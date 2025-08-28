# Collaboration Server Manager

A simple bash script to manage the NodeUI collaboration WebSocket server.

## Usage

```bash
./collaboration-server.sh {start|stop|restart|status}
```

## Commands

- **start**: Starts the collaboration server on port 8080
- **stop**: Stops the running server gracefully
- **restart**: Stops and restarts the server
- **status**: Shows current server status and recent logs

## Examples

```bash
# Start the server
./collaboration-server.sh start

# Check server status
./collaboration-server.sh status

# Restart the server
./collaboration-server.sh restart

# Stop the server
./collaboration-server.sh stop
```

## Features

- Automatic dependency installation (npm install)
- PID tracking to prevent multiple instances
- Port conflict detection
- Graceful shutdown with fallback to force kill
- Log file management (`server/server.log`)
- Colored output for better readability

## Files

- **PID file**: `server/.server.pid` (tracks running process)
- **Log file**: `server/server.log` (server output)

## Requirements

- Node.js installed
- Bash shell
- `lsof` command (for port checking)