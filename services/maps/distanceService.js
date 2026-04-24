// services/maps/distanceService.js

require('dotenv').config();
const axios = require('axios');

class DistanceService {
  constructor() {
    this.apiKey = process.env.HERE_ACCESS_KEY_ID;
    this.routeUrl = 'https://router.hereapi.com/v8/routes';
    
    if (!this.apiKey) {
      throw new Error('❌ HERE_ACCESS_KEY_ID non configurée dans .env');
    }
    console.log('✅ HERE Maps API configurée pour distance');
  }

  async getDistanceMatrix(origin, destination, withTraffic = true) {
    try {
      const response = await axios.get(this.routeUrl, {
        params: {
          apiKey: this.apiKey,
          transportMode: 'car',
          origin: `${origin.lat},${origin.lng}`,
          destination: `${destination.lat},${destination.lng}`,
          return: 'summary',
          lang: 'fr'
        },
        timeout: 10000
      });

      if (!response.data.routes || response.data.routes.length === 0) {
        throw new Error('Aucun itinéraire trouvé');
      }

      const section = response.data.routes[0].sections[0];
      const summary = section.summary;
      
      const distanceMeters = summary.length;
      const distanceKm = distanceMeters / 1000;
      const durationSec = summary.duration;
      const durationMin = Math.ceil(durationSec / 60);
      
      const trafficDelay = summary.trafficDelay || 0;
      
      let trafficLevel = { level: 'none', description: 'Trafic fluide', color: '#43A047' };
      if (trafficDelay > 300) {
        trafficLevel = { level: 'high', description: 'Trafic très dense', color: '#E53935' };
      } else if (trafficDelay > 120) {
        trafficLevel = { level: 'medium', description: 'Trafic modéré', color: '#FB8C00' };
      } else if (trafficDelay > 30) {
        trafficLevel = { level: 'low', description: 'Trafic léger', color: '#FFD600' };
      }

      return {
        success: true,
        distanceMeters,
        distanceKm: Math.round(distanceKm * 100) / 100,
        durationWithTrafficSec: durationSec + trafficDelay,
        durationWithoutTrafficSec: durationSec,
        durationWithTrafficMin: Math.ceil((durationSec + trafficDelay) / 60),
        durationWithoutTrafficMin: durationMin,
        trafficLevel
      };
    } catch (error) {
      console.error('❌ Erreur distance HERE:', error.message);
      throw error;
    }
  }

  async getDirections(origin, destination, waypoints = []) {
    try {
      let waypointStr = '';
      if (waypoints.length > 0) {
        waypointStr = `&via=${waypoints.map(w => `${w.lat},${w.lng}`).join('|')}`;
      }
      
      const response = await axios.get(`${this.routeUrl}`, {
        params: {
          apiKey: this.apiKey,
          transportMode: 'car',
          origin: `${origin.lat},${origin.lng}`,
          destination: `${destination.lat},${destination.lng}`,
          return: 'summary,polyline,instructions',
          lang: 'fr'
        },
        timeout: 10000
      });

      if (!response.data.routes || response.data.routes.length === 0) {
        throw new Error('Aucun itinéraire trouvé');
      }

      const route = response.data.routes[0];
      const section = route.sections[0];
      const summary = section.summary;
      
      const steps = (section.actions || []).map((action, index) => ({
        instruction: action.instruction || `Étape ${index + 1}`,
        distance: `${(action.length || 0)} m`,
        duration: `${Math.ceil((action.duration || 0) / 60)} min`,
        lat: action.position?.lat || 0,
        lng: action.position?.lng || 0,
        polyline: action.polyline,
        maneuver: action.maneuver
      }));

      return {
        success: true,
        distance: `${(summary.length / 1000).toFixed(1)} km`,
        distanceMeters: summary.length,
        duration: `${Math.ceil(summary.duration / 60)} min`,
        durationSec: summary.duration,
        startAddress: section.departure?.place?.address || 'Départ',
        endAddress: section.arrival?.place?.address || 'Arrivée',
        steps,
        polyline: route.polyline,
        bounds: null
      };
    } catch (error) {
      console.error('❌ Erreur directions HERE:', error.message);
      throw error;
    }
  }

  async isRouteAccessible(origin, destination) {
    const result = await this.getDistanceMatrix(origin, destination, false);
    return {
      accessible: true,
      distanceKm: result.distanceKm,
      durationMin: result.durationWithoutTrafficMin
    };
  }

  calculateHaversineDistance(lat1, lon1, lat2, lon2) {
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
}

module.exports = new DistanceService();