const shawariService = require('../services/payment/shawariService');
const { Payment } = require('../models');

class WebhookController {
  /**
   * Webhook Shawari pour les paiements
   * POST /api/v1/webhooks/shawari/payment
   */
  async shawariPaymentWebhook(req, res, next) {
    try {
      const payload = req.body;
      
      // Vérifier la signature (à implémenter selon docs Shawari)
      // const isValid = verifySignature(payload, req.headers['x-signature']);
      // if (!isValid) return res.status(401).json({ error: 'Signature invalide' });
      
      const result = await shawariService.handleWebhook(payload);
      
      res.json({ success: true, message: 'Webhook traité' });
    } catch (error) {
      console.error('Erreur webhook Shawari:', error);
      // Toujours retourner 200 pour éviter les tentatives répétées
      res.json({ success: false, message: error.message });
    }
  }

  /**
   * Webhook Clickatell pour les statuts SMS
   * POST /api/v1/webhooks/clickatell/status
   */
  async clickatellStatusWebhook(req, res, next) {
    try {
      const payload = req.body;
      
      // Enregistrer le statut du SMS
      console.log('SMS Status:', payload);
      
      res.json({ success: true });
    } catch (error) {
      res.json({ success: false });
    }
  }

  /**
   * Webhook pour les mises à jour de statut de course
   * POST /api/v1/webhooks/ride/status
   */
  async rideStatusWebhook(req, res, next) {
    try {
      const { ride_id, status, location } = req.body;
      
      // Mettre à jour le statut via WebSocket
      // io.to(`ride_${ride_id}`).emit('status_update', { status, location });
      
      res.json({ success: true });
    } catch (error) {
      res.json({ success: false });
    }
  }

  /**
   * Webhook pour les mises à jour de position chauffeur
   * POST /api/v1/webhooks/driver/location
   */
  async driverLocationWebhook(req, res, next) {
    try {
      const { driver_id, lat, lng } = req.body;
      
      // Mettre à jour la position via WebSocket
      // io.to(`driver_${driver_id}`).emit('location_update', { lat, lng });
      
      res.json({ success: true });
    } catch (error) {
      res.json({ success: false });
    }
  }
}

module.exports = new WebhookController();