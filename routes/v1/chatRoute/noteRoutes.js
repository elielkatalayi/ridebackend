const express = require('express');
const router = express.Router();
const { auth } = require('../../../middleware/auth');
const upload = require('../../../middleware/upload');
const { validate } = require('../../../middleware/validation');
const Joi = require('joi');

// Import du contrôleur
const noteController = require('../../../controllers/chat/noteController');


// =====================================================
// RECHERCHE
// =====================================================

// Rechercher dans les notes
router.get('/search/:query', auth, noteController.searchNotes);


// =====================================================
// VALIDATION SCHEMAS
// =====================================================

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


// =====================================================
// ROUTES DES DOSSIERS
// =====================================================

// Créer un dossier
router.post('/folders', auth, validate(createFolderSchema), noteController.createFolder);

// Récupérer tous les dossiers
router.get('/folders', auth, noteController.getUserFolders);

// Modifier un dossier
router.put('/folders/:folderId', auth, noteController.updateFolder);

// Supprimer un dossier
router.delete('/folders/:folderId', auth, noteController.deleteFolder);


// =====================================================
// ROUTES DES NOTES
// =====================================================

// Créer une note
router.post('/', auth, upload.array('media', 10), validate(createNoteSchema), noteController.createNote);

// Récupérer toutes les notes
router.get('/', auth, noteController.getUserNotes);

// Récupérer une note par ID
router.get('/:noteId', auth, noteController.getNoteById);

// Modifier une note
router.put('/:noteId', auth, noteController.updateNote);

// Supprimer une note
router.delete('/:noteId', auth, noteController.deleteNote);

// Restaurer une note
router.post('/:noteId/restore', auth, noteController.restoreNote);

module.exports = router;