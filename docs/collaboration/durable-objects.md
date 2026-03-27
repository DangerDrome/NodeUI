# Durable Objects Deployment

The collaboration backend runs as a Cloudflare Durable Object. Each session room is a single Durable Object instance that manages WebSocket connections and broadcasts messages between participants. The implementation uses hibernation to minimize duration charges on the free tier.

## Architecture

```
Browser                Cloudflare Pages              Durable Object
  |                    Function                      (CollaborationRoom)
  |--- WSS upgrade --> /collab/NOVA-WOLF-BLAZE -->  idFromName("NOVA-WOLF-BLAZE")
  |                    extracts session ID            .get(id).fetch(request)
  |<-- 101 Switching Protocols -------------------- WebSocketPair created
  |                                                  state.acceptWebSocket(server)
  |--- { type: "join", userId: "..." } -----------> webSocketMessage()
  |<-- { type: "users-list", users: [...] } ------- broadcast to sender
  |<-- { type: "user-joined", userId } ------------ broadcast to others
```

### Components

**Pages Function** (`functions/collab/[[path]].js`): Catches all requests to `/collab/*`, extracts the session ID from the URL path, looks up the Durable Object by name, and forwards the request.

**Durable Object** (`durable-objects-worker/src/index.js`): The `CollaborationRoom` class. Each instance manages one session room. It accepts WebSocket connections with hibernation support, handles join/leave lifecycle, and broadcasts operations between clients.

## Prerequisites

- A Cloudflare account (free tier works)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) v3+ installed
- Node.js 18+

## Deployment Steps

### Step 1: Deploy the Durable Object Worker

```bash
cd durable-objects-worker
npx wrangler deploy
```

This deploys the worker using the configuration in `wrangler.toml`:

```toml
name = "nodeui-collaboration-do"
main = "src/index.js"
compatibility_date = "2023-10-30"

[[durable_objects.bindings]]
name = "COLLABORATION_ROOMS"
class_name = "CollaborationRoom"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["CollaborationRoom"]
```

::: tip
The `new_sqlite_classes` migration type uses SQLite-backed Durable Objects, which are available on the free tier. This is more cost-effective than the standard storage backend.
:::

### Step 2: Bind the Durable Object to Pages

After deploying the worker, you need to bind it to your Cloudflare Pages project so the Pages Function can access it.

1. Go to the [Cloudflare dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** > your Pages project > **Settings** > **Bindings**
3. Add a **Durable Object Namespace** binding:
   - **Variable name:** `COLLABORATION_ROOMS`
   - **Durable Object namespace:** Select `nodeui-collaboration-do` and the `CollaborationRoom` class

::: warning
The binding variable name must be exactly `COLLABORATION_ROOMS`. The Pages Function references `context.env.COLLABORATION_ROOMS` to look up Durable Object instances.
:::

### Step 3: Deploy the Pages Site

Deploy your NodeUI frontend to Cloudflare Pages. The `functions/collab/[[path]].js` file is automatically picked up as a Pages Function:

```bash
# From the project root
npx wrangler pages deploy . --project-name your-project-name
```

Or configure automatic deployments by connecting your GitHub repository in the Cloudflare Pages dashboard.

### Step 4: Configure the WebSocket URL

If your Pages project is on a custom domain, update `config.js`:

```javascript
if (window.location.hostname === 'yourdomain.com') {
    window.NODEUI_WS_URL = 'wss://yourdomain.com/collab';
}
```

For `*.pages.dev` domains, no configuration is needed -- the auto-detection handles it.

## How the Durable Object Works

### Hibernation

The `CollaborationRoom` uses Cloudflare's [WebSocket Hibernation API](https://developers.cloudflare.com/durable-objects/api/websockets/). Instead of the standard `ws.addEventListener('message', ...)` pattern, it uses class methods:

| Method | When It Runs |
|--------|-------------|
| `fetch(request)` | When a new WebSocket upgrade request arrives |
| `webSocketMessage(ws, message)` | When a connected client sends a message |
| `webSocketClose(ws, code, reason)` | When a client disconnects |
| `webSocketError(ws, error)` | When a WebSocket error occurs |

Between messages, the Durable Object hibernates and does not consume CPU time. This is critical for staying within free tier limits.

### Message Handling

The Durable Object handles four message types:

| Message Type | Action |
|-------------|--------|
| `ping` | Responds with `pong` (keep-alive) |
| `join` | Stores user info via `serializeAttachment()`, sends user list to joiner, broadcasts `user-joined` to others |
| `operation` | Broadcasts the operation to all other connected clients |
| `request-state` / `state-response` | Broadcasts to all other clients (state sync between peers) |

### User Tracking

Each WebSocket connection stores user data through the Durable Object's attachment API:

```javascript
// Store user info on the WebSocket
ws.serializeAttachment({ userId: message.userId, joinTime: Date.now() });

// Read it back later
const stored = ws.deserializeAttachment();
```

This is how the Durable Object knows which user ID belongs to which connection, and can broadcast `user-left` messages when a connection closes.

### Broadcasting

The `broadcast()` method sends a message to every connected WebSocket except the sender:

```javascript
broadcast(message, excludeUserId = null) {
  const messageStr = JSON.stringify(message);
  for (const ws of this.state.getWebSockets()) {
    const stored = ws.deserializeAttachment();
    if (!excludeUserId || !stored || stored.userId !== excludeUserId) {
      ws.send(messageStr);
    }
  }
}
```

## Troubleshooting

### "Durable Object binding not configured"

The Pages Function returns this 500 error when `context.env.COLLABORATION_ROOMS` is undefined. Verify the binding in your Pages project settings.

### WebSocket connection fails silently

Check the browser console for errors. Common causes:
- The Durable Object worker has not been deployed yet
- The Pages Function binding name does not match `COLLABORATION_ROOMS`
- Mixed content: your site uses HTTPS but the WebSocket URL uses `ws://` instead of `wss://`

### Session capacity

Each Durable Object instance has no hard-coded user limit. However, Cloudflare enforces per-request size limits. If state sync payloads exceed these limits (large graphs with embedded images), the connection may drop. The collaboration module logs warnings for payloads over 10MB.

### Free tier limits

Cloudflare's free tier includes:
- 100,000 requests/day to Durable Objects
- 1,000 WebSocket messages/minute per object
- Hibernation is essential -- without it, duration charges accumulate quickly

The keep-alive ping every 30 seconds counts toward message limits. For a two-user session, that is approximately 4 messages/minute for keep-alive alone.
