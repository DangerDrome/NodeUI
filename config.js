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

// For nodeui.io production deployment:
if (window.location.hostname === 'nodeui.io') {
    // Using Cloudflare Pages Functions - same domain!
    window.NODEUI_WS_URL = 'wss://nodeui.io/collab';
}

// For development, it will default to ws://localhost:8080