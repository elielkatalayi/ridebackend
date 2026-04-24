// services/auth/otpService.js
const { Op } = require('sequelize');
const { OtpCode } = require('../../models');
const clickatell = require('../../config/clickatell');
const env = require('../../config/env');

class OtpService {
  constructor() {
    this.otpLength = 4; // Code à 4 chiffres
    this.otpExpiryMinutes = 10;
    this.maxAttempts = 5;
  }

  /**
   * Générer un code OTP aléatoire à 4 chiffres
   */
  generateCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /**
   * Formater le numéro de téléphone (sans coder en dur l'indicatif)
   * Accepte les formats:
   * - International: +XXX XXXX XXXX
   * - Local: 0XX XXXX XXXX
   * - Chiffres seuls: XXXXXXXX
   */
  formatPhoneNumber(phone) {
    if (!phone) return phone;
    
    // Enlever tous les caractères non numériques
    let clean = phone.replace(/\D/g, '');
    
    // Si le numéro commence par 0 (format local)
    if (clean.startsWith('0')) {
      // Garder le numéro tel quel avec le 0
      // Le pays sera déterminé par la configuration ou la validation
      return clean;
    }
    
    // Si le numéro a déjà le format international (commence par un indicatif)
    // On le garde tel quel sans ajouter de préfixe
    if (clean.length >= 10 && clean.length <= 15) {
      // Vérifier si c'est un format international valide
      // Les indicatifs de pays vont de 1 à 3 chiffres
      return clean;
    }
    
    // Pour tout autre cas, retourner le numéro nettoyé
    // La validation Joi se chargera de vérifier le format
    return clean;
  }

