const sosService = require('../services/sos/sosService');

class SosController {
  /**
   * Déclencher une alerte SOS
   * POST /api/v1/sos/trigger
   */
  async triggerSos(req, res, next) {
    try {
      const { ride_id, lat, lng } = req.body;
      
      if (!ride_id || !lat || !lng) {
        return res.status(400).json({ error: 'ID course, latitude et longitude requis' });
      }
      
      const result = await sosService.triggerSos(
        ride_id,
        req.user.id,
        lat,
        lng
      );
      
      res.status(201).json({
        success: true,
        sosAlert: result.sosAlert,
        chatId: result.chatId,
        message: 'Alerte SOS envoyée. L\'équipe Uplus a été notifiée.'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les alertes SOS actives (admin)
   * GET /api/v1/sos/active
   */
  async getActiveAlerts(req, res, next) {
    try {
      const alerts = await sosService.getActiveSosAlerts();
      
      res.json(alerts);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Résoudre une alerte SOS (admin)
   * PUT /api/v1/sos/:sosId/resolve
   */
  async resolveSos(req, res, next) {
    try {
      const { sosId } = req.params;
      const { resolution_notes, status } = req.body;
      
      if (!resolution_notes) {
        return res.status(400).json({ error: 'Notes de résolution requises' });
      }
      
      const result = await sosService.resolveSos(
        sosId,
        req.user.id,
        resolution_notes,
        status || 'resolved'
      );
      
      res.json({
        success: true,
        sosAlert: result,
        message: status === 'false_alarm' ? 'Alerte marquée comme fausse alerte' : 'Alerte résolue'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir l'historique SOS d'un passager
   * GET /api/v1/sos/history
   */
  async getSosHistory(req, res, next) {
    try {
      const history = await sosService.getPassengerSosHistory(req.user.id);
      
      res.json(history);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les détails d'une alerte SOS
   * GET /api/v1/sos/:sosId
   */
  async getSosDetails(req, res, next) {
    try {
      const { sosId } = req.params;
      
      const { SosAlert, Ride, User, Driver } = require('../models');
      const sosAlert = await SosAlert.findByPk(sosId, {
        include: [
          { model: Ride, as: 'ride', include: ['passenger', 'driver'] }
        ]
      });
      
      if (!sosAlert) {
        return res.status(404).json({ error: 'Alerte SOS non trouvée' });
      }
      
      res.json(sosAlert);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SosController();