const { Category, CityCategoryPricing, AdminLog } = require('../../models');
const { sequelize } = require('../../config/database');

class CategoryService {
  /**
   * Créer une nouvelle catégorie
   * @param {Object} categoryData - Données de la catégorie
   * @param {string} adminId - ID de l'admin
   * @returns {Promise<Object>}
   */
  async createCategory(categoryData, adminId) {
    const category = await Category.create(categoryData);
    
    await AdminLog.create({
      admin_id: adminId,
      action: 'CREATE_CATEGORY',
      target_type: 'category',
      target_id: category.id,
      new_value: categoryData
    });
    
    return category;
  }

  /**
   * Mettre à jour une catégorie
   * @param {string} categoryId - ID de la catégorie
   * @param {Object} updateData - Données à mettre à jour
   * @param {string} adminId - ID de l'admin
   * @returns {Promise<Object>}
   */
  async updateCategory(categoryId, updateData, adminId) {
    const category = await Category.findByPk(categoryId);
    if (!category) {
      throw new Error('Catégorie non trouvée');
    }
    
    const oldValue = category.toJSON();
    
    await category.update(updateData);
    
    await AdminLog.create({
      admin_id: adminId,
      action: 'UPDATE_CATEGORY',
      target_type: 'category',
      target_id: categoryId,
      old_value: oldValue,
      new_value: updateData
    });
    
    return category;
  }

  /**
   * Supprimer une catégorie (soft delete)
   * @param {string} categoryId - ID de la catégorie
   * @param {string} adminId - ID de l'admin
   * @returns {Promise<Object>}
   */
  async deleteCategory(categoryId, adminId) {
    const category = await Category.findByPk(categoryId);
    if (!category) {
      throw new Error('Catégorie non trouvée');
    }
    
    await category.update({ is_active: false });
    
    await AdminLog.create({
      admin_id: adminId,
      action: 'DELETE_CATEGORY',
      target_type: 'category',
      target_id: categoryId,
      old_value: category.toJSON()
    });
    
    return { success: true };
  }

  /**
   * Obtenir toutes les catégories
   * @param {boolean} onlyActive - Uniquement les actives
   * @returns {Promise<Array>}
   */
  async getAllCategories(onlyActive = true) {
    const where = onlyActive ? { is_active: true } : {};
    
    const categories = await Category.findAll({
      where,
      order: [['display_order', 'ASC'], ['name', 'ASC']]
    });
    
    return categories;
  }

  /**
   * Définir les tarifs par ville pour une catégorie
   * @param {string} categoryId - ID de la catégorie
   * @param {string} cityId - ID de la ville
   * @param {Object} pricingData - Données de tarification
   * @param {string} adminId - ID de l'admin
   * @returns {Promise<Object>}
   */
  async setCityPricing(categoryId, cityId, pricingData, adminId) {
    let cityPricing = await CityCategoryPricing.findOne({
      where: {
        category_id: categoryId,
        city_id: cityId
      }
    });
    
    if (cityPricing) {
      await cityPricing.update(pricingData);
    } else {
      cityPricing = await CityCategoryPricing.create({
        category_id: categoryId,
        city_id: cityId,
        ...pricingData
      });
    }
    
    await AdminLog.create({
      admin_id: adminId,
      action: 'SET_CITY_PRICING',
      target_type: 'city_category_pricing',
      target_id: cityPricing.id,
      new_value: pricingData
    });
    
    return cityPricing;
  }

  /**
   * Obtenir les tarifs par ville pour une catégorie
   * @param {string} categoryId - ID de la catégorie
   * @returns {Promise<Array>}
   */
  async getCityPricing(categoryId) {
    const pricing = await CityCategoryPricing.findAll({
      where: { category_id: categoryId },
      include: ['city']
    });
    
    return pricing;
  }
}

module.exports = new CategoryService();