// config/hereMaps.js

const axios = require('axios');
require('dotenv').config();

class HereMapsService {
  constructor() {
    this.apiKey = process.env.HERE_ACCESS_KEY_ID;
    this.routeUrl = 'https://router.hereapi.com/v8/routes';
    this.geocodeUrl = 'https://geocode.search.hereapi.com/v1/geocode';
    
    if (!this.apiKey) {
      console.error('❌ HERE API key non configurée dans .env');
      console.error('   Ajoutez HERE_ACCESS_KEY_ID dans votre fichier .env');
    } else {
      console.log('✅ HERE Maps API configurée avec succès');
    }
  }

  /**
   * Calculer la distance et la durée entre deux points
   */
  async getDistanceMatrix(origin, destination) {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'HERE API key non configurée'
      };
    }

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
        return {
          success: false,
          error: 'Aucun itinéraire trouvé'
        };
      }

      const section = response.data.routes[0].sections[0];
      const summary = section.summary;
      
      const distanceMeters = summary.length;
      const distanceKm = distanceMeters / 1000;
      const durationSec = summary.duration;
      const durationMin = Math.ceil(durationSec / 60);
      
      // HERE gratuit n'inclut pas le trafic temps réel
      const trafficDelay = summary.trafficDelay || 0;
      
      console.log('✅ HERE Distance Matrix réussi:', {
        distanceKm: distanceKm.toFixed(2),
        durationMin
      });

      return {
        success: true,
        distanceMeters,
        distanceKm: Math.round(distanceKm * 100) / 100,
        durationWithTrafficSec: durationSec + trafficDelay,
        durationWithoutTrafficSec: durationSec,
        durationWithTrafficMin: Math.ceil((durationSec + trafficDelay) / 60),
        durationWithoutTrafficMin: durationMin
      };
      
    } catch (error) {
      console.error('❌ Erreur HERE Maps:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Géocodage d'une adresse
   */
  async geocodeAddress(address) {
    if (!this.apiKey) {
      return { success: false, error: 'HERE API key non configurée' };
    }

    try {
      const response = await axios.get(this.geocodeUrl, {
        params: {
          q: address,
          apiKey: this.apiKey,
          limit: 1,
          lang: 'fr'
        },
        timeout: 10000
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
}

module.exports = new HereMapsService();