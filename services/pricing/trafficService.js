// services/ride/trafficService.js

const googleMaps = require('../../config/googleMaps');
const { Ride, TrafficData } = require('../../models');

class TrafficService {
  /**
   * Obtenir les conditions de trafic pour un trajet
   * @param {Object} origin - Point de départ {lat, lng}
   * @param {Object} destination - Point d'arrivée {lat, lng}
   * @returns {Promise<Object>}
   */
  async getTrafficConditions(origin, destination) {
    try {
      const distanceData = await googleMaps.getDistanceMatrix(origin, destination, true);
      
      // Calculer le niveau de trafic (0-100)
      let trafficLevel = 0;
      let trafficDescription = 'Faible';
      
      if (distanceData.durationWithTrafficSec && distanceData.durationWithoutTrafficSec) {
        const ratio = distanceData.durationWithTrafficSec / distanceData.durationWithoutTrafficSec;
        
        if (ratio >= 1.5) {
          trafficLevel = 75;
          trafficDescription = 'Très dense';
        } else if (ratio >= 1.2) {
          trafficLevel = 50;
          trafficDescription = 'Modéré';
        } else if (ratio >= 1.05) {
          trafficLevel = 25;
          trafficDescription = 'Léger';
        } else {
          trafficLevel = 0;
          trafficDescription = 'Fluide';
        }
      }
      
      return {
        trafficLevel,
        trafficDescription,
        durationWithTraffic: distanceData.durationWithTrafficMin,
        durationWithoutTraffic: distanceData.durationWithoutTrafficMin,
        extraTimeMinutes: (distanceData.durationWithTrafficMin - distanceData.durationWithoutTrafficMin),
        extraTimePercent: distanceData.durationWithTrafficSec && distanceData.durationWithoutTrafficSec
          ? Math.round((distanceData.durationWithTrafficSec / distanceData.durationWithoutTrafficSec - 1) * 100)
          : 0
      };
    } catch (error) {
      console.error('❌ Erreur getTrafficConditions:', error.message);
      return {
        trafficLevel: 0,
        trafficDescription: 'Inconnu',
        durationWithTraffic: 0,
        durationWithoutTraffic: 0,
        extraTimeMinutes: 0,
        extraTimePercent: 0
      };
    }
  }

  /**
   * Sauvegarder les données de trafic pour une course
   * @param {string} rideId - ID de la course
   * @param {Object} origin - Point de départ
   * @param {Object} destination - Point d'arrivée
   * @returns {Promise<Object>}
   */
  async saveTrafficData(rideId, origin, destination) {
    try {
      const trafficConditions = await this.getTrafficConditions(origin, destination);
      
      const trafficData = await TrafficData.create({
        ride_id: rideId,
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        destination_lat: destination.lat,
        destination_lng: destination.lng,
        traffic_level: trafficConditions.trafficLevel,
        traffic_description: trafficConditions.trafficDescription,
        duration_with_traffic: trafficConditions.durationWithTraffic,
        duration_without_traffic: trafficConditions.durationWithoutTraffic,
        extra_time_minutes: trafficConditions.extraTimeMinutes
      });
      
      return trafficData;
    } catch (error) {
      console.error('❌ Erreur saveTrafficData:', error.message);
      throw error;
    }
  }

  /**
   * Obtenir l'historique des trafics pour une zone
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {number} radius - Rayon en km
   * @returns {Promise<Array>}
   */
  async getTrafficHistory(lat, lng, radius = 5) {
    try {
      const history = await TrafficData.findAll({
        where: {
          created_at: {
            [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 derniers jours
          }
        },
        order: [['created_at', 'DESC']],
        limit: 100
      });
      
      // Filtrer par distance
      const nearbyTraffic = history.filter(data => {
        const distance = this.calculateDistance(
          lat, lng,
          data.origin_lat, data.origin_lng
        );
        return distance <= radius;
      });
      
      return nearbyTraffic;
    } catch (error) {
      console.error('❌ Erreur getTrafficHistory:', error.message);
      return [];
    }
  }

  /**
   * Calculer la distance entre deux points
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Prédire le temps de trajet basé sur l'historique
   * @param {Object} origin - Point de départ
   * @param {Object} destination - Point d'arrivée
   * @param {Date} datetime - Date et heure du trajet
   * @returns {Promise<Object>}
   */
  async predictTravelTime(origin, destination, datetime = new Date()) {
    try {
      // Obtenir les conditions actuelles
      const currentTraffic = await this.getTrafficConditions(origin, destination);
      
      // Facteur horaire (heures de pointe)
      const hour = datetime.getHours();
      let timeFactor = 1.0;
      
      if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19)) {
        timeFactor = 1.3; // Heures de pointe
      } else if (hour >= 22 || hour <= 5) {
        timeFactor = 0.7; // Nuit
      }
      
      const predictedDuration = Math.round(currentTraffic.durationWithoutTraffic * timeFactor);
      
      return {
        predictedDurationMinutes: predictedDuration,
        currentDurationMinutes: currentTraffic.durationWithTraffic,
        durationWithoutTrafficMinutes: currentTraffic.durationWithoutTraffic,
        timeFactor,
        isPeakHour: timeFactor > 1,
        trafficLevel: currentTraffic.trafficDescription
      };
    } catch (error) {
      console.error('❌ Erreur predictTravelTime:', error.message);
      return {
        predictedDurationMinutes: 30,
        currentDurationMinutes: 30,
        durationWithoutTrafficMinutes: 20,
        timeFactor: 1,
        isPeakHour: false,
        trafficLevel: 'Normal'
      };
    }
  }
}

module.exports = new TrafficService();