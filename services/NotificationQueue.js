// backend/services/NotificationQueue.js (optionnel - pour les envois différés)
const Bull = require('bull');
const FcmService = require('./FcmService');

class NotificationQueue {
  constructor() {
    this.queue = new Bull('notifications', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
      }
    });
    
    this.setupProcessors();
  }
  
  setupProcessors() {
    // Traitement des jobs
    this.queue.process(async (job) => {
      const { type, data } = job.data;
      
      switch (type) {
        case 'send_to_user':
          return await FcmService.sendToUser(data.userId, data.notification, data.payload);
        case 'send_to_multiple':
          return await FcmService.sendToMultipleUsers(data.userIds, data.notification, data.payload);
        case 'send_to_topic':
          return await FcmService.sendToTopic(data.topic, data.notification, data.payload);
        default:
          throw new Error(`Type de notification inconnu: ${type}`);
      }
    });
    
    // Gestion des erreurs
    this.queue.on('failed', (job, err) => {
      console.error(`❌ Job ${job.id} échoué:`, err.message);
    });
    
    this.queue.on('completed', (job) => {
      console.log(`✅ Job ${job.id} terminé`);
    });
  }
  
  // Ajouter une notification à envoyer
  async addToQueue(type, data, delay = 0) {
    const job = await this.queue.add(
      { type, data },
      { delay, attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
    );
    console.log(`📦 Job ${job.id} ajouté à la queue (delay: ${delay}ms)`);
    return job;
  }
  
  // Envoyer maintenant (sans queue)
  async sendNow(type, data) {
    switch (type) {
      case 'send_to_user':
        return await FcmService.sendToUser(data.userId, data.notification, data.payload);
      case 'send_to_multiple':
        return await FcmService.sendToMultipleUsers(data.userIds, data.notification, data.payload);
      case 'send_to_topic':
        return await FcmService.sendToTopic(data.topic, data.notification, data.payload);
      default:
        throw new Error(`Type de notification inconnu: ${type}`);
    }
  }
  
  // Obtenir les statistiques de la queue
  async getStats() {
    return {
      waiting: await this.queue.getWaitingCount(),
      active: await this.queue.getActiveCount(),
      completed: await this.queue.getCompletedCount(),
      failed: await this.queue.getFailedCount(),
      delayed: await this.queue.getDelayedCount()
    };
  }
  
  // Nettoyer la queue
  async clean() {
    await this.queue.clean(0, 'completed');
    await this.queue.clean(0, 'failed');
    console.log('🧹 Queue nettoyée');
  }
}

module.exports = new NotificationQueue();