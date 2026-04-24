// test-realtime-complete.js
const io = require('socket.io-client');

const SOCKET_URL = 'http://localhost:5000/location';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjgyYjY0NDI3LTViMDEtNDI5NC05Njk4LTNhNzkzZmQ3ZGFiOSIsInBob25lIjoiKzI0MzgxMjM0NTY3OCIsInJvbGUiOiJwYXNzZW5nZXIiLCJpYXQiOjE3NzY5MDA3MDMsImV4cCI6MTc3OTQ5MjcwM30.NGdsci5ba8FFpO-twSR4BEzcrn__YUrYE2b_pRy1lnQ'; // Remplacez par votre token

console.log('=========================================');
console.log('🧪 TEST TEMPS RÉEL COMPLET');
console.log('=========================================');
console.log('🔗 URL:', SOCKET_URL);
console.log('=========================================\n');

const socket = io(SOCKET_URL, {
    transports: ['websocket'],
    auth: { token: TOKEN }
});

let positionCount = 0;
let interval = null;

socket.on('connect', () => {
    console.log('✅ Connecté au serveur');
    console.log('📡 Socket ID:', socket.id);
});

socket.on('location:connected', (data) => {
    console.log('✅ Authentifié!', data);
    console.log('\n▶️ Envoi de positions toutes les 3 secondes...\n');
    
    // Démarrer l'envoi automatique de positions
    interval = setInterval(() => {
        positionCount++;
        const lat = -4.4419 + (Math.random() - 0.5) * 0.01;
        const lng = 15.2663 + (Math.random() - 0.5) * 0.01;
        const speed = 30 + Math.random() * 50;
        
        console.log(`📍 [${positionCount}] Envoi: ${lat.toFixed(6)}, ${lng.toFixed(6)} - ${speed.toFixed(1)} km/h`);
        
        socket.emit('location:update', {
            latitude: lat,
            longitude: lng,
            speed: speed,
            accuracy: 10,
            heading: Math.random() * 360
        });
        
        if (positionCount >= 10) {
            clearInterval(interval);
            console.log('\n✅ Test terminé - 10 positions envoyées');
            setTimeout(() => socket.disconnect(), 2000);
        }
    }, 3000);
});

socket.on('location:saved', (data) => {
    console.log(`   ✅ Sauvegardée: ${data.id}`);
});

socket.on('location:error', (error) => {
    console.error('❌ Erreur:', error);
});

socket.on('connect_error', (error) => {
    console.error('❌ Erreur connexion:', error.message);
});

socket.on('disconnect', () => {
    console.log('\n🔌 Déconnecté');
    process.exit(0);
});

setTimeout(() => {
    if (interval) clearInterval(interval);
    console.log('\n⏰ Timeout');
    socket.disconnect();
    process.exit(0);
}, 60000);