const rideService = require('../services/ride/rideService');
const negotiationService = require('../services/ride/negotiationService');
const pauseService = require('../services/ride/pauseService');
const waitTimeService = require('../services/ride/waitTimeService');
const stopService = require('../services/ride/stopService');
const pricingService = require('../services/pricing/pricingService');
const { Ride } = require('../models');

class RideController {
  /**
   * Demander une course (estimation de prix)
   * POST /api/v1/rides/estimate
   */
  async estimatePrice(req, res, next) {
    try {
      const { origin_lat, origin_lng, destination_lat, destination_lng, category_id } = req.body;
      
      const estimate = await pricingService.estimatePrice(
        { lat: origin_lat, lng: origin_lng },
        { lat: destination_lat, lng: destination_lng },
        category_id
      );
      
      res.json(estimate);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Créer une nouvelle demande de course
   * POST /api/v1/rides/request
   */
  async createRide(req, res, next) {
    try {
      const rideData = {
        ...req.body,
        passenger_id: req.user.id
      };
      
      const result = await rideService.createRide(rideData);
      
      res.status(201).json({
        success: true,
        ride: result.ride,
        priceEstimate: result.priceEstimate,
        driversNotified: result.driversNotified
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les détails d'une course
   * GET /api/v1/rides/:rideId
   */
  async getRide(req, res, next) {
    try {
      const { rideId } = req.params;
      
      const ride = await rideService.getRideById(rideId);
      
      if (ride.passenger_id !== req.user.id && ride.driver?.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Non autorisé' });
      }
      
      res.json(ride);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Accepter une course (chauffeur)
   * POST /api/v1/rides/:rideId/accept
   */
  async acceptRide(req, res, next) {
    try {
      const { rideId } = req.params;
      const driverId = req.driver.id;
      
      const ride = await rideService.acceptRide(rideId, driverId);
      
      res.json({
        success: true,
        ride
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Proposer un prix (négociation)
   * POST /api/v1/rides/:rideId/negotiate
   */
  async negotiatePrice(req, res, next) {
    try {
      const { rideId } = req.params;
      const { proposed_price } = req.body;
      
      const role = req.user.role === 'driver' ? 'driver' : 'passenger';
      
      const negotiation = await negotiationService.proposePrice(rideId, role, proposed_price);
      
      res.json({
        success: true,
        negotiation
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Accepter la proposition de prix
   * POST /api/v1/rides/:rideId/accept-price
   */
  async acceptPrice(req, res, next) {
    try {
      const { rideId } = req.params;
      
      const role = req.user.role === 'driver' ? 'driver' : 'passenger';
      
      const result = await negotiationService.acceptProposal(rideId, role);
      
      res.json({
        success: true,
        acceptedPrice: result.acceptedPrice,
        ride: result.ride
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Signaler l'arrivée du chauffeur
   * POST /api/v1/rides/:rideId/driver-arrived
   */
  async driverArrived(req, res, next) {
    try {
      const { rideId } = req.params;
      const driverId = req.driver.id;
      
      const waitTime = await waitTimeService.driverArrived(rideId, driverId);
      
      res.json({
        success: true,
        waitTime
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Démarrer la course
   * POST /api/v1/rides/:rideId/start
   */
  async startRide(req, res, next) {
    try {
      const { rideId } = req.params;
      const driverId = req.driver.id;
      
      await waitTimeService.endWait(rideId);
      
      const ride = await rideService.startRide(rideId, driverId);
      
      res.json({
        success: true,
        ride
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Faire une pause pendant la course
   * POST /api/v1/rides/:rideId/pause
   */
  async pauseRide(req, res, next) {
    try {
      const { rideId } = req.params;
      const driverId = req.driver.id;
      
      const pause = await pauseService.startPause(rideId, driverId);
      
      res.json({
        success: true,
        pause
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reprendre la course après pause
   * POST /api/v1/rides/:rideId/resume
   */
  async resumeRide(req, res, next) {
    try {
      const { rideId } = req.params;
      const driverId = req.driver.id;
      
      const result = await pauseService.endPause(rideId, driverId);
      
      res.json({
        success: true,
        durationMinutes: result.durationMinutes,
        amountCharged: result.amountCharged
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Ajouter un arrêt intermédiaire
   * POST /api/v1/rides/:rideId/add-stop
   */
  async addStop(req, res, next) {
    try {
      const { rideId } = req.params;
      const { lat, lng, address, name } = req.body;
      
      const stop = await stopService.addStop(rideId, { lat, lng, address, name });
      
      const priceUpdate = await stopService.recalculatePriceWithStops(rideId);
      
      res.json({
        success: true,
        stop,
        priceUpdate
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Terminer la course
   * POST /api/v1/rides/:rideId/complete
   */
  async completeRide(req, res, next) {
    try {
      const { rideId } = req.params;
      const driverId = req.driver.id;
      
      const ride = await rideService.completeRide(rideId, driverId);
      
      res.json({
        success: true,
        ride,
        message: 'Course terminée avec succès'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Annuler une course
   * POST /api/v1/rides/:rideId/cancel
   */
  async cancelRide(req, res, next) {
    try {
      const { rideId } = req.params;
      const { reason } = req.body;
      
      const cancelledBy = req.user.role === 'driver' ? 'driver' : 'passenger';
      
      const ride = await rideService.cancelRide(rideId, cancelledBy, reason);
      
      res.json({
        success: true,
        ride,
        message: 'Course annulée'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir l'historique des négociations
   * GET /api/v1/rides/:rideId/negotiations
   */
  async getNegotiations(req, res, next) {
    try {
      const { rideId } = req.params;
      
      const negotiations = await negotiationService.getNegotiationHistory(rideId);
      
      res.json(negotiations);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les arrêts d'une course
   * GET /api/v1/rides/:rideId/stops
   */
  async getStops(req, res, next) {
    try {
      const { rideId } = req.params;
      
      const stops = await stopService.getRideStops(rideId);
      
      res.json(stops);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les pauses d'une course
   * GET /api/v1/rides/:rideId/pauses
   */
  async getPauses(req, res, next) {
    try {
      const { rideId } = req.params;
      
      const pauses = await pauseService.getRidePauses(rideId);
      
      res.json(pauses);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RideController();