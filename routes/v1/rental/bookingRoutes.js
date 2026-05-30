const express = require('express');
const router = express.Router();
const bookingController = require('../../../controllers/rental/bookingController');
const { auth } = require('../../../middleware/auth');

router.use(auth);

router.post('/', bookingController.createBooking);
router.put('/:bookingId/accept', bookingController.acceptBooking);
router.put('/:bookingId/complete', bookingController.completeBooking);
router.put('/:bookingId/cancel', bookingController.cancelBooking);
router.get('/my-bookings', bookingController.getMyBookings);
router.get('/:bookingId', bookingController.getBookingDetails);

module.exports = router;