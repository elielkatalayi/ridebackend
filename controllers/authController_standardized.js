// controllers/authController.js - VERSION STANDARDISÉE
const jwtService = require('../services/auth/jwtService');
const otpService = require('../services/auth/otpService');
const passwordService = require('../services/auth/passwordService');
const { User, Wallet, Page, PageAdmin, UserPhoneHistory } = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

const maskPhoneNumber = (phone) => {
  if (!phone) return null;
  const phoneStr = phone.toString();
  if (phoneStr.length <= 4) return '***';
  const visibleStart = phoneStr.substring(0, 3);
  const visibleEnd = phoneStr.substring(phoneStr.length - 2);
  return `${visibleStart}***${visibleEnd}`;
};

class AuthController {

  // =====================================================
  // 📝 INSCRIPTION (NOUVELLE LOGIQUE SIMPLIFIÉE)
  // =====================================================

  async requestRegisterOtp(req, res, next) {
    try {
      let { phone, channel = 'sms' } = req.body;
      
      console.log('📥 requestRegisterOtp - Body reçu:', JSON.stringify(req.body, null, 2));
      
      if (!phone) {
        console.log('❌ ERREUR: Numéro de téléphone manquant - body:', req.body);
        return res.status(400).json({ 
          state: false, 
          message: 'Numéro de téléphone requis', 
          datas: null 
        });
      }
      
      console.log('📞 Traitement pour le numéro:', phone, '| canal:', channel);
      
      const existingUser = await User.findOne({ where: { phone } });
      if (existingUser) {
        console.log('❌ ERREUR: Numéro déjà utilisé:', phone);
        return res.status(409).json({ 
          state: false, 
          message: 'Ce numéro est déjà utilisé', 
          datas: null 
        });
      }
      
      console.log('✅ Numéro disponible, envoi OTP en cours...');
      
      const result = await otpService.sendOtp(phone, channel, 'register');
      
      console.log('✅ OTP envoyé avec succès:', { 
        phone: phone, 
        otpId: result.otpId, 
        expiresAt: result.expiresAt,
        channel: channel 
      });
      
      res.json({
        state: true,
        message: `Code OTP envoyé par ${channel}`,
        datas: {
          otpId: result.otpId,
          expiresAt: result.expiresAt,
          phone: phone
        }
      });
      
    } catch (error) {
      console.error('❌ ERREUR requestRegisterOtp:', error);
      next(error);
    }
  }

  async verifyOtpOnly(req, res, next) {
    const transaction = await sequelize.transaction();
  
    try {
      let { phone, otpId, code, otp_channel = 'sms' } = req.body;
      
      if (!phone) {
        return res.status(400).json({ 
          state: false, 
          message: 'Numéro de téléphone requis', 
          datas: null 
        });
      }
      
      if (!otpId) {
        return res.status(400).json({ 
          state: false, 
          message: 'ID OTP requis', 
          datas: null 
        });
      }
      
      if (!code) {
        return res.status(400).json({ 
          state: false, 
          message: 'Code OTP requis', 
          datas: null 
        });
      }
      
      const result = await otpService.verifyOtpWithId(otpId, code, phone, 'register');
      
      if (!result.isValid) {
        return res.status(401).json({ 
          state: false, 
          message: result.message || 'Code OTP invalide ou expiré', 
          datas: null 
        });
      }
      
      await otpService.markOtpAsUsed(otpId);
      
      const user = await User.create({
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
      
      const wallet = await Wallet.create({
        user_id: user.id,
        balance: 0,
        currency: 'CDF'
      }, { transaction });
      
      await transaction.commit();
      
      const token = jwtService.generateToken({
        id: user.id,
        phone: user.phone,
        role: user.role,
        is_profile_completed: false
      });
      
      const refreshToken = jwtService.generateRefreshToken({
        id: user.id,
        phone: user.phone
      });
      
      res.json({
        state: true,
        message: 'Code OTP vérifié avec succès',
        datas: {
          token: token,
          refreshToken: refreshToken,
          user: {
            id: user.id,
            phone: user.phone,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role,
            is_active: user.is_active,
            is_profile_completed: user.is_profile_completed
          },
          wallet: {
            id: wallet.id,
            balance: wallet.balance,
            currency: wallet.currency
          },
          isProfileCompleted: false,
          requiresProfileCompletion: true
        }
      });
      
    } catch (error) {
      await transaction.rollback();
      console.error('Erreur verifyOtpOnly:', error);
      res.status(400).json({ 
        state: false, 
        message: error.message, 
        datas: null 
      });
    }
  }

  async completeRegistration(req, res, next) {
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
      
      console.log('📝 Complétion profil pour userId:', userId);
      console.log('📝 Données reçues:', { first_name, last_name, email, birth_date });
      
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
      
      await user.update({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: email || null,
        emergency_contact_name: emergency_contact_name || null,
        emergency_contact_phone: emergency_contact_phone || null,
        birth_date: birth_date || null,
        is_profile_completed: true
      }, { transaction });
      
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
      
      let wallet = await Wallet.findOne({ 
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
          token: newToken,
          refreshToken: newRefreshToken,
          user: {
            id: user.id,
            phone: user.phone,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            birth_date: user.birth_date,
            role: user.role,
            avatar_url: user.avatar_url,
            is_active: user.is_active,
            is_verified: user.is_verified,
            is_profile_completed: true
          },
          personal_page: personalPage ? {
            id: personalPage.id,
            name: personalPage.name,
            slug: personalPage.slug,
            description: personalPage.description,
            category: personalPage.category,
            profile_picture: personalPage.profile_picture,
            cover_photo: personalPage.cover_photo,
            created_at: personalPage.created_at,
            is_admin: true,
            is_following: true
          } : null,
          wallet: wallet ? {
            id: wallet.id,
            balance: wallet.balance,
            currency: wallet.currency
          } : null
        }
      });
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Erreur completeRegistration:', error);
      next(error);
    }
  }

