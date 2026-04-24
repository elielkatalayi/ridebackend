/**
 * Utilitaires de dates
 */
class DateUtils {
  /**
   * Formater une date
   * @param {Date} date - Date à formater
   * @param {string} format - Format (default: 'YYYY-MM-DD HH:mm:ss')
   * @returns {string}
   */
  static formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  }

  /**
   * Obtenir la différence entre deux dates
   * @param {Date} date1 - Première date
   * @param {Date} date2 - Deuxième date
   * @param {string} unit - Unité (seconds, minutes, hours, days)
   * @returns {number}
   */
  static diff(date1, date2, unit = 'seconds') {
    const diffMs = Math.abs(new Date(date1) - new Date(date2));
    const diffSeconds = diffMs / 1000;
    
    switch (unit) {
      case 'seconds': return diffSeconds;
      case 'minutes': return diffSeconds / 60;
      case 'hours': return diffSeconds / 3600;
      case 'days': return diffSeconds / 86400;
      default: return diffSeconds;
    }
  }

  /**
   * Ajouter du temps à une date
   * @param {Date} date - Date de base
   * @param {number} value - Valeur à ajouter
   * @param {string} unit - Unité (seconds, minutes, hours, days, months, years)
   * @returns {Date}
   */
  static add(date, value, unit) {
    const result = new Date(date);
    
    switch (unit) {
      case 'seconds': result.setSeconds(result.getSeconds() + value); break;
      case 'minutes': result.setMinutes(result.getMinutes() + value); break;
      case 'hours': result.setHours(result.getHours() + value); break;
      case 'days': result.setDate(result.getDate() + value); break;
      case 'months': result.setMonth(result.getMonth() + value); break;
      case 'years': result.setFullYear(result.getFullYear() + value); break;
    }
    
    return result;
  }

  /**
   * Vérifier si une date est passée
   * @param {Date} date - Date à vérifier
   * @returns {boolean}
   */
  static isPast(date) {
    return new Date(date) < new Date();
  }

  /**
   * Vérifier si une date est future
   * @param {Date} date - Date à vérifier
   * @returns {boolean}
   */
  static isFuture(date) {
    return new Date(date) > new Date();
  }

  /**
   * Obtenir le début de la journée
   * @param {Date} date - Date
   * @returns {Date}
   */
  static startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Obtenir la fin de la journée
   * @param {Date} date - Date
   * @returns {Date}
   */
  static endOfDay(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  /**
   * Obtenir le début de la semaine (lundi)
   * @param {Date} date - Date
   * @returns {Date}
   */
  static startOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day === 0 ? 6 : day - 1);
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Obtenir la fin de la semaine (dimanche)
   * @param {Date} date - Date
   * @returns {Date}
   */
  static endOfWeek(date) {
    const d = this.startOfWeek(date);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  /**
   * Obtenir le début du mois
   * @param {Date} date - Date
   * @returns {Date}
   */
  static startOfMonth(date) {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Obtenir la fin du mois
   * @param {Date} date - Date
   * @returns {Date}
   */
  static endOfMonth(date) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  /**
   * Formater une durée en texte lisible
   * @param {number} seconds - Durée en secondes
   * @returns {string}
   */
  static formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}min`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    
    return parts.join(' ');
  }

  /**
   * Obtenir le temps relatif (il y a X minutes, etc.)
   * @param {Date} date - Date
   * @returns {string}
   */
  static getRelativeTime(date) {
    const now = new Date();
    const diffSeconds = Math.floor((now - new Date(date)) / 1000);
    
    if (diffSeconds < 60) return 'à l\'instant';
    if (diffSeconds < 3600) return `il y a ${Math.floor(diffSeconds / 60)} min`;
    if (diffSeconds < 86400) return `il y a ${Math.floor(diffSeconds / 3600)} h`;
    if (diffSeconds < 604800) return `il y a ${Math.floor(diffSeconds / 86400)} j`;
    
    return this.formatDate(date, 'DD/MM/YYYY');
  }

  /**
   * Vérifier si deux dates sont le même jour
   * @param {Date} date1 - Première date
   * @param {Date} date2 - Deuxième date
   * @returns {boolean}
   */
  static isSameDay(date1, date2) {
    return this.startOfDay(date1).getTime() === this.startOfDay(date2).getTime();
  }
}

module.exports = DateUtils;