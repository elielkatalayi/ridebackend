// services/auth/otpService.js
const { Op } = require('sequelize');
const { Otp } = require('../../models');  // ← Utiliser "Otp" pas "OtpCode"
const clickatell = require('../../config/clickatell');
const env = require('../../config/env');

class OtpService {
  constructor() {
    this.otpExpiryMinutes = 10;
    this.maxAttempts = 5;
  }

  /**
   * Générer un code OTP aléatoire à 6 chiffres
   */
  generateCode() {
    // Générer un code à 6 chiffres (de 100000 à 999999)
    const min = 100000;
    const max = 999999;
    const code = Math.floor(min + Math.random() * (max - min + 1));
    return code.toString();
  }

  /**
   * Formater le numéro de téléphone
   */
  formatPhoneNumber(phone) {
    if (!phone) return phone;
    // Enlever tous les caractères non numériques
    let clean = phone.replace(/\D/g, '');
    return clean;
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
      console.log(`   🔑 Code OTP: ${code}`);
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
    console.log(`   🔑 Code OTP: ${code}`);
    console.log(`   📝 Purpose: ${purpose}`);
    console.log(`   ⏰ Expire dans: ${this.otpExpiryMinutes} minutes\n`);
    
    return { success: true, simulated: true, email, code };
  }

  /**
   * Envoyer un OTP (méthode principale)
   * POST /api/v1/auth/send-otp
   */
  async sendOtp(destination, channel, purpose = 'verification') {
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + this.otpExpiryMinutes * 60 * 1000);
    
    // Créer l'OTP en base de données
    const otpData = {
      destination: destination,
      channel: channel,
      code: code,
      purpose: purpose,
      attempts: 0,
      is_used: false,
      is_valid: true,
      expires_at: expiresAt
    };
    
    const otpRecord = await Otp.create(otpData);
    
    // Envoyer selon le canal
    let result;
    if (channel === 'sms') {
      const formattedPhone = this.formatPhoneNumber(destination);
      result = await this.sendOtpBySms(formattedPhone, code, purpose);
    } else if (channel === 'email') {
      result = await this.sendOtpByEmail(destination, code, purpose);
    } else {
      // whatsapp ou autre
      result = await this.sendOtpBySms(destination, code, purpose);
    }
    
    return {
      otpId: otpRecord.id,
      expiresAt: expiresAt,
      simulated: result.simulated || false,
      code: result.code // Pour le debug seulement
    };
  }

  /**
   * Vérifier un OTP avec son ID et son code (VÉRIFICATION À DEUX NIVEAUX)
   * POST /api/v1/auth/verify-otp
   */
  async verifyOtpWithId(otpId, code, destination, purpose) {
    try {
      console.log('🔍 Vérification OTP avec ID:', { otpId, destination, purpose });
      
      // Construire la condition WHERE
      const whereCondition = {
        id: otpId,
        purpose: purpose,
        is_used: false,
        is_valid: true,
        expires_at: {
          [Op.gt]: new Date()  // Non expiré
        }
      };
      
      // Ajouter la destination
      whereCondition.destination = destination;
      
      console.log('🔍 Condition WHERE:', whereCondition);
      
      // Chercher l'OTP dans la base
      const otpRecord = await Otp.findOne({
        where: whereCondition
      });
      
      // NIVEAU 1: Vérifier si l'OTP existe
      if (!otpRecord) {
        console.log('❌ OTP non trouvé ou expiré');
        return {
          isValid: false,
          message: 'Code OTP invalide ou expiré'
        };
      }
      
      console.log('✅ OTP trouvé, vérification du code...');
      
      // NIVEAU 2: Vérifier le code
      const isValidCode = (otpRecord.code === code);
      
      if (!isValidCode) {
        // Incrémenter le compteur de tentatives
        otpRecord.attempts = (otpRecord.attempts || 0) + 1;
        
        // Bloquer après maxAttempts tentatives
        if (otpRecord.attempts >= this.maxAttempts) {
          otpRecord.is_valid = false;
          await otpRecord.save();
          return {
            isValid: false,
            message: 'Trop de tentatives. Veuillez demander un nouveau code.'
          };
        }
        
        await otpRecord.save();
        
        const remainingAttempts = this.maxAttempts - otpRecord.attempts;
        return {
          isValid: false,
          message: `Code OTP incorrect. Il vous reste ${remainingAttempts} tentative(s).`
        };
      }
      
      console.log('✅ Code OTP valide !');
      
      return {
        isValid: true,
        otpId: otpRecord.id,
        otpRecord: otpRecord
      };
      
    } catch (error) {
      console.error('❌ Erreur verifyOtpWithId:', error);
      return {
        isValid: false,
        message: 'Erreur lors de la vérification'
      };
    }
  }

  /**
   * Marquer un OTP comme utilisé
   */
  async markOtpAsUsed(otpId) {
    if (!otpId) return;
    
    await Otp.update(
      { is_used: true },
      { where: { id: otpId } }
    );
  }

  /**
   * Invalider tous les OTPs d'un utilisateur
   */
  async invalidateAllOtps(destination, purpose = null) {
    const whereCondition = {
      destination: destination,
      is_used: false,
      is_valid: true
    };
    
    if (purpose) {
      whereCondition.purpose = purpose;
    }
    
    await Otp.update(
      { is_valid: false },
      { where: whereCondition }
    );
  }

  /**
   * Nettoyer les OTPs expirés
   */
  async cleanupExpiredOtps() {
    const result = await Otp.destroy({
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
   * Vérifier si un OTP est valide (sans le marquer)
   */
  async isOtpValid(otpId, destination, purpose) {
    try {
      const otpRecord = await Otp.findOne({
        where: {
          id: otpId,
          destination: destination,
          purpose: purpose,
          is_used: false,
          is_valid: true,
          expires_at: {
            [Op.gt]: new Date()
          }
        }
      });
      return !!otpRecord;
    } catch (error) {
      return false;
    }
  }

  /**
   * Envoyer OTP avec message personnalisé (pour changement de numéro)
   */
  async sendCustomOtp(destination, channel, purpose, customMessage) {
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + this.otpExpiryMinutes * 60 * 1000);
    
    const otpRecord = await Otp.create({
      destination: destination,
      channel: channel,
      code: code,
      purpose: purpose,
      attempts: 0,
      is_used: false,
      is_valid: true,
      expires_at: expiresAt
    });
    
    // Afficher le message personnalisé
    console.log('\n╔═══════════════════════════════════════════════════╗');
    console.log('║     📱 CODE OTP AVEC MESSAGE PERSONNALISÉ        ║');
    console.log('╚═══════════════════════════════════════════════════╝');
    console.log(`   📞 Destination: ${destination}`);
    console.log(`   🔑 Code OTP: ${code}`);
    console.log(`   📝 Message: ${customMessage}`);
    console.log(`   ⏰ Expire dans: ${this.otpExpiryMinutes} minutes\n`);
    
    return {
      otpId: otpRecord.id,
      expiresAt: expiresAt,
      code: code
    };
  }
}

module.exports = new OtpService();