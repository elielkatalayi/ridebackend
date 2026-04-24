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
  
  // Liste des indicatifs de pays valides (tous les pays)
  const validCountryCodes = [
    '1',   // USA, Canada
    '7',   // Russie, Kazakhstan
    '20',  // Égypte
    '27',  // Afrique du Sud
    '30',  // Grèce
    '31',  // Pays-Bas
    '32',  // Belgique
    '33',  // France
    '34',  // Espagne
    '36',  // Hongrie
    '39',  // Italie
    '40',  // Roumanie
    '41',  // Suisse
    '43',  // Autriche
    '44',  // Royaume-Uni
    '45',  // Danemark
    '46',  // Suède
    '47',  // Norvège
    '48',  // Pologne
    '49',  // Allemagne
    '51',  // Pérou
    '52',  // Mexique
    '53',  // Cuba
    '54',  // Argentine
    '55',  // Brésil
    '56',  // Chili
    '57',  // Colombie
    '58',  // Venezuela
    '60',  // Malaisie
    '61',  // Australie
    '62',  // Indonésie
    '63',  // Philippines
    '64',  // Nouvelle-Zélande
    '65',  // Singapour
    '66',  // Thaïlande
    '81',  // Japon
    '82',  // Corée du Sud
    '84',  // Viêt Nam
    '86',  // Chine
    '90',  // Turquie
    '91',  // Inde
    '92',  // Pakistan
    '93',  // Afghanistan
    '94',  // Sri Lanka
    '95',  // Myanmar
    '98',  // Iran
    '212', // Maroc
    '213', // Algérie
    '216', // Tunisie
    '218', // Libye
    '220', // Gambie
    '221', // Sénégal
    '222', // Mauritanie
    '223', // Mali
    '224', // Guinée
    '225', // Côte d'Ivoire
    '226', // Burkina Faso
    '227', // Niger
    '228', // Togo
    '229', // Bénin
    '230', // Maurice
    '231', // Liberia
    '232', // Sierra Leone
    '233', // Ghana
    '234', // Nigeria
    '235', // Tchad
    '236', // République Centrafricaine
    '237', // Cameroun
    '238', // Cap-Vert
    '239', // São Tomé et Príncipe
    '240', // Guinée équatoriale
    '241', // Gabon
    '242', // République du Congo
    '243', // République Démocratique du Congo (RDC)
    '244', // Angola
    '245', // Guinée-Bissau
    '246', // Diego Garcia
    '247', // Ascension
    '248', // Seychelles
    '249', // Soudan
    '250', // Rwanda
    '251', // Éthiopie
    '252', // Somalie
    '253', // Djibouti
    '254', // Kenya
    '255', // Tanzanie
    '256', // Ouganda
    '257', // Burundi
    '258', // Mozambique
    '259', // Zanzibar
    '260', // Zambie
    '261', // Madagascar
    '262', // Réunion, Mayotte
    '263', // Zimbabwe
    '264', // Namibie
    '265', // Malawi
    '266', // Lesotho
    '267', // Botswana
    '268', // Swaziland
    '269', // Comores
    '290', // Sainte-Hélène
    '291', // Érythrée
    '297', // Aruba
    '298', // Îles Féroé
    '299', // Groenland
    '350', // Gibraltar
    '351', // Portugal
    '352', // Luxembourg
    '353', // Irlande
    '354', // Islande
    '355', // Albanie
    '356', // Malte
    '357', // Chypre
    '358', // Finlande
    '359', // Bulgarie
    '370', // Lituanie
    '371', // Lettonie
    '372', // Estonie
    '373', // Moldavie
    '374', // Arménie
    '375', // Biélorussie
    '376', // Andorre
    '377', // Monaco
    '378', // Saint-Marin
    '379', // Vatican
    '380', // Ukraine
    '381', // Serbie
    '382', // Monténégro
    '383', // Kosovo
    '385', // Croatie
    '386', // Slovénie
    '387', // Bosnie-Herzégovine
    '389', // Macédoine du Nord
    '420', // République tchèque
    '421', // Slovaquie
    '423', // Liechtenstein
    '500', // Îles Malouines
    '501', // Belize
    '502', // Guatemala
    '503', // Salvador
    '504', // Honduras
    '505', // Nicaragua
    '506', // Costa Rica
    '507', // Panama
    '508', // Saint-Pierre-et-Miquelon
    '509', // Haïti
    '590', // Guadeloupe
    '591', // Bolivie
    '592', // Guyana
    '593', // Équateur
    '594', // Guyane française
    '595', // Paraguay
    '596', // Martinique
    '597', // Suriname
    '598', // Uruguay
    '599', // Antilles néerlandaises
    '670', // Timor oriental
    '672', // Territoires australiens
    '673', // Brunéi
    '674', // Nauru
    '675', // Papouasie-Nouvelle-Guinée
    '676', // Tonga
    '677', // Îles Salomon
    '678', // Vanuatu
    '679', // Fidji
    '680', // Palaos
    '681', // Wallis-et-Futuna
    '682', // Îles Cook
    '683', // Niue
    '685', // Samoa
    '686', // Kiribati
    '687', // Nouvelle-Calédonie
    '688', // Tuvalu
    '689', // Polynésie française
    '690', // Tokelau
    '691', // Micronésie
    '692', // Îles Marshall
    '850', // Corée du Nord
    '852', // Hong Kong
    '853', // Macao
    '855', // Cambodge
    '856', // Laos
    '880', // Bangladesh
    '886', // Taïwan
    '960', // Maldives
    '961', // Liban
    '962', // Jordanie
    '963', // Syrie
    '964', // Irak
    '965', // Koweït
    '966', // Arabie saoudite
    '967', // Yémen
    '968', // Oman
    '969', // Yémen du Sud
    '970', // Palestine
    '971', // Émirats arabes unis
    '972', // Israël
    '973', // Bahreïn
    '974', // Qatar
    '975', // Bhoutan
    '976', // Mongolie
    '977', // Népal
    '992', // Tadjikistan
    '993', // Turkménistan
    '994', // Azerbaïdjan
    '995', // Géorgie
    '996', // Kirghizistan
    '998'  // Ouzbékistan
  ];
  
  // Si le numéro est au format international
  if (internationalPattern.test(cleaned)) {
    const countryCode = cleaned.substring(1).split('')[0];
    // Vérifier si l'indicatif est valide
    const isValid = validCountryCodes.some(code => {
      if (code.length === 1) return cleaned.substring(1, 2) === code;
      if (code.length === 2) return cleaned.substring(1, 3) === code;
      if (code.length === 3) return cleaned.substring(1, 4) === code;
      return false;
    });
    
    if (!isValid) {
      return helpers.error('any.invalid', { message: 'Indicatif de pays invalide' });
    }
    return cleaned;
  }
  
  // Si le numéro est au format local (commence par 0)
  if (localPattern.test(cleaned)) {
    // Accepter les numéros locaux (ils seront formatés par le backend)
    return cleaned;
  }
  
  // Si le numéro n'a pas de format international ni local
  // Vérifier si c'est juste des chiffres (pourrait être un numéro local sans 0)
  const digitsOnly = cleaned.replace(/[^0-9]/g, '');
  if (digitsOnly.length >= 8 && digitsOnly.length <= 12) {
    return digitsOnly;
  }
  
  return helpers.error('any.invalid', { message: 'Numéro de téléphone invalide. Utilisez le format international (+XXX...) ou local (0XXX...)' });
};

