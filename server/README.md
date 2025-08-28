# NodeUI Collaboration Server

Simple WebSocket server for enabling real-time collaborative editing in NodeUI.

## Installation

```bash
cd server
npm install
```

## Quick Start

### Using the Server Manager Script (Recommended)

```bash
./collaboration-server.sh start    # Start the server
./collaboration-server.sh status   # Check server status
./collaboration-server.sh restart  # Restart the server
./collaboration-server.sh stop     # Stop the server
```

### Manual Start

```bash
npm start
```

The server will start on port 8080 by default.

## Using Collaboration in NodeUI

### 1. Start the Server

Ensure the WebSocket server is running (see above).

### 2. Access Collaboration Features

In NodeUI, press **Shift+C** to toggle the collaboration panel (top-right corner).

### 3. Start or Join a Session

**To start a new session:**
1. Click "Start New Session"
2. Share the session code with collaborators
3. Or copy the share link and send it to others

**To join an existing session:**
1. Click "Join Session"
2. Enter the session code
3. Or open a shared link directly

## Features

- **Real-time Synchronization**: All graph operations (creating, moving, deleting nodes/edges) are synchronized across all clients
- **Session Management**: Easy-to-share session codes for collaboration
- **Automatic State Sync**: New users receive the current graph state when joining
- **User Count Display**: See how many users are in the session
- **Automatic Reconnection**: Clients automatically reconnect on disconnect
- **Share Links**: Direct links with session parameter for easy joining

## Server Manager Script

The `collaboration-server.sh` script provides additional features:

- **Automatic dependency installation** (npm install)
- **PID tracking** to prevent multiple instances
- **Port conflict detection**
- **Graceful shutdown** with fallback to force kill
- **Log file management** (`server.log`)
- **Colored output** for better readability

### Script Files

- **PID file**: `server/.server.pid` (tracks running process)
- **Log file**: `server/server.log` (server output)

## How it Works

### Architecture

1. **Client Module** (`src/core/collaboration.js`): Handles WebSocket connection and event synchronization
2. **UI Module** (`src/core/collaborationUI.js`): Provides the user interface
3. **Server** (`server/index.js`): WebSocket relay server that manages session rooms

### Technical Details

- The server maintains session rooms identified by unique session IDs
- Clients join a session and all operations are broadcast to other clients in the same room
- No data is persisted - the server only relays messages between clients
- When a new client joins, they request and receive the current state from existing clients
- Each operation includes an operation ID to prevent broadcast loops

## Configuration

To change the port, edit `index.js`:

```javascript
const wss = new WebSocket.Server({ port: 8080 });
```

## Keyboard Shortcuts

- **Shift+C**: Toggle collaboration panel

## Troubleshooting

### Connection Failed Error
- Ensure the WebSocket server is running
- Check that port 8080 is not blocked by firewall
- If using a custom server URL, update it in `src/core/collaboration.js`

### Not Seeing Changes
- Check the connection status indicator (should be green)
- Ensure all users are in the same session (check session code)
- Try refreshing the page and rejoining the session

### Port Already in Use
- Another process is using port 8080
- Use `collaboration-server.sh stop` to stop any running instances
- Check for other processes: `lsof -i :8080`

## Current Limitations

- **No Persistence**: Graphs are only stored in memory during the session
- **No Authentication**: Anyone with the session code can join
- **Basic Conflict Resolution**: Last-write-wins approach
- **Server Dependency**: Collaboration requires the server to be running

## For Production Use

Consider implementing:

- **HTTPS/WSS Support**: Use SSL certificates for secure connections
- **Authentication**: Add user authentication and session validation
- **Persistent Storage**: Save session data to database
- **Rate Limiting**: Prevent abuse and DOS attacks
- **Process Manager**: Use PM2 or similar for production deployment
- **Health Checks**: Add monitoring and health check endpoints
- **Load Balancing**: Scale horizontally with multiple server instances
- **Redis**: Use Redis for session storage across multiple servers

## Deployment Options

Since NodeUI can be hosted on static sites (like Cloudflare Pages), the WebSocket server needs to be deployed separately. Here are quick deployment options:

### Heroku (Free Tier)
```bash
cd server
git init
heroku create your-app-name
git add .
git commit -m "Deploy"
git push heroku main
```

### Railway.app
- Push to GitHub
- Connect repo on Railway
- Auto-deploys from `server` directory

### Render.com
- Create Web Service
- Connect GitHub repo
- Set root directory to `server`

### Glitch.com
- Create new project
- Upload server files
- Always-on free hosting

See [DEPLOYMENT.md](../DEPLOYMENT.md) for detailed instructions.

## Future Enhancements

Possible improvements:

- User cursors and selection visualization
- Conflict resolution with operational transforms (OT) or CRDTs
- User permissions and access control
- Session recording and playback
- Voice/video chat integration
- Presence indicators showing user activity
- Collaborative undo/redo
- Session templates and sharing presets

## Requirements

- Node.js (v14 or higher)
- npm
- Bash shell (for the management script)
- `lsof` command (for port checking in the script)