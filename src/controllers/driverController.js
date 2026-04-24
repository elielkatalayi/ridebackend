const driverService = require('../services/driver/driverService');
const pointsService = require('../services/driver/pointsService');
const sanctionService = require('../services/driver/sanctionService');
const { Driver, User } = require('../models');

class DriverController {
  /**
   * Devenir chauffeur (inscription)
   * POST /api/v1/drivers/register
   */
async registerDriver(req, res, next) {
  try {
    // Récupérer les fichiers uploadés par multer
    const files = req.files || {};
    
    // Construire l'objet driverData avec TOUTES les données
    const driverData = {
      user_id: req.user.id,
      // Données texte
      vehicle_brand: req.body.vehicle_brand,
      vehicle_model: req.body.vehicle_model,
      vehicle_color: req.body.vehicle_color,
      vehicle_plate: req.body.vehicle_plate,
      license_number: req.body.license_number,
      city_id: req.body.city_id,
      address: req.body.address,
      country_id: req.body.country_id,
      // Fichiers (multer)
      license_photo: files.license_photo ? files.license_photo[0] : null,
      vehicle_registration: files.vehicle_registration ? files.vehicle_registration[0] : null,
      insurance: files.insurance ? files.insurance[0] : null,
      id_photo: files.id_photo ? files.id_photo[0] : null,
      portrait_photo: files.portrait_photo ? files.portrait_photo[0] : null,
      vehicle_photo_front: files.vehicle_photo_front ? files.vehicle_photo_front[0] : null,
      vehicle_photo_back: files.vehicle_photo_back ? files.vehicle_photo_back[0] : null,
      vehicle_photo_interior: files.vehicle_photo_interior ? files.vehicle_photo_interior[0] : null,
    };
    
    // Créer le chauffeur
    const driver = await driverService.createDriver(driverData);
    
    // Mettre à jour le rôle de l'utilisateur
    await User.update({ role: 'driver' }, { where: { id: req.user.id } });
    
    res.status(201).json({
      success: true,
      driver: {
        id: driver.id,
        unique_id: driver.unique_id,
        is_approved: driver.is_approved,
        vehicle_brand: driver.vehicle_brand,
        vehicle_model: driver.vehicle_model,
        vehicle_plate: driver.vehicle_plate,
      },
      message: 'Votre compte chauffeur a été créé avec succès'
    });
  } catch (error) {
    next(error);
  }
}

  /**
   * Obtenir le profil chauffeur
   * GET /api/v1/drivers/me
   */
  async getDriverProfile(req, res, next) {
    try {
      const stats = await driverService.getDriverStats(req.driver.id);
      
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour la position GPS
   * PUT /api/v1/drivers/location
   */
  async updateLocation(req, res, next) {
    try {
      const { lat, lng } = req.body;
      
      if (!lat || !lng) {
        return res.status(400).json({ error: 'Latitude et longitude requises' });
      }
      
      const driver = await driverService.updateLocation(req.driver.id, lat, lng);
      
      res.json({
        success: true,
        location: { lat: driver.current_lat, lng: driver.current_lng }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour le statut en ligne
   * PUT /api/v1/drivers/status
   */
  async updateOnlineStatus(req, res, next) {
    try {
      const { is_online } = req.body;
      
      const driver = await driverService.setOnlineStatus(req.driver.id, is_online);
      
      res.json({
        success: true,
        is_online: driver.is_online
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les points d'activité
   * GET /api/v1/drivers/points
   */
  async getPoints(req, res, next) {
    try {
      const driver = await Driver.findByPk(req.driver.id, {
        attributes: ['activity_points', 'rating', 'total_rides', 'total_cancellations']
      });
      
      const history = await pointsService.getPointsHistory(req.driver.id, {
        limit: 20,
        offset: 0
      });
      
      res.json({
        current_points: driver.activity_points,
        rating: driver.rating,
        total_rides: driver.total_rides,
        total_cancellations: driver.total_cancellations,
        history: history.rows,
        total_history: history.count
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir le classement des chauffeurs
   * GET /api/v1/drivers/leaderboard
   */
  async getLeaderboard(req, res, next) {
    try {
      const { city_id, limit = 50 } = req.query;
      
      const leaderboard = await pointsService.getLeaderboard(city_id, parseInt(limit));
      
      res.json(leaderboard);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour les documents
   * PUT /api/v1/drivers/documents
   */
  async updateDocuments(req, res, next) {
    try {
      const documents = req.body;
      
      const driver = await driverService.updateDriverDocuments(req.driver.id, documents);
      
      res.json({
        success: true,
        message: 'Documents mis à jour avec succès',
        documents: {
          license: !!driver.license_photo_url,
          registration: !!driver.vehicle_registration_url,
          insurance: !!driver.insurance_url,
          id_photo: !!driver.id_photo_url,
          portrait: !!driver.portrait_photo_url,
          vehicle_photos: {
            front: !!driver.vehicle_photo_front_url,
            back: !!driver.vehicle_photo_back_url,
            interior: !!driver.vehicle_photo_interior_url
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les chauffeurs à proximité
   * GET /api/v1/drivers/nearby
   */
  async getNearbyDrivers(req, res, next) {
    try {
      const { lat, lng, radius = 5 } = req.query;
      
      if (!lat || !lng) {
        return res.status(400).json({ error: 'Latitude et longitude requises' });
      }
      
      const drivers = await driverService.getNearbyDrivers(
        parseFloat(lat),
        parseFloat(lng),
        parseFloat(radius)
      );
      
      res.json({
        count: drivers.length,
        drivers: drivers.map(d => ({
          id: d.id,
          unique_id: d.unique_id,
          rating: d.rating,
          distance: d.distance,
          vehicle: {
            brand: d.vehicle_brand,
            model: d.vehicle_model,
            color: d.vehicle_color,
            plate: d.vehicle_plate
          },
          user: {
            first_name: d.user.first_name,
            last_name: d.user.last_name,
            avatar_url: d.user.avatar_url
          }
        }))
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DriverController();