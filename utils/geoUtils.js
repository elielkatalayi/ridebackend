/**
 * Utilitaires géographiques
 */
class GeoUtils {
  /**
   * Calculer la distance entre deux points (Haversine formula)
   * @param {number} lat1 - Latitude point 1
   * @param {number} lon1 - Longitude point 1
   * @param {number} lat2 - Latitude point 2
   * @param {number} lon2 - Longitude point 2
   * @returns {number} Distance en mètres
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Rayon de la Terre en mètres
    const φ1 = this.toRadians(lat1);
    const φ2 = this.toRadians(lat2);
    const Δφ = this.toRadians(lat2 - lat1);
    const Δλ = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  /**
   * Convertir les degrés en radians
   * @param {number} deg - Degrés
   * @returns {number} Radians
   */
  static toRadians(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Convertir les radians en degrés
   * @param {number} rad - Radians
   * @returns {number} Degrés
   */
  static toDegrees(rad) {
    return rad * (180 / Math.PI);
  }

  /**
   * Vérifier si un point est dans un rayon
   * @param {Object} center - Point central {lat, lng}
   * @param {Object} point - Point à vérifier {lat, lng}
   * @param {number} radius - Rayon en mètres
   * @returns {boolean}
   */
  static isWithinRadius(center, point, radius) {
    const distance = this.calculateDistance(
      center.lat, center.lng,
      point.lat, point.lng
    );
    return distance <= radius;
  }

  /**
   * Calculer la boîte englobante pour un rayon
   * @param {number} lat - Latitude du centre
   * @param {number} lng - Longitude du centre
   * @param {number} radius - Rayon en mètres
   * @returns {Object} {minLat, maxLat, minLng, maxLng}
   */
  static getBoundingBox(lat, lng, radius) {
    const latRad = this.toRadians(lat);
    const degLatKm = 110.574;
    const degLngKm = 111.320 * Math.cos(latRad);
    
    const deltaLat = radius / 1000 / degLatKm;
    const deltaLng = radius / 1000 / degLngKm;
    
    return {
      minLat: lat - deltaLat,
      maxLat: lat + deltaLat,
      minLng: lng - deltaLng,
      maxLng: lng + deltaLng
    };
  }

  /**
   * Calculer la vitesse moyenne entre deux points
   * @param {Object} point1 - Premier point {lat, lng, timestamp}
   * @param {Object} point2 - Deuxième point {lat, lng, timestamp}
   * @returns {number} Vitesse en km/h
   */
  static calculateSpeed(point1, point2) {
    const distance = this.calculateDistance(
      point1.lat, point1.lng,
      point2.lat, point2.lng
    );
    const timeHours = (point2.timestamp - point1.timestamp) / (1000 * 60 * 60);
    
    if (timeHours <= 0) return 0;
    return (distance / 1000) / timeHours;
  }

  /**
   * Calculer l'azimut entre deux points
   * @param {number} lat1 - Latitude point 1
   * @param {number} lon1 - Longitude point 1
   * @param {number} lat2 - Latitude point 2
   * @param {number} lon2 - Longitude point 2
   * @returns {number} Azimut en degrés
   */
  static calculateBearing(lat1, lon1, lat2, lon2) {
    const φ1 = this.toRadians(lat1);
    const φ2 = this.toRadians(lat2);
    const λ1 = this.toRadians(lon1);
    const λ2 = this.toRadians(lon2);
    
    const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
    
    let θ = Math.atan2(y, x);
    θ = this.toDegrees(θ);
    return (θ + 360) % 360;
  }

  /**
   * Interpoler un point sur un segment
   * @param {Object} start - Point de départ {lat, lng}
   * @param {Object} end - Point d'arrivée {lat, lng}
   * @param {number} fraction - Fraction du trajet (0-1)
   * @returns {Object} Point interpolé {lat, lng}
   */
  static interpolatePoint(start, end, fraction) {
    return {
      lat: start.lat + (end.lat - start.lat) * fraction,
      lng: start.lng + (end.lng - start.lng) * fraction
    };
  }

  /**
   * Calculer le point milieu entre deux points
   * @param {Object} point1 - Premier point {lat, lng}
   * @param {Object} point2 - Deuxième point {lat, lng}
   * @returns {Object} Point milieu {lat, lng}
   */
  static getMidpoint(point1, point2) {
    return this.interpolatePoint(point1, point2, 0.5);
  }

  /**
   * Vérifier si un point est sur un segment
   * @param {Object} point - Point à vérifier {lat, lng}
   * @param {Object} start - Point de départ {lat, lng}
   * @param {Object} end - Point d'arrivée {lat, lng}
   * @param {number} tolerance - Tolérance en mètres
   * @returns {boolean}
   */
  static isPointOnSegment(point, start, end, tolerance = 10) {
    const distanceToStart = this.calculateDistance(point.lat, point.lng, start.lat, start.lng);
    const distanceToEnd = this.calculateDistance(point.lat, point.lng, end.lat, end.lng);
    const segmentLength = this.calculateDistance(start.lat, start.lng, end.lat, end.lng);
    
    const distance = distanceToStart + distanceToEnd - segmentLength;
    return Math.abs(distance) <= tolerance;
  }
}

module.exports = GeoUtils;