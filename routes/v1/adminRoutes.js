const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/adminController');
const { auth } = require('../../middleware/auth');
const { isAdmin } = require('../../middleware/roleCheck');
const { validate } = require('../../middleware/validation');
const adminValidator = require('../../validators/adminValidator');
const driverBlockController = require('../../controllers/driverBlockController');

// Toutes les routes nécessitent authentification admin
router.use(auth);
router.use(isAdmin);

// =====================================================
// 👑 ROUTES ADMINISTRATION
// =====================================================

// ========== STATISTIQUES ==========
router.get('/stats', adminController.getStats);
router.get('/financial-stats', validate(adminValidator.financialStats, 'query'), adminController.getFinancialStats);

// ========== UTILISATEURS ==========
router.get('/users', validate(adminValidator.listUsers, 'query'), adminController.getUsers);
router.get('/drivers', validate(adminValidator.listDrivers, 'query'), adminController.getDrivers);
router.post('/drivers/:driverId/suspend', validate(adminValidator.suspendDriver), adminController.suspendDriver);
router.post('/drivers/:driverId/reactivate', adminController.reactivateDriver);

// ========== PARAMÈTRES ==========
router.get('/settings', adminController.getAllSettings);
router.put('/settings/:key', validate(adminValidator.updateSetting), adminController.updateSetting);
router.post('/settings/bulk', validate(adminValidator.updateMultipleSettings), adminController.updateMultipleSettings);
router.get('/dispatch-config', adminController.getDispatchConfig);
router.put('/dispatch-config', validate(adminValidator.updateDispatchConfig), adminController.updateDispatchConfig);

// ========== CATÉGORIES ==========
router.get('/categories', adminController.getAllCategories);
router.post('/categories', validate(adminValidator.createCategory), adminController.createCategory);
router.put('/categories/:categoryId', validate(adminValidator.updateCategory), adminController.updateCategory);
router.delete('/categories/:categoryId', adminController.deleteCategory);
router.post('/city-pricing', validate(adminValidator.setCityPricing), adminController.setCityPricing);

// ========== GÉOGRAPHIE ==========
router.get('/countries', adminController.getAllCountries);
router.post('/countries', validate(adminValidator.createCountry), adminController.createCountry);
router.post('/cities', validate(adminValidator.createCity), adminController.createCity);
router.put('/cities/:cityId', validate(adminValidator.updateCity), adminController.updateCity);

// Gestion des chauffeurs bloqués
router.get('/drivers/blocked', driverBlockController.getBlockedDrivers);
router.get('/drivers/:driverId/balance', driverBlockController.getDriverBalance);
router.post('/drivers/:driverId/unblock', driverBlockController.unblockDriver);
module.exports = router;