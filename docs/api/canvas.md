# Canvas System

The `Canvas` class in `src/core/canvas.js` manages all visual rendering on the NodeUI workspace. It initializes the layered SVG and HTML structure, handles pan and zoom transforms, draws edge curves and arrowheads, and provides snap guides and selection box logic.

## Initialization

`Canvas` is instantiated with a reference to the main `NodeUI` instance and sets up the workspace with `initCanvas()`:

```javascript
const canvas = new Canvas(nodeUI);
canvas.initCanvas();
```

`initCanvas()` creates four rendering layers inside the container element, from bottom to top:

1. **Grid SVG** -- A dot-grid background using an SVG `<pattern>` element with 20px spacing
2. **Group container** -- An HTML `<div>` for GroupNode elements
3. **Edge SVG** -- An SVG canvas with a `<g>` group for edge paths and arrowheads
4. **Node container** -- An HTML `<div>` for node elements and the selection box

All four layers share the same coordinate transform, so nodes and edges stay aligned during pan and zoom.

## Pan and Zoom

NodeUI stores the current viewport state in `nodeUI.panZoom`:

```javascript
nodeUI.panZoom = {
  offsetX: 0,    // Horizontal pan in pixels
  offsetY: 0,    // Vertical pan in pixels
  scale: 1       // Zoom level (1 = 100%)
};
```

### Applying Transforms

Call `updateCanvasTransform()` after modifying `panZoom` values. This method applies the transform to every layer simultaneously:

- HTML layers use CSS `translate3d()` and `scale()` for GPU-accelerated rendering
- The SVG layer uses an SVG `transform` attribute
- The grid pattern updates its `patternTransform` to create the illusion of an infinite background

```javascript
// Pan the canvas 100px to the right
nodeUI.panZoom.offsetX += 100;
canvas.updateCanvasTransform();
```

### Animated Pan/Zoom

Use `animatePanZoom()` for smooth transitions, such as zooming to fit or centering on a node:

```javascript
canvas.animatePanZoom(
  targetScale,    // Target zoom level
  targetOffsetX,  // Target horizontal pan
  targetOffsetY,  // Target vertical pan
  duration        // Animation time in ms (default: 300)
);
```

The animation uses cubic ease-out interpolation (`1 - (1 - t)^3`) and runs via `requestAnimationFrame`.

## Edge Rendering

### Arrowhead Markers

During initialization, `createMarkers()` generates SVG `<marker>` definitions for every combination of node color and state:

- **Colors:** `default`, `red`, `green`, `blue`, `yellow`, `purple`
- **States:** `border` (normal), `border-hover` (active/hover)

Each marker is named `arrowhead-{color}-{state}` and references CSS custom properties for its fill color:

```css
/* The marker fill reads from CSS variables */
fill: var(--color-node-yellow-border);
```

### Bezier Curves

The `calculateCurve()` method generates a cubic bezier SVG path between two points. It accounts for the handle positions (top, bottom, left, right) on each node to determine the curve direction:

```javascript
const pathData = canvas.calculateCurve(
  { x: 100, y: 200 },  // Start position
  { x: 400, y: 300 },  // End position
  'right',              // Start handle direction
  'left'                // End handle direction
);
// Returns: "M 108 200 C 158 200, 350 300, 392 300"
```

The algorithm:

1. **Pad** the start and end points away from the node by a configurable `--edge-padding` distance (default 8px)
2. **Calculate control points** offset along the handle direction, with the offset capped at half the distance between nodes
3. **Generate** an SVG cubic bezier: `M startX startY C cp1X cp1Y, cp2X cp2Y, endX endY`

### Spline Routing

When an edge has routing points (waypoints added by the user), `calculateSpline()` generates a path through all of them:

```javascript
const pathData = canvas.calculateSpline(
  [startPos, routingPoint1, routingPoint2, endPos],
  'right',  // Start handle
  'left'    // End handle
);
```

Routing points use straight line segments (`L`) between waypoints, with padding applied at the start and end based on handle direction.

### Updating Edges

`updateEdge(edgeId)` recalculates and redraws a specific edge. It:

1. Reads the edge's current start and end positions
2. Chooses `calculateSpline` (if routing points exist) or `calculateCurve` (if not)
3. Updates the visible path and the invisible hit area path
4. Repositions the label and its background rectangle at the path midpoint

```javascript
canvas.updateEdge('edge-abc-123');
```

## Snap Guides

Snap guides are temporary alignment lines that appear during node dragging.

### `drawGuide(val, orientation, color)`

Draws a guide line on the canvas.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `val` | `number` | -- | The position value (x-coordinate for vertical, y-coordinate for horizontal) |
| `orientation` | `string` | -- | `'v'` for vertical line, `'h'` for horizontal line |
| `color` | `string` | `'var(--color-danger)'` | CSS color value for the guide |

```javascript
// Draw a vertical guide at x=300
canvas.drawGuide(300, 'v');

// Draw a horizontal guide at y=200 in green
canvas.drawGuide(200, 'h', 'var(--color-success)');
```

### `clearGuides()`

Removes all snap guide lines from the canvas. Call this when a drag operation ends.

```javascript
canvas.clearGuides();
```

## Selection Box

The canvas manages a selection box element (`selectionState.selectionBox`) that appears when the user drags on empty canvas space.

`endSelection()` is called when the drag ends. It:

1. Computes the bounding rectangle of the selection box
2. Tests every node and edge against that rectangle
3. Adds matching elements to the selection set
4. Publishes `selection:changed` with the updated selection

::: tip
The selection box is an HTML `<div>` in the node container layer, not an SVG element. This keeps it above edges but in the same coordinate space as nodes.
:::

## Method Reference

| Method | Description |
|--------|-------------|
| `initCanvas()` | Creates all rendering layers and marker definitions |
| `createMarkers()` | Generates SVG arrowhead markers for each color/state |
| `updateEdge(edgeId)` | Recalculates and redraws a single edge |
| `calculateCurve(startPos, endPos, startHandle, endHandle)` | Returns SVG path data for a cubic bezier |
| `calculateSpline(points, startHandle, endHandle)` | Returns SVG path data through multiple waypoints |
| `calculateEdgePath(edge)` | Returns the correct path data for any edge (delegates to curve or spline) |
| `updateCanvasTransform()` | Applies current pan/zoom to all layers |
| `animatePanZoom(scale, offsetX, offsetY, duration)` | Smoothly transitions to target pan/zoom |
| `drawGuide(val, orientation, color)` | Draws a snap alignment guide |
| `clearGuides()` | Removes all snap guides |
| `endSelection()` | Finalizes a selection box drag and selects enclosed elements |
| `createVersionWatermark()` | Adds the version label to the bottom-right corner |
| `updateWatermarkPosition(watermarkGroup)` | Repositions the watermark after resize |
