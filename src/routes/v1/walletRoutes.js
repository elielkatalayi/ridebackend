// routes/walletRoutes.js

const express = require('express');
const router = express.Router();
const walletController = require('../../controllers/walletController');
const { auth } = require('../../middleware/auth');
const { transferLimiter } = require('../../middleware/rateLimiter');

router.use(auth);

router.get('/balance', walletController.getBalance);
router.post('/set-pin', walletController.setPin);
router.post('/verify-pin', walletController.verifyPin);
router.post('/transfer', transferLimiter, walletController.transfer);
router.post('/pay-ride', walletController.payRide);
router.get('/transactions', walletController.getTransactions);
router.get('/search', walletController.searchUser);

module.exports = router;