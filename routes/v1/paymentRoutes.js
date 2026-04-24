// routes/paymentRoutes.js

const express = require('express');
const router = express.Router();
const paymentController = require('../../controllers/paymentController');
const { auth } = require('../../middleware/auth');
const { paymentLimiter } = require('../../middleware/rateLimiter');

router.use(auth);

router.post('/deposit', paymentLimiter, paymentController.initiateDeposit);
router.get('/:paymentId/status', paymentController.checkPaymentStatus);
router.post('/withdraw', paymentLimiter, paymentController.withdraw);

module.exports = router;