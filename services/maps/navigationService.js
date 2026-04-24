// services/maps/navigationService.js

require('dotenv').config();
const distanceService = require('./distanceService');
const trafficService = require('./trafficService');

class NavigationService {
  constructor() {
    this.apiKey = process.env.HERE_ACCESS_KEY_ID;
    this.isOnline = true;
    this.currentLocation = null;
    this.currentRoute = null;
    
    if (!this.apiKey) {
      throw new Error('❌ HERE_ACCESS_KEY_ID non configurée dans .env');
    }
    console.log('✅ HERE Maps API configurée pour navigation');
  }

  setDrivingStatus(status) {
    this.isOnline = status;
    console.log(`🚗 Mode conduite: ${status ? 'EN LIGNE' : 'HORS LIGNE'}`);
    return { success: true, isOnline: status };
  }

  updateCurrentLocation(lat, lng, heading = null, speed = null) {
    this.currentLocation = { lat, lng, heading, speed, timestamp: new Date() };
    return this.currentLocation;
  }

  async getRouteToPickup(driverLocation, pickupLocation) {
    const route = await distanceService.getDirections(driverLocation, pickupLocation);
    
    const traffic = await trafficService.getTrafficConditions(driverLocation, pickupLocation);
    
    this.currentRoute = {
      type: 'pickup',
      destination: pickupLocation,
      route,
      traffic,
      eta: traffic.trafficDuration
    };
    
    return {
      success: true,
      distance: route.distance,
      duration: route.duration,
      etaMinutes: Math.ceil(this.currentRoute.eta),
      steps: route.steps,
      polyline: route.polyline,
      traffic: traffic
    };
  }

  async getRouteToDestination(currentLocation, destination, stops = []) {
    const waypoints = stops.map(stop => ({ lat: stop.lat, lng: stop.lng }));
    const route = await distanceService.getDirections(currentLocation, destination, waypoints);
    
    const traffic = await trafficService.getTrafficConditions(currentLocation, destination);
    
    this.currentRoute = {
      type: 'destination',
      destination,
      stops,
      route,
      traffic,
      eta: traffic.trafficDuration
    };
    
    return {
      success: true,
      distance: route.distance,
      duration: route.duration,
      etaMinutes: Math.ceil(this.currentRoute.eta),
      remainingStops: stops.length,
      steps: route.steps,
      polyline: route.polyline,
      traffic: traffic
    };
  }

  async recalculateRoute() {
    if (!this.currentRoute || !this.currentLocation) {
      return { success: false, error: 'Aucun itinéraire actif' };
    }
    
    const destination = this.currentRoute.destination;
    const stops = this.currentRoute.stops || [];
    
    return this.getRouteToDestination(this.currentLocation, destination, stops);
  }

  async checkRouteDeviation(maxDeviationMeters = 100) {
    if (!this.currentRoute || !this.currentLocation) {
      return { onRoute: true, deviation: 0 };
    }
    
    const nextStep = this.getNextStep();
    
    if (!nextStep) {
      return { onRoute: true, deviation: 0 };
    }
    
    const deviation = distanceService.calculateHaversineDistance(
      this.currentLocation.lat, this.currentLocation.lng,
      nextStep.lat, nextStep.lng
    ) * 1000;
    
    return {
      onRoute: deviation <= maxDeviationMeters,
      deviationMeters: Math.round(deviation),
      maxDeviationMeters,
      needsRecalculation: deviation > maxDeviationMeters
    };
  }

  getNextStep() {
    if (!this.currentRoute || !this.currentRoute.route.steps) {
      return null;
    }
    
    let closestStep = null;
    let minDistance = Infinity;
    
    for (const step of this.currentRoute.route.steps) {
      if (step.lat && step.lng) {
        const distance = distanceService.calculateHaversineDistance(
          this.currentLocation.lat, this.currentLocation.lng,
          step.lat, step.lng
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          closestStep = step;
        }
      }
    }
    
    return closestStep;
  }

  getVoiceInstructions() {
    if (!this.currentRoute || !this.currentRoute.route.steps) {
      return [];
    }
    
    const nextStep = this.getNextStep();
    if (!nextStep) {
      return [];
    }
    
    const instructions = [];
    
    if (nextStep.instruction) {
      instructions.push({
        type: 'maneuver',
        text: nextStep.instruction,
        distance: nextStep.distance
      });
    }
    
    if (this.currentRoute.traffic && this.currentRoute.traffic.trafficLevel === 'high') {
      instructions.push({
        type: 'traffic',
        text: `Attention, ${this.currentRoute.traffic.trafficDescription} sur votre itinéraire`
      });
    }
    
    return instructions;
  }

  async updateRealTimeETA() {
    if (!this.currentRoute || !this.currentLocation) {
      return { eta: null };
    }
    
    const destination = this.currentRoute.destination;
    const traffic = await trafficService.getTrafficConditions(this.currentLocation, destination);
    
    const remainingDistance = distanceService.calculateHaversineDistance(
      this.currentLocation.lat, this.currentLocation.lng,
      destination.lat, destination.lng
    );
    
    return {
      etaMinutes: traffic.trafficDuration,
      remainingDistanceKm: Math.round(remainingDistance * 100) / 100,
      trafficLevel: traffic.trafficLevel,
      speed: this.currentLocation.speed || 30
    };
  }

  getNavigationSummary() {
    return {
      isOnline: this.isOnline,
      hasActiveRoute: !!this.currentRoute,
      currentLocation: this.currentLocation,
      routeType: this.currentRoute?.type || null,
      destination: this.currentRoute?.destination || null,
      estimatedTimeRemaining: this.currentRoute?.eta || null
    };
  }
}

module.exports = new NavigationService();