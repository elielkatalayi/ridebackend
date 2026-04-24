const { sequelize } = require('../../config/database');
const { Chat, ChatMessage, ChatParticipant, ChatReaction, ChatPinnedMessage, ChatUserStats,User  } = require('../../models');
const NotificationService = require('../notification/NotificationService');
const SocketService = require('../notification/SocketService');
const { uploadToSupabase } = require('../../utils/storage');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

class MessageService {
    
    // =====================================================
    // ENVOI DE MESSAGES
    // =====================================================
    
    async sendMessage(chatId, senderId, messageData, files = null) {
        const transaction = await sequelize.transaction();
        
        try {
            const chat = await Chat.findByPk(chatId);
            if (!chat) throw new Error('Chat non trouvé');
            
            // Vérifier slow mode
            if (chat.settings?.slow_mode_seconds > 0) {
                const lastMessage = await ChatMessage.findOne({
                    where: { chat_id: chatId, sender_id: senderId },
                    order: [['created_at', 'DESC']]
                });
                
                if (lastMessage) {
                    const secondsSince = (Date.now() - new Date(lastMessage.created_at)) / 1000;
                    if (secondsSince < chat.settings.slow_mode_seconds) {
                        throw new Error(`Veuillez attendre ${Math.ceil(chat.settings.slow_mode_seconds - secondsSince)} secondes`);
                    }
                }
            }
            
            let mediaData = null;
            
            // Upload des fichiers
            if (files && files.length > 0) {
                const file = files[0];
                const fileExt = file.originalname.split('.').pop();
                const fileName = `chat_${uuidv4()}_${Date.now()}.${fileExt}`;
                
                let mediaType = 'document';
                let messageType = 'document';
                
                if (file.mimetype.startsWith('image/')) {
                    messageType = 'image';
                    mediaType = 'image';
                } else if (file.mimetype.startsWith('video/')) {
                    messageType = 'video';
                    mediaType = 'video';
                } else if (file.mimetype.startsWith('audio/')) {
                    messageType = 'audio';
                    mediaType = 'audio';
                }
                
                const folder = `chat/${chatId}/${messageType}s`;
                const { url, thumbnail } = await uploadToSupabase(
                    'chat-media', folder, file.buffer, file.mimetype, fileName
                );
                
                mediaData = {
                    url,
                    thumbnail: thumbnail || null,
                    type: mediaType,
                    size: file.size,
                    duration: file.duration || null,
                    name: file.originalname
                };
            }
            
            // Créer le message
            const message = await ChatMessage.create({
                chat_id: chatId,
                sender_id: senderId,
                message_type: messageData.message_type || (mediaData ? mediaData.type : 'text'),
                content: messageData.content || null,
                media_url: mediaData?.url,
                media_type: mediaData?.type,
                media_size: mediaData?.size,
                media_duration: mediaData?.duration,
                thumbnail_url: mediaData?.thumbnail,
                file_name: mediaData?.name,
                reply_to_id: messageData.reply_to_id || null,
                reply_preview: messageData.reply_preview,
                mentions: messageData.mentions || [],
                location_lat: messageData.location_lat,
                location_lng: messageData.location_lng,
                location_address: messageData.location_address,
                poll_data: messageData.poll_data,
                is_ephemeral: messageData.is_ephemeral || false,
                expires_at: messageData.is_ephemeral ? new Date(Date.now() + (messageData.ephemeral_duration || 30) * 1000) : null,
                status: 'sent'
            }, { transaction });
            
            // Mettre à jour le dernier message du chat
            await chat.update({
                last_message: message.content?.substring(0, 100) || `[${message.message_type}]`,
                last_message_at: message.created_at,
                last_message_sender_id: senderId,
                message_count: chat.message_count + 1
            }, { transaction });
            
            // Mettre à jour les statistiques utilisateur
            try {
                await this.updateUserStats(senderId, { total_messages: 1 }, transaction);
            } catch (statsError) {
                console.warn('⚠️ Erreur mise à jour stats utilisateur:', statsError.message);
                // Ne pas bloquer l'envoi du message
            }
            
            // Commit de la transaction
            await transaction.commit();
            
            // Notifier les participants (hors transaction)
            await this.notifyMessage(chat, message, senderId);
            
            // Gérer les messages éphémères
            if (message.is_ephemeral) {
                setTimeout(async () => {
                    try {
                        await this.deleteEphemeralMessage(message.id);
                    } catch (err) {
                        console.error('Erreur suppression message éphémère:', err);
                    }
                }, (messageData.ephemeral_duration || 30) * 1000);
            }
            
            return message;
            
        } catch (error) {
            // Vérifier si la transaction existe et n'est pas déjà terminée
            if (transaction && !transaction.finished) {
                await transaction.rollback();
            }
            throw error;
        }
    }
    
