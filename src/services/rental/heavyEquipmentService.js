const { HeavyEquipmentRental, Category, User, City } = require('../../models');
const { sequelize } = require('../../config/database');
const NotificationService = require('../notification/NotificationService');

class HeavyEquipmentService {
  /**
   * Créer une location d'engin TP
   * @param {Object} rentalData - Données de location
   * @returns {Promise<Object>}
   */
  async createRental(rentalData) {
    const {
      user_id,
      category_id,
      city_id,
      equipment_type,
      equipment_model,
      start_date,
      end_date,
      site_address,
      site_lat,
      site_lng,
      with_operator
    } = rentalData;
    
    const transaction = await sequelize.transaction();
    
    try {
      // Vérifier la catégorie
      const category = await Category.findByPk(category_id, { transaction });
      if (!category || category.type !== 'heavy') {
        throw new Error('Catégorie non disponible pour location d\'engin');
      }
      
      // Calculer le prix
      const days = Math.ceil((new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24));
      const dailyRate = category.heavy_daily_rate || 100000;
      const baseAmount = dailyRate * days;
      
      const operatorFee = with_operator ? (dailyRate * 0.3) * days : 0;
      const depositAmount = baseAmount * 0.5;
      const totalAmount = baseAmount + operatorFee;
      
      // Créer la location
      const rental = await HeavyEquipmentRental.create({
        user_id,
        category_id,
        city_id,
        equipment_type,
        equipment_model,
        start_date,
        end_date,
        hourly_rate: category.heavy_hourly_rate,
        daily_rate: dailyRate,
        total_amount: totalAmount,
        deposit_amount: depositAmount,
        site_address,
        site_lat,
        site_lng,
        with_operator,
        operator_fee: operatorFee,
        status: 'pending'
      }, { transaction });
      
      await transaction.commit();
      
      // Notification de création de location
      await NotificationService.sendRentalNotification(
        user_id,
        rental.id,
        'confirmed',
        {
          vehicle: equipment_type,
          startDate: start_date,
          endDate: end_date,
          amount: totalAmount
        }
      );
      
      return {
        rental,
        pricing: {
          baseAmount,
          operatorFee,
          depositAmount,
          totalAmount,
          days
        }
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Confirmer une location d'engin
   * @param {string} rentalId - ID de la location
   * @returns {Promise<Object>}
   */
  async confirmRental(rentalId) {
    const rental = await HeavyEquipmentRental.findByPk(rentalId, {
      include: [{ model: User, as: 'user' }]
    });
    
    if (!rental) {
      throw new Error('Location non trouvée');
    }
    
    await rental.update({ status: 'confirmed' });
    
    // Notification de confirmation
    await NotificationService.sendRentalNotification(
      rental.user_id,
      rentalId,
      'confirmed',
      {
        vehicle: rental.equipment_type,
        startDate: rental.start_date,
        endDate: rental.end_date,
        amount: rental.total_amount
      }
    );
    
    return rental;
  }

  /**
   * Démarrer une location d'engin
   * @param {string} rentalId - ID de la location
   * @returns {Promise<Object>}
   */
  async startRental(rentalId) {
    const rental = await HeavyEquipmentRental.findByPk(rentalId, {
      include: [{ model: User, as: 'user' }]
    });
    
    if (!rental) {
      throw new Error('Location non trouvée');
    }
    
    await rental.update({ status: 'ongoing' });
    
    // Notification de début de location
    await NotificationService.sendRentalNotification(
      rental.user_id,
      rentalId,
      'started',
      {
        vehicle: rental.equipment_type,
        startDate: rental.start_date
      }
    );
    
    return rental;
  }

  /**
   * Terminer une location d'engin
   * @param {string} rentalId - ID de la location
   * @returns {Promise<Object>}
   */
  async completeRental(rentalId) {
    const rental = await HeavyEquipmentRental.findByPk(rentalId, {
      include: [{ model: User, as: 'user' }]
    });
    
    if (!rental) {
      throw new Error('Location non trouvée');
    }
    
    await rental.update({
      status: 'completed',
      completed_at: new Date()
    });
    
    // Notification de fin de location
    await NotificationService.sendRentalNotification(
      rental.user_id,
      rentalId,
      'ended',
      {
        vehicle: rental.equipment_type,
        totalAmount: rental.total_amount
      }
    );
    
    return rental;
  }

  /**
   * Obtenir les locations d'engin d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Array>}
   */
  async getUserRentals(userId) {
    const rentals = await HeavyEquipmentRental.findAll({
      where: { user_id: userId },
      include: ['category', 'city'],
      order: [['created_at', 'DESC']]
    });
    
    return rentals;
  }

  /**
   * Obtenir les engins disponibles
   * @param {string} cityId - ID de la ville
   * @returns {Promise<Array>}
   */
  async getAvailableEquipment(cityId) {
    // Récupérer toutes les catégories d'engins lourds
    const categories = await Category.findAll({
      where: {
        type: 'heavy',
        is_active: true
      },
      attributes: ['id', 'name', 'slug', 'heavy_hourly_rate', 'heavy_daily_rate', 'description']
    });
    
    // TODO: Filtrer par disponibilité réelle (inventaire)
    // Pour l'instant, on retourne toutes les catégories actives
    return categories.map(category => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      hourly_rate: category.heavy_hourly_rate,
      daily_rate: category.heavy_daily_rate,
      description: category.description,
      available: true // À remplacer par une vraie vérification d'inventaire
    }));
  }

  /**
   * Rappel de location (à appeler par cron job)
   * @param {string} rentalId - ID de la location
   * @returns {Promise<void>}
   */
  async sendRentalReminder(rentalId) {
    const rental = await HeavyEquipmentRental.findByPk(rentalId, {
      include: [{ model: User, as: 'user' }]
    });
    
    if (!rental || rental.status !== 'confirmed') return;
    
    const hoursBeforeStart = (new Date(rental.start_date) - new Date()) / (1000 * 60 * 60);
    
    if (hoursBeforeStart <= 24 && hoursBeforeStart > 0) {
      await NotificationService.sendRentalNotification(
        rental.user_id,
        rentalId,
        'reminder',
        {
          vehicle: rental.equipment_type,
          hoursBefore: Math.floor(hoursBeforeStart),
          startDate: rental.start_date,
          siteAddress: rental.site_address
        }
      );
    }
  }
}

module.exports = new HeavyEquipmentService();