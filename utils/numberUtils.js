/**
 * Utilitaires pour les nombres
 */
class NumberUtils {
  /**
   * Formater un nombre en monnaie
   * @param {number} amount - Montant
   * @param {string} currency - Symbole de la devise (default: 'FC')
   * @returns {string}
   */
  static formatMoney(amount, currency = 'FC') {
    if (amount === null || amount === undefined) return `0 ${currency}`;
    return `${amount.toLocaleString('fr-FR')} ${currency}`;
  }

  /**
   * Formater un nombre avec séparateur de milliers
   * @param {number} number - Nombre
   * @returns {string}
   */
  static formatNumber(number) {
    return number.toLocaleString('fr-FR');
  }

  /**
   * Arrondir à 2 décimales
   * @param {number} number - Nombre
   * @returns {number}
   */
  static round(number) {
    return Math.round(number * 100) / 100;
  }

  /**
   * Calculer le pourcentage
   * @param {number} value - Valeur
   * @param {number} total - Total
   * @returns {number}
   */
  static percentage(value, total) {
    if (total === 0) return 0;
    return (value / total) * 100;
  }

  /**
   * Calculer la commission
   * @param {number} amount - Montant
   * @param {number} rate - Taux en pourcentage (ex: 10 pour 10%)
   * @returns {number}
   */
  static calculateCommission(amount, rate) {
    return Math.floor(amount * rate / 100);
  }

  /**
   * Calculer la TVA
   * @param {number} amount - Montant HT
   * @param {number} rate - Taux TVA (default: 18%)
   * @returns {number}
   */
  static calculateVAT(amount, rate = 18) {
    return Math.floor(amount * rate / 100);
  }

  /**
   * Limiter un nombre entre min et max
   * @param {number} value - Valeur
   * @param {number} min - Minimum
   * @param {number} max - Maximum
   * @returns {number}
   */
  static clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Générer un nombre aléatoire entre min et max
   * @param {number} min - Minimum
   * @param {number} max - Maximum
   * @returns {number}
   */
  static random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Vérifier si un nombre est un entier
   * @param {number} number - Nombre
   * @returns {boolean}
   */
  static isInteger(number) {
    return Number.isInteger(number);
  }

  /**
   * Formater un nombre de téléphone
   * @param {string} phone - Numéro de téléphone
   * @returns {string}
   */
  static formatPhoneNumber(phone) {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('243') && cleaned.length === 12) {
      return `+${cleaned}`;
    }
    
    if (cleaned.length === 9) {
      return `+243${cleaned}`;
    }
    
    return phone;
  }

  /**
   * Obtenir le nom de l'opérateur mobile
   * @param {string} phone - Numéro de téléphone
   * @returns {string}
   */
  static getMobileOperator(phone) {
    const formatted = this.formatPhoneNumber(phone);
    
    if (formatted.startsWith('+24381') || formatted.startsWith('+24382')) {
      return 'vodacom'; // M-Pesa
    }
    if (formatted.startsWith('+24383') || formatted.startsWith('+24384')) {
      return 'orange';
    }
    if (formatted.startsWith('+24385') || formatted.startsWith('+24386')) {
      return 'airtel';
    }
    if (formatted.startsWith('+24389') || formatted.startsWith('+24388')) {
      return 'africell';
    }
    
    return 'unknown';
  }

  /**
   * Extraire les chiffres d'une chaîne
   * @param {string} str - Chaîne
   * @returns {string}
   */
  static extractDigits(str) {
    return str.replace(/\D/g, '');
  }

  /**
   * Générer un code aléatoire
   * @param {number} length - Longueur du code
   * @param {boolean} includeLetters - Inclure des lettres
   * @returns {string}
   */
  static generateCode(length = 6, includeLetters = false) {
    let charset = '0123456789';
    if (includeLetters) {
      charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    }
    
    let code = '';
    for (let i = 0; i < length; i++) {
      code += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    return code;
  }

  /**
   * Générer un ID unique
   * @param {string} prefix - Préfixe
   * @returns {string}
   */
  static generateUniqueId(prefix = 'MD') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }
}

module.exports = NumberUtils;