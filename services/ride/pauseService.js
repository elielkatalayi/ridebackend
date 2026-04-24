const { Ride, RidePause } = require('../../models');
const pricingService = require('../pricing/pricingService');

class PauseService {
  /**
   * Démarrer une pause pendant une course
   * @param {string} rideId - ID de la course
   * @param {string} driverId - ID du chauffeur
   * @returns {Promise<Object>}
   */
  async startPause(rideId, driverId) {
    const ride = await Ride.findOne({
      where: {
        id: rideId,
        driver_id: driverId,
        status: 'ongoing'
      },
      include: ['category']
    });
    
    if (!ride) {
      throw new Error('Course non trouvée ou non en cours');
    }
    
    // Vérifier s'il y a déjà une pause active
    const activePause = await RidePause.findOne({
      where: {
        ride_id: rideId,
        status: 'active'
      }
    });
    
    if (activePause) {
      throw new Error('Une pause est déjà en cours');
    }
    
    // Récupérer le tarif de pause
    const pauseRate = ride.category.pause_per_minute;
    
    // Créer la pause
    const pause = await RidePause.create({
      ride_id: rideId,
      pause_start: new Date(),
      rate_per_minute: pauseRate,
      status: 'active'
    });
    
    // Mettre à jour le statut de la course
    await ride.update({
      status: 'paused',
      paused_at: new Date()
    });
    
    return pause;
  }

  /**
   * Terminer une pause
   * @param {string} rideId - ID de la course
   * @param {string} driverId - ID du chauffeur
   * @returns {Promise<Object>}
   */
  async endPause(rideId, driverId) {
    const ride = await Ride.findOne({
      where: {
        id: rideId,
        driver_id: driverId,
        status: 'paused'
      }
    });
    
    if (!ride) {
      throw new Error('Course non trouvée ou non en pause');
    }
    
    // Récupérer la pause active
    const activePause = await RidePause.findOne({
      where: {
        ride_id: rideId,
        status: 'active'
      }
    });
    
    if (!activePause) {
      throw new Error('Aucune pause active');
    }
    
    // Calculer la durée de la pause
    const endTime = new Date();
    const durationSeconds = Math.floor((endTime - activePause.pause_start) / 1000);
    const durationMinutes = Math.ceil(durationSeconds / 60);
    
    // Calculer le montant facturé
    const amount = durationMinutes * activePause.rate_per_minute;
    
    // Terminer la pause
    await activePause.update({
      pause_end: endTime,
      duration_seconds: durationSeconds,
      amount_charged: amount,
      status: 'ended'
    });
    
    // Mettre à jour la course
    await ride.update({
      status: 'ongoing',
      resumed_at: new Date()
    });
    
    // Mettre à jour le prix final de la course
    const currentPrice = ride.price_final || ride.price_negotiated || ride.price_suggested;
    await ride.update({
      price_final: currentPrice + amount,
      price_breakdown: {
        ...ride.price_breakdown,
        pause_charge: amount,
        pause_minutes: durationMinutes
      }
    });
    
    return {
      pause: activePause,
      durationMinutes,
      amountCharged: amount
    };
  }

  /**
   * Obtenir les pauses d'une course
   * @param {string} rideId - ID de la course
   * @returns {Promise<Array>}
   */
  async getRidePauses(rideId) {
    const pauses = await RidePause.findAll({
      where: { ride_id: rideId },
      order: [['pause_start', 'ASC']]
    });
    
    return pauses;
  }
}

module.exports = new PauseService();