# GroupNode

A container node for visually organizing collections of related nodes. GroupNode renders as a larger, distinct region on the canvas without a content body, allowing other nodes to sit inside it.

## Key Features

- **Visual grouping** -- acts as a background container for other nodes
- **No content area** -- the body is intentionally empty to maximize space for child nodes
- **Contained node tracking** -- maintains a set of node IDs that belong to the group
- **Distinct styling** via the `group-node` CSS class
- **Group icon** in the title bar to differentiate from standard nodes

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `width` | `number` | `400` | Width in pixels |
| `height` | `number` | `300` | Height in pixels |
| `title` | `string` | `'New Group'` | Display title in the title bar |
| `color` | `string` | `'default'` | Color theme variant |
| `containedNodeIds` | `string[]` | `[]` | Array of node IDs this group contains |

## Usage

### Creating a Group

Add a GroupNode from the context menu. It appears as a large, semi-transparent region. Drag it behind other nodes or drag nodes on top of it to create a visual grouping.

### Managing Contained Nodes

GroupNode tracks which nodes are contained within it through its `containedNodeIds` set. When you drag a node into a group's bounding area, the system adds that node's ID to the group. Dragging a node out removes it.

### Resizing

Resize the group freely using any of the eight resize handles. The group does not constrain the position of its children -- it serves as a visual organizer, not a strict container.

::: tip
Use GroupNode to organize related sections of your graph. For example, group all data-processing nodes together and all output nodes together to keep large graphs navigable.
:::
