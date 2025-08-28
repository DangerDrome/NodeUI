/**
 * Durable Object for managing collaboration sessions
 * This is imported by the Pages Function
 */

export class CollaborationSession {
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

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    
    server.accept();
    
    let userId = null;
    
    server.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'join':
            userId = message.userId;
            this.sessions.set(userId, server);
            
            // Send current users
            server.send(JSON.stringify({
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
            // Broadcast to all except sender
            this.broadcast(message, message.userId);
            break;
            
          case 'request-state':
            // Forward to other users
            this.broadcast(message, message.userId);
            break;
            
          case 'state-response':
            // Send to specific user or broadcast
            if (message.targetUserId) {
              const targetWs = this.sessions.get(message.targetUserId);
              if (targetWs) {
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
    
    server.addEventListener('close', () => {
      if (userId) {
        this.sessions.delete(userId);
        this.broadcast({
          type: 'user-left',
          userId: userId
        });
      }
    });
    
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }
  
  broadcast(message, excludeUserId = null) {
    const messageStr = JSON.stringify(message);
    this.sessions.forEach((ws, uid) => {
      if (uid !== excludeUserId) {
        try {
          ws.send(messageStr);
        } catch (err) {
          this.sessions.delete(uid);
        }
      }
    });
  }
}