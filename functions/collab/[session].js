/**
 * Cloudflare Pages Function with Durable Objects for collaboration
 * Accessible at: https://nodeui.io/collab/SESSION_ID
 * 
 * This provides full session management with Durable Objects
 */

// Export the Durable Object class
export { CollaborationSession } from '../../src/CollaborationSession.js';

export async function onRequest(context) {
  const upgradeHeader = context.request.headers.get('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket', { status: 426 });
  }

  // Get session ID from URL
  const sessionId = context.params.session || 'default';
  
  // Get or create Durable Object for this session
  if (context.env.COLLABORATION_SESSIONS) {
    const id = context.env.COLLABORATION_SESSIONS.idFromName(sessionId);
    const stub = context.env.COLLABORATION_SESSIONS.get(id);
    
    // Forward request to Durable Object
    return stub.fetch(context.request);
  } else {
    // Fallback if Durable Objects not configured
    return handleBasicWebSocket(context.request, sessionId);
  }
}

// Basic WebSocket handler without Durable Objects
function handleBasicWebSocket(request, sessionId) {
  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);
  
  server.accept();
  
  server.addEventListener('message', (event) => {
    try {
      const message = JSON.parse(event.data);
      // Echo back - in production would broadcast
      server.send(JSON.stringify(message));
    } catch (err) {
      console.error('Error:', err);
    }
  });
  
  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}