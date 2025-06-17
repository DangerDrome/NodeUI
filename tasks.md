# NodeUI Build Task List

This document outlines the tasks required to build the NodeUI application, following an event-driven architecture.

## 1. Core Architecture & Setup
- [x] Create `index.html` with the basic page structure and a responsive viewport meta tag.
- [x] Create `styles.css` and implement the base theme using responsive units (rem, em, %) and CSS variables.
- [x] Integrate Lucide icons library.
- [x] Create `js/events.js` to implement the core Pub/Sub event bus.
- [x] Create `js/logs.js` and subscribe to all events (`*`) for debugging.
- [x] Create `js/ui.js` for shared UI utility functions (e.g., `createButton`).
- [x] Implement a mobile-first layout with media queries for larger screens.
- [x] **Create Checkpoint 1:** Core architecture and setup complete.

## 2. Graph Entity Base Classes
- [x] Create `js/graph/` directory.
- [x] Create `js/graph/basenode.js` for the `BaseNode` class.
- [x] Create `js/graph/baseedge.js` for the `BaseEdge` class.
- [x] **Create Checkpoint 2:** Graph entity base classes complete.

## 3. NodeUI Canvas Implementation
- [x] Create `js/nodeui.js` to manage the main canvas.
- [x] Subscribe to events for node/edge creation, updates, and deletion.
- [x] Implement the dotted grid background.
- [x] Implement canvas panning and zooming (for both mouse and touch).
- [x] Implement node dragging logic, publishing `node:moved` events (for both mouse and touch).
- [x] Implement edge drawing logic, publishing `edge:created` events (for both mouse and touch).
- [x] Implement multi-selection logic, publishing `selection:changed` events (for both mouse and touch).
- [x] Implement cut/copy/paste, publishing clipboard and entity creation events.
- [x] Implement "cut edge" functionality (publishes `edge:deleted`).
- [x] Implement snap-to-grid and snap-to-object functionality.
- [x] Create a right-click context menu that publishes action events (e.g., `context:createNode`) and supports long-press on touch.
- [x] **Create Checkpoint 3:** NodeUI canvas implementation complete.

## 4. Properties Panel
- [x] Create `js/properties.js` to manage the properties panel UI.
- [x] Subscribe to `selection:changed` and display properties for the selected item.
- [x] Implement controls for changing node color, publishing `node:update` events.
- [x] Implement controls for editing node titles, publishing `node:update` events.
- [ ] **Create Checkpoint 4:** Properties panel complete.

## 5. File Tree Implementation
- [ ] Create `js/filetree.js` to manage the file tree UI.
- [ ] Ensure the panel is collapsible or docks appropriately on mobile screens.
- [ ] Implement expand/collapse functionality.
- [ ] For file operations (create, delete, rename), publish events (e.g., `file:created`, `file:deleted`).
- [ ] Add a right-click context menu that publishes file operation events and supports long-press on touch.
- [ ] Implement hover previews for media files (consider touch-friendly alternatives).
- [ ] **Create Checkpoint 5:** File tree implementation complete.

## 6. Drag and Drop Integration
- [ ] Implement drag-from-OS to file tree (publishes `file:dropped`).
- [ ] Implement drag-from-OS to canvas (publishes `node:createWithFile`).
- [ ] Implement drag-from-file-tree to canvas (publishes `node:createWithFile`).
- [ ] **Create Checkpoint 6:** Drag and drop integration complete.

## 7. Persistence
- [ ] Create `js/database.js` for IndexedDB logic.
- [ ] On startup, load data and publish events to populate the graph and file tree.
- [ ] Subscribe to all relevant events (`node:*`, `edge:*`, `file:*`, `group:*`) to save changes to IndexedDB.
- [ ] **Create Checkpoint 7:** Persistence complete.

## 8. Custom Node Types (Renderers)
- [ ] Create `js/nodes/markdowneditor.js` extending `BaseNode`.
- [ ] Create `js/nodes/videoplayer.js` extending `BaseNode`.
- [ ] Create `js/nodes/imageviewer.js` extending `BaseNode`.
- [ ] Update the `nodeui.js` module to use the appropriate renderer based on node type.
- [ ] **Create Checkpoint 8:** Custom node types complete.

## 9. Settings & Help
- [ ] Create `js/settings.js` for the settings UI.
- [ ] When a setting is changed, publish a `setting:changed` event.
- [ ] Relevant modules will subscribe to `setting:changed` events to apply them.
- [ ] Create a help menu with usage instructions.
- [ ] **Create Checkpoint 9:** Settings & help complete.

## 10. Plugins
- [ ] Implement a plugins menu to manage custom node types.
- [ ] Publish `plugin:toggled` events to enable/disable node renderers.
- [ ] **Create Checkpoint 10:** Plugin system complete. 