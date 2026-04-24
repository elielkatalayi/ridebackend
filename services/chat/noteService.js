const { sequelize } = require('../../config/database');
const { ChatNote, ChatNoteFolder } = require('../../models');
const { uploadToSupabase } = require('../../utils/storage');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

class NoteService {
    
    async createNote(userId, noteData, files = null) {
        const transaction = await sequelize.transaction();
        
        try {
            console.log('🔵 NoteService.createNote - Début');
            
            let mediaFiles = [];
            
            if (files && files.length > 0) {
                for (const file of files) {
                    const fileExt = file.originalname.split('.').pop();
                    const fileName = `note_${uuidv4()}_${Date.now()}.${fileExt}`;
                    
                    let mediaType = 'document';
                    if (file.mimetype.startsWith('image/')) mediaType = 'image';
                    else if (file.mimetype.startsWith('video/')) mediaType = 'video';
                    else if (file.mimetype.startsWith('audio/')) mediaType = 'audio';
                    
                    const { url } = await uploadToSupabase(
                        'chat-notes', `notes/${userId}`, file.buffer, file.mimetype, fileName
                    );
                    
                    mediaFiles.push({ type: mediaType, url, name: file.originalname, size: file.size });
                }
            }
            
            console.log('📝 Création de la note...');
            const note = await ChatNote.create({
                user_id: userId,
                folder_id: noteData.folder_id || null,
                title: noteData.title,
                content: noteData.content,
                media: mediaFiles,
                source_type: noteData.source_type || null,
                source_id: noteData.source_id || null,
                original_message_id: noteData.original_message_id || null,
                color: noteData.color || null
            }, { transaction });
            
            console.log('✅ Note créée:', note.id);
            
            if (noteData.folder_id) {
                await ChatNoteFolder.increment('note_count', { by: 1, where: { id: noteData.folder_id }, transaction });
            }
            
            // ✅ PAS DE STATS - On ignore complètement ChatUserStats
            console.log('📊 Mise à jour des stats ignorée (contournement temporaire)');
            
            await transaction.commit();
            console.log('✅ Transaction commitée avec succès');
            return note;
            
        } catch (error) {
            console.error('❌ Erreur dans createNote:', error);
            await transaction.rollback();
            throw error;
        }
    }
    
    async getUserNotes(userId, options = {}) {
        const { limit = 50, offset = 0, folder_id = null, is_pinned = null, is_archived = false } = options;
        
        const where = { user_id: userId, deleted_at: null };
        if (folder_id !== null) where.folder_id = folder_id;
        if (is_pinned !== null) where.is_pinned = is_pinned;
        if (is_archived !== null) where.is_archived = is_archived;
        
        const notes = await ChatNote.findAll({
            where,
            order: [
                ['is_pinned', 'DESC'],
                ['updated_at', 'DESC']
            ],
            limit,
            offset
        });
        
        return notes;
    }
    
    async getNoteById(noteId, userId) {
        const note = await ChatNote.findOne({
            where: { id: noteId, user_id: userId, deleted_at: null }
        });
        
        if (!note) return null;
        
        await note.update({ view_count: note.view_count + 1 });
        
        return note;
    }
    
    async updateNote(noteId, userId, updateData) {
        const note = await ChatNote.findOne({
            where: { id: noteId, user_id: userId, deleted_at: null }
        });
        
        if (!note) throw new Error('Note non trouvée');
        
        const updates = {};
        if (updateData.title !== undefined) updates.title = updateData.title;
        if (updateData.content !== undefined) updates.content = updateData.content;
        if (updateData.folder_id !== undefined) updates.folder_id = updateData.folder_id;
        if (updateData.color !== undefined) updates.color = updateData.color;
        if (updateData.is_pinned !== undefined) updates.is_pinned = updateData.is_pinned;
        if (updateData.is_archived !== undefined) updates.is_archived = updateData.is_archived;
        
        await note.update(updates);
        return note;
    }
    
    async deleteNote(noteId, userId, permanent = false) {
        const note = await ChatNote.findOne({
            where: { id: noteId, user_id: userId }
        });
        
        if (!note) throw new Error('Note non trouvée');
        
        if (permanent) {
            await note.destroy();
        } else {
            await note.update({ deleted_at: new Date() });
        }
        
        return true;
    }
    
    async restoreNote(noteId, userId) {
        const note = await ChatNote.findOne({
            where: { id: noteId, user_id: userId, deleted_at: { [Op.ne]: null } }
        });
        
        if (!note) throw new Error('Note non trouvée');
        
        await note.update({ deleted_at: null });
        
        return note;
    }
    
    async createFolder(userId, folderData) {
        const folder = await ChatNoteFolder.create({
            user_id: userId,
            name: folderData.name,
            color: folderData.color,
            icon: folderData.icon,
            parent_id: folderData.parent_id || null
        });
        
        return folder;
    }
    
    async getUserFolders(userId) {
        // ✅ Version simplifiée SANS include (recommandée)
        const folders = await ChatNoteFolder.findAll({
            where: { user_id: userId, is_deleted: false },
            order: [['created_at', 'ASC']]
        });
        
        return folders;
    }
    
    async updateFolder(folderId, userId, updateData) {
        const folder = await ChatNoteFolder.findOne({
            where: { id: folderId, user_id: userId }
        });
        
        if (!folder) throw new Error('Dossier non trouvé');
        
        await folder.update(updateData);
        return folder;
    }
    
    async deleteFolder(folderId, userId) {
        const folder = await ChatNoteFolder.findOne({
            where: { id: folderId, user_id: userId }
        });
        
        if (!folder) throw new Error('Dossier non trouvé');
        
        await ChatNote.update({ folder_id: null }, { where: { folder_id: folderId } });
        await folder.destroy();
        
        return true;
    }
    
    async searchNotes(userId, query, options = {}) {
        const { limit = 50, offset = 0 } = options;
        
        const notes = await ChatNote.findAll({
            where: {
                user_id: userId,
                deleted_at: null,
                [Op.or]: [
                    { title: { [Op.iLike]: `%${query}%` } },
                    { content: { [Op.iLike]: `%${query}%` } }
                ]
            },
            order: [['updated_at', 'DESC']],
            limit,
            offset
        });
        
        return notes;
    }
}

module.exports = new NoteService();