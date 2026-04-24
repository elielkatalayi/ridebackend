const SocketService = require('../../services/notification/SocketService');
const ChatService = require('../../services/chat/chatService');
const MessageService = require('../../services/chat/messageService');
const TransferService = require('../../services/chat/transferService');
const NotificationService = require('../../services/notification/NotificationService');

class ChatHandler {
    constructor(io, socket) {
        this.io = io;
        this.socket = socket;
        this.userId = socket.userId;
        this.userRooms = new Set(); // Stocker les rooms où l'utilisateur est connecté
    }

    register() {
        // =====================================================
        // REJOINDRE/QUITTER DES CHATS
        // =====================================================
        
        this.socket.on('chat:join', this.handleJoinChat.bind(this));
        this.socket.on('chat:leave', this.handleLeaveChat.bind(this));
        this.socket.on('chat:join-multiple', this.handleJoinMultipleChats.bind(this));
        
        // =====================================================
        // MESSAGES
        // =====================================================
        
        this.socket.on('chat:message', this.handleSendMessage.bind(this));
        this.socket.on('chat:edit', this.handleEditMessage.bind(this));
        this.socket.on('chat:delete', this.handleDeleteMessage.bind(this));
        this.socket.on('chat:delete-for-all', this.handleDeleteForAll.bind(this));
        
        // =====================================================
        // RÉACTIONS
        // =====================================================
        
        this.socket.on('chat:react', this.handleAddReaction.bind(this));
        this.socket.on('chat:unreact', this.handleRemoveReaction.bind(this));
        
        // =====================================================
        // TYPING INDICATOR
        // =====================================================
        
        this.socket.on('chat:typing', this.handleTyping.bind(this));
        this.socket.on('chat:stop-typing', this.handleStopTyping.bind(this));
        
        // =====================================================
        // ACCUSÉS DE LECTURE
        // =====================================================
        
        this.socket.on('chat:read', this.handleMarkAsRead.bind(this));
        this.socket.on('chat:delivered', this.handleMarkAsDelivered.bind(this));
        
        // =====================================================
        // MESSAGES ÉPINGLÉS
        // =====================================================
        
        this.socket.on('chat:pin', this.handlePinMessage.bind(this));
        this.socket.on('chat:unpin', this.handleUnpinMessage.bind(this));
        
        // =====================================================
        // TRANSFERTS
        // =====================================================
        
        this.socket.on('chat:transfer', this.handleTransferMessage.bind(this));
        
        // =====================================================
        // MEMBRES
        // =====================================================
        
        this.socket.on('chat:add-member', this.handleAddMember.bind(this));
        this.socket.on('chat:remove-member', this.handleRemoveMember.bind(this));
        this.socket.on('chat:update-role', this.handleUpdateRole.bind(this));
        
        // =====================================================
        // DÉCONNEXION
        // =====================================================
        
        this.socket.on('disconnect', this.handleDisconnect.bind(this));
    }

    // =====================================================
    // GESTION DES ROOMS
    // =====================================================
    
    async handleJoinChat(data) {
        try {
            const { chatId } = data;
            
            // Vérifier si l'utilisateur est membre du chat
            const participant = await ChatService.isParticipant(chatId, this.userId);
            if (!participant) {
                this.socket.emit('chat:error', { message: 'Vous n\'êtes pas membre de ce chat' });
                return;
            }
            
            const roomName = `chat:${chatId}`;
            await this.socket.join(roomName);
            this.userRooms.add(roomName);
            
            // Notifier les autres membres que l'utilisateur est en ligne
            this.socket.to(roomName).emit('chat:user:online', {
                user_id: this.userId,
                chat_id: chatId,
                timestamp: new Date()
            });
            
            this.socket.emit('chat:joined', { chatId });
            
            console.log(`User ${this.userId} joined chat ${chatId}`);
            
        } catch (error) {
            console.error('Error in handleJoinChat:', error);
            this.socket.emit('chat:error', { message: error.message });
        }
    }
    
    async handleLeaveChat(data) {
        try {
            const { chatId } = data;
            const roomName = `chat:${chatId}`;
            
            await this.socket.leave(roomName);
            this.userRooms.delete(roomName);
            
            // Notifier les autres membres
            this.socket.to(roomName).emit('chat:user:offline', {
                user_id: this.userId,
                chat_id: chatId,
                timestamp: new Date()
            });
            
            this.socket.emit('chat:left', { chatId });
            
        } catch (error) {
            console.error('Error in handleLeaveChat:', error);
            this.socket.emit('chat:error', { message: error.message });
        }
    }
    
