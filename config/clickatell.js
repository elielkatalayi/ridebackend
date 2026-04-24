const axios = require('axios');
const env = require('./env');

class ClickatellService {
  constructor() {
    this.apiKey = env.CLICKATELL_API_KEY;
    this.apiUrl = 'https://platform.clickatell.com/v1/message';
    
    // Vérifier si la clé API est valide
    const isValidApiKey = this.apiKey && 
                          this.apiKey !== 'votre_api_key_clickatell' &&
                          this.apiKey.length > 10;
    
    this.isConfigured = isValidApiKey;
    
    console.log(`📱 Clickatell: ${this.isConfigured ? '✅ Mode RÉEL' : '❌ NON CONFIGURÉ'}`);
    if (this.isConfigured) {
      console.log(`   🔑 API Key: ${this.apiKey.substring(0, 8)}...`);
      console.log(`   🌐 URL: ${this.apiUrl}`);
    } else {
      console.error(`   ⚠️ ERREUR: Clickatell non configuré - Les SMS ne pourront pas être envoyés !`);
    }
  }

  /**
   * Envoi d'un SMS via Clickatell (sans simulation)
   */
  async sendSMS(phoneNumber, message) {
    // Vérifier si configuré
    if (!this.isConfigured) {
      throw new Error('Clickatell n\'est pas configuré. Veuillez vérifier votre CLICKATELL_API_KEY');
    }
    
    try {
      const cleanPhone = this.formatPhoneNumber(phoneNumber);
      
      console.log(`📤 Envoi SMS réel à ${cleanPhone}...`);
      
      // Format correct selon la documentation Clickatell
      const payload = {
        messages: [
          {
            channel: "sms",
            to: cleanPhone,
            content: message
          }
        ]
      };
      
      console.log('📦 Payload:', JSON.stringify(payload, null, 2));
      
      const response = await axios.post(
        this.apiUrl,
        payload,
        {
          headers: {
            'Authorization': this.apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 30000
        }
      );

      // Vérifier si le message a été accepté
      if (response.data && response.data.messages && response.data.messages[0]) {
        const messageResult = response.data.messages[0];
        
        if (messageResult.accepted === true) {
          console.log(`✅ SMS envoyé avec succès à ${cleanPhone}`);
          console.log(`   Message ID: ${messageResult.apiMessageId}`);
          return {
            success: true,
            messageId: messageResult.apiMessageId,
            phone: cleanPhone,
            data: response.data
          };
        } else {
          // Le message n'a pas été accepté
          const errorMsg = messageResult.error?.description || 'Erreur inconnue';
          console.error(`❌ SMS non accepté pour ${cleanPhone}: ${errorMsg}`);
          throw new Error(`SMS non accepté: ${errorMsg}`);
        }
      } else {
        throw new Error('Réponse inattendue de Clickatell');
      }
    } catch (error) {
      console.error('❌ Erreur Clickatell:', error.response?.data || error.message);
      throw new Error(`Échec envoi SMS: ${error.message}`);
    }
  }

  /**
   * Envoi d'un code OTP
   */
  async sendOTP(phoneNumber, code, purpose = 'verification') {
    let message = '';
    
    switch (purpose) {
      case 'register':
        message = `Bienvenue sur MediBE ! Votre code de vérification est : ${code}. Valable 10 minutes.`;
        break;
      case 'login':
        message = `Votre code de connexion MediBE est : ${code}. Valable 10 minutes.`;
        break;
      case 'reset':
        message = `Votre code de réinitialisation MediBE est : ${code}. Valable 10 minutes.`;
        break;
      case 'payment':
        message = `Votre code de confirmation de paiement MediBE est : ${code}. Valable 5 minutes.`;
        break;
      default:
        message = `Votre code MediBE est : ${code}. Valable 10 minutes.`;
    }
    
    return await this.sendSMS(phoneNumber, message);
  }

  /**
   * Formater le numéro de téléphone au format international
   * Clickatell attend le format: 243XXXXXXXXX (sans +)
   */
  formatPhoneNumber(phone) {
    // Enlever tous les caractères non numériques
    let clean = phone.replace(/\D/g, '');
    
    // Si le numéro commence par 0 (0XX XXX XXX)
    if (clean.startsWith('0') && clean.length === 10) {
      clean = '243' + clean.substring(1);
    }
    
    // Si le numéro commence par +243, enlever le +
    if (clean.startsWith('243') && clean.length === 12) {
      return clean;
    }
    
    // Si le numéro a déjà le bon format
    if (clean.length === 12 && clean.startsWith('243')) {
      return clean;
    }
    
    // Par défaut, ajouter 243
    if (clean.length === 9) {
      return '243' + clean;
    }
    
    return clean;
  }

  /**
   * Générer un code OTP aléatoire à 6 chiffres
   */
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}

module.exports = new ClickatellService();