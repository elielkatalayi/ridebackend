const { Notification, NotificationLog } = require('../../models');
const { sequelize } = require('../../config/database');
const TemplateService = require('./TemplateService');
const DispatcherService = require('./DispatcherService');
const PreferenceService = require('./PreferenceService');
const PushService = require('./pushService');
const SocketService = require('./SocketService');
const BatchService = require('./BatchService');

class NotificationService {
  
  // ==================== MÉTHODE PRINCIPALE ====================
  
  async send(options) {
    const {
      userId,
      type,
      subtype,
      title,
      body,
      data = {},
      referenceId = null,
      referenceType = null,
      actorId = null,
      actorName = null,
      actorAvatar = null,
      mediaPreview = null,
      priority = 'normal',
      useTemplate = true,
      templateData = {},
      expiresAt = null
    } = options;
    
    let notificationData = {
      user_id: userId,
      type,
      subtype,
      priority,
      data,
      reference_id: referenceId,
      reference_type: referenceType,
      actor_id: actorId,
      actor_name: actorName,
      actor_avatar: actorAvatar,
      media_preview: mediaPreview,
      expires_at: expiresAt
    };
    
    // Utiliser template si demandé
    if (useTemplate) {
      const templateNotif = await TemplateService.createNotificationFromTemplate(
        type, subtype, {
          ...templateData,
          payload: data,
          reference_id: referenceId,
          reference_type: referenceType,
          actor_name: actorName,
          actor_avatar: actorAvatar,
          media_preview: mediaPreview,
          priority,
          expires_at: expiresAt
        }, userId, actorId
      );
      
      if (templateNotif) {
        notificationData = { ...notificationData, ...templateNotif };
      }
    } else {
      notificationData.title = title;
      notificationData.body = body;
    }
    
    // Créer la notification en BDD
    const notification = await Notification.create(notificationData);
    
    // Dispatcher
    const result = await DispatcherService.dispatch(notification);
    
    return { notification, result };
  }
  
  // ==================== NOTIFICATIONS DE COURSE ====================
  
  async sendRideNotification(userId, rideId, event, data = {}) {
    const templates = {
      'driver_found': { type: 'ride', subtype: 'ride_accepted', priority: 'high' },
      'driver_arrived': { type: 'ride', subtype: 'ride_arrived', priority: 'high' },
      'ride_started': { type: 'ride', subtype: 'ride_started', priority: 'normal' },
      'ride_completed': { type: 'ride', subtype: 'ride_completed', priority: 'normal' },
      'ride_cancelled': { type: 'ride', subtype: 'ride_cancelled', priority: 'normal' },
      'new_ride_request': { type: 'ride', subtype: 'ride_request', priority: 'high' },
      'ride_negotiation': { type: 'ride', subtype: 'ride_negotiation', priority: 'normal' },
      'driver_waiting': { type: 'ride', subtype: 'driver_waiting', priority: 'normal' }
    };
    
    const template = templates[event];
    if (!template) {
      return this.sendCustomRideNotification(userId, rideId, event, data);
    }
    
    return this.send({
      userId,
      type: template.type,
      subtype: template.subtype,
      priority: template.priority,
      referenceId: rideId,
      referenceType: 'ride',
      useTemplate: true,
      templateData: {
        ride_id: rideId,
        ...data
      },
      data: { rideId, event, ...data }
    });
  }
  
  async sendCustomRideNotification(userId, rideId, event, data) {
    const titles = {
      'driver_assigned': 'Chauffeur assigné',
      'driver_cancelled': 'Chauffeur annulé',
      'searching_driver': 'Recherche de chauffeur en cours',
      'price_updated': 'Prix mis à jour'
    };
    
    const bodies = {
      'driver_assigned': `Un chauffeur a été assigné à votre course`,
      'driver_cancelled': `Le chauffeur a annulé la course, recherche d'un nouveau chauffeur`,
      'searching_driver': `Nous recherchons un chauffeur près de chez vous`,
      'price_updated': `Le prix de la course a été mis à jour`
    };
    
    return this.send({
      userId,
      type: 'ride',
      subtype: event,
      priority: 'normal',
      title: titles[event] || 'Mise à jour de la course',
      body: bodies[event] || data.message || '',
      referenceId: rideId,
      referenceType: 'ride',
      useTemplate: false,
      data: { rideId, event, ...data }
    });
  }
  
