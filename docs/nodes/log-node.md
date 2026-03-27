# LogNode

A real-time event log node that subscribes to the global event bus and displays every event as it fires. LogNode is the primary debugging tool in NodeUI.

## Key Features

- **Wildcard event subscription** -- captures every event published on the global event bus
- **Real-time display** -- events appear instantly with auto-scroll to the latest entry
- **Structured output** -- each log entry shows the event name in brackets followed by a JSON-serialized payload
- **Circular reference handling** -- safely serializes objects with circular structures
- **Clipboard monitoring** -- listens to `clipboard:changed` events for copy/paste debugging
- **Editable log** -- double-click the log container to select and copy text
- **Terminal icon** in the title bar to distinguish from other node types

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `width` | `number` | `400` | Width in pixels |
| `height` | `number` | `300` | Height in pixels |
| `title` | `string` | `'Event Log'` | Display title in the title bar |
| `color` | `string` | `'default'` | Color theme variant |

## Usage

### Viewing Events

Add a LogNode to the canvas. It immediately begins capturing events. Each entry appears as:

```
[event:name] { "key": "value" }
```

The log auto-scrolls to keep the most recent events visible.

### Selecting and Copying Log Text

Double-click the log container to enter editable mode. You can then select text and copy it. Press `Escape` or click outside to exit editable mode.

### Event Types You Will See

LogNode captures all events on the bus, including but not limited to:

- `node:update` -- when any node property changes
- `node:visual-update` -- when a node's visual state changes (resize, color)
- `graph:save` / `graph:load-content` -- graph serialization events
- `setting:update` -- when a setting value changes
- `clipboard:changed` -- when the clipboard contents change
- `log:info` -- informational messages (displayed without JSON payload)

### Cleanup

LogNode properly unsubscribes from the event bus when destroyed, preventing memory leaks.

::: tip
Add a LogNode early in your workflow to understand how events flow through the system. It is invaluable for debugging edge connections, node updates, and custom interactions.
:::
