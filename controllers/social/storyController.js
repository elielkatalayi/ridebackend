// controllers/social/storyController.js
const { sequelize } = require('../../config/database');
const { Story, StoryView, StoryComment, StoryHighlight, User } = require('../../models');
const { Page, PageAdmin, PageFollower } = require('../../models');
const { uploadToSupabase, deleteFromSupabase } = require('../../utils/storage');
const NotificationService = require('../../services/notification/NotificationService');
const SocketService = require('../../services/notification/SocketService');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

// =====================================================
// ✅ FONCTION DE NOTIFICATION (CORRIGÉE)
// =====================================================
async function notifyPageFollowers(pageId, storyId, authorId) {
    if (!pageId) return;
    
    try {
        const followers = await PageFollower.findAll({
            where: { page_id: pageId },
            attributes: ['user_id']
        });
        
        for (const follower of followers) {
            if (follower.user_id !== authorId) {
                try {
                    await NotificationService.sendStoryNotification(
                        follower.user_id,
                        storyId,
                        'published',
                        authorId,
                        null,
                        null,
                        'story'
                    );
                    
                    SocketService.sendToUser(follower.user_id, 'story:new', {
                        story_id: storyId,
                        page_id: pageId,
                        timestamp: new Date()
                    });
                } catch (err) {
                    console.error(`Erreur notification pour user ${follower.user_id}:`, err.message);
                }
            }
        }
    } catch (error) {
        console.error('Erreur notifyPageFollowers:', error.message);
    }
}

class StoryController {
    
    // =====================================================
    // CRÉATION DE STORY
    // =====================================================