  // ==================== NOTIFICATIONS DE CHAT ====================
  
  async sendChatMessage(userId, messageId, chatId, chatType, senderName, senderId, messagePreview, isMention = false, groupName = null) {
    const type = chatType === 'private' ? 'chat_private' : 'chat_group';
    const subtype = isMention ? 'group_mention' : (chatType === 'private' ? 'private_message' : 'group_message');
    const priority = isMention ? 'high' : 'normal';
    
    return this.send({
      userId,
      type,
      subtype,
      priority,
      referenceId: messageId,
      referenceType: 'message',
      actorId: senderId,
      actorName: senderName,
      useTemplate: true,
      templateData: {
        actor_name: senderName,
        message_preview: messagePreview.substring(0, 100),
        group_name: groupName || chatId
      },
      data: { 
        messageId, 
        chatId, 
        chatType, 
        messagePreview: messagePreview.substring(0, 100), 
        isMention,
        groupName,
        senderId
      }
    });
  }
  
  async sendTypingIndicator(userId, chatId, chatType, senderName, isTyping) {
    // Envoi direct via socket sans persistance
    const roomName = chatType === 'private' ? `chat:${chatId}` : `group:${chatId}`;
    SocketService.sendToRoom(roomName, 'chat:typing', {
      userId,
      senderName,
      isTyping,
      chatId,
      timestamp: new Date()
    });
  }
  
  async sendMessageReadReceipt(userId, messageId, senderId, chatId, chatType) {
    SocketService.sendToUser(senderId, 'chat:read', {
      messageId,
      userId,
      chatId,
      readAt: new Date()
    });
  }
  
  // ==================== NOTIFICATIONS SOCIALES ====================
  
  async sendSocialNotification(userId, postId, event, actorId, actorName, actorAvatar = null, preview = null, commentId = null) {
    const templates = {
      'like': { type: 'social_like', subtype: 'post_like', priority: 'low' },
      'comment': { type: 'social_comment', subtype: 'post_comment', priority: 'normal' },
      'reply': { type: 'social_reply', subtype: 'comment_reply', priority: 'normal' },
      'mention': { type: 'social_mention', subtype: 'comment_mention', priority: 'high' },
      'follow': { type: 'social_follow', subtype: 'new_follower', priority: 'normal' },
      'share': { type: 'social_post', subtype: 'post_share', priority: 'low' }
    };
    
    const template = templates[event];
    if (!template) return null;
    
    return this.send({
      userId,
      type: template.type,
      subtype: template.subtype,
      priority: template.priority,
      referenceId: commentId || postId,
      referenceType: commentId ? 'comment' : 'post',
      actorId,
      actorName,
      actorAvatar,
      useTemplate: true,
      templateData: {
        actor_name: actorName,
        comment_preview: preview ? preview.substring(0, 100) : null,
        post_preview: preview ? preview.substring(0, 100) : null,
        like_count: 1
      },
      mediaPreview: null,
      data: { 
        postId, 
        event, 
        actorName,
        actorId,
        commentId,
        preview: preview ? preview.substring(0, 100) : null
      }
    });
  }
  
  async sendBulkSocialNotification(userIds, postId, event, actorId, actorName, preview = null) {
    const results = [];
    for (const userId of userIds) {
      const result = await this.sendSocialNotification(userId, postId, event, actorId, actorName, null, preview);
      results.push(result);
    }
    return results;
  }
  
  // ==================== NOTIFICATIONS STORIES ====================
  
