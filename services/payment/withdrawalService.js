// services/payment/withdrawalService.js

const { sequelize } = require('../../config/database');
const { WalletTransaction } = require('../../models');
const walletService = require('./walletService');

class WithdrawalService {
  
  async withdraw(userId, amount, method, destination, pin) {
    await walletService.verifyWalletPin(userId, pin);
    
    const wallet = await walletService.getUserWallet(userId);
    if (wallet.balance < amount) throw new Error('Solde insuffisant');
    
    const fee = Math.floor(amount * 0.05);
    const netAmount = amount - fee;
    
    if (amount < 1000) throw new Error('Montant minimum: 1000 FC');
    if (amount > 500000) throw new Error('Montant maximum: 500000 FC');
    
    const transaction = await sequelize.transaction();
    try {
      const debitResult = await walletService.debit(userId, amount, 'withdrawal', 'withdrawal', null, {
        fee,
        description: `Retrait de ${amount} FC vers ${destination}`
      });
      
      const withdrawalRecord = await WalletTransaction.create({
        wallet_id: wallet.id,
        type: 'withdrawal',
        status: 'completed',
        amount: -amount,
        fee,
        net_amount: -netAmount,
        balance_after: debitResult.newBalance,
        payment_method: method,
        external_reference: destination,
        description: `Retrait vers ${destination}`,
        completed_at: new Date()
      }, { transaction });
      
      await transaction.commit();
      
      return {
        success: true,
        amount,
        fee,
        netAmount,
        newBalance: debitResult.newBalance
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = new WithdrawalService();