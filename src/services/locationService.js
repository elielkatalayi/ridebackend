// services/locationService.js
const { UserLocation, User, Ride ,sequelize } = require('../models');
const { Op } = require('sequelize');

class LocationService {
  
  /**
   * Mettre à jour la position d'un utilisateur
   */
  async updateLocation(userId, locationData, userType = 'both') {
    const {
      latitude,
      longitude,
      accuracy = 0,
      speed = 0,
      heading = 0,
      altitude = null,
      metadata = {},
      active_ride_id = null
    } = locationData;
    
    // Déterminer le statut du mouvement
    let movement_status = 'unknown';
    if (speed > 30) movement_status = 'driving';
    else if (speed > 1) movement_status = 'walking';
    else movement_status = 'stationary';
    
    // Créer l'enregistrement
    const location = await UserLocation.create({
      user_id: userId,
      latitude,
      longitude,
      accuracy,
      speed,
      heading,
      altitude,
      user_type: userType,
      movement_status,
      active_ride_id,
      metadata: {
        ...metadata,
        battery_level: metadata.battery_level,
        network_type: metadata.network_type,
        timestamp: new Date().toISOString()
      },
      recorded_at: new Date(),
      expires_at: active_ride_id ? null : new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h TTL
    });
    
    // Mettre à jour la dernière position du driver si c'est un chauffeur
    if (userType === 'driver') {
      await this.updateDriverLastLocation(userId, latitude, longitude);
    }
    
    return location;
  }
  
  /**
   * Mettre à jour la dernière position du driver
   */
  async updateDriverLastLocation(userId, latitude, longitude) {
    const { Driver } = require('../models');
    await Driver.update({
      current_lat: latitude,
      current_lng: longitude,
      last_location_update: new Date()
    }, {
      where: { user_id: userId }
    });
  }
  
  /**
   * Obtenir la dernière position d'un utilisateur
   */
  async getLastLocation(userId) {
    const location = await UserLocation.findOne({
      where: { user_id: userId },
      order: [['recorded_at', 'DESC']]
    });
    
    return location;
  }
  
  /**
   * Obtenir l'historique des positions d'un utilisateur
   */
  async getLocationHistory(userId, options = {}) {
    const { limit = 100, startDate, endDate } = options;
    
    const where = { user_id: userId };
    
    if (startDate) {
      where.recorded_at = { [Op.gte]: startDate };
    }
    if (endDate) {
      where.recorded_at = { ...where.recorded_at, [Op.lte]: endDate };
    }
    
    const locations = await UserLocation.findAll({
      where,
      order: [['recorded_at', 'DESC']],
      limit
    });
    
    return locations;
  }
  
  /**
   * Trouver les utilisateurs à proximité
   */
  async getNearbyUsers(latitude, longitude, radius = 5, userType = null) {
    const where = {
      [Op.and]: [
        sequelize.literal(`(6371 * acos(cos(radians(${latitude})) 
          * cos(radians(latitude)) 
          * cos(radians(longitude) - radians(${longitude})) 
          + sin(radians(${latitude})) 
          * sin(radians(latitude)))) <= ${radius}`)
      ]
    };
    
    if (userType) {
      where.user_type = { [Op.in]: [userType, 'both'] };
    }
    
    const locations = await UserLocation.findAll({
      where,
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'first_name', 'last_name', 'avatar_url', 'role']
      }],
      order: [['recorded_at', 'DESC']],
      limit: 50
    });
    
    return locations;
  }
  
  /**
   * Nettoyer les anciennes positions
   */
  async cleanupOldLocations() {
    const deleted = await UserLocation.destroy({
      where: {
        recorded_at: { [Op.lt]: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        active_ride_id: null
      }
    });
    
    console.log(`🧹 Nettoyage: ${deleted} anciennes positions supprimées`);
    return deleted;
  }
  
  /**
   * Démarrer le tracking d'une course
   */
  async startRideTracking(userId, rideId) {
    await UserLocation.update(
      { active_ride_id: rideId, expires_at: null },
      { where: { user_id: userId, active_ride_id: null } }
    );
  }
  
  /**
   * Arrêter le tracking d'une course
   */
  async stopRideTracking(userId, rideId) {
    await UserLocation.update(
      { active_ride_id: null, expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      { where: { user_id: userId, active_ride_id: rideId } }
    );
  }
}

module.exports = new LocationService();