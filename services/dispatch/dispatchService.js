const { Op } = require('sequelize');
const { Driver, DispatchSetting, PlatformSetting, User } = require('../../models');
const driverMatcher = require('./driverMatcher');
const { sequelize } = require('../../config/database');
const NotificationService = require('../notification/NotificationService');
const SocketService = require('../notification/SocketService');

class DispatchService {
  /**
   * Trouver les chauffeurs disponibles pour une course
   * @param {Object} pickup - Point de prise en charge {lat, lng}
   * @param {string} categoryId - ID de la catégorie
   * @returns {Promise<Array>}
   */
  async findAvailableDrivers(pickup, categoryId) {
    try {
      // Récupérer les paramètres de dispatch par défaut
      const dispatchSettings = await DispatchSetting.findOne({
        where: {
          city_id: null
        },
        limit: 1
      });
      
      const maxRadius = dispatchSettings?.max_search_radius_km || 5;
      const maxDrivers = dispatchSettings?.max_drivers_notified || 10;
      
      // Récupérer le seuil de points minimum
      const suspensionThreshold = await PlatformSetting.findOne({
        where: { setting_key: 'driver_points_suspension_threshold' }
      });
      const minPoints = parseInt(suspensionThreshold?.setting_value) || 300;
      
      // ✅ Chercher les chauffeurs disponibles avec conditions
      const availableDrivers = await Driver.findAll({
        where: {
          is_approved: true,
          is_online: true,
          is_suspended: false,
          is_blocked_for_negative_balance: false,  // ← Exclure les chauffeurs bloqués pour solde négatif
          activity_points: { [Op.gte]: minPoints },
          current_lat: { [Op.ne]: null },
          current_lng: { [Op.ne]: null }
        },
        include: [
          { 
            model: User, 
            as: 'user',
            attributes: ['id', 'first_name', 'last_name', 'phone', 'avatar_url']
          }
        ],
        limit: 50
      });
      
      if (!availableDrivers.length) {
        console.log('📢 Aucun chauffeur disponible trouvé');
        return [];
      }
      
      // Filtrer par distance
      const driversWithDistance = availableDrivers.map(driver => {
        const distance = this.calculateDistance(
          pickup.lat,
          pickup.lng,
          parseFloat(driver.current_lat),
          parseFloat(driver.current_lng)
        );
        return { driver, distance };
      }).filter(item => item.distance <= maxRadius);
      
      // Trier par score (points + proximité)
      const pointsWeight = parseFloat(dispatchSettings?.points_weight) || 0.6;
      const distanceWeight = parseFloat(dispatchSettings?.distance_weight) || 0.4;
      
      const scoredDrivers = driverMatcher.calculateScores(
        driversWithDistance,
        pointsWeight,
        distanceWeight,
        maxRadius
      );
      
      // Prendre les meilleurs
      return scoredDrivers.slice(0, maxDrivers);
      
    } catch (error) {
      console.error('❌ Erreur findAvailableDrivers:', error.message);
      return [];
    }
  }

  /**
   * Calculer la distance entre deux points (formule de Haversine)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Notifier les chauffeurs d'une nouvelle course
   */
  async notifyDrivers(drivers, rideData) {
    console.log(`📢 Notification envoyée à ${drivers.length} chauffeurs pour la course ${rideData.id}`);
    
    for (const item of drivers) {
      const driver = item.driver;
      const driverUserId = driver.user_id;
      
      SocketService.sendToUser(driverUserId, 'ride:new_request', {
        ride_id: rideData.id,
        pickup: {
          lat: rideData.origin_lat,
          lng: rideData.origin_lng,
          address: rideData.origin_address
        },
        distance: item.distance,
        estimated_price: rideData.price_suggested,
        category: rideData.category_id,
        expires_in: 15
      });
      
      await NotificationService.sendRideNotification(
        driverUserId,
        rideData.id,
        'new_ride_request',
        {
          distance: item.distance.toFixed(1),
          price: rideData.price_suggested,
          pickup: rideData.origin_address,
          expires_in: 15
        }
      );
      
      console.log(`   📱 Notification à chauffeur: ${rideData.price_suggested} FC`);
    }
    
    return { notified: drivers.length };
  }

  /**
   * Notifier qu'une course a expiré
   */
  async notifyRideExpired(passengerId, rideId) {
    await NotificationService.sendRideNotification(
      passengerId,
      rideId,
      'ride_expired',
      {
        message: 'Aucun chauffeur disponible pour le moment. Veuillez réessayer plus tard.'
      }
    );
    
    SocketService.sendToUser(passengerId, 'ride:expired', {
      ride_id: rideId,
      message: 'Aucun chauffeur trouvé'
    });
  }

  /**
   * Notifier qu'un chauffeur a été trouvé
   */
  async notifyDriverFound(passengerId, rideId, driver) {
    await NotificationService.sendRideNotification(
      passengerId,
      rideId,
      'driver_found',
      {
        driver_name: driver.user?.first_name,
        driver_rating: driver.rating,
        vehicle_model: driver.vehicle_model,
        vehicle_plate: driver.vehicle_plate,
        eta: 5
      }
    );
    
    SocketService.sendToUser(passengerId, 'ride:driver_found', {
      ride_id: rideId,
      driver: {
        id: driver.id,
        name: driver.user?.first_name,
        rating: driver.rating,
        vehicle: {
          model: driver.vehicle_model,
          plate: driver.vehicle_plate,
          color: driver.vehicle_color
        },
        location: {
          lat: driver.current_lat,
          lng: driver.current_lng
        }
      }
    });
  }

  /**
   * Assigner un chauffeur à une course
   */
  async assignDriver(rideId, driverId) {
    const { Ride } = require('../../models');
    
    const ride = await Ride.findByPk(rideId);
    if (!ride) {
      throw new Error('Course non trouvée');
    }
    
    if (ride.status !== 'pending' && ride.status !== 'negotiating') {
      throw new Error('Course déjà assignée ou annulée');
    }
    
    await ride.update({
      driver_id: driverId,
      status: 'accepted',
      accepted_at: new Date()
    });
    
    return ride;
  }
}

module.exports = new DispatchService();