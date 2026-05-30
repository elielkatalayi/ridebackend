const vehicleService = require('../../services/rental/vehicleService');
const { Vehicle } = require('../../models');
const { uploadToSupabase, deleteFromSupabase } = require('../../utils/storage');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

class VehicleController {
  
  constructor() {
    // Lier toutes les méthodes pour conserver le contexte 'this'
    this.uploadFile = this.uploadFile.bind(this);
    this.addVehicle = this.addVehicle.bind(this);
    this.addVehiclePhotos = this.addVehiclePhotos.bind(this);
    this.deleteVehiclePhoto = this.deleteVehiclePhoto.bind(this);
    this.getMyVehicles = this.getMyVehicles.bind(this);
    this.updateVehicle = this.updateVehicle.bind(this);
    this.deleteVehicle = this.deleteVehicle.bind(this);
    this.completeBookingAndFreeVehicle = this.completeBookingAndFreeVehicle.bind(this);
    this.getVehicleDetails = this.getVehicleDetails.bind(this);
  }
  
  /**
   * Upload de fichiers vers Supabase
   */
  async uploadFile(file, folder, userId, vehicleId = null) {
    if (!file) return null;
    
    try {
      let fileBuffer;
      
      if (file.buffer) {
        fileBuffer = file.buffer;
      } else if (file.path) {
        fileBuffer = fs.readFileSync(file.path);
      } else {
        throw new Error('Format de fichier non supporté');
      }
      
      // Générer un nom unique
      const fileExt = file.originalname.split('.').pop();
      const fileName = `vehicle_${Date.now()}_${uuidv4()}.${fileExt}`;
      
      // Chemin dans Supabase
      let path = `users/${userId}/vehicles`;
      if (vehicleId) {
        path = `${path}/${vehicleId}/${folder}`;
      } else {
        path = `${path}/temp/${folder}`;
      }
      
      console.log(`📤 Upload: ${fileName} (${fileBuffer.length} bytes)`);
      
      const result = await uploadToSupabase(
        'vehicle-rental',
        `${path}/${fileName}`,
        fileBuffer,
        file.mimetype,
        fileName
      );
      
      console.log(`✅ Fichier uploadé: ${result.url}`);
      return result.url;
      
    } catch (error) {
      console.error('❌ Erreur upload:', error.message);
      return null;
    }
  }
  
  /**
   * Ajouter un véhicule AVEC UPLOAD DE PHOTOS
   * POST /api/rental/vehicles
   */
  async addVehicle(req, res, next) {
    try {
      const userId = req.user.id;
      const vehicleData = req.body;
      const files = req.files || {};
      
      console.log('📝 Début enregistrement véhicule...');
      console.log('Fichiers reçus:', Object.keys(files));
      console.log('Données véhicule:', vehicleData);
      
      // 1. Upload des photos
      let coverPhotoUrl = null;
      let photosUrls = [];
      
      // Upload de la photo de couverture
      if (files.cover_photo && files.cover_photo[0]) {
        console.log('📸 Upload cover photo...');
        coverPhotoUrl = await this.uploadFile(files.cover_photo[0], 'cover', userId, null);
      }
      
      // Upload des photos multiples
      if (files.photos && files.photos.length > 0) {
        console.log(`📸 Upload de ${files.photos.length} photos...`);
        for (const photo of files.photos) {
          const photoUrl = await this.uploadFile(photo, 'photos', userId, null);
          if (photoUrl) {
            photosUrls.push(photoUrl);
          }
        }
      }
      
      // 2. Créer le véhicule
      const vehicle = await vehicleService.createVehicle(userId, {
        brand: vehicleData.brand,
        model: vehicleData.model,
        year: parseInt(vehicleData.year),
        color: vehicleData.color,
        plate_number: vehicleData.plate_number,
        price_per_day: parseInt(vehicleData.price_per_day),
        price_per_hour: parseInt(vehicleData.price_per_hour),
        city: vehicleData.city,
        description: vehicleData.description || null,
        cover_photo: coverPhotoUrl,
        photos: photosUrls
      });
      
      // 3. Re-upload des photos avec l'ID du véhicule
      if (coverPhotoUrl && files.cover_photo && files.cover_photo[0]) {
        const finalCoverUrl = await this.uploadFile(files.cover_photo[0], 'cover', userId, vehicle.id);
        if (finalCoverUrl) {
          await vehicle.update({ cover_photo: finalCoverUrl });
          vehicle.cover_photo = finalCoverUrl;
        }
      }
      
      if (photosUrls.length > 0 && files.photos) {
        const finalPhotosUrls = [];
        for (let i = 0; i < files.photos.length; i++) {
          const finalPhotoUrl = await this.uploadFile(files.photos[i], 'photos', userId, vehicle.id);
          if (finalPhotoUrl) {
            finalPhotosUrls.push(finalPhotoUrl);
          }
        }
        if (finalPhotosUrls.length > 0) {
          await vehicle.update({ photos: finalPhotosUrls });
          vehicle.photos = finalPhotosUrls;
        }
      }
      
      console.log(`✅ Véhicule créé avec ID: ${vehicle.id}`);
      
      res.status(201).json({
        success: true,
        message: 'Véhicule ajouté avec succès',
        vehicle
      });
      
    } catch (error) {
      console.error('❌ Erreur addVehicle:', error.message);
      console.error('Stack:', error.stack);
      next(error);
    }
  }
  
