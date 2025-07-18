# Technical Context

## Technology Stack

### Core Technologies
- HTML5
- CSS3
- Vanilla JavaScript (ES6+)

### Browser Features Used
1. **DOM API**
   - Element manipulation
   - Event handling
   - DOM traversal

2. **Canvas API**
   - Node rendering
   - Connection visualization
   - Interactive graphics

3. **Local Storage API**
   - Graph state persistence
   - Configuration storage
   - Session management

4. **WebGL**
   - 3D rendering via `three.js`
   - Hardware-accelerated graphics for the 3D viewport

## Development Setup

### Project Structure
```
NodeUI/
  ├── index.html          # Main entry point
  ├── src/                # Source code
  │   ├── styles/        # Stylesheets
  │   │   ├── styles.css # Global styles
  │   │   ├── variables.css # CSS variables
  │   │   ├── icons.css # Icon styles
  │   │   ├── components.css # Component styles
  │   │   ├── core/          # Core system modules
  │   │   │   ├── main.js           # Core application orchestration
  │   │   │   ├── canvas.js         # Canvas rendering and SVG operations
  │   │   │   ├── file.js           # File operations and persistence
  │   │   │   ├── contextMenu.js    # Context menu management
  │   │   │   ├── nodes.js          # Node and edge lifecycle management
  │   │   │   ├── interactions.js   # User input handling and interactions
  │   │   │   ├── edges.js          # Edge drawing and routing
  │   │   │   └── events.js         # Event system
  │   │   └── nodes/           # Node implementations
  │   │       ├── basenode.js
  │   │       ├── baseedge.js
  │   │       ├── groupnode.js
  │   │       ├── lognode.js
  │   │       ├── routingnode.js
  │   │       └── settingsnode.js
  │   │       └── subgraphnode.js
  │   │       └── threejsnode.js
  │   └── graph.json         # Graph state storage
```

### Module Dependencies
```mermaid
flowchart TD
    main[main.js] --> canvas[canvas.js]
    main --> file[file.js]
    main --> contextmenu[contextMenu.js]
    main --> nodes[nodes.js]
    main --> interactions[interactions.js]
    main --> edges[edges.js]
    main --> events[events.js]
    
    subgraph nodes[nodes/]
        basenode[basenode.js]
        baseedge[baseedge.js]
        groupnode[groupnode.js]
        lognode[lognode.js]
        routingnode[routingnode.js]
        settingsnode[settingsnode.js]
        subgraphnode[subgraphnode.js]
        threejsnode[threejsnode.js]
    end
    
    nodes --> nodes
```

## Technical Constraints

### Browser Compatibility
- Modern evergreen browsers
- ES6+ JavaScript support
- HTML5 Canvas support
- Local Storage availability

### Performance Requirements
1. **Rendering**
   - Smooth node movement
   - Responsive edge updates
   - Efficient property updates
   - Optimized 3D viewport rendering with minimal flickering

2. **State Management**
   - Quick save/load operations
   - Responsive UI updates
   - Efficient event handling
   - Intelligent render state tracking for 3D scenes

3. **Memory Usage**
   - Proper resource cleanup
   - Optimized data structures
   - Event listener management
   - Conditional animation loops to conserve resources

4. **3D Performance**
   - Conditional WebGL rendering based on state changes
   - GPU-accelerated CSS optimizations
   - Intelligent animation loop management
   - Optimized WebGL renderer configurations

### Security Considerations
1. **Data Storage**
   - Local storage limitations
   - Data validation
   - Safe serialization

2. **User Input**
   - Input sanitization
   - XSS prevention
   - Safe event handling

## Dependencies

### External Resources
- **three.js**: Used for 3D rendering within the `ThreeJSNode`. It is loaded from a CDN via an `importmap` in `index.html`, so no local installation or build step is required.
  - Core `three.js` library
  - `OrbitControls.js` for camera manipulation
  - `Line2.js`, `LineGeometry.js`, `LineMaterial.js` for advanced line rendering
  - `FontLoader.js` and `TextGeometry.js` for rendering 3D text
  - A `helvetiker_regular.typeface.json` font file is also loaded from a CDN.
- No CSS frameworks
- No build tools required

### Browser APIs
1. **Required APIs**
   - DOM Manipulation
   - Canvas 2D Context
   - WebGL Context (via three.js)
   - Local Storage
   - JSON parsing/stringifying

2. **Optional APIs**
   - Pointer Events
   - ResizeObserver
   - requestAnimationFrame

## Development Guidelines

### Code Standards
1. **JavaScript**
   - ES6+ features
   - Handler pattern for separation of concerns
   - Clear documentation
   - Consistent naming

2. **HTML/CSS**
   - Semantic markup
   - BEM methodology
   - Responsive design
   - Performance-focused

### Architecture Guidelines
1. **Handler Pattern**
   - Each handler has a single responsibility
   - Clean interfaces between handlers
   - Delegation pattern for method calls
   - Event-driven communication

2. **State Management**
   - Centralized state in NodeUI core
   - Handler-specific state isolation
   - Clear state boundaries
   - Event-based state updates

### Testing Requirements
1. **Browser Testing**
   - Chrome
   - Firefox
   - Safari
   - Edge

2. **Feature Testing**
   - Node operations
   - Edge management
   - State persistence
   - Event handling
   - Handler interactions
   - SubGraph operations
   - 3D Viewport rendering and interaction

3. **Performance Testing**
   - 3D viewport rendering performance
   - Animation loop efficiency
   - Memory usage optimization
   - GPU acceleration effectiveness
   - Flickering elimination validation

## 3D Performance Optimization Techniques

### Animation Loop Management
- **Conditional Activation**: Animation loops only run when user is interacting or timeline is playing
- **State Tracking**: `isAnimating` and `needsRender` flags prevent unnecessary operations
- **Resource Conservation**: Automatic cleanup of animation frames when not needed

### Render Optimization
- **Intelligent Rendering**: Only render when scene state actually changes
- **State Flags**: `needsRender` flag tracks when rendering is required
- **Minimal Operations**: Avoid render calls when scene is static

### WebGL Optimizations
- **Power Preference**: Set to "high-performance" for better GPU utilization
- **Pixel Ratio Capping**: Limit device pixel ratio to prevent excessive rendering
- **Feature Toggles**: Disable expensive features like shadows when not needed
- **Color Space**: Proper SRGB color space configuration

### CSS Performance
- **GPU Acceleration**: `transform: translateZ(0)` forces hardware acceleration
- **Layout Optimization**: Absolute positioning prevents layout thrashing
- **Rendering Hints**: `will-change` and `backface-visibility` optimize rendering
- **Canvas Optimization**: Image rendering optimizations for smooth display 