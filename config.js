/**
 * NodeUI Configuration
 * 
 * This file can be used to configure various aspects of NodeUI,
 * including the collaboration WebSocket server URL.
 */

// For production deployment, set your WebSocket server URL here
// Examples:
// - window.NODEUI_WS_URL = 'wss://nodeui-collab.herokuapp.com';
// - window.NODEUI_WS_URL = 'wss://collab.nodeui.io';
// - window.NODEUI_WS_URL = 'wss://your-server.com:8080';

// Uncomment and modify the line below to set your production WebSocket server:
// window.NODEUI_WS_URL = 'wss://your-websocket-server.com';

// For production deployment:
// Connect directly to the Durable Objects Worker for collaboration
if (window.location.hostname === 'app.nodeui.io' || window.location.hostname === 'nodeui.io') {
    window.NODEUI_WS_URL = 'wss://nodeui-collaboration-do.danger-ltd.workers.dev';
}

// For development, it will default to ws://localhost:8080