const { SosAlert, Ride, User, Driver, Chat } = require('../../models');
const { sequelize } = require('../../config/database');
const clickatell = require('../../config/clickatell');

class SosService {
  /**
   * Déclencher une alerte SOS
   * @param {string} rideId - ID de la course
   * @param {string} passengerId - ID du passager
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Promise<Object>}
   */
  async triggerSos(rideId, passengerId, lat, lng) {
    const transaction = await sequelize.transaction();
    
    try {
      // Récupérer la course
      const ride = await Ride.findByPk(rideId, {
        include: [
          { model: User, as: 'passenger' },
          { model: Driver, as: 'driver', include: ['user'] }
        ],
        transaction
      });
      
      if (!ride) {
        throw new Error('Course non trouvée');
      }
      
      // Mettre à jour la course
      await ride.update({ sos_triggered: true }, { transaction });
      
      // Créer l'alerte SOS
      const sosAlert = await SosAlert.create({
        ride_id: rideId,
        passenger_id: passengerId,
        driver_id: ride.driver_id,
        lat,
        lng,
        status: 'pending'
      }, { transaction });
      
      // Notifier l'équipe Uplus (admin)
      await this.notifyUplusTeam(sosAlert, ride);
      
      // Notifier le contact d'urgence
      if (ride.passenger.emergency_contact_phone) {
        await this.notifyEmergencyContact(sosAlert, ride);
      }
      
      // Créer un chat de support
      const chat = await Chat.create({
        user_id: passengerId,
        driver_id: ride.driver_id,
        ride_id: rideId,
        is_support_chat: true,
        is_active: true
      }, { transaction });
      
      await sosAlert.update({ chat_id: chat.id, chat_created: true }, { transaction });
      
      await transaction.commit();
      
      return {
        sosAlert,
        chatId: chat.id,
        ride
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Notifier l'équipe Uplus 24/7
   * @param {Object} sosAlert - Alerte SOS
   * @param {Object} ride - Course
   */
  async notifyUplusTeam(sosAlert, ride) {
    // TODO: Envoyer notification via WebSocket aux admins
    console.log(`
      🚨 ALERTE SOS URGENTE 🚨
      Course: ${ride.id}
      Passager: ${ride.passenger.first_name} ${ride.passenger.last_name} (${ride.passenger.phone})
      Chauffeur: ${ride.driver?.user?.first_name} ${ride.driver?.user?.last_name}
      Position: ${sosAlert.lat}, ${sosAlert.lng}
      Heure: ${new Date().toISOString()}
    `);
    
    await sosAlert.update({
      uplus_notified: true,
      uplus_notified_at: new Date()
    });
  }

  /**
   * Notifier le contact d'urgence du passager
   * @param {Object} sosAlert - Alerte SOS
   * @param {Object} ride - Course
   */
  async notifyEmergencyContact(sosAlert, ride) {
    const contactPhone = ride.passenger.emergency_contact_phone;
    const mapsLink = `https://maps.google.com/?q=${sosAlert.lat},${sosAlert.lng}`;
    
    const message = `
      🚨 URGENCE ! ${ride.passenger.first_name} ${ride.passenger.last_name} a déclenché SOS.
      Position: ${mapsLink}
      Chauffeur: ${ride.driver?.user?.first_name} ${ride.driver?.user?.last_name}
      Veuillez contacter le passager immédiatement.
    `;
    
    try {
      await clickatell.sendSMS(contactPhone, message);
      await sosAlert.update({
        contact_notified: true,
        contact_phone: contactPhone,
        contact_notified_at: new Date()
      });
    } catch (error) {
      console.error('Erreur envoi SMS contact urgence:', error.message);
    }
  }

  /**
   * Résoudre une alerte SOS
   * @param {string} sosAlertId - ID de l'alerte
   * @param {string} resolvedBy - ID de l'admin qui résout
   * @param {string} resolutionNotes - Notes de résolution
   * @param {string} status - 'resolved' ou 'false_alarm'
   * @returns {Promise<Object>}
   */
  async resolveSos(sosAlertId, resolvedBy, resolutionNotes, status) {
    const sosAlert = await SosAlert.findByPk(sosAlertId);
    if (!sosAlert) {
      throw new Error('Alerte SOS non trouvée');
    }
    
    await sosAlert.update({
      status,
      resolved_at: new Date(),
      resolved_by: resolvedBy,
      resolution_notes: resolutionNotes
    });
    
    // Si fausse alerte, appliquer une pénalité de points au passager
    if (status === 'false_alarm') {
      // TODO: Implémenter la pénalité passager
      console.log(`Fausse alerte détectée pour la course ${sosAlert.ride_id}`);
    }
    
    return sosAlert;
  }

  /**
   * Obtenir les alertes SOS actives
   * @returns {Promise<Array>}
   */
  async getActiveSosAlerts() {
    const alerts = await SosAlert.findAll({
      where: { status: 'pending' },
      include: [
        { model: Ride, as: 'ride', include: ['passenger', 'driver'] }
      ],
      order: [['triggered_at', 'DESC']]
    });
    
    return alerts;
  }

  /**
   * Obtenir l'historique des alertes SOS d'un passager
   * @param {string} passengerId - ID du passager
   * @returns {Promise<Array>}
   */
  async getPassengerSosHistory(passengerId) {
    const alerts = await SosAlert.findAll({
      where: { passenger_id: passengerId },
      include: [{ model: Ride, as: 'ride' }],
      order: [['triggered_at', 'DESC']]
    });
    
    return alerts;
  }
}

module.exports = new SosService();