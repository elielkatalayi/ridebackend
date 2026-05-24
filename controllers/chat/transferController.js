const TransferService = require('../../services/chat/transferService');
const { ChatMessage } = require('../../models');

class TransferController {
    
    // =====================================================
    // TRANSFERT VERS CHAT
    // =====================================================
    
    async transferToChat(req, res) {
        try {
            const { messageId } = req.params;
            const userId = req.user.id;
            const { targetChatId, note } = req.body;
            
            if (!targetChatId) {
                return res.status(400).json({ 
                    state: false, 
                    message: 'targetChatId est requis', 
                    datas: null 
                });
            }
            
            const result = await TransferService.transferToChat(messageId, userId, targetChatId, note);
            
            res.status(200).json({
                state: true,
                message: 'Message transféré avec succès',
                datas: result
            });
            
        } catch (error) {
            console.error('Erreur transferToChat:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
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
                state: true,
                message: 'Message sauvegardé dans les notes',
                datas: result
            });
            
        } catch (error) {
            console.error('Erreur transferToNote:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
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
                return res.status(400).json({ 
                    state: false, 
                    message: 'targetChatId est requis', 
                    datas: null 
                });
            }
            
            const result = await TransferService.transferNoteToChat(noteId, userId, targetChatId);
            
            res.status(200).json({
                state: true,
                message: 'Note transférée vers le chat',
                datas: result
            });
            
        } catch (error) {
            console.error('Erreur transferNoteToChat:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
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
                return res.status(400).json({ 
                    state: false, 
                    message: 'messageIds est requis', 
                    datas: null 
                });
            }
            
            if (!targetType || !['private', 'group', 'note'].includes(targetType)) {
                return res.status(400).json({ 
                    state: false, 
                    message: 'targetType invalide', 
                    datas: null 
                });
            }
            
            if (!targetId && targetType !== 'note') {
                return res.status(400).json({ 
                    state: false, 
                    message: 'targetId est requis', 
                    datas: null 
                });
            }
            
            const results = await TransferService.transferMultipleMessages(messageIds, userId, targetType, targetId, note);
            
            const successCount = results.filter(r => r.success).length;
            const failCount = results.filter(r => !r.success).length;
            
            res.status(200).json({
                state: true,
                message: `${successCount} message(s) transféré(s), ${failCount} échec(s)`,
                datas: results
            });
            
        } catch (error) {
            console.error('Erreur transferMultiple:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
    
    // =====================================================
    // HISTORIQUE
    // =====================================================
    
    async getTransferHistory(req, res) {
        try {
            const userId = req.user.id;
            const limit = parseInt(req.query.limit) || 50;
            const offset = parseInt(req.query.offset) || 0;
            
            const result = await TransferService.getTransferHistory(userId, { limit, offset });
            
            const transfers = result.rows || result;
            const total = result.count || (Array.isArray(transfers) ? transfers.length : 0);
            
            const totalPages = Math.ceil(total / limit);
            const currentPage = Math.floor(offset / limit) + 1;
            
            res.status(200).json({
                state: true,
                message: 'Historique des transferts récupéré',
                datas: transfers,
                meta: {
                    total: total,
                    count: transfers.length,
                    per_page: limit,
                    current_page: currentPage,
                    total_pages: totalPages
                }
            });
            
        } catch (error) {
            console.error('Erreur getTransferHistory:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
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
                return res.status(404).json({ 
                    state: false, 
                    message: 'Message non trouvé', 
                    datas: null 
                });
            }
            
            const canTransfer = await TransferService.canTransfer(userId, message.chat_id);
            
            res.status(200).json({
                state: true,
                message: 'Vérification effectuée',
                datas: { can_transfer: canTransfer }
            });
            
        } catch (error) {
            console.error('Erreur canTransfer:', error);
            res.status(500).json({ 
                state: false, 
                message: error.message, 
                datas: null 
            });
        }
    }
}

module.exports = new TransferController();