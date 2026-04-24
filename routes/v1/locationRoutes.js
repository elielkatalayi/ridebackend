// // routes/locationRoutes.js

// const express = require('express');
// const router = express.Router();
// const locationController = require('../../controllers/locationController');
// const { authenticate } = require('../../middleware/auth');

// // Toutes les routes nécessitent une authentification
// router.use(authenticate);

// // ============================================
// // 🌍 GÉOCODAGE
// // ============================================

// // Convertir une adresse en coordonnées
// router.post('/geocode', locationController.geocode);

// // Convertir des coordonnées en adresse
// router.post('/reverse-geocode', locationController.reverseGeocode);

// // Auto-complétion d'adresse (recherche temps réel)
// router.get('/autocomplete', locationController.autocomplete);

// // ============================================
// // 📏 DISTANCE
// // ============================================

// // Calculer la distance entre deux points
// router.post('/distance', locationController.calculateDistance);

// // Calculer la distance à vol d'oiseau
// router.post('/haversine', locationController.haversineDistance);

// // ============================================
// // 🚦 TRAFIC
// // ============================================

// // Obtenir les conditions de trafic pour un trajet
// router.post('/traffic', locationController.getTraffic);

// // Prédire le temps de trajet
// router.post('/predict-travel-time', locationController.predictTravelTime);

// // Obtenir les zones de trafic autour d'un point
// router.get('/nearby-traffic', locationController.getNearbyTraffic);

// // Vérifier l'heure de pointe
// router.get('/is-peak-hour', locationController.isPeakHour);

// module.exports = router;




// routes/locationRoutes.js
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const locationService = require('../../services/locationService');

// Mettre à jour sa position
router.post('/', auth, async (req, res) => {
  try {
    const { latitude, longitude, accuracy, speed, heading, metadata } = req.body;
    
    const location = await locationService.updateLocation(
      req.user.id,
      { latitude, longitude, accuracy, speed, heading, metadata },
      req.user.role
    );
    
    res.json({
      success: true,
      location
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir sa dernière position
router.get('/last', auth, async (req, res) => {
  try {
    const location = await locationService.getLastLocation(req.user.id);
    res.json({ success: true, location });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir l'historique des positions
router.get('/history', auth, async (req, res) => {
  try {
    const { limit, startDate, endDate } = req.query;
    const history = await locationService.getLocationHistory(req.user.id, {
      limit: limit || 100,
      startDate,
      endDate
    });
    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir les utilisateurs à proximité
router.get('/nearby', auth, async (req, res) => {
  try {
    const { latitude, longitude, radius, userType } = req.query;
    
    const nearby = await locationService.getNearbyUsers(
      parseFloat(latitude),
      parseFloat(longitude),
      parseFloat(radius || 5),
      userType
    );
    
    res.json({ success: true, users: nearby });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;