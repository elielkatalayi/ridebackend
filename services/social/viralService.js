const { sequelize } = require('../../config/database');
const { Post, PostView, PostReaction, Comment, Repost, PostShare, SavedPost, Hashtag, TrendingPost, User, Page, Group, PageFollower, GroupMember } = require('../../models');
const NotificationService = require('../notification/NotificationService');
const { Op } = require('sequelize');

class ViralService {
    
    // =====================================================
    // CALCUL DU SCORE VIRAL
    // =====================================================
    
    async calculateViralScore(postId) {
        try {
            const stats = await this.getPostStats(postId);
            if (!stats) return 0;
            
            let score = 0;
            
            // 1. VUES (pondération faible)
            score += (stats.views_count || 0) * 0.5;
            
            // 2. VUES UNIQUES (pondération moyenne)
            score += (stats.unique_views_count || 0) * 1;
            
            // 3. TEMPS DE VISIONNAGE (pour vidéos)
            if (stats.avg_watch_time_percentage) {
                score += (stats.avg_watch_time_percentage || 0) * 1;
                if (stats.completion_rate) {
                    score += (stats.completion_rate || 0) * 5;
                }
            }
            
            // 4. RÉACTIONS (pondération par type)
            score += (stats.likes_count || 0) * 2;
            score += (stats.loves_count || 0) * 3;
            score += (stats.fires_count || 0) * 4;
            score += (stats.celebrates_count || 0) * 5;
            
            // 5. COMMENTAIRES (pondération élevée)
            score += (stats.comments_count || 0) * 5;
            score += (stats.media_comments_count || 0) * 3;
            
            // 6. PARTAGES ET REPOSTS (pondération très élevée)
            score += (stats.shares_count || 0) * 10;
            score += (stats.reposts_count || 0) * 8;
            
            // 7. SAUVEGARDES
            score += (stats.saves_count || 0) * 3;
            
            // 8. HASHTAGS TRENDANCE
            if (stats.trending_hashtags_count) {
                score += stats.trending_hashtags_count * 20;
            }
            
            // 9. MENTIONS
            if (stats.mentions_count) {
                score += stats.mentions_count * 10;
            }
            
            // 10. VITESSE D'ENGAGEMENT
            const hoursSinceCreation = stats.hours_since_creation || 1;
            const engagementVelocity = (stats.total_engagement || 0) / hoursSinceCreation;
            score += engagementVelocity * 2;
            
            // 11. RATIO ENGAGEMENT/VUES
            if (stats.views_count > 0) {
                const engagementRate = (stats.total_engagement / stats.views_count) * 100;
                score += engagementRate * 5;
            }
            
            // Mettre à jour le score
            await this.updatePostViralScore(postId, Math.floor(score));
            
            // Vérifier si le post devient viral
            if (score >= 1000 && !stats.is_viral) {
                await this.markPostAsViral(postId, score);
            }
            
            // Vérifier si le post devient trending
            if (score >= 500 && !stats.is_trending) {
                await this.markPostAsTrending(postId, score);
            }
            
            return score;
            
        } catch (error) {
            console.error('❌ Erreur calcul score viral:', error);
            return 0;
        }
    }
    
    async getPostStats(postId) {
        const query = `
            SELECT 
                p.views_count,
                p.unique_views_count,
                p.likes_count,
                p.loves_count,
                p.fires_count,
                p.celebrates_count,
                p.comments_count,
                p.shares_count,
                p.reposts_count,
                p.saves_count,
                p.is_viral,
                p.is_trending,
                p.viral_score,
                p.engagement_score,
                p.created_at,
                EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600 as hours_since_creation,
                (p.likes_count + p.loves_count + p.fires_count + p.celebrates_count + 
                p.comments_count + p.shares_count + p.reposts_count + p.saves_count) as total_engagement,
                (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND media IS NOT NULL) as media_comments_count,
                COALESCE(jsonb_array_length(p.mentions), 0) as mentions_count,
                0 as trending_hashtags_count,
                (SELECT AVG(watch_percentage) FROM post_views WHERE post_id = p.id) as avg_watch_time_percentage,
                (SELECT COUNT(*) * 100.0 / NULLIF(COUNT(*), 0) FROM post_views WHERE post_id = p.id AND completed = true) as completion_rate
            FROM posts p
            WHERE p.id = $1
        `;
        
        const result = await sequelize.query(query, {
            bind: [postId],
            type: sequelize.QueryTypes.SELECT
        });
        
        return result[0] || null;
    }
    
