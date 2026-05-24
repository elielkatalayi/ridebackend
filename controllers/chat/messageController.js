const MessageService = require('../../services/chat/messageService');

class MessageController {
    
    // =====================================================
    // MESSAGES
    // =====================================================
    
    async sendMessage(req, res) {
        try {
            const { chatId } = req.params;
            const userId = req.user.id;
            const messageData = req.body;
            const files = req.files;
            
            const message = await MessageService.sendMessage(chatId, userId, messageData, files);
            
            res.status(201).json({
                state: true,
                message: 'Message envoyé',
                datas: message
            });
            
        } catch (error) {
            console.error('Erreur sendMessage:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
    
    async getMessages(req, res) {
        try {
            const { chatId } = req.params;
            const userId = req.user.id;
            const limit = parseInt(req.query.limit) || 50;
            const offset = parseInt(req.query.offset) || 0;
            const { before, after } = req.query;
            
            const result = await MessageService.getMessages(chatId, userId, {
                limit, offset, before, after
            });
            
            const messages = result.rows || result;
            const total = result.count || (Array.isArray(messages) ? messages.length : 0);
            
            const totalPages = Math.ceil(total / limit);
            const currentPage = Math.floor(offset / limit) + 1;
            
            res.status(200).json({
                state: true,
                message: 'Messages récupérés avec succès',
                datas: messages,
                meta: {
                    total: total,
                    count: messages.length,
                    per_page: limit,
                    current_page: currentPage,
                    total_pages: totalPages
                }
            });
            
        } catch (error) {
            console.error('Erreur getMessages:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
    
    async getMessageById(req, res) {
        try {
            const { messageId } = req.params;
            const userId = req.user.id;
            
            const message = await MessageService.getMessageById(messageId, userId);
            
            if (!message) {
                return res.status(404).json({ 
                    state: false, 
                    message: 'Message non trouvé', 
                    datas: null 
                });
            }
            
            res.status(200).json({ 
                state: true, 
                message: 'Message récupéré avec succès',
                datas: message
            });
            
        } catch (error) {
            console.error('Erreur getMessageById:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
    
    // =====================================================
    // MODIFICATION
    // =====================================================
    
    async editMessage(req, res) {
        try {
            const { messageId } = req.params;
            const userId = req.user.id;
            const { content } = req.body;
            
            const message = await MessageService.editMessage(messageId, userId, content);
            
            res.status(200).json({
                state: true,
                message: 'Message modifié',
                datas: message
            });
            
        } catch (error) {
            console.error('Erreur editMessage:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
    
    async deleteMessage(req, res) {
        try {
            const { messageId } = req.params;
            const userId = req.user.id;
            const { forEveryone = false } = req.body;
            
            await MessageService.deleteMessage(messageId, userId, forEveryone);
            
            res.status(200).json({
                state: true,
                message: forEveryone ? 'Message supprimé pour tous' : 'Message supprimé',
                datas: null
            });
            
        } catch (error) {
            console.error('Erreur deleteMessage:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
    
    // =====================================================
    // RÉACTIONS
    // =====================================================
    
    async addReaction(req, res) {
        try {
            const { messageId } = req.params;
            const userId = req.user.id;
            const { reaction_type } = req.body;
            
            await MessageService.addReaction(messageId, userId, reaction_type);
            
            res.status(200).json({
                state: true,
                message: 'Réaction ajoutée',
                datas: null
            });
            
        } catch (error) {
            console.error('Erreur addReaction:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
    
    async removeReaction(req, res) {
        try {
            const { messageId } = req.params;
            const userId = req.user.id;
            
            await MessageService.removeReaction(messageId, userId);
            
            res.status(200).json({
                state: true,
                message: 'Réaction retirée',
                datas: null
            });
            
        } catch (error) {
            console.error('Erreur removeReaction:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
    
    // =====================================================
    // MESSAGES ÉPINGLÉS
    // =====================================================
    
    async pinMessage(req, res) {
        try {
            const { chatId, messageId } = req.params;
            const userId = req.user.id;
            
            await MessageService.pinMessage(chatId, messageId, userId);
            
            res.status(200).json({
                state: true,
                message: 'Message épinglé',
                datas: null
            });
            
        } catch (error) {
            console.error('Erreur pinMessage:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
    
    async unpinMessage(req, res) {
        try {
            const { chatId, messageId } = req.params;
            const userId = req.user.id;
            
            await MessageService.unpinMessage(chatId, messageId, userId);
            
            res.status(200).json({
                state: true,
                message: 'Message détaché',
                datas: null
            });
            
        } catch (error) {
            console.error('Erreur unpinMessage:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
    
    async getPinnedMessages(req, res) {
        try {
            const { chatId } = req.params;
            const limit = parseInt(req.query.limit) || 20;
            
            const messages = await MessageService.getPinnedMessages(chatId, limit);
            
            res.status(200).json({
                state: true,
                message: 'Messages épinglés récupérés',
                datas: messages
            });
            
        } catch (error) {
            console.error('Erreur getPinnedMessages:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
    
    // =====================================================
    // ACCUSÉS DE LECTURE
    // =====================================================
    
    async markAsRead(req, res) {
        try {
            const { chatId, messageId } = req.params;
            const userId = req.user.id;
            
            await MessageService.markAsRead(chatId, userId, messageId);
            
            res.status(200).json({
                state: true,
                message: 'Messages marqués comme lus',
                datas: null
            });
            
        } catch (error) {
            console.error('Erreur markAsRead:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
    
    async markAsDelivered(req, res) {
        try {
            const { chatId, messageId } = req.params;
            const userId = req.user.id;
            
            await MessageService.markAsDelivered(chatId, userId, messageId);
            
            res.status(200).json({
                state: true,
                message: 'Message marqué comme délivré',
                datas: null
            });
            
        } catch (error) {
            console.error('Erreur markAsDelivered:', error);
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
    
    async searchMessages(req, res) {
        try {
            const userId = req.user.id;
            const { q, limit = 50, offset = 0, chatId } = req.query;
            
            if (!q || q.length < 2) {
                return res.status(400).json({ 
                    state: false, 
                    message: 'La recherche doit contenir au moins 2 caractères', 
                    datas: null 
                });
            }
            
            const result = await MessageService.searchMessages(userId, q, {
                limit: parseInt(limit),
                offset: parseInt(offset),
                chatId
            });
            
            const messages = result.rows || result;
            const total = result.count || (Array.isArray(messages) ? messages.length : 0);
            const totalPages = Math.ceil(total / limit);
            const currentPage = Math.floor(offset / limit) + 1;
            
            res.status(200).json({
                state: true,
                message: 'Résultats de recherche',
                datas: messages,
                meta: {
                    total: total,
                    count: messages.length,
                    per_page: parseInt(limit),
                    current_page: currentPage,
                    total_pages: totalPages
                }
            });
            
        } catch (error) {
            console.error('Erreur searchMessages:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
}

module.exports = new MessageController();