  async checkProfileStatus(req, res, next) {
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
        message: 'Statut du profil récupéré avec succès',
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
      console.error('Erreur checkProfileStatus:', error);
      next(error);
    }
  }

  // =====================================================
  // 🔐 CONNEXION AVEC OTP (2 NIVEAUX + VÉRIFICATION PROFIL)
  // =====================================================

  async login(req, res, next) {
    try {
      let { phone, channel = 'sms' } = req.body;
      
      if (!phone) {
        return res.status(400).json({ 
          state: false,
          message: 'Le numéro de téléphone est requis',
          datas: null
        });
      }
      
      console.log('🔍 Demande de connexion OTP pour:', { phone });
      
      const user = await User.findOne({ where: { phone: phone } });
      
      if (!user) {
        console.log('❌ Utilisateur non trouvé pour:', phone);
        return res.status(401).json({ 
          state: false,
          message: 'Aucun compte associé à ce numéro',
          datas: null
        });
      }
      
      console.log('✅ Utilisateur trouvé:', { id: user.id, phone: user.phone });
      
      if (!user.is_profile_completed) {
        console.log('⚠️ Utilisateur avec profil non complété:', { phone, is_profile_completed: user.is_profile_completed });
        return res.status(403).json({ 
          state: false,
          message: 'Profil non complété',
          datas: { isProfileCompleted: false, requiresProfileCompletion: true }
        });
      }
      
      if (!user.is_active) {
        return res.status(403).json({ 
          state: false,
          message: 'Ce compte est désactivé',
          datas: null
        });
      }
      
      if (user.is_blocked) {
        return res.status(403).json({ 
          state: false,
          message: 'Ce compte est bloqué',
          datas: null
        });
      }
      
      const result = await otpService.sendOtp(phone, channel || user.otp_channel || 'sms', 'login');
      
      console.log('✅ OTP envoyé pour connexion:', { phone, otpId: result.otpId, expiresAt: result.expiresAt });
      
      res.json({
        state: true,
        message: `Code OTP envoyé par ${channel || user.otp_channel || 'sms'}`,
        datas: {
          otpId: result.otpId,
          expiresAt: result.expiresAt,
          phone: phone,
          userId: user.id,
          requiresOtpVerification: true
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur envoi OTP connexion:', error);
      next(error);
    }
  }

  // ... (autres méthodes à standardiser de la même manière)
  
  // =====================================================
  // 📞 CHANGEMENT DE NUMÉRO DE TÉLÉPHONE
  // =====================================================

  async initiatePhoneChange(req, res, next) {
    const transaction = await sequelize.transaction();
  
    try {
      const userId = req.user.id;
      const { new_phone } = req.body;
      
      if (!new_phone) {
        if (transaction && !transaction.finished) await transaction.rollback();
        return res.status(400).json({ 
          state: false, 
          message: 'Le nouveau numéro est requis', 
          datas: null 
        });
      }
      
      const user = await User.findByPk(userId);
      if (!user) {
        if (transaction && !transaction.finished) await transaction.rollback();
        return res.status(404).json({ 
          state: false, 
          message: 'Utilisateur non trouvé', 
          datas: null 
        });
      }
      
      const old_phone = user.phone;
      
      const existingUser = await User.findOne({ where: { phone: new_phone } });
      if (existingUser && existingUser.id !== userId) {
        if (transaction && !transaction.finished) await transaction.rollback();
        return res.status(409).json({ 
          state: false, 
          message: 'Ce numéro est déjà utilisé par un autre compte', 
          datas: null 
        });
      }
      
      const pendingChange = await UserPhoneHistory.findOne({
        where: { user_id: userId, status: 'pending' }
      });
      
      if (pendingChange) {
        if (transaction && !transaction.finished) await transaction.rollback();
        return res.status(400).json({ 
          state: false, 
          message: 'Un changement de numéro est déjà en cours', 
          datas: { pendingChangeId: pendingChange.id }
        });
      }
      
      const phoneChange = await UserPhoneHistory.create({
        user_id: userId,
        old_phone: old_phone,
        new_phone: new_phone,
        status: 'pending',
        old_phone_verified: true,
        new_phone_verified: false
      }, { transaction });
      
      const alertMessage = `⚠️ ALERTE SECURITE: Une demande de changement de numéro de téléphone a été initiée pour votre compte vers le numéro ${new_phone}. Si vous n'êtes pas à l'origine de cette demande, veuillez contacter le support immédiatement.`;
      
      console.log('\n╔═════════════════════════════════════════════════╗');
      console.log('║     📱 ALERTE SECURITE (ANCIEN NUMÉRO)          ║');
      console.log('╚═════════════════════════════════════════════════╝');
      console.log(`   📞 Destination: ${old_phone}`);
      console.log(`   📝 Message: ${alertMessage}\n`);
      
      const newOtpResult = await otpService.sendOtp(new_phone, 'sms', 'phone_change_new');
      
      await phoneChange.update({
        new_phone_otp_id: newOtpResult.otpId
      }, { transaction });
      
      await transaction.commit();
      
      res.json({
        state: true,
        message: 'Message d\'alerte envoyé à l\'ancien numéro. Code OTP envoyé au nouveau numéro.',
        datas: {
          phoneChangeId: phoneChange.id,
          old_phone: maskPhoneNumber(old_phone),
          new_phone: maskPhoneNumber(new_phone),
          expiresIn: 600
        }
      });
      
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      console.error('❌ Erreur initiatePhoneChange:', error);
      next(error);
    }
  }

  // ... (autres méthodes à continuer de la même manière)
}

module.exports = AuthController;
