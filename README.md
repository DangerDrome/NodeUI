# NodeUI

A powerful, serverless node-based interface for creating interactive graphs and 3D visualizations. Built with vanilla JavaScript, HTML, and CSS - no build tools or servers required.

## 🚀 Features

### Core Node System
- **Multiple Node Types**: Base, Group, Log, Routing, Settings, SubGraph, ThreeJS
- **Interactive Edges**: Create connections between nodes with visual feedback
- **Context Menus**: Right-click operations for all node types
- **Drag & Drop**: Intuitive node manipulation and file import
- **Properties Panel**: Configure node attributes and settings

### Advanced Features
- **SubGraph System**: Create nested, self-contained graphs with navigation
- **3D Viewport**: Integrated Three.js scene with timeline and animation
- **Timeline System**: Advanced keyframe management and animation playback
- **Performance Optimized**: GPU-accelerated rendering with intelligent updates

### Serverless Operation
- **Zero Server Required**: Works completely offline from file system
- **CORS-Free**: No browser security issues when running locally
- **Embedded Data**: Demo graph included for immediate testing
- **Double-Click Launch**: Open index.html directly in any browser

## 🏗️ Architecture

### Modular Design
```
src/
├── main.js              # Application entry point
├── core/
│   ├── canvas.js        # Canvas rendering and SVG operations
│   ├── contextMenu.js   # Context menu system
│   ├── edges.js         # Edge drawing and routing
│   ├── events.js        # Event handling system
│   ├── file.js          # File operations and persistence
│   ├── interactions.js  # Mouse/touch/keyboard interactions
│   ├── libs.js          # External library loading
│   ├── main.js          # Core application logic
│   └── markdown.js      # Markdown processing
├── nodes/
│   ├── basenode.js      # Base node class
│   ├── baseedge.js      # Base edge class
│   ├── groupnode.js     # Group node implementation
│   ├── imagesequencenode.js
│   ├── lognode.js       # Logging node
│   ├── routingnode.js   # Routing node
│   ├── settingsnode.js  # Settings node
│   ├── subgraphnode.js  # SubGraph node
│   └── threejsnode.js   # 3D viewport node
└── styles/
    ├── styles.css       # Main stylesheet (imports all others)
    ├── variables.css    # CSS custom properties
    ├── icons.css        # Icon definitions
    ├── layout.css       # Layout and positioning
    ├── nodes.css        # Node-specific styles
    └── timeline.css     # Timeline UI styles
```

### Key Components
- **NodeUI**: Core orchestration and state management
- **CanvasRenderer**: Visual rendering and SVG operations
- **FileHandler**: File operations, save/load, drag & drop
- **ContextMenuHandler**: Context menu display and edge editing
- **NodeManager**: Node/edge lifecycle and grouping
- **InteractionHandler**: Mouse/touch/keyboard interactions
- **EdgeHandler**: Edge drawing and routing logic

## 🚀 Quick Start

### Option 1: Double-Click Launch (Recommended)
1. Download or clone the repository
2. Double-click `index.html` to open in your browser
3. Start creating nodes and connections immediately

### Option 2: Local Server (Optional)
If you prefer using a local server:
```bash
# Python 3
python3 -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js
npx http-server

# PHP
php -S localhost:8000
```

Then visit `http://localhost:8000`

## 🎯 Usage

### Basic Operations
- **Create Nodes**: Right-click canvas → Add Node
- **Connect Nodes**: Drag from node output to input
- **Move Nodes**: Click and drag nodes around
- **Select Multiple**: Shift+click or drag selection box
- **Delete**: Select nodes/edges and press Delete

### Advanced Features
- **SubGraphs**: Create nested graphs for complex workflows
- **3D Viewport**: Add ThreeJS nodes for 3D visualization
- **Timeline**: Use timeline nodes for animation and keyframes
- **Routing**: Press 'R' + drag to create routing nodes

### Keyboard Shortcuts
- `Delete`: Remove selected nodes/edges
- `R + Drag`: Create routing node
- `I`: Insert keyframe (in timeline)
- `Ctrl/Cmd + C/V`: Copy/paste nodes
- `Ctrl/Cmd + Z`: Undo (when implemented)

## 🛠️ Development

### Project Structure
The application follows a modular architecture with clear separation of concerns:

- **Core Modules**: Handle specific functionality (canvas, events, file operations)
- **Node Classes**: Individual node type implementations
- **Style Modules**: Organized CSS for different UI components
- **External Libraries**: Centralized dependency management

### Adding New Node Types
1. Create a new file in `src/nodes/`
2. Extend the `BaseNode` class
3. Implement required methods and properties
4. Register the node type in the main application

### Styling
CSS is organized into focused files:
- `layout.css`: Main layout and positioning
- `nodes.css`: Node-specific styles and animations
- `timeline.css`: Timeline UI components
- `variables.css`: CSS custom properties and theming

## 🔧 Technical Details

### Browser Compatibility
- Modern browsers with ES6+ support
- WebGL support for 3D viewport
- Local storage for data persistence

### Performance Features
- Conditional animation loops
- Intelligent render state tracking
- GPU acceleration for 3D rendering
- Optimized event handling

### Data Persistence
- Local storage for graph data
- JSON export/import functionality
- Screenshot capture capability

## 📁 File Structure

```
NodeUI2/
├── index.html              # Main application entry point
├── launch.html             # Launch page with instructions
├── graph.json              # Default graph data
├── test-graph.json         # Test graph data
├── README.md               # This file
├── memory-bank/            # Project documentation
│   ├── activeContext.md    # Current development context
│   ├── progress.md         # Progress tracking
│   ├── projectbrief.md     # Project overview
│   ├── systemPatterns.md   # System architecture patterns
│   └── techContext.md      # Technical context
└── src/                    # Source code
    ├── main.js             # Application entry point
    ├── core/               # Core application modules
    ├── nodes/              # Node type implementations
    └── styles/             # CSS stylesheets
```

## 🎨 Customization

### Theming
Modify `src/styles/variables.css` to customize colors, fonts, and spacing.

### Node Styling
Edit `src/styles/nodes.css` to customize node appearance and animations.

### Layout
Adjust `src/styles/layout.css` to modify the overall application layout.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🆘 Support

For issues, questions, or contributions:
1. Check the memory bank documentation in `/memory-bank/`
2. Review the technical context and system patterns
3. Open an issue on GitHub

---

**NodeUI** - Powerful node-based interface for interactive graphs and 3D visualizations. Serverless, modern, and ready to use. 