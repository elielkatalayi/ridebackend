const { NotificationTemplate } = require('../../models');
const { Op } = require('sequelize');

class TemplateService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    this.lastLoad = null;
  }

  async loadTemplates(force = false) {
    const now = Date.now();
    if (!force && this.lastLoad && (now - this.lastLoad) < this.cacheExpiry) {
      return;
    }

    const templates = await NotificationTemplate.findAll({
      where: { is_active: true }
    });
    
    this.cache.clear();
    templates.forEach(template => {
      const key = this.getCacheKey(template.type, template.subtype, template.locale);
      this.cache.set(key, template);
      
      // Aussi stocker sans sous-type pour fallback
      if (template.subtype) {
        const fallbackKey = this.getCacheKey(template.type, null, template.locale);
        if (!this.cache.has(fallbackKey)) {
          this.cache.set(fallbackKey, template);
        }
      }
    });
    
    this.lastLoad = now;
    console.log(`📦 Templates chargés: ${templates.length} templates`);
  }

  getCacheKey(type, subtype, locale) {
    return `${type}:${subtype || 'default'}:${locale}`;
  }

  getTemplate(type, subtype, locale = 'fr') {
    // Essayer avec le sous-type exact
    let key = this.getCacheKey(type, subtype, locale);
    let template = this.cache.get(key);
    
    // Essayer sans sous-type
    if (!template) {
      key = this.getCacheKey(type, null, locale);
      template = this.cache.get(key);
    }
    
    // Fallback vers français si autre langue
    if (!template && locale !== 'fr') {
      key = this.getCacheKey(type, subtype, 'fr');
      template = this.cache.get(key);
      if (!template) {
        key = this.getCacheKey(type, null, 'fr');
        template = this.cache.get(key);
      }
    }
    
    return template;
  }

  render(template, data) {
    let title = template.title_template;
    let body = template.body_template || '';
    
    // Remplacer les variables {{variable}}
    const renderText = (text, context) => {
      if (!text) return '';
      return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        // Support pour les chemins nested comme user.name
        const value = key.split('.').reduce((obj, k) => obj && obj[k], context);
        return value !== undefined && value !== null ? value : match;
      });
    };
    
    title = renderText(title, data);
    body = renderText(body, data);
    
    // Support pour les conditions {{#if condition}}...{{/if}}
    const processConditionals = (text, context) => {
      if (!text) return '';
      return text.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
        return context[condition] ? content : '';
      });
    };
    
    title = processConditionals(title, data);
    body = processConditionals(body, data);
    
    return { title, body };
  }

  async createNotificationFromTemplate(type, subtype, data, userId, actorId = null) {
    await this.loadTemplates();
    
    const template = this.getTemplate(type, subtype, data.locale || 'fr');
    
    if (!template) {
      console.warn(`Template non trouvé: ${type}/${subtype}`);
      return null;
    }
    
    const { title, body } = this.render(template, data);
    
    // Calculer expiration
    let expiresAt = null;
    if (template.ttl_seconds && template.ttl_seconds > 0) {
      expiresAt = new Date(Date.now() + (template.ttl_seconds * 1000));
    }
    
    return {
      user_id: userId,
      type,
      subtype,
      priority: data.priority || template.default_priority,
      title,
      body,
      data: data.payload || {},
      reference_id: data.reference_id,
      reference_type: data.reference_type,
      actor_id: actorId || data.actor_id,
      actor_name: data.actor_name,
      actor_avatar: data.actor_avatar,
      media_preview: data.media_preview || {},
      expires_at: data.expires_at || expiresAt
    };
  }

  async createCustomNotification(options) {
    return {
      user_id: options.userId,
      type: options.type,
      subtype: options.subtype || null,
      priority: options.priority || 'normal',
      title: options.title,
      body: options.body || null,
      data: options.data || {},
      reference_id: options.referenceId || null,
      reference_type: options.referenceType || null,
      actor_id: options.actorId || null,
      actor_name: options.actorName || null,
      actor_avatar: options.actorAvatar || null,
      media_preview: options.mediaPreview || {},
      expires_at: options.expiresAt || null
    };
  }

  // Remplacer les variables dans une chaîne existante
  replaceVariables(text, data) {
    if (!text) return '';
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = key.split('.').reduce((obj, k) => obj && obj[k], data);
      return value !== undefined && value !== null ? value : match;
    });
  }
}

module.exports = new TemplateService();