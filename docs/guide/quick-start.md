# Quick Start

Get NodeUI running in under a minute. No installation, no build tools, no dependencies.

## Step 1: Get the Code

Clone the repository:

```bash
git clone https://github.com/megasupersoft/nodeui.git
```

Or [download the ZIP](https://github.com/megasupersoft/nodeui/archive/refs/heads/master.zip) and extract it.

## Step 2: Open in a Browser

Open `index.html` in any modern browser:

```bash
cd NodeUI
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

That's it. No `npm install`. No build step. No server required.

::: tip
NodeUI works from a local `file://` path. You can also serve it from any static web server, GitHub Pages, Netlify, Vercel, or an S3 bucket.
:::

## Step 3: Create Your First Node

1. **Right-click** on the canvas
2. Select **Add Node** from the context menu
3. Choose a node type (start with **BaseNode**)

Your first node appears on the canvas.

## Step 4: Connect Two Nodes

1. Create a second node using the same right-click method
2. **Drag from a handle** on the first node to a handle on the second node
3. A bezier curve edge connects the two nodes

You now have a working graph.

## Step 5: Save Your Work

Press `Ctrl+S` (or `Cmd+S` on macOS) to save your graph as a JSON file.

::: tip
NodeUI also auto-saves to your browser's local storage continuously. Your work persists between sessions without manual saves.
:::

## Basic Workflow

Here is the typical workflow in NodeUI:

1. **Create nodes** by right-clicking the canvas
2. **Connect nodes** by dragging between handles
3. **Organize** by moving nodes and using GroupNodes as containers
4. **Edit content** by interacting with node-specific controls (markdown, 3D viewport, timeline)
5. **Save and export** with `Ctrl+S` for JSON or export as PNG screenshot

## What's Next

- [Basic Operations](./basic-operations) -- Full reference for all canvas interactions
- [Keyboard Shortcuts](./keyboard-shortcuts) -- Work faster with hotkeys
- [File Format](./file-format) -- Understand what gets saved
