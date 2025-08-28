/**
 * NodeUI Collaboration Server using Cloudflare Durable Objects
 * 
 * This provides a complete WebSocket server implementation that can handle
 * multiple sessions with proper state management.
 */

// Durable Object class for managing collaboration sessions
export class CollaborationSession {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    // Map of WebSocket connections by userId
    this.sessions = new Map();
  }

  async fetch(request) {
    // Only accept WebSocket
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket connection', { status: 426 });
    }

    // Create WebSocket pair
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Accept the connection
    server.accept();

    // Generate a unique connection ID
    const connectionId = crypto.randomUUID();
    let userId = null;

    // Handle messages
    server.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'join':
            userId = message.userId;
            this.sessions.set(userId, server);
            
            // Send current users list
            server.send(JSON.stringify({
              type: 'users-list',
              users: Array.from(this.sessions.keys())
            }));
            
            // Broadcast user joined to others
            this.broadcast({
              type: 'user-joined',
              userId: userId
            }, userId);
            break;
            
          case 'operation':
            // Broadcast operation to all other users
            this.broadcast({
              type: 'operation',
              ...message
            }, message.userId);
            break;
            
          case 'request-state':
            // Forward state request to other users
            this.broadcast({
              type: 'request-state',
              ...message
            }, message.userId);
            break;
            
          case 'state-response':
            // Forward state response to specific user or all
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
      } catch (error) {
        console.error('Error handling message:', error);
      }
    });

    // Handle disconnect
    server.addEventListener('close', () => {
      if (userId) {
        this.sessions.delete(userId);
        // Broadcast user left
        this.broadcast({
          type: 'user-left',
          userId: userId
        });
      }
    });

    // Return the client WebSocket
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  // Broadcast message to all users except sender
  broadcast(message, excludeUserId = null) {
    const messageStr = JSON.stringify(message);
    this.sessions.forEach((ws, uid) => {
      if (uid !== excludeUserId) {
        try {
          ws.send(messageStr);
        } catch (error) {
          // Connection might be closed
          this.sessions.delete(uid);
        }
      }
    });
  }
}

// Worker script that routes requests to Durable Objects
export default {
  async fetch(request, env) {
    try {
      // Parse the URL to get session ID
      const url = new URL(request.url);
      const sessionId = url.pathname.slice(1) || 'default';
      
      // Get the Durable Object for this session
      const id = env.COLLABORATION_SESSIONS.idFromName(sessionId);
      const session = env.COLLABORATION_SESSIONS.get(id);
      
      // Forward the request to the Durable Object
      return await session.fetch(request);
    } catch (error) {
      return new Response(error.message, { status: 500 });
    }
  }
};