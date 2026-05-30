// test-shawari.js - Test complet de l'API Shawari
const axios = require('axios');
require('dotenv').config();

class ShawariTest {
  constructor() {
    // Configuration
    this.merchantId = process.env.SHAWARI_MERCHANT_ID || '6e62166a-c303-4cff-bae8-6d3077a89899';
    this.merchantKey = process.env.SHAWARI_MERCHANT_KEY || 'shwary_95cb9241-02ed-497c-9910-8bcf2f92c3b7';
    this.baseUrl = 'https://api.shwary.com/api/v1';
    
    console.log('🧪 TEST SHAWARI API\n');
    console.log('📋 Configuration:');
    console.log(`   Merchant ID: ${this.merchantId.substring(0, 8)}...`);
    console.log(`   Merchant Key: ${this.merchantKey.substring(0, 10)}...`);
    console.log(`   Base URL: ${this.baseUrl}\n`);
  }

  /**
   * Formater le numéro de téléphone
   */
  formatPhoneNumber(phone) {
    let clean = phone.toString().replace(/\D/g, '');
    if (clean.startsWith('0') && clean.length === 9) {
      clean = '243' + clean.substring(1);
    }
    if (clean.length === 9) {
      return `+243${clean}`;
    }
    if (clean.startsWith('243') && clean.length === 12) {
      return `+${clean}`;
    }
    return `+${clean}`;
  }

  /**
   * Test 1: Vérifier que l'API est accessible
   */
  async testApiHealth() {
    console.log('📡 Test 1: Vérification de l\'API...');
    try {
      const response = await axios.get('https://api.shwary.com', {
        timeout: 5000,
        validateStatus: false
      });
      console.log(`   ✅ API accessible - Status: ${response.status}`);
      return true;
    } catch (error) {
      console.log(`   ❌ API inaccessible - ${error.code || error.message}`);
      return false;
    }
  }

