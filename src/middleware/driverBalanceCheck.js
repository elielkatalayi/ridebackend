// middleware/driverBalanceCheck.js

const walletService = require('../services/payment/walletService');

const checkDriverBalance = async (req, res, next) => {
  try {
    if (!req.driver) {
      return next();
    }
    
    const wallet = await walletService.getUserWallet(req.driver.user_id);
    
    if (wallet.balance < 0) {
      return res.status(403).json({
        error: 'Votre wallet est négatif. Veuillez recharger pour continuer.',
        balance: wallet.balance
      });
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { checkDriverBalance };