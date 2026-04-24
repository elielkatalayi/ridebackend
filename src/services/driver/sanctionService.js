const { Driver, CancellationSetting, PlatformSetting, User } = require('../../models');
const pointsService = require('./pointsService');
const { sequelize } = require('../../config/database');
const NotificationService = require('../notification/NotificationService');

class SanctionService {
  /**
   * Vérifier et appliquer les sanctions pour annulation
   * @param {string} driverId - ID du chauffeur
   * @param {string} rideId - ID de la course
   * @param {boolean} isDuringFreeWait - Annulation pendant temps gratuit ?
   * @returns {Promise<Object>}
   */
  async handleDriverCancellation(driverId, rideId, isDuringFreeWait) {
    const transaction = await sequelize.transaction();
    
    try {
      const driver = await Driver.findByPk(driverId, { 
        include: [{ model: User, as: 'user' }],
        transaction 
      });
      if (!driver) {
        throw new Error('Chauffeur non trouvé');
      }
      
      // Incrémenter le compteur d'annulations
      await driver.increment('total_cancellations', { transaction });
      
      let result;
      let actionType;
      
      if (isDuringFreeWait) {
        // Annulation pendant temps gratuit - sanction plus lourde
        actionType = 'cancel_during_free_wait';
        result = await pointsService.updateDriverPoints(
          driverId, 
          actionType, 
          'ride', 
          rideId
        );
      } else {
        // Annulation après temps gratuit
        actionType = 'cancel_after_free_wait';
        result = await pointsService.updateDriverPoints(
          driverId, 
          actionType, 
          'ride', 
          rideId
        );
      }
      
      // Notification supplémentaire pour annulation
      await NotificationService.sendDriverNotification(
        driver.user_id,
        'sanction',
        {
          action: 'cancellation',
          points_change: result.pointsChange,
          new_points: result.newPoints,
          is_during_free_wait: isDuringFreeWait,
          ride_id: rideId
        }
      );
      
      await transaction.commit();
      
      return {
        success: true,
        pointsChange: result.pointsChange,
        newPoints: result.newPoints,
        isSuspended: result.isSuspended,
        totalCancellations: driver.total_cancellations + 1
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Vérifier et appliquer les sanctions pour refus après acceptation
   * @param {string} driverId - ID du chauffeur
   * @param {string} rideId - ID de la course
   * @returns {Promise<Object>}
   */
  async handleDriverRefusal(driverId, rideId) {
    const result = await pointsService.updateDriverPoints(driverId, 'refuse_after_acceptance', 'ride', rideId);
    
    const driver = await Driver.findByPk(driverId, { include: [{ model: User, as: 'user' }] });
    if (driver) {
      await NotificationService.sendDriverNotification(
        driver.user_id,
        'sanction',
        {
          action: 'refusal',
          points_change: result.pointsChange,
          new_points: result.newPoints,
          ride_id: rideId
        }
      );
    }
    
    return result;
  }

  /**
   * Vérifier et appliquer les sanctions pour signalement
   * @param {string} driverId - ID du chauffeur
   * @param {string} reportReason - Raison du signalement
   * @returns {Promise<Object>}
   */
  async handleDriverReport(driverId, reportReason) {
    const transaction = await sequelize.transaction();
    
    try {
      const driver = await Driver.findByPk(driverId, { 
        include: [{ model: User, as: 'user' }],
        transaction 
      });
      if (!driver) {
        throw new Error('Chauffeur non trouvé');
      }
      
      await driver.increment('total_reports', { transaction });
      
      let result;
      let actionType;
      
      if (reportReason === 'dangerous_driving') {
        actionType = 'report_dangerous_driving';
        result = await pointsService.updateDriverPoints(driverId, actionType);
      } else {
        actionType = 'report_other';
        result = await pointsService.updateDriverPoints(driverId, actionType);
      }
      
      // Notification pour signalement
      await NotificationService.sendDriverNotification(
        driver.user_id,
        'sanction',
        {
          action: 'report',
          reason: reportReason,
          points_change: result.pointsChange,
          new_points: result.newPoints
        }
      );
      
      await transaction.commit();
      
      return {
        success: true,
        pointsChange: result.pointsChange,
        newPoints: result.newPoints,
        totalReports: driver.total_reports + 1
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Vérifier les conditions d'exclusion définitive
   * @param {string} driverId - ID du chauffeur
   * @returns {Promise<boolean>}
   */
  async checkPermanentExclusion(driverId) {
    const exclusionThreshold = await PlatformSetting.findOne({
      where: { setting_key: 'driver_exclusion_after_relapses' }
    });
    const maxRelapses = parseInt(exclusionThreshold?.setting_value) || 2;
    
    // Compter le nombre de suspensions déjà subies
    const driver = await Driver.findByPk(driverId);
    if (!driver) {
      return false;
    }
    
    // Cette logique nécessite un historique des suspensions
    // À implémenter avec une table driver_suspension_history
    
    const shouldExclude = driver.total_cancellations > maxRelapses * 5; // Approximation
    
    if (shouldExclude && driver.user_id) {
      await NotificationService.sendDriverNotification(
        driver.user_id,
        'permanent_exclusion',
        {
          reason: 'Trop de récidives',
          total_cancellations: driver.total_cancellations,
          max_allowed: maxRelapses * 5
        }
      );
    }
    
    return shouldExclude;
  }

  /**
   * Vérifier si un chauffeur peut être réactivé après formation
   * @param {string} driverId - ID du chauffeur
   * @returns {Promise<Object>}
   */
  async canReactivate(driverId) {
    const driver = await Driver.findByPk(driverId, { include: [{ model: User, as: 'user' }] });
    if (!driver) {
      throw new Error('Chauffeur non trouvé');
    }
    
    const waitDays = await PlatformSetting.findOne({
      where: { setting_key: 'driver_reactivation_wait_days' }
    });
    const daysNeeded = parseInt(waitDays?.setting_value) || 7;
    
    if (!driver.suspended_at) {
      return { canReactivate: false, reason: 'Chauffeur non suspendu' };
    }
    
    const daysSinceSuspension = Math.floor(
      (new Date() - driver.suspended_at) / (1000 * 60 * 60 * 24)
    );
    
    const hasCompletedTraining = false; // À vérifier depuis une table training_completion
    
    const result = {
      canReactivate: daysSinceSuspension >= daysNeeded && hasCompletedTraining,
      daysSinceSuspension,
      daysNeeded
    };
    
    // Notification de rappel de réactivation
    if (daysSinceSuspension >= daysNeeded && !hasCompletedTraining && driver.user_id) {
      await NotificationService.sendDriverNotification(
        driver.user_id,
        'reactivation_reminder',
        {
          message: 'Vous êtes éligible à la réactivation. Veuillez compléter la formation.',
          days_since_suspension: daysSinceSuspension
        }
      );
    }
    
    if (daysSinceSuspension >= daysNeeded && hasCompletedTraining) {
      return { canReactivate: true };
    }
    
    return {
      canReactivate: false,
      daysRemaining: Math.max(0, daysNeeded - daysSinceSuspension),
      trainingRequired: !hasCompletedTraining
    };
  }

  /**
   * Appliquer une amende de points (sans argent)
   * @param {string} driverId - ID du chauffeur
   * @param {string} reason - Raison
   * @param {number} pointsAmount - Nombre de points à retirer
   * @returns {Promise<Object>}
   */
  async applyPointsPenalty(driverId, reason, pointsAmount) {
    const transaction = await sequelize.transaction();
    
    try {
      const driver = await Driver.findByPk(driverId, { 
        include: [{ model: User, as: 'user' }],
        transaction 
      });
      if (!driver) {
        throw new Error('Chauffeur non trouvé');
      }
      
      const previousPoints = driver.activity_points;
      const newPoints = Math.max(0, previousPoints - pointsAmount);
      
      await driver.update({ activity_points: newPoints }, { transaction });
      
      await DriverPointsHistory.create({
        driver_id: driverId,
        points_change: -pointsAmount,
        reason: `penalty_${reason}`,
        previous_points: previousPoints,
        new_points: newPoints
      }, { transaction });
      
      // Notification de pénalité
      await NotificationService.sendDriverNotification(
        driver.user_id,
        'points_penalty',
        {
          reason: reason,
          points_removed: pointsAmount,
          previous_points: previousPoints,
          new_points: newPoints
        }
      );
      
      await transaction.commit();
      
      return {
        success: true,
        pointsRemoved: pointsAmount,
        previousPoints,
        newPoints
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Appliquer une récompense de points
   * @param {string} driverId - ID du chauffeur
   * @param {string} reason - Raison
   * @param {number} pointsAmount - Nombre de points à ajouter
   * @returns {Promise<Object>}
   */
  async applyPointsReward(driverId, reason, pointsAmount) {
    const transaction = await sequelize.transaction();
    
    try {
      const driver = await Driver.findByPk(driverId, { 
        include: [{ model: User, as: 'user' }],
        transaction 
      });
      if (!driver) {
        throw new Error('Chauffeur non trouvé');
      }
      
      const previousPoints = driver.activity_points;
      const newPoints = Math.min(1000, previousPoints + pointsAmount);
      
      await driver.update({ activity_points: newPoints }, { transaction });
      
      await DriverPointsHistory.create({
        driver_id: driverId,
        points_change: pointsAmount,
        reason: `reward_${reason}`,
        previous_points: previousPoints,
        new_points: newPoints
      }, { transaction });
      
      // Notification de récompense
      await NotificationService.sendDriverNotification(
        driver.user_id,
        'points_reward',
        {
          reason: reason,
          points_added: pointsAmount,
          previous_points: previousPoints,
          new_points: newPoints
        }
      );
      
      await transaction.commit();
      
      return {
        success: true,
        pointsAdded: pointsAmount,
        previousPoints,
        newPoints
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = new SanctionService();