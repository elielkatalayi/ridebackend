const NotificationService = require('../services/notification/NotificationService');
const PreferenceService = require('../services/notification/PreferenceService');

class NotificationController {
  
  // ==================== NOTIFICATIONS ====================
  
  async getNotifications(req, res, next) {
    try {
      const userId = req.user.id;
      const { limit = 50, offset = 0, status, type, startDate, endDate } = req.query;
      
      const result = await NotificationService.getUserNotifications(userId, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        status,
        type,
        startDate,
        endDate
      });
      
      res.json({
        success: true,
        data: result.notifications,
        pagination: {
          total: result.total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: result.hasMore
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  async getUnreadNotifications(req, res, next) {
    try {
      const userId = req.user.id;
      const { limit = 20 } = req.query;
      
      const notifications = await NotificationService.getUnreadNotifications(userId, parseInt(limit));
      
      res.json({
        success: true,
        data: notifications,
        count: notifications.length
      });
    } catch (error) {
      next(error);
    }
  }
  
  async getNotificationById(req, res, next) {
    try {
      const userId = req.user.id;
      const { notificationId } = req.params;
      
      const notification = await NotificationService.getNotificationById(notificationId, userId);
      
      if (!notification) {
        return res.status(404).json({ success: false, message: 'Notification non trouvée' });
      }
      
      res.json({ success: true, data: notification });
    } catch (error) {
      next(error);
    }
  }
  
  async markAsRead(req, res, next) {
    try {
      const userId = req.user.id;
      const { notificationId } = req.params;
      
      await NotificationService.markAsRead(notificationId, userId);
      
      res.json({ success: true, message: 'Notification marquée comme lue' });
    } catch (error) {
      next(error);
    }
  }
  
  async markAllAsRead(req, res, next) {
    try {
      const userId = req.user.id;
      const count = await NotificationService.markAllAsRead(userId);
      
      res.json({ 
        success: true, 
        message: `${count} notification(s) marquée(s) comme lue(s)`,
        count
      });
    } catch (error) {
      next(error);
    }
  }
  
  async deleteNotification(req, res, next) {
    try {
      const userId = req.user.id;
      const { notificationId } = req.params;
      
      const deleted = await NotificationService.deleteNotification(notificationId, userId);
      
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Notification non trouvée' });
      }
      
      res.json({ success: true, message: 'Notification supprimée' });
    } catch (error) {
      next(error);
    }
  }
  
  async deleteAllNotifications(req, res, next) {
    try {
      const userId = req.user.id;
      const count = await NotificationService.deleteAllNotifications(userId);
      
      res.json({ 
        success: true, 
        message: `${count} notification(s) supprimée(s)`,
        count
      });
    } catch (error) {
      next(error);
    }
  }
  
  async getUnreadCount(req, res, next) {
    try {
      const userId = req.user.id;
      const count = await NotificationService.getUnreadCount(userId);
      
      res.json({ success: true, count });
    } catch (error) {
      next(error);
    }
  }
  
  // ==================== PRÉFÉRENCES ====================
  
  async getPreferences(req, res, next) {
    try {
      const userId = req.user.id;
      const preferences = await NotificationService.getUserPreferences(userId);
      
      res.json({ success: true, data: preferences });
    } catch (error) {
      next(error);
    }
  }
  
  async updatePreferences(req, res, next) {
    try {
      const userId = req.user.id;
      const updates = req.body;
      
      const preferences = await NotificationService.updateUserPreferences(userId, updates);
      
      res.json({ success: true, data: preferences });
    } catch (error) {
      next(error);
    }
  }
  
  async resetPreferences(req, res, next) {
    try {
      const userId = req.user.id;
      const preferences = await NotificationService.resetUserPreferences(userId);
      
      res.json({ success: true, data: preferences, message: 'Préférences réinitialisées' });
    } catch (error) {
      next(error);
    }
  }
  
  // ==================== APPAREILS ====================
  
  async registerDevice(req, res, next) {
    try {
      const userId = req.user.id;
      const deviceData = req.body;
      
      const device = await NotificationService.registerDevice(userId, deviceData);
      
      res.json({ success: true, data: device });
    } catch (error) {
      next(error);
    }
  }
  
  async unregisterDevice(req, res, next) {
    try {
      const userId = req.user.id;
      const { device_token } = req.body;
      
      const device = await NotificationService.unregisterDevice(userId, device_token);
      
      res.json({ success: true, message: 'Appareil désenregistré', data: device });
    } catch (error) {
      next(error);
    }
  }
  
  async getUserDevices(req, res, next) {
    try {
      const userId = req.user.id;
      const devices = await NotificationService.getUserDevices(userId);
      
      res.json({ success: true, data: devices });
    } catch (error) {
      next(error);
    }
  }
  
  // ==================== STATISTIQUES ====================
  
  async getStats(req, res, next) {
    try {
      const userId = req.user.id;
      const { days = 30 } = req.query;
      
      const stats = await NotificationService.getNotificationStats(userId, parseInt(days));
      
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
  
  // ==================== TEST ====================
  
  async testNotification(req, res, next) {
    try {
      const userId = req.user.id;
      const { type = 'system', message = 'Ceci est un test' } = req.body;
      
      let result;
      
      switch (type) {
        case 'ride':
          result = await NotificationService.sendRideNotification(userId, 'test-ride-id', 'driver_found', {
            driver_name: 'Test Driver',
            eta: 5
          });
          break;
        case 'chat':
          result = await NotificationService.sendChatMessage(
            userId, 'test-msg-id', 'test-chat-id', 'private', 
            'Test User', 'test-user-id', message, false
          );
          break;
        case 'social':
          result = await NotificationService.sendSocialNotification(
            userId, 'test-post-id', 'like', 'test-user-id', 'Test User', null, message
          );
          break;
        default:
          result = await NotificationService.sendSystemNotification(userId, 'Test', message);
      }
      
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new NotificationController();