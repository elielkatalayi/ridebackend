const { VehicleBooking, Vehicle, User } = require('../../models');
const availabilityService = require('./availabilityService');
const notificationService = require('../notification/NotificationService');
const { Op } = require('sequelize');

class BookingService {
  
  /**
   * Créer une nouvelle réservation
   */
  async createBooking(renterId, bookingData) {
    const {
      vehicle_id,
      start_date,
      end_date,
      booking_type,
      notes
    } = bookingData;
    
    // 1. Vérifier si le véhicule existe
    const vehicle = await Vehicle.findByPk(vehicle_id, {
      include: [{ model: User, as: 'owner' }]
    });
    
    if (!vehicle) {
      throw new Error('Véhicule non trouvé');
    }

    if (vehicle.owner_id === renterId) {
      throw new Error('Vous ne pouvez pas réserver votre propre véhicule');
    }
    
    // 2. Vérifier si le véhicule est disponible
    if (!vehicle.is_available) {
      throw new Error('Ce véhicule est déjà réservé');
    }
    
    // 3. Vérifier les conflits de dates
    const { available } = await availabilityService.checkAvailability(
      vehicle_id,
      start_date,
      end_date
    );
    
    if (!available) {
      throw new Error('Véhicule non disponible sur cette période');
    }
    
    // 4. Calculer le montant total
    const start = new Date(start_date);
    const end = new Date(end_date);
    
    let totalAmount = 0;
    if (booking_type === 'daily') {
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      totalAmount = days * vehicle.price_per_day;
    } else {
      const hours = Math.ceil((end - start) / (1000 * 60 * 60));
      totalAmount = hours * vehicle.price_per_hour;
    }
    
    // 5. Caution = 50% du total
    const depositAmount = Math.floor(totalAmount * 0.5);
    
    // 6. Générer numéro de réservation unique
    const bookingNumber = `BK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // 7. Créer la réservation
    const booking = await VehicleBooking.create({
      booking_number: bookingNumber,
      vehicle_id,
      renter_id: renterId,
      owner_id: vehicle.owner_id,
      start_date,
      end_date,
      booking_type,
      total_amount: totalAmount,
      deposit_amount: depositAmount,
      status: 'pending',
      notes
    });
    
    // 8. Rendre le véhicule indisponible
    await availabilityService.markAsUnavailable(vehicle_id);
    
    // 9. Envoyer notification au propriétaire (CORRIGÉ)
    try {
      await notificationService.send({
        userId: vehicle.owner_id,
        type: 'rental',
        subtype: 'new_booking',
        title: '🚗 Nouvelle réservation',
        body: `${booking.booking_number} - ${vehicle.brand} ${vehicle.model}`,
        priority: 'normal',
        data: { booking_id: booking.id, vehicle_id, start_date, end_date },
        referenceId: booking.id,
        referenceType: 'booking',
        useTemplate: false
      });
    } catch (notifError) {
      console.error('Erreur envoi notification:', notifError.message);
      // Ne pas bloquer la création de la réservation
    }
    
    return booking;
  }
  
  /**
   * Accepter une réservation (par le propriétaire)
   */
  async acceptBooking(ownerId, bookingId) {
    const booking = await VehicleBooking.findByPk(bookingId, {
      include: [{ model: Vehicle, as: 'vehicle' }]
    });
    
    if (!booking) {
      throw new Error('Réservation non trouvée');
    }
    
    // Vérifier que c'est bien le propriétaire
    if (booking.owner_id !== ownerId) {
      throw new Error('Non autorisé');
    }
    
    if (booking.status !== 'pending') {
      throw new Error(`Impossible d'accepter une réservation au statut ${booking.status}`);
    }
    
    // Mettre à jour le statut
    await booking.update({
      status: 'accepted'
    });
    
    // Notification au locataire (CORRIGÉ)
    try {
      await notificationService.send({
        userId: booking.renter_id,
        type: 'rental',
        subtype: 'booking_accepted',
        title: '✅ Réservation acceptée',
        body: `Votre réservation ${booking.booking_number} a été acceptée par le propriétaire`,
        priority: 'normal',
        data: { booking_id: booking.id },
        referenceId: booking.id,
        referenceType: 'booking',
        useTemplate: false
      });
    } catch (notifError) {
      console.error('Erreur envoi notification:', notifError.message);
    }
    
