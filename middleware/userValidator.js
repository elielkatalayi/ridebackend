const Joi = require('joi');

const userValidator = {
  // =====================================================
  // 📝 INSCRIPTION EN DEUX ÉTAPES
  // =====================================================
  
  requestRegisterOtp: Joi.object({
    phone: Joi.string().pattern(/^(\+243|0)[0-9]{9}$/).required(),
    channel: Joi.string().valid('sms', 'email').default('sms')
  }),

  verifyOtpOnly: Joi.object({
    phone: Joi.string().pattern(/^(\+243|0)[0-9]{9}$/).required(),
    code: Joi.string().pattern(/^\d{6}$/).required(),
    otp_channel: Joi.string().valid('sms', 'email').default('sms')
  }),

  completeRegistration: Joi.object({
    tempToken: Joi.string().required(),
    first_name: Joi.string().min(2).max(50).required(),
    last_name: Joi.string().min(2).max(50).required(),
    password: Joi.string().min(6).max(100).required(),
    email: Joi.string().email().optional().allow(null),
    emergency_contact_name: Joi.string().max(100).optional().allow(null),
    emergency_contact_phone: Joi.string().pattern(/^(\+243|0)[0-9]{9}$/).optional().allow(null)
  }),

  // =====================================================
  // 📝 INSCRIPTION DIRECTE (1 étape)
  // =====================================================
  
  register: Joi.object({
    phone: Joi.string().pattern(/^(\+243|0)[0-9]{9}$/).required(),
    email: Joi.string().email().optional(),
    password: Joi.string().min(6).max(100).required(),
    first_name: Joi.string().max(100).optional(),
    last_name: Joi.string().max(100).optional(),
    otp_channel: Joi.string().valid('sms', 'email').default('sms'),
    emergency_contact_name: Joi.string().max(100).optional(),
    emergency_contact_phone: Joi.string().pattern(/^(\+243|0)[0-9]{9}$/).optional()
  }),

  // =====================================================
  // 🔐 CONNEXION
  // =====================================================
  
  login: Joi.object({
    phone: Joi.string().pattern(/^(\+243|0)[0-9]{9}$/).required(),
    password: Joi.string().required()
  }),

  // =====================================================
  // 👤 PROFIL
  // =====================================================
  
  updateProfile: Joi.object({
    first_name: Joi.string().max(100).optional(),
    last_name: Joi.string().max(100).optional(),
    email: Joi.string().email().optional(),
    avatar_url: Joi.string().uri().optional(),
    emergency_contact_name: Joi.string().max(100).optional(),
    emergency_contact_phone: Joi.string().pattern(/^(\+243|0)[0-9]{9}$/).optional(),
    otp_channel: Joi.string().valid('sms', 'email').optional()
  }),

  // =====================================================
  // 🔑 MOT DE PASSE
  // =====================================================
  
  changePassword: Joi.object({
    current_password: Joi.string().required(),
    new_password: Joi.string().min(6).max(100).required()
  }),

  forgotPassword: Joi.object({
    phone: Joi.string().pattern(/^(\+243|0)[0-9]{9}$/).required()
  }),

  // ✅ CORRECTION ICI - resetPassword ne doit valider que resetToken et new_password
  resetPassword: Joi.object({
    resetToken: Joi.string().required(),
    new_password: Joi.string().min(6).max(100).required()
  }),

  verifyResetOtp: Joi.object({
    phone: Joi.string().pattern(/^(\+243|0)[0-9]{9}$/).required(),
    code: Joi.string().pattern(/^\d{6}$/).required(),
    otp_channel: Joi.string().valid('sms', 'email').default('sms')
  }),

  // =====================================================
  // 📱 OTP
  // =====================================================
  
  requestOtp: Joi.object({
    destination: Joi.string().required(),
    channel: Joi.string().valid('sms', 'email').required(),
    purpose: Joi.string().valid('verification', 'login', 'reset_password', 'payment', 'register').default('verification')
  }),

  verifyOtp: Joi.object({
    destination: Joi.string().required(),
    channel: Joi.string().valid('sms', 'email').required(),
    code: Joi.string().pattern(/^\d{6}$/).required(),
    purpose: Joi.string().valid('verification', 'login', 'reset_password', 'payment', 'register').default('verification')
  }),

  // =====================================================
  // 🔄 TOKEN
  // =====================================================
  
  refreshToken: Joi.object({
    refreshToken: Joi.string().required()
  }),

  // =====================================================
  // 🆔 ID
  // =====================================================
  
  userId: Joi.object({
    userId: Joi.string().uuid().required()
  })
};

console.log('✅ userValidator chargé avec les propriétés:', Object.keys(userValidator));

module.exports = userValidator;