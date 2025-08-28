# NodeUI Collaboration Server

Simple WebSocket server for enabling shared sessions in NodeUI.

## Installation

```bash
cd server
npm install
```

## Running the Server

```bash
npm start
```

The server will start on port 8080 by default.

## How it Works

- The server maintains session rooms identified by session IDs
- Clients can join a session and all graph operations are broadcast to other clients in the same session
- No data is persisted - the server only relays messages between clients
- When a new client joins, they can request the current state from existing clients

## Configuration

To change the port, edit `index.js`:

```javascript
const wss = new WebSocket.Server({ port: 8080 });
```

## For Production

For production use, consider:
- Adding HTTPS/WSS support
- Implementing authentication
- Adding rate limiting
- Using a process manager like PM2
- Adding health checks and monitoring