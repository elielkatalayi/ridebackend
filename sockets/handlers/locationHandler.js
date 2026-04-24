// sockets/handlers/locationHandler.js
const locationService = require('../../services/locationService');

class LocationHandler {
  constructor(io, socket) {
    this.io = io;
    this.socket = socket;
    this.userId = socket.userId;
    this.userRole = socket.userRole;
    this.trackingInterval = null;
  }
  
  register() {
    console.log(`📍 LocationHandler registered for user ${this.userId}`);
    
    this.socket.on('location:update', this.handleUpdate.bind(this));
    this.socket.on('location:start-tracking', this.handleStartTracking.bind(this));
    this.socket.on('location:stop-tracking', this.handleStopTracking.bind(this));
    this.socket.on('location:nearby', this.handleNearby.bind(this));
    this.socket.on('location:last', this.handleLast.bind(this));
    
    this.socket.on('disconnect', () => {
      if (this.trackingInterval) {
        clearInterval(this.trackingInterval);
      }
    });
  }
  
  async handleUpdate(data) {
    try {
      const { latitude, longitude, accuracy, speed, heading, rideId, metadata } = data;
      
      const location = await locationService.updateLocation(
        this.userId,
        { 
          latitude, 
          longitude, 
          accuracy: accuracy || 10, 
          speed: speed || 0, 
          heading: heading || 0,
          active_ride_id: rideId,
          metadata: metadata || {}
        },
        this.userRole
      );
      
      this.socket.emit('location:saved', { 
        id: location.id, 
        recorded_at: location.recorded_at 
      });
      
      if (rideId) {
        this.io.to(`ride:${rideId}`).emit('location:ride-update', {
          userId: this.userId,
          latitude,
          longitude,
          speed,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('❌ Location update error:', error.message);
      this.socket.emit('location:error', { message: error.message });
    }
  }
  
  async handleStartTracking(data) {
    const { interval = 5000, rideId = null } = data || {};
    
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
    }
    
    if (rideId) {
      await locationService.startRideTracking(this.userId, rideId);
      this.socket.join(`ride:${rideId}`);
    }
    
    this.trackingInterval = setInterval(() => {
      this.socket.emit('location:request');
    }, interval);
    
    this.socket.emit('location:tracking-started', { interval, rideId });
    console.log(`▶️ Tracking started for user ${this.userId} (interval: ${interval}ms)`);
  }
  
  async handleStopTracking(data) {
    const { rideId = null } = data || {};
    
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
    
    if (rideId) {
      await locationService.stopRideTracking(this.userId, rideId);
      this.socket.leave(`ride:${rideId}`);
    }
    
    this.socket.emit('location:tracking-stopped');
    console.log(`⏹️ Tracking stopped for user ${this.userId}`);
  }
  
  async handleNearby(data) {
    try {
      const { latitude, longitude, radius = 5 } = data;
      
      if (!latitude || !longitude) {
        this.socket.emit('location:error', { message: 'Latitude et longitude requises' });
        return;
      }
      
      const drivers = await locationService.getNearbyUsers(latitude, longitude, radius, 'driver');
      
      this.socket.emit('location:nearby-result', {
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
      this.socket.emit('location:error', { message: error.message });
    }
  }
  
  async handleLast() {
    try {
      const location = await locationService.getLastLocation(this.userId);
      this.socket.emit('location:last-result', location);
    } catch (error) {
      this.socket.emit('location:error', { message: error.message });
    }
  }
}

module.exports = LocationHandler;