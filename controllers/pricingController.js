const pricingService = require('../services/pricing/pricingService');
const trafficService = require('../services/pricing/trafficService');
const { Category } = require('../models');

class PricingController {
  /**
   * Estimer le prix d'une course
   * POST /api/v1/pricing/estimate
   */
  async estimatePrice(req, res, next) {
    try {
      const { origin_lat, origin_lng, destination_lat, destination_lng, category_id, city_id } = req.body;
      
      if (!origin_lat || !origin_lng || !destination_lat || !destination_lng || !category_id || !city_id) {
        return res.status(400).json({ error: 'Paramètres manquants' });
      }
      
      const estimate = await pricingService.estimatePrice(
        { lat: origin_lat, lng: origin_lng },
        { lat: destination_lat, lng: destination_lng },
        category_id,
        city_id
      );
      
      res.json(estimate);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir le niveau de trafic pour un trajet
   * POST /api/v1/pricing/traffic
   */
  async getTrafficLevel(req, res, next) {
    try {
      const { origin_lat, origin_lng, destination_lat, destination_lng } = req.body;
      
      const traffic = await trafficService.getTrafficLevel(
        { lat: origin_lat, lng: origin_lng },
        { lat: destination_lat, lng: destination_lng }
      );
      
      res.json(traffic);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Prédire le trafic à une heure donnée
   * POST /api/v1/pricing/predict-traffic
   */
  async predictTraffic(req, res, next) {
    try {
      const { origin_lat, origin_lng, destination_lat, destination_lng, departure_time } = req.body;
      
      const prediction = await trafficService.predictTraffic(
        { lat: origin_lat, lng: origin_lng },
        { lat: destination_lat, lng: destination_lng },
        new Date(departure_time)
      );
      
      res.json(prediction);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les tarifs d'une catégorie
   * GET /api/v1/pricing/category/:categoryId
   */
  async getCategoryPricing(req, res, next) {
    try {
      const { categoryId } = req.params;
      const { city_id } = req.query;
      
      if (!city_id) {
        const category = await Category.findByPk(categoryId);
        if (!category) {
          return res.status(404).json({ error: 'Catégorie non trouvée' });
        }
        
        return res.json({
          base_fare: category.base_fare,
          per_km_rate: category.per_km_rate,
          per_minute_rate: category.per_minute_rate,
          min_fare: category.min_fare,
          wait_free_minutes: category.wait_free_minutes,
          wait_paid_per_minute: category.wait_paid_per_minute,
          pause_per_minute: category.pause_per_minute
        });
      }
      
      const pricing = await pricingService.getCategoryPricing(categoryId, city_id);
      
      res.json(pricing);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Calculer les frais d'attente
   * POST /api/v1/pricing/calculate-wait
   */
  async calculateWaitCharge(req, res, next) {
    try {
      const { wait_minutes, free_minutes, paid_per_minute } = req.body;
      
      const result = pricingService.calculateWaitCharge(wait_minutes, free_minutes, paid_per_minute);
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Calculer les frais de pause
   * POST /api/v1/pricing/calculate-pause
   */
  async calculatePauseCharge(req, res, next) {
    try {
      const { pause_minutes, rate_per_minute } = req.body;
      
      const result = pricingService.calculatePauseCharge(pause_minutes, rate_per_minute);
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les zones de trafic dense
   * GET /api/v1/pricing/hotspots
   */
  async getTrafficHotspots(req, res, next) {
    try {
      const { city_id } = req.query;
      
      const hotspots = await trafficService.getTrafficHotspots(city_id);
      
      res.json(hotspots);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PricingController();