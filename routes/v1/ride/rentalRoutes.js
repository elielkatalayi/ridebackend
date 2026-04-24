const express = require('express');
const router = express.Router();
const rentalController = require('../../../controllers/rentalController');
const { auth } = require('../../../middleware/auth');

// Toutes les routes nécessitent une authentification
router.use(auth);

// =====================================================
// 🚙 ROUTES LOCATION
// =====================================================

/**
 * @route   POST /api/v1/rentals/vehicle
 * @desc    Créer une location de véhicule
 * @access  Private
 */
router.post('/vehicle', rentalController.createVehicleRental);

/**
 * @route   POST /api/v1/rentals/heavy-equipment
 * @desc    Créer une location d'engin TP
 * @access  Private
 */
router.post('/heavy-equipment', rentalController.createHeavyEquipmentRental);

/**
 * @route   GET /api/v1/rentals/my-rentals
 * @desc    Obtenir les locations de l'utilisateur
 * @access  Private
 */
router.get('/my-rentals', rentalController.getMyRentals);

/**
 * @route   GET /api/v1/rentals/available-vehicles
 * @desc    Obtenir les véhicules disponibles
 * @access  Public
 */
router.get('/available-vehicles', rentalController.getAvailableVehicles);

/**
 * @route   GET /api/v1/rentals/available-equipment
 * @desc    Obtenir les engins disponibles
 * @access  Public
 */
router.get('/available-equipment', rentalController.getAvailableEquipment);

/**
 * @route   PUT /api/v1/rentals/:rentalId/confirm
 * @desc    Confirmer une location (admin)
 * @access  Private (Admin uniquement)
 */
router.put('/:rentalId/confirm', rentalController.confirmRental);

/**
 * @route   PUT /api/v1/rentals/:rentalId/start
 * @desc    Démarrer une location
 * @access  Private (Admin uniquement)
 */
router.put('/:rentalId/start', rentalController.startRental);

/**
 * @route   PUT /api/v1/rentals/:rentalId/complete
 * @desc    Terminer une location
 * @access  Private (Admin uniquement)
 */
router.put('/:rentalId/complete', rentalController.completeRental);

/**
 * @route   POST /api/v1/rentals/:rentalId/refund-deposit
 * @desc    Rembourser la caution
 * @access  Private (Admin uniquement)
 */
router.post('/:rentalId/refund-deposit', rentalController.refundDeposit);

module.exports = router;