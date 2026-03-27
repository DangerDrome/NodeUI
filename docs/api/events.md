# Event System

The `EventEmitter` class in `src/core/events.js` is a lightweight pub/sub bus that all NodeUI modules use to communicate. A single global instance (`events`) is shared across the entire application.

## How It Works

Modules publish events when something happens. Other modules subscribe to those events and react. No module needs a direct reference to any other module.

```javascript
// Subscribe to an event
const subscription = events.subscribe('node:moved', (data) => {
  console.log(`Node ${data.nodeId} moved to ${data.x}, ${data.y}`);
});

// Publish an event
events.publish('node:moved', { nodeId: 'abc-123', x: 300, y: 150 });

// Unsubscribe when you no longer need it
subscription.unsubscribe();
```

## API

### `events.subscribe(eventName, callback)`

Registers a callback for a specific event.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `eventName` | `string` | The event to listen for. Use `'*'` for a wildcard listener. |
| `callback` | `Function` | The function to call when the event fires. |

**Returns:** An object with an `unsubscribe()` method.

**Wildcard listeners** receive two arguments -- the event name and the data -- while specific listeners receive only the data:

```javascript
// Wildcard: receives (eventName, data)
events.subscribe('*', (eventName, data) => {
  console.log(`[${eventName}]`, data);
});

// Specific: receives (data)
events.subscribe('node:delete', (nodeId) => {
  console.log(`Deleted: ${nodeId}`);
});
```

### `events.publish(eventName, data)`

Fires an event, calling all subscribers in registration order. Wildcard subscribers run first.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `eventName` | `string` | The event name to publish. |
| `data` | `any` | The payload passed to each subscriber callback. |

::: tip Error Isolation
Each subscriber callback is wrapped in a `try/catch`. If one subscriber throws, the remaining subscribers still execute. Errors are logged to the console.
:::

## Event Reference

These are the events used throughout NodeUI. The `data` column shows the payload shape passed to subscriber callbacks.

### Node Events

| Event | Data | Description |
|-------|------|-------------|
| `node:create` | `{ id, x, y, width, height, title, content, type, color, ... }` | Request to create a new node |
| `node:update` | `{ nodeId, ...updatedFields }` | Update one or more node properties |
| `node:moved` | `{ nodeId, x, y }` | Node position changed after drag |
| `node:resized` | `{ nodeId, width, height }` | Node dimensions changed |
| `node:delete` | `nodeId` (string) | Request to delete a node |

### Edge Events

| Event | Data | Description |
|-------|------|-------------|
| `edge:create` | `{ startNodeId, startHandleId, endNodeId, endHandleId }` | Request to create a new edge |
| `edge:update` | `{ edgeId, ...updatedFields }` | Update edge properties (label, routing points) |
| `edge:delete` | `edgeId` (string) | Request to delete an edge |

### Selection Events

| Event | Data | Description |
|-------|------|-------------|
| `selection:changed` | `{ selectedNodeIds: string[], selectedEdgeIds: string[] }` | Selection set changed |

### Collaboration Events

| Event | Data | Description |
|-------|------|-------------|
| `collaboration:connected` | `{ sessionId }` | WebSocket connection established |
| `collaboration:disconnected` | (none) | WebSocket connection lost |
| `collaboration:user-joined` | `{ userId }` | A remote user joined the session |
| `collaboration:user-left` | `{ userId }` | A remote user left the session |
| `collaboration:users-updated` | `{ users: string[] }` | Full user list refreshed |
| `collaboration:error` | `{ error }` | Connection or protocol error |

### SubGraph Events

| Event | Data | Description |
|-------|------|-------------|
| `subgraph:update` | `{ nodeId, internalGraph }` | A subgraph's internal state changed |

## Usage Patterns

### Logging All Events

The wildcard subscriber is useful for debugging. Subscribe to `'*'` to see every event that flows through the system:

```javascript
events.subscribe('*', (eventName, data) => {
  console.log(`[Event] ${eventName}`, data);
});
```

### Preventing Echo in Collaboration

When the collaboration module receives a remote operation, it publishes the event locally. To prevent that local publish from being sent back to the server, each message carries an `_operationId`. The collaboration module tracks these IDs and skips re-broadcasting events it originated:

```javascript
// The collaboration module attaches _operationId to incoming data
events.publish('node:moved', {
  nodeId: 'abc-123',
  x: 300,
  y: 150,
  _operationId: 'remote_user42_1234567890'
});
```

::: warning
Do not rely on `_operationId` in your own code. It is an internal mechanism used by the collaboration layer to prevent infinite loops. The field may not be present on locally originated events.
:::

### Cleaning Up Subscriptions

Always unsubscribe when a module or component is destroyed. Leaked subscriptions cause memory issues and unexpected behavior:

```javascript
class MyPlugin {
  constructor() {
    this.subscriptions = [];
    this.subscriptions.push(
      events.subscribe('node:create', this.onNodeCreate.bind(this))
    );
    this.subscriptions.push(
      events.subscribe('node:delete', this.onNodeDelete.bind(this))
    );
  }

  destroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
  }
}
```
