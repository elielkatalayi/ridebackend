// controllers/authController.js
const jwtService = require('../services/auth/jwtService');
const otpService = require('../services/auth/otpService');
const passwordService = require('../services/auth/passwordService');
const { User, Wallet, Page, PageAdmin, UserPhoneHistory, Otp } = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

// Fonction utilitaire pour masquer le numéro
const maskPhoneNumber = (phone) => {
  if (!phone) return null;
  const phoneStr = phone.toString();
  if (phoneStr.length <= 4) return '***';
  const visibleStart = phoneStr.substring(0, 3);
  const visibleEnd = phoneStr.substring(phoneStr.length - 2);
  return `${visibleStart}***${visibleEnd}`;
};

class AuthController {

// controllers/authController.js

// =====================================================
// 🔐 ENDPOINT UNIQUE POUR ENVOYER OTP (INSCRIPTION/CONNEXION)
// =====================================================

/**
 * Endpoint unique pour envoyer OTP
 * - Si le numéro existe → envoie OTP pour connexion
 * - Si le numéro n'existe pas → envoie OTP pour inscription
 */
async sendOtp(req, res, next) {
  try {
    let { phone, channel = 'sms' } = req.body;
    
    if (!phone) {
      return res.status(400).json({ 
        success: false,
        error: 'Numéro de téléphone requis' 
      });
    }
    
    console.log('📞 sendOtp - Traitement pour le numéro:', phone);
    
    // Nettoyer le numéro
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Vérifier si le numéro existe déjà
    const existingUser = await User.findOne({ where: { phone: cleanPhone } });
    
    let purpose = 'register';
    let userExists = false;
    let needsProfileCompletion = false;
    
    if (existingUser) {
      userExists = true;
      
      // Vérifier si le profil est complété
      if (!existingUser.is_profile_completed) {
        needsProfileCompletion = true;
        purpose = 'register'; // Pour permettre de compléter le profil
        console.log('⚠️ Utilisateur existant mais profil non complété');
      } else {
        purpose = 'login';
        console.log('✅ Utilisateur existant - envoi OTP pour connexion');
      }
    } else {
      console.log('✅ Nouvel utilisateur - envoi OTP pour inscription');
    }
    
    // Envoyer OTP
    const result = await otpService.sendOtp(cleanPhone, channel, purpose);
    
    res.json({
      state: true,
      message: `Code OTP envoyé par ${channel}`,
      datas: {
        otpId: result.otpId,
        expiresAt: result.expiresAt,
        phone: cleanPhone,
        userExists: userExists,
        needsProfileCompletion: needsProfileCompletion
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur sendOtp:', error);
    res.status(500).json({ 
      state: false,
      message: 'Erreur lors de l\'envoi du code',
      datas: null
    });
  }
}

// =====================================================
// 🔐 VÉRIFICATION OTP UNIQUE (CONNEXION/CREATION)
// =====================================================

/**
 * Endpoint unique pour vérifier OTP
 * - Crée un compte si le numéro n'existe pas
 * - Connecte l'utilisateur si le compte existe
 */
async verifyOtp(req, res, next) {
  const transaction = await sequelize.transaction();
  let transactionFinished = false;
  
  try {
    let { verification_id, otp_code } = req.body;
    
    if (!verification_id) {
      return res.status(400).json({ 
        state: false, 
        message: 'ID OTP requis', 
        datas: null 
      });
    }
    
    if (!otp_code) {
      return res.status(400).json({ 
        state: false, 
        message: 'Code OTP requis', 
        datas: null 
      });
    }
    
    // ⚠️ D'ABORD récupérer l'OTP pour connaître son purpose
    const otpRecord = await Otp.findOne({ 
      where: { 
        id: verification_id,
        is_used: false,
        is_valid: true,
        expires_at: { [Op.gt]: new Date() }
      }
    });
    
    if (!otpRecord) {
      return res.status(401).json({ 
        state: false, 
        message: 'OTP invalide ou expiré', 
        datas: null 
      });
    }
    
    const phone = otpRecord.destination;
    const purpose = otpRecord.purpose; // ← Utiliser le vrai purpose
    
    console.log('🔍 Vérification OTP:', { 
      otpId: verification_id, 
      phone, 
      purpose  // ← Sera 'login' ou 'register'
    });
    
    // Vérifier l'OTP avec le bon purpose
    const result = await otpService.verifyOtpWithId(
      verification_id, 
      otp_code, 
      phone, 
      purpose  // ← Utiliser le purpose réel
    );
    
    if (!result.isValid) {
      return res.status(401).json({ 
        state: false, 
        message: result.message || 'Code OTP invalide ou expiré', 
        datas: null 
      });
    }
    
    await otpService.markOtpAsUsed(verification_id);
    
    // Vérifier si l'utilisateur existe déjà
    let user = await User.findOne({ 
      where: { phone: phone },
      transaction 
    });
    
    if (!user) {
      // Créer un nouvel utilisateur
      user = await User.create({
        phone: phone,
        email: null,
        first_name: null,
        last_name: null,
        emergency_contact_name: null,
        emergency_contact_phone: null,
        birth_date: null,
        role: 'passenger',
        is_active: true,
        is_profile_completed: false,
        otp_channel: 'sms'
      }, { transaction });
      
      await Wallet.create({
        user_id: user.id,
        balance: 0,
        currency: 'CDF'
      }, { transaction });
      
      console.log('✅ Nouvel utilisateur créé:', user.id);
    } else {
      console.log('✅ Utilisateur existant trouvé, connexion directe:', user.id);
    }
    
    let wallet = await Wallet.findOne({ 
      where: { user_id: user.id },
      transaction 
    });
    
    await transaction.commit();
    transactionFinished = true;
    
    const token = jwtService.generateToken({
      id: user.id,
      phone: user.phone,
      role: user.role,
      is_profile_completed: user.is_profile_completed
    });
    
    const refreshToken = jwtService.generateRefreshToken({
      id: user.id,
      phone: user.phone
    });
    
    res.json({
      state: true,
      message: user.is_profile_completed ? 'Connexion réussie' : 'Code OTP vérifié avec succès',
      datas: {
        token: token,
        refreshToken: refreshToken,
        user: {
          id: user.id,
          phone: user.phone,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          avatar_url: user.avatar_url,
          cover_url: user.cover_url,
          role: user.role,
          is_active: user.is_active,
          is_verified: user.is_verified,
          is_profile_completed: user.is_profile_completed,
          rating: user.rating,
          total_rides: user.total_rides,
          birth_date: user.birth_date
        },
        wallet: wallet ? {
          balance: wallet.balance,
          currency: wallet.currency
        } : null,
        isProfileCompleted: user.is_profile_completed,
        requiresProfileCompletion: !user.is_profile_completed
      }
    });
    
  } catch (error) {
    if (!transactionFinished) {
      await transaction.rollback();
    }
    console.error('❌ Erreur verifyOtp:', error);
    res.status(400).json({ 
      state: false, 
      message: error.message, 
      datas: null 
    });
  }
}

  /**
   * Éditer le profil - Pour frontend Flutter
   * POST /api/v1/auth/edit-profile
   */
  async editProfile(req, res, next) {
    const transaction = await sequelize.transaction();
    
    try {
      const userId = req.user.id;
      
      const { 
        first_name,
        last_name,
        email,
        birth_date,
        emergency_contact_name,
        emergency_contact_phone
      } = req.body;
      
      console.log('📝 editProfile pour userId:', userId);
      
      if (!first_name || first_name.trim() === '') {
        return res.status(400).json({ 
          state: false,
          message: 'Le prénom est requis',
          datas: null
        });
      }
      
      if (!last_name || last_name.trim() === '') {
        return res.status(400).json({ 
          state: false,
          message: 'Le nom est requis',
          datas: null
        });
      }
      
      const user = await User.findByPk(userId, { transaction });
      
      if (!user) {
        return res.status(404).json({ 
          state: false, 
          message: 'Utilisateur non trouvé', 
          datas: null 
        });
      }
      
      if (user.is_profile_completed) {
        return res.status(400).json({ 
          state: false,
          message: 'Profil déjà complété',
          datas: { isProfileCompleted: true }
        });
      }
      
      // Validation email
      if (email) {
        const emailRegex = /^\S+@\S+\.\S+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({ 
            state: false,
            message: 'Format d\'email invalide',
            datas: null
          });
        }
        
        const emailExists = await User.findOne({ 
          where: { 
            email: email,
            id: { [Op.ne]: userId }
          },
          transaction 
        });
        
        if (emailExists) {
          return res.status(409).json({ 
            state: false,
            message: 'Cet email est déjà utilisé',
            datas: null
          });
        }
      }
      
      // Validation date de naissance
      if (birth_date) {
        const birthDateObj = new Date(birth_date);
        const today = new Date();
        let age = today.getFullYear() - birthDateObj.getFullYear();
        const monthDiff = today.getMonth() - birthDateObj.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
          age--;
        }
        
        if (age < 13) {
          return res.status(400).json({ 
            state: false,
            message: 'Vous devez avoir au moins 13 ans',
            datas: null
          });
        }
        
        if (age > 120) {
          return res.status(400).json({ 
            state: false,
            message: 'Date de naissance invalide',
            datas: null
          });
        }
      }
      
      await user.update({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: email || null,
        emergency_contact_name: emergency_contact_name || null,
        emergency_contact_phone: emergency_contact_phone || null,
        birth_date: birth_date || null,
        is_profile_completed: true
      }, { transaction });
      
      // Créer la page personnelle
      const generateSlug = (firstName, lastName, userId) => {
        const baseSlug = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
        const uniqueSlug = `${baseSlug}.${userId.slice(0, 8)}`;
        return uniqueSlug
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9.-]+/g, '-')
          .replace(/^-|-$/g, '');
      };
      
      let personalPage = await Page.findOne({ 
        where: { created_by: user.id },
        transaction 
      });
      
      if (!personalPage) {
        const pageSlug = generateSlug(first_name, last_name, user.id);
        
        personalPage = await Page.create({
          name: `${first_name} ${last_name}`,
          slug: pageSlug,
          description: `Page personnelle de ${first_name} ${last_name}`,
          category: 'personal',
          created_by: user.id,
          settings: {
            allow_posts: true,
            allow_comments: true,
            allow_reactions: true,
            allow_sharing: true,
            allow_reposts: true,
            allow_stories: true,
            auto_approve_posts: true,
            moderation_enabled: false,
            is_personal_page: true
          },
          is_active: true,
          is_verified: false,
          is_deleted: false,
          followers_count: 0,
          posts_count: 0,
          stories_count: 0,
          total_likes: 0,
          total_views: 0,
          engagement_score: 0,
          viral_score: 0
        }, { transaction });
        
        await PageAdmin.create({
          page_id: personalPage.id,
          user_id: user.id,
          role: 'admin'
        }, { transaction });
      }
      
      const wallet = await Wallet.findOne({ 
        where: { user_id: user.id },
        transaction 
      });
      
      await transaction.commit();
      
      const newToken = jwtService.generateToken({
        id: user.id,
        phone: user.phone,
        role: user.role,
        is_profile_completed: true
      });
      
      const newRefreshToken = jwtService.generateRefreshToken({
        id: user.id,
        phone: user.phone
      });
      
      res.json({
        state: true,
        message: 'Profil complété avec succès',
        datas: {
          user: {
            id: user.id,
            phone: user.phone,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            avatar_url: user.avatar_url,
            cover_url: user.cover_url,
            role: user.role,
            is_active: user.is_active,
            is_verified: user.is_verified,
            is_profile_completed: true,
            rating: user.rating,
            total_rides: user.total_rides,
            birth_date: user.birth_date
          },
          wallet: wallet ? {
            balance: wallet.balance,
            currency: wallet.currency
          } : null,
          token: newToken,
          refreshToken: newRefreshToken
        }
      });
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Erreur editProfile:', error);
      next(error);
    }
  }

  // =====================================================
  // 📞 CHANGEMENT DE NUMÉRO DE TÉLÉPHONE
  // =====================================================

  /**
   * Initier le changement de numéro - Pour frontend Flutter
   * POST /api/v1/auth/initiate-phone-change
   */
