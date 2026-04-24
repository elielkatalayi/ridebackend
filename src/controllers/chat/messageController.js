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
                success: true,
                message: 'Message envoyé',
                data: message
            });
            
        } catch (error) {
            console.error('Erreur sendMessage:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getMessages(req, res) {
        try {
            const { chatId } = req.params;
            const userId = req.user.id;
            const { limit = 50, offset = 0, before, after } = req.query;
            
            const messages = await MessageService.getMessages(chatId, userId, {
                limit: parseInt(limit),
                offset: parseInt(offset),
                before,
                after
            });
            
            res.status(200).json({
                success: true,
                data: messages,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    has_more: messages.length === parseInt(limit)
                }
            });
            
        } catch (error) {
            console.error('Erreur getMessages:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getMessageById(req, res) {
        try {
            const { messageId } = req.params;
            const userId = req.user.id;
            
            const message = await MessageService.getMessageById(messageId, userId);
            
            if (!message) {
                return res.status(404).json({ success: false, error: 'Message non trouvé' });
            }
            
            res.status(200).json({ success: true, data: message });
            
        } catch (error) {
            console.error('Erreur getMessageById:', error);
            res.status(500).json({ success: false, error: error.message });
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
                success: true,
                message: 'Message modifié',
                data: message
            });
            
        } catch (error) {
            console.error('Erreur editMessage:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async deleteMessage(req, res) {
        try {
            const { messageId } = req.params;
            const userId = req.user.id;
            const { forEveryone = false } = req.body;
            
            await MessageService.deleteMessage(messageId, userId, forEveryone);
            
            res.status(200).json({
                success: true,
                message: forEveryone ? 'Message supprimé pour tous' : 'Message supprimé'
            });
            
        } catch (error) {
            console.error('Erreur deleteMessage:', error);
            res.status(500).json({ success: false, error: error.message });
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
                success: true,
                message: 'Réaction ajoutée'
            });
            
        } catch (error) {
            console.error('Erreur addReaction:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async removeReaction(req, res) {
        try {
            const { messageId } = req.params;
            const userId = req.user.id;
            
            await MessageService.removeReaction(messageId, userId);
            
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
    // MESSAGES ÉPINGLÉS
    // =====================================================
    
    async pinMessage(req, res) {
        try {
            const { chatId, messageId } = req.params;
            const userId = req.user.id;
            
            await MessageService.pinMessage(chatId, messageId, userId);
            
            res.status(200).json({
                success: true,
                message: 'Message épinglé'
            });
            
        } catch (error) {
            console.error('Erreur pinMessage:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async unpinMessage(req, res) {
        try {
            const { chatId, messageId } = req.params;
            const userId = req.user.id;
            
            await MessageService.unpinMessage(chatId, messageId, userId);
            
            res.status(200).json({
                success: true,
                message: 'Message détaché'
            });
            
        } catch (error) {
            console.error('Erreur unpinMessage:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getPinnedMessages(req, res) {
        try {
            const { chatId } = req.params;
            const { limit = 20 } = req.query;
            
            const messages = await MessageService.getPinnedMessages(chatId, parseInt(limit));
            
            res.status(200).json({
                success: true,
                data: messages
            });
            
        } catch (error) {
            console.error('Erreur getPinnedMessages:', error);
            res.status(500).json({ success: false, error: error.message });
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
                success: true,
                message: 'Messages marqués comme lus'
            });
            
        } catch (error) {
            console.error('Erreur markAsRead:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async markAsDelivered(req, res) {
        try {
            const { chatId, messageId } = req.params;
            const userId = req.user.id;
            
            await MessageService.markAsDelivered(chatId, userId, messageId);
            
            res.status(200).json({
                success: true,
                message: 'Message marqué comme délivré'
            });
            
        } catch (error) {
            console.error('Erreur markAsDelivered:', error);
            res.status(500).json({ success: false, error: error.message });
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
                return res.status(400).json({ success: false, error: 'La recherche doit contenir au moins 2 caractères' });
            }
            
            const messages = await MessageService.searchMessages(userId, q, {
                limit: parseInt(limit),
                offset: parseInt(offset),
                chatId
            });
            
            res.status(200).json({
                success: true,
                data: messages,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    has_more: messages.length === parseInt(limit)
                }
            });
            
        } catch (error) {
            console.error('Erreur searchMessages:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new MessageController();