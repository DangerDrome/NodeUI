# Project Plan: 2D Image Sequence Integration

This plan outlines the implementation of 2D image sequence playback within the 3D viewport.

## Phase 1: Create the `ImageSequenceNode`

- [ ] **Create `ImageSequenceNode.js`:**
    - Inherit from `BaseNode`.
    - Create a simple UI with a title and a content area for the thumbnail.
- [ ] **Implement Thumbnail Viewer:**
    - The content area will display a single thumbnail from the image sequence.
- [ ] **Implement Thumbnail Scrubbing:**
    - Add event listeners (`mousedown`, `mousemove`, `mouseup`, `mouseleave`) to the thumbnail element.
    - On drag, calculate the frame index based on horizontal mouse movement and update the thumbnail's `src`.
- [ ] **Data Structure:**
    - The node will hold a hardcoded array of image file paths for initial implementation.

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