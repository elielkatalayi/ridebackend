// services/payment/depositService.js

const { Payment } = require('../../models');
const walletService = require('./walletService');
const shawari = require('../../config/shawari');

class DepositService {
  
  async initiateDeposit(userId, amount, phoneNumber, operator = 'vodacom') {
    if (amount < 2900) {
      throw new Error(`Montant minimum: 2900 FC`);
    }
    
    const payment = await Payment.create({
      user_id: userId,
      amount,
      net_amount: amount,
      method: 'shawari',
      status: 'pending',
      metadata: { phone_number: phoneNumber, operator }
    });
    
    try {
      const result = await shawari.initiatePayment({
        amount,
        phoneNumber,
        reference: payment.id,
        callbackUrl: `${process.env.API_URL}/api/v1/webhooks/shawari/payment`
      });
      
      await payment.update({
        shawari_transaction_id: result.transactionId,
        status: result.status === 'completed' ? 'completed' : 'processing',
        shawari_response: result
      });
      
      if (result.status === 'completed') {
        await walletService.credit(userId, amount, 'deposit', 'deposit', payment.id, {
          description: `Dépôt de ${amount} FC via ${operator}`
        });
      }
      
      return { success: true, payment, transactionId: result.transactionId, status: result.status };
    } catch (error) {
      await payment.update({ status: 'failed' });
      throw error;
    }
  }

  async checkPaymentStatus(paymentId) {
    const payment = await Payment.findByPk(paymentId);
    if (!payment) throw new Error('Paiement non trouvé');
    if (!payment.shawari_transaction_id) throw new Error('Aucune transaction associée');
    
    const status = await shawari.checkPaymentStatus(payment.shawari_transaction_id);
    
    if (status.status === 'completed' && payment.status !== 'completed') {
      await payment.update({ status: 'completed', completed_at: new Date() });
      await walletService.credit(payment.user_id, payment.amount, 'deposit', 'deposit', payment.id, {
        description: `Dépôt confirmé`
      });
    } else if (status.status === 'failed' && payment.status !== 'failed') {
      await payment.update({ status: 'failed' });
    }
    
    return { payment, shawariStatus: status };
  }
}

module.exports = new DepositService();