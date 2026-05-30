// routes/walletRoutes.js

const express = require('express');
const router = express.Router();
const walletController = require('../../controllers/walletController');
const { auth } = require('../../middleware/auth');
const { transferLimiter ,paymentLimiter } = require('../../middleware/rateLimiter');
const paymentController = require('../../controllers/paymentController');
router.use(auth);

router.get('/balance', walletController.getBalance);
router.post('/set-pin', walletController.setPin);
router.post('/verify-pin', walletController.verifyPin);
router.post('/transfer', transferLimiter, walletController.transfer);
router.post('/pay-ride', walletController.payRide);
router.get('/transactions', walletController.getTransactions);
router.get('/search', walletController.searchUser);


router.post('/deposit', paymentLimiter, paymentController.initiateDeposit);
router.get('/:paymentId/status', paymentController.checkPaymentStatus);
router.post('/withdraw', paymentLimiter, paymentController.withdraw);

module.exports = router;