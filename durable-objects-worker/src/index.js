/**
 * Minimal CollaborationRoom Durable Object with hibernation
 * Reduces duration charges by hibernating when inactive
 */

export class CollaborationRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    
    // Accept the websocket connection
    this.state.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws, messageStr) {
    // Handle incoming messages
    try {
      const message = JSON.parse(messageStr);
      
      // Get stored data for this websocket
      const stored = ws.deserializeAttachment() || {};
      
      switch (message.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
          
        case 'join':
          // Store user info
          stored.userId = message.userId;
          stored.joinTime = Date.now();
          ws.serializeAttachment(stored);
          
          // Get all connected users
          const users = [];
          for (const socket of this.state.getWebSockets()) {
            const data = socket.deserializeAttachment();
            if (data && data.userId) {
              users.push(data.userId);
            }
          }
          
          // Send user list
          ws.send(JSON.stringify({
            type: 'users-list',
            users: users
          }));
          
          // Notify others
          this.broadcast({
            type: 'user-joined',
            userId: message.userId
          }, message.userId);
          break;
          
        case 'operation':
        case 'request-state':
        case 'state-response':
          // Just broadcast these
          this.broadcast(message, message.userId);
          break;
      }
    } catch (err) {
      console.error('Message handling error:', err);
    }
  }

  async webSocketClose(ws, code, reason, wasClean) {
    const stored = ws.deserializeAttachment();
    if (stored && stored.userId) {
      this.broadcast({
        type: 'user-left',
        userId: stored.userId
      });
    }
  }
  
  async webSocketError(ws, error) {
    console.error('WebSocket error:', error);
    ws.close(1011, 'Server error');
  }

  broadcast(message, excludeUserId = null) {
    const messageStr = JSON.stringify(message);
    for (const ws of this.state.getWebSockets()) {
      const stored = ws.deserializeAttachment();
      if (!excludeUserId || !stored || stored.userId !== excludeUserId) {
        try {
          ws.send(messageStr);
        } catch (err) {
          // Ignore send errors
        }
      }
    }
  }
}

export default {
  async fetch(request, env) {
    return new Response('Collaboration Worker', { status: 200 });
  }
}