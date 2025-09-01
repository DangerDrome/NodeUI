/**
 * Worker that exports the CollaborationRoom Durable Object
 * This version supports hibernation but falls back gracefully
 */

export class CollaborationRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map(); // userId -> WebSocket
    this.operationCounts = new Map(); // userId -> { count, resetTime }
    this.MAX_USERS = 50;
    this.MAX_OPS_PER_SECOND = 20;
    
    // Check if hibernation API is available
    this.hibernationSupported = typeof this.state.acceptWebSocket === 'function';
    
    if (this.hibernationSupported) {
      // Re-establish websockets that survived hibernation
      this.state.getWebSockets().forEach(ws => {
        const data = ws.deserializeAttachment();
        if (data && data.userId) {
          this.sessions.set(data.userId, ws);
        }
      });
    }
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    if (this.hibernationSupported) {
      // Use hibernation API
      await this.handleHibernatingSocket(server);
    } else {
      // Use traditional handling
      await this.handleTraditionalSocket(server);
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  // Hibernation-aware socket handling
  async handleHibernatingSocket(webSocket) {
    this.state.acceptWebSocket(webSocket);
    webSocket.serializeAttachment({
      userId: null,
      joinTime: Date.now(),
      operationCount: 0,
      operationResetTime: Date.now() + 1000
    });
  }

  // Traditional socket handling (fallback)
  async handleTraditionalSocket(webSocket) {
    webSocket.accept();
    
    let userId = null;
    let pingInterval = null;
    
    // Only set up ping interval in traditional mode
    pingInterval = setInterval(() => {
      if (webSocket.readyState === 1) {
        try {
          webSocket.send(JSON.stringify({ type: 'ping' }));
        } catch (err) {
          clearInterval(pingInterval);
        }
      } else {
        clearInterval(pingInterval);
      }
    }, 20000);
    
    webSocket.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'ping') {
          webSocket.send(JSON.stringify({ type: 'pong' }));
          return;
        }
        
        if (message.type === 'pong') {
          return;
        }
        
        switch (message.type) {
          case 'join':
            if (this.sessions.size >= this.MAX_USERS) {
              webSocket.send(JSON.stringify({
                type: 'error',
                message: 'Session full - maximum 50 users reached'
              }));
              webSocket.close();
              return;
            }
            
            userId = message.userId;
            this.sessions.set(userId, webSocket);
            
            webSocket.send(JSON.stringify({
              type: 'users-list',
              users: Array.from(this.sessions.keys())
            }));
            
            this.broadcast({
              type: 'user-joined',
              userId: userId
            }, userId);
            break;
            
          case 'operation':
            const now = Date.now();
            const userOps = this.operationCounts.get(message.userId) || { count: 0, resetTime: now + 1000 };
            
            if (now > userOps.resetTime) {
              userOps.count = 0;
              userOps.resetTime = now + 1000;
            }
            
            if (userOps.count >= this.MAX_OPS_PER_SECOND) {
              return;
            }
            
            userOps.count++;
            this.operationCounts.set(message.userId, userOps);
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
        this.operationCounts.delete(userId);
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

  // Hibernation API: called when message received
  async webSocketMessage(ws, message) {
    try {
      const data = JSON.parse(message);
      let attachment = ws.deserializeAttachment() || {
        userId: null,
        joinTime: Date.now(),
        operationCount: 0,
        operationResetTime: Date.now() + 1000
      };
      
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }
      
      if (data.type === 'pong') {
        return;
      }
      
      switch (data.type) {
        case 'join':
          // Count users
          let userCount = 0;
          for (const socket of this.state.getWebSockets()) {
            const att = socket.deserializeAttachment();
            if (att && att.userId) userCount++;
          }
          
          if (userCount >= this.MAX_USERS) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Session full - maximum 50 users reached'
            }));
            ws.close();
            return;
          }
          
          attachment.userId = data.userId;
          ws.serializeAttachment(attachment);
          this.sessions.set(data.userId, ws);
          
          // Get users list
          const users = [];
          for (const socket of this.state.getWebSockets()) {
            const att = socket.deserializeAttachment();
            if (att && att.userId) {
              users.push(att.userId);
            }
          }
          
          ws.send(JSON.stringify({
            type: 'users-list',
            users: users
          }));
          
          await this.hibernatingBroadcast({
            type: 'user-joined',
            userId: data.userId
          }, data.userId);
          break;
          
        case 'operation':
          if (!attachment.userId) return;
          
          const now = Date.now();
          if (now > attachment.operationResetTime) {
            attachment.operationCount = 0;
            attachment.operationResetTime = now + 1000;
          }
          
          if (attachment.operationCount >= this.MAX_OPS_PER_SECOND) {
            return;
          }
          
          attachment.operationCount++;
          ws.serializeAttachment(attachment);
          
          await this.hibernatingBroadcast(data, data.userId);
          break;
          
        case 'request-state':
          await this.hibernatingBroadcast(data, data.userId);
          break;
          
        case 'state-response':
          if (data.targetUserId) {
            for (const socket of this.state.getWebSockets()) {
              const att = socket.deserializeAttachment();
              if (att && att.userId === data.targetUserId) {
                socket.send(JSON.stringify(data));
                break;
              }
            }
          } else {
            await this.hibernatingBroadcast(data, data.userId);
          }
          break;
      }
    } catch (err) {
      console.error('Message error:', err);
    }
  }

  // Hibernation API: called when socket closes
  async webSocketClose(ws, code, reason, wasClean) {
    const attachment = ws.deserializeAttachment();
    if (attachment && attachment.userId) {
      this.sessions.delete(attachment.userId);
      await this.hibernatingBroadcast({
        type: 'user-left',
        userId: attachment.userId
      });
    }
  }

  // Hibernation API: called on socket error
  async webSocketError(ws, error) {
    console.error('WebSocket error:', error);
    ws.close(1011, 'Server error');
  }

  // Traditional broadcast
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

  // Hibernation-aware broadcast
  async hibernatingBroadcast(message, excludeUserId = null) {
    const messageStr = JSON.stringify(message);
    for (const ws of this.state.getWebSockets()) {
      try {
        const attachment = ws.deserializeAttachment();
        if (!excludeUserId || (attachment && attachment.userId !== excludeUserId)) {
          ws.send(messageStr);
        }
      } catch (err) {
        // Will be cleaned up by webSocketClose
      }
    }
  }
}

export default {
  async fetch(request, env) {
    return new Response('CollaborationRoom Durable Object Worker', {
      headers: { 'content-type': 'text/plain' },
    });
  }
}