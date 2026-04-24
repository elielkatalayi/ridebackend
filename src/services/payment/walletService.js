// services/payment/walletService.js

const bcrypt = require('bcryptjs');
const { sequelize } = require('../../config/database');
const { Wallet, WalletTransaction, User, Ride, CommissionHistory } = require('../../models')
const commissionService = require('./commissionService');

class WalletService {
  
  async getUserWallet(userId) {
    let wallet = await Wallet.findOne({ 
      where: { user_id: userId },
      attributes: { exclude: ['driver_id'] }
    });
    if (!wallet) {
      wallet = await Wallet.create({ user_id: userId, balance: 0 });
    }
    return wallet;
  }

  async getUserByPhone(phone) {
    const user = await User.findOne({ where: { phone, is_active: true, is_blocked: false } });
    if (!user) throw new Error('Utilisateur non trouvé');
    return user;
  }

  async setWalletPin(userId, pin) {
    const wallet = await this.getUserWallet(userId);
    if (!pin || pin.length !== 6 || !/^\d+$/.test(pin)) {
      throw new Error('PIN doit être 6 chiffres');
    }
    const pinHash = await bcrypt.hash(pin, 10);
    await wallet.update({ pin_hash: pinHash, pin_attempts: 0, pin_locked_until: null });
    return { success: true };
  }

  async verifyWalletPin(userId, pin) {
    const wallet = await this.getUserWallet(userId);
    if (!wallet.pin_hash) throw new Error('PIN non défini');
    
    if (wallet.pin_locked_until && wallet.pin_locked_until > new Date()) {
      const minutesLeft = Math.ceil((wallet.pin_locked_until - new Date()) / 60000);
      throw new Error(`Wallet bloqué pour ${minutesLeft} minutes`);
    }
    
    const isValid = await bcrypt.compare(pin, wallet.pin_hash);
    if (!isValid) {
      const newAttempts = (wallet.pin_attempts || 0) + 1;
      if (newAttempts >= 5) {
        const lockUntil = new Date(Date.now() + 30 * 60 * 1000);
        await wallet.update({ pin_attempts: newAttempts, pin_locked_until: lockUntil });
        throw new Error('Trop de tentatives. Wallet bloqué 30 minutes.');
      }
      await wallet.update({ pin_attempts: newAttempts });
      throw new Error('PIN incorrect');
    }
    await wallet.update({ pin_attempts: 0, pin_locked_until: null });
    return true;
  }

  async checkDailyLimit(userId, amount) {
    const wallet = await this.getUserWallet(userId);
    if (!wallet.daily_transfer_limit || wallet.daily_transfer_limit === 0) {
      return true;
    }
    
    const today = new Date().toDateString();
    const lastReset = new Date(wallet.last_transfer_reset).toDateString();
    
    if (lastReset !== today) {
      await wallet.update({ daily_transfer_amount: 0, last_transfer_reset: new Date() });
      wallet.daily_transfer_amount = 0;
    }
    
    const newTotal = (wallet.daily_transfer_amount || 0) + amount;
    if (newTotal > wallet.daily_transfer_limit) {
      throw new Error(`Limite quotidienne dépassée (${wallet.daily_transfer_limit.toLocaleString()} FC/jour)`);
    }
    return true;
  }

