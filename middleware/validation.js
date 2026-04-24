const Joi = require('joi');

/**
 * Middleware de validation des requêtes
 * @param {Joi.Schema} schema - Schéma Joi
 * @param {string} property - Propriété à valider (body, query, params)
 * @returns {Function} Middleware Express
 */
const validate = (schema, property = 'body') => {
  // Vérifier que le schéma existe
  if (!schema) {
    console.error('❌ ERREUR: Schéma de validation manquant pour', property);
    return (req, res, next) => next();
  }
  
  // Vérifier que le schéma a la méthode validate
  if (typeof schema.validate !== 'function') {
    console.error('❌ ERREUR: Schéma invalide - pas de méthode validate', schema);
    return (req, res, next) => next();
  }
  
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        error: 'Erreur de validation',
        errors
      });
    }
    
    req[property] = value;
    next();
  };
};

// Schémas de validation communs
const schemas = {
  pagination: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(50),
    offset: Joi.number().integer().min(0).default(0)
  }),
  
  id: Joi.object({
    id: Joi.string().uuid().required()
  }),
  
  coordinates: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required()
  }),
  
  phone: Joi.string().pattern(/^(\+243|0)[0-9]{9}$/).required(),
  email: Joi.string().email().optional(),
  password: Joi.string().min(6).max(100).required(),
  amount: Joi.number().integer().min(100).max(10000000).required(),
  pin: Joi.string().pattern(/^\d{6}$/).required(),
  otp: Joi.string().pattern(/^\d{6}$/).required(),
  boolean: Joi.boolean(),
  date: Joi.date()
};

module.exports = {
  validate,
  schemas
};

