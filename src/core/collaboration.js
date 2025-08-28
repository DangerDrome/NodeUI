/**
 * @fileoverview WebSocket-based collaboration module for shared graph sessions.
 * Handles both the network communication and UI components for real-time collaboration.
 */

class Collaboration {
    constructor(nodeUI) {
        this.nodeUI = nodeUI;
        this.ws = null;
        this.sessionId = null;
        this.userId = this.generateUserId();
        this.isConnected = false;
        this.connectedUsers = new Set();
        this.wsUrl = 'ws://localhost:8080'; // Default WebSocket server URL
        
        // UI elements
        this.statusIndicator = null;
        
        // Events to sync between users
        // Note: node:create is handled directly in addNode() to prevent loops
        this.syncEvents = [
            'node:update', 
            'node:moved',
            'node:resized',
            'node:delete',
            'edge:create',
            'edge:update',
            'edge:delete',
            'subgraph:update'
        ];
        
        // Track operations to prevent echo
        this.localOperations = new Set();
        this.operationTimeout = 5000; // Clear operation IDs after 5 seconds
        
        // Flag to track if we've already loaded state
        this.hasLoadedState = false;
        
        // Initialize UI
        this.createUI();
        this.bindUIEvents();
    }
    
    /**
     * Creates the UI components.
     */
    createUI() {
        // Create status indicator that shows at the bottom left
        this.statusIndicator = document.createElement('div');
        this.statusIndicator.className = 'collaboration-status-indicator';
        this.statusIndicator.innerHTML = `
            <span class="collaboration-status-indicator-dot"></span>
            <span class="collaboration-status-indicator-text">Offline</span>
        `;
        
        // Add click handler
        this.statusIndicator.addEventListener('click', () => {
            if (this.sessionId && this.isConnected) {
                // Copy session ID when connected
                navigator.clipboard.writeText(this.sessionId).then(() => {
                    // Briefly show "Copied!" feedback
                    const textEl = this.statusIndicator.querySelector('.collaboration-status-indicator-text');
                    const originalText = textEl.textContent;
                    textEl.textContent = 'Copied!';
                    setTimeout(() => {
                        textEl.textContent = originalText;
                    }, 1500);
                });
            } else {
                // Start a new session when offline
                this.startSession();
            }
        });
        
        // Add to the body for fixed positioning
        document.body.appendChild(this.statusIndicator);
    }
    
    /**
     * Binds UI event handlers.
     */
    bindUIEvents() {
        // Listen for collaboration events to update UI
        events.subscribe('collaboration:connected', (data) => {
            this.updateStatus('connected', data.sessionId);
        });
        
        events.subscribe('collaboration:disconnected', () => {
            this.updateStatus('disconnected');
        });
        
        events.subscribe('collaboration:users-updated', (data) => {
            // Could add user count to status if desired
        });
        
        events.subscribe('collaboration:error', (data) => {
            console.error('Collaboration error:', data.error);
            this.showError('Connection failed. Check if server is running.');
        });
    }
    
    /**
     * Updates the connection status display.
     */
    updateStatus(status, sessionId = null) {
        
        const indicatorDot = this.statusIndicator.querySelector('.collaboration-status-indicator-dot');
        const indicatorText = this.statusIndicator.querySelector('.collaboration-status-indicator-text');
        
        if (status === 'connected' && sessionId) {
            indicatorDot.classList.add('connected');
            indicatorText.textContent = `Session: ${sessionId}`;
            this.statusIndicator.style.cursor = 'pointer';
            this.statusIndicator.title = 'Click to copy session ID';
        } else {
            indicatorDot.classList.remove('connected');
            indicatorText.textContent = 'Offline';
            this.statusIndicator.style.cursor = 'pointer';
            this.statusIndicator.title = 'Click to start a new session';
        }
    }
    
    /**
     * Shows an error message.
     */
    showError(message) {
        console.error('Collaboration error:', message);
        alert(message);
    }
    
    /**
     * Shows dialog to join an existing session.
     */
    showJoinDialog() {
        const sessionId = prompt('Enter the session code:');
        if (sessionId && sessionId.trim()) {
            this.joinSession(sessionId.trim());
        }
    }
    
