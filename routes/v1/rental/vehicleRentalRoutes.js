// routes/vehicleRentalRoutes.js
const express = require('express');
const router = express.Router();
const vehicleRentalController = require('../../../controllers/rental/vehicleRentalController');
const { auth } = require('../../../middleware/auth');
const upload = require('../../../middleware/upload');

// Toutes les routes nécessitent authentification
router.use(auth);

// =====================================================
// 🚗 GESTION DES VÉHICULES (PROPRIÉTAIRE)
// =====================================================

/**
 * @route   POST /api/v1/vehicles
 * @desc    Enregistrer un nouveau véhicule
 * @access  Private
 */
router.post(
  '/',
  upload.fields([
    { name: 'cover_photo', maxCount: 1 },
    { name: 'registration_photo', maxCount: 1 },
    { name: 'insurance_photo', maxCount: 1 },
    { name: 'technical_control_photo', maxCount: 1 }
  ]),
  vehicleRentalController.registerVehicle
);

/**
 * @route   GET /api/v1/vehicles/my-vehicles
 * @desc    Obtenir mes véhicules
 * @access  Private
 */
router.get('/my-vehicles', vehicleRentalController.getMyVehicles);

/**
 * @route   GET /api/v1/vehicles/:vehicleId
 * @desc    Obtenir un véhicule
 * @access  Public
 */
router.get('/:vehicleId', vehicleRentalController.getVehicle);

/**
 * @route   PUT /api/v1/vehicles/:vehicleId
 * @desc    Modifier un véhicule
 * @access  Private (propriétaire uniquement)
 */
router.put('/:vehicleId', vehicleRentalController.updateVehicle);

/**
 * @route   DELETE /api/v1/vehicles/:vehicleId
 * @desc    Supprimer un véhicule
 * @access  Private (propriétaire uniquement)
 */
router.delete('/:vehicleId', vehicleRentalController.deleteVehicle);

// =====================================================
// 📅 GESTION DE LA DISPONIBILITÉ
// =====================================================

/**
 * @route   PUT /api/v1/vehicles/:vehicleId/availability
 * @desc    Mettre à jour la disponibilité
 * @access  Private (propriétaire uniquement)
 */
router.put('/:vehicleId/availability', vehicleRentalController.updateAvailability);

/**
 * @route   GET /api/v1/vehicles/:vehicleId/availability
 * @desc    Obtenir la disponibilité
 * @access  Public
 */
router.get('/:vehicleId/availability', vehicleRentalController.getAvailability);

// =====================================================
// 🔍 RECHERCHE ET DISPONIBILITÉ
// =====================================================

/**
 * @route   GET /api/v1/vehicles/available
 * @desc    Obtenir les véhicules disponibles
 * @access  Public
 */
router.get('/available', vehicleRentalController.getAvailableVehicles);

/**
 * @route   POST /api/v1/vehicles/:vehicleId/check-availability
 * @desc    Vérifier la disponibilité
 * @access  Public
 */
router.post('/:vehicleId/check-availability', vehicleRentalController.checkAvailability);

// =====================================================
// 📝 GESTION DES RÉSERVATIONS
// =====================================================

/**
 * @route   POST /api/v1/bookings
 * @desc    Créer une réservation
 * @access  Private
 */
router.post('/bookings', vehicleRentalController.createBooking);

/**
 * @route   GET /api/v1/bookings/my-bookings
 * @desc    Obtenir mes réservations
 * @access  Private
 */
router.get('/bookings/my-bookings', vehicleRentalController.getMyBookings);

/**
 * @route   GET /api/v1/bookings/:bookingId
 * @desc    Obtenir une réservation
 * @access  Private
 */
router.get('/bookings/:bookingId', vehicleRentalController.getBooking);

/**
 * @route   PUT /api/v1/bookings/:bookingId/confirm
 * @desc    Confirmer une réservation (propriétaire)
 * @access  Private (propriétaire uniquement)
 */
router.put('/bookings/:bookingId/confirm', vehicleRentalController.confirmBooking);

/**
 * @route   PUT /api/v1/bookings/:bookingId/start
 * @desc    Démarrer la location
 * @access  Private (propriétaire uniquement)
 */
router.put(
  '/bookings/:bookingId/start',
  upload.array('start_photos', 10),
  vehicleRentalController.startBooking
);

/**
 * @route   PUT /api/v1/bookings/:bookingId/complete
 * @desc    Terminer la location
 * @access  Private (propriétaire uniquement)
 */
router.put(
  '/bookings/:bookingId/complete',
  upload.fields([
    { name: 'end_photos', maxCount: 10 },
    { name: 'damage_photos', maxCount: 10 }
  ]),
  vehicleRentalController.completeBooking
);

/**
 * @route   POST /api/v1/bookings/:bookingId/cancel
 * @desc    Annuler une réservation
 * @access  Private
 */
router.post('/bookings/:bookingId/cancel', vehicleRentalController.cancelBooking);

// =====================================================
// ⭐ ÉVALUATIONS
// =====================================================

/**
 * @route   POST /api/v1/bookings/:bookingId/review
 * @desc    Évaluer une location
 * @access  Private
 */
router.post('/bookings/:bookingId/review', vehicleRentalController.addReview);

module.exports = router;