    async createStory(req, res) {
        const transaction = await sequelize.transaction();
        
        try {
            const userId = req.user.id;
            let { page_id, type, content, duration = 24, mentions = [] } = req.body;
            
            // Log de debug
            console.log('📥 [CREATE_STORY] Données reçues:');
            console.log('   - type:', type);
            console.log('   - page_id:', page_id);
            console.log('   - content:', content);
            console.log('   - duration:', duration);
            console.log('   - files:', req.files ? Object.keys(req.files) : 'aucun');
            
            if (!page_id) {
                const personalPage = await Page.findOne({
                    where: {
                        created_by: userId,
                        'settings.is_personal_page': true
                    },
                    transaction
                });
                
                if (!personalPage) {
                    await transaction.rollback();
                    return res.status(400).json({
                        success: false,
                        error: 'Vous n\'avez pas de page personnelle. Veuillez en créer une ou spécifier un page_id.'
                    });
                }
                
                page_id = personalPage.id;
            }
            
            if (!['photo', 'video', 'text', 'audio'].includes(type)) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    error: 'Type invalide. Types acceptés: photo, video, text, audio'
                });
            }
            
            // ✅ CORRECTION 1: Texte requis seulement pour type 'text'
            if (type === 'text' && (!content || content.trim() === '')) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    error: 'Le contenu est requis pour une story de type texte'
                });
            }
            
            let validDuration = parseInt(duration);
            const allowedDurations = [1, 2, 3, 4, 5, 6, 12, 24, 48, 72, 96, 120, 144, 168];
            
            if (isNaN(validDuration)) {
                validDuration = 24;
            } else if (!allowedDurations.includes(validDuration)) {
                validDuration = 24;
            }
            
            const isAdmin = await PageAdmin.findOne({
                where: { page_id, user_id: userId },
                transaction
            });
            
            if (!isAdmin) {
                await transaction.rollback();
                return res.status(403).json({
                    success: false,
                    error: 'Vous devez être administrateur de cette page pour publier une story'
                });
            }
            
            // Gestion du fichier média
            let mediaUrl = null;
            let thumbnailUrl = null;
            let mediaType = null;
            
            let uploadedFile = null;
            
            if (req.files) {
                if (req.files.media && req.files.media[0]) {
                    uploadedFile = req.files.media[0];
                    console.log('📸 Fichier trouvé dans media');
                } else if (req.files.mediaFile && req.files.mediaFile[0]) {
                    uploadedFile = req.files.mediaFile[0];
                    console.log('📸 Fichier trouvé dans mediaFile');
                } else if (req.files.file && req.files.file[0]) {
                    uploadedFile = req.files.file[0];
                    console.log('📸 Fichier trouvé dans file');
                }
            } else if (req.file) {
                uploadedFile = req.file;
                console.log('📸 Fichier trouvé dans file (singulier)');
            }
            
            if (uploadedFile) {
                const fileExt = uploadedFile.originalname.split('.').pop();
                const fileName = `story_${Date.now()}_${uuidv4()}.${fileExt}`;
                const folder = `stories/${page_id}`;
                
                if (uploadedFile.mimetype.startsWith('image/')) {
                    mediaType = 'image';
                    console.log('🖼️ Upload d\'une image');
                } else if (uploadedFile.mimetype.startsWith('video/')) {
                    mediaType = 'video';
                    console.log('🎥 Upload d\'une vidéo');
                } else if (uploadedFile.mimetype.startsWith('audio/')) {
                    mediaType = 'audio';
                    console.log('🎵 Upload d\'un audio');
                } else {
                    mediaType = 'document';
                    console.log('📄 Upload d\'un document');
                }
                
                console.log(`📤 Upload: ${fileName} (${uploadedFile.size} bytes)`);
                
                const { url, thumbnail } = await uploadToSupabase(
                    'social-media',
                    folder,
                    uploadedFile.buffer,
                    uploadedFile.mimetype,
                    fileName
                );
                
                mediaUrl = url;
                thumbnailUrl = thumbnail;
                
                console.log(`✅ Fichier uploadé: ${mediaUrl}`);
            } else if (type !== 'text') {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    error: `Un fichier est requis pour une story de type ${type}`
                });
            }
            
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + validDuration);
            
            // ✅ CORRECTION 2: TOUS les types peuvent avoir du texte (optionnel)
            // Seul le type 'text' nécessite du texte, les autres peuvent en avoir ou pas
            const storyData = {
                page_id,
                type,
                content: content || null,  // ← Permet d'avoir du texte pour TOUS les types
                media_url: mediaUrl,
                media_type: mediaType,
                thumbnail_url: thumbnailUrl,
                duration: validDuration,
                expires_at: expiresAt,
                mentions: mentions || [],
                settings: {}
            };
            
            console.log('📝 Création story avec:', {
                type: storyData.type,
                hasContent: !!storyData.content,
                hasMedia: !!storyData.media_url
            });
            
            const story = await Story.create(storyData, { transaction });
            
            await Page.increment('stories_count', { by: 1, where: { id: page_id }, transaction });
            
            await transaction.commit();
            
            // Notifications (non bloquante)
            try {
                await notifyPageFollowers(page_id, story.id, userId);
            } catch (notifError) {
                console.error('Erreur notification (non bloquante):', notifError.message);
            }
            
            return res.status(201).json({
                success: true,
                message: 'Story créée avec succès',
                data: story
            });
            
        } catch (error) {
            if (transaction && transaction.finished !== 'commit' && transaction.finished !== 'rollback') {
                await transaction.rollback();
            }
            console.error('❌ Erreur createStory:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    
    // =====================================================
    // RÉCUPÉRATION DES STORIES
    // =====================================================
    
    async getFeedStories(req, res) {
        try {
            const userId = req.user.id;
            
            const followedPages = await PageFollower.findAll({
                where: { user_id: userId },
                attributes: ['page_id']
            });
            const pageIds = followedPages.map(f => f.page_id);
            
            if (pageIds.length === 0) {
                return res.status(200).json({
                    success: true,
                    data: []
                });
            }
            
            const now = new Date();
            
            const stories = await Story.findAll({
                where: {
                    page_id: { [Op.in]: pageIds },
                    expires_at: { [Op.gt]: now },
                    is_deleted: false
                },
                order: [['created_at', 'DESC']],
                limit: 50
            });
            
            const storiesWithPageInfo = [];
            for (const story of stories) {
                const storyObj = story.toJSON();
                const page = await Page.findByPk(story.page_id, {
                    attributes: ['id', 'name', 'profile_picture']
                });
                storyObj.page = page;
                storiesWithPageInfo.push(storyObj);
            }
            
            const groupedStories = {};
            for (const story of storiesWithPageInfo) {
                const pageId = story.page_id;
                
                if (!groupedStories[pageId]) {
                    groupedStories[pageId] = {
                        publisher_id: pageId,
                        publisher_type: 'page',
                        publisher_name: story.page?.name,
                        publisher_avatar: story.page?.profile_picture,
                        stories: []
                    };
                }
                groupedStories[pageId].stories.push(story);
            }
            
            res.status(200).json({
                success: true,
                data: Object.values(groupedStories)
            });
            
        } catch (error) {
            console.error('Erreur getFeedStories:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getPageStories(req, res) {
        try {
            const { page_id } = req.params;
            const now = new Date();
            
            const stories = await Story.findAll({
                where: {
                    page_id,
                    expires_at: { [Op.gt]: now },
                    is_deleted: false
                },
                order: [['created_at', 'DESC']]
            });
            
            const page = await Page.findByPk(page_id, {
                attributes: ['id', 'name', 'profile_picture']
            });
            
            const storiesWithPage = stories.map(story => {
                const storyObj = story.toJSON();
                storyObj.page = page;
                return storyObj;
            });
            
            res.status(200).json({
                success: true,
                data: storiesWithPage
            });
            
        } catch (error) {
            console.error('Erreur getPageStories:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getStoryById(req, res) {
        try {
            const { story_id } = req.params;
            
            const story = await Story.findByPk(story_id);
            
            if (!story || story.is_deleted) {
                return res.status(404).json({
                    success: false,
                    error: 'Story non trouvée'
                });
            }
            
            const storyObj = story.toJSON();
            if (story.page_id) {
                const page = await Page.findByPk(story.page_id, {
                    attributes: ['id', 'name', 'profile_picture']
                });
                storyObj.page = page;
            }
            
            res.status(200).json({
                success: true,
                data: storyObj
            });
            
        } catch (error) {
            console.error('Erreur getStoryById:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // INTERACTIONS
    // =====================================================
    
    async viewStory(req, res) {
        try {
            const { story_id } = req.params;
            const userId = req.user.id;
            
            const existing = await StoryView.findOne({
                where: { story_id, user_id: userId }
            });
            
            if (!existing) {
                await StoryView.create({
                    story_id,
                    user_id: userId
                });
                
                await Story.increment('view_count', { by: 1, where: { id: story_id } });
            }
            
            res.status(200).json({
                success: true,
                message: 'Story vue'
            });
            
        } catch (error) {
            console.error('Erreur viewStory:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async reactToStory(req, res) {
        try {
            const { story_id } = req.params;
            const userId = req.user.id;
            const { reaction_type } = req.body;
            
            const story = await Story.findByPk(story_id);
            if (!story) {
                return res.status(404).json({ success: false, error: 'Story non trouvée' });
            }
            
            const [view, created] = await StoryView.findOrCreate({
                where: { story_id, user_id: userId },
                defaults: { story_id, user_id: userId, reaction_type }
            });
            
            if (!created) {
                await view.update({ reaction_type });
            }
            
            res.status(200).json({
                success: true,
                message: 'Réaction ajoutée'
            });
            
        } catch (error) {
            console.error('Erreur reactToStory:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async deleteStory(req, res) {
        try {
            const { story_id } = req.params;
            const userId = req.user.id;
            
            const story = await Story.findByPk(story_id);
            if (!story) {
                return res.status(404).json({ success: false, error: 'Story non trouvée' });
            }
            
            const isAdmin = await PageAdmin.findOne({
                where: { page_id: story.page_id, user_id: userId }
            });
            
            if (!isAdmin) {
                return res.status(403).json({
                    success: false,
                    error: 'Vous n\'êtes pas autorisé à supprimer cette story'
                });
            }
            
            if (story.media_url) {
                const path = story.media_url.split('/').pop();
                await deleteFromSupabase('social-media', `stories/${path}`).catch(console.error);
            }
            
            await story.update({ is_deleted: true, deleted_at: new Date() });
            
            res.status(200).json({
                success: true,
                message: 'Story supprimée'
            });
            
        } catch (error) {
            console.error('Erreur deleteStory:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // COMMENTAIRES
    // =====================================================
    
    async addComment(req, res) {
        try {
            const { story_id } = req.params;
            const userId = req.user.id;
            const { content, parent_comment_id } = req.body;
            
            if (!content && (!req.files || req.files.length === 0)) {
                return res.status(400).json({
                    success: false,
                    error: 'Le commentaire doit contenir du texte ou un média'
                });
            }
            
            const story = await Story.findByPk(story_id);
            if (!story) {
                return res.status(404).json({ success: false, error: 'Story non trouvée' });
            }
            
            let mediaFiles = [];
            if (req.files && req.files.length > 0) {
                for (const file of req.files) {
                    const fileExt = file.originalname.split('.').pop();
                    const fileName = `story_comment_${uuidv4()}_${Date.now()}.${fileExt}`;
                    
                    let mediaType = 'image';
                    if (file.mimetype.startsWith('video/')) mediaType = 'video';
                    else if (file.mimetype.startsWith('audio/')) mediaType = 'audio';
                    
                    const { url } = await uploadToSupabase(
                        'social-media',
                        `stories/comments/${story_id}`,
                        file.buffer,
                        file.mimetype,
                        fileName
                    );
                    
                    mediaFiles.push({ type: mediaType, url, duration: file.duration || null });
                }
            }
            
            const comment = await StoryComment.create({
                story_id,
                user_id: userId,
                content: content || '',
                parent_comment_id: parent_comment_id || null,
                media: mediaFiles
            });
            
            await Story.increment('comment_count', { by: 1, where: { id: story_id } });
            
            res.status(201).json({
                success: true,
                message: 'Commentaire ajouté',
                data: comment
            });
            
        } catch (error) {
            console.error('Erreur addComment:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getComments(req, res) {
        try {
            const { story_id } = req.params;
            const { limit = 20, offset = 0 } = req.query;
            
            const comments = await StoryComment.findAll({
                where: { story_id, parent_comment_id: null, is_deleted: false },
                include: [
                    { model: User, as: 'user', attributes: ['id', 'first_name', 'last_name', 'avatar_url'] }
                ],
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
            
            res.status(200).json({
                success: true,
                data: comments
            });
            
        } catch (error) {
            console.error('Erreur getComments:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async addReply(req, res) {
        try {
            const { comment_id } = req.params;
            const userId = req.user.id;
            const { content } = req.body;
            
            const parentComment = await StoryComment.findByPk(comment_id);
            if (!parentComment) {
                return res.status(404).json({ success: false, error: 'Commentaire non trouvé' });
            }
            
            let mediaFiles = [];
            if (req.files && req.files.length > 0) {
                for (const file of req.files) {
                    const fileExt = file.originalname.split('.').pop();
                    const fileName = `story_reply_${uuidv4()}_${Date.now()}.${fileExt}`;
                    
                    let mediaType = 'document';
                    if (file.mimetype.startsWith('image/')) mediaType = 'image';
                    else if (file.mimetype.startsWith('video/')) mediaType = 'video';
                    else if (file.mimetype.startsWith('audio/')) mediaType = 'audio';
                    
                    const { url } = await uploadToSupabase(
                        'social-media',
                        `stories/replies/${comment_id}`,
                        file.buffer,
                        file.mimetype,
                        fileName
                    );
                    
                    mediaFiles.push({ 
                        type: mediaType,
                        url,
                        mime_type: file.mimetype,
                        size: file.size
                    });
                }
            }
            
            const reply = await StoryComment.create({
                story_id: parentComment.story_id,
                user_id: userId,
                content,
                parent_comment_id: comment_id,
                media: mediaFiles
            });
            
            await StoryComment.increment('reply_count', { by: 1, where: { id: comment_id } });
            
            res.status(201).json({
                success: true,
                message: 'Réponse ajoutée',
                data: reply
            });
            
        } catch (error) {
            console.error('Erreur addReply:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async likeComment(req, res) {
        try {
            const { comment_id } = req.params;
            
            const comment = await StoryComment.findByPk(comment_id);
            if (!comment) {
                return res.status(404).json({ success: false, error: 'Commentaire non trouvé' });
            }
            
            await comment.increment('like_count', { by: 1 });
            
            res.status(200).json({
                success: true,
                message: 'Commentaire liké'
            });
            
        } catch (error) {
            console.error('Erreur likeComment:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // HIGHLIGHTS
    // =====================================================
    
    async createHighlight(req, res) {
        try {
            const { title, cover_image, cover_type, page_id } = req.body;
            
            if (!page_id) {
                return res.status(400).json({
                    success: false,
                    error: 'L\'ID de la page est requis'
                });
            }
            
            const highlight = await StoryHighlight.create({
                user_id: null,
                page_id: page_id,
                title,
                cover_image,
                cover_type,
                stories_order: []
            });
            
            res.status(201).json({
                success: true,
                message: 'Highlight créé',
                data: highlight
            });
            
        } catch (error) {
            console.error('Erreur createHighlight:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async addToHighlight(req, res) {
        try {
            const { highlight_id, story_id } = req.params;
            
            const highlight = await StoryHighlight.findByPk(highlight_id);
            if (!highlight) {
                return res.status(404).json({ success: false, error: 'Highlight non trouvé' });
            }
            
            const story = await Story.findByPk(story_id);
            if (!story) {
                return res.status(404).json({ success: false, error: 'Story non trouvée' });
            }
            
            await story.update({ is_highlight: true, highlight_id });
            
            const storiesOrder = highlight.stories_order || [];
            if (!storiesOrder.includes(story_id)) {
                storiesOrder.push(story_id);
                await highlight.update({ stories_order: storiesOrder });
            }
            
            res.status(200).json({
                success: true,
                message: 'Story ajoutée au highlight'
            });
            
        } catch (error) {
            console.error('Erreur addToHighlight:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async removeFromHighlight(req, res) {
        try {
            const { highlight_id, story_id } = req.params;
            
            const story = await Story.findByPk(story_id);
            if (story) {
                await story.update({ is_highlight: false, highlight_id: null });
            }
            
            const highlight = await StoryHighlight.findByPk(highlight_id);
            if (highlight) {
                const storiesOrder = (highlight.stories_order || []).filter(id => id !== story_id);
                await highlight.update({ stories_order: storiesOrder });
            }
            
            res.status(200).json({
                success: true,
                message: 'Story retirée du highlight'
            });
            
        } catch (error) {
            console.error('Erreur removeFromHighlight:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getPageHighlights(req, res) {
        try {
            const { page_id } = req.params;
            
            const highlights = await StoryHighlight.findAll({
                where: { 
                    page_id, 
                    is_deleted: false 
                },
                order: [['created_at', 'DESC']]
            });
            
            const highlightsWithStories = [];
            for (const highlight of highlights) {
                const highlightObj = highlight.toJSON();
                const storyIds = highlight.stories_order || [];
                
                if (storyIds.length > 0) {
                    const stories = await Story.findAll({
                        where: {
                            id: { [Op.in]: storyIds },
                            is_deleted: false
                        },
                        attributes: ['id', 'type', 'content', 'media_url', 'thumbnail_url', 'created_at']
                    });
                    highlightObj.stories = stories;
                } else {
                    highlightObj.stories = [];
                }
                
                highlightsWithStories.push(highlightObj);
            }
            
            res.status(200).json({
                success: true,
                data: highlightsWithStories
            });
            
        } catch (error) {
            console.error('Erreur getPageHighlights:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async deleteHighlight(req, res) {
        try {
            const { highlight_id } = req.params;
            
            await Story.update(
                { is_highlight: false, highlight_id: null },
                { where: { highlight_id } }
            );
            
            await StoryHighlight.destroy({ where: { id: highlight_id } });
            
            res.status(200).json({
                success: true,
                message: 'Highlight supprimé'
            });
            
        } catch (error) {
            console.error('Erreur deleteHighlight:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new StoryController();