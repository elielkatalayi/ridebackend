const express = require('express');
const router = express.Router();
const categoryController = require('../../../controllers/categoryController');

// =====================================================
// 📋 ROUTES CATÉGORIES
// =====================================================

/**
 * @route   GET /api/v1/categories
 * @desc    Obtenir toutes les catégories
 * @access  Public
 */
router.get('/', categoryController.getAllCategories);

/**
 * @route   GET /api/v1/categories/:categoryId
 * @desc    Obtenir une catégorie par ID
 * @access  Public
 */
router.get('/:categoryId', categoryController.getCategoryById);

/**
 * @route   GET /api/v1/categories/city/:cityId
 * @desc    Obtenir les catégories disponibles pour une ville
 * @access  Public
 */
router.get('/city/:cityId', categoryController.getCategoriesByCity);

module.exports = router;