const Joi = require('joi');

// =====================================================
// 📞 VALIDATION DES NUMÉROS DE TÉLÉPHONE INTERNATIONAUX
// =====================================================

// Fonction de validation personnalisée pour les numéros de téléphone internationaux
const validateInternationalPhone = (value, helpers) => {
  // Nettoyer le numéro (enlever espaces, tirets, etc.)
  let cleaned = value.toString().replace(/[\s\-\(\)]/g, '');
  
  // Pattern pour les numéros internationaux (commence par + suivi de 8-15 chiffres)
  const internationalPattern = /^\+\d{8,15}$/;
  
  // Pattern pour les numéros locaux avec 0 (certains pays)
  const localPattern = /^0\d{7,12}$/;
  
  // Liste des indicatifs de pays valides
  const validCountryCodes = [
    '1', '7', '20', '27', '30', '31', '32', '33', '34', '36', '39', '40', '41', '43', '44', '45', '46', '47', '48', '49',
    '51', '52', '53', '54', '55', '56', '57', '58', '60', '61', '62', '63', '64', '65', '66', '81', '82', '84', '86', '90',
    '91', '92', '93', '94', '95', '98', '212', '213', '216', '218', '220', '221', '222', '223', '224', '225', '226', '227',
    '228', '229', '230', '231', '232', '233', '234', '235', '236', '237', '238', '239', '240', '241', '242', '243', '244',
    '245', '246', '247', '248', '249', '250', '251', '252', '253', '254', '255', '256', '257', '258', '259', '260', '261',
    '262', '263', '264', '265', '266', '267', '268', '269', '290', '291', '297', '298', '299', '350', '351', '352', '353',
    '354', '355', '356', '357', '358', '359', '370', '371', '372', '373', '374', '375', '376', '377', '378', '379', '380',
    '381', '382', '383', '385', '386', '387', '389', '420', '421', '423', '500', '501', '502', '503', '504', '505', '506',
    '507', '508', '509', '590', '591', '592', '593', '594', '595', '596', '597', '598', '599', '670', '672', '673', '674',
    '675', '676', '677', '678', '679', '680', '681', '682', '683', '685', '686', '687', '688', '689', '690', '691', '692',
    '850', '852', '853', '855', '856', '880', '886', '960', '961', '962', '963', '964', '965', '966', '967', '968', '969',
    '970', '971', '972', '973', '974', '975', '976', '977', '992', '993', '994', '995', '996', '998'
  ];
  
  // Si le numéro est au format international
  if (internationalPattern.test(cleaned)) {
    // Vérifier si l'indicatif est valide
    let isValid = false;
    for (const code of validCountryCodes) {
      if (code.length === 1 && cleaned.substring(1, 2) === code) {
        isValid = true;
        break;
      }
      if (code.length === 2 && cleaned.substring(1, 3) === code) {
        isValid = true;
        break;
      }
      if (code.length === 3 && cleaned.substring(1, 4) === code) {
        isValid = true;
        break;
      }
    }
    
    if (!isValid) {
      return helpers.error('any.invalid', { message: 'Indicatif de pays invalide' });
    }
    return cleaned;
  }
  
  // Si le numéro est au format local (commence par 0)
  if (localPattern.test(cleaned)) {
    return cleaned;
  }
  
  // Si le numéro n'a pas de format international ni local
  const digitsOnly = cleaned.replace(/[^0-9]/g, '');
  if (digitsOnly.length >= 8 && digitsOnly.length <= 12) {
    return digitsOnly;
  }
  
  return helpers.error('any.invalid', { message: 'Numéro de téléphone invalide. Utilisez le format international (+XXX...) ou local (0XXX...)' });
};

// Schéma personnalisé pour les numéros de téléphone
const phoneSchema = Joi.string().custom(validateInternationalPhone, 'Validation téléphone international');

// =====================================================
// 🔐 VALIDATEURS POUR FRONTEND FLUTTER
// =====================================================

/**
 * Envoyer OTP - POST /api/v1/auth/send-otp
 * Le frontend envoie: { phone, channel? }
 */
const sendOtp = Joi.object({
  phone: phoneSchema.required(),
  channel: Joi.string().valid('sms', 'whatsapp', 'email').default('sms')
});

/**
 * Vérifier OTP - POST /api/v1/auth/verify-otp
 * Le frontend envoie: { verification_id, otp_code }
 */
const verifyOtp = Joi.object({
  verification_id: Joi.string().required(),
  otp_code: Joi.string().pattern(/^\d{4,8}$/).required()
});

/**
 * Compléter le profil - POST /api/v1/auth/edit-profile
 * Le frontend envoie: { first_name, last_name, email?, birth_date?, emergency_contact_name?, emergency_contact_phone? }
 */
const editProfile = Joi.object({
  first_name: Joi.string().min(2).max(50).required(),
  last_name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().optional(),
  birth_date: Joi.date().iso().optional(),
  emergency_contact_name: Joi.string().max(100).optional(),
  emergency_contact_phone: phoneSchema.optional()
});

/**
 * Rafraîchir token - POST /api/v1/auth/refresh-token
 * Le frontend envoie: { refreshToken }
 */
const refreshTokenBody = Joi.object({
  refreshToken: Joi.string().required()
});

/**
 * Initier changement de numéro - POST /api/v1/auth/initiate-phone-change
 * Le frontend envoie: { new_phone }
 */
const initiatePhoneChange = Joi.object({
  new_phone: phoneSchema.required()
});

