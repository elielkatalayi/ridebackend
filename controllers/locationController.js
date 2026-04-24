// controllers/locationController.js

const maps = require('../services/maps');

class LocationController {
  /**
   * Géocodage d'une adresse (adresse → coordonnées)
   * POST /api/v1/location/geocode
   * 
   * Body: { "address": "Gombe, Kinshasa" }
   * Response: { lat, lng, formattedAddress }
   */
  async geocode(req, res, next) {
    try {
      const { address } = req.body;
      
      if (!address) {
        return res.status(400).json({ error: 'Adresse requise' });
      }
      
      const result = await maps.geocoding.addressToCoordinates(address);
      
      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }
      
      res.json({
        success: true,
        lat: result.lat,
        lng: result.lng,
        formattedAddress: result.formattedAddress,
        placeId: result.placeId
      });
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * Géocodage inverse (coordonnées → adresse)
   * POST /api/v1/location/reverse-geocode
   * 
   * Body: { "lat": -4.4419, "lng": 15.2663 }
   * Response: { address, city, district, street }
   */
  async reverseGeocode(req, res, next) {
    try {
      const { lat, lng } = req.body;
      
      if (!lat || !lng) {
        return res.status(400).json({ error: 'Latitude et longitude requises' });
      }
      
      const result = await maps.geocoding.coordinatesToAddress(lat, lng);
      
      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }
      
      res.json({
        success: true,
        address: result.address,
        city: result.city,
        district: result.district,
        street: result.street,
        placeId: result.placeId
      });
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * Auto-complétion d'adresse (recherche en temps réel)
   * GET /api/v1/location/autocomplete?input=gombe
   * 
   * Response: [{ description, placeId, mainText, secondaryText }]
   */
  async autocomplete(req, res, next) {
    try {
      const { input, sessionToken } = req.query;
      
      if (!input || input.length < 2) {
        return res.json({ success: true, predictions: [] });
      }
      
      const result = await maps.geocoding.autocompleteAddress(input, sessionToken);
      
      res.json(result);
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * Calculer la distance entre deux points
   * POST /api/v1/location/distance
   * 
   * Body: {
   *   "origin": { "lat": -4.4419, "lng": 15.2663 },
   *   "destination": { "lat": -4.4319, "lng": 15.2763 },
   *   "withTraffic": true
   * }
   */
  async calculateDistance(req, res, next) {
    try {
      const { origin, destination, withTraffic = true } = req.body;
      
      if (!origin || !destination) {
        return res.status(400).json({ error: 'Origine et destination requises' });
      }
      
      const result = await maps.distance.getDistanceMatrix(origin, destination, withTraffic);
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      res.json({
        success: true,
        distance: {
          meters: result.distanceMeters,
          km: result.distanceKm
        },
        duration: {
          withTraffic: {
            seconds: result.durationWithTrafficSec,
            minutes: result.durationWithTrafficMin
          },
          withoutTraffic: {
            seconds: result.durationWithoutTrafficSec,
            minutes: result.durationWithoutTrafficMin
          }
        },
        traffic: result.trafficLevel
      });
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les conditions de trafic pour un trajet
   * POST /api/v1/location/traffic
   * 
   * Body: {
   *   "origin": { "lat": -4.4419, "lng": 15.2663 },
   *   "destination": { "lat": -4.4319, "lng": 15.2763 }
   * }
   */
  async getTraffic(req, res, next) {
    try {
      const { origin, destination } = req.body;
      
      if (!origin || !destination) {
        return res.status(400).json({ error: 'Origine et destination requises' });
      }
      
      const result = await maps.traffic.getConditions(origin, destination);
      
      res.json(result);
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * Prédire le temps de trajet à une heure donnée
   * POST /api/v1/location/predict-travel-time
   * 
   * Body: {
   *   "origin": { "lat": -4.4419, "lng": 15.2663 },
   *   "destination": { "lat": -4.4319, "lng": 15.2763 },
   *   "datetime": "2026-04-21T17:00:00Z" (optionnel)
   * }
   */
  async predictTravelTime(req, res, next) {
    try {
      const { origin, destination, datetime } = req.body;
      
      if (!origin || !destination) {
        return res.status(400).json({ error: 'Origine et destination requises' });
      }
      
      const result = await maps.traffic.predictTravelTime(
        origin,
        destination,
        datetime ? new Date(datetime) : new Date()
      );
      
      res.json(result);
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les zones de trafic autour d'un point
   * GET /api/v1/location/nearby-traffic?lat=-4.4419&lng=15.2663&radius=5
   */
  async getNearbyTraffic(req, res, next) {
    try {
      const { lat, lng, radius = 5 } = req.query;
      
      if (!lat || !lng) {
        return res.status(400).json({ error: 'Latitude et longitude requises' });
      }
      
      const result = await maps.traffic.getNearbyZones(
        parseFloat(lat),
        parseFloat(lng),
        parseFloat(radius)
      );
      
      res.json(result);
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * Calculer la distance à vol d'oiseau (Haversine)
   * POST /api/v1/location/haversine
   * 
   * Body: {
   *   "point1": { "lat": -4.4419, "lng": 15.2663 },
   *   "point2": { "lat": -4.4319, "lng": 15.2763 }
   * }
   */
  async haversineDistance(req, res, next) {
    try {
      const { point1, point2 } = req.body;
      
      if (!point1 || !point2) {
        return res.status(400).json({ error: 'Deux points requis' });
      }
      
      const distance = maps.distance.calculateHaversineDistance(
        point1.lat, point1.lng,
        point2.lat, point2.lng
      );
      
      res.json({
        success: true,
        distanceKm: Math.round(distance * 100) / 100,
        distanceMeters: Math.round(distance * 1000)
      });
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * Vérifier si c'est l'heure de pointe
   * GET /api/v1/location/is-peak-hour
   */
  async isPeakHour(req, res, next) {
    try {
      const isPeak = maps.traffic.isPeakHour();
      const factor = maps.traffic.getTrafficFactor();
      
      res.json({
        success: true,
        isPeakHour: isPeak,
        trafficFactor: factor,
        message: isPeak ? 'Heure de pointe - trafic dense' : 'Heure normale'
      });
      
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new LocationController();