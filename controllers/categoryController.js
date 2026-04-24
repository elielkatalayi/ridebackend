const { Category, CityCategoryPricing, City } = require('../models');

class CategoryController {
  /**
   * Obtenir toutes les catégories
   * GET /api/v1/categories
   */
  async getAllCategories(req, res, next) {
    try {
      const { city_id, type } = req.query;
      
      let where = { is_active: true };
      if (type) {
        where.type = type;
      }
      
      const categories = await Category.findAll({
        where,
        order: [['display_order', 'ASC'], ['name', 'ASC']]
      });
      
      // Si city_id est fourni, ajouter les tarifs spécifiques
      if (city_id) {
        const cityPricing = await CityCategoryPricing.findAll({
          where: { city_id, is_active: true }
        });
        
        const pricingMap = {};
        for (const pricing of cityPricing) {
          pricingMap[pricing.category_id] = pricing;
        }
        
        const categoriesWithPricing = categories.map(cat => {
          const catJson = cat.toJSON();
          const cityPricingData = pricingMap[cat.id];
          
          if (cityPricingData) {
            catJson.city_pricing = {
              base_fare: cityPricingData.base_fare ?? cat.base_fare,
              per_km_rate: cityPricingData.per_km_rate ?? cat.per_km_rate,
              per_minute_rate: cityPricingData.per_minute_rate ?? cat.per_minute_rate,
              min_fare: cityPricingData.min_fare ?? cat.min_fare,
              wait_free_minutes: cityPricingData.wait_free_minutes ?? cat.wait_free_minutes,
              wait_paid_per_minute: cityPricingData.wait_paid_per_minute ?? cat.wait_paid_per_minute,
              pause_per_minute: cityPricingData.pause_per_minute ?? cat.pause_per_minute
            };
          } else {
            catJson.city_pricing = {
              base_fare: cat.base_fare,
              per_km_rate: cat.per_km_rate,
              per_minute_rate: cat.per_minute_rate,
              min_fare: cat.min_fare,
              wait_free_minutes: cat.wait_free_minutes,
              wait_paid_per_minute: cat.wait_paid_per_minute,
              pause_per_minute: cat.pause_per_minute
            };
          }
          
          return catJson;
        });
        
        return res.json(categoriesWithPricing);
      }
      
      res.json(categories);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir une catégorie par ID
   * GET /api/v1/categories/:categoryId
   */
  async getCategoryById(req, res, next) {
    try {
      const { categoryId } = req.params;
      const { city_id } = req.query;
      
      const category = await Category.findByPk(categoryId);
      if (!category) {
        return res.status(404).json({ error: 'Catégorie non trouvée' });
      }
      
      const result = category.toJSON();
      
      // Ajouter les tarifs spécifiques à la ville
      if (city_id) {
        const cityPricing = await CityCategoryPricing.findOne({
          where: { category_id: categoryId, city_id, is_active: true }
        });
        
        if (cityPricing) {
          result.city_pricing = {
            base_fare: cityPricing.base_fare ?? category.base_fare,
            per_km_rate: cityPricing.per_km_rate ?? category.per_km_rate,
            per_minute_rate: cityPricing.per_minute_rate ?? category.per_minute_rate,
            min_fare: cityPricing.min_fare ?? category.min_fare,
            wait_free_minutes: cityPricing.wait_free_minutes ?? category.wait_free_minutes,
            wait_paid_per_minute: cityPricing.wait_paid_per_minute ?? category.wait_paid_per_minute,
            pause_per_minute: cityPricing.pause_per_minute ?? category.pause_per_minute
          };
        } else {
          result.city_pricing = {
            base_fare: category.base_fare,
            per_km_rate: category.per_km_rate,
            per_minute_rate: category.per_minute_rate,
            min_fare: category.min_fare,
            wait_free_minutes: category.wait_free_minutes,
            wait_paid_per_minute: category.wait_paid_per_minute,
            pause_per_minute: category.pause_per_minute
          };
        }
      }
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les catégories disponibles pour une ville
   * GET /api/v1/categories/city/:cityId
   */
  async getCategoriesByCity(req, res, next) {
    try {
      const { cityId } = req.params;
      
      const city = await City.findByPk(cityId);
      if (!city) {
        return res.status(404).json({ error: 'Ville non trouvée' });
      }
      
      const categories = await Category.findAll({
        where: { is_active: true, type: 'ride' },
        order: [['display_order', 'ASC']]
      });
      
      const cityPricing = await CityCategoryPricing.findAll({
        where: { city_id: cityId, is_active: true }
      });
      
      const pricingMap = {};
      for (const pricing of cityPricing) {
        pricingMap[pricing.category_id] = pricing;
      }
      
      const result = categories.map(cat => {
        const catJson = cat.toJSON();
        const pricing = pricingMap[cat.id];
        
        catJson.price_per_km = pricing?.per_km_rate ?? cat.per_km_rate;
        catJson.base_fare = pricing?.base_fare ?? cat.base_fare;
        catJson.icon = cat.icon;
        
        return catJson;
      });
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CategoryController();