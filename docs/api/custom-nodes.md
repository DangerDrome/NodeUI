# Custom Nodes

Every node in NodeUI extends the `BaseNode` class. You create custom node types by subclassing `BaseNode` and overriding the methods that control rendering and behavior.

## BaseNode Overview

`BaseNode` (in `src/nodes/basenode.js`) provides the foundation that all nodes share:

- A positioned, resizable `<div>` element on the canvas
- A title bar with icon, title text, pin toggle, and color cycle button
- A content area with markdown rendering and inline editing
- Four connection handles (top, bottom, left, right)
- Resize handles on all edges and corners
- A popover container for additional UI

### Constructor Options

```javascript
const node = new BaseNode({
  id: 'node-001',        // Unique ID (auto-generated UUID if omitted)
  x: 100,                // X position on canvas (default: 0)
  y: 200,                // Y position on canvas (default: 0)
  width: 200,            // Width in pixels (default: 200)
  height: 120,           // Height in pixels (default: 120)
  title: 'My Node',      // Title bar text (default: 'New Node')
  content: '# Hello',    // Markdown content (default: '')
  type: 'BaseNode',      // Type identifier for serialization
  color: 'yellow',       // Color theme (default: 'yellow')
  isPinned: false,       // Pinned nodes stay fixed on screen
  metadata: null          // Optional metadata object
});
```

### Available Colors

Nodes support six color themes. The color name maps to CSS custom properties:

| Color | CSS Variable Prefix |
|-------|-------------------|
| `default` | `--color-node-default-*` |
| `red` | `--color-node-red-*` |
| `green` | `--color-node-green-*` |
| `blue` | `--color-node-blue-*` |
| `yellow` | `--color-node-yellow-*` |
| `purple` | `--color-node-purple-*` |

## Creating a Custom Node

### Step 1: Create the Class File

Create a new file in `src/nodes/`. Name it after your node type in lowercase:

```javascript
// src/nodes/counternode.js

class CounterNode extends BaseNode {
  constructor(options = {}) {
    super({
      ...options,
      type: 'CounterNode',
      title: options.title || 'Counter',
      width: options.width || 180,
      height: options.height || 100,
    });

    // Custom state
    this.count = options.count || 0;
  }
}
```

### Step 2: Override `renderContent`

The `renderContent(contentArea)` method controls what appears inside the node body. The base implementation renders markdown. Override it to render anything you want:

```javascript
class CounterNode extends BaseNode {
  constructor(options = {}) {
    super({
      ...options,
      type: 'CounterNode',
      title: options.title || 'Counter',
      width: options.width || 180,
      height: options.height || 100,
    });
    this.count = options.count || 0;
  }

  renderContent(contentArea) {
    contentArea.style.display = 'flex';
    contentArea.style.alignItems = 'center';
    contentArea.style.justifyContent = 'center';
    contentArea.style.gap = '12px';

    const decrementBtn = document.createElement('button');
    decrementBtn.textContent = '-';
    decrementBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.count--;
      this.updateDisplay();
      events.publish('node:update', { nodeId: this.id, count: this.count });
    });

    this.display = document.createElement('span');
    this.display.style.fontSize = '24px';
    this.display.style.fontWeight = 'bold';
    this.display.textContent = this.count;

    const incrementBtn = document.createElement('button');
    incrementBtn.textContent = '+';
    incrementBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.count++;
      this.updateDisplay();
      events.publish('node:update', { nodeId: this.id, count: this.count });
    });

    contentArea.appendChild(decrementBtn);
    contentArea.appendChild(this.display);
    contentArea.appendChild(incrementBtn);
  }

  updateDisplay() {
    if (this.display) {
      this.display.textContent = this.count;
    }
  }
}
```

::: tip
Always call `e.stopPropagation()` on click and mousedown events inside the content area. Without this, clicks will bubble up and trigger node dragging.
:::

### Step 3: Override the Title Bar Icon

The base title bar includes a default file icon. Override `createTitleBar()` to customize:

```javascript
createTitleBar() {
  const titleBar = super.createTitleBar();
  // Replace the icon class
  const icon = titleBar.querySelector('.node-icon');
  if (icon) {
    icon.className = 'node-icon icon-hash';  // Use a different icon
  }
  return titleBar;
}
```

### Step 4: Handle Serialization

For collaboration and file save/load to work, your custom properties need to be included in the state sync. The collaboration module serializes specific known fields from node instances. For custom properties, add them to the node data object when responding to `node:create` events:

```javascript
// When the main module creates your node from event data, ensure
// your custom properties are passed through the options:
events.subscribe('node:create', (data) => {
  if (data.type === 'CounterNode') {
    const node = new CounterNode({
      ...data,
      count: data.count || 0
    });
    // ... add to canvas
  }
});
```

### Step 5: Register the Node Type

Add a `<script>` tag in `index.html` after `basenode.js`:

```html
<script src="src/nodes/basenode.js"></script>
<script src="src/nodes/counternode.js"></script>
```

Then register it in the context menu so users can create it. The context menu configuration maps type names to constructors.

## Existing Node Types

NodeUI ships with these built-in node types, each demonstrating different extension patterns:

| Type | File | Purpose |
|------|------|---------|
| `BaseNode` | `basenode.js` | Standard node with markdown content |
| `GroupNode` | `groupnode.js` | Container that holds other nodes |
| `RoutingNode` | `routingnode.js` | Minimal node for edge path management |
| `LogNode` | `lognode.js` | Displays real-time event log |
| `SettingsNode` | `settingsnode.js` | Application settings UI |
| `SubGraphNode` | `subgraphnode.js` | Nested graph with independent state |
| `ThreeJSNode` | `threejsnode.js` | Embedded 3D viewport (Three.js) |
| `ImageSequenceNode` | `imagesequencenode.js` | Frame-by-frame image animation |

## Key Methods to Override

| Method | Base Behavior | When to Override |
|--------|--------------|-----------------|
| `renderContent(contentArea)` | Renders markdown from `this.content` | You want custom UI inside the node body |
| `createTitleBar()` | Standard title bar with icon, text, pin, color cycle | You want a different title bar layout or icon |
| `createContentArea()` | Creates an empty `<div>` with class `node-content` | You need a different container element |
| `render(parentElement)` | Full node rendering pipeline | You need to completely change the DOM structure |

## Properties Available on Every Node

These properties are set by `BaseNode` and available in all subclasses:

| Property | Type | Description |
|----------|------|-------------|
| `this.id` | `string` | Unique node identifier |
| `this.x`, `this.y` | `number` | Canvas position |
| `this.width`, `this.height` | `number` | Dimensions in pixels |
| `this.title` | `string` | Title bar text |
| `this.content` | `string` | Markdown content |
| `this.type` | `string` | Type identifier string |
| `this.color` | `string` | Color theme name |
| `this.isPinned` | `boolean` | Whether the node is pinned to the viewport |
| `this.element` | `HTMLElement` | The root DOM element |
| `this.handles` | `object` | Map of handle position to handle DOM elements |
| `this.connections` | `Map` | Maps handle positions to sets of connected edge IDs |

## Publishing Updates

When your node's state changes, publish a `node:update` event so the rest of the system (auto-save, collaboration, undo) stays in sync:

```javascript
events.publish('node:update', {
  nodeId: this.id,
  count: this.count,        // Your custom properties
  title: 'Updated Title'    // Standard properties work too
});
```

::: warning
Do not mutate `this.x`, `this.y`, `this.width`, or `this.height` directly. These are managed by the interaction system. Publish `node:moved` or `node:resized` events instead, and the system will update the values and re-render.
:::
