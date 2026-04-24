// services/maps/trafficService.js

require('dotenv').config();
const distanceService = require('./distanceService');

class TrafficService {
  constructor() {
    this.apiKey = process.env.HERE_ACCESS_KEY_ID;
    
    if (!this.apiKey) {
      throw new Error('❌ HERE_ACCESS_KEY_ID non configurée dans .env');
    }
    console.log('✅ HERE Maps API configurée pour trafic');
  }

  async getTrafficConditions(origin, destination) {
    const distanceData = await distanceService.getDistanceMatrix(origin, destination, true);
    
    const hour = new Date().getHours();
    const isPeakHour = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19);
    const isNight = hour >= 22 || hour <= 5;
    
    let peakFactor = 1.0;
    if (isPeakHour) peakFactor = 1.3;
    if (isNight) peakFactor = 0.7;
    
    return {
      success: true,
      distanceKm: distanceData.distanceKm,
      normalDuration: distanceData.durationWithoutTrafficMin,
      trafficDuration: distanceData.durationWithTrafficMin,
      extraTimeMin: distanceData.durationWithTrafficMin - distanceData.durationWithoutTrafficMin,
      extraTimePercent: Math.round(((distanceData.durationWithTrafficMin - distanceData.durationWithoutTrafficMin) / distanceData.durationWithoutTrafficMin) * 100),
      trafficLevel: distanceData.trafficLevel.level,
      trafficDescription: distanceData.trafficLevel.description,
      trafficColor: distanceData.trafficLevel.color,
      isPeakHour,
      isNight,
      peakFactor,
      recommendedSpeedKmh: this.getRecommendedSpeed(distanceData.trafficLevel.level)
    };
  }

  async predictTravelTime(origin, destination, datetime = new Date()) {
    const baseDistance = await distanceService.getDistanceMatrix(origin, destination, false);
    
    const hour = datetime.getHours();
    const dayOfWeek = datetime.getDay();
    
    let timeFactor = 1.0;
    if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19)) {
      timeFactor = 1.4;
    } else if (hour >= 22 || hour <= 5) {
      timeFactor = 0.7;
    } else if (dayOfWeek === 0 || dayOfWeek === 6) {
      timeFactor = 0.9;
    }
    
    const predictedMinutes = Math.round(baseDistance.durationWithoutTrafficMin * timeFactor);
    
    return {
      success: true,
      distanceKm: baseDistance.distanceKm,
      normalDuration: baseDistance.durationWithoutTrafficMin,
      predictedDuration: predictedMinutes,
      timeFactor,
      confidence: timeFactor > 1.3 ? 'high' : 'medium',
      recommendation: timeFactor > 1.3 ? 'Évitez de conduire maintenant - fortes congestions' : 'Conditions normales'
    };
  }

  async getNearbyTrafficZones(lat, lng, radius = 5) {
    const trafficZones = [
      { name: 'Gombe - Boulevard du 30 Juin', lat: -4.3156, lng: 15.3092, severity: 'high' },
      { name: 'Lemba - Marché', lat: -4.3833, lng: 15.3333, severity: 'high' },
      { name: 'Ngaliema - Place de l\'Échangeur', lat: -4.3667, lng: 15.2333, severity: 'medium' },
      { name: 'Limete - Université de Kinshasa', lat: -4.4167, lng: 15.3167, severity: 'medium' },
      { name: 'Matonge - Rond-point', lat: -4.3333, lng: 15.3167, severity: 'high' }
    ];
    
    const nearbyZones = trafficZones.filter(zone => {
      const distance = this.calculateDistance(lat, lng, zone.lat, zone.lng);
      return distance <= radius;
    });
    
    return {
      success: true,
      zones: nearbyZones,
      count: nearbyZones.length,
      hasTraffic: nearbyZones.length > 0,
      recommendation: nearbyZones.length > 0 ? 'Trafic dense détecté sur votre itinéraire' : 'Trafic fluide'
    };
  }

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

  getRecommendedSpeed(trafficLevel) {
    const speeds = {
      high: 15,
      medium: 25,
      low: 35,
      none: 45
    };
    return speeds[trafficLevel] || 30;
  }
}

module.exports = new TrafficService();