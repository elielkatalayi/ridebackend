const { Vehicle, VehicleBooking } = require('../../models');
const { Op } = require('sequelize');

class VehicleService {
  
  /**
   * Créer un nouveau véhicule
   */
  async createVehicle(ownerId, vehicleData) {
    const vehicle = await Vehicle.create({
      owner_id: ownerId,
      brand: vehicleData.brand,
      model: vehicleData.model,
      year: vehicleData.year,
      color: vehicleData.color,
      plate_number: vehicleData.plate_number,
      price_per_day: vehicleData.price_per_day,
      price_per_hour: vehicleData.price_per_hour,
      photos: vehicleData.photos || [],
      cover_photo: vehicleData.cover_photo || null,
      city: vehicleData.city,
      description: vehicleData.description || null,
      is_available: true,
      is_active: true
    });
    
    return vehicle;
  }
  
  /**
   * Récupérer tous les véhicules d'un propriétaire
   */
  async getOwnerVehicles(ownerId) {
    const vehicles = await Vehicle.findAll({
      where: {
        owner_id: ownerId
      },
      order: [['created_at', 'DESC']]
    });
    
    return vehicles;
  }
  
  /**
   * Récupérer un véhicule par son ID
   */
  async getVehicleById(vehicleId) {
    const vehicle = await Vehicle.findByPk(vehicleId);
    
    if (!vehicle) {
      throw new Error('Véhicule non trouvé');
    }
    
    return vehicle;
  }
  
  /**
   * Mettre à jour un véhicule
   */
  async updateVehicle(vehicleId, ownerId, updateData) {
    // Vérifier que le véhicule appartient au propriétaire
    const vehicle = await Vehicle.findOne({
      where: {
        id: vehicleId,
        owner_id: ownerId
      }
    });
    
    if (!vehicle) {
      throw new Error('Véhicule non trouvé ou non autorisé');
    }
    
    // Champs autorisés à la mise à jour
    const allowedUpdates = [
      'brand', 'model', 'year', 'color', 'plate_number',
      'price_per_day', 'price_per_hour', 'photos', 'cover_photo',
      'city', 'description', 'is_active'
    ];
    
    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        vehicle[field] = updateData[field];
      }
    });
    
    await vehicle.save();
    
    return vehicle;
  }
  
  /**
   * Supprimer un véhicule (soft delete)
   */
  async deleteVehicle(vehicleId, ownerId) {
    const vehicle = await Vehicle.findOne({
      where: {
        id: vehicleId,
        owner_id: ownerId
      }
    });
    
    if (!vehicle) {
      throw new Error('Véhicule non trouvé ou non autorisé');
    }
    
    // Vérifier s'il y a des réservations en cours
    const activeBookings = await VehicleBooking.findOne({
      where: {
        vehicle_id: vehicleId,
        status: {
          [Op.in]: ['pending', 'accepted', 'ongoing']
        }
      }
    });
    
    if (activeBookings) {
      throw new Error('Impossible de supprimer un véhicule avec des réservations en cours');
    }
    
    await vehicle.destroy();
    
    return true;
  }
  
  /**
   * Marquer un véhicule comme disponible
   */
  async markAsAvailable(vehicleId, ownerId) {
    const vehicle = await Vehicle.findOne({
      where: {
        id: vehicleId,
        owner_id: ownerId
      }
    });
    
    if (!vehicle) {
      throw new Error('Véhicule non trouvé ou non autorisé');
    }
    
    vehicle.is_available = true;
    await vehicle.save();
    
    return vehicle;
  }
  
  /**
   * Marquer un véhicule comme indisponible
   */
  async markAsUnavailable(vehicleId, ownerId) {
    const vehicle = await Vehicle.findOne({
      where: {
        id: vehicleId,
        owner_id: ownerId
      }
    });
    
    if (!vehicle) {
      throw new Error('Véhicule non trouvé ou non autorisé');
    }
    
    vehicle.is_available = false;
    await vehicle.save();
    
    return vehicle;
  }
  
  /**
   * Terminer une location et libérer le véhicule
   */
  async completeRentalAndFreeVehicle(vehicleId, bookingId, ownerId) {
    const vehicle = await Vehicle.findOne({
      where: {
        id: vehicleId,
        owner_id: ownerId
      }
    });
    
    if (!vehicle) {
      throw new Error('Véhicule non trouvé ou non autorisé');
    }
    
    const booking = await VehicleBooking.findOne({
      where: {
        id: bookingId,
        vehicle_id: vehicleId,
        owner_id: ownerId
      }
    });
    
    if (!booking) {
      throw new Error('Réservation non trouvée');
    }
    
    if (booking.status !== 'accepted') {
      throw new Error('Cette réservation n\'est pas en cours');
    }
    
    // Marquer la réservation comme terminée
    booking.status = 'completed';
    booking.completed_at = new Date();
    await booking.save();
    
    // Libérer le véhicule
    vehicle.is_available = true;
    await vehicle.save();
    
    // Incrémenter le compteur de réservations
    vehicle.total_bookings = (vehicle.total_bookings || 0) + 1;
    await vehicle.save();
    
    return { vehicle, booking };
  }
  
  /**
   * Obtenir tous les véhicules disponibles (pour le public)
   */
  async getAvailableVehicles(filters = {}) {
    const where = {
      is_available: true,
      is_active: true
    };
    
    if (filters.brand) {
      where.brand = { [Op.iLike]: `%${filters.brand}%` };
    }
    
    if (filters.city) {
      where.city = { [Op.iLike]: `%${filters.city}%` };
    }
    
    if (filters.min_price) {
      where.price_per_day = { [Op.gte]: parseInt(filters.min_price) };
    }
    
    if (filters.max_price) {
      where.price_per_day = { ...where.price_per_day, [Op.lte]: parseInt(filters.max_price) };
    }
    
    const vehicles = await Vehicle.findAll({
      where,
      order: [['created_at', 'DESC']]
    });
    
    return vehicles;
  }
}

module.exports = new VehicleService();