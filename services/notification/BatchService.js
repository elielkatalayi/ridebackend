const { NotificationBatch, Notification } = require('../../models');
const { sequelize } = require('../../config/database');
const { Op } = require('sequelize');

class BatchService {
  constructor() {
    this.timers = new Map();
    this.defaultDelay = 10; // secondes
  }

  generateBatchKey(notification) {
    // Exemple: "social_like:post:550e8400:likes"
    const referenceId = notification.reference_id || 'global';
    const type = notification.type;
    const subtype = notification.subtype || 'default';
    return `${type}:${referenceId}:${subtype}`;
  }

  async addToBatch(userId, notificationData) {
    const batchKey = this.generateBatchKey(notificationData);
    
    // Rechercher ou créer le batch
    let batch = await NotificationBatch.findOne({
      where: { user_id: userId, batch_key: batchKey }
    });
    
    if (!batch) {
      batch = await NotificationBatch.create({
        user_id: userId,
        batch_key: batchKey,
        type: notificationData.type,
        subtype: notificationData.subtype,
        count: 1,
        last_notification_id: notificationData.id,
        timer_active: false,
        aggregation_delay: this.defaultDelay
      });
    } else {
      // Incrémenter le compteur
      batch.count += 1;
      batch.last_notification_id = notificationData.id;
      await batch.save();
    }
    
    // Démarrer timer si pas actif
    if (!batch.timer_active) {
      await this.startBatchTimer(batch);
    }
    
    return { batched: true, batchId: batch.id, count: batch.count };
  }

  async startBatchTimer(batch) {
    const delay = batch.aggregation_delay || this.defaultDelay;
    
    batch.timer_active = true;
    await batch.save();
    
    const timer = setTimeout(async () => {
      await this.flushBatch(batch.id);
    }, delay * 1000);
    
    this.timers.set(batch.id, timer);
  }

  async flushBatch(batchId) {
    // Nettoyer timer
    if (this.timers.has(batchId)) {
      clearTimeout(this.timers.get(batchId));
      this.timers.delete(batchId);
    }
    
    // Récupérer le batch
    const batch = await NotificationBatch.findByPk(batchId);
    if (!batch || batch.count === 0) return null;
    
    // Vérifier si une notification groupée existe déjà récemment
    const existingGrouped = await Notification.findOne({
      where: {
        user_id: batch.user_id,
        batch_id: batch.id,
        batch_aggregated: true,
        created_at: { [Op.gte]: new Date(Date.now() - 60000) } // dernière minute
      }
    });
    
    if (existingGrouped) {
      // Mettre à jour la notification existante
      existingGrouped.batch_count = batch.count;
      existingGrouped.data = {
        ...existingGrouped.data,
        count: batch.count,
        last_aggregated_at: new Date()
      };
      await existingGrouped.save();
      
      // Réinitialiser le batch
      batch.count = 0;
      batch.timer_active = false;
      await batch.save();
      
      return existingGrouped;
    }
    
    // Créer notification groupée
    const aggregatedTitle = this.getAggregatedTitle(batch);
    const aggregatedBody = this.getAggregatedBody(batch);
    
    const aggregatedNotification = await Notification.create({
      user_id: batch.user_id,
      type: batch.type,
      subtype: batch.subtype,
      priority: 'normal',
      title: aggregatedTitle,
      body: aggregatedBody,
      data: {
        batch_id: batch.id,
        count: batch.count,
        original_notification_id: batch.last_notification_id,
        aggregated: true,
        aggregated_at: new Date()
      },
      reference_id: batch.batch_key.split(':')[2] || null,
      reference_type: batch.type,
      batch_id: batch.id,
      batch_count: batch.count,
      batch_aggregated: true,
      status: 'pending'
    });
    
    // Marquer les notifications originales comme groupées
    await Notification.update(
      { 
        batch_aggregated: true, 
        batch_id: batch.id,
        status: 'cancelled'
      },
      { 
        where: { 
          user_id: batch.user_id, 
          batch_id: batch.id,
          batch_aggregated: false,
          id: { [Op.ne]: aggregatedNotification.id }
        } 
      }
    );
    
    // Réinitialiser le batch
    batch.timer_active = false;
    await batch.save();
    
    return aggregatedNotification;
  }

