# Basic Operations

A reference for every core interaction in NodeUI.

## Quick Reference

| Action | Method |
|--------|--------|
| Create node | Right-click canvas, select **Add Node** |
| Connect nodes | Drag from one node handle to another |
| Move node | Click and drag the node |
| Multi-select | Shift+click or drag a selection box |
| Delete | Select element(s), press `Delete` |
| Pan canvas | Click and drag on empty canvas space |
| Zoom | Mouse wheel or trackpad pinch gesture |

## Creating Nodes

Right-click on any empty area of the canvas to open the context menu. Select **Add Node** and choose a node type from the submenu.

Available node types:

- **BaseNode** -- General-purpose node with markdown content
- **GroupNode** -- Container that holds and organizes other nodes
- **RoutingNode** -- Lightweight node for managing edge paths
- **LogNode** -- Displays real-time event logs for debugging
- **SettingsNode** -- Controls application configuration
- **SubGraphNode** -- Embeds a nested graph with its own independent state
- **ThreeJSNode** -- Renders a full 3D viewport with Three.js
- **ImageSequenceNode** -- Plays back image sequences frame by frame

::: warning
Right-click on the **canvas**, not on an existing node. Clicking on a node opens that node's context menu instead.
:::

## Connecting Nodes

Each node has **handles** (connection points) on its edges. To create a connection:

1. Hover over a handle on the source node
2. Click and drag toward the target node
3. Release on a handle of the target node

A bezier curve edge appears between the two nodes. Edges provide visual feedback during the drag to show valid connection targets.

## Moving Nodes

Click on a node and drag it to reposition. The node moves with your cursor, and all connected edges update in real time.

When you move a node inside a **GroupNode**, the group acts as a container. Moving the group moves all of its children together.

## Selection

### Single Selection

Click on a node or edge to select it. The selected element receives a visual highlight.

### Multi-Selection

You have two options:

- **Shift+click** individual nodes to add them to your current selection
- **Drag a selection box** across the canvas to select all nodes within the rectangle

Multi-selected nodes can be moved, deleted, or grouped as a batch.

## Deleting Elements

Select one or more nodes or edges, then press the `Delete` key. Selected elements are removed from the graph.

::: tip
If you accidentally delete something, check your browser's local storage -- NodeUI auto-saves frequently, and a recent state may still be available.
:::

## Canvas Navigation

### Panning

Click and drag on any empty area of the canvas (where there are no nodes) to pan the viewport. This lets you navigate large graphs without losing your place.

### Zooming

Use the **mouse wheel** or a **trackpad pinch gesture** to zoom in and out. Zooming centers on your cursor position.

## Context Menus

Right-click on different elements to access context-specific actions:

- **Canvas** -- Add nodes, paste, and other canvas-level operations
- **Nodes** -- Node-specific actions like delete, duplicate, or configure
- **Edges** -- Edge-specific actions like delete or reroute

## Drag and Drop

You can drag files from your file system onto the NodeUI canvas to import them. Supported file types are processed and loaded into the graph automatically.

## SubGraph Navigation

**SubGraphNodes** contain nested graphs. Double-click a SubGraphNode to navigate into it. A **breadcrumb trail** appears at the top of the canvas so you can navigate back to parent graphs.

Each SubGraph maintains its own independent state, including its own set of nodes, edges, and layout.

## What's Next

- [Keyboard Shortcuts](./keyboard-shortcuts) -- Full hotkey reference
- [File Format](./file-format) -- How graphs are stored and structured
