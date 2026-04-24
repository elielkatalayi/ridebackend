const { sequelize } = require('../../config/database');
const { AdCampaign, AdImpression, AdTargeting, AdPayment } = require('../../models/advertising');
const { Wallet, WalletTransaction } = require('../../models');
const NotificationService = require('../notification/NotificationService');
const { Op } = require('sequelize');

class AdService {
    
    // =====================================================
    // CRÉATION DE CAMPAGNE
    // =====================================================
    
    async createCampaign(pageId, userId, campaignData) {
        const transaction = await sequelize.transaction();
        
        try {
            // Vérifier le solde du wallet
            const wallet = await Wallet.findOne({
                where: { user_id: userId, is_active: true }
            });
            
            if (!wallet || wallet.balance < campaignData.total_budget) {
                throw new Error('Solde insuffisant dans le wallet');
            }
            
            // Créer la campagne
            const campaign = await AdCampaign.create({
                page_id: pageId,
                created_by: userId,
                ad_type: campaignData.ad_type,
                post_id: campaignData.post_id || null,
                story_id: campaignData.story_id || null,
                external_url: campaignData.external_url,
                external_title: campaignData.external_title,
                external_description: campaignData.external_description,
                external_image: campaignData.external_image,
                media_url: campaignData.media_url,
                media_type: campaignData.media_type,
                thumbnail_url: campaignData.thumbnail_url,
                title: campaignData.title,
                description: campaignData.description,
                call_to_action: campaignData.call_to_action,
                total_budget: campaignData.total_budget,
                daily_budget: campaignData.daily_budget,
                start_date: campaignData.start_date,
                end_date: campaignData.end_date,
                targeting: campaignData.targeting || {},
                objective: campaignData.objective || 'reach',
                status: 'pending'
            }, { transaction });
            
            // Ajouter les ciblages détaillés
            if (campaignData.targeting_details && campaignData.targeting_details.length > 0) {
                await AdTargeting.bulkCreate(
                    campaignData.targeting_details.map(t => ({
                        campaign_id: campaign.id,
                        target_type: t.target_type,
                        target_id: t.target_id,
                        target_value: t.target_value
                    })),
                    { transaction }
                );
            }
            
            // Débiter le wallet
            const walletTransaction = await WalletTransaction.create({
                wallet_id: wallet.id,
                type: 'withdrawal',
                status: 'completed',
                amount: campaignData.total_budget,
                fee: 0,
                net_amount: campaignData.total_budget,
                balance_after: wallet.balance - campaignData.total_budget,
                reference_type: 'ad_campaign',
                reference_id: campaign.id,
                payment_method: 'wallet',
                requires_pin: false,
                metadata: { campaign_id: campaign.id, type: 'advertising' }
            }, { transaction });
            
            // Enregistrer le paiement
            await AdPayment.create({
                campaign_id: campaign.id,
                wallet_transaction_id: walletTransaction.id,
                amount: campaignData.total_budget,
                payment_method: 'wallet',
                status: 'completed',
                completed_at: new Date()
            }, { transaction });
            
            // Mettre à jour le solde du wallet
            await wallet.update({ balance: wallet.balance - campaignData.total_budget }, { transaction });
            
            await transaction.commit();
            
            // Notifier l'utilisateur
            await NotificationService.sendSystemNotification(
                userId,
                'Campagne publicitaire créée',
                `Votre campagne "${campaign.title}" a été créée. En attente de validation.`,
                { campaign_id: campaign.id },
                'normal'
            );
            
            // Notifier les admins pour validation
            await this.notifyAdminsForReview(campaign);
            
            return campaign;
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
    // =====================================================
    // VALIDATION DE CAMPAGNE (ADMIN)
    // =====================================================
    
    async approveCampaign(campaignId, adminId) {
        const campaign = await AdCampaign.findByPk(campaignId);
        
        if (!campaign) throw new Error('Campagne non trouvée');
        
        await campaign.update({
            status: 'active',
            reviewed_by: adminId,
            reviewed_at: new Date(),
            review_note: 'Approuvé'
        });
        
        // Notifier le créateur
        await NotificationService.sendSystemNotification(
            campaign.created_by,
            'Campagne approuvée 🎉',
            `Votre campagne "${campaign.title}" est maintenant active et diffusée.`,
            { campaign_id: campaign.id },
            'high'
        );
        
        return campaign;
    }
    
    async rejectCampaign(campaignId, adminId, reason) {
        const campaign = await AdCampaign.findByPk(campaignId);
        
        if (!campaign) throw new Error('Campagne non trouvée');
        
        await campaign.update({
            status: 'rejected',
            reviewed_by: adminId,
            reviewed_at: new Date(),
            review_note: reason
        });
        
        // Rembourser le wallet
        await this.refundCampaign(campaign);
        
        // Notifier le créateur
        await NotificationService.sendSystemNotification(
            campaign.created_by,
            'Campagne refusée',
            `Votre campagne "${campaign.title}" a été refusée. Raison: ${reason}. Le montant a été remboursé.`,
            { campaign_id: campaign.id },
            'high'
        );
        
        return campaign;
    }
    
    async refundCampaign(campaign) {
        const transaction = await sequelize.transaction();
        
        try {
            const payment = await AdPayment.findOne({
                where: { campaign_id: campaign.id, status: 'completed' }
            });
            
            if (!payment) return;
            
            const wallet = await Wallet.findOne({
                where: { user_id: campaign.created_by, is_active: true }
            });
            
            if (wallet) {
                await WalletTransaction.create({
                    wallet_id: wallet.id,
                    type: 'refund',
                    status: 'completed',
                    amount: payment.amount,
                    fee: 0,
                    net_amount: payment.amount,
                    balance_after: wallet.balance + payment.amount,
                    reference_type: 'ad_campaign_refund',
                    reference_id: campaign.id,
                    payment_method: 'wallet',
                    metadata: { campaign_id: campaign.id, reason: 'campaign_rejected' }
                }, { transaction });
                
                await wallet.update({ balance: wallet.balance + payment.amount }, { transaction });
                
                await payment.update({ status: 'refunded' }, { transaction });
            }
            
            await transaction.commit();
            
        } catch (error) {
            await transaction.rollback();
            console.error('Erreur remboursement:', error);
        }
    }
    
    // =====================================================
    // DIFFUSION DES PUBLICITÉS
    // =====================================================
    
    async getAdsForUser(userId, position = 'feed', limit = 3) {
        const now = new Date();
        
        // Récupérer les campagnes actives
        const campaigns = await AdCampaign.findAll({
            where: {
                status: 'active',
                start_date: { [Op.lte]: now },
                end_date: { [Op.gte]: now },
                spent_amount: { [Op.lt]: sequelize.col('total_budget') }
            },
            include: [
                { model: AdTargeting, as: 'targeting', required: false }
            ],
            order: [
                [sequelize.literal(`CASE WHEN daily_budget IS NOT NULL THEN (spent_amount_daily / daily_budget) ELSE 0 END`), 'ASC'],
                [sequelize.literal('RANDOM()')]
            ],
            limit: limit * 2
        });
        
        // Filtrer par ciblage utilisateur
        const eligibleAds = [];
        
        for (const campaign of campaigns) {
            if (this.isUserTargeted(userId, campaign)) {
                // Vérifier si l'utilisateur a déjà vu cette pub
                const alreadySeen = await AdImpression.findOne({
                    where: { campaign_id: campaign.id, user_id: userId }
                });
                
                if (!alreadySeen) {
                    eligibleAds.push(campaign);
                }
                
                if (eligibleAds.length >= limit) break;
            }
        }
        
        // Enregistrer les impressions
        for (const ad of eligibleAds) {
            await AdImpression.create({
                campaign_id: ad.id,
                user_id: userId,
                position: position,
                clicked: false
            });
            
            await ad.increment('impressions');
            await this.updateSpentAmount(ad.id, ad.cost_per_impression || 1);
        }
        
        return eligibleAds;
    }
    
    isUserTargeted(userId, campaign) {
        const targeting = campaign.targeting || {};
        
        // TODO: Implémenter la logique de ciblage réelle avec les données utilisateur
        // Pour l'instant, retourne true pour tous
        return true;
    }
    
    // =====================================================
    // SUIVI DES CLICS
    // =====================================================
    
    async trackClick(campaignId, userId) {
        const impression = await AdImpression.findOne({
            where: { campaign_id: campaignId, user_id: userId }
        });
        
        if (impression && !impression.clicked) {
            await impression.update({
                clicked: true,
                clicked_at: new Date()
            });
            
            await AdCampaign.increment('clicks', { by: 1, where: { id: campaignId } });
            await this.updateSpentAmount(campaignId, campaign.cost_per_click || 10);
            
            // Rediriger vers la destination
            const campaign = await AdCampaign.findByPk(campaignId);
            return this.getDestinationUrl(campaign);
        }
        
        return null;
    }
    
    async trackEngagement(campaignId, userId, action) {
        const impression = await AdImpression.findOne({
            where: { campaign_id: campaignId, user_id: userId }
        });
        
        if (impression) {
            if (action === 'like') {
                await impression.update({ liked: true });
                await AdCampaign.increment('likes', { by: 1, where: { id: campaignId } });
            } else if (action === 'comment') {
                await AdCampaign.increment('comments', { by: 1, where: { id: campaignId } });
            } else if (action === 'share') {
                await AdCampaign.increment('shares', { by: 1, where: { id: campaignId } });
            }
        }
    }
    
    // =====================================================
    // GESTION DU BUDGET
    // =====================================================
    
    async updateSpentAmount(campaignId, amount) {
        const campaign = await AdCampaign.findByPk(campaignId);
        
        if (campaign) {
            const newSpent = campaign.spent_amount + amount;
            
            if (newSpent >= campaign.total_budget) {
                await campaign.update({
                    spent_amount: newSpent,
                    status: 'completed'
                });
            } else {
                await campaign.update({ spent_amount: newSpent });
            }
        }
    }
    
    // =====================================================
    // STATISTIQUES
    // =====================================================
    
    async getCampaignStats(campaignId, pageId, userId) {
        // Vérifier les droits
        const campaign = await AdCampaign.findOne({
            where: { id: campaignId, page_id: pageId }
        });
        
        if (!campaign) throw new Error('Campagne non trouvée');
        
        const stats = {
            impressions: campaign.impressions,
            clicks: campaign.clicks,
            likes: campaign.likes,
            comments: campaign.comments,
            shares: campaign.shares,
            ctr: campaign.impressions > 0 ? (campaign.clicks / campaign.impressions * 100).toFixed(2) : 0,
            cost_per_click: campaign.clicks > 0 ? (campaign.spent_amount / campaign.clicks) : 0,
            cost_per_impression: campaign.impressions > 0 ? (campaign.spent_amount / campaign.impressions) : 0,
            remaining_budget: campaign.total_budget - campaign.spent_amount,
            spent_percentage: (campaign.spent_amount / campaign.total_budget * 100).toFixed(2)
        };
        
        return stats;
    }
    
    async getDailyStats(campaignId, pageId, userId) {
        const impressionsByDay = await AdImpression.findAll({
            where: { campaign_id: campaignId },
            attributes: [
                [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'impressions'],
                [sequelize.fn('SUM', sequelize.cast(sequelize.col('clicked'), 'integer')), 'clicks']
            ],
            group: [sequelize.fn('DATE', sequelize.col('created_at'))],
            order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']]
        });
        
        return impressionsByDay;
    }
    
    // =====================================================
    // GESTION DES CAMPAGNES
    // =====================================================
    
    async pauseCampaign(campaignId, pageId, userId) {
        const campaign = await AdCampaign.findOne({
            where: { id: campaignId, page_id: pageId }
        });
        
        if (!campaign) throw new Error('Campagne non trouvée');
        
        await campaign.update({ status: 'paused' });
        
        await NotificationService.sendSystemNotification(
            userId,
            'Campagne mise en pause',
            `Votre campagne "${campaign.title}" a été mise en pause.`,
            { campaign_id: campaignId }
        );
        
        return campaign;
    }
    
    async resumeCampaign(campaignId, pageId, userId) {
        const campaign = await AdCampaign.findOne({
            where: { id: campaignId, page_id: pageId }
        });
        
        if (!campaign) throw new Error('Campagne non trouvée');
        
        await campaign.update({ status: 'active' });
        
        await NotificationService.sendSystemNotification(
            userId,
            'Campagne reprise',
            `Votre campagne "${campaign.title}" est de nouveau active.`,
            { campaign_id: campaignId }
        );
        
        return campaign;
    }
    
    async cancelCampaign(campaignId, pageId, userId) {
        const campaign = await AdCampaign.findOne({
            where: { id: campaignId, page_id: pageId }
        });
        
        if (!campaign) throw new Error('Campagne non trouvée');
        
        await campaign.update({ status: 'cancelled' });
        
        // Rembourser le solde restant
        const remaining = campaign.total_budget - campaign.spent_amount;
        if (remaining > 0) {
            await this.refundRemaining(campaign, remaining);
        }
        
        await NotificationService.sendSystemNotification(
            userId,
            'Campagne annulée',
            `Votre campagne "${campaign.title}" a été annulée. Solde restant remboursé.`,
            { campaign_id: campaignId }
        );
        
        return campaign;
    }
    
    async refundRemaining(campaign, amount) {
        const transaction = await sequelize.transaction();
        
        try {
            const wallet = await Wallet.findOne({
                where: { user_id: campaign.created_by, is_active: true }
            });
            
            if (wallet) {
                await WalletTransaction.create({
                    wallet_id: wallet.id,
                    type: 'refund',
                    status: 'completed',
                    amount: amount,
                    fee: 0,
                    net_amount: amount,
                    balance_after: wallet.balance + amount,
                    reference_type: 'ad_campaign_refund',
                    reference_id: campaign.id,
                    payment_method: 'wallet',
                    metadata: { campaign_id: campaign.id, reason: 'campaign_cancelled' }
                }, { transaction });
                
                await wallet.update({ balance: wallet.balance + amount }, { transaction });
            }
            
            await transaction.commit();
            
        } catch (error) {
            await transaction.rollback();
            console.error('Erreur remboursement solde:', error);
        }
    }
    
    // =====================================================
    // NOTIFICATIONS
    // =====================================================
    
    async notifyAdminsForReview(campaign) {
        const { User } = require('../../models');
        
        const admins = await User.findAll({
            where: { role: ['admin', 'super_admin'] }
        });
        
        for (const admin of admins) {
            await NotificationService.sendSystemNotification(
                admin.id,
                'Nouvelle campagne à valider',
                `Une nouvelle campagne "${campaign.title}" attend votre validation.`,
                { campaign_id: campaign.id, type: 'ad_review' },
                'high'
            );
        }
    }
    
    getDestinationUrl(campaign) {
        if (campaign.ad_type === 'post' && campaign.post_id) {
            return `/post/${campaign.post_id}`;
        } else if (campaign.ad_type === 'story' && campaign.story_id) {
            return `/story/${campaign.story_id}`;
        } else if (campaign.ad_type === 'external_link') {
            return campaign.external_url;
        } else if (campaign.ad_type === 'page_promotion') {
            return `/page/${campaign.page_id}`;
        }
        return '/';
    }
}

module.exports = new AdService();