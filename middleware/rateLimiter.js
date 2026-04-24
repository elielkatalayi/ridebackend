const rateLimit = require('express-rate-limit');

/**
 * Limiteur global
 * 100 requêtes par 15 minutes
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  }
});

/**
 * Limiteur strict pour l'authentification
 * 5 tentatives par 15 minutes
 */
const authLimiter = rateLimit({
  windowMs: 0,
  max: 5,
  message: { error: 'Trop de tentatives de connexion, veuillez réessayer dans 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

/**
 * Limiteur pour les SMS OTP
 * 3 SMS par heure
 */
const otpLimiter = rateLimit({
  windowMs: 0, // 1 heure
  max: 3,
  message: { error: 'Trop de codes OTP demandés, veuillez réessayer dans 1 heure' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.body.phone || req.body.destination || req.ip;
  }
});

/**
 * Limiteur pour les paiements
 * 10 paiements par heure
 */
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives de paiement, veuillez réessayer plus tard' },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Limiteur pour les webhooks
 * 100 requêtes par minute
 */
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'Trop de requêtes' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for trusted IPs
    const trustedIps = process.env.TRUSTED_IPS?.split(',') || [];
    return trustedIps.includes(req.ip);
  }
});

/**
 * Limiteur pour les alertes SOS
 * 3 alertes par heure par utilisateur
 */
const sosLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Trop d\'alertes SOS, veuillez contacter le support' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  }
});

/**
 * Limiteur pour les mises à jour de position GPS
 * 120 requêtes par minute (2 par seconde)
 */
const locationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Trop de mises à jour de position' },
  standardHeaders: true,
  legacyHeaders: false
});


// Limiteur spécifique pour les transferts
const transferLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 transferts max
  message: 'Trop de transferts. Veuillez réessayer dans 15 minutes.',
  keyGenerator: (req) => req.user?.id || req.ip
});


module.exports = {
  globalLimiter,
  authLimiter,
  otpLimiter,
  paymentLimiter,
  webhookLimiter,
  sosLimiter,
  locationLimiter,
  transferLimiter
}; 

