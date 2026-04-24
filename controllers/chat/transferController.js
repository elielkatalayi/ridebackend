const TransferService = require('../../services/chat/transferService');
const { ChatMessage } = require('../../models');  // ✅ Ajoutez cette ligne
class TransferController {
    
    // =====================================================
    // TRANSFERT VERS CHAT
    // =====================================================
    
    async transferToChat(req, res) {
        try {
            // 📝 LOG 1: Début de la requête
            console.log('=' .repeat(60));
            console.log('📨 [TRANSFER] Nouvelle requête reçue');
            
            // 📝 LOG 2: Paramètres de la route
            console.log('📌 Paramètres URL (req.params):', JSON.stringify(req.params, null, 2));
            
            // 📝 LOG 3: Corps de la requête
            console.log('📦 Corps de la requête (req.body):', JSON.stringify(req.body, null, 2));
            
            // 📝 LOG 4: Utilisateur authentifié
            console.log('👤 Utilisateur connecté (req.user):', JSON.stringify({
                id: req.user?.id,
                email: req.user?.email,
                role: req.user?.role
            }, null, 2));
            
            const { messageId } = req.params;
            const userId = req.user.id;
            const { targetChatId, note } = req.body;
            
            // 📝 LOG 5: Variables extraites
            console.log('\n📊 Variables extraites:');
            console.log('   - messageId:', messageId);
            console.log('   - userId:', userId);
            console.log('   - targetChatId:', targetChatId);
            console.log('   - note:', note || '(pas de note)');
            
            // 📝 LOG 6: Validation
            if (!targetChatId) {
                console.log('❌ [TRANSFER] Erreur: targetChatId manquant');
                return res.status(400).json({ 
                    success: false, 
                    error: 'targetChatId est requis' 
                });
            }
            
            console.log('✅ [TRANSFER] Validation passée, appel du service...');
            
            // 📝 LOG 7: Appel du service
            const startTime = Date.now();
            const result = await TransferService.transferToChat(messageId, userId, targetChatId, note);
            const duration = Date.now() - startTime;
            
            console.log(`✅ [TRANSFER] Succès en ${duration}ms`);
            console.log('📤 Résultat:', JSON.stringify(result, null, 2));
            console.log('=' .repeat(60));
            
            res.status(200).json({
                success: true,
                message: 'Message transféré avec succès',
                data: result
            });
            
        } catch (error) {
            // 📝 LOG 8: Erreur détaillée
            console.error('\n❌ [TRANSFER] ERREUR DÉTAILLÉE:');
            console.error('   - Message:', error.message);
            console.error('   - Stack:', error.stack);
            console.error('   - Name:', error.name);
            
            if (error.parent) {
                console.error('   - SQL Error:', error.parent.message);
                console.error('   - SQL Code:', error.parent.code);
            }
            
            console.log('=' .repeat(60));
            
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }
    
    // =====================================================
    // TRANSFERT VERS NOTE
    // =====================================================
    
    async transferToNote(req, res) {
        try {
            const { messageId } = req.params;
            const userId = req.user.id;
            const { folderId, note } = req.body;
            
            const result = await TransferService.transferToNote(messageId, userId, folderId, note);
            
            res.status(200).json({
                success: true,
                message: 'Message sauvegardé dans les notes',
                data: result
            });
            
        } catch (error) {
            console.error('Erreur transferToNote:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // TRANSFERT DE NOTE VERS CHAT
    // =====================================================
    
    async transferNoteToChat(req, res) {
        try {
            const { noteId } = req.params;
            const userId = req.user.id;
            const { targetChatId } = req.body;
            
            if (!targetChatId) {
                return res.status(400).json({ success: false, error: 'targetChatId est requis' });
            }
            
            const result = await TransferService.transferNoteToChat(noteId, userId, targetChatId);
            
            res.status(200).json({
                success: true,
                message: 'Note transférée vers le chat',
                data: result
            });
            
        } catch (error) {
            console.error('Erreur transferNoteToChat:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // TRANSFERT MULTIPLE
    // =====================================================
    
    async transferMultiple(req, res) {
        try {
            const userId = req.user.id;
            const { messageIds, targetType, targetId, note } = req.body;
            
            if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
                return res.status(400).json({ success: false, error: 'messageIds est requis' });
            }
            
            if (!targetType || !['private', 'group', 'note'].includes(targetType)) {
                return res.status(400).json({ success: false, error: 'targetType invalide' });
            }
            
            if (!targetId && targetType !== 'note') {
                return res.status(400).json({ success: false, error: 'targetId est requis' });
            }
            
            const results = await TransferService.transferMultipleMessages(messageIds, userId, targetType, targetId, note);
            
            const successCount = results.filter(r => r.success).length;
            const failCount = results.filter(r => !r.success).length;
            
            res.status(200).json({
                success: true,
                message: `${successCount} message(s) transféré(s), ${failCount} échec(s)`,
                data: results
            });
            
        } catch (error) {
            console.error('Erreur transferMultiple:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // HISTORIQUE
    // =====================================================
    
    async getTransferHistory(req, res) {
        try {
            const userId = req.user.id;
            const { limit = 50, offset = 0 } = req.query;
            
            const transfers = await TransferService.getTransferHistory(userId, {
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
            
            res.status(200).json({
                success: true,
                data: transfers,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    has_more: transfers.length === parseInt(limit)
                }
            });
            
        } catch (error) {
            console.error('Erreur getTransferHistory:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // VÉRIFICATION
    // =====================================================
    
    async canTransfer(req, res) {
        try {
            const { messageId } = req.params;
            const userId = req.user.id;
            
            const message = await ChatMessage.findByPk(messageId);
            if (!message) {
                return res.status(404).json({ success: false, error: 'Message non trouvé' });
            }
            
            const canTransfer = await TransferService.canTransfer(userId, message.chat_id);
            
            res.status(200).json({
                success: true,
                data: { can_transfer: canTransfer }
            });
            
        } catch (error) {
            console.error('Erreur canTransfer:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new TransferController();