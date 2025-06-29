# Project Plan: 2D Image Sequence Integration

This plan outlines the implementation of 2D image sequence playback within the 3D viewport.

## Phase 1: Create the `ImageSequenceNode` ✅ COMPLETED

- [x] **Create `ImageSequenceNode.js`:**
    - Inherit from `BaseNode`.
    - Create a simple UI with a title and a content area for the thumbnail.
- [x] **Implement Thumbnail Viewer:**
    - The content area will display a single thumbnail from the image sequence.
- [x] **Implement Thumbnail Scrubbing:**
    - Add event listeners (`mousedown`, `mousemove`, `mouseup`, `mouseleave`) to the thumbnail element.
    - On drag, calculate the frame index based on horizontal mouse movement and update the thumbnail's `src`.
- [x] **Data Structure:**
    - The node will hold a hardcoded array of image file paths for initial implementation.
- [x] **Keyboard Navigation:**
    - Left arrow key steps to previous frame
    - Right arrow key steps to next frame
    - Node is focusable with tabindex for keyboard interaction
    - Wraps around at sequence boundaries (last frame → first frame, first frame → last frame)
- [x] **Play/Pause Functionality:**
    - Space bar toggles play/pause state
    - Default 24 FPS playback speed
    - Visual play indicator (▶) in frame counter when playing
    - Automatically pauses when scrubbing starts
    - Publishes `imagesequence:play` and `imagesequence:pause` events
    - Configurable FPS with `setFPS()` method (1-60 FPS range)
    - Proper cleanup of animation intervals on destroy

**Implementation Details:**
- Created `src/nodes/imagesequencenode.js` with full scrubbing functionality
- Added CSS styles in `src/styles/components.css` for visual feedback
- Registered node type in `src/core/main.js` and context menu
- Added context menu entry in `graph.json`
- Includes frame indicator, placeholder for empty sequences, and smooth scrubbing
- Publishes `imagesequence:frame-changed` events for timeline integration
- Added `nextFrame()` and `previousFrame()` methods for keyboard navigation
- Node is focusable with `tabindex="0"` for keyboard interaction
- Arrow keys prevent default behavior and stop propagation to avoid conflicts
- Added `play()`, `pause()`, and `togglePlayPause()` methods
- Animation state management with `isPlaying` flag and `animationInterval`
- Frame duration calculation based on FPS setting
- Scrubbing automatically pauses playback to prevent conflicts
- Proper event cleanup in `destroy()` method

## Phase 1.5: Drag & Drop Support ✅ COMPLETED

- [x] **Multiple Image File Detection:**
    - Modified `src/core/file.js` to detect when multiple image files are dropped
    - Automatically creates an ImageSequenceNode instead of individual image nodes
- [x] **Single Image Sequence Detection:**
    - Added `isLikelySequenceImage()` method to detect sequence patterns in filenames
    - Detects patterns like: `_0001.jpg`, `-001.png`, `[0001].jpg`, `frame001.jpg`, etc.
    - Automatically creates ImageSequenceNode for single images that match sequence patterns
    - No user choice overlay - always creates sequence nodes for detected sequence images
- [x] **File Processing:**
    - Sorts image files by name for consistent ordering
    - Converts all images to data URLs for storage in the node
    - Creates descriptive title from base filename and frame count
    - Special title for single sequence frames: "(Sequence Frame)"
- [x] **Node Creation:**
    - Creates ImageSequenceNode with appropriate size and position
    - Sets blue color theme to distinguish from regular image nodes
    - Initializes with first frame (index 0)
    - Handles both multi-frame sequences and single-frame sequences

**Implementation Details:**
- Updated `onDrop` method in `src/core/file.js` to check for multiple image files
- Added `createImageSequenceNode` helper method for processing image sequences
- Added `isLikelySequenceImage` method to detect sequence patterns in filenames
- Maintains backward compatibility with single image drops and other file types
- Sequence detection patterns include:
  - Frame numbers with separators: `_0001.jpg`, `-001.png`, `.0001.jpg`
  - Frame numbers in brackets: `[0001].jpg`, `(001).png`
  - Keywords: `frame001.jpg`, `shot_001.png`, `seq001.jpg`
  - Timecode patterns: `_00_00_01_000.jpg`
  - Simple numbers: `image1.jpg`, `shot2.png`

## Phase 2: Implement "2D Mode" in the `ThreeJSNode`

- [ ] **Add UI Toggle:**
    - Create a "2D/3D" button in the `ThreeJSNode`'s viewport overlay.
- [ ] **Implement Camera Switching:**
    - Add an orthographic camera to `ThreeJSNode`.
    - Create a function to toggle between the existing perspective camera and the new orthographic camera.
    - When switching to 2D, the camera should have a top-down view (`position: [0, 10, 0]`, `lookAt: [0, 0, 0]`).
- [ ] **Update Camera Controls:**
    - When in 2D mode, disable orbit controls (rotation) but keep pan and zoom functional.

## Phase 3: Display Image Sequences in 2D Mode

- [ ] **Detect Connected Nodes:**
    - Update `ThreeJSNode` to identify when an `ImageSequenceNode` is connected to it.
- [ ] **Create Image Planes:**
    - For each connected `ImageSequenceNode`, create a `THREE.Mesh` with a `PlaneGeometry` and a `MeshBasicMaterial`.
- [ ] **Layer Multiple Sequences:**
    - If multiple `ImageSequenceNode`s are connected, arrange their corresponding planes with a slight Z-axis offset to ensure they are all visible and do not overlap perfectly (z-fighting).

## Phase 4: Animate the Image Sequence

- [ ] **Link to Timeline:**
    - In the `ThreeJSNode`'s animation loop (`updateAnimatedProperties`), get the current frame.
- [ ] **Update Textures:**
    - Based on the current frame, determine the correct image from the sequence.
    - Load the image as a `THREE.Texture`.
    - Apply the new texture to the material of the corresponding plane.
- [ ] **Maintain Aspect Ratio:**
    - When a new texture is loaded, get its dimensions.
    - Adjust the scale of the `THREE.Plane` mesh to match the image's aspect ratio. 