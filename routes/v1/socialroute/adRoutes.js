const express = require('express');
const router = express.Router();
const { auth } = require('../../../middleware/auth');
const { validate } = require('../../../middleware/validation');
const Joi = require('joi');
const adController = require('../../../controllers/advertising/adController');

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const createCampaignSchema = Joi.object({
    ad_type: Joi.string().valid('post', 'story', 'external_link', 'page_promotion').required(),
    post_id: Joi.string().uuid().when('ad_type', { is: 'post', then: Joi.required() }),
    story_id: Joi.string().uuid().when('ad_type', { is: 'story', then: Joi.required() }),
    external_url: Joi.string().uri().when('ad_type', { is: 'external_link', then: Joi.required() }),
    external_title: Joi.string().max(255),
    external_description: Joi.string().max(500),
    external_image: Joi.string().uri(),
    title: Joi.string().max(255).required(),
    description: Joi.string().max(500),
    call_to_action: Joi.string().valid('learn_more', 'shop_now', 'subscribe', 'contact', 'download', 'visit_page'),
    total_budget: Joi.number().min(1000).required(),
    daily_budget: Joi.number().min(500),
    start_date: Joi.date().required(),
    end_date: Joi.date().greater(Joi.ref('start_date')).required(),
    targeting: Joi.object(),
    objective: Joi.string().valid('reach', 'engagement', 'clicks', 'conversions')
});

const rejectSchema = Joi.object({
    reason: Joi.string().required()
});

// =====================================================
// ROUTES PUBLICITÉ
// =====================================================

// Créer une campagne
router.post('/pages/:pageId/campaigns', auth, validate(createCampaignSchema), adController.createCampaign);

// Récupérer les campagnes d'une page
router.get('/pages/:pageId/campaigns', auth, adController.getCampaigns);

// Statistiques d'une campagne
router.get('/pages/:pageId/campaigns/:campaignId/stats', auth, adController.getCampaignStats);

// Statistiques quotidiennes
router.get('/pages/:pageId/campaigns/:campaignId/daily', auth, adController.getDailyStats);

// Mettre en pause
router.post('/pages/:pageId/campaigns/:campaignId/pause', auth, adController.pauseCampaign);

// Reprendre
router.post('/pages/:pageId/campaigns/:campaignId/resume', auth, adController.resumeCampaign);

// Annuler
router.delete('/pages/:pageId/campaigns/:campaignId', auth, adController.cancelCampaign);

// =====================================================
// ROUTES ADMIN
// =====================================================

// Récupérer les campagnes en attente
router.get('/admin/pending', auth, adController.getPendingCampaigns);

// Approuver une campagne
router.post('/admin/campaigns/:campaignId/approve', auth, adController.approveCampaign);

// Rejeter une campagne
router.post('/admin/campaigns/:campaignId/reject', auth, validate(rejectSchema), adController.rejectCampaign);

module.exports = router;