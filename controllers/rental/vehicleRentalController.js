// controllers/rental/vehicleRentalController.js
const vehicleRentalService = require('../../services/rental/vehicleRentalService');
const { uploadToSupabase } = require('../../utils/storage');
const fs = require('fs');

class VehicleRentalController {
  
  constructor() {
    // Lier les méthodes au contexte
    this.uploadFile = this.uploadFile.bind(this);
    this.registerVehicle = this.registerVehicle.bind(this);
    this.getMyVehicles = this.getMyVehicles.bind(this);
    this.getAvailableVehicles = this.getAvailableVehicles.bind(this);
    this.checkAvailability = this.checkAvailability.bind(this);
    this.updateAvailability = this.updateAvailability.bind(this);
    this.createBooking = this.createBooking.bind(this);
    this.confirmBooking = this.confirmBooking.bind(this);
    this.startBooking = this.startBooking.bind(this);
    this.completeBooking = this.completeBooking.bind(this);
    this.cancelBooking = this.cancelBooking.bind(this);
    this.getMyBookings = this.getMyBookings.bind(this);
    this.getBooking = this.getBooking.bind(this);
    this.addReview = this.addReview.bind(this);
    this.getVehicle = this.getVehicle.bind(this);
    this.updateVehicle = this.updateVehicle.bind(this);
    this.deleteVehicle = this.deleteVehicle.bind(this);
    this.getAvailability = this.getAvailability.bind(this);
  }

  /**
   * Upload d'un fichier vers Supabase
   */
  async uploadFile(file, folder, userId, vehicleId = null) {
    if (!file) return null;
    
    let path = `users/${userId}/vehicles`;
    if (vehicleId) {
      path = `${path}/${vehicleId}/${folder}`;
    } else {
      path = `${path}/temp/${folder}`;
    }
    
    try {
      let fileBuffer;
      
      if (file.buffer) {
        fileBuffer = file.buffer;
      } else if (file.path) {
        fileBuffer = fs.readFileSync(file.path);
      } else {
        throw new Error('Format de fichier non supporté');
      }
      
      const result = await uploadToSupabase(
        'vehicle-rental',
        path,
        fileBuffer,
        file.mimetype,
        file.originalname
      );
      
      console.log(`✅ Fichier uploadé: ${result.url}`);
      return result.url;
      
    } catch (error) {
      console.error('❌ Erreur upload:', error.message);
      return null;
    }
  }

