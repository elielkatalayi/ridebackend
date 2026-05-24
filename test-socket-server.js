// test-socket-server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Stockage des utilisateurs connectés
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('✅ Nouveau client connecté:', socket.id);
  
  // Rejoindre un chat
  socket.on('chat:join', (data) => {
    const { chatId } = data;
    socket.join(`chat_${chatId}`);
    console.log(`📢 Client ${socket.id} a rejoint le chat: ${chatId}`);
    
    socket.emit('chat:joined', {
      chatId: chatId,
      message: 'Vous avez rejoint le chat'
    });
  });
  
  // Quitter un chat
  socket.on('chat:leave', (data) => {
    const { chatId } = data;
    socket.leave(`chat_${chatId}`);
    console.log(`👋 Client ${socket.id} a quitté le chat: ${chatId}`);
  });
  
  // Envoyer un message
  socket.on('chat:message:send', (data) => {
    const { chatId, message, senderId, senderName } = data;
    console.log(`💬 Message de ${senderName}: ${message}`);
    
    // Diffuser à tous les membres du chat (sauf l'expéditeur)
    socket.to(`chat_${chatId}`).emit('chat:message:new', {
      id: Date.now().toString(),
      chatId: chatId,
      content: message,
      senderId: senderId,
      senderName: senderName,
      createdAt: new Date().toISOString(),
      status: 'sent'
    });
    
    // Confirmer à l'expéditeur
    socket.emit('chat:message:sent', {
      id: Date.now().toString(),
      chatId: chatId,
      content: message,
      senderId: senderId,
      senderName: senderName,
      createdAt: new Date().toISOString(),
      status: 'sent'
    });
  });
  
  // Indicateur de frappe
  socket.on('chat:typing', (data) => {
    const { chatId, userId, userName, isTyping } = data;
    socket.to(`chat_${chatId}`).emit('chat:typing', {
      chatId: chatId,
      userId: userId,
      userName: userName,
      isTyping: isTyping,
      timestamp: new Date().toISOString()
    });
  });
  
  // Message lu
  socket.on('chat:message:read', (data) => {
    const { chatId, messageId, userId, userName } = data;
    socket.to(`chat_${chatId}`).emit('chat:message:read', {
      messageId: messageId,
      chatId: chatId,
      userId: userId,
      userName: userName,
      readAt: new Date().toISOString()
    });
  });
  
  // Message délivré
  socket.on('chat:message:delivered', (data) => {
    const { chatId, messageId, userId, userName } = data;
    socket.to(`chat_${chatId}`).emit('chat:message:delivered', {
      messageId: messageId,
      chatId: chatId,
      userId: userId,
      userName: userName,
      deliveredAt: new Date().toISOString()
    });
  });
  
  // Déconnexion
  socket.on('disconnect', () => {
    console.log('❌ Client déconnecté:', socket.id);
    connectedUsers.delete(socket.id);
  });
});

