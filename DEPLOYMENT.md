# NodeUI Deployment Guide

## Static Site Deployment (Cloudflare Pages, GitHub Pages, etc.)

NodeUI can be deployed to any static hosting service like Cloudflare Pages. However, the collaboration feature requires a separate WebSocket server.

## Collaboration Server Deployment

Since static hosting services don't support WebSocket servers, you need to deploy the collaboration server separately. Here are several options:

### Option 0: Cloudflare Workers (Recommended for Cloudflare Pages)

Since you're already using Cloudflare Pages, Cloudflare Workers is the most integrated solution:

1. Install Wrangler CLI:
```bash
npm install -g wrangler
```

2. Deploy the Worker:
```bash
cd server
wrangler publish
```

3. Your WebSocket server will be available at:
```
wss://nodeui-collaboration.YOUR-SUBDOMAIN.workers.dev
```

4. Update `config.js`:
```javascript
window.NODEUI_WS_URL = 'wss://nodeui-collaboration.YOUR-SUBDOMAIN.workers.dev';
```

**Advantages:**
- Same platform as your static site
- Global edge network
- No separate billing
- Automatic scaling
- Built-in DDoS protection

**Note:** The Durable Objects version (`cloudflare-durable-objects.js`) provides proper session isolation and state management.

### Option 1: Heroku (Free Tier Available)

1. Create a new Heroku app for the WebSocket server
2. Deploy the `server` directory:

```bash
cd server
git init
heroku create nodeui-collab-server
git add .
git commit -m "Initial commit"
git push heroku main
```

3. Update `config.js` with your Heroku URL:
```javascript
window.NODEUI_WS_URL = 'wss://nodeui-collab-server.herokuapp.com';
```

### Option 2: Railway.app

1. Sign up at [Railway.app](https://railway.app)
2. Create a new project from the `server` directory
3. Railway will automatically detect it's a Node.js app
4. Get your deployment URL and update `config.js`:
```javascript
window.NODEUI_WS_URL = 'wss://your-app.railway.app';
```

### Option 3: Render.com

1. Sign up at [Render.com](https://render.com)
2. Create a new Web Service
3. Connect your GitHub repo and set root directory to `server`
4. Choose the free tier
5. Update `config.js` with your Render URL:
```javascript
window.NODEUI_WS_URL = 'wss://your-app.onrender.com';
```

### Option 4: VPS (DigitalOcean, Linode, AWS, etc.)

For production use, deploy to a VPS:

1. Set up a VPS with Node.js
2. Clone the repository
3. Install PM2 for process management:
```bash
npm install -g pm2
cd server
npm install
pm2 start index.js --name nodeui-collab
pm2 save
pm2 startup
```

4. Set up Nginx as a reverse proxy with SSL:
```nginx
server {
    listen 443 ssl;
    server_name collab.nodeui.io;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

5. Update `config.js`:
```javascript
window.NODEUI_WS_URL = 'wss://collab.nodeui.io';
```

### Option 5: Glitch.com (Free, Always-On)

1. Go to [Glitch.com](https://glitch.com)
2. Create a new project
3. Upload the `server` directory contents
4. Your WebSocket server will be available at `wss://your-project.glitch.me`
5. Update `config.js` accordingly

## Configuration Methods

You can configure the WebSocket server URL in three ways:

### 1. Static Configuration (Recommended for Production)

Edit `config.js` before deployment:
```javascript
window.NODEUI_WS_URL = 'wss://your-websocket-server.com';
```

### 2. URL Parameter (Good for Testing)

Users can specify a custom server via URL parameter:
```
https://nodeui.io/?ws=wss://custom-server.com
```

### 3. Local Development

When running locally, it defaults to `ws://localhost:8080`

## CORS Considerations

The WebSocket server already includes CORS headers for the handshake. No additional configuration needed.

## Security Considerations

1. **Use WSS (WebSocket Secure) in Production**: Always use `wss://` instead of `ws://` for encrypted connections
2. **Rate Limiting**: Consider adding rate limiting to prevent abuse
3. **Authentication**: For private deployments, add authentication to the WebSocket server
4. **Monitoring**: Set up monitoring to ensure server uptime

## Testing Your Deployment

1. Deploy your WebSocket server using one of the methods above
2. Update `config.js` with your server URL
3. Deploy NodeUI to Cloudflare Pages
4. Test collaboration by:
   - Opening NodeUI in multiple browsers/devices
   - Starting a session in one browser
   - Joining the same session in another browser
   - Verify that changes sync in real-time

## Troubleshooting

### "No server running" Error
- Verify your WebSocket server is actually running
- Check the browser console for connection errors
- Ensure the URL in `config.js` is correct
- Make sure to use `wss://` for HTTPS sites

### Connection Refused
- Check firewall settings on your server
- Verify the port is open (default 8080)
- Ensure SSL certificates are valid for WSS connections

### Mixed Content Error
- If NodeUI is served over HTTPS, WebSocket must use WSS
- Update the URL from `ws://` to `wss://`