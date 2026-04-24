const bcrypt = require('bcryptjs');

class PasswordService {
  constructor() {
    this.saltRounds = 10;
  }

  /**
   * Hasher un mot de passe
   * @param {string} password - Mot de passe en clair
   * @returns {Promise<string>} Mot de passe hashé
   */
  async hashPassword(password) {
    return bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Vérifier un mot de passe
   * @param {string} password - Mot de passe en clair
   * @param {string} hash - Mot de passe hashé
   * @returns {Promise<boolean>}
   */
  async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Valider la force d'un mot de passe
   * @param {string} password - Mot de passe à valider
   * @returns {Object} Résultat de la validation
   */
  validatePasswordStrength(password) {
    const errors = [];
    
    if (!password || password.length < 6) {
      errors.push('Le mot de passe doit contenir au moins 6 caractères');
    }
    
    if (password.length > 100) {
      errors.push('Le mot de passe ne peut pas dépasser 100 caractères');
    }
    
    // Optionnel : vérifier la présence de chiffres
    // if (!/\d/.test(password)) {
    //   errors.push('Le mot de passe doit contenir au moins un chiffre');
    // }
    
    // Optionnel : vérifier la présence de lettres majuscules
    // if (!/[A-Z]/.test(password)) {
    //   errors.push('Le mot de passe doit contenir au moins une majuscule');
    // }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Générer un mot de passe aléatoire temporaire
   * @param {number} length - Longueur du mot de passe
   * @returns {string} Mot de passe aléatoire
   */
  generateRandomPassword(length = 10) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }
}

module.exports = new PasswordService();