/**
 * Vérifier changement de numéro - POST /api/v1/auth/verify-phone-change
 * Le frontend envoie: { phoneChangeId, new_phone_otp }
 */
const verifyPhoneChange = Joi.object({
  phoneChangeId: Joi.string().required(),  // ✅ accepte UUID ou string
  new_phone_otp: Joi.string().pattern(/^\d{4,8}$/).required()
});

// =====================================================
// 🔧 VALIDATEURS POUR LES AUTRES ROUTES (COMPATIBILITÉ)
// =====================================================

// Étape 1: Demander OTP (ancienne version)
const requestRegisterOtp = Joi.object({
  phone: phoneSchema.required(),
  channel: Joi.string().valid('sms', 'whatsapp', 'email', 'telegram').default('sms')
});

// Étape 2: Vérifier OTP seulement (ancienne version)
const verifyOtpOnly = Joi.object({
  phone: phoneSchema.required(),
  otpId: Joi.string().required(),
  code: Joi.string().pattern(/^\d{4,8}$/).required(),
  otp_channel: Joi.string().valid('sms', 'whatsapp', 'email', 'telegram').default('sms')
});

// Étape 3: Compléter l'inscription (ancienne version)
const completeRegistration = Joi.object({
  email: Joi.string().email().optional(),
  password: Joi.alternatives().try(
    Joi.string().min(6).max(100),
    Joi.string().allow('')
  ).optional(),
  first_name: Joi.string().max(100).required(),
  last_name: Joi.string().max(100).required(),
  emergency_contact_name: Joi.string().max(100).optional(),
  emergency_contact_phone: phoneSchema.optional(),
  birth_date: Joi.date().iso().optional()
});

// Connexion classique
const login = Joi.object({
  phone: phoneSchema.required(),
  channel: Joi.string().default('sms')
});

// Connexion OTP par email
const loginOtp = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string().pattern(/^\d{4,8}$/).required()
});

// Vérification OTP connexion
const verifyLoginOtp = Joi.object({
  phone: phoneSchema.required(),
  otpId: Joi.string().required(),
  code: Joi.string().pattern(/^\d{4,8}$/).required(),
  otp_channel: Joi.string().valid('sms', 'whatsapp', 'email', 'telegram').default('sms')
});

// OTP générique
const requestOtp = Joi.object({
  destination: Joi.string().required(),
  channel: Joi.string().valid('sms', 'whatsapp', 'email').default('sms'),
  purpose: Joi.string().valid('verification', 'login', 'reset_password', 'payment', 'register').default('verification')
});

// Vérification OTP générique
const verifyOtpGeneric = Joi.object({
  destination: Joi.string().required(),
  channel: Joi.string().valid('sms', 'whatsapp', 'email').default('sms'),
  code: Joi.string().pattern(/^\d{4,8}$/).required(),
  purpose: Joi.string().valid('verification', 'login', 'reset_password', 'payment', 'register').default('verification')
});

// Mise à jour profil
const updateProfile = Joi.object({
  first_name: Joi.string().max(100).optional(),
  last_name: Joi.string().max(100).optional(),
  email: Joi.string().email().optional(),
  avatar_url: Joi.string().uri().optional(),
  emergency_contact_name: Joi.string().max(100).optional(),
  emergency_contact_phone: phoneSchema.optional(),
  otp_channel: Joi.string().valid('sms', 'email', 'whatsapp', 'telegram').optional(),
  birth_date: Joi.date().iso().optional()
});

// Changement de mot de passe
const changePassword = Joi.object({
  current_password: Joi.string().required(),
  new_password: Joi.string().min(6).max(100).required()
});

// Forgot password
const forgotPassword = Joi.object({
  phone: phoneSchema.required()
});

// Reset password
const resetPassword = Joi.object({
  phone: phoneSchema.required(),
  code: Joi.string().pattern(/^\d{4,8}$/).required(),
  new_password: Joi.string().min(6).max(100).required()
});

// Refresh token
const refreshToken = Joi.object({
  refreshToken: Joi.string().required()
});

// ID utilisateur (params)
const userId = Joi.object({
  userId: Joi.string().uuid().required()
});

// Vérification email
const verifyEmail = Joi.object({
  code: Joi.string().length(6).required(),
  email: Joi.string().email().required()
});

// Changer rôle utilisateur
const changeUserRole = Joi.object({
  role: Joi.string().valid('passenger', 'driver', 'admin', 'moderator').required()
});

// Bloquer utilisateur
const blockUser = Joi.object({
  reason: Joi.string().min(5).max(255).required(),
  days: Joi.number().integer().min(1).max(365).optional()
});

// Supprimer utilisateur (params)
const deleteUser = Joi.object({
  userId: Joi.string().uuid().required()
});

// Annuler changement de numéro
const cancelPhoneChange = Joi.object({
  phoneChangeId: Joi.string().uuid().required()
});

// =====================================================
// 📤 EXPORTS
// =====================================================

module.exports = {
  // Pour frontend Flutter
  sendOtp,
  verifyOtp,
  editProfile,
  refreshTokenBody,
  initiatePhoneChange,
  verifyPhoneChange,
  
  // Anciens validateurs (compatibilité)
  requestRegisterOtp,
  verifyOtpOnly,
  completeRegistration,
  login,
  loginOtp,
  verifyLoginOtp,
  requestOtp,
  verifyOtp: verifyOtpGeneric,  // Note: renommé pour éviter conflit
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  refreshToken,
  userId,
  verifyEmail,
  changeUserRole,
  blockUser,
  deleteUser,
  cancelPhoneChange
};


