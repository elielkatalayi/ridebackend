const express = require('express');
const router = express.Router();
const { auth } = require('../../../middleware/auth');
const upload = require('../../../middleware/upload');
const { validate } = require('../../../middleware/validation');
const Joi = require('joi');

// Import du contrôleur
const pageController = require('../../../controllers/social/pageController');

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const createPageSchema = Joi.object({
    name: Joi.string().min(3).max(100).required(),
    description: Joi.string().max(5000),
    category: Joi.string().max(50),
    phone: Joi.string().max(20),
    email: Joi.string().email(),
    website: Joi.string().uri(),
    address: Joi.string().max(255),
    city: Joi.string().max(100),
    country: Joi.string().max(100),
    settings: Joi.object()
});

const updatePageSchema = Joi.object({
    name: Joi.string().min(3).max(100),
    description: Joi.string().max(5000),
    category: Joi.string().max(50),
    phone: Joi.string().max(20),
    email: Joi.string().email(),
    website: Joi.string().uri(),
    address: Joi.string().max(255),
    city: Joi.string().max(100),
    country: Joi.string().max(100),
    settings: Joi.object()
});

const addAdminSchema = Joi.object({
    user_id: Joi.string().uuid().required(),
    role: Joi.string().valid('admin', 'editor', 'moderator').default('admin')
});

// =====================================================
// GESTION DES PAGES
// =====================================================

// Créer une page
router.post(
    '/',
    auth,
    upload.fields([
        { name: 'profile_picture', maxCount: 1 },
        { name: 'cover_photo', maxCount: 1 }
    ]),
    validate(createPageSchema),
    pageController.createPage
);

// Récupérer toutes les pages (public)
router.get('/', pageController.getAllPages);

// Récupérer la page personnelle de l'utilisateur connecté
router.get('/me', auth, pageController.getPersonalPage);

// Récupérer les pages suggérées
router.get('/suggested', auth, pageController.getSuggestedPages);

// Récupérer les pages suivies par l'utilisateur
router.get('/followed', auth, pageController.getFollowedPages);

// Récupérer une page par ID
router.get('/:page_id', pageController.getPageById);

// Récupérer une page par slug
router.get('/by-slug/:slug', pageController.getPageBySlug);

// Mettre à jour une page
router.put(
    '/:page_id',
    auth,
    upload.fields([
        { name: 'profile_picture', maxCount: 1 },
        { name: 'cover_photo', maxCount: 1 }
    ]),
    validate(updatePageSchema),
    pageController.updatePage
);

// Supprimer une page (soft delete)
router.delete('/:page_id', auth, pageController.deletePage);

// Supprimer définitivement une page (admin only)
router.delete('/:page_id/final', auth, pageController.deletePageFinal);

// Restaurer une page
router.post('/:page_id/restore', auth, pageController.restorePage);

// =====================================================
// INTERACTIONS AVEC LES PAGES
// =====================================================

// Suivre une page
router.post('/:page_id/follow', auth, pageController.followPage);

// Ne plus suivre une page
router.delete('/:page_id/follow', auth, pageController.unfollowPage);

// Vérifier si l'utilisateur suit la page
router.get('/:page_id/is-following', auth, pageController.checkFollowing);

// Obtenir les followers d'une page
router.get('/:page_id/followers', pageController.getFollowers);

// Obtenir les statistiques d'une page
router.get('/:page_id/stats', auth, pageController.getPageStats);

// =====================================================
// ADMINISTRATION DES PAGES
// =====================================================

// Ajouter un administrateur
router.post(
    '/:page_id/admins',
    auth,
    validate(addAdminSchema),
    pageController.addAdmin
);

// Retirer un administrateur
router.delete('/:page_id/admins/:user_id', auth, pageController.removeAdmin);

// Modifier le rôle d'un administrateur
router.put(
    '/:page_id/admins/:user_id/role',
    auth,
    validate(Joi.object({ role: Joi.string().valid('admin', 'editor', 'moderator').required() })),
    pageController.updateAdminRole
);

// Obtenir les administrateurs
router.get('/:page_id/admins', pageController.getAdmins);

// =====================================================
// NOTIFICATIONS PAGES
// =====================================================

// Activer/désactiver les notifications
router.put('/:page_id/notifications', auth, pageController.toggleNotifications);

// =====================================================
// RECHERCHE PAGES
// =====================================================

// Rechercher des pages
router.get('/search/:query', pageController.searchPages);

module.exports = router;