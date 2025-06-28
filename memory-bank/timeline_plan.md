# Project Plan: Advanced Timeline Implementation

This plan is divided into four distinct phases. We will tackle one phase at a time, ensuring each step is complete and correct before moving to the next.

## Phase 1: UI/UX Overhaul & Layout Reconstruction

The goal of this phase is to restructure the node's content area to create the foundational layout for the advanced timeline, including the layer panel and the new playhead design. This is primarily a visual and structural update with placeholder content.

- [x] **Restructure Content Area:** Divide the `.node-content` of the ThreeJSNode into a two-column layout.
- [x] **Create Timeline Header:** Design a new header area with playback controls, editable start/end frames, and current frame display.
- [x] **Implement New Playhead:** Replace the old slider with a new draggable playhead element.
- [x] **Implement Draggable Range Handles:** Add visual handles to resize the active frame range.
- [x] **Initial Styling:** Apply CSS to style all new elements.

## Phase 2: Data Model, Dynamic Layers & Interactivity

This phase focuses on the data model, populating the layers panel, and making the timeline interactive.

- [x] **Establish Data Structure:** Create the `this.sceneObjects` data structure to manage animatable objects and their keyframes.
- [x] **Detect Connected Nodes:** Implement a method to traverse the graph and find nodes connected to the ThreeJSNode. *(Note: We are currently using a hardcoded data model for testing. This step is pending.)*
- [x] **Render Layers Dynamically:** Repopulate the Layers Panel based on the `this.sceneObjects` data.
- [x] **Implement Keyframe Management (Context Menu & Shortcuts):**
    - [x] Add context menus for the viewport and timeline.
    - [x] Implement Insert Keyframe (`I` key).
    - [x] Implement Delete Selected Keyframes (`Delete`/`Backspace`).
    - [x] Implement Copy/Paste for selected keyframes.
- [x] **Implement Interactive Action Bars:**
    - [x] Make action bars draggable to shift animations.
    - [x] Make action bars resizable to control clip start/end times.

## Phase 3: Keyframe Creation & Visualization

This phase brings the timeline to life by adding the ability to create and display keyframes on each object track.

- [x] **Enhance Data Structure:** Expand the data structure to include keyframe arrays.
- [x] **Implement Keyframe Creation:** Add a mechanism to insert keyframes.
- [x] **Visualize Keyframes:** Implement a method to render keyframe markers on the timeline.

## Phase 4: Animation Playback & Interpolation

The final phase connects the keyframe data to the three.js engine to drive the actual animation.

- [x] **Create 3D Object Representations:** Create corresponding `THREE.Object3D` in the three.js scene for each animatable node.
- [x] **Implement Interpolation Logic:** Update the animation loop to calculate interpolated transform values based on keyframes.
- [x] **Update 3D Objects:** Apply the interpolated values to the corresponding `THREE.Object3D` properties.
- [x] **Render Scene:** Ensure the three.js renderer updates on each frame during playback. 