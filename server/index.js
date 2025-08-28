/**
 * Simple WebSocket server for NodeUI collaboration
 * Handles room-based message broadcasting for shared graph sessions
 */

const WebSocket = require('ws');

// Create WebSocket server on port 8080
const wss = new WebSocket.Server({ port: 8080 });

// Store session rooms
const sessions = new Map(); // sessionId -> Set of client objects

console.log('NodeUI collaboration server started on port 8080');

// Handle new client connections
wss.on('connection', (ws) => {
    let currentSession = null;
    let userId = null;
    
    console.log('New client connected');
    
    // Handle messages from client
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            console.log(`Received message from client ${userId}: ${message.type}`, message);
            
            switch (message.type) {
                case 'join':
                    // Leave current session if any
                    if (currentSession) {
                        leaveSession(currentSession, ws, userId);
                    }
                    
                    // Join new session
                    currentSession = message.sessionId;
                    userId = message.userId;
                    joinSession(currentSession, ws, userId);
                    break;
                    
                case 'operation':
                    console.log(`Broadcasting operation from ${message.userId} in session ${currentSession}:`, message.eventName);
                    // Broadcast to all clients in the same session except sender
                    broadcastToSession(currentSession, message, ws);
                    break;
                    
                case 'request-state':  // Fixed: was 'state-request'
                case 'state-response':
                    // Broadcast to all clients in the same session except sender
                    broadcastToSession(currentSession, message, ws);
                    break;
                    
                default:
                    console.log('Unknown message type:', message.type);
            }
            
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });
    
    // Handle client disconnect
    ws.on('close', () => {
        console.log('Client disconnected');
        if (currentSession) {
            leaveSession(currentSession, ws, userId);
        }
    });
    
    // Handle errors
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

/**
 * Add a client to a session
 */
function joinSession(sessionId, client, userId) {
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, new Set());
        console.log(`Created new session: ${sessionId}`);
    }
    
    const session = sessions.get(sessionId);
    
    // Store client info
    client.sessionId = sessionId;
    client.userId = userId;
    
    session.add(client);
    console.log(`User ${userId} joined session ${sessionId}. Total users: ${session.size}`);
    
    // Send current users list to the new client
    const users = Array.from(session).map(c => c.userId).filter(id => id !== userId);
    client.send(JSON.stringify({
        type: 'users-list',
        users: users
    }));
    
    // Notify other clients about the new user
    broadcastToSession(sessionId, {
        type: 'user-joined',
        userId: userId
    }, client);
}

/**
 * Remove a client from a session
 */
function leaveSession(sessionId, client, userId) {
    const session = sessions.get(sessionId);
    if (session) {
        session.delete(client);
        console.log(`User ${userId} left session ${sessionId}. Remaining users: ${session.size}`);
        
        // Clean up empty sessions
        if (session.size === 0) {
            sessions.delete(sessionId);
            console.log(`Deleted empty session: ${sessionId}`);
        } else {
            // Notify other clients about the user leaving
            broadcastToSession(sessionId, {
                type: 'user-left',
                userId: userId
            }, client);
        }
    }
}

/**
 * Broadcast a message to all clients in a session except the sender
 */
function broadcastToSession(sessionId, message, sender) {
    const session = sessions.get(sessionId);
    if (session) {
        const messageStr = JSON.stringify(message);
        let broadcastCount = 0;
        session.forEach(client => {
            if (client !== sender && client.readyState === WebSocket.OPEN) {
                console.log(`Broadcasting to client ${client.userId} in session ${sessionId}`);
                client.send(messageStr);
                broadcastCount++;
            }
        });
        console.log(`Broadcast completed. Sent to ${broadcastCount} clients in session ${sessionId}`);
    } else {
        console.log(`No session found for sessionId: ${sessionId}`);
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    wss.close(() => {
        process.exit(0);
    });
});