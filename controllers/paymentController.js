// controllers/paymentController.js

const depositService = require('../services/payment/depositService');
const withdrawalService = require('../services/payment/withdrawalService');

class PaymentController {
  
  async initiateDeposit(req, res, next) {
    try {
      const { amount, phone_number, operator } = req.body;
      const result = await depositService.initiateDeposit(req.user.id, amount, phone_number, operator);
      res.json(result);
    } catch (error) { next(error); }
  }

  async checkPaymentStatus(req, res, next) {
    try {
      const { paymentId } = req.params;
      const result = await depositService.checkPaymentStatus(paymentId);
      res.json(result);
    } catch (error) { next(error); }
  }

  async withdraw(req, res, next) {
    try {
      const { amount, method, destination, pin } = req.body;
      const result = await withdrawalService.withdraw(req.user.id, amount, method, destination, pin);
      res.json(result);
    } catch (error) { next(error); }
  }
}

module.exports = new PaymentController();