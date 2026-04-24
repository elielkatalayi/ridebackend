const { City, Country, AdminLog } = require('../../models');
const { sequelize } = require('../../config/database');

class CityService {
  /**
   * Créer un nouveau pays
   * @param {Object} countryData - Données du pays
   * @param {string} adminId - ID de l'admin
   * @returns {Promise<Object>}
   */
  async createCountry(countryData, adminId) {
    const country = await Country.create(countryData);
    
    await AdminLog.create({
      admin_id: adminId,
      action: 'CREATE_COUNTRY',
      target_type: 'country',
      target_id: country.id,
      new_value: countryData
    });
    
    return country;
  }

  /**
   * Créer une nouvelle ville
   * @param {Object} cityData - Données de la ville
   * @param {string} adminId - ID de l'admin
   * @returns {Promise<Object>}
   */
  async createCity(cityData, adminId) {
    const city = await City.create(cityData);
    
    await AdminLog.create({
      admin_id: adminId,
      action: 'CREATE_CITY',
      target_type: 'city',
      target_id: city.id,
      new_value: cityData
    });
    
    return city;
  }

  /**
   * Mettre à jour une ville
   * @param {string} cityId - ID de la ville
   * @param {Object} updateData - Données à mettre à jour
   * @param {string} adminId - ID de l'admin
   * @returns {Promise<Object>}
   */
  async updateCity(cityId, updateData, adminId) {
    const city = await City.findByPk(cityId);
    if (!city) {
      throw new Error('Ville non trouvée');
    }
    
    const oldValue = city.toJSON();
    await city.update(updateData);
    
    await AdminLog.create({
      admin_id: adminId,
      action: 'UPDATE_CITY',
      target_type: 'city',
      target_id: cityId,
      old_value: oldValue,
      new_value: updateData
    });
    
    return city;
  }

  /**
   * Obtenir toutes les villes
   * @param {boolean} onlyActive - Uniquement les actives
   * @returns {Promise<Array>}
   */
  async getAllCities(onlyActive = true) {
    const where = onlyActive ? { is_active: true } : {};
    
    const cities = await City.findAll({
      where,
      include: ['country'],
      order: [['name', 'ASC']]
    });
    
    return cities;
  }

  /**
   * Obtenir les villes par pays
   * @param {string} countryId - ID du pays
   * @returns {Promise<Array>}
   */
  async getCitiesByCountry(countryId) {
    const cities = await City.findAll({
      where: { country_id: countryId, is_active: true },
      order: [['name', 'ASC']]
    });
    
    return cities;
  }

  /**
   * Obtenir tous les pays
   * @returns {Promise<Array>}
   */
  async getAllCountries() {
    const countries = await Country.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']]
    });
    
    return countries;
  }

  /**
   * Activer/désactiver une ville
   * @param {string} cityId - ID de la ville
   * @param {boolean} isActive - Statut d'activation
   * @param {string} adminId - ID de l'admin
   * @returns {Promise<Object>}
   */
  async toggleCityStatus(cityId, isActive, adminId) {
    const city = await City.findByPk(cityId);
    if (!city) {
      throw new Error('Ville non trouvée');
    }
    
    await city.update({ is_active: isActive });
    
    await AdminLog.create({
      admin_id: adminId,
      action: isActive ? 'ACTIVATE_CITY' : 'DEACTIVATE_CITY',
      target_type: 'city',
      target_id: cityId,
      old_value: { is_active: !isActive },
      new_value: { is_active: isActive }
    });
    
    return city;
  }
}

module.exports = new CityService();