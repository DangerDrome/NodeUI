# Real-Time Collaboration

NodeUI supports real-time multi-user editing through WebSocket connections backed by Cloudflare Durable Objects. Multiple users can work on the same graph simultaneously, with node operations, edge changes, and subgraph updates synced in real time.

## How It Works

```
 User A (browser)              Cloudflare              User B (browser)
 +--------------+     wss://    +-----------+    wss://  +--------------+
 | Collaboration|<------------>| Durable   |<---------->| Collaboration|
 | module       |   WebSocket  | Object    |  WebSocket | module       |
 +--------------+              | (room)    |            +--------------+
       |                       +-----------+                  |
       v                                                      v
  events.publish()                                     events.publish()
  (local changes)                                      (remote changes)
```

1. A user starts or joins a **session** identified by a memorable three-word code (e.g., `NOVA-WOLF-BLAZE`)
2. The browser opens a WebSocket connection to a Cloudflare Pages Function at `/collab/{SESSION_ID}`
3. The Pages Function routes the connection to a **Durable Object** that acts as the room
4. The Durable Object broadcasts messages to all connected clients in that room
5. Each client's `Collaboration` module translates local events into WebSocket messages and remote messages into local events

## Synced Events

These events are automatically broadcast to all users in a session:

| Event | What Syncs |
|-------|-----------|
| `node:update` | Title, content, color, pin state, and custom properties |
| `node:moved` | Node position after drag |
| `node:resized` | Node dimensions after resize |
| `node:delete` | Node removal |
| `edge:create` | New edge connections |
| `edge:update` | Edge label and routing point changes |
| `edge:delete` | Edge removal |
| `subgraph:update` | Internal graph state of SubGraphNodes |

::: tip
Node creation (`node:create`) is handled separately from the sync event list. It is dispatched directly during state sync to prevent duplication loops.
:::

## Session Management

### Starting a Session

Click the status indicator in the bottom-left corner to start a new session. NodeUI generates a three-word session code and connects automatically.

Programmatically:

```javascript
const sessionId = nodeUI.collaboration.startSession();
// Returns something like 'NOVA-WOLF-BLAZE'
```

### Joining a Session

Share the session code with a collaborator. They enter it through the join dialog or pass it as part of their workflow:

```javascript
nodeUI.collaboration.joinSession('NOVA-WOLF-BLAZE');
```

### Leaving a Session

```javascript
nodeUI.collaboration.leaveSession();
```

This closes the WebSocket, clears the session ID, and removes all nodes from the canvas.

### Session Info

```javascript
const info = nodeUI.collaboration.getSessionInfo();
// {
//   sessionId: 'NOVA-WOLF-BLAZE',
//   userId: 'flux-ember_m4k7x9',
//   isConnected: true,
//   connectedUsers: ['flux-ember_m4k7x9', 'dark-wolf_p2j8q1'],
//   userCount: 2
// }
```

## State Synchronization

When a new user joins an existing session, the system syncs the current graph state:

1. The new user sends a `request-state` message
2. An existing user responds with a `state-response` containing all nodes and edges
3. The new user loads the remote state, clearing their local canvas first
4. A `hasLoadedState` flag prevents processing duplicate state responses

::: warning
State sync transfers the full graph as JSON. Large graphs with embedded image data (ImageSequenceNodes) can produce messages over 10MB. The system logs warnings for payloads exceeding this size.
:::

## Presence

Each user gets a randomly generated display name made of two words (e.g., `flux-ember`). Connected users appear in the top-right corner of the screen.

The status indicator in the bottom-left shows:

| State | Display | Click Action |
|-------|---------|-------------|
| No session | `Session: none` | Start a new session |
| Connected | `Session: NOVA-WOLF-BLAZE` | Copy session ID to clipboard |
| Disconnected | `Session: NOVA-WOLF-BLAZE (offline)` | Attempt reconnection |

## Reconnection

If the WebSocket connection drops, NodeUI automatically attempts to reconnect with exponential backoff:

- Retry intervals: 1s, 2s, 4s, 8s, 16s, 30s (capped)
- Maximum attempts: 10
- After max attempts, the user sees an error prompting a page refresh

A keep-alive ping is sent every 30 seconds to prevent idle connection timeouts.

## Architecture Details

See the following pages for setup and deployment:

- [WebSocket Configuration](./websocket-setup.md) -- How to configure the WebSocket URL
- [Durable Objects Deployment](./durable-objects.md) -- How to deploy the collaboration backend
