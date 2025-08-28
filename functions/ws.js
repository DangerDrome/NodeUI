/**
 * Cloudflare Pages Function for WebSocket collaboration
 * Accessible at: https://nodeui.io/ws
 */

export async function onRequest(context) {
  // Handle WebSocket upgrade
  const upgradeHeader = context.request.headers.get('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket', { status: 426 });
  }

  // Create WebSocket pair
  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  // Handle the WebSocket
  handleSession(server, context);

  // Return 101 Switching Protocols
  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}

async function handleSession(webSocket, context) {
  webSocket.accept();
  
  // In a real implementation with Durable Objects, you'd get the session here
  // For now, we'll handle basic message relaying
  
  webSocket.addEventListener('message', async (event) => {
    try {
      const message = JSON.parse(event.data);
      
      // Echo back for now - in production, you'd broadcast to session members
      switch (message.type) {
        case 'join':
          webSocket.send(JSON.stringify({
            type: 'users-list',
            users: [message.userId]
          }));
          break;
          
        case 'operation':
          // In production, broadcast to all users in session
          webSocket.send(JSON.stringify(message));
          break;
      }
    } catch (err) {
      console.error('Error handling message:', err);
    }
  });

  webSocket.addEventListener('close', () => {
    console.log('Client disconnected');
  });
}