const { sequelize } = require('../../config/database');
const { Post, User, Page, Group, PageFollower, GroupMember, PostView, PostReaction, Comment, Hashtag } = require('../../models');
const ViralService = require('../../services/social/viralService');
const { Op } = require('sequelize');

class ViralController {
    
    // =====================================================
    // TRENDING POSTS
    // =====================================================
    
    async getTrendingPosts(req, res) {
        try {
            const { limit = 20, offset = 0, time_range = '24h' } = req.query;
            
            let interval = '24 hours';
            switch (time_range) {
                case '7d': interval = '7 days'; break;
                case '30d': interval = '30 days'; break;
                case '1h': interval = '1 hour'; break;
                default: interval = '24 hours';
            }
            
            const posts = await Post.findAll({
                where: {
                    is_deleted: false,
                    status: 'active',
                    created_at: { [Op.gte]: sequelize.literal(`NOW() - INTERVAL '${interval}'`) }
                },
                include: [
                    { model: User, as: 'author', attributes: ['id', 'first_name', 'avatar_url'] }
                ],
                order: [
                    ['viral_score', 'DESC'],
                    ['engagement_score', 'DESC']
                ],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
            
            // Ajouter les métriques récentes
            const postsWithMetrics = await Promise.all(posts.map(async (post) => {
                const recentViews = await PostView.count({
                    where: {
                        post_id: post.id,
                        viewed_at: { [Op.gte]: sequelize.literal(`NOW() - INTERVAL '${interval}'`) }
                    }
                });
                
                const recentReactions = await PostReaction.count({
                    where: {
                        post_id: post.id,
                        created_at: { [Op.gte]: sequelize.literal(`NOW() - INTERVAL '${interval}'`) }
                    }
                });
                
                return {
                    ...post.toJSON(),
                    recent_views: recentViews,
                    recent_reactions: recentReactions
                };
            }));
            
            res.status(200).json({
                success: true,
                data: postsWithMetrics,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    has_more: postsWithMetrics.length === parseInt(limit)
                }
            });
            
        } catch (error) {
            console.error('Erreur getTrendingPosts:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getTrendingByCategory(req, res) {
        try {
            const { category } = req.params;
            const { limit = 20, offset = 0 } = req.query;
            
            // Récupérer les pages de cette catégorie
            const pages = await Page.findAll({
                where: { category, is_deleted: false },
                attributes: ['id']
            });
            
            const pageIds = pages.map(p => p.id);
            
            if (pageIds.length === 0) {
                return res.status(200).json({ 
                    success: true, 
                    data: [], 
                    pagination: { 
                        total: 0, 
                        limit: parseInt(limit), 
                        offset: parseInt(offset), 
                        has_more: false 
                    } 
                });
            }
            
            const posts = await Post.findAll({
                where: {
                    container_type: 'page',
                    container_id: { [Op.in]: pageIds },
                    is_deleted: false,
                    status: 'active',
                    created_at: { [Op.gte]: sequelize.literal("NOW() - INTERVAL '7 days'") }
                },
                include: [
                    { model: User, as: 'author', attributes: ['id', 'first_name', 'last_name', 'avatar_url'] }
                ],
                order: [['viral_score', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
            
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
            console.error('Erreur getTrendingByCategory:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getTrendingByHashtag(req, res) {
        try {
            const { tag } = req.params;
            const { limit = 20, offset = 0 } = req.query;
            
            // Version avec SQL brut et conversion de type explicite
            const posts = await sequelize.query(
                `SELECT p.*, 
                        u.id as "author.id", 
                        u.first_name as "author.first_name", 
                        u.avatar_url as "author.avatar_url"
                FROM posts p
                LEFT JOIN users u ON p.author_id = u.id
                WHERE $1 = ANY(p.hashtags::text[])
                AND p.is_deleted = false 
                AND p.status = 'active'
                AND p.created_at >= NOW() - INTERVAL '7 days'
                ORDER BY p.viral_score DESC
                LIMIT $2 OFFSET $3`,
                {
                    bind: [tag, parseInt(limit), parseInt(offset)],
                    type: sequelize.QueryTypes.SELECT
                }
            );
            
            // Formater les résultats
            const formattedPosts = posts.map(post => {
                const formattedPost = {
                    ...post,
                    author: {
                        id: post['author.id'],
                        first_name: post['author.first_name'],
                        avatar_url: post['author.avatar_url']
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
            console.error('Erreur getTrendingByHashtag:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // RECOMMANDATIONS PERSONNALISÉES (CORRIGÉ)
    // =====================================================
    
async getPersonalizedRecommendations(req, res) {
    try {
        const userId = req.user.id;
        const { limit = 20, offset = 0 } = req.query;
        
        // Récupérer les hashtags des posts de l'utilisateur
        const userPosts = await Post.findAll({
            where: { author_id: userId, is_deleted: false },
            attributes: ['hashtags'],
            limit: 50
        });
        
        const userHashtags = new Set();
        for (const post of userPosts) {
            if (post.hashtags && Array.isArray(post.hashtags)) {
                post.hashtags.forEach(tag => {
                    // Nettoyer les hashtags qui contiennent des guillemets
                    let cleanTag = tag;
                    if (typeof tag === 'string') {
                        cleanTag = tag.replace(/[\[\]"]/g, '');
                    }
                    if (cleanTag && cleanTag.length > 0 && cleanTag !== 'bienvenue' && cleanTag !== 'community') {
                        userHashtags.add(cleanTag);
                    }
                });
            }
        }
        
        // Récupérer les pages suivies et groupes membres
        const followedPages = await PageFollower.findAll({
            where: { user_id: userId },
            attributes: ['page_id']
        });
        
        const memberGroups = await GroupMember.findAll({
            where: { user_id: userId, status: 'active' },
            attributes: ['group_id']
        });
        
        const followedPageIds = followedPages.map(f => f.page_id);
        const memberGroupIds = memberGroups.map(m => m.group_id);
        
        let recommendations = [];
        
        // Si l'utilisateur a des hashtags, chercher des posts similaires
        if (userHashtags.size > 0) {
            const hashtagArray = Array.from(userHashtags).slice(0, 10);
            
            // Construire la requête SQL avec les bons paramètres
            let sqlQuery = `
                SELECT p.*, 
                        u.id as "author.id", 
                        u.first_name as "author.first_name", 
                        u.avatar_url as "author.avatar_url"
                FROM posts p
                LEFT JOIN users u ON p.author_id = u.id
                WHERE p.is_deleted = false 
                AND p.status = 'active'
                AND p.author_id != $1
            `;
            
            const queryParams = [userId];
            let paramIndex = 2;
            
            // Ajouter la condition des hashtags
            if (hashtagArray.length > 0) {
                const hashtagConditions = hashtagArray.map((_, i) => `$${paramIndex + i}`).join(', ');
                sqlQuery += ` AND p.hashtags::text[] && ARRAY[${hashtagConditions}]::text[]`;
                queryParams.push(...hashtagArray);
                paramIndex += hashtagArray.length;
            }
            
            // Exclure les pages déjà suivies
            if (followedPageIds.length > 0) {
                sqlQuery += ` AND NOT (p.container_type = 'page' AND p.container_id = ANY($${paramIndex}::uuid[]))`;
                queryParams.push(followedPageIds);
                paramIndex++;
            }
            
            // Exclure les groupes déjà membres
            if (memberGroupIds.length > 0) {
                sqlQuery += ` AND NOT (p.container_type = 'group' AND p.container_id = ANY($${paramIndex}::uuid[]))`;
                queryParams.push(memberGroupIds);
                paramIndex++;
            }
            
            // Ajouter le tri et les limites
            sqlQuery += ` ORDER BY p.viral_score DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            queryParams.push(parseInt(limit), parseInt(offset));
            
            const hashtagPosts = await sequelize.query(sqlQuery, {
                bind: queryParams,
                type: sequelize.QueryTypes.SELECT
            });
            
            recommendations = hashtagPosts.map(post => ({
                ...post,
                author: {
                    id: post['author.id'],
                    first_name: post['author.first_name'],
                    avatar_url: post['author.avatar_url']
                }
            }));
        }
        
        // Si pas assez de recommandations, ajouter des posts viraux généraux
        if (recommendations.length < parseInt(limit)) {
            const remainingLimit = parseInt(limit) - recommendations.length;
            const excludeIds = recommendations.map(r => r.id);
            
            let viralSql = `
                SELECT p.*, 
                        u.id as "author.id", 
                        u.first_name as "author.first_name", 
                        u.avatar_url as "author.avatar_url"
                FROM posts p
                LEFT JOIN users u ON p.author_id = u.id
                WHERE p.is_viral = true
                AND p.author_id != $1
                AND p.is_deleted = false 
                AND p.status = 'active'
            `;
            
            const viralParams = [userId];
            let viralParamIndex = 2;
            
            if (excludeIds.length > 0) {
                viralSql += ` AND p.id != ANY($${viralParamIndex}::uuid[])`;
                viralParams.push(excludeIds);
                viralParamIndex++;
            }
            
            viralSql += ` ORDER BY p.viral_score DESC LIMIT $${viralParamIndex} OFFSET $${viralParamIndex + 1}`;
            viralParams.push(remainingLimit, 0);
            
            const viralPosts = await sequelize.query(viralSql, {
                bind: viralParams,
                type: sequelize.QueryTypes.SELECT
            });
            
            const formattedViralPosts = viralPosts.map(post => ({
                ...post,
                author: {
                    id: post['author.id'],
                    first_name: post['author.first_name'],
                    avatar_url: post['author.avatar_url']
                }
            }));
            
            recommendations.push(...formattedViralPosts);
        }
        
        // Nettoyer les objets pour enlever les champs temporaires
        const cleanRecommendations = recommendations.map(post => {
            const cleanPost = { ...post };
            delete cleanPost['author.id'];
            delete cleanPost['author.first_name'];
            delete cleanPost['author.avatar_url'];
            return cleanPost;
        });
        
        res.status(200).json({
            success: true,
            data: cleanRecommendations,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                has_more: cleanRecommendations.length === parseInt(limit)
            }
        });
        
    } catch (error) {
        console.error('Erreur getPersonalizedRecommendations:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}
    
    // =====================================================
    // ANALYTICS VIRAL (Admin)
    // =====================================================
    
    async getGlobalViralAnalytics(req, res) {
        try {
            const { time_range = '7d' } = req.query;
            
            // Vérifier si admin
            if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
                return res.status(403).json({ success: false, error: 'Accès non autorisé' });
            }
            
            let interval = '7 days';
            switch (time_range) {
                case '24h': interval = '24 hours'; break;
                case '30d': interval = '30 days'; break;
                default: interval = '7 days';
            }
            
            const analytics = await ViralService.getViralAnalytics(time_range);
            
            // Top posts viraux
            const topPosts = await Post.findAll({
                where: {
                    is_viral: true,
                    created_at: { [Op.gte]: sequelize.literal(`NOW() - INTERVAL '${interval}'`) }
                },
                include: [
                    { model: User, as: 'author', attributes: ['id', 'first_name', 'avatar_url'] }
                ],
                order: [['viral_score', 'DESC']],
                limit: 10
            });
            
            // Top créateurs
            const topCreators = await User.findAll({
                include: [{
                    model: Post,
                    as: 'posts',
                    where: {
                        is_viral: true,
                        created_at: { [Op.gte]: sequelize.literal(`NOW() - INTERVAL '${interval}'`) }
                    },
                    required: true,
                    attributes: []
                }],
                attributes: [
                    'id', 'first_name', 'avatar_url',
                    [sequelize.fn('COUNT', sequelize.col('posts.id')), 'viral_posts_count'],
                    [sequelize.fn('AVG', sequelize.col('posts.viral_score')), 'avg_viral_score']
                ],
                group: ['User.id', 'User.first_name', 'User.avatar_url'],
                order: [[sequelize.fn('AVG', sequelize.col('posts.viral_score')), 'DESC']],
                limit: 10
            });
            
            // Trending hashtags
            const trendingHashtags = await ViralService.getTrendingHashtags(20);
            
            res.status(200).json({
                success: true,
                data: {
                    global: analytics,
                    top_posts: topPosts,
                    top_creators: topCreators,
                    trending_hashtags: trendingHashtags
                }
            });
            
        } catch (error) {
            console.error('Erreur getGlobalViralAnalytics:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getPostViralAnalytics(req, res) {
        try {
            const { post_id } = req.params;
            
            const post = await Post.findByPk(post_id, {
                include: [
                    { model: User, as: 'author', attributes: ['id', 'first_name', 'avatar_url'] }
                ]
            });
            
            if (!post) {
                return res.status(404).json({ success: false, error: 'Post non trouvé' });
            }
            
            // Vérifier si l'utilisateur est l'auteur ou admin
            if (post.author_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
                return res.status(403).json({ success: false, error: 'Accès non autorisé' });
            }
            
            // Récupérer les métriques détaillées
            const stats = await ViralService.getPostStats(post_id);
            
            // Récupérer l'évolution du score viral (par heure)
            const hourlyProgress = await PostView.findAll({
                where: { post_id },
                attributes: [
                    [sequelize.fn('DATE_TRUNC', 'hour', sequelize.col('viewed_at')), 'hour'],
                    [sequelize.fn('COUNT', sequelize.col('id')), 'views']
                ],
                group: [sequelize.fn('DATE_TRUNC', 'hour', sequelize.col('viewed_at'))],
                order: [[sequelize.fn('DATE_TRUNC', 'hour', sequelize.col('viewed_at')), 'ASC']],
                limit: 72
            });
            
            // Réactions par type
            const reactionsByType = await PostReaction.findAll({
                where: { post_id },
                attributes: ['reaction_type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                group: ['reaction_type']
            });
            
            res.status(200).json({
                success: true,
                data: {
                    post: post,
                    stats: stats,
                    hourly_progress: hourlyProgress,
                    reactions_by_type: reactionsByType,
                    viral_threshold: 1000,
                    current_viral_score: post.viral_score,
                    is_viral: post.is_viral
                }
            });
            
        } catch (error) {
            console.error('Erreur getPostViralAnalytics:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // MISE À JOUR DES SCORES (Cron Job)
    // =====================================================
    
    async updateViralScores(req, res) {
        try {
            // Vérifier si admin
            if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
                return res.status(403).json({ success: false, error: 'Accès non autorisé' });
            }
            
            const result = await ViralService.batchUpdateViralScores();
            
            res.status(200).json({
                success: true,
                message: `Mise à jour terminée: ${result.updated} posts mis à jour sur ${result.total}`,
                data: result
            });
            
        } catch (error) {
            console.error('Erreur updateViralScores:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new ViralController();