  async credit(userId, amount, type, referenceType, referenceId, metadata = {}) {
    const transaction = await sequelize.transaction();
    try {
      const wallet = await this.getUserWallet(userId);
      const oldBalance = wallet.balance;
      const newBalance = oldBalance + amount;
      
      await wallet.update({ balance: newBalance }, { transaction });
      
      const walletTransaction = await WalletTransaction.create({
        wallet_id: wallet.id,
        type,
        status: 'completed',
        amount,
        fee: 0,
        net_amount: amount,
        balance_after: newBalance,
        reference_type: referenceType,
        reference_id: referenceId,
        description: metadata.description,
        completed_at: new Date()
      }, { transaction });
      
      await transaction.commit();
      return { success: true, transaction: walletTransaction, oldBalance, newBalance };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async debit(userId, amount, type, referenceType, referenceId, metadata = {}) {
    const transaction = await sequelize.transaction();
    try {
      const wallet = await this.getUserWallet(userId);
      if (wallet.balance < amount) throw new Error('Solde insuffisant');
      
      const oldBalance = wallet.balance;
      const newBalance = oldBalance - amount;
      
      await wallet.update({ balance: newBalance }, { transaction });
      
      if (type === 'transfer_sent') {
        await wallet.update({ daily_transfer_amount: (wallet.daily_transfer_amount || 0) + amount }, { transaction });
      }
      
      const walletTransaction = await WalletTransaction.create({
        wallet_id: wallet.id,
        type,
        status: 'completed',
        amount: -amount,
        fee: metadata.fee || 0,
        net_amount: -(amount - (metadata.fee || 0)),
        balance_after: newBalance,
        reference_type: referenceType,
        reference_id: referenceId,
        to_user_id: metadata.toUserId,
        from_user_id: metadata.fromUserId,
        description: metadata.description,
        completed_at: new Date()
      }, { transaction });
      
      await transaction.commit();
      return { success: true, transaction: walletTransaction, oldBalance, newBalance };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async transferByPhone(fromUserId, toPhone, amount, pin, description = '') {
    await this.verifyWalletPin(fromUserId, pin);
    
    const toUser = await this.getUserByPhone(toPhone);
    if (toUser.id === fromUserId) throw new Error('Transfert à soi-même impossible');
    
    await this.checkDailyLimit(fromUserId, amount);
    
    const fromWallet = await this.getUserWallet(fromUserId);
    if (fromWallet.balance < amount) throw new Error('Solde insuffisant');
    
    const transaction = await sequelize.transaction();
    try {
      await this.debit(fromUserId, amount, 'transfer_sent', 'transfer', null, {
        toUserId: toUser.id,
        description: description || `Transfert à ${toUser.phone}`
      });
      
      await this.credit(toUser.id, amount, 'transfer_received', 'transfer', null, {
        description: description || `Transfert de ${fromUserId.substring(0, 8)}`
      });
      
      await transaction.commit();
      return { success: true, to_user: toUser.id, to_phone: toPhone, amount };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Payer une course (transfert automatique avec commission)
   */
  async payRide(passengerId, rideId, amount, pin) {
    // Récupérer la course avec les infos nécessaires
    const ride = await Ride.findByPk(rideId, { 
      include: [
        { association: 'driver', include: ['user'] },
        { association: 'category' }
      ]
    });
    
    if (!ride) throw new Error('Course non trouvée');
    if (ride.status !== 'completed') throw new Error('Course non terminée');
    
    const driverId = ride.driver.user_id;
    const categoryId = ride.category_id;
    
    // Vérifier le PIN du passager
    await this.verifyWalletPin(passengerId, pin);
    
    // Vérifier le solde du passager
    const passengerWallet = await this.getUserWallet(passengerId);
    if (passengerWallet.balance < amount) throw new Error('Solde insuffisant');
    
    const transaction = await sequelize.transaction();
    
    try {
      // 1. Débiter le passager (montant total)
      const passengerWalletFresh = await Wallet.findOne({
        where: { user_id: passengerId },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      
      if (passengerWalletFresh.balance < amount) {
        throw new Error('Solde insuffisant');
      }
      
      const passengerOldBalance = passengerWalletFresh.balance;
      const passengerNewBalance = passengerOldBalance - amount;
      
      await passengerWalletFresh.update({ balance: passengerNewBalance }, { transaction });
      
      await WalletTransaction.create({
        wallet_id: passengerWalletFresh.id,
        type: 'transfer_sent',
        status: 'completed',
        amount: -amount,
        fee: 0,
        net_amount: -amount,
        balance_after: passengerNewBalance,
        reference_type: 'ride',
        reference_id: rideId,
        to_user_id: driverId,
        description: `Paiement course #${rideId.substring(0, 8)}`,
        completed_at: new Date()
      }, { transaction });
      
      // 2. Créditer le chauffeur (montant total)
      const driverWallet = await Wallet.findOne({
        where: { user_id: driverId },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      
      const driverOldBalance = driverWallet.balance;
      const driverNewBalance = driverOldBalance + amount;
      
      await driverWallet.update({ balance: driverNewBalance }, { transaction });
      
      await WalletTransaction.create({
        wallet_id: driverWallet.id,
        type: 'transfer_received',
        status: 'completed',
        amount: amount,
        fee: 0,
        net_amount: amount,
        balance_after: driverNewBalance,
        reference_type: 'ride',
        reference_id: rideId,
        from_user_id: passengerId,
        description: `Gain course #${rideId.substring(0, 8)} (avant commission)`,
        completed_at: new Date()
      }, { transaction });
      
      // 3. Calculer la commission
      const commission = await commissionService.calculateCommission(amount, categoryId);
      
      // 4. Débiter le chauffeur de la commission
      const commissionWalletFresh = await Wallet.findOne({
        where: { user_id: driverId },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      
      if (commissionWalletFresh.balance < commission.commissionAmount) {
        throw new Error(`Solde insuffisant pour payer la commission de ${commission.commissionAmount} FC`);
      }
      
      const commissionOldBalance = commissionWalletFresh.balance;
      const commissionNewBalance = commissionOldBalance - commission.commissionAmount;
      
      await commissionWalletFresh.update({ balance: commissionNewBalance }, { transaction });
      
      await WalletTransaction.create({
        wallet_id: commissionWalletFresh.id,
        type: 'commission_debit',
        status: 'completed',
        amount: -commission.commissionAmount,
        fee: 0,
        net_amount: -commission.commissionAmount,
        balance_after: commissionNewBalance,
        reference_type: 'ride',
        reference_id: rideId,
        description: `Commission course #${rideId.substring(0, 8)} (${commission.percentage}%)`,
        completed_at: new Date()
      }, { transaction });
      
      // 5. Créditer la société (commission)
      const COMPANY_USER_ID = 'fe3c9a86-586f-45bc-96be-fac621e1c32e';
      let companyWallet = await Wallet.findOne({
        where: { user_id: COMPANY_USER_ID },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      
      const companyOldBalance = companyWallet?.balance || 0;
      const companyNewBalance = companyOldBalance + commission.commissionAmount;
      
      if (companyWallet) {
        await companyWallet.update({ balance: companyNewBalance }, { transaction });
      } else {
        companyWallet = await Wallet.create({
          user_id: COMPANY_USER_ID,
          balance: commission.commissionAmount
        }, { transaction });
      }
      
      await WalletTransaction.create({
        wallet_id: companyWallet.id,
        type: 'commission_earning',
        status: 'completed',
        amount: commission.commissionAmount,
        fee: 0,
        net_amount: commission.commissionAmount,
        balance_after: companyNewBalance,
        reference_type: 'ride',
        reference_id: rideId,
        description: `Commission course #${rideId.substring(0, 8)}`,
        completed_at: new Date()
      }, { transaction });
      
      // 6. Enregistrer dans l'historique des commissions
      const { CommissionHistory } = require('../../models');
      await CommissionHistory.create({
        ride_id: rideId,
        driver_id: driverId,
        total_amount: amount,
        commission_percentage: commission.percentage,
        commission_amount: commission.commissionAmount,
        driver_net: commission.driverAmount,
        status: 'completed'
      }, { transaction });
      
      await transaction.commit();
      
      // 7. Vérifier si le chauffeur est en négatif
      const finalWallet = await this.getUserWallet(driverId);
      if (finalWallet.balance < 0) {
        const { Driver } = require('../../models');
        await Driver.update(
          { is_blocked_for_negative_balance: true, is_online: false },
          { where: { user_id: driverId } }
        );
      }
      
      return {
        success: true,
        ride_id: rideId,
        total_amount: amount,
        commission: commission.commissionAmount,
        driver_final_amount: commission.driverAmount,
        commission_percentage: commission.percentage,
        driver_balance_after: finalWallet.balance,
        message: `Course payée. Commission de ${commission.commissionAmount} FC déduite du wallet chauffeur.`
      };
      
    } catch (error) {
      if (transaction.finished !== 'commit') {
        await transaction.rollback();
      }
      throw error;
    }
  }

  async getBalance(userId) {
    const wallet = await this.getUserWallet(userId);
    return { balance: wallet.balance, currency: 'FC', wallet_id: wallet.id };
  }

  async getTransactionHistory(userId, { limit = 50, offset = 0 }) {
    const wallet = await this.getUserWallet(userId);
    const transactions = await WalletTransaction.findAndCountAll({
      where: { wallet_id: wallet.id },
      order: [['created_at', 'DESC']],
      limit,
      offset
    });
    return { transactions: transactions.rows, total: transactions.count, limit, offset };
  }
}

module.exports = new WalletService();