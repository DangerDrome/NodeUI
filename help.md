# NodeUI Help & Features

Welcome to NodeUI! This guide covers all the features and controls you'll need to get started.

## 1. Basic Navigation

You can navigate the canvas using your mouse or touch gestures.

| Action         | Mouse Control            | Touch Control              | Description                               |
| -------------- | ------------------------ | -------------------------- | ----------------------------------------- |
| **Pan**        | Middle-click + Drag      | One-finger drag            | Moves your view across the canvas.        |
| **Zoom**       | Scroll wheel             | Two-finger pinch           | Zooms in and out of the canvas.           |
| **Frame View** | Press `F` key            | -                          | Zooms to fit the current selection.       |
| **Select All** | `Ctrl/Cmd + A`           | -                          | Selects all nodes and edges on the canvas.|

## 2. Working with Nodes

Nodes are the core elements of your graph.

### Creating Nodes
- **Context Menu**: Right-click (or long-press on touch) on an empty area of the canvas to open a menu with options to create different node types (Note, Group, Router, etc.).
- **Keyboard Shortcut**: Press `N` to create a new **Note** at your cursor's position. Press `M` to create a new **Router** node.
- **From an Edge**: Drag an edge from a handle into an empty space. A context menu will appear, allowing you to create and connect a new node instantly.

### Selecting Nodes
- **Single Select**: Click on a node.
- **Multi-Select**: Hold `Shift` and click on multiple nodes.
- **Box Select**: Click and drag on the canvas to draw a selection box around the nodes you want to select.

### Moving & Resizing
- **Move**: Click and drag a node to move it. If you move a selected group of nodes, they will all move together.
- **Resize**: Hover over a node to see the resize handles. Drag a handle to resize the node.

### Deleting Nodes
- **Keyboard**: Select one or more nodes and press `Delete` or `Backspace`.
- **Popover**: Click the `...` icon on a node, then click the "Delete Node" button.

## 3. Node Features

Nodes have several advanced features for organization and interaction.

- **Grouping**: Select multiple nodes and press the `G` key to wrap them in a **Group Node**. You can also drag nodes into and out of existing groups.
- **Pinning**: Click the **pin icon** in a node's title bar. Pinned nodes will stay fixed on your screen, unaffected by canvas panning and zooming. This is great for keeping important nodes, like Settings, always accessible.
- **Color Cycling**: Click the **sun icon** in a node's title bar to cycle through a predefined set of colors.
- **Shake to Disconnect**: If a node has many connections you want to remove quickly, just "shake" it while dragging. All of its connected edges will be deleted.
- **Editing Content**: Double-click the content area of a **Note** to edit its markdown text. Click outside the node to save and see the rendered markdown.

## 4. Working with Edges

Edges connect your nodes.

### Creating Edges
- Drag from any handle (the circles that appear when you hover over a node's border) to another node's handle.

### Deleting Edges
- **Edge Cutting Mode**: Hold the `C` key and drag your mouse across any edges you want to delete.
- **Selection**: Select one or more edges and press the `Delete` or `Backspace` key.
- **Context Menu**: Right-click an edge and select "Delete".

### Edge Routing
- **Add Routing Point**: Double-click anywhere on an edge to add a new routing point that you can drag to change the edge's path.
- **Insert Routing Node**:
    - Right-click on an edge and select "Add Routing Node".
    - Hold the `R` key and drag your mouse across an edge to insert a **Router Node** at the intersection point.

## 5. Advanced Features

### Clipboard
The standard clipboard shortcuts work for nodes and edges.
- `Ctrl/Cmd + C`: Copy selection.
- `Ctrl/Cmd + X`: Cut selection.
- `Ctrl/Cmd + V`: Paste selection at your cursor's position.

### Loading & Saving
- **Drag & Drop**: Drag a `graph.json` file from your computer directly onto the canvas to load it.
- **Settings Node**: Use the "Save Graph" and "Load Graph" buttons inside the **Settings** node. You can also take and save a screenshot of your graph from here.

## 6. Node Types

- **Note**: The default node for writing markdown.
- **Group**: A container to organize other nodes.
- **Router**: A small, circular node used to neatly route edges. Right-click it to cycle its color.
- **Log**: A special node that displays a real-time log of all application events for debugging.
- **Settings**: A special node that allows you to configure UI settings, theme colors, and project metadata. 