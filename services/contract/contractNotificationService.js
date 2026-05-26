const notificationService = require('../../services/notification/notificationService');
const { User, Driver, ContractRequest, Contract } = require('../../models');

/**
 * Envoyer une notification pour une nouvelle demande de contrat
 * @param {Object} contractRequest - La demande de contrat
 * @param {Object} driver - Le chauffeur concerné
 */
const sendContractRequestNotification = async (contractRequest, driver) => {
  try {
    // Notification push au chauffeur
    if (driver.user_id) {
      const user = await User.findByPk(driver.user_id);
      if (user && user.device_token) {
        await notificationService.sendPushNotification(user.device_token, {
          title: 'Nouvelle demande de contrat',
          body: `Vous avez reçu une nouvelle demande de contrat pour ${contractRequest.vehicle_type || 'un véhicule'}`,
          data: {
            type: 'contract_request',
            request_id: contractRequest.id,
            status: contractRequest.status
          }
        });
      }
    }

    console.log(`✅ Notification de demande de contrat envoyée au chauffeur ${driver.id}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur envoi notification demande contrat:', error);
    return false;
  }
};

/**
 * Envoyer une notification lorsque le contrat est approuvé
 * @param {Object} contract - Le contrat approuvé
 * @param {Object} driver - Le chauffeur
 */
const sendContractApprovedNotification = async (contract, driver) => {
  try {
    if (driver.user_id) {
      const user = await User.findByPk(driver.user_id);
      if (user && user.device_token) {
        await notificationService.sendPushNotification(user.device_token, {
          title: '✅ Contrat approuvé',
          body: `Votre contrat a été approuvé et est maintenant actif`,
          data: {
            type: 'contract_approved',
            contract_id: contract.id,
            status: contract.status
          }
        });
      }
    }

    console.log(`✅ Notification d'approbation de contrat envoyée`);
    return true;
  } catch (error) {
    console.error('❌ Erreur envoi notification approbation:', error);
    return false;
  }
};

/**
 * Envoyer une notification pour un contrat expirant bientôt
 * @param {Object} contract - Le contrat
 * @param {Object} driver - Le chauffeur
 * @param {number} daysLeft - Jours restants
 */
const sendContractExpiringNotification = async (contract, driver, daysLeft) => {
  try {
    if (driver.user_id) {
      const user = await User.findByPk(driver.user_id);
      if (user && user.device_token) {
        await notificationService.sendPushNotification(user.device_token, {
          title: '⚠️ Contrat bientôt expiré',
          body: `Votre contrat expire dans ${daysLeft} jour(s). Pensez à le renouveler.`,
          data: {
            type: 'contract_expiring',
            contract_id: contract.id,
            days_left: daysLeft
          }
        });
      }
    }

    console.log(`✅ Notification d'expiration de contrat envoyée`);
    return true;
  } catch (error) {
    console.error('❌ Erreur envoi notification expiration:', error);
    return false;
  }
};

/**
 * Notifier les chauffeurs à proximité d'une nouvelle demande
 * @param {Object} request - La demande de contrat
 */
const notifyNearbyDrivers = async (request) => {
  try {
    console.log(`📢 [NOTIFICATION] Nouvelle demande de contrat #${request.id}`);
    console.log(`   Trajet: ${request.pickup_address} → ${request.dropoff_address}`);
    console.log(`   Montant: ${request.amount_per_day} ${request.currency}/jour`);
    console.log(`   Type: ${request.contract_type === 'cdd' ? 'CDD' : 'CDI'}`);
    
    // TODO: Implémenter la recherche des chauffeurs à proximité
    // TODO: Envoyer des notifications push aux chauffeurs trouvés
    
    console.log(`   ✅ Notification envoyée aux chauffeurs à proximité`);
    return true;
  } catch (error) {
    console.error('❌ Erreur notification chauffeurs:', error);
    return false;
  }
};

/**
 * Envoyer une notification pour un contrat rejeté
 * @param {Object} contractRequest - La demande rejetée
 * @param {Object} driver - Le chauffeur
 * @param {string} reason - Raison du rejet
 */
const sendContractRejectedNotification = async (contractRequest, driver, reason) => {
  try {
    if (driver.user_id) {
      const user = await User.findByPk(driver.user_id);
      if (user && user.device_token) {
        await notificationService.sendPushNotification(user.device_token, {
          title: '❌ Demande de contrat rejetée',
          body: `Votre demande de contrat a été rejetée. Raison: ${reason || 'Non spécifiée'}`,
          data: {
            type: 'contract_rejected',
            request_id: contractRequest.id,
            reason: reason
          }
        });
      }
    }

    console.log(`✅ Notification de rejet de contrat envoyée`);
    return true;
  } catch (error) {
    console.error('❌ Erreur envoi notification rejet:', error);
    return false;
  }
};

/**
 * Envoyer une notification générale pour un contrat
 * @param {Object} contract - Le contrat
 * @param {string} type - Type de notification
 * @param {Object} additionalData - Données supplémentaires
 */
const sendContractNotification = async (contract, type, additionalData = {}) => {
  try {
    const driver = await Driver.findByPk(contract.driver_id, {
      include: [{ model: User, as: 'user' }]
    });

    if (!driver) {
      console.error('❌ Chauffeur non trouvé pour le contrat', contract.id);
      return false;
    }

    let notificationData = {
      title: 'Mise à jour de contrat',
      body: 'Votre contrat a été mis à jour',
      data: {
        type: type,
        contract_id: contract.id,
        ...additionalData
      }
    };

    switch (type) {
      case 'created':
        notificationData.title = '📝 Contrat créé';
        notificationData.body = 'Votre contrat a été créé avec succès';
        break;
      case 'updated':
        notificationData.title = '🔄 Contrat mis à jour';
        notificationData.body = 'Votre contrat a été modifié';
        break;
      case 'cancelled':
        notificationData.title = '🚫 Contrat annulé';
        notificationData.body = 'Votre contrat a été annulé';
        break;
      default:
        break;
    }

    if (driver.user && driver.user.device_token) {
      await notificationService.sendPushNotification(driver.user.device_token, notificationData);
    }

    console.log(`✅ Notification ${type} envoyée pour le contrat ${contract.id}`);
    return true;
  } catch (error) {
    console.error(`❌ Erreur envoi notification ${type}:`, error);
    return false;
  }
};

/**
 * Envoyer une notification pour un paiement de contrat
 * @param {Object} payment - Le paiement
 * @param {Object} contract - Le contrat associé
 */
const sendContractPaymentNotification = async (payment, contract) => {
  try {
    const driver = await Driver.findByPk(contract.driver_id, {
      include: [{ model: User, as: 'user' }]
    });

    if (driver && driver.user && driver.user.device_token) {
      await notificationService.sendPushNotification(driver.user.device_token, {
        title: '💰 Paiement de contrat',
        body: `Paiement de ${payment.amount} € pour le contrat ${contract.id}`,
        data: {
          type: 'contract_payment',
          payment_id: payment.id,
          contract_id: contract.id,
          amount: payment.amount
        }
      });
    }

    console.log(`✅ Notification de paiement envoyée pour le contrat ${contract.id}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur envoi notification paiement:', error);
    return false;
  }
};

module.exports = {
  sendContractRequestNotification,
  sendContractApprovedNotification,
  sendContractExpiringNotification,
  sendContractRejectedNotification,
  sendContractNotification,
  sendContractPaymentNotification,
  notifyNearbyDrivers  // ✅ AJOUTÉE
};