  /**
   * Extraire l'indicatif du pays d'un numéro de téléphone
   */
  extractCountryCode(phone) {
    if (!phone) return null;
    
    const clean = phone.replace(/\D/g, '');
    
    // Liste des indicatifs internationaux (1-3 chiffres)
    // Cette liste pourrait être chargée depuis une configuration
    const countryCodes = {
      '1': ['US', 'CA'],     // USA, Canada
      '7': ['RU', 'KZ'],     // Russie, Kazakhstan
      '20': ['EG'],          // Égypte
      '27': ['ZA'],          // Afrique du Sud
      '30': ['GR'],          // Grèce
      '31': ['NL'],          // Pays-Bas
      '32': ['BE'],          // Belgique
      '33': ['FR'],          // France
      '34': ['ES'],          // Espagne
      '36': ['HU'],          // Hongrie
      '39': ['IT'],          // Italie
      '40': ['RO'],          // Roumanie
      '41': ['CH'],          // Suisse
      '43': ['AT'],          // Autriche
      '44': ['GB'],          // Royaume-Uni
      '45': ['DK'],          // Danemark
      '46': ['SE'],          // Suède
      '47': ['NO'],          // Norvège
      '48': ['PL'],          // Pologne
      '49': ['DE'],          // Allemagne
      '51': ['PE'],          // Pérou
      '52': ['MX'],          // Mexique
      '53': ['CU'],          // Cuba
      '54': ['AR'],          // Argentine
      '55': ['BR'],          // Brésil
      '56': ['CL'],          // Chili
      '57': ['CO'],          // Colombie
      '58': ['VE'],          // Venezuela
      '60': ['MY'],          // Malaisie
      '61': ['AU'],          // Australie
      '62': ['ID'],          // Indonésie
      '63': ['PH'],          // Philippines
      '64': ['NZ'],          // Nouvelle-Zélande
      '65': ['SG'],          // Singapour
      '66': ['TH'],          // Thaïlande
      '81': ['JP'],          // Japon
      '82': ['KR'],          // Corée du Sud
      '84': ['VN'],          // Viêt Nam
      '86': ['CN'],          // Chine
      '90': ['TR'],          // Turquie
      '91': ['IN'],          // Inde
      '92': ['PK'],          // Pakistan
      '93': ['AF'],          // Afghanistan
      '94': ['LK'],          // Sri Lanka
      '95': ['MM'],          // Myanmar
      '98': ['IR'],          // Iran
      '212': ['MA'],         // Maroc
      '213': ['DZ'],         // Algérie
      '216': ['TN'],         // Tunisie
      '218': ['LY'],         // Libye
      '220': ['GM'],         // Gambie
      '221': ['SN'],         // Sénégal
      '222': ['MR'],         // Mauritanie
      '223': ['ML'],         // Mali
      '224': ['GN'],         // Guinée
      '225': ['CI'],         // Côte d'Ivoire
      '226': ['BF'],         // Burkina Faso
      '227': ['NE'],         // Niger
      '228': ['TG'],         // Togo
      '229': ['BJ'],         // Bénin
      '230': ['MU'],         // Maurice
      '231': ['LR'],         // Liberia
      '232': ['SL'],         // Sierra Leone
      '233': ['GH'],         // Ghana
      '234': ['NG'],         // Nigeria
      '235': ['TD'],         // Tchad
      '236': ['CF'],         // République Centrafricaine
      '237': ['CM'],         // Cameroun
      '238': ['CV'],         // Cap-Vert
      '239': ['ST'],         // São Tomé et Príncipe
      '240': ['GQ'],         // Guinée équatoriale
      '241': ['GA'],         // Gabon
      '242': ['CG'],         // République du Congo
      '243': ['CD'],         // République Démocratique du Congo
      '244': ['AO'],         // Angola
      '245': ['GW'],         // Guinée-Bissau
      '246': ['IO'],         // Diego Garcia
      '247': ['AC'],         // Ascension
      '248': ['SC'],         // Seychelles
      '249': ['SD'],         // Soudan
      '250': ['RW'],         // Rwanda
      '251': ['ET'],         // Éthiopie
      '252': ['SO'],         // Somalie
      '253': ['DJ'],         // Djibouti
      '254': ['KE'],         // Kenya
      '255': ['TZ'],         // Tanzanie
      '256': ['UG'],         // Ouganda
      '257': ['BI'],         // Burundi
      '258': ['MZ'],         // Mozambique
      '259': ['TZ'],         // Zanzibar
      '260': ['ZM'],         // Zambie
      '261': ['MG'],         // Madagascar
      '262': ['RE', 'YT'],   // Réunion, Mayotte
      '263': ['ZW'],         // Zimbabwe
      '264': ['NA'],         // Namibie
      '265': ['MW'],         // Malawi
      '266': ['LS'],         // Lesotho
      '267': ['BW'],         // Botswana
      '268': ['SZ'],         // Swaziland
      '269': ['KM'],         // Comores
      '290': ['SH'],         // Sainte-Hélène
      '291': ['ER'],         // Érythrée
      '297': ['AW'],         // Aruba
      '298': ['FO'],         // Îles Féroé
      '299': ['GL']          // Groenland
    };
    
    // Tenter d'extraire l'indicatif (1, 2 ou 3 chiffres)
    for (let len = 3; len >= 1; len--) {
      const potentialCode = clean.substring(0, len);
      if (countryCodes[potentialCode]) {
        return {
          code: potentialCode,
          country: countryCodes[potentialCode][0],
          fullNumber: clean
        };
      }
    }
    
    return null;
  }

  /**
   * Envoyer OTP par SMS via Clickatell
   */
  async sendOtpBySms(phone, code, purpose) {
    const isConfigured = clickatell && clickatell.isConfigured;
    
    if (env.NODE_ENV === 'development' || !isConfigured) {
      console.log('\n╔═══════════════════════════════════════════════════╗');
      console.log('║     📱 CODE OTP (MODE SIMULATION)                 ║');
      console.log('╚═══════════════════════════════════════════════════╝');
      console.log(`   📞 Téléphone: ${phone}`);
      console.log(`   🔑 Code OTP: ${code} (${this.otpLength} chiffres)`);
      console.log(`   📝 Purpose: ${purpose}`);
      console.log(`   ⏰ Expire dans: ${this.otpExpiryMinutes} minutes\n`);
      
      return { success: true, simulated: true, code };
    }
    
    return await clickatell.sendOTP(phone, code, purpose);
  }

