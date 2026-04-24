const ChatService = require('../../services/chat/chatService');
const MessageService = require('../../services/chat/messageService');
const { Chat, ChatParticipant } = require('../../models');

class ChatController {
    
    // =====================================================
    // CONVERSATIONS
    // =====================================================
    
    async createPrivateChat(req, res) {
        try {
            const userId = req.user.id;
            const { otherUserId } = req.body;
            
            const chat = await ChatService.createPrivateChat(userId, otherUserId);
            
            res.status(201).json({
                success: true,
                message: 'Chat créé avec succès',
                data: chat
            });
            
        } catch (error) {
            console.error('Erreur createPrivateChat:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async createGroupChat(req, res) {
        try {
            const userId = req.user.id;
            const { name, description, is_public, join_type, members, settings, avatar_url } = req.body;
            
            const chat = await ChatService.createGroupChat(userId, {
                name,
                description,
                is_public,
                join_type,
                settings,
                avatar_url
            }, members || []);
            
            res.status(201).json({
                success: true,
                message: 'Groupe créé avec succès',
                data: chat
            });
            
        } catch (error) {
            console.error('Erreur createGroupChat:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getUserChats(req, res) {
        try {
            const userId = req.user.id;
            const { limit = 50, offset = 0 } = req.query;
            
            const chats = await ChatService.getUserChats(userId, { limit: parseInt(limit), offset: parseInt(offset) });
            
            res.status(200).json({
                success: true,
                data: chats,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    has_more: chats.length === parseInt(limit)
                }
            });
            
        } catch (error) {
            console.error('Erreur getUserChats:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getChatById(req, res) {
        try {
            const { chatId } = req.params;
            const userId = req.user.id;
            
            const chat = await ChatService.getChatById(chatId, userId);
            
            if (!chat) {
                return res.status(404).json({ success: false, error: 'Chat non trouvé' });
            }
            
            res.status(200).json({ success: true, data: chat });
            
        } catch (error) {
            console.error('Erreur getChatById:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // MEMBRES
    // =====================================================
    
    async addMember(req, res) {
        try {
            const { chatId } = req.params;
            const { memberId } = req.body;
            const userId = req.user.id;
            
            await ChatService.addMember(chatId, userId, memberId);
            
            res.status(200).json({
                success: true,
                message: 'Membre ajouté avec succès'
            });
            
        } catch (error) {
            console.error('Erreur addMember:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async removeMember(req, res) {
        try {
            const { chatId, memberId } = req.params;
            const userId = req.user.id;
            
            await ChatService.removeMember(chatId, userId, memberId);
            
            res.status(200).json({
                success: true,
                message: 'Membre retiré avec succès'
            });
            
        } catch (error) {
            console.error('Erreur removeMember:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async updateMemberRole(req, res) {
        try {
            const { chatId, memberId } = req.params;
            const { role } = req.body;
            const userId = req.user.id;
            
            await ChatService.updateMemberRole(chatId, userId, memberId, role);
            
            res.status(200).json({
                success: true,
                message: 'Rôle mis à jour avec succès'
            });
            
        } catch (error) {
            console.error('Erreur updateMemberRole:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async leaveGroup(req, res) {
        try {
            const { chatId } = req.params;
            const userId = req.user.id;
            
            await ChatService.leaveGroup(chatId, userId);
            
            res.status(200).json({
                success: true,
                message: 'Vous avez quitté le groupe'
            });
            
        } catch (error) {
            console.error('Erreur leaveGroup:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // PARAMÈTRES
    // =====================================================
    
    async updateChatSettings(req, res) {
        try {
            const { chatId } = req.params;
            const { settings } = req.body;
            const userId = req.user.id;
            
            const chat = await ChatService.updateChatSettings(chatId, userId, settings);
            
            res.status(200).json({
                success: true,
                message: 'Paramètres mis à jour',
                data: chat
            });
            
        } catch (error) {
            console.error('Erreur updateChatSettings:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async updateParticipantSettings(req, res) {
        try {
            const { chatId } = req.params;
            const { is_muted, muted_until, notifications_enabled, nickname } = req.body;
            const userId = req.user.id;
            
            const participant = await ChatService.updateParticipantSettings(chatId, userId, {
                is_muted, muted_until, notifications_enabled, nickname
            });
            
            res.status(200).json({
                success: true,
                message: 'Paramètres mis à jour',
                data: participant
            });
            
        } catch (error) {
            console.error('Erreur updateParticipantSettings:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // STATISTIQUES
    // =====================================================
    
    async getUserStats(req, res) {
        try {
            const userId = req.user.id;
            const stats = await ChatService.getUserStats(userId);
            
            res.status(200).json({ success: true, data: stats });
            
        } catch (error) {
            console.error('Erreur getUserStats:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new ChatController();