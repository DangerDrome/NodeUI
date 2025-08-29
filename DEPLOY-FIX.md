# Fix WebSocket Disconnection Issues

The WebSocket keeps disconnecting because the Durable Object needs to be redeployed with a more aggressive ping interval.

## Steps to fix:

1. **Deploy the updated Durable Object:**
```bash
cd durable-objects-worker
wrangler deploy
```

2. **Commit and push the changes:**
```bash
git add .
git commit -m "fix: Reduce WebSocket ping interval to prevent timeouts"
git push
```

## What was changed:
- Reduced server ping interval from 30s to 20s (Cloudflare has strict timeouts)
- Added proper handling for client pong messages
- Client now has exponential backoff reconnection (1s, 2s, 4s, 8s... up to 30s)

## Why it keeps disconnecting:
- Cloudflare has a ~30 second timeout on idle WebSocket connections
- The server was pinging every 30 seconds, which was too close to the timeout
- Now pings every 20 seconds to stay well within the limit

## Alternative solutions if this doesn't work:
1. Use Server-Sent Events (SSE) instead of WebSockets
2. Use a different hosting provider for the WebSocket server
3. Implement long-polling as a fallback