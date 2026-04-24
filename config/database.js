const { Sequelize } = require('sequelize');
const env = require('./env');

// =====================================================
// 🗄️ CONNEXION POSTGRESQL (RENDER)
// =====================================================
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  logging: env.NODE_ENV === 'development' ? console.log : false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false  // Important pour Render
    }
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  define: {
    timestamps: true,
    underscored: true,
    underscoredAll: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// =====================================================
// 🔌 TEST DE CONNEXION
// =====================================================
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connecté avec succès (Render)');
    
    // Synchronisation des modèles (développement uniquement)
    if (env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('✅ Modèles synchronisés');
    }
  } catch (error) {
    console.error('❌ Erreur de connexion PostgreSQL:', error.message);
    // Ne pas exit, laisser l'app démarrer sans DB si nécessaire
    // process.exit(1);
  }
};

module.exports = {
  sequelize,
  connectDB,
  Sequelize
};