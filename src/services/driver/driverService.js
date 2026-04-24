// services/driver/driverService.js

const { Driver, User, Ride, Wallet, DriverPointsHistory } = require('../../models');
const { sequelize } = require('../../config/database');
const pointsService = require('./pointsService');
const { uploadToSupabase } = require('../../utils/storage');
const walletService = require('../payment/walletService'); // ← AJOUT IMPORTANT
const { Op } = require('sequelize');
const fs = require('fs');

class DriverService {
  /**
   * Créer un nouveau chauffeur
   * @param {Object} driverData - Données du chauffeur (inclut les fichiers)
   * @returns {Promise<Object>}
   */
  async createDriver(driverData) {
      const {
        user_id,
        city_id,
        license_photo,
        vehicle_registration,
        insurance,
        id_photo,
        portrait_photo,
        vehicle_photo_front,
        vehicle_photo_back,
        vehicle_photo_interior,
        ...driverInfo
      } = driverData;
      
      const transaction = await sequelize.transaction();
      
      try {
        const user = await User.findByPk(user_id, { transaction });
        if (!user) {
          throw new Error('Utilisateur non trouvé');
        }
        
        const existingDriver = await Driver.findOne({
          where: { user_id },
          transaction
        });
        
        if (existingDriver) {
          throw new Error('Cet utilisateur est déjà chauffeur');
        }
        
        const uploadedFiles = {};
        
        const uploadFile = async (file, folder, type) => {
          if (!file) return null;
          
          try {
            let fileBuffer;
            
            if (file.buffer) {
              fileBuffer = file.buffer;
            } else if (file.path) {
              fileBuffer = fs.readFileSync(file.path);
            } else {
              throw new Error('Format de fichier non supporté - pas de buffer ni de path');
            }
            
            const result = await uploadToSupabase(
              'drivers',
              folder,
              fileBuffer,
              file.mimetype,
              file.originalname
            );
            
            return result.url;
            
          } catch (error) {
            throw new Error(`Erreur lors de l'upload du ${type}: ${error.message}`);
          }
        };
        
        if (license_photo) {
          uploadedFiles.license_photo_url = await uploadFile(license_photo, 'licenses', 'license');
        }
        
        if (vehicle_registration) {
          uploadedFiles.vehicle_registration_url = await uploadFile(vehicle_registration, 'registrations', 'registration');
        }
        
        if (insurance) {
          uploadedFiles.insurance_url = await uploadFile(insurance, 'insurances', 'insurance');
        }
        
        if (id_photo) {
          uploadedFiles.id_photo_url = await uploadFile(id_photo, 'id_photos', 'id_photo');
        }
        
        if (portrait_photo) {
          uploadedFiles.portrait_photo_url = await uploadFile(portrait_photo, 'portraits', 'portrait');
        }
        
        if (vehicle_photo_front) {
          uploadedFiles.vehicle_photo_front_url = await uploadFile(vehicle_photo_front, 'vehicles', 'vehicle_front');
        }
        if (vehicle_photo_back) {
          uploadedFiles.vehicle_photo_back_url = await uploadFile(vehicle_photo_back, 'vehicles', 'vehicle_back');
        }
        if (vehicle_photo_interior) {
          uploadedFiles.vehicle_photo_interior_url = await uploadFile(vehicle_photo_interior, 'vehicles', 'vehicle_interior');
        }
        
        const createData = {
          user_id,
          city_id,
          ...driverInfo,
          ...uploadedFiles,
          is_approved: true
        };
        
        const driver = await Driver.create(createData, { transaction });
        
        await transaction.commit();
        
        return driver;
        
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    }

  /**
   * Mettre à jour la position GPS d'un chauffeur
   */
  async updateLocation(driverId, lat, lng) {
    const driver = await Driver.findByPk(driverId);
    if (!driver) {
      throw new Error('Chauffeur non trouvé');
    }
    
    await driver.update({
      current_lat: lat,
      current_lng: lng,
      last_location_update: new Date()
    });
    
    return driver;
  }

  /**
   * Mettre à jour le statut en ligne/hors ligne
   */
  async setOnlineStatus(driverId, isOnline) {
    const driver = await Driver.findByPk(driverId);
    if (!driver) {
      throw new Error('Chauffeur non trouvé');
    }
    
    await driver.update({ is_online: isOnline });
    
    return driver;
  }

  /**
   * Obtenir les documents d'un chauffeur
   */
  async getDriverDocuments(driverId) {
    const driver = await Driver.findByPk(driverId, {
      attributes: [
        'license_photo_url',
        'vehicle_registration_url',
        'insurance_url',
        'id_photo_url',
        'portrait_photo_url',
        'vehicle_photo_front_url',
        'vehicle_photo_back_url',
        'vehicle_photo_interior_url'
      ]
    });
    
    return driver;
  }

  /**
   * Mettre à jour les documents d'un chauffeur
   */
  async updateDriverDocuments(driverId, documents) {
    const driver = await Driver.findByPk(driverId);
    if (!driver) {
      throw new Error('Chauffeur non trouvé');
    }
    
    await driver.update(documents);
    
    return driver;
  }

  /**
   * Suspendre un chauffeur
   */
  async suspendDriver(driverId, reason, days = 7) {
    const driver = await Driver.findByPk(driverId);
    if (!driver) {
      throw new Error('Chauffeur non trouvé');
    }
    
    const suspendedUntil = new Date();
    suspendedUntil.setDate(suspendedUntil.getDate() + days);
    
    await driver.update({
      is_suspended: true,
      suspension_reason: reason,
      suspended_at: new Date(),
      suspended_until: suspendedUntil,
      is_online: false
    });
    
    return driver;
  }

  /**
   * Réactiver un chauffeur suspendu
   */
  async reactivateDriver(driverId) {
    const driver = await Driver.findByPk(driverId);
    if (!driver) {
      throw new Error('Chauffeur non trouvé');
    }
    
    await driver.update({
      is_suspended: false,
      suspension_reason: null,
      suspended_at: null,
      suspended_until: null
    });
    
    return driver;
  }

  /**
   * Obtenir les chauffeurs à proximité
   */
  async getNearbyDrivers(lat, lng, radius = 5) {
    const drivers = await Driver.findAll({
      where: {
        is_approved: true,
        is_online: true,
        is_suspended: false,
        is_blocked_for_negative_balance: false,
        current_lat: { [Op.ne]: null },
        current_lng: { [Op.ne]: null }
      },
      include: [{ model: User, as: 'user', attributes: ['id', 'first_name', 'last_name', 'phone', 'avatar_url'] }]
    });
    
    const nearby = drivers.filter(driver => {
      const distance = this.calculateDistance(
        lat, lng,
        parseFloat(driver.current_lat),
        parseFloat(driver.current_lng)
      );
      return distance <= radius;
    });
    
    return nearby;
  }

  /**
   * Calculer la distance entre deux points
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Obtenir les statistiques complètes d'un chauffeur
   */
  async getDriverStats(driverId) {
    const driver = await Driver.findByPk(driverId, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'first_name', 'last_name', 'phone', 'email', 'avatar_url'] }
      ]
    });
    
    if (!driver) {
      throw new Error('Chauffeur non trouvé');
    }
    
    // ✅ Utiliser getUserWallet (système unifié)
    const wallet = await walletService.getUserWallet(driver.user_id);
    
    const completedRides = await Ride.count({
      where: { driver_id: driverId, status: 'completed' }
    });
    
    const cancelledRides = await Ride.count({
      where: { driver_id: driverId, status: 'cancelled' }
    });
    
    const totalEarnings = await Ride.sum('price_final', {
      where: { driver_id: driverId, status: 'completed' }
    });
    
    const totalRides = driver.total_rides || 0;
    
    return {
      success: true,
      driver: {
        id: driver.id,
        unique_id: driver.unique_id,
        vehicle_brand: driver.vehicle_brand,
        vehicle_model: driver.vehicle_model,
        vehicle_color: driver.vehicle_color,
        vehicle_plate: driver.vehicle_plate,
        rating: driver.rating,
        activity_points: driver.activity_points,
        is_approved: driver.is_approved,
        is_online: driver.is_online,
        is_suspended: driver.is_suspended,
        is_blocked_for_negative_balance: driver.is_blocked_for_negative_balance || false,
        created_at: driver.created_at
      },
      user: driver.user,
      wallet: {
        balance: wallet.balance,
        currency: 'FC'
      },
      stats: {
        total_rides: totalRides,
        completed_rides: completedRides,
        cancelled_rides: cancelledRides,
        total_earnings: totalEarnings || 0,
        completion_rate: totalRides > 0 
          ? Math.round((completedRides / totalRides) * 100) 
          : 100
      }
    };
  }
}

module.exports = new DriverService();