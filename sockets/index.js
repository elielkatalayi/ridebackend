// sockets/index.js
const SocketService = require('../services/notification/SocketService');
const PresenceHandler = require('./handlers/presenceHandler');
const RideHandler = require('./handlers/rideHandler');
const ChatHandler = require('./handlers/chatHandler');
const SocialHandler = require('./handlers/socialHandler');
const StoryHandler = require('./handlers/storyHandler');
const LocationHandler = require('./handlers/locationHandler');

// Middleware d'authentification
const authMiddleware = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    socket.userId = decoded.id || decoded.userId;
    socket.userRole = decoded.role || 'passenger';
    socket.userEmail = decoded.email;
    
    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
};

function initializeSocket(server) {
  const { Server } = require('socket.io');
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    allowEIO3: true
  });
  
  // Middleware global
  io.use(authMiddleware);
  
  // Connexion principale
  io.on('connection', (socket) => {
    const userId = socket.userId;
    const userRole = socket.userRole;
    
    console.log(`🔌 New connection: user ${userId} (${userRole}) - socket ${socket.id}`);
    
    // Enregistrer dans SocketService
    SocketService.addSocket(userId, socket.id, socket, {
      ipAddress: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent']
    });
    
    // Envoyer l'état initial
    socket.emit('connection:established', {
      userId,
      role: userRole,
      timestamp: new Date(),
      serverTime: new Date().toISOString()
    });
    
    // Envoyer le nombre de notifications non lues
    const NotificationService = require('../services/notification/NotificationService');
    NotificationService.getUnreadCount(userId).then(count => {
      socket.emit('badge:update', { count });
    }).catch(() => {});
    
    // Initialiser tous les handlers
    const handlers = [
      new PresenceHandler(io, socket),
      new RideHandler(io, socket),
      new ChatHandler(io, socket),
      new SocialHandler(io, socket),
      new StoryHandler(io, socket),
      new LocationHandler(io, socket)
    ];
    
    handlers.forEach(handler => handler.register());
    
    // Déconnexion
    socket.on('disconnect', (reason) => {
      console.log(`❌ Disconnect: user ${userId} - ${reason}`);
      SocketService.removeSocket(socket.id);
    });
    
    // Gestion des erreurs
    socket.on('error', (error) => {
      console.error(`Socket error for user ${userId}:`, error);
      socket.emit('error', { message: error.message });
    });
  });
  
  // Namespace pour la localisation
  const locationNamespace = io.of('/location');
  locationNamespace.use(authMiddleware);
  locationNamespace.on('connection', (socket) => {
    const userId = socket.userId;
    const userRole = socket.userRole;
    
    console.log(`📍 Location namespace: user ${userId} (${userRole}) connected - socket ${socket.id}`);
    
    // ✅ Envoyer la confirmation de connexion
    socket.emit('location:connected', {
      userId: userId,
      role: userRole,
      timestamp: new Date(),
      message: 'Connected to location service'
    });
    
    let trackingInterval = null;
    
    // Mise à jour position
    socket.on('location:update', async (data) => {
      const locationService = require('../services/locationService');
      try {
        const { latitude, longitude, accuracy, speed, heading, rideId, metadata } = data;
        
        const location = await locationService.updateLocation(
          userId,
          { 
            latitude, 
            longitude, 
            accuracy: accuracy || 10, 
            speed: speed || 0, 
            heading: heading || 0,
            active_ride_id: rideId,
            metadata: metadata || {}
          },
          userRole
        );
        
        socket.emit('location:saved', { 
          id: location.id, 
          recorded_at: location.recorded_at 
        });
        
        // Si c'est une course active, diffuser aux participants
        if (rideId) {
          locationNamespace.to(`ride:${rideId}`).emit('location:ride-update', {
            userId: userId,
            latitude,
            longitude,
            speed,
            heading,
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.error('❌ Location update error:', error.message);
        socket.emit('location:error', { message: error.message });
      }
    });
    
    // Démarrer le tracking périodique
    socket.on('location:start-tracking', async (data) => {
      const { interval = 5000, rideId = null } = data || {};
      const locationService = require('../services/locationService');
      
      if (trackingInterval) {
        clearInterval(trackingInterval);
      }
      
      if (rideId) {
        await locationService.startRideTracking(userId, rideId);
        socket.join(`ride:${rideId}`);
      }
      
      trackingInterval = setInterval(() => {
        socket.emit('location:request');
      }, interval);
      
      socket.emit('location:tracking-started', { interval, rideId });
      console.log(`▶️ Tracking started for user ${userId} (interval: ${interval}ms, ride: ${rideId || 'none'})`);
    });
    
    // Arrêter le tracking
    socket.on('location:stop-tracking', async (data) => {
      const { rideId = null } = data || {};
      const locationService = require('../services/locationService');
      
      if (trackingInterval) {
        clearInterval(trackingInterval);
        trackingInterval = null;
      }
      
      if (rideId) {
        await locationService.stopRideTracking(userId, rideId);
        socket.leave(`ride:${rideId}`);
      }
      
      socket.emit('location:tracking-stopped');
      console.log(`⏹️ Tracking stopped for user ${userId}`);
    });
    
    // Demander les chauffeurs à proximité
    socket.on('location:nearby', async (data) => {
      const locationService = require('../services/locationService');
      try {
        const { latitude, longitude, radius = 5 } = data;
        
        if (!latitude || !longitude) {
          socket.emit('location:error', { message: 'Latitude et longitude requises' });
          return;
        }
        
        const drivers = await locationService.getNearbyUsers(latitude, longitude, radius, 'driver');
        
        socket.emit('location:nearby-result', {
          count: drivers.length,
          drivers: drivers.map(d => ({
            userId: d.user_id,
            name: `${d.user?.first_name || ''} ${d.user?.last_name || ''}`,
            avatar: d.user?.avatar_url,
            latitude: parseFloat(d.latitude),
            longitude: parseFloat(d.longitude),
            speed: d.speed,
            distance: parseFloat(d.distance),
            last_update: d.recorded_at
          }))
        });
      } catch (error) {
        console.error('❌ Nearby drivers error:', error.message);
        socket.emit('location:error', { message: error.message });
      }
    });
    
    // Obtenir la dernière position
    socket.on('location:last', async () => {
      const locationService = require('../services/locationService');
      try {
        const location = await locationService.getLastLocation(userId);
        socket.emit('location:last-result', location);
      } catch (error) {
        socket.emit('location:error', { message: error.message });
      }
    });
    
    // Déconnexion
    socket.on('disconnect', () => {
      console.log(`📍 Location client déconnecté: user ${userId}`);
      if (trackingInterval) {
        clearInterval(trackingInterval);
      }
      socket.leave(`user:${userId}`);
      socket.leave('drivers');
      socket.leave('passengers');
    });
  });
  
  // Stocker l'instance pour les services
  SocketService.setIO(io);
  
  console.log('🚀 Socket.IO server initialized');
  console.log('   - Main namespace: /');
  console.log('   - Location namespace: /location');
  
  return io;
}

function getIO() {
  return SocketService.io;
}

module.exports = { initializeSocket, getIO };