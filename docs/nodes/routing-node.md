# RoutingNode

A minimalist waypoint node designed for managing edge paths. RoutingNode is a tiny 30x30 pixel node with no title bar, no content area, and no resize handles -- just a network icon and four connection handles.

## Key Features

- **Compact size** -- 30x30 pixels by default, the smallest node type
- **No content or title** -- renders only an icon and connection handles
- **Edge routing** -- use as a waypoint to redirect or organize edge paths between distant nodes
- **Custom render** -- bypasses the standard BaseNode title bar and content area for a minimal footprint
- **Icon cycling** -- tracks an internal `iconState` for potential icon variations

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `width` | `number` | `30` | Width in pixels |
| `height` | `number` | `30` | Height in pixels |
| `title` | `string` | `''` | Empty by default (not displayed) |
| `color` | `string` | `'default'` | Color theme variant |

## Usage

### Redirecting Edges

Place a RoutingNode between two distant nodes to create a clean path:

1. Add a RoutingNode from the context menu.
2. Connect an edge from Node A to the RoutingNode.
3. Connect another edge from the RoutingNode to Node B.

The result is a neatly routed connection that avoids crossing over unrelated nodes.

### Organizing Complex Graphs

In dense graphs, RoutingNodes act as junction points. Use them to consolidate multiple connections at a single waypoint before fanning out to destination nodes.

::: tip
RoutingNodes are especially useful in large graphs where direct node-to-node edges would create a tangled mess. Place them at strategic intersections to keep your layout clean.
:::
