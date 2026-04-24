const { WalletTransaction, Payment, Ride, User, Driver } = require('../../models');
const { sequelize } = require('../../config/database');

class TransactionService {
  /**
   * Enregistrer une transaction de dépôt
   * @param {string} userId - ID de l'utilisateur
   * @param {number} amount - Montant déposé
   * @param {string} method - Méthode de paiement
   * @param {string} externalRef - Référence externe
   * @returns {Promise<Object>}
   */
  async recordDeposit(userId, amount, method, externalRef = null) {
    const walletService = require('./walletService');
    const wallet = await walletService.getUserWallet(userId);
    
    const result = await walletService.credit(
      wallet.id,
      amount,
      'deposit',
      'deposit',
      externalRef
    );
    
    // Enregistrer le paiement
    const payment = await Payment.create({
      user_id: userId,
      amount,
      net_amount: amount,
      method,
      status: 'completed',
      external_reference: externalRef,
      completed_at: new Date()
    });
    
    return {
      transaction: result.transaction,
      payment,
      newBalance: result.newBalance
    };
  }

  /**
   * Enregistrer un paiement de course
   * @param {string} rideId - ID de la course
   * @param {string} passengerId - ID du passager
   * @param {string} driverId - ID du chauffeur
   * @param {number} amount - Montant
   * @param {Object} security - Infos de sécurité
   * @returns {Promise<Object>}
   */
  async recordRidePayment(rideId, passengerId, driverId, amount, security = {}) {
    const transaction = await sequelize.transaction();
    
    try {
      const walletService = require('./walletService');
      
      // Récupérer les wallets
      const passengerWallet = await walletService.getUserWallet(passengerId);
      const driverWallet = await walletService.getDriverWallet(driverId);
      
      // Commission Uplus (10% par défaut)
      const commission = Math.floor(amount * 0.1);
      const driverAmount = amount - commission;
      
      // Débiter le passager
      const debit = await walletService.debit(
        passengerWallet.id,
        amount,
        'payment',
        'ride',
        rideId,
        security,
        transaction
      );
      
      // Créditer le chauffeur
      const credit = await walletService.credit(
        driverWallet.id,
        driverAmount,
        'earning',
        'ride',
        rideId,
        transaction
      );
      
      // Enregistrer le paiement
      const payment = await Payment.create({
        ride_id: rideId,
        user_id: passengerId,
        driver_id: driverId,
        amount,
        fee: commission,
        net_amount: driverAmount,
        method: 'wallet',
        status: 'completed',
        completed_at: new Date(),
        metadata: {
          security: {
            pin_verified: !!security.pinVerifiedAt,
            driver_id_verified: security.driverUniqueId
          }
        }
      }, { transaction });
      
      await transaction.commit();
      
      return {
        success: true,
        payment,
        passengerDebit: debit,
        driverCredit: credit,
        commission
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Enregistrer un retrait (chauffeur)
   * @param {string} driverId - ID du chauffeur
   * @param {number} amount - Montant à retirer
   * @param {string} method - Méthode de retrait
   * @param {string} destination - Destination du retrait
   * @returns {Promise<Object>}
   */
  async recordWithdrawal(driverId, amount, method, destination) {
    const walletService = require('./walletService');
    const wallet = await walletService.getDriverWallet(driverId);
    
    const fee = Math.floor(amount * 0.05); // 5% de frais
    const netAmount = amount - fee;
    
    const result = await walletService.debit(
      wallet.id,
      amount,
      'withdrawal',
      'withdrawal',
      null
    );
    
    // Enregistrer la transaction de retrait
    const withdrawalRecord = await WalletTransaction.create({
      wallet_id: wallet.id,
      type: 'withdrawal',
      status: 'completed',
      amount: -amount,
      fee,
      net_amount: -netAmount,
      balance_after: result.newBalance,
      payment_method: method,
      external_reference: destination,
      metadata: {
        destination,
        method,
        netAmount
      },
      completed_at: new Date()
    });
    
    return {
      success: true,
      transaction: withdrawalRecord,
      amount,
      fee,
      netAmount,
      newBalance: result.newBalance
    };
  }

  /**
   * Obtenir l'historique des transactions d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {Object} options - Pagination
   * @returns {Promise<Object>}
   */
  async getUserTransactionHistory(userId, { limit = 50, offset = 0 }) {
    const walletService = require('./walletService');
    const wallet = await walletService.getUserWallet(userId);
    
    const transactions = await WalletTransaction.findAndCountAll({
      where: { wallet_id: wallet.id },
      include: [
        {
          model: Ride,
          as: 'ride',
          required: false
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });
    
    return transactions;
  }

  /**
   * Obtenir l'historique des transactions d'un chauffeur
   * @param {string} driverId - ID du chauffeur
   * @param {Object} options - Pagination
   * @returns {Promise<Object>}
   */
  async getDriverTransactionHistory(driverId, { limit = 50, offset = 0 }) {
    const walletService = require('./walletService');
    const wallet = await walletService.getDriverWallet(driverId);
    
    const transactions = await WalletTransaction.findAndCountAll({
      where: { wallet_id: wallet.id },
      order: [['created_at', 'DESC']],
      limit,
      offset
    });
    
    return transactions;
  }

  /**
   * Obtenir les statistiques des transactions
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Object>}
   */
  async getUserTransactionStats(userId) {
    const walletService = require('./walletService');
    const wallet = await walletService.getUserWallet(userId);
    
    const totalSpent = await WalletTransaction.sum('amount', {
      where: {
        wallet_id: wallet.id,
        type: 'payment',
        status: 'completed',
        amount: { [Op.lt]: 0 }
      }
    });
    
    const totalDeposits = await WalletTransaction.sum('amount', {
      where: {
        wallet_id: wallet.id,
        type: 'deposit',
        status: 'completed',
        amount: { [Op.gt]: 0 }
      }
    });
    
    return {
      balance: wallet.balance,
      totalDeposits: Math.abs(totalDeposits || 0),
      totalSpent: Math.abs(totalSpent || 0),
      transactionCount: await WalletTransaction.count({
        where: { wallet_id: wallet.id, status: 'completed' }
      })
    };
  }
}

module.exports = new TransactionService();