// services/maps/hereMapsService.js

const axios = require('axios');
require('dotenv').config();

class HereMapsService {
  constructor() {
    this.accessKeyId = process.env.HERE_ACCESS_KEY_ID;
    this.accessKeySecret = process.env.HERE_ACCESS_KEY_SECRET;
    this.geocodeUrl = 'https://geocode.search.hereapi.com/v1/geocode';
    this.routeUrl = 'https://router.hereapi.com/v8/routes';
    
    if (!this.accessKeyId || !this.accessKeySecret) {
      console.error('❌ HERE credentials non configurées');
    } else {
      console.log('✅ HERE Maps API configurée');
    }
  }

  /**
   * Obtenir un token OAuth pour l'API HERE
   */
  async getAccessToken() {
    // Note: HERE utilise OAuth 2.0 avec API Key simplifié
    // Pour les API récentes, on peut utiliser directement l'API Key
    return this.accessKeyId;
  }

  /**
   * Géocodage : adresse → coordonnées
   */
  async geocodeAddress(address) {
    try {
      const response = await axios.get(this.geocodeUrl, {
        params: {
          q: address,
          apiKey: this.accessKeyId,
          limit: 1,
          lang: 'fr'
        }
      });

      if (response.data.items && response.data.items.length > 0) {
        const item = response.data.items[0];
        return {
          success: true,
          lat: item.position.lat,
          lng: item.position.lng,
          address: item.address.label,
          city: item.address.city,
          country: item.address.countryName
        };
      }
      return { success: false, error: 'Adresse non trouvée' };
    } catch (error) {
      console.error('❌ Erreur géocodage HERE:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Calcul de distance et durée entre deux points
   */
  async getDistanceMatrix(origin, destination) {
    try {
      // Utiliser l'API Routing de HERE
      const response = await axios.get(this.routeUrl, {
        params: {
          apiKey: this.accessKeyId,
          transportMode: 'car',
          origin: `${origin.lat},${origin.lng}`,
          destination: `${destination.lat},${destination.lng}`,
          return: 'summary',
          lang: 'fr'
        }
      });

      if (response.data.routes && response.data.routes.length > 0) {
        const section = response.data.routes[0].sections[0];
        const summary = section.summary;
        
        const distanceMeters = summary.length;
        const distanceKm = distanceMeters / 1000;
        const durationSec = summary.duration;
        const durationMin = Math.ceil(durationSec / 60);
        
        // HERE ne donne pas de trafic temps réel gratuitement
        const trafficDelay = summary.trafficDelay || 0;
        
        return {
          success: true,
          distanceMeters,
          distanceKm: Math.round(distanceKm * 100) / 100,
          durationWithTrafficSec: durationSec + trafficDelay,
          durationWithoutTrafficSec: durationSec,
          durationWithTrafficMin: Math.ceil((durationSec + trafficDelay) / 60),
          durationWithoutTrafficMin: durationMin
        };
      }
      
      return { success: false, error: 'Aucun itinéraire trouvé' };
    } catch (error) {
      console.error('❌ Erreur distance HERE:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Reverse géocodage : coordonnées → adresse
   */
  async reverseGeocode(lat, lng) {
    try {
      const response = await axios.get('https://revgeocode.search.hereapi.com/v1/revgeocode', {
        params: {
          at: `${lat},${lng}`,
          apiKey: this.accessKeyId,
          lang: 'fr'
        }
      });

      if (response.data.items && response.data.items.length > 0) {
        const item = response.data.items[0];
        return {
          success: true,
          address: item.address.label,
          city: item.address.city,
          district: item.address.district,
          street: item.address.street,
          houseNumber: item.address.houseNumber
        };
      }
      return { success: false, error: 'Adresse non trouvée' };
    } catch (error) {
      console.error('❌ Erreur reverse HERE:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Auto-complétion pour recherche en temps réel
   */
  async autocomplete(input) {
    try {
      const response = await axios.get('https://autocomplete.search.hereapi.com/v1/autocomplete', {
        params: {
          q: input,
          apiKey: this.accessKeyId,
          limit: 5,
          lang: 'fr'
        }
      });

      const predictions = (response.data.items || []).map(item => ({
        address: item.address.label,
        title: item.title,
        lat: item.position.lat,
        lng: item.position.lng
      }));

      return { success: true, predictions };
    } catch (error) {
      console.error('❌ Erreur autocomplete HERE:', error.message);
      return { success: true, predictions: [] };
    }
  }
}

module.exports = new HereMapsService();