const { Ride, RideStop } = require('../../models');
const googleMaps = require('../../config/googleMaps');

class StopService {
  /**
   * Ajouter un arrêt intermédiaire à une course
   * @param {string} rideId - ID de la course
   * @param {Object} stopData - Données de l'arrêt
   * @returns {Promise<Object>}
   */
  async addStop(rideId, stopData) {
    const { lat, lng, address, name } = stopData;
    
    const ride = await Ride.findByPk(rideId);
    if (!ride) {
      throw new Error('Course non trouvée');
    }
    
    if (ride.status !== 'ongoing') {
      throw new Error('Impossible d\'ajouter un arrêt en dehors d\'une course en cours');
    }
    
    // Compter les arrêts existants
    const existingStops = await RideStop.count({
      where: { ride_id: rideId }
    });
    
    // Créer l'arrêt
    const stop = await RideStop.create({
      ride_id: rideId,
      stop_order: existingStops + 1,
      lat,
      lng,
      address,
      name,
      is_extra: true
    });
    
    return stop;
  }

  /**
   * Marquer un arrêt comme atteint
   * @param {string} stopId - ID de l'arrêt
   * @returns {Promise<Object>}
   */
  async markStopArrived(stopId) {
    const stop = await RideStop.findByPk(stopId);
    if (!stop) {
      throw new Error('Arrêt non trouvé');
    }
    
    await stop.update({
      arrived_at: new Date()
    });
    
    return stop;
  }

  /**
   * Recalculer le prix après ajout d'arrêts
   * @param {string} rideId - ID de la course
   * @returns {Promise<Object>}
   */
  async recalculatePriceWithStops(rideId) {
    const ride = await Ride.findByPk(rideId, {
      include: ['category', 'stops']
    });
    
    if (!ride) {
      throw new Error('Course non trouvée');
    }
    
    // Calculer le détour total
    let totalExtraDistance = 0;
    let totalExtraCharge = 0;
    
    // Pour simplifier, on ajoute un forfait par arrêt
    const extraStops = ride.stops.filter(s => s.is_extra);
    const extraStopFee = extraStops.length * 500; // 500 FC par arrêt
    
    // Mettre à jour le prix
    const currentPrice = ride.price_final || ride.price_negotiated || ride.price_suggested;
    const newPrice = currentPrice + extraStopFee;
    
    await ride.update({
      price_final: newPrice,
      price_breakdown: {
        ...ride.price_breakdown,
        extra_stops_charge: extraStopFee,
        extra_stops_count: extraStops.length
      }
    });
    
    // Mettre à jour chaque arrêt avec son adjustment
    for (const stop of extraStops) {
      await stop.update({ price_adjustment: 500 });
    }
    
    return {
      originalPrice: currentPrice,
      extraStopFee,
      newPrice,
      extraStopsCount: extraStops.length
    };
  }

  /**
   * Obtenir les arrêts d'une course
   * @param {string} rideId - ID de la course
   * @returns {Promise<Array>}
   */
  async getRideStops(rideId) {
    const stops = await RideStop.findAll({
      where: { ride_id: rideId },
      order: [['stop_order', 'ASC']]
    });
    
    return stops;
  }
}

module.exports = new StopService();