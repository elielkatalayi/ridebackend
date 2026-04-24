const { Server } = require('socket.io');
const SocketService = require('../services/notification/SocketService');

let io = null;

function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  });
  
  // Middleware d'authentification
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      // Vérifier JWT
      const decoded = await verifyJWT(token);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });
  
  // Connexion
  io.on('connection', (socket) => {
    const userId = socket.userId;
    
    // Enregistrer la connexion
    SocketService.addSocket(userId, socket.id, socket);
    
    // Écouter les événements
    setupEventHandlers(socket, userId);
    
    // Déconnexion
    socket.on('disconnect', () => {
      SocketService.removeSocket(socket.id);
    });
  });
  
  SocketService.setIO(io);
  
  return io;
}

function setupEventHandlers(socket, userId) {
  // Présence
  socket.on('presence:update', (data) => {
    SocketService.updatePresence(userId, data.status);
  });
  
  // Rejoindre une room
  socket.on('room:join', async (data) => {
    await SocketService.joinRoom(userId, data.room);
  });
  
  // Quitter une room
  socket.on('room:leave', async (data) => {
    await SocketService.leaveRoom(userId, data.room);
  });
  
  // Marquer notification comme lue
  socket.on('notification:read', async (data) => {
    const { notificationId } = data;
    const NotificationService = require('../services/notification/NotificationService');
    await NotificationService.markAsRead(notificationId, userId);
  });
  
  // Tout marquer comme lu
  socket.on('notification:readAll', async () => {
    const NotificationService = require('../services/notification/NotificationService');
    await NotificationService.markAllAsRead(userId);
  });
  
  // Demander badge count
  socket.on('badge:request', async () => {
    const NotificationService = require('../services/notification/NotificationService');
    const count = await NotificationService.getUnreadCount(userId);
    socket.emit('badge:update', { count });
  });
  
  // Heartbeat
  socket.on('ping', () => {
    socket.emit('pong');
  });
}

async function verifyJWT(token) {
  // Implémente la vérification JWT
  const jwt = require('jsonwebtoken');
  return jwt.verify(token, process.env.JWT_SECRET);
}

function getIO() {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
}

module.exports = { initializeSocket, getIO };