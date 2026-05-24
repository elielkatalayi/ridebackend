// controllers/userController.js
const { User, Driver, Wallet, Ride, Category } = require('../models');
const { sequelize } = require('../config/database');
const { uploadToSupabase } = require('../utils/storage');
const path = require('path');
const { Op } = require('sequelize');

class UserController {
  // =====================================================
  // 👤 GESTION DU PROFIL
  // =====================================================

  /**
   * Obtenir le profil de l'utilisateur connecté
   * GET /api/v1/users/profile ou /api/v1/users/me
   */
  async getProfile(req, res, next) {
    try {
      const user = await User.findByPk(req.user.id, {
        attributes: { exclude: ['password_hash'] }
      });
      
      if (!user) {
        return res.status(404).json({ 
          state: false,
          message: 'Utilisateur non trouvé', 
          datas: null 
        });
      }
      
      // Récupérer le wallet
      const wallet = await Wallet.findOne({ where: { user_id: user.id } });
      
      // Si c'est un chauffeur, récupérer les infos chauffeur
      let driverInfo = null;
      if (user.role === 'driver') {
        driverInfo = await Driver.findOne({
          where: { user_id: user.id },
          attributes: { exclude: ['user_id'] }
        });
      }
      
      res.json({
        state: true,
        message: 'Profil récupéré avec succès',
        datas: {
          user: user.toJSON(),
          wallet: wallet ? { 
            balance: wallet.balance, 
            currency: wallet.currency 
          } : null,
          driver: driverInfo
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour le profil utilisateur
   * PUT /api/v1/users/profile ou /api/v1/users/me
   */
  async updateProfile(req, res, next) {
    try {
      const { 
        first_name, 
        last_name, 
        email, 
        emergency_contact_name, 
        emergency_contact_phone, 
        otp_channel,
        birth_date
      } = req.body;
      
      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({ 
          state: false, 
          message: 'Utilisateur non trouvé', 
          datas: null 
        });
      }
      
      // Vérifier si l'email n'est pas déjà utilisé par un autre utilisateur
      if (email && email !== user.email) {
        const existingUser = await User.findOne({ 
          where: { 
            email, 
            id: { [Op.ne]: user.id } 
          } 
        });
        if (existingUser) {
          return res.status(409).json({ 
            state: false, 
            message: 'Cet email est déjà utilisé', 
            datas: null 
          });
        }
      }
      
      // Valider la date de naissance si fournie
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
        first_name: first_name || user.first_name,
        last_name: last_name || user.last_name,
        email: email || user.email,
        emergency_contact_name: emergency_contact_name || user.emergency_contact_name,
        emergency_contact_phone: emergency_contact_phone || user.emergency_contact_phone,
        otp_channel: otp_channel || user.otp_channel,
        birth_date: birth_date !== undefined ? (birth_date || null) : user.birth_date
      });
      
      // Récupérer l'utilisateur mis à jour sans le password
      const updatedUser = await User.findByPk(user.id, {
        attributes: { exclude: ['password_hash'] }
      });
      
      res.json({
        state: true,
        message: 'Profil mis à jour avec succès',
        datas: updatedUser.toJSON()
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour le contact d'urgence
   * PUT /api/v1/users/emergency-contact
   */
  async updateEmergencyContact(req, res, next) {
    try {
      const { emergency_contact_name, emergency_contact_phone } = req.body;
      
      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({ 
          state: false, 
          message: 'Utilisateur non trouvé', 
          datas: null 
        });
      }
      
      await user.update({
        emergency_contact_name: emergency_contact_name || null,
        emergency_contact_phone: emergency_contact_phone || null
      });
      
      res.json({
        state: true,
        message: 'Contact d\'urgence mis à jour avec succès',
        datas: {
          emergency_contact: {
            name: user.emergency_contact_name,
            phone: user.emergency_contact_phone
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Supprimer le compte utilisateur (soft delete)
   * DELETE /api/v1/users/account ou /api/v1/users/me
   */
  async deleteAccount(req, res, next) {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({ 
          state: false, 
          message: 'Utilisateur non trouvé', 
          datas: null 
        });
      }
      
      // Soft delete - désactiver le compte
      await user.update({ 
        is_active: false,
        is_blocked: true,
        blocked_reason: 'Compte supprimé par l\'utilisateur'
      });
      
      res.json({ 
        state: true, 
        message: 'Compte désactivé avec succès', 
        datas: null 
      });
    } catch (error) {
      next(error);
    }
  }

  // =====================================================
  // 📸 GESTION DES PHOTOS (avec Supabase)
  // =====================================================

  /**
   * Uploader une photo de profil
   * POST /api/v1/users/profile-picture
   */
  async uploadProfilePicture(req, res, next) {
    try {
      const userId = req.user.id;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ 
          state: false, 
          message: 'Aucune photo fournie', 
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
      
      // Upload vers Supabase
      const bucket = 'profiles';
      const directory = 'avatars';
      const result = await uploadToSupabase(
        bucket,
        directory,
        file.buffer,
        file.mimetype,
        file.originalname
      );
      
      // Supprimer l'ancienne photo si elle existe
      if (user.avatar_url) {
        const oldPath = user.avatar_url.split('/').pop();
        if (oldPath) {
          try {
            // Importer supabase client si nécessaire
            const { supabase } = require('../config/supabase');
            await supabase.storage.from(bucket).remove([`${directory}/${oldPath}`]);
          } catch (e) {
            console.log('Ancienne photo non supprimée:', e.message);
          }
        }
      }
      
      // Mettre à jour l'utilisateur avec la nouvelle URL
      await user.update({ avatar_url: result.url });
      
      res.json({
        state: true,
        message: 'Photo de profil mise à jour avec succès',
        datas: {
          avatar_url: result.url
        }
      });
    } catch (error) {
      console.error('Erreur upload photo profil:', error);
      res.status(500).json({ 
        state: false, 
        message: 'Erreur lors de l\'upload de la photo', 
        datas: null 
      });
    }
  }

  /**
   * Uploader une photo de couverture
   * POST /api/v1/users/cover-picture
   */
  async uploadCoverPicture(req, res, next) {
    try {
      const userId = req.user.id;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ 
          state: false, 
          message: 'Aucune photo fournie', 
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
      
      // Upload vers Supabase
      const bucket = 'profiles';
      const directory = 'covers';
      const result = await uploadToSupabase(
        bucket,
        directory,
        file.buffer,
        file.mimetype,
        file.originalname
      );
      
      // Mettre à jour l'utilisateur avec la nouvelle URL
      await user.update({ cover_url: result.url });
      
      res.json({
        state: true,
        message: 'Photo de couverture mise à jour avec succès',
        datas: {
          cover_url: result.url
        }
      });
    } catch (error) {
      console.error('Erreur upload photo couverture:', error);
      res.status(500).json({ 
        state: false, 
        message: 'Erreur lors de l\'upload de la photo', 
        datas: null 
      });
    }
  }

  /**
   * Supprimer la photo de profil
   * DELETE /api/v1/users/profile-picture
   */
  async deleteProfilePicture(req, res, next) {
    try {
      const userId = req.user.id;
      
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ 
          state: false, 
          message: 'Utilisateur non trouvé', 
          datas: null 
        });
      }
      
      if (user.avatar_url) {
        const bucket = 'profiles';
        const directory = 'avatars';
        const oldPath = user.avatar_url.split('/').pop();
        if (oldPath) {
          try {
            const { supabase } = require('../config/supabase');
            await supabase.storage.from(bucket).remove([`${directory}/${oldPath}`]);
          } catch (e) {
            console.log('Ancienne photo non supprimée:', e.message);
          }
        }
        
        await user.update({ avatar_url: null });
      }
      
      res.json({
        state: true,
        message: 'Photo de profil supprimée avec succès',
        datas: null
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Supprimer la photo de couverture
   * DELETE /api/v1/users/cover-picture
   */
  async deleteCoverPicture(req, res, next) {
    try {
      const userId = req.user.id;
      
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ 
          state: false, 
          message: 'Utilisateur non trouvé', 
          datas: null 
        });
      }
      
      if (user.cover_url) {
        const bucket = 'profiles';
        const directory = 'covers';
        const oldPath = user.cover_url.split('/').pop();
        if (oldPath) {
          try {
            const { supabase } = require('../config/supabase');
            await supabase.storage.from(bucket).remove([`${directory}/${oldPath}`]);
          } catch (e) {
            console.log('Ancienne photo non supprimée:', e.message);
          }
        }
        
        await user.update({ cover_url: null });
      }
      
      res.json({
        state: true,
        message: 'Photo de couverture supprimée avec succès',
        datas: null
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les photos de l'utilisateur
   * GET /api/v1/users/photos
   */
  async getUserPhotos(req, res, next) {
    try {
      const userId = req.user.id;
      
      const user = await User.findByPk(userId, {
        attributes: ['avatar_url', 'cover_url']
      });
      
      res.json({
        state: true,
        message: 'Photos récupérées avec succès',
        datas: {
          avatar_url: user.avatar_url,
          cover_url: user.cover_url
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =====================================================
  // 📊 STATISTIQUES ET HISTORIQUE
  // =====================================================

  /**
   * Obtenir l'historique des courses
   * GET /api/v1/users/rides
   */
  async getRideHistory(req, res, next) {
    try {
      const { limit = 50, offset = 0, status } = req.query;
      
      const where = { passenger_id: req.user.id };
      if (status) {
        where.status = status;
      }
      
      const rides = await Ride.findAndCountAll({
        where,
        include: [
          { 
            model: Driver, 
            as: 'driver', 
            include: [{ 
              model: User, 
              as: 'user', 
              attributes: ['id', 'first_name', 'last_name', 'avatar_url'] 
            }] 
          },
          { 
            model: Category, 
            as: 'category', 
            attributes: ['id', 'name', 'base_price'] 
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      const totalPages = Math.ceil(rides.count / parseInt(limit));
      const currentPage = Math.floor(parseInt(offset) / parseInt(limit)) + 1;
      
      res.json({
        state: true,
        message: 'Historique des trajets récupéré',
        datas: rides.rows,
        meta: {
          total: rides.count,
          count: rides.rows.length,
          per_page: parseInt(limit),
          current_page: currentPage,
          total_pages: totalPages
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les statistiques utilisateur
   * GET /api/v1/users/stats
   */
  async getUserStats(req, res, next) {
    try {
      const userId = req.user.id;
      
      const totalRides = await Ride.count({
        where: { passenger_id: userId, status: 'completed' }
      });
      
      const totalSpent = await Ride.sum('price_final', {
        where: { passenger_id: userId, status: 'completed' }
      });
      
      const wallet = await Wallet.findOne({ where: { user_id: userId } });
      const user = await User.findByPk(userId, { attributes: ['created_at', 'rating', 'total_rides'] });
      
      res.json({
        state: true,
        message: 'Statistiques récupérées avec succès',
        datas: {
          total_rides: totalRides || 0,
          total_spent: totalSpent || 0,
          wallet_balance: wallet ? wallet.balance : 0,
          member_since: user.created_at,
          rating: user.rating,
          rides_as_passenger: user.total_rides || 0
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les infos du wallet
   * GET /api/v1/users/wallet
   */
  async getWalletInfo(req, res, next) {
    try {
      const userId = req.user.id;
      
      const wallet = await Wallet.findOne({ where: { user_id: userId } });
      if (!wallet) {
        return res.status(404).json({ 
          state: false, 
          message: 'Wallet non trouvé', 
          datas: null 
        });
      }
      
      res.json({
        state: true,
        message: 'Infos wallet récupérées',
        datas: {
          balance: wallet.balance,
          currency: wallet.currency,
          last_transaction_at: wallet.updated_at
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir l'historique des transactions
   * GET /api/v1/users/transactions
   */
  async getTransactionHistory(req, res, next) {
    try {
      const { limit = 50, offset = 0 } = req.query;
      
      // À implémenter selon votre modèle Transaction
      const transactions = [];
      const total = 0;
      
      const totalPages = Math.ceil(total / parseInt(limit));
      const currentPage = Math.floor(parseInt(offset) / parseInt(limit)) + 1;
      
      res.json({
        state: true,
        message: 'Historique des transactions récupéré',
        datas: transactions,
        meta: {
          total: total,
          count: transactions.length,
          per_page: parseInt(limit),
          current_page: currentPage,
          total_pages: totalPages
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =====================================================
  // 👥 GESTION DES AUTRES UTILISATEURS (Admin)
  // =====================================================

  /**
   * Lister les utilisateurs (admin seulement)
   * GET /api/v1/users
   */
  async listUsers(req, res, next) {
    try {
      const { limit = 50, offset = 0, role, is_active } = req.query;
      
      const where = {};
      if (role) where.role = role;
      if (is_active !== undefined) where.is_active = is_active === 'true';
      
      const users = await User.findAndCountAll({
        where,
        attributes: { exclude: ['password_hash'] },
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['created_at', 'DESC']]
      });
      
      const totalPages = Math.ceil(users.count / parseInt(limit));
      const currentPage = Math.floor(parseInt(offset) / parseInt(limit)) + 1;
      
      res.json({
        state: true,
        message: 'Liste des utilisateurs récupérée',
        datas: users.rows.map(user => ({
          id: user.id,
          phone: user.phone,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          is_active: user.is_active,
          is_blocked: user.is_blocked,
          created_at: user.created_at
        })),
        meta: {
          total: users.count,
          count: users.rows.length,
          per_page: parseInt(limit),
          current_page: currentPage,
          total_pages: totalPages
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir un utilisateur par ID
   * GET /api/v1/users/:userId
   */
  async getUserById(req, res, next) {
    try {
      const { userId } = req.params;
      
      const user = await User.findByPk(userId, {
        attributes: { exclude: ['password_hash'] }
      });
      
      if (!user) {
        return res.status(404).json({ 
          state: false, 
          message: 'Utilisateur non trouvé', 
          datas: null 
        });
      }
      
      const wallet = await Wallet.findOne({ where: { user_id: user.id } });
      
      res.json({
        state: true,
        message: 'Utilisateur récupéré',
        datas: {
          user: {
            id: user.id,
            phone: user.phone,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role,
            is_active: user.is_active,
            is_blocked: user.is_blocked,
            rating: user.rating,
            total_rides: user.total_rides
          },
          wallet: wallet ? { balance: wallet.balance } : null
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Bloquer un utilisateur (admin seulement)
   * PUT /api/v1/users/:userId/block
   */
  async blockUser(req, res, next) {
    try {
      const { userId } = req.params;
      const { reason, days } = req.body;
      
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ 
          state: false, 
          message: 'Utilisateur non trouvé', 
          datas: null 
        });
      }
      
      const blockedUntil = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;
      
      await user.update({
        is_blocked: true,
        blocked_reason: reason || 'Violation des conditions d\'utilisation',
        blocked_until: blockedUntil
      });
      
      res.json({
        state: true,
        message: `Utilisateur ${user.phone} bloqué avec succès`,
        datas: {
          id: user.id,
          phone: user.phone,
          is_blocked: true,
          blocked_reason: user.blocked_reason,
          blocked_until: blockedUntil
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Débloquer un utilisateur (admin seulement)
   * PUT /api/v1/users/:userId/unblock
   */
  async unblockUser(req, res, next) {
    try {
      const { userId } = req.params;
      
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ 
          state: false, 
          message: 'Utilisateur non trouvé', 
          datas: null 
        });
      }
      
      await user.update({
        is_blocked: false,
        blocked_reason: null,
        blocked_until: null
      });
      
      res.json({
        state: true,
        message: `Utilisateur ${user.phone} débloqué avec succès`,
        datas: {
          id: user.id,
          phone: user.phone,
          is_blocked: false,
          blocked_reason: null,
          blocked_until: null
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Changer le rôle d'un utilisateur (admin seulement)
   * PUT /api/v1/users/:userId/role
   */
  async changeUserRole(req, res, next) {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ 
          state: false, 
          message: 'Utilisateur non trouvé', 
          datas: null 
        });
      }
      
      await user.update({ role });
      
      res.json({
        state: true,
        message: `Rôle de l'utilisateur ${user.phone} changé en ${role}`,
        datas: {
          id: user.id,
          phone: user.phone,
          role: user.role
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Supprimer un utilisateur (admin seulement)
   * DELETE /api/v1/users/:userId
   */
  async deleteUserByAdmin(req, res, next) {
    try {
      const { userId } = req.params;
      
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ 
          state: false, 
          message: 'Utilisateur non trouvé', 
          datas: null 
        });
      }
      
      // Soft delete
      await user.update({
        is_active: false,
        is_blocked: true,
        blocked_reason: 'Compte supprimé par l\'administrateur'
      });
      
      res.json({
        state: true,
        message: `Utilisateur ${user.phone} supprimé avec succès`,
        datas: null
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();