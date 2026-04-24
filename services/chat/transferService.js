const { sequelize } = require('../../config/database');
const { ChatMessage, ChatNote, ChatParticipant, Chat, User } = require('../../models');
const ChatService = require('./chatService');
const MessageService = require('./messageService');
const NotificationService = require('../notification/NotificationService');
const { v4: uuidv4 } = require('uuid');

class TransferService {
    
    // =====================================================
    // TRANSFERT VERS CHAT
    // =====================================================
    
    async transferToChat(originalMessageId, userId, targetChatId, note = null) {
        console.log('\n' + '='.repeat(80));
        console.log('🟢 [TRANSFER SERVICE] Début de transferToChat');
        console.log('📝 Paramètres reçus:', {
            originalMessageId,
            userId,
            targetChatId,
            note: note || '(pas de note)'
        });
        
        const transaction = await sequelize.transaction();
        console.log('🔓 Transaction démarrée');
        
        try {
            // =====================================================
            // ÉTAPE 1: Récupérer le message original
            // =====================================================
            console.log('\n📥 [1/5] Recherche du message original...');
            console.log(`   - ID du message: ${originalMessageId}`);
            
            const originalMessage = await ChatMessage.findByPk(originalMessageId);
            
            if (!originalMessage) {
                console.log('❌ Message original non trouvé!');
                throw new Error('Message original non trouvé');
            }
            
            console.log('✅ Message original trouvé:');
            console.log(`   - ID: ${originalMessage.id}`);
            console.log(`   - Chat ID: ${originalMessage.chat_id}`);
            console.log(`   - Sender ID: ${originalMessage.sender_id}`);
            console.log(`   - Type: ${originalMessage.message_type}`);
            console.log(`   - Content: ${originalMessage.content?.substring(0, 50)}...`);
            
            // =====================================================
            // ÉTAPE 2: Vérifier les droits de transfert
            // =====================================================
            console.log('\n🔐 [2/5] Vérification des droits de transfert...');
            console.log(`   - User ID: ${userId}`);
            console.log(`   - Chat ID: ${originalMessage.chat_id}`);
            
            const canTransfer = await this.canTransfer(userId, originalMessage.chat_id);
            console.log(`   - Peut transférer: ${canTransfer}`);
            
            if (!canTransfer) {
                console.log('❌ Non autorisé à transférer ce message!');
                throw new Error('Non autorisé à transférer ce message');
            }
            
            // =====================================================
            // ÉTAPE 3: Créer le nouveau message
            // =====================================================
            console.log('\n📤 [3/5] Création du nouveau message...');
            console.log(`   - Chat cible: ${targetChatId}`);
            console.log(`   - Contenu: ${originalMessage.content?.substring(0, 50)}...`);
            
            const messageData = {
                content: originalMessage.content,
                message_type: originalMessage.message_type,
                media_url: originalMessage.media_url,
                media_type: originalMessage.media_type,
                thumbnail_url: originalMessage.thumbnail_url,
                file_name: originalMessage.file_name,
                is_forwarded: true,
                forward_note: note
            };
            
            console.log('📦 Message data:', JSON.stringify(messageData, null, 2));
            
            const newMessage = await MessageService.sendMessage(
                targetChatId,
                userId,
                messageData,
                null,
                transaction
            );
            
            console.log('✅ Nouveau message créé:');
            console.log(`   - ID: ${newMessage.id}`);
            console.log(`   - Chat ID: ${newMessage.chat_id}`);
            console.log(`   - Status: ${newMessage.status}`);
            
            // =====================================================
            // ÉTAPE 4: Enregistrer le transfert (avec SQL BRUTE)
            // =====================================================
            console.log('\n💾 [4/5] Enregistrement du transfert (SQL brute)...');
            
            const transferId = uuidv4();
            const transferredAt = new Date();
            
            const transferData = {
                id: transferId,
                original_message_id: originalMessageId,
                original_chat_id: originalMessage.chat_id,
                original_sender_id: originalMessage.sender_id,
                target_type: 'private',
                target_id: targetChatId,
                new_message_id: newMessage.id,
                new_note_id: null,
                transferred_by: userId,
                transferred_at: transferredAt,
                note: note
            };
            
            console.log('📊 Transfer data:', JSON.stringify(transferData, null, 2));
            
            // ✅ REQUÊTE SQL BRUTE - Évite le problème de RETURNING
            const sqlQuery = `
                INSERT INTO chat_transfers (
                    id,
                    original_message_id,
                    original_chat_id,
                    original_sender_id,
                    target_type,
                    target_id,
                    new_message_id,
                    new_note_id,
                    transferred_by,
                    transferred_at,
                    note
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
                )
                RETURNING id, original_message_id, original_chat_id, original_sender_id,
                          target_type, target_id, new_message_id, new_note_id,
                          transferred_by, transferred_at, note
            `;
            
            const sqlValues = [
                transferData.id,
                transferData.original_message_id,
                transferData.original_chat_id,
                transferData.original_sender_id,
                transferData.target_type,
                transferData.target_id,
                transferData.new_message_id,
                transferData.new_note_id,
                transferData.transferred_by,
                transferData.transferred_at,
                transferData.note
            ];
            
            const result = await sequelize.query(sqlQuery, {
                bind: sqlValues,
                type: sequelize.QueryTypes.INSERT,
                transaction
            });
            
            // Récupérer le transfert créé
            const transfer = result[0][0];
            
            console.log('✅ Transfert enregistré:');
            console.log(`   - Transfer ID: ${transfer.id}`);
            console.log(`   - Target type: ${transfer.target_type}`);
            
            // =====================================================
            // ÉTAPE 5: Notifier le destinataire
            // =====================================================
            console.log('\n🔔 [5/5] Notification du destinataire...');
            
            try {
                const targetChat = await ChatService.getChatById(targetChatId, userId);
                console.log(`   - Chat cible trouvé: ${!!targetChat}`);
                
                if (targetChat) {
                    const recipientId = targetChat.user2_id === userId ? targetChat.user1_id : targetChat.user2_id;
                    console.log(`   - Destinataire ID: ${recipientId}`);
                    
                    await NotificationService.sendSystemNotification(
                        recipientId,
                        'Message transféré',
                        `${userId} vous a transféré un message`,
                        { chat_id: targetChatId, message_id: newMessage.id }
                    );
                    console.log('✅ Notification envoyée');
                } else {
                    console.log('⚠️ Chat cible non trouvé, notification ignorée');
                }
            } catch (notifError) {
                console.error('⚠️ Erreur lors de la notification:', notifError.message);
                // On continue même si la notification échoue
            }
            
            // =====================================================
            // COMMIT DE LA TRANSACTION
            // =====================================================
            await transaction.commit();
            console.log('\n✅ COMMIT effectué avec succès');
            console.log('='.repeat(80));
            
            return { transfer, newMessage };
            
        } catch (error) {
            // =====================================================
            // ROLLBACK EN CAS D'ERREUR
            // =====================================================
            console.log('\n🔴 [TRANSFER SERVICE] ERREUR DÉTECTÉE!');
            console.log('   - Message:', error.message);
            console.log('   - Stack:', error.stack);
            
            if (error.parent) {
                console.log('   - SQL Error:', error.parent.message);
                console.log('   - SQL Code:', error.parent.code);
            }
            
            console.log('🔄 Rollback de la transaction...');
            await transaction.rollback();
            console.log('✅ Rollback effectué');
            console.log('='.repeat(80));
            
            throw error;
        }
    }
    
