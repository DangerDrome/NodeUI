# NodeUI Build Task List

This document outlines the tasks required to build the NodeUI application, following an event-driven architecture.

## 1. Core Architecture & Setup
- [x] 1.1 Create `index.html` with the basic page structure and a responsive viewport meta tag.
- [x] 1.2 Create `styles.css` and implement the base theme using responsive units (rem, em, %) and CSS variables.
- [x] 1.3 Integrate Lucide icons library.
- [x] 1.4 Create `js/events.js` to implement the core Pub/Sub event bus.
- [x] 1.5 Create `js/logs.js` and subscribe to all events (`*`) for debugging.
- [x] 1.6 Create `js/ui.js` for shared UI utility functions (e.g., `createButton`).
- [x] 1.7 Implement a mobile-first layout with media queries for larger screens.
- [x] **Checkpoint 1:** Core architecture and setup complete.

## 2. Graph Entity Base Classes
- [x] 2.1 Create `js/graph/` directory.
- [x] 2.2 Create `js/graph/basenode.js` for the `BaseNode` class.
- [x] 2.3 Create `js/graph/baseedge.js` for the `BaseEdge` class.
- [x] **Checkpoint 2:** Graph entity base classes complete.

## 3. NodeUI Canvas Implementation
- [x] 3.1 Create `js/nodeui.js` to manage the main canvas.
- [x] 3.2 Subscribe to events for node/edge creation, updates, and deletion.
- [x] 3.3 Implement the dotted grid background.
- [x] 3.4 Implement canvas panning and zooming (for both mouse and touch).
- [x] 3.5 Implement node dragging logic, publishing `node:moved` events (for both mouse and touch).
- [x] 3.6 Implement edge drawing logic, publishing `edge:created` events (for both mouse and touch).
- [x] 3.7 Implement multi-selection logic, publishing `selection:changed` events (for both mouse and touch).
- [x] 3.8 Implement cut/copy/paste, publishing clipboard and entity creation events.
- [x] 3.9 Implement "cut edge" functionality (publishes `edge:deleted`).
- [x] 3.10 Implement snap-to-grid and snap-to-object functionality.
- [x] 3.11 Create a right-click context menu that publishes action events (e.g., `context:createNode`) and supports long-press on touch.
- [] **Checkpoint 3:** NodeUI canvas implementation complete.

## 4. Properties Panel
- [ ] 4.1 Create `js/properties.js` to manage the properties panel UI.
- [ ] 4.2 Subscribe to `selection:changed` and display properties for the selected item.
- [ ] 4.3 Implement controls for changing node color, publishing `node:update` events.
- [ ] 4.4 Implement controls for editing node titles, publishing `node:update` events.
- [ ] **Checkpoint 4:** Properties panel complete.

## 5. File Tree Implementation
- [ ] 5.1 Create `js/filetree.js` to manage the file tree UI.
- [ ] 5.2 Ensure the panel is collapsible or docks appropriately on mobile screens.
- [ ] 5.3 Implement expand/collapse functionality.
- [ ] 5.4 For file operations (create, delete, rename), publish events (e.g., `file:created`, `file:deleted`).
- [ ] 5.5 Add a right-click context menu that publishes file operation events and supports long-press on touch.
- [ ] 5.6 Implement hover previews for media files (consider touch-friendly alternatives).
- [ ] **Checkpoint 5:** File tree implementation complete.

## 6. Drag and Drop Integration
- [ ] 6.1 Implement drag-from-OS to file tree (publishes `file:dropped`).
- [ ] 6.2 Implement drag-from-OS to canvas (publishes `node:createWithFile`).
- [ ] 6.3 Implement drag-from-file-tree to canvas (publishes `node:createWithFile`).
- [ ] **Checkpoint 6:** Drag and drop integration complete.

## 7. Persistence
- [ ] 7.1 Create `js/database.js` for IndexedDB logic.
- [ ] 7.2 On startup, load data and publish events to populate the graph and file tree.
- [ ] 7.3 Subscribe to all relevant events (`node:*`, `edge:*`, `file:*`, `group:*`) to save changes to IndexedDB.
- [ ] **Checkpoint 7:** Persistence complete.

## 8. Custom Node Types (Renderers)
- [ ] 8.1 Create `js/nodes/markdowneditor.js` extending `BaseNode`.
- [ ] 8.2 Create `js/nodes/videoplayer.js` extending `BaseNode`.
- [ ] 8.3 Create `js/nodes/imageviewer.js` extending `BaseNode`.
- [ ] 8.4 Update the `nodeui.js` module to use the appropriate renderer based on node type.
- [ ] **Checkpoint 8:** Custom node types complete.

## 9. Settings & Help
- [ ] 9.1 Create `js/settings.js` for the settings UI.
- [ ] 9.2 When a setting is changed, publish a `setting:changed` event.
- [ ] 9.3 Relevant modules will subscribe to `setting:changed` events to apply them.
- [ ] 9.4 Create a help menu with usage instructions.
- [ ] **Checkpoint 9:** Settings & help complete.

## 10. Plugins
- [ ] 10.1 Implement a plugins menu to manage custom node types.
- [ ] 10.2 Publish `plugin:toggled` events to enable/disable node renderers.
- [ ] **Checkpoint 10:** Plugin system complete. 