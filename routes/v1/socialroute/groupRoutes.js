const express = require('express');
const router = express.Router();
const { auth } = require('../../../middleware/auth');
const upload = require('../../../middleware/upload');
const { validate } = require('../../../middleware/validation');
const Joi = require('joi');

// Import du contrôleur
const groupController = require('../../../controllers/social/groupController');

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const createGroupSchema = Joi.object({
    name: Joi.string().min(3).max(100).required(),
    description: Joi.string().max(5000),
    category: Joi.string().max(50),
    privacy_type: Joi.string().valid('public', 'private', 'secret').default('public'),
    join_type: Joi.string().valid('free', 'approval', 'invite_only').default('free'),
    settings: Joi.object()
});

const updateGroupSchema = Joi.object({
    name: Joi.string().min(3).max(100),
    description: Joi.string().max(5000),
    category: Joi.string().max(50),
    privacy_type: Joi.string().valid('public', 'private', 'secret'),
    join_type: Joi.string().valid('free', 'approval', 'invite_only'),
    settings: Joi.object()
});

const addMemberSchema = Joi.object({
    user_id: Joi.string().uuid().required(),
    role: Joi.string().valid('admin', 'moderator', 'member').default('member')
});

// =====================================================
// GESTION DES GROUPES
// =====================================================

// Créer un groupe
router.post(
    '/',
    auth,
    upload.single('cover_image'),
    validate(createGroupSchema),
    groupController.createGroup
);

// Récupérer tous les groupes (public)
router.get('/', groupController.getAllGroups);

// Récupérer les groupes suggérés
router.get('/suggested', auth, groupController.getSuggestedGroups);

// Récupérer les groupes de l'utilisateur
router.get('/my-groups', auth, groupController.getMyGroups);

// Récupérer un groupe par ID
router.get('/:group_id', groupController.getGroupById);

// Récupérer un groupe par slug
router.get('/by-slug/:slug', groupController.getGroupBySlug);

// Mettre à jour un groupe
router.put(
    '/:group_id',
    auth,
    upload.single('cover_image'),
    validate(updateGroupSchema),
    groupController.updateGroup
);

// Supprimer un groupe (soft delete)
router.delete('/:group_id', auth, groupController.deleteGroup);

// Supprimer définitivement un groupe (admin only)
router.delete('/:group_id/final', auth, groupController.deleteGroupFinal);

// Restaurer un groupe
router.post('/:group_id/restore', auth, groupController.restoreGroup);

// =====================================================
// MEMBRES DES GROUPES
// =====================================================

// Rejoindre un groupe
router.post('/:group_id/join', auth, groupController.joinGroup);

// Quitter un groupe
router.delete('/:group_id/leave', auth, groupController.leaveGroup);

// Vérifier si l'utilisateur est membre
router.get('/:group_id/is-member', auth, groupController.checkMembership);

// Obtenir les membres
router.get('/:group_id/members', groupController.getMembers);

// Obtenir les membres en attente (admin only)
router.get('/:group_id/pending-members', auth, groupController.getPendingMembers);

// Approuver un membre
router.post('/:group_id/members/:user_id/approve', auth, groupController.approveMember);

// Rejeter un membre
router.delete('/:group_id/members/:user_id/reject', auth, groupController.rejectMember);

// Retirer un membre
router.delete('/:group_id/members/:user_id', auth, groupController.removeMember);

// Modifier le rôle d'un membre
router.put(
    '/:group_id/members/:user_id/role',
    auth,
    validate(Joi.object({ role: Joi.string().valid('admin', 'moderator', 'member').required() })),
    groupController.updateMemberRole
);

// =====================================================
// ADMINISTRATION GROUPES
// =====================================================

// Obtenir les administrateurs
router.get('/:group_id/admins', groupController.getAdmins);

// =====================================================
// STATISTIQUES GROUPES
// =====================================================

router.get('/:group_id/stats', auth, groupController.getGroupStats);

// =====================================================
// RECHERCHE GROUPES
// =====================================================

router.get('/search/:query', groupController.searchGroups);


// Dans groupRoutes.js, ajoutez cette route
// Ajouter un membre par un admin
router.post(
    '/:group_id/members/add',
    auth,
    validate(Joi.object({
        user_id: Joi.string().uuid().required(),
        role: Joi.string().valid('admin', 'moderator', 'member').default('member')
    })),
    groupController.addMember
);
module.exports = router;