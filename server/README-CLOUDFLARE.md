# Deploying NodeUI Collaboration to Cloudflare Workers

This guide explains how to deploy the NodeUI collaboration server to Cloudflare Workers, which is the recommended approach when hosting NodeUI on Cloudflare Pages.

## Prerequisites

- Cloudflare account
- Node.js and npm installed
- Wrangler CLI (`npm install -g wrangler`)

## Quick Start

1. **Login to Cloudflare:**
```bash
wrangler login
```

2. **Deploy the Worker:**
```bash
cd server
wrangler publish
```

3. **Note your Worker URL:**
After deployment, you'll see something like:
```
Published to https://nodeui-collaboration.YOUR-SUBDOMAIN.workers.dev
```

4. **Update NodeUI Configuration:**
Edit `config.js` in the root directory:
```javascript
window.NODEUI_WS_URL = 'wss://nodeui-collaboration.YOUR-SUBDOMAIN.workers.dev';
```

5. **Commit and Push:**
Push your changes to trigger a Cloudflare Pages rebuild.

## Architecture Options

### Basic Worker (Simple, Limited)

The `cloudflare-worker.js` provides a basic WebSocket relay but has limitations:
- No persistent state between connections
- Sessions are isolated per connection
- Best for testing or very simple use cases

### Durable Objects (Recommended)

The `cloudflare-durable-objects.js` provides full functionality:
- Persistent session state
- Proper user management per session  
- Broadcast capabilities
- Scales automatically

To use Durable Objects, ensure `wrangler.toml` is configured correctly:
```toml
name = "nodeui-collaboration"
main = "cloudflare-durable-objects.js"
compatibility_date = "2023-05-18"

[[durable_objects.bindings]]
name = "COLLABORATION_SESSIONS"
class_name = "CollaborationSession"
```

## Pricing

- **Workers Free Plan:** 100,000 requests/day
- **Durable Objects:** $0.15/GB-month for storage + request costs
- For most collaboration use cases, the free tier is sufficient

## Custom Domain (Optional)

To use a custom domain like `collab.nodeui.io`:

1. Add to `wrangler.toml`:
```toml
routes = [
  { pattern = "collab.nodeui.io/*", zone_id = "YOUR-ZONE-ID" }
]
```

2. Set up DNS record in Cloudflare dashboard

3. Update `config.js`:
```javascript
window.NODEUI_WS_URL = 'wss://collab.nodeui.io';
```

## Development

For local development:
```bash
cd server
wrangler dev
```

This starts a local server at `ws://localhost:8787`

## Monitoring

View logs and metrics in the Cloudflare dashboard:
1. Go to Workers & Pages
2. Select your worker
3. View Analytics and Logs tabs

## Troubleshooting

### "WebSocket connection failed"
- Ensure the Worker is deployed successfully
- Check that you're using `wss://` (not `ws://`)
- Verify the URL in `config.js` is correct

### "Script not found"
- Make sure you're in the `server` directory when running `wrangler publish`
- Check that `wrangler.toml` points to the correct main file

### Session Issues
- Durable Objects may take a moment to initialize on first use
- Check Worker logs for any errors

## Security Considerations

1. **Rate Limiting:** Consider adding rate limiting for production
2. **Authentication:** Add auth headers if needed for private deployments
3. **CORS:** Already handled in the Worker code

## Advantages of Cloudflare Workers

- **Global Edge Network:** Low latency worldwide
- **Integrated with Cloudflare Pages:** Same platform, easy management
- **Automatic Scaling:** Handles traffic spikes automatically
- **Built-in Security:** DDoS protection, SSL included
- **Cost Effective:** Free tier is generous for most use cases