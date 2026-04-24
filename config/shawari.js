const axios = require('axios');
const env = require('./env');

class ShawariService {
  constructor() {
    this.baseUrl = 'https://api.shwary.com/api/v1';
    this.merchantId = env.SHAWARI_MERCHANT_ID;
    this.merchantKey = env.SHAWARI_MERCHANT_KEY;
    this.isConfigured = !!(this.merchantId && this.merchantKey && 
                          this.merchantId !== 'votre_merchant_id' &&
                          this.merchantKey !== 'votre_merchant_key');
    
    console.log(`💳 Shawari: ${this.isConfigured ? '✅ Mode PRODUCTION' : '⚠️ Mode SIMULATION'}`);
    if (this.isConfigured) {
      console.log(`   🆔 Merchant ID: ${this.merchantId.substring(0, 8)}...`);
      console.log(`   🔑 Merchant Key: ${this.merchantKey.substring(0, 10)}...`);
      console.log(`   🌐 URL: ${this.baseUrl}`);
    }
  }

  /**
   * Obtenir le code pays pour Shwary
   */
  getCountryCode(phoneNumber) {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.startsWith('243')) return 'DRC';
    if (cleanPhone.startsWith('254')) return 'KE';
    if (cleanPhone.startsWith('256')) return 'UG';
    return 'DRC'; // Par défaut RDC
  }

  /**
   * Obtenir la devise selon le pays
   */
  getCurrency(countryCode) {
    switch (countryCode) {
      case 'DRC': return 'CDF';
      case 'KE': return 'KES';
      case 'UG': return 'UGX';
      default: return 'CDF';
    }
  }

  /**
   * Initier un paiement via Shwary (Production)
   */
  async initiatePayment(params) {
    const { amount, phoneNumber, callbackUrl, reference } = params;
    
    // Nettoyer le numéro de téléphone
    const cleanPhone = this.formatPhoneNumber(phoneNumber);
    const countryCode = this.getCountryCode(cleanPhone);
    const currency = this.getCurrency(countryCode);
    
    // Vérifier le montant minimum pour la RDC (2900 CDF)
    if (countryCode === 'DRC' && amount < 2900) {
      throw new Error(`Le montant minimum pour la RDC est de 2900 CDF (actuel: ${amount})`);
    }
    
    // Mode simulation si non configuré
    if (!this.isConfigured) {
      console.log(`💳 [SIMULATION] Paiement de ${amount} ${currency} depuis ${cleanPhone}`);
      return {
        success: true,
        simulated: true,
        transactionId: `sim_${Date.now()}`,
        status: 'completed',
        referenceId: reference || `ref_${Date.now()}`
      };
    }
    
    try {
      const payload = {
        amount: amount,
        clientPhoneNumber: cleanPhone,
        callbackUrl: callbackUrl || `${env.API_URL}/api/v1/webhooks/shawari/payment`
      };
      
      console.log(`💳 Initiation paiement Shwary:`);
      console.log(`   Pays: ${countryCode}`);
      console.log(`   Montant: ${amount} ${currency}`);
      console.log(`   Téléphone: ${cleanPhone}`);
      console.log(`   Callback: ${payload.callbackUrl}`);
      
      const response = await axios.post(
        `${this.baseUrl}/merchants/payment/${countryCode}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-merchant-id': this.merchantId,
            'x-merchant-key': this.merchantKey
          },
          timeout: 30000
        }
      );
      
      console.log(`✅ Paiement initié: ${response.data.id}`);
      console.log(`   Statut: ${response.data.status}`);
      
      return {
        success: true,
        transactionId: response.data.id,
        status: response.data.status,
        referenceId: response.data.referenceId,
        currency: response.data.currency,
        isSandbox: response.data.isSandbox || false
      };
    } catch (error) {
      console.error('❌ Erreur Shwary:', error.response?.data || error.message);
      
      // En cas d'erreur, retourner une simulation
      return {
        success: false,
        simulated: true,
        error: error.response?.data?.message || error.message,
        transactionId: `err_${Date.now()}`,
        status: 'failed'
      };
    }
  }

  /**
   * Vérifier le statut d'une transaction
   */
  async checkPaymentStatus(transactionId) {
    if (!this.isConfigured) {
      return {
        success: true,
        simulated: true,
        transactionId,
        status: 'completed'
      };
    }
    
    try {
      const response = await axios.get(
        `${this.baseUrl}/merchants/transactions/${transactionId}`,
        {
          headers: {
            'x-merchant-id': this.merchantId,
            'x-merchant-key': this.merchantKey
          }
        }
      );
      
      return {
        success: true,
        transactionId: response.data.id,
        status: response.data.status,
        amount: response.data.amount,
        currency: response.data.currency,
        failureReason: response.data.failureReason,
        completedAt: response.data.completedAt,
        isSandbox: response.data.isSandbox
      };
    } catch (error) {
      console.error('❌ Erreur vérification statut:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        status: 'unknown'
      };
    }
  }

  /**
   * Formater le numéro de téléphone (format E.164)
   */
  formatPhoneNumber(phone) {
    let clean = phone.replace(/\D/g, '');
    
    // Si le numéro commence par 0 (0XX XXX XXX)
    if (clean.startsWith('0') && clean.length === 9) {
      clean = '243' + clean.substring(1);
    }
    
    // Si le numéro commence par +243
    if (clean.startsWith('243') && clean.length === 12) {
      return `+${clean}`;
    }
    
    // Si le numéro a déjà le bon format
    if (clean.length === 12 && clean.startsWith('243')) {
      return `+${clean}`;
    }
    
    // Par défaut, ajouter +243
    if (clean.length === 9) {
      return `+243${clean}`;
    }
    
    return `+${clean}`;
  }
}

module.exports = new ShawariService();