    async updatePostViralScore(postId, score) {
        await Post.update(
            { 
                viral_score: score,
                engagement_score: score * 0.8
            },
            { where: { id: postId } }
        );
    }
    
    // =====================================================
    // MARQUER COMME VIRAL / TRENDING
    // =====================================================
    
    async markPostAsViral(postId, score) {
        try {
            await Post.update(
                { is_viral: true, viral_at: new Date() },
                { where: { id: postId } }
            );
            
            const post = await Post.findByPk(postId, {
                include: [{ model: User, as: 'author', attributes: ['id', 'name', 'avatar'] }]
            });
            
            if (!post) return;
            
            // Notifier l'auteur
            await NotificationService.sendSystemNotification(
                post.author_id,
                '🎉 VOTRE POST DEVIENT VIRAL !',
                `Votre post a dépassé ${score} points d'engagement ! Il est maintenant viral.`,
                { post_id: postId, viral_score: score },
                'high'
            );
            
            // Ajouter aux tendances
            await this.addToTrending(postId, score, post.container_type === 'page' ? await this.getPostCategory(postId) : null);
            
            // Notifier les followers de la page/groupe
            await this.notifyViralPost(post);
            
            console.log(`🔥 Post ${postId} est devenu viral avec score ${score}`);
            
        } catch (error) {
            console.error('Erreur markPostAsViral:', error);
        }
    }
    
    async markPostAsTrending(postId, score) {
        try {
            await Post.update(
                { is_trending: true, trending_at: new Date() },
                { where: { id: postId } }
            );
            
            const post = await Post.findByPk(postId, {
                include: [{ model: User, as: 'author', attributes: ['id', 'name'] }]
            });
            
            if (post) {
                await NotificationService.sendSystemNotification(
                    post.author_id,
                    '📈 Votre post est en tendance !',
                    `Votre post est actuellement dans les tendances avec ${score} points !`,
                    { post_id: postId, trending_score: score },
                    'normal'
                );
            }
            
        } catch (error) {
            console.error('Erreur markPostAsTrending:', error);
        }
    }
    
