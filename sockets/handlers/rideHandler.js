const SocketService = require('../../services/notification/SocketService');

class RideHandler {
  constructor(io, socket) {
    this.io = io;
    this.socket = socket;
    this.userId = socket.userId;
    this.userRole = socket.userRole;
  }

  register() {
    this.socket.on('ride:join', this.handleJoinRide.bind(this));
    this.socket.on('ride:leave', this.handleLeaveRide.bind(this));
    this.socket.on('ride:location', this.handleLocationUpdate.bind(this));
    this.socket.on('ride:accept', this.handleAcceptRide.bind(this));
    this.socket.on('ride:decline', this.handleDeclineRide.bind(this));
    this.socket.on('ride:cancel', this.handleCancelRide.bind(this));
    this.socket.on('ride:status', this.handleStatusUpdate.bind(this));
  }

  async handleJoinRide(data) {
    const { rideId } = data;
    await SocketService.joinRideRoom(this.userId, rideId);
    this.socket.emit('ride:joined', { rideId });
  }

  async handleLeaveRide(data) {
    const { rideId } = data;
    await SocketService.leaveRideRoom(this.userId, rideId);
    this.socket.emit('ride:left', { rideId });
  }

  handleLocationUpdate(data) {
    const { rideId, lat, lng } = data;
    SocketService.sendToRoom(`ride:${rideId}`, 'ride:location:update', {
      userId: this.userId,
      role: this.userRole,
      lat,
      lng,
      timestamp: new Date()
    });
  }

  handleAcceptRide(data) {
    const { rideId } = data;
    SocketService.sendToRoom(`ride:${rideId}`, 'ride:accepted', {
      driverId: this.userId,
      rideId,
      timestamp: new Date()
    });
  }

  handleDeclineRide(data) {
    const { rideId, reason } = data;
    SocketService.sendToRoom(`ride:${rideId}`, 'ride:declined', {
      driverId: this.userId,
      rideId,
      reason,
      timestamp: new Date()
    });
  }

  handleCancelRide(data) {
    const { rideId, reason, cancelledBy } = data;
    SocketService.sendToRoom(`ride:${rideId}`, 'ride:cancelled', {
      rideId,
      cancelledBy: cancelledBy || this.userRole,
      userId: this.userId,
      reason,
      timestamp: new Date()
    });
  }

  handleStatusUpdate(data) {
    const { rideId, status, ...extra } = data;
    SocketService.sendToRoom(`ride:${rideId}`, 'ride:status:update', {
      rideId,
      status,
      userId: this.userId,
      ...extra,
      timestamp: new Date()
    });
  }
}

module.exports = RideHandler;