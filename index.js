const app = require('./app');
const env = require('./config/env');
const { connectDB } = require('./config/database');
const logger = require('./utils/logger');

// =====================================================
// 🚀 DÉMARRAGE DU SERVEUR
// =====================================================

let server = null;

/**
 * Démarrage du serveur
 */
const startServer = async () => {
  try {
    // Connexion à la base de données
    await connectDB();
    logger.info('✅ Base de données connectée');
    
    // Démarrage du serveur HTTP
    server = app.listen(env.PORT, () => {
      const banner = `
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🚀 MediBE API - DÉMARRÉ AVEC SUCCÈS !                       ║
║                                                               ║
║   📍 Environnement : ${env.NODE_ENV.padEnd(36)}║
║   🌐 Port : ${String(env.PORT).padEnd(44)}║
║   🔗 URL : ${env.API_URL.padEnd(44)}║
║                                                               ║
║   🩺 Health check : ${env.API_URL}/health${' '.repeat(26)}║
║   📚 Documentation : ${env.API_URL}/api/v1/docs${' '.repeat(24)}║
║                                                               ║
║   ⚡ Service prêt à traiter les requêtes                      ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
      `;
      console.log(banner);
      logger.info(`Serveur démarré sur le port ${env.PORT}`);
    });
    
  } catch (error) {
    logger.error(`❌ Erreur au démarrage: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Arrêt gracieux du serveur
 */
const gracefulShutdown = async () => {
  logger.info('🛑 Arrêt du serveur en cours...');
  
  if (server) {
    server.close(async () => {
      logger.info('✅ Serveur HTTP arrêté');
      
      // Fermeture de la connexion base de données
      const { sequelize } = require('./config/database');
      try {
        await sequelize.close();
        logger.info('✅ Connexion base de données fermée');
      } catch (err) {
        logger.error(`❌ Erreur fermeture base de données: ${err.message}`);
      }
      
      logger.info('👋 Serveur arrêté avec succès');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

// Gestion des signaux d'arrêt
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  logger.error(`❌ Uncaught Exception: ${error.message}`);
  logger.error(error.stack);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`❌ Unhandled Rejection: ${reason}`);
  gracefulShutdown();
});

// =====================================================
// 🚀 LANCEMENT
// =====================================================
startServer();

module.exports = { app, server };