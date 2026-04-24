// routes/commissionRoutes.js

const express = require('express');
const router = express.Router();
const commissionController = require('../../controllers/commissionController');
const { auth } = require('../../middleware/auth');

// Toutes les routes nécessitent une authentification
router.use(auth);

// =====================================================
// 📊 ROUTES COMMISSIONS POUR CHAUFFEUR
// =====================================================

/**
 * @route   GET /api/v1/commissions/history
 * @desc    Obtenir l'historique des commissions du chauffeur
 * @access  Private (Chauffeur uniquement)
 */
router.get('/history', commissionController.getMyCommissionHistory);

/**
 * @route   GET /api/v1/commissions/stats
 * @desc    Obtenir les statistiques des commissions
 * @access  Private (Chauffeur uniquement)
 */
router.get('/stats', commissionController.getMyCommissionStats);

/**
 * @route   GET /api/v1/commissions/:commissionId
 * @desc    Obtenir le détail d'une commission
 * @access  Private (Chauffeur uniquement)
 */
router.get('/:commissionId', commissionController.getCommissionDetail);

/**
 * @route   GET /api/v1/commissions/export/csv
 * @desc    Exporter l'historique des commissions en CSV
 * @access  Private (Chauffeur uniquement)
 */
router.get('/export/csv', commissionController.exportCommissions);

module.exports = router;