/**
 * Test endpoint to verify Durable Objects binding
 * Visit: https://nodeui.io/collab-test
 */

export async function onRequest(context) {
  const info = {
    message: "Collaboration test endpoint",
    hasDurableObjectBinding: !!context.env.COLLABORATION_ROOMS,
    env: Object.keys(context.env),
    timestamp: new Date().toISOString()
  };
  
  return new Response(JSON.stringify(info, null, 2), {
    headers: { 'content-type': 'application/json' }
  });
}