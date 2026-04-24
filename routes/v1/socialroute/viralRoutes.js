const express = require('express');
const router = express.Router();
const { auth } = require('../../../middleware/auth');

// Import du contrôleur
const viralController = require('../../../controllers/social/viralController');

// =====================================================
// TRENDING & VIRAL
// =====================================================

// Posts trending (globaux)
router.get('/trending', viralController.getTrendingPosts);

// Trending par catégorie
router.get('/trending/category/:category', viralController.getTrendingByCategory);

// Trending par hashtag
router.get('/trending/hashtag/:tag', viralController.getTrendingByHashtag);

// =====================================================
// RECOMMANDATIONS
// =====================================================

// Recommandations personnalisées
router.get('/recommendations', auth, viralController.getPersonalizedRecommendations);

// =====================================================
// ANALYTICS (pour admins)
// =====================================================

// Statistiques globales viralité
router.get('/analytics/global', auth, viralController.getGlobalViralAnalytics);

// Statistiques d'un post
router.get('/analytics/post/:post_id', auth, viralController.getPostViralAnalytics);

// =====================================================
// SCORES
// =====================================================

// Calculer et mettre à jour les scores viraux (cron job)
router.post('/scores/update', auth, viralController.updateViralScores);

module.exports = router;