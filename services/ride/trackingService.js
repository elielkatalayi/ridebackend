const NotificationService = require('../notification/NotificationService');
const SocketService = require('../notification/SocketService');

class TrackingService {
  constructor() {
    // Stockage temporaire des positions (à remplacer par Redis ou base de données)
    this.rideLocations = new Map();
    // Stockage des seuils de notification (éviter les notifications en spam)
    this.lastNotification = new Map();
  }

  /**
   * Mettre à jour la position d'un véhicule
   * @param {string} rideId - ID de la course
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {number} heading - Direction (optionnel)
   * @param {number} speed - Vitesse (optionnel)
   */
  async updateLocation(rideId, lat, lng, heading = null, speed = null) {
    if (!this.rideLocations.has(rideId)) {
      this.rideLocations.set(rideId, []);
    }
    
    const locations = this.rideLocations.get(rideId);
    const lastLocation = locations.length > 0 ? locations[locations.length - 1] : null;
    
    locations.push({
      lat,
      lng,
      heading,
      speed,
      timestamp: new Date()
    });
    
    // Garder seulement les 100 dernières positions
    if (locations.length > 100) {
      locations.shift();
    }
    
    // Envoyer la position en temps réel via Socket.IO
    const { Ride } = require('../../models');
    const ride = await Ride.findByPk(rideId, {
      include: ['passenger', 'driver']
    });
    
    if (ride && ride.passenger_id) {
      SocketService.sendToUser(ride.passenger_id, 'ride:location', {
        ride_id: rideId,
        location: { lat, lng, heading, speed },
        timestamp: new Date()
      });
      
      // Vérifier l'arrivée imminente (distance < 500m)
      if (lastLocation && ride.origin_lat && ride.origin_lng) {
        const distanceToDestination = this.calculateHaversineDistance(
          lat, lng,
          ride.destination_lat || ride.origin_lat,
          ride.destination_lng || ride.origin_lng
        );
        
        // Notification d'arrivée imminente
        const lastNotifKey = `${rideId}_arriving`;
        const lastNotif = this.lastNotification.get(lastNotifKey);
        const now = Date.now();
        
        if (distanceToDestination < 500 && (!lastNotif || (now - lastNotif) > 60000)) {
          this.lastNotification.set(lastNotifKey, now);
          
          await NotificationService.sendRideNotification(
            ride.passenger_id,
            rideId,
            'driver_arriving',
            {
              eta: Math.ceil(distanceToDestination / (speed || 10) / 16.67), // minutes approximatives
              distance: Math.round(distanceToDestination)
            }
          );
        }
      }
    }
  }

  /**
   * Obtenir la dernière position d'une course
   * @param {string} rideId - ID de la course
   * @returns {Object|null}
   */
  getLastLocation(rideId) {
    const locations = this.rideLocations.get(rideId);
    if (!locations || locations.length === 0) {
      return null;
    }
    return locations[locations.length - 1];
  }

  /**
   * Obtenir l'historique des positions d'une course
   * @param {string} rideId - ID de la course
   * @param {number} limit - Nombre maximum de positions
   * @returns {Array}
   */
  getLocationHistory(rideId, limit = 50) {
    const locations = this.rideLocations.get(rideId);
    if (!locations) {
      return [];
    }
    return locations.slice(-limit);
  }

  /**
   * Calculer la distance parcourue pendant une course
   * @param {string} rideId - ID de la course
   * @returns {number} Distance en mètres
   */
  calculateDistanceTraveled(rideId) {
    const locations = this.rideLocations.get(rideId);
    if (!locations || locations.length < 2) {
      return 0;
    }
    
    let totalDistance = 0;
    for (let i = 1; i < locations.length; i++) {
      const prev = locations[i - 1];
      const curr = locations[i];
      totalDistance += this.calculateHaversineDistance(
        prev.lat, prev.lng,
        curr.lat, curr.lng
      );
    }
    
    return totalDistance;
  }

  /**
   * Calculer la distance entre deux points (Haversine)
   * @param {number} lat1 - Latitude point 1
   * @param {number} lon1 - Longitude point 1
   * @param {number} lat2 - Latitude point 2
   * @param {number} lon2 - Longitude point 2
   * @returns {number} Distance en mètres
   */
  calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Rayon de la Terre en mètres
    const φ1 = this.toRadians(lat1);
    const φ2 = this.toRadians(lat2);
    const Δφ = this.toRadians(lat2 - lat1);
    const Δλ = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  toRadians(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Nettoyer les données d'une course terminée
   * @param {string} rideId - ID de la course
   */
  clearRideTracking(rideId) {
    this.rideLocations.delete(rideId);
    // Nettoyer aussi les notifications associées
    for (const key of this.lastNotification.keys()) {
      if (key.startsWith(rideId)) {
        this.lastNotification.delete(key);
      }
    }
  }

  /**
   * Estimer le temps d'arrivée
   * @param {string} rideId - ID de la course
   * @param {number} speed - Vitesse moyenne estimée (km/h)
   * @returns {number} Temps estimé en minutes
   */
  async estimateArrivalTime(rideId, speed = 30) {
    const lastLocation = this.getLastLocation(rideId);
    if (!lastLocation) return null;
    
    const { Ride } = require('../../models');
    const ride = await Ride.findByPk(rideId);
    
    if (!ride || !ride.destination_lat) return null;
    
    const distance = this.calculateHaversineDistance(
      lastLocation.lat, lastLocation.lng,
      ride.destination_lat, ride.destination_lng
    );
    
    const speedMs = speed * 1000 / 3600; // km/h -> m/s
    const etaSeconds = distance / speedMs;
    
    return Math.ceil(etaSeconds / 60);
  }
}

module.exports = new TrackingService();