  /**
   * Envoyer OTP par Email
   */
  async sendOtpByEmail(email, code, purpose) {
    console.log(`\n╔═══════════════════════════════════════════════════╗`);
    console.log(`║     ✉️ CODE OTP PAR EMAIL (SIMULATION)           ║`);
    console.log(`╚═══════════════════════════════════════════════════╝`);
    console.log(`   📧 Email: ${email}`);
    console.log(`   🔑 Code OTP: ${code} (${this.otpLength} chiffres)`);
    console.log(`   📝 Purpose: ${purpose}`);
    console.log(`   ⏰ Expire dans: ${this.otpExpiryMinutes} minutes\n`);
    
    return { success: true, simulated: true, email, code };
  }

  /**
   * Envoyer un OTP (méthode principale)
   */
  async sendOtp(destination, channel, purpose = 'verification') {
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + this.otpExpiryMinutes * 60 * 1000);
    
    const otpData = {
      code: code,
      channel: channel,
      purpose: purpose,
      attempts: 0,
      is_used: false,
      expires_at: expiresAt
    };
    
    // Ajouter phone ou email selon le canal
    if (channel === 'sms') {
      otpData.phone = this.formatPhoneNumber(destination);
    } else {
      otpData.email = destination;
    }
    
    const otpRecord = await OtpCode.create(otpData);
    
    let result;
    if (channel === 'sms') {
      result = await this.sendOtpBySms(otpData.phone, code, purpose);
    } else {
      result = await this.sendOtpByEmail(destination, code, purpose);
    }
    
    return {
      success: true,
      otpId: otpRecord.id,
      expiresAt: expiresAt,
      simulated: result.simulated || false,
      code: result.code
    };
  }

  /**
   * Vérifier un OTP
   */
  async verifyOtp(destination, channel, code, purpose = 'verification') {
    const whereCondition = {
      code: code,
      purpose: purpose,
      is_used: false,
      expires_at: {
        [Op.gt]: new Date()
      }
    };
    
    if (channel === 'sms') {
      whereCondition.phone = this.formatPhoneNumber(destination);
    } else {
      whereCondition.email = destination;
    }
    
    const otpRecord = await OtpCode.findOne({
      where: whereCondition
    });
    
    if (!otpRecord) {
      throw new Error('Code OTP invalide ou expiré');
    }
    
    otpRecord.attempts += 1;
    
    if (otpRecord.attempts >= this.maxAttempts) {
      otpRecord.is_used = true;
      await otpRecord.save();
      throw new Error('Trop de tentatives. Veuillez demander un nouveau code.');
    }
    
    await otpRecord.save();
    
    return {
      valid: true,
      otpId: otpRecord.id
    };
  }

  /**
   * Marquer un OTP comme utilisé
   */
  async markOtpAsUsed(otpId) {
    if (!otpId) return;
    
    await OtpCode.update(
      { is_used: true },
      { where: { id: otpId } }
    );
  }

  /**
   * Invalider tous les OTPs d'un utilisateur
   */
  async invalidateAllOtps(destination, channel) {
    const whereCondition = {
      is_used: false
    };
    
    if (channel === 'sms') {
      whereCondition.phone = this.formatPhoneNumber(destination);
    } else {
      whereCondition.email = destination;
    }
    
    await OtpCode.update(
      { is_used: true },
      { where: whereCondition }
    );
  }

  /**
   * Nettoyer les OTPs expirés
   */
  async cleanupExpiredOtps() {
    const result = await OtpCode.destroy({
      where: {
        expires_at: {
          [Op.lt]: new Date()
        }
      }
    });
    
    if (result > 0) {
      console.log(`🧹 Nettoyage OTP: ${result} codes expirés supprimés`);
    }
    
    return result;
  }

  /**
   * Vérifier si un OTP est valide
   */
  async isOtpValid(destination, channel, code, purpose = 'verification') {
    try {
      const whereCondition = {
        code: code,
        purpose: purpose,
        is_used: false,
        expires_at: {
          [Op.gt]: new Date()
        }
      };
      
      if (channel === 'sms') {
        whereCondition.phone = this.formatPhoneNumber(destination);
      } else {
        whereCondition.email = destination;
      }
      
      const otpRecord = await OtpCode.findOne({ where: whereCondition });
      return !!otpRecord;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new OtpService();