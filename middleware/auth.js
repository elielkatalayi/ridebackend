const jwtService = require('../services/auth/jwtService');
const { User, Driver } = require('../models');

/**
 * Middleware d'authentification JWT
 * Vérifie le token et ajoute l'utilisateur à req.user
 */
const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token d\'authentification manquant' });
    }
    
    const token = authHeader.split(' ')[1];
    
    const payload = jwtService.verifyToken(token);
    
    const user = await User.findByPk(payload.id, {
      attributes: { exclude: ['password_hash'] }
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non trouvé' });
    }
    
    if (!user.is_active) {
      return res.status(403).json({ error: 'Compte désactivé' });
    }
    
    if (user.is_blocked) {
      return res.status(403).json({ error: 'Compte bloqué. Contactez le support.' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    if (error.message === 'Token expiré') {
      return res.status(401).json({ error: 'Token expiré' });
    }
    if (error.message === 'Token invalide') {
      return res.status(401).json({ error: 'Token invalide' });
    }
    return res.status(401).json({ error: 'Authentification échouée' });
  }
};

/**
 * Middleware d'authentification optionnelle
 * N'échoue pas si le token est absent
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payload = jwtService.verifyToken(token);
      
      const user = await User.findByPk(payload.id, {
        attributes: { exclude: ['password_hash'] }
      });
      
      if (user && user.is_active && !user.is_blocked) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    next();
  }
};

/**
 * Middleware d'authentification pour chauffeur
 * Vérifie que l'utilisateur est bien un chauffeur et ajoute req.driver
 */
const driverAuth = async (req, res, next) => {
  try {
    await auth(req, res, async (err) => {
      if (err) return;
      
      if (!req.user) {
        return res.status(401).json({ error: 'Authentification requise' });
      }
      
      const driver = await Driver.findOne({
        where: { user_id: req.user.id }
      });
      
      if (!driver) {
        return res.status(403).json({ error: 'Compte chauffeur non trouvé' });
      }
      
      if (!driver.is_approved) {
        return res.status(403).json({ error: 'Compte chauffeur en attente de validation' });
      }
      
      if (driver.is_suspended) {
        const suspensionEnd = driver.suspended_until;
        if (suspensionEnd && new Date() < suspensionEnd) {
          return res.status(403).json({ 
            error: `Compte suspendu jusqu'au ${suspensionEnd.toLocaleDateString()}`,
            suspended_until: suspensionEnd,
            reason: driver.suspension_reason
          });
        }
      }
      
      req.driver = driver;
      next();
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  auth,
  authenticate: auth,  // ← Ajoute cet alias pour compatibilité
  optionalAuth,
  driverAuth
};

