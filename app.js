const express = require('express');
const http = require('http'); // ✅ AJOUTÉ pour créer le serveur HTTP
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const env = require('./config/env');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { globalLimiter } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');

// =====================================================
// 🔌 SOCKET.IO IMPORTS
// =====================================================
const { initializeSocket } = require('./sockets');
const SocketService = require('./services/notification/SocketService');

// Créer le dossier logs s'il n'existe pas
if (!fs.existsSync(path.join(__dirname, '../logs'))) {
  fs.mkdirSync(path.join(__dirname, '../logs'), { recursive: true });
}

// Créer un stream pour les erreurs séparées
const errorLogStream = fs.createWriteStream(
  path.join(__dirname, '../logs/error.log'),
  { flags: 'a' }
);

// Logger le démarrage
logger.info('🚀 Démarrage de l\'application MediBE');
logger.info(`📦 Environnement: ${env.NODE_ENV}`);
logger.info(`🌍 Port configuré: ${env.PORT}`);

// Créer l'application Express
const app = express();

// =====================================================
// 🔒 SECURITY MIDDLEWARE
// =====================================================

logger.debug('🔒 Configuration des middlewares de sécurité...');

// Helmet pour sécuriser les en-têtes HTTP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https://api.shawari.app", "https://maps.googleapis.com", "wss:", "ws:"]
    }
  }
}));

// CORS
const corsOptions = {
  origin: [
    env.FRONTEND_URL,
    env.PASSENGER_APP_URL,
    env.DRIVER_APP_URL,
    env.ADMIN_DASHBOARD_URL,
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://192.168.1.65:3000'
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

// Compression
app.use(compression());

// Rate limiting global
app.use(globalLimiter);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware pour capturer les erreurs de parsing JSON
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    logger.error('❌ Erreur de parsing JSON:', {
      error: err.message,
      body: req.body,
      url: req.url,
      ip: req.ip
    });
    errorLogStream.write(`${new Date().toISOString()} - JSON Parse Error - ${err.stack}\n`);
    return res.status(400).json({ 
      error: 'Format JSON invalide', 
      message: err.message 
    });
  }
  next(err);
});

logger.debug('✅ Middlewares de sécurité chargés');

// =====================================================
// 📝 LOGGING
// =====================================================

// Morgan pour les logs HTTP (format combiné)
const morganFormat = env.NODE_ENV === 'production' ? 'combined' : 'dev';
const accessLogStream = fs.createWriteStream(
  path.join(__dirname, '../logs/access.log'),
  { flags: 'a' }
);
app.use(morgan(morganFormat, { stream: accessLogStream }));
app.use(morgan(morganFormat));

// Logger personnalisé pour les requêtes
app.use((req, res, next) => {
  const start = Date.now();
  
  if (env.NODE_ENV !== 'production') {
    logger.debug(`📥 ${req.method} ${req.url}`, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  }
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'error' : 'info';
    
    if (res.statusCode >= 400) {
      logger[level](`📤 ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
      errorLogStream.write(`${new Date().toISOString()} - ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms\n`);
    } else if (env.NODE_ENV !== 'production') {
      logger.debug(`📤 ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
    }
  });
  
  next();
});

// Middleware pour capturer les réponses d'erreur
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function(data) {
    if (res.statusCode >= 400) {
      logger.error('❌ Réponse d\'erreur envoyée:', {
        statusCode: res.statusCode,
        url: req.url,
        method: req.method,
        response: data,
        ip: req.ip
      });
      errorLogStream.write(`${new Date().toISOString()} - Error Response - ${req.method} ${req.url} - ${res.statusCode}\n`);
    }
    originalJson.call(this, data);
  };
  next();
});

logger.debug('✅ Système de logging configuré');

// =====================================================
// 🩺 HEALTH CHECK & METRICS
// =====================================================

app.get('/health', (req, res) => {
  logger.debug('Health check appelé');
  res.status(200).json({
    status: 'OK',
    service: 'MediBE API',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    websocket: SocketService.isConnectedSocket() ? 'connected' : 'disconnected'
  });
});

app.get('/health/detailed', async (req, res) => {
  const { sequelize } = require('./config/database');
  let dbStatus = 'disconnected';
  let socketStatus = 'disconnected';
  
  try {
    await sequelize.authenticate();
    dbStatus = 'connected';
  } catch (error) {
    dbStatus = 'error';
    logger.error('❌ Erreur DB dans health check:', error.message);
  }
  
  try {
    socketStatus = SocketService.isConnectedSocket() ? 'connected' : 'disconnected';
  } catch (error) {
    socketStatus = 'error';
  }
  
  res.status(200).json({
    status: 'OK',
    service: 'MediBE API',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: dbStatus,
    websocket: socketStatus
  });
});

app.get('/metrics', (req, res) => {
  logger.debug('Métriques demandées');
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    node_version: process.version,
    platform: process.platform,
    websocket_connected: SocketService.isConnectedSocket()
  });
});

logger.debug('✅ Routes de health check configurées');

// =====================================================
// 🚦 API ROUTES
// =====================================================

app.get('/', (req, res) => {
  logger.info('🏠 Page d\'accueil API consultée');
  res.status(200).json({
    name: 'MediBE API',
    version: '1.0.0',
    description: 'API de la plateforme de mobilité MediBE',
    websocket: {
      status: 'available',
      endpoint: `ws://localhost:${env.PORT || 5000}`
    },
    documentation: '/api/v1/docs',
    health: '/health',
    endpoints: {
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      rides: '/api/v1/rides',
      drivers: '/api/v1/drivers',
      categories: '/api/v1/categories',
      pricing: '/api/v1/pricing',
      payments: '/api/v1/payments',
      wallet: '/api/v1/wallet',
      sos: '/api/v1/sos',
      rentals: '/api/v1/rentals',
      admin: '/api/v1/admin',
      webhooks: '/api/v1/webhooks'
    }
  });
});

