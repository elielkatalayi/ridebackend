const { SocketSession } = require('../../models');
const { Op } = require('sequelize');

class SocketService {
  constructor() {
    this.io = null;
    // In-memory stores
    this.userSockets = new Map(); // userId -> Set(socketIds)
    this.userPresence = new Map(); // userId -> { status, lastSeen, lastActive, metadata }
    this.userRooms = new Map(); // userId -> Set(roomNames)
    this.roomMembers = new Map(); // roomName -> Set(userIds)
    this.socketToUser = new Map(); // socketId -> userId
    this.userMetadata = new Map(); // userId -> { deviceInfo, location, customData }
  }

  setIO(io) {
    this.io = io;
    console.log('🔌 Socket.IO instance set');
  }

  addSocket(userId, socketId, socket, metadata = {}) {
    // Ajouter aux maps utilisateur
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(socketId);
    this.socketToUser.set(socketId, userId);
    
    // Mettre à jour présence
    this.userPresence.set(userId, {
      status: 'online',
      lastSeen: new Date(),
      lastActive: new Date(),
      socketId,
      ...metadata
    });
    
    // Joindre la room personnelle
    socket.join(`user:${userId}`);
    
    // Enregistrer session en BDD (async, ne pas bloquer)
    SocketSession.create({
      user_id: userId,
      socket_id: socketId,
      ip_address: metadata.ipAddress,
      user_agent: metadata.userAgent,
      connected_at: new Date(),
      last_heartbeat: new Date(),
      is_connected: true
    }).catch(err => console.error('Error saving socket session:', err));
    
    // Notifier les amis/followers que l'utilisateur est en ligne
    this.broadcastPresence(userId, 'online');
    
    console.log(`✅ Socket connected: user ${userId} (${socketId}) - Total connections: ${this.userSockets.get(userId).size}`);
  }