    async handleJoinMultipleChats(data) {
        try {
            const { chatIds } = data;
            
            for (const chatId of chatIds) {
                const participant = await ChatService.isParticipant(chatId, this.userId);
                if (participant) {
                    const roomName = `chat:${chatId}`;
                    await this.socket.join(roomName);
                    this.userRooms.add(roomName);
                }
            }
            
            this.socket.emit('chat:joined-multiple', { chatIds: Array.from(this.userRooms).map(r => r.replace('chat:', '')) });
            
        } catch (error) {
            console.error('Error in handleJoinMultipleChats:', error);
            this.socket.emit('chat:error', { message: error.message });
        }
    }
    
    // =====================================================
    // MESSAGES
    // =====================================================
    
    async handleSendMessage(data) {
        try {
            const { chatId, content, messageType, replyToId, mentions, location, isEphemeral, ephemeralDuration } = data;
            
            // Vérifier slow mode
            const canSend = await this.checkSlowMode(chatId, this.userId);
            if (!canSend) {
                this.socket.emit('chat:error', { message: 'Veuillez patienter avant d\'envoyer un autre message' });
                return;
            }
            
            // Envoyer le message
            const message = await MessageService.sendMessage(
                chatId,
                this.userId,
                {
                    content,
                    message_type: messageType || 'text',
                    reply_to_id: replyToId,
                    mentions: mentions || [],
                    location_lat: location?.lat,
                    location_lng: location?.lng,
                    location_address: location?.address,
                    is_ephemeral: isEphemeral || false,
                    ephemeral_duration: ephemeralDuration
                },
                data.files
            );
            
            // Récupérer le message complet avec les infos utilisateur
            const fullMessage = await MessageService.getMessageById(message.id, this.userId);
            
            // Diffuser à tous les membres du chat
            const roomName = `chat:${chatId}`;
            this.io.to(roomName).emit('chat:message:new', {
                chat_id: chatId,
                message: fullMessage,
                sender_id: this.userId,
                timestamp: new Date()
            });
            
            // Notifier les mentions spécifiquement
            if (mentions && mentions.length > 0) {
                for (const mentionedUserId of mentions) {
                    if (mentionedUserId !== this.userId) {
                        // Envoyer une notification push prioritaire
                        await NotificationService.sendChatMessage(
                            mentionedUserId,
                            message.id,
                            chatId,
                            'group',
                            this.socket.userName || 'Quelqu\'un',
                            this.userId,
                            `@vous ${content?.substring(0, 50) || ''}`,
                            true
                        );
                        
                        // Notification socket
                        SocketService.sendToUser(mentionedUserId, 'chat:mention', {
                            chat_id: chatId,
                            message_id: message.id,
                            sender_id: this.userId,
                            content: content?.substring(0, 100),
                            timestamp: new Date()
                        });
                    }
                }
            }
            
            // Mettre à jour le dernier message du chat
            await ChatService.updateLastMessage(chatId, message.id, this.userId, content);
            
        } catch (error) {
            console.error('Error in handleSendMessage:', error);
            this.socket.emit('chat:error', { message: error.message });
        }
    }
    
    async handleEditMessage(data) {
        try {
            const { messageId, content } = data;
            
            const message = await MessageService.editMessage(messageId, this.userId, content);
            
            const roomName = `chat:${message.chat_id}`;
            this.io.to(roomName).emit('chat:message:updated', {
                message_id: messageId,
                chat_id: message.chat_id,
                content: content,
                edited_at: new Date(),
                edited_by: this.userId
            });
            
        } catch (error) {
            console.error('Error in handleEditMessage:', error);
            this.socket.emit('chat:error', { message: error.message });
        }
    }
    
