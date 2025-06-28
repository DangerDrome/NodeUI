# Active Context

## Current Focus
The current focus is on implementing the advanced timeline features within the `ThreeJSNode`. We are working through the phases outlined in `memory-bank/timeline_plan.md`, having recently completed the dynamic integration of connected nodes into the timeline and 3D scene.

## Recent Changes
- **Dynamic Node Connection**: Implemented a system where nodes connected to the `ThreeJSNode` are automatically detected and represented in the timeline's outliner and the 3D scene.
- **3D Text Rendering**: Notes connected to the `ThreeJSNode` are now rendered as 3D text meshes in the viewport, replacing the previous placeholder cubes. This involves asynchronous font loading.
- **Direct State Push**: A new system pattern was introduced where the main application logic directly pushes state changes (like new connections) to specialized nodes like the `ThreeJSNode`.
- **Keyframe & Action Bar Interactions**: Implemented comprehensive interactivity for keyframes (selection, multi-select, marquee, dragging, copy/paste, insert/delete) and for summary action bars (dragging, resizing).
- **Animation Playback**: The timeline now drives the animation in the 3D viewport, interpolating values between keyframes and updating the scene in real-time.

## Active Decisions
- The `ThreeJSNode` should dynamically reflect the nodes connected to it.
- Connected notes should be represented by their text content in the 3D world, not as generic shapes.
- The animation system should correctly interpolate values and update the 3D scene during both playback and scrubbing.
- Interactivity in the timeline should be robust, supporting selection, dragging, and management of keyframes.

## Next Steps
- Complete the remaining items in the `timeline_plan.md`.
- Implement loading of 3D model formats (e.g., FBX, glTF, Alembic) into the `ThreeJSNode`.
- Expose properties from the 3D scene (e.g., camera position, object transforms) as connectable attributes on the node.

## Known Issues
- The connection detection logic currently passes the entire node `content`. For large notes, this could be inefficient. This may need optimization later.

## Current Status
- **Project**: Advanced Timeline Implementation
- **Phase**: Phase 2/3 - Data Model & Interactivity / Keyframe Visualization
- **Progress**: The core UI, data model, and keyframe interactivity are largely complete. The system now dynamically connects to other nodes. The next major step is rendering the animation in the viewport. 