    /**
     * Generates a unique user ID for this session.
     */
    generateUserId() {
        return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Generates a session ID for a new room.
     */
    generateSessionId() {
        return Math.random().toString(36).substr(2, 9).toUpperCase();
    }
    
    /**
     * Starts a new shared session.
     */
    startSession() {
        this.sessionId = this.generateSessionId();
        this.connect();
        return this.sessionId;
    }
    
    /**
     * Joins an existing session.
     * @param {string} sessionId - The session ID to join
     */
    joinSession(sessionId) {
        this.sessionId = sessionId.toUpperCase();
        this.connect();
    }
    
    /**
     * Leaves the current session.
     */
    leaveSession() {
        this.disconnect();
    }
    
    /**
     * Connects to the WebSocket server.
     */
    connect() {
        if (this.ws) {
            this.disconnect();
        }
        
        try {
            this.ws = new WebSocket(this.wsUrl);
            
            this.ws.onopen = () => {
                this.isConnected = true;
                
                // Join the session room
                this.send({
                    type: 'join',
                    sessionId: this.sessionId,
                    userId: this.userId
                });
                
                // Subscribe to sync events
                this.subscribeToEvents();
                
                // Request current state from other users
                this.send({
                    type: 'request-state',
                    sessionId: this.sessionId,
                    userId: this.userId
                });
                
                events.publish('collaboration:connected', { sessionId: this.sessionId });
            };
            
            this.ws.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                events.publish('collaboration:error', { error });
            };
            
            this.ws.onclose = () => {
                this.isConnected = false;
                this.unsubscribeFromEvents();
                events.publish('collaboration:disconnected');
                
                // Attempt to reconnect after 3 seconds if we didn't disconnect intentionally
                if (this.sessionId) {
                    setTimeout(() => this.connect(), 3000);
                }
            };
            
        } catch (error) {
            console.error('Failed to connect to collaboration server:', error);
            events.publish('collaboration:error', { error });
        }
    }
    
    /**
     * Disconnects from the WebSocket server.
     */
    disconnect() {
        this.sessionId = null;
        this.hasLoadedState = false;
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connectedUsers.clear();
        this.unsubscribeFromEvents();
    }
    
    /**
     * Sends a message through the WebSocket connection.
     * @param {object} data - The data to send
     */
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
    
    /**
     * Handles incoming WebSocket messages.
     * @param {object} message - The received message
     */
    handleMessage(message) {
        switch (message.type) {
            case 'user-joined':
                this.connectedUsers.add(message.userId);
                events.publish('collaboration:user-joined', { userId: message.userId });
                break;
                
            case 'user-left':
                this.connectedUsers.delete(message.userId);
                events.publish('collaboration:user-left', { userId: message.userId });
                break;
                
            case 'users-list':
                this.connectedUsers = new Set(message.users);
                events.publish('collaboration:users-updated', { users: Array.from(this.connectedUsers) });
                break;
                
            case 'operation':
                this.handleRemoteOperation(message);
                break;
                
            case 'request-state':
                // Only respond if we're not the requester and we have content
                if (message.userId !== this.userId && (this.nodeUI.nodes.size > 0 || this.nodeUI.edges.size > 0)) {
                    // Check if they're requesting a specific graph context
                    if (message.targetGraphId && message.targetGraphId !== this.nodeUI.graphContext.currentGraphId) {
                        // They want a different graph context, don't respond
                        return;
                    }
                    // Add a small random delay to reduce simultaneous responses
                    const delay = Math.random() * 100;
                    setTimeout(() => {
                        console.log('Sending state to user after', delay, 'ms delay');
                        this.sendCurrentState();
                    }, delay);
                }
                break;
                
            case 'state-response':
                // Only load state from users in the same context
                if (message.graphContext && message.graphContext !== this.nodeUI.graphContext.currentGraphId) {
                    console.log('Ignoring state from different context:', message.graphContext);
                    return;
                }
                
                // Only load the first state response to avoid conflicts
                if (!this.hasLoadedState) {
                    this.hasLoadedState = true;
                    console.log('Loading state from first responder');
                    this.loadRemoteState(message.state);
                } else {
                    console.log('Ignoring additional state response');
                }
                break;
        }
    }
    
    /**
     * Subscribes to local events for syncing.
     */
    subscribeToEvents() {
        this.eventHandlers = {};
        
        this.syncEvents.forEach(eventName => {
            this.eventHandlers[eventName] = events.subscribe(eventName, (data) => {
                this.handleLocalEvent(eventName, data);
            });
        });
    }
    
    /**
     * Unsubscribes from local events.
     */
    unsubscribeFromEvents() {
        Object.values(this.eventHandlers || {}).forEach(handler => {
            if (handler && handler.unsubscribe) {
                handler.unsubscribe();
            }
        });
        this.eventHandlers = {};
    }
    
    /**
     * Handles local events and broadcasts them to other users.
     * @param {string} eventName - The event name
     * @param {object} data - The event data
     */
    handleLocalEvent(eventName, data) {
        
        if (!this.isConnected) {
            return;
        }
        
        
        // Handle both object and primitive data types
        const isObject = data && typeof data === 'object';
        
        // Check if this event has an operation ID already (to prevent loops)
        if (isObject && data._operationId && this.localOperations.has(data._operationId)) {
            return; // Skip events we've already processed
        }
        
        // For delete events with primitive data, check if we recently processed this exact delete
        if ((eventName === 'node:delete' || eventName === 'edge:delete') && typeof data === 'string') {
            const recentKey = `${eventName}:${data}`;
            if (this.localOperations.has(recentKey)) {
                return; // Skip recently processed deletes
            }
            // Track this delete for a short time to prevent loops
            this.localOperations.add(recentKey);
            setTimeout(() => this.localOperations.delete(recentKey), 1000);
        }
        
        // Generate operation ID
        const operationId = (isObject && data._operationId) || `${this.userId}_${Date.now()}_${Math.random()}`;
        
        // Track this operation to prevent echo
        this.localOperations.add(operationId);
        setTimeout(() => this.localOperations.delete(operationId), this.operationTimeout);
        
        // Handle both object and primitive data types
        const eventData = data;
        
        const message = {
            type: 'operation',
            sessionId: this.sessionId,
            userId: this.userId,
            operationId: operationId,
            eventName: eventName,
            data: eventData,
            timestamp: Date.now(),
            graphContext: this.nodeUI.graphContext.currentGraphId
        };
        
        
        // Send the operation to other users
        this.send(message);
        
    }
    
