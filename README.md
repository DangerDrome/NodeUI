# NodeUI

A serverless, node-based visual programming interface for creating interactive graphs and 3D visualizations. Built with vanilla JavaScript - no build tools, dependencies, or installation required.

## Overview

NodeUI is a powerful web application that runs entirely in the browser, allowing users to create complex node graphs, 3D scenes, and interactive visualizations. Simply open `index.html` in any modern browser to get started.

### Key Highlights

- **Zero Installation**: Works directly from the file system - just open and use
- **No Dependencies**: Pure vanilla JavaScript with CDN-loaded libraries
- **Real-time Collaboration**: Optional WebSocket support for multi-user editing
- **Professional Features**: Timeline animation, 3D viewport, nested graphs
- **High Performance**: GPU acceleration and intelligent rendering optimizations

## Features

### Node System

NodeUI provides a comprehensive set of node types for different use cases:

- **BaseNode**: Standard nodes with markdown content support
- **GroupNode**: Container nodes for organizing and managing node collections
- **RoutingNode**: Minimalist nodes for edge path management
- **LogNode**: Real-time event logging and debugging interface
- **SettingsNode**: Application configuration and preferences
- **SubGraphNode**: Nested graph containers with independent state
- **ThreeJSNode**: Full 3D viewport with integrated Three.js scene
- **ImageSequenceNode**: Frame-by-frame image animation support

### Graph Capabilities

- **Interactive Edges**: Bezier curve connections with visual feedback
- **Smart Routing**: Automatic and manual edge path optimization
- **Selection System**: Multi-select with keyboard modifiers
- **Drag & Drop**: File import and node manipulation
- **Context Menus**: Right-click operations for all elements
- **Undo/Redo**: Full operation history (when implemented)

### Advanced Features

- **SubGraph Navigation**: Hierarchical graph organization with breadcrumb navigation
- **Timeline System**: Professional keyframe animation at 24fps
- **3D Integration**: Full Three.js support with camera controls
- **Real-time Collaboration**: WebSocket-based multi-user sessions
- **Auto-save**: Continuous local storage persistence
- **Export Options**: JSON graphs and PNG screenshots

## Getting Started

### Quick Start

1. Clone or download the repository
2. Open `index.html` in any modern browser
3. Start creating nodes and connections

No installation, build process, or server required.

### Basic Operations

| Action | Method |
|--------|--------|
| Create Node | Right-click canvas → Add Node |
| Connect Nodes | Drag from node handle to another |
| Move Node | Click and drag |
| Multi-select | Shift+click or drag selection box |
| Delete | Select and press Delete key |
| Pan Canvas | Click and drag on empty space |
| Zoom | Mouse wheel or trackpad gesture |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Delete` | Remove selected elements |
| `R` + Drag | Create routing node |
| `Shift` + Click | Add to selection |
| `I` | Insert timeline keyframe |
| `Ctrl/Cmd + S` | Save graph |
| `Ctrl/Cmd + O` | Open graph file |

## Architecture

### Project Structure

```
NodeUI/
├── index.html           # Application entry point
├── config.js            # Configuration (WebSocket URL)
├── src/
│   ├── main.js          # Module loader and initialization
│   ├── core/            # Core system modules
│   │   ├── main.js      # Application orchestrator
│   │   ├── canvas.js    # SVG rendering system
│   │   ├── interactions.js  # User input handling
│   │   ├── file.js      # File operations and persistence
│   │   ├── nodes.js     # Node lifecycle management
│   │   ├── edges.js     # Edge drawing and routing
│   │   ├── events.js    # Event bus system
│   │   ├── contextMenu.js   # Context menu implementation
│   │   ├── collaboration.js # WebSocket collaboration
│   │   ├── markdown.js  # Markdown processing
│   │   └── libs.js      # External library management
│   ├── nodes/           # Node type implementations
│   └── styles/          # Modular CSS architecture
```

### Core Architecture

NodeUI follows a modular, event-driven architecture:

1. **Event System**: Central pub/sub bus for all inter-module communication
2. **Module Pattern**: Self-contained modules with clear interfaces
3. **State Management**: Centralized state in Main class with reactive updates
4. **Rendering Pipeline**: Layered SVG/HTML rendering with optimizations
5. **Asset Management**: IndexedDB for file storage with lazy loading

## Development

### Creating Custom Nodes

Extend the `BaseNode` class to create custom node types:

```javascript
class CustomNode extends BaseNode {
    constructor(options) {
        super(options);
        this.type = 'custom';
        // Initialize custom properties
    }
    
    render() {
        super.render();
        // Add custom rendering logic
    }
    
    // Override methods as needed
}
```

### Module System

Each module follows a consistent pattern:

```javascript
export class ModuleName {
    constructor(main) {
        this.main = main;
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        this.main.events.on('event:name', this.handleEvent.bind(this));
    }
}
```

### Styling

CSS is organized into focused modules:

- `variables.css` - Design tokens and theme variables
- `layout.css` - Application structure and layout
- `nodes.css` - Node styling and states
- `timeline.css` - Timeline interface styles
- `icons.css` - Icon definitions and sprites

## Collaboration

### WebSocket Setup (Optional)

For real-time collaboration features:

1. Deploy the Durable Object worker to Cloudflare
2. Update `config.js` with your WebSocket URL
3. Share session IDs with collaborators

### Features

- Real-time cursor positions
- Synchronized node operations
- Automatic image compression (1200x1200 max)
- Presence indicators
- Session management

## Performance

### Optimizations

- **Lazy Loading**: Libraries load on-demand
- **Render Batching**: Edge updates during drag operations
- **Event Throttling**: Optimized update frequencies
- **GPU Acceleration**: Hardware-accelerated 3D rendering
- **Memory Management**: Automatic cleanup and GC optimization

### Browser Requirements

- Modern browser with ES6+ support
- WebGL for 3D features
- IndexedDB for file storage
- WebSocket support for collaboration (optional)

## File Format

NodeUI uses a JSON-based file format for graphs:

```json
{
  "nodes": [
    {
      "id": "unique-id",
      "type": "base",
      "x": 100,
      "y": 200,
      "width": 200,
      "height": 150,
      "content": "Node content"
    }
  ],
  "edges": [
    {
      "id": "edge-id",
      "sourceId": "node1-id",
      "targetId": "node2-id"
    }
  ]
}
```

## Deployment

### Static Hosting

NodeUI can be deployed to any static file host:

- GitHub Pages
- Netlify
- Vercel
- Amazon S3
- Any web server

Simply upload all files and ensure `index.html` is accessible.

### Collaboration Server

For WebSocket features, deploy the Durable Object:

```bash
cd durable-objects-worker
wrangler deploy
```

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Blank screen | Check browser console for errors |
| Can't create nodes | Ensure right-clicking on canvas, not nodes |
| Lost work | Check browser local storage |
| WebSocket errors | Verify config.js URL and CORS settings |

### Browser Compatibility

Tested and supported on:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Contributing

Contributions are welcome. Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Credits

Built with vanilla JavaScript and leveraging:
- Three.js for 3D graphics
- Marked.js for markdown processing
- Cloudflare Durable Objects for collaboration

---

**NodeUI v1.1.12** - Modern visual programming for the web