// backend/config/firebase.js - Version CORRIGÉE
const admin = require('firebase-admin');
require('dotenv').config();
const env = require('./env');

// ✅ Vérifier que toutes les variables existent
const requiredEnvVars = [
  'FIREBASE_TYPE',
  'FIREBASE_PROJECT_ID', 
  'FIREBASE_PRIVATE_KEY_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_CLIENT_ID'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Variable d'environnement manquante: ${envVar}`);
  }
}

// ✅ Construction correcte du service account
const serviceAccount = {
  type: process.env.FIREBASE_TYPE || 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID,  // ← Vérifie que cette variable existe
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
  token_uri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
  universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN || 'googleapis.com'
};

// ✅ Vérification explicite
if (!serviceAccount.project_id) {
  console.error('❌ FIREBASE_PROJECT_ID est manquant dans .env');
  console.log('📋 Valeurs actuelles:', {
    has_type: !!serviceAccount.type,
    has_project_id: !!serviceAccount.project_id,
    has_private_key_id: !!serviceAccount.private_key_id,
    has_private_key: !!serviceAccount.private_key,
    has_client_email: !!serviceAccount.client_email,
    has_client_id: !!serviceAccount.client_id
  });
}

let messaging = null;
let adminInstance = null;

try {
  if (serviceAccount.project_id) {
    adminInstance = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    messaging = admin.messaging();
    console.log('✅ Firebase Admin initialisé avec succès');
    console.log(`📱 Project ID: ${serviceAccount.project_id}`);
  } else {
    console.error('❌ Impossible d\'initialiser Firebase: project_id manquant');
  }
} catch (error) {
  console.error('❌ Erreur initialisation Firebase Admin:', error.message);
}

module.exports = { 
  admin: adminInstance, 
  messaging,
  isInitialized: !!messaging
};