    async addToTrending(postId, score, category = null) {
        await TrendingPost.upsert({
            post_id: postId,
            score: score,
            category: category,
            started_at: new Date(),
            rank: 0
        });
        
        // Mettre à jour les rangs
        await this.updateTrendingRanks();
        
        // Nettoyer les anciennes tendances (plus de 7 jours)
        await TrendingPost.destroy({
            where: {
                started_at: { [Op.lt]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            }
        });
    }
    
    async updateTrendingRanks() {
        const trending = await TrendingPost.findAll({
            order: [['score', 'DESC']]
        });
        
        for (let i = 0; i < trending.length; i++) {
            await trending[i].update({ rank: i + 1 });
        }
    }
    
    async getPostCategory(postId) {
        const post = await Post.findByPk(postId);
        if (!post) return null;
        
        if (post.container_type === 'page') {
            const page = await Page.findByPk(post.container_id);
            return page?.category || null;
        }
        return null;
    }
    
    // =====================================================
    // NOTIFICATIONS POUR POST VIRAL
    // =====================================================
    
    async notifyViralPost(post) {
        try {
            let recipients = [];
            
            if (post.container_type === 'page') {
                const followers = await PageFollower.findAll({
                    where: { page_id: post.container_id },
                    attributes: ['user_id']
                });
                recipients = followers.map(f => f.user_id);
            } else if (post.container_type === 'group') {
                const members = await GroupMember.findAll({
                    where: { group_id: post.container_id, status: 'active' },
                    attributes: ['user_id']
                });
                recipients = members.map(m => m.user_id);
            }
            
            for (const recipientId of recipients) {
                if (recipientId !== post.author_id) {
                    await NotificationService.sendSocialNotification(
                        recipientId,
                        post.id,
                        'viral_post',
                        post.author_id,
                        post.author?.name || 'Quelqu\'un',
                        post.author?.avatar,
                        `🔥 Ce post est devenu viral !`
                    );
                }
            }
            
        } catch (error) {
            console.error('Erreur notifyViralPost:', error);
        }
    }
    
    // =====================================================
    // TRENDING GLOBAL
    // =====================================================
    
    async getGlobalTrending(limit = 20, timeRange = '24h') {
        let interval = '24 hours';
        switch (timeRange) {
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
                { model: User, as: 'author', attributes: ['id', 'name', 'avatar'] }
            ],
            order: [
                ['viral_score', 'DESC'],
                ['engagement_score', 'DESC']
            ],
            limit: limit
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
        
        return postsWithMetrics;
    }
    
    async getTrendingByCategory(category, limit = 20) {
        const pages = await Page.findAll({
            where: { category, is_deleted: false },
            attributes: ['id']
        });
        
        const pageIds = pages.map(p => p.id);
        
        if (pageIds.length === 0) return [];
        
        const posts = await Post.findAll({
            where: {
                container_type: 'page',
                container_id: { [Op.in]: pageIds },
                is_deleted: false,
                status: 'active',
                created_at: { [Op.gte]: sequelize.literal("NOW() - INTERVAL '7 days'") }
            },
            include: [
                { model: User, as: 'author', attributes: ['id', 'name', 'avatar'] }
            ],
            order: [['viral_score', 'DESC']],
            limit: limit
        });
        
        return posts;
    }
    
    async getTrendingByHashtag(hashtag, limit = 20) {
        const posts = await Post.findAll({
            where: {
                hashtags: { [Op.contains]: [hashtag] },
                is_deleted: false,
                status: 'active',
                created_at: { [Op.gte]: sequelize.literal("NOW() - INTERVAL '7 days'") }
            },
            include: [
                { model: User, as: 'author', attributes: ['id', 'name', 'avatar'] }
            ],
            order: [['viral_score', 'DESC']],
            limit: limit
        });
        
        return posts;
    }
    
    // =====================================================
    // RECOMMANDATIONS PERSONNALISÉES
    // =====================================================
    
    async getPersonalizedRecommendations(userId, limit = 20) {
        // Récupérer les hashtags des posts de l'utilisateur
        const userPosts = await Post.findAll({
            where: { author_id: userId, is_deleted: false },
            attributes: ['hashtags'],
            limit: 50
        });
        
        const userHashtags = new Set();
        for (const post of userPosts) {
            if (post.hashtags) {
                post.hashtags.forEach(tag => userHashtags.add(tag));
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
        
        const excludeContainers = [
            ...followedPages.map(f => ({ type: 'page', id: f.page_id })),
            ...memberGroups.map(m => ({ type: 'group', id: m.group_id }))
        ];
        
        let recommendations = [];
        
        if (userHashtags.size > 0) {
            const hashtagArray = Array.from(userHashtags).slice(0, 10);
            
            recommendations = await Post.findAll({
                where: {
                    hashtags: { [Op.overlap]: hashtagArray },
                    author_id: { [Op.ne]: userId },
                    is_deleted: false,
                    status: 'active',
                    [Op.not]: [
                        { container_type: 'page', container_id: { [Op.in]: followedPages.map(f => f.page_id) } },
                        { container_type: 'group', container_id: { [Op.in]: memberGroups.map(m => m.group_id) } }
                    ]
                },
                include: [
                    { model: User, as: 'author', attributes: ['id', 'name', 'avatar'] }
                ],
                order: [['viral_score', 'DESC']],
                limit: limit
            });
        }
        
        // Si pas assez, ajouter des posts viraux
        if (recommendations.length < limit) {
            const remainingLimit = limit - recommendations.length;
            
            const viralPosts = await Post.findAll({
                where: {
                    is_viral: true,
                    author_id: { [Op.ne]: userId },
                    is_deleted: false,
                    status: 'active',
                    id: { [Op.notIn]: recommendations.map(r => r.id) }
                },
                include: [
                    { model: User, as: 'author', attributes: ['id', 'name', 'avatar'] }
                ],
                order: [['viral_score', 'DESC']],
                limit: remainingLimit
            });
            
            recommendations.push(...viralPosts);
        }
        
        return recommendations;
    }
    
    // =====================================================
    // TRENDING HASHTAGS
    // =====================================================
    
    async getTrendingHashtags(limit = 20) {
        const hashtags = await Hashtag.findAll({
            where: {
                created_at: { [Op.gte]: sequelize.literal("NOW() - INTERVAL '24 hours'") }
            },
            attributes: [
                'tag',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: ['tag'],
            order: [[sequelize.literal('count'), 'DESC']],
            limit: limit
        });
        
        return hashtags.map(h => ({
            tag: h.tag,
            count: parseInt(h.dataValues.count)
        }));
    }
    
    async updateHashtagTrending() {
        const trendingHashtags = await this.getTrendingHashtags(50);
        
        for (const ht of trendingHashtags) {
            await Hashtag.update(
                { is_trending: true, trending_score: ht.count },
                { where: { tag: ht.tag, created_at: { [Op.gte]: sequelize.literal("NOW() - INTERVAL '24 hours'") } } }
            );
        }
        
        // Réinitialiser les hashtags non tendance
        await Hashtag.update(
            { is_trending: false, trending_score: 0 },
            { where: { created_at: { [Op.lt]: sequelize.literal("NOW() - INTERVAL '24 hours'") } } }
        );
        
        console.log(`✅ Mise à jour des hashtags tendance: ${trendingHashtags.length} hashtags`);
    }
    
    // =====================================================
    // ANALYTIQUES VIRALES
    // =====================================================
    
    async getViralAnalytics(timeRange = '7d') {
        let interval = '7 days';
        switch (timeRange) {
            case '24h': interval = '24 hours'; break;
            case '30d': interval = '30 days'; break;
            default: interval = '7 days';
        }
        
        const result = await Post.findOne({
            where: {
                created_at: { [Op.gte]: sequelize.literal(`NOW() - INTERVAL '${interval}'`) },
                is_deleted: false
            },
            attributes: [
                [sequelize.fn('COUNT', sequelize.col('id')), 'total_posts'],
                [sequelize.fn('SUM', sequelize.col('views_count')), 'total_views'],
                [sequelize.fn('SUM', sequelize.col('likes_count')), 'total_likes'],
                [sequelize.fn('SUM', sequelize.col('comments_count')), 'total_comments'],
                [sequelize.fn('SUM', sequelize.col('shares_count')), 'total_shares'],
                [sequelize.fn('SUM', sequelize.col('reposts_count')), 'total_reposts'],
                [sequelize.fn('AVG', sequelize.col('viral_score')), 'avg_viral_score'],
                [sequelize.fn('MAX', sequelize.col('viral_score')), 'max_viral_score']
            ]
        });
        
        const viralCount = await Post.count({
            where: {
                is_viral: true,
                created_at: { [Op.gte]: sequelize.literal(`NOW() - INTERVAL '${interval}'`) },
                is_deleted: false
            }
        });
        
        return {
            total_posts: parseInt(result?.dataValues?.total_posts || 0),
            total_views: parseInt(result?.dataValues?.total_views || 0),
            total_likes: parseInt(result?.dataValues?.total_likes || 0),
            total_comments: parseInt(result?.dataValues?.total_comments || 0),
            total_shares: parseInt(result?.dataValues?.total_shares || 0),
            total_reposts: parseInt(result?.dataValues?.total_reposts || 0),
            avg_viral_score: parseFloat(result?.dataValues?.avg_viral_score || 0),
            max_viral_score: parseFloat(result?.dataValues?.max_viral_score || 0),
            viral_posts_count: viralCount
        };
    }
    
    // =====================================================
    // BATCH UPDATE
    // =====================================================
    
    async batchUpdateViralScores() {
        console.log('🔄 Début mise à jour batch des scores viraux...');
        
        const posts = await Post.findAll({
            where: {
                created_at: { [Op.gte]: sequelize.literal("NOW() - INTERVAL '48 hours'") },
                is_deleted: false,
                status: 'active'
            },
            attributes: ['id']
        });
        
        let updated = 0;
        for (const post of posts) {
            await this.calculateViralScore(post.id);
            updated++;
            
            if (updated % 10 === 0) {
                await this.sleep(100);
            }
        }
        
        // Mettre à jour les hashtags tendance
        await this.updateHashtagTrending();
        
        console.log(`✅ Batch terminé: ${updated} posts mis à jour`);
        return { updated, total: posts.length };
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new ViralService();