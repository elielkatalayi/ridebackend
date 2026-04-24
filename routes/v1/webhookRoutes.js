const express = require('express');
const router = express.Router();
const webhookController = require('../../controllers/webhookController');
const { webhookLimiter } = require('../../middleware/rateLimiter');

// =====================================================
// 🔔 ROUTES WEBHOOKS (externe, pas d'auth JWT)
// =====================================================

/**
 * @route   POST /api/v1/webhooks/shawari/payment
 * @desc    Webhook Shawari pour les paiements
 * @access  Public (mais avec vérification de signature)
 */
router.post(
  '/shawari/payment',
  webhookLimiter,
  webhookController.shawariPaymentWebhook
);

/**
 * @route   POST /api/v1/webhooks/clickatell/status
 * @desc    Webhook Clickatell pour les statuts SMS
 * @access  Public
 */
router.post(
  '/clickatell/status',
  webhookLimiter,
  webhookController.clickatellStatusWebhook
);

/**
 * @route   POST /api/v1/webhooks/ride/status
 * @desc    Webhook pour les mises à jour de statut de course
 * @access  Public (authentifié par token spécifique)
 */
router.post(
  '/ride/status',
  webhookLimiter,
  webhookController.rideStatusWebhook
);

/**
 * @route   POST /api/v1/webhooks/driver/location
 * @desc    Webhook pour les mises à jour de position chauffeur
 * @access  Public (authentifié par token spécifique)
 */
router.post(
  '/driver/location',
  webhookLimiter,
  webhookController.driverLocationWebhook
);

module.exports = router;