  async sendStoryNotification(userId, storyId, event, actorId, actorName, actorAvatar = null, mediaType = 'photo', expiresIn = '24h', commentId = null) {
    const templates = {
      'published': { type: 'story', subtype: 'story_published', priority: 'low' },
      'viewed': { type: 'story', subtype: 'story_viewed', priority: 'low' },
      'comment': { type: 'story', subtype: 'story_comment', priority: 'normal' },
      'reply': { type: 'story', subtype: 'story_reply', priority: 'normal' },
      'mention': { type: 'story', subtype: 'story_mention', priority: 'high' },
      'reaction': { type: 'story', subtype: 'story_reaction', priority: 'low' },
      'highlighted': { type: 'story', subtype: 'story_highlighted', priority: 'low' }
    };
    
    const template = templates[event];
    if (!template) return null;
    
    return this.send({
      userId,
      type: template.type,
      subtype: template.subtype,
      priority: template.priority,
      referenceId: commentId || storyId,
      referenceType: commentId ? 'story_comment' : 'story',
      actorId,
      actorName,
      actorAvatar,
      useTemplate: true,
      templateData: {
        actor_name: actorName,
        media_type: mediaType,
        expires_in: expiresIn,
        reaction_emoji: '❤️',
        reaction_text: 'like',
        comment_preview: null
      },
      data: { 
        storyId, 
        event, 
        actorName,
        actorId,
        commentId,
        mediaType,
        expiresIn
      }
    });
  }
  
  async sendStoryViewBatch(userId, storyId, viewCount, viewers = []) {
    // Notification groupée pour les vues multiples
    return this.send({
      userId,
      type: 'story',
      subtype: 'story_viewed',
      priority: 'low',
      referenceId: storyId,
      referenceType: 'story',
      useTemplate: true,
      templateData: {
        view_count: viewCount,
        first_viewers: viewers.slice(0, 3).join(', ')
      },
      data: { 
        storyId, 
        viewCount, 
        viewers: viewers.slice(0, 10)
      }
    });
  }
  
  // ==================== NOTIFICATIONS WALLET & PAYMENT ====================
  
  async sendWalletNotification(userId, transactionId, event, amount, balance = null) {
    const templates = {
      'deposit': { type: 'wallet', subtype: 'wallet_deposit', priority: 'normal' },
      'withdrawal': { type: 'wallet', subtype: 'wallet_withdrawal', priority: 'normal' },
      'payment': { type: 'payment', subtype: 'payment_success', priority: 'normal' },
      'payment_failed': { type: 'payment', subtype: 'payment_failed', priority: 'high' },
      'balance_low': { type: 'wallet', subtype: 'wallet_balance_low', priority: 'high' },
      'refund': { type: 'wallet', subtype: 'refund', priority: 'normal' }
    };
    
    const template = templates[event];
    if (!template) return null;
    
    return this.send({
      userId,
      type: template.type,
      subtype: template.subtype,
      priority: template.priority,
      referenceId: transactionId,
      referenceType: 'transaction',
      useTemplate: true,
      templateData: { 
        amount: amount.toLocaleString(),
        balance: balance ? balance.toLocaleString() : null
      },
      data: { transactionId, event, amount, balance }
    });
  }
  
  // ==================== NOTIFICATIONS SOS ====================
  
  async sendSOSNotification(userId, rideId, event, passengerName = 'Passager', location = null) {
    const priority = 'critical';
    
    if (event === 'triggered') {
      return this.send({
        userId,
        type: 'sos',
        subtype: 'sos_triggered',
        priority,
        referenceId: rideId,
        referenceType: 'ride',
        useTemplate: true,
        templateData: {
          passenger_name: passengerName,
          location: location || 'position inconnue'
        },
        data: { rideId, event, location }
      });
    } else {
      return this.send({
        userId,
        type: 'sos',
        subtype: 'sos_resolved',
        priority: 'high',
        referenceId: rideId,
        referenceType: 'ride',
        useTemplate: true,
        templateData: {
          passenger_name: passengerName
        },
        data: { rideId, event }
      });
    }
  }
  
  async sendSOSAlertToAdmins(rideId, passengerName, passengerId, location, adminIds) {
    const results = [];
    for (const adminId of adminIds) {
      const result = await this.send({
        userId: adminId,
        type: 'admin',
        subtype: 'sos_alert',
        priority: 'critical',
        referenceId: rideId,
        referenceType: 'ride',
        actorId: passengerId,
        actorName: passengerName,
        useTemplate: false,
        title: '🆘 ALERTE SOS URGENTE',
        body: `${passengerName} a déclenché une alerte SOS à ${location}`,
        data: { rideId, passengerId, passengerName, location, type: 'sos_alert' }
      });
      results.push(result);
    }
    return results;
  }
  
