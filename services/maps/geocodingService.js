// services/maps/geocodingService.js

require('dotenv').config();
const axios = require('axios');

class GeocodingService {
  constructor() {
    this.apiKey = process.env.HERE_ACCESS_KEY_ID;
    this.geocodeUrl = 'https://geocode.search.hereapi.com/v1/geocode';
    this.autocompleteUrl = 'https://autocomplete.search.hereapi.com/v1/autocomplete';
    this.reverseGeocodeUrl = 'https://revgeocode.search.hereapi.com/v1/revgeocode';
    
    if (!this.apiKey) {
      throw new Error('❌ HERE_ACCESS_KEY_ID non configurée dans .env');
    }
    console.log('✅ HERE Maps API configurée pour géocodage');
  }

  async addressToCoordinates(address) {
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
          formattedAddress: item.address.label,
          placeId: item.id,
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

  async coordinatesToAddress(lat, lng) {
    try {
      const response = await axios.get(this.reverseGeocodeUrl, {
        params: {
          at: `${lat},${lng}`,
          apiKey: this.apiKey,
          lang: 'fr'
        },
        timeout: 10000
      });

      if (response.data.items && response.data.items.length > 0) {
        const item = response.data.items[0];
        let city = '', district = '';
        
        if (item.address) {
          city = item.address.city || '';
          district = item.address.district || '';
        }
        
        return {
          success: true,
          address: item.address.label,
          city,
          district,
          placeId: item.id
        };
      }
      return { success: false, error: 'Coordonnées non trouvées' };
    } catch (error) {
      console.error('❌ Erreur reverse géocodage HERE:', error.message);
      return { success: false, error: error.message };
    }
  }

  async autocompleteAddress(input, sessionToken = null) {
    if (input.length < 2) {
      return { success: true, predictions: [] };
    }

    try {
      const response = await axios.get(this.autocompleteUrl, {
        params: {
          q: input,
          apiKey: this.apiKey,
          limit: 5,
          lang: 'fr'
        },
        timeout: 10000
      });

      if (response.data.items && response.data.items.length > 0) {
        return {
          success: true,
          predictions: response.data.items.map(item => ({
            description: item.address.label,
            placeId: item.id,
            mainText: item.title,
            secondaryText: item.address.city,
            lat: item.position.lat,
            lng: item.position.lng
          }))
        };
      }
      return { success: true, predictions: [] };
    } catch (error) {
      console.error('❌ Erreur autocomplete HERE:', error.message);
      return { success: true, predictions: [] };
    }
  }
}

module.exports = new GeocodingService();