const Joi = require('joi');

const paymentValidator = {
  // Dépôt
  deposit: Joi.object({
    amount: Joi.number().integer().min(500).max(10000000).required(),
    phone_number: Joi.string().pattern(/^(\+243|0)[0-9]{9}$/).required(),
    operator: Joi.string().valid('vodacom', 'orange', 'airtel', 'africell').required()
  }),

  // Paiement de course
  payRide: Joi.object({
    ride_id: Joi.string().uuid().required(),
    driver_unique_id: Joi.string().pattern(/^MD-[A-Z0-9]{8}$/).required(),
    pin: Joi.string().pattern(/^\d{6}$/).optional()
  }),

  // Retrait
  withdraw: Joi.object({
    amount: Joi.number().integer().min(1000).max(5000000).required(),
    method: Joi.string().valid('mpesa', 'orange_money', 'airtel_money', 'bank', 'cash').required(),
    destination: Joi.string().required(),
    pin: Joi.string().pattern(/^\d{6}$/).required()
  }),

  // Vérification paiement
  checkPayment: Joi.object({
    paymentId: Joi.string().uuid().required()
  }),

  // ID wallet
  walletId: Joi.object({
    walletId: Joi.string().uuid().required()
  }),

  // PIN wallet
  setPin: Joi.object({
    pin: Joi.string().pattern(/^\d{6}$/).required()
  }),

  verifyPin: Joi.object({
    pin: Joi.string().pattern(/^\d{6}$/).required()
  }),

  // Liste transactions
  listTransactions: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(50),
    offset: Joi.number().integer().min(0).default(0),
    type: Joi.string().valid('deposit', 'payment', 'earning', 'withdrawal', 'refund').optional(),
    start_date: Joi.date().optional(),
    end_date: Joi.date().optional()
  }),

  // Webhook Shawari
  shawariWebhook: Joi.object({
    transaction_id: Joi.string().required(),
    status: Joi.string().valid('pending', 'processing', 'completed', 'failed').required(),
    amount: Joi.number().integer().required(),
    reference: Joi.string().required(),
    provider_reference: Joi.string().optional()
  })
};

module.exports = paymentValidator;