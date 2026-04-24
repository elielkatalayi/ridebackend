const express = require('express');
const router = express.Router();
const sosController = require('../../../controllers/sosController');
const { auth } = require('../../../middleware/auth');
const { validate } = require('../../../middleware/validation');
const { sosLimiter } = require('../../../middleware/rateLimiter');

// Toutes les routes nécessitent une authentification
router.use(auth);

// =====================================================
// 🆘 ROUTES SOS
// =====================================================

/**
 * @route   POST /api/v1/sos/trigger
 * @desc    Déclencher une alerte SOS
 * @access  Private
 */
router.post(
  '/trigger',
  sosLimiter,
  sosController.triggerSos
);

/**
 * @route   GET /api/v1/sos/active
 * @desc    Obtenir les alertes SOS actives (admin)
 * @access  Private (Admin uniquement)
 */
router.get('/active', sosController.getActiveAlerts);

/**
 * @route   PUT /api/v1/sos/:sosId/resolve
 * @desc    Résoudre une alerte SOS (admin)
 * @access  Private (Admin uniquement)
 */
router.put('/:sosId/resolve', sosController.resolveSos);

/**
 * @route   GET /api/v1/sos/history
 * @desc    Obtenir l'historique SOS d'un passager
 * @access  Private
 */
router.get('/history', sosController.getSosHistory);

/**
 * @route   GET /api/v1/sos/:sosId
 * @desc    Obtenir les détails d'une alerte SOS
 * @access  Private
 */
router.get('/:sosId', sosController.getSosDetails);

module.exports = router;