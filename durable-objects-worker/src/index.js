/**
 * Worker that exports the CollaborationRoom Durable Object
 * This needs to be deployed first so Pages can reference it
 */

// Export the Durable Object class with WebSocket hibernation support
export class CollaborationRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.MAX_USERS = 50; // Max concurrent users per session
    this.MAX_OPS_PER_SECOND = 20; // Max operations per second per user
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket connection with hibernation
    this.state.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  // Called when a WebSocket message is received (wakes from hibernation if needed)
  async webSocketMessage(webSocket, message) {
    try {
      const data = JSON.parse(message);
      
      // Handle ping/pong (though auto-response should handle most)
      if (data.type === 'ping') {
        webSocket.send(JSON.stringify({ type: 'pong' }));
        return;
      }
      
      if (data.type === 'pong') {
        return;
      }
      
      switch (data.type) {
        case 'join':
          await this.handleJoin(webSocket, data);
          break;
          
        case 'operation':
          await this.handleOperation(webSocket, data);
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
  async webSocketClose(webSocket, code, reason, wasClean) {
    // Get all websockets to find which user disconnected
    const websockets = this.state.getWebSockets();
    let userId = null;
    
    // Find the userId for this websocket
    for (const ws of websockets) {
      const metadata = ws.getUserData();
      if (metadata && ws === webSocket) {
        userId = metadata.userId;
        break;
      }
    }
    
    if (userId) {
      // Notify others
      await this.broadcast({
        type: 'user-left',
        userId: userId
      });
    }
  }

  // Called when the Durable Object may be evicted
  async webSocketError(webSocket, error) {
    console.error('WebSocket error:', error);
    // Close the websocket on error
    webSocket.close(1011, 'Server error');
  }

  async handleJoin(webSocket, data) {
    const websockets = this.state.getWebSockets();
    
    // Count current users
    let userCount = 0;
    for (const ws of websockets) {
      if (ws.readyState === 1) userCount++;
    }
    
    // Check user limit
    if (userCount >= this.MAX_USERS) {
      webSocket.send(JSON.stringify({
        type: 'error',
        message: 'Session full - maximum 50 users reached'
      }));
      webSocket.close();
      return;
    }
    
    // Store userId as websocket metadata
    webSocket.setUserData({ 
      userId: data.userId,
      joinTime: Date.now(),
      operationCount: 0,
      operationResetTime: Date.now() + 1000
    });
    
    // Get all user IDs
    const users = [];
    for (const ws of websockets) {
      const metadata = ws.getUserData();
      if (metadata && metadata.userId && ws.readyState === 1) {
        users.push(metadata.userId);
      }
    }
    
    // Send current users list
    webSocket.send(JSON.stringify({
      type: 'users-list',
      users: users
    }));
    
    // Notify others
    await this.broadcast({
      type: 'user-joined',
      userId: data.userId
    }, data.userId);
  }

  async handleOperation(webSocket, data) {
    const metadata = webSocket.getUserData();
    if (!metadata) return;
    
    // Rate limiting
    const now = Date.now();
    
    // Reset counter if second has passed
    if (now > metadata.operationResetTime) {
      metadata.operationCount = 0;
      metadata.operationResetTime = now + 1000;
    }
    
    // Check if over limit
    if (metadata.operationCount >= this.MAX_OPS_PER_SECOND) {
      // Silently drop the message
      return;
    }
    
    // Increment counter
    metadata.operationCount++;
    webSocket.setUserData(metadata);
    
    // Broadcast the operation
    await this.broadcast(data, data.userId);
  }

  async handleStateResponse(data) {
    if (data.targetUserId) {
      // Send to specific user
      const websockets = this.state.getWebSockets();
      for (const ws of websockets) {
        const metadata = ws.getUserData();
        if (metadata && metadata.userId === data.targetUserId && ws.readyState === 1) {
          ws.send(JSON.stringify(data));
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
        const metadata = ws.getUserData();
        if (ws.readyState === 1 && (!excludeUserId || metadata?.userId !== excludeUserId)) {
          ws.send(messageStr);
        }
      } catch (err) {
        // Connection error, it will be cleaned up by webSocketClose
      }
    }
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