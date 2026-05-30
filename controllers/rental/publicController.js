const { Vehicle, User } = require('../../models');
const { Op } = require('sequelize');
const availabilityService = require('../../services/rental/availabilityService');

class PublicController {
  
  /**
   * Liste des véhicules disponibles
   * GET /api/rental/public/available-vehicles
   */
  async getAvailableVehicles(req, res, next) {
    try {
      const { 
        start_date, 
        end_date, 
        min_price, 
        max_price, 
        brand, 
        city 
      } = req.query;
      
      // Construire les filtres de base
      const where = {
        is_available: true,
        is_active: true
      };
      
      if (brand) where.brand = { [Op.iLike]: `%${brand}%` };
      if (city) where.city = { [Op.iLike]: `%${city}%` };
      if (min_price) where.price_per_day = { [Op.gte]: parseInt(min_price) };
      if (max_price) where.price_per_day = { ...where.price_per_day, [Op.lte]: parseInt(max_price) };
      
      // Récupérer tous les véhicules actifs
      let vehicles = await Vehicle.findAll({
        where,
        include: [{
          model: User,
          as: 'owner',
          attributes: ['id', 'first_name', 'last_name', 'avatar_url', 'rating']
        }],
        order: [['created_at', 'DESC']]
      });
      
      // Si des dates sont fournies, filtrer par disponibilité
      if (start_date && end_date) {
        const availableVehicles = [];
        
        for (const vehicle of vehicles) {
          const { available } = await availabilityService.checkAvailability(
            vehicle.id,
            start_date,
            end_date
          );
          
          if (available) {
            availableVehicles.push(vehicle);
          }
        }
        
        vehicles = availableVehicles;
      }
      
      res.json({
        success: true,
        count: vehicles.length,
        vehicles
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Détails d'un véhicule
   * GET /api/rental/public/vehicles/:vehicleId
   */
  async getVehicleDetails(req, res, next) {
    try {
      const { vehicleId } = req.params;
      
      const vehicle = await Vehicle.findByPk(vehicleId, {
        include: [{
          model: User,
          as: 'owner',
          attributes: ['id', 'first_name', 'last_name', 'avatar_url', 'rating', 'phone']
        }]
      });
      
      if (!vehicle) {
        return res.status(404).json({ success: false, message: 'Véhicule non trouvé' });
      }
      
      res.json({
        success: true,
        vehicle
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PublicController();