  removeSocket(socketId) {
    const userId = this.socketToUser.get(socketId);
    if (!userId) return;
    
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
        this.userPresence.set(userId, {
          status: 'offline',
          lastSeen: new Date(),
          lastActive: new Date()
        });
        
        // Notifier que l'utilisateur est hors ligne
        this.broadcastPresence(userId, 'offline');
      }
    }
    
    this.socketToUser.delete(socketId);
    
    // Mettre à jour session BDD
    SocketSession.update(
      { is_connected: false, disconnected_at: new Date() },
      { where: { socket_id: socketId } }
    ).catch(err => console.error('Error updating socket session:', err));
    
    console.log(`❌ Socket disconnected: ${socketId} (user ${userId})`);
  }

  sendToUser(userId, event, data) {
    if (!this.io) return false;
    
    const sockets = this.userSockets.get(userId);
    if (!sockets || sockets.size === 0) return false;
    
    this.io.to(`user:${userId}`).emit(event, data);
    return true;
  }

  sendToRoom(roomName, event, data) {
    if (!this.io) return false;
    this.io.to(roomName).emit(event, data);
    return true;
  }

  sendToDriver(driverId, event, data) {
    return this.sendToUser(driverId, event, data);
  }

  sendToMultipleUsers(userIds, event, data) {
    let sentCount = 0;
    userIds.forEach(userId => {
      if (this.sendToUser(userId, event, data)) {
        sentCount++;
      }
    });
    return sentCount;
  }

  async joinRoom(userId, roomName) {
    const sockets = this.userSockets.get(userId);
    if (!sockets || sockets.size === 0) return false;
    
    if (!this.userRooms.has(userId)) {
      this.userRooms.set(userId, new Set());
    }
    this.userRooms.get(userId).add(roomName);
    
    if (!this.roomMembers.has(roomName)) {
      this.roomMembers.set(roomName, new Set());
    }
    this.roomMembers.get(roomName).add(userId);
    
    // Joindre via Socket.IO pour tous les sockets de l'utilisateur
    for (const socketId of sockets) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.join(roomName);
      }
    }
    
    console.log(`User ${userId} joined room ${roomName}`);
    return true;
  }

  async leaveRoom(userId, roomName) {
    const sockets = this.userSockets.get(userId);
    if (!sockets || sockets.size === 0) return false;
    
    if (this.userRooms.has(userId)) {
      this.userRooms.get(userId).delete(roomName);
    }
    
    if (this.roomMembers.has(roomName)) {
      this.roomMembers.get(roomName).delete(userId);
    }
    
    for (const socketId of sockets) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.leave(roomName);
      }
    }
    
    console.log(`User ${userId} left room ${roomName}`);
    return true;
  }

  async leaveAllRooms(userId) {
    const rooms = this.userRooms.get(userId);
    if (rooms) {
      for (const roomName of rooms) {
        await this.leaveRoom(userId, roomName);
      }
    }
    return true;
  }

  getUserPresence(userId) {
    return this.userPresence.get(userId) || { status: 'offline', lastSeen: null };
  }

  isUserOnline(userId) {
    const presence = this.userPresence.get(userId);
    return presence && presence.status === 'online';
  }

  getOnlineUsers(userIds) {
    const online = [];
    for (const userId of userIds) {
      if (this.isUserOnline(userId)) {
        online.push(userId);
      }
    }
    return online;
  }

  async updatePresence(userId, status, metadata = {}) {
    const current = this.userPresence.get(userId) || {};
    this.userPresence.set(userId, {
      ...current,
      status,
      lastSeen: new Date(),
      lastActive: status === 'active' ? new Date() : current.lastActive,
      ...metadata
    });
    
    // Notifier les followers/chats
    this.broadcastPresence(userId, status);
    
    // Envoyer à l'utilisateur lui-même confirmation
    this.sendToUser(userId, 'presence:updated', { userId, status, ...metadata });
  }

  broadcastPresence(userId, status) {
    // Notifier les rooms où l'utilisateur est présent
    const rooms = this.userRooms.get(userId);
    if (rooms) {
      for (const roomName of rooms) {
        this.sendToRoom(roomName, 'presence:changed', {
          userId,
          status,
          timestamp: new Date()
        });
      }
    }
  }

  getRoomMembers(roomName) {
    return this.roomMembers.get(roomName) || new Set();
  }

  getRoomMemberCount(roomName) {
    return (this.roomMembers.get(roomName) || new Set()).size;
  }

  getUserRooms(userId) {
    return this.userRooms.get(userId) || new Set();
  }

  getConnectedSocketsCount() {
    let total = 0;
    for (const sockets of this.userSockets.values()) {
      total += sockets.size;
    }
    return total;
  }

  getConnectedUsersCount() {
    return this.userSockets.size;
  }

  async cleanupStaleSessions() {
    // Nettoyer les sessions BDD trop vieilles
    const staleDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await SocketSession.update(
      { is_connected: false },
      { where: { is_connected: true, last_heartbeat: { [Op.lt]: staleDate } } }
    );
  }

  updateHeartbeat(socketId) {
    const userId = this.socketToUser.get(socketId);
    if (userId) {
      const presence = this.userPresence.get(userId);
      if (presence) {
        presence.lastHeartbeat = new Date();
        this.userPresence.set(userId, presence);
      }
    }
    
    SocketSession.update(
      { last_heartbeat: new Date() },
      { where: { socket_id: socketId } }
    ).catch(err => console.error('Error updating heartbeat:', err));
  }

  // ==================== ROOMS SPÉCIFIQUES ====================

  async joinRideRoom(userId, rideId) {
    return this.joinRoom(userId, `ride:${rideId}`);
  }

  async leaveRideRoom(userId, rideId) {
    return this.leaveRoom(userId, `ride:${rideId}`);
  }

  async joinChatRoom(userId, chatId, chatType) {
    return this.joinRoom(userId, `${chatType}:${chatId}`);
  }

  async leaveChatRoom(userId, chatId, chatType) {
    return this.leaveRoom(userId, `${chatType}:${chatId}`);
  }

  async joinGroupRoom(userId, groupId) {
    return this.joinRoom(userId, `group:${groupId}`);
  }

  async leaveGroupRoom(userId, groupId) {
    return this.leaveRoom(userId, `group:${groupId}`);
  }

  async joinPostRoom(userId, postId) {
    return this.joinRoom(userId, `post:${postId}`);
  }

  async leavePostRoom(userId, postId) {
    return this.leaveRoom(userId, `post:${postId}`);
  }

  async joinStoryRoom(userId, storyId) {
    return this.joinRoom(userId, `story:${storyId}`);
  }

  async leaveStoryRoom(userId, storyId) {
    return this.leaveRoom(userId, `story:${storyId}`);
  }

  async joinDriverRoom(driverId) {
    return this.joinRoom(driverId, `driver:${driverId}`);
  }

  async leaveDriverRoom(driverId) {
    return this.leaveRoom(driverId, `driver:${driverId}`);
  }

  // ==================== MÉTADONNÉES UTILISATEUR ====================

  setUserMetadata(userId, metadata) {
    const current = this.userMetadata.get(userId) || {};
    this.userMetadata.set(userId, { ...current, ...metadata });
  }

  getUserMetadata(userId) {
    return this.userMetadata.get(userId) || {};
  }

  updateUserLocation(userId, lat, lng) {
    const metadata = this.getUserMetadata(userId);
    metadata.lastLocation = { lat, lng, updatedAt: new Date() };
    this.userMetadata.set(userId, metadata);
    
    // Notifier les abonnés à la position
    this.sendToUser(userId, 'location:updated', { lat, lng });
  }

  // ==================== NOTIFICATIONS GROUPÉES ====================

  sendToRoomExcept(roomName, exceptUserId, event, data) {
    if (!this.io) return false;
    
    const members = this.getRoomMembers(roomName);
    for (const userId of members) {
      if (userId !== exceptUserId) {
        this.sendToUser(userId, event, data);
      }
    }
    return true;
  }

  sendToAll(event, data) {
    if (!this.io) return false;
    this.io.emit(event, data);
    return true;
  }

  // ==================== STATISTIQUES ====================

  getStats() {
    return {
      connectedUsers: this.getConnectedUsersCount(),
      connectedSockets: this.getConnectedSocketsCount(),
      activeRooms: this.roomMembers.size,
      totalRoomsJoined: Array.from(this.userRooms.values()).reduce((sum, rooms) => sum + rooms.size, 0)
    };
  }

  // ==================== NETTOYAGE ====================

  async cleanup() {
    // Nettoyer les sessions inactives
    await this.cleanupStaleSessions();
    
    // Nettoyer les rooms vides
    for (const [roomName, members] of this.roomMembers.entries()) {
      if (members.size === 0) {
        this.roomMembers.delete(roomName);
      }
    }
    
    // Nettoyer les utilisateurs sans sockets
    for (const [userId, sockets] of this.userSockets.entries()) {
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
        this.userPresence.delete(userId);
        this.userRooms.delete(userId);
        this.userMetadata.delete(userId);
      }
    }
    
    return {
      roomsCleaned: this.roomMembers.size,
      usersCleaned: this.userSockets.size
    };
  }

  // ==================== DEBUG ====================

  getDebugInfo() {
    return {
      userSockets: Array.from(this.userSockets.entries()).map(([userId, sockets]) => ({
        userId,
        socketCount: sockets.size,
        socketIds: Array.from(sockets)
      })),
      userPresence: Array.from(this.userPresence.entries()),
      roomMembers: Array.from(this.roomMembers.entries()).map(([room, members]) => ({
        room,
        memberCount: members.size,
        members: Array.from(members)
      })),
      stats: this.getStats()
    };
  }
}

module.exports = new SocketService();