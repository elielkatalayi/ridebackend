const express = require('express');
const router = express.Router();
const { auth } = require('../../../middleware/auth');
const upload = require('../../../middleware/upload');
const { validate } = require('../../../middleware/validation');
const Joi = require('joi');

// Import du contrôleur
const storyController = require('../../../controllers/social/storyController');

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const createStorySchema = Joi.object({
    page_id: Joi.string().uuid().required(), // ← REQUIS (stories uniquement pour pages)
    type: Joi.string().valid('photo', 'video', 'text', 'audio').required(),
    content: Joi.string().max(500),
    duration: Joi.number().valid(1, 2, 3, 4, 5, 6, 12, 24, 48, 72, 96, 120, 144, 168).default(24),
    mentions: Joi.array().items(Joi.object({
        type: Joi.string().valid('user', 'page').required(),
        id: Joi.string().uuid().required(),
        name: Joi.string()
    })),
    settings: Joi.object({
        allow_comments: Joi.boolean(),
        allow_reactions: Joi.boolean(),
        allow_sharing: Joi.boolean(),
        allow_screenshots: Joi.boolean(),
        show_viewers: Joi.boolean()
    })
}).custom((value, helpers) => {
    if (value.type === 'text' && !value.content) {
        return helpers.error('any.required', { 
            message: 'La story de type text doit avoir un contenu' 
        });
    }
    return value;
});

const commentSchema = Joi.object({
    content: Joi.string().max(500),
    parent_comment_id: Joi.string().uuid()
}).min(1);

const reactionSchema = Joi.object({
    reaction_type: Joi.string().valid('like', 'heart', 'laugh', 'wow', 'sad', 'angry').required()
});

const highlightSchema = Joi.object({
    title: Joi.string().min(1).max(100).required(),
    cover_image: Joi.string().uri(),
    cover_type: Joi.string().valid('image', 'video'),
    page_id: Joi.string().uuid().required() // ← REQUIS
});

// =====================================================
// GESTION DES STORIES (UNIQUEMENT POUR PAGES)
// =====================================================

// Créer une story (uniquement pour les pages)
router.post(
    '/',
    auth,
    upload.fields([
        { name: 'media', maxCount: 1 },
        { name: 'mediaFile', maxCount: 1 },
        { name: 'thumbnail', maxCount: 1 }
    ]),
    validate(createStorySchema),
    storyController.createStory
);

// Récupérer les stories du feed (pages suivies)
router.get('/feed', auth, storyController.getFeedStories);

// Récupérer les stories d'une page
router.get('/page/:page_id', storyController.getPageStories);

// ❌ SUPPRIMER cette route (plus de stories utilisateur)
// router.get('/user/:user_id', storyController.getUserStories);

// Récupérer une story par ID
router.get('/:story_id', storyController.getStoryById);

// Supprimer une story
router.delete('/:story_id', auth, storyController.deleteStory);

// =====================================================
// INTERACTIONS STORIES
// =====================================================

// Voir une story
router.post('/:story_id/view', auth, storyController.viewStory);

// Réagir à une story
router.post(
    '/:story_id/react',
    auth,
    validate(reactionSchema),
    storyController.reactToStory
);

// Commenter une story
router.post(
    '/:story_id/comments',
    auth,
    upload.array('media', 5),
    validate(commentSchema),
    storyController.addComment
);

// Récupérer les commentaires d'une story
router.get('/:story_id/comments', storyController.getComments);

// Répondre à un commentaire
router.post(
    '/comments/:comment_id/replies',
    auth,
    upload.array('media', 5),
    validate(Joi.object({ content: Joi.string().max(500).required() })),
    storyController.addReply
);

// Liker un commentaire
router.post('/comments/:comment_id/like', auth, storyController.likeComment);

// =====================================================
// HIGHLIGHTS (UNIQUEMENT POUR PAGES)
// =====================================================

// Créer un highlight
router.post(
    '/highlights',
    auth,
    validate(highlightSchema),
    storyController.createHighlight
);

// Ajouter une story à un highlight
router.post('/highlights/:highlight_id/stories/:story_id', auth, storyController.addToHighlight);

// Retirer une story d'un highlight
router.delete('/highlights/:highlight_id/stories/:story_id', auth, storyController.removeFromHighlight);

// Récupérer les highlights d'une page
router.get('/highlights/page/:page_id', storyController.getPageHighlights);

// ❌ SUPPRIMER cette route (plus de highlights utilisateur)
// router.get('/user/:user_id/highlights', storyController.getUserHighlights);

// Supprimer un highlight
router.delete('/highlights/:highlight_id', auth, storyController.deleteHighlight);

module.exports = router;