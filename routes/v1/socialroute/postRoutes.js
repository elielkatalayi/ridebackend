const express = require('express');
const router = express.Router();
const { auth } = require('../../../middleware/auth');
const upload = require('../../../middleware/upload');
const { validate } = require('../../../middleware/validation');
const parseHashtags = require('../../../middleware/parseHashtags');
const Joi = require('joi');

// Import du contrôleur
const postController = require('../../../controllers/social/postController');

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const createPostSchema = Joi.object({
    container_type: Joi.string().valid('page', 'group').required(),
    container_id: Joi.string().uuid().required(),
    content: Joi.string().max(5000),
    visibility: Joi.string().valid('public', 'members', 'admins_only').default('public'),
    hashtags: Joi.array().items(Joi.string().max(50)).max(10),
    mentions: Joi.array().items(Joi.object({
        type: Joi.string().valid('user', 'page').required(),
        id: Joi.string().uuid().required(),
        name: Joi.string()
    })),
    is_album: Joi.boolean().default(false),
    album_title: Joi.string().max(255)
}).min(1).custom((value, helpers) => {
    if (!value.content && !value.media && !value.is_album) {
        return helpers.error('any.required', { message: 'Le post doit contenir du texte ou des médias' });
    }
    return value;
});

const updatePostSchema = Joi.object({
    content: Joi.string().max(5000),
    visibility: Joi.string().valid('public', 'members', 'admins_only'),
    hashtags: Joi.alternatives().try(
        Joi.array().items(Joi.string().max(50)).max(10),
        Joi.string()
    ).default([]),
    replace_media: Joi.alternatives().try(
        Joi.boolean(),
        Joi.string().valid('true', 'false')
    ).default(false),
    remove_media_indexes: Joi.alternatives().try(
        Joi.array().items(Joi.number().min(0)),
        Joi.string()
    ),
    // Pour les fichiers, la validation se fait via multer, pas Joi
}).min(1);

const commentSchema = Joi.object({
    content: Joi.string().max(2000),
    parent_comment_id: Joi.string().uuid()
}).min(1).custom((value, helpers) => {
    if (!value.content && !value.media) {
        return helpers.error('any.required', { message: 'Le commentaire doit contenir du texte ou un média' });
    }
    return value;
});

const reactionSchema = Joi.object({
    reaction_type: Joi.string().valid('like', 'love', 'fire', 'celebrate', 'haha', 'wow', 'sad', 'angry').required()
});

const repostSchema = Joi.object({
    repost_type: Joi.string().valid('simple', 'quote').default('simple'),
    quote_content: Joi.string().max(1000).when('repost_type', {
        is: 'quote',
        then: Joi.required()
    })
});

// =====================================================
// CRÉATION DE POSTS
// =====================================================

// Créer un post (texte + médias)
router.post(
    '/',
    auth,
    upload.array('media', 15),
    parseHashtags,  // ← Ajouter le parser AVANT la validation
    validate(createPostSchema),
    postController.createPost
);

// Upload temporaire de médias (avant création du post)
router.post(
    '/upload-temp',
    auth,
    upload.array('media', 15),
    postController.uploadTempMedia
);

// =====================================================
// LECTURE DE POSTS
// =====================================================

// Feed personnalisé (pages suivies + groupes membres + viral)
router.get('/feed', auth, postController.getPersonalizedFeed);

// Feed d'une page
router.get('/page/:page_id', postController.getPagePosts);

// Feed d'un groupe
router.get('/group/:group_id', auth, postController.getGroupPosts);


// Récupérer les posts trending (viraux)
router.get('/trending', postController.getTrendingPosts);

// Récupérer les posts par hashtag
router.get('/hashtag/:tag', postController.getPostsByHashtag);

// Récupérer les posts sauvegardés par l'utilisateur
router.get('/saved', auth, postController.getSavedPosts);

// =====================================================
// MODIFICATION DE POSTS
// =====================================================

// Modifier un post
router.put(
    '/:post_id',
    auth,
    upload.array('media', 15),
    validate(updatePostSchema),
    postController.updatePost
);

// Épingler un post (admin only)
router.post('/:post_id/pin', auth, postController.pinPost);

// Détacher un post épinglé
router.delete('/:post_id/pin', auth, postController.unpinPost);

// Mettre en vedette un post (admin only)
router.post('/:post_id/feature', auth, postController.featurePost);

// =====================================================
// SUPPRESSION DE POSTS
// =====================================================

