const express = require('express');
const router = express.Router();
const { auth } = require('../../../middleware/auth');
const upload = require('../../../middleware/upload');
const { validate } = require('../../../middleware/validation');
const Joi = require('joi');

// Import des contrôleurs
const chatController = require('../../../controllers/chat/chatController');
const messageController = require('../../../controllers/chat/messageController');
const noteController = require('../../../controllers/chat/noteController');
const transferController = require('../../../controllers/chat/transferController');

// =====================================================
// VALIDATION SCHEMAS 
// =====================================================

const createPrivateChatSchema = Joi.object({
    otherUserId: Joi.string().uuid().required()
});

const createGroupChatSchema = Joi.object({
    name: Joi.string().min(3).max(100).required(),
    description: Joi.string().max(500),
    is_public: Joi.boolean(),
    join_type: Joi.string().valid('free', 'approval', 'invite'),
    members: Joi.array().items(Joi.string().uuid()),
    settings: Joi.object(),
    avatar_url: Joi.string().uri()
});

const sendMessageSchema = Joi.object({
    content: Joi.string().max(5000),
    message_type: Joi.string().valid('text', 'image', 'video', 'audio', 'document', 'voice', 'location', 'poll'),
    reply_to_id: Joi.string().uuid(),
    reply_preview: Joi.string().max(200),
    mentions: Joi.array().items(Joi.string().uuid()),
    location_lat: Joi.number().min(-90).max(90),
    location_lng: Joi.number().min(-180).max(180),
    location_address: Joi.string().max(500),
    poll_data: Joi.object(),
    is_ephemeral: Joi.boolean(),
    ephemeral_duration: Joi.number().min(5).max(3600)
}).min(1);

const editMessageSchema = Joi.object({
    content: Joi.string().max(5000).required()
});

const reactionSchema = Joi.object({
    reaction_type: Joi.string().valid('like', 'love', 'haha', 'wow', 'sad', 'angry', 'fire', 'celebrate').required()
});

const createNoteSchema = Joi.object({
    title: Joi.string().max(255),
    content: Joi.string(),
    folder_id: Joi.string().uuid(),
    color: Joi.string().max(20)
});

const createFolderSchema = Joi.object({
    name: Joi.string().min(1).max(100).required(),
    color: Joi.string().max(20),
    icon: Joi.string().max(50),
    parent_id: Joi.string().uuid()
});

const transferToChatSchema = Joi.object({
    targetChatId: Joi.string().uuid().required(),
    note: Joi.string().max(500)
});

const transferToNoteSchema = Joi.object({
    folderId: Joi.string().uuid(),
    note: Joi.string().max(500)
});

const transferMultipleSchema = Joi.object({
    messageIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
    targetType: Joi.string().valid('private', 'group', 'note').required(),
    targetId: Joi.string().uuid().when('targetType', {
        is: 'note',
        then: Joi.optional(),
        otherwise: Joi.required()
    }),
    note: Joi.string().max(500)
});

// =====================================================
// CHATS (CONVERSATIONS)
// =====================================================

// Créer un chat privé
router.post('/private', auth, validate(createPrivateChatSchema), chatController.createPrivateChat);

// Créer un groupe
router.post('/group', auth, upload.single('avatar'), validate(createGroupChatSchema), chatController.createGroupChat);

// Récupérer tous les chats de l'utilisateur
router.get('/', auth, chatController.getUserChats);

// Récupérer un chat par ID
router.get('/get/:chatId', auth, chatController.getChatById);

// Mettre à jour les paramètres du chat
router.put('/:chatId/settings', auth, chatController.updateChatSettings);

// Mettre à jour ses paramètres personnels
router.put('/:chatId/my-settings', auth, chatController.updateParticipantSettings);

// =====================================================
// MEMBRES
// =====================================================

// Ajouter un membre
router.post('/:chatId/members', auth, chatController.addMember);

// Retirer un membre
router.delete('/:chatId/members/:memberId', auth, chatController.removeMember);

// Modifier le rôle d'un membre
router.put('/:chatId/members/:memberId/role', auth, chatController.updateMemberRole);