// Routes API v1
try {
  const apiRoutes = require('./routes/v1');
  app.use('/api/v1', apiRoutes);
  logger.info('✅ Routes API v1 chargées avec succès');
} catch (error) {
  logger.error('❌ Erreur lors du chargement des routes API v1:', {
    error: error.message,
    stack: error.stack
  });
  errorLogStream.write(`${new Date().toISOString()} - Routes Loading Error - ${error.stack}\n`);
}

// =====================================================
// 🗂️ STATIC FILES (pour les uploads)
// =====================================================
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
logger.debug('✅ Serveur de fichiers statiques configuré');

// =====================================================
// 🗄️ DATABASE CONNECTION
// =====================================================

const { sequelize } = require('./config/database');
sequelize.authenticate()
  .then(() => {
    logger.info('✅ Connexion à la base de données établie avec succès');
  })
  .catch(err => {
    logger.error('❌ Erreur de connexion à la base de données:', {
      error: err.message,
      stack: err.stack,
      code: err.code
    });
    errorLogStream.write(`${new Date().toISOString()} - DB Connection Error - ${err.stack}\n`);
  });

// =====================================================
// ❌ ERROR HANDLERS (doivent être après les routes)
// =====================================================

app.use(notFoundHandler);
app.use(errorHandler);

app.use((err, req, res, next) => {
  logger.error('💥 Erreur non capturée dans le middleware final:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    ip: req.ip
  });
  errorLogStream.write(`${new Date().toISOString()} - Uncaught Error - ${err.stack}\n`);
  next(err);
});

logger.info('✅ Application configurée avec succès');
logger.info('🎯 Tous les middlewares et routes sont en place');

// =====================================================
// 🚀 DÉMARRAGE DU SERVEUR AVEC SOCKET.IO
// =====================================================

const PORT = env.PORT || 5000;

// ✅ CRÉER LE SERVEUR HTTP (au lieu de app.listen directement)
const server = http.createServer(app);

// ✅ INITIALISER SOCKET.IO
const io = initializeSocket(server);

// ✅ DÉMARRER LE SERVEUR
server.listen(PORT, () => {
  logger.info('='.repeat(60));
  logger.info(`🚀 Serveur démarré avec succès !`);
  logger.info(`📡 HTTP URL: http://localhost:${PORT}`);
  logger.info(`🔌 WebSocket URL: ws://localhost:${PORT}`);
  logger.info(`🌍 Environnement: ${env.NODE_ENV}`);
  logger.info(`💾 Base de données: ${env.DB_NAME || 'Non configurée'}`);
  logger.info(`📝 Logs: ${path.join(__dirname, '../logs')}`);
  logger.info('='.repeat(60));
  console.log(`\n✅ Serveur API démarré sur http://localhost:${PORT}`);
  console.log(`🔌 WebSocket disponible sur ws://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 Documentation: http://localhost:${PORT}/\n`);
});

// Gestion des erreurs du serveur
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`❌ Le port ${PORT} est déjà utilisé. Arrêt du serveur.`);
    errorLogStream.write(`${new Date().toISOString()} - Port ${PORT} already in use\n`);
    process.exit(1);
  } else {
    logger.error('❌ Erreur du serveur:', error);
    errorLogStream.write(`${new Date().toISOString()} - Server Error - ${error.stack}\n`);
  }
});

// =====================================================
// 🔄 GESTION DES ERREURS NON GÉRÉES
// =====================================================

process.on('uncaughtException', (error) => {
  logger.error('💥 Erreur non capturée (uncaughtException):', {
    error: error.message,
    stack: error.stack,
    name: error.name
  });
  errorLogStream.write(`${new Date().toISOString()} - uncaughtException - ${error.stack}\n`);
  console.error('Erreur fatale:', error);
  
  server.close(() => {
    logger.info('Serveur fermé après une erreur fatale');
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Promesse rejetée non gérée (unhandledRejection):', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise
  });
  errorLogStream.write(`${new Date().toISOString()} - unhandledRejection - ${reason?.stack || reason}\n`);
  console.error('Rejet non géré:', reason);
});

process.on('SIGTERM', () => {
  logger.info('🛑 Signal SIGTERM reçu, fermeture propre...');
  errorLogStream.write(`${new Date().toISOString()} - SIGTERM received\n`);
  
  if (io) {
    io.close(() => {
      logger.info('🔌 Socket.IO fermé');
    });
  }
  
  server.close(() => {
    logger.info('✅ Serveur fermé proprement');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('🛑 Signal SIGINT reçu, fermeture propre...');
  errorLogStream.write(`${new Date().toISOString()} - SIGINT received\n`);
  
  if (io) {
    io.close(() => {
      logger.info('🔌 Socket.IO fermé');
    });
  }
  
  server.close(() => {
    logger.info('✅ Serveur fermé proprement');
    process.exit(0);
  });
});

// Middleware de debug pour voir tous les headers
app.use((req, res, next) => {
  console.log('📨 Headers Authorization:', req.headers.authorization);
  console.log('📨 URL:', req.url);
  next();
});
module.exports = { app, server, io };

