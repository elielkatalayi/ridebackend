const AdService = require('../../services/advertising/adService');
const { Page, PageAdmin, User ,AdCampaign } = require('../../models');

class AdController {
    
    // =====================================================
    // CRÉATION
    // =====================================================
    
    async createCampaign(req, res) {
        try {
            const { pageId } = req.params;
            const userId = req.user.id;
            const campaignData = req.body;
            
            // Vérifier si l'utilisateur est admin de la page
            const isAdmin = await PageAdmin.findOne({
                where: { page_id: pageId, user_id: userId }
            });
            
            if (!isAdmin) {
                return res.status(403).json({
                    success: false,
                    error: 'Vous devez être administrateur de cette page'
                });
            }
            
            const campaign = await AdService.createCampaign(pageId, userId, campaignData);
            
            res.status(201).json({
                success: true,
                message: 'Campagne créée avec succès. En attente de validation.',
                data: campaign
            });
            
        } catch (error) {
            console.error('Erreur createCampaign:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // LECTURE
    // =====================================================
    
    async getCampaigns(req, res) {
        try {
            const { pageId } = req.params;
            const userId = req.user.id;
            const { status, limit = 20, offset = 0 } = req.query;
            
            const where = { page_id: pageId };
            if (status) where.status = status;
            
            const campaigns = await AdCampaign.findAndCountAll({
                where,
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
            
            res.status(200).json({
                success: true,
                data: campaigns.rows,
                pagination: {
                    total: campaigns.count,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    has_more: campaigns.rows.length === parseInt(limit)
                }
            });
            
        } catch (error) {
            console.error('Erreur getCampaigns:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getCampaignStats(req, res) {
        try {
            const { pageId, campaignId } = req.params;
            const userId = req.user.id;
            
            const stats = await AdService.getCampaignStats(campaignId, pageId, userId);
            
            res.status(200).json({
                success: true,
                data: stats
            });
            
        } catch (error) {
            console.error('Erreur getCampaignStats:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getDailyStats(req, res) {
        try {
            const { pageId, campaignId } = req.params;
            const userId = req.user.id;
            
            const stats = await AdService.getDailyStats(campaignId, pageId, userId);
            
            res.status(200).json({
                success: true,
                data: stats
            });
            
        } catch (error) {
            console.error('Erreur getDailyStats:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // GESTION
    // =====================================================
    
    async pauseCampaign(req, res) {
        try {
            const { pageId, campaignId } = req.params;
            const userId = req.user.id;
            
            const campaign = await AdService.pauseCampaign(campaignId, pageId, userId);
            
            res.status(200).json({
                success: true,
                message: 'Campagne mise en pause',
                data: campaign
            });
            
        } catch (error) {
            console.error('Erreur pauseCampaign:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async resumeCampaign(req, res) {
        try {
            const { pageId, campaignId } = req.params;
            const userId = req.user.id;
            
            const campaign = await AdService.resumeCampaign(campaignId, pageId, userId);
            
            res.status(200).json({
                success: true,
                message: 'Campagne reprise',
                data: campaign
            });
            
        } catch (error) {
            console.error('Erreur resumeCampaign:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async cancelCampaign(req, res) {
        try {
            const { pageId, campaignId } = req.params;
            const userId = req.user.id;
            
            const campaign = await AdService.cancelCampaign(campaignId, pageId, userId);
            
            res.status(200).json({
                success: true,
                message: 'Campagne annulée',
                data: campaign
            });
            
        } catch (error) {
            console.error('Erreur cancelCampaign:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // ADMIN (Validation)
    // =====================================================
    
    async getPendingCampaigns(req, res) {
        try {
            const { limit = 20, offset = 0 } = req.query;
            
            const campaigns = await AdCampaign.findAndCountAll({
                where: { status: 'pending' },
                include: [
                    { model: Page, as: 'page', attributes: ['id', 'name'] },
                    { model: User, as: 'creator', attributes: ['id', 'first_name'] }
                ],
                order: [['created_at', 'ASC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
            
            res.status(200).json({
                success: true,
                data: campaigns.rows,
                pagination: {
                    total: campaigns.count,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    has_more: campaigns.rows.length === parseInt(limit)
                }
            });
            
        } catch (error) {
            console.error('Erreur getPendingCampaigns:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async approveCampaign(req, res) {
        try {
            const { campaignId } = req.params;
            const adminId = req.user.id;
            
            const campaign = await AdService.approveCampaign(campaignId, adminId);
            
            res.status(200).json({
                success: true,
                message: 'Campagne approuvée',
                data: campaign
            });
            
        } catch (error) {
            console.error('Erreur approveCampaign:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async rejectCampaign(req, res) {
        try {
            const { campaignId } = req.params;
            const adminId = req.user.id;
            const { reason } = req.body;
            
            if (!reason) {
                return res.status(400).json({ success: false, error: 'La raison du rejet est requise' });
            }
            
            const campaign = await AdService.rejectCampaign(campaignId, adminId, reason);
            
            res.status(200).json({
                success: true,
                message: 'Campagne rejetée',
                data: campaign
            });
            
        } catch (error) {
            console.error('Erreur rejectCampaign:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new AdController();