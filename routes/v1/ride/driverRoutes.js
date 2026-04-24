const express = require('express');
const router = express.Router();
const driverController = require('../../../controllers/driverController');
const { auth, driverAuth } = require('../../../middleware/auth');
const { validate } = require('../../../middleware/validation');
const { locationLimiter } = require('../../../middleware/rateLimiter');
const upload = require('../../../middleware/upload');

// Toutes les routes nécessitent une authentification
router.use(auth);

// =====================================================
// 👨‍✈️ ROUTES CHAUFFEUR
// =====================================================

/**
 * @route   POST /api/v1/drivers/register
 * @desc    Devenir chauffeur
 * @access  Private
 */
router.post(
  '/register',
  upload.fields([
    { name: 'license_photo', maxCount: 1 },
    { name: 'vehicle_registration', maxCount: 1 },
    { name: 'insurance', maxCount: 1 },
    { name: 'id_photo', maxCount: 1 },
    { name: 'portrait_photo', maxCount: 1 },
    { name: 'vehicle_photo_front', maxCount: 1 },
    { name: 'vehicle_photo_back', maxCount: 1 },
    { name: 'vehicle_photo_interior', maxCount: 1 },
  ]),
  driverController.registerDriver
);

/**
 * @route   GET /api/v1/drivers/me
 * @desc    Obtenir le profil chauffeur
 * @access  Private (Chauffeur uniquement)
 */
router.get('/me', driverAuth, driverController.getDriverProfile);

/**
 * @route   PUT /api/v1/drivers/location
 * @desc    Mettre à jour la position GPS
 * @access  Private (Chauffeur uniquement)
 */
router.put(
  '/location',
  driverAuth,
  locationLimiter,
  driverController.updateLocation
);

/**
 * @route   PUT /api/v1/drivers/status
 * @desc    Mettre à jour le statut en ligne
 * @access  Private (Chauffeur uniquement)
 */
router.put('/status', driverAuth, driverController.updateOnlineStatus);

/**
 * @route   GET /api/v1/drivers/points
 * @desc    Obtenir les points d'activité
 * @access  Private (Chauffeur uniquement)
 */
router.get('/points', driverAuth, driverController.getPoints);

/**
 * @route   GET /api/v1/drivers/leaderboard
 * @desc    Obtenir le classement des chauffeurs
 * @access  Public
 */
router.get('/leaderboard', driverController.getLeaderboard);

/**
 * @route   PUT /api/v1/drivers/documents
 * @desc    Mettre à jour les documents
 * @access  Private (Chauffeur uniquement)
 */
router.put('/documents', driverAuth, driverController.updateDocuments);

/**
 * @route   GET /api/v1/drivers/nearby
 * @desc    Obtenir les chauffeurs à proximité
 * @access  Public
 */
router.get('/nearby', driverController.getNearbyDrivers);

module.exports = router;