    /**
     * Handles remote operations from other users.
     * @param {object} message - The operation message
     */
    handleRemoteOperation(message) {
        
        // Skip if this is our own operation (echo prevention)
        if (this.localOperations.has(message.operationId) || message.userId === this.userId) {
            return;
        }
        
        // Skip if the sender is in a different graph context (except for subgraph:update)
        if (message.graphContext && message.graphContext !== this.nodeUI.graphContext.currentGraphId) {
            // Special handling for subgraph updates - these should cross contexts
            if (message.eventName === 'subgraph:update') {
                // Let it through - the handler will check if we should process it
            } else {
                return; // Ignore other operations from users in different contexts
            }
        }
        
        
        // Track this operation to prevent re-processing
        this.localOperations.add(message.operationId);
        setTimeout(() => this.localOperations.delete(message.operationId), this.operationTimeout);
        
        // Apply the operation locally
        // For primitive values, we can't attach the operation ID, so we need to handle them differently
        if (message.eventName === 'node:delete' || message.eventName === 'edge:delete') {
            // For delete events, temporarily track the operation to prevent re-broadcasting
            const tempData = { _operationId: message.operationId, id: message.data };
            this.localOperations.add(tempData._operationId);
            events.publish(message.eventName, message.data);
            // The operation ID is already tracked above, no need to track again
        } else {
            const isObject = message.data && typeof message.data === 'object';
            const dataWithOperationId = isObject 
                ? { ...message.data, _operationId: message.operationId }
                : message.data;
            events.publish(message.eventName, dataWithOperationId);
        }
        
    }
    
    /**
     * Sends the current graph state to other users.
     */
    sendCurrentState() {
        const state = {
            nodes: Array.from(this.nodeUI.nodes.entries()).map(([id, node]) => ({
                id: id,
                x: node.x,
                y: node.y,
                width: node.width,
                height: node.height,
                title: node.title,
                content: node.content,
                type: node.type || node.constructor.name,
                color: node.color,
                isPinned: node.isPinned,
                // Add type-specific data
                ...(node.containedNodeIds && { containedNodeIds: Array.from(node.containedNodeIds) }),
                ...(node.internalGraph && { internalGraph: node.internalGraph }),
                ...(node.subgraphId && { subgraphId: node.subgraphId })
            })),
            edges: Array.from(this.nodeUI.edges.entries()).map(([id, edge]) => ({
                id: id,
                startNodeId: edge.startNodeId,
                endNodeId: edge.endNodeId,
                startHandleId: edge.startHandleId,
                endHandleId: edge.endHandleId,
                type: edge.type,
                label: edge.label,
                routingPoints: edge.routingPoints
            }))
        };
        
        this.send({
            type: 'state-response',
            sessionId: this.sessionId,
            userId: this.userId,
            state: state,
            graphContext: this.nodeUI.graphContext.currentGraphId
        });
    }
    
    /**
     * Loads a remote graph state.
     * @param {object} state - The graph state to load
     */
    loadRemoteState(state) {
        // Temporarily disable broadcasting to prevent echo
        const wasConnected = this.isConnected;
        this.isConnected = false;
        
        // Clear current view
        this.nodeUI.clearAll();
        
        // Load nodes
        if (state.nodes) {
            state.nodes.forEach(nodeData => {
                // Mark with _operationId to prevent re-broadcasting
                const nodeDataWithOperationId = {
                    ...nodeData,
                    _operationId: `remote_state_${Date.now()}_${Math.random()}`
                };
                events.publish('node:create', nodeDataWithOperationId);
            });
        }
        
        // Load edges (after nodes are created)
        if (state.edges) {
            // Use requestAnimationFrame to ensure nodes are rendered before edges
            requestAnimationFrame(() => {
                state.edges.forEach(edgeData => {
                    // Mark with _operationId to prevent re-broadcasting
                    const edgeDataWithOperationId = {
                        ...edgeData,
                        _operationId: `remote_state_${Date.now()}_${Math.random()}`
                    };
                    events.publish('edge:create', edgeDataWithOperationId);
                });
            });
        }
        
        // Re-enable broadcasting
        this.isConnected = wasConnected;
    }
    
    /**
     * Gets the current session info.
     * @returns {object} Session information
     */
    getSessionInfo() {
        return {
            sessionId: this.sessionId,
            userId: this.userId,
            isConnected: this.isConnected,
            connectedUsers: Array.from(this.connectedUsers),
            userCount: this.connectedUsers.size + 1 // Include self
        };
    }
}

// Attach to window for global access
window.Collaboration = Collaboration;