// sockets/locationSocket.js
const locationService = require('../services/locationService');

module.exports = (io) => {
  io.on('connection', (socket) => {
    const userId = socket.userId;
    const userRole = socket.userRole;
    
    console.log(`📍 Location client connecté: user ${userId} (${userRole}) - socket ${socket.id}`);
    
    let trackingInterval = null;
    let currentRideId = null;
    
    // Rejoindre les rooms
    socket.join(`user:${userId}`);
    if (userRole === 'driver') {
      socket.join('drivers');
    } else if (userRole === 'passenger') {
      socket.join('passengers');
    }
    
    // Confirmer la connexion
    socket.emit('location:connected', {
      userId,
      role: userRole,
      timestamp: new Date()
    });
    
    // Mise à jour position
    socket.on('location:update', async (data) => {
      const { 
        latitude, 
        longitude, 
        accuracy = 10, 
        speed = 0, 
        heading = 0,
        altitude = null,
        rideId = null,
        metadata = {}
      } = data;
      
      try {
        const location = await locationService.updateLocation(
          userId,
          { 
            latitude, 
            longitude, 
            accuracy, 
            speed, 
            heading, 
            altitude,
            active_ride_id: rideId,
            metadata
          },
          userRole
        );
        
        // Si c'est une course active, diffuser aux participants
        if (rideId) {
          io.to(`ride:${rideId}`).emit('location:ride-update', {
            userId,
            latitude,
            longitude,
            speed,
            heading,
            timestamp: new Date()
          });
        }
        
        // Confirmer la sauvegarde
        socket.emit('location:saved', {
          id: location.id,
          recorded_at: location.recorded_at
        });
        
      } catch (error) {
        console.error(`❌ Erreur sauvegarde position user ${userId}:`, error.message);
        socket.emit('location:error', { message: error.message });
      }
    });
    
    // Démarrer le tracking périodique
    socket.on('location:start-tracking', async (data) => {
      const { interval = 5000, rideId = null } = data;
      
      if (trackingInterval) {
        clearInterval(trackingInterval);
      }
      
      currentRideId = rideId;
      
      if (rideId) {
        await locationService.startRideTracking(userId, rideId);
        socket.join(`ride:${rideId}`);
      }
      
      // Demander la position à intervalle régulier
      trackingInterval = setInterval(() => {
        socket.emit('location:request');
      }, interval);
      
      console.log(`▶️ Tracking démarré pour user ${userId} (intervalle: ${interval}ms, ride: ${rideId || 'none'})`);
      socket.emit('location:tracking-started', { interval, rideId });
    });
    
    // Arrêter le tracking
    socket.on('location:stop-tracking', async (data) => {
      const { rideId = null } = data || {};
      
      if (trackingInterval) {
        clearInterval(trackingInterval);
        trackingInterval = null;
      }
      
      if (rideId || currentRideId) {
        const rideToStop = rideId || currentRideId;
        await locationService.stopRideTracking(userId, rideToStop);
        socket.leave(`ride:${rideToStop}`);
      }
      
      console.log(`⏹️ Tracking arrêté pour user ${userId}`);
      socket.emit('location:tracking-stopped');
    });
    
    // Demander les chauffeurs à proximité
    socket.on('location:nearby', async (data) => {
      const { latitude, longitude, radius = 5 } = data;
      
      try {
        const drivers = await locationService.getNearbyUsers(
          latitude,
          longitude,
          radius,
          'driver'
        );
        
        socket.emit('location:nearby-result', {
          count: drivers.length,
          drivers: drivers.map(d => ({
            userId: d.user_id,
            name: `${d.user?.first_name || ''} ${d.user?.last_name || ''}`,
            avatar: d.user?.avatar_url,
            latitude: parseFloat(d.latitude),
            longitude: parseFloat(d.longitude),
            speed: d.speed,
            distance: d.distance,
            last_update: d.recorded_at
          }))
        });
      } catch (error) {
        console.error('❌ Erreur recherche chauffeurs:', error.message);
        socket.emit('location:error', { message: error.message });
      }
    });
    
    // Obtenir la dernière position
    socket.on('location:last', async () => {
      try {
        const location = await locationService.getLastLocation(userId);
        
        if (location) {
          socket.emit('location:last-result', {
            latitude: location.latitude,
            longitude: location.longitude,
            speed: location.speed,
            recorded_at: location.recorded_at
          });
        } else {
          socket.emit('location:last-result', null);
        }
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
      if (currentRideId) {
        socket.leave(`ride:${currentRideId}`);
      }
    });
  });
};