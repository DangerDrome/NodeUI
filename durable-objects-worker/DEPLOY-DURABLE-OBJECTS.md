# WebSocket Collaboration with Cloudflare Pages

This guide enables real-time collaboration on nodeui.io using Cloudflare Pages Functions and Durable Objects (FREE tier).

## Step 1: Deploy the Durable Object Class

```bash
cd durable-objects-worker
npm install -g wrangler  # if not already installed
wrangler login
wrangler deploy
```

This creates the `CollaborationRoom` class in your Cloudflare account.

## Step 2: Configure Pages Binding

1. Go to Cloudflare Dashboard → Pages → nodeui → Settings
2. Navigate to Functions → Durable Objects bindings
3. Add binding:
   - Variable name: `COLLABORATION_ROOMS`
   - Durable Object namespace: `CollaborationRoom` (select from dropdown)
   - Save

## Step 3: Add Functions Directory

Create the Pages Function that will use the Durable Object:

```bash
mkdir -p functions/collab
```

Then add the WebSocket handler file (provided after DO deployment).

## Step 4: Deploy

```bash
git add .
git commit -m "Add WebSocket collaboration"
git push
```

## That's it!

Your collaboration endpoint will be available at:
```
wss://nodeui.io/collab/SESSION_ID
```

## Testing

1. Open nodeui.io in two browsers
2. Press Shift+C for collaboration panel
3. Start session in one, join in the other

## Notes

- The Durable Object must be deployed BEFORE you can select it in Pages
- This uses the FREE Durable Objects binding in Pages
- No ongoing maintenance required after setup