/**
 * Worker that exports the CollaborationRoom Durable Object
 * This needs to be deployed first so Pages can reference it
 */

// Export the Durable Object class
export class CollaborationRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map(); // userId -> WebSocket
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    await this.handleSession(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async handleSession(webSocket) {
    webSocket.accept();
    
    let userId = null;
    
    // Keep-alive ping every 30 seconds
    const pingInterval = setInterval(() => {
      if (webSocket.readyState === 1) {
        webSocket.send(JSON.stringify({ type: 'ping' }));
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);
    
    webSocket.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data);
        
        // Respond to ping with pong
        if (message.type === 'ping') {
          webSocket.send(JSON.stringify({ type: 'pong' }));
          return;
        }
        
        switch (message.type) {
          case 'join':
            userId = message.userId;
            this.sessions.set(userId, webSocket);
            
            // Send current users
            webSocket.send(JSON.stringify({
              type: 'users-list',
              users: Array.from(this.sessions.keys())
            }));
            
            // Notify others
            this.broadcast({
              type: 'user-joined',
              userId: userId
            }, userId);
            break;
            
          case 'operation':
            this.broadcast(message, message.userId);
            break;
            
          case 'request-state':
            this.broadcast(message, message.userId);
            break;
            
          case 'state-response':
            if (message.targetUserId) {
              const targetWs = this.sessions.get(message.targetUserId);
              if (targetWs && targetWs.readyState === 1) {
                targetWs.send(JSON.stringify(message));
              }
            } else {
              this.broadcast(message, message.userId);
            }
            break;
        }
      } catch (err) {
        console.error('Message error:', err);
      }
    });
    
    webSocket.addEventListener('close', () => {
      clearInterval(pingInterval);
      if (userId) {
        this.sessions.delete(userId);
        this.broadcast({
          type: 'user-left',
          userId: userId
        });
      }
    });
    
    webSocket.addEventListener('error', (err) => {
      console.error('WebSocket error:', err);
      clearInterval(pingInterval);
    });
  }
  
  broadcast(message, excludeUserId = null) {
    const messageStr = JSON.stringify(message);
    this.sessions.forEach((ws, uid) => {
      if (uid !== excludeUserId && ws.readyState === 1) {
        try {
          ws.send(messageStr);
        } catch (err) {
          this.sessions.delete(uid);
        }
      }
    });
  }
}

// Default export for the Worker (required)
export default {
  async fetch(request, env) {
    return new Response('This Worker exports the CollaborationRoom Durable Object', {
      headers: { 'content-type': 'text/plain' },
    });
  }
}