  // ==================== NOTIFICATIONS DRIVER ====================
  
  async sendDriverNotification(userId, event, data = {}) {
    const templates = {
      'approved': { type: 'driver', subtype: 'driver_approved', priority: 'high' },
      'suspended': { type: 'driver', subtype: 'driver_suspended', priority: 'high' },
      'points_change': { type: 'driver', subtype: 'driver_points_change', priority: 'normal' },
      'new_ride': { type: 'driver', subtype: 'new_ride_available', priority: 'high' },
      'earning': { type: 'driver', subtype: 'driver_earning', priority: 'normal' }
    };
    
    const template = templates[event];
    if (!template) return null;
    
    return this.send({
      userId,
      type: template.type,
      subtype: template.subtype,
      priority: template.priority,
      referenceId: data.rideId || null,
      referenceType: data.referenceType || null,
      useTemplate: true,
      templateData: {
        points: data.points,
        reason: data.reason,
        amount: data.amount,
        ...data
      },
      data: { event, ...data }
    });
  }
  
  // ==================== NOTIFICATIONS RENTAL ====================
  
  async sendRentalNotification(userId, rentalId, event, data = {}) {
    const templates = {
      'confirmed': { type: 'rental', subtype: 'rental_confirmed', priority: 'normal' },
      'started': { type: 'rental', subtype: 'rental_started', priority: 'normal' },
      'ended': { type: 'rental', subtype: 'rental_ended', priority: 'normal' },
      'reminder': { type: 'rental', subtype: 'rental_reminder', priority: 'normal' },
      'cancelled': { type: 'rental', subtype: 'rental_cancelled', priority: 'normal' }
    };
    
    const template = templates[event];
    if (!template) return null;
    
    return this.send({
      userId,
      type: template.type,
      subtype: template.subtype,
      priority: template.priority,
      referenceId: rentalId,
      referenceType: 'rental',
      useTemplate: true,
      templateData: {
        vehicle: data.vehicle || 'Véhicule',
        start: data.startDate,
        end: data.endDate,
        hours: data.hoursBefore || 2,
        ...data
      },
      data: { rentalId, event, ...data }
    });
  }
  
  // ==================== NOTIFICATIONS ADMIN ====================
  
  async sendAdminNotification(userId, event, data = {}) {
    return this.send({
      userId,
      type: 'admin',
      subtype: event,
      priority: 'high',
      referenceId: data.referenceId || null,
      referenceType: data.referenceType || null,
      useTemplate: false,
      title: data.title || 'Notification Admin',
      body: data.message || '',
      data: { event, ...data }
    });
  }
  
  // ==================== NOTIFICATIONS SYSTÈME ====================
  
  async sendSystemNotification(userId, title, body, data = {}, priority = 'normal') {
    return this.send({
      userId,
      type: 'system',
      subtype: 'system_alert',
      priority,
      title,
      body,
      useTemplate: false,
      data
    });
  }
  
  // ==================== MÉTHODES DE RÉCUPÉRATION ====================
  