    async notifyMessage(chat, message, senderId) {
        try {
            // 1. Récupérer les infos de l'expéditeur
            const sender = await User.findByPk(senderId, {
                attributes: ['first_name', 'last_name']
            });
            
            // 2. Construire le nom complet
            const senderName = sender 
                ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim() 
                : 'Quelqu\'un';
            
            // 3. Récupérer les participants (sauf l'expéditeur)
            const participants = await ChatParticipant.findAll({
                where: { 
                    chat_id: chat.id, 
                    left_at: null, 
                    user_id: { [Op.ne]: senderId } 
                }
            });
            
            // 4. Notifier chaque participant
            for (const participant of participants) {
                // Ne pas notifier si muet
                if (participant.is_muted && (!participant.muted_until || participant.muted_until > new Date())) {
                    continue;
                }
                
                // Notification via socket
                SocketService.sendToUser(participant.user_id, 'chat:message:new', {
                    chat_id: chat.id,
                    message_id: message.id,
                    sender_id: senderId,
                    content: message.content,
                    message_type: message.message_type,
                    media_url: message.media_url,
                    created_at: message.created_at
                });
                
                // Notification push si pas en ligne
                const isOnline = SocketService.isUserOnline(participant.user_id);
                if (!isOnline && participant.notifications_enabled) {
                    let notificationBody = message.content || '';
                    if (message.message_type !== 'text') {
                        const typeLabels = {
                            'image': '📷 une image',
                            'video': '🎥 une vidéo',
                            'audio': '🎵 un audio',
                            'document': '📄 un document'
                        };
                        notificationBody = typeLabels[message.message_type] || `📎 ${message.message_type}`;
                    }
                    
                    // Limiter la longueur du body
                    if (notificationBody.length > 100) {
                        notificationBody = notificationBody.substring(0, 97) + '...';
                    }
                    
                    try {
                        await NotificationService.sendChatMessage(
                            participant.user_id,
                            message.id,
                            chat.id,
                            chat.chat_type,
                            senderName,
                            senderId,
                            notificationBody,
                            message.mentions?.includes(participant.user_id) || false,
                            chat.name || null
                        );
                    } catch (notifError) {
                        console.error('❌ Erreur envoi notification push:', notifError.message);
                        // Ne pas bloquer l'envoi du message
                    }
                }
            }
            
            // 5. Notifier les mentions (priorité haute)
            if (message.mentions && message.mentions.length > 0) {
                for (const mentionId of message.mentions) {
                    if (mentionId !== senderId) {
                        try {
                            await NotificationService.sendChatMessage(
                                mentionId,
                                message.id,
                                chat.id,
                                chat.chat_type,
                                senderName,
                                senderId,
                                `👤 @vous ${message.content?.substring(0, 50) || ''}`,
                                true,
                                chat.name || null
                            );
                        } catch (notifError) {
                            console.error('❌ Erreur envoi notification mention:', notifError.message);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('❌ Erreur dans notifyMessage:', error);
            // Ne pas propager l'erreur pour ne pas bloquer l'envoi du message
        }
    }
    
    // =====================================================
    // RÉCUPÉRATION DES MESSAGES
    // =====================================================
    
    async getMessages(chatId, userId, options = {}) {
        const { limit = 50, offset = 0, before = null, after = null } = options;
        
        const participant = await ChatParticipant.findOne({
            where: { chat_id: chatId, user_id: userId, left_at: null }
        });
        
        if (!participant) throw new Error('Non membre');
        
        const where = { chat_id: chatId, is_deleted: false };
        
        if (before) {
            where.created_at = { [Op.lt]: before };
        }
        if (after) {
            where.created_at = { [Op.gt]: after };
        }
        
        const messages = await ChatMessage.findAll({
            where,
            include: [
                { 
                    model: User, 
                    as: 'sender', 
                    attributes: ['id', 'first_name', 'last_name', 'avatar_url'] 
                },
                { 
                    model: ChatReaction, 
                    as: 'reactions', 
                    include: [{ 
                        model: User, 
                        as: 'user', 
                        attributes: ['id', 'first_name', 'last_name'] 
                    }] 
                },
                { 
                    model: ChatMessage, 
                    as: 'replyTo',  // Le message auquel on répond
                    required: false,
                    include: [{ 
                        model: User, 
                        as: 'sender', 
                        attributes: ['id', 'first_name', 'last_name'] 
                    }] 
                },
                { 
                    model: ChatMessage, 
                    as: 'replies',  // Les réponses à ce message
                    required: false,
                    limit: 3,  // Limiter le nombre de réponses pour performance
                    separate: true,  // Exécuter une requête séparée pour les replies
                    include: [{ 
                        model: User, 
                        as: 'sender', 
                        attributes: ['id', 'first_name', 'last_name'] 
                    }] 
                }
            ],
            order: [['created_at', 'DESC']],
            limit,
            offset,
            subQuery: false  // Éviter les problèmes avec les associations multiples
        });
        
        // Marquer les messages comme lus
        if (messages.length > 0) {
            const lastMessageId = messages[0].id;
            await participant.update({
                last_read_at: new Date(),
                last_read_message_id: lastMessageId
            });
        }
        
        return messages.reverse();
    }
    
    async getMessageById(messageId, userId) {
        const message = await ChatMessage.findOne({
            where: { id: messageId, is_deleted: false },
            include: [
                { model: User, as: 'sender', attributes: ['id', 'first_name', 'last_name', 'avatar_url'] },
                { model: ChatReaction, as: 'reactions', include: [{ model: User, as: 'user', attributes: ['id', 'first_name', 'last_name'] }] }
            ]
        });
        
        if (!message) return null;
        
        // Vérifier si l'utilisateur est membre du chat
        const participant = await ChatParticipant.findOne({
            where: { chat_id: message.chat_id, user_id: userId, left_at: null }
        });
        
        if (!participant) return null;
        
        return message;
    }
    
    // =====================================================
    // MODIFICATION DE MESSAGES
    // =====================================================
    
    async editMessage(messageId, userId, newContent) {
        const transaction = await sequelize.transaction();
        
        try {
            const message = await ChatMessage.findOne({
                where: { id: messageId, sender_id: userId, is_deleted: false }
            });
            
            if (!message) throw new Error('Message non trouvé ou non autorisé');
            
            const chat = await Chat.findByPk(message.chat_id);
            // ✅ Changer de 60 minutes à 120 minutes (2 heures)
            const editTimeout = chat.settings?.edit_timeout_minutes || 120; // 2 heures
            const minutesSince = (Date.now() - new Date(message.created_at)) / 60000000;
            
            if (minutesSince > editTimeout) {
                throw new Error(`Délai de modification dépassé (${editTimeout} minutes max)`);
            }
            
            // Sauvegarder l'historique
            const editHistory = message.edit_history || [];
            editHistory.push({
                content: message.content,
                edited_at: new Date(),
                by: userId
            });
            
            await message.update({
                content: newContent,
                is_edited: true,
                edited_at: new Date(),
                edit_history: editHistory
            }, { transaction });
            
            await transaction.commit();
            
            // Notifier les participants
            const participants = await ChatParticipant.findAll({
                where: { chat_id: message.chat_id, left_at: null }
            });
            
            for (const participant of participants) {
                SocketService.sendToUser(participant.user_id, 'chat:message:updated', {
                    message_id: messageId,
                    chat_id: message.chat_id,
                    content: newContent,
                    edited_at: message.edited_at
                });
            }
            
            return message;
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
    // =====================================================
    // SUPPRESSION DE MESSAGES
    // =====================================================
    
    async deleteMessage(messageId, userId, forEveryone = false) {
        const transaction = await sequelize.transaction();
        
        try {
            const message = await ChatMessage.findByPk(messageId);
            if (!message) throw new Error('Message non trouvé');
            
            let canDelete = message.sender_id === userId;
            
            if (!canDelete && forEveryone) {
                const participant = await ChatParticipant.findOne({
                    where: { chat_id: message.chat_id, user_id: userId, role: ['admin', 'moderator'] }
                });
                canDelete = !!participant;
            }
            
            if (!canDelete) throw new Error('Non autorisé');
            
            await message.update({
                is_deleted: true,
                deleted_by: userId,
                deleted_for_all: forEveryone,
                deleted_at: new Date(),
                content: forEveryone ? 'Message supprimé' : null
            }, { transaction });
            
            await transaction.commit();
            
            // Notifier les participants
            const participants = await ChatParticipant.findAll({
                where: { chat_id: message.chat_id, left_at: null }
            });
            
            for (const participant of participants) {
                SocketService.sendToUser(participant.user_id, 'chat:message:deleted', {
                    message_id: messageId,
                    chat_id: message.chat_id,
                    deleted_for_all: forEveryone,
                    deleted_by: userId
                });
            }
            
            return true;
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
    async deleteEphemeralMessage(messageId) {
        const message = await ChatMessage.findByPk(messageId);
        if (message && message.is_ephemeral && !message.was_read) {
            await message.update({ is_deleted: true, deleted_at: new Date() });
        }
    }
    
    // =====================================================
    // RÉACTIONS
    // =====================================================
    
    async addReaction(messageId, userId, reactionType) {
        const transaction = await sequelize.transaction();
        
        try {
            const message = await ChatMessage.findByPk(messageId);
            if (!message) throw new Error('Message non trouvé');
            
            const existing = await ChatReaction.findOne({
                where: { message_id: messageId, user_id: userId }
            });
            
            if (existing) {
                if (existing.reaction_type === reactionType) {
                    throw new Error('Déjà réagi');
                }
                await existing.update({ reaction_type: reactionType }, { transaction });
            } else {
                await ChatReaction.create({
                    message_id: messageId,
                    user_id: userId,
                    reaction_type: reactionType
                }, { transaction });
                
                await this.updateUserStats(userId, { total_reactions_given: 1 }, transaction);
            }
            
            await transaction.commit();
            
            // Notifier
            SocketService.sendToUser(message.sender_id, 'chat:reaction:added', {
                message_id: messageId,
                user_id: userId,
                reaction_type: reactionType
            });
            
            return true;
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
    async removeReaction(messageId, userId) {
        const reaction = await ChatReaction.findOne({
            where: { message_id: messageId, user_id: userId }
        });
        
        if (!reaction) throw new Error('Réaction non trouvée');
        
        await reaction.destroy();
        await this.updateUserStats(userId, { total_reactions_given: -1 });
        
        return true;
    }
    
    // =====================================================
    // MESSAGES ÉPINGLÉS
    // =====================================================
    
    async pinMessage(chatId, messageId, userId) {
        const transaction = await sequelize.transaction();
        
        try {
            const participant = await ChatParticipant.findOne({
                where: { chat_id: chatId, user_id: userId, role: ['admin', 'moderator'] }
            });
            
            if (!participant) throw new Error('Non autorisé');
            
            await ChatPinnedMessage.create({
                chat_id: chatId,
                message_id: messageId,
                pinned_by: userId
            }, { transaction });
            
            await transaction.commit();
            
            // Notifier
            const participants = await ChatParticipant.findAll({
                where: { chat_id: chatId, left_at: null }
            });
            
            for (const p of participants) {
                SocketService.sendToUser(p.user_id, 'chat:message:pinned', {
                    message_id: messageId,
                    chat_id: chatId,
                    pinned_by: userId
                });
            }
            
            return true;
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
    async unpinMessage(chatId, messageId, userId) {
        const transaction = await sequelize.transaction();
        
        try {
            const participant = await ChatParticipant.findOne({
                where: { chat_id: chatId, user_id: userId, role: ['admin', 'moderator'] }
            });
            
            if (!participant) throw new Error('Non autorisé');
            
            await ChatPinnedMessage.destroy({
                where: { chat_id: chatId, message_id: messageId }
            }, { transaction });
            
            await transaction.commit();
            
            return true;
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
    async getPinnedMessages(chatId, limit = 20) {
        const pinned = await ChatPinnedMessage.findAll({
            where: { chat_id: chatId },
            include: [
                { model: ChatMessage, as: 'message', include: [{ model: User, as: 'sender', attributes: ['id', 'first_name', 'last_name'] }] },
                { model: User, as: 'pinner', attributes: ['id', 'first_name', 'last_name'] }
            ],
            order: [['pinned_at', 'DESC']],
            limit
        });
        
        return pinned.map(p => p.message);
    }
    
    // =====================================================
    // ACCUSÉS DE LECTURE
    // =====================================================
    
    async markAsRead(chatId, userId, messageId) {
        const participant = await ChatParticipant.findOne({
            where: { chat_id: chatId, user_id: userId, left_at: null }
        });
        
        if (!participant) throw new Error('Non membre');
        
        await participant.update({
            last_read_at: new Date(),
            last_read_message_id: messageId
        });
        
        // Notifier l'expéditeur du dernier message
        const lastMessage = await ChatMessage.findOne({
            where: { chat_id: chatId },
            order: [['created_at', 'DESC']]
        });
        
        if (lastMessage && lastMessage.sender_id !== userId) {
            SocketService.sendToUser(lastMessage.sender_id, 'chat:message:read', {
                message_id: lastMessage.id,
                chat_id: chatId,
                user_id: userId,
                read_at: new Date()
            });
        }
        
        // Mettre à jour le message comme lu si éphémère
        if (messageId) {
            const message = await ChatMessage.findByPk(messageId);
            if (message && message.is_ephemeral && !message.was_read) {
                await message.update({ was_read: true });
            }
        }
        
        return true;
    }
    
    async markAsDelivered(chatId, userId, messageId) {
        const participant = await ChatParticipant.findOne({
            where: { chat_id: chatId, user_id: userId }
        });
        
        if (participant) {
            await participant.update({ last_delivered_at: new Date() });
        }
        
        const message = await ChatMessage.findByPk(messageId);
        if (message && message.sender_id !== userId) {
            SocketService.sendToUser(message.sender_id, 'chat:message:delivered', {
                message_id: messageId,
                chat_id: chatId,
                user_id: userId,
                delivered_at: new Date()
            });
        }
        
        return true;
    }
    
    // =====================================================
    // RECHERCHE
    // =====================================================
    
    async searchMessages(userId, query, options = {}) {
        const { limit = 50, offset = 0, chatId = null } = options;
        
        // Récupérer les chats de l'utilisateur
        const userChats = await ChatParticipant.findAll({
            where: { user_id: userId, left_at: null },
            attributes: ['chat_id']
        });
        
        const chatIds = userChats.map(c => c.chat_id);
        
        if (chatId && !chatIds.includes(chatId)) throw new Error('Non autorisé');
        
        const where = {
            chat_id: chatId ? [chatId] : { [Op.in]: chatIds },
            is_deleted: false,
            [Op.or]: [
                { content: { [Op.iLike]: `%${query}%` } },
                { file_name: { [Op.iLike]: `%${query}%` } }
            ]
        };
        
        const messages = await ChatMessage.findAll({
            where,
            include: [
                { model: User, as: 'sender', attributes: ['id', 'first_name', 'last_name', 'avatar_url'] },
                { model: Chat, as: 'chat', attributes: ['id', 'name', 'chat_type'] }  // ✅ name, pas first_name/last_name
            ],
            order: [['created_at', 'DESC']],
            limit,
            offset
        });
        
        return messages;
    }
    
    // =====================================================
    // UTILITAIRES
    // =====================================================
    
    async updateUserStats(userId, increments, transaction = null) {
        const [stats, created] = await ChatUserStats.findOrCreate({
            where: { user_id: userId },
            defaults: { user_id: userId },
            transaction
        });
        
        const updates = {};
        if (increments.total_messages) updates.total_messages = stats.total_messages + increments.total_messages;
        if (increments.total_reactions_given) updates.total_reactions_given = stats.total_reactions_given + increments.total_reactions_given;
        
        if (Object.keys(updates).length > 0) {
            await stats.update(updates, { transaction });
        }
        
        return stats;
    }
}

module.exports = new MessageService();