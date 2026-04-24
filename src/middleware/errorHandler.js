const env = require('../config/env');

/**
 * Gestionnaire d'erreurs global
 */
const errorHandler = (err, req, res, next) => {
  // Log de l'erreur
  console.error(`[ERROR] ${err.stack}`);
  
  // Erreurs Sequelize
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      error: 'Erreur de validation',
      details: err.errors.map(e => ({
        field: e.path,
        message: e.message
      }))
    });
  }
  
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      error: 'Conflit de données',
      details: err.errors.map(e => ({
        field: e.path,
        message: `La valeur "${e.value}" existe déjà`
      }))
    });
  }
  
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({
      error: 'Référence invalide',
      message: 'La référence vers une ressource est invalide'
    });
  }
  
  // Erreurs JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Token invalide',
      message: 'Le token d\'authentification est invalide'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expiré',
      message: 'Le token d\'authentification a expiré'
    });
  }
  
  // Erreurs métier personnalisées
  const businessErrors = [
    'Solde insuffisant',
    'PIN incorrect',
    'Course non trouvée',
    'Chauffeur non trouvé',
    'Utilisateur non trouvé',
    'Code OTP invalide',
    'Code OTP expiré',
    'Wallet non trouvé',
    'Catégorie non trouvée',
    'Ville non trouvée',
    'Document manquant',
    'Compte suspendu',
    'Non autorisé',
    'Token expiré',
    'Token invalide'
  ];
  
  if (businessErrors.includes(err.message)) {
    return res.status(400).json({
      error: err.message
    });
  }
  
  // Erreur par défaut
  const statusCode = err.status || 500;
  const response = {
    error: err.message || 'Erreur interne du serveur'
  };
  
  if (env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }
  
  res.status(statusCode).json(response);
};

/**
 * Gestionnaire pour les routes non trouvées
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Route non trouvée',
    path: req.originalUrl,
    method: req.method
  });
};

module.exports = {
  errorHandler,
  notFoundHandler
};


