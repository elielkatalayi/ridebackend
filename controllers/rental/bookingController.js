const bookingService = require('../../services/rental/bookingService');

class BookingController {
  
  /**
   * Créer une réservation
   * POST /api/rental/bookings
   */
  async createBooking(req, res, next) {
    try {
      const userId = req.user.id;
      const bookingData = req.body;
      
      const booking = await bookingService.createBooking(userId, bookingData);
      
      res.status(201).json({
        success: true,
        message: 'Réservation créée avec succès',
        booking
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Accepter une réservation (propriétaire)
   * PUT /api/rental/bookings/:bookingId/accept
   */
  async acceptBooking(req, res, next) {
    try {
      const userId = req.user.id;
      const { bookingId } = req.params;
      
      const booking = await bookingService.acceptBooking(userId, bookingId);
      
      res.json({
        success: true,
        message: 'Réservation acceptée',
        booking
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Terminer une réservation (propriétaire)
   * PUT /api/rental/bookings/:bookingId/complete
   */
  async completeBooking(req, res, next) {
    try {
      const userId = req.user.id;
      const { bookingId } = req.params;
      
      const booking = await bookingService.completeBooking(userId, bookingId);
      
      res.json({
        success: true,
        message: 'Location terminée',
        booking
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Annuler une réservation
   * PUT /api/rental/bookings/:bookingId/cancel
   */
  async cancelBooking(req, res, next) {
    try {
      const userId = req.user.id;
      const { bookingId } = req.params;
      const { role, reason } = req.body; // role: 'renter' ou 'owner'
      
      const booking = await bookingService.cancelBooking(userId, bookingId, role, reason);
      
      res.json({
        success: true,
        message: 'Réservation annulée',
        booking
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Mes réservations
   * GET /api/rental/bookings/my-bookings
   */
  async getMyBookings(req, res, next) {
    try {
      const userId = req.user.id;
      const { role } = req.query; // 'renter' ou 'owner'
      
      const bookings = await bookingService.getUserBookings(userId, role);
      
      res.json({
        success: true,
        bookings
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Détails d'une réservation
   * GET /api/rental/bookings/:bookingId
   */
  async getBookingDetails(req, res, next) {
    try {
      const { bookingId } = req.params;
      const { VehicleBooking, Vehicle, User } = require('../../models');
      
      const booking = await VehicleBooking.findByPk(bookingId, {
        include: [
          { model: Vehicle, as: 'vehicle' },
          { model: User, as: 'renter', attributes: ['id', 'first_name', 'last_name', 'avatar_url', 'phone'] },
          { model: User, as: 'owner', attributes: ['id', 'first_name', 'last_name', 'avatar_url', 'phone'] }
        ]
      });
      
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Réservation non trouvée' });
      }
      
      res.json({ success: true, booking });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new BookingController();