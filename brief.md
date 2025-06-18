# NodeUI Application Brief

You are a senior JavaScript developer that comments all his code and works in a simple, efficient manner. Using vanilla JavaScript, you're to build NodeUI, a modular, event-driven node-based UI application inspired by JSONCanvas and Obsidian.

The application's core principle is that **all nodes are fundamentally markdown renderers**. The node's `type` will determine how its markdown content is visually presented. For example, a node containing `![alt text](image.png)` can be rendered as a full markdown document or as a dedicated image viewer, depending on its type. This architecture ensures the app is highly extensible.

## Architecture Overview

The application will use a **Publish/Subscribe (Pub/Sub) event bus** to facilitate communication between modules. This creates a decoupled architecture where modules do not directly reference each other. Instead, they publish events (e.g., `node:created`, `color:changed`) and other modules subscribe to the events they need to act on.

This event-driven model makes the system more scalable, maintainable, and easier to debug. A central `events.js` module will manage this flow. All major components (`nodeui`, `properties`, `filetree`, `database`) will interact through this bus rather than calling each other directly.

The `nodeui.js` module is responsible for managing the state of the main canvas and its entities. It listens for events to create, modify, or delete nodes and edges. It, in turn, publishes events about user interactions on the canvas, such as `node:moved` or `selection:changed`.

## Project Structure

```
/
├── index.html               # Main page
├── styles.css               # All styles (dark mode + green accent)
js/                          # Core stuff goes here
├── events.js                # Central event bus (Pub/Sub)
├── ui.js                    # UI utility functions (e.g., creating buttons, panels)
├── nodeui.js                # Core UI and canvas logic
├── properties.js            # Properties UI for nodes and edges
├── filetree.js              # File-tree UI logic
├── settings.js              # Settings UI logic
├── database.js              # IndexedDB persistence logic
└── logs.js                  # Debug logging service

js/graph/                    # Graph entity base classes
├── basenode.js              # The base class for all node types
└── baseedge.js              # The base class for all edge types

js/nodes/                    # Custom node type implementations (renderers)
├── markdowneditor.js        # Renders markdown with a full editor
├── videoplayer.js           # Renders a video player from a markdown link
└── imageviewer.js           # Renders an image viewer from a markdown link
```

## Node and Edge Architecture

All node types will extend a `BaseNode` class, and all edge types will extend a `BaseEdge` class. These base classes handle all common functionalities (ID, position, selection, etc.). Specialized classes are only responsible for their unique rendering and logic.

## Look & Feel

- **UI Framework**: Lucide icons
- **Theme**: Sleek, modern, **responsive/mobile-friendly**, dark mode with green accents
- **Theme Reference**: Inspired by the Supabase dashboard dark theme. [https://supabase.com/](https://supabase.com/)
- **Theme Modes**: dark, light, blue, colorized

## Core Features

### Mobile & Touch Support
- The entire UI must be responsive and usable on screens of all sizes.
- All interactions (dragging, connecting, context menus) must support touch events.
- UI panels (File Tree, Properties) must be collapsible or docked to optimize space on small screens.

### Node Graph

- Create, edit, and delete nodes
- Draw and remove edges
- Drag-to-reposition nodes
- Group/ungroup nodes and groups
- Cut, copy, paste and delete nodes
- Drag selecting multiple nodes
- Cut edges using 'c' key and dragging
- Node properties panel on click for changing node colors and names
- Change node color from a predefined palette
- Import/export graphs
- Right click context menus for creating nodes and snapping settings (must support long-press on touch devices)
- Snap to object
- Snap to grid
- Dotted grid pattern using a plus: `+`

### File Tree

- Expand/collapse file tree panel on left
- Expand/collapse folders
- Drag-and-drop files/folders to reorder
- Create & delete files and folders
- Support dragging files from the tree onto the graph
- Support for renaming files and folders
- **Supported file types**: image files, video files, markdown files
- Hover preview of image and video files
- Right click context menu for renaming and deleting etc. (must support long-press on touch devices)
- Allow multi file drag and drop
- Recognize file sequences as 1 file

### Local Drag-and-Drop

- DnD files from the OS file explorer directly onto the graph
- DnD files from the OS file explorer directly onto the filetree
- DnD files from the filetree onto the graph

## Persistence

- Use IndexedDB to save/restore both graph data and the file tree

## Settings & Help

- Settings menu for theme toggles: dark, light, blue, colorized 
- Settings for edge types
- Graph preferences
- Accent color and any other theme settings
- Help menu with usage instructions
- Markdown style settings, headers, callouts, etc

## Plugins

- Plugins menu for enabling and disabling custom node types 
