# NodeUI

https://nodeui.pages.dev/

NodeUI is a web-based interactive node graph editor. It allows users to create, connect, group, and manage nodes visually, supporting features like zooming, panning, context menus, and drag-and-drop file loading.

![Screenshot](https://github.com/user-attachments/assets/663299e5-4d90-4a25-867b-edbc925f3188)

## Features

- **Add Nodes & Groups:** Create nodes or group containers via toolbar or context menu.
- **Connect Nodes:** Draw edges between node sockets with straight, step, or bezier styles.
- **Routing Points:** Add and drag routing points on edges for custom paths.
- **Selection & Multi-Select:** Click or shift-drag to select nodes/edges. Use selection box for multi-select.
- **Node Grouping:** Drag nodes into/out of groups for organization.
- **Zoom & Pan:** Mouse wheel or toolbar buttons to zoom; middle mouse or drag background to pan.
- **Context Menu:** Right-click nodes/edges/background for quick actions (rename, delete, properties, etc).
- **Properties Panel:** Edit node name and color.
- **Theme Toggle:** Switch between light and dark themes.
- **Cut Mode:** Press `c` to enable edge cutting, then drag to delete edges.
- **File Drag & Drop:** Load a saved graph by dropping a JSON file onto the canvas.

## Usage

1. **Open `index.html` in your browser.**
2. Use the toolbar at the bottom to add nodes, groups, zoom, or change edge type.
3. Right-click on nodes, edges, or the background for context actions.
4. Drag nodes to move them, or drag their corners to resize.
5. Connect nodes by dragging from a socket to another socket.
6. Save your graph by exporting `nodes` and `edges` as JSON (see below).

## Keyboard Shortcuts

- <kbd>Delete</kbd> or <kbd>Backspace</kbd>: Delete selected nodes/edges
- <kbd>Shift</kbd> + Click: Multi-select nodes/edges
- <kbd>c</kbd>: Enter/exit cut mode for edges
- <kbd>d</kbd>: Toggle disable state for selected nodes

## Data Format

Graphs are saved/loaded as JSON with the following structure:
```json
{
  "nodes": [ ... ],
  "edges": [ ... ]
}