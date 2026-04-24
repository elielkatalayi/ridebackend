const settingsService = require('../services/admin/settingsService');
const categoryService = require('../services/admin/categoryService');
const cityService = require('../services/admin/cityService');
const { User, Driver, Ride, Payment } = require('../models');
const { sequelize } = require('../config/database');

class AdminController {
  /**
   * Obtenir les statistiques globales
   * GET /api/v1/admin/stats
   */
  async getStats(req, res, next) {
    try {
      const totalUsers = await User.count({ where: { role: 'passenger' } });
      const totalDrivers = await Driver.count();
      const activeDrivers = await Driver.count({ where: { is_online: true } });
      const totalRides = await Ride.count();
      const completedRides = await Ride.count({ where: { status: 'completed' } });
      const totalRevenue = await Payment.sum('amount', { where: { status: 'completed' } });
      
      res.json({
        users: {
          total: totalUsers
        },
        drivers: {
          total: totalDrivers,
          active: activeDrivers
        },
        rides: {
          total: totalRides,
          completed: completedRides
        },
        revenue: totalRevenue || 0
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir tous les utilisateurs
   * GET /api/v1/admin/users
   */
  async getUsers(req, res, next) {
    try {
      const { limit = 50, offset = 0, role } = req.query;
      
      const where = {};
      if (role) {
        where.role = role;
      }
      
      const users = await User.findAndCountAll({
        where,
        attributes: { exclude: ['password_hash'] },
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['created_at', 'DESC']]
      });
      
      res.json({
        users: users.rows,
        total: users.count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir tous les chauffeurs
   * GET /api/v1/admin/drivers
   */
  async getDrivers(req, res, next) {
    try {
      const { limit = 50, offset = 0, status } = req.query;
      
      const where = {};
      if (status === 'suspended') {
        where.is_suspended = true;
      } else if (status === 'active') {
        where.is_suspended = false;
        where.is_approved = true;
      } else if (status === 'pending') {
        where.is_approved = false;
      }
      
      const drivers = await Driver.findAndCountAll({
        where,
        include: ['user', 'city'],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['created_at', 'DESC']]
      });
      
      res.json({
        drivers: drivers.rows,
        total: drivers.count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Suspendre un chauffeur
   * POST /api/v1/admin/drivers/:driverId/suspend
   */
  async suspendDriver(req, res, next) {
    try {
      const { driverId } = req.params;
      const { reason, days } = req.body;
      
      const driverService = require('../services/driver/driverService');
      const driver = await driverService.suspendDriver(driverId, reason, days || 7);
      
      res.json({
        success: true,
        driver,
        message: `Chauffeur suspendu pour ${days || 7} jours`
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Réactiver un chauffeur
   * POST /api/v1/admin/drivers/:driverId/reactivate
   */
  async reactivateDriver(req, res, next) {
    try {
      const { driverId } = req.params;
      
      const driverService = require('../services/driver/driverService');
      const driver = await driverService.reactivateDriver(driverId);
      
      res.json({
        success: true,
        driver,
        message: 'Chauffeur réactivé'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir tous les paramètres
   * GET /api/v1/admin/settings
   */
  async getAllSettings(req, res, next) {
    try {
      const settings = await settingsService.getAllSettings();
      
      res.json(settings);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour un paramètre
   * PUT /api/v1/admin/settings/:key
   */
  async updateSetting(req, res, next) {
    try {
      const { key } = req.params;
      const { value } = req.body;
      
      const result = await settingsService.updateSetting(key, value, req.user.id);
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour plusieurs paramètres
   * POST /api/v1/admin/settings/bulk
   */
  async updateMultipleSettings(req, res, next) {
    try {
      const { settings } = req.body;
      
      const results = await settingsService.updateMultipleSettings(settings, req.user.id);
      
      res.json({
        success: true,
        updated: results.length,
        results
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir la configuration de dispatch
   * GET /api/v1/admin/dispatch-config
   */
  async getDispatchConfig(req, res, next) {
    try {
      const config = await settingsService.getDispatchConfig();
      
      res.json(config);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour la configuration de dispatch
   * PUT /api/v1/admin/dispatch-config
   */
  async updateDispatchConfig(req, res, next) {
    try {
      const config = req.body;
      
      const result = await settingsService.updateDispatchConfig(config, req.user.id);
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les catégories (admin)
   * GET /api/v1/admin/categories
   */
  async getAllCategories(req, res, next) {
    try {
      const categories = await categoryService.getAllCategories(false);
      
      res.json(categories);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Créer une catégorie
   * POST /api/v1/admin/categories
   */
  async createCategory(req, res, next) {
    try {
      const category = await categoryService.createCategory(req.body, req.user.id);
      
      res.status(201).json(category);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour une catégorie
   * PUT /api/v1/admin/categories/:categoryId
   */
  async updateCategory(req, res, next) {
    try {
      const { categoryId } = req.params;
      
      const category = await categoryService.updateCategory(categoryId, req.body, req.user.id);
      
      res.json(category);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Supprimer une catégorie
   * DELETE /api/v1/admin/categories/:categoryId
   */
  async deleteCategory(req, res, next) {
    try {
      const { categoryId } = req.params;
      
      await categoryService.deleteCategory(categoryId, req.user.id);
      
      res.json({ success: true, message: 'Catégorie supprimée' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Définir les tarifs par ville
   * POST /api/v1/admin/city-pricing
   */
  async setCityPricing(req, res, next) {
    try {
      const { category_id, city_id, ...pricingData } = req.body;
      
      const pricing = await categoryService.setCityPricing(
        category_id,
        city_id,
        pricingData,
        req.user.id
      );
      
      res.json(pricing);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir tous les pays
   * GET /api/v1/admin/countries
   */
  async getAllCountries(req, res, next) {
    try {
      const countries = await cityService.getAllCountries();
      
      res.json(countries);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Créer un pays
   * POST /api/v1/admin/countries
   */
  async createCountry(req, res, next) {
    try {
      const country = await cityService.createCountry(req.body, req.user.id);
      
      res.status(201).json(country);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Créer une ville
   * POST /api/v1/admin/cities
   */
  async createCity(req, res, next) {
    try {
      const city = await cityService.createCity(req.body, req.user.id);
      
      res.status(201).json(city);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour une ville
   * PUT /api/v1/admin/cities/:cityId
   */
  async updateCity(req, res, next) {
    try {
      const { cityId } = req.params;
      
      const city = await cityService.updateCity(cityId, req.body, req.user.id);
      
      res.json(city);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les statistiques financières
   * GET /api/v1/admin/financial-stats
   */
  async getFinancialStats(req, res, next) {
    try {
      const { start_date, end_date } = req.query;
      
      const where = { status: 'completed' };
      if (start_date && end_date) {
        where.completed_at = {
          [Op.between]: [new Date(start_date), new Date(end_date)]
        };
      }
      
      const totalPayments = await Payment.sum('amount', { where });
      const totalFees = await Payment.sum('fee', { where });
      const totalRides = await Ride.count({ where: { status: 'completed' } });
      
      // Revenus par méthode de paiement
      const paymentsByMethod = await Payment.findAll({
        where,
        attributes: ['method', [sequelize.fn('SUM', sequelize.col('amount')), 'total']],
        group: ['method']
      });
      
      res.json({
        total_revenue: totalPayments || 0,
        total_fees: totalFees || 0,
        net_revenue: (totalPayments || 0) - (totalFees || 0),
        total_rides: totalRides,
        by_method: paymentsByMethod
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminController();