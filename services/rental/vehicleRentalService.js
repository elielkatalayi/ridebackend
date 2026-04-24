// services/rental/vehicleRentalService.js
const { Vehicle, VehicleAvailability, VehicleBooking, User, sequelize } = require('../../models');
const { Op } = require('sequelize');
const walletService = require('../payment/walletService');
const notificationService = require('../notification/NotificationService');

class VehicleRentalService {
  
  /**
   * Enregistrer un nouveau véhicule (validation directe)
   */
  async registerVehicle(ownerId, vehicleData, files) {
    const transaction = await sequelize.transaction();
    
    try {
      const vehicle = await Vehicle.create({
        owner_id: ownerId,
        brand: vehicleData.brand,
        model: vehicleData.model,
        year: vehicleData.year,
        color: vehicleData.color,
        plate_number: vehicleData.plate_number,
        vin_number: vehicleData.vin_number,
        seat_count: vehicleData.seat_count || 4,
        door_count: vehicleData.door_count || 4,
        transmission: vehicleData.transmission,
        fuel_type: vehicleData.fuel_type,
        air_conditioning: vehicleData.air_conditioning !== undefined ? vehicleData.air_conditioning : true,
        photos: vehicleData.photos || [],
        cover_photo: files?.cover_photo || null,
        base_daily_rate: vehicleData.base_daily_rate,
        base_hourly_rate: vehicleData.base_hourly_rate,
        commission_percentage: vehicleData.commission_percentage || 20,
        registration_photo: files?.registration_photo || null,
        insurance_photo: files?.insurance_photo || null,
        technical_control_photo: files?.technical_control_photo || null,
        is_approved: true, // Validation directe
        is_active: true,
        description: vehicleData.description,
        features: vehicleData.features || []
      }, { transaction });
      
      // Créer la disponibilité par défaut (6 mois)
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 6);
      
      await VehicleAvailability.create({
        vehicle_id: vehicle.id,
        start_date: startDate,
        end_date: endDate,
        available_from: '08:00',
        available_until: '20:00'
      }, { transaction });
      
      await transaction.commit();
      
      return vehicle;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  /**
   * Mettre à jour la disponibilité d'un véhicule
   */
  async updateAvailability(ownerId, vehicleId, availabilityData) {
    const { start_date, end_date, is_blocked, special_daily_rate, special_hourly_rate } = availabilityData;
    
    // Vérifier que le véhicule appartient au propriétaire
    const vehicle = await Vehicle.findOne({
      where: { id: vehicleId, owner_id: ownerId }
    });
    
    if (!vehicle) {
      throw new Error('Véhicule non trouvé');
    }
    
    // Vérifier qu'il n'y a pas de réservations sur cette période
    const existingBooking = await VehicleBooking.findOne({
      where: {
        vehicle_id: vehicleId,
        status: ['confirmed', 'ongoing', 'pending'],
        [Op.or]: [
          { start_date: { [Op.between]: [start_date, end_date] } },
          { end_date: { [Op.between]: [start_date, end_date] } }
        ]
      }
    });
    
    if (existingBooking) {
      throw new Error('Des réservations existent sur cette période');
    }
    
    const [availability, created] = await VehicleAvailability.upsert({
      vehicle_id: vehicleId,
      start_date,
      end_date,
      is_blocked: is_blocked || false,
      special_daily_rate,
      special_hourly_rate
    });
    
    return availability;
  }
  
  /**
   * Vérifier la disponibilité d'un véhicule
   */
  async checkAvailability(vehicleId, startDate, endDate) {
    // Vérifier les réservations existantes
    const conflictingBookings = await VehicleBooking.findOne({
      where: {
        vehicle_id: vehicleId,
        status: ['confirmed', 'ongoing'],
        [Op.or]: [
          {
            start_date: { [Op.between]: [startDate, endDate] }
          },
          {
            end_date: { [Op.between]: [startDate, endDate] }
          },
          {
            [Op.and]: [
              { start_date: { [Op.lte]: startDate } },
              { end_date: { [Op.gte]: endDate } }
            ]
          }
        ]
      }
    });
    
    if (conflictingBookings) {
      return { available: false, reason: 'Déjà réservé sur cette période' };
    }
    
    // Vérifier la disponibilité générale
    const availability = await VehicleAvailability.findOne({
      where: {
        vehicle_id: vehicleId,
        start_date: { [Op.lte]: endDate },
        end_date: { [Op.gte]: startDate },
        is_blocked: false
      }
    });
    
    return { available: !!availability, availability };
  }
  
  /**
   * Créer une réservation
   */
  // services/rental/vehicleRentalService.js

  async createBooking(renterId, bookingData) {
    const { vehicle_id, start_date, end_date, booking_type, pickup_address, pickup_lat, pickup_lng, driver_id } = bookingData;
    
    const transaction = await sequelize.transaction();
    
    try {
      // Vérifier la disponibilité
      const { available } = await this.checkAvailability(vehicle_id, start_date, end_date);
      
      if (!available) {
        await transaction.rollback();
        throw new Error('Véhicule non disponible sur cette période');
      }
      
      // Récupérer le véhicule avec son propriétaire
      const vehicle = await Vehicle.findByPk(vehicle_id, {
        include: [{ model: User, as: 'owner', attributes: ['id', 'first_name', 'last_name', 'phone', 'avatar_url'] }]
      });
      
      if (!vehicle) {
        await transaction.rollback();
        throw new Error('Véhicule non trouvé');
      }
      
      // Calculer le prix
      const days = Math.ceil((new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24));
      const hours = Math.ceil((new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60));
      
      let baseAmount = 0;
      if (booking_type === 'daily') {
        baseAmount = vehicle.base_daily_rate * days;
      } else {
        baseAmount = vehicle.base_hourly_rate * hours;
      }
      
      const commissionAmount = Math.floor(baseAmount * vehicle.commission_percentage / 100);
      const netAmount = baseAmount - commissionAmount;
      const depositAmount = Math.floor(baseAmount * 0.5);
      const totalAmount = baseAmount + depositAmount;
      
      // Récupérer les infos du chauffeur
      let driverInfo = {};
      if (driver_id) {
        const driver = await User.findByPk(driver_id);
        if (driver) {
          driverInfo = {
            driver_id: driver.id,
            driver_name: `${driver.first_name} ${driver.last_name}`,
            driver_phone: driver.phone,
            driver_photo: driver.avatar_url
          };
        }
      } else if (vehicle.owner) {
        driverInfo = {
          driver_id: vehicle.owner.id,
          driver_name: `${vehicle.owner.first_name} ${vehicle.owner.last_name}`,
          driver_phone: vehicle.owner.phone,
          driver_photo: vehicle.owner.avatar_url
        };
      }
      
      // Créer la réservation
      const booking = await VehicleBooking.create({
        vehicle_id,
        renter_id: renterId,
        start_date,
        end_date,
        booking_type,
        base_amount: baseAmount,
        platform_commission: vehicle.commission_percentage,
        commission_amount: commissionAmount,
        net_amount: netAmount,
        deposit_amount: depositAmount,
        total_amount: totalAmount,
        status: 'pending',
        pickup_address,
        pickup_lat,
        pickup_lng,
        ...driverInfo
      }, { transaction });
      
      // Bloquer la disponibilité
      await VehicleAvailability.update(
        { is_booked: true },
        {
          where: {
            vehicle_id,
            start_date: { [Op.lte]: end_date },
            end_date: { [Op.gte]: start_date }
          },
          transaction
        }
      );
      
      // ✅ Commit avant les notifications
      await transaction.commit();
      
      // Notifications (en dehors de la transaction)
      try {
        await notificationService.sendNotification(vehicle.owner_id, {
          title: 'Nouvelle réservation',
          message: `${driverInfo.driver_name || 'Un client'} a réservé votre ${vehicle.brand} ${vehicle.model}`,
          type: 'booking_pending',
          data: { booking_id: booking.id }
        });
      } catch (notifError) {
        console.error('Erreur envoi notification:', notifError.message);
        // Ne pas bloquer la création de la réservation
      }
      
      return { booking, vehicle, pricing: { baseAmount, commissionAmount, netAmount, depositAmount, totalAmount } };
      
    } catch (error) {
      // ✅ Vérifier si la transaction est encore active avant rollback
      if (transaction && transaction.finished !== 'commit' && transaction.finished !== 'rollback') {
        await transaction.rollback();
      }
      throw error;
    }
  }
  
  /**
   * Confirmer une réservation (par le propriétaire)
   */
  async confirmBooking(ownerId, bookingId) {
    const transaction = await sequelize.transaction();
    
    try {
      const booking = await VehicleBooking.findByPk(bookingId, {
        include: [{ model: Vehicle, as: 'vehicle' }]
      });
      
      if (!booking) {
        await transaction.rollback();
        throw new Error('Réservation non trouvée');
      }
      
      if (booking.vehicle.owner_id !== ownerId) {
        await transaction.rollback();
        throw new Error('Non autorisé');
      }
      
      if (booking.status !== 'pending') {
        await transaction.rollback();
        throw new Error(`Impossible de confirmer une réservation au statut ${booking.status}`);
      }
      
      await booking.update({
        status: 'confirmed',
        confirmed_at: new Date()
      }, { transaction });
      
      // ✅ Commit avant les notifications
      await transaction.commit();
      
      // Notifications (en dehors de la transaction)
      try {
        await notificationService.sendNotification(booking.renter_id, {
          title: 'Réservation confirmée',
          message: `Votre réservation pour ${booking.vehicle.brand} ${booking.vehicle.model} a été confirmée`,
          type: 'booking_confirmed',
          data: { booking_id: booking.id }
        });
      } catch (notifError) {
        console.error('Erreur envoi notification:', notifError.message);
      }
      
      return booking;
      
    } catch (error) {
      if (transaction && transaction.finished !== 'commit' && transaction.finished !== 'rollback') {
        await transaction.rollback();
      }
      throw error;
    }
  }
  
  // services/rental/vehicleRentalService.js

  /**
   * Démarrer la location (état des lieux départ)
   */
  async startBooking(ownerId, bookingId, startData) {
    const { start_odometer, start_photos } = startData;
    
    const transaction = await sequelize.transaction();
    
    try {
      const booking = await VehicleBooking.findByPk(bookingId, {
        include: [{ model: Vehicle, as: 'vehicle' }],
        transaction
      });
      
      if (!booking) {
        await transaction.rollback();
        throw new Error('Réservation non trouvée');
      }
      
      if (booking.vehicle.owner_id !== ownerId) {
        await transaction.rollback();
        throw new Error('Non autorisé');
      }
      
      if (booking.status !== 'confirmed') {
        await transaction.rollback();
        throw new Error(`Impossible de démarrer une location au statut ${booking.status}`);
      }
      
      await booking.update({
        status: 'ongoing',
        started_at: new Date(),
        start_odometer: parseInt(start_odometer),
        start_photos: start_photos || []
      }, { transaction });
      
      // ✅ Commit avant les notifications
      await transaction.commit();
      
      // Notifications (en dehors de la transaction)
      try {
        await notificationService.sendNotification(booking.renter_id, {
          title: 'Location démarrée',
          message: `Votre location de ${booking.vehicle.brand} ${booking.vehicle.model} a démarré`,
          type: 'booking_started',
          data: { booking_id: booking.id }
        });
      } catch (notifError) {
        console.error('Erreur envoi notification:', notifError.message);
        // Ne pas bloquer
      }
      
      return booking;
      
    } catch (error) {
      // ✅ Vérifier si la transaction est encore active avant rollback
      if (transaction && transaction.finished !== 'commit' && transaction.finished !== 'rollback') {
        await transaction.rollback();
      }
      throw error;
    }
  }
  
  /**
   * Terminer la location (état des lieux fin)
   */
  async completeBooking(ownerId, bookingId, endData) {
    const { end_odometer, end_photos, damage_report } = endData;
    
    const transaction = await sequelize.transaction();
    
    try {
      const booking = await VehicleBooking.findByPk(bookingId, {
        include: [{ model: Vehicle, as: 'vehicle' }],
        transaction
      });
      
      if (!booking) {
        await transaction.rollback();
        throw new Error('Réservation non trouvée');
      }
      
      if (booking.vehicle.owner_id !== ownerId) {
        await transaction.rollback();
        throw new Error('Non autorisé');
      }
      
      if (booking.status !== 'ongoing') {
        await transaction.rollback();
        throw new Error(`Impossible de terminer une location au statut ${booking.status}`);
      }
      
      // Calculer les kilomètres supplémentaires
      let totalKm = null;
      let extraKmCharges = 0;
      
      if (booking.start_odometer && end_odometer) {
        totalKm = parseInt(end_odometer) - booking.start_odometer;
        const maxKm = booking.booking_type === 'daily' ? 200 : 100;
        if (totalKm > maxKm) {
          const extraKm = totalKm - maxKm;
          extraKmCharges = extraKm * booking.extra_km_rate;
        }
      }
      
      // Calculer les frais de dégâts
      let damageCharges = 0;
      let damageReport = {};
      if (damage_report) {
        damageReport = typeof damage_report === 'string' ? JSON.parse(damage_report) : damage_report;
        damageCharges = damageReport.cost || 0;
      }
      
      const totalAdjustments = extraKmCharges + damageCharges;
      let depositRefundAmount = booking.deposit_amount - totalAdjustments;
      if (depositRefundAmount < 0) depositRefundAmount = 0;
      
      await booking.update({
        status: 'completed',
        completed_at: new Date(),
        end_odometer: parseInt(end_odometer),
        end_photos: end_photos || [],
        damage_report: damageReport,
        total_km: totalKm,
        extra_km_charges: extraKmCharges
      }, { transaction });
      
      // ✅ Commit avant les notifications
      await transaction.commit();
      
      // Notifications (en dehors de la transaction)
      try {
        await notificationService.sendNotification(booking.renter_id, {
          title: 'Location terminée',
          message: `Votre location s'est terminée. Caution remboursée: ${depositRefundAmount} FCFA`,
          type: 'booking_completed',
          data: { booking_id: booking.id }
        });
      } catch (notifError) {
        console.error('Erreur envoi notification:', notifError.message);
      }
      
      return { booking, depositRefundAmount, extraKmCharges, damageCharges };
      
    } catch (error) {
      // ✅ Vérifier si la transaction est encore active avant rollback
      if (transaction && transaction.finished !== 'commit' && transaction.finished !== 'rollback') {
        await transaction.rollback();
      }
      throw error;
    }
  }
  
  /**
   * Annuler une réservation
   */
  async cancelBooking(userId, bookingId, role, reason) {
    const transaction = await sequelize.transaction();
    
    try {
      const booking = await VehicleBooking.findByPk(bookingId, {
        include: [{ model: Vehicle, as: 'vehicle' }]
      });
      
      if (!booking) {
        await transaction.rollback();
        throw new Error('Réservation non trouvée');
      }
      
      if (role === 'owner' && booking.vehicle.owner_id !== userId) {
        await transaction.rollback();
        throw new Error('Non autorisé');
      }
      if (role === 'renter' && booking.renter_id !== userId) {
        await transaction.rollback();
        throw new Error('Non autorisé');
      }
      
      const hoursBeforeStart = (new Date(booking.start_date) - new Date()) / (1000 * 60 * 60);
      let penaltyAmount = 0;
      let newStatus = '';
      
      if (role === 'renter') {
        newStatus = 'cancelled_by_renter';
        if (hoursBeforeStart < 24) {
          penaltyAmount = booking.base_amount * 0.3;
        }
      } else {
        newStatus = 'cancelled_by_owner';
        if (hoursBeforeStart < 24) {
          penaltyAmount = booking.base_amount * 0.5;
        }
      }
      
      await booking.update({
        status: newStatus,
        cancelled_at: new Date(),
        cancelled_by: userId,
        cancellation_reason: reason
      }, { transaction });
      
      // Libérer la disponibilité
      await VehicleAvailability.update(
        { is_booked: false },
        {
          where: {
            vehicle_id: booking.vehicle_id,
            start_date: { [Op.lte]: booking.end_date },
            end_date: { [Op.gte]: booking.start_date }
          },
          transaction
        }
      );
      
      await transaction.commit();
      
      return { booking, penaltyAmount };
      
    } catch (error) {
      if (transaction && transaction.finished !== 'commit' && transaction.finished !== 'rollback') {
        await transaction.rollback();
      }
      throw error;
    }
  }
  
  /**
   * Obtenir les véhicules disponibles
   */
  async getAvailableVehicles(filters) {
    const { start_date, end_date, city_id, min_price, max_price, brand } = filters;
    
    let where = { is_approved: true, is_active: true, is_deleted: false };
    
    if (brand) where.brand = brand;
    if (min_price) where.base_daily_rate = { [Op.gte]: min_price };
    if (max_price) where.base_daily_rate = { ...where.base_daily_rate, [Op.lte]: max_price };
    
    const vehicles = await Vehicle.findAll({ where });
    
    // Filtrer par disponibilité
    const availableVehicles = [];
    for (const vehicle of vehicles) {
      const { available } = await this.checkAvailability(vehicle.id, start_date, end_date);
      if (available) {
        availableVehicles.push(vehicle);
      }
    }
    
    return availableVehicles;
  }
  
  /**
   * Obtenir les réservations d'un utilisateur
   */
  async getUserBookings(userId, role) {
    let where = {};
    
    if (role === 'renter') {
      where.renter_id = userId;
    } else if (role === 'owner') {
      where['$vehicle.owner_id$'] = userId;
    }
    
    const bookings = await VehicleBooking.findAll({
      where,
      include: [
        { model: Vehicle, as: 'vehicle' },
        { model: User, as: 'renter', attributes: ['id', 'first_name', 'last_name', 'avatar_url'] }
      ],
      order: [['created_at', 'DESC']]
    });
    
    return bookings;
  }
}

module.exports = new VehicleRentalService();