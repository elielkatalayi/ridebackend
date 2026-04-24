// routes/v1/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../../controllers/authController');
const { validate } = require('../../middleware/validation');
const { authLimiter, otpLimiter } = require('../../middleware/rateLimiter');
const userValidator = require('../../validators/userValidator');
const { authenticate } = require('../../middleware/auth');

// =====================================================
// 🔐 ROUTES D'AUTHENTIFICATION
// =====================================================

// ========== INSCRIPTION (2 ÉTAPES) ==========

/**
 * @route   POST /api/v1/auth/request-register-otp
 * @desc    ÉTAPE 1: Demander OTP pour inscription
 * @access  Public
 */
router.post(
  '/request-register-otp',
  otpLimiter,
  validate(userValidator.requestRegisterOtp, 'body'),
  authController.requestRegisterOtp
);

/**
 * @route   POST /api/v1/auth/verify-otp-only
 * @desc    ÉTAPE 2: Vérifier OTP (sans créer compte)
 * @access  Public
 */
router.post(
  '/verify-otp-only',
  otpLimiter,
  validate(userValidator.verifyOtpOnly, 'body'),
  authController.verifyOtpOnly
);

/**
 * @route   POST /api/v1/auth/complete-registration
 * @desc    ÉTAPE 3: Compléter l'inscription après vérification OTP
 * @access  Public
 */
router.post(
  '/complete-registration',
  authLimiter,
  validate(userValidator.completeRegistration, 'body'),
  authController.completeRegistration
);

// ========== CONNEXION ==========

/**
 * @route   POST /api/v1/auth/login
 * @desc    Connexion utilisateur
 * @access  Public
 */
router.post(
  '/login',
  authLimiter,
  validate(userValidator.login, 'body'),
  authController.login
);

// ========== OTP GÉNÉRIQUE ==========

/**
 * @route   POST /api/v1/auth/request-otp
 * @desc    Demander un code OTP générique
 * @access  Public
 */
router.post(
  '/request-otp',
  otpLimiter,
  validate(userValidator.requestOtp, 'body'),
  authController.requestOtp
);

/**
 * @route   POST /api/v1/auth/verify-otp
 * @desc    Vérifier un code OTP générique
 * @access  Public
 */
router.post(
  '/verify-otp',
  otpLimiter,
  validate(userValidator.verifyOtp, 'body'),
  authController.verifyOtp
);

// ========== RÉINITIALISATION MOT DE PASSE (2 ÉTAPES) ==========

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    ÉTAPE 1: Demander OTP pour réinitialisation
 * @access  Public
 */
router.post(
  '/forgot-password',
  authLimiter,
  validate(userValidator.forgotPassword, 'body'),
  authController.forgotPassword
);

/**
 * @route   POST /api/v1/auth/verify-reset-otp
 * @desc    ÉTAPE 2: Vérifier OTP pour réinitialisation
 * @access  Public
 */
router.post(
  '/verify-reset-otp',
  otpLimiter,
  validate(userValidator.verifyResetOtp, 'body'),
  authController.verifyResetOtp
);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    ÉTAPE 3: Réinitialiser le mot de passe après vérification
 * @access  Public
 */
router.post(
  '/reset-password',
  authLimiter,
  // validate(userValidator.resetPassword, 'body'), // ← Validation supprimée
  authController.resetPassword
);

// ========== RAFRAÎCHISSEMENT TOKEN ==========

/**
 * @route   POST /api/v1/auth/refresh-token
 * @desc    Rafraîchir le token JWT
 * @access  Public
 */
router.post(
  '/refresh-token',
  validate(userValidator.refreshToken, 'body'),
  authController.refreshToken
);

// ========== DÉCONNEXION ==========

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Déconnexion
 * @access  Private
 */
router.post('/logout', authenticate, authController.logout);

// ========== VÉRIFICATION EMAIL (Optionnel) ==========

// /**
//  * @route   POST /api/v1/auth/verify-email
//  * @desc    Vérifier l'email avec OTP
//  * @access  Private
//  */
// router.post(
//   '/verify-email',
//   authenticate,
//   validate(userValidator.verifyEmail, 'body'),
//   authController.verifyEmail
// );

/**
//  * @route   POST /api/v1/auth/resend-verification
//  * @desc    Renvoyer OTP de vérification email
//  * @access  Private
//  */
// router.post(
//   '/resend-verification',
//   authenticate,
//   authController.resendVerification
// );

module.exports = router;