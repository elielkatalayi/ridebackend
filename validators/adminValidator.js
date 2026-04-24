const Joi = require('joi');

const adminValidator = {
  // Création catégorie
  createCategory: Joi.object({
    name: Joi.string().max(50).required(),
    slug: Joi.string().max(50).required(),
    type: Joi.string().valid('ride', 'rental', 'heavy').default('ride'),
    icon: Joi.string().max(10).optional(),
    description: Joi.string().optional(),
    base_fare: Joi.number().integer().min(0).default(500),
    per_km_rate: Joi.number().integer().min(0).default(1000),
    per_minute_rate: Joi.number().integer().min(0).default(80),
    min_fare: Joi.number().integer().min(0).default(2000),
    wait_free_minutes: Joi.number().integer().min(0).default(5),
    wait_paid_per_minute: Joi.number().integer().min(0).default(150),
    pause_per_minute: Joi.number().integer().min(0).default(100),
    rental_half_day_rate: Joi.number().integer().min(0).optional(),
    rental_full_day_rate: Joi.number().integer().min(0).optional(),
    rental_week_rate: Joi.number().integer().min(0).optional(),
    heavy_hourly_rate: Joi.number().integer().min(0).optional(),
    heavy_daily_rate: Joi.number().integer().min(0).optional(),
    display_order: Joi.number().integer().min(0).default(0)
  }),

  // Mise à jour catégorie
  updateCategory: Joi.object({
    name: Joi.string().max(50).optional(),
    slug: Joi.string().max(50).optional(),
    type: Joi.string().valid('ride', 'rental', 'heavy').optional(),
    icon: Joi.string().max(10).optional(),
    description: Joi.string().optional(),
    base_fare: Joi.number().integer().min(0).optional(),
    per_km_rate: Joi.number().integer().min(0).optional(),
    per_minute_rate: Joi.number().integer().min(0).optional(),
    min_fare: Joi.number().integer().min(0).optional(),
    wait_free_minutes: Joi.number().integer().min(0).optional(),
    wait_paid_per_minute: Joi.number().integer().min(0).optional(),
    pause_per_minute: Joi.number().integer().min(0).optional(),
    is_active: Joi.boolean().optional(),
    display_order: Joi.number().integer().min(0).optional()
  }),

  // Tarifs par ville
  setCityPricing: Joi.object({
    category_id: Joi.string().uuid().required(),
    city_id: Joi.string().uuid().required(),
    base_fare: Joi.number().integer().min(0).optional(),
    per_km_rate: Joi.number().integer().min(0).optional(),
    per_minute_rate: Joi.number().integer().min(0).optional(),
    min_fare: Joi.number().integer().min(0).optional(),
    wait_free_minutes: Joi.number().integer().min(0).optional(),
    wait_paid_per_minute: Joi.number().integer().min(0).optional(),
    pause_per_minute: Joi.number().integer().min(0).optional()
  }),

  // Création pays
  createCountry: Joi.object({
    code: Joi.string().length(2).uppercase().required(),
    name: Joi.string().max(100).required(),
    currency_code: Joi.string().length(3).uppercase().required(),
    currency_symbol: Joi.string().max(5).required(),
    phone_code: Joi.string().max(5).required()
  }),

  // Création ville
  createCity: Joi.object({
    country_id: Joi.string().uuid().required(),
    name: Joi.string().max(100).required(),
    timezone: Joi.string().default('Africa/Kinshasa'),
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional()
  }),

  // Mise à jour ville
  updateCity: Joi.object({
    name: Joi.string().max(100).optional(),
    timezone: Joi.string().optional(),
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),
    is_active: Joi.boolean().optional()
  }),

  // Suspension chauffeur
  suspendDriver: Joi.object({
    reason: Joi.string().max(255).required(),
    days: Joi.number().integer().min(1).max(30).default(7)
  }),

  // Configuration dispatch
  updateDispatchConfig: Joi.object({
    points_weight: Joi.number().min(0).max(1).optional(),
    distance_weight: Joi.number().min(0).max(1).optional(),
    max_search_radius_km: Joi.number().integer().min(1).max(20).optional(),
    max_drivers_notified: Joi.number().integer().min(1).max(50).optional()
  }),

  // Paramètres plateforme
  updateSetting: Joi.object({
    value: Joi.any().required()
  }),

  updateMultipleSettings: Joi.object({
    settings: Joi.object().required()
  }),

  // Liste utilisateurs
  listUsers: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(50),
    offset: Joi.number().integer().min(0).default(0),
    role: Joi.string().valid('passenger', 'driver', 'admin').optional(),
    is_active: Joi.boolean().optional()
  }),

  // Liste chauffeurs
  listDrivers: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(50),
    offset: Joi.number().integer().min(0).default(0),
    status: Joi.string().valid('active', 'suspended', 'pending').optional(),
    city_id: Joi.string().uuid().optional()
  }),

  // Statistiques financières
  financialStats: Joi.object({
    start_date: Joi.date().optional(),
    end_date: Joi.date().optional()
  })
};

module.exports = adminValidator;