  /**
   * Enregistrer un véhicule avec upload des photos
   */
  async registerVehicle(req, res, next) {
    try {
      const files = req.files || {};
      const userId = req.user.id;
      
      console.log('📝 Début enregistrement véhicule...');
      console.log('Fichiers reçus:', Object.keys(files));
      
      // 1. Upload des photos vers Supabase
      let coverPhotoUrl = null;
      let registrationPhotoUrl = null;
      let insurancePhotoUrl = null;
      let technicalControlUrl = null;
      
      if (files.cover_photo && files.cover_photo[0]) {
        console.log('📸 Upload cover photo...');
        coverPhotoUrl = await this.uploadFile(files.cover_photo[0], 'cover', userId, null);
        console.log('Cover URL:', coverPhotoUrl);
      }
      
      if (files.registration_photo && files.registration_photo[0]) {
        console.log('📸 Upload registration photo...');
        registrationPhotoUrl = await this.uploadFile(files.registration_photo[0], 'documents', userId, null);
      }
      
      if (files.insurance_photo && files.insurance_photo[0]) {
        console.log('📸 Upload insurance photo...');
        insurancePhotoUrl = await this.uploadFile(files.insurance_photo[0], 'documents', userId, null);
      }
      
      if (files.technical_control_photo && files.technical_control_photo[0]) {
        console.log('📸 Upload technical control photo...');
        technicalControlUrl = await this.uploadFile(files.technical_control_photo[0], 'documents', userId, null);
      }
      
      // 2. Préparer les données du véhicule
      const vehicleData = {
        brand: req.body.brand,
        model: req.body.model,
        year: parseInt(req.body.year),
        color: req.body.color,
        plate_number: req.body.plate_number,
        vin_number: req.body.vin_number || null,
        seat_count: parseInt(req.body.seat_count) || 4,
        door_count: parseInt(req.body.door_count) || 4,
        transmission: req.body.transmission,
        fuel_type: req.body.fuel_type,
        air_conditioning: req.body.air_conditioning === 'true' || req.body.air_conditioning === true,
        photos: req.body.photos ? (Array.isArray(req.body.photos) ? req.body.photos : JSON.parse(req.body.photos)) : [],
        base_daily_rate: parseInt(req.body.base_daily_rate),
        base_hourly_rate: parseInt(req.body.base_hourly_rate),
        commission_percentage: parseInt(req.body.commission_percentage) || 20,
        description: req.body.description || null,
        features: req.body.features ? (Array.isArray(req.body.features) ? req.body.features : JSON.parse(req.body.features)) : []
      };
      
      console.log('📦 Données véhicule:', { brand: vehicleData.brand, model: vehicleData.model, plate: vehicleData.plate_number });
      
      // 3. Créer le véhicule via le service
      let vehicle = await vehicleRentalService.registerVehicle(userId, vehicleData, {
        cover_photo_url: coverPhotoUrl,
        registration_photo_url: registrationPhotoUrl,
        insurance_photo_url: insurancePhotoUrl,
        technical_control_url: technicalControlUrl
      });
      
      console.log(`✅ Véhicule créé avec ID: ${vehicle.id}`);
      
      // 4. Re-upload des photos avec l'ID du véhicule (pour organiser correctement)
      if (files.cover_photo && files.cover_photo[0] && coverPhotoUrl) {
        console.log('📸 Re-upload cover photo avec ID véhicule...');
        const finalCoverUrl = await this.uploadFile(files.cover_photo[0], 'cover', userId, vehicle.id);
        if (finalCoverUrl) {
          await vehicle.update({ cover_photo: finalCoverUrl });
          vehicle.cover_photo = finalCoverUrl;
        }
      }
      
      if (files.registration_photo && files.registration_photo[0] && registrationPhotoUrl) {
        const finalRegUrl = await this.uploadFile(files.registration_photo[0], 'documents', userId, vehicle.id);
        if (finalRegUrl) {
          await vehicle.update({ registration_photo: finalRegUrl });
          vehicle.registration_photo = finalRegUrl;
        }
      }
      
      if (files.insurance_photo && files.insurance_photo[0] && insurancePhotoUrl) {
        const finalInsUrl = await this.uploadFile(files.insurance_photo[0], 'documents', userId, vehicle.id);
        if (finalInsUrl) {
          await vehicle.update({ insurance_photo: finalInsUrl });
          vehicle.insurance_photo = finalInsUrl;
        }
      }
      
      if (files.technical_control_photo && files.technical_control_photo[0] && technicalControlUrl) {
        const finalTechUrl = await this.uploadFile(files.technical_control_photo[0], 'documents', userId, vehicle.id);
        if (finalTechUrl) {
          await vehicle.update({ technical_control_photo: finalTechUrl });
          vehicle.technical_control_photo = finalTechUrl;
        }
      }
      
      res.status(201).json({
        success: true,
        vehicle: {
          id: vehicle.id,
          brand: vehicle.brand,
          model: vehicle.model,
          plate_number: vehicle.plate_number,
          cover_photo: vehicle.cover_photo,
          base_daily_rate: vehicle.base_daily_rate,
          base_hourly_rate: vehicle.base_hourly_rate,
          registration_photo: vehicle.registration_photo,
          insurance_photo: vehicle.insurance_photo,
          technical_control_photo: vehicle.technical_control_photo
        },
        message: 'Véhicule enregistré avec succès'
      });
      
    } catch (error) {
      console.error('❌ Erreur registerVehicle:', error.message);
      next(error);
    }
  }
  
