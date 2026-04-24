// controllers/walletController.js

const walletService = require('../services/payment/walletService');

class WalletController {
  
  async getBalance(req, res, next) {
    try {
      const balance = await walletService.getBalance(req.user.id);
      res.json(balance);
    } catch (error) { next(error); }
  }

  async setPin(req, res, next) {
    try {
      const { pin } = req.body;
      await walletService.setWalletPin(req.user.id, pin);
      res.json({ success: true, message: 'PIN défini avec succès' });
    } catch (error) { next(error); }
  }

  async verifyPin(req, res, next) {
    try {
      const { pin } = req.body;
      await walletService.verifyWalletPin(req.user.id, pin);
      res.json({ success: true, message: 'PIN valide' });
    } catch (error) { next(error); }
  }

  async transfer(req, res, next) {
    try {
      const { to_phone, amount, pin, description } = req.body;
      if (!to_phone) return res.status(400).json({ error: 'Numéro destinataire requis' });
      if (!amount || amount < 100) return res.status(400).json({ error: 'Montant minimum: 100 FC' });
      
      const result = await walletService.transferByPhone(req.user.id, to_phone, amount, pin, description);
      res.json(result);
    } catch (error) { next(error); }
  }

  async payRide(req, res, next) {
    try {
      const { ride_id, amount, pin } = req.body;
      if (!ride_id) return res.status(400).json({ error: 'ID course requis' });
      
      const result = await walletService.payRide(req.user.id, ride_id, amount, pin);
      res.json(result);
    } catch (error) { next(error); }
  }

  async getTransactions(req, res, next) {
    try {
      const { limit = 50, offset = 0 } = req.query;
      const result = await walletService.getTransactionHistory(req.user.id, { limit: parseInt(limit), offset: parseInt(offset) });
      res.json(result);
    } catch (error) { next(error); }
  }

  async searchUser(req, res, next) {
    try {
      const { phone } = req.query;
      if (!phone) return res.status(400).json({ error: 'Numéro requis' });
      
      const user = await walletService.getUserByPhone(phone);
      res.json({ phone: user.phone, name: `${user.first_name || ''} ${user.last_name || ''}`.trim(), user_id: user.id });
    } catch (error) { next(error); }
  }
}

module.exports = new WalletController();