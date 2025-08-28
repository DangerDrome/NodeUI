/**
 * NodeUI Collaboration Server for Cloudflare Workers
 * 
 * Deploy this as a Cloudflare Worker to enable real-time collaboration
 * without needing a separate server.
 */

export default {
  async fetch(request, env) {
    // Only accept WebSocket connections
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket connection', { status: 426 });
    }

    // Create WebSocket pair
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Accept the WebSocket connection
    server.accept();

    // Get or create session state
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('session') || 'default';
    
    // Handle the WebSocket connection
    server.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data);
        
        // Handle different message types
        switch (message.type) {
          case 'join':
            await handleJoin(server, message, sessionId, env);
            break;
            
          case 'leave':
            await handleLeave(server, message, sessionId, env);
            break;
            
          case 'operation':
            await handleOperation(server, message, sessionId, env);
            break;
            
          case 'request-state':
            await handleStateRequest(server, message, sessionId, env);
            break;
            
          case 'state-response':
            await handleStateResponse(server, message, sessionId, env);
            break;
            
          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Error handling message:', error);
      }
    });

    // Clean up on close
    server.addEventListener('close', async () => {
      // In a real implementation, you'd remove the user from the session
      console.log('Client disconnected');
    });

    // Return the client WebSocket
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }
};

// Helper functions for message handling
async function handleJoin(ws, message, sessionId, env) {
  // In a production setup, you'd use Durable Objects to maintain session state
  // For now, we'll just acknowledge the join
  ws.send(JSON.stringify({
    type: 'users-list',
    users: [message.userId]
  }));
}

async function handleLeave(ws, message, sessionId, env) {
  // Notify other users about the leave
  // In production, broadcast to all users in the session
}

async function handleOperation(ws, message, sessionId, env) {
  // Broadcast the operation to all other users in the session
  // In production, you'd maintain a list of connections per session
  ws.send(JSON.stringify({
    type: 'operation',
    ...message
  }));
}

async function handleStateRequest(ws, message, sessionId, env) {
  // Request state from other users
  // In production, forward this request to other connected clients
}

async function handleStateResponse(ws, message, sessionId, env) {
  // Forward state response to requesting user
  // In production, route this to the specific requesting client
}