    async handleDeleteMessage(data) {
        try {
            const { messageId } = data;
            
            const message = await MessageService.getMessageById(messageId, this.userId);
            if (!message) {
                this.socket.emit('chat:error', { message: 'Message non trouvé' });
                return;
            }
            
            await MessageService.deleteMessage(messageId, this.userId, false);
            
            const roomName = `chat:${message.chat_id}`;
            this.io.to(roomName).emit('chat:message:deleted', {
                message_id: messageId,
                chat_id: message.chat_id,
                deleted_by: this.userId,
                deleted_for_all: false,
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error('Error in handleDeleteMessage:', error);
            this.socket.emit('chat:error', { message: error.message });
        }
    }
    
    async handleDeleteForAll(data) {
        try {
            const { messageId } = data;
            
            const message = await MessageService.getMessageById(messageId, this.userId);
            if (!message) {
                this.socket.emit('chat:error', { message: 'Message non trouvé' });
                return;
            }
            
            await MessageService.deleteMessage(messageId, this.userId, true);
            
            const roomName = `chat:${message.chat_id}`;
            this.io.to(roomName).emit('chat:message:deleted', {
                message_id: messageId,
                chat_id: message.chat_id,
                deleted_by: this.userId,
                deleted_for_all: true,
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error('Error in handleDeleteForAll:', error);
            this.socket.emit('chat:error', { message: error.message });
        }
    }
    
    // =====================================================
    // RÉACTIONS
    // =====================================================
    
    async handleAddReaction(data) {
        try {
            const { messageId, reactionType } = data;
            
            await MessageService.addReaction(messageId, this.userId, reactionType);
            
            const message = await MessageService.getMessageById(messageId, this.userId);
            const roomName = `chat:${message.chat_id}`;
            
            this.io.to(roomName).emit('chat:reaction:added', {
                message_id: messageId,
                chat_id: message.chat_id,
                user_id: this.userId,
                reaction_type: reactionType,
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error('Error in handleAddReaction:', error);
            this.socket.emit('chat:error', { message: error.message });
        }
    }
    
    async handleRemoveReaction(data) {
        try {
            const { messageId } = data;
            
            await MessageService.removeReaction(messageId, this.userId);
            
            const message = await MessageService.getMessageById(messageId, this.userId);
            const roomName = `chat:${message.chat_id}`;
            
            this.io.to(roomName).emit('chat:reaction:removed', {
                message_id: messageId,
                chat_id: message.chat_id,
                user_id: this.userId,
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error('Error in handleRemoveReaction:', error);
            this.socket.emit('chat:error', { message: error.message });
        }
    }
    
    // =====================================================
    // TYPING INDICATOR
    // =====================================================
    
    async handleTyping(data) {
        try {
            const { chatId } = data;
            
            const roomName = `chat:${chatId}`;
            this.socket.to(roomName).emit('chat:typing', {
                chat_id: chatId,
                user_id: this.userId,
                is_typing: true,
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error('Error in handleTyping:', error);
        }
    }
    
    async handleStopTyping(data) {
        try {
            const { chatId } = data;
            
            const roomName = `chat:${chatId}`;
            this.socket.to(roomName).emit('chat:typing', {
                chat_id: chatId,
                user_id: this.userId,
                is_typing: false,
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error('Error in handleStopTyping:', error);
        }
    }
    
    // =====================================================
    // ACCUSÉS DE LECTURE
    // =====================================================
    
    async handleMarkAsRead(data) {
        try {
            const { chatId, messageId } = data;
            
            await MessageService.markAsRead(chatId, this.userId, messageId);
            
            const roomName = `chat:${chatId}`;
            this.io.to(roomName).emit('chat:message:read', {
                chat_id: chatId,
                user_id: this.userId,
                last_read_message_id: messageId,
                read_at: new Date()
            });
            
        } catch (error) {
            console.error('Error in handleMarkAsRead:', error);
        }
    }
    
    async handleMarkAsDelivered(data) {
        try {
            const { chatId, messageId } = data;
            
            await MessageService.markAsDelivered(chatId, this.userId, messageId);
            
            const roomName = `chat:${chatId}`;
            this.io.to(roomName).emit('chat:message:delivered', {
                chat_id: chatId,
                user_id: this.userId,
                message_id: messageId,
                delivered_at: new Date()
            });
            
        } catch (error) {
            console.error('Error in handleMarkAsDelivered:', error);
        }
    }
    
    // =====================================================
    // MESSAGES ÉPINGLÉS
    // =====================================================
    
    async handlePinMessage(data) {
        try {
            const { chatId, messageId } = data;
            
            await MessageService.pinMessage(chatId, messageId, this.userId);
            
            const roomName = `chat:${chatId}`;
            this.io.to(roomName).emit('chat:message:pinned', {
                chat_id: chatId,
                message_id: messageId,
                pinned_by: this.userId,
                pinned_at: new Date()
            });
            
        } catch (error) {
            console.error('Error in handlePinMessage:', error);
            this.socket.emit('chat:error', { message: error.message });
        }
    }
    
    async handleUnpinMessage(data) {
        try {
            const { chatId, messageId } = data;
            
            await MessageService.unpinMessage(chatId, messageId, this.userId);
            
            const roomName = `chat:${chatId}`;
            this.io.to(roomName).emit('chat:message:unpinned', {
                chat_id: chatId,
                message_id: messageId,
                unpinned_by: this.userId,
                unpinned_at: new Date()
            });
            
        } catch (error) {
            console.error('Error in handleUnpinMessage:', error);
            this.socket.emit('chat:error', { message: error.message });
        }
    }
    
    // =====================================================
    // TRANSFERTS
    // =====================================================
    
    async handleTransferMessage(data) {
        try {
            const { messageId, targetChatId, targetType, note } = data;
            
            let result;
            
            if (targetType === 'chat') {
                result = await TransferService.transferToChat(messageId, this.userId, targetChatId, note);
            } else if (targetType === 'note') {
                result = await TransferService.transferToNote(messageId, this.userId, targetChatId, note);
            }
            
            // Notifier le destinataire si c'est un chat
            if (targetType === 'chat' && result.newMessage) {
                const targetRoomName = `chat:${targetChatId}`;
                this.io.to(targetRoomName).emit('chat:message:new', {
                    chat_id: targetChatId,
                    message: result.newMessage,
                    sender_id: this.userId,
                    is_forwarded: true,
                    timestamp: new Date()
                });
            }
            
            this.socket.emit('chat:transferred', {
                success: true,
                message_id: messageId,
                target_type: targetType,
                target_id: targetChatId,
                result: result
            });
            
        } catch (error) {
            console.error('Error in handleTransferMessage:', error);
            this.socket.emit('chat:error', { message: error.message });
        }
    }
    
    // =====================================================
    // MEMBRES
    // =====================================================
    
    async handleAddMember(data) {
        try {
            const { chatId, memberId } = data;
            
            await ChatService.addMember(chatId, this.userId, memberId);
            
            const roomName = `chat:${chatId}`;
            this.io.to(roomName).emit('chat:member:added', {
                chat_id: chatId,
                user_id: memberId,
                added_by: this.userId,
                timestamp: new Date()
            });
            
            // Inviter le nouveau membre à rejoindre la room
            SocketService.sendToUser(memberId, 'chat:invite', {
                chat_id: chatId,
                invited_by: this.userId,
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error('Error in handleAddMember:', error);
            this.socket.emit('chat:error', { message: error.message });
        }
    }
    
    async handleRemoveMember(data) {
        try {
            const { chatId, memberId } = data;
            
            await ChatService.removeMember(chatId, this.userId, memberId);
            
            const roomName = `chat:${chatId}`;
            this.io.to(roomName).emit('chat:member:removed', {
                chat_id: chatId,
                user_id: memberId,
                removed_by: this.userId,
                timestamp: new Date()
            });
            
            // Retirer le membre de la room
            SocketService.sendToUser(memberId, 'chat:removed', {
                chat_id: chatId,
                removed_by: this.userId,
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error('Error in handleRemoveMember:', error);
            this.socket.emit('chat:error', { message: error.message });
        }
    }
    
    async handleUpdateRole(data) {
        try {
            const { chatId, memberId, role } = data;
            
            await ChatService.updateMemberRole(chatId, this.userId, memberId, role);
            
            const roomName = `chat:${chatId}`;
            this.io.to(roomName).emit('chat:role:updated', {
                chat_id: chatId,
                user_id: memberId,
                role: role,
                updated_by: this.userId,
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error('Error in handleUpdateRole:', error);
            this.socket.emit('chat:error', { message: error.message });
        }
    }
    
    // =====================================================
    // UTILITAIRES
    // =====================================================
    
    async checkSlowMode(chatId, userId) {
        try {
            const chat = await ChatService.getChatById(chatId, userId);
            if (!chat || !chat.settings?.slow_mode_seconds) return true;
            
            const lastMessage = await MessageService.getLastUserMessage(chatId, userId);
            if (!lastMessage) return true;
            
            const secondsSince = (Date.now() - new Date(lastMessage.created_at)) / 1000;
            return secondsSince >= chat.settings.slow_mode_seconds;
            
        } catch (error) {
            return true;
        }
    }
    
    handleDisconnect() {
        // Quitter toutes les rooms
        for (const roomName of this.userRooms) {
            this.socket.leave(roomName);
            
            // Notifier les autres membres
            const chatId = roomName.replace('chat:', '');
            this.socket.to(roomName).emit('chat:user:offline', {
                user_id: this.userId,
                chat_id: chatId,
                timestamp: new Date()
            });
        }
        
        console.log(`User ${this.userId} disconnected from chat rooms`);
    }
}

module.exports = ChatHandler;