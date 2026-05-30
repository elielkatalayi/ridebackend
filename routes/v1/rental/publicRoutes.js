const express = require('express');
const router = express.Router();
const publicController = require('../../../controllers/rental/publicController');

// Routes publiques (SANS AUTHENTIFICATION)
router.get('/available-vehicles', publicController.getAvailableVehicles);
router.get('/vehicles/:vehicleId', publicController.getVehicleDetails);

module.exports = router;