const { Notification, NotificationLog } = require('../../models');
const { sequelize } = require('../../config/database');
const PreferenceService = require('./PreferenceService');
const PushService = require('./pushService');
const SocketService = require('./SocketService');
const BatchService = require('./BatchService');

class DispatcherService {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    this.stats = {
      dispatched: 0,
      batched: 0,
      failed: 0,
      lastReset: new Date()
    };
  }

  async dispatch(notification) {
    // Vérifier si doit être groupé
    const { shouldGroup, delay } = await PreferenceService.shouldGroup(
      notification.user_id,
      notification.type,
      notification.subtype
    );
    
    if (shouldGroup && !notification.batch_aggregated) {
      const batchResult = await BatchService.addToBatch(notification.user_id, notification);
      if (batchResult.batched) {
        this.stats.batched++;
        return { dispatched: false, batched: true, batchId: batchResult.batchId };
      }
    }
    
    // Vérifier préférences utilisateur
    const { shouldSend, channel, prefs, needsContextCheck } = await PreferenceService.shouldSend(
      notification.user_id,
      notification.type,
      notification.subtype,
      notification.priority === 'critical'
    );
    
    if (!shouldSend) {
      await this.markAsFailed(notification.id, 'disabled_by_user');
      this.stats.failed++;
      return { dispatched: false, reason: 'disabled_by_user' };
    }
    
    // Ajouter à la file d'attente
    const queueItem = {
      notification,
      channels: channel || [],
      prefs,
      priority: this.priorityOrder[notification.priority || 'normal'],
      createdAt: new Date(),
      needsContextCheck
    };
    
    this.queue.push(queueItem);
    
    // Trier par priorité
    this.queue.sort((a, b) => a.priority - b.priority);
    
    // Traiter la file
    if (!this.processing) {
      this.processQueue();
    }
    
    this.stats.dispatched++;
    return { dispatched: true, queued: true };
  }

  async processQueue() {
    if (this.processing) return;
    this.processing = true;
    
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      
      // Vérification contextuelle supplémentaire si nécessaire
      if (item.needsContextCheck) {
        const shouldContinue = await this.checkContext(item);
        if (!shouldContinue) {
          await this.markAsFailed(item.notification.id, 'context_check_failed');
          continue;
        }
      }
      
      await this.send(item);
      
      // Petit délai pour éviter de surcharger
      if (this.queue.length > 0) {
        await this.sleep(10);
      }
    }
    
    this.processing = false;
  }

  async checkContext(item) {
    // Vérifications contextuelles spécifiques
    const { notification, prefs } = item;
    const type = notification.type;
    const data = notification.data;
    
    if (type === 'social_comment' && prefs.preferences?.social_comment?.on_my_posts_only) {
      // Vérifier si le commentaire est sur le post de l'utilisateur
      const postUserId = data.post_user_id;
      return postUserId === notification.user_id;
    }
    
    if (type === 'story' && prefs.preferences?.story?.from_followed_only) {
      // Vérifier si l'utilisateur suit l'auteur de la story
      const storyAuthorId = data.author_id;
      const isFollowing = await this.checkIfFollowing(notification.user_id, storyAuthorId);
      return isFollowing;
    }
    
    return true;
  }

  async checkIfFollowing(userId, authorId) {
    // À implémenter avec le service de follow
    // Pour l'instant, retourne true
    return true;
  }

  async send(item) {
    const { notification, channels, prefs } = item;
    const deliveryChannels = [];
    const errors = [];
    
    // 1. Envoi via Socket.IO (in-app temps réel)
    if (channels.includes('in_app')) {
      const sent = SocketService.sendToUser(notification.user_id, 'notification', {
        id: notification.id,
        type: notification.type,
        subtype: notification.subtype,
        title: notification.title,
        body: notification.body,
        media_preview: notification.media_preview,
        data: notification.data,
        priority: notification.priority,
        created_at: notification.created_at
      });
      
      if (sent) {
        deliveryChannels.push('socket');
        notification.socket_sent = true;
      } else {
        // L'utilisateur n'est pas connecté, la notification sera dans la BDD
        deliveryChannels.push('in_app_stored');
      }
    }
    
    // 2. Envoi via Push (FCM)
    if (channels.includes('push') && prefs.push_enabled) {
      try {
        const result = await PushService.sendToUser(notification.user_id, notification);
        if (result.sent > 0) {
          deliveryChannels.push('push');
          notification.push_sent = true;
        } else if (result.queued) {
          deliveryChannels.push('push_queued');
        } else if (result.failed > 0) {
          errors.push(`Push failed: ${result.failed}/${result.total}`);
          notification.push_error = `Failed for ${result.failed} devices`;
        }
      } catch (error) {
        console.error('Push error:', error);
        errors.push(`Push error: ${error.message}`);
        notification.push_error = error.message;
      }
    }
    
    // 3. Envoi via Email (pour plus tard)
    if (channels.includes('email') && prefs.email_enabled) {
      // À implémenter avec un service email
      deliveryChannels.push('email_pending');
    }
    
    // Mettre à jour la notification
    notification.delivery_channels = deliveryChannels;
    notification.delivered_at = new Date();
    notification.status = deliveryChannels.length > 0 ? 'delivered' : 'pending';
    
    if (errors.length > 0) {
      notification.push_error = errors.join('; ');
    }
    
    await notification.save();
    
    // Logger l'envoi
    await this.logDispatch(notification.id, notification.user_id, deliveryChannels, errors);
    
    return { delivered: deliveryChannels, errors };
  }

  async logDispatch(notificationId, userId, channels, errors) {
    try {
      await NotificationLog.create({
        notification_id: notificationId,
        user_id: userId,
        channel: channels.join(','),
        status: errors.length > 0 ? 'failed' : 'sent',
        error_message: errors.join('; ') || null,
        sent_at: new Date(),
        metadata: { channels, errors }
      });
    } catch (err) {
      console.error('Error logging dispatch:', err);
    }
  }

  async markAsDelivered(notificationId, channel) {
    await Notification.update(
      { 
        status: 'delivered', 
        delivered_at: new Date(),
        [`${channel}_sent`]: true
      },
      { where: { id: notificationId } }
    );
  }

  async markAsFailed(notificationId, reason) {
    await Notification.update(
      { status: 'failed', push_error: reason },
      { where: { id: notificationId } }
    );
  }

  async markAsRead(notificationId, userId) {
    const notification = await Notification.findOne({
      where: { id: notificationId, user_id: userId }
    });
    
    if (notification && notification.status !== 'read') {
      notification.status = 'read';
      notification.read_at = new Date();
      await notification.save();
      
      // Mettre à jour badge
      await this.updateBadgeCount(userId);
    }
    
    return notification;
  }

  async markAllAsRead(userId) {
    const [updatedCount] = await Notification.update(
      { status: 'read', read_at: new Date() },
      { where: { user_id: userId, status: ['pending', 'delivered'] } }
    );
    
    await this.updateBadgeCount(userId);
    return updatedCount;
  }

  async updateBadgeCount(userId) {
    const unreadCount = await Notification.count({
      where: { user_id: userId, status: ['pending', 'delivered'], is_deleted: false }
    });
    
    // Envoyer le badge via socket
    SocketService.sendToUser(userId, 'badge:update', { count: unreadCount });
    
    // Mettre à jour les préférences badge
    const prefs = await PreferenceService.getPreferences(userId);
    if (prefs.badge_enabled) {
      // Envoyer via push pour mise à jour du badge iOS/Android
      await PushService.sendToUser(userId, {
        title: '',
        body: '',
        data: { badge_count: unreadCount }
      }, { badge: unreadCount });
    }
    
    return unreadCount;
  }

  async getUserUnreadCount(userId) {
    return await Notification.count({
      where: { user_id: userId, status: ['pending', 'delivered'], is_deleted: false }
    });
  }

  async getStats() {
    return { ...this.stats, queueLength: this.queue.length };
  }

  async resetStats() {
    this.stats = {
      dispatched: 0,
      batched: 0,
      failed: 0,
      lastReset: new Date()
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async flushUserQueue(userId) {
    // Flush tous les batches en attente pour un utilisateur
    await BatchService.flushAllBatchesForUser(userId);
    
    // Traiter immédiatement les notifications en file pour cet utilisateur
    const userQueueItems = this.queue.filter(item => item.notification.user_id === userId);
    for (const item of userQueueItems) {
      const index = this.queue.indexOf(item);
      if (index !== -1) {
        this.queue.splice(index, 1);
        await this.send(item);
      }
    }
    
    return userQueueItems.length;
  }
}

module.exports = new DispatcherService();