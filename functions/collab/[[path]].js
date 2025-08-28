/**
 * Pages Function to handle WebSocket connections at /collab/SESSION_ID
 * This routes WebSocket requests to the Durable Object
 */

export async function onRequest(context) {
  // Only handle WebSocket upgrade requests
  const upgradeHeader = context.request.headers.get('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket', { status: 426 });
  }

  // Extract session ID from URL path
  // URL format: https://nodeui.io/collab/SESSION_ID
  const url = new URL(context.request.url);
  const pathParts = url.pathname.split('/');
  const sessionId = pathParts[pathParts.length - 1] || 'default';

  // Check if Durable Objects binding exists
  if (!context.env.COLLABORATION_ROOMS) {
    return new Response('Durable Objects binding not configured', { status: 500 });
  }

  // Get or create a Durable Object instance for this session
  const id = context.env.COLLABORATION_ROOMS.idFromName(sessionId);
  const stub = context.env.COLLABORATION_ROOMS.get(id);
  
  // Forward the WebSocket request to the Durable Object
  return stub.fetch(context.request);
}