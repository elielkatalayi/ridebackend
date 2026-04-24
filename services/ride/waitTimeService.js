// services/ride/waitTimeService.js

const { Ride, RideWaitTime } = require('../../models');

class WaitTimeService {
  /**
   * Enregistrer l'arrivée du chauffeur
   * POST /rides/:rideId/driver-arrived
   */
  async driverArrived(rideId, driverId) {
    const ride = await Ride.findOne({
      where: { id: rideId, driver_id: driverId }
    });
    
    if (!ride) {
      throw new Error('Course non trouvée');
    }
    
    if (ride.status !== 'accepted') {
      throw new Error('Course non acceptée');
    }
    
    // Créer l'enregistrement d'attente
    const waitTime = await RideWaitTime.create({
      ride_id: rideId,
      driver_arrived_at: new Date(),
      status: 'waiting',
      free_minutes_allocated: 5
    });
    
    // Mettre à jour le statut de la course
    await ride.update({
      status: 'driver_arrived',
      driver_arrived_at: new Date()
    });
    
    return {
      ride,
      waitTime,
      freeMinutes: 5,
      message: 'Chauffeur arrivé, attente démarrée'
    };
  }

  /**
   * Terminer l'attente (passager monte)
   * POST /rides/:rideId/start (appelé avant de démarrer)
   */
  async endWait(rideId) {
    const ride = await Ride.findByPk(rideId);
    if (!ride) {
      throw new Error('Course non trouvée');
    }
    
    const waitTime = await RideWaitTime.findOne({
      where: { ride_id: rideId, status: 'waiting' }
    });
    
    if (waitTime) {
      const now = new Date();
      const waitSeconds = Math.floor((now - waitTime.driver_arrived_at) / 1000);
      const waitMinutes = Math.ceil(waitSeconds / 60);
      
      await waitTime.update({
        passenger_boarding_at: now,
        wait_started_at: waitTime.driver_arrived_at,
        wait_ended_at: now,
        free_minutes_used: Math.min(waitMinutes, waitTime.free_minutes_allocated || 5),
        paid_seconds: Math.max(0, waitSeconds - (waitTime.free_minutes_allocated || 5) * 60),
        status: 'completed'
      });
      
      return {
        waitTime,
        waitSeconds,
        waitMinutes,
        freeMinutesUsed: waitTime.free_minutes_allocated || 5,
        paidSeconds: Math.max(0, waitSeconds - (waitTime.free_minutes_allocated || 5) * 60)
      };
    }
    
    return { waitTime: null };
  }

  /**
   * Obtenir le temps d'attente actuel
   */
  async getCurrentWaitTime(rideId) {
    const waitTime = await RideWaitTime.findOne({
      where: { ride_id: rideId, status: 'waiting' }
    });
    
    if (!waitTime) {
      return { waiting: false };
    }
    
    const now = new Date();
    const waitSeconds = Math.floor((now - waitTime.driver_arrived_at) / 1000);
    const freeSeconds = (waitTime.free_minutes_allocated || 5) * 60;
    
    return {
      waiting: true,
      totalSeconds: waitSeconds,
      totalMinutes: Math.ceil(waitSeconds / 60),
      freeSecondsRemaining: Math.max(0, freeSeconds - waitSeconds),
      isPaid: waitSeconds > freeSeconds,
      paidSeconds: Math.max(0, waitSeconds - freeSeconds),
      driverArrivedAt: waitTime.driver_arrived_at
    };
  }
}

module.exports = new WaitTimeService();