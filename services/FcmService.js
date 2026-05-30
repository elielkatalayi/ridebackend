// backend/services/FcmService.js
const { messaging, isInitialized } = require('../config/firebase');
const DeviceToken = require('../models/DeviceToken');
const Notification = require('../models/Notification');

class FcmService {
  
  /**
   * Vérifie si Firebase est initialisé
   */
  isReady() {
    if (!isInitialized || !messaging) {
      console.error('❌ Firebase Messaging non initialisé');
      return false;
    }
    return true;
  }

  /**
   * Envoie une notification à un utilisateur spécifique
   */
  async sendToUser(userId, notification, data = {}, saveHistory = true) {
    if (!this.isReady()) {
      return { success: false, reason: 'fcm_not_initialized' };
    }

    try {
      const tokens = await DeviceToken.findAll({
        where: { user_id: userId, is_active: true }
      });
      
      if (tokens.length === 0) {
        console.log(`⚠️ Aucun token FCM pour l'utilisateur ${userId}`);
        return { success: false, reason: 'no_tokens' };
      }
      
      const tokenList = tokens.map(t => t.token);
      
      const message = {
        notification: {
          title: notification.title,
          body: notification.body,
          ...(notification.image && { image: notification.image })
        },
        data: {
          ...data,
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          timestamp: Date.now().toString()
        },
        tokens: tokenList
      };
      
      const response = await messaging.sendEachForMulticast(message);
      
      // Gérer les tokens invalides
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.log(`❌ Token invalide pour l'utilisateur ${userId}: ${tokenList[idx]}`);
            DeviceToken.update(
              { is_active: false }, 
              { where: { token: tokenList[idx] } }
            );
          }
        });
      }
      
      // Sauvegarder l'historique
      if (saveHistory && response.successCount > 0) {
        await Notification.create({
          user_id: userId,
          type: data.type || 'unknown',
          title: notification.title,
          body: notification.body,
          data: data,
          related_id: data.post_id || data.story_id || data.chat_id,
          is_delivered: response.successCount > 0,
          delivered_at: response.successCount > 0 ? new Date() : null
        });
      }
      
      console.log(`✅ Notification envoyée à ${userId}: ${response.successCount} succès / ${response.failureCount} échecs`);
      return { success: true, successCount: response.successCount, failureCount: response.failureCount };
      
    } catch (error) {
      console.error('❌ Erreur sendToUser:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Envoie une notification à plusieurs utilisateurs
   */
  async sendToMultipleUsers(userIds, notification, data = {}, saveHistory = true) {
    if (!this.isReady()) {
      return { success: false, reason: 'fcm_not_initialized' };
    }

    try {
      const tokens = await DeviceToken.findAll({
        where: { user_id: userIds, is_active: true }
      });
      
      const tokenList = tokens.map(t => t.token);
      
      if (tokenList.length === 0) {
        return { success: false, reason: 'no_tokens' };
      }
      
      const message = {
        notification: {
          title: notification.title,
          body: notification.body,
          ...(notification.image && { image: notification.image })
        },
        data: { 
          ...data, 
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          timestamp: Date.now().toString()
        },
        tokens: tokenList
      };
      
      const response = await messaging.sendEachForMulticast(message);
      
      console.log(`✅ Notification envoyée à ${tokenList.length} devices`);
      return { success: true, successCount: response.successCount, failureCount: response.failureCount };
      
    } catch (error) {
      console.error('❌ Erreur sendToMultipleUsers:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Envoie une notification à un topic (groupe d'utilisateurs)
   */
  async sendToTopic(topic, notification, data = {}) {
    if (!this.isReady()) {
      return { success: false, reason: 'fcm_not_initialized' };
    }

    try {
      const message = {
        notification: {
          title: notification.title,
          body: notification.body,
          ...(notification.image && { image: notification.image })
        },
        data: { 
          ...data, 
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          timestamp: Date.now().toString()
        },
        topic: topic
      };
      
      const response = await messaging.send(message);
      console.log(`✅ Notification envoyée au topic ${topic}`);
      return { success: true, response };
      
    } catch (error) {
      console.error(`❌ Erreur sendToTopic ${topic}:`, error.message);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Enregistre/met à jour un token
   */
  async registerToken(userId, token, deviceType, deviceName, appVersion) {
    try {
      // Supprimer l'ancien token identique
      await DeviceToken.destroy({ where: { token } });
      
      // Créer le nouveau
      const deviceToken = await DeviceToken.create({
        user_id: userId,
        token,
        device_type: deviceType,
        device_name: deviceName,
        app_version: appVersion,
        last_used_at: new Date(),
        is_active: true
      });
      
      console.log(`✅ Token enregistré pour l'utilisateur ${userId} (${deviceType})`);
      return { success: true, deviceToken };
      
    } catch (error) {
      console.error('❌ Erreur registerToken:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Désactive un token (déconnexion)
   */
  async unregisterToken(token) {
    try {
      await DeviceToken.update(
        { is_active: false },
        { where: { token } }
      );
      console.log(`✅ Token désactivé`);
      return { success: true };
    } catch (error) {
      console.error('❌ Erreur unregisterToken:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Supprime complètement un token
   */
  async deleteToken(token) {
    try {
      await DeviceToken.destroy({ where: { token } });
      console.log(`✅ Token supprimé`);
      return { success: true };
    } catch (error) {
      console.error('❌ Erreur deleteToken:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Abonne un token à un topic
   */
  async subscribeToTopic(token, topic) {
    if (!this.isReady()) return { success: false };
    
    try {
      await messaging.subscribeToTopic(token, topic);
      console.log(`✅ Token abonné au topic ${topic}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Erreur subscribeToTopic:`, error.message);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Désabonne un token d'un topic
   */
  async unsubscribeFromTopic(token, topic) {
    if (!this.isReady()) return { success: false };
    
    try {
      await messaging.unsubscribeFromTopic(token, topic);
      console.log(`✅ Token désabonné du topic ${topic}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Erreur unsubscribeFromTopic:`, error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new FcmService();