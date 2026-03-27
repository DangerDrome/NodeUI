# Deployment

NodeUI is a static web application with zero build step. The entire frontend -- HTML, JavaScript, CSS -- runs in the browser with no server-side rendering or bundling required. You can deploy it to any platform that serves static files.

## What You Deploy

The entire project directory is the deployable artifact. The key files are:

```
NodeUI/
+-- index.html              # Entry point
+-- config.js               # WebSocket URL configuration
+-- src/
|   +-- main.js             # Module loader
|   +-- core/               # Core system modules
|   +-- nodes/              # Node type implementations
|   +-- styles/             # CSS files
+-- functions/              # Cloudflare Pages Functions (optional)
|   +-- collab/[[path]].js  # WebSocket proxy for collaboration
+-- durable-objects-worker/ # Collaboration backend (optional)
```

::: tip
The `functions/` directory is only relevant for Cloudflare Pages deployments. Other hosting platforms ignore it.
:::

## Hosting Options

### Static Hosts (Frontend Only)

These platforms serve the static files. Collaboration features require a separate WebSocket backend.

| Platform | Cost | Setup Complexity |
|----------|------|-----------------|
| **Cloudflare Pages** | Free | Low -- includes Pages Functions for collaboration |
| **GitHub Pages** | Free | Low -- deploy from a branch or GitHub Actions |
| **Netlify** | Free tier | Low -- drag-and-drop or Git integration |
| **Vercel** | Free tier | Low -- Git integration |
| **Amazon S3 + CloudFront** | Pay-as-you-go | Medium -- requires AWS configuration |
| **Any web server** | Varies | Low -- just serve the directory |

### With Collaboration

For real-time collaboration, you need a WebSocket backend. The recommended approach is Cloudflare Pages + Durable Objects, because the Pages Function and the Durable Object worker integrate seamlessly on the same domain.

See the [Cloudflare Pages guide](./cloudflare-pages.md) for the full setup.

## Minimal Deployment

The simplest deployment is copying the files to any web server:

```bash
# Using Python's built-in server for testing
cd NodeUI
python3 -m http.server 8080
# Open http://localhost:8080
```

```bash
# Using Node.js
npx serve .
# Open http://localhost:3000
```

::: warning
NodeUI does not work from the `file://` protocol for collaboration features. WebSocket connections require an HTTP/HTTPS origin. The core editor (nodes, edges, canvas) works from `file://` but collaboration is disabled.
:::

## Configuration for Deployment

### WebSocket URL

If you are deploying with collaboration enabled, update `config.js` to point to your WebSocket backend:

```javascript
// config.js
if (window.location.hostname === 'yourdomain.com') {
    window.NODEUI_WS_URL = 'wss://yourdomain.com/collab';
}
```

See [WebSocket Configuration](../collaboration/websocket-setup.md) for all configuration options.

### Custom Domain

No code changes are needed for custom domains. NodeUI uses relative paths for all assets. The only absolute URL is the WebSocket endpoint, which you configure in `config.js`.

## Deployment Guides

- [Cloudflare Pages](./cloudflare-pages.md) -- Recommended. Includes collaboration support with Durable Objects on the same domain.
