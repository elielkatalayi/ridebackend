const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  // =====================================================
  // 🌍 SERVER
  // =====================================================
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT) || 5000,
  API_URL: process.env.API_URL || 'http://localhost:5000',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',

  // =====================================================
  // 🗄️ POSTGRES DATABASE
  // =====================================================
  DB_USER: process.env.DB_USER,
  DB_HOST: process.env.DB_HOST,
  DB_NAME: process.env.DB_NAME,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_PORT: parseInt(process.env.DB_PORT) || 5432,

  // =====================================================
  // 🔐 JWT
  // =====================================================
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30d',

  // =====================================================
  // 📱 CLICKATELL (OTP SMS)
  // =====================================================
  CLICKATELL_API_KEY: process.env.CLICKATELL_API_KEY,
  CLICKATELL_API_URL: process.env.CLICKATELL_API_URL || 'https://platform.clickatell.com/v1/message',

  // =====================================================
  // 💳 SHAWARI PAYMENTS
  // =====================================================
  SHAWARI_BASE_URL: process.env.SHAWARI_BASE_URL || 'https://api.shawari.app',
  SHAWARI_MERCHANT_ID: process.env.SHAWARI_MERCHANT_ID,
  SHAWARI_MERCHANT_KEY: process.env.SHAWARI_MERCHANT_KEY,

  // =====================================================
  // 🗺️ GOOGLE MAPS
  // =====================================================
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,

  // =====================================================
  // ☁️ SUPABASE (Storage)
  // =====================================================
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,

  // =====================================================
  // 🌐 FRONTEND URLS
  // =====================================================
  PASSENGER_APP_URL: process.env.PASSENGER_APP_URL || 'http://localhost:3000',
  DRIVER_APP_URL: process.env.DRIVER_APP_URL || 'http://localhost:3001',
  ADMIN_DASHBOARD_URL: process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3002'
};