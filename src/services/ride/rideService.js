const { Ride, User, Driver, Category, Wallet, WalletTransaction } = require('../../models');
const pricingService = require('../pricing/pricingService');
const dispatchService = require('../dispatch/dispatchService');
const { sequelize } = require('../../config/database');

class RideService {
  /**
   * Créer une nouvelle demande de course
   * @param {Object} rideData - Données de la course
   * @returns {Promise<Object>}
   */
  async createRide(rideData) {
    const {
      passenger_id,
      category_id,
      origin_lat,
      origin_lng,
      origin_address,
      destination_lat,
      destination_lng,
      destination_address
    } = rideData;
    
    // Vérifier que le passager existe
    const passenger = await User.findByPk(passenger_id);
    if (!passenger) {
      throw new Error('Passager non trouvé');
    }
    
    // Vérifier que la catégorie existe
    const category = await Category.findByPk(category_id);
    if (!category) {
      throw new Error('Catégorie non trouvée');
    }
    
    // Calculer le prix suggéré
    const priceEstimate = await pricingService.estimatePrice(
      { lat: origin_lat, lng: origin_lng },
      { lat: destination_lat, lng: destination_lng },
      category_id
    );
    
    // Créer la course
    const ride = await Ride.create({
      passenger_id,
      category_id,
      origin_lat,
      origin_lng,
      origin_address,
      destination_lat,
      destination_lng,
      destination_address,
      distance_meters: priceEstimate.distanceMeters,
      duration_with_traffic_sec: priceEstimate.durationSec,
      duration_without_traffic_sec: priceEstimate.durationWithoutTrafficMin * 60,
      price_suggested: priceEstimate.suggestedPrice,
      status: 'pending'
    });
    
    // Chercher des chauffeurs disponibles
    const availableDrivers = await dispatchService.findAvailableDrivers(
      { lat: origin_lat, lng: origin_lng },
      category_id
    );
    
    // Notifier les chauffeurs
    await dispatchService.notifyDrivers(availableDrivers, ride);
    
    return {
      ride,
      priceEstimate,
      driversNotified: availableDrivers.length
    };
  }

  /**
   * Obtenir les détails d'une course
   * @param {string} rideId - ID de la course
   * @returns {Promise<Object>}
   */
  async getRideById(rideId) {
    const ride = await Ride.findByPk(rideId, {
      include: [
        { model: User, as: 'passenger', attributes: { exclude: ['password_hash'] } },
        { model: Driver, as: 'driver', include: ['user'] },
        { model: Category, as: 'category' }
      ]
    });
    
    if (!ride) {
      throw new Error('Course non trouvée');
    }
    
    return ride;
  }

  /**
   * Accepter une course (par un chauffeur)
   * @param {string} rideId - ID de la course
   * @param {string} driverId - ID du chauffeur
   * @returns {Promise<Object>}
   */
  async acceptRide(rideId, driverId) {
    const ride = await Ride.findByPk(rideId);
    if (!ride) {
      throw new Error('Course non trouvée');
    }
    
    if (ride.status !== 'pending' && ride.status !== 'negotiating') {
      throw new Error('Course non disponible');
    }
    
    const driver = await Driver.findByPk(driverId);
    if (!driver) {
      throw new Error('Chauffeur non trouvé');
    }
    
    await ride.update({
      driver_id: driverId,
      status: 'accepted',
      accepted_at: new Date()
    });
    
    return ride;
  }

  /**
   * Démarrer une course
   * @param {string} rideId - ID de la course
   * @param {string} driverId - ID du chauffeur
   * @returns {Promise<Object>}
   */
  async startRide(rideId, driverId) {
    const ride = await Ride.findOne({
      where: {
        id: rideId,
        driver_id: driverId
      }
    });
    
    if (!ride) {
      throw new Error('Course non trouvée');
    }
    
    if (ride.status !== 'driver_arrived' && ride.status !== 'accepted') {
      throw new Error('Course non prête à démarrer');
    }
    
    await ride.update({
      status: 'ongoing',
      started_at: new Date()
    });
    
    return ride;
  }

  /**
   * Terminer une course
   * @param {string} rideId - ID de la course
   * @param {string} driverId - ID du chauffeur
   * @returns {Promise<Object>}
   */
  async completeRide(rideId, driverId) {
    const ride = await Ride.findOne({
      where: {
        id: rideId,
        driver_id: driverId
      }
    });
    
    if (!ride) {
      throw new Error('Course non trouvée');
    }
    
    if (ride.status !== 'ongoing') {
      throw new Error('Course non en cours');
    }
    
    await ride.update({
      status: 'completed',
      completed_at: new Date()
    });
    
    return ride;
  }

  /**
   * Annuler une course
   * @param {string} rideId - ID de la course
   * @param {string} cancelledBy - 'passenger', 'driver', 'system'
   * @param {string} reason - Raison de l'annulation
   * @returns {Promise<Object>}
   */
  async cancelRide(rideId, cancelledBy, reason) {
    const ride = await Ride.findByPk(rideId);
    if (!ride) {
      throw new Error('Course non trouvée');
    }
    
    if (ride.status === 'completed') {
      throw new Error('Course déjà terminée');
    }
    
    await ride.update({
      status: 'cancelled',
      cancelled_at: new Date(),
      cancelled_by: cancelledBy,
      cancel_reason: reason
    });
    
    return ride;
  }

  /**
   * Mettre à jour la position GPS d'une course
   * @param {string} rideId - ID de la course
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Promise<void>}
   */
  async updateRideLocation(rideId, lat, lng) {
    console.log(`Course ${rideId} position: ${lat}, ${lng}`);
  }
}

module.exports = new RideService();
 