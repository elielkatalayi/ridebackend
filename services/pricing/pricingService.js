// services/pricing/pricingService.js

const { Category } = require('../../models');
const hereMaps = require('../../config/hereMaps');  // ← Changé: iciMaps au lieu de googleMaps

class PricingService {
  /**
   * Obtenir les tarifs d'une catégorie
   * @param {string} categoryId - ID de la catégorie
   * @returns {Promise<Object>}
   */
  async getCategoryPricing(categoryId) {
    const category = await Category.findByPk(categoryId);
    if (!category) {
      throw new Error('Catégorie non trouvée');
    }
    
    return {
      base_fare: category.base_fare,
      per_km_rate: category.per_km_rate,
      per_minute_rate: category.per_minute_rate,
      min_fare: category.min_fare,
      wait_free_minutes: category.wait_free_minutes,
      wait_paid_per_minute: category.wait_paid_per_minute,
      pause_per_minute: category.pause_per_minute
    };
  }

  /**
   * Calculer le prix estimé d'une course
   * @param {Object} origin - Point de départ {lat, lng}
   * @param {Object} destination - Point d'arrivée {lat, lng}
   * @param {string} categoryId - ID de la catégorie
   * @returns {Promise<Object>}
   */
  async estimatePrice(origin, destination, categoryId) {
    // Récupérer les tarifs
    const pricing = await this.getCategoryPricing(categoryId);
    
    // Obtenir la distance et la durée avec trafic (via HERE Maps)
    const distanceData = await hereMaps.getDistanceMatrix(origin, destination);
    
    // Vérifier si le calcul a réussi
    if (!distanceData.success) {
      throw new Error('Impossible de calculer la distance: ' + distanceData.error);
    }
    
    // Calcul du prix
    const distancePrice = distanceData.distanceKm * pricing.per_km_rate;
    const timePrice = distanceData.durationWithTrafficMin * pricing.per_minute_rate;
    const totalPrice = pricing.base_fare + distancePrice + timePrice;
    const finalPrice = Math.max(totalPrice, pricing.min_fare);
    
    return {
      suggestedPrice: Math.round(finalPrice),
      distanceKm: distanceData.distanceKm,
      distanceMeters: distanceData.distanceMeters,
      durationMin: distanceData.durationWithTrafficMin,
      durationSec: distanceData.durationWithTrafficSec,
      durationWithoutTrafficMin: distanceData.durationWithoutTrafficMin,
      baseFare: pricing.base_fare,
      distancePrice: Math.round(distancePrice),
      timePrice: Math.round(timePrice),
      provider: 'here',  // Indique que la donnée vient de HERE
      breakdown: {
        base_fare: pricing.base_fare,
        per_km_rate: pricing.per_km_rate,
        per_minute_rate: pricing.per_minute_rate,
        distance_km: distanceData.distanceKm,
        duration_min: distanceData.durationWithTrafficMin,
        min_fare: pricing.min_fare
      }
    };
  }

  /**
   * Recalculer le prix avec des arrêts supplémentaires
   * @param {Object} originalEstimate - Estimation originale
   * @param {Array} extraStops - Arrêts supplémentaires [{lat, lng}]
   * @param {Object} pricing - Tarifs de la catégorie
   * @returns {Promise<Object>}
   */
  async recalculateWithStops(originalEstimate, extraStops, pricing) {
    const extraStopFee = extraStops.length * 500;
    const newTotal = originalEstimate.suggestedPrice + extraStopFee;
    
    return {
      ...originalEstimate,
      suggestedPrice: newTotal,
      extraStopFee,
      extraStopsCount: extraStops.length
    };
  }

  /**
   * Calculer les frais d'attente
   * @param {number} waitMinutes - Minutes d'attente réelles
   * @param {number} freeMinutes - Minutes gratuites
   * @param {number} paidPerMinute - Tarif par minute après gratuit
   * @returns {Object}
   */
  calculateWaitCharge(waitMinutes, freeMinutes, paidPerMinute) {
    if (waitMinutes <= freeMinutes) {
      return {
        billableMinutes: 0,
        amount: 0,
        freeMinutesUsed: waitMinutes,
        paidMinutesUsed: 0
      };
    }
    
    const paidMinutes = Math.ceil(waitMinutes - freeMinutes);
    const amount = paidMinutes * paidPerMinute;
    
    return {
      billableMinutes: paidMinutes,
      amount,
      freeMinutesUsed: freeMinutes,
      paidMinutesUsed: paidMinutes
    };
  }

  /**
   * Calculer les frais de pause
   * @param {number} pauseMinutes - Minutes de pause
   * @param {number} ratePerMinute - Tarif par minute
   * @returns {Object}
   */
  calculatePauseCharge(pauseMinutes, ratePerMinute) {
    const amount = pauseMinutes * ratePerMinute;
    
    return {
      minutes: pauseMinutes,
      amount,
      ratePerMinute
    };
  }

  /**
   * Calculer le prix final d'une course
   * @param {Object} params - Paramètres de calcul
   * @returns {Object}
   */
  calculateFinalPrice(params) {
    const {
      negotiatedPrice,
      waitCharge = 0,
      pauseCharge = 0,
      extraStopsCharge = 0
    } = params;
    
    const finalPrice = negotiatedPrice + waitCharge + pauseCharge + extraStopsCharge;
    
    return {
      finalPrice,
      breakdown: {
        negotiated_price: negotiatedPrice,
        wait_charge: waitCharge,
        pause_charge: pauseCharge,
        extra_stops_charge: extraStopsCharge
      }
    };
  }
}

module.exports = new PricingService();