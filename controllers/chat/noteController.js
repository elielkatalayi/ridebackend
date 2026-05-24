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
                state: true,
                message: 'Note créée avec succès',
                datas: note
            });
            
        } catch (error) {
            console.error('Erreur createNote:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
    
    async getUserNotes(req, res) {
        try {
            const userId = req.user.id;
            const limit = parseInt(req.query.limit) || 50;
            const offset = parseInt(req.query.offset) || 0;
            const folder_id = req.query.folder_id === 'null' ? null : req.query.folder_id;
            const is_pinned = req.query.is_pinned === 'true' ? true : (req.query.is_pinned === 'false' ? false : null);
            const is_archived = req.query.is_archived === 'true';
            
            const result = await NoteService.getUserNotes(userId, {
                limit, offset, folder_id, is_pinned, is_archived
            });
            
            const notes = result.rows || result;
            const total = result.count || (Array.isArray(notes) ? notes.length : 0);
            
            const totalPages = Math.ceil(total / limit);
            const currentPage = Math.floor(offset / limit) + 1;
            
            res.status(200).json({
                state: true,
                message: 'Notes récupérées avec succès',
                datas: notes,
                meta: {
                    total: total,
                    count: notes.length,
                    per_page: limit,
                    current_page: currentPage,
                    total_pages: totalPages
                }
            });
            
        } catch (error) {
            console.error('Erreur getUserNotes:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
    
    async getNoteById(req, res) {
        try {
            const { noteId } = req.params;
            const userId = req.user.id;
            
            const note = await NoteService.getNoteById(noteId, userId);
            
            if (!note) {
                return res.status(404).json({ 
                    state: false, 
                    message: 'Note non trouvée', 
                    datas: null 
                });
            }
            
            res.status(200).json({ 
                state: true, 
                message: 'Note récupérée avec succès',
                datas: note 
            });
            
        } catch (error) {
            console.error('Erreur getNoteById:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
    
    async updateNote(req, res) {
        try {
            const { noteId } = req.params;
            const userId = req.user.id;
            const updateData = req.body;
            
            const note = await NoteService.updateNote(noteId, userId, updateData);
            
            res.status(200).json({
                state: true,
                message: 'Note mise à jour',
                datas: note
            });
            
        } catch (error) {
            console.error('Erreur updateNote:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
    
    async deleteNote(req, res) {
        try {
            const { noteId } = req.params;
            const userId = req.user.id;
            const permanent = req.query.permanent === 'true';
            
            await NoteService.deleteNote(noteId, userId, permanent);
            
            res.status(200).json({
                state: true,
                message: permanent ? 'Note supprimée définitivement' : 'Note déplacée dans la corbeille',
                datas: null
            });
            
        } catch (error) {
            console.error('Erreur deleteNote:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
    
    async restoreNote(req, res) {
        try {
            const { noteId } = req.params;
            const userId = req.user.id;
            
            const note = await NoteService.restoreNote(noteId, userId);
            
            res.status(200).json({
                state: true,
                message: 'Note restaurée',
                datas: note
            });
            
        } catch (error) {
            console.error('Erreur restoreNote:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
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
                state: true,
                message: 'Dossier créé',
                datas: folder
            });
            
        } catch (error) {
            console.error('Erreur createFolder:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
    
    async getUserFolders(req, res) {
        try {
            const userId = req.user.id;
            
            const folders = await NoteService.getUserFolders(userId);
            
            res.status(200).json({
                state: true,
                message: 'Dossiers récupérés',
                datas: folders
            });
            
        } catch (error) {
            console.error('Erreur getUserFolders:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
    
    async updateFolder(req, res) {
        try {
            const { folderId } = req.params;
            const userId = req.user.id;
            const updateData = req.body;
            
            const folder = await NoteService.updateFolder(folderId, userId, updateData);
            
            res.status(200).json({
                state: true,
                message: 'Dossier mis à jour',
                datas: folder
            });
            
        } catch (error) {
            console.error('Erreur updateFolder:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
    
    async deleteFolder(req, res) {
        try {
            const { folderId } = req.params;
            const userId = req.user.id;
            
            await NoteService.deleteFolder(folderId, userId);
            
            res.status(200).json({
                state: true,
                message: 'Dossier supprimé',
                datas: null
            });
            
        } catch (error) {
            console.error('Erreur deleteFolder:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
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
                return res.status(400).json({ 
                    state: false, 
                    message: 'La recherche doit contenir au moins 2 caractères', 
                    datas: null 
                });
            }
            
            const result = await NoteService.searchNotes(userId, q, {
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
            
            const notes = result.rows || result;
            const total = result.count || (Array.isArray(notes) ? notes.length : 0);
            const totalPages = Math.ceil(total / limit);
            const currentPage = Math.floor(offset / limit) + 1;
            
            res.status(200).json({
                state: true,
                message: 'Résultats de recherche',
                datas: notes,
                meta: {
                    total: total,
                    count: notes.length,
                    per_page: parseInt(limit),
                    current_page: currentPage,
                    total_pages: totalPages
                }
            });
            
        } catch (error) {
            console.error('Erreur searchNotes:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
}

module.exports = new NoteController();