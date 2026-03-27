# SettingsNode

The application configuration hub. SettingsNode provides a full settings panel within a node, covering project metadata, graph persistence, UI behavior, theme customization, and context menu configuration.

## Key Features

- **Project settings** -- set project name, thumbnail URL, copy project markdown, and take/save screenshots
- **Graph persistence** -- save the current graph to JSON or load a graph from a JSON file
- **UI settings** -- toggle snap-to-objects, snap-to-grid, and adjust snap threshold, shake sensitivity, and edge gravity
- **Theme editor** -- live color pickers for every CSS custom property defined in `:root`, organized by category
- **Context menu editor** -- customize labels and icons for context menu items
- **Live updates** -- settings changes propagate immediately through the event bus

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `width` | `number` | `450` | Width in pixels |
| `height` | `number` | `600` | Height in pixels |
| `title` | `string` | `'Settings'` | Display title in the title bar |
| `color` | `string` | `'default'` | Color theme variant |

## Sections

### Project

Configure project-level metadata:

- **Project Name** -- the display name for your graph
- **Thumbnail URL** -- a URL or data URI for the project thumbnail
- **Copy Markdown** -- copies a markdown snippet with the project title and thumbnail to your clipboard
- **Take Screenshot** -- captures a screenshot of the current canvas
- **Save Screenshot** -- downloads the most recent screenshot as a PNG file

### Graph

Manage graph persistence:

- **Save Graph** -- serializes the full graph (nodes, edges, canvas state) to a JSON file download
- **Load Graph** -- opens a file picker to load a previously saved `.json` graph file

### UI Settings

Fine-tune canvas behavior with these controls:

| Setting | Type | Range | Description |
|---------|------|-------|-------------|
| Snap to Objects | Toggle | on/off | Enable alignment snapping to other nodes |
| Snap to Grid | Toggle | on/off | Enable snapping to the canvas grid |
| Snap Threshold | Slider | 1 -- 20 | Distance in pixels at which snapping activates |
| Shake Sensitivity | Slider | 1 -- 10 (step 0.5) | Sensitivity of the shake gesture to disconnect edges |
| Edge Gravity | Slider | 0 -- 100 | How strongly edges curve toward their midpoint |

### Theme

The theme section provides color pickers and text inputs for every CSS custom property defined on `:root`. Variables are grouped into cards by category:

- **Core: Background** -- canvas and panel background colors
- **Core: Text, Borders & Accents** -- text colors, border colors, accent and danger colors
- **Node: Default / Red / Green / Blue / Yellow / Purple** -- per-color-variant node theming
- **Sizing & Layout** -- border radius, shadows, panel dimensions, edge and handle sizing
- **Typography** -- font families and heading sizes

Color changes apply in real time. RGBA values preserve their original alpha channel when you pick a new color.

### Context Menu

Customize the labels and icon classes for items in the canvas and edge context menus. Changes take effect immediately.

::: tip
Use the Theme section to build a custom color scheme that matches your project or brand. Every color on the canvas, including node variants and edge colors, is driven by CSS custom properties that you can edit here.
:::
