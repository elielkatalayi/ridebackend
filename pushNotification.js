// pushNotification.js
require('dotenv').config();

const pushService = require('./services/notification/pushService');

async function testPushNotifications() {
  console.log('=== TEST PUSH NOTIFICATIONS ===\n');
  
  // REMPLACEZ CE TOKEN PAR LE VÔTRE
  const realDeviceToken = '';
  
  if (realDeviceToken === '') {
    console.log('⚠️ Veuillez remplacer par un vrai token FCM depuis votre application');
    console.log('\nPour obtenir un token:');
    console.log('1. Lancez votre app mobile');
    console.log('2. Récupérez le token FCM (voir console)');
    console.log('3. Copiez-le dans ce fichier');
    return;
  }
  
  console.log('📱 Test avec token:', realDeviceToken.substring(0, 20) + '...');
  
  // Test 1: Notification simple
  console.log('\n📤 Envoi notification simple...');
  const result1 = await pushService.sendNotification(
    realDeviceToken,
    '🧪 Test de notification',
    'Ceci est un test depuis votre serveur backend !',
    { 
      test: 'true', 
      timestamp: new Date().toISOString(),
      type: 'test'
    }
  );
  console.log('Résultat:', result1);
  
  // Test 2: Notification de course (simulation)
  console.log('\n📤 Test notification course acceptée...');
  const result2 = await pushService.notifyRideAccepted(
    realDeviceToken,
    { id: 12345 }, // ride fictif
    { 
      id: 1,
      user: { first_name: 'Jean', last_name: 'Martin' },
      eta: 3,
      vehicle_plate: 'AB-123-CD'
    }
  );
  console.log('Résultat:', result2);
  
  // Test 3: Notification de nouvelle demande
  console.log('\n📤 Test nouvelle demande course...');
  const result3 = await pushService.notifyNewRideRequest(
    realDeviceToken,
    { 
      id: 12345, 
      price_suggested: 2500,
      origin_lat: -4.4419,
      origin_lng: 15.2663,
      destination_lat: -4.3319,
      destination_lng: 15.3163
    },
    { 
      id: 1,
      first_name: 'Marie', 
      last_name: 'Diaby' 
    }
  );
  console.log('Résultat:', result3);
  
  console.log('\n✅ Tests terminés !');
}

// Exécuter le test
testPushNotifications().catch(console.error);