  getAggregatedTitle(batch) {
    const titles = {
      'social_like:post_like': `✨ ${batch.count} ${batch.count > 1 ? 'personnes ont aimé' : 'personne a aimé'} votre publication`,
      'social_like:comment_like': `❤️ ${batch.count} ${batch.count > 1 ? 'likes' : 'like'} sur votre commentaire`,
      'social_comment:post_comment': `💬 ${batch.count} ${batch.count > 1 ? 'nouveaux commentaires' : 'nouveau commentaire'}`,
      'story:story_viewed': `👁️ ${batch.count} ${batch.count > 1 ? 'personnes ont vu' : 'personne a vu'} votre story`,
      'story:story_reaction': `😊 ${batch.count} ${batch.count > 1 ? 'réactions' : 'réaction'} sur votre story`,
      'social_follow:new_follower': `👥 ${batch.count} ${batch.count > 1 ? 'nouveaux followers' : 'nouveau follower'}`,
      'story:story_comment': `💬 ${batch.count} ${batch.count > 1 ? 'commentaires' : 'commentaire'} sur votre story`,
      'chat_group:group_message': `💬 ${batch.count} ${batch.count > 1 ? 'messages' : 'message'} dans le groupe`
    };
    
    const key = `${batch.type}:${batch.subtype}`;
    return titles[key] || `📢 ${batch.count} ${batch.count > 1 ? 'nouvelles notifications' : 'nouvelle notification'}`;
  }

  getAggregatedBody(batch) {
    const bodies = {
      'social_like:post_like': `Cliquez pour voir qui a aimé votre publication`,
      'social_like:comment_like': `Cliquez pour voir qui a aimé votre commentaire`,
      'social_comment:post_comment': `Cliquez pour voir les nouveaux commentaires`,
      'story:story_viewed': `Votre story a été vue ${batch.count} fois`,
      'story:story_reaction': `Découvrez les réactions à votre story`,
      'social_follow:new_follower': `${batch.count} ${batch.count > 1 ? 'personnes vous suivent maintenant' : 'personne vous suit maintenant'}`,
      'story:story_comment': `${batch.count} ${batch.count > 1 ? 'commentaires' : 'commentaire'} sur votre story`
    };
    
    const key = `${batch.type}:${batch.subtype}`;
    return bodies[key] || `Vous avez ${batch.count} nouvelle(s) notification(s)`;
  }

  async cancelBatch(batchId) {
    if (this.timers.has(batchId)) {
      clearTimeout(this.timers.get(batchId));
      this.timers.delete(batchId);
    }
    
    await NotificationBatch.update(
      { timer_active: false },
      { where: { id: batchId } }
    );
  }

  async flushAllBatchesForUser(userId) {
    const batches = await NotificationBatch.findAll({
      where: { user_id: userId, timer_active: true }
    });
    
    for (const batch of batches) {
      await this.flushBatch(batch.id);
    }
    
    return batches.length;
  }

  async cleanupExpiredBatches() {
    // Nettoyer les batches trop vieux (> 1 heure sans activité)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const oldBatches = await NotificationBatch.findAll({
      where: {
        timer_active: true,
        updated_at: { [Op.lt]: oneHourAgo }
      }
    });
    
    for (const batch of oldBatches) {
      await this.flushBatch(batch.id);
    }
    
    return oldBatches.length;
  }

  async setAggregationDelay(userId, type, delaySeconds) {
    // Mettre à jour dans les préférences (sera fait par PreferenceService)
    // Cette méthode est un placeholder pour l'API
    return { type, delaySeconds };
  }
}

module.exports = new BatchService();