  /**
   * Ajouter des photos à un véhicule existant
   */
  async addVehiclePhotos(req, res, next) {
    try {
      const { vehicleId } = req.params;
      const userId = req.user.id;
      const files = req.files || {};
      
      const vehicle = await Vehicle.findOne({
        where: { id: vehicleId, owner_id: userId }
      });
      
      if (!vehicle) {
        return res.status(404).json({
          success: false,
          message: 'Véhicule non trouvé ou non autorisé'
        });
      }
      
      const uploadedPhotos = [];
      let newCoverPhoto = null;
      
      if (files.cover_photo && files.cover_photo[0]) {
        newCoverPhoto = await this.uploadFile(files.cover_photo[0], 'cover', userId, vehicleId);
        if (newCoverPhoto) {
          await vehicle.update({ cover_photo: newCoverPhoto });
        }
      }
      
      if (files.photos && files.photos.length > 0) {
        for (const photo of files.photos) {
          const photoUrl = await this.uploadFile(photo, 'photos', userId, vehicleId);
          if (photoUrl) {
            uploadedPhotos.push(photoUrl);
          }
        }
        
        if (uploadedPhotos.length > 0) {
          const currentPhotos = vehicle.photos || [];
          const allPhotos = [...currentPhotos, ...uploadedPhotos];
          await vehicle.update({ photos: allPhotos });
        }
      }
      
      res.json({
        success: true,
        message: 'Photos ajoutées avec succès',
        vehicle: {
          id: vehicle.id,
          cover_photo: vehicle.cover_photo,
          photos: vehicle.photos,
          new_photos_added: uploadedPhotos.length
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur addVehiclePhotos:', error.message);
      next(error);
    }
  }
  
  /**
   * Supprimer une photo d'un véhicule
   */
  async deleteVehiclePhoto(req, res, next) {
    try {
      const { vehicleId, photoIndex } = req.params;
      const userId = req.user.id;
      
      const vehicle = await Vehicle.findOne({
        where: { id: vehicleId, owner_id: userId }
      });
      
      if (!vehicle) {
        return res.status(404).json({
          success: false,
          message: 'Véhicule non trouvé ou non autorisé'
        });
      }
      
      const currentPhotos = vehicle.photos || [];
      const index = parseInt(photoIndex);
      
      if (index < 0 || index >= currentPhotos.length) {
        return res.status(400).json({
          success: false,
          message: 'Index de photo invalide'
        });
      }
      
      currentPhotos.splice(index, 1);
      await vehicle.update({ photos: currentPhotos });
      
      res.json({
        success: true,
        message: 'Photo supprimée avec succès',
        photos: currentPhotos
      });
      
    } catch (error) {
      console.error('❌ Erreur deleteVehiclePhoto:', error.message);
      next(error);
    }
  }
  
  /**
   * Récupérer tous mes véhicules
   */
  async getMyVehicles(req, res, next) {
    try {
      const userId = req.user.id;
      
      const vehicles = await Vehicle.findAll({
        where: { owner_id: userId },
        order: [['created_at', 'DESC']]
      });
      
      res.json({
        success: true,
        vehicles
      });
    } catch (error) {
      console.error('Erreur getMyVehicles:', error.message);
      next(error);
    }
  }
  
  /**
   * Modifier un véhicule
   */
  async updateVehicle(req, res, next) {
    try {
      const { vehicleId } = req.params;
      const userId = req.user.id;
      const updateData = req.body;
      
      const vehicle = await vehicleService.updateVehicle(vehicleId, userId, updateData);
      
      res.json({
        success: true,
        message: 'Véhicule modifié avec succès',
        vehicle
      });
    } catch (error) {
      console.error('Erreur updateVehicle:', error.message);
      next(error);
    }
  }
  
  /**
   * Supprimer un véhicule
   */
  async deleteVehicle(req, res, next) {
    try {
      const { vehicleId } = req.params;
      const userId = req.user.id;
      
      await vehicleService.deleteVehicle(vehicleId, userId);
      
      res.json({
        success: true,
        message: 'Véhicule supprimé avec succès'
      });
    } catch (error) {
      console.error('Erreur deleteVehicle:', error.message);
      next(error);
    }
  }
  
  /**
   * Marquer une location comme terminée
   */
  async completeBookingAndFreeVehicle(req, res, next) {
    try {
      const { vehicleId, bookingId } = req.params;
      const userId = req.user.id;
      
      const result = await vehicleService.completeRentalAndFreeVehicle(vehicleId, bookingId, userId);
      
      res.json({
        success: true,
        message: 'Location terminée, véhicule disponible',
        vehicle: result.vehicle
      });
    } catch (error) {
      console.error('Erreur completeBookingAndFreeVehicle:', error.message);
      next(error);
    }
  }
  
  /**
   * Obtenir les détails d'un véhicule
   */
  async getVehicleDetails(req, res, next) {
    try {
      const { vehicleId } = req.params;
      const userId = req.user.id;
      
      const vehicle = await Vehicle.findByPk(vehicleId);
      
      if (!vehicle) {
        return res.status(404).json({
          success: false,
          message: 'Véhicule non trouvé'
        });
      }
      
      if (vehicle.owner_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Non autorisé à voir ce véhicule'
        });
      }
      
      res.json({
        success: true,
        vehicle
      });
    } catch (error) {
      console.error('Erreur getVehicleDetails:', error.message);
      next(error);
    }
  }
}

module.exports = new VehicleController();