const { PlatformSetting, AdminLog } = require('../../models');
const { sequelize } = require('../../config/database');

class SettingsService {
  /**
   * Obtenir tous les paramètres
   * @returns {Promise<Object>}
   */
  async getAllSettings() {
    const settings = await PlatformSetting.findAll();
    
    const settingsMap = {};
    for (const setting of settings) {
      settingsMap[setting.setting_key] = setting.setting_value;
    }
    
    return settingsMap;
  }

  /**
   * Obtenir un paramètre spécifique
   * @param {string} key - Clé du paramètre
   * @returns {Promise<any>}
   */
  async getSetting(key) {
    const setting = await PlatformSetting.findOne({
      where: { setting_key: key }
    });
    
    return setting ? setting.setting_value : null;
  }

  /**
   * Mettre à jour un paramètre
   * @param {string} key - Clé du paramètre
   * @param {any} value - Nouvelle valeur
   * @param {string} adminId - ID de l'admin
   * @returns {Promise<Object>}
   */
  async updateSetting(key, value, adminId) {
    const transaction = await sequelize.transaction();
    
    try {
      const setting = await PlatformSetting.findOne({
        where: { setting_key: key },
        transaction
      });
      
      const oldValue = setting ? setting.setting_value : null;
      
      if (setting) {
        await setting.update({
          setting_value: value,
          updated_by: adminId,
          updated_at: new Date()
        }, { transaction });
      } else {
        await PlatformSetting.create({
          setting_key: key,
          setting_value: value,
          updated_by: adminId
        }, { transaction });
      }
      
      // Enregistrer l'action admin
      await AdminLog.create({
        admin_id: adminId,
        action: 'UPDATE_SETTING',
        target_type: 'platform_setting',
        target_id: setting?.id,
        old_value: oldValue,
        new_value: value,
        ip_address: null
      }, { transaction });
      
      await transaction.commit();
      
      return { success: true, key, value };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Mettre à jour plusieurs paramètres
   * @param {Object} settings - Objet {key: value}
   * @param {string} adminId - ID de l'admin
   * @returns {Promise<Array>}
   */
  async updateMultipleSettings(settings, adminId) {
    const results = [];
    
    for (const [key, value] of Object.entries(settings)) {
      const result = await this.updateSetting(key, value, adminId);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Obtenir la configuration de l'algorithme de dispatch
   * @returns {Promise<Object>}
   */
  async getDispatchConfig() {
    const DispatchSetting = require('../../models/DispatchSetting');
    const config = await DispatchSetting.findOne({
      where: { city_id: null }
    });
    
    return {
      points_weight: config?.points_weight || 0.6,
      distance_weight: config?.distance_weight || 0.4,
      max_search_radius_km: config?.max_search_radius_km || 5,
      max_drivers_notified: config?.max_drivers_notified || 10
    };
  }

  /**
   * Mettre à jour la configuration de l'algorithme de dispatch
   * @param {Object} config - Configuration
   * @param {string} adminId - ID de l'admin
   * @returns {Promise<Object>}
   */
  async updateDispatchConfig(config, adminId) {
    const DispatchSetting = require('../../models/DispatchSetting');
    
    let dispatchConfig = await DispatchSetting.findOne({
      where: { city_id: null }
    });
    
    if (dispatchConfig) {
      await dispatchConfig.update({
        ...config,
        updated_by: adminId,
        updated_at: new Date()
      });
    } else {
      dispatchConfig = await DispatchSetting.create({
        ...config,
        updated_by: adminId
      });
    }
    
    return dispatchConfig;
  }
}

module.exports = new SettingsService();