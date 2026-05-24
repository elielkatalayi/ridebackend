// routes/v1/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../../controllers/authController');
const { validate } = require('../../middleware/validation');
const { authLimiter, otpLimiter } = require('../../middleware/rateLimiter');
const userValidator = require('../../validators/userValidator');
const { auth } = require('../../middleware/auth');

// =====================================================
// 🔐 ROUTES UTILISÉES PAR LE FRONTEND FLUTTER
// =====================================================

/**
 * @route   POST /api/v1/auth/send-otp
 * @desc    ÉTAPE 1: Envoyer OTP pour inscription
 * @access  Public
 * @body    { phone, channel? }
 * @return  { state, message, data: { verification_id, expiresAt, phone } }
 */
router.post(
  '/send-otp',
  otpLimiter,
  validate(userValidator.sendOtp, 'body'),
  authController.sendOtp
);

/**
 * @route   POST /api/v1/auth/verify-otp
 * @desc    ÉTAPE 2: Vérifier OTP et créer compte
 * @access  Public
 * @body    { verification_id, otp_code }
 * @return  { state, message, data: { token, refreshToken, user, isProfileCompleted } }
 */
// Dans authRoutes.js - changement temporaire pour tester
router.post(
  '/verify-otp',  // ← NOUVEAU NOM
  otpLimiter,
  authController.verifyOtp  // ← SANS validation
);

/**
 * @route   POST /api/v1/auth/edit-profile
 * @desc    ÉTAPE 3: Compléter le profil utilisateur
 * @access  Private (nécessite token)
 * @body    { first_name, last_name, email?, birth_date?, emergency_contact_name?, emergency_contact_phone? }
 * @return  { state, message, data: { user, wallet, token, refreshToken } }
 */
router.post(
  '/edit-profile',
  auth,
  authLimiter,
  validate(userValidator.editProfile, 'body'),
  authController.editProfile
);

/**
 * @route   POST /api/v1/auth/initiate-phone-change
 * @desc    ÉTAPE 1: Initier le changement de numéro
 * @access  Private
 * @body    { new_phone }
 * @return  { success, message, phoneChangeId, old_phone, new_phone, expiresIn }
 */
router.post(
  '/initiate-phone-change',
  auth,
  authLimiter,
  validate(userValidator.initiatePhoneChange, 'body'),
  authController.initiatePhoneChange
);

/**
 * @route   POST /api/v1/auth/verify-phone-change
 * @desc    ÉTAPE 2: Vérifier et changer le numéro
 * @access  Private
 * @body    { phoneChangeId, new_phone_otp }
 * @return  { success, message, token, refreshToken, user }
 */
router.post(
  '/verify-phone-change',
  auth,
  authLimiter,
  validate(userValidator.verifyPhoneChange, 'body'),
  authController.verifyPhoneChange
);

/**
 * @route   POST /api/v1/auth/refresh-token
 * @desc    Rafraîchir le token JWT
 * @access  Public
 * @body    { refreshToken }
 * @return  { state, message, data: { token, refreshToken } }
 */
router.post(
  '/refresh-token',
  authLimiter,
  validate(userValidator.refreshTokenBody, 'body'),
  authController.refreshTokenForFrontend
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Déconnexion
 * @access  Private
 * @return  { state, message, data: null }
 */
router.post(
  '/logout',
  auth,
  authController.logoutForFrontend
);

/**
 * @route   GET /api/v1/auth/profile-status
 * @desc    Vérifier le statut du profil
 * @access  Private
 * @return  { state, message, data: { isProfileCompleted, hasName, user } }
 */
router.get(
  '/profile-status',
  auth,
  authController.profileStatus
);

module.exports = router;