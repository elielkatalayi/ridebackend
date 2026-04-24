// services/payment/commissionService.js

const { Category, CategoryCommissionSetting, Wallet, Driver } = require('../../models');
const walletService = require('./walletService');

class CommissionService {
  
  get COMPANY_USER_ID() {
    return 'fe3c9a86-586f-45bc-96be-fac621e1c32e';
  }

  async getCommissionPercentage(categoryId) {
    const category = await Category.findByPk(categoryId, {
      attributes: ['commission_percentage']
    });
    if (!category) throw new Error('Catégorie non trouvée');
    return category.commission_percentage || 10;
  }

  async calculateCommission(amount, categoryId) {
    const percentage = await this.getCommissionPercentage(categoryId);
    const commissionAmount = Math.floor(amount * percentage / 100);
    const driverAmount = amount - commissionAmount;
    
    return {
      amount,
      percentage,
      commissionAmount,
      driverAmount,
      breakdown: {
        total: amount,
        commission_percentage: percentage,
        commission_amount: commissionAmount,
        driver_net: driverAmount
      }
    };
  }

  /**
   * Retirer la commission du wallet du chauffeur APRÈS la course
   * @param {string} driverId - ID du chauffeur (user_id)
   * @param {string} rideId - ID de la course
   * @param {number} totalAmount - Montant total payé par le passager
   * @param {string} categoryId - ID de la catégorie
   * @returns {Promise<Object>}
   */
  async deductCommissionFromDriver(driverId, rideId, totalAmount, categoryId) {
    const commission = await this.calculateCommission(totalAmount, categoryId);
    
    // Vérifier le solde du chauffeur
    const driverWallet = await walletService.getUserWallet(driverId);
    if (driverWallet.balance < commission.commissionAmount) {
      // Si solde insuffisant, bloquer le chauffeur
      await this.blockDriverForNegativeBalance(driverId, `Solde insuffisant pour payer commission de ${commission.commissionAmount} FC`);
      throw new Error(`Solde insuffisant pour payer la commission. Le chauffeur est bloqué.`);
    }
    
    // Débiter le chauffeur (commission)
    await walletService.debit(
      driverId,
      commission.commissionAmount,
      'commission_debit',
      'ride',
      rideId,
      {
        description: `Commission course #${rideId.substring(0, 8)} (${commission.percentage}%)`
      }
    );
    
    // Créditer la société
    await walletService.credit(
      this.COMPANY_USER_ID,
      commission.commissionAmount,
      'commission_earning',
      'ride',
      rideId,
      {
        description: `Commission course #${rideId.substring(0, 8)}`
      }
    );
    
    // Enregistrer l'historique de commission
    await CommissionHistory.create({
      ride_id: rideId,
      driver_id: driverId,
      total_amount: totalAmount,
      commission_percentage: commission.percentage,
      commission_amount: commission.commissionAmount,
      driver_net: commission.driverAmount,
      status: 'completed'
    });
    
    return commission;
  }

  /**
   * Bloquer un chauffeur si solde négatif
   */
  async blockDriverForNegativeBalance(driverId, reason) {
    const driver = await Driver.findOne({ where: { user_id: driverId } });
    if (driver) {
      await driver.update({
        is_blocked_for_negative_balance: true,
        blocked_at: new Date(),
        block_reason: reason,
        is_online: false
      });
      
      console.log(`🚫 Chauffeur ${driverId} bloqué: ${reason}`);
    }
  }

  /**
   * Vérifier et bloquer un chauffeur si solde négatif
   */
  async checkAndBlockDriverIfNegativeBalance(driverId) {
    const wallet = await walletService.getUserWallet(driverId);
    
    if (wallet.balance < 0) {
      await this.blockDriverForNegativeBalance(driverId, `Solde négatif: ${wallet.balance} FC`);
      return { is_blocked: true, balance: wallet.balance };
    }
    
    return { is_blocked: false, balance: wallet.balance };
  }

  /**
   * Débloquer un chauffeur (après recharge)
   */
  async unblockDriver(driverId, adminId, reason) {
    const driver = await Driver.findOne({ where: { user_id: driverId } });
    if (driver) {
      await driver.update({
        is_blocked_for_negative_balance: false,
        blocked_at: null,
        block_reason: null
      });
      
      // Enregistrer l'action admin
      await AdminLog.create({
        admin_id: adminId,
        action: 'unblock_driver',
        target_type: 'driver',
        target_id: driver.id,
        new_value: { reason }
      });
      
      return { success: true };
    }
    return { success: false };
  }
}

module.exports = new CommissionService();