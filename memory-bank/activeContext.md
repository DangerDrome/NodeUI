# Active Context

## Current Focus
The current focus is on implementing a new SubGraph node type that provides self-contained graph functionality similar to Houdini HDAs. This feature allows users to create reusable, shareable graph components with exposed attributes.

## Recent Changes
- **Implemented SubGraph Node**: Created a new SubGraphNode class that extends BaseNode with internal graph management capabilities.
- **Added Graph Context Management**: Implemented navigation between parent and subgraph contexts with breadcrumb navigation.
- **Added Preview Rendering**: SubGraph nodes display a simplified preview of their internal contents.
- **Added Exposed Attributes**: SubGraph nodes can have input/output ports that connect to the parent graph.
- **Updated Context Menu**: Added SubGraph creation option to the canvas context menu.
- **Added File Management**: Implemented separate JSON file storage for SubGraph data.
- **Added CSS Styling**: Created styles for SubGraph nodes, preview canvas, exposed handles, and breadcrumb navigation.

## Active Decisions
- SubGraph nodes are self-contained and stored as separate JSON files.
- Double-click navigation with breadcrumb support for easy navigation.
- Simplified preview rendering showing nodes as rectangles without text.
- Exposed attributes as handles on the left (input) and right (output) sides.
- Purple color scheme for SubGraph nodes to distinguish them from other node types.

## Next Steps
- Test the SubGraph functionality in the browser.
- Implement proper exposed attribute data flow between parent and subgraph.
- Add SubGraph-specific context menu options for managing exposed attributes.
- Consider adding SubGraph templates or library functionality.

## Known Issues
- File loading for SubGraphs currently uses a file input dialog instead of direct file system access.
- Exposed attribute data flow is currently placeholder implementation.

## Current Status
- **Project**: SubGraph Node Implementation
- **Phase**: Implementation Complete
- **Progress**: 90% - Core functionality implemented, needs testing and refinement. 