  async getUserNotifications(userId, options = {}) {
    const { limit = 50, offset = 0, status = null, type = null, startDate = null, endDate = null } = options;
    
    const where = { user_id: userId, is_deleted: false };
    if (status) where.status = status;
    if (type) where.type = type;
    if (startDate) where.created_at = { [Op.gte]: startDate };
    if (endDate) where.created_at = { ...where.created_at, [Op.lte]: endDate };
    
    const { rows, count } = await Notification.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: Math.min(limit, 100),
      offset
    });
    
    return { notifications: rows, total: count, hasMore: offset + limit < count };
  }
  
  async getUnreadNotifications(userId, limit = 20) {
    const notifications = await Notification.findAll({
      where: { user_id: userId, status: ['pending', 'delivered'], is_deleted: false },
      order: [['created_at', 'DESC']],
      limit
    });
    
    return notifications;
  }
  
  async getNotificationById(notificationId, userId) {
    const notification = await Notification.findOne({
      where: { id: notificationId, user_id: userId }
    });
    
    return notification;
  }
  
  // ==================== MÉTHODES DE MISE À JOUR ====================
  
  async markAsRead(notificationId, userId) {
    return DispatcherService.markAsRead(notificationId, userId);
  }
  
  async markAllAsRead(userId) {
    return DispatcherService.markAllAsRead(userId);
  }
  
  async deleteNotification(notificationId, userId) {
    const notification = await Notification.findOne({
      where: { id: notificationId, user_id: userId }
    });
    
    if (!notification) return false;
    
    notification.is_deleted = true;
    notification.deleted_at = new Date();
    await notification.save();
    
    return true;
  }
  
  async deleteAllNotifications(userId) {
    const [updatedCount] = await Notification.update(
      { is_deleted: true, deleted_at: new Date() },
      { where: { user_id: userId, is_deleted: false } }
    );
    
    return updatedCount;
  }
  
  async getUnreadCount(userId) {
    return DispatcherService.getUserUnreadCount(userId);
  }
  
  // ==================== MÉTHODES DE PRÉFÉRENCES ====================
  
  async getUserPreferences(userId) {
    return PreferenceService.getPreferences(userId);
  }
  
  async updateUserPreferences(userId, updates) {
    return PreferenceService.updatePreferences(userId, updates);
  }
  
  async resetUserPreferences(userId) {
    return PreferenceService.resetToDefaults(userId);
  }
  
  // ==================== MÉTHODES D'APPAREILS ====================
  
  async registerDevice(userId, deviceData) {
    const { UserDevice } = require('../../models');
    
    // Désactiver l'ancien token si existe
    await UserDevice.update(
      { is_active: false },
      { where: { user_id: userId, device_token: deviceData.device_token } }
    );
    
    // Créer ou réactiver
    const [device, created] = await UserDevice.upsert({
      user_id: userId,
      device_token: deviceData.device_token,
      platform: deviceData.platform,
      app_version: deviceData.app_version,
      os_version: deviceData.os_version,
      device_model: deviceData.device_model,
      locale: deviceData.locale || 'fr',
      timezone: deviceData.timezone || 'Africa/Kinshasa',
      is_active: true,
      last_seen_at: new Date()
    });
    
    return device;
  }
  
  async unregisterDevice(userId, deviceToken) {
    const { UserDevice } = require('../../models');
    
    const device = await UserDevice.findOne({
      where: { user_id: userId, device_token: deviceToken }
    });
    
    if (device) {
      device.is_active = false;
      await device.save();
    }
    
    return device;
  }
  
  async getUserDevices(userId) {
    const { UserDevice } = require('../../models');
    
    const devices = await UserDevice.findAll({
      where: { user_id: userId, is_active: true }
    });
    
    return devices;
  }
  
  // ==================== STATISTIQUES ====================
  
  async getNotificationStats(userId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const stats = await Notification.findAll({
      where: { user_id: userId, created_at: { [Op.gte]: startDate } },
      attributes: [
        'type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('COUNT', sequelize.cast(sequelize.col('status = "read"'), 'integer')), 'read_count']
      ],
      group: ['type']
    });
    
    return stats;
  }
  
  // ==================== UTILITAIRES ====================
  
  async sendBulk(userIds, notificationOptions) {
    const results = [];
    for (const userId of userIds) {
      const result = await this.send({ ...notificationOptions, userId });
      results.push({ userId, ...result });
    }
    return results;
  }
  
  async sendToRole(role, notificationOptions) {
    const { User } = require('../../models');
    const users = await User.findAll({ where: { role, is_active: true } });
    const userIds = users.map(u => u.id);
    return this.sendBulk(userIds, notificationOptions);
  }
  
  async sendToAllUsers(notificationOptions, excludeUserIds = []) {
    const { User } = require('../../models');
    const where = { is_active: true };
    if (excludeUserIds.length > 0) {
      where.id = { [Op.notIn]: excludeUserIds };
    }
    const users = await User.findAll({ where });
    const userIds = users.map(u => u.id);
    return this.sendBulk(userIds, notificationOptions);
  }
}

module.exports = new NotificationService();



