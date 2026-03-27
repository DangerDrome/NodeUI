# API Reference

NodeUI is built on an event-driven, modular, class-based architecture. Every core system -- the canvas, nodes, edges, and collaboration layer -- communicates through a central event bus, keeping modules decoupled and extensible.

## Architecture Overview

```
                    +----------------+
                    |  EventEmitter  |  (Global Pub/Sub Bus)
                    +-------+--------+
                            |
         +------------------+-------------------+
         |                  |                   |
   +-----+------+    +-----+------+    +-------+------+
   |   Canvas    |    |   Edges    |    | Collaboration|
   | (SVG render)|    | (drawing,  |    | (WebSocket   |
   |             |    |  routing)  |    |  sync)       |
   +-----+------+    +-----+------+    +--------------+
         |                  |
   +-----+------+    +-----+------+
   |   Nodes    |    |  BaseEdge  |
   | (BaseNode, |    | (path data,|
   |  subtypes) |    |  labels)   |
   +------------+    +------------+
```

### Core Modules

| Module | File | Responsibility |
|--------|------|----------------|
| **EventEmitter** | `src/core/events.js` | Global pub/sub bus for all inter-module communication |
| **Canvas** | `src/core/canvas.js` | SVG rendering, pan/zoom transforms, snap guides, selection |
| **Edges** | `src/core/edges.js` | Edge drawing state, routing cuts, edge routing points |
| **Collaboration** | `src/core/collaboration.js` | WebSocket sessions, state sync, presence |
| **BaseNode** | `src/nodes/basenode.js` | Base class for all node types |
| **BaseEdge** | `src/nodes/baseedge.js` | Base class for all edge types |

### Design Principles

**Event-driven communication.** Modules never call each other directly. A node move publishes `node:moved`, and any module that cares subscribes to it. This means you can add new behaviors (logging, collaboration sync, undo history) without modifying existing code.

**Class-based extensibility.** Nodes and edges use classical inheritance. `BaseNode` provides rendering, handles, and content editing. Specialized types like `GroupNode`, `SubGraphNode`, and `ThreeJSNode` extend it with custom behavior.

**Zero dependencies at the core.** The core architecture uses vanilla JavaScript with no framework or build tool. External libraries (Three.js, Marked.js) load on demand via CDN only when a node type requires them.

### Rendering Layers

The canvas uses a layered rendering approach with four stacked layers:

| Layer | Technology | Contains |
|-------|-----------|----------|
| Grid | SVG with `<pattern>` | Dot grid background |
| Groups | HTML `<div>` | GroupNode containers |
| Edges | SVG `<g>` | Edge paths, arrowheads, labels |
| Nodes | HTML `<div>` | All node elements, selection box |

All layers share the same `translate` and `scale` transform, keeping nodes and edges visually synchronized during pan and zoom.

### State Storage

NodeUI stores graph state as a flat structure of nodes and edges:

```javascript
// Nodes stored in a Map<string, BaseNode>
nodeUI.nodes.get('node-id')  // => BaseNode instance

// Edges stored in a Map<string, BaseEdge>
nodeUI.edges.get('edge-id')  // => BaseEdge instance
```

The graph serializes to JSON for file save/load and collaboration sync:

```json
{
  "nodes": [
    { "id": "abc-123", "type": "BaseNode", "x": 100, "y": 200, "width": 200, "height": 120, "title": "My Node", "content": "Hello", "color": "yellow" }
  ],
  "edges": [
    { "id": "edge-456", "startNodeId": "abc-123", "endNodeId": "def-789", "startHandleId": "right", "endHandleId": "left" }
  ]
}
```

## What is in This Section

- [Event System](./events.md) -- The pub/sub bus that connects all modules
- [Canvas System](./canvas.md) -- SVG rendering, pan/zoom, snap guides
- [Edge System](./edges.md) -- Edge drawing, bezier curves, routing
- [Custom Nodes](./custom-nodes.md) -- How to create your own node types by extending BaseNode
