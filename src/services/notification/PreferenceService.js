const { NotificationPreference } = require('../../models');
const { Op } = require('sequelize');

class PreferenceService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 10 * 60 * 1000; // 10 minutes
  }

  async getPreferences(userId, forceRefresh = false) {
    // Vérifier cache
    if (!forceRefresh && this.cache.has(userId)) {
      const cached = this.cache.get(userId);
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.preferences;
      }
    }
    
    let prefs = await NotificationPreference.findOne({ where: { user_id: userId } });
    
    if (!prefs) {
      prefs = await NotificationPreference.create({ user_id: userId });
    }
    
    // Mettre en cache
    this.cache.set(userId, {
      preferences: prefs,
      timestamp: Date.now()
    });
    
    return prefs;
  }

  async updatePreferences(userId, updates) {
    const prefs = await this.getPreferences(userId, true);
    
    // Mise à jour des champs simples
    const simpleFields = [
      'push_enabled', 'in_app_enabled', 'email_enabled',
      'sound_enabled', 'vibration_enabled', 'badge_enabled',
      'quiet_hours_enabled', 'quiet_hours_start', 'quiet_hours_end'
    ];
    
    simpleFields.forEach(field => {
      if (updates[field] !== undefined) {
        prefs[field] = updates[field];
      }
    });
    
    // Mise à jour des préférences JSONB
    if (updates.preferences) {
      const currentPrefs = prefs.preferences || {};
      prefs.preferences = {
        ...currentPrefs,
        ...updates.preferences
      };
      
      // Mise à jour spécifique par type
      if (updates.preferences.ride) {
        prefs.preferences.ride = { ...currentPrefs.ride, ...updates.preferences.ride };
      }
      if (updates.preferences.chat_private) {
        prefs.preferences.chat_private = { ...currentPrefs.chat_private, ...updates.preferences.chat_private };
      }
      if (updates.preferences.chat_group) {
        prefs.preferences.chat_group = { ...currentPrefs.chat_group, ...updates.preferences.chat_group };
      }
      if (updates.preferences.social_post) {
        prefs.preferences.social_post = { ...currentPrefs.social_post, ...updates.preferences.social_post };
      }
      if (updates.preferences.story) {
        prefs.preferences.story = { ...currentPrefs.story, ...updates.preferences.story };
      }
    }
    
    await prefs.save();
    
    // Invalider cache
    this.cache.delete(userId);
    
    return prefs;
  }

  async shouldSend(userId, type, subtype, isCritical = false) {
    const prefs = await this.getPreferences(userId);
    
    // Vérifier master switch
    if (!prefs.in_app_enabled && !prefs.push_enabled) {
      return { shouldSend: false, channel: null, reason: 'all_disabled' };
    }
    
    // Vérifier heures silencieuses
    if (prefs.quiet_hours_enabled && !isCritical) {
      const now = new Date();
      const currentTime = now.toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit', hour12: false });
      
      if (this.isInQuietHours(currentTime, prefs.quiet_hours_start, prefs.quiet_hours_end)) {
        return { shouldSend: false, channel: null, reason: 'quiet_hours' };
      }
    }
    
    // Vérifier préférence spécifique du type
    const typePref = prefs.preferences?.[type];
    if (typePref && typePref.enabled === false) {
      return { shouldSend: false, channel: null, reason: 'type_disabled' };
    }
    
    // Vérification spécifique pour les mentions
    if (subtype === 'group_mention' && typePref?.mentions_only === true) {
      // Les mentions sont toujours envoyées
    }
    
    // Déterminer canaux
    const channels = [];
    if (prefs.in_app_enabled) channels.push('in_app');
    if (prefs.push_enabled && typePref?.push !== false) channels.push('push');
    if (prefs.email_enabled) channels.push('email');
    
    // Vérifier si le type a des restrictions supplémentaires
    if (type === 'social_like' && typePref?.enabled === false) {
      return { shouldSend: false, channel: null, reason: 'likes_disabled' };
    }
    
    if (type === 'social_comment' && typePref?.on_my_posts_only === true) {
      // On vérifiera plus tard si c'est sur son post
      return { shouldSend: true, channel: channels, prefs, needsContextCheck: true };
    }
    
    if (type === 'story' && typePref?.from_followed_only === true) {
      return { shouldSend: true, channel: channels, prefs, needsContextCheck: true };
    }
    
    return { shouldSend: channels.length > 0, channel: channels, prefs };
  }

  isInQuietHours(currentTime, start, end) {
    if (start <= end) {
      return currentTime >= start && currentTime < end;
    } else {
      // Cas où les heures silencieuses traversent minuit
      return currentTime >= start || currentTime < end;
    }
  }

  async shouldGroup(userId, type, subtype) {
    const prefs = await this.getPreferences(userId);
    
    // Vérifier si ce type doit être groupé
    const typePref = prefs.preferences?.[type];
    const groupDelay = typePref?.group_delay;
    
    // Types par défaut qui doivent être groupés
    const defaultGroupTypes = ['social_like', 'story_viewed', 'social_follow'];
    
    if (groupDelay === 0) {
      return { shouldGroup: false, delay: null };
    }
    
    if (groupDelay > 0) {
      return { shouldGroup: true, delay: groupDelay };
    }
    
    if (defaultGroupTypes.includes(type)) {
      return { shouldGroup: true, delay: 10 };
    }
    
    return { shouldGroup: false, delay: null };
  }

  async updateBadgePreference(userId, enabled) {
    const prefs = await this.getPreferences(userId);
    prefs.badge_enabled = enabled;
    await prefs.save();
    this.cache.delete(userId);
    return prefs;
  }

  async resetToDefaults(userId) {
    const prefs = await this.getPreferences(userId, true);
    prefs.push_enabled = true;
    prefs.in_app_enabled = true;
    prefs.email_enabled = false;
    prefs.sound_enabled = true;
    prefs.vibration_enabled = true;
    prefs.badge_enabled = true;
    prefs.quiet_hours_enabled = false;
    prefs.quiet_hours_start = '22:00';
    prefs.quiet_hours_end = '08:00';
    prefs.preferences = {
      ride: { enabled: true, push: true, sound: 'default', vibration: true },
      payment: { enabled: true, push: true, sound: 'default' },
      wallet: { enabled: true, push: true, balance_low_threshold: 5000 },
      chat_private: { enabled: true, push: true, preview: true },
      chat_group: { enabled: true, push: true, mentions_only: false, preview: true },
      social_post: { enabled: true, push: false, from_followed_only: true },
      social_comment: { enabled: true, push: true, on_my_posts_only: true },
      social_like: { enabled: true, push: false, group_delay: 10 },
      social_mention: { enabled: true, push: true, priority: 'high' },
      story: { enabled: true, push: false, from_followed_only: true },
      story_comment: { enabled: true, push: true, on_my_stories_only: true },
      rental: { enabled: true, push: true, reminder_hours_before: 2 },
      admin: { enabled: true, push: true, priority: 'high' },
      system: { enabled: true, push: true }
    };
    await prefs.save();
    this.cache.delete(userId);
    return prefs;
  }

  // Pour les notifications groupées, obtenir le délai
  async getGroupDelay(userId, type) {
    const prefs = await this.getPreferences(userId);
    const typePref = prefs.preferences?.[type];
    return typePref?.group_delay || 10;
  }
}

module.exports = new PreferenceService();