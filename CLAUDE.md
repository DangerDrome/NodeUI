# NodeUI - Claude Code Guide

## Project Overview

NodeUI is a serverless, node-based visual programming interface for creating interactive graphs and 3D visualizations. Built with **vanilla JavaScript** (no bundler, no framework). The app runs entirely in the browser - just open `index.html`.

- **Live app**: https://app.nodeui.io
- **Docs site**: VitePress at `/docs/` (run with `npm run docs:dev`)
- **Collaboration server**: Cloudflare Durable Objects worker at `/durable-objects-worker/`
- **Version**: See `package.json` (currently 1.1.22)

## Architecture

### No Build System
This is vanilla JS loaded via `<script>` tags in `index.html`. There is no bundler, no transpiler, no module system beyond dynamic `<script>` loading in `src/main.js`. Do NOT introduce build tools, ES module imports, or npm dependencies into the app code.

### File Structure
```
index.html              # App entry point - loads all scripts
config.js               # WebSocket URL config (per-environment)
src/
  main.js               # Module loader - loads all core + node scripts
  core/
    main.js             # App orchestrator (Main class) - central state
    canvas.js           # SVG rendering system
    interactions.js     # User input (pan, zoom, drag, select)
    file.js             # File I/O, localStorage, IndexedDB
    nodes.js            # Node lifecycle management
    edges.js            # Edge drawing and routing (bezier)
    events.js           # Event bus (pub/sub)
    contextMenu.js      # Right-click menus
    collaboration.js    # WebSocket collab client
    markdown.js         # Markdown processing
    libs.js             # CDN library loader (Three.js, Marked, etc.)
    version.js          # Version display
  nodes/
    basenode.js          # Base node class - all nodes extend this
    baseedge.js          # Base edge class
    groupnode.js         # Container/group node
    routingnode.js       # Edge routing helper node
    lognode.js           # Debug logging node
    settingsnode.js      # App settings node
    subgraphnode.js      # Nested graph container
    threejsnode.js       # 3D viewport (Three.js)
    imagesequencenode.js # Frame animation node
  styles/
    variables.css        # Design tokens / CSS custom properties
    layout.css           # App layout
    nodes.css            # Node styling
    timeline.css         # Timeline UI
    icons.css            # Icon sprites
```

### Key Patterns
- **Event-driven**: Modules communicate through `main.events` (pub/sub bus)
- **Class-based nodes**: All node types extend `BaseNode`
- **Centralized state**: `Main` class in `src/core/main.js` holds app state
- **CDN libraries**: Three.js, Marked.js, etc. loaded dynamically from CDN via `libs.js`
- **SVG + HTML rendering**: Canvas uses layered SVG for edges, HTML for nodes

### Collaboration
- WebSocket client in `src/core/collaboration.js`
- Server: Cloudflare Durable Objects in `durable-objects-worker/`
- Deploy with `cd durable-objects-worker && wrangler deploy`
- Config: Set `window.NODEUI_WS_URL` in `config.js`

## Development Commands

```bash
# Documentation site (VitePress)
npm run docs:dev        # Dev server
npm run docs:build      # Build docs
npm run docs:preview    # Preview built docs

# Collaboration server
cd durable-objects-worker && wrangler deploy

# App itself - no build needed, just serve index.html
# e.g. python3 -m http.server, or open file directly
```

## Coding Conventions

- **Vanilla JS only** in `src/` - no npm imports, no ES modules, no TypeScript
- Libraries loaded from CDN via `libs.js` - do not add to package.json
- Node types go in `src/nodes/` and extend `BaseNode`
- CSS uses custom properties defined in `variables.css`
- Use the event bus (`this.main.events`) for cross-module communication
- File format is JSON (see README for schema)
- Docs are VitePress markdown in `docs/`

## Important Notes

- `package.json` is ONLY for the VitePress docs site, not the app
- `node_modules/` contains VitePress deps only
- The app has zero npm dependencies - keep it that way
- `graph.json` at root is a sample/test graph file
- `functions/` contains Cloudflare Pages Functions for collab routing