    // =====================================================
    // TRANSFERT VERS NOTE
    // =====================================================
    
    async transferToNote(originalMessageId, userId, folderId = null, note = null) {
        const transaction = await sequelize.transaction();
        
        try {
            const originalMessage = await ChatMessage.findByPk(originalMessageId);
            if (!originalMessage) throw new Error('Message original non trouvé');
            
            const canTransfer = await this.canTransfer(userId, originalMessage.chat_id);
            if (!canTransfer) throw new Error('Non autorisé');
            
            // Créer la note
            const newNote = await ChatNote.create({
                user_id: userId,
                folder_id: folderId,
                title: `Message de ${originalMessage.sender_id}`,
                content: originalMessage.content,
                source_type: 'private',
                source_id: originalMessage.chat_id,
                original_message_id: originalMessageId,
                media: originalMessage.media_url ? [{
                    type: originalMessage.message_type,
                    url: originalMessage.media_url,
                    thumbnail: originalMessage.thumbnail_url,
                    name: originalMessage.file_name
                }] : []
            }, { transaction });
            
            // Enregistrer le transfert avec SQL brute
            const transferId = uuidv4();
            
            const sqlQuery = `
                INSERT INTO chat_transfers (
                    id, original_message_id, original_chat_id, original_sender_id,
                    target_type, target_id, new_note_id, transferred_by, transferred_at, note
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
                )
                RETURNING *
            `;
            
            const result = await sequelize.query(sqlQuery, {
                bind: [
                    transferId,
                    originalMessageId,
                    originalMessage.chat_id,
                    originalMessage.sender_id,
                    'note',
                    newNote.id,
                    newNote.id,
                    userId,
                    new Date(),
                    note
                ],
                type: sequelize.QueryTypes.INSERT,
                transaction
            });
            
            const transfer = result[0][0];
            
            await transaction.commit();
            return { transfer, newNote };
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
    // =====================================================
    // AUTRES MÉTHODES
    // =====================================================
    
    async canTransfer(userId, chatId) {
        const participant = await ChatParticipant.findOne({
            where: { chat_id: chatId, user_id: userId, left_at: null }
        });
        return !!participant;
    }
    
    async canTransferMessage(messageId, userId) {
        const message = await ChatMessage.findByPk(messageId);
        if (!message) {
            throw new Error('Message non trouvé');
        }
        const canTransfer = await this.canTransfer(userId, message.chat_id);
        return {
            can_transfer: canTransfer,
            message_id: messageId,
            chat_id: message.chat_id,
            message_type: message.message_type
        };
    }
    
    async getTransferHistory(userId, options = {}) {
        const { limit = 50, offset = 0 } = options;
        
        const transfers = await sequelize.query(`
            SELECT * FROM chat_transfers 
            WHERE transferred_by = $1 
            ORDER BY transferred_at DESC 
            LIMIT $2 OFFSET $3
        `, {
            bind: [userId, limit, offset],
            type: sequelize.QueryTypes.SELECT
        });
        
        return transfers;
    }
}

module.exports = new TransferService();