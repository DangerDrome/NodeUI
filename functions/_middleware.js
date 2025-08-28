/**
 * Middleware to handle Durable Objects binding for Pages Functions
 */

export async function onRequest(context) {
  // Make Durable Objects available to all functions
  context.env.COLLABORATION_SESSIONS = context.env.COLLABORATION_SESSIONS || null;
  
  return context.next();
}