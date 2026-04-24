class DriverMatcher {
  /**
   * Calculer les scores pour chaque chauffeur
   * @param {Array} driversWithDistance - [{driver, distance}]
   * @param {number} pointsWeight - Poids des points (0-1)
   * @param {number} distanceWeight - Poids de la distance (0-1)
   * @param {number} maxRadius - Rayon maximum en km
   * @returns {Array} Chauffeurs triés par score
   */
  calculateScores(driversWithDistance, pointsWeight, distanceWeight, maxRadius) {
    const maxPoints = 1000;
    const maxDistance = maxRadius;
    
    return driversWithDistance.map(item => {
      const normalizedPoints = Math.min(item.driver.activity_points, maxPoints) / maxPoints;
      const normalizedDistance = 1 - (item.distance / maxDistance);
      const score = (normalizedPoints * pointsWeight) + (normalizedDistance * distanceWeight);
      
      return {
        driver: item.driver,
        distance: item.distance,
        points: item.driver.activity_points,
        normalizedPoints,
        normalizedDistance,
        score: Math.round(score * 100) / 100
      };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Vérifier si un chauffeur est éligible pour une course
   * @param {Object} driver - Chauffeur
   * @param {Object} ride - Course
   * @returns {boolean}
   */
  isDriverEligible(driver, ride) {
    if (driver.is_suspended) return false;
    if (!driver.is_online) return false;
    if (driver.activity_points < 300) return false;
    return true;
  }

  /**
   * Filtrer les chauffeurs par catégorie de véhicule
   * @param {Array} drivers - Liste des chauffeurs
   * @param {string} categoryId - ID de la catégorie
   * @returns {Array}
   */
  filterByCategory(drivers, categoryId) {
    // À implémenter selon les règles métier
    // Un chauffeur Uplus X ne peut pas faire Uplus Black
    return drivers;
  }
}

module.exports = new DriverMatcher();