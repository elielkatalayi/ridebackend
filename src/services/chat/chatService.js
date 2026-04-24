const { sequelize } = require('../../config/database');
const { Chat, ChatParticipant, ChatMessage, ChatUserStats, User } = require('../../models');
const NotificationService = require('../notification/NotificationService');
const SocketService = require('../notification/SocketService');
const { Op, QueryTypes  } = require('sequelize');

class ChatService {
    
    // =====================================================
    // CRÉATION ET GESTION DES CHATS
    // =====================================================
    
    async createPrivateChat(user1Id, user2Id) {
        const transaction = await sequelize.transaction();
        
        try {
            // Vérifier si un chat existe déjà
            const existingChat = await Chat.findOne({
                where: {
                    chat_type: 'private',
                    [Op.or]: [
                        { user1_id: user1Id, user2_id: user2Id },
                        { user1_id: user2Id, user2_id: user1Id }
                    ]
                }
            });
            
            if (existingChat) {
                return existingChat;
            }
            
            // Créer le chat
            const chat = await Chat.create({
                chat_type: 'private',
                user1_id: user1Id,
                user2_id: user2Id,
                created_by: user1Id
            }, { transaction });
            
            // Ajouter les participants
            await ChatParticipant.bulkCreate([
                { chat_id: chat.id, user_id: user1Id, role: 'member' },
                { chat_id: chat.id, user_id: user2Id, role: 'member' }
            ], { transaction });
            
            // Mettre à jour les statistiques
            await this.updateUserStats(user1Id, { total_chats: 1 }, transaction);
            await this.updateUserStats(user2Id, { total_chats: 1 }, transaction);
            
            await transaction.commit();
            return chat;
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
    async createGroupChat(creatorId, groupData, memberIds = []) {
        const transaction = await sequelize.transaction();
        
        try {
            const chat = await Chat.create({
                chat_type: 'group',
                name: groupData.name,
                avatar_url: groupData.avatar_url,
                description: groupData.description,
                created_by: creatorId,
                is_public: groupData.is_public !== false,
                join_type: groupData.join_type || 'invite',
                settings: groupData.settings || {}
            }, { transaction });
            
            // Ajouter le créateur comme admin
            await ChatParticipant.create({
                chat_id: chat.id,
                user_id: creatorId,
                role: 'admin',
                joined_at: new Date()
            }, { transaction });
            
            // Ajouter les autres membres
            for (const memberId of memberIds) {
                if (memberId !== creatorId) {
                    await ChatParticipant.create({
                        chat_id: chat.id,
                        user_id: memberId,
                        role: 'member',
                        joined_at: new Date()
                    }, { transaction });
                    
                    await this.updateUserStats(memberId, { total_chats: 1 }, transaction);
                }
            }
            
            await chat.update({ member_count: memberIds.length + 1 }, { transaction });
            await this.updateUserStats(creatorId, { total_chats: 1 }, transaction);
            
            await transaction.commit();
            
            // Notifier les membres
            for (const memberId of memberIds) {
                await NotificationService.sendSystemNotification(
                    memberId,
                    'Nouveau groupe',
                    `${groupData.name} - Vous avez été ajouté au groupe`,
                    { chat_id: chat.id, group_name: groupData.name }
                );
            }
            
            return chat;
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
async getUserChats(userId, options = {}) {
    const { limit = 50, offset = 0 } = options;
    
    try {
        // ✅ APPROCHE 1 : Utiliser une requête raw SQL (plus fiable)
        const query = `
            SELECT 
                c.id,
                c.chat_type,
                c.name,
                c.avatar_url,
                c.description,
                c.created_by,
                c.is_public,
                c.join_type,
                c.member_count,
                c.message_count,
                c.settings,
                c.is_active,
                c.is_deleted,
                c.created_at,
                c.updated_at,
                cp.role as user_role,
                cp.is_muted,
                cp.notifications_enabled,
                cp.last_read_at,
                -- Dernier message
                cm.content as last_message,
                cm.created_at as last_message_at,
                cm.sender_id as last_message_sender_id,
                -- Autre participant (pour les chats privés)
                other_user.id as other_user_id,
                other_user.first_name as other_first_name,
                other_user.last_name as other_last_name,
                other_user.avatar_url as other_avatar
            FROM chat_participants cp
            INNER JOIN chats c ON cp.chat_id = c.id AND c.is_deleted = false
            LEFT JOIN LATERAL (
                SELECT content, created_at, sender_id
                FROM chat_messages 
                WHERE chat_id = c.id 
                ORDER BY created_at DESC 
                LIMIT 1
            ) cm ON true
            LEFT JOIN chat_participants other_cp 
                ON c.id = other_cp.chat_id 
                AND other_cp.user_id != cp.user_id
                AND other_cp.left_at IS NULL
            LEFT JOIN users other_user ON other_cp.user_id = other_user.id
            WHERE cp.user_id = :userId 
                AND cp.left_at IS NULL
            ORDER BY cm.created_at DESC NULLS LAST
            LIMIT :limit OFFSET :offset
        `;
        
        const chats = await sequelize.query(query, {
            replacements: { userId, limit, offset },
            type: QueryTypes.SELECT
        });
        
        // Formater les résultats
        const formattedChats = chats.map(chat => ({
            id: chat.id,
            chat_type: chat.chat_type,
            name: chat.chat_type === 'private' 
                ? (chat.other_first_name ? `${chat.other_first_name} ${chat.other_last_name}` : null)
                : chat.name,
            avatar_url: chat.chat_type === 'private' ? chat.other_avatar : chat.avatar_url,
            description: chat.description,
            created_by: chat.created_by,
            is_public: chat.is_public,
            join_type: chat.join_type,
            member_count: chat.member_count,
            message_count: chat.message_count,
            settings: chat.settings,
            is_active: chat.is_active,
            created_at: chat.created_at,
            updated_at: chat.updated_at,
            last_message: chat.last_message,
            last_message_at: chat.last_message_at,
            last_message_sender_id: chat.last_message_sender_id,
            user_role: chat.user_role,
            is_muted: chat.is_muted,
            notifications_enabled: chat.notifications_enabled,
            unread_count: chat.last_read_at < (chat.last_message_at || 0) ? 1 : 0,
            participant: chat.other_user_id ? {
                id: chat.other_user_id,
                first_name: chat.other_first_name,
                last_name: chat.other_last_name,
                avatar_url: chat.other_avatar
            } : null
        }));
        
        return formattedChats;
        
    } catch (error) {
        console.error('Erreur getUserChats:', error);
        throw error;
    }
}
    
    async getChatById(chatId, userId) {
        const chat = await Chat.findOne({
            where: { id: chatId, is_deleted: false },
            include: [
                {
                    model: ChatParticipant,
                    as: 'participants',
                    include: [{ model: User, as: 'user', attributes: ['id', 'first_name', 'avatar_url'] }]
                }
            ]
        });
        
        if (!chat) return null;
        
        // Vérifier si l'utilisateur est participant
        const isParticipant = chat.participants.some(p => p.user_id === userId);
        if (!isParticipant) return null;
        
        const userParticipant = chat.participants.find(p => p.user_id === userId);
        chat.dataValues.user_role = userParticipant?.role;
        chat.dataValues.is_muted = userParticipant?.is_muted;
        chat.dataValues.notifications_enabled = userParticipant?.notifications_enabled;
        
        return chat;
    }
    
    // =====================================================
    // GESTION DES MEMBRES
    // =====================================================
    
    async addMember(chatId, adminId, memberId) {
        const transaction = await sequelize.transaction();
        
        try {
            const admin = await ChatParticipant.findOne({
                where: { chat_id: chatId, user_id: adminId, role: ['admin', 'moderator'] }
            });
            
            if (!admin) throw new Error('Non autorisé');
            
            const existing = await ChatParticipant.findOne({
                where: { chat_id: chatId, user_id: memberId }
            });
            
            if (existing) {
                if (existing.left_at) {
                    await existing.update({ left_at: null, joined_at: new Date() }, { transaction });
                } else {
                    throw new Error('Déjà membre');
                }
            } else {
                await ChatParticipant.create({
                    chat_id: chatId,
                    user_id: memberId,
                    role: 'member',
                    joined_at: new Date()
                }, { transaction });
            }
            
            await Chat.increment('member_count', { by: 1, where: { id: chatId }, transaction });
            await this.updateUserStats(memberId, { total_chats: 1 }, transaction);
            
            await transaction.commit();
            
            const chat = await Chat.findByPk(chatId);
            
            await NotificationService.sendSystemNotification(
                memberId,
                'Ajouté au groupe',
                `Vous avez été ajouté au groupe "${chat.first_name}"`,
                { chat_id: chatId, group_name: chat.first_name}
            );
            
            return true;
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
    async removeMember(chatId, adminId, memberId) {
        const transaction = await sequelize.transaction();
        
        try {
            const admin = await ChatParticipant.findOne({
                where: { chat_id: chatId, user_id: adminId, role: ['admin', 'moderator'] }
            });
            
            if (!admin) throw new Error('Non autorisé');
            
            const member = await ChatParticipant.findOne({
                where: { chat_id: chatId, user_id: memberId }
            });
            
            if (!member) throw new Error('Membre non trouvé');
            
            // Vérifier si c'est le dernier admin
            if (member.role === 'admin') {
                const adminCount = await ChatParticipant.count({
                    where: { chat_id: chatId, role: 'admin', left_at: null }
                });
                if (adminCount <= 1) throw new Error('Impossible de retirer le dernier admin');
            }
            
            await member.update({ left_at: new Date() }, { transaction });
            await Chat.decrement('member_count', { by: 1, where: { id: chatId }, transaction });
            await this.updateUserStats(memberId, { total_chats: -1 }, transaction);
            
            await transaction.commit();
            
            const chat = await Chat.findByPk(chatId);
            
            await NotificationService.sendSystemNotification(
                memberId,
                'Retiré du groupe',
                `Vous avez été retiré du groupe "${chat.name}"`,
                { chat_id: chatId, group_name: chat.name }
            );
            
            return true;
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
    async updateMemberRole(chatId, adminId, memberId, role) {
        const transaction = await sequelize.transaction();
        
        try {
            const admin = await ChatParticipant.findOne({
                where: { chat_id: chatId, user_id: adminId, role: 'admin' }
            });
            
            if (!admin) throw new Error('Seul un admin peut modifier les rôles');
            
            const member = await ChatParticipant.findOne({
                where: { chat_id: chatId, user_id: memberId }
            });
            
            if (!member) throw new Error('Membre non trouvé');
            
            await member.update({ role }, { transaction });
            await transaction.commit();
            
            return member;
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
    async leaveGroup(chatId, userId) {
        const transaction = await sequelize.transaction();
        
        try {
            const member = await ChatParticipant.findOne({
                where: { chat_id: chatId, user_id: userId }
            });
            
            if (!member) throw new Error('Vous n\'êtes pas membre');
            
            // Vérifier si c'est le dernier admin
            if (member.role === 'admin') {
                const adminCount = await ChatParticipant.count({
                    where: { chat_id: chatId, role: 'admin', left_at: null }
                });
                if (adminCount <= 1) throw new Error('Vous êtes le dernier admin. Nommez un autre admin avant de quitter.');
            }
            
            await member.update({ left_at: new Date() }, { transaction });
            await Chat.decrement('member_count', { by: 1, where: { id: chatId }, transaction });
            await this.updateUserStats(userId, { total_chats: -1 }, transaction);
            
            await transaction.commit();
            return true;
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
    // =====================================================
    // PARAMÈTRES
    // =====================================================
    
    async updateChatSettings(chatId, userId, settings) {
        const transaction = await sequelize.transaction();
        
        try {
            const admin = await ChatParticipant.findOne({
                where: { chat_id: chatId, user_id: userId, role: 'admin' }
            });
            
            if (!admin) throw new Error('Seul un admin peut modifier les paramètres');
            
            const chat = await Chat.findByPk(chatId);
            await chat.update({ settings: { ...chat.settings, ...settings } }, { transaction });
            
            await transaction.commit();
            return chat;
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
    async updateParticipantSettings(chatId, userId, settings) {
        const participant = await ChatParticipant.findOne({
            where: { chat_id: chatId, user_id: userId }
        });
        
        if (!participant) throw new Error('Non membre');
        
        await participant.update({
            is_muted: settings.is_muted !== undefined ? settings.is_muted : participant.is_muted,
            muted_until: settings.muted_until || null,
            notifications_enabled: settings.notifications_enabled !== undefined ? settings.notifications_enabled : participant.notifications_enabled,
            nickname: settings.nickname || participant.nickname
        });
        
        return participant;
    }
    
    // =====================================================
    // STATISTIQUES
    // =====================================================
    
    async updateUserStats(userId, increments, transaction = null) {
        try {
            // Chercher ou créer les stats
            let stats = await ChatUserStats.findByPk(userId);
            
            if (!stats) {
                stats = await ChatUserStats.create({
                    user_id: userId,
                    total_messages: 0,
                    total_chats: 0,
                    total_reactions_given: 0,
                    total_reactions_received: 0,
                    total_notes: 0
                }, { transaction });
            }
            
            // Préparer les mises à jour
            const updates = {};
            if (increments.total_messages !== undefined) {
                updates.total_messages = (stats.total_messages || 0) + increments.total_messages;
            }
            if (increments.total_chats !== undefined) {
                updates.total_chats = (stats.total_chats || 0) + increments.total_chats;
            }
            if (increments.total_reactions_given !== undefined) {
                updates.total_reactions_given = (stats.total_reactions_given || 0) + increments.total_reactions_given;
            }
            if (increments.total_reactions_received !== undefined) {
                updates.total_reactions_received = (stats.total_reactions_received || 0) + increments.total_reactions_received;
            }
            if (increments.total_notes !== undefined) {
                updates.total_notes = (stats.total_notes || 0) + increments.total_notes;
            }
            
            // Mettre à jour si nécessaire
            if (Object.keys(updates).length > 0) {
                updates.last_active_at = new Date();
                updates.updated_at = new Date();
                await stats.update(updates, { transaction });
            }
            
            return stats;
            
        } catch (error) {
            console.error('Erreur updateUserStats:', error);
            // Ne pas bloquer l'opération principale
            return { success: false, error: error.message };
        }
    }
    
    async getUserStats(userId) {
        const stats = await ChatUserStats.findByPk(userId);
        return stats || { total_messages: 0, total_chats: 0, total_reactions_given: 0, total_reactions_received: 0 };
    }
}

module.exports = new ChatService();