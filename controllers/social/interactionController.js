const { sequelize } = require('../../config/database');
const { 
     Post,
    Comment,PostReaction, CommentReaction, Repost, SavedPost, 
    Notification, NotificationPreference, User 
} = require('../../models');
const NotificationService = require('../../services/notification/NotificationService');
const PreferenceService = require('../../services/notification/PreferenceService');
const { Op } = require('sequelize');

class InteractionController {
    
    // =====================================================
    // RÉACTIONS UNIFIÉES
    // =====================================================
    
    async react(req, res) {
        const transaction = await sequelize.transaction();
        
        try {
            const userId = req.user.id;
            const { target_type, target_id, reaction_type } = req.body;
            
            let result;
            let postId = null;
            
            switch (target_type) {
                case 'post':
                    result = await this.handlePostReaction(userId, target_id, reaction_type, transaction);
                    postId = target_id;
                    break;
                case 'comment':
                    result = await this.handleCommentReaction(userId, target_id, reaction_type, transaction);
                    const comment = await Comment.findByPk(target_id);
                    postId = comment?.post_id;
                    break;
                case 'reply':
                    result = await this.handleReplyReaction(userId, target_id, reaction_type, transaction);
                    const reply = await Comment.findByPk(target_id);
                    postId = reply?.post_id;
                    break;
                case 'repost':
                    result = await this.handleRepostReaction(userId, target_id, reaction_type, transaction);
                    const repost = await Repost.findByPk(target_id);
                    postId = repost?.original_post_id;
                    break;
                default:
                    return res.status(400).json({ success: false, error: 'Type de cible invalide' });
            }
            
            await transaction.commit();
            
            // Mettre à jour le score viral
            if (postId) {
                const ViralService = require('../../services/social/viralService');
                await ViralService.calculateViralScore(postId);
            }
            
            res.status(200).json({
                success: true,
                message: 'Réaction enregistrée',
                data: result
            });
            
        } catch (error) {
            await transaction.rollback();
            console.error('Erreur react:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async handlePostReaction(userId, postId, reactionType, transaction) {
        const existing = await PostReaction.findOne({
            where: { post_id: postId, user_id: userId },
            transaction
        });
        
        if (existing) {
            if (existing.reaction_type === reactionType) {
                throw new Error('Vous avez déjà réagi avec ce type');
            }
            await existing.update({ reaction_type: reactionType }, { transaction });
        } else {
            await PostReaction.create({
                post_id: postId,
                user_id: userId,
                reaction_type: reactionType
            }, { transaction });
        }
        
        // Mettre à jour les compteurs
        const counts = await PostReaction.findAll({
            where: { post_id: postId },
            attributes: ['reaction_type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
            group: ['reaction_type'],
            transaction
        });
        
        const updateData = { likes_count: 0, loves_count: 0, fires_count: 0, celebrates_count: 0 };
        for (const c of counts) {
            if (c.reaction_type === 'like') updateData.likes_count = parseInt(c.dataValues.count);
            else if (c.reaction_type === 'love') updateData.loves_count = parseInt(c.dataValues.count);
            else if (c.reaction_type === 'fire') updateData.fires_count = parseInt(c.dataValues.count);
            else if (c.reaction_type === 'celebrate') updateData.celebrates_count = parseInt(c.dataValues.count);
        }
        
        await Post.update(updateData, { where: { id: postId }, transaction });
        
        // Notifier l'auteur
        const post = await Post.findByPk(postId, { transaction });
        if (post && post.author_id !== userId) {
            await NotificationService.sendSocialNotification(
                post.author_id, postId, 'like', userId, null, null, null
            );
        }
        
        return { success: true, reaction_type: reactionType };
    }
    
    async handleCommentReaction(userId, commentId, reactionType, transaction) {
        const existing = await CommentReaction.findOne({
            where: { comment_id: commentId, user_id: userId },
            transaction
        });
        
        if (existing) {
            if (existing.reaction_type === reactionType) {
                throw new Error('Vous avez déjà réagi avec ce type');
            }
            await existing.update({ reaction_type: reactionType }, { transaction });
        } else {
            await CommentReaction.create({
                comment_id: commentId,
                user_id: userId,
                reaction_type: reactionType
            }, { transaction });
        }
        
        const likeCount = await CommentReaction.count({
            where: { comment_id: commentId, reaction_type: 'like' },
            transaction
        });
        
        await Comment.update({ likes_count: likeCount }, { where: { id: commentId }, transaction });
        
        return { success: true, reaction_type: reactionType };
    }
    
    async handleReplyReaction(userId, replyId, reactionType, transaction) {
        // Les replies sont aussi dans la table comments avec parent_comment_id non null
        return this.handleCommentReaction(userId, replyId, reactionType, transaction);
    }
    
    async handleRepostReaction(userId, repostId, reactionType, transaction) {
        const existing = await RepostReaction.findOne({
            where: { repost_id: repostId, user_id: userId },
            transaction
        });
        
        if (existing) {
            if (existing.reaction_type === reactionType) {
                throw new Error('Vous avez déjà réagi avec ce type');
            }
            await existing.update({ reaction_type: reactionType }, { transaction });
        } else {
            await RepostReaction.create({
                repost_id: repostId,
                user_id: userId,
                reaction_type: reactionType
            }, { transaction });
        }
        
        const likeCount = await RepostReaction.count({
            where: { repost_id: repostId, reaction_type: 'like' },
            transaction
        });
        
        await Repost.update({ likes_count: likeCount }, { where: { id: repostId }, transaction });
        
        return { success: true, reaction_type: reactionType };
    }
    
    async removeReaction(req, res) {
        try {
            const userId = req.user.id;
            const { target_type, target_id } = req.body;
            
            switch (target_type) {
                case 'post':
                    await PostReaction.destroy({ where: { post_id: target_id, user_id: userId } });
                    break;
                case 'comment':
                    await CommentReaction.destroy({ where: { comment_id: target_id, user_id: userId } });
                    break;
                case 'reply':
                    await CommentReaction.destroy({ where: { comment_id: target_id, user_id: userId } });
                    break;
                case 'repost':
                    await RepostReaction.destroy({ where: { repost_id: target_id, user_id: userId } });
                    break;
                default:
                    return res.status(400).json({ success: false, error: 'Type de cible invalide' });
            }
            
            res.status(200).json({
                success: true,
                message: 'Réaction retirée'
            });
            
        } catch (error) {
            console.error('Erreur removeReaction:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // NOTIFICATIONS
    // =====================================================
    
    async markAllNotificationsRead(req, res) {
        try {
            const userId = req.user.id;
            
            const [updatedCount] = await Notification.update(
                { status: 'read', read_at: new Date() },
                { where: { user_id: userId, status: ['pending', 'delivered'] } }
            );
            
            res.status(200).json({
                success: true,
                message: `${updatedCount} notification(s) marquée(s) comme lue(s)`,
                count: updatedCount
            });
            
        } catch (error) {
            console.error('Erreur markAllNotificationsRead:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getNotificationPreferences(req, res) {
        try {
            const userId = req.user.id;
            const preferences = await PreferenceService.getPreferences(userId);
            
            res.status(200).json({
                success: true,
                data: preferences
            });
            
        } catch (error) {
            console.error('Erreur getNotificationPreferences:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async updateNotificationPreferences(req, res) {
        try {
            const userId = req.user.id;
            const updates = req.body;
            
            const preferences = await PreferenceService.updatePreferences(userId, updates);
            
            res.status(200).json({
                success: true,
                message: 'Préférences mises à jour',
                data: preferences
            });
            
        } catch (error) {
            console.error('Erreur updateNotificationPreferences:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // ACTIVITÉ UTILISATEUR
    // =====================================================
    
    async getUserActivity(req, res) {
        try {
            const userId = req.user.id;
            const { limit = 50, offset = 0, type = 'all' } = req.query;
            
            let activities = [];
            
            // Posts créés
            const posts = await Post.findAll({
                where: { author_id: userId, is_deleted: false },
                attributes: ['id', 'content', 'created_at'],
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['created_at', 'DESC']]
            });
            
            activities.push(...posts.map(p => ({
                type: 'post_created',
                id: p.id,
                content: p.content?.substring(0, 100),
                created_at: p.created_at
            })));
            
            // Commentaires
            const comments = await Comment.findAll({
                where: { user_id: userId, is_deleted: false },
                include: [{ model: Post, as: 'post', attributes: ['id'] }],
                attributes: ['id', 'content', 'created_at', 'post_id'],
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['created_at', 'DESC']]
            });
            
            activities.push(...comments.map(c => ({
                type: 'comment',
                id: c.id,
                content: c.content?.substring(0, 100),
                post_id: c.post_id,
                created_at: c.created_at
            })));
            
            // Réactions
            const reactions = await PostReaction.findAll({
                where: { user_id: userId },
                include: [{ model: Post, as: 'post', attributes: ['id'] }],
                attributes: ['reaction_type', 'created_at', 'post_id'],
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['created_at', 'DESC']]
            });
            
            activities.push(...reactions.map(r => ({
                type: 'reaction',
                reaction_type: r.reaction_type,
                post_id: r.post_id,
                created_at: r.created_at
            })));
            
            // Reposts
            const reposts = await Repost.findAll({
                where: { user_id: userId },
                include: [{ model: Post, as: 'original_post', attributes: ['id'] }],
                attributes: ['repost_type', 'created_at', 'original_post_id'],
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['created_at', 'DESC']]
            });
            
            activities.push(...reposts.map(r => ({
                type: 'repost',
                repost_type: r.repost_type,
                post_id: r.original_post_id,
                created_at: r.created_at
            })));
            
            // Trier par date
            activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            
            // Paginer manuellement
            const paginated = activities.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
            
            res.status(200).json({
                success: true,
                data: paginated,
                pagination: {
                    total: activities.length,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    has_more: parseInt(offset) + parseInt(limit) < activities.length
                }
            });
            
        } catch (error) {
            console.error('Erreur getUserActivity:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getEngagementStats(req, res) {
        try {
            const userId = req.user.id;
            
            // Statistiques des posts
            const postsStats = await Post.findAll({
                where: { author_id: userId, is_deleted: false },
                attributes: [
                    [sequelize.fn('COUNT', sequelize.col('id')), 'total_posts'],
                    [sequelize.fn('SUM', sequelize.col('views_count')), 'total_views'],
                    [sequelize.fn('SUM', sequelize.col('likes_count')), 'total_likes'],
                    [sequelize.fn('SUM', sequelize.col('comments_count')), 'total_comments'],
                    [sequelize.fn('SUM', sequelize.col('shares_count')), 'total_shares'],
                    [sequelize.fn('SUM', sequelize.col('reposts_count')), 'total_reposts'],
                    [sequelize.fn('AVG', sequelize.col('viral_score')), 'avg_viral_score']
                ]
            });
            
            // Dernier post viral
            const lastViralPost = await Post.findOne({
                where: { author_id: userId, is_viral: true, is_deleted: false },
                order: [['viral_at', 'DESC']],
                attributes: ['id', 'viral_score', 'viral_at']
            });
            
            // Engagement par jour (30 derniers jours)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const dailyEngagement = await Post.findAll({
                where: {
                    author_id: userId,
                    created_at: { [Op.gte]: thirtyDaysAgo },
                    is_deleted: false
                },
                attributes: [
                    [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
                    [sequelize.fn('SUM', sequelize.col('likes_count')), 'likes'],
                    [sequelize.fn('SUM', sequelize.col('comments_count')), 'comments'],
                    [sequelize.fn('SUM', sequelize.col('views_count')), 'views']
                ],
                group: [sequelize.fn('DATE', sequelize.col('created_at'))],
                order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']]
            });
            
            res.status(200).json({
                success: true,
                data: {
                    posts: postsStats[0] || {},
                    last_viral_post: lastViralPost,
                    daily_engagement: dailyEngagement,
                    total_engagement: {
                        views: parseInt(postsStats[0]?.dataValues?.total_views || 0),
                        likes: parseInt(postsStats[0]?.dataValues?.total_likes || 0),
                        comments: parseInt(postsStats[0]?.dataValues?.total_comments || 0),
                        shares: parseInt(postsStats[0]?.dataValues?.total_shares || 0),
                        reposts: parseInt(postsStats[0]?.dataValues?.total_reposts || 0)
                    }
                }
            });
            
        } catch (error) {
            console.error('Erreur getEngagementStats:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new InteractionController();