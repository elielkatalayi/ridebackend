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
                state: true,
                message: 'Chat créé avec succès',
                datas: chat
            });
            
        } catch (error) {
            console.error('Erreur createPrivateChat:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
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
                state: true,
                message: 'Groupe créé avec succès',
                datas: chat
            });
            
        } catch (error) {
            console.error('Erreur createGroupChat:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
    
    async getUserChats(req, res) {
        try {
            const userId = req.user.id;
            const limit = parseInt(req.query.limit) || 50;
            const offset = parseInt(req.query.offset) || 0;
            
            const result = await ChatService.getUserChats(userId, { limit, offset });
            
            const chats = result.rows || result;
            const total = result.count || (Array.isArray(chats) ? chats.length : 0);
            
            const totalPages = Math.ceil(total / limit);
            const currentPage = Math.floor(offset / limit) + 1;
            
            res.status(200).json({
                state: true,
                message: 'Chats récupérés avec succès',
                datas: chats,
                meta: {
                    total: total,
                    count: chats.length,
                    per_page: limit,
                    current_page: currentPage,
                    total_pages: totalPages
                }
            });
            
        } catch (error) {
            console.error('Erreur getUserChats:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
    
    async getChatById(req, res) {
        try {
            const { chatId } = req.params;
            const userId = req.user.id;
            
            const chat = await ChatService.getChatById(chatId, userId);
            
            if (!chat) {
                return res.status(404).json({ 
                    state: false, 
                    message: 'Chat non trouvé', 
                    datas: null 
                });
            }
            
            res.status(200).json({ 
                state: true, 
                message: 'Chat récupéré avec succès',
                datas: chat
            });
            
        } catch (error) {
            console.error('Erreur getChatById:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
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
                state: true,
                message: 'Membre ajouté avec succès',
                datas: null
            });
            
        } catch (error) {
            console.error('Erreur addMember:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
    
    async removeMember(req, res) {
        try {
            const { chatId, memberId } = req.params;
            const userId = req.user.id;
            
            await ChatService.removeMember(chatId, userId, memberId);
            
            res.status(200).json({
                state: true,
                message: 'Membre retiré avec succès',
                datas: null
            });
            
        } catch (error) {
            console.error('Erreur removeMember:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
    
    async updateMemberRole(req, res) {
        try {
            const { chatId, memberId } = req.params;
            const { role } = req.body;
            const userId = req.user.id;
            
            await ChatService.updateMemberRole(chatId, userId, memberId, role);
            
            res.status(200).json({
                state: true,
                message: 'Rôle mis à jour avec succès',
                datas: null
            });
            
        } catch (error) {
            console.error('Erreur updateMemberRole:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
    
    async leaveGroup(req, res) {
        try {
            const { chatId } = req.params;
            const userId = req.user.id;
            
            await ChatService.leaveGroup(chatId, userId);
            
            res.status(200).json({
                state: true,
                message: 'Vous avez quitté le groupe',
                datas: null
            });
            
        } catch (error) {
            console.error('Erreur leaveGroup:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
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
                state: true,
                message: 'Paramètres mis à jour',
                datas: chat
            });
            
        } catch (error) {
            console.error('Erreur updateChatSettings:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
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
                state: true,
                message: 'Paramètres mis à jour',
                datas: participant
            });
            
        } catch (error) {
            console.error('Erreur updateParticipantSettings:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
    
    // =====================================================
    // STATISTIQUES
    // =====================================================
    
    async getUserStats(req, res) {
        try {
            const userId = req.user.id;
            const stats = await ChatService.getUserStats(userId);
            
            res.status(200).json({ 
                state: true, 
                message: 'Statistiques récupérées avec succès',
                datas: stats
            });
            
        } catch (error) {
            console.error('Erreur getUserStats:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
}

module.exports = new ChatController();