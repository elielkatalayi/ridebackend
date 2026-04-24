const express = require('express');
const router = express.Router();
const pricingController = require('../../../controllers/pricingController');
const { auth } = require('../../../middleware/auth');
const { validate } = require('../../../middleware/validation');
const rideValidator = require('../../../validators/rideValidator');

// =====================================================
// 💰 ROUTES TARIFICATION
// =====================================================

/**
 * @route   POST /api/v1/pricing/estimate
 * @desc    Estimer le prix d'une course
 * @access  Private
 */
router.post(
  '/estimate',
  auth,
  validate(rideValidator.estimate),
  pricingController.estimatePrice
);

/**
 * @route   POST /api/v1/pricing/traffic
 * @desc    Obtenir le niveau de trafic pour un trajet
 * @access  Public
 */
router.post('/traffic', pricingController.getTrafficLevel);

/**
 * @route   POST /api/v1/pricing/predict-traffic
 * @desc    Prédire le trafic à une heure donnée
 * @access  Public
 */
router.post('/predict-traffic', pricingController.predictTraffic);

/**
 * @route   GET /api/v1/pricing/category/:categoryId
 * @desc    Obtenir les tarifs d'une catégorie
 * @access  Public
 */
router.get('/category/:categoryId', pricingController.getCategoryPricing);

/**
 * @route   POST /api/v1/pricing/calculate-wait
 * @desc    Calculer les frais d'attente
 * @access  Public
 */
router.post('/calculate-wait', pricingController.calculateWaitCharge);

/**
 * @route   POST /api/v1/pricing/calculate-pause
 * @desc    Calculer les frais de pause
 * @access  Public
 */
router.post('/calculate-pause', pricingController.calculatePauseCharge);

/**
 * @route   GET /api/v1/pricing/hotspots
 * @desc    Obtenir les zones de trafic dense
 * @access  Public
 */
router.get('/hotspots', pricingController.getTrafficHotspots);

module.exports = router;