  /**
   * Obtenir mes véhicules
   */
  async getMyVehicles(req, res, next) {
    try {
      const { Vehicle } = require('../../models');
      const vehicles = await Vehicle.findAll({
        where: { owner_id: req.user.id, is_deleted: false },
        order: [['created_at', 'DESC']]
      });
      
      res.json({ success: true, vehicles });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Obtenir les véhicules disponibles
   */
  async getAvailableVehicles(req, res, next) {
    try {
      const { start_date, end_date, brand, min_price, max_price } = req.query;
      
      if (!start_date || !end_date) {
        return res.status(400).json({ error: 'Dates de location requises' });
      }
      
      const vehicles = await vehicleRentalService.getAvailableVehicles({
        start_date,
        end_date,
        brand,
        min_price: min_price ? parseInt(min_price) : null,
        max_price: max_price ? parseInt(max_price) : null
      });
      
      res.json({ success: true, count: vehicles.length, vehicles });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Vérifier la disponibilité
   */
  async checkAvailability(req, res, next) {
    try {
      const { vehicleId } = req.params;
      const { start_date, end_date } = req.body;
      
      const result = await vehicleRentalService.checkAvailability(vehicleId, start_date, end_date);
      
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Mettre à jour la disponibilité
   */
  async updateAvailability(req, res, next) {
    try {
      const { vehicleId } = req.params;
      const availabilityData = req.body;
      
      const result = await vehicleRentalService.updateAvailability(req.user.id, vehicleId, availabilityData);
      
      res.json({ success: true, availability: result });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Créer une réservation
   */
  async createBooking(req, res, next) {
    try {
      const bookingData = {
        ...req.body,
        renter_id: req.user.id
      };
      
      const result = await vehicleRentalService.createBooking(req.user.id, bookingData);
      
      res.status(201).json({
        success: true,
        booking: result.booking,
        pricing: result.pricing,
        message: 'Réservation créée avec succès'
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Confirmer une réservation
   */
  async confirmBooking(req, res, next) {
    try {
      const { bookingId } = req.params;
      
      const booking = await vehicleRentalService.confirmBooking(req.user.id, bookingId);
      
      res.json({
        success: true,
        booking,
        message: 'Réservation confirmée'
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Démarrer la location avec upload des photos
   */
  async startBooking(req, res, next) {
    try {
      const { bookingId } = req.params;
      const { start_odometer } = req.body;
      const files = req.files || [];
      const userId = req.user.id;
      
      // Upload des photos de début
      const startPhotos = [];
      for (const file of files) {
        try {
          let fileBuffer;
          
          if (file.buffer) {
            fileBuffer = file.buffer;
          } else if (file.path) {
            fileBuffer = fs.readFileSync(file.path);
          } else {
            continue;
          }
          
          const path = `users/${userId}/bookings/${bookingId}/start`;
          const result = await uploadToSupabase(
            'vehicle-rental',
            path,
            fileBuffer,
            file.mimetype,
            file.originalname
          );
          startPhotos.push(result.url);
        } catch (error) {
          console.error('Erreur upload start photo:', error.message);
        }
      }
      
      const booking = await vehicleRentalService.startBooking(req.user.id, bookingId, {
        start_odometer: parseInt(start_odometer),
        start_photos: startPhotos
      });
      
      res.json({
        success: true,
        booking,
        message: 'Location démarrée'
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Terminer la location avec upload des photos
   */
  async completeBooking(req, res, next) {
    try {
      const { bookingId } = req.params;
      const { end_odometer, damage_report } = req.body;
      const files = req.files || [];
      const userId = req.user.id;
      
      // Upload des photos de fin
      const endPhotos = [];
      for (const file of files) {
        try {
          let fileBuffer;
          
          if (file.buffer) {
            fileBuffer = file.buffer;
          } else if (file.path) {
            fileBuffer = fs.readFileSync(file.path);
          } else {
            continue;
          }
          
          const path = `users/${userId}/bookings/${bookingId}/end`;
          const result = await uploadToSupabase(
            'vehicle-rental',
            path,
            fileBuffer,
            file.mimetype,
            file.originalname
          );
          endPhotos.push(result.url);
        } catch (error) {
          console.error('Erreur upload end photo:', error.message);
        }
      }
      
      const result = await vehicleRentalService.completeBooking(req.user.id, bookingId, {
        end_odometer: parseInt(end_odometer),
        end_photos: endPhotos,
        damage_report: damage_report ? (typeof damage_report === 'string' ? JSON.parse(damage_report) : damage_report) : {}
      });
      
      res.json({
        success: true,
        booking: result.booking,
        deposit_refund: result.depositRefundAmount,
        extra_charges: result.extraKmCharges + result.damageCharges,
        message: 'Location terminée'
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Annuler une réservation
   */
  async cancelBooking(req, res, next) {
    try {
      const { bookingId } = req.params;
      const { reason, role } = req.body;
      
      const result = await vehicleRentalService.cancelBooking(req.user.id, bookingId, role, reason);
      
      res.json({
        success: true,
        booking: result.booking,
        penalty: result.penaltyAmount,
        message: 'Réservation annulée'
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Obtenir mes réservations
   */
  async getMyBookings(req, res, next) {
    try {
      const { role = 'renter' } = req.query;
      
      const bookings = await vehicleRentalService.getUserBookings(req.user.id, role);
      
      res.json({ success: true, bookings });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Obtenir une réservation
   */
  async getBooking(req, res, next) {
    try {
      const { bookingId } = req.params;
      const { VehicleBooking, Vehicle, User } = require('../../models');
      
      const booking = await VehicleBooking.findByPk(bookingId, {
        include: [
          { model: Vehicle, as: 'vehicle' },
          { model: User, as: 'renter', attributes: ['id', 'first_name', 'last_name', 'avatar_url', 'phone'] }
        ]
      });
      
      if (!booking) {
        return res.status(404).json({ error: 'Réservation non trouvée' });
      }
      
      res.json({ success: true, booking });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Ajouter une évaluation
   */
  async addReview(req, res, next) {
    try {
      const { bookingId } = req.params;
      const { rating, comment, categories, target_user_id } = req.body;
      const { BookingReview } = require('../../models');
      
      const review = await BookingReview.create({
        booking_id: bookingId,
        reviewer_id: req.user.id,
        target_user_id: target_user_id,
        rating: parseInt(rating),
        comment,
        categories: categories || {}
      });
      
      res.json({ success: true, review, message: 'Évaluation ajoutée' });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Obtenir un véhicule
   */
  async getVehicle(req, res, next) {
    try {
      const { vehicleId } = req.params;
      const { Vehicle, User } = require('../../models');
      
      const vehicle = await Vehicle.findByPk(vehicleId, {
        include: [{ model: User, as: 'owner', attributes: ['id', 'first_name', 'last_name', 'avatar_url', 'rating'] }]
      });
      
      if (!vehicle) {
        return res.status(404).json({ error: 'Véhicule non trouvé' });
      }
      
      res.json({ success: true, vehicle });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Modifier un véhicule
   */
  async updateVehicle(req, res, next) {
    try {
      const { vehicleId } = req.params;
      const { Vehicle } = require('../../models');
      
      const vehicle = await Vehicle.findOne({
        where: { id: vehicleId, owner_id: req.user.id }
      });
      
      if (!vehicle) {
        return res.status(404).json({ error: 'Véhicule non trouvé' });
      }
      
      await vehicle.update(req.body);
      
      res.json({ success: true, vehicle, message: 'Véhicule modifié' });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Supprimer un véhicule
   */
  async deleteVehicle(req, res, next) {
    try {
      const { vehicleId } = req.params;
      const { Vehicle } = require('../../models');
      
      const vehicle = await Vehicle.findOne({
        where: { id: vehicleId, owner_id: req.user.id }
      });
      
      if (!vehicle) {
        return res.status(404).json({ error: 'Véhicule non trouvé' });
      }
      
      await vehicle.update({ is_deleted: true, is_active: false });
      
      res.json({ success: true, message: 'Véhicule supprimé' });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Obtenir la disponibilité d'un véhicule
   */
  async getAvailability(req, res, next) {
    try {
      const { vehicleId } = req.params;
      const { VehicleAvailability } = require('../../models');
      
      const availability = await VehicleAvailability.findAll({
        where: { vehicle_id: vehicleId },
        order: [['start_date', 'ASC']]
      });
      
      res.json({ success: true, availability });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new VehicleRentalController();