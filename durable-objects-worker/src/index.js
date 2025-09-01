/**
 * Worker that exports the CollaborationRoom Durable Object
 * This needs to be deployed first so Pages can reference it
 */

// Export the Durable Object class with hibernation support
export class CollaborationRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.MAX_USERS = 50;
    this.MAX_OPS_PER_SECOND = 20;
    
    // Initialize hibernation WebSocket handler
    this.state.getWebSockets().forEach(ws => {
      // Re-establish any websockets that survived hibernation
      this.handleSocket(ws);
    });
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket with hibernation capability
    await this.handleSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async handleSocket(webSocket) {
    // Accept the WebSocket connection
    this.state.acceptWebSocket(webSocket);
    
    // Attach user data placeholder
    const tags = ['pending'];
    webSocket.serializeAttachment({
      userId: null,
      joinTime: Date.now(),
      operationCount: 0,
      operationResetTime: Date.now() + 1000
    });
  }

  // Called when a WebSocket message is received (wakes from hibernation)
  async webSocketMessage(ws, message) {
    try {
      const data = JSON.parse(message);
      
      // Handle ping/pong
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }
      
      if (data.type === 'pong') {
        return;
      }
      
      // Get attachment data
      let attachment = ws.deserializeAttachment();
      if (!attachment) {
        attachment = {
          userId: null,
          joinTime: Date.now(),
          operationCount: 0,
          operationResetTime: Date.now() + 1000
        };
      }
      
      switch (data.type) {
        case 'join':
          await this.handleJoin(ws, data, attachment);
          break;
          
        case 'operation':
          await this.handleOperation(ws, data, attachment);
          break;
          
        case 'request-state':
          await this.broadcast(data, data.userId);
          break;
          
        case 'state-response':
          await this.handleStateResponse(data);
          break;
      }
    } catch (err) {
      console.error('Message error:', err);
    }
  }

  // Called when a WebSocket is closed
  async webSocketClose(ws, code, reason, wasClean) {
    const attachment = ws.deserializeAttachment();
    if (attachment && attachment.userId) {
      // Notify others
      await this.broadcast({
        type: 'user-left',
        userId: attachment.userId
      });
    }
  }
  
  // Called when an error occurs on the WebSocket
  async webSocketError(ws, error) {
    console.error('WebSocket error:', error);
    ws.close(1011, 'Server error');
  }

  async handleJoin(ws, data, attachment) {
    const websockets = this.state.getWebSockets();
    
    // Count current active users
    let userCount = 0;
    for (const socket of websockets) {
      const att = socket.deserializeAttachment();
      if (att && att.userId) userCount++;
    }
    
    // Check user limit
    if (userCount >= this.MAX_USERS) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Session full - maximum 50 users reached'
      }));
      ws.close();
      return;
    }
    
    // Update attachment with userId
    attachment.userId = data.userId;
    ws.serializeAttachment(attachment);
    
    // Get all user IDs
    const users = [];
    for (const socket of websockets) {
      const att = socket.deserializeAttachment();
      if (att && att.userId) {
        users.push(att.userId);
      }
    }
    
    // Send current users list
    ws.send(JSON.stringify({
      type: 'users-list',
      users: users
    }));
    
    // Notify others
    await this.broadcast({
      type: 'user-joined',
      userId: data.userId
    }, data.userId);
  }

  async handleOperation(ws, data, attachment) {
    if (!attachment || !attachment.userId) return;
    
    // Rate limiting
    const now = Date.now();
    
    // Reset counter if second has passed
    if (now > attachment.operationResetTime) {
      attachment.operationCount = 0;
      attachment.operationResetTime = now + 1000;
    }
    
    // Check if over limit
    if (attachment.operationCount >= this.MAX_OPS_PER_SECOND) {
      // Silently drop
      return;
    }
    
    // Increment counter
    attachment.operationCount++;
    ws.serializeAttachment(attachment);
    
    // Broadcast the operation
    await this.broadcast(data, data.userId);
  }

  async handleStateResponse(data) {
    if (data.targetUserId) {
      // Send to specific user
      const websockets = this.state.getWebSockets();
      for (const socket of websockets) {
        const att = socket.deserializeAttachment();
        if (att && att.userId === data.targetUserId) {
          socket.send(JSON.stringify(data));
          break;
        }
      }
    } else {
      // Broadcast to all
      await this.broadcast(data, data.userId);
    }
  }

  async broadcast(message, excludeUserId = null) {
    const messageStr = JSON.stringify(message);
    const websockets = this.state.getWebSockets();
    
    for (const ws of websockets) {
      try {
        const attachment = ws.deserializeAttachment();
        if (!excludeUserId || (attachment && attachment.userId !== excludeUserId)) {
          ws.send(messageStr);
        }
      } catch (err) {
        // Socket error, will be cleaned up
      }
    }
  }
}

// Export default required for worker
export default {
  async fetch(request, env) {
    return new Response('CollaborationRoom Durable Object Worker', {
      headers: { 'content-type': 'text/plain' },
    });
  }
}