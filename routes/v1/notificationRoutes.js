// routes/v1/notificationRoutes.js
const express = require('express');
const router = express.Router();
const NotificationController = require('../../controllers/NotificationController');
const { auth } = require('../../middleware/auth');
const { validate } = require('../../middleware/validation');
const Joi = require('joi');

// Toutes les routes nécessitent authentification
router.use(auth);

// ==================== NOTIFICATIONS ====================

router.get('/', NotificationController.getNotifications);
router.get('/unread', NotificationController.getUnreadNotifications);
router.get('/unread/count', NotificationController.getUnreadCount);
router.get('/:notificationId', NotificationController.getNotificationById);
router.put('/:notificationId/read', NotificationController.markAsRead);
router.put('/read/all', NotificationController.markAllAsRead);
router.delete('/:notificationId', NotificationController.deleteNotification);
router.delete('/', NotificationController.deleteAllNotifications);

// ==================== PRÉFÉRENCES ====================

router.get('/preferences', NotificationController.getPreferences);

// ✅ Correction : Passe directement le schéma Joi, pas un objet { body: ... }
router.put('/preferences', validate(Joi.object({
  push_enabled: Joi.boolean(),
  in_app_enabled: Joi.boolean(),
  email_enabled: Joi.boolean(),
  sound_enabled: Joi.boolean(),
  vibration_enabled: Joi.boolean(),
  badge_enabled: Joi.boolean(),
  quiet_hours_enabled: Joi.boolean(),
  quiet_hours_start: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  quiet_hours_end: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  preferences: Joi.object()
}), 'body'), NotificationController.updatePreferences);

router.post('/preferences/reset', NotificationController.resetPreferences);

// ==================== APPAREILS ====================

// ✅ Correction ici aussi
router.post('/devices', validate(Joi.object({
  device_token: Joi.string().required(),
  platform: Joi.string().valid('ios', 'android', 'web').required(),
  app_version: Joi.string(),
  os_version: Joi.string(),
  device_model: Joi.string(),
  locale: Joi.string(),
  timezone: Joi.string()
}), 'body'), NotificationController.registerDevice);

// ✅ Correction ici aussi
router.delete('/devices', validate(Joi.object({
  device_token: Joi.string().required()
}), 'body'), NotificationController.unregisterDevice);

router.get('/devices', NotificationController.getUserDevices);

// ==================== STATISTIQUES ====================

router.get('/stats', NotificationController.getStats);

// ==================== TEST ====================

router.post('/test', NotificationController.testNotification);

module.exports = router;