// services/maps/index.js

require('dotenv').config();

const geocodingService = require('./geocodingService');
const distanceService = require('./distanceService');
const trafficService = require('./trafficService');

module.exports = {
  // Services principaux
  geocoding: geocodingService,
  distance: distanceService,
  traffic: {
    getConditions: (origin, destination) => trafficService.getTrafficConditions(origin, destination),
    predictTravelTime: (origin, destination, datetime) => trafficService.predictTravelTime(origin, destination, datetime),
    getNearbyZones: (lat, lng, radius) => trafficService.getNearbyTrafficZones(lat, lng, radius),
    // ✅ Ajout de isPeakHour directement ici
    isPeakHour: () => {
      const hour = new Date().getHours();
      return (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19);
    },
    getTrafficFactor: () => {
      const hour = new Date().getHours();
      if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19)) return 1.4;
      if (hour >= 22 || hour <= 5) return 0.7;
      return 1.0;
    }
  },
  
  // Raccourcis pratiques
  addressToCoordinates: (address) => geocodingService.addressToCoordinates(address),
  coordinatesToAddress: (lat, lng) => geocodingService.coordinatesToAddress(lat, lng),
  autocomplete: (input, sessionToken) => geocodingService.autocompleteAddress(input, sessionToken),
  
  getDistance: (origin, destination, withTraffic) => 
    distanceService.getDistanceMatrix(origin, destination, withTraffic),
  
  getTraffic: (origin, destination) => 
    trafficService.getTrafficConditions(origin, destination),
  
  predictTravelTime: (origin, destination, datetime) => 
    trafficService.predictTravelTime(origin, destination, datetime),
  
  getNearbyZones: (lat, lng, radius) => 
    trafficService.getNearbyTrafficZones(lat, lng, radius),
  
  // ✅ Ajout des méthodes manquantes au niveau racine aussi
  isPeakHour: () => {
    const hour = new Date().getHours();
    return (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19);
  },
  
  getTrafficFactor: () => {
    const hour = new Date().getHours();
    if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19)) return 1.4;
    if (hour >= 22 || hour <= 5) return 0.7;
    return 1.0;
  },
  
  calculateHaversine: (lat1, lng1, lat2, lng2) => 
    distanceService.calculateHaversineDistance(lat1, lng1, lat2, lng2)
};