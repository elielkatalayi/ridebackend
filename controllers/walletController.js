// controllers/walletController.js
const walletService = require('../services/payment/walletService');

class WalletController {
  
  /**
   * Obtenir le solde du wallet
   * GET /api/v1/wallet/balance
   */
  async getBalance(req, res, next) {
    try {
      const balance = await walletService.getBalance(req.user.id);
      
      res.json({
        state: true,
        message: 'Solde récupéré avec succès',
        datas: {
          balance: balance.balance || balance,
          currency: balance.currency || 'CDF'
        }
      });
    } catch (error) { 
      next(error); 
    }
  }

  /**
   * Définir le PIN du wallet
   * POST /api/v1/wallet/pin
   */
  async setPin(req, res, next) {
    try {
      const { pin } = req.body;
      
      if (!pin) {
        return res.status(400).json({
          state: false,
          message: 'Le PIN est requis',
          datas: null
        });
      }
      
      if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        return res.status(400).json({
          state: false,
          message: 'Le PIN doit contenir 4 chiffres',
          datas: null
        });
      }
      
      await walletService.setWalletPin(req.user.id, pin);
      
      res.json({
        state: true,
        message: 'PIN défini avec succès',
        datas: null
      });
    } catch (error) { 
      next(error); 
    }
  }

  /**
   * Vérifier le PIN du wallet
   * POST /api/v1/wallet/verify-pin
   */
  async verifyPin(req, res, next) {
    try {
      const { pin } = req.body;
      
      if (!pin) {
        return res.status(400).json({
          state: false,
          message: 'Le PIN est requis',
          datas: null
        });
      }
      
      await walletService.verifyWalletPin(req.user.id, pin);
      
      res.json({
        state: true,
        message: 'PIN valide',
        datas: null
      });
    } catch (error) { 
      next(error); 
    }
  }

  /**
   * Transférer de l'argent vers un autre utilisateur
   * POST /api/v1/wallet/transfer
   */
  async transfer(req, res, next) {
    try {
      const { to_phone, amount, pin, description } = req.body;
      
      if (!to_phone) {
        return res.status(400).json({
          state: false,
          message: 'Numéro destinataire requis',
          datas: null
        });
      }
      
      if (!amount || amount < 100) {
        return res.status(400).json({
          state: false,
          message: 'Montant minimum: 100 FC',
          datas: null
        });
      }
      
      if (!pin) {
        return res.status(400).json({
          state: false,
          message: 'PIN requis pour la transaction',
          datas: null
        });
      }
      
      const result = await walletService.transferByPhone(
        req.user.id, 
        to_phone, 
        amount, 
        pin, 
        description
      );
      
      res.json({
        state: true,
        message: 'Transfert effectué avec succès',
        datas: {
          transaction_id: result.transaction_id || result.id,
          from: result.from,
          to: result.to,
          amount: amount,
          fee: result.fee || 0,
          total_deducted: result.total_deducted || amount,
          new_balance: result.new_balance,
          reference: result.reference,
          description: description || 'Transfert entre utilisateurs',
          created_at: result.created_at || new Date().toISOString()
        }
      });
    } catch (error) { 
      next(error); 
    }
  }

  /**
   * Payer une course
   * POST /api/v1/wallet/pay-ride
   */
  async payRide(req, res, next) {
    try {
      const { ride_id, amount, pin } = req.body;
      
      if (!ride_id) {
        return res.status(400).json({
          state: false,
          message: 'ID course requis',
          datas: null
        });
      }
      
      if (!amount || amount <= 0) {
        return res.status(400).json({
          state: false,
          message: 'Montant valide requis',
          datas: null
        });
      }
      
      if (!pin) {
        return res.status(400).json({
          state: false,
          message: 'PIN requis pour le paiement',
          datas: null
        });
      }
      
      const result = await walletService.payRide(req.user.id, ride_id, amount, pin);
      
      res.json({
        state: true,
        message: 'Paiement effectué avec succès',
        datas: {
          ride_id: ride_id,
          amount_paid: amount,
          new_balance: result.new_balance,
          transaction_id: result.transaction_id,
          status: 'completed',
          paid_at: new Date().toISOString()
        }
      });
    } catch (error) { 
      next(error); 
    }
  }

  /**
   * Obtenir l'historique des transactions
   * GET /api/v1/wallet/transactions
   */
  async getTransactions(req, res, next) {
    try {
      const { limit = 50, offset = 0, type, start_date, end_date } = req.query;
      
      const filters = {
        limit: parseInt(limit),
        offset: parseInt(offset)
      };
      
      if (type) filters.type = type;
      if (start_date) filters.start_date = start_date;
      if (end_date) filters.end_date = end_date;
      
      const result = await walletService.getTransactionHistory(req.user.id, filters);
      
      // Si result contient déjà { transactions, total, ... }
      const transactions = result.transactions || result.rows || result;
      const total = result.total || result.count || (Array.isArray(transactions) ? transactions.length : 0);
      
      const totalPages = Math.ceil(total / parseInt(limit));
      const currentPage = Math.floor(parseInt(offset) / parseInt(limit)) + 1;
      
      res.json({
        state: true,
        message: 'Historique des transactions récupéré',
        datas: transactions,
        meta: {
          total: total,
          count: Array.isArray(transactions) ? transactions.length : 0,
          per_page: parseInt(limit),
          current_page: currentPage,
          total_pages: totalPages
        }
      });
    } catch (error) { 
      next(error); 
    }
  }

  /**
   * Rechercher un utilisateur par téléphone (pour transfert)
   * GET /api/v1/wallet/search-user?phone=XXX
   */
  async searchUser(req, res, next) {
    try {
      const { phone } = req.query;
      
      if (!phone) {
        return res.status(400).json({
          state: false,
          message: 'Numéro de téléphone requis',
          datas: null
        });
      }
      
      const user = await walletService.getUserByPhone(phone);
      
      if (!user) {
        return res.status(404).json({
          state: false,
          message: 'Utilisateur non trouvé',
          datas: null
        });
      }
      
      res.json({
        state: true,
        message: 'Utilisateur trouvé',
        datas: {
          user_id: user.id,
          phone: user.phone,
          name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          avatar_url: user.avatar_url || null
        }
      });
    } catch (error) { 
      next(error); 
    }
  }

  /**
   * Ajouter de l'argent au wallet (recharge)
   * POST /api/v1/wallet/deposit
   */
  async deposit(req, res, next) {
    try {
      const { amount, payment_method, reference } = req.body;
      
      if (!amount || amount < 100) {
        return res.status(400).json({
          state: false,
          message: 'Montant minimum de recharge: 100 FC',
          datas: null
        });
      }
      
      if (!payment_method) {
        return res.status(400).json({
          state: false,
          message: 'Méthode de paiement requise',
          datas: null
        });
      }
      
      const result = await walletService.deposit(
        req.user.id, 
        amount, 
        payment_method, 
        reference
      );
      
      res.json({
        state: true,
        message: 'Recharge effectuée avec succès',
        datas: {
          transaction_id: result.id,
          amount: amount,
          new_balance: result.new_balance,
          payment_method: payment_method,
          status: 'completed',
          created_at: new Date().toISOString()
        }
      });
    } catch (error) { 
      next(error); 
    }
  }

  /**
   * Retirer de l'argent du wallet
   * POST /api/v1/wallet/withdraw
   */
  async withdraw(req, res, next) {
    try {
      const { amount, pin, withdrawal_method, phone_number } = req.body;
      
      if (!amount || amount < 500) {
        return res.status(400).json({
          state: false,
          message: 'Montant minimum de retrait: 500 FC',
          datas: null
        });
      }
      
      if (!pin) {
        return res.status(400).json({
          state: false,
          message: 'PIN requis pour le retrait',
          datas: null
        });
      }
      
      if (!withdrawal_method) {
        return res.status(400).json({
          state: false,
          message: 'Méthode de retrait requise',
          datas: null
        });
      }
      
      const result = await walletService.withdraw(
        req.user.id, 
        amount, 
        pin, 
        withdrawal_method,
        phone_number
      );
      
      res.json({
        state: true,
        message: 'Retrait effectué avec succès',
        datas: {
          transaction_id: result.id,
          amount: amount,
          fee: result.fee || 0,
          total_deducted: amount + (result.fee || 0),
          new_balance: result.new_balance,
          withdrawal_method: withdrawal_method,
          status: 'pending',
          reference: result.reference,
          created_at: new Date().toISOString()
        }
      });
    } catch (error) { 
      next(error); 
    }
  }

  /**
   * Obtenir les détails d'une transaction
   * GET /api/v1/wallet/transactions/:transactionId
   */
  async getTransactionDetails(req, res, next) {
    try {
      const { transactionId } = req.params;
      
      if (!transactionId) {
        return res.status(400).json({
          state: false,
          message: 'ID de transaction requis',
          datas: null
        });
      }
      
      const transaction = await walletService.getTransactionById(
        req.user.id, 
        transactionId
      );
      
      if (!transaction) {
        return res.status(404).json({
          state: false,
          message: 'Transaction non trouvée',
          datas: null
        });
      }
      
      res.json({
        state: true,
        message: 'Détails de la transaction récupérés',
        datas: transaction
      });
    } catch (error) { 
      next(error); 
    }
  }
}

module.exports = new WalletController();