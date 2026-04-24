const crypto = require('crypto');

/**
 * Utilitaires de chiffrement
 */
class EncryptionUtils {
  constructor() {
    this.algorithm = 'aes-256-cbc';
    this.secretKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
    this.ivLength = 16;
  }

  /**
   * Chiffrer une chaîne
   * @param {string} text - Texte à chiffrer
   * @returns {string} Texte chiffré (base64)
   */
  encrypt(text) {
    const iv = crypto.randomBytes(this.ivLength);
    const key = Buffer.from(this.secretKey, 'hex');
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    return `${iv.toString('base64')}:${encrypted}`;
  }

  /**
   * Déchiffrer une chaîne
   * @param {string} encryptedText - Texte chiffré
   * @returns {string} Texte déchiffré
   */
  decrypt(encryptedText) {
    const [ivBase64, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivBase64, 'base64');
    const key = Buffer.from(this.secretKey, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Hasher un texte (SHA-256)
   * @param {string} text - Texte à hasher
   * @returns {string} Hash
   */
  hash(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  /**
   * Hasher un texte avec HMAC
   * @param {string} text - Texte à hasher
   * @param {string} secret - Secret
   * @returns {string}
   */
  hmac(text, secret) {
    return crypto.createHmac('sha256', secret).update(text).digest('hex');
  }

  /**
   * Générer une signature de requête
   * @param {Object} data - Données
   * @param {string} secret - Secret
   * @returns {string}
   */
  generateSignature(data, secret) {
    const sortedKeys = Object.keys(data).sort();
    const stringToSign = sortedKeys.map(key => `${key}=${data[key]}`).join('&');
    return this.hmac(stringToSign, secret);
  }

  /**
   * Vérifier une signature
   * @param {Object} data - Données
   * @param {string} signature - Signature à vérifier
   * @param {string} secret - Secret
   * @returns {boolean}
   */
  verifySignature(data, signature, secret) {
    const expectedSignature = this.generateSignature(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Générer un token aléatoire sécurisé
   * @param {number} length - Longueur
   * @returns {string}
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Masquer les données sensibles
   * @param {string} text - Texte à masquer
   * @param {number} visibleStart - Caractères visibles au début
   * @param {number} visibleEnd - Caractères visibles à la fin
   * @returns {string}
   */
  maskData(text, visibleStart = 3, visibleEnd = 2) {
    if (!text) return '';
    if (text.length <= visibleStart + visibleEnd) {
      return '*'.repeat(text.length);
    }
    
    const start = text.substring(0, visibleStart);
    const end = text.substring(text.length - visibleEnd);
    const middle = '*'.repeat(text.length - visibleStart - visibleEnd);
    
    return start + middle + end;
  }

  /**
   * Masquer un numéro de téléphone
   * @param {string} phone - Numéro de téléphone
   * @returns {string}
   */
  maskPhone(phone) {
    return this.maskData(phone, 3, 2);
  }

  /**
   * Masquer une adresse email
   * @param {string} email - Adresse email
   * @returns {string}
   */
  maskEmail(email) {
    if (!email) return '';
    const [local, domain] = email.split('@');
    if (!domain) return this.maskData(email, 2, 2);
    
    const maskedLocal = this.maskData(local, 2, 1);
    return `${maskedLocal}@${domain}`;
  }

  /**
   * Générer un ID unique pour les transactions
   * @param {string} prefix - Préfixe
   * @returns {string}
   */
  generateTransactionId(prefix = 'TXN') {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }

  /**
   * Générer une clé API
   * @returns {string}
   */
  generateApiKey() {
    return crypto.randomBytes(32).toString('base64');
  }
}

module.exports = new EncryptionUtils();