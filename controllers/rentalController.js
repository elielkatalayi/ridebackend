const vehicleRentalService = require('../services/rental/vehicleRentalService');
const heavyEquipmentService = require('../services/rental/heavyEquipmentService');

class RentalController {
  /**
   * Créer une location de véhicule
   * POST /api/v1/rentals/vehicle
   */
  async createVehicleRental(req, res, next) {
    try {
      const rentalData = {
        ...req.body,
        user_id: req.user.id
      };
      
      const result = await vehicleRentalService.createRental(rentalData);
      
      res.status(201).json({
        success: true,
        rental: result.rental,
        pricing: result.pricing,
        message: 'Demande de location créée avec succès'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Créer une location d'engin TP
   * POST /api/v1/rentals/heavy-equipment
   */
  async createHeavyEquipmentRental(req, res, next) {
    try {
      const rentalData = {
        ...req.body,
        user_id: req.user.id
      };
      
      const result = await heavyEquipmentService.createRental(rentalData);
      
      res.status(201).json({
        success: true,
        rental: result.rental,
        pricing: result.pricing,
        message: 'Demande de location d\'engin créée avec succès'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les locations de l'utilisateur
   * GET /api/v1/rentals/my-rentals
   */
  async getMyRentals(req, res, next) {
    try {
      const { type = 'all' } = req.query;
      
      let vehicleRentals = [];
      let heavyRentals = [];
      
      if (type === 'all' || type === 'vehicle') {
        vehicleRentals = await vehicleRentalService.getUserRentals(req.user.id);
      }
      
      if (type === 'all' || type === 'heavy') {
        heavyRentals = await heavyEquipmentService.getUserRentals(req.user.id);
      }
      
      res.json({
        vehicle_rentals: vehicleRentals,
        heavy_equipment_rentals: heavyRentals
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les véhicules disponibles
   * GET /api/v1/rentals/available-vehicles
   */
  async getAvailableVehicles(req, res, next) {
    try {
      const { city_id } = req.query;
      
      if (!city_id) {
        return res.status(400).json({ error: 'ID ville requis' });
      }
      
      const vehicles = await vehicleRentalService.getAvailableVehicles(city_id);
      
      res.json(vehicles);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les engins disponibles
   * GET /api/v1/rentals/available-equipment
   */
  async getAvailableEquipment(req, res, next) {
    try {
      const { city_id } = req.query;
      
      const equipment = await heavyEquipmentService.getAvailableEquipment(city_id);
      
      res.json(equipment);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Confirmer une location (admin)
   * PUT /api/v1/rentals/:rentalId/confirm
   */
  async confirmRental(req, res, next) {
    try {
      const { rentalId } = req.params;
      const { type } = req.query;
      
      let result;
      if (type === 'vehicle') {
        result = await vehicleRentalService.confirmRental(rentalId);
      } else {
        result = await heavyEquipmentService.confirmRental(rentalId);
      }
      
      res.json({
        success: true,
        rental: result,
        message: 'Location confirmée'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Démarrer une location
   * PUT /api/v1/rentals/:rentalId/start
   */
  async startRental(req, res, next) {
    try {
      const { rentalId } = req.params;
      const { type, driver_id } = req.body;
      
      let result;
      if (type === 'vehicle') {
        result = await vehicleRentalService.startRental(rentalId, driver_id);
      } else {
        result = await heavyEquipmentService.startRental(rentalId);
      }
      
      res.json({
        success: true,
        rental: result,
        message: 'Location démarrée'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Terminer une location
   * PUT /api/v1/rentals/:rentalId/complete
   */
  async completeRental(req, res, next) {
    try {
      const { rentalId } = req.params;
      const { type, km_driven } = req.body;
      
      let result;
      if (type === 'vehicle') {
        result = await vehicleRentalService.completeRental(rentalId, km_driven);
      } else {
        result = await heavyEquipmentService.completeRental(rentalId);
      }
      
      res.json({
        success: true,
        rental: result,
        message: 'Location terminée'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Rembourser la caution
   * POST /api/v1/rentals/:rentalId/refund-deposit
   */
  async refundDeposit(req, res, next) {
    try {
      const { rentalId } = req.params;
      
      const result = await vehicleRentalService.refundDeposit(rentalId);
      
      res.json({
        success: true,
        rental: result,
        message: 'Caution remboursée'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RentalController();