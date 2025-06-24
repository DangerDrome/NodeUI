# Active Context

## Current Focus
The current focus is on stabilizing and refining the `SubGraph` node feature. After completing the initial implementation, work has shifted to addressing bugs related to state management, navigation, and data persistence to ensure the system is robust and reliable, especially in nested contexts.

## Recent Changes
- **Refactored Preview to SVG**: Replaced the canvas-based preview with an SVG-based one, resolving high-DPI scaling issues and enabling automatic centering and framing via the `viewBox` attribute.
- **Fixed State Persistence**: Resolved multiple bugs where `SubGraph` state (including edges) was not being correctly preserved when navigating between different graph levels using the breadcrumbs.
- **Corrected Navigation Logic**: Rewrote breadcrumb navigation logic to handle multi-level jumps correctly, preventing corrupted graph states.
- **Synchronized Graph Loading**: Removed a `setTimeout` from the graph loading process to make it synchronous, fixing a race condition that caused edges to disappear during navigation.
- **Improved UI Consistency**: Standardized the `SubGraph` icon and fixed an issue where breadcrumbs would disappear when navigating up a single level.
- **Resolved Unwanted Downloads**: Fixed a bug where exiting a subgraph would incorrectly trigger a file download.

## Active Decisions
- SubGraph nodes are self-contained and can be created from JSON files.
- Navigation is handled via double-click and a breadcrumb trail with a "Main" button for direct root access.
- Previews are rendered using SVG for crisp, scalable, and automatically-framed thumbnails.
- A deep-copy approach to state serialization is used when navigating contexts to prevent data corruption.
- The `squares-subtract` icon is now used consistently for all `SubGraph` related UI elements.

## Next Steps
- Implement robust data flow for exposed attributes between parent and subgraphs.
- Add SubGraph-specific context menu options for managing exposed attributes.
- Thoroughly test all `SubGraph` interaction paths, including deeply nested scenarios.
- Consider adding `SubGraph` templates or a library system for reusability.

## Known Issues
- Exposed attribute data flow is still a placeholder implementation and not fully functional.
- SubGraph file creation still relies on a manual save action rather than being fully automatic or integrated with a library system.

## Current Status
- **Project**: SubGraph Node Stabilization
- **Phase**: Refinement & Bug Fixing
- **Progress**: 95% - Core functionality is stable, with remaining work focused on data flow and advanced features. 