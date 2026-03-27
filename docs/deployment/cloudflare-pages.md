# Cloudflare Pages Deployment

Cloudflare Pages is the recommended deployment platform for NodeUI. It serves the static frontend globally via Cloudflare's CDN and supports Pages Functions, which handle the WebSocket proxy for real-time collaboration -- all on the same domain with no CORS issues.

## Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is sufficient)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) v3+ installed
- [Node.js](https://nodejs.org/) 18+
- The NodeUI repository cloned locally

## Step 1: Deploy the Durable Object Worker

The collaboration backend must be deployed before the Pages site, because the Pages Function needs to bind to it.

```bash
cd durable-objects-worker
npx wrangler deploy
```

You should see output confirming the worker and Durable Object class were deployed:

```
Uploaded nodeui-collaboration-do
Published nodeui-collaboration-do
  https://nodeui-collaboration-do.<your-account>.workers.dev
  Durable Object: CollaborationRoom
```

::: tip
This only needs to be done once. After the initial deployment, the Durable Object worker persists in your Cloudflare account. Redeploy only when you change the worker code.
:::

## Step 2: Create the Pages Project

You have two options: Git integration (automatic deploys) or direct upload.

### Option A: Git Integration (Recommended)

1. Push your NodeUI repository to GitHub or GitLab
2. Go to the [Cloudflare dashboard](https://dash.cloudflare.com) > **Workers & Pages** > **Create**
3. Select **Pages** > **Connect to Git**
4. Choose your repository
5. Configure the build settings:

| Setting | Value |
|---------|-------|
| **Framework preset** | None |
| **Build command** | (leave empty) |
| **Build output directory** | `.` (the root) |

6. Click **Save and Deploy**

Since NodeUI has no build step, Cloudflare Pages serves the files directly from the repository root.

### Option B: Direct Upload

```bash
# From the NodeUI project root
npx wrangler pages deploy . --project-name nodeui
```

## Step 3: Bind the Durable Object

The Pages Function at `functions/collab/[[path]].js` needs access to the Durable Object namespace to route WebSocket connections.

1. Go to the Cloudflare dashboard > **Workers & Pages** > your Pages project
2. Navigate to **Settings** > **Bindings**
3. Click **Add binding** > **Durable Object Namespace**
4. Configure:

| Field | Value |
|-------|-------|
| **Variable name** | `COLLABORATION_ROOMS` |
| **Durable Object namespace** | `nodeui-collaboration-do` |
| **Class** | `CollaborationRoom` |

5. Click **Save**

::: warning
After adding or changing bindings, you must trigger a new deployment for the changes to take effect. Push a commit or redeploy manually.
:::

## Step 4: Configure the WebSocket URL

If you are using the default `*.pages.dev` domain, no configuration is needed. The `Collaboration` module auto-detects Pages domains and constructs the WebSocket URL automatically.

For a custom domain, update `config.js`:

```javascript
// config.js
if (window.location.hostname === 'yourdomain.com') {
    window.NODEUI_WS_URL = 'wss://yourdomain.com/collab';
}
```

## Step 5: Add a Custom Domain (Optional)

1. In the Pages project settings, go to **Custom domains**
2. Click **Set up a custom domain**
3. Enter your domain (e.g., `nodeui.yourdomain.com`)
4. Cloudflare handles SSL automatically

## How It All Connects

After deployment, the request flow works like this:

```
Browser visits https://your-project.pages.dev
  |
  +-- Static files served from Pages CDN (index.html, src/*, etc.)
  |
  +-- User starts collaboration session
  |
  +-- Browser opens WSS to /collab/NOVA-WOLF-BLAZE
  |
  +-- Pages Function (functions/collab/[[path]].js) handles the request
  |     |
  |     +-- Extracts session ID from URL path
  |     +-- Looks up Durable Object: COLLABORATION_ROOMS.idFromName('NOVA-WOLF-BLAZE')
  |     +-- Forwards the WebSocket upgrade to the Durable Object
  |
  +-- Durable Object (CollaborationRoom) accepts the WebSocket
        |
        +-- Manages the room: join, leave, broadcast operations
        +-- Hibernates between messages to reduce costs
```

## Verifying the Deployment

### Test the static site

Open your Pages URL in a browser. You should see the NodeUI canvas with the dot grid background.

### Test the Durable Object binding

Open the browser console and check for errors. If the binding is missing, you will see:

```
Collaboration error: Durable Object binding not configured
```

### Test collaboration

1. Open NodeUI in two browser tabs
2. In the first tab, click the status indicator (bottom-left) to start a session
3. Copy the session code
4. In the second tab, use the context menu or command palette to join with the session code
5. Create a node in one tab -- it should appear in the other

## Updating the Deployment

### Frontend changes

If using Git integration, push to your connected branch. Cloudflare Pages rebuilds automatically.

For direct upload:

```bash
npx wrangler pages deploy . --project-name nodeui
```

### Durable Object changes

```bash
cd durable-objects-worker
npx wrangler deploy
```

::: tip
Durable Object updates are independent of Pages deployments. You can update the collaboration backend without redeploying the frontend, and vice versa.
:::

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Blank page after deploy | Check that build output directory is `.` (root), not a subdirectory |
| "Durable Object binding not configured" | Add the `COLLABORATION_ROOMS` binding in Pages settings and redeploy |
| WebSocket fails on custom domain | Ensure `config.js` uses `wss://` (not `ws://`) for the custom domain |
| Changes not appearing | Clear Cloudflare cache, or wait for the CDN to propagate (usually under 1 minute) |
| Collaboration works on `pages.dev` but not custom domain | Verify the custom domain DNS is proxied (orange cloud) in Cloudflare DNS settings |

## Cost Considerations

Cloudflare's free tier includes:

| Resource | Free Tier Limit |
|----------|----------------|
| Pages requests | Unlimited |
| Pages bandwidth | Unlimited |
| Workers requests | 100,000/day |
| Durable Object requests | 100,000/day |
| Durable Object duration | Hibernation minimizes this |
| Durable Object storage | 1 GB |

For most use cases, the free tier is sufficient. The hibernation-based Durable Object design keeps duration charges near zero when sessions are idle.
