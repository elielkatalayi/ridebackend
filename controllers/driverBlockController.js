// controllers/admin/driverBlockController.js

const commissionService = require('../services/payment/commissionService');
const walletService = require('../services/payment/walletService');
const { Driver, User } = require('../models');

class DriverBlockController {
  
  /**
   * Liste des chauffeurs bloqués (solde négatif)
   * GET /api/v1/admin/drivers/blocked
   */
  async getBlockedDrivers(req, res, next) {
    try {
      const drivers = await Driver.findAll({
        where: { is_blocked_for_negative_balance: true },
        include: [
          { model: User, as: 'user', attributes: ['id', 'first_name', 'last_name', 'phone'] }
        ],
        attributes: ['id', 'user_id', 'vehicle_brand', 'vehicle_model', 'vehicle_plate', 'blocked_at', 'block_reason']
      });
      
      // Ajouter le solde pour chaque chauffeur
      const driversWithBalance = await Promise.all(drivers.map(async (driver) => {
        const wallet = await walletService.getUserWallet(driver.user_id);
        return {
          ...driver.toJSON(),
          balance: wallet.balance
        };
      }));
      
      res.json({ success: true, drivers: driversWithBalance });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Débloquer un chauffeur
   * POST /api/v1/admin/drivers/:driverId/unblock
   */
  async unblockDriver(req, res, next) {
    try {
      const { driverId } = req.params;
      const { reason } = req.body;
      
      const result = await commissionService.unblockDriver(driverId, req.user.id, reason);
      
      if (result.success) {
        res.json({ success: true, message: 'Chauffeur débloqué avec succès' });
      } else {
        res.status(404).json({ error: 'Chauffeur non trouvé' });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Voir le solde d'un chauffeur spécifique
   * GET /api/v1/admin/drivers/:driverId/balance
   */
  async getDriverBalance(req, res, next) {
    try {
      const { driverId } = req.params;
      const wallet = await walletService.getUserWallet(driverId);
      
      res.json({
        success: true,
        driver_id: driverId,
        balance: wallet.balance,
        is_blocked: wallet.balance < 0
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DriverBlockController();