// controllers/authController.js - Méthode initiatePhoneChange

async initiatePhoneChange(req, res, next) {
  const transaction = await sequelize.transaction();
  
  try {
    const userId = req.user.id;
    const { new_phone } = req.body;
    
    if (!new_phone) {
      return res.status(400).json({ 
        state: false, 
        message: 'Le nouveau numéro est requis', 
        datas: null 
      });
    }
    
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ 
        state: false, 
        message: 'Utilisateur non trouvé', 
        datas: null 
      });
    }
    
    const old_phone = user.phone;
    
    // Vérifier si le nouveau numéro n'est pas déjà utilisé
    const existingUser = await User.findOne({ where: { phone: new_phone } });
    if (existingUser && existingUser.id !== userId) {
      return res.status(409).json({ 
        state: false, 
        message: 'Ce numéro est déjà utilisé par un autre compte', 
        datas: null 
      });
    }
    
    // ⚠️ SUPPRIMER OU COMMENTER CE BLOC ⚠️
    /*
    // Vérifier si un changement est déjà en cours
    const pendingChange = await UserPhoneHistory.findOne({
      where: { user_id: userId, status: 'pending' }
    });
    
    if (pendingChange) {
      return res.status(400).json({ 
        state: false, 
        message: 'Un changement de numéro est déjà en cours',
        data: { pendingChangeId: pendingChange.id }
      });
    }
    */
    
    // Créer l'enregistrement du changement
    const phoneChange = await UserPhoneHistory.create({
      user_id: userId,
      old_phone: old_phone,
      new_phone: new_phone,
      status: 'pending',
      old_phone_verified: true,
      new_phone_verified: false
    }, { transaction });
    
    // Envoyer OTP au nouveau numéro
    const newOtpResult = await otpService.sendOtp(new_phone, 'sms', 'phone_change_new');
    
    await phoneChange.update({
      new_phone_otp_id: newOtpResult.otpId
    }, { transaction });
    
    await transaction.commit();
    
    res.json({
      state: true,
      message: 'Code OTP envoyé au nouveau numéro',
      data: {
        phoneChangeId: phoneChange.id,
        old_phone: maskPhoneNumber(old_phone),
        new_phone: maskPhoneNumber(new_phone),
        expiresIn: 600
      }
    });
    
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Erreur initiatePhoneChange:', error);
    next(error);
  }
}

  /**
   * Vérifier et changer le numéro - Pour frontend Flutter
   * POST /api/v1/auth/verify-phone-change
   */
  async verifyPhoneChange(req, res, next) {
    const transaction = await sequelize.transaction();
    
    try {
      const userId = req.user.id;
      const { phoneChangeId, new_phone_otp } = req.body;
      
      if (!phoneChangeId) {
        return res.status(400).json({ 
          state: false, 
          message: 'ID du changement requis', 
          datas: null 
        });
      }
      
      if (!new_phone_otp) {
        return res.status(400).json({ 
          state: false, 
          message: 'Code OTP du nouveau numéro requis', 
          datas: null 
        });
      }
      
      const phoneChange = await UserPhoneHistory.findOne({
        where: {
          id: phoneChangeId,
          user_id: userId,
          status: 'pending'
        },
        transaction
      });
      
      if (!phoneChange) {
        return res.status(404).json({ 
          state: false, 
          message: 'Demande de changement non trouvée ou expirée', 
          datas: null 
        });
      }
      
      // Vérifier l'OTP du nouveau numéro
      const newOtpVerification = await otpService.verifyOtpWithId(
        phoneChange.new_phone_otp_id,
        new_phone_otp,
        phoneChange.new_phone,
        'phone_change_new'
      );
      
      if (!newOtpVerification.isValid) {
        return res.status(401).json({ 
          state: false, 
          message: 'Code OTP invalide pour le nouveau numéro',
          datas: null 
        });
      }
      
      await otpService.markOtpAsUsed(phoneChange.new_phone_otp_id);
      
      // Mettre à jour le numéro de l'utilisateur
      const user = await User.findByPk(userId, { transaction });
      
      await user.update({
        phone: phoneChange.new_phone
      }, { transaction });
      
      await phoneChange.update({
        new_phone_verified: true,
        status: 'completed',
        completed_at: new Date()
      }, { transaction });
      
      await transaction.commit();
      
      // Générer un nouveau token
      const newToken = jwtService.generateToken({
        id: user.id,
        phone: user.phone,
        role: user.role,
        is_profile_completed: user.is_profile_completed
      });
      
      const newRefreshToken = jwtService.generateRefreshToken({
        id: user.id,
        phone: user.phone
      });
      
      res.json({
        state: true,
        message: 'Numéro de téléphone changé avec succès',
        data: {
          token: newToken,
          refreshToken: newRefreshToken,
          user: {
            id: user.id,
            phone: user.phone,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name
          },
          old_phone: phoneChange.old_phone,
          new_phone: phoneChange.new_phone
        }
      });
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Erreur verifyPhoneChange:', error);
      next(error);
    }
  }

  /**
   * Rafraîchir le token - Pour frontend Flutter
   * POST /api/v1/auth/refresh-token
   */
  async refreshTokenForFrontend(req, res, next) {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({ 
          state: false, 
          message: 'Refresh token requis', 
          datas: null 
        });
      }
      
      const payload = jwtService.verifyToken(refreshToken);
      
      const user = await User.findByPk(payload.id);
      if (!user) {
        return res.status(401).json({ 
          state: false, 
          message: 'Utilisateur non trouvé', 
          datas: null 
        });
      }
      
      const newToken = jwtService.generateToken({
        id: user.id,
        phone: user.phone,
        role: user.role,
        is_profile_completed: user.is_profile_completed
      });
      
      const newRefreshToken = jwtService.generateRefreshToken({
        id: user.id,
        phone: user.phone
      });
      
      res.json({
        state: true,
        message: 'Token rafraîchi avec succès',
        data: {
          token: newToken,
          refreshToken: newRefreshToken
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Déconnexion - Pour frontend Flutter
   * POST /api/v1/auth/logout
   */
  async logoutForFrontend(req, res, next) {
    try {
      res.json({ 
        state: true, 
        message: 'Déconnecté avec succès',
        datas: null
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Statut du profil - Pour frontend Flutter
   * GET /api/v1/auth/profile-status
   */
  async profileStatus(req, res, next) {
    try {
      const userId = req.user.id;
      
      const user = await User.findByPk(userId, {
        attributes: ['id', 'first_name', 'last_name', 'email', 'is_profile_completed']
      });
      
      if (!user) {
        return res.status(404).json({ 
          state: false, 
          message: 'Utilisateur non trouvé', 
          datas: null 
        });
      }
      
      res.json({
        state: true,
        message: 'Statut du profil récupéré',
        datas: {
          isProfileCompleted: user.is_profile_completed,
          hasName: !!(user.first_name && user.last_name),
          user: {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email
          }
        }
      });
      
    } catch (error) {
      console.error('Erreur profileStatus:', error);
      next(error);
    }
  }
}

module.exports = new AuthController();