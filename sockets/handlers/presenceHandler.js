const SocketService = require('../../services/notification/SocketService');

class PresenceHandler {
  constructor(io, socket) {
    this.io = io;
    this.socket = socket;
    this.userId = socket.userId;
  }

  register() {
    this.socket.on('presence:update', this.handlePresenceUpdate.bind(this));
    this.socket.on('presence:subscribe', this.handlePresenceSubscribe.bind(this));
    this.socket.on('presence:unsubscribe', this.handlePresenceUnsubscribe.bind(this));
    this.socket.on('ping', this.handlePing.bind(this));
  }

  handlePresenceUpdate(data) {
    const { status, ...metadata } = data;
    SocketService.updatePresence(this.userId, status, metadata);
  }

  handlePresenceSubscribe(data) {
    const { userIds } = data;
    // Stocker les abonnements dans la session socket
    if (!this.socket.presenceSubscriptions) {
      this.socket.presenceSubscriptions = new Set();
    }
    
    userIds.forEach(id => {
      this.socket.presenceSubscriptions.add(id);
      const presence = SocketService.getUserPresence(id);
      this.socket.emit('presence:state', { userId: id, ...presence });
    });
  }

  handlePresenceUnsubscribe(data) {
    const { userIds } = data;
    if (this.socket.presenceSubscriptions) {
      userIds.forEach(id => {
        this.socket.presenceSubscriptions.delete(id);
      });
    }
  }

  handlePing() {
    SocketService.updateHeartbeat(this.socket.id);
    this.socket.emit('pong', { timestamp: new Date() });
  }
}

module.exports = PresenceHandler;