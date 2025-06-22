# NodeUI

NodeUI is a web-based node graph interface implementation that allows users to create, connect, and manipulate various types of nodes in a visual graph environment. The project focuses on providing a flexible and interactive user interface for node-based workflows. It is built with pure vanilla JavaScript, HTML5, and CSS3, with no external dependencies.

## Core Features

-   **Interactive Node Graph**: A visual interface to create, connect, and manage nodes.
-   **Multiple Node Types**: Supports various node types like Base, Group, Log, Routing, and Settings.
-   **Edge Connections**: Easily manage connections between nodes.
-   **Context Menu**: A right-click menu for quick node operations.
-   **Properties Panel**: Configure node-specific settings and properties.
-   **Data Persistence**: Save and load graph states to/from local storage.
-   **Event System**: A robust event handling system for user interactions.
-   **Logging**: Logs operations for debugging and tracking.

## Technology Stack

-   **HTML5**
-   **CSS3**
-   **Vanilla JavaScript (ES6+)**

## Getting Started

To get started with NodeUI, simply open the `index.html` file in a modern web browser.

## Project Structure

```
NodeUI/
  ├── index.html          # Main entry point
  ├── src/
  │   ├── styles/
  │   │   └── styles.css # Global styles
  │   ├── core/          # Core system modules
  │   │   ├── main.js              # Main application orchestrator
  │   │   ├── events.js            # Event system
  │   │   ├── canvas.js            # Canvas rendering and physics
  │   │   ├── file.js              # File operations and data handling
  │   │   ├── contextMenu.js       # Context menus and UI interactions
  │   │   ├── nodes.js             # Node lifecycle management
  │   │   ├── interactions.js      # All user interactions, drag, and selection
  │   │   └── edges.js             # Edge drawing and routing
  │   └── nodes/
  │       ├── basenode.js
  │       ├── groupnode.js
  │       ├── lognode.js
  │       ├── routingnode.js
  │       └── settingsnode.js
  └── graph.json         # Graph state storage
```

**Note:** All drag and selection logic is now handled by `interactions.js`. The codebase is fully modular, with each core file focused on a single responsibility.

## How to Use

1.  **Open the application**: Launch `index.html` in your browser.
2.  **Create a node**: Right-click on the canvas to open the context menu and select a node to create.
3.  **Connect nodes**: Click on the output of one node and drag to the input of another to create a connection.
4.  **Configure nodes**: Select a node to view and edit its properties in the properties panel.
5.  **Save/Load**: Use the appropriate UI controls to save the current graph state or load a previously saved one. 