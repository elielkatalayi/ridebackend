const { Driver, DriverPointsHistory, SanctionRule, PlatformSetting, User } = require('../../models');
const { sequelize } = require('../../config/database');
const NotificationService = require('../notification/NotificationService');

class PointsService {
  /**
   * Ajouter ou retirer des points à un chauffeur
   * @param {string} driverId - ID du chauffeur
   * @param {string} action - Action à l'origine du changement
   * @param {string} referenceType - Type de référence (ride, etc.)
   * @param {string} referenceId - ID de référence
   * @returns {Promise<Object>}
   */
  async updateDriverPoints(driverId, action, referenceType = null, referenceId = null) {
    const transaction = await sequelize.transaction();
    
    try {
      // Récupérer le chauffeur
      const driver = await Driver.findByPk(driverId, { 
        include: [{ model: User, as: 'user' }],
        transaction 
      });
      if (!driver) {
        throw new Error('Chauffeur non trouvé');
      }
      
      // Récupérer la règle de sanction correspondante
      const sanctionRule = await SanctionRule.findOne({
        where: {
          user_type: 'driver',
          action: action,
          is_active: true
        },
        transaction
      });
      
      if (!sanctionRule) {
        // Pas de règle définie pour cette action, on ignore
        return { success: true, pointsChanged: 0 };
      }
      
      const pointsChange = sanctionRule.points_change;
      const previousPoints = driver.activity_points;
      let newPoints = previousPoints + pointsChange;
      
      // Limiter les points entre 0 et 1000
      newPoints = Math.max(0, Math.min(1000, newPoints));
      
      // Mettre à jour les points du chauffeur
      await driver.update({ activity_points: newPoints }, { transaction });
      
      // Enregistrer l'historique
      await DriverPointsHistory.create({
        driver_id: driverId,
        points_change: pointsChange,
        reason: action,
        reference_type: referenceType,
        reference_id: referenceId,
        previous_points: previousPoints,
        new_points: newPoints
      }, { transaction });
      
      // Notification du changement de points
      if (pointsChange !== 0) {
        const pointsText = pointsChange > 0 ? `+${pointsChange}` : `${pointsChange}`;
        await NotificationService.sendDriverNotification(
          driver.user_id,
          'points_change',
          {
            points_change: pointsChange,
            points_text: pointsText,
            previous_points: previousPoints,
            new_points: newPoints,
            reason: action,
            reference_id: referenceId
          }
        );
      }
      
      // Vérifier si le chauffeur doit être suspendu
      const suspensionThreshold = await PlatformSetting.findOne({
        where: { setting_key: 'driver_points_suspension_threshold' },
        transaction
      });
      const threshold = parseInt(suspensionThreshold?.setting_value) || 300;
      
      if (newPoints < threshold && previousPoints >= threshold) {
        // Déclencher la suspension
        const driverService = require('./driverService');
        await driverService.suspendDriver(driverId, `Points inférieurs à ${threshold}`, 7);
        
        // Notification de suspension
        await NotificationService.sendDriverNotification(
          driver.user_id,
          'suspended',
          {
            reason: `Points inférieurs à ${threshold}`,
            current_points: newPoints,
            threshold: threshold
          }
        );
      }
      
      await transaction.commit();
      
      return {
        success: true,
        pointsChange,
        previousPoints,
        newPoints,
        isSuspended: newPoints < threshold
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Appliquer les points pour une course complétée
   * @param {string} driverId - ID du chauffeur
   * @param {string} rideId - ID de la course
   * @returns {Promise<Object>}
   */
  async onRideCompleted(driverId, rideId) {
    return this.updateDriverPoints(driverId, 'ride_completed', 'ride', rideId);
  }

  /**
   * Appliquer les points pour une annulation pendant temps gratuit
   * @param {string} driverId - ID du chauffeur
   * @param {string} rideId - ID de la course
   * @returns {Promise<Object>}
   */
  async onCancelDuringFreeWait(driverId, rideId) {
    return this.updateDriverPoints(driverId, 'cancel_during_free_wait', 'ride', rideId);
  }

  /**
   * Appliquer les points pour une annulation après temps gratuit
   * @param {string} driverId - ID du chauffeur
   * @param {string} rideId - ID de la course
   * @returns {Promise<Object>}
   */
  async onCancelAfterFreeWait(driverId, rideId) {
    return this.updateDriverPoints(driverId, 'cancel_after_free_wait', 'ride', rideId);
  }

  /**
   * Appliquer les points pour un refus après acceptation
   * @param {string} driverId - ID du chauffeur
   * @param {string} rideId - ID de la course
   * @returns {Promise<Object>}
   */
  async onRefuseAfterAcceptance(driverId, rideId) {
    return this.updateDriverPoints(driverId, 'refuse_after_acceptance', 'ride', rideId);
  }

  /**
   * Appliquer les points pour une évaluation (rating)
   * @param {string} driverId - ID du chauffeur
   * @param {number} rating - Note (1-5)
   * @param {string} rideId - ID de la course
   * @returns {Promise<Object>}
   */
  async onRatingReceived(driverId, rating, rideId) {
    let action;
    if (rating === 5) {
      action = 'high_rating_5star';
    } else if (rating === 4) {
      action = 'high_rating_4star';
    } else if (rating === 2) {
      action = 'low_rating_2star';
    } else if (rating === 1) {
      action = 'low_rating_1star';
    } else {
      return { success: true, pointsChanged: 0 };
    }
    
    return this.updateDriverPoints(driverId, action, 'ride', rideId);
  }

  /**
   * Appliquer les points pour arrivée en avance
   * @param {string} driverId - ID du chauffeur
   * @param {string} rideId - ID de la course
   * @returns {Promise<Object>}
   */
  async onArriveEarly(driverId, rideId) {
    return this.updateDriverPoints(driverId, 'arrive_early_5min', 'ride', rideId);
  }

  /**
   * Appliquer le bonus pour 100 courses sans annulation
   * @param {string} driverId - ID du chauffeur
   * @returns {Promise<Object>}
   */
  async on100RidesNoCancel(driverId) {
    return this.updateDriverPoints(driverId, '100_rides_no_cancel');
  }

  /**
   * Réactiver un chauffeur après formation
   * @param {string} driverId - ID du chauffeur
   * @returns {Promise<Object>}
   */
  async reactivateAfterTraining(driverId) {
    const transaction = await sequelize.transaction();
    
    try {
      const reactivationPoints = await PlatformSetting.findOne({
        where: { setting_key: 'driver_points_reactivation' },
        transaction
      });
      const pointsValue = parseInt(reactivationPoints?.setting_value) || 300;
      
      const driver = await Driver.findByPk(driverId, { 
        include: [{ model: User, as: 'user' }],
        transaction 
      });
      if (!driver) {
        throw new Error('Chauffeur non trouvé');
      }
      
      const previousPoints = driver.activity_points;
      
      await driver.update({
        activity_points: pointsValue,
        is_suspended: false,
        suspension_reason: null,
        suspended_at: null,
        suspended_until: null
      }, { transaction });
      
      await DriverPointsHistory.create({
        driver_id: driverId,
        points_change: pointsValue - previousPoints,
        reason: 'reactivation_after_training',
        previous_points: previousPoints,
        new_points: pointsValue
      }, { transaction });
      
      await transaction.commit();
      
      // Notification de réactivation
      await NotificationService.sendDriverNotification(
        driver.user_id,
        'approved',
        {
          message: `Votre compte a été réactivé avec ${pointsValue} points`,
          new_points: pointsValue
        }
      );
      
      return {
        success: true,
        previousPoints,
        newPoints: pointsValue
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Obtenir l'historique des points d'un chauffeur
   * @param {string} driverId - ID du chauffeur
   * @param {Object} options - Pagination
   * @returns {Promise<Object>}
   */
  async getPointsHistory(driverId, { limit = 50, offset = 0 }) {
    const history = await DriverPointsHistory.findAndCountAll({
      where: { driver_id: driverId },
      order: [['created_at', 'DESC']],
      limit,
      offset
    });
    
    return history;
  }

  /**
   * Obtenir le classement des chauffeurs (leaderboard)
   * @param {string} cityId - ID de la ville (optionnel)
   * @param {number} limit - Nombre de chauffeurs
   * @returns {Promise<Array>}
   */
  async getLeaderboard(cityId = null, limit = 100) {
    const where = { is_approved: true };
    if (cityId) {
      where.city_id = cityId;
    }
    
    const drivers = await Driver.findAll({
      where,
      attributes: ['id', 'activity_points', 'rating', 'total_rides'],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['first_name', 'last_name', 'avatar_url']
        }
      ],
      order: [['activity_points', 'DESC']],
      limit
    });
    
    return drivers;
  }
}

module.exports = new PointsService();