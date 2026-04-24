// config/googleMaps.js

// ✅ FORCER le chargement de dotenv TOUT EN PREMIER
require('dotenv').config();

const axios = require('axios');

// =====================================================
// 🗺️ CLIENT GOOGLE MAPS
// =====================================================
class GoogleMapsService {
  constructor() {
    // ✅ Lire directement depuis process.env
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.baseUrl = 'https://maps.googleapis.com/maps/api';
    
    // Debug: Afficher la clé (masquée partiellement)
    if (this.apiKey) {
      console.log(`🔑 Clé API trouvée: ${this.apiKey.substring(0, 10)}...`);
    } else {
      console.log('❌ Aucune clé API trouvée dans process.env');
    }
    
    // Vérifier si la clé est configurée
    if (!this.apiKey) {
      console.error('❌ ERREUR: Google Maps API key non configurée dans .env');
      console.error('   Ajoutez GOOGLE_MAPS_API_KEY= votre_clé dans le fichier .env');
      throw new Error('Google Maps API key is required. Please check your .env file.');
    }
    
    // Vérifier que ce n'est pas la valeur par défaut
    if (this.apiKey === 'AIzaSyDkDVRVD2jTh1-glT7CGeo1F1Ry0LURTSE') {
      console.error('❌ ERREUR: Vous utilisez la clé API par défaut');
      console.error('   Veuillez configurer votre propre clé Google Maps API');
      throw new Error('Invalid Google Maps API key. Please use your own key.');
    }
    
    console.log('✅ Google Maps API configurée avec succès');
  }

  /**
   * Calculer la distance et la durée entre deux points
   */
  async getDistanceMatrix(origin, destination, withTraffic = true) {
    try {
      const originStr = typeof origin === 'string' 
        ? encodeURIComponent(origin)
        : `${origin.lat},${origin.lng}`;
      
      const destStr = typeof destination === 'string'
        ? encodeURIComponent(destination)
        : `${destination.lat},${destination.lng}`;

      const params = {
        origins: originStr,
        destinations: destStr,
        key: this.apiKey,
        units: 'metric'
      };

      if (withTraffic) {
        params.departure_time = 'now';
        params.traffic_model = 'best_guess';
      }

      console.log('🌍 Appel Google Maps Distance Matrix API...');
      console.log('📍 Origine:', originStr);
      console.log('📍 Destination:', destStr);

      const response = await axios.get(
        `${this.baseUrl}/distancematrix/json`,
        { params, timeout: 10000 }
      );

      if (response.data.status !== 'OK') {
        console.error('❌ Google Maps API error:', response.data.status);
        console.error('📦 Message:', response.data.error_message);
        throw new Error(`Google Maps API error: ${response.data.status} - ${response.data.error_message || ''}`);
      }

      const element = response.data.rows[0].elements[0];
      
      if (element.status !== 'OK') {
        throw new Error(`No route found: ${element.status}`);
      }

      const distanceMeters = element.distance.value;
      const distanceKm = distanceMeters / 1000;
      
      let durationWithTrafficSec, durationWithoutTrafficSec;
      let durationWithTrafficMin, durationWithoutTrafficMin;
      
      if (withTraffic && element.duration_in_traffic) {
        durationWithTrafficSec = element.duration_in_traffic.value;
        durationWithTrafficMin = Math.ceil(durationWithTrafficSec / 60);
        durationWithoutTrafficSec = element.duration.value;
        durationWithoutTrafficMin = Math.ceil(durationWithoutTrafficSec / 60);
      } else {
        durationWithTrafficSec = element.duration.value;
        durationWithTrafficMin = Math.ceil(durationWithTrafficSec / 60);
        durationWithoutTrafficSec = element.duration.value;
        durationWithoutTrafficMin = Math.ceil(durationWithoutTrafficSec / 60);
      }

      console.log('✅ Distance Matrix réussi:', {
        distanceKm: distanceKm.toFixed(2),
        durationWithTrafficMin,
        durationWithoutTrafficMin
      });

      return {
        distanceMeters,
        distanceKm: Math.round(distanceKm * 100) / 100,
        durationWithTrafficSec,
        durationWithoutTrafficSec,
        durationWithTrafficMin,
        durationWithoutTrafficMin,
        originAddress: response.data.origin_addresses[0],
        destinationAddress: response.data.destination_addresses[0]
      };
      
    } catch (error) {
      console.error('❌ Erreur Google Maps:', error.message);
      throw new Error(`Erreur calcul distance: ${error.message}`);
    }
  }

  /**
   * Géocodage d'une adresse
   */
  async geocodeAddress(address) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/geocode/json`,
        {
          params: {
            address: encodeURIComponent(address),
            key: this.apiKey,
            language: 'fr'
          },
          timeout: 10000
        }
      );

      if (response.data.status !== 'OK') {
        throw new Error(`Geocoding error: ${response.data.status}`);
      }

      if (response.data.results.length === 0) {
        throw new Error('Aucun résultat trouvé');
      }

      const result = response.data.results[0];
      const location = result.geometry.location;

      return {
        lat: location.lat,
        lng: location.lng,
        formattedAddress: result.formatted_address,
        placeId: result.place_id
      };
    } catch (error) {
      console.error('❌ Erreur géocodage:', error.message);
      throw error;
    }
  }

  /**
   * Géocodage inverse
   */
  async reverseGeocode(lat, lng) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/geocode/json`,
        {
          params: {
            latlng: `${lat},${lng}`,
            key: this.apiKey,
            language: 'fr'
          },
          timeout: 10000
        }
      );

      if (response.data.status !== 'OK') {
        throw new Error(`Reverse geocoding error: ${response.data.status}`);
      }

      const result = response.data.results[0];
      
      let city = '';
      let country = '';
      
      for (const component of result.address_components) {
        if (component.types.includes('locality')) {
          city = component.long_name;
        }
        if (component.types.includes('country')) {
          country = component.long_name;
        }
      }

      return {
        address: result.formatted_address,
        city,
        country,
        placeId: result.place_id
      };
    } catch (error) {
      console.error('❌ Erreur reverse géocodage:', error.message);
      throw error;
    }
  }
}

module.exports = new GoogleMapsService();