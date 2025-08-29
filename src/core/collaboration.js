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
        // Determine WebSocket URL based on environment
        this.wsUrl = this.getWebSocketUrl();
        
        // Reconnection handling
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectTimeout = null;
        
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
            <span class="collaboration-status-indicator-text">Session: none</span>
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
            } else if (this.sessionId) {
                // Reconnect to existing session
                this.connect();
            } else {
                // Start a new session when offline
                this.startSession();
            }
        });
        
        // Add to the body for fixed positioning
        document.body.appendChild(this.statusIndicator);
        
        // Create user count indicator (top-right)
        this.userCountIndicator = document.createElement('div');
        this.userCountIndicator.style.cssText = 'position: fixed; top: 28px; right: 28px; color: rgba(255, 255, 255, 0.3); font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; pointer-events: none; z-index: 10000; text-align: right; line-height: 1.4;';
        this.userCountIndicator.innerHTML = this.userDisplayName || 'you';
        document.body.appendChild(this.userCountIndicator);
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
            this.updateUserCount();
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
            if (this.sessionId) {
                indicatorText.textContent = `Session: ${this.sessionId} (offline)`;
                this.statusIndicator.title = 'Click to reconnect';
            } else {
                indicatorText.textContent = 'Session: none';
                this.statusIndicator.title = 'Click to start a new session';
            }
            this.statusIndicator.style.cursor = 'pointer';
        }
    }
    
    /**
     * Updates the user count display.
     */
    updateUserCount() {
        if (this.userCountIndicator) {
            // Create list of users
            const users = [];
            
            // Add all connected users (including self if in the set)
            this.connectedUsers.forEach(userId => {
                // Extract display name from userId (format: "word1-word2_timestamp")
                const displayName = userId.split('_')[0];
                if (displayName) {
                    // Mark self with "(you)" prefix with subtle accent color
                    if (userId === this.userId) {
                        users.push('<span style="color: rgba(62, 207, 142, 0.4)">(you)</span> ' + displayName);
                    } else {
                        users.push(displayName);
                    }
                }
            });
            
            // If we're not in the connected users set (not connected), just show self
            if (users.length === 0) {
                users.push('<span style="color: rgba(62, 207, 142, 0.4)">(you)</span> ' + (this.userDisplayName || 'you'));
            }
            
            // Update the display (one user per line) - use innerHTML for HTML content
            this.userCountIndicator.innerHTML = users.join('<br>');
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
     * Determines the WebSocket URL based on environment.
     * @returns {string} The WebSocket server URL
     */
    getWebSocketUrl() {
        // Check for environment variable or configuration
        if (window.NODEUI_WS_URL) {
            return window.NODEUI_WS_URL;
        }
        
        // Check URL parameters for custom server
        const urlParams = new URLSearchParams(window.location.search);
        const customWsUrl = urlParams.get('ws');
        if (customWsUrl) {
            return customWsUrl;
        }
        
        // Check if running on Cloudflare Pages (production)
        if (window.location.hostname === 'nodeui.pages.dev' || window.location.hostname.includes('pages.dev')) {
            // For Cloudflare Workers/Functions, append session ID to URL path
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            return `${protocol}//${window.location.host}/collab/`;
        }
        
        // Check if running from file:// protocol
        if (window.location.protocol === 'file:') {
            console.warn('Collaboration requires running from a web server, not file:// protocol');
            return null;
        }
        
        // For production deployment on nodeui.io
        if (window.location.hostname === 'nodeui.io') {
            // You'll need to deploy your WebSocket server somewhere
            // For example: wss://nodeui-collab.herokuapp.com or your own server
            console.warn('No production WebSocket server configured. Collaboration will not work.');
            return null;
        }
        
        // For other deployments, return null (no collaboration)
        return null;
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
        // Reuse the same word list from session IDs for consistency
        const words = [
            // Cosmic
            'nova', 'void', 'flux', 'warp', 'rift', 'apex', 'core', 'pulse', 'spark', 'glow',
            // Nature/Elements
            'fire', 'ice', 'storm', 'wave', 'bolt', 'mist', 'dune', 'reef', 'peak', 'vale',
            // Mythical creatures
            'wolf', 'hawk', 'crow', 'lynx', 'bear', 'stag', 'pike', 'moth', 'wasp', 'viper',
            // Actions/Power
            'rush', 'dash', 'leap', 'dive', 'soar', 'drift', 'hack', 'sync', 'ping', 'zap',
            // Tech/Cyber
            'node', 'mesh', 'grid', 'link', 'byte', 'port', 'chip', 'code', 'loop', 'cache',
            // Cool descriptors
            'dark', 'neon', 'twin', 'swift', 'steel', 'silk', 'chrome', 'frost', 'ember', 'echo',
            // Abstract
            'zen', 'flux', 'edge', 'blur', 'fold', 'shift', 'phase', 'nexus', 'helix', 'prism',
            // Energy/Light
            'glow', 'beam', 'ray', 'arc', 'flare', 'blaze', 'shine', 'flash', 'gleam', 'halo',
            // Materials
            'jade', 'onyx', 'ruby', 'opal', 'zinc', 'iron', 'gold', 'cobalt', 'quartz', 'amber',
            // Time/Space
            'dawn', 'dusk', 'time', 'space', 'zone', 'era', 'age', 'now', 'neo', 'retro'
        ];
        
        // Generate two random words for username
        const word1 = words[Math.floor(Math.random() * words.length)];
        const word2 = words[Math.floor(Math.random() * words.length)];
        
        // Store the display name
        this.userDisplayName = `${word1}-${word2}`;
        
        // Return a unique ID that includes the display name
        return `${word1}-${word2}_${Date.now().toString(36)}`;
    }
    
    /**
     * Generates a session ID for a new room.
     */
    generateSessionId() {
        // Curated list of cool, memorable words for session IDs
        const words = [
            // Cosmic
            'nova', 'void', 'flux', 'warp', 'rift', 'apex', 'core', 'pulse', 'spark', 'glow',
            // Nature/Elements
            'fire', 'ice', 'storm', 'wave', 'bolt', 'mist', 'dune', 'reef', 'peak', 'vale',
            // Mythical creatures
            'wolf', 'hawk', 'crow', 'lynx', 'bear', 'stag', 'pike', 'moth', 'wasp', 'viper',
            // Actions/Power
            'rush', 'dash', 'leap', 'dive', 'soar', 'drift', 'hack', 'sync', 'ping', 'zap',
            // Tech/Cyber
            'node', 'mesh', 'grid', 'link', 'byte', 'port', 'chip', 'code', 'loop', 'cache',
            // Cool descriptors
            'dark', 'neon', 'twin', 'swift', 'steel', 'silk', 'chrome', 'frost', 'ember', 'echo',
            // Abstract
            'zen', 'flux', 'edge', 'blur', 'fold', 'shift', 'phase', 'nexus', 'helix', 'prism',
            // Energy/Light
            'glow', 'beam', 'ray', 'arc', 'flare', 'blaze', 'shine', 'flash', 'gleam', 'halo',
            // Materials
            'jade', 'onyx', 'ruby', 'opal', 'zinc', 'iron', 'gold', 'cobalt', 'quartz', 'amber',
            // Time/Space
            'dawn', 'dusk', 'time', 'space', 'zone', 'era', 'age', 'now', 'neo', 'retro'
        ];
        
        // Select three random words
        const word1 = words[Math.floor(Math.random() * words.length)];
        const word2 = words[Math.floor(Math.random() * words.length)];
        const word3 = words[Math.floor(Math.random() * words.length)];
        
        return `${word1}-${word2}-${word3}`.toUpperCase();
    }
    
    /**
     * Starts a new shared session.
     */
    startSession() {
        if (!this.wsUrl) {
            this.showError('No collaboration server configured. Please run a local server or specify a WebSocket URL.');
            return null;
        }
        this.sessionId = this.generateSessionId();
        console.log(`Starting new session: ${this.sessionId}`);
        this.connect();
        return this.sessionId;
    }
    
    /**
     * Joins an existing session.
     * @param {string} sessionId - The session ID to join
     */
    joinSession(sessionId) {
        if (!this.wsUrl) {
            this.showError('No collaboration server configured. Please run a local server or specify a WebSocket URL.');
            return;
        }
        this.sessionId = sessionId.toUpperCase();
        console.log(`Joining session: ${this.sessionId}`);
        this.connect();
    }
    
    /**
     * Leaves the current session completely.
     */
    leaveSession() {
        this.disconnect(true); // Full exit - clear everything
    }
    
    /**
     * Connects to the WebSocket server.
     */
    connect() {
        if (this.ws) {
            this.disconnect();
        }
        
        try {
            // For Cloudflare Workers/Functions, append session ID to URL path
            let wsUrl = this.wsUrl;
            if (this.wsUrl && (this.wsUrl.includes('workers.dev') || this.wsUrl.includes('/collab')) && this.sessionId) {
                // Remove trailing slash if present
                wsUrl = this.wsUrl.replace(/\/$/, '') + '/' + this.sessionId;
            }
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                this.isConnected = true;
                this.reconnectAttempts = 0; // Reset on successful connection
                
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
                
                // Start keep-alive mechanism
                this.startKeepAlive();
            };
            
            this.ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                
                // Handle ping/pong for keep-alive
                if (message.type === 'ping') {
                    this.send({ type: 'pong' });
                    return;
                }
                
                if (message.type === 'pong') {
                    // Just ignore pongs now
                    return;
                }
                
                this.handleMessage(message);
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                events.publish('collaboration:error', { error });
            };
            
            this.ws.onclose = () => {
                this.isConnected = false;
                this.stopKeepAlive();
                this.unsubscribeFromEvents();
                this.connectedUsers.clear();
                this.updateUserCount();
                events.publish('collaboration:disconnected');
                
                // Attempt to reconnect with exponential backoff
                if (this.sessionId && !this.reconnectAttempts) {
                    this.reconnectAttempts = 0;
                    this.attemptReconnect();
                }
            };
            
        } catch (error) {
            console.error('Failed to connect to collaboration server:', error);
            events.publish('collaboration:error', { error });
        }
    }
    
    /**
     * Disconnects from the WebSocket server.
     * @param {boolean} clearSession - Whether to clear the session ID (default: false)
     */
    disconnect(clearSession = false) {
        if (clearSession) {
            this.sessionId = null;
            // Clear all nodes and edges when exiting session
            this.nodeUI.clearAll();
        }
        this.hasLoadedState = false;
        this.reconnectAttempts = 0;
        this.isConnected = false;
        
        // Cancel any pending reconnect
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        
        this.stopKeepAlive();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connectedUsers.clear();
        this.updateUserCount();
        this.unsubscribeFromEvents();
        
        // Update UI to reflect disconnected state
        if (clearSession) {
            this.updateStatus('disconnected');
        } else {
            this.updateStatus('disconnected', this.sessionId);
        }
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
                const joinedName = message.userId.split('_')[0];
                console.log(`${joinedName} joined`);
                events.publish('collaboration:user-joined', { userId: message.userId });
                this.updateUserCount();
                break;
                
            case 'user-left':
                this.connectedUsers.delete(message.userId);
                const leftName = message.userId.split('_')[0];
                console.log(`${leftName} left`);
                events.publish('collaboration:user-left', { userId: message.userId });
                this.updateUserCount();
                break;
                
            case 'users-list':
                this.connectedUsers = new Set(message.users);
                events.publish('collaboration:users-updated', { users: Array.from(this.connectedUsers) });
                this.updateUserCount();
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
                        // console.log('Sending state to user after', delay, 'ms delay');
                        this.sendCurrentState();
                    }, delay);
                }
                break;
                
            case 'state-response':
                // Only load state from users in the same context
                if (message.graphContext && message.graphContext !== this.nodeUI.graphContext.currentGraphId) {
                    // console.log('Ignoring state from different context:', message.graphContext);
                    return;
                }
                
                // Only load the first state response to avoid conflicts
                if (!this.hasLoadedState) {
                    this.hasLoadedState = true;
                    console.log('Synced with existing session');
                    this.loadRemoteState(message.state);
                } else {
                    // console.log('Ignoring additional state response');
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
    
    /**
     * Starts the keep-alive mechanism to prevent connection timeouts.
     */
    startKeepAlive() {
        // Server sends pings every 30s, we just need to respond
        // No need for client-side pings
    }
    
    /**
     * Stops the keep-alive mechanism.
     */
    stopKeepAlive() {
        // Nothing to stop anymore
    }
    
    /**
     * Attempts to reconnect with exponential backoff.
     */
    attemptReconnect() {
        if (!this.sessionId || this.isConnected) {
            this.reconnectAttempts = 0;
            return;
        }
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached. Please refresh the page.');
            this.showError('Connection lost. Please refresh the page to reconnect.');
            return;
        }
        
        // Calculate backoff: 1s, 2s, 4s, 8s... up to 30s
        const backoffMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        
        console.log(`Reconnecting in ${backoffMs / 1000}s...`);
        
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
        }, backoffMs);
    }
}

// Attach to window for global access
window.Collaboration = Collaboration;