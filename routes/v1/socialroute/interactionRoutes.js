const express = require('express');
const router = express.Router();
const { auth } = require('../../../middleware/auth');
const { validate } = require('../../../middleware/validation');
const Joi = require('joi');

// Import du contrôleur
const interactionController = require('../../../controllers/social/interactionController');

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const reactionSchema = Joi.object({
    reaction_type: Joi.string().valid('like', 'love', 'fire', 'celebrate', 'haha', 'wow', 'sad', 'angry').required()
});

// =====================================================
// RÉACTIONS UNIFIÉES
// =====================================================

// Réagir à n'importe quel contenu (post, comment, reply, repost)
router.post(
    '/react',
    auth,
    validate(Joi.object({
        target_type: Joi.string().valid('post', 'comment', 'reply', 'repost').required(),
        target_id: Joi.string().uuid().required(),
        reaction_type: Joi.string().valid('like', 'love', 'fire', 'celebrate', 'haha', 'wow', 'sad', 'angry').required()
    })),
    interactionController.react
);

// Supprimer une réaction
router.delete(
    '/react',
    auth,
    validate(Joi.object({
        target_type: Joi.string().valid('post', 'comment', 'reply', 'repost').required(),
        target_id: Joi.string().uuid().required()
    })),
    interactionController.removeReaction
);

// =====================================================
// NOTIFICATIONS
// =====================================================

// Marquer les notifications comme lues
router.put('/notifications/read-all', auth, interactionController.markAllNotificationsRead);

// Obtenir les préférences de notification
router.get('/notifications/preferences', auth, interactionController.getNotificationPreferences);

// Mettre à jour les préférences
router.put(
    '/notifications/preferences',
    auth,
    validate(Joi.object({
        push_enabled: Joi.boolean(),
        email_enabled: Joi.boolean(),
        quiet_hours_enabled: Joi.boolean(),
        quiet_hours_start: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
        quiet_hours_end: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    })),
    interactionController.updateNotificationPreferences
);

// =====================================================
// ACTIVITÉ UTILISATEUR
// =====================================================

// Historique des activités
router.get('/activity', auth, interactionController.getUserActivity);

// Statistiques d'engagement
router.get('/engagement/stats', auth, interactionController.getEngagementStats);

module.exports = router;