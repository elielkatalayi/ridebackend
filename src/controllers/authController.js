// controllers/authController.js
const jwtService = require('../services/auth/jwtService');
const otpService = require('../services/auth/otpService');
const passwordService = require('../services/auth/passwordService');
const { User, Wallet, Page, PageAdmin } = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

class AuthController {

  // =====================================================
  // 📝 INSCRIPTION (3 ÉTAPES)
  // =====================================================

  async requestRegisterOtp(req, res, next) {
    try {
      let { phone, channel = 'sms' } = req.body;
      
      // ✅ Plus de validation formatPhoneNumber
      if (!phone) {
        return res.status(400).json({ error: 'Numéro de téléphone requis' });
      }
      
      const existingUser = await User.findOne({ where: { phone } });
      if (existingUser) {
        return res.status(409).json({ error: 'Ce numéro est déjà utilisé' });
      }
      
      const result = await otpService.sendOtp(phone, channel, 'register');
      
      res.json({
        success: true,
        message: `Code OTP envoyé par ${channel}`,
        expiresAt: result.expiresAt,
        phone: phone
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyOtpOnly(req, res, next) {
    try {
      let { phone, code, otp_channel = 'sms' } = req.body;
      
      // ✅ Plus de validation formatPhoneNumber
      if (!phone) {
        return res.status(400).json({ error: 'Numéro de téléphone requis' });
      }
      
      const result = await otpService.verifyOtp(phone, otp_channel, code, 'register');
      
      const tempToken = jwtService.generateTempToken({
        phone: phone,
        otpId: result.otpId,
        verified: true,
        purpose: 'registration'
      });
      
      res.json({
        success: true,
        message: 'Code OTP vérifié avec succès',
        tempToken: tempToken,
        expiresIn: 900
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async completeRegistration(req, res, next) {
      const transaction = await sequelize.transaction();
      
      try {
        const { 
          tempToken, 
          email, 
          password, 
          first_name, 
          last_name,
          emergency_contact_name,
          emergency_contact_phone,
          birth_date  
        } = req.body;
        
        let payload;
        try {
          payload = jwtService.verifyTempToken(tempToken);
        } catch (error) {
          return res.status(401).json({ 
            error: 'Session expirée. Veuillez recommencer la vérification OTP.' 
          });
        }
        
        if (payload.purpose !== 'registration' || !payload.verified) {
          return res.status(401).json({ 
            error: 'Token invalide. Veuillez recommencer.' 
          });
        }
        
        const phone = payload.phone;
        
        const existingUser = await User.findOne({
          where: {
            [Op.or]: [
              { phone },
              ...(email ? [{ email }] : [])
            ]
          }
        });
        
        if (existingUser) {
          return res.status(409).json({ error: 'Cet utilisateur existe déjà' });
        }
        
        const passwordValidation = passwordService.validatePasswordStrength(password);
        if (!passwordValidation.isValid) {
          return res.status(400).json({ error: passwordValidation.errors[0] });
        }
        
        // ✅ Valider la date de naissance si fournie - CORRIGÉ
        if (birth_date) {
          const birthDateObj = new Date(birth_date);
          const today = new Date();
          let age = today.getFullYear() - birthDateObj.getFullYear();  // ← let au lieu de const
          const monthDiff = today.getMonth() - birthDateObj.getMonth();
          
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
            age--;  // ← Maintenant ça fonctionne
          }
          
          if (age < 13) {
            return res.status(400).json({ 
              error: 'Vous devez avoir au moins 13 ans pour vous inscrire' 
            });
          }
          
          if (age > 120) {
            return res.status(400).json({ 
              error: 'Date de naissance invalide' 
            });
          }
        }
        
        const user = await User.create({
          phone,
          email: email || null,
          password_hash: password,
          first_name,
          last_name,
          emergency_contact_name: emergency_contact_name || null,
          emergency_contact_phone: emergency_contact_phone || null,
          birth_date: birth_date || null,
          role: 'passenger',
          is_active: true,
          otp_channel: 'sms'
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
        
        const pageSlug = generateSlug(first_name, last_name, user.id);
        
        const personalPage = await Page.create({
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
        
        const wallet = await Wallet.create({
          user_id: user.id,
          balance: 0,
          currency: 'CDF'
        }, { transaction });
        
        if (payload.otpId) {
          await otpService.markOtpAsUsed(payload.otpId);
        }
        
        await transaction.commit();
        
        const token = jwtService.generateToken({
          id: user.id,
          phone: user.phone,
          role: user.role
        });
        
        const refreshToken = jwtService.generateRefreshToken({
          id: user.id,
          phone: user.phone
        });
        
        res.status(201).json({
          success: true,
          message: 'Inscription réussie',
          user: {
            id: user.id,
            phone: user.phone,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            birth_date: user.birth_date,
            role: user.role,
            avatar_url: user.avatar_url,
            is_active: user.is_active
          },
          personal_page: {
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
          },
          wallet: {
            id: wallet.id,
            balance: wallet.balance
          },
          token,
          refreshToken
        });
      } catch (error) {
        await transaction.rollback();
        next(error);
      }
  }

  // =====================================================
  // 🔐 CONNEXION
  // =====================================================

  async login(req, res, next) {
    try {
      let { phone, password } = req.body;
      
      if (!phone) {
        return res.status(400).json({ 
          error: 'Le numéro de téléphone est requis',
          field: 'phone'
        });
      }
      
      if (!password) {
        return res.status(400).json({ 
          error: 'Le mot de passe est requis',
          field: 'password'
        });
      }
      
      // ✅ Plus de validation formatPhoneNumber
      console.log('🔍 Tentative de connexion:', { 
        originalPhone: phone
      });
      
      const user = await User.findOne({ where: { phone: phone } });
      
      if (!user) {
        console.log('❌ Utilisateur non trouvé pour:', phone);
        return res.status(401).json({ 
          error: 'Aucun compte associé à ce numéro',
          field: 'phone',
          suggestion: 'Vérifiez votre numéro ou inscrivez-vous'
        });
      }
      
      console.log('✅ Utilisateur trouvé:', { id: user.id, phone: user.phone });
      
      const isPasswordValid = await user.comparePassword(password);
      
      if (!isPasswordValid) {
        console.log('❌ Mot de passe incorrect pour:', phone);
        return res.status(401).json({ 
          error: 'Mot de passe incorrect',
          field: 'password',
          suggestion: 'Vérifiez votre mot de passe ou utilisez "Mot de passe oublié"'
        });
      }
      
      console.log('✅ Mot de passe valide');
      
      if (!user.is_active) {
        return res.status(403).json({ 
          error: 'Ce compte est désactivé',
          suggestion: 'Contactez le support pour réactiver votre compte'
        });
      }
      
      if (user.is_blocked) {
        return res.status(403).json({ 
          error: 'Ce compte est bloqué',
          reason: user.blocked_reason || 'Violation des conditions d\'utilisation',
          suggestion: 'Contactez le support pour plus d\'informations'
        });
      }
      
      await user.update({
        last_login_at: new Date(),
        last_login_ip: req.ip || req.connection.remoteAddress
      });
      
      const token = jwtService.generateToken({
        id: user.id,
        phone: user.phone,
        role: user.role
      });
      
      const refreshToken = jwtService.generateRefreshToken({
        id: user.id,
        phone: user.phone
      });
      
      console.log('✅ Connexion réussie pour:', phone);
      
      res.json({
        success: true,
        message: 'Connexion réussie',
        user: {
          id: user.id,
          phone: user.phone,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          avatar_url: user.avatar_url,
          cover_url: user.cover_url,
          is_active: user.is_active,
          is_verified: user.is_verified,
          rating: user.rating,
          total_rides: user.total_rides,
          created_at: user.created_at
        },
        token,
        refreshToken
      });
    } catch (error) {
      console.error('❌ Erreur login:', error);
      next(error);
    }
  }

  // =====================================================
  // 🔑 OTP GÉNÉRIQUE
  // =====================================================

  async requestOtp(req, res, next) {
    try {
      const { destination, channel, purpose = 'verification' } = req.body;
      const result = await otpService.sendOtp(destination, channel, purpose);
      
      res.json({
        success: true,
        message: `Code OTP envoyé par ${channel}`,
        expiresAt: result.expiresAt,
        otpId: result.otpId
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyOtp(req, res, next) {
    try {
      const { destination, channel, code, purpose = 'verification' } = req.body;
      const result = await otpService.verifyOtp(destination, channel, code, purpose);
      
      res.json({
        success: true,
        message: 'Code OTP valide',
        otpId: result.otpId
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // =====================================================
  // 🔐 RÉINITIALISATION MOT DE PASSE
  // =====================================================

  async forgotPassword(req, res, next) {
    try {
      let { phone } = req.body;
      
      // ✅ Plus de validation formatPhoneNumber
      if (!phone) {
        return res.json({ 
          success: true, 
          message: 'Si le compte existe, un code vous a été envoyé' 
        });
      }
      
      const user = await User.findOne({ where: { phone } });
      if (!user) {
        return res.json({ 
          success: true, 
          message: 'Si le compte existe, un code vous a été envoyé' 
        });
      }
      
      await otpService.sendOtp(phone, user.otp_channel || 'sms', 'reset_password');
      
      res.json({
        success: true,
        message: 'Si le compte existe, un code vous a été envoyé'
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyResetOtp(req, res, next) {
    try {
      let { phone, code, otp_channel = 'sms' } = req.body;
      
      // ✅ Plus de validation formatPhoneNumber
      if (!phone) {
        return res.status(400).json({ error: 'Numéro de téléphone requis' });
      }
      
      const user = await User.findOne({ where: { phone } });
      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }
      
      const result = await otpService.verifyOtp(phone, otp_channel, code, 'reset_password');
      
      const resetToken = jwtService.generateTempToken({
        phone: phone,
        userId: user.id,
        otpId: result.otpId,
        purpose: 'reset_password'
      });
      
      res.json({
        success: true,
        message: 'Code vérifié avec succès',
        resetToken: resetToken,
        expiresIn: 900
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async resetPassword(req, res, next) {
    const transaction = await sequelize.transaction();
    
    try {
      const { resetToken, new_password } = req.body;
      
      let payload;
      try {
        payload = jwtService.verifyTempToken(resetToken);
      } catch (error) {
        return res.status(401).json({ 
          error: 'Session expirée. Veuillez recommencer la vérification.' 
        });
      }
      
      if (payload.purpose !== 'reset_password') {
        return res.status(401).json({ error: 'Token invalide.' });
      }
      
      const user = await User.findByPk(payload.userId);
      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }
      
      const passwordValidation = passwordService.validatePasswordStrength(new_password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({ error: passwordValidation.errors[0] });
      }
      
      user.password_hash = new_password;
      await user.save({ transaction });
      
      if (payload.otpId) {
        await otpService.markOtpAsUsed(payload.otpId);
      }
      
      await transaction.commit();
      
      res.json({
        success: true,
        message: 'Mot de passe réinitialisé avec succès'
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  // =====================================================
  // 🔄 RAFRAÎCHISSEMENT TOKEN
  // =====================================================

  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token requis' });
      }
      
      const payload = jwtService.verifyToken(refreshToken);
      
      const user = await User.findByPk(payload.id);
      if (!user) {
        return res.status(401).json({ error: 'Utilisateur non trouvé' });
      }
      
      const newToken = jwtService.generateToken({
        id: user.id,
        phone: user.phone,
        role: user.role
      });
      
      const newRefreshToken = jwtService.generateRefreshToken({
        id: user.id,
        phone: user.phone
      });
      
      res.json({
        success: true,
        token: newToken,
        refreshToken: newRefreshToken
      });
    } catch (error) {
      next(error);
    }
  }

  // =====================================================
  // 🚪 DÉCONNEXION
  // =====================================================

  async logout(req, res, next) {
    try {
      res.json({ 
        success: true, 
        message: 'Déconnecté avec succès' 
      });
    } catch (error) {
      next(error);
    }
  }

  // =====================================================
  // 📧 VÉRIFICATION EMAIL
  // =====================================================

  async verifyEmail(req, res, next) {
    const transaction = await sequelize.transaction();
    
    try {
      const userId = req.user.id;
      const { code, email } = req.body;
      
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }
      
      await otpService.verifyOtp(email, 'email', code, 'verify_email');
      
      await user.update({
        email: email,
        is_verified: true,
        verified_at: new Date()
      }, { transaction });
      
      await transaction.commit();
      
      res.json({
        success: true,
        message: 'Email vérifié avec succès'
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  async resendVerification(req, res, next) {
    try {
      const userId = req.user.id;
      const { email } = req.body;
      
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }
      
      await otpService.sendOtp(email, 'email', 'verify_email');
      
      res.json({
        success: true,
        message: 'Code de vérification renvoyé avec succès'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();