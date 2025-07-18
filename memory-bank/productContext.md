# Product Context

## Purpose
NodeUI exists to provide a flexible, lightweight solution for creating and managing node-based visual workflows in web applications. It addresses the need for a framework-independent node graph interface that can be easily integrated into any web project.

## Problems Solved
1. **Visual Workflow Creation**: Enables users to create complex workflows through visual node connections
2. **Dynamic Configuration**: Provides a flexible way to configure node properties and behaviors
3. **State Management**: Handles complex state management for node graphs without external libraries
4. **User Interaction**: Simplifies complex user interactions into intuitive operations
5. **Data Persistence**: Manages saving and loading of graph states
6. **Workflow Modularity**: Allows for the creation of reusable, nested, and shareable graph components.
7. **3D Visualization**: Provides an integrated 3D viewport for displaying and interacting with 3D scenes and timelines.

## User Experience Goals

### Core User Flows
1. **Node Creation**
   - Quick access to node types through context menu
   - Intuitive placement in the workspace
   - Clear visual feedback

2. **Node Connection**
   - Simple edge creation between nodes
   - Visual feedback for valid/invalid connections
   - Easy edge manipulation

3. **Node Configuration**
   - Accessible properties panel
   - Real-time property updates
   - Type-specific configuration options

4. **Graph Management**
   - Save/load graph states
   - Group operations on nodes
   - Workspace navigation

4. **SubGraph Management**
   - Create self-contained subgraphs from nodes or files
   - Navigate into and out of subgraphs seamlessly
   - Understand subgraph contents via previews

### User Interface Principles
1. **Clarity**: Clear visual hierarchy and node relationships
2. **Responsiveness**: Immediate feedback for user actions
3. **Consistency**: Uniform interaction patterns across features
4. **Efficiency**: Minimize clicks for common operations
5. **Flexibility**: Support for different use cases and workflows

## Key Features

### Node System
- Multiple node types for different purposes
- Extensible node architecture
- Custom node properties and behaviors

### Edge Management
- Flexible connection system
- Edge routing and visualization
- Connection validation

### 3D Viewport System
- Integrated `three.js` viewport node
- Interactive camera controls (orbit, pan, zoom)
- Timeline controls for animation playback

### SubGraph System
- Create self-contained, nested graphs
- Share and reuse subgraphs via JSON files
- Navigate graph hierarchy with breadcrumbs
- Expose attributes for external connections

### User Interface
- Context-sensitive menus
- Properties panel
- Workspace controls
- Event handling system

### Data Management
- Graph state persistence
- Node configuration storage
- Event logging

## Integration Goals
- Easy integration into existing web applications
- Minimal setup requirements
- Clean API for external interaction
- Customizable styling and theming 