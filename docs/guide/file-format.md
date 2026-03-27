# File Format

NodeUI saves and loads graphs as JSON files. This page documents the structure of that format.

## Overview

A NodeUI graph file contains two top-level arrays: `nodes` and `edges`. Every node and edge has a unique `id` used to reference it within the graph.

```json
{
  "nodes": [ ... ],
  "edges": [ ... ]
}
```

## Full Example

```json
{
  "nodes": [
    {
      "id": "node-001",
      "type": "base",
      "x": 100,
      "y": 200,
      "width": 200,
      "height": 150,
      "content": "# Hello\n\nThis is a markdown node."
    },
    {
      "id": "node-002",
      "type": "base",
      "x": 400,
      "y": 200,
      "width": 200,
      "height": 150,
      "content": "Second node"
    }
  ],
  "edges": [
    {
      "id": "edge-001",
      "sourceId": "node-001",
      "targetId": "node-002"
    }
  ]
}
```

This file defines two BaseNodes connected by a single edge.

## Node Object

Each entry in the `nodes` array describes a single node on the canvas.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier for the node |
| `type` | `string` | Node type (`base`, `group`, `routing`, `log`, `settings`, `subgraph`, `threejs`, `imagesequence`) |
| `x` | `number` | Horizontal position on the canvas (pixels) |
| `y` | `number` | Vertical position on the canvas (pixels) |
| `width` | `number` | Width of the node (pixels) |
| `height` | `number` | Height of the node (pixels) |
| `content` | `string` | Node content (interpretation depends on node type) |

::: tip
The `content` field supports markdown in BaseNodes. Other node types may use this field differently or ignore it entirely.
:::

### Node Types

| Type Value | Corresponding Node |
|------------|--------------------|
| `base` | BaseNode |
| `group` | GroupNode |
| `routing` | RoutingNode |
| `log` | LogNode |
| `settings` | SettingsNode |
| `subgraph` | SubGraphNode |
| `threejs` | ThreeJSNode |
| `imagesequence` | ImageSequenceNode |

## Edge Object

Each entry in the `edges` array describes a connection between two nodes.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier for the edge |
| `sourceId` | `string` | `id` of the source node |
| `targetId` | `string` | `id` of the target node |

::: warning
Both `sourceId` and `targetId` must reference valid node IDs that exist in the `nodes` array. Edges referencing missing nodes will fail to render.
:::

## Saving and Loading

### Manual Save

Press `Ctrl+S` (or `Cmd+S` on macOS) to download the current graph as a `.json` file.

### Manual Load

Press `Ctrl+O` (or `Cmd+O` on macOS) to open a file picker and load a previously saved graph.

### Auto-save

NodeUI continuously persists the current graph state to your browser's local storage. This happens automatically and does not require any action. If you close the browser and reopen NodeUI, your last session is restored.

### File Storage

Files and assets referenced by nodes (such as images in ImageSequenceNode) are stored in the browser's IndexedDB. These assets are loaded lazily as needed.

## Export Options

In addition to the JSON graph format, NodeUI supports exporting the current canvas view as a **PNG screenshot** through the context menu or export controls.

## Related

- [Quick Start](./quick-start) -- Get running and save your first graph
- [Basic Operations](./basic-operations) -- Canvas interactions reference
