# ThreeJSNode

A full 3D viewport node powered by Three.js. ThreeJSNode provides a live-rendered 3D scene with orbit controls, a scene outline panel, and a timeline editor for keyframe animation -- all embedded within a single node on the canvas.

## Key Features

- **Live 3D rendering** with Three.js (scene, camera, renderer, and orbit controls)
- **Grid and axes helpers** for spatial orientation
- **Scene outline panel** -- hierarchical tree view of scene objects (meshes, cameras, lights)
- **Timeline editor** with playback controls, frame range, and FPS configuration
- **Keyframe animation** -- per-property keyframes for position and rotation on any scene object
- **Action clips** -- movable, resizable time ranges per object in the timeline
- **Marquee selection** for batch-selecting keyframes in the timeline
- **Keyframe dragging** to reposition keyframes along the timeline
- **Range interaction** -- adjust the visible playback range by dragging its start/end handles
- **Tumbling mode** -- double-click the viewport to activate orbit controls; the status indicator shows whether interaction is active
- **Resize-aware** -- the renderer and camera update when the node is resized
- **Resizable panels** -- the scene outline and timeline panels have drag handles for adjusting their proportions

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `width` | `number` | `800` | Width in pixels |
| `height` | `number` | `600` | Height in pixels |
| `title` | `string` | `'3D Viewport'` | Display title in the title bar |
| `color` | `string` | `'default'` | Color theme variant |

## Layout

The node is divided into two main regions:

1. **3D Canvas** (top) -- the Three.js render target with a status indicator overlay
2. **Timeline Editor** (bottom) -- split into a scene outline panel on the left and the main timeline on the right, separated by a draggable vertical resize handle. A horizontal resize handle sits between the viewport and the timeline.

## Usage

### Activating the Viewport

The 3D viewport starts in an inactive state displaying "NOT ACTIVE (double click to activate)". Double-click the canvas area to enable orbit controls (tumbling). The status indicator updates to reflect the active state.

### Scene Objects

The default scene includes:

- **World** (root scene node)
- **Camera** with position and rotation animation channels
- **Cube** mesh with position.x and rotation.y keyframes

The scene outline panel lists all objects in a tree hierarchy. Click an object to select it and view its animation channels in the timeline.

### Timeline Controls

The timeline header provides:

| Control | Description |
|---------|-------------|
| Start frame input | Set the beginning of the playback range |
| End frame input | Set the end of the playback range |
| Current frame input | Jump to a specific frame |
| FPS input | Set playback speed (default: 24) |
| Play/Pause button | Toggle animation playback |
| Forward/Backward | Set playback direction |

### Keyframe Animation

Each scene object can have keyframes on multiple properties (`position.x`, `position.y`, `position.z`, `rotation.x`, `rotation.y`, `rotation.z`). Keyframes appear as diamonds in the timeline track. You can:

- **Click** a keyframe to select it
- **Drag** selected keyframes to reposition them in time
- **Marquee select** by clicking and dragging on empty timeline space to batch-select keyframes
- **Move action clips** by dragging the clip bar to shift all keyframes for an object

### Panel Resizing

Drag the vertical resize handle between the scene outline and the timeline to adjust their widths. Drag the horizontal resize handle between the viewport and the timeline to adjust their heights.

::: tip
The 3D viewport only renders when changes occur (dirty-flag rendering) to keep CPU usage low. If you notice the viewport not updating, double-click to reactivate it.
:::
