// services/pushNotificationService.js
require('dotenv').config();

const admin = require('firebase-admin');

// Configuration Firebase depuis .env
const FCM_PROJECT_ID = process.env.FCM_PROJECT_ID;
const FCM_CLIENT_EMAIL = process.env.FCM_CLIENT_EMAIL;
const FCM_PRIVATE_KEY = process.env.FCM_PRIVATE_KEY;

class PushNotificationService {
  constructor() {
    this.isConfigured = false;
    this.fcm = null;
    this.initialize();
  }

  initialize() {
    if (this.isConfigured) return;
    
    if (!FCM_PROJECT_ID || !FCM_CLIENT_EMAIL || !FCM_PRIVATE_KEY) {
      console.warn('⚠️ FCM non configuré - les push notifications seront désactivées');
      return;
    }
    
    try {
      // Nettoyer la clé privée (remplacer \n par des vrais sauts de ligne)
      const privateKey = FCM_PRIVATE_KEY.replace(/\\n/g, '\n');
      
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: FCM_PROJECT_ID,
          clientEmail: FCM_CLIENT_EMAIL,
          privateKey: privateKey
        })
      });
      
      this.fcm = admin.messaging();
      this.isConfigured = true;
      console.log('✅ Firebase Admin SDK initialisé avec succès');
      console.log(`📱 Projet FCM: ${FCM_PROJECT_ID}`);
    } catch (error) {
      console.error('❌ Erreur initialisation Firebase:', error.message);
      this.isConfigured = false;
    }
  }

  /**
   * Envoyer une notification à un utilisateur
   * @param {string} deviceToken - Token FCM de l'appareil
   * @param {string} title - Titre de la notification
   * @param {string} body - Corps de la notification
   * @param {Object} data - Données supplémentaires
   * @returns {Promise<Object>}
   */
  async sendNotification(deviceToken, title, body, data = {}) {
    if (!this.isConfigured || !this.fcm) {
      console.log(`[PUSH SIMULATION] À ${deviceToken}: ${title} - ${body}`);
      return { success: true, simulated: true };
    }
    
    try {
      const message = {
        token: deviceToken,
        notification: { 
          title: title.substring(0, 100), // Limite FCM
          body: body.substring(0, 200)
        },
        data: {
          ...data,
          timestamp: new Date().toISOString()
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'medibe_notifications',
            priority: 'max'
          }
        },
        apns: {
          payload: {
            aps: { 
              sound: 'default',
              'content-available': 1
            }
          }
        }
      };
      
      const response = await this.fcm.send(message);
      console.log(`✅ Notification envoyée à ${deviceToken.substring(0, 10)}...`);
      return { success: true, messageId: response };
    } catch (error) {
      console.error('❌ Erreur envoi notification push:', error.message);
      
      // Gestion des erreurs spécifiques FCM
      if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
        console.warn(`⚠️ Token invalide: ${deviceToken.substring(0, 10)}...`);
        return { success: false, error: error.message, invalidToken: true };
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Envoyer une notification à plusieurs appareils
   * @param {string[]} deviceTokens - Liste des tokens FCM
   * @param {string} title - Titre de la notification
   * @param {string} body - Corps de la notification
   * @param {Object} data - Données supplémentaires
   * @returns {Promise<Object>}
   */
  async sendMulticast(deviceTokens, title, body, data = {}) {
    if (!this.isConfigured || !this.fcm) {
      console.log(`[PUSH SIMULATION MULTICAST] À ${deviceTokens.length} appareils: ${title}`);
      return { success: true, simulated: true, sent: deviceTokens.length };
    }
    
    if (!deviceTokens || deviceTokens.length === 0) {
      return { success: false, error: 'Aucun token fourni', sent: 0 };
    }
    
    try {
      const message = {
        tokens: deviceTokens,
        notification: { title, body },
        data: {
          ...data,
          timestamp: new Date().toISOString()
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'medibe_notifications'
          }
        }
      };
      
      const response = await this.fcm.sendEachForMulticast(message);
      
      const successCount = response.responses.filter(r => r.success).length;
      const failureCount = response.responses.filter(r => !r.success).length;
      
      console.log(`✅ Multicast: ${successCount}/${deviceTokens.length} succès`);
      
      return {
        success: true,
        sent: successCount,
        failed: failureCount,
        responses: response.responses
      };
    } catch (error) {
      console.error('❌ Erreur envoi multicast:', error.message);
      return { success: false, error: error.message, sent: 0 };
    }
  }

  /**
   * Notifier un passager d'une nouvelle course assignée
   * @param {string} deviceToken - Token du passager
   * @param {Object} ride - Données de la course
   * @param {Object} driver - Données du chauffeur
   */
  async notifyRideAccepted(deviceToken, ride, driver) {
    return this.sendNotification(
      deviceToken,
      '✅ Course confirmée !',
      `${driver.user?.first_name || 'Chauffeur'} ${driver.user?.last_name || ''} arrive dans ${driver.eta || 5} minutes`,
      {
        type: 'ride_accepted',
        ride_id: String(ride.id),
        driver_id: String(driver.id),
        driver_name: `${driver.user?.first_name || ''} ${driver.user?.last_name || ''}`,
        driver_plate: driver.vehicle_plate || '',
        driver_photo: driver.portrait_photo_url || '',
        eta: String(driver.eta || 5)
      }
    );
  }

  /**
   * Notifier un chauffeur d'une nouvelle demande de course
   * @param {string} deviceToken - Token du chauffeur
   * @param {Object} ride - Données de la course
   * @param {Object} passenger - Données du passager
   */
  async notifyNewRideRequest(deviceToken, ride, passenger) {
    return this.sendNotification(
      deviceToken,
      '🚗 Nouvelle demande de course',
      `${passenger.first_name || 'Passager'} ${passenger.last_name || ''} - ${ride.price_suggested || 0} FC`,
      {
        type: 'new_ride_request',
        ride_id: String(ride.id),
        passenger_name: `${passenger.first_name || ''} ${passenger.last_name || ''}`,
        passenger_id: String(passenger.id),
        price: String(ride.price_suggested || 0),
        origin_lat: String(ride.origin_lat || ''),
        origin_lng: String(ride.origin_lng || ''),
        destination_lat: String(ride.destination_lat || ''),
        destination_lng: String(ride.destination_lng || ''),
        origin_address: ride.origin_address || '',
        destination_address: ride.destination_address || ''
      }
    );
  }

  /**
   * Notifier un passager que le chauffeur est arrivé
   * @param {string} deviceToken - Token du passager
   * @param {Object} driver - Données du chauffeur
   */
  async notifyDriverArrived(deviceToken, driver) {
    return this.sendNotification(
      deviceToken,
      '📍 Votre chauffeur est arrivé',
      `${driver.user?.first_name || 'Chauffeur'} ${driver.user?.last_name || ''} vous attend`,
      {
        type: 'driver_arrived',
        driver_id: String(driver.id),
        driver_name: `${driver.user?.first_name || ''} ${driver.user?.last_name || ''}`,
        driver_phone: driver.user?.phone || '',
        vehicle_plate: driver.vehicle_plate || ''
      }
    );
  }

  /**
   * Notifier un passager d'une contre-offre de prix
   * @param {string} deviceToken - Token du passager
   * @param {number} proposedPrice - Prix proposé par le chauffeur
   * @param {Object} driver - Données du chauffeur
   */
  async notifyPriceCounterOffer(deviceToken, proposedPrice, driver) {
    return this.sendNotification(
      deviceToken,
      '💰 Contre-offre reçue',
      `${driver.user?.first_name || 'Chauffeur'} propose ${proposedPrice} FC pour la course`,
      {
        type: 'price_counter_offer',
        proposed_price: String(proposedPrice),
        driver_id: String(driver.id),
        driver_name: `${driver.user?.first_name || ''} ${driver.user?.last_name || ''}`
      }
    );
  }

  /**
   * Notifier un chauffeur d'une nouvelle offre du passager
   * @param {string} deviceToken - Token du chauffeur
   * @param {number} proposedPrice - Prix proposé par le passager
   * @param {Object} passenger - Données du passager
   */
  async notifyPassengerOffer(deviceToken, proposedPrice, passenger) {
    return this.sendNotification(
      deviceToken,
      '💬 Nouvelle offre du passager',
      `${passenger?.first_name || 'Passager'} propose ${proposedPrice} FC pour la course`,
      {
        type: 'passenger_offer',
        proposed_price: String(proposedPrice),
        passenger_id: String(passenger?.id || ''),
        passenger_name: `${passenger?.first_name || ''} ${passenger?.last_name || ''}`
      }
    );
  }

  /**
   * Notifier un passager que sa course a été annulée
   * @param {string} deviceToken - Token du passager
   * @param {string} reason - Raison de l'annulation
   * @param {Object} additionalData - Données supplémentaires
   */
  async notifyRideCancelled(deviceToken, reason, additionalData = {}) {
    return this.sendNotification(
      deviceToken,
      '❌ Course annulée',
      reason || 'Le chauffeur a annulé la course',
      {
        type: 'ride_cancelled',
        reason: reason || '',
        ...additionalData
      }
    );
  }

  /**
   * Notifier un chauffeur qu'il a été suspendu
   * @param {string} deviceToken - Token du chauffeur
   * @param {string} reason - Raison de la suspension
   * @param {number} days - Nombre de jours
   */
  async notifyDriverSuspended(deviceToken, reason, days) {
    return this.sendNotification(
      deviceToken,
      '⚠️ Compte suspendu',
      `Votre compte est suspendu pour ${days} jours: ${reason}`,
      {
        type: 'driver_suspended',
        reason: reason,
        days: String(days),
        suspension_end: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      }
    );
  }

  /**
   * Notifier un passager du début de course
   * @param {string} deviceToken - Token du passager
   * @param {Object} ride - Données de la course
   */
  async notifyRideStarted(deviceToken, ride) {
    return this.sendNotification(
      deviceToken,
      '🚀 Course en cours',
      `Votre course a commencé, bon voyage !`,
      {
        type: 'ride_started',
        ride_id: String(ride.id),
        start_time: new Date().toISOString()
      }
    );
  }

  /**
   * Notifier un passager de la fin de course
   * @param {string} deviceToken - Token du passager
   * @param {Object} ride - Données de la course
   * @param {number} finalPrice - Prix final
   */
  async notifyRideCompleted(deviceToken, ride, finalPrice) {
    return this.sendNotification(
      deviceToken,
      '🏁 Course terminée',
      `Merci d'avoir voyagé avec nous ! Total: ${finalPrice} FC`,
      {
        type: 'ride_completed',
        ride_id: String(ride.id),
        final_price: String(finalPrice),
        end_time: new Date().toISOString()
      }
    );
  }

  /**
   * Vérifier l'état de la configuration
   */
  isReady() {
    return this.isConfigured && this.fcm !== null;
  }

  /**
   * Obtenir les informations de configuration
   */
  getConfigStatus() {
    return {
      configured: this.isConfigured,
      projectId: FCM_PROJECT_ID || 'non défini',
      clientEmail: FCM_CLIENT_EMAIL ? 'défini' : 'non défini',
      privateKey: FCM_PRIVATE_KEY ? 'défini' : 'non défini'
    };
  }
}

// Exporter une instance unique
const pushService = new PushNotificationService();

module.exports = pushService;