// Supprimer un post (soft delete)
router.delete('/:post_id', auth, postController.deletePost);

// Supprimer définitivement (admin only)
router.delete('/:post_id/final', auth, postController.deletePostFinal);

// Restaurer un post
router.post('/:post_id/restore', auth, postController.restorePost);

// =====================================================
// INTERACTIONS - RÉACTIONS
// =====================================================

// Ajouter/Modifier une réaction
router.post(
    '/:post_id/reactions',
    auth,
    validate(reactionSchema),
    postController.addReaction
);

// Supprimer une réaction
router.delete('/:post_id/reactions', auth, postController.removeReaction);

// Obtenir les réactions d'un post
router.get('/:post_id/reactions', postController.getReactions);

// Obtenir les réactions par type
router.get('/:post_id/reactions/:type', postController.getReactionsByType);

// =====================================================
// INTERACTIONS - COMMENTAIRES
// =====================================================

// Ajouter un commentaire (texte + média)
router.post(
    '/:post_id/comments',
    auth,
    upload.array('media', 5),
    validate(commentSchema),
    postController.addComment
);

// Récupérer les commentaires d'un post
router.get('/:post_id/comments', postController.getComments);

// Modifier un commentaire
router.put(
    '/comments/:comment_id',
    auth,
    upload.array('media', 5),
    validate(Joi.object({ content: Joi.string().max(2000) })),
    postController.updateComment
);

// Supprimer un commentaire
router.delete('/comments/:comment_id', auth, postController.deleteComment);

// Épingler un commentaire (admin only)
router.post('/comments/:comment_id/pin', auth, postController.pinComment);

// =====================================================
// INTERACTIONS - RÉPONSES AUX COMMENTAIRES
// =====================================================

// Répondre à un commentaire
router.post(
    '/comments/:comment_id/replies',
    auth,
    upload.array('media', 5),
    validate(Joi.object({ content: Joi.string().max(2000).required() })),
    postController.addReply
);

// Récupérer les réponses d'un commentaire
router.get('/comments/:comment_id/replies', postController.getReplies);

// Modifier une réponse
router.put(
    '/replies/:reply_id',
    auth,
    upload.array('media', 5),
    validate(Joi.object({ content: Joi.string().max(2000) })),
    postController.updateReply
);

// Supprimer une réponse
router.delete('/replies/:reply_id', auth, postController.deleteReply);

// =====================================================
// INTERACTIONS - RÉACTIONS AUX COMMENTAIRES
// =====================================================

// Réagir à un commentaire
router.post(
    '/comments/:comment_id/reactions',
    auth,
    validate(reactionSchema),
    postController.addCommentReaction
);

// Supprimer une réaction de commentaire
router.delete('/comments/:comment_id/reactions', auth, postController.removeCommentReaction);

// Obtenir les réactions d'un commentaire
router.get('/comments/:comment_id/reactions', postController.getCommentReactions);

// =====================================================
// INTERACTIONS - REPOSTS
// =====================================================

// Reposter un post
router.post('/:post_id/reposts', auth, validate(repostSchema), postController.repostPost);

// Supprimer un repost
router.delete('/:post_id/reposts', auth, postController.removeRepost);

// Obtenir les reposts d'un post
router.get('/:post_id/reposts', postController.getReposts);

// =====================================================
// INTERACTIONS - PARTAGES
// =====================================================

// Partager un post (externe)
router.post('/:post_id/share', auth, postController.sharePost);

// =====================================================
// INTERACTIONS - SAUVEGARDE
// =====================================================

// Sauvegarder un post
router.post('/:post_id/save', auth, postController.savePost);

// Retirer des sauvegardes
router.delete('/:post_id/save', auth, postController.unsavePost);

// Vérifier si post sauvegardé
router.get('/:post_id/is-saved', auth, postController.isSaved);

// =====================================================
// VUES
// =====================================================

// Enregistrer une vue (watch time pour vidéos)
router.post('/:post_id/view', auth, postController.recordView);

// =====================================================
// SIGNALEMENTS
// =====================================================

// Signaler un post
router.post('/:post_id/report', auth, postController.reportPost);

// Signaler un commentaire
router.post('/comments/:comment_id/report', auth, postController.reportComment);

// =====================================================
// HASHTAGS
// =====================================================

// Hashtags populaires
router.get('/hashtags/popular', postController.getPopularHashtags);

// Récupérer un post par ID
router.get('/:post_id', postController.getPostById);

module.exports = router;