// Schéma personnalisé pour les numéros de téléphone
const phoneSchema = Joi.string().custom(validateInternationalPhone, 'Validation téléphone international');

const userValidator = {
  // =====================================================
  // INSCRIPTION (3 ÉTAPES)
  // =====================================================
  
  // Étape 1: Demander OTP
  requestRegisterOtp: Joi.object({
    phone: phoneSchema.required(),
    channel: Joi.string().valid('sms', 'whatsapp', 'email', 'telegram').default('sms')
  }),

  // Étape 2: Vérifier OTP seulement
  verifyOtpOnly: Joi.object({
    phone: phoneSchema.required(),
    code: Joi.string().pattern(/^\d{4,8}$/).required(),
    otp_channel: Joi.string().valid('sms', 'whatsapp', 'email', 'telegram').default('sms')
  }),

  // Étape 3: Compléter l'inscription
  completeRegistration: Joi.object({
    tempToken: Joi.string().required(),
    email: Joi.string().email().optional(),
    password: Joi.string().min(6).max(100).required(),
    first_name: Joi.string().max(100).required(),
    last_name: Joi.string().max(100).required(),
    emergency_contact_name: Joi.string().max(100).optional(),
    emergency_contact_phone: phoneSchema.optional(),
    birth_date: Joi.date().iso().optional()  // ← Ajoutez cette ligne
  }),

  // Étape 2 reset: Vérifier OTP pour reset password
  verifyResetOtp: Joi.object({
    phone: phoneSchema.required(),
    code: Joi.string().pattern(/^\d{4,8}$/).required(),
    otp_channel: Joi.string().valid('sms', 'whatsapp', 'email', 'telegram').default('sms')
  }),

  // =====================================================
  // CONNEXION & AUTRES
  // =====================================================
  
  // Connexion
  login: Joi.object({
    phone: phoneSchema.required(),
    password: Joi.string().required()
  }),

  // Mise à jour profil
  updateProfile: Joi.object({
    first_name: Joi.string().max(100).optional(),
    last_name: Joi.string().max(100).optional(),
    email: Joi.string().email().optional(),
    avatar_url: Joi.string().uri().optional(),
    emergency_contact_name: Joi.string().max(100).optional(),
    emergency_contact_phone: phoneSchema.optional(),
    otp_channel: Joi.string().valid('sms', 'email', 'whatsapp', 'telegram').optional(),
    birth_date: Joi.date().iso().optional()
  }),

  // Changement de mot de passe
  changePassword: Joi.object({
    current_password: Joi.string().required(),
    new_password: Joi.string().min(6).max(100).required()
  }),

  // OTP
  requestOtp: Joi.object({
    destination: Joi.string().required(),
    channel: Joi.string().valid('sms', 'email', 'whatsapp', 'telegram').required(),
    purpose: Joi.string().valid('verification', 'login', 'reset_password', 'payment', 'register').default('verification')
  }),

  verifyOtp: Joi.object({
    destination: Joi.string().required(),
    channel: Joi.string().valid('sms', 'email', 'whatsapp', 'telegram').required(),
    code: Joi.string().pattern(/^\d{4,8}$/).required(),
    purpose: Joi.string().valid('verification', 'login', 'reset_password', 'payment', 'register').default('verification')
  }),

  // Réinitialisation mot de passe
  forgotPassword: Joi.object({
    phone: phoneSchema.required()
  }),

  resetPassword: Joi.object({
    phone: phoneSchema.required(),
    code: Joi.string().pattern(/^\d{4,8}$/).required(),
    new_password: Joi.string().min(6).max(100).required()
  }),

  // Refresh token
  refreshToken: Joi.object({
    refreshToken: Joi.string().required()
  }),

  // ID utilisateur
  userId: Joi.object({
    userId: Joi.string().uuid().required()
  }),

  // Vérification email
  verifyEmail: Joi.object({
    code: Joi.string().length(6).required(),
    email: Joi.string().email().required()
  }),

  // Changer le rôle d'un utilisateur (admin)
  changeUserRole: Joi.object({
    role: Joi.string().valid('passenger', 'driver', 'admin', 'moderator').required()
  }),

  // Récupérer utilisateur par ID (params)
  getUserById: Joi.object({
    userId: Joi.string().uuid().required()
  }),

  // Bloquer un utilisateur
  blockUser: Joi.object({
    reason: Joi.string().min(5).max(255).required(),
    days: Joi.number().integer().min(1).max(365).optional()
  }),

  // Supprimer utilisateur (params)
  deleteUser: Joi.object({
    userId: Joi.string().uuid().required()
  }),

  // Inscription (ancienne, à garder pour compatibilité)
  register: Joi.object({
    phone: phoneSchema.required(),
    email: Joi.string().email().optional(),
    password: Joi.string().min(6).max(100).required(),
    first_name: Joi.string().max(100).optional(),
    last_name: Joi.string().max(100).optional(),
    otp_channel: Joi.string().valid('sms', 'email', 'whatsapp', 'telegram').default('sms'),
    emergency_contact_name: Joi.string().max(100).optional(),
    emergency_contact_phone: phoneSchema.optional()
  })
};

module.exports = userValidator;

