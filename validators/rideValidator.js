const Joi = require('joi');

const rideValidator = {
  // Estimation de prix (SANS city_id)
  estimate: Joi.object({
    origin_lat: Joi.number().min(-90).max(90).required(),
    origin_lng: Joi.number().min(-180).max(180).required(),
    destination_lat: Joi.number().min(-90).max(90).required(),
    destination_lng: Joi.number().min(-180).max(180).required(),
    category_id: Joi.string().uuid().required()
    // city_id: Joi.string().uuid().required()  ← SUPPRIMÉ
  }),

  // Création de course (SANS city_id)
  create: Joi.object({
    category_id: Joi.string().uuid().required(),
    // city_id: Joi.string().uuid().required()  ← SUPPRIMÉ
    origin_lat: Joi.number().min(-90).max(90).required(),
    origin_lng: Joi.number().min(-180).max(180).required(),
    origin_address: Joi.string().max(500).optional(),
    destination_lat: Joi.number().min(-90).max(90).optional(),
    destination_lng: Joi.number().min(-180).max(180).optional(),
    destination_address: Joi.string().max(500).optional()
  }),

  // Négociation de prix
  negotiate: Joi.object({
    proposed_price: Joi.number().integer().min(500).max(1000000).required()
  }),

  // Ajout d'arrêt
  addStop: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
    address: Joi.string().max(500).optional(),
    name: Joi.string().max(255).optional()
  }),

  // Annulation
  cancel: Joi.object({
    reason: Joi.string().max(255).optional()
  }),

  // ID course
  rideId: Joi.object({
    rideId: Joi.string().uuid().required()
  }),

  // Liste des courses
  list: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(50),
    offset: Joi.number().integer().min(0).default(0),
    status: Joi.string().valid('pending', 'ongoing', 'completed', 'cancelled').optional(),
    start_date: Joi.date().optional(),
    end_date: Joi.date().optional()
  })
};

module.exports = rideValidator;
