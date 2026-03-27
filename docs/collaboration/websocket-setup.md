# WebSocket Configuration

The `Collaboration` module determines where to connect based on a priority chain of configuration options. You configure the WebSocket URL in `config.js` or through URL parameters.

## URL Resolution Order

When the `Collaboration` module initializes, it checks these sources in order and uses the first one that returns a value:

1. **`window.NODEUI_WS_URL`** -- Global variable set in `config.js`
2. **`?ws=` URL parameter** -- Query string override
3. **Cloudflare Pages auto-detection** -- If the hostname contains `pages.dev`
4. **`file://` protocol check** -- Logs a warning and returns `null` (collaboration disabled)
5. **Falls back to `null`** -- Collaboration is not available

## Configuring `config.js`

The `config.js` file at the project root is the primary configuration point. Set `window.NODEUI_WS_URL` to your WebSocket server URL:

```javascript
// config.js

// For a custom WebSocket server:
window.NODEUI_WS_URL = 'wss://your-server.example.com';

// For Cloudflare Pages with same-domain Functions:
if (window.location.hostname === 'yourdomain.com') {
    window.NODEUI_WS_URL = 'wss://yourdomain.com/collab';
}
```

The default `config.js` shipped with NodeUI configures `wss://nodeui.io/collab` for the production deployment on `nodeui.io`:

```javascript
if (window.location.hostname === 'nodeui.io') {
    window.NODEUI_WS_URL = 'wss://nodeui.io/collab';
}
```

::: warning
The protocol must match your hosting. Use `wss://` for HTTPS sites and `ws://` for HTTP. Mixed content (WSS on HTTP or WS on HTTPS) will be blocked by the browser.
:::

## URL Parameter Override

For testing or ad-hoc connections, pass the WebSocket URL as a query parameter:

```
https://yourdomain.com/?ws=wss://alternate-server.example.com
```

This is useful for:
- Testing a staging collaboration server against a production frontend
- Connecting to a teammate's local development server
- Debugging with a specific Durable Object worker URL

## Cloudflare Pages Auto-Detection

If your site is hosted on Cloudflare Pages (any `*.pages.dev` domain), the module automatically constructs the WebSocket URL from the current host:

```javascript
// Automatic for *.pages.dev domains:
// wss://your-project.pages.dev/collab/{SESSION_ID}
```

This works because Cloudflare Pages Functions handle the `/collab/*` route and forward WebSocket upgrades to the Durable Object. No `config.js` change is needed for Pages deployments.

## How the URL Is Used

When connecting, the `Collaboration` module appends the session ID to the URL path:

```javascript
// If wsUrl is 'wss://nodeui.io/collab'
// and sessionId is 'NOVA-WOLF-BLAZE'
// the actual connection URL is:
// wss://nodeui.io/collab/NOVA-WOLF-BLAZE
```

This path-based routing is how the Cloudflare Pages Function determines which Durable Object room to connect to. The session ID in the URL path maps to a unique Durable Object instance.

## Local Development

When opening NodeUI from a local web server (not `file://`), and no `window.NODEUI_WS_URL` is set, collaboration returns `null` and is disabled. To enable it locally, you have two options:

**Option 1: Point to a remote worker**

```javascript
// config.js
window.NODEUI_WS_URL = 'wss://your-deployed-worker.workers.dev';
```

**Option 2: Use a URL parameter**

```
http://localhost:8080/?ws=wss://your-deployed-worker.workers.dev
```

::: tip
You cannot run the Durable Objects backend locally with `wrangler dev` in the same way as a standard Worker, because Durable Objects require the Cloudflare runtime. For local development, deploy the worker to Cloudflare and point your local frontend at it.
:::

## Configuration Reference

| Setting | Location | Example |
|---------|----------|---------|
| Production URL | `config.js` | `window.NODEUI_WS_URL = 'wss://nodeui.io/collab'` |
| Per-domain config | `config.js` | `if (hostname === 'yourdomain.com') { ... }` |
| Ad-hoc override | URL param | `?ws=wss://alternate.example.com` |
| Pages auto-detect | Automatic | Enabled on any `*.pages.dev` hostname |
