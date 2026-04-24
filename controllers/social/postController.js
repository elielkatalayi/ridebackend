const { sequelize } = require('../../config/database');
const { Post, Comment, PostReaction, CommentReaction, Repost, SavedPost, PostView, PostShare, Page, Group, GroupMember, PageFollower, PageAdmin, User, Report   } = require('../../models');
const { uploadToSupabase } = require('../../utils/storage');
const NotificationService = require('../../services/notification/NotificationService');
const SocketService = require('../../services/notification/SocketService');
const ViralService = require('../../services/social/viralService');
const AdService = require('../../services/advertising/adService');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

class PostController {
    
    // =====================================================
    // CRÉATION
    // =====================================================

    async createPost(req, res) {
        try {
            const userId = req.user.id;
            let { container_type, container_id, content, visibility = 'public', hashtags = [], mentions = [], is_album = false, album_title } = req.body;
            
            // ✅ Convertir hashtags en tableau si ce n'est pas déjà le cas
            if (typeof hashtags === 'string') {
                hashtags = hashtags.split(',').map(tag => tag.trim()).filter(tag => tag);
            }
            if (!Array.isArray(hashtags)) {
                hashtags = [];
            }
            
            // ✅ Convertir mentions en tableau si ce n'est pas déjà le cas
            if (typeof mentions === 'string') {
                try {
                    mentions = JSON.parse(mentions);
                } catch {
                    mentions = [];
                }
            }
            if (!Array.isArray(mentions)) {
                mentions = [];
            }
            
            // Vérifier les permissions
            let canPost = false;
            
            if (container_type === 'page') {
                const isAdmin = await PageAdmin.findOne({ 
                    where: { page_id: container_id, user_id: userId }
                });
                const page = await Page.findByPk(container_id);
                canPost = !!isAdmin || (page?.settings?.allow_posts === true);
            } else if (container_type === 'group') {
                const membership = await GroupMember.findOne({ 
                    where: { group_id: container_id, user_id: userId, status: 'active' }
                });
                const group = await Group.findByPk(container_id);
                canPost = !!membership && (group?.settings?.allow_posts !== false);
            }
            
            if (!canPost) {
                return res.status(403).json({ 
                    success: false, 
                    error: 'Vous n\'êtes pas autorisé à poster ici' 
                });
            }
            
            if (!content && (!req.files || req.files.length === 0) && !is_album) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Le post doit contenir du texte ou des médias' 
                });
            }
            
            // Upload des médias
            let mediaFiles = [];
            if (req.files && req.files.length > 0) {
                for (let i = 0; i < req.files.length; i++) {
                    const file = req.files[i];
                    const fileExt = file.originalname.split('.').pop();
                    const fileName = `post_${uuidv4()}_${Date.now()}_${i}.${fileExt}`;
                    
                    let mediaType = 'document';
                    if (file.mimetype.startsWith('image/')) mediaType = 'image';
                    else if (file.mimetype.startsWith('video/')) mediaType = 'video';
                    else if (file.mimetype.startsWith('audio/')) mediaType = 'audio';
                    
                    const folder = `posts/${container_type}/${container_id}/${mediaType}s`;
                    
                    const { url, thumbnail } = await uploadToSupabase(
                        'social-media', folder, file.buffer, file.mimetype, fileName
                    );
                    
                    mediaFiles.push({
                        type: mediaType, url, thumbnail: thumbnail || null,
                        mime_type: file.mimetype, size: file.size, duration: file.duration || null
                    });
                }
            }
            
            const post = await Post.create({
                container_type, 
                container_id, 
                author_type: 'user', 
                author_id: userId,
                content: content || '', 
                media: mediaFiles, 
                visibility, 
                hashtags: hashtags || [],
                mentions: mentions || [], 
                is_album: is_album || mediaFiles.length > 1, 
                album_title
            });
            
            // Mettre à jour les compteurs
            if (container_type === 'page') {
                await Page.increment('posts_count', { by: 1, where: { id: container_id } });
            } else if (container_type === 'group') {
                await Group.increment('posts_count', { by: 1, where: { id: container_id } });
            }
            
            // Notifications - Version intégrée sans this
            const notifyMembers = async () => {
                try {
                    let members = [];
                    
                    if (container_type === 'page') {
                        const followers = await PageFollower.findAll({ 
                            where: { page_id: container_id }, 
                            attributes: ['user_id'] 
                        });
                        members = followers.map(f => f.user_id);
                    } else if (container_type === 'group') {
                        const groupMembers = await GroupMember.findAll({ 
                            where: { group_id: container_id, status: 'active' }, 
                            attributes: ['user_id'] 
                        });
                        members = groupMembers.map(m => m.user_id);
                    }
                    
                    for (const memberId of members) {
                        if (memberId !== userId) {
                            await NotificationService.sendSocialNotification(
                                memberId, post.id, 'new_post', userId, null, null, null
                            );
                            SocketService.sendToUser(memberId, 'feed:new_post', { 
                                post_id: post.id, 
                                container_type, 
                                container_id 
                            });
                        }
                    }
                } catch (err) {
                    console.error('Erreur notification membres:', err);
                }
            };
            
            notifyMembers();
            
            for (const mention of mentions) {
                if (mention.id !== userId) {
                    NotificationService.sendSocialNotification(
                        mention.id, post.id, 'mention', userId, req.user.name, req.user.avatar, content?.substring(0, 100)
                    ).catch(err => console.error('Erreur notification mention:', err));
                }
            }
            
            ViralService.calculateViralScore(post.id).catch(err => 
                console.error('Erreur calcul viral score:', err)
            );
            
            res.status(201).json({ 
                success: true, 
                message: 'Post créé avec succès', 
                data: post 
            });
            
        } catch (error) {
            console.error('Erreur createPost:', error);
            
            // Gérer les erreurs de validation Sequelize
            if (error.name === 'SequelizeValidationError') {
                return res.status(400).json({
                    success: false,
                    error: 'Erreur de validation',
                    errors: error.errors.map(e => ({
                        field: e.path,
                        message: e.message
                    }))
                });
            }
            
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // LECTURE - FEED PERSONNALISÉ AVEC PUBLICITÉS
    // =====================================================
    
    async getNormalFeed(userId, limit, offset) {
        // Récupérer les pages suivies et groupes membres
        const followedPages = await PageFollower.findAll({ where: { user_id: userId }, attributes: ['page_id'] });
        const memberGroups = await GroupMember.findAll({ where: { user_id: userId, status: 'active' }, attributes: ['group_id'] });
        
        const containerIds = [
            ...followedPages.map(f => ({ type: 'page', id: f.page_id })),
            ...memberGroups.map(m => ({ type: 'group', id: m.group_id }))
        ];
        
        if (containerIds.length === 0) {
            return [];
        }
        
        const posts = await Post.findAll({
            where: {
                [Op.or]: containerIds.map(c => ({
                    container_type: c.type,
                    container_id: c.id
                })),
                is_deleted: false,
                status: 'active'
            },
            include: [
                { model: User, as: 'author', attributes: ['id', 'first_name', 'avatar_url'] }
            ],
            order: [['is_pinned', 'DESC'], ['viral_score', 'DESC'], ['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        // Ajouter les interactions utilisateur
        for (const post of posts) {
            const userReaction = await PostReaction.findOne({ where: { post_id: post.id, user_id: userId } });
            const isSaved = await SavedPost.findOne({ where: { post_id: post.id, user_id: userId } });
            const hasReposted = await Repost.findOne({ where: { original_post_id: post.id, user_id: userId } });
            
            post.dataValues.user_reaction = userReaction?.reaction_type || null;
            post.dataValues.is_saved = !!isSaved;
            post.dataValues.has_reposted = !!hasReposted;
            post.dataValues.type = 'post';
        }
        
        return posts;
    }
    
    interleaveAds(posts, ads, frequency = 5) {
        const result = [];
        let adIndex = 0;
        
        for (let i = 0; i < posts.length; i++) {
            result.push(posts[i]);
            
            // Insérer une pub tous les 'frequency' posts
            if ((i + 1) % frequency === 0 && adIndex < ads.length) {
                const ad = ads[adIndex];
                result.push({
                    type: 'ad',
                    id: ad.id,
                    ad_type: ad.ad_type,
                    title: ad.title,
                    description: ad.description,
                    call_to_action: ad.call_to_action,
                    media_url: ad.media_url,
                    thumbnail_url: ad.thumbnail_url,
                    external_url: ad.external_url,
                    page_id: ad.page_id,
                    page_name: ad.Page?.name,
                    page_avatar: ad.Page?.profile_picture,
                    campaign_id: ad.id
                });
                adIndex++;
            }
        }
        
        return result;
    }
    
async getPersonalizedFeed(req, res) {
    try {
        const userId = req.user.id;
        const { limit = 30, offset = 0 } = req.query;
        
        // Récupérer les pages suivies et groupes membres
        const followedPages = await PageFollower.findAll({ 
            where: { user_id: userId }, 
            attributes: ['page_id'] 
        });
        const memberGroups = await GroupMember.findAll({ 
            where: { user_id: userId, status: 'active' }, 
            attributes: ['group_id'] 
        });
        
        const containerIds = [
            ...followedPages.map(f => ({ type: 'page', id: f.page_id })),
            ...memberGroups.map(m => ({ type: 'group', id: m.group_id }))
        ];
        
        if (containerIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                pagination: { limit: parseInt(limit), offset: parseInt(offset), has_more: false }
            });
        }
        
        // Récupérer les posts directement (sans appeler getNormalFeed)
        const posts = await Post.findAll({
            where: {
                [Op.or]: containerIds.map(c => ({
                    container_type: c.type,
                    container_id: c.id
                })),
                is_deleted: false,
                status: 'active'
            },
            include: [
                { model: User, as: 'author', attributes: ['id', 'first_name', 'last_name', 'avatar_url'] }
            ],
            order: [['is_pinned', 'DESC'], ['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        // Ajouter les interactions utilisateur
        for (const post of posts) {
            const userReaction = await PostReaction.findOne({ 
                where: { post_id: post.id, user_id: userId } 
            });
            const isSaved = await SavedPost.findOne({ 
                where: { post_id: post.id, user_id: userId } 
            });
            const hasReposted = await Repost.findOne({ 
                where: { original_post_id: post.id, user_id: userId } 
            });
            
            post.dataValues.user_reaction = userReaction?.reaction_type || null;
            post.dataValues.is_saved = !!isSaved;
            post.dataValues.has_reposted = !!hasReposted;
            post.dataValues.type = 'post';
        }
        
        res.status(200).json({
            success: true,
            data: posts,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                has_more: posts.length === parseInt(limit)
            }
        });
        
    } catch (error) {
        console.error('Erreur getPersonalizedFeed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}
    
    async getPagePosts(req, res) {
        try {
            const { page_id } = req.params;
            const { limit = 20, offset = 0 } = req.query;
            
            const posts = await Post.findAll({
                where: { container_type: 'page', container_id: page_id, is_deleted: false, status: 'active' },
                include: [{ model: User, as: 'author', attributes: ['id', 'first_name', 'avatar_url'] }],
                order: [['is_pinned', 'DESC'], ['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
            
            // Ajouter le type pour chaque post
            for (const post of posts) {
                post.dataValues.type = 'post';
            }
            
            res.status(200).json({ success: true, data: posts });
            
        } catch (error) {
            console.error('Erreur getPagePosts:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getGroupPosts(req, res) {
        try {
            const { group_id } = req.params;
            const { limit = 20, offset = 0 } = req.query;
            const userId = req.user.id;
            
            // Vérifier si membre pour les groupes privés
            const group = await Group.findByPk(group_id);
            if (group?.privacy_type === 'private') {
                const isMember = await GroupMember.findOne({ where: { group_id, user_id: userId, status: 'active' } });
                if (!isMember) {
                    return res.status(403).json({ success: false, error: 'Ce groupe est privé' });
                }
            }
            
            const posts = await Post.findAll({
                where: { container_type: 'group', container_id: group_id, is_deleted: false, status: 'active' },
                include: [{ model: User, as: 'author', attributes: ['id', 'first_name', 'avatar_url'] }],
                order: [['is_pinned', 'DESC'], ['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
            
            // Ajouter le type pour chaque post
            for (const post of posts) {
                post.dataValues.type = 'post';
            }
            
            res.status(200).json({ success: true, data: posts });
            
        } catch (error) {
            console.error('Erreur getGroupPosts:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getPostById(req, res) {
        try {
            const { post_id } = req.params;
            const userId = req.user?.id;
            
            const post = await Post.findByPk(post_id, {
                include: [
                    { model: User, as: 'author', attributes: ['id', 'first_name', 'avatar_url'] },
                    { model: Comment, as: 'comments', where: { is_deleted: false, parent_comment_id: null }, required: false, limit: 5,
                      include: [{ model: User, as: 'user', attributes: ['id', 'first_name', 'avatar_url'] }] }
                ]
            });
            
            if (!post || post.is_deleted) {
                return res.status(404).json({ success: false, error: 'Post non trouvé' });
            }
            
            if (userId) {
                const userReaction = await PostReaction.findOne({ where: { post_id, user_id: userId } });
                const isSaved = await SavedPost.findOne({ where: { post_id, user_id: userId } });
                const hasReposted = await Repost.findOne({ where: { original_post_id: post_id, user_id: userId } });
                
                post.dataValues.user_reaction = userReaction?.reaction_type || null;
                post.dataValues.is_saved = !!isSaved;
                post.dataValues.has_reposted = !!hasReposted;
            }
            
            post.dataValues.type = 'post';
            
            // Incrémenter les vues
            if (userId && userId !== post.author_id) {
                await PostView.create({ post_id, user_id: userId });
                await Post.increment('views_count', { by: 1, where: { id: post_id } });
                await Post.increment('unique_views_count', { by: 1, where: { id: post_id } });
            }
            
            res.status(200).json({ success: true, data: post });
            
        } catch (error) {
            console.error('Erreur getPostById:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getTrendingPosts(req, res) {
        try {
            const { limit = 20, offset = 0 } = req.query;
            
            const posts = await Post.findAll({
                where: { is_viral: true, is_deleted: false, status: 'active' },
                include: [{ model: User, as: 'author', attributes: ['id', 'first_name', 'avatar_url'] }],
                order: [['viral_score', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
            
            for (const post of posts) {
                post.dataValues.type = 'post';
            }
            
            res.status(200).json({ success: true, data: posts });
            
        } catch (error) {
            console.error('Erreur getTrendingPosts:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getPostsByHashtag(req, res) {
        try {
            const { tag } = req.params;
            const { limit = 20, offset = 0 } = req.query;
            
            // Utiliser ? pour les paramètres au lieu de $1, $2, $3
            const posts = await sequelize.query(
                `SELECT p.*, 
                        u.id as "author.id", 
                        u.first_name as "author.first_name", 
                        u.avatar_url as "author.avatar_url"
                FROM posts p
                LEFT JOIN users u ON p.author_id = u.id
                WHERE ? = ANY(p.hashtags)
                AND p.is_deleted = false 
                AND p.status = 'active'
                ORDER BY p.created_at DESC
                LIMIT ? OFFSET ?`,
                {
                    replacements: [tag, parseInt(limit), parseInt(offset)],
                    type: sequelize.QueryTypes.SELECT
                }
            );
            
            // Formater les résultats pour correspondre au format attendu
            const formattedPosts = posts.map(post => {
                const formattedPost = {
                    ...post,
                    author: {
                        id: post['author.id'],
                        first_name: post['author.first_name'],
                        avatar_url: post['author.avatar_url']
                    },
                    dataValues: {
                        type: 'post'
                    }
                };
                delete formattedPost['author.id'];
                delete formattedPost['author.first_name'];
                delete formattedPost['author.avatar_url'];
                return formattedPost;
            });
            
            res.status(200).json({ 
                success: true, 
                data: formattedPosts,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    has_more: formattedPosts.length === parseInt(limit)
                }
            });
            
        } catch (error) {
            console.error('Erreur getPostsByHashtag:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getSavedPosts(req, res) {
        try {
            const userId = req.user.id;
            const { limit = 20, offset = 0 } = req.query;
            
            const saved = await SavedPost.findAndCountAll({
                where: { user_id: userId },
                include: [{ model: Post, as: 'post', include: [{ model: User, as: 'author', attributes: ['id', 'first_name', 'avatar_url'] }] }],
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['created_at', 'DESC']]
            });
            
            const posts = saved.rows.map(s => {
                const post = s.post;
                post.dataValues.type = 'post';
                return post;
            });
            
            res.status(200).json({
                success: true,
                data: posts,
                pagination: { total: saved.count, limit: parseInt(limit), offset: parseInt(offset), has_more: parseInt(offset) + posts.length < saved.count }
            });
            
        } catch (error) {
            console.error('Erreur getSavedPosts:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // MODIFICATION
    // =====================================================
    
async updatePost(req, res) {
    try {
        const { post_id } = req.params;
        const userId = req.user.id;
        let { content, visibility, hashtags, replace_media = false } = req.body;
        
        // ✅ Convertir hashtags en tableau si ce n'est pas déjà le cas
        if (hashtags !== undefined && hashtags !== null) {
            if (typeof hashtags === 'string') {
                hashtags = hashtags.split(',').map(tag => tag.trim()).filter(tag => tag);
            } else if (!Array.isArray(hashtags)) {
                hashtags = [];
            }
        }
        
        const post = await Post.findByPk(post_id);
        if (!post) {
            return res.status(404).json({ success: false, error: 'Post non trouvé' });
        }
        
        // Vérifier les permissions
        let canEdit = post.author_id === userId;
        if (!canEdit && post.container_type === 'page') {
            const isAdmin = await PageAdmin.findOne({ 
                where: { page_id: post.container_id, user_id: userId } 
            });
            canEdit = !!isAdmin;
        } else if (!canEdit && post.container_type === 'group') {
            const isAdmin = await GroupMember.findOne({ 
                where: { group_id: post.container_id, user_id: userId, role: 'admin' } 
            });
            canEdit = !!isAdmin;
        }
        
        if (!canEdit) {
            return res.status(403).json({ 
                success: false, 
                error: 'Vous n\'êtes pas autorisé à modifier ce post' 
            });
        }
        
        // =====================================================
        // GESTION DES MÉDIAS (SANS SUPPRESSION SUR SUPABASE)
        // =====================================================
        
        let mediaFiles = post.media || [];
        
        // Si l'utilisateur veut remplacer les médias
        if (replace_media === true || replace_media === 'true') {
            // ⚠️ On ne supprime PAS les anciens médias de Supabase
            // On garde juste une trace dans la base de données
            // Les anciens URLs restent dans l'historique mais ne sont plus affichées
            
            // Upload des nouveaux médias uniquement
            mediaFiles = [];
            if (req.files && req.files.length > 0) {
                for (let i = 0; i < req.files.length; i++) {
                    const file = req.files[i];
                    const fileExt = file.originalname.split('.').pop();
                    const fileName = `post_${uuidv4()}_${Date.now()}_${i}.${fileExt}`;
                    
                    let mediaType = 'document';
                    if (file.mimetype.startsWith('image/')) mediaType = 'image';
                    else if (file.mimetype.startsWith('video/')) mediaType = 'video';
                    else if (file.mimetype.startsWith('audio/')) mediaType = 'audio';
                    
                    const folder = `posts/${post.container_type}/${post.container_id}/${mediaType}s`;
                    
                    const { url, thumbnail } = await uploadToSupabase(
                        'social-media', folder, file.buffer, file.mimetype, fileName
                    );
                    
                    mediaFiles.push({
                        type: mediaType, 
                        url, 
                        thumbnail: thumbnail || null,
                        mime_type: file.mimetype, 
                        size: file.size, 
                        duration: file.duration || null
                    });
                }
            }
        } 
        // Si l'utilisateur veut AJOUTER des médias (sans remplacer)
        else if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                const fileExt = file.originalname.split('.').pop();
                const fileName = `post_${uuidv4()}_${Date.now()}_${i}.${fileExt}`;
                
                let mediaType = 'document';
                if (file.mimetype.startsWith('image/')) mediaType = 'image';
                else if (file.mimetype.startsWith('video/')) mediaType = 'video';
                else if (file.mimetype.startsWith('audio/')) mediaType = 'audio';
                
                const folder = `posts/${post.container_type}/${post.container_id}/${mediaType}s`;
                
                const { url, thumbnail } = await uploadToSupabase(
                    'social-media', folder, file.buffer, file.mimetype, fileName
                );
                
                mediaFiles.push({
                    type: mediaType, 
                    url, 
                    thumbnail: thumbnail || null,
                    mime_type: file.mimetype, 
                    size: file.size, 
                    duration: file.duration || null
                });
            }
        }
        
        // Si l'utilisateur veut supprimer un média spécifique (seulement de l'affichage)
        if (req.body.remove_media_indexes) {
            let indexesToRemove = [];
            if (typeof req.body.remove_media_indexes === 'string') {
                indexesToRemove = req.body.remove_media_indexes.split(',').map(i => parseInt(i));
            } else if (Array.isArray(req.body.remove_media_indexes)) {
                indexesToRemove = req.body.remove_media_indexes;
            }
            
            // Supprimer les médias sélectionnés du tableau (mais pas de Supabase)
            for (const index of indexesToRemove.sort((a, b) => b - a)) {
                if (mediaFiles[index]) {
                    // On ne supprime PAS de Supabase, on enlève juste de l'affichage
                    console.log(`Média ${index} retiré de l'affichage mais toujours sur Supabase`);
                    mediaFiles.splice(index, 1);
                }
            }
        }
        
        // Construire l'objet de mise à jour
        const updateData = {};
        if (content !== undefined) updateData.content = content;
        if (visibility !== undefined) updateData.visibility = visibility;
        if (hashtags !== undefined) updateData.hashtags = hashtags;
        if (mediaFiles !== undefined) updateData.media = mediaFiles;
        
        // Mettre à jour is_album si nécessaire
        if (mediaFiles.length > 1) {
            updateData.is_album = true;
        } else if (mediaFiles.length <= 1 && post.media && post.media.length > 1) {
            updateData.is_album = false;
        }
        
        await post.update(updateData);
        
        res.status(200).json({ 
            success: true, 
            message: 'Post mis à jour avec succès', 
            data: {
                id: post.id,
                content: post.content,
                media: post.media,
                visibility: post.visibility,
                hashtags: post.hashtags,
                is_album: post.is_album,
                updated_at: post.updated_at
            }
        });
        
    } catch (error) {
        console.error('Erreur updatePost:', error);
        
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                success: false,
                error: 'Erreur de validation',
                errors: error.errors.map(e => ({
                    field: e.path,
                    message: e.message
                }))
            });
        }
        
        res.status(500).json({ success: false, error: error.message });
    }
}
    
    async pinPost(req, res) {
        try {
            const { post_id } = req.params;
            const userId = req.user.id;
            
            const post = await Post.findByPk(post_id);
            if (!post) {
                return res.status(404).json({ success: false, error: 'Post non trouvé' });
            }
            
            let isAdmin = false;
            if (post.container_type === 'page') {
                isAdmin = await PageAdmin.findOne({ where: { page_id: post.container_id, user_id: userId } });
            } else {
                isAdmin = await GroupMember.findOne({ where: { group_id: post.container_id, user_id: userId, role: 'admin' } });
            }
            
            if (!isAdmin) {
                return res.status(403).json({ success: false, error: 'Seul un administrateur peut épingler un post' });
            }
            
            await post.update({ is_pinned: true });
            
            res.status(200).json({ success: true, message: 'Post épinglé' });
            
        } catch (error) {
            console.error('Erreur pinPost:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async unpinPost(req, res) {
        try {
            const { post_id } = req.params;
            const userId = req.user.id;
            
            const post = await Post.findByPk(post_id);
            if (!post) {
                return res.status(404).json({ success: false, error: 'Post non trouvé' });
            }
            
            let isAdmin = false;
            if (post.container_type === 'page') {
                isAdmin = await PageAdmin.findOne({ where: { page_id: post.container_id, user_id: userId } });
            } else {
                isAdmin = await GroupMember.findOne({ where: { group_id: post.container_id, user_id: userId, role: 'admin' } });
            }
            
            if (!isAdmin) {
                return res.status(403).json({ success: false, error: 'Seul un administrateur peut détacher un post' });
            }
            
            await post.update({ is_pinned: false });
            
            res.status(200).json({ success: true, message: 'Post détaché' });
            
        } catch (error) {
            console.error('Erreur unpinPost:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async featurePost(req, res) {
        try {
            const { post_id } = req.params;
            const userId = req.user.id;
            
            const post = await Post.findByPk(post_id);
            if (!post) {
                return res.status(404).json({ success: false, error: 'Post non trouvé' });
            }
            
            let isAdmin = false;
            if (post.container_type === 'page') {
                isAdmin = await PageAdmin.findOne({ where: { page_id: post.container_id, user_id: userId } });
            } else {
                isAdmin = await GroupMember.findOne({ where: { group_id: post.container_id, user_id: userId, role: 'admin' } });
            }
            
            if (!isAdmin) {
                return res.status(403).json({ success: false, error: 'Seul un administrateur peut mettre en vedette un post' });
            }
            
            await post.update({ is_featured: true });
            
            res.status(200).json({ success: true, message: 'Post mis en vedette' });
            
        } catch (error) {
            console.error('Erreur featurePost:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // SUPPRESSION
    // =====================================================
    
    async deletePost(req, res) {
        try {
            const { post_id } = req.params;
            const userId = req.user.id;
            
            const post = await Post.findByPk(post_id);
            if (!post) {
                return res.status(404).json({ success: false, error: 'Post non trouvé' });
            }
            
            let canDelete = post.author_id === userId;
            if (!canDelete && post.container_type === 'page') {
                const isAdmin = await PageAdmin.findOne({ where: { page_id: post.container_id, user_id: userId } });
                canDelete = !!isAdmin;
            } else if (!canDelete && post.container_type === 'group') {
                const isAdmin = await GroupMember.findOne({ where: { group_id: post.container_id, user_id: userId, role: 'admin' } });
                canDelete = !!isAdmin;
            }
            
            if (!canDelete) {
                return res.status(403).json({ success: false, error: 'Vous n\'êtes pas autorisé à supprimer ce post' });
            }
            
            await post.update({ is_deleted: true, deleted_at: new Date(), status: 'deleted' });
            
            res.status(200).json({ success: true, message: 'Post supprimé' });
            
        } catch (error) {
            console.error('Erreur deletePost:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async deletePostFinal(req, res) {
        try {
            const { post_id } = req.params;
            
            if (req.user.role !== 'super_admin') {
                return res.status(403).json({ success: false, error: 'Action non autorisée' });
            }
            
            await Post.destroy({ where: { id: post_id } });
            
            res.status(200).json({ success: true, message: 'Post supprimé définitivement' });
            
        } catch (error) {
            console.error('Erreur deletePostFinal:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async restorePost(req, res) {
        try {
            const { post_id } = req.params;
            
            if (req.user.role !== 'super_admin') {
                return res.status(403).json({ success: false, error: 'Action non autorisée' });
            }
            
            await Post.update({ is_deleted: false, deleted_at: null, status: 'active' }, { where: { id: post_id } });
            
            res.status(200).json({ success: true, message: 'Post restauré' });
            
        } catch (error) {
            console.error('Erreur restorePost:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // RÉACTIONS
    // =====================================================
    
    async addReaction(req, res) {
        try {
            const { post_id } = req.params;
            const userId = req.user.id;
            const { reaction_type } = req.body;
            
            const existing = await PostReaction.findOne({ where: { post_id, user_id: userId } });
            
            if (existing) {
                if (existing.reaction_type === reaction_type) {
                    return res.status(400).json({ success: false, error: 'Vous avez déjà réagi avec ce type' });
                }
                await existing.update({ reaction_type });
            } else {
                await PostReaction.create({ post_id, user_id: userId, reaction_type });
            }
            
            // Mettre à jour les compteurs
            const counts = await PostReaction.findAll({
                where: { post_id },
                attributes: ['reaction_type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                group: ['reaction_type']
            });
            
            const updateData = { likes_count: 0, loves_count: 0, fires_count: 0, celebrates_count: 0 };
            for (const c of counts) {
                if (c.reaction_type === 'like') updateData.likes_count = parseInt(c.dataValues.count);
                else if (c.reaction_type === 'love') updateData.loves_count = parseInt(c.dataValues.count);
                else if (c.reaction_type === 'fire') updateData.fires_count = parseInt(c.dataValues.count);
                else if (c.reaction_type === 'celebrate') updateData.celebrates_count = parseInt(c.dataValues.count);
            }
            
            await Post.update(updateData, { where: { id: post_id } });
            await ViralService.calculateViralScore(post_id);
            
            // Notifier l'auteur
            const post = await Post.findByPk(post_id);
            if (post && post.author_id !== userId) {
                await NotificationService.sendSocialNotification(
                    post.author_id, post_id, 'like', userId, req.user.name, req.user.avatar, null
                );
            }
            
            res.status(200).json({ success: true, message: 'Réaction ajoutée' });
            
        } catch (error) {
            console.error('Erreur addReaction:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async removeReaction(req, res) {
        try {
            const { post_id } = req.params;
            const userId = req.user.id;
            
            await PostReaction.destroy({ where: { post_id, user_id: userId } });
            
            // Recalculer les compteurs
            const counts = await PostReaction.findAll({
                where: { post_id },
                attributes: ['reaction_type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                group: ['reaction_type']
            });
            
            const updateData = { likes_count: 0, loves_count: 0, fires_count: 0, celebrates_count: 0 };
            for (const c of counts) {
                if (c.reaction_type === 'like') updateData.likes_count = parseInt(c.dataValues.count);
                else if (c.reaction_type === 'love') updateData.loves_count = parseInt(c.dataValues.count);
                else if (c.reaction_type === 'fire') updateData.fires_count = parseInt(c.dataValues.count);
                else if (c.reaction_type === 'celebrate') updateData.celebrates_count = parseInt(c.dataValues.count);
            }
            
            await Post.update(updateData, { where: { id: post_id } });
            await ViralService.calculateViralScore(post_id);
            
            res.status(200).json({ success: true, message: 'Réaction retirée' });
            
        } catch (error) {
            console.error('Erreur removeReaction:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getReactions(req, res) {
        try {
            const { post_id } = req.params;
            
            const reactions = await PostReaction.findAll({
                where: { post_id },
                include: [{ model: User, as: 'user', attributes: ['id', 'first_name', 'avatar_url'] }],
                order: [['created_at', 'DESC']]
            });
            
            const counts = await PostReaction.findAll({
                where: { post_id },
                attributes: ['reaction_type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                group: ['reaction_type']
            });
            
            const countsObj = { like: 0, love: 0, fire: 0, celebrate: 0 };
            for (const c of counts) {
                if (c.reaction_type === 'like') countsObj.like = parseInt(c.dataValues.count);
                else if (c.reaction_type === 'love') countsObj.love = parseInt(c.dataValues.count);
                else if (c.reaction_type === 'fire') countsObj.fire = parseInt(c.dataValues.count);
                else if (c.reaction_type === 'celebrate') countsObj.celebrate = parseInt(c.dataValues.count);
            }
            
            res.status(200).json({ success: true, data: { users: reactions, counts: countsObj } });
            
        } catch (error) {
            console.error('Erreur getReactions:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getReactionsByType(req, res) {
        try {
            const { post_id, type } = req.params;
            const { limit = 20, offset = 0 } = req.query;
            
            const reactions = await PostReaction.findAll({
                where: { post_id, reaction_type: type },
                include: [{ model: User, as: 'user', attributes: ['id', 'first_name', 'avatar_url'] }],
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['created_at', 'DESC']]
            });
            
            res.status(200).json({ success: true, data: reactions.map(r => r.user) });
            
        } catch (error) {
            console.error('Erreur getReactionsByType:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // COMMENTAIRES
    // =====================================================
    
    async addComment(req, res) {
        const transaction = await sequelize.transaction();
        
        try {
            const { post_id } = req.params;
            const userId = req.user.id;
            const { content, parent_comment_id } = req.body;
            
            if (!content && (!req.files || req.files.length === 0)) {
                return res.status(400).json({ success: false, error: 'Le commentaire doit contenir du texte ou un média' });
            }
            
            let mediaFile = null;
            if (req.files && req.files.length > 0) {
                const file = req.files[0];
                const fileExt = file.originalname.split('.').pop();
                const fileName = `comment_${uuidv4()}_${Date.now()}.${fileExt}`;
                
                let mediaType = 'image';
                if (file.mimetype.startsWith('video/')) mediaType = 'video';
                else if (file.mimetype.startsWith('audio/')) mediaType = 'audio';
                
                const { url } = await uploadToSupabase(
                    'social-media', `comments/${post_id}/${mediaType}s`, file.buffer, file.mimetype, fileName
                );
                
                mediaFile = { type: mediaType, url, duration: file.duration || null };
            }
            
            const comment = await Comment.create({
                post_id, user_id: userId, content, parent_comment_id, media: mediaFile
            }, { transaction });
            
            await Post.increment('comments_count', { by: 1, where: { id: post_id }, transaction });
            
            if (parent_comment_id) {
                await Comment.increment('replies_count', { by: 1, where: { id: parent_comment_id }, transaction });
            }
            
            await transaction.commit();
            
            // Notifications
            const post = await Post.findByPk(post_id);
            if (post && post.author_id !== userId && !parent_comment_id) {
                await NotificationService.sendSocialNotification(
                    post.author_id, post_id, 'comment', userId, req.user.name, req.user.avatar, content?.substring(0, 100)
                );
            }
            
            if (parent_comment_id) {
                const parentComment = await Comment.findByPk(parent_comment_id);
                if (parentComment && parentComment.user_id !== userId) {
                    await NotificationService.sendSocialNotification(
                        parentComment.user_id, post_id, 'reply', userId, req.user.name, req.user.avatar, content?.substring(0, 100)
                    );
                }
            }
            
            res.status(201).json({ success: true, message: 'Commentaire ajouté', data: comment });
            
        } catch (error) {
            await transaction.rollback();
            console.error('Erreur addComment:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getComments(req, res) {
        try {
            const { post_id } = req.params;
            const { limit = 20, offset = 0, sort = 'newest' } = req.query;
            
            let order = [];
            if (sort === 'newest') order = [['created_at', 'DESC']];
            else if (sort === 'oldest') order = [['created_at', 'ASC']];
            else if (sort === 'popular') order = [['likes_count', 'DESC']];
            
            const comments = await Comment.findAll({
                where: { post_id, parent_comment_id: null, is_deleted: false },
                include: [{ model: User, as: 'user', attributes: ['id', 'first_name', 'avatar_url'] }],
                order,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
            
            res.status(200).json({ success: true, data: comments });
            
        } catch (error) {
            console.error('Erreur getComments:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async updateComment(req, res) {
        try {
            const { comment_id } = req.params;
            const userId = req.user.id;
            let { content } = req.body;
            
            const comment = await Comment.findByPk(comment_id);
            if (!comment) {
                return res.status(404).json({ success: false, error: 'Commentaire non trouvé' });
            }
            
            if (comment.user_id !== userId) {
                return res.status(403).json({ success: false, error: 'Vous n\'êtes pas autorisé' });
            }
            
            // =====================================================
            // GESTION DES MÉDIAS POUR COMMENTAIRE
            // =====================================================
            
            let mediaFile = comment.media || null;
            
            // Si l'utilisateur veut remplacer le média
            if (req.body.replace_media === 'true' || req.body.replace_media === true) {
                mediaFile = null;
                
                if (req.files && req.files.length > 0) {
                    const file = req.files[0];
                    const fileExt = file.originalname.split('.').pop();
                    const fileName = `comment_${uuidv4()}_${Date.now()}.${fileExt}`;
                    
                    let mediaType = 'image';
                    if (file.mimetype.startsWith('video/')) mediaType = 'video';
                    else if (file.mimetype.startsWith('audio/')) mediaType = 'audio';
                    
                    const { url } = await uploadToSupabase(
                        'social-media', 
                        `comments/${comment.post_id}/${mediaType}s`, 
                        file.buffer, 
                        file.mimetype, 
                        fileName
                    );
                    
                    mediaFile = { 
                        type: mediaType, 
                        url, 
                        duration: file.duration || null,
                        mime_type: file.mimetype,
                        size: file.size
                    };
                }
            }
            // Si l'utilisateur veut ajouter/supprimer un média
            else if (req.body.remove_media === 'true' || req.body.remove_media === true) {
                mediaFile = null;
            }
            // Si l'utilisateur veut ajouter un nouveau média (sans remplacer)
            else if (req.files && req.files.length > 0 && !comment.media) {
                const file = req.files[0];
                const fileExt = file.originalname.split('.').pop();
                const fileName = `comment_${uuidv4()}_${Date.now()}.${fileExt}`;
                
                let mediaType = 'image';
                if (file.mimetype.startsWith('video/')) mediaType = 'video';
                else if (file.mimetype.startsWith('audio/')) mediaType = 'audio';
                
                const { url } = await uploadToSupabase(
                    'social-media', 
                    `comments/${comment.post_id}/${mediaType}s`, 
                    file.buffer, 
                    file.mimetype, 
                    fileName
                );
                
                mediaFile = { 
                    type: mediaType, 
                    url, 
                    duration: file.duration || null,
                    mime_type: file.mimetype,
                    size: file.size
                };
            }
            
            // Construire l'objet de mise à jour
            const updateData = {};
            if (content !== undefined) updateData.content = content;
            if (mediaFile !== undefined) updateData.media = mediaFile;
            
            await comment.update(updateData);
            
            res.status(200).json({ 
                success: true, 
                message: 'Commentaire mis à jour', 
                data: comment 
            });
            
        } catch (error) {
            console.error('Erreur updateComment:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async deleteComment(req, res) {
        try {
            const { comment_id } = req.params;
            const userId = req.user.id;
            
            const comment = await Comment.findByPk(comment_id);
            if (!comment) {
                return res.status(404).json({ success: false, error: 'Commentaire non trouvé' });
            }
            
            if (comment.user_id !== userId) {
                return res.status(403).json({ success: false, error: 'Vous n\'êtes pas autorisé' });
            }
            
            await comment.update({ is_deleted: true });
            await Post.decrement('comments_count', { by: 1, where: { id: comment.post_id } });
            
            res.status(200).json({ success: true, message: 'Commentaire supprimé' });
            
        } catch (error) {
            console.error('Erreur deleteComment:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async pinComment(req, res) {
        try {
            const { comment_id } = req.params;
            const userId = req.user.id;
            
            const comment = await Comment.findByPk(comment_id);
            if (!comment) {
                return res.status(404).json({ success: false, error: 'Commentaire non trouvé' });
            }
            
            const post = await Post.findByPk(comment.post_id);
            let isAdmin = false;
            
            if (post.container_type === 'page') {
                isAdmin = await PageAdmin.findOne({ where: { page_id: post.container_id, user_id: userId } });
            } else {
                isAdmin = await GroupMember.findOne({ where: { group_id: post.container_id, user_id: userId, role: 'admin' } });
            }
            
            if (!isAdmin) {
                return res.status(403).json({ success: false, error: 'Seul un administrateur peut épingler un commentaire' });
            }
            
            await comment.update({ is_pinned: true });
            
            res.status(200).json({ success: true, message: 'Commentaire épinglé' });
            
        } catch (error) {
            console.error('Erreur pinComment:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // RÉPONSES
    // =====================================================
    
    async addReply(req, res) {
        const transaction = await sequelize.transaction();
        
        try {
            const { comment_id } = req.params;
            const userId = req.user.id;
            const { content } = req.body;
            
            if (!content && (!req.files || req.files.length === 0)) {
                return res.status(400).json({ success: false, error: 'La réponse doit contenir du texte ou un média' });
            }
            
            const parentComment = await Comment.findByPk(comment_id);
            if (!parentComment) {
                return res.status(404).json({ success: false, error: 'Commentaire non trouvé' });
            }
            
            let mediaFile = null;
            if (req.files && req.files.length > 0) {
                const file = req.files[0];
                const fileExt = file.originalname.split('.').pop();
                const fileName = `reply_${uuidv4()}_${Date.now()}.${fileExt}`;
                
                const { url } = await uploadToSupabase(
                    'social-media', `replies/${comment_id}`, file.buffer, file.mimetype, fileName
                );
                
                mediaFile = { url };
            }
            
            const reply = await Comment.create({
                post_id: parentComment.post_id, user_id: userId, content,
                parent_comment_id: comment_id, media: mediaFile
            }, { transaction });
            
            await Comment.increment('replies_count', { by: 1, where: { id: comment_id }, transaction });
            await Post.increment('comments_count', { by: 1, where: { id: parentComment.post_id }, transaction });
            
            await transaction.commit();
            
            // Notifier l'auteur du commentaire parent
            if (parentComment.user_id !== userId) {
                await NotificationService.sendSocialNotification(
                    parentComment.user_id, parentComment.post_id, 'reply',
                    userId, req.user.name, req.user.avatar, content?.substring(0, 100)
                );
            }
            
            res.status(201).json({ success: true, message: 'Réponse ajoutée', data: reply });
            
        } catch (error) {
            await transaction.rollback();
            console.error('Erreur addReply:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getReplies(req, res) {
        try {
            const { comment_id } = req.params;
            const { limit = 20, offset = 0 } = req.query;
            
            const replies = await Comment.findAll({
                where: { parent_comment_id: comment_id, is_deleted: false },
                include: [{ model: User, as: 'user', attributes: ['id', 'first_name', 'avatar_url'] }],
                order: [['created_at', 'ASC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
            
            res.status(200).json({ success: true, data: replies });
            
        } catch (error) {
            console.error('Erreur getReplies:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async updateReply(req, res) {
        try {
            const { reply_id } = req.params;
            const userId = req.user.id;
            const { content } = req.body;
            
            const reply = await Comment.findByPk(reply_id);
            if (!reply || !reply.parent_comment_id) {
                return res.status(404).json({ success: false, error: 'Réponse non trouvée' });
            }
            
            if (reply.user_id !== userId) {
                return res.status(403).json({ success: false, error: 'Vous n\'êtes pas autorisé' });
            }
            
            await reply.update({ content });
            
            res.status(200).json({ success: true, message: 'Réponse mise à jour', data: reply });
            
        } catch (error) {
            console.error('Erreur updateReply:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async deleteReply(req, res) {
        try {
            const { reply_id } = req.params;
            const userId = req.user.id;
            
            const reply = await Comment.findByPk(reply_id);
            if (!reply || !reply.parent_comment_id) {
                return res.status(404).json({ success: false, error: 'Réponse non trouvée' });
            }
            
            if (reply.user_id !== userId) {
                return res.status(403).json({ success: false, error: 'Vous n\'êtes pas autorisé' });
            }
            
            await reply.update({ is_deleted: true });
            await Comment.decrement('replies_count', { by: 1, where: { id: reply.parent_comment_id } });
            await Post.decrement('comments_count', { by: 1, where: { id: reply.post_id } });
            
            res.status(200).json({ success: true, message: 'Réponse supprimée' });
            
        } catch (error) {
            console.error('Erreur deleteReply:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // RÉACTIONS AUX COMMENTAIRES
    // =====================================================
    
    async addCommentReaction(req, res) {
        try {
            const { comment_id } = req.params;
            const userId = req.user.id;
            const { reaction_type } = req.body;
            
            const existing = await CommentReaction.findOne({ where: { comment_id, user_id: userId } });
            
            if (existing) {
                if (existing.reaction_type === reaction_type) {
                    return res.status(400).json({ success: false, error: 'Vous avez déjà réagi' });
                }
                await existing.update({ reaction_type });
            } else {
                await CommentReaction.create({ comment_id, user_id: userId, reaction_type });
            }
            
            const likeCount = await CommentReaction.count({ where: { comment_id, reaction_type: 'like' } });
            await Comment.update({ likes_count: likeCount }, { where: { id: comment_id } });
            
            res.status(200).json({ success: true, message: 'Réaction ajoutée' });
            
        } catch (error) {
            console.error('Erreur addCommentReaction:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async removeCommentReaction(req, res) {
        try {
            const { comment_id } = req.params;
            const userId = req.user.id;
            
            await CommentReaction.destroy({ where: { comment_id, user_id: userId } });
            
            const likeCount = await CommentReaction.count({ where: { comment_id, reaction_type: 'like' } });
            await Comment.update({ likes_count: likeCount }, { where: { id: comment_id } });
            
            res.status(200).json({ success: true, message: 'Réaction retirée' });
            
        } catch (error) {
            console.error('Erreur removeCommentReaction:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getCommentReactions(req, res) {
        try {
            const { comment_id } = req.params;
            
            const reactions = await CommentReaction.findAll({
                where: { comment_id },
                include: [{ model: User, as: 'user', attributes: ['id', 'first_name', 'avatar_url'] }],
                order: [['created_at', 'DESC']]
            });
            
            res.status(200).json({ success: true, data: reactions });
            
        } catch (error) {
            console.error('Erreur getCommentReactions:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // REPOSTS
    // =====================================================
    
    async repostPost(req, res) {
        try {
            const { post_id } = req.params;
            const userId = req.user.id;
            const { repost_type = 'simple', quote_content } = req.body;
            
            const existing = await Repost.findOne({ 
                where: { original_post_id: post_id, user_id: userId } 
            });
            
            if (existing) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Vous avez déjà reposté ce post' 
                });
            }
            
            // =====================================================
            // GESTION DES MÉDIAS POUR LE REPOST
            // =====================================================
            
            let mediaFiles = [];
            
            // Si l'utilisateur ajoute des médias à son repost
            if (req.files && req.files.length > 0) {
                for (let i = 0; i < req.files.length; i++) {
                    const file = req.files[i];
                    const fileExt = file.originalname.split('.').pop();
                    const fileName = `repost_${uuidv4()}_${Date.now()}_${i}.${fileExt}`;
                    
                    let mediaType = 'document';
                    if (file.mimetype.startsWith('image/')) mediaType = 'image';
                    else if (file.mimetype.startsWith('video/')) mediaType = 'video';
                    else if (file.mimetype.startsWith('audio/')) mediaType = 'audio';
                    
                    // Les reposts sont stockés dans un dossier "reposts"
                    const folder = `reposts/${post_id}/${mediaType}s`;
                    
                    const { url, thumbnail } = await uploadToSupabase(
                        'social-media', folder, file.buffer, file.mimetype, fileName
                    );
                    
                    mediaFiles.push({
                        type: mediaType, 
                        url, 
                        thumbnail: thumbnail || null,
                        mime_type: file.mimetype, 
                        size: file.size, 
                        duration: file.duration || null
                    });
                }
            }
            
            // Créer le repost avec ou sans médias
            const repost = await Repost.create({ 
                original_post_id: post_id, 
                user_id: userId, 
                repost_type, 
                quote_content,
                media: mediaFiles.length > 0 ? mediaFiles : null  // Ajout des médias
            });
            
            // Incrémenter le compteur
            await Post.increment('reposts_count', { by: 1, where: { id: post_id } });
            await ViralService.calculateViralScore(post_id);
            
            const post = await Post.findByPk(post_id);
            if (post && post.author_id !== userId) {
                await NotificationService.sendSocialNotification(
                    post.author_id, post_id, 'repost', userId, req.user.name, req.user.avatar, quote_content?.substring(0, 100)
                );
            }
            
            res.status(200).json({ 
                success: true, 
                message: 'Post reposté', 
                data: {
                    repost_id: repost.id,
                    has_media: mediaFiles.length > 0,
                    media_count: mediaFiles.length
                }
            });
            
        } catch (error) {
            console.error('Erreur repostPost:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async removeRepost(req, res) {
        try {
            const { post_id } = req.params;
            const userId = req.user.id;
            
            await Repost.destroy({ where: { original_post_id: post_id, user_id: userId } });
            await Post.decrement('reposts_count', { by: 1, where: { id: post_id } });
            await ViralService.calculateViralScore(post_id);
            
            res.status(200).json({ success: true, message: 'Repost retiré' });
            
        } catch (error) {
            console.error('Erreur removeRepost:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getReposts(req, res) {
        try {
            const { post_id } = req.params;
            const { limit = 20, offset = 0 } = req.query;
            
            const reposts = await Repost.findAll({
                where: { original_post_id: post_id },
                include: [{ model: User, as: 'user', attributes: ['id', 'first_name', 'avatar_url'] }],
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['created_at', 'DESC']]
            });
            
            res.status(200).json({ success: true, data: reposts });
            
        } catch (error) {
            console.error('Erreur getReposts:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // PARTAGES
    // =====================================================
    
    async sharePost(req, res) {
        try {
            const { post_id } = req.params;
            const userId = req.user.id;
            const { platform } = req.body;
            
            const shareUrl = `${process.env.FRONTEND_URL}/post/${post_id}`;
            
            await PostShare.create({ post_id, user_id: userId, platform, share_url: shareUrl });
            await Post.increment('shares_count', { by: 1, where: { id: post_id } });
            await ViralService.calculateViralScore(post_id);
            
            res.status(200).json({ success: true, message: 'Post partagé', data: { share_url: shareUrl } });
            
        } catch (error) {
            console.error('Erreur sharePost:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // SAUVEGARDE
    // =====================================================
    
    async savePost(req, res) {
        try {
            const { post_id } = req.params;
            const userId = req.user.id;
            const { collection_name = 'default' } = req.body;
            
            const existing = await SavedPost.findOne({ where: { post_id, user_id: userId, collection_name } });
            if (existing) {
                return res.status(400).json({ success: false, error: 'Post déjà sauvegardé' });
            }
            
            await SavedPost.create({ post_id, user_id: userId, collection_name });
            await Post.increment('saves_count', { by: 1, where: { id: post_id } });
            
            res.status(200).json({ success: true, message: 'Post sauvegardé' });
            
        } catch (error) {
            console.error('Erreur savePost:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async unsavePost(req, res) {
        try {
            const { post_id } = req.params;
            const userId = req.user.id;
            
            await SavedPost.destroy({ where: { post_id, user_id: userId } });
            await Post.decrement('saves_count', { by: 1, where: { id: post_id } });
            
            res.status(200).json({ success: true, message: 'Post retiré des sauvegardes' });
            
        } catch (error) {
            console.error('Erreur unsavePost:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async isSaved(req, res) {
        try {
            const { post_id } = req.params;
            const userId = req.user.id;
            
            const saved = await SavedPost.findOne({ where: { post_id, user_id: userId } });
            
            res.status(200).json({ success: true, data: { is_saved: !!saved } });
            
        } catch (error) {
            console.error('Erreur isSaved:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // VUES
    // =====================================================
    
    async recordView(req, res) {
        try {
            const { post_id } = req.params;
            const userId = req.user.id;
            const { watch_duration_seconds = 0, watch_percentage = 0, completed = false } = req.body;
            
            const existing = await PostView.findOne({ where: { post_id, user_id: userId } });
            
            if (existing) {
                await existing.update({ watch_duration_seconds, watch_percentage, completed, viewed_at: new Date() });
            } else {
                await PostView.create({ post_id, user_id: userId, watch_duration_seconds, watch_percentage, completed });
                await Post.increment('unique_views_count', { by: 1, where: { id: post_id } });
            }
            
            await Post.increment('views_count', { by: 1, where: { id: post_id } });
            await ViralService.calculateViralScore(post_id);
            
            res.status(200).json({ success: true, message: 'Vue enregistrée' });
            
        } catch (error) {
            console.error('Erreur recordView:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // SIGNALEMENTS
    // =====================================================
    
    async reportPost(req, res) {
        try {
            const { post_id } = req.params;
            const userId = req.user.id;
            const { reason, description } = req.body;
            
            const existing = await Report.findOne({ where: { target_type: 'post', target_id: post_id, reporter_id: userId } });
            if (existing) {
                return res.status(400).json({ success: false, error: 'Vous avez déjà signalé ce post' });
            }
            
            await Report.create({ target_type: 'post', target_id: post_id, reporter_id: userId, reason, description });
            await Post.increment('reported_count', { by: 1, where: { id: post_id } });
            
            res.status(201).json({ success: true, message: 'Signalement envoyé' });
            
        } catch (error) {
            console.error('Erreur reportPost:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async reportComment(req, res) {
        try {
            const { comment_id } = req.params;
            const userId = req.user.id;
            const { reason, description } = req.body;
            
            const existing = await Report.findOne({ where: { target_type: 'comment', target_id: comment_id, reporter_id: userId } });
            if (existing) {
                return res.status(400).json({ success: false, error: 'Vous avez déjà signalé ce commentaire' });
            }
            
            await Report.create({ target_type: 'comment', target_id: comment_id, reporter_id: userId, reason, description });
            
            res.status(201).json({ success: true, message: 'Signalement envoyé' });
            
        } catch (error) {
            console.error('Erreur reportComment:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // HASHTAGS
    // =====================================================
    
    async getPopularHashtags(req, res) {
        try {
            const { limit = 20 } = req.query;
            
            const posts = await Post.findAll({
                where: { is_deleted: false, status: 'active' },
                attributes: ['hashtags'],
                limit: 1000
            });
            
            const hashtagCount = {};
            for (const post of posts) {
                if (post.hashtags && post.hashtags.length) {
                    for (const tag of post.hashtags) {
                        hashtagCount[tag] = (hashtagCount[tag] || 0) + 1;
                    }
                }
            }
            
            const sorted = Object.entries(hashtagCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, parseInt(limit))
                .map(([tag, count]) => ({ tag, count }));
            
            res.status(200).json({ success: true, data: sorted });
            
        } catch (error) {
            console.error('Erreur getPopularHashtags:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // UPLOAD TEMPORAIRE
    // =====================================================
    
    async uploadTempMedia(req, res) {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ success: false, error: 'Aucun fichier fourni' });
            }
            
            const uploadedFiles = [];
            
            for (const file of req.files) {
                const fileExt = file.originalname.split('.').pop();
                const fileName = `temp_${uuidv4()}_${Date.now()}.${fileExt}`;
                
                let mediaType = 'document';
                if (file.mimetype.startsWith('image/')) mediaType = 'image';
                else if (file.mimetype.startsWith('video/')) mediaType = 'video';
                else if (file.mimetype.startsWith('audio/')) mediaType = 'audio';
                
                const { url } = await uploadToSupabase(
                    'social-media', 'temp', file.buffer, file.mimetype, fileName
                );
                
                uploadedFiles.push({ url, type: mediaType, name: file.originalname, size: file.size });
            }
            
            res.status(200).json({ success: true, data: uploadedFiles });
            
        } catch (error) {
            console.error('Erreur uploadTempMedia:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // MÉTHODES PRIVÉES
    // =====================================================

    async notifyContainerMembers(container_type, container_id, post_id, author_id) {
        try {
            let members = [];
            
            if (container_type === 'page') {
                const followers = await PageFollower.findAll({ 
                    where: { page_id: container_id }, 
                    attributes: ['user_id'] 
                });
                members = followers.map(f => f.user_id);
            } else if (container_type === 'group') {
                const groupMembers = await GroupMember.findAll({ 
                    where: { group_id: container_id, status: 'active' }, 
                    attributes: ['user_id'] 
                });
                members = groupMembers.map(m => m.user_id);
            }
            
            for (const memberId of members) {
                if (memberId !== author_id) {
                    await NotificationService.sendSocialNotification(
                        memberId, post_id, 'new_post', author_id, null, null, null
                    );
                    SocketService.sendToUser(memberId, 'feed:new_post', { 
                        post_id, 
                        container_type, 
                        container_id 
                    });
                }
            }
            
        } catch (error) {
            console.error('Erreur notifyContainerMembers:', error);
        }
    }
}

module.exports = new PostController();  