// Quitter un groupe
router.post('/:chatId/leave', auth, chatController.leaveGroup);

// =====================================================
// MESSAGES
// =====================================================

// Envoyer un message
router.post('/:chatId/messages', auth, upload.array('media', 5), validate(sendMessageSchema), messageController.sendMessage);

// Récupérer les messages
router.get('/:chatId/messages', auth, messageController.getMessages);

// Récupérer un message par ID
router.get('/messages/:messageId', auth, messageController.getMessageById);

// Modifier un message
router.put('/messages/:messageId', auth, validate(editMessageSchema), messageController.editMessage);

// Supprimer un message
router.delete('/messages/:messageId', auth, messageController.deleteMessage);

// =====================================================
// RÉACTIONS
// =====================================================

// Ajouter une réaction
router.post('/messages/:messageId/reactions', auth, validate(reactionSchema), messageController.addReaction);

// Retirer une réaction
router.delete('/messages/:messageId/reactions', auth, messageController.removeReaction);

// =====================================================
// MESSAGES ÉPINGLÉS
// =====================================================

// Épingler un message
router.post('/:chatId/pinned/:messageId', auth, messageController.pinMessage);

// Détacher un message
router.delete('/:chatId/pinned/:messageId', auth, messageController.unpinMessage);

// Récupérer les messages épinglés
router.get('/:chatId/pinned', auth, messageController.getPinnedMessages);

// =====================================================
// ACCUSÉS DE LECTURE
// =====================================================

// Marquer comme lu
router.post('/:chatId/read/:messageId', auth, messageController.markAsRead);

// Marquer comme délivré
router.post('/:chatId/delivered/:messageId', auth, messageController.markAsDelivered);

// =====================================================
// RECHERCHE
// =====================================================

// Rechercher dans les messages
router.get('/search/messages', auth, messageController.searchMessages);

// =====================================================
// STATISTIQUES
// =====================================================

// Statistiques de l'utilisateur
router.get('/stats', auth, chatController.getUserStats);

// =====================================================
// NOTES (NOTE BLOCK)
// =====================================================

// Créer une note
router.post('/notes', auth, upload.array('media', 10), validate(createNoteSchema), noteController.createNote);

// Récupérer les notes
router.get('/notes', auth, noteController.getUserNotes);

// Récupérer une note par ID
router.get('/notes/:noteId', auth, noteController.getNoteById);

// Modifier une note
router.put('/notes/:noteId', auth, noteController.updateNote);

// Supprimer une note
router.delete('/notes/:noteId', auth, noteController.deleteNote);

// Restaurer une note
router.post('/notes/:noteId/restore', auth, noteController.restoreNote);

// =====================================================
// DOSSIERS DE NOTES
// =====================================================

// Créer un dossier
router.post('/notes/folders', auth, validate(createFolderSchema), noteController.createFolder);

// Récupérer les dossiers
router.get('/notes/folders', auth, noteController.getUserFolders);

// Modifier un dossier
router.put('/notes/folders/:folderId', auth, noteController.updateFolder);

// Supprimer un dossier
router.delete('/notes/folders/:folderId', auth, noteController.deleteFolder);

// Rechercher dans les notes
router.get('/notes/search/:query', auth, noteController.searchNotes);

// =====================================================
// TRANSFERTS
// =====================================================

// Transférer un message vers un chat
router.post('/transfer/message/:messageId/to-chat', auth, validate(transferToChatSchema), transferController.transferToChat);

// Transférer un message vers les notes
router.post('/transfer/message/:messageId/to-note', auth, validate(transferToNoteSchema), transferController.transferToNote);

// Transférer une note vers un chat
router.post('/transfer/note/:noteId/to-chat', auth, transferController.transferNoteToChat);

// Transférer plusieurs messages
router.post('/transfer/multiple', auth, validate(transferMultipleSchema), transferController.transferMultiple);

// Historique des transferts
router.get('/transfer/history', auth, transferController.getTransferHistory);

// Vérifier si un message peut être transféré
router.get('/transfer/message/:messageId/can-transfer', auth, transferController.canTransfer);

module.exports = router;