const { Ride, RideNegotiation } = require('../../models');
const NotificationService = require('../notification/NotificationService');
const SocketService = require('../notification/SocketService');

class NegotiationService {
  /**
   * Proposer un nouveau prix pour une course
   * @param {string} rideId - ID de la course
   * @param {string} proposedBy - 'passenger' ou 'driver'
   * @param {number} proposedPrice - Prix proposé
   * @returns {Promise<Object>}
   */
  async proposePrice(rideId, proposedBy, proposedPrice) {
    const ride = await Ride.findByPk(rideId, {
      include: ['passenger', 'driver']
    });
    
    if (!ride) {
      throw new Error('Course non trouvée');
    }
    
    if (ride.status !== 'pending' && ride.status !== 'negotiating') {
      throw new Error('Négociation non possible');
    }
    
    // Récupérer la dernière proposition
    const lastNegotiation = await RideNegotiation.findOne({
      where: { ride_id: rideId },
      order: [['created_at', 'DESC']]
    });
    
    // Créer la nouvelle proposition
    const negotiation = await RideNegotiation.create({
      ride_id: rideId,
      proposed_by: proposedBy,
      proposed_price: proposedPrice,
      previous_price: lastNegotiation?.proposed_price || ride.price_suggested,
      status: 'pending'
    });
    
    // Mettre à jour le statut de la course
    await ride.update({
      status: 'negotiating',
      price_negotiated: proposedPrice,
      negotiated_at: new Date()
    });
    
    // Notification à l'autre partie
    const otherUserId = proposedBy === 'driver' ? ride.passenger_id : ride.driver?.user_id;
    
    if (otherUserId) {
      await NotificationService.sendRideNotification(
        otherUserId,
        rideId,
        'ride_negotiation',
        {
          proposed_price: proposedPrice,
          proposed_by: proposedBy,
          previous_price: lastNegotiation?.proposed_price || ride.price_suggested,
          ride_id: rideId
        }
      );
      
      // Notification socket en temps réel
      SocketService.sendToUser(otherUserId, 'ride:negotiation', {
        ride_id: rideId,
        proposed_price: proposedPrice,
        proposed_by: proposedBy,
        previous_price: lastNegotiation?.proposed_price || ride.price_suggested,
        timestamp: new Date()
      });
    }
    
    return negotiation;
  }

  /**
   * Accepter une proposition
   * @param {string} rideId - ID de la course
   * @param {string} acceptedBy - 'passenger' ou 'driver'
   * @returns {Promise<Object>}
   */
  async acceptProposal(rideId, acceptedBy) {
    const ride = await Ride.findByPk(rideId, {
      include: ['passenger', 'driver']
    });
    
    if (!ride) {
      throw new Error('Course non trouvée');
    }
    
    // Récupérer la dernière proposition
    const lastNegotiation = await RideNegotiation.findOne({
      where: { ride_id: rideId },
      order: [['created_at', 'DESC']]
    });
    
    if (!lastNegotiation) {
      throw new Error('Aucune proposition à accepter');
    }
    
    // Vérifier que l'accepteur n'est pas le proposeur
    if (lastNegotiation.proposed_by === acceptedBy) {
      throw new Error('Vous ne pouvez pas accepter votre propre proposition');
    }
    
    // Marquer la proposition comme acceptée
    await lastNegotiation.update({ status: 'accepted' });
    
    // Mettre à jour la course
    await ride.update({
      status: 'accepted',
      price_final: lastNegotiation.proposed_price,
      accepted_at: new Date()
    });
    
    // Notification à l'autre partie
    const otherUserId = acceptedBy === 'driver' ? ride.passenger_id : ride.driver?.user_id;
    
    if (otherUserId) {
      await NotificationService.sendRideNotification(
        otherUserId,
        rideId,
        'ride_accepted',
        {
          accepted_price: lastNegotiation.proposed_price,
          ride_id: rideId,
          accepted_by: acceptedBy
        }
      );
      
      // Notification socket
      SocketService.sendToUser(otherUserId, 'ride:price_accepted', {
        ride_id: rideId,
        accepted_price: lastNegotiation.proposed_price,
        accepted_by: acceptedBy,
        timestamp: new Date()
      });
    }
    
    return {
      ride,
      acceptedPrice: lastNegotiation.proposed_price
    };
  }

  /**
   * Rejeter une proposition
   * @param {string} rideId - ID de la course
   * @param {string} rejectedBy - 'passenger' ou 'driver'
   * @param {string} reason - Raison du rejet
   * @returns {Promise<Object>}
   */
  async rejectProposal(rideId, rejectedBy, reason) {
    const ride = await Ride.findByPk(rideId, {
      include: ['passenger', 'driver']
    });
    
    if (!ride) {
      throw new Error('Course non trouvée');
    }
    
    // Récupérer la dernière proposition
    const lastNegotiation = await RideNegotiation.findOne({
      where: { ride_id: rideId },
      order: [['created_at', 'DESC']]
    });
    
    if (!lastNegotiation) {
      throw new Error('Aucune proposition à rejeter');
    }
    
    await lastNegotiation.update({
      status: 'rejected',
      rejected_reason: reason
    });
    
    // Notification à l'autre partie
    const otherUserId = rejectedBy === 'driver' ? ride.passenger_id : ride.driver?.user_id;
    
    if (otherUserId) {
      await NotificationService.sendRideNotification(
        otherUserId,
        rideId,
        'ride_negotiation_rejected',
        {
          ride_id: rideId,
          rejected_by: rejectedBy,
          reason: reason
        }
      );
      
      // Notification socket
      SocketService.sendToUser(otherUserId, 'ride:price_rejected', {
        ride_id: rideId,
        rejected_by: rejectedBy,
        reason: reason,
        timestamp: new Date()
      });
    }
    
    // Si plus de propositions, retourner au statut pending
    const pendingNegotiations = await RideNegotiation.count({
      where: {
        ride_id: rideId,
        status: 'pending'
      }
    });
    
    if (pendingNegotiations === 0) {
      await ride.update({ status: 'pending' });
    }
    
    return { success: true };
  }

  /**
   * Obtenir l'historique des négociations d'une course
   * @param {string} rideId - ID de la course
   * @returns {Promise<Array>}
   */
  async getNegotiationHistory(rideId) {
    const negotiations = await RideNegotiation.findAll({
      where: { ride_id: rideId },
      order: [['created_at', 'ASC']]
    });
    
    return negotiations;
  }
}

module.exports = new NegotiationService();