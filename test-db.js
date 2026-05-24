// test-db.js
require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    console.log('🔄 Tentative de connexion...');
    await client.connect();
    console.log('✅ Connecté!');
    
    const result = await client.query('SELECT NOW()');
    console.log('📅 Heure du serveur:', result.rows[0]);
    
    await client.end();
    console.log('✅ Déconnecté');
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testConnection();