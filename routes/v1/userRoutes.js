// routes/v1/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../../controllers/userController');
const upload = require('../../middleware/upload');
const { auth, driverAuth } = require('../../middleware/auth'); // ← Change ici
const { validate } = require('../../middleware/validation');
const userValidator = require('../../validators/userValidator');

// =====================================================
// 👤 TOUTES LES ROUTES SONT PROTÉGÉES (authentification requise)
// =====================================================
router.use(auth); // ← Utilise 'auth' au lieu de 'authenticate'

// =====================================================
// 📸 GESTION DES PHOTOS
// =====================================================

router.post(
  '/profile-picture',
  upload.single('avatar'),
  userController.uploadProfilePicture
);

router.post(
  '/cover-picture',
  upload.single('cover'),
  userController.uploadCoverPicture
);

router.delete(
  '/profile-picture',
  userController.deleteProfilePicture
);

router.delete(
  '/cover-picture',
  userController.deleteCoverPicture
);

router.get(
  '/photos',
  userController.getUserPhotos
);

// =====================================================
// 👤 GESTION DU PROFIL
// =====================================================

router.get('/profile', userController.getProfile);
router.get('/me', userController.getProfile);

router.put(
  '/profile',
  validate(userValidator.updateProfile, 'body'),
  userController.updateProfile
);

router.put(
  '/me',
  validate(userValidator.updateProfile, 'body'),
  userController.updateProfile
);


router.put(
  '/emergency-contact',
  validate(userValidator.updateEmergencyContact, 'body'),
  userController.updateEmergencyContact
);

router.delete('/account', userController.deleteAccount);
router.delete('/me', userController.deleteAccount);

// =====================================================
// 📊 STATISTIQUES ET HISTORIQUE
// =====================================================

router.get('/stats', userController.getUserStats);
router.get('/rides', userController.getRideHistory);
router.get('/wallet', userController.getWalletInfo);
router.get('/transactions', userController.getTransactionHistory);

// =====================================================
// 👥 GESTION DES AUTRES UTILISATEURS (admin)
// =====================================================

// Note: Pour l'admin, tu peux créer un middleware authorize séparé
// ou utiliser driverAuth avec un rôle admin

router.get('/', userController.listUsers); // Ajoute vérification admin si besoin

router.get(
  '/:userId',
  validate(userValidator.getUserById, 'params'),
  userController.getUserById
);

router.put(
  '/:userId/block',
  validate(userValidator.blockUser, 'body'),
  userController.blockUser
);

router.put(
  '/:userId/unblock',
  userController.unblockUser
);

router.put(
  '/:userId/role',
  validate(userValidator.changeUserRole, 'body'),
  userController.changeUserRole
);

router.delete(
  '/:userId',
  validate(userValidator.deleteUser, 'params'),
  userController.deleteUserByAdmin
);

module.exports = router;