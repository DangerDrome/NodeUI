# NodeUI Collaboration Feature

This guide explains how to use the shared session feature in NodeUI to collaborate on graphs in real-time with other users.

## Quick Start

### 1. Start the WebSocket Server

First, start the collaboration server:

```bash
cd server
npm install
npm start
```

The server will run on port 8080 by default.

### 2. Open NodeUI

Open your NodeUI application in a web browser (file:// or http://).

### 3. Access Collaboration Panel

Press **Shift+C** to toggle the collaboration panel (top-right corner).

### 4. Start or Join a Session

**To start a new session:**
1. Click "Start New Session"
2. Share the session code with collaborators
3. Or copy the share link and send it to others

**To join an existing session:**
1. Click "Join Session"
2. Enter the session code
3. Or open a shared link directly

## How It Works

- All graph operations (creating, moving, deleting nodes/edges) are synchronized in real-time
- Each user sees the same graph state
- Changes are broadcast through the WebSocket server to all connected clients
- When a new user joins, they receive the current graph state from existing users

## Keyboard Shortcuts

- **Shift+C**: Toggle collaboration panel

## Features

- Real-time synchronization of all graph operations
- Session codes for easy sharing
- User count display
- Automatic reconnection on disconnect
- Share links with session parameter

## Technical Details

The collaboration system consists of:

1. **Client Module** (`src/core/collaboration.js`): Handles WebSocket connection and event synchronization
2. **UI Module** (`src/core/collaborationUI.js`): Provides the user interface
3. **Server** (`server/index.js`): Simple WebSocket relay server

## Limitations

- No persistence - graphs are only stored in memory during the session
- No authentication - anyone with the session code can join
- Basic conflict resolution (last-write-wins)
- Server must be running for collaboration to work

## Troubleshooting

**Connection Failed Error:**
- Ensure the WebSocket server is running (`npm start` in server directory)
- Check that port 8080 is not blocked
- If using a custom server URL, update it in `src/core/collaboration.js`

**Not Seeing Changes:**
- Check the connection status indicator (should be green)
- Ensure all users are in the same session
- Try refreshing the page and rejoining

## Future Enhancements

Possible improvements for production use:
- User authentication
- Persistent storage
- User cursors and selection visualization
- Conflict resolution with operational transforms
- SSL/WSS support for secure connections
- User permissions and access control