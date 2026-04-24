const NoteService = require('../../services/chat/noteService');

class NoteController {
    
    // =====================================================
    // NOTES
    // =====================================================
    
    async createNote(req, res) {
        try {
            const userId = req.user.id;
            const noteData = req.body;
            const files = req.files;
            
            const note = await NoteService.createNote(userId, noteData, files);
            
            res.status(201).json({
                success: true,
                message: 'Note créée avec succès',
                data: note
            });
            
        } catch (error) {
            console.error('Erreur createNote:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getUserNotes(req, res) {
        try {
            const userId = req.user.id;
            const { limit = 50, offset = 0, folder_id = null, is_pinned = null, is_archived = false } = req.query;
            
            const notes = await NoteService.getUserNotes(userId, {
                limit: parseInt(limit),
                offset: parseInt(offset),
                folder_id: folder_id === 'null' ? null : folder_id,
                is_pinned: is_pinned === 'true' ? true : (is_pinned === 'false' ? false : null),
                is_archived: is_archived === 'true'
            });
            
            res.status(200).json({
                success: true,
                data: notes,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    has_more: notes.length === parseInt(limit)
                }
            });
            
        } catch (error) {
            console.error('Erreur getUserNotes:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getNoteById(req, res) {
        try {
            const { noteId } = req.params;
            const userId = req.user.id;
            
            const note = await NoteService.getNoteById(noteId, userId);
            
            if (!note) {
                return res.status(404).json({ success: false, error: 'Note non trouvée' });
            }
            
            res.status(200).json({ success: true, data: note });
            
        } catch (error) {
            console.error('Erreur getNoteById:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async updateNote(req, res) {
        try {
            const { noteId } = req.params;
            const userId = req.user.id;
            const updateData = req.body;
            
            const note = await NoteService.updateNote(noteId, userId, updateData);
            
            res.status(200).json({
                success: true,
                message: 'Note mise à jour',
                data: note
            });
            
        } catch (error) {
            console.error('Erreur updateNote:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async deleteNote(req, res) {
        try {
            const { noteId } = req.params;
            const userId = req.user.id;
            const { permanent = false } = req.query;
            
            await NoteService.deleteNote(noteId, userId, permanent === 'true');
            
            res.status(200).json({
                success: true,
                message: permanent === 'true' ? 'Note supprimée définitivement' : 'Note déplacée dans la corbeille'
            });
            
        } catch (error) {
            console.error('Erreur deleteNote:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async restoreNote(req, res) {
        try {
            const { noteId } = req.params;
            const userId = req.user.id;
            
            const note = await NoteService.restoreNote(noteId, userId);
            
            res.status(200).json({
                success: true,
                message: 'Note restaurée',
                data: note
            });
            
        } catch (error) {
            console.error('Erreur restoreNote:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // DOSSIERS
    // =====================================================
    
    async createFolder(req, res) {
        try {
            const userId = req.user.id;
            const folderData = req.body;
            
            const folder = await NoteService.createFolder(userId, folderData);
            
            res.status(201).json({
                success: true,
                message: 'Dossier créé',
                data: folder
            });
            
        } catch (error) {
            console.error('Erreur createFolder:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getUserFolders(req, res) {
        try {
            const userId = req.user.id;
            
            const folders = await NoteService.getUserFolders(userId);
            
            res.status(200).json({
                success: true,
                data: folders
            });
            
        } catch (error) {
            console.error('Erreur getUserFolders:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async updateFolder(req, res) {
        try {
            const { folderId } = req.params;
            const userId = req.user.id;
            const updateData = req.body;
            
            const folder = await NoteService.updateFolder(folderId, userId, updateData);
            
            res.status(200).json({
                success: true,
                message: 'Dossier mis à jour',
                data: folder
            });
            
        } catch (error) {
            console.error('Erreur updateFolder:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async deleteFolder(req, res) {
        try {
            const { folderId } = req.params;
            const userId = req.user.id;
            
            await NoteService.deleteFolder(folderId, userId);
            
            res.status(200).json({
                success: true,
                message: 'Dossier supprimé'
            });
            
        } catch (error) {
            console.error('Erreur deleteFolder:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // RECHERCHE
    // =====================================================
    
    async searchNotes(req, res) {
        try {
            const userId = req.user.id;
            const { q, limit = 50, offset = 0 } = req.query;
            
            if (!q || q.length < 2) {
                return res.status(400).json({ success: false, error: 'La recherche doit contenir au moins 2 caractères' });
            }
            
            const notes = await NoteService.searchNotes(userId, q, {
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
            
            res.status(200).json({
                success: true,
                data: notes,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    has_more: notes.length === parseInt(limit)
                }
            });
            
        } catch (error) {
            console.error('Erreur searchNotes:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new NoteController();