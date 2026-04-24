const express = require('express');
const router = express.Router();
const rideController = require('../../../controllers/rideController');
const { auth, driverAuth } = require('../../../middleware/auth');
const { validate } = require('../../../middleware/validation');
const { sosLimiter, locationLimiter } = require('../../../middleware/rateLimiter');
const rideValidator = require('../../../validators/rideValidator');

// Routes passager (authentification simple)
router.use(auth);

// =====================================================
// 🚗 ROUTES COURSES
// =====================================================

/**
 * @route   POST /api/v1/rides/estimate
 * @desc    Estimer le prix d'une course
 * @access  Private
 */
router.post(
  '/estimate',
  validate(rideValidator.estimate),
  rideController.estimatePrice
);

/**
 * @route   POST /api/v1/rides/request
 * @desc    Créer une nouvelle demande de course
 * @access  Private
 */
router.post(
  '/request',
  validate(rideValidator.create),
  rideController.createRide
);

/**
 * @route   GET /api/v1/rides/:rideId
 * @desc    Obtenir les détails d'une course
 * @access  Private
 */
router.get(
  '/:rideId',
  validate(rideValidator.rideId, 'params'),
  rideController.getRide
);

/**
 * @route   POST /api/v1/rides/:rideId/accept
 * @desc    Accepter une course (chauffeur)
 * @access  Private (Chauffeur uniquement)
 */
router.post(
  '/:rideId/accept',
  driverAuth,
  validate(rideValidator.rideId, 'params'),
  rideController.acceptRide
);

/**
 * @route   POST /api/v1/rides/:rideId/negotiate
 * @desc    Proposer un prix (négociation)
 * @access  Private
 */
router.post(
  '/:rideId/negotiate',
  validate(rideValidator.rideId, 'params'),
  validate(rideValidator.negotiate),
  rideController.negotiatePrice
);

/**
 * @route   POST /api/v1/rides/:rideId/accept-price
 * @desc    Accepter la proposition de prix
 * @access  Private
 */
router.post(
  '/:rideId/accept-price',
  validate(rideValidator.rideId, 'params'),
  rideController.acceptPrice
);

/**
 * @route   POST /api/v1/rides/:rideId/driver-arrived
 * @desc    Signaler l'arrivée du chauffeur
 * @access  Private (Chauffeur uniquement)
 */
router.post(
  '/:rideId/driver-arrived',
  driverAuth,
  validate(rideValidator.rideId, 'params'),
  rideController.driverArrived
);

/**
 * @route   POST /api/v1/rides/:rideId/start
 * @desc    Démarrer la course
 * @access  Private (Chauffeur uniquement)
 */
router.post(
  '/:rideId/start',
  driverAuth,
  validate(rideValidator.rideId, 'params'),
  rideController.startRide
);

/**
 * @route   POST /api/v1/rides/:rideId/pause
 * @desc    Faire une pause pendant la course
 * @access  Private (Chauffeur uniquement)
 */
router.post(
  '/:rideId/pause',
  driverAuth,
  validate(rideValidator.rideId, 'params'),
  rideController.pauseRide
);

/**
 * @route   POST /api/v1/rides/:rideId/resume
 * @desc    Reprendre la course après pause
 * @access  Private (Chauffeur uniquement)
 */
router.post(
  '/:rideId/resume',
  driverAuth,
  validate(rideValidator.rideId, 'params'),
  rideController.resumeRide
);

/**
 * @route   POST /api/v1/rides/:rideId/add-stop
 * @desc    Ajouter un arrêt intermédiaire
 * @access  Private (Passager uniquement)
 */
router.post(
  '/:rideId/add-stop',
  validate(rideValidator.rideId, 'params'),
  validate(rideValidator.addStop),
  rideController.addStop
);

/**
 * @route   POST /api/v1/rides/:rideId/complete
 * @desc    Terminer la course
 * @access  Private (Chauffeur uniquement)
 */
router.post(
  '/:rideId/complete',
  driverAuth,
  validate(rideValidator.rideId, 'params'),
  rideController.completeRide
);

/**
 * @route   POST /api/v1/rides/:rideId/cancel
 * @desc    Annuler une course
 * @access  Private
 */
router.post(
  '/:rideId/cancel',
  validate(rideValidator.rideId, 'params'),
  validate(rideValidator.cancel),
  rideController.cancelRide
);

/**
 * @route   GET /api/v1/rides/:rideId/negotiations
 * @desc    Obtenir l'historique des négociations
 * @access  Private
 */
router.get(
  '/:rideId/negotiations',
  validate(rideValidator.rideId, 'params'),
  rideController.getNegotiations
);

/**
 * @route   GET /api/v1/rides/:rideId/stops
 * @desc    Obtenir les arrêts d'une course
 * @access  Private
 */
router.get(
  '/:rideId/stops',
  validate(rideValidator.rideId, 'params'),
  rideController.getStops
);

/**
 * @route   GET /api/v1/rides/:rideId/pauses
 * @desc    Obtenir les pauses d'une course
 * @access  Private
 */
router.get(
  '/:rideId/pauses',
  validate(rideValidator.rideId, 'params'),
  rideController.getPauses
);

module.exports = router;