  /**
   * Test 2: Initier un paiement réel
   */
  async testRealPayment(amount = 2900, phoneNumber = '+243823883575') {
    console.log(`\n💰 Test 2: Initier un paiement réel (${amount} CDF)...`);
    
    const payload = {
      amount: amount,
      clientPhoneNumber: this.formatPhoneNumber(phoneNumber),
      callbackUrl: 'https://webhook.site/test-shawari'
    };
    
    try {
      const response = await axios.post(
        `${this.baseUrl}/merchants/payment/DRC`,
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
      
      console.log(`   ✅ Paiement réussi !`);
      console.log(`   📝 Transaction ID: ${response.data.id}`);
      console.log(`   📊 Statut: ${response.data.status}`);
      console.log(`   🏷️  Référence: ${response.data.referenceId}`);
      console.log(`   💰 Devise: ${response.data.currency}`);
      console.log(`   🧪 Sandbox: ${response.data.isSandbox ? 'Oui' : 'Non'}`);
      
      return response.data;
      
    } catch (error) {
      console.log(`   ❌ Échec paiement réel`);
      
      if (error.response) {
        console.log(`   📛 Status: ${error.response.status}`);
        console.log(`   📝 Message: ${error.response.data?.message || error.response.data?.title}`);
        console.log(`   📄 Détail: ${error.response.data?.detail || JSON.stringify(error.response.data)}`);
      } else if (error.code) {
        console.log(`   🔌 Erreur réseau: ${error.code}`);
        console.log(`   📝 Message: ${error.message}`);
      }
      
      return null;
    }
  }

  /**
   * Test 3: Initier un paiement sandbox
   */
  async testSandboxPayment(amount = 2900, phoneNumber = '+243823883575') {
    console.log(`\n🧪 Test 3: Initier un paiement SANDBOX (${amount} CDF)...`);
    
    const payload = {
      amount: amount,
      clientPhoneNumber: this.formatPhoneNumber(phoneNumber),
      callbackUrl: 'https://webhook.site/test-shawari-sandbox'
    };
    
    try {
      const response = await axios.post(
        `${this.baseUrl}/merchants/payment/sandbox/DRC`,
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
      
      console.log(`   ✅ Paiement sandbox réussi !`);
      console.log(`   📝 Transaction ID: ${response.data.id}`);
      console.log(`   📊 Statut: ${response.data.status}`);
      console.log(`   🏷️  Référence: ${response.data.referenceId}`);
      console.log(`   🧪 Sandbox: ${response.data.isSandbox ? 'Oui ✅' : 'Non'}`);
      
      // Attendre 6 secondes pour la complétion automatique du sandbox
      console.log(`   ⏳ Attente de la complétion automatique (6s)...`);
      await new Promise(resolve => setTimeout(resolve, 6000));
      
      // Vérifier le statut après complétion
      await this.testCheckStatus(response.data.id);
      
      return response.data;
      
    } catch (error) {
      console.log(`   ❌ Échec paiement sandbox`);
      
      if (error.response) {
        console.log(`   📛 Status: ${error.response.status}`);
        console.log(`   📝 Message: ${error.response.data?.message || error.response.data?.title}`);
      } else if (error.code) {
        console.log(`   🔌 Erreur réseau: ${error.code}`);
      }
      
      return null;
    }
  }

  /**
   * Test 4: Vérifier le statut d'une transaction
   */
  async testCheckStatus(transactionId) {
    console.log(`\n🔍 Test 4: Vérification du statut...`);
    
    if (!transactionId) {
      console.log(`   ⚠️ Aucun transaction ID fourni`);
      return;
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
      
      console.log(`   ✅ Statut récupéré !`);
      console.log(`   📊 Statut: ${response.data.status}`);
      console.log(`   💰 Montant: ${response.data.amount} ${response.data.currency}`);
      
      if (response.data.status === 'completed') {
        console.log(`   ✅ Transaction complétée !`);
        console.log(`   ⏰ Date: ${response.data.completedAt}`);
        if (response.data.txHash) {
          console.log(`   🔗 Hash: ${response.data.txHash}`);
        }
      } else if (response.data.status === 'failed') {
        console.log(`   ❌ Transaction échouée`);
        console.log(`   📝 Raison: ${response.data.failureReason}`);
      }
      
      return response.data;
      
    } catch (error) {
      console.log(`   ❌ Échec vérification`);
      if (error.response) {
        console.log(`   📛 Status: ${error.response.status}`);
        console.log(`   📝 Message: ${error.response.data?.message}`);
      }
      return null;
    }
  }

  /**
   * Test 5: Tester avec différents montants
   */
  async testAmounts() {
    console.log(`\n📊 Test 5: Test avec différents montants...`);
    
    const amounts = [1000, 2900, 5000, 10000];
    
    for (const amount of amounts) {
      console.log(`\n   Test montant: ${amount} CDF`);
      
      const payload = {
        amount: amount,
        clientPhoneNumber: '+243823883575'
      };
      
      try {
        const response = await axios.post(
          `${this.baseUrl}/merchants/payment/sandbox/DRC`,
          payload,
          {
            headers: {
              'x-merchant-id': this.merchantId,
              'x-merchant-key': this.merchantKey
            },
            timeout: 10000
          }
        );
        
        console.log(`   ✅ Montant ${amount}: Accepté (ID: ${response.data.id.substring(0, 8)}...)`);
        
      } catch (error) {
        if (error.response?.status === 400) {
          console.log(`   ❌ Montant ${amount}: Refusé - ${error.response.data?.message}`);
        } else if (error.code === 'ECONNABORTED') {
          console.log(`   ⏰ Montant ${amount}: Timeout`);
        } else {
          console.log(`   ❌ Montant ${amount}: Erreur - ${error.message}`);
        }
      }
      
      // Pause entre les requêtes
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * Test 6: Tester différents numéros de téléphone
   */
  async testPhoneNumbers() {
    console.log(`\n📞 Test 6: Test avec différents numéros...`);
    
    const phones = [
      '+243823883575',
      '0823883575',
      '243823883575',
      '+254712345678',  // Kenya
      '+256712345678'   // Uganda
    ];
    
    for (const phone of phones) {
      console.log(`\n   Test numéro: ${phone}`);
      
      const payload = {
        amount: 2900,
        clientPhoneNumber: this.formatPhoneNumber(phone)
      };
      
      let countryCode = 'DRC';
      if (phone.includes('254')) countryCode = 'KE';
      if (phone.includes('256')) countryCode = 'UG';
      
      try {
        const response = await axios.post(
          `${this.baseUrl}/merchants/payment/sandbox/${countryCode}`,
          payload,
          {
            headers: {
              'x-merchant-id': this.merchantId,
              'x-merchant-key': this.merchantKey
            },
            timeout: 10000
          }
        );
        
        console.log(`   ✅ ${phone} -> ${countryCode}: Accepté`);
        
      } catch (error) {
        if (error.response) {
          console.log(`   ❌ ${phone}: Erreur ${error.response.status} - ${error.response.data?.message}`);
        } else {
          console.log(`   ❌ ${phone}: ${error.message}`);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  /**
   * Exécuter tous les tests
   */
  async runAllTests() {
    console.log('🚀 DÉBUT DES TESTS SHAWARI\n');
    console.log('=' .repeat(60));
    
    // Test 1: Vérifier l'API
    const apiAvailable = await this.testApiHealth();
    
    // Test 2: Paiement réel
    const realPayment = await this.testRealPayment();
    
    // Test 3: Paiement sandbox (recommandé)
    const sandboxPayment = await this.testSandboxPayment();
    
    // Test 4: Vérification statut
    if (sandboxPayment?.id) {
      await this.testCheckStatus(sandboxPayment.id);
    }
    
    // Test 5: Différents montants
    await this.testAmounts();
    
    // Test 6: Différents numéros
    await this.testPhoneNumbers();
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ DES TESTS\n');
    
    if (apiAvailable) {
      console.log('✅ API accessible');
    } else {
      console.log('⚠️ API inaccessible (peut être normal en développement)');
    }
    
    if (realPayment) {
      console.log('✅ Paiement réel: OK');
    } else {
      console.log('⚠️ Paiement réel: Échec (API Shawari peut être en panne)');
    }
    
    if (sandboxPayment) {
      console.log('✅ Paiement sandbox: OK');
    } else {
      console.log('❌ Paiement sandbox: Échec (vérifiez vos clés)');
    }
    
    console.log('\n💡 Conclusion:');
    if (!apiAvailable) {
      console.log('   L\'API Shawari semble être en panne (502). Contactez leur support.');
    } else if (!sandboxPayment && realPayment) {
      console.log('   Le sandbox ne fonctionne pas mais le réel oui.');
    } else if (!sandboxPayment && !realPayment) {
      console.log('   Problème d\'authentification - Vérifiez vos clés API.');
    } else {
      console.log('   Tout fonctionne correctement !');
    }
    
    console.log('\n🏁 FIN DES TESTS\n');
  }
}

// Exécuter les tests
const tester = new ShawariTest();
tester.runAllTests().catch(console.error);