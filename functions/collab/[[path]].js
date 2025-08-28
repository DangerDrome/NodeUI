/**
 * Pages Function to handle WebSocket connections at /collab/SESSION_ID
 * This routes WebSocket requests to the Durable Object
 */

export async function onRequest(context) {
  const url = new URL(context.request.url);
  
  // Extract session ID from URL
  const pathParts = url.pathname.split('/').filter(p => p);
  const sessionId = pathParts[pathParts.length - 1] || 'default';
  
  // Get the Durable Object namespace
  const namespace = context.env.COLLABORATION_ROOMS;
  if (!namespace) {
    return new Response('Durable Object binding not configured', { status: 500 });
  }
  
  // Get the Durable Object for this session
  const id = namespace.idFromName(sessionId);
  const durableObject = namespace.get(id);
  
  // Forward the request to the Durable Object
  return durableObject.fetch(context.request);
}