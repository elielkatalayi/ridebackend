const shawari = require('../../config/shawari');
const { Payment } = require('../../models');
const walletService = require('./walletService');
const NotificationService = require('../notification/NotificationService');

class ShawariPaymentService {
  /**
   * Initier un dépôt via Shwary (correction du nom de méthode)
   */
  async initiateDeposit(params) {
    const {
      userId,
      amount,
      phoneNumber,
      reference
    } = params;
    
    // Vérifier le montant minimum pour la RDC
    if (amount < 2900) {
      throw new Error(`Le montant minimum pour un dépôt est de 2900 FC (actuel: ${amount})`);
    }
    
    // Créer l'enregistrement du paiement
    const payment = await Payment.create({
      user_id: userId,
      amount,
      net_amount: amount,
      method: 'shawari',
      status: 'pending',
      metadata: {
        phone_number: phoneNumber,
        reference
      }
    });
    
    try {
      // Appeler la méthode correcte de shawari config
      const result = await shawari.initiatePayment({
        amount,
        phoneNumber,
        reference: payment.id,
        callbackUrl: `${process.env.API_URL}/api/v1/webhooks/shawari/payment`
      });
      
      // Mettre à jour le paiement
      await payment.update({
        shawari_transaction_id: result.transactionId,
        status: result.status === 'completed' ? 'completed' : 'processing',
        shawari_response: result
      });
      
      // Si la transaction est déjà complétée (sandbox), créditer le wallet
      if (result.status === 'completed') {
        await walletService.credit(
          userId,
          amount,
          'deposit',
          'payment',
          payment.id
        );
        
        // Notification de dépôt réussi
        await NotificationService.sendWalletNotification(
          userId,
          payment.id,
          'deposit',
          amount
        );
      } else {
        // Notification de tentative de dépôt
        await NotificationService.sendWalletNotification(
          userId,
          payment.id,
          'deposit',
          amount
        );
      }
      
      return {
        success: true,
        payment,
        transactionId: result.transactionId,
        status: result.status
      };
    } catch (error) {
      await payment.update({ status: 'failed' });
      
      // Notification d'échec de dépôt
      await NotificationService.sendWalletNotification(
        userId,
        payment.id,
        'payment_failed',
        amount
      );
      
      throw error;
    }
  }

  /**
   * Vérifier le statut d'un paiement
   */
  async checkPaymentStatus(paymentId) {
    const payment = await Payment.findByPk(paymentId);
    if (!payment) {
      throw new Error('Paiement non trouvé');
    }
    
    if (!payment.shawari_transaction_id) {
      throw new Error('Aucune transaction Shwary associée');
    }
    
    const status = await shawari.checkPaymentStatus(payment.shawari_transaction_id);
    
    // Mettre à jour le statut local
    if (status.status === 'completed' && payment.status !== 'completed') {
      await payment.update({
        status: 'completed',
        completed_at: new Date()
      });
      
      // Créditer le wallet
      await walletService.credit(
        payment.user_id,
        payment.amount,
        'deposit',
        'payment',
        payment.id
      );
      
      // Notification de dépôt réussi
      await NotificationService.sendWalletNotification(
        payment.user_id,
        payment.id,
        'deposit',
        payment.amount
      );
      
    } else if (status.status === 'failed' && payment.status !== 'failed') {
      await payment.update({ status: 'failed' });
      
      // Notification d'échec
      await NotificationService.sendWalletNotification(
        payment.user_id,
        payment.id,
        'payment_failed',
        payment.amount
      );
    }
    
    return {
      payment,
      shawariStatus: status
    };
  }

  /**
   * Traiter le webhook Shwary
   */
  async handleWebhook(payload) {
    console.log('📨 Webhook Shwary reçu:', payload);
    
    const { id, status, amount, failureReason, completedAt } = payload;
    
    const payment = await Payment.findOne({
      where: { shawari_transaction_id: id }
    });
    
    if (!payment) {
      console.log(`⚠️ Paiement non trouvé pour transaction: ${id}`);
      return { success: false, error: 'Payment not found' };
    }
    
    if (status === 'completed' && payment.status !== 'completed') {
      await payment.update({
        status: 'completed',
        completed_at: completedAt ? new Date(completedAt) : new Date(),
        shawari_response: { ...payment.shawari_response, webhook: payload }
      });
      
      // Créditer le wallet
      await walletService.credit(
        payment.user_id,
        payment.amount,
        'deposit',
        'payment',
        payment.id
      );
      
      // Notification de dépôt réussi
      await NotificationService.sendWalletNotification(
        payment.user_id,
        payment.id,
        'deposit',
        payment.amount
      );
      
      console.log(`✅ Paiement ${id} complété, wallet crédité`);
      
    } else if (status === 'failed') {
      await payment.update({
        status: 'failed',
        metadata: {
          ...payment.metadata,
          failureReason
        }
      });
      
      // Notification d'échec
      await NotificationService.sendWalletNotification(
        payment.user_id,
        payment.id,
        'payment_failed',
        payment.amount
      );
      
      console.log(`❌ Paiement ${id} échoué: ${failureReason}`);
      
    } else if (status === 'cancelled') {
      await payment.update({
        status: 'cancelled',
        metadata: {
          ...payment.metadata,
          failureReason
        }
      });
      
      console.log(`🚫 Paiement ${id} annulé: ${failureReason}`);
    }
    
    return { success: true, payment };
  }
}

module.exports = new ShawariPaymentService();