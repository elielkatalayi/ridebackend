const express = require('express');
const router = express.Router();
const vehicleController = require('../../../controllers/rental/vehicleController');
const { auth } = require('../../../middleware/auth');
const multer = require('multer');

// Configuration multer pour accepter les fichiers en mémoire
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté. Utilisez JPG, PNG, GIF, WEBP ou MP4.'), false);
    }
  }
});

// Toutes les routes nécessitent une authentification
router.use(auth);

// Routes pour les véhicules avec upload de fichiers
router.post(
  '/vehicles',
  upload.fields([
    { name: 'cover_photo', maxCount: 1 },
    { name: 'photos', maxCount: 10 }
  ]),
  vehicleController.addVehicle
);

// Routes pour ajouter des photos à un véhicule existant
router.post(
  '/vehicles/:vehicleId/photos',
  upload.fields([
    { name: 'cover_photo', maxCount: 1 },
    { name: 'photos', maxCount: 10 }
  ]),
  vehicleController.addVehiclePhotos
);

// Routes pour supprimer une photo
router.delete(
  '/vehicles/:vehicleId/photos/:photoIndex',
  vehicleController.deleteVehiclePhoto
);

// Autres routes CRUD
router.get('/vehicles/my-vehicles', vehicleController.getMyVehicles);
router.get('/vehicles/:vehicleId', vehicleController.getVehicleDetails);
router.put('/vehicles/:vehicleId', vehicleController.updateVehicle);
router.delete('/vehicles/:vehicleId', vehicleController.deleteVehicle);
router.put('/vehicles/:vehicleId/complete-booking/:bookingId', vehicleController.completeBookingAndFreeVehicle);

module.exports = router;