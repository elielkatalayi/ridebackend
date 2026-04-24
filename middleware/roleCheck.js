/**
 * Middleware de vérification des rôles
 * @param {...string} roles - Rôles autorisés
 * @returns {Function}
 */
const checkRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentification requise' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Accès refusé. Rôle requis: ${roles.join(' ou ')}`,
        required_roles: roles,
        your_role: req.user.role
      });
    }
    
    next();
  };
};

/**
 * Vérifie si l'utilisateur est un administrateur
 */
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès administrateur requis' });
  }
  
  next();
};

/**
 * Vérifie si l'utilisateur est un passager
 */
const isPassenger = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  
  if (req.user.role !== 'passenger' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès passager requis' });
  }
  
  next();
};

/**
 * Vérifie si l'utilisateur est un chauffeur
 */
const isDriver = (req, res, next) => {
  if (!req.driver && !req.user?.role === 'admin') {
    return res.status(403).json({ error: 'Accès chauffeur requis' });
  }
  
  next();
};

/**
 * Vérifie que l'utilisateur a accès à la ressource
 * @param {string} paramName - Nom du paramètre dans req.params contenant l'ID
 * @param {string} modelName - Nom du modèle (User, Ride, etc.)
 * @param {string} userIdField - Champ contenant l'ID utilisateur dans le modèle
 */
const checkOwnership = (paramName, modelName, userIdField = 'user_id') => {
  return async (req, res, next) => {
    try {
      if (req.user.role === 'admin') {
        return next();
      }
      
      const { models } = require('../models');
      const Model = models[modelName];
      
      if (!Model) {
        return res.status(500).json({ error: 'Modèle non trouvé' });
      }
      
      const resourceId = req.params[paramName];
      const resource = await Model.findByPk(resourceId);
      
      if (!resource) {
        return res.status(404).json({ error: 'Ressource non trouvée' });
      }
      
      if (resource[userIdField] !== req.user.id) {
        return res.status(403).json({ error: 'Vous n\'êtes pas autorisé à accéder à cette ressource' });
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  checkRole,
  isAdmin,
  isPassenger,
  isDriver,
  checkOwnership
};