// Route de test
app.get('/test-socket', (req, res) => {
  res.send(`
    <!DOCTYPE html>
<html>
<head>
    <title>Test Socket.io - Chat en temps réel</title>
    <style>
        body { font-family: Arial; padding: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; }
        .header { background: #075E54; color: white; padding: 15px; border-radius: 10px 10px 0 0; }
        .config { background: white; padding: 15px; border-radius: 0 0 10px 10px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .config label { display: inline-block; width: 100px; font-weight: bold; }
        .config input { width: 300px; padding: 8px; margin: 5px; border: 1px solid #ddd; border-radius: 5px; }
        .config button { padding: 8px 20px; margin: 5px; cursor: pointer; border: none; border-radius: 5px; }
        .btn-connect { background: #25D366; color: white; }
        .btn-disconnect { background: #dc3545; color: white; }
        .chat { background: white; height: 400px; overflow-y: auto; padding: 15px; border-radius: 10px; margin-bottom: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .message { margin: 10px 0; padding: 10px; border-radius: 10px; max-width: 70%; clear: both; }
        .my-message { background: #DCF8C6; float: right; text-align: right; }
        .other-message { background: #E4E6EB; float: left; }
        .message small { font-size: 10px; color: #666; display: block; margin-top: 5px; }
        .input-area { background: white; padding: 15px; border-radius: 10px; display: flex; gap: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .input-area input { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 20px; }
        .input-area button { padding: 10px 20px; border: none; border-radius: 20px; cursor: pointer; }
        .btn-send { background: #075E54; color: white; }
        .btn-typing { background: #FF9800; color: white; }
        .status { background: #e9ecef; padding: 10px; border-radius: 10px; margin-top: 10px; text-align: center; color: #28a745; font-size: 12px; }
        .clearfix::after { content: ""; clear: both; display: table; }
        .user-info { background: #f0f2f5; padding: 10px; border-radius: 10px; margin-top: 10px; font-size: 12px; }
        .user-info span { color: #075E54; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>💬 Test Socket.io - Chat en temps réel</h2>
            <p>Test avec les vrais IDs de votre base de données</p>
        </div>
        
        <div class="config">
            <h3>⚙️ Configuration</h3>
            <div>
                <label>Chat ID:</label>
                <input type="text" id="chatId" value="4c81b445-dea8-4a6b-a211-4b885dd52919" placeholder="Chat ID">
                <small>✓ Votre vrai chat privé</small>
            </div>
            <div>
                <label>User ID:</label>
                <input type="text" id="userId" value="a3b48dbe-43d7-4530-9c6a-720dc0ad229a" placeholder="User ID">
                <small>✓ Jean MUKENDI (vous)</small>
            </div>
            <div>
                <label>User Name:</label>
                <input type="text" id="userName" value="Jean MUKENDI" placeholder="User Name">
            </div>
            <div>
                <button class="btn-connect" onclick="connect()">🔌 Connexion</button>
                <button class="btn-disconnect" onclick="disconnect()">🔌 Déconnexion</button>
            </div>
        </div>
        
        <div class="user-info">
            💡 <span>Astuce:</span> Ouvrez deux onglets avec des utilisateurs différents pour tester les messages en temps réel
        </div>
        
        <div id="chat" class="chat"></div>
        
        <div class="input-area">
            <input type="text" id="message" placeholder="Votre message..." onkeypress="if(event.key==='Enter') sendMessage()">
            <button class="btn-send" onclick="sendMessage()">📤 Envoyer</button>
            <button class="btn-typing" onclick="sendTyping()">✏️ Tape...</button>
        </div>
        
        <div id="status" class="status">Prêt à se connecter...</div>
    </div>
    
    <script src="/socket.io/socket.io.js"></script>
    <script>
        let socket = null;
        let currentChatId = null;
        let currentUserId = null;
        let currentUserName = null;
        
        function addStatus(text, isError = false) {
            const statusDiv = document.getElementById('status');
            statusDiv.innerHTML = text;
            statusDiv.style.color = isError ? '#dc3545' : '#28a745';
            setTimeout(() => {
                if (statusDiv.innerHTML === text) {
                    statusDiv.innerHTML = 'Prêt';
                    statusDiv.style.color = '#28a745';
                }
            }, 3000);
        }
        
        function addMessage(data, isMine) {
            const chatDiv = document.getElementById('chat');
            const msgDiv = document.createElement('div');
            msgDiv.className = 'message ' + (isMine ? 'my-message' : 'other-message');
            const time = new Date(data.createdAt).toLocaleTimeString();
            msgDiv.innerHTML = '<strong>' + (isMine ? 'Moi' : data.senderName) + '</strong><br>' + 
                              data.content + '<br><small>' + time + '</small>';
            chatDiv.appendChild(msgDiv);
            chatDiv.scrollTop = chatDiv.scrollHeight;
        }
        
        function connect() {
            currentChatId = document.getElementById('chatId').value;
            currentUserId = document.getElementById('userId').value;
            currentUserName = document.getElementById('userName').value;
            
            if (!currentChatId || !currentUserId) {
                addStatus('❌ Chat ID et User ID sont requis', true);
                return;
            }
            
            addStatus('🔌 Connexion au serveur...');
            
            socket = io('http://localhost:5001', {
                transports: ['websocket'],
                reconnection: true,
                reconnectionAttempts: 5
            });
            
            socket.on('connect', () => {
                addStatus('✅ Connecté au serveur (ID: ' + socket.id + ')');
                socket.emit('chat:join', { chatId: currentChatId });
            });
            
            socket.on('chat:joined', (data) => {
                addStatus('📢 ' + data.message + ' - Chat ID: ' + data.chatId);
                document.getElementById('chat').innerHTML = '';
                addStatus('✅ Prêt à envoyer des messages !');
            });
            
            socket.on('chat:message:new', (data) => {
                console.log('📩 Nouveau message reçu:', data);
                addMessage(data, false);
            });
            
            socket.on('chat:message:sent', (data) => {
                console.log('✅ Message envoyé:', data);
                addMessage(data, true);
            });
            
            socket.on('chat:typing', (data) => {
                if (data.isTyping) {
                    addStatus('✏️ ' + data.userName + ' est en train d\'écrire...');
                }
            });
            
            socket.on('chat:message:read', (data) => {
                addStatus('👁️ ' + data.userName + ' a lu le message');
            });
            
            socket.on('chat:message:delivered', (data) => {
                addStatus('📬 ' + data.userName + ' a reçu le message');
            });
            
            socket.on('connect_error', (error) => {
                console.error('Erreur connexion:', error);
                addStatus('❌ Erreur de connexion: ' + error.message, true);
            });
            
            socket.on('disconnect', () => {
                addStatus('❌ Déconnecté du serveur', true);
            });
        }
        
        function disconnect() {
            if (socket) {
                socket.disconnect();
                socket = null;
                addStatus('🔌 Déconnecté volontairement');
                document.getElementById('chat').innerHTML = '';
            }
        }
        
        function sendMessage() {
            const message = document.getElementById('message').value;
            if (!message) {
                addStatus('⚠️ Entrez un message', true);
                return;
            }
            if (!socket) {
                addStatus('❌ Connectez-vous d\'abord', true);
                return;
            }
            
            socket.emit('chat:message:send', {
                chatId: currentChatId,
                message: message,
                senderId: currentUserId,
                senderName: currentUserName
            });
            
            document.getElementById('message').value = '';
        }
        
        function sendTyping() {
            if (!socket) {
                addStatus('❌ Connectez-vous d\'abord', true);
                return;
            }
            socket.emit('chat:typing', {
                chatId: currentChatId,
                userId: currentUserId,
                userName: currentUserName,
                isTyping: true
            });
        }
    </script>
</body>
</html>
  `);
});

// Démarrer le serveur
const PORT = 5001;
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║     🚀 SERVEUR SOCKET.IO DE TEST DÉMARRÉ              ║
╠════════════════════════════════════════════════════════╣
║  📡 URL: http://localhost:${PORT}                      ║
║  🧪 Test: http://localhost:${PORT}/test-socket         ║
╚════════════════════════════════════════════════════════╝
  `);
});