    return booking;
  }
  
  /**
   * Marquer une location comme terminée (par propriétaire)
   */
  async completeBooking(ownerId, bookingId) {
    const booking = await VehicleBooking.findByPk(bookingId);
    
    if (!booking) {
      throw new Error('Réservation non trouvée');
    }
    
    if (booking.owner_id !== ownerId) {
      throw new Error('Non autorisé');
    }
    
    if (booking.status !== 'accepted') {
      throw new Error(`Impossible de terminer une réservation au statut ${booking.status}`);
    }
    
    // Mettre à jour le statut
    await booking.update({
      status: 'completed',
      completed_at: new Date()
    });
    
    // Rendre le véhicule disponible à nouveau
    await availabilityService.markAsAvailable(booking.vehicle_id);
    
    // Notification au locataire (CORRIGÉ)
    try {
      await notificationService.send({
        userId: booking.renter_id,
        type: 'rental',
        subtype: 'booking_completed',
        title: '🏁 Location terminée',
        body: `La location ${booking.booking_number} est terminée. Merci !`,
        priority: 'normal',
        data: { booking_id: booking.id },
        referenceId: booking.id,
        referenceType: 'booking',
        useTemplate: false
      });
    } catch (notifError) {
      console.error('Erreur envoi notification:', notifError.message);
    }
    
    // Mettre à jour le compteur du véhicule
    await Vehicle.increment('total_bookings', {
      by: 1,
      where: { id: booking.vehicle_id }
    });
    
    return booking;
  }
  
  /**
   * Annuler une réservation
   */
  async cancelBooking(userId, bookingId, role, reason) {
    const booking = await VehicleBooking.findByPk(bookingId);
    
    if (!booking) {
      throw new Error('Réservation non trouvée');
    }
    
    // Vérifier les permissions
    if (role === 'renter' && booking.renter_id !== userId) {
      throw new Error('Non autorisé');
    }
    
    if (role === 'owner' && booking.owner_id !== userId) {
      throw new Error('Non autorisé');
    }
    
    // Vérifier que la réservation n'est pas déjà terminée
    if (booking.status === 'completed') {
      throw new Error('Impossible d\'annuler une location terminée');
    }
    
    // Définir le nouveau statut
    const newStatus = role === 'renter' ? 'cancelled_by_renter' : 'cancelled_by_owner';
    
    // Mettre à jour
    await booking.update({
      status: newStatus,
      cancelled_at: new Date(),
      cancelled_by: userId,
      cancellation_reason: reason
    });
    
    // Rendre le véhicule disponible
    await availabilityService.markAsAvailable(booking.vehicle_id);
    
    // Notification à l'autre partie (CORRIGÉ)
    const notificationUserId = role === 'renter' ? booking.owner_id : booking.renter_id;
    const notificationTitle = role === 'renter' ? '❌ Réservation annulée' : '❌ Réservation annulée par le propriétaire';
    
    try {
      await notificationService.send({
        userId: notificationUserId,
        type: 'rental',
        subtype: 'booking_cancelled',
        title: notificationTitle,
        body: `Réservation ${booking.booking_number} annulée. Raison: ${reason || 'Non spécifiée'}`,
        priority: 'normal',
        data: { booking_id: booking.id, cancelled_by: role, reason },
        referenceId: booking.id,
        referenceType: 'booking',
        useTemplate: false
      });
    } catch (notifError) {
      console.error('Erreur envoi notification:', notifError.message);
    }
    
    return booking;
  }
  
  /**
   * Récupérer toutes les réservations d'un utilisateur
   */
  async getUserBookings(userId, role) {
    const where = {};
    
    if (role === 'renter') {
      where.renter_id = userId;
    } else if (role === 'owner') {
      where.owner_id = userId;
    }
    
    const bookings = await VehicleBooking.findAll({
      where,
      include: [
        {
          model: Vehicle,
          as: 'vehicle',
          attributes: ['id', 'brand', 'model', 'cover_photo', 'price_per_day', 'price_per_hour']
        },
        {
          model: User,
          as: role === 'renter' ? 'owner' : 'renter',
          attributes: ['id', 'first_name', 'last_name', 'avatar_url', 'phone']
        }
      ],
      order: [['created_at', 'DESC']]
    });
    
    return bookings;
  }
}

module.exports = new BookingService();