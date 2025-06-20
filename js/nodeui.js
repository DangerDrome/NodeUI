/**
 * @fileoverview Manages the main canvas, including rendering nodes, edges,
 * and handling all user interactions like panning, zooming, and dragging.
 */

class NodeUI {
    /**
     * @param {HTMLElement} container - The container element for the canvas.
     */
    constructor(container) {
        if (!container) {
            throw new Error("A container element is required for NodeUI.");
        }
        this.container = container;
        this.nodes = new Map();
        this.edges = new Map();
        this.selectedNodes = new Set();
        this.selectedEdges = new Set();

        this.draggingState = {
            isDragging: false,
            targetNode: null,
            startX: 0,
            startY: 0,
            offsetX: 0,
            offsetY: 0,
            shakeHistory: [],
            lastShakeTime: 0,
            shakeCooldown: false,
            droppableEdge: null, // Track which edge we can drop onto
            isDraggingPinned: false
        };

        this.edgeDrawingState = {
            isDrawing: false,
            startNodeId: null,
            startHandlePosition: null,
            startPosition: null,
            tempEdgeElement: null
        };

        this.resizingState = {
            isResizing: false,
            targetNode: null,
            startX: 0,
            startY: 0,
            originalX: 0,
            originalY: 0,
            originalWidth: 0,
            originalHeight: 0,
            direction: null
        };

        this.selectionState = {
            isSelecting: false,
            selectionBox: null,
            startX: 0,
            startY: 0
        };

        this.clipboard = {
            nodes: [],
            edges: []
        };

        this.edgeCutState = {
            isCutting: false,
            cutLine: null,
            startX: 0,
            startY: 0
        };

        this.routingCutState = {
            isRouting: false,
            cutLine: null
        };

        this.routingState = {
            isRouting: false,
            edgeId: null,
            pointIndex: -1
        };

        this.snapToGrid = 0; // Grid size, can be false or a number
        this.snapToObjects = true;
        this.snapThreshold = 5;
        this.shakeSensitivity = 6.5; // Higher number = less sensitive shake detection
        this.edgeGravity = 0;

        this.projectName = 'Untitled Graph';
        this.thumbnailUrl = '';

        this.contextMenuSettings = {
            canvas: {
                cut: { label: 'Cut', iconClass: 'icon-scissors' },
                copy: { label: 'Copy', iconClass: 'icon-copy' },
                paste: { label: 'Paste', iconClass: 'icon-clipboard' },
                delete: { label: 'Delete', iconClass: 'icon-trash-2' },
                note: { label: 'Note', iconClass: 'icon-file-text' },
                routingNode: { label: 'Router', iconClass: 'icon-network' },
                group: { label: 'Group', iconClass: 'icon-group' },
                log: { label: 'Log', iconClass: 'icon-terminal' },
                settings: { label: 'Settings', iconClass: 'icon-settings' },
                snapGrid: { label: `Grid Snap`, iconClass: 'icon-grid-2x2' },
                snapObject: { label: `Obj Snap`, iconClass: 'icon-layout-panel-left' },
                changeBackground: { label: 'Background', iconClass: 'icon-paint-bucket' }
            },
            edge: {
                addRoutingNode: { label: 'Add Routing Node', iconClass: 'icon-network' },
                delete: { label: 'Delete', iconClass: 'icon-trash-2' },
                edit: { label: 'Edit Label', iconClass: 'icon-edit' }
            }
        };

        this.contextMenu = new ContextMenu();
        this.longPressTimer = null;
        this.openPopoverNodeId = null;
        this.maxGroupZIndex = 0;
        this.maxNodeZIndex = 10000; // Large offset to separate node/group layers
        this.selectionDebounceTimer = null;
        this.pinnedNodes = new Set();

        this.panZoom = {
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            isPanning: false
        };

        this.lastTap = 0;
        this.lastMousePosition = { clientX: 0, clientY: 0 };

        this.initialPinchDistance = null;
        this.initialScale = 1;
        this.isPinching = false;

        this.init();
    }

    /**
     * Initializes the canvas, sets up the SVG element, and binds event listeners.
     */
    init() {
        this.container.innerHTML = ''; // Clear any previous content

        // --- Pinned Node Layer (Topmost) ---
        this.pinnedNodeContainer = document.getElementById('pinned-node-container');

        // --- Grid Layer (Bottom) ---
        this.gridSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.gridSvg.classList.add('grid-canvas');

        const gridDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.id = 'grid-pattern';
        pattern.setAttribute('width', '20');
        pattern.setAttribute('height', '20');
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '1');
        circle.setAttribute('cy', '1');
        circle.setAttribute('r', '1');
        circle.classList.add('grid-dot');

        pattern.appendChild(circle);
        gridDefs.appendChild(pattern);
        this.gridSvg.appendChild(gridDefs);

        this.gridRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        this.gridRect.setAttribute('width', '100%');
        this.gridRect.setAttribute('height', '100%');
        this.gridRect.setAttribute('fill', 'url(#grid-pattern)');
        this.gridSvg.appendChild(this.gridRect);

        // --- Edge Layer (Middle) ---
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.classList.add('node-ui-canvas');

        this.createMarkers();
        
        this.canvasGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.svg.appendChild(this.canvasGroup);
        
        this.guideGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.guideGroup.classList.add('guide-group');
        this.canvasGroup.appendChild(this.guideGroup);

        // --- Node Layers (Top) ---
        this.groupContainer = document.createElement('div');
        this.groupContainer.classList.add('group-container');

        this.nodeContainer = document.createElement('div');
        this.nodeContainer.classList.add('node-container');

        this.selectionState.selectionBox = document.createElement('div');
        this.selectionState.selectionBox.classList.add('selection-box');
        this.nodeContainer.appendChild(this.selectionState.selectionBox);

        // --- Final Assembly ---
        this.container.appendChild(this.gridSvg);         // 1. Grid
        this.container.appendChild(this.groupContainer);   // 2. Groups
        this.container.appendChild(this.svg);              // 3. Edges
        this.container.appendChild(this.nodeContainer);    // 4. Nodes
        
        this.bindEventListeners();
        this.subscribeToEvents();
        this.startPhysicsLoop(); // Start the physics simulation

        console.log('%c[NodeUI]%c Service initialized.', 'color: #3ecf8e; font-weight: bold;', 'color: inherit;');
    }

    /**
     * Creates SVG markers for edge arrowheads for each color state.
     */
    createMarkers() {
        const edgeDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const colors = ['default', 'red', 'green', 'blue', 'yellow', 'purple'];
        const states = ['border', 'border-hover'];

        colors.forEach(color => {
            states.forEach(state => {
                const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
                marker.id = `arrowhead-${color}-${state}`;
                marker.setAttribute('viewBox', '0 0 10 10');
                marker.setAttribute('refX', '8');
                marker.setAttribute('refY', '5');
                marker.setAttribute('markerWidth', '6');
                marker.setAttribute('markerHeight', '6');
                marker.setAttribute('orient', 'auto-start-reverse');
                
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
                path.style.fill = `var(--color-node-${color}-${state})`;
                
                marker.appendChild(path);
                edgeDefs.appendChild(marker);
            });
        });

        this.svg.appendChild(edgeDefs);
    }

    /**
     * Binds DOM event listeners for canvas interactions.
     */
    bindEventListeners() {
        document.addEventListener('mousedown', this.onMouseDown.bind(this));
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
        
        // Add touch event listeners
        document.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });

        // Add keyboard event listeners
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));

        // Add wheel event for zooming
        this.container.addEventListener('wheel', this.onWheel.bind(this), { passive: false });

        // Add context menu event
        document.addEventListener('contextmenu', this.onContextMenu.bind(this));

        // Add drag and drop listeners for graph files
        this.container.addEventListener('dragover', this.onDragOver.bind(this));
        this.container.addEventListener('dragleave', this.onDragLeave.bind(this));
        this.container.addEventListener('drop', this.onDrop.bind(this));
    }

    /**
     * Subscribes to application-wide events from the event bus.
     */
    subscribeToEvents() {
        events.subscribe('node:create', (options) => {
            if (options.type === 'GroupNode') {
                this.addNode(new GroupNode(options));
            } else if (options.type === 'RoutingNode') {
                this.addNode(new RoutingNode(options));
            } else if (options.type === 'LogNode') {
                this.addNode(new LogNode(options));
            } else if (options.type === 'SettingsNode') {
                this.addNode(new SettingsNode(options));
            }
            else {
                this.addNode(new BaseNode(options));
            }
        });
        events.subscribe('edge:create', (options) => this.addEdge(new BaseEdge(options)));
        events.subscribe('node:delete', (nodeId) => this.removeNode(nodeId));
        events.subscribe('edge:delete', (edgeId) => this.removeEdge(edgeId));
        events.subscribe('edge:update', (data) => this.updateEdgeProps(data));
        events.subscribe('snap:grid-toggle', () => this.toggleSnapToGrid());
        events.subscribe('node:update', (data) => this.updateNode(data));
        events.subscribe('snap:object-toggle', this.toggleSnapToObjects.bind(this));
        events.subscribe('node:visual-update', ({ nodeId }) => this.updateConnectedEdges(nodeId));
        events.subscribe('edge:add-routing-node', (data) => this.splitEdgeWithRoutingNode(data));
        events.subscribe('edge:selected', (data) => this.onEdgeSelected(data));
        events.subscribe('edge:create-with-new-node', (data) => this.createNodeAndConnectEdge(data));
        events.subscribe('setting:update', (data) => this.updateSetting(data));
        events.subscribe('edge:edit-label', ({ edgeId }) => {
            const edge = this.edges.get(edgeId);
            if (edge) {
                this.editEdgeLabel(edge);
            }
        });
        events.subscribe('settings:request', () => this.publishSettings());
        events.subscribe('graph:save', () => this.saveGraph());
        events.subscribe('graph:load-content', (json) => this.loadGraph(json));
        events.subscribe('graph:screenshot', () => this.takeScreenshot());
        events.subscribe('contextmenu:hidden', () => {
            if (this.edgeDrawingState.isDrawing) {
                this.cancelDrawingEdge();
            }
        });
    }

    /**
     * Adds a node to the canvas and renders it.
     * @param {BaseNode} node - The node instance to add.
     */
    addNode(node) {
        this.nodes.set(node.id, node);
        if (node instanceof GroupNode) {
            node.render(this.groupContainer);
        } else {
            node.render(this.nodeContainer);
        }
    }

    /**
     * Adds an edge to the canvas and renders it.
     * @param {BaseEdge} edge - The edge instance to add.
     */
    addEdge(edge) {
        this.edges.set(edge.id, edge);
        edge.render(this.canvasGroup); // Edges are SVG elements
        
        // Calculate initial positions and draw the edge immediately
        const startNode = this.nodes.get(edge.startNodeId);
        const endNode = this.nodes.get(edge.endNodeId);
        
        if (startNode && endNode) {
            edge.startPosition = this.getHandlePosition(edge.startNodeId, edge.startHandleId);
            edge.endPosition = this.getHandlePosition(edge.endNodeId, edge.endHandleId);
            this.updateEdge(edge.id);

            // Update node connection states
            startNode.addConnection(edge.startHandleId, edge.id);
            endNode.addConnection(edge.endHandleId, edge.id);
        }
    }

    /**
     * Removes a node from the canvas and all connected edges.
     * @param {string} nodeId - The ID of the node to remove.
     */
    removeNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return;

        // If the node has a custom destroy method, call it for cleanup
        if (typeof node.destroy === 'function') {
            node.destroy();
        }

        // Find and remove all connected edges first
        const edgesToRemove = [];
        this.edges.forEach(edge => {
            if (edge.startNodeId === nodeId || edge.endNodeId === nodeId) {
                edgesToRemove.push(edge.id);
            }
        });
        edgesToRemove.forEach(edgeId => this.removeEdge(edgeId));
        
        // Remove the node element itself
        if (node.element) {
            node.element.remove();
        }
        this.nodes.delete(nodeId);
    }

    /**
     * Removes an edge from the canvas.
     * @param {string} edgeId - The ID of the edge to remove.
     */
    removeEdge(edgeId) {
        const edge = this.edges.get(edgeId);
        if (!edge) return;

        // Update node connection states before removing the edge
        const startNode = this.nodes.get(edge.startNodeId);
        const endNode = this.nodes.get(edge.endNodeId);
        if (startNode) {
            startNode.removeConnection(edge.startHandleId, edge.id);
        }
        if (endNode) {
            endNode.removeConnection(edge.endHandleId, edge.id);
        }

        // Remove the entire edge group element and from the map
        if (edge.groupElement) {
            edge.groupElement.remove();
        }
        this.edges.delete(edgeId);
    }

    // --- Interaction Event Handlers ---

    /**
     * Handles the mousedown event on the node container.
     * @param {MouseEvent} event 
     */
    onMouseDown(event) {
        // Only process events inside the main container or pinned container
        const isInsideContainer = event.target.closest('#canvas-container') || event.target.closest('#pinned-node-container');
        if (!isInsideContainer && !this.draggingState.isDragging && !this.resizingState.isResizing) {
            return;
        }

        // If a popover is open, and the click is not inside it, close it.
        if (this.openPopoverNodeId && !event.target.closest('.node-popover') && !event.target.closest('.node-settings-icon')) {
            this.toggleNodePopover(this.openPopoverNodeId);
        }

        if (event.target.classList.contains('resize-handle')) {
            const { nodeId, direction } = event.target.dataset;
            this.startResize(nodeId, event, direction);
            return;
        }
        if (this.routingCutState.isRouting) {
            this.startRoutingCut(event);
            return;
        }
        if (this.edgeCutState.isCutting) {
            this.startCuttingLine(event);
            return;
        }
        if (event.target.classList.contains('node-handle-zone')) {
            if (event.button !== 0) return; // Only allow left-click to draw edges
            const { nodeId, handlePosition } = event.target.dataset;
            this.startDrawingEdge(nodeId, handlePosition);
            return;
        }

        // Check if the click is on the settings icon
        if (event.target.closest('.node-settings-icon')) {
            const nodeElement = event.target.closest('.node');
            if (nodeElement) {
                // If popover is already shown for this node, hide it. Otherwise, show it.
                if (this.openPopoverNodeId === nodeElement.id) {
                    this.toggleNodePopover(nodeElement.id);
                } else {
                    this.toggleNodePopover(nodeElement.id);
                }
            }
            return;
        }

        // Check if the click is on the cycle color icon
        if (event.target.closest('.node-cycle-color-icon')) {
            const nodeElement = event.target.closest('.node');
            if (nodeElement) {
                this.cycleNodeColor(nodeElement.id);
            }
            return;
        }

        // Check if the click is on a node (but not a handle, which is handled earlier)
        const nodeElement = event.target.closest('.node');
        if (nodeElement) {
            const nodeId = nodeElement.id;
            const node = this.nodes.get(nodeId);

            if (node.isPinned && !(node instanceof SettingsNode)) { // Allow settings node to be dragged even if pinned
                this.startDrag(nodeId, event.clientX, event.clientY, true);
                return;
            }

            this.bringToFront(nodeId); // Bring the node and its hierarchy to the front

            // If the node is not part of a multi-selection, clear the selection.
            // This allows dragging a single unselected node without clearing the current selection.
            if (!this.selectedNodes.has(nodeId)) {
                this.clearSelection();
                this.selectNode(nodeId);
            }
            this.startDrag(nodeId, event.clientX, event.clientY);
            return;
        } 
        
        // If the click wasn't on a handle or title bar, it's a background click.
        // This handles panning and selection.
        if (event.button === 1) { // Middle mouse for panning
            event.preventDefault(); 
            this.panZoom.isPanning = true;
            this.draggingState.startX = event.clientX;
            this.draggingState.startY = event.clientY;
        } else { // Left click for selection
            // Debounce to prevent firing on dblclick
            this.clearSelection(); // Clear previous selection on new mousedown
            this.selectionDebounceTimer = setTimeout(() => {
                this.selectionState.isSelecting = true;
                const mousePos = this.getMousePosition(event);
                this.selectionState.startX = mousePos.x;
                this.selectionState.startY = mousePos.y;
                
                const box = this.selectionState.selectionBox;
                box.style.left = `${mousePos.x}px`;
                box.style.top = `${mousePos.y}px`;
                box.style.width = '0px';
                box.style.height = '0px';
                box.style.display = 'block';

            }, 150);
        }

        if (event.target.classList.contains('edge-routing-handle')) {
            const { edgeId, pointIndex } = event.target.dataset;
            this.routingState.isRouting = true;
            this.routingState.edgeId = edgeId;
            this.routingState.pointIndex = parseInt(pointIndex);
            return;
        }
    }

    /**
     * Handles the mousemove event on the document.
     * @param {MouseEvent} event 
     */
    onMouseMove(event) {
        this.lastMousePosition = { clientX: event.clientX, clientY: event.clientY };

        if (this.routingCutState.isRouting && this.routingCutState.cutLine) {
            this.updateRoutingCut(event);
            return;
        }
        if (this.edgeCutState.isCutting && this.edgeCutState.cutLine) {
            this.updateCuttingLine(event);
            return;
        }
        if (this.selectionState.isSelecting) {
            const mousePos = this.getMousePosition(event);
            const { startX, startY } = this.selectionState;

            const newX = Math.min(mousePos.x, startX);
            const newY = Math.min(mousePos.y, startY);

            const box = this.selectionState.selectionBox;
            box.style.left = `${newX}px`;
            box.style.top = `${newY}px`;
            box.style.width = `${Math.abs(mousePos.x - startX)}px`;
            box.style.height = `${Math.abs(mousePos.y - startY)}px`;
            return;
        }
        
        if (this.resizingState.isResizing) {
            const { targetNode, startX, startY, originalX, originalY, originalWidth, originalHeight, direction } = this.resizingState;
            const scale = targetNode.isPinned ? 1 : this.panZoom.scale;
            const dx = (event.clientX - startX) / scale;
            const dy = (event.clientY - startY) / scale;
        
            const minWidth = parseInt(getComputedStyle(this.container).getPropertyValue('--panel-width'));
            const minHeight = parseInt(getComputedStyle(this.container).getPropertyValue('--panel-height'));
        
            let newX = originalX;
            let newY = originalY;
            let newWidth = originalWidth;
            let newHeight = originalHeight;
        
            if (direction.includes('e')) {
                newWidth = Math.max(minWidth, originalWidth + dx);
            }
            if (direction.includes('w')) {
                const calculatedWidth = originalWidth - dx;
                if (calculatedWidth > minWidth) {
                    newWidth = calculatedWidth;
                    newX = originalX + dx;
                }
            }
            if (direction.includes('s')) {
                newHeight = Math.max(minHeight, originalHeight + dy);
            }
            if (direction.includes('n')) {
                const calculatedHeight = originalHeight - dy;
                if (calculatedHeight > minHeight) {
                    newHeight = calculatedHeight;
                    newY = originalY + dy;
                }
            }

            if (this.snapToObjects && !targetNode.isPinned) {
                const snapResult = this.checkForResizeSnapping(targetNode, newX, newY, newWidth, newHeight, direction);
                newX = snapResult.x;
                newY = snapResult.y;
                newWidth = snapResult.width;
                newHeight = snapResult.height;
            }
        
            targetNode.x = newX;
            targetNode.y = newY;
            targetNode.width = newWidth;
            targetNode.height = newHeight;
        
            targetNode.element.style.left = `${newX}px`;
            targetNode.element.style.top = `${newY}px`;
            targetNode.element.style.width = `${newWidth}px`;
            targetNode.element.style.height = `${newHeight}px`;
        
            this.updateConnectedEdges(targetNode.id);
            return;
        }

        if (this.draggingState.isDragging) {
            // Handle dragging for pinned nodes (screen space)
            if (this.draggingState.isDraggingPinned) {
                const primaryNode = this.draggingState.targetNode;
                const dx = event.clientX - this.draggingState.startX;
                const dy = event.clientY - this.draggingState.startY;

                const nodesToMove = this.getNodesToMove(primaryNode.id);
                nodesToMove.forEach(nodeId => {
                    const node = this.nodes.get(nodeId);
                    if (node) {
                        node.x = node.originalX + dx;
                        node.y = node.originalY + dy;
                        node.element.style.left = `${node.x}px`;
                        node.element.style.top = `${node.y}px`;
                        this.updateConnectedEdges(nodeId);
                    }
                });
                return;
            }
            
            // Handle dragging for regular nodes (world space)
            const primaryNode = this.draggingState.targetNode;

            // 1. Calculate base delta from mouse movement
            const dx = (event.clientX - this.draggingState.startX) / this.panZoom.scale;
            const dy = (event.clientY - this.draggingState.startY) / this.panZoom.scale;

            // 2. Calculate primary node's potential new position
            let primaryNewX = primaryNode.originalX + dx;
            let primaryNewY = primaryNode.originalY + dy;

            // 3. Apply snapping to the primary node's position
            if (this.snapToGrid) {
                primaryNewX = Math.round(primaryNewX / this.snapToGrid) * this.snapToGrid;
                primaryNewY = Math.round(primaryNewY / this.snapToGrid) * this.snapToGrid;
            }
            if (this.snapToObjects) {
                const snapResult = this.checkForSnapping(primaryNode, primaryNewX, primaryNewY);
                primaryNewX = snapResult.x;
                primaryNewY = snapResult.y;
            }

            // 4. The final delta for ALL nodes is based on the primary node's snapped movement
            const finalDeltaX = primaryNewX - primaryNode.originalX;
            const finalDeltaY = primaryNewY - primaryNode.originalY;

            const nodesToMove = this.getNodesToMove(primaryNode.id);

            // 5. Apply the consistent delta to all nodes in the group/selection
            nodesToMove.forEach(nodeId => {
                const node = this.nodes.get(nodeId);
                if (node) {
                    node.x = node.originalX + finalDeltaX;
                    node.y = node.originalY + finalDeltaY;
                    node.element.style.left = `${node.x}px`;
                    node.element.style.top = `${node.y}px`;
                    this.updateConnectedEdges(nodeId);
                }
            });

            // Record shake history
            const now = Date.now();
            if (now - this.draggingState.lastShakeTime > 50) { // Sample every 50ms
                this.draggingState.shakeHistory.push({x: primaryNewX, y: primaryNewY});
                if (this.draggingState.shakeHistory.length > 10) {
                    this.draggingState.shakeHistory.shift(); // Keep history to a manageable size
                }
                this.draggingState.lastShakeTime = now;
            }

            // Check for shake in real-time
            this.checkForShake(primaryNode);

            // Clear previous droppable state
            if (this.draggingState.droppableEdge) {
                this.draggingState.droppableEdge.classList.remove('is-droppable');
                this.draggingState.droppableEdge = null;
            }

            // Check for new droppable edge
            let foundDroppable = false;
            for (const edge of this.edges.values()) {
                if (this.isPointOnEdge(primaryNode, edge)) {
                    edge.element.classList.add('is-droppable');
                    this.draggingState.droppableEdge = edge.element;
                    foundDroppable = true;
                    break;
                }
            }

            return;
        }

        if (this.panZoom.isPanning) {
            const dx = event.clientX - this.draggingState.startX;
            const dy = event.clientY - this.draggingState.startY;

            this.panZoom.offsetX += dx;
            this.panZoom.offsetY += dy;

            this.updateCanvasTransform();

            this.draggingState.startX = event.clientX;
            this.draggingState.startY = event.clientY;

            this.clearGuides();
        } else if (this.edgeDrawingState.isDrawing) {
            const mousePos = this.getMousePosition(event);
            this.updateDrawingEdge(mousePos.x, mousePos.y);
        }

        if (this.edgeCutState.isCutting) {
            this.endCuttingLine();
            return;
        }
        if (this.selectionState.isSelecting) {
            this.endSelection();
            this.cancelDrawingEdge();
        }

        if (this.draggingState.isDragging && this.snapToObjects) {
            this.checkForSnapping(this.draggingState.targetNode, this.draggingState.targetNode.x, this.draggingState.targetNode.y);
        }

        if (this.routingState.isRouting) {
            const edge = this.edges.get(this.routingState.edgeId);
            if (edge) {
                const point = this.getMousePosition(event);
                edge.routingPoints[this.routingState.pointIndex] = point;
                this.updateEdge(edge.id);
                this.renderRoutingPoints(edge); // Re-render points to update their position
            }
            return;
        }
    }

    /**
     * Handles the mouseup event on the document.
     * @param {MouseEvent} event 
     */
    onMouseUp(event) {
        // Always clear the timer that may have been set on mousedown
        clearTimeout(this.selectionDebounceTimer);

        if (this.routingCutState.isRouting) {
            this.endRoutingCut();
            return;
        }

        // The order of these checks is critical.
        if (this.edgeDrawingState.isDrawing) {
            if (event.target.classList.contains('node-handle-zone')) {
                const { nodeId, handlePosition } = event.target.dataset;
                this.endDrawingEdge(nodeId, handlePosition);
            } else {
                // If the mouseup is on the context menu, let the menu handle it.
                if (event.target.closest('#context-menu')) {
                    return;
                }

                const state = this.edgeDrawingState;
                const edgeStartInfo = {
                    startNodeId: state.startNodeId,
                    startHandleId: state.startHandlePosition
                };
                // Keep the temp edge visually connected to where the menu will appear
                const mousePos = this.getMousePosition(event);
                this.updateDrawingEdge(mousePos.x, mousePos.y);

                this.showCanvasContextMenu(event.clientX, event.clientY, edgeStartInfo);
            }
            return;
        }

        if (this.edgeCutState.isCutting) {
            this.endCuttingLine();
            // isCutting is reset by onKeyUp
            return;
        }
        if (this.resizingState.isResizing) {
            this.endResize();
            return;
        }
        if (this.selectionState.isSelecting) {
            this.endSelection();
            return;
        }
        if (this.draggingState.isDragging) {
            this.endDrag();
        }
        if (this.panZoom.isPanning) {
            this.panZoom.isPanning = false;
            this.container.classList.remove('is-panning');
        }

        if (this.routingState.isRouting) {
            this.routingState.isRouting = false;
            return;
        }

        this.container.classList.remove('is-panning');
    }

    /**
     * Handles the touchstart event on the node container.
     * @param {TouchEvent} event 
     */
    onTouchStart(event) {
        // Handle pinch-to-zoom
        if (event.touches.length === 2) {
            event.preventDefault(); // Prevent default browser actions
            this.panZoom.isPanning = false; // Stop panning when pinching
            this.draggingState.isDragging = false; // Stop dragging when pinching
            this.isPinching = true;
            this.initialPinchDistance = this.getPinchDistance(event);
            this.initialScale = this.panZoom.scale;
            return;
        }

        // Only process events inside the main container or pinned container
        const isInsideContainer = event.target.closest('#canvas-container') || event.target.closest('#pinned-node-container');
        if (!isInsideContainer && !this.draggingState.isDragging && !this.resizingState.isResizing) {
            return;
        }

        const touch = event.touches[0];

        // Start a timer for long-press
        this.longPressTimer = setTimeout(() => {
            this.showContextMenu(touch.clientX, touch.clientY);
            this.longPressTimer = null; // Prevent firing twice
        }, 500); // 500ms for a long press

        if (event.target.classList.contains('node-handle-zone')) {
            event.preventDefault(); // Prevent scrolling
            const { nodeId, handlePosition } = event.target.dataset;
            this.startDrawingEdge(nodeId, handlePosition);
            return;
        }
        
        // Check if the touch is on a node (but not a handle, which is handled earlier)
        const nodeElement = event.target.closest('.node');
        if (nodeElement) {
            event.preventDefault(); // Prevent scrolling
            const nodeId = nodeElement.id;
            this.startDrag(nodeId, touch.clientX, touch.clientY);
            return;
        } 
        
        // If the touch wasn't on a handle or title bar, it's a background touch for panning.
        event.preventDefault(); // Prevent scrolling
        this.panZoom.isPanning = true;
        this.container.classList.add('is-panning');
        this.draggingState.startX = touch.clientX;
        this.draggingState.startY = touch.clientY;
    }
    
    /**
     * Handles the touchmove event on the document.
     * @param {TouchEvent} event 
     */
    onTouchMove(event) {
        // Handle pinch-to-zoom
        if (event.touches.length === 2) {
            event.preventDefault();
            const currentPinchDistance = this.getPinchDistance(event);
            const scaleFactor = currentPinchDistance / this.initialPinchDistance;
            let newScale = this.initialScale * scaleFactor;

            // Clamp the scale to prevent zooming too far in or out
            newScale = Math.max(0.1, Math.min(3, newScale));

            // Get the center of the pinch gesture
            const rect = this.container.getBoundingClientRect();
            const pinchCenterX = (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left;
            const pinchCenterY = (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top;

            // Adjust offset to zoom towards the pinch center
            this.panZoom.offsetX = pinchCenterX - (pinchCenterX - this.panZoom.offsetX) * (newScale / this.panZoom.scale);
            this.panZoom.offsetY = pinchCenterY - (pinchCenterY - this.panZoom.offsetY) * (newScale / this.panZoom.scale);
            this.panZoom.scale = newScale;

            this.updateCanvasTransform();
            return;
        }

        // If the finger moves, it's not a long press
        clearTimeout(this.longPressTimer);

        if (this.resizingState.isResizing) {
            event.preventDefault();
            const touch = event.touches[0];
            const { targetNode, startX, startY, originalX, originalY, originalWidth, originalHeight, direction } = this.resizingState;
            const scale = targetNode.isPinned ? 1 : this.panZoom.scale;
            const dx = (touch.clientX - startX) / scale;
            const dy = (touch.clientY - startY) / scale;

            const minWidth = parseInt(getComputedStyle(this.container).getPropertyValue('--panel-width'));
            const minHeight = parseInt(getComputedStyle(this.container).getPropertyValue('--panel-height'));

            let newX = originalX;
            let newY = originalY;
            let newWidth = originalWidth;
            let newHeight = originalHeight;

            if (direction.includes('e')) {
                newWidth = Math.max(minWidth, originalWidth + dx);
            }
            if (direction.includes('w')) {
                const calculatedWidth = originalWidth - dx;
                if (calculatedWidth > minWidth) {
                    newWidth = calculatedWidth;
                    newX = originalX + dx;
                }
            }
            if (direction.includes('s')) {
                newHeight = Math.max(minHeight, originalHeight + dy);
            }
            if (direction.includes('n')) {
                const calculatedHeight = originalHeight - dy;
                if (calculatedHeight > minHeight) {
                    newHeight = calculatedHeight;
                    newY = originalY + dy;
                }
            }

            if (this.snapToObjects && !targetNode.isPinned) {
                const snapResult = this.checkForResizeSnapping(targetNode, newX, newY, newWidth, newHeight, direction);
                newX = snapResult.x;
                newY = snapResult.y;
                newWidth = snapResult.width;
                newHeight = snapResult.height;
            }

            targetNode.x = newX;
            targetNode.y = newY;
            targetNode.width = newWidth;
            targetNode.height = newHeight;
            targetNode.element.style.left = `${newX}px`;
            targetNode.element.style.top = `${newY}px`;
            targetNode.element.style.width = `${newWidth}px`;
            targetNode.element.style.height = `${newHeight}px`;
            this.updateConnectedEdges(targetNode.id);

        } else if (this.draggingState.isDragging) {
            event.preventDefault(); // Prevent scrolling
            const touch = event.touches[0];
            const node = this.draggingState.targetNode;

            const dx = (touch.clientX - this.draggingState.startX) / this.panZoom.scale;
            const dy = (touch.clientY - this.draggingState.startY) / this.panZoom.scale;

            let newX = node.originalX + dx;
            let newY = node.originalY + dy;

            if (this.snapToGrid) {
                newX = Math.round(newX / this.snapToGrid) * this.snapToGrid;
                newY = Math.round(newY / this.snapToGrid) * this.snapToGrid;
            }
            
            if (this.snapToObjects) {
                const snapResult = this.checkForSnapping(node, newX, newY);
                newX = snapResult.x;
                newY = snapResult.y;
            }

            // Update the visual position of all selected nodes based on the primary dragged node
            if (this.selectedNodes.size > 1 && this.selectedNodes.has(this.draggingState.targetNode.id)) {
                const deltaX = newX - node.originalX;
                const deltaY = newY - node.originalY;

                this.selectedNodes.forEach(nodeId => {
                    const selected = this.nodes.get(nodeId);
                    if(selected) {
                        selected.x = selected.originalX + deltaX;
                        selected.y = selected.originalY + deltaY;
                        selected.element.style.left = `${selected.x}px`;
                        selected.element.style.top = `${selected.y}px`;
                        this.updateConnectedEdges(selected.id);
                    }
                });
            } else {
                node.x = newX;
                node.y = newY;
                node.element.style.left = `${newX}px`;
                node.element.style.top = `${newY}px`;
                this.updateConnectedEdges(node.id);
            }
            
            return;

        } else if (this.panZoom.isPanning) {
            event.preventDefault(); // Prevent scrolling
            const touch = event.touches[0];
            const dx = touch.clientX - this.draggingState.startX;
            const dy = touch.clientY - this.draggingState.startY;

            this.panZoom.offsetX += dx;
            this.panZoom.offsetY += dy;

            this.updateCanvasTransform();

            this.draggingState.startX = touch.clientX;
            this.draggingState.startY = touch.clientY;
        } else if (this.edgeDrawingState.isDrawing) {
            event.preventDefault(); // Prevent scrolling
            const touch = event.touches[0];
            const mousePos = this.getMousePosition(touch);
            this.updateDrawingEdge(mousePos.x, mousePos.y);
        }
    }

    /**
     * Handles the touchend event on the document.
     * @param {TouchEvent} event 
     */
    onTouchEnd(event) {
        // If the gesture was a pinch, prevent it from being treated as a tap
        if (this.isPinching) {
            // This logic ensures that when the two fingers from a pinch are lifted,
            // it doesn't accidentally trigger a double-tap action.
            if (event.touches.length < 2) {
                this.isPinching = false;
                this.lastTap = 0; // Invalidate the tap history
            }
            return;
        }

        // Double tap to zoom or fit view
        const now = new Date().getTime();
        const timesince = now - this.lastTap;
        if ((timesince < 300) && (timesince > 0)) {
            const touch = event.changedTouches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            
            const tappedNodeElement = target.closest('.node');

            if (tappedNodeElement) {
                // A node was double-tapped.
                // The first tap should have already selected it via onTouchStart -> onMouseDown.
                // We ensure it's the *only* thing selected, then frame it.
                if (!this.selection.nodes.has(tappedNodeElement.id) || this.selection.nodes.size > 1) {
                    this.clearSelection();
                    this.toggleNodeSelection(tappedNodeElement.id, true);
                }
                this.frameSelection();
            } else {
                // On background: incrementally zoom in towards the tap point
                const oldScale = this.panZoom.scale;
                const newScale = Math.min(3, oldScale + 0.4); // Zoom in, capped at 3x

                const rect = this.container.getBoundingClientRect();
                const mouseX = touch.clientX - rect.left;
                const mouseY = touch.clientY - rect.top;

                // Calculate the target offset without modifying the current state
                const targetOffsetX = mouseX - (mouseX - this.panZoom.offsetX) * (newScale / oldScale);
                const targetOffsetY = mouseY - (mouseY - this.panZoom.offsetY) * (newScale / oldScale);
                
                this.animatePanZoom(newScale, targetOffsetX, targetOffsetY, 150);
            }

            this.lastTap = 0; // Reset tap time to prevent triple-tap issues
            return; 
        }
        this.lastTap = now;

        // If the touch ends before the timer, it's not a long press
        clearTimeout(this.longPressTimer);

        // If a pinch gesture was active, reset the state
        if (event.touches.length < 2) {
            this.initialPinchDistance = null;
        }

        // Same logic as onMouseUp: handle the most specific state first.
        if (this.edgeDrawingState.isDrawing) {
            const touch = event.changedTouches[0];
            const endElement = document.elementFromPoint(touch.clientX, touch.clientY);
            
            if (endElement && endElement.classList.contains('node-handle-zone')) {
                const { nodeId, handlePosition } = endElement.dataset;
                this.endDrawingEdge(nodeId, handlePosition);
            } else {
                const state = this.edgeDrawingState;
                const edgeStartInfo = {
                    startNodeId: state.startNodeId,
                    startHandleId: state.startHandlePosition
                };
                // Keep the temp edge visually connected to where the menu will appear
                const mousePos = this.getMousePosition(touch);
                this.updateDrawingEdge(mousePos.x, mousePos.y);

                this.showCanvasContextMenu(touch.clientX, touch.clientY, edgeStartInfo);
            }
            return;
        }

        if (this.resizingState.isResizing) {
            this.endResize();
        }
        if (this.draggingState.isDragging) {
            this.endDrag();
        }
        if (this.panZoom.isPanning) {
            this.panZoom.isPanning = false;
            this.container.classList.remove('is-panning');
        }
        if (this.selectionState.isSelecting) {
            this.endSelection();
        }

        if (this.routingState.isRouting) {
            this.routingState.isRouting = false;
            return;
        }

        this.container.classList.remove('is-panning');

        // Handle single tap for selection, but only if it wasn't a drag
        const dx = this.lastMousePosition.clientX - this.draggingState.startX;
        const dy = this.lastMousePosition.clientY - this.draggingState.startY;
        const isDrag = Math.sqrt(dx * dx + dy * dy) > this.DRAG_THRESHOLD;

        if (!isDrag) {
            this.handleSelection(event);
        }

        // Defer clearing the dragging state until after we've checked for drag
        this.draggingState.isDragging = false;
        this.draggingState.hasDragged = false;
    }

    /**
     * Handles the wheel event for zooming.
     * @param {WheelEvent} event 
     */
    onWheel(event) {
        event.preventDefault();
        
        const zoomIntensity = 0.1;
        const oldScale = this.panZoom.scale;

        // Determine the direction of the scroll
        const scroll = event.deltaY < 0 ? 1 : -1;
        
        // Calculate the new scale
        const newScale = Math.max(0.1, Math.min(3, oldScale + scroll * zoomIntensity * oldScale));
        
        // Get the mouse position relative to the container
        const rect = this.container.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // Adjust the offset to zoom towards the mouse position
        this.panZoom.offsetX = mouseX - (mouseX - this.panZoom.offsetX) * (newScale / oldScale);
        this.panZoom.offsetY = mouseY - (mouseY - this.panZoom.offsetY) * (newScale / oldScale);
        this.panZoom.scale = newScale;
        
        this.updateCanvasTransform();
    }

    /**
     * Handles keyboard shortcuts for cut, copy, and paste.
     * @param {KeyboardEvent} event 
     */
    onKeyDown(event) {
        // Use event.metaKey for Command key on macOS
        const isModKey = event.ctrlKey || event.metaKey;
        const target = event.target;
        const isEditingContent = target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
        const key = event.key.toLowerCase();

        if (isModKey && key === 'a' && !isEditingContent) {
            event.preventDefault();
            this.selectAll();
        } else if (isModKey && key === 'c' && !isEditingContent) {
            event.preventDefault();
            this.copySelection();
        } else if (isModKey && key === 'x' && !isEditingContent) {
            event.preventDefault();
            this.cutSelection();
        } else if (isModKey && key === 'v' && !isEditingContent) {
            event.preventDefault();
            this.paste();
        } else if (key === 'g' && !isModKey && !isEditingContent) {
            event.preventDefault();
            this.groupSelection();
        } else if (key === 'f' && !isModKey && !isEditingContent) {
            event.preventDefault();
            this.frameSelection();
        } else if (key === 'n' && !isModKey && !isEditingContent) {
            event.preventDefault();
            this.createNodeAtMousePosition();
        } else if (key === 'm' && !isModKey && !isEditingContent) {
            event.preventDefault();
            this.createRoutingNodeAtMousePosition();
        } else if ((key === 'delete' || key === 'backspace') && !isEditingContent) {
            event.preventDefault();
            this.deleteSelection();
        } else if ((key === 'c' || key === 'y') && !isModKey && !isEditingContent) {
            event.preventDefault();
            this.edgeCutState.isCutting = true;
            this.container.classList.add('is-cutting');
        } else if (key === 'r' && !isModKey && !isEditingContent) {
            event.preventDefault();
            this.routingCutState.isRouting = true;
            this.container.classList.add('is-routing');
        }
    }

    /**
     * Handles key up events for ending states like edge cutting.
     * @param {KeyboardEvent} event 
     */
    onKeyUp(event) {
        const key = event.key.toLowerCase();
        if (key === 'c' || key === 'y') {
            this.edgeCutState.isCutting = false;
            this.container.classList.remove('is-cutting');
            // If a cut line is still present (e.g., key released before mouseup), clean it up without cutting.
            if (this.edgeCutState.cutLine) {
                this.endCuttingLine(false);
            }
        } else if (key === 'r') {
            this.routingCutState.isRouting = false;
            this.container.classList.remove('is-routing');
        }
    }

    // --- Drag Logic ---

    /**
     * Initiates the dragging state for a node.
     * @param {string} nodeId - The ID of the node to drag.
     * @param {number} clientX - The clientX from the triggering event.
     * @param {number} clientY - The clientY from the triggering event.
     */
    startDrag(nodeId, clientX, clientY, isPinned = false) {
        const node = this.nodes.get(nodeId);
        if (!node) return;

        this.draggingState.isDragging = true;
        this.draggingState.targetNode = node;
        this.draggingState.isDraggingPinned = isPinned;
        
        // Store initial mouse position and node's original position
        this.draggingState.startX = clientX;
        this.draggingState.startY = clientY;
        
        const nodesToMove = this.getNodesToMove(nodeId);
        
        nodesToMove.forEach(nodeToMoveId => {
            const nodeToMove = this.nodes.get(nodeToMoveId);
            if (nodeToMove) {
                nodeToMove.originalX = nodeToMove.x;
                nodeToMove.originalY = nodeToMove.y;
            }
        });

        this.draggingState.shakeHistory = [];
        this.draggingState.lastShakeTime = Date.now();
        
        node.element.classList.add('is-dragging');
    }

    /**
     * Ends the current dragging state and publishes the result.
     */
    endDrag() {
        const { targetNode } = this.draggingState;
        if (!targetNode) return;

        this.updateGroupingForMovedNodes();

        // Clear any final droppable state
        if (this.draggingState.droppableEdge) {
            this.draggingState.droppableEdge.classList.remove('is-droppable');
            this.draggingState.droppableEdge = null;
        }

        const nodesMoved = this.getNodesToMove(targetNode.id);

        // If any node is dropped on an edge, split the edge
        let edgeToSplit = null;
        for (const edge of this.edges.values()) {
            if (this.isPointOnEdge(targetNode, edge)) {
                edgeToSplit = edge;
                break;
            }
        }
        if (edgeToSplit) {
            this.splitEdgeWithNode(edgeToSplit, targetNode, true);
        }

        targetNode.element.classList.remove('is-dragging');

        if (this.snapToObjects) {
            this.clearGuides();
        }

        // Publish 'moved' for all affected nodes
        nodesMoved.forEach(nodeId => {
            const node = this.nodes.get(nodeId);
            if (node) {
                events.publish('node:moved', { nodeId: node.id, x: node.x, y: node.y });
            }
        });

        // Reset dragging state
        this.draggingState.isDragging = false;
        this.draggingState.targetNode = null;
        this.draggingState.shakeCooldown = false; // Reset cooldown
        this.draggingState.isDraggingPinned = false;
    }

    /**
     * Traverses the node hierarchy (groups and selection) to determine all nodes that should move together.
     * @param {string} startNodeId The ID of the node initiating the drag.
     * @returns {Set<string>} A set of node IDs that should be moved.
     */
    getNodesToMove(startNodeId) {
        const nodesToMove = new Set();
        const queue = [];

        // If the start node is part of a selection, the entire selection moves.
        // Otherwise, only the start node and its children move.
        if (this.selectedNodes.has(startNodeId)) {
            this.selectedNodes.forEach(id => queue.push(id));
        } else {
            queue.push(startNodeId);
        }

        while (queue.length > 0) {
            const currentId = queue.shift();
            if (nodesToMove.has(currentId)) {
                continue;
            }
            nodesToMove.add(currentId);

            const node = this.nodes.get(currentId);
            if (node instanceof GroupNode) {
                node.containedNodeIds.forEach(childId => {
                    if (!nodesToMove.has(childId)) {
                        queue.push(childId);
                    }
                });
            }
        }
        return nodesToMove;
    }

    /**
     * Checks for and applies grouping changes after a drag operation.
     */
    updateGroupingForMovedNodes() {
        const movedNodes = this.getNodesToMove(this.draggingState.targetNode.id);
        
        movedNodes.forEach(nodeId => {
            const node = this.nodes.get(nodeId);
            if (!node) return;

            const currentParent = this.findParentGroup(nodeId);
            const newParent = this.findBestTargetGroup(node);

            if (currentParent !== newParent) {
                if (currentParent) {
                    currentParent.removeContainedNode(nodeId);
                    console.log(`Node ${node.title} removed from group ${currentParent.title}`);
                }
                if (newParent) {
                    newParent.addContainedNode(nodeId);
                    console.log(`Node ${node.title} added to group ${newParent.title}`);
                }
            }
        });
    }

    /**
     * Finds the group that a given node should be placed in based on its position.
     * It prioritizes the smallest, topmost group.
     * @param {BaseNode} node The node to find a parent for.
     * @returns {GroupNode|null} The best target group or null if none.
     */
    findBestTargetGroup(node) {
        let bestTarget = null;
        let smallestArea = Infinity;

        for (const potentialParent of this.nodes.values()) {
            if (
                potentialParent instanceof GroupNode &&
                potentialParent.id !== node.id && // Cannot be its own parent
                !this.isDescendant(potentialParent, node) // Prevent cycles
            ) {
                const nodeCenter = {
                    x: node.x + node.width / 2,
                    y: node.y + node.height / 2
                };

                // Check if the node's center is inside the potential parent
                if (
                    nodeCenter.x > potentialParent.x &&
                    nodeCenter.x < potentialParent.x + potentialParent.width &&
                    nodeCenter.y > potentialParent.y &&
                    nodeCenter.y < potentialParent.y + potentialParent.height
                ) {
                    const area = potentialParent.width * potentialParent.height;
                    // Prioritize smaller groups if they are on top
                    if (!bestTarget || area < smallestArea || (area === smallestArea && parseInt(potentialParent.element.style.zIndex) > parseInt(bestTarget.element.style.zIndex))) {
                        smallestArea = area;
                        bestTarget = potentialParent;
                    }
                }
            }
        }
        return bestTarget;
    }

    /**
     * Finds the current parent group of a given node.
     * @param {string} nodeId The ID of the node to check.
     * @returns {GroupNode|null} The parent group or null.
     */
    findParentGroup(nodeId) {
        for (const node of this.nodes.values()) {
            if (node instanceof GroupNode && node.containedNodeIds.has(nodeId)) {
                return node;
            }
        }
        return null;
    }

    /**
     * Checks if a potential ancestor node is a descendant of a given node.
     * @param {BaseNode} potentialAncestor The node to check if it is a descendant.
     * @param {BaseNode} node The node to check against.
     * @returns {boolean} True if a cycle would be created.
     */
    isDescendant(potentialAncestor, node) {
        if (!(node instanceof GroupNode)) {
            return false;
        }

        const queue = [...node.containedNodeIds];
        while (queue.length > 0) {
            const childId = queue.shift();
            if (childId === potentialAncestor.id) {
                return true;
            }
            const childNode = this.nodes.get(childId);
            if (childNode instanceof GroupNode) {
                childNode.containedNodeIds.forEach(id => queue.push(id));
            }
        }
        return false;
    }

    /**
     * Checks if a point (from a node's center) is on an edge.
     * @param {BaseNode} node The node (acting as the point).
     * @param {BaseEdge} edge The edge to check against.
     * @returns {boolean}
     */
    isPointOnEdge(node, edge) {
        if (!edge.element) return false;
        const point = { x: node.x + node.width / 2, y: node.y + node.height / 2 };
        const path = edge.element;
        const len = path.getTotalLength();
        if (len === 0) return false;

        for (let i = 0; i < len; i += 5) {
            const p = path.getPointAtLength(i);
            if (Math.hypot(p.x - point.x, p.y - point.y) < 10) { // 10px tolerance
                return true;
            }
        }
        return false;
    }

    /**
     * Splits an edge by inserting a node.
     * @param {BaseEdge} edge The edge to split.
     * @param {BaseNode} node The node to insert.
     * @param {boolean} removeOriginalEdge Whether to remove the original edge
     */
    splitEdgeWithNode(edge, node, removeOriginalEdge = true) {
        const originalStartNodeId = edge.startNodeId;
        const originalEndNodeId = edge.endNodeId;
        const originalStartHandleId = edge.startHandleId;
        const originalEndHandleId = edge.endHandleId;

        // Delete the original edge first to correctly update handle states
        if (removeOriginalEdge) {
            events.publish('edge:delete', edge.id);
        }

        // Create two new edges connecting to the new routing node
        events.publish('edge:create', { 
            startNodeId: originalStartNodeId, 
            startHandleId: originalStartHandleId, 
            endNodeId: node.id, 
            endHandleId: 'left' 
        });
        events.publish('edge:create', { 
            startNodeId: node.id, 
            startHandleId: 'right', 
            endNodeId: originalEndNodeId, 
            endHandleId: originalEndHandleId 
        });
    }

    // --- Edge Drawing Logic ---

    /**
     * Starts the process of drawing a new edge.
     * @param {string} nodeId - The ID of the starting node.
     * @param {string} handlePosition - The position of the starting handle.
     */
    startDrawingEdge(nodeId, handlePosition) {
        const startNode = this.nodes.get(nodeId);
        if (!startNode) return;

        this.edgeDrawingState.isDrawing = true;
        this.edgeDrawingState.startNodeId = nodeId;
        this.edgeDrawingState.startHandlePosition = handlePosition;
        this.edgeDrawingState.startPosition = this.getHandlePosition(nodeId, handlePosition);

        // Create a temporary path element
        const tempEdge = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tempEdge.classList.add('edge', 'edge-drawing');

        const nodeColor = startNode.color || 'default';
        // Use the hover state for the marker since this is an active interaction
        tempEdge.setAttribute('marker-end', `url(#arrowhead-${nodeColor}-border-hover)`);
        
        // Set the --edge-draw-color variable for this specific edge to match the start node's hover color
        const drawColor = getComputedStyle(document.documentElement).getPropertyValue(`--color-node-${nodeColor}-border-hover`).trim();
        tempEdge.style.setProperty('--edge-draw-color', drawColor);
        
        this.canvasGroup.appendChild(tempEdge);
        this.edgeDrawingState.tempEdgeElement = tempEdge;
    }

    /**
     * Updates the temporary edge path as the user drags.
     * @param {number} endX - The current X-coordinate of the mouse.
     * @param {number} endY - The current Y-coordinate of the mouse.
     */
    updateDrawingEdge(endX, endY) {
        const state = this.edgeDrawingState;
        if (!state.isDrawing) return;

        const startPos = state.startPosition;
        
        // Let the SVG's 'orient' attribute handle the rotation automatically.
        // We just need a simple curve from start to end.
        const pathData = this.calculateCurve(startPos, {x: endX, y: endY}, state.startHandlePosition, 'auto');
        state.tempEdgeElement.setAttribute('d', pathData);
    }

    /**
     * Finishes drawing an edge if the drop is valid.
     * @param {string} endNodeId - The ID of the node where the edge ends.
     * @param {string} endHandlePosition - The position of the handle where the edge ends.
     */
    endDrawingEdge(endNodeId, endHandlePosition) {
        const state = this.edgeDrawingState;
        if (state.startNodeId === endNodeId) {
            console.warn("Cannot connect a node to itself.");
            this.cancelDrawingEdge(); // Still need to cancel
            return;
        }

        events.publish('edge:create', {
            startNodeId: state.startNodeId,
            startHandleId: state.startHandlePosition,
            endNodeId: endNodeId,
            endHandleId: endHandlePosition,
        });

        this.cancelDrawingEdge(); // Clean up after successful connection
    }

    /**
     * Cancels the current edge drawing operation.
     */
    cancelDrawingEdge() {
        if (this.edgeDrawingState.tempEdgeElement) {
            this.edgeDrawingState.tempEdgeElement.remove();
        }
        
        this.edgeDrawingState = {
            isDrawing: false,
            startNodeId: null,
            startHandlePosition: null,
            startPosition: null,
            tempEdgeElement: null
        };
    }

    /**
     * Gets the absolute position of a node's handle.
     * The position is the center of the visible handle, offset from the node's border.
     * @param {string} nodeId - The ID of the node.
     * @param {string} handlePosition - The position of the handle ('top', 'right', 'bottom', 'left').
     * @returns {{x: number, y: number}} The coordinates in world space.
     */
    getHandlePosition(nodeId, handlePosition) {
        const node = this.nodes.get(nodeId);
        if (!node) return { x: 0, y: 0 };

        let x = node.x;
        let y = node.y;

        const offsetMult = parseFloat(getComputedStyle(this.container).getPropertyValue('--handle-offset-mult')) || 1;
        const baseOffset = 10;
        const offset = baseOffset * offsetMult;
        
        if (node.isPinned) {
             // For pinned nodes, calculations are in screen space first
             let screenX = node.x;
             let screenY = node.y;

             switch (handlePosition) {
                case 'top':    screenX += node.width / 2; screenY -= offset; break;
                case 'right':  screenX += node.width + offset; screenY += node.height / 2; break;
                case 'bottom': screenX += node.width / 2; screenY += node.height + offset; break;
                case 'left':   screenX -= offset; screenY += node.height / 2; break;
            }

            // Then convert final screen coordinates to world coordinates for the SVG
            const worldX = (screenX - this.panZoom.offsetX) / this.panZoom.scale;
            const worldY = (screenY - this.panZoom.offsetY) / this.panZoom.scale;
            return { x: worldX, y: worldY };

        } else {
            // For regular nodes, all calculations are in world space
            switch (handlePosition) {
                case 'top':    x += node.width / 2; y -= offset; break;
                case 'right':  x += node.width + offset; y += node.height / 2; break;
                case 'bottom': x += node.width / 2; y += node.height + offset; break;
                case 'left':   x -= offset; y += node.height / 2; break;
            }
            return { x, y };
        }
    }

    /**
     * Gets the mouse position relative to the SVG canvas.
     * @param {MouseEvent} event 
     * @returns {{x: number, y: number}}
     */
    getMousePosition(event) {
        const svgRect = this.svg.getBoundingClientRect();
        const x = (event.clientX - svgRect.left - this.panZoom.offsetX) / this.panZoom.scale;
        const y = (event.clientY - svgRect.top - this.panZoom.offsetY) / this.panZoom.scale;
        return { x, y };
    }

    /**
     * Updates the path of an existing edge.
     * @param {string} edgeId - The ID of the edge to update.
     */
    updateEdge(edgeId) {
        const edge = this.edges.get(edgeId);
        if (!edge || !edge.element) return;

        const allPoints = [edge.startPosition, ...edge.routingPoints, edge.endPosition];
        const pathData = this.calculateSpline(allPoints, edge.startHandleId, edge.endHandleId);
        edge.element.setAttribute('d', pathData);
        edge.hitArea.setAttribute('d', pathData);

        // Update label position, content, and background
        if (edge.labelElement && edge.labelBackgroundElement) {
            edge.labelElement.textContent = edge.label;
            const path = edge.element;
            const len = path.getTotalLength();
            if (len > 0 && edge.label) {
                const midPoint = path.getPointAtLength(len / 2);
                edge.labelElement.setAttribute('x', midPoint.x);
                edge.labelElement.setAttribute('y', midPoint.y); // Offset a bit above the line

                edge.labelBackgroundElement.style.display = 'block';

                // Use a minimal timeout to allow the browser to compute the bounding box of the text
                setTimeout(() => {
                    try {
                        const labelBBox = edge.labelElement.getBBox();
                        const padding = 4;
                        edge.labelBackgroundElement.setAttribute('x', labelBBox.x - padding);
                        edge.labelBackgroundElement.setAttribute('y', labelBBox.y - padding);
                        edge.labelBackgroundElement.setAttribute('width', labelBBox.width + (padding * 2));
                        edge.labelBackgroundElement.setAttribute('height', labelBBox.height + (padding * 2));
                        edge.labelBackgroundElement.setAttribute('rx', 3); // rounded corners
                    } catch (e) {
                        // In case of an error (e.g., element not rendered), hide the background
                        edge.labelBackgroundElement.style.display = 'none';
                    }
                }, 0);

            } else {
                // Hide background if there's no label text
                edge.labelBackgroundElement.style.display = 'none';
            }
        }
    }

    /**
     * Calculates a smooth Catmull-Rom spline through a series of points.
     * @param {Array<{x: number, y: number}>} points - An array of points.
     * @returns {string} The SVG path `d` attribute string.
     */
    calculateSpline(points, startHandle, endHandle) {
        if (!points || points.length < 2) return "";
        
        let d = `M ${points[0].x} ${points[0].y}`;

        if (points.length === 2) {
            // If only two points, use the old bezier calculation for a nice curve
            return this.calculateCurve(points[0], points[1], startHandle, endHandle);
        }

        // Use Catmull-Rom for the intermediate points, with gravity sagging
        for (let i = 0; i < points.length - 1; i++) {
            let p0 = i > 0 ? points[i - 1] : points[i];
            let p1 = points[i];
            let p2 = points[i + 1];
            let p3 = i < points.length - 2 ? points[i + 2] : p2;

            let cp1x = p1.x + (p2.x - p0.x) / 6;
            let cp1y = p1.y + (p2.y - p0.y) / 6;
            let cp2x = p2.x - (p3.x - p1.x) / 6;
            let cp2y = p2.y - (p3.y - p1.y) / 6;

            // Apply gravity
            if (this.edgeGravity > 0) {
                const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                const sag = (dist / 200) * this.edgeGravity;
                cp1y += sag;
                cp2y += sag;
            }

            d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
        }
        return d;
    }

    /**
     * Calculates the SVG path data for a cubic Bézier curve between two points.
     * @param {{x:number, y:number}} startPos The start point.
     * @param {{x:number, y:number}} endPos The end point.
     * @param {string} startHandle The orientation of the start handle.
     * @param {string} endHandle The orientation of the end handle.
     * @returns {string} The SVG path `d` attribute string.
     */
    calculateCurve(startPos, endPos, startHandle, endHandle) {
        const edge = this.findEdgeByPositions(startPos, endPos);
        let sag = 0;

        if (this.edgeGravity > 0 && edge) {
            if (edge.physics.isSettled) {
                const dist = Math.hypot(endPos.x - startPos.x, endPos.y - startPos.y);
                sag = (dist / 150) * this.edgeGravity;
                edge.physics.sag = sag; // Set initial resting sag
            } else {
                sag = edge.physics.sag;
            }
        }
        
        return this._getCurvedPathD(startPos, endPos, startHandle, endHandle, sag);
    }

    /**
     * A pure function to calculate the SVG path data for a cubic Bézier curve,
     * with an optional vertical sag.
     * @param {{x:number, y:number}} startPos The start point.
     * @param {{x:number, y:number}} endPos The end point.
     * @param {string} startHandle The orientation of the start handle.
     * @param {string} endHandle The orientation of the end handle.
     * @param {number} [sag=0] - The amount of vertical sag to apply.
     * @returns {string} The SVG path `d` attribute string.
     */
    _getCurvedPathD(startPos, endPos, startHandle, endHandle, sag = 0) {
        // P0 and P3 are the start and end points of the edge, but we will draw from p1 to p2.
        const p0 = { ...startPos };
        const p3 = { ...endPos };

        // Determine the padded start/end points (p1/p2) for the S-curve.
        const maxPadding = parseInt(getComputedStyle(this.container).getPropertyValue('--edge-padding')) || 8;
        const distance = Math.hypot(p3.x - p0.x, p3.y - p0.y);
        const padding = Math.min(maxPadding, distance / 2.5);

        let p1 = { ...p0 }; // This will be the padded start point of the visible curve
        let p2 = { ...p3 }; // This will be the padded end point of the visible curve

        switch (startHandle) {
            case 'top':    p1.y -= padding; break;
            case 'bottom': p1.y += padding; break;
            case 'left':   p1.x -= padding; break;
            case 'right':  p1.x += padding; break;
        }

        switch (endHandle) {
            case 'top':    p2.y -= padding; break;
            case 'bottom': p2.y += padding; break;
            case 'left':   p2.x -= padding; break;
            case 'right':  p2.x += padding; break;
        }

        // Determine the control points for the Bezier curve
        const offset = Math.min(100, distance / 2);
        let cp1 = { ...p1 };
        let cp2 = { ...p2 };

        switch (startHandle) {
            case 'top':    cp1.y -= offset; break;
            case 'bottom': cp1.y += offset; break;
            case 'left':   cp1.x -= offset; break;
            case 'right':  cp1.x += offset; break;
        }

        switch (endHandle) {
            case 'top':    cp2.y -= offset; break;
            case 'bottom': cp2.y += offset; break;
            case 'left':   cp2.x -= offset; break;
            case 'right':  cp2.x += offset; break;
        }

        // Apply tapered sag. The sag is reduced for vertical connections to
        // create a more natural exit angle from the node before hanging.
        if (sag > 0) {
            let sag1 = sag;
            let sag2 = sag;

            // Reduce sag effect on the control point if the handle is vertical.
            if (startHandle === 'top' || startHandle === 'bottom') {
                sag1 *= 0.25;
            }
            if (endHandle === 'top' || endHandle === 'bottom') {
                sag2 *= 0.25;
            }

            cp1.y += sag1;
            cp2.y += sag2;
        }

        // The path starts from the padded point (p1), not the handle center (p0).
        return `M ${p1.x} ${p1.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p2.x} ${p2.y}`;
    }

    /**
     * Applies the current pan and zoom transformation to the canvas elements.
     */
    updateCanvasTransform() {
        // Create the transform strings for CSS (for HTML nodes) and SVG (for edges)
        const transformCss = `translate(${this.panZoom.offsetX}px, ${this.panZoom.offsetY}px) scale(${this.panZoom.scale})`;
        const transformSvg = `translate(${this.panZoom.offsetX}, ${this.panZoom.offsetY}) scale(${this.panZoom.scale})`;

        // Apply transform to the HTML containers for nodes
        this.groupContainer.style.transform = transformCss;
        this.nodeContainer.style.transform = transformCss;
        
        // Apply the same transform to the SVG group for edges to keep them in sync
        this.canvasGroup.setAttribute('transform', transformSvg);
        
        // The grid pattern is transformed separately to give the illusion of an infinite grid.
        const pattern = this.gridSvg.getElementById('grid-pattern');
        if(pattern) {
            // We transform the pattern inside the SVG definition.
            const gridX = this.panZoom.offsetX;
            const gridY = this.panZoom.offsetY;
            pattern.setAttribute('patternTransform', `translate(${gridX} ${gridY}) scale(${this.panZoom.scale})`);
        }

        // Force-update edges connected to pinned nodes so they follow the pan/zoom
        this.pinnedNodes.forEach(nodeId => {
            this.updateConnectedEdges(nodeId, false); // Don't pluck during simple pan/zoom
        });
    }

    /**
     * Updates all edges connected to a given node.
     * @param {string} nodeId - The ID of the node that has moved.
     * @param {boolean} pluck - Whether to "pluck" the edge to start physics.
     */
    updateConnectedEdges(nodeId, pluck = true) {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        
        // This method is called on visual updates (move, resize, color change)
        this.edges.forEach(edge => {
            let needsUpdate = false;
            if (edge.startNodeId === nodeId) {
                needsUpdate = true;
                // If the node is the start of an edge, its position and color change.
                edge.startPosition = this.getHandlePosition(edge.startNodeId, edge.startHandleId);
                
                // Update the data-color attribute for the pure CSS styling to pick it up.
                const nodeColor = node.color || 'default';
                edge.groupElement.dataset.color = nodeColor;
                
                // Update the marker based on the new color
                const markerState = edge.groupElement.classList.contains('is-hovered') ? 'border-hover' : 'border';
                edge.element.setAttribute('marker-end', `url(#arrowhead-${nodeColor}-${markerState})`);

                this.updateEdge(edge.id);
            } else if (edge.endNodeId === nodeId) {
                needsUpdate = true;
                // If the node is the end of an edge, only its position changes.
                // The color is determined by the start node.
                edge.endPosition = this.getHandlePosition(edge.endNodeId, edge.endHandleId);
                this.updateEdge(edge.id);
            }
            if (needsUpdate && pluck && this.edgeGravity) {
                this.pluckEdge(edge);
            }
        });
        
        // Ensure the node's own handles are correctly reflecting their state
        node.checkConnections();
    }

    // --- Selection Logic ---

    /**
     * Selects all nodes on the canvas.
     */
    selectAll() {
        this.clearSelection();
        this.nodes.forEach(node => this.selectNode(node.id));
        events.publish('selection:changed', {
            selectedNodeIds: Array.from(this.selectedNodes)
        });
    }

    /**
     * Finishes the selection process and identifies selected nodes.
     */
    endSelection() {
        this.selectionState.isSelecting = false;
        this.selectionState.selectionBox.style.display = 'none';

        const box = this.selectionState.selectionBox;
        const selectionRect = {
            left: parseFloat(box.style.left),
            top: parseFloat(box.style.top),
            right: parseFloat(box.style.left) + parseFloat(box.style.width),
            bottom: parseFloat(box.style.top) + parseFloat(box.style.height)
        };
        
        this.nodes.forEach(node => {
            if (this.isNodeInSelection(node, selectionRect)) {
                this.selectNode(node.id);
            }
        });

        this.edges.forEach(edge => {
            if (this.isEdgeInSelection(edge, selectionRect)) {
                this.selectEdge(edge.id);
            }
        });

        events.publish('selection:changed', {
            selectedNodeIds: Array.from(this.selectedNodes),
            selectedEdgeIds: Array.from(this.selectedEdges)
        });
    }

    /**
     * Checks if a node is within the selection rectangle.
     * @param {BaseNode} node The node to check.
     * @param {DOMRect} selectionRect The bounding rectangle of the selection box.
     * @returns {boolean} True if the node is inside the selection.
     */
    isNodeInSelection(node, selectionRect) {
        // Simple overlap check in world space
        return (
            node.x < selectionRect.right &&
            (node.x + node.width) > selectionRect.left &&
            node.y < selectionRect.bottom &&
            (node.y + node.height) > selectionRect.top
        );
    }

    /**
     * Checks if an edge intersects with the selection rectangle.
     * This is done by sampling points along the edge's path.
     * @param {BaseEdge} edge The edge to check.
     * @param {object} selectionRect The selection rectangle in world space.
     * @returns {boolean} True if the edge intersects the selection.
     */
    isEdgeInSelection(edge, selectionRect) {
        if (!edge.element) return false;

        const path = edge.element;
        const len = path.getTotalLength();
        if (len === 0) return false;

        // Sample points along the path
        for (let i = 0; i < len; i += 10) {
            const point = path.getPointAtLength(i);
            if (
                point.x > selectionRect.left &&
                point.x < selectionRect.right &&
                point.y > selectionRect.top &&
                point.y < selectionRect.bottom
            ) {
                return true;
            }
        }
        return false;
    }

    /**
     * Adds a node to the current selection.
     * @param {string} nodeId The ID of the node to select.
     */
    selectNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (node && node.element) {
            this.selectedNodes.add(nodeId);
            node.element.classList.add('is-selected');
            // Do not set z-index here; it's handled by bringToFront on mousedown
        }
    }

    /**
     * Adds an edge to the current selection.
     * @param {string} edgeId The ID of the edge to select.
     */
    selectEdge(edgeId) {
        const edge = this.edges.get(edgeId);
        if (edge && edge.element) {
            this.selectedEdges.add(edgeId);
            edge.element.classList.add('is-selected');
        }
    }

    /**
     * Clears the current selection.
     */
    clearSelection() {
        this.selectedNodes.forEach(nodeId => {
            const node = this.nodes.get(nodeId);
            if (node && node.element) {
                node.element.classList.remove('is-selected');
                // Don't reset z-index here, let nodes keep their stacked order
            }
        });
        this.selectedNodes.clear();

        this.selectedEdges.forEach(edgeId => {
            const edge = this.edges.get(edgeId);
            if (edge && edge.element) {
                edge.element.classList.remove('is-selected');
            }
        });
        this.selectedEdges.clear();
        
        events.publish('selection:changed', { selectedNodeIds: [], selectedEdgeIds: [] });
    }

    // --- Clipboard Logic ---

    /**
     * Copies the selected nodes and their connecting edges to the clipboard.
     */
    copySelection() {
        this.clipboard.nodes = [];
        this.clipboard.edges = [];

        if (this.selectedNodes.size === 0) return;

        // Deep clone the node data
        this.selectedNodes.forEach(nodeId => {
            const node = this.nodes.get(nodeId);
            if (node) {
                // Clone the node data, nullifying DOM-related properties
                const nodeData = { 
                    ...node,
                    element: null, 
                    handles: {},
                    connections: new Map()
                };

                // If the node is pinned, its coordinates are in screen space.
                // Convert them to world space for consistent clipboard data.
                if (node.isPinned) {
                    nodeData.x = (node.x - this.panZoom.offsetX) / this.panZoom.scale;
                    nodeData.y = (node.y - this.panZoom.offsetY) / this.panZoom.scale;
                }

                // Serialize containedNodeIds if it's a GroupNode
                if (node instanceof GroupNode) {
                    nodeData.containedNodeIds = Array.from(node.containedNodeIds);
                }

                this.clipboard.nodes.push(nodeData);
            }
        });

        // Find and clone ANY edge connected to the selection
        this.edges.forEach(edge => {
            if (this.selectedNodes.has(edge.startNodeId) || this.selectedNodes.has(edge.endNodeId)) {
                this.clipboard.edges.push({ ...edge, element: null, groupElement: null, hitArea: null, labelElement: null });
            }
        });
        
        console.log(`Copied ${this.clipboard.nodes.length} nodes and ${this.clipboard.edges.length} edges.`);
    }

    /**
     * Cuts the selected nodes by copying them and then deleting them.
     */
    cutSelection() {
        this.copySelection();

        // Delete the original nodes and edges
        this.selectedNodes.forEach(nodeId => events.publish('node:delete', nodeId));
        this.clipboard.edges.forEach(edge => events.publish('edge:delete', edge.id));
        
        this.clearSelection();
    }

    /**
     * Pastes nodes and edges from the clipboard onto the canvas at the mouse location.
     */
    paste() {
        if (this.clipboard.nodes.length === 0) return;

        const idMap = new Map(); // Maps old IDs to new IDs
        const nodesToPin = [];   // Keep track of nodes that should be pinned after creation

        // For a more predictable paste, use the last known mouse position
        const pasteCenter = this.getMousePosition(this.lastMousePosition) || { x: 100, y: 100 };
        
        // Find the geometric center of the copied nodes (all now in world space)
        let totalX = 0, totalY = 0;
        this.clipboard.nodes.forEach(node => {
            totalX += node.x + node.width / 2;
            totalY += node.y + node.height / 2;
        });
        const groupCenterX = totalX / this.clipboard.nodes.length;
        const groupCenterY = totalY / this.clipboard.nodes.length;

        // Create new nodes with calculated positions
        this.clipboard.nodes.forEach(nodeData => {
            const oldId = nodeData.id;
            const newId = crypto.randomUUID();
            idMap.set(oldId, newId);

            // Calculate new position relative to the group's center and paste location
            const offsetX = nodeData.x - groupCenterX;
            const offsetY = nodeData.y - groupCenterY;

            // Create a copy, but explicitly set isPinned to false for initial creation.
            // The real pinned state from nodeData.isPinned will be applied later via updateNode.
            const newNodeData = {
                id: newId,
                x: pasteCenter.x + offsetX,
                y: pasteCenter.y + offsetY,
                width: nodeData.width,
                height: nodeData.height,
                title: nodeData.title,
                content: nodeData.content,
                type: nodeData.type,
                color: nodeData.color,
                isPinned: false, // Create as unpinned; will be updated to pinned later
                containedNodeIds: nodeData.containedNodeIds
            };

            // Instantiate the correct class based on the node type
            if (newNodeData.type === 'RoutingNode') {
                this.addNode(new RoutingNode(newNodeData));
            } else if (newNodeData.type === 'GroupNode') {
                this.addNode(new GroupNode(newNodeData));
            } else if (newNodeData.type === 'LogNode') {
                this.addNode(new LogNode(newNodeData));
            } else if (newNodeData.type === 'SettingsNode') {
                this.addNode(new SettingsNode(newNodeData));
            }
            else {
                this.addNode(new BaseNode(newNodeData));
            }

            // If the original node in the clipboard was pinned, mark the new one to be pinned.
            if (nodeData.isPinned) {
                nodesToPin.push(newId);
            }
        });

        // Create new edges with updated node IDs and positions
        this.clipboard.edges.forEach(edgeData => {
            const newStartNodeId = idMap.get(edgeData.startNodeId) || edgeData.startNodeId;
            const newEndNodeId = idMap.get(edgeData.endNodeId) || edgeData.endNodeId;

            if (idMap.has(edgeData.startNodeId) || idMap.has(edgeData.endNodeId)) {
                events.publish('edge:create', {
                    startNodeId: newStartNodeId,
                    endNodeId: newEndNodeId,
                    startHandleId: edgeData.startHandleId,
                    endHandleId: edgeData.endHandleId
                });
            }
        });

        // After all nodes are created, apply the pinned state.
        // This triggers the `reparentNode` logic to move them to the correct container.
        nodesToPin.forEach(nodeId => {
            this.updateNode({ nodeId: nodeId, isPinned: true });
        });

        // Select the newly pasted nodes
        this.clearSelection();
        idMap.forEach(newNodeId => this.selectNode(newNodeId));

        events.publish('selection:changed', {
            selectedNodeIds: Array.from(this.selectedNodes)
        });

        console.log(`Pasted ${this.clipboard.nodes.length} nodes.`);
    }

    // --- Edge Cutting Logic ---

    startCuttingLine(event) {
        const mousePos = this.getMousePosition(event);
        this.edgeCutState.startX = mousePos.x;
        this.edgeCutState.startY = mousePos.y;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('cut-line');
        line.setAttribute('x1', mousePos.x);
        line.setAttribute('y1', mousePos.y);
        line.setAttribute('x2', mousePos.x);
        line.setAttribute('y2', mousePos.y);
        
        this.canvasGroup.appendChild(line);
        this.edgeCutState.cutLine = line;
    }

    updateCuttingLine(event) {
        if (!this.edgeCutState.cutLine) return;
        const mousePos = this.getMousePosition(event);
        this.edgeCutState.cutLine.setAttribute('x2', mousePos.x);
        this.edgeCutState.cutLine.setAttribute('y2', mousePos.y);
    }

    endCuttingLine(performCut = true) {
        if (!this.edgeCutState.cutLine) return;
        
        if (performCut) {
            const x1 = parseFloat(this.edgeCutState.cutLine.getAttribute('x1'));
            const y1 = parseFloat(this.edgeCutState.cutLine.getAttribute('y1'));
            const x2 = parseFloat(this.edgeCutState.cutLine.getAttribute('x2'));
            const y2 = parseFloat(this.edgeCutState.cutLine.getAttribute('y2'));
    
            this.edges.forEach(edge => {
                const path = edge.element;
                const len = path.getTotalLength();
                for (let i = 0; i < len; i += 5) {
                    const p1 = path.getPointAtLength(i);
                    const p2 = path.getPointAtLength(i + 5 > len ? len : i + 5);
                    if (this.lineIntersect(x1, y1, x2, y2, p1.x, p1.y, p2.x, p2.y)) {
                        events.publish('edge:delete', edge.id);
                        break; 
                    }
                }
            });
        }

        this.edgeCutState.cutLine.remove();
        this.edgeCutState.cutLine = null;
    }

    lineIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
        const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (den === 0) {
            return false;
        }
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;

        return t > 0 && t < 1 && u > 0 && u < 1;
    }

    // --- Snapping Logic ---
    
    checkForSnapping(draggedNode, currentX, currentY) {
        this.clearGuides();
        let snapX = currentX;
        let snapY = currentY;

        const draggedBounds = {
            left: currentX,
            top: currentY,
            right: currentX + draggedNode.width,
            bottom: currentY + draggedNode.height,
            hCenter: currentX + draggedNode.width / 2,
            vCenter: currentY + draggedNode.height / 2
        };

        const nodeColor = getComputedStyle(draggedNode.element).getPropertyValue(`--color-node-${draggedNode.color}-border`);

        this.nodes.forEach(staticNode => {
            if (staticNode.id === draggedNode.id) return;

            const staticBounds = {
                left: staticNode.x,
                top: staticNode.y,
                right: staticNode.x + staticNode.width,
                bottom: staticNode.y + staticNode.height,
                hCenter: staticNode.x + staticNode.width / 2,
                vCenter: staticNode.y + staticNode.height / 2
            };

            // --- Vertical Snapping ---
            if (Math.abs(draggedBounds.left - staticBounds.left) < this.snapThreshold) { snapX = staticBounds.left; this.drawGuide(staticBounds.left, 'v', nodeColor); }
            if (Math.abs(draggedBounds.right - staticBounds.right) < this.snapThreshold) { snapX = staticBounds.right - draggedNode.width; this.drawGuide(staticBounds.right, 'v', nodeColor); }
            if (Math.abs(draggedBounds.hCenter - staticBounds.hCenter) < this.snapThreshold) { snapX = staticBounds.hCenter - draggedNode.width / 2; this.drawGuide(staticBounds.hCenter, 'v', nodeColor); }
            
            // --- Horizontal Snapping ---
            if (Math.abs(draggedBounds.top - staticBounds.top) < this.snapThreshold) { snapY = staticBounds.top; this.drawGuide(staticBounds.top, 'h', nodeColor); }
            if (Math.abs(draggedBounds.bottom - staticBounds.bottom) < this.snapThreshold) { snapY = staticBounds.bottom - draggedNode.height; this.drawGuide(staticBounds.bottom, 'h', nodeColor); }
            if (Math.abs(draggedBounds.vCenter - staticBounds.vCenter) < this.snapThreshold) { snapY = staticBounds.vCenter - draggedNode.height / 2; this.drawGuide(staticBounds.vCenter, 'h', nodeColor); }
        });

        return { x: snapX, y: snapY };
    }

    drawGuide(val, orientation, color = 'var(--color-danger)') {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('snap-guide');
        line.style.stroke = color;
        if (orientation === 'v') {
            line.setAttribute('x1', val);
            line.setAttribute('y1', -10000);
            line.setAttribute('x2', val);
            line.setAttribute('y2', 10000);
        } else {
            line.setAttribute('x1', -10000);
            line.setAttribute('y1', val);
            line.setAttribute('x2', 10000);
            line.setAttribute('y2', val);
        }
        this.guideGroup.appendChild(line);
    }
    
    clearGuides() {
        while (this.guideGroup.firstChild) {
            this.guideGroup.removeChild(this.guideGroup.firstChild);
        }
    }

    /**
     * Handles the context menu event.
     * @param {MouseEvent} event 
     */
    onContextMenu(event) {
        // Only show context menu for events inside the app's containers
        const isInsideContainer = event.target.closest('#canvas-container') || event.target.closest('#pinned-node-container');
        if (!isInsideContainer) {
            return;
        }

        event.preventDefault();
        
        const target = event.target;
        const nodeElement = target.closest('.node');
        const edgeHitArea = target.closest('.edge-hit-area');
        
        if (edgeHitArea) {
            const edgeId = edgeHitArea.parentElement.querySelector('.edge').id;
            const edge = this.edges.get(edgeId);

            // If right-clicking on an edge that isn't part of a multi-selection,
            // clear the current selection and select just this edge.
            if (edge && !this.selectedEdges.has(edge.id)) {
                this.clearSelection();
                this.selectEdge(edge.id);
                events.publish('selection:changed', {
                    selectedNodeIds: Array.from(this.selectedNodes),
                    selectedEdgeIds: Array.from(this.selectedEdges)
                });
            }
            this.showEdgeContextMenu(event.clientX, event.clientY, edgeId);
        } else if (nodeElement) {
            const node = this.nodes.get(nodeElement.id);

            // If right-clicking on a node that isn't part of a multi-selection,
            // clear the current selection and select just this node.
            if (!this.selectedNodes.has(node.id)) {
                this.clearSelection();
                this.selectNode(node.id);
                events.publish('selection:changed', {
                    selectedNodeIds: Array.from(this.selectedNodes),
                    selectedEdgeIds: Array.from(this.selectedEdges)
                });
            }

            if (node instanceof RoutingNode) {
                // On right-click, cycle the color.
                this.cycleRoutingNodeColor(node.id);
            } else {
                // For other nodes, show the default canvas menu.
                this.showCanvasContextMenu(event.clientX, event.clientY);
            }
        } else {
            this.showCanvasContextMenu(event.clientX, event.clientY);
        }
    }

    /**
     * Shows the main canvas context menu.
     * @param {number} x The screen x-coordinate.
     * @param {number} y The screen y-coordinate.
     * @param {object|null} edgeStartInfo - Information about a pending edge connection.
     */
    showCanvasContextMenu(x, y, edgeStartInfo = null) {
        const worldPos = this.getMousePosition({ clientX: x, clientY: y });
        let items = [];

        // Define potential node types to create
        const nodeCreationActions = [
            { 
                key: 'note',
                type: 'BaseNode',
            },
            {
                key: 'group',
                type: 'GroupNode',
            },
            {
                key: 'routingNode',
                type: 'RoutingNode',
            },
            {
                key: 'settings',
                type: 'SettingsNode',
            },
            {
                key: 'log',
                type: 'LogNode',
            }
        ];

        nodeCreationActions.forEach(action => {
            const menuConfig = this.contextMenuSettings.canvas[action.key];
            if (!menuConfig) return;

            items.push({
                label: menuConfig.label,
                iconClass: menuConfig.iconClass,
                action: () => {
                    let newNode;
                    if (action.type === 'RoutingNode') {
                        newNode = new RoutingNode({ x: worldPos.x, y: worldPos.y });
                    } else if (action.type === 'GroupNode') {
                        newNode = new GroupNode({ x: worldPos.x, y: worldPos.y });
                    } else if (action.type === 'LogNode') {
                        newNode = new LogNode({ x: worldPos.x, y: worldPos.y });
                    } else if (action.type === 'SettingsNode') {
                        newNode = new SettingsNode({ x: worldPos.x, y: worldPos.y });
                    }
                    else {
                        newNode = new BaseNode({ x: worldPos.x, y: worldPos.y, title: menuConfig.label, type: action.type });
                    }
                    this.addNode(newNode);

                    if (edgeStartInfo) {
                        const startNode = this.nodes.get(edgeStartInfo.startNodeId);
                        if (startNode) {
                            const endHandlePosition = this.getOptimalHandle(startNode, newNode);
                            events.publish('edge:create', {
                                startNodeId: edgeStartInfo.startNodeId,
                                startHandleId: edgeStartInfo.startHandleId,
                                endNodeId: newNode.id,
                                endHandleId: endHandlePosition
                            });
                        }
                    }
                    if (this.edgeDrawingState.isDrawing) {
                        this.cancelDrawingEdge();
                    }
                }
            });
        });
        
        // Add other context menu items if not in edge-draw mode
        if (!edgeStartInfo) {
            // Background color submenu
            const backgroundSubmenu = [];
            const colors = ['default', 'red', 'green', 'blue', 'yellow', 'purple'];
            
            colors.forEach(color => {
                // The value to set for the overlay. 'transparent' for default, or the var for others.
                const finalValue = color === 'default' ? 'transparent' : `var(--color-bg-canvas-${color})`;
            
                // The color for the swatch preview. The actual color for colored ones, the base color for default.
                const swatchColorVar = color === 'default' ? '--color-bg-default' : `--color-bg-canvas-${color}`;
                
                backgroundSubmenu.push({
                    label: color.charAt(0).toUpperCase() + color.slice(1),
                    iconHtml: `<span class="context-menu-swatch" style="background-color: var(${swatchColorVar})"></span>`,
                    action: () => {
                        document.documentElement.style.setProperty('--color-bg-canvas', finalValue);
                    }
                });
            });

            // Snap settings
            items.push({ isSeparator: true });
            items.push({
                label: this.contextMenuSettings.canvas.changeBackground.label,
                iconClass: this.contextMenuSettings.canvas.changeBackground.iconClass,
                submenu: backgroundSubmenu
            });
            const snapGridLabel = `${this.contextMenuSettings.canvas.snapGrid.label}: ${this.snapToGrid ? 'On' : 'Off'}`;
            const snapObjectLabel = `${this.contextMenuSettings.canvas.snapObject.label}: ${this.snapToObjects ? 'On' : 'Off'}`;
            
            items.push(
                { 
                    label: snapGridLabel,
                    iconClass: this.contextMenuSettings.canvas.snapGrid.iconClass,
                    action: () => events.publish('snap:grid-toggle') 
                },
                {
                    label: snapObjectLabel,
                    iconClass: this.contextMenuSettings.canvas.snapObject.iconClass,
                    action: () => events.publish('snap:object-toggle')
                }
            );

            // Clipboard actions
            items.push({ isSeparator: true });
            const hasSelection = this.selectedNodes.size > 0 || this.selectedEdges.size > 0;
            const clipboardHasContent = this.clipboard.nodes.length > 0;
            const menu = this.contextMenuSettings.canvas;

            items.push({
                label: menu.cut.label,
                iconClass: menu.cut.iconClass,
                action: () => this.cutSelection(),
                disabled: !hasSelection
            });
            items.push({
                label: menu.copy.label,
                iconClass: menu.copy.iconClass,
                action: () => this.copySelection(),
                disabled: !hasSelection
            });
            items.push({
                label: menu.paste.label,
                iconClass: menu.paste.iconClass,
                action: () => this.paste(),
                disabled: !clipboardHasContent
            });
            items.push({
                label: menu.delete.label,
                iconClass: menu.delete.iconClass,
                action: () => this.deleteSelection(),
                disabled: !hasSelection
            });
        }

        this.contextMenu.show(x, y, items);
    }

    /**
     * Shows the context menu for a specific edge.
     * @param {number} x The screen x-coordinate.
     * @param {number} y The screen y-coordinate.
     * @param {string} edgeId The ID of the edge.
     */
    showEdgeContextMenu(x, y, edgeId) {
        const edge = this.edges.get(edgeId);
        if (!edge) return;

        const hasSelection = this.selectedNodes.size > 0 || this.selectedEdges.size > 0;
        const menu = this.contextMenuSettings.edge;

        const items = [
            {
                label: menu.edit.label,
                iconClass: menu.edit.iconClass,
                inlineEdit: true,
                initialValue: edge.label,
                onEdit: (newLabel) => {
                    events.publish('edge:update', { edgeId: edge.id, label: newLabel });
                }
            },
            {
                label: menu.addRoutingNode.label,
                iconClass: menu.addRoutingNode.iconClass,
                action: () => {
                    // Find the midpoint of the edge to place the new node
                    const p1 = edge.startPosition;
                    const p2 = edge.endPosition;
                    const midX = (p1.x + p2.x) / 2;
                    const midY = (p1.y + p2.y) / 2;

                    const routingNode = new RoutingNode({ x: midX, y: midY });
                    this.addNode(routingNode);
                    
                    // Create two new edges connecting to the new routing node
                    events.publish('edge:create', { startNodeId: edge.startNodeId, startHandleId: edge.startHandleId, endNodeId: routingNode.id, endHandleId: 'left' });
                    events.publish('edge:create', { startNodeId: routingNode.id, startHandleId: 'right', endNodeId: edge.endNodeId, endHandleId: edge.endHandleId });
                    
                    // Delete the original edge
                    events.publish('edge:delete', edge.id);
                }
            },
            { isSeparator: true },
            {
                label: menu.delete.label,
                iconClass: menu.delete.iconClass,
                action: () => this.deleteSelection(),
                disabled: !hasSelection
            }
        ];
        this.contextMenu.show(x, y, items);
    }

    /**
     * Creates an inline editor for an edge's label.
     * @param {BaseEdge} edge The edge to edit.
     */
    editEdgeLabel(edge) {
        if (!edge || !edge.labelElement) return;

        // Hide the SVG label
        edge.labelElement.style.visibility = 'hidden';

        // Get the position of the SVG label to place the editor
        // We use getBoundingClientRect because it gives us the final screen position after all SVG transforms
        const labelRect = edge.labelElement.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();

        // Create the editor element
        const editor = document.createElement('input');
        editor.type = 'text';
        editor.className = 'edge-label-editor';
        editor.value = edge.label || '';
        document.body.appendChild(editor);

        // Position the editor over the now-hidden SVG label
        const editorWidth = Math.max(80, labelRect.width + 20);
        editor.style.width = `${editorWidth}px`;
        editor.style.left = `${labelRect.left + (labelRect.width / 2) - (editorWidth / 2) - containerRect.left}px`;
        editor.style.top = `${labelRect.top + (labelRect.height / 2) - (editor.offsetHeight / 2) - containerRect.top}px`;
        
        editor.focus();
        editor.select();

        const finishEditing = (saveChanges) => {
            if (saveChanges) {
                const newLabel = editor.value;
                if (newLabel !== edge.label) {
                    events.publish('edge:update', { edgeId: edge.id, label: newLabel });
                }
            }
            // Cleanup
            document.body.removeChild(editor);
            edge.labelElement.style.visibility = 'visible';
        };

        // Use a one-time event listener for blur to prevent issues
        const blurHandler = () => {
            finishEditing(true);
            editor.removeEventListener('blur', blurHandler);
        };
        editor.addEventListener('blur', blurHandler);

        editor.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                finishEditing(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                finishEditing(false);
            }
        });
    }

    /**
     * Toggles the snap-to-grid functionality.
     * @param {boolean} [force] - Optional boolean to force a state.
     */
    toggleSnapToGrid(force) {
        if (typeof force === 'boolean') {
            this.snapToGrid = force ? 20 : 0;
        } else {
            this.snapToGrid = this.snapToGrid ? 0 : 20;
        }
        console.log(`Snap to grid is now ${this.snapToGrid ? 'enabled' : 'disabled'}`);
        this.publishSettings();
    }

    /**
     * Toggles the snap-to-objects functionality.
     * @param {boolean} [force] - Optional boolean to force a state.
     */
    toggleSnapToObjects(force) {
        if (typeof force === 'boolean') {
            this.snapToObjects = force;
        } else {
            this.snapToObjects = !this.snapToObjects;
        }
        console.log(`Snap to objects is now ${this.snapToObjects ? 'enabled' : 'disabled'}`);
        this.publishSettings();
    }

    /**
     * Determines the most logical handle on an end node for a new connection
     * based on the relative position of the start node.
     * @param {BaseNode} startNode The node where the edge originates.
     * @param {BaseNode} endNode The newly created node where the edge will terminate.
     * @returns {string} The handle position ('top', 'right', 'bottom', 'left').
     */
    getOptimalHandle(startNode, endNode) {
        const dx = (endNode.x + endNode.width / 2) - (startNode.x + startNode.width / 2);
        const dy = (endNode.y + endNode.height / 2) - (startNode.y + startNode.height / 2);

        if (Math.abs(dx) > Math.abs(dy)) {
            // More horizontal than vertical
            return dx > 0 ? 'left' : 'right';
        } else {
            // More vertical than horizontal
            return dy > 0 ? 'top' : 'bottom';
        }
    }

    /**
     * Updates a node's properties based on an event.
     * @param {{nodeId: string, [key: string]: any}} data The update data.
     */
    updateNode(data) {
        const node = this.nodes.get(data.nodeId);
        if (node) {
            const oldPinnedState = node.isPinned;
            node.update(data);

            // Handle cascading pin for groups
            if (node instanceof GroupNode && data.isPinned !== undefined) {
                const containedNodes = this.getAllContainedNodes(node);
                containedNodes.forEach(childNode => {
                    this.updateNode({ nodeId: childNode.id, isPinned: data.isPinned });
                });
            }

            if (data.isPinned !== undefined && oldPinnedState !== data.isPinned) {
                this.reparentNode(data.nodeId);
            }
        }
    }

    /**
     * Recursively gets all nodes contained within a group, including those in nested groups.
     * @param {GroupNode} groupNode The parent group.
     * @returns {Set<BaseNode>} A set of all contained node instances.
     */
    getAllContainedNodes(groupNode) {
        const allNodes = new Set();
        const queue = [...groupNode.containedNodeIds];
        
        while (queue.length > 0) {
            const nodeId = queue.shift();
            const node = this.nodes.get(nodeId);
            if (node) {
                allNodes.add(node);
                if (node instanceof GroupNode) {
                    node.containedNodeIds.forEach(childId => queue.push(childId));
                }
            }
        }
        return allNodes;
    }

    // --- Resize Logic ---

    /**
     * Initiates the resize state for a node.
     * @param {string} nodeId - The ID of the node to resize.
     * @param {MouseEvent} event - The triggering mouse event.
     * @param {string} direction - The direction of the resize ('n', 's', 'e', 'w', etc.).
     */
    startResize(nodeId, event, direction) {
        const node = this.nodes.get(nodeId);
        if (!node) return;

        event.stopPropagation(); // Prevent drag from firing

        this.resizingState = {
            isResizing: true,
            targetNode: node,
            startX: event.clientX,
            startY: event.clientY,
            originalX: node.x,
            originalY: node.y,
            originalWidth: node.width,
            originalHeight: node.height,
            direction: direction
        };
    }

    /**
     * Ends the current resizing state.
     */
    endResize() {
        if (!this.resizingState.isResizing) return;
        
        const { targetNode } = this.resizingState;
        if (targetNode) {
            events.publish('node:resized', {
                nodeId: targetNode.id,
                x: targetNode.x,
                y: targetNode.y,
                width: targetNode.width,
                height: targetNode.height
            });
        }
        
        this.resizingState.isResizing = false;
        this.resizingState.targetNode = null;
    }

    /**
     * Checks for snapping guides during node resizing.
     * @param {BaseNode} resizingNode The node being resized.
     * @param {number} currentWidth The proposed new width.
     * @param {number} currentHeight The proposed new height.
     * @returns {{width: number, height: number}} The snapped dimensions.
     */
    checkForResizeSnapping(resizingNode, currentX, currentY, currentWidth, currentHeight, direction) {
        this.clearGuides();
        let snappedX = currentX;
        let snappedY = currentY;
        let snappedWidth = currentWidth;
        let snappedHeight = currentHeight;

        const { originalX, originalY, originalWidth, originalHeight } = this.resizingState;
        const nodeColor = getComputedStyle(resizingNode.element).getPropertyValue(`--color-node-${resizingNode.color}-border`);

        this.nodes.forEach(staticNode => {
            if (staticNode.id === resizingNode.id) return;

            const staticBounds = {
                left: staticNode.x,
                top: staticNode.y,
                right: staticNode.x + staticNode.width,
                bottom: staticNode.y + staticNode.height,
                hCenter: staticNode.x + staticNode.width / 2,
                vCenter: staticNode.y + staticNode.height / 2
            };

            // --- Vertical Snapping (affects X and Width) ---
            if (direction.includes('w')) {
                const newLeft = currentX;
                if (Math.abs(newLeft - staticBounds.left) < this.snapThreshold) {
                    snappedX = staticBounds.left;
                    snappedWidth = originalX + originalWidth - snappedX;
                    this.drawGuide(staticBounds.left, 'v', nodeColor);
                }
                if (Math.abs(newLeft - staticBounds.right) < this.snapThreshold) {
                    snappedX = staticBounds.right;
                    snappedWidth = originalX + originalWidth - snappedX;
                    this.drawGuide(staticBounds.right, 'v', nodeColor);
                }
            }
            if (direction.includes('e')) {
                const newRight = currentX + currentWidth;
                if (Math.abs(newRight - staticBounds.right) < this.snapThreshold) {
                    snappedWidth = staticBounds.right - snappedX;
                    this.drawGuide(staticBounds.right, 'v', nodeColor);
                }
                if (Math.abs(newRight - staticBounds.left) < this.snapThreshold) {
                    snappedWidth = staticBounds.left - snappedX;
                    this.drawGuide(staticBounds.left, 'v', nodeColor);
                }
            }

            // --- Horizontal Snapping (affects Y and Height) ---
            if (direction.includes('n')) {
                const newTop = currentY;
                if (Math.abs(newTop - staticBounds.top) < this.snapThreshold) {
                    snappedY = staticBounds.top;
                    snappedHeight = originalY + originalHeight - snappedY;
                    this.drawGuide(staticBounds.top, 'h', nodeColor);
                }
                if (Math.abs(newTop - staticBounds.bottom) < this.snapThreshold) {
                    snappedY = staticBounds.bottom;
                    snappedHeight = originalY + originalHeight - snappedY;
                    this.drawGuide(staticBounds.bottom, 'h', nodeColor);
                }
            }
            if (direction.includes('s')) {
                const newBottom = currentY + currentHeight;
                if (Math.abs(newBottom - staticBounds.bottom) < this.snapThreshold) {
                    snappedHeight = staticBounds.bottom - snappedY;
                    this.drawGuide(staticBounds.bottom, 'h', nodeColor);
                }
                if (Math.abs(newBottom - staticBounds.top) < this.snapThreshold) {
                    snappedHeight = staticBounds.top - snappedY;
                    this.drawGuide(staticBounds.top, 'h', nodeColor);
                }
            }
        });

        return { x: snappedX, y: snappedY, width: snappedWidth, height: snappedHeight };
    }

    /**
     * Toggles the visibility of a node's popover.
     * @param {string} nodeId The ID of the node to toggle the popover for.
     */
    toggleNodePopover(nodeId) {
        const currentlyOpenNodeId = this.openPopoverNodeId;
        
        // Close any currently open popover
        if (currentlyOpenNodeId && currentlyOpenNodeId !== nodeId) {
            const oldNode = this.nodes.get(currentlyOpenNodeId);
            if (oldNode) {
                oldNode.element.classList.remove('is-popover-open');
                oldNode.popoverElement.innerHTML = ''; // Clear content
            }
        }
        
        const node = this.nodes.get(nodeId);
        if (!node) return;

        const isOpen = node.element.classList.toggle('is-popover-open');
        
        if (isOpen) {
            this.openPopoverNodeId = nodeId;
            node.popoverElement.innerHTML = node.getPopoverContent();
            this.addPopoverListeners(node);
        } else {
            this.openPopoverNodeId = null;
            node.popoverElement.innerHTML = ''; // Clear content
        }
    }

    /**
     * Adds event listeners to the controls inside a node's popover.
     * @param {BaseNode} node The node whose popover needs listeners.
     */
    addPopoverListeners(node) {
        const popoverEl = node.popoverElement;
        if (!popoverEl) return;

        // Debounced input handler for the title
        const debounce = (func, delay) => {
            let timeout;
            return (...args) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), delay);
            };
        };
        const debouncedTitleUpdate = debounce((newTitle) => {
            events.publish('node:update', { nodeId: node.id, title: newTitle });
        }, 500);

        const titleInput = popoverEl.querySelector('.popover-input');
        titleInput.addEventListener('input', (e) => debouncedTitleUpdate(e.target.value));

        popoverEl.querySelectorAll('.popover-color-swatch').forEach(swatch => {
            swatch.addEventListener('click', (e) => {
                const newColor = e.target.dataset.color;
                events.publish('node:update', { nodeId: node.id, color: newColor });
                this.toggleNodePopover(node.id); // Close popover after selection
            });
        });

        const deleteButton = popoverEl.querySelector('.popover-delete-button');
        if (deleteButton) {
            deleteButton.addEventListener('click', () => {
                events.publish('node:delete', node.id);
                this.toggleNodePopover(node.id); // Close popover
            });
        }
    }

    /**
     * Checks if a node was shaken during a drag and releases its connections if so.
     * @param {BaseNode} node The node that was dragged.
     */
    checkForShake(node) {
        if (this.draggingState.shakeCooldown) return;

        const history = this.draggingState.shakeHistory;
        if (history.length < 4) return; // Need at least a few points to detect a shake

        let directionChanges = 0;
        for (let i = 1; i < history.length - 1; i++) {
            const dx1 = history[i].x - history[i-1].x;
            const dx2 = history[i+1].x - history[i].x;
            const dy1 = history[i].y - history[i-1].y;
            const dy2 = history[i+1].y - history[i].y;

            // Check for a change in direction (sign change)
            if ((dx1 * dx2 < 0) || (dy1 * dy2 < 0)) {
                directionChanges++;
            }
        }

        // If there are enough rapid direction changes, it's a shake.
        if (directionChanges > this.shakeSensitivity) {
            console.log(`Node ${node.id} was shaken! Releasing connections.`);
            this.edges.forEach(edge => {
                if (edge.startNodeId === node.id || edge.endNodeId === node.id) {
                    events.publish('edge:delete', edge.id);
                }
            });
            this.draggingState.shakeCooldown = true; // Activate cooldown
            this.draggingState.shakeHistory = []; // Clear history to prevent re-triggering
        }
    }

    /**
     * Cycles through the available colors for a given node.
     * @param {string} nodeId The ID of the node to cycle the color for.
     */
    cycleNodeColor(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return;

        const colors = ['default', 'red', 'green', 'blue', 'yellow', 'purple'];
        const currentIndex = colors.indexOf(node.color);
        const nextIndex = (currentIndex + 1) % colors.length;
        const newColor = colors[nextIndex];

        events.publish('node:update', { nodeId, color: newColor });
    }

    /**
     * Adds a new routing point to an edge.
     * If event is provided, adds at that location.
     * If event is null, adds to the center of the longest segment.
     * @param {string} edgeId The ID of the edge to add a point to.
     * @param {MouseEvent|null} event The dblclick event or null.
     */
    addRoutingPoint(edgeId, event) {
        const edge = this.edges.get(edgeId);
        if (!edge) return;
        
        const allPoints = [edge.startPosition, ...edge.routingPoints, edge.endPosition];
        let insertIndex = 0;
        let point;

        if (event) {
            point = this.getMousePosition(event);
            let minDistance = Infinity;
            for (let i = 0; i < allPoints.length - 1; i++) {
                const dist = this.distanceToSegment(point, allPoints[i], allPoints[i+1]);
                if (dist < minDistance) {
                    minDistance = dist;
                    insertIndex = i + 1;
                }
            }
        } else {
            // Find the longest segment to add the point to its center
            let longestDist = -1;
            for (let i = 0; i < allPoints.length - 1; i++) {
                const dist = Math.hypot(allPoints[i+1].x - allPoints[i].x, allPoints[i+1].y - allPoints[i].y);
                if (dist > longestDist) {
                    longestDist = dist;
                    insertIndex = i + 1;
                }
            }
            const p1 = allPoints[insertIndex - 1];
            const p2 = allPoints[insertIndex];
            point = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        }
        
        edge.routingPoints.splice(insertIndex - 1, 0, point);
        this.renderRoutingPoints(edge);
        this.updateEdge(edge.id);
    }

    /**
     * Renders the draggable handles for an edge's routing points.
     * @param {BaseEdge} edge The edge to render points for.
     */
    renderRoutingPoints(edge) {
        // Clear existing points
        edge.routingPointElements.forEach(el => el.remove());
        edge.routingPointElements = [];

        edge.routingPoints.forEach((point, index) => {
            const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            handle.classList.add('edge-routing-handle');
            handle.setAttribute('cx', point.x);
            handle.setAttribute('cy', point.y);
            handle.setAttribute('r', '5');
            handle.dataset.edgeId = edge.id;
            handle.dataset.pointIndex = index;
            this.canvasGroup.appendChild(handle);
            edge.routingPointElements.push(handle);
        });
    }

    /**
     * Calculates the shortest distance from a point to a line segment.
     * @param {{x,y}} p The point.
     * @param {{x,y}} v The start of the line segment.
     * @param {{x,y}} w The end of the line segment.
     * @returns {number} The distance.
     */
    distanceToSegment(p, v, w) {
        const l2 = (v.x - w.x)**2 + (v.y - w.y)**2;
        if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        const closestX = v.x + t * (w.x - v.x);
        const closestY = v.y + t * (w.y - v.y);
        return Math.hypot(p.x - closestX, p.y - closestY);
    }

    /**
     * Handles the edge:selected event to toggle selection.
     * @param {{edgeId: string, isSelected: boolean, isMultiSelect: boolean}} data 
     */
    onEdgeSelected({ edgeId, isSelected, isMultiSelect }) {
        if (!isMultiSelect) {
            this.clearSelection();
        }

        if (isSelected) {
            this.selectEdge(edgeId);
        } else {
            this.deselectEdge(edgeId);
        }

        events.publish('selection:changed', { 
            selectedNodeIds: Array.from(this.selectedNodes),
            selectedEdgeIds: Array.from(this.selectedEdges)
        });
    }

    /**
     * Removes an edge from the current selection.
     * @param {string} edgeId The ID of the edge to deselect.
     */
    deselectEdge(edgeId) {
        const edge = this.edges.get(edgeId);
        if (edge && edge.element) {
            this.selectedEdges.delete(edgeId);
            edge.element.classList.remove('is-selected');
        }
    }

    // --- Routing Cut Logic ---

    startRoutingCut(event) {
        const mousePos = this.getMousePosition(event);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('routing-cut-line');
        line.setAttribute('x1', mousePos.x);
        line.setAttribute('y1', mousePos.y);
        line.setAttribute('x2', mousePos.x);
        line.setAttribute('y2', mousePos.y);
        this.canvasGroup.appendChild(line);
        this.routingCutState.cutLine = line;
    }

    updateRoutingCut(event) {
        if (!this.routingCutState.cutLine) return;
        const mousePos = this.getMousePosition(event);
        this.routingCutState.cutLine.setAttribute('x2', mousePos.x);
        this.routingCutState.cutLine.setAttribute('y2', mousePos.y);
    }

    endRoutingCut() {
        if (!this.routingCutState.cutLine) return;

        const line = this.routingCutState.cutLine;
        const p1 = { x: parseFloat(line.getAttribute('x1')), y: parseFloat(line.getAttribute('y1')) };
        const p2 = { x: parseFloat(line.getAttribute('x2')), y: parseFloat(line.getAttribute('y2')) };
        let hasCut = false;

        this.edges.forEach(edge => {
            if (hasCut) return; // Only cut the first intersected edge

            const path = edge.element;
            const len = path.getTotalLength();
            for (let i = 0; i < len; i += 5) {
                const point1 = path.getPointAtLength(i);
                const point2 = path.getPointAtLength(i + 5 > len ? len : i + 5);
                const intersection = this.getLineIntersection(p1, p2, point1, point2);
                if (intersection) {
                    const routingNode = new RoutingNode({ x: intersection.x, y: intersection.y });
                    this.addNode(routingNode);
                    
                    // Create two new edges
                    events.publish('edge:create', { startNodeId: edge.startNodeId, startHandleId: edge.startHandleId, endNodeId: routingNode.id, endHandleId: 'left' });
                    events.publish('edge:create', { startNodeId: routingNode.id, startHandleId: 'right', endNodeId: edge.endNodeId, endHandleId: edge.endHandleId });
                    
                    // Delete the original edge
                    events.publish('edge:delete', edge.id);
                    
                    hasCut = true;
                    break;
                }
            }
        });

        line.remove();
        this.routingCutState.cutLine = null;
    }

    getLineIntersection(p0, p1, p2, p3) {
        const s1_x = p1.x - p0.x;
        const s1_y = p1.y - p0.y;
        const s2_x = p3.x - p2.x;
        const s2_y = p3.y - p2.y;
    
        const s = (-s1_y * (p0.x - p2.x) + s1_x * (p0.y - p2.y)) / (-s2_x * s1_y + s1_x * s2_y);
        const t = ( s2_x * (p0.y - p2.y) - s2_y * (p0.x - p2.x)) / (-s2_x * s1_y + s1_x * s2_y);
    
        if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
            // Collision detected
            return {
                x: p0.x + (t * s1_x),
                y: p0.y + (t * s1_y)
            };
        }
        return null; // No collision
    }

    /**
     * Creates a new node and connects an edge to it.
     * @param {object} data - The data for the new node and edge.
     */
    createNodeAndConnectEdge(data) {
        const newNode = new BaseNode({ x: data.x, y: data.y, title: 'New Node' });
        this.addNode(newNode);

        setTimeout(() => {
            events.publish('edge:create', {
                startNodeId: data.startNodeId,
                startHandleId: data.startHandleId,
                endNodeId: newNode.id,
                endHandleId: this.getOptimalHandle(this.nodes.get(data.startNodeId), newNode)
            });
        }, 0);
    }

    /**
     * Internal method to delete an edge without affecting handle visibility.
     * @param {string} edgeId - The ID of the edge to remove.
     */
    _deleteEdge(edgeId) {
        const edge = this.edges.get(edgeId);
        if (!edge) return;

        // Only remove the element and from the map
        if (edge.groupElement) {
            edge.groupElement.remove();
        }
        this.edges.delete(edgeId);
    }

    /**
     * Splits an edge by inserting a new RoutingNode at the specified event location.
     * @param {{edgeId: string, event: MouseEvent}} data - The data for the event.
     */
    splitEdgeWithRoutingNode({ edgeId, event }) {
        const edge = this.edges.get(edgeId);
        if (!edge) return;

        const position = this.getMousePosition(event);
        const startNode = this.nodes.get(edge.startNodeId);
        const endNode = this.nodes.get(edge.endNodeId);

        if (!startNode || !endNode) return;

        // Create and add the new routing node, centering it on the cursor
        const routingNode = new RoutingNode({ 
            x: position.x - 15, // Half of default routing node width
            y: position.y - 15  // Half of default routing node height
        });
        this.addNode(routingNode);

        // Determine the best handles for the new connections to maintain edge flow
        const getOppositeHandle = (handle) => {
            const opposites = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
            return opposites[handle] || 'right';
        };

        const handleToNewNode = this.getOptimalHandle(startNode, routingNode);
        const handleFromNewNode = getOppositeHandle(handleToNewNode);

        // Create the two new edges
        events.publish('edge:create', { 
            startNodeId: edge.startNodeId, 
            startHandleId: edge.startHandleId, 
            endNodeId: routingNode.id, 
            endHandleId: handleToNewNode
        });
        events.publish('edge:create', { 
            startNodeId: routingNode.id, 
            startHandleId: handleFromNewNode, 
            endNodeId: edge.endNodeId, 
            endHandleId: edge.endHandleId 
        });

        // Remove the original edge
        events.publish('edge:delete', edge.id);
    }

    /**
     * Brings a node and all its children (if it's a group) or all selected nodes to the front.
     * @param {string} startNodeId The ID of the node initiating the action.
     */
    bringToFront(startNodeId) {
        const nodesToFront = this.getNodesToMove(startNodeId);
        
        const groups = [];
        const regularNodes = [];

        // Separate nodes into groups and regular nodes
        nodesToFront.forEach(nodeId => {
            const node = this.nodes.get(nodeId);
            if (node) {
                if (node instanceof GroupNode) {
                    groups.push(node);
                } else {
                    regularNodes.push(node);
                }
            }
        });

        // Sort groups so that parent groups come before their children.
        // This ensures parents get a lower z-index.
        groups.sort((a, b) => {
            if (this.isDescendant(b, a)) return -1; // a contains b, so a should be first
            if (this.isDescendant(a, b)) return 1;  // b contains a, so b should be first
            return 0;
        });
        
        // Assign z-indices to groups from the group pool
        groups.forEach(node => {
            if(node.element) node.element.style.zIndex = this.maxGroupZIndex++;
        });
        
        // Then assign z-indices to regular nodes from the node pool
        regularNodes.forEach(node => {
            if(node.element) node.element.style.zIndex = this.maxNodeZIndex++;
        });
    }

    /**
     * Creates a new group node around the currently selected nodes.
     */
    groupSelection() {
        if (this.selectedNodes.size < 1) return;

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        this.selectedNodes.forEach(nodeId => {
            const node = this.nodes.get(nodeId);
            if (node) {
                minX = Math.min(minX, node.x);
                minY = Math.min(minY, node.y);
                maxX = Math.max(maxX, node.x + node.width);
                maxY = Math.max(maxY, node.y + node.height);
            }
        });

        const padding = 40; // Add padding around the nodes
        const groupX = minX - padding;
        const groupY = minY - padding;
        const groupWidth = (maxX - minX) + (padding * 2);
        const groupHeight = (maxY - minY) + (padding * 2);

        const containedNodeIds = Array.from(this.selectedNodes);

        // Remove newly contained nodes from any previous parent
        containedNodeIds.forEach(nodeId => {
            const oldParent = this.findParentGroup(nodeId);
            if (oldParent) {
                oldParent.removeContainedNode(nodeId);
            }
        });

        const newGroup = new GroupNode({
            x: groupX,
            y: groupY,
            width: groupWidth,
            height: groupHeight,
            containedNodeIds: containedNodeIds
        });

        this.addNode(newGroup);

        // Update selection to be just the new group
        this.clearSelection();
        this.selectNode(newGroup.id);
        events.publish('selection:changed', {
            selectedNodeIds: Array.from(this.selectedNodes),
            selectedEdgeIds: Array.from(this.selectedEdges)
        });
    }

    /**
     * Creates a new BaseNode at the last known mouse position.
     */
    createNodeAtMousePosition() {
        const position = this.getMousePosition(this.lastMousePosition);
        events.publish('node:create', {
            x: position.x,
            y: position.y,
            title: 'Note'
        });
    }

    /**
     * Creates a new RoutingNode at the last known mouse position.
     */
    createRoutingNodeAtMousePosition() {
        const position = this.getMousePosition(this.lastMousePosition);
        events.publish('node:create', {
            type: 'RoutingNode',
            x: position.x - 15, // Center the small node on the cursor
            y: position.y - 15
        });
    }

    /**
     * Cycles through the available colors for a given routing node on right-click.
     * @param {string} routingNodeId The ID of the routing node to cycle.
     */
    cycleRoutingNodeColor(routingNodeId) {
        const routingNode = this.nodes.get(routingNodeId);
        if (!routingNode) return;

        // --- Cycle Color ---
        const colors = ['default', 'red', 'green', 'blue', 'yellow', 'purple'];
        const currentIndex = colors.indexOf(routingNode.color);
        const newColor = colors[(currentIndex + 1) % colors.length];
        
        // Use the public update event to change the color
        events.publish('node:update', { nodeId: routingNodeId, color: newColor });
    }

    /**
     * Frames the current selection or all elements if nothing is selected,
     * then animates the viewport to center on the bounding box.
     */
    frameSelection() {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        const hasSelection = this.selectedNodes.size > 0 || this.selectedEdges.size > 0;
        
        // Filter to only consider unpinned nodes and the edges between them for framing
        const nodesToFrame = (hasSelection ? Array.from(this.selectedNodes).map(id => this.nodes.get(id)) : Array.from(this.nodes.values()))
            .filter(node => node && !node.isPinned); 
        
        const edgesToFrame = (hasSelection ? Array.from(this.selectedEdges).map(id => this.edges.get(id)) : Array.from(this.edges.values()))
            .filter(edge => {
                if (!edge) return false;
                const startNode = this.nodes.get(edge.startNodeId);
                const endNode = this.nodes.get(edge.endNodeId);
                return startNode && !startNode.isPinned && endNode && !endNode.isPinned;
            });

        // Bounding box for nodes
        nodesToFrame.forEach(node => {
            if (node) {
                minX = Math.min(minX, node.x);
                minY = Math.min(minY, node.y);
                maxX = Math.max(maxX, node.x + node.width);
                maxY = Math.max(maxY, node.y + node.height);
            }
        });

        // Bounding box for edges
        edgesToFrame.forEach(edge => {
            if (edge && edge.startPosition && edge.endPosition) {
                const points = [edge.startPosition, ...edge.routingPoints, edge.endPosition];
                points.forEach(p => {
                    minX = Math.min(minX, p.x);
                    minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x);
                    maxY = Math.max(maxY, p.y);
                });
            }
        });
        
        // If there's nothing to frame, do nothing.
        if (!isFinite(minX)) {
            return;
        }

        // Calculate target scale and offset
        const padding = 100; // pixels of padding around the selection
        const selectionWidth = (maxX - minX) + padding * 2;
        const selectionHeight = (maxY - minY) + padding * 2;
        const containerRect = this.container.getBoundingClientRect();
        
        const targetScale = Math.min(
            containerRect.width / selectionWidth, 
            containerRect.height / selectionHeight,
            1.5 // Cap max zoom level when framing
        );

        const selectionCenterX = minX + (maxX - minX) / 2;
        const selectionCenterY = minY + (maxY - minY) / 2;
        const targetOffsetX = (containerRect.width / 2) - (selectionCenterX * targetScale);
        const targetOffsetY = (containerRect.height / 2) - (selectionCenterY * targetScale);

        this.animatePanZoom(targetScale, targetOffsetX, targetOffsetY);
    }

    /**
     * Animates the pan and zoom to a target state.
     * @param {number} targetScale The destination scale.
     * @param {number} targetOffsetX The destination X offset.
     * @param {number} targetOffsetY The destination Y offset.
     * @param {number} duration The duration of the animation in ms.
     */
    animatePanZoom(targetScale, targetOffsetX, targetOffsetY, duration = 300) {
        const startScale = this.panZoom.scale;
        const startOffsetX = this.panZoom.offsetX;
        const startOffsetY = this.panZoom.offsetY;

        const scaleDiff = targetScale - startScale;
        const offsetXDiff = targetOffsetX - startOffsetX;
        const offsetYDiff = targetOffsetY - startOffsetY;

        let startTime = null;

        const animationStep = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);

            this.panZoom.scale = startScale + scaleDiff * ease;
            this.panZoom.offsetX = startOffsetX + offsetXDiff * ease;
            this.panZoom.offsetY = startOffsetY + offsetYDiff * ease;

            this.updateCanvasTransform();

            if (progress < 1) {
                requestAnimationFrame(animationStep);
            }
        };

        requestAnimationFrame(animationStep);
    }

    /**
     * Moves a node between the main container and the pinned container based on its state.
     * @param {string} nodeId The ID of the node to reparent.
     */
    reparentNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node || !node.element) return;

        if (node.isPinned) {
            // Pinning the node: Move from world container to pinned container
            const rect = node.element.getBoundingClientRect();
            const containerRect = this.container.getBoundingClientRect();

            // Convert world coords and size to screen coords for pinning
            node.x = rect.left - containerRect.left;
            node.y = rect.top - containerRect.top;
            node.width = rect.width;
            node.height = rect.height;
            
            this.pinnedNodeContainer.appendChild(node.element);
            node.element.style.left = `${node.x}px`;
            node.element.style.top = `${node.y}px`;
            node.element.style.width = `${node.width}px`;
            node.element.style.height = `${node.height}px`;
            this.pinnedNodes.add(nodeId);

        } else {
            // Unpinning the node: Move from pinned container to world container
            // Convert screen coords and size back to world coords
            const worldX = (node.x - this.panZoom.offsetX) / this.panZoom.scale;
            const worldY = (node.y - this.panZoom.offsetY) / this.panZoom.scale;
            const worldWidth = node.width / this.panZoom.scale;
            const worldHeight = node.height / this.panZoom.scale;

            node.x = worldX;
            node.y = worldY;
            node.width = worldWidth;
            node.height = worldHeight;

            const targetContainer = node instanceof GroupNode ? this.groupContainer : this.nodeContainer;
            targetContainer.appendChild(node.element);
            node.element.style.left = `${node.x}px`;
            node.element.style.top = `${node.y}px`;
            node.element.style.width = `${node.width}px`;
            node.element.style.height = `${node.height}px`;
            this.pinnedNodes.delete(nodeId);
        }
        this.updateConnectedEdges(nodeId);
    }

    /**
     * Publishes the current state of NodeUI settings.
     */
    publishSettings() {
        const settings = {
            snapToGrid: this.snapToGrid,
            snapToObjects: this.snapToObjects,
            snapThreshold: this.snapThreshold,
            shakeSensitivity: this.shakeSensitivity,
            edgeGravity: this.edgeGravity,
            projectName: this.projectName,
            thumbnailUrl: this.thumbnailUrl,
            contextMenuSettings: this.contextMenuSettings
        };
        events.publish('settings:response', settings);
    }

    /**
     * Updates a specific setting from an event.
     * @param {{key: string, value: any}} data
     */
    updateSetting({ key, value }) {
        if (this.hasOwnProperty(key)) {
            this[key] = value;
            this.publishSettings();
            console.log(`Setting updated: ${key} =`, value);

            // If a visual setting that affects edges is changed, redraw them all
            if (key === 'edgeGravity') {
                this.edges.forEach(edge => this.updateEdge(edge.id));
            }
        } else if (key === 'contextMenuSettings') {
            this.contextMenuSettings = value;
            this.publishSettings();
            console.log(`Setting updated: contextMenuSettings =`, value);
        }
    }

    /**
     * Saves the current graph state to a JSON file.
     */
    saveGraph() {
        const data = {
            metadata: {
                projectName: this.projectName,
                thumbnailUrl: this.thumbnailUrl,
                contextMenuSettings: this.contextMenuSettings
            },
            nodes: [],
            edges: []
        };

        this.nodes.forEach(node => {
            const nodeData = {
                id: node.id,
                x: node.x,
                y: node.y,
                width: node.width,
                height: node.height,
                title: node.title,
                content: node.content,
                type: node.type,
                color: node.color,
                isPinned: node.isPinned
            };
            if (node instanceof GroupNode) {
                nodeData.containedNodeIds = Array.from(node.containedNodeIds);
            }

            // If node is pinned, its coords are in screen space. Convert to world space for saving.
            if (node.isPinned) {
                nodeData.x = (node.x - this.panZoom.offsetX) / this.panZoom.scale;
                nodeData.y = (node.y - this.panZoom.offsetY) / this.panZoom.scale;
                nodeData.width = node.width / this.panZoom.scale;
                nodeData.height = node.height / this.panZoom.scale;
            }

            data.nodes.push(nodeData);
        });

        this.edges.forEach(edge => {
            data.edges.push({
                id: edge.id,
                startNodeId: edge.startNodeId,
                endNodeId: edge.endNodeId,
                startHandleId: edge.startHandleId,
                endHandleId: edge.endHandleId,
                routingPoints: edge.routingPoints,
                type: edge.type,
                label: edge.label
            });
        });

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'graph.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log("Graph saved.");
    }

    /**
     * Loads a graph from a JSON string.
     * @param {string} json
     */
    loadGraph(json) {
        try {
            const data = JSON.parse(json);
            if (!data.nodes || !data.edges) {
                throw new Error("Invalid graph file format.");
            }

            this.clearAll();

            // Load metadata first, as it's independent of content
            if (data.metadata) {
                this.projectName = data.metadata.projectName || 'Untitled Graph';
                this.thumbnailUrl = data.metadata.thumbnailUrl || '';
                if(data.metadata.contextMenuSettings) {
                    this.contextMenuSettings = this.deepMerge(this.contextMenuSettings, data.metadata.contextMenuSettings);
                }
                this.publishSettings();
            }

            // --- Pre-calculate framing ---
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            let hasContent = false;
            if (data.nodes && data.nodes.length > 0) {
                data.nodes.forEach(node => {
                    // Only consider unpinned nodes for the initial framing calculation
                    if (!node.isPinned) {
                        minX = Math.min(minX, node.x);
                        minY = Math.min(minY, node.y);
                        maxX = Math.max(maxX, node.x + node.width);
                        maxY = Math.max(maxY, node.y + node.height);
                        hasContent = true;
                    }
                });
            }

            if (hasContent) {
                const padding = 100;
                const selectionWidth = (maxX - minX) + padding * 2;
                const selectionHeight = (maxY - minY) + padding * 2;
                const containerRect = this.container.getBoundingClientRect();
                
                const targetScale = Math.min(
                    containerRect.width / selectionWidth, 
                    containerRect.height / selectionHeight,
                    1.5 // Cap max zoom level
                );

                const selectionCenterX = minX + (maxX - minX) / 2;
                const selectionCenterY = minY + (maxY - minY) / 2;
                const targetOffsetX = (containerRect.width / 2) - (selectionCenterX * targetScale);
                const targetOffsetY = (containerRect.height / 2) - (selectionCenterY * targetScale);

                // Set initial state for subtle zoom-in effect
                const initialScale = targetScale * 0.9;
                this.panZoom.scale = initialScale;
                this.panZoom.offsetX = (containerRect.width / 2) - (selectionCenterX * initialScale);
                this.panZoom.offsetY = (containerRect.height / 2) - (selectionCenterY * initialScale);
                this.updateCanvasTransform();

                // Defer node creation and animation
                setTimeout(() => {
                    const idMap = new Map();
                    const nodesToPin = []; // Keep track of nodes to pin after creation

                    data.nodes.forEach(nodeData => {
                        const oldId = nodeData.id;
                        const newId = crypto.randomUUID();
                        idMap.set(oldId, newId);

                        const shouldBePinned = nodeData.isPinned;

                        // Create the node as unpinned initially
                        const newNodeData = { ...nodeData, id: newId, isPinned: false };
                        events.publish('node:create', newNodeData);

                        if (shouldBePinned) {
                            nodesToPin.push(newId);
                        }
                    });

                    this.nodes.forEach(node => {
                        if (node instanceof GroupNode) {
                            const newContainedIds = new Set();
                            node.containedNodeIds.forEach(oldId => {
                                const newId = idMap.get(oldId);
                                if (newId) newContainedIds.add(newId);
                            });
                            node.containedNodeIds = newContainedIds;
                        }
                    });

                    data.edges.forEach(edgeData => {
                        edgeData.startNodeId = idMap.get(edgeData.startNodeId);
                        edgeData.endNodeId = idMap.get(edgeData.endNodeId);
                        if (edgeData.startNodeId && edgeData.endNodeId) {
                            events.publish('edge:create', edgeData);
                        }
                    });

                    // After all nodes are in the DOM, pin the ones that need to be pinned.
                    // This triggers the `reparentNode` logic correctly.
                    nodesToPin.forEach(nodeId => {
                        const node = this.nodes.get(nodeId);
                        if (node) {
                            this.updateNode({ nodeId: nodeId, isPinned: true });
                        }
                    });
                    
                    this.animatePanZoom(targetScale, targetOffsetX, targetOffsetY, 400);
                    console.log("Graph loaded.");
                }, 10);

            } else {
                 // Reset pan and zoom if loading an empty graph
                this.panZoom.scale = 1;
                this.panZoom.offsetX = 0;
                this.panZoom.offsetY = 0;
                this.updateCanvasTransform();
            }

        } catch (error) {
            console.error("Failed to load graph:", error);
            // Optionally, publish a UI notification event here
        }
    }

    /**
     * Clears all nodes and edges from the canvas.
     */
    clearAll() {
        // Create a copy of the IDs to avoid issues while iterating and deleting
        const nodeIds = Array.from(this.nodes.keys());
        const edgeIds = Array.from(this.edges.keys());

        edgeIds.forEach(id => this.removeEdge(id));
        nodeIds.forEach(id => this.removeNode(id));
        
        this.clearSelection();
        this.maxGroupZIndex = 0;
        this.maxNodeZIndex = 10000;
        this.projectName = 'Untitled Graph';
        this.thumbnailUrl = '';
        this.publishSettings();
        console.log("Canvas cleared.");
    }

    /**
     * Deletes the currently selected nodes and edges.
     */
    deleteSelection() {
        if (this.selectedNodes.size > 0 || this.selectedEdges.size > 0) {
            this.selectedNodes.forEach(nodeId => {
                events.publish('node:delete', nodeId);
            });
            this.selectedEdges.forEach(edgeId => {
                events.publish('edge:delete', edgeId);
            });
            this.clearSelection();
        }
    }

    /**
     * Captures the current graph view as a Base64 PNG image using html2canvas.
     */
    async takeScreenshot() {
        console.log("Starting screenshot with html2canvas...");
        try {
            const padding = 50;

            // 1. Calculate bounding box of all non-pinned content
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            let hasContent = false;

            this.nodes.forEach(node => {
                if (!node.isPinned) {
                    minX = Math.min(minX, node.x);
                    minY = Math.min(minY, node.y);
                    maxX = Math.max(maxX, node.x + node.width);
                    maxY = Math.max(maxY, node.y + node.height);
                    hasContent = true;
                }
            });

            if (!hasContent) {
                console.warn("No non-pinned content to screenshot.");
                return;
            }

            // Also consider edges in the bounding box calculation
            this.edges.forEach(edge => {
                if(this.nodes.get(edge.startNodeId)?.isPinned || this.nodes.get(edge.endNodeId)?.isPinned) return;
                const points = [edge.startPosition, ...edge.routingPoints, edge.endPosition];
                points.forEach(p => {
                    minX = Math.min(minX, p.x);
                    minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x);
                    maxY = Math.max(maxY, p.y);
                });
            });

            // 2. Prepare for screenshot
            const captureArea = this.container;
            const originalScroll = { x: captureArea.scrollLeft, y: captureArea.scrollTop };
            const { scale, offsetX, offsetY } = this.panZoom;
            
            // The capture dimensions in world coordinates
            const captureWidth = (maxX - minX) + (padding * 2);
            const captureHeight = (maxY - minY) + (padding * 2);

            // 3. Temporarily hide non-graph elements and apply styles
            this.selectionState.selectionBox.style.display = 'none';
            document.querySelectorAll('.resize-handle').forEach(h => h.style.display = 'none');
            
            const canvas = await html2canvas(captureArea, {
                backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-bg-default').trim(),
                x: (minX - padding) * scale + offsetX,
                y: (minY - padding) * scale + offsetY,
                width: captureWidth * scale,
                height: captureHeight * scale,
                scale: 2 // Increase resolution
            });

            // 4. Restore UI elements
            this.selectionState.selectionBox.style.display = 'block';
            document.querySelectorAll('.resize-handle').forEach(h => h.style.display = '');

            // 5. Update thumbnail
            const dataUrl = canvas.toDataURL('image/png');
            this.thumbnailUrl = dataUrl;
            events.publish('setting:update', { key: 'thumbnailUrl', value: dataUrl });
            console.log("Screenshot captured and thumbnail updated via html2canvas.");

        } catch (error) {
            console.error("Error taking screenshot with html2canvas:", error);
        }
    }

    /**
     * Deeply merges two objects. The source object's properties overwrite the target's.
     * @param {object} target The target object.
     * @param {object} source The source object.
     * @returns {object} The merged object.
     */
    deepMerge(target, source) {
        const output = { ...target };
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target)) {
                        Object.assign(output, { [key]: source[key] });
                    } else {
                        output[key] = this.deepMerge(target[key], source[key]);
                    }
                } else {
                    Object.assign(output, { [key]: source[key] });
                }
            });
        }
        return output;
    }
    
    /**
     * Utility to check if a variable is a non-null object.
     * @param {*} item The variable to check.
     * @returns {boolean}
     */
    isObject(item) {
        return (item && typeof item === 'object' && !Array.isArray(item));
    }

    /**
     * Calculates the distance between two touch points for pinch gestures.
     * @param {TouchEvent} event The touch event.
     * @returns {number} The distance between the two touch points.
     */
    getPinchDistance(event) {
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        return Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
    }

    /**
     * Handles the dragover event for file drops.
     * @param {DragEvent} event
     */
    onDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Check if the dragged item is a file
        if (event.dataTransfer.types.includes('Files')) {
            this.container.classList.add('is-drop-target');
        }
    }

    /**
     * Handles the dragleave event for file drops.
     * @param {DragEvent} event
     */
    onDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        this.container.classList.remove('is-drop-target');
    }

    /**
     * Handles the drop event for files, supporting graph loading and image embedding.
     * @param {DragEvent} event
     */
    onDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        this.container.classList.remove('is-drop-target');

        if (!event.dataTransfer || !event.dataTransfer.files.length) {
            return;
        }

        const position = this.getMousePosition(event);

        // Process all dropped files
        Array.from(event.dataTransfer.files).forEach((file, index) => {
            const filePosition = {
                x: position.x + index * 20, // Offset subsequent files
                y: position.y + index * 20
            };

            // Handle graph loading
            if (file.type === 'application/json' || file.name.endsWith('.json')) {
                const reader = new FileReader();
                reader.onload = (e) => events.publish('graph:load-content', e.target.result);
                reader.readAsText(file);
                return;
            }

            // Handle image embedding
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const dataUrl = e.target.result;
                    
                    // Create an in-memory image to get its dimensions
                    const img = new Image();
                    img.onload = () => {
                        const nodeWidth = 200;
                        const contentPadding = 16;
                        const titleBarHeight = 48; 
                        const imageMarginTop = 8;
                        
                        // Calculate image aspect ratio
                        const aspectRatio = img.height / img.width;
                        const imageWidthInNode = nodeWidth - (contentPadding * 2);
                        const imageHeightInNode = imageWidthInNode * aspectRatio;

                        // Calculate total node height
                        const totalContentHeight = contentPadding + imageMarginTop + imageHeightInNode + contentPadding;
                        const nodeHeight = titleBarHeight + totalContentHeight;

                        events.publish('node:create', {
                            x: filePosition.x - nodeWidth / 2,
                            y: filePosition.y - nodeHeight / 2,
                            width: nodeWidth,
                            height: nodeHeight,
                            title: file.name,
                            content: `![${file.name}](${dataUrl})`,
                            type: 'BaseNode',
                            color: 'default'
                        });
                    };
                    img.src = dataUrl;
                };
                reader.readAsDataURL(file);
                return;
            }

            // Handle markdown file embedding
            if (file.type === 'text/markdown' || file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const markdownContent = e.target.result;
                    const nodeWidth = 200;
                    const nodeHeight = 120;

                    events.publish('node:create', {
                        x: filePosition.x - nodeWidth / 2,
                        y: filePosition.y - nodeHeight / 2,
                        width: nodeWidth,
                        height: nodeHeight,
                        title: file.name.replace(/\.(md|markdown)$/i, ''),
                        content: markdownContent,
                        type: 'BaseNode',
                        color: 'default'
                    });
                };
                reader.readAsText(file);
                return;
            }

            console.warn("Unsupported file type dropped:", file.name, file.type);
        });
    }

    /**
     * Updates an edge's properties based on an event.
     * @param {{edgeId: string, [key: string]: any}} data The update data.
     */
    updateEdgeProps(data) {
        const edge = this.edges.get(data.edgeId);
        if (edge) {
            if (data.label !== undefined) {
                edge.label = data.label;
            }
            // In the future, other properties could be updated here.
            this.updateEdge(data.edgeId); // Re-render the edge to show the new label
        }
    }

    /**
     * Starts the physics simulation loop.
     */
    startPhysicsLoop() {
        const stiffness = 0.02;
        const damping = 0.90;

        const update = () => {
            let hasUnsettledEdges = false;

            this.edges.forEach(edge => {
                if (edge.physics.isSettled) return;

                // If gravity is turned off mid-simulation, settle the edge.
                if (this.edgeGravity === 0) {
                    edge.physics.isSettled = true;
                    edge.physics.sag = 0;
                    edge.physics.velocity = 0;
                    this.updateEdge(edge.id);
                    return;
                }

                hasUnsettledEdges = true;

                if (edge.routingPoints.length > 0) {
                    edge.physics.isSettled = true;
                    return;
                }
                
                const startPos = edge.startPosition;
                const endPos = edge.endPosition;
                const dist = Math.hypot(endPos.x - startPos.x, endPos.y - startPos.y);
                const restingSag = (dist / 150) * this.edgeGravity;

                const force = (restingSag - edge.physics.sag) * stiffness;
                
                edge.physics.velocity += force;
                edge.physics.velocity *= damping;
                edge.physics.sag += edge.physics.velocity;
                
                const pathData = this._getCurvedPathD(edge.startPosition, edge.endPosition, edge.startHandleId, edge.endHandleId, edge.physics.sag);
                if (edge.element) {
                    edge.element.setAttribute('d', pathData);
                    edge.hitArea.setAttribute('d', pathData);
                }

                if (Math.abs(edge.physics.velocity) < 0.01 && Math.abs(restingSag - edge.physics.sag) < 0.01) {
                    edge.physics.isSettled = true;
                    this.updateEdge(edge.id);
                }
            });

            if (hasUnsettledEdges) {
                requestAnimationFrame(update);
            }
        };

        events.subscribe('physics:start', () => {
            requestAnimationFrame(update);
        });
    }

    /**
     * "Plucks" an edge, giving its control point velocity and starting the physics simulation.
     * @param {BaseEdge} edge 
     */
    pluckEdge(edge) {
        if (!edge || this.edgeGravity === 0) return;
        
        // Give it a little push when plucked
        edge.physics.velocity += 2;
        
        if (edge.physics.isSettled) {
            edge.physics.isSettled = false;
            events.publish('physics:start');
        }
    }

    /**
     * Finds an edge based on its start and end positions. Note: This is a fallback and can be slow.
     * @param {{x:number, y:number}} startPos
     * @param {{x:number, y:number}} endPos
     * @returns {BaseEdge|null}
     */
    findEdgeByPositions(startPos, endPos) {
        for (const edge of this.edges.values()) {
            if (edge.startPosition === startPos && edge.endPosition === endPos) {
                return edge;
            }
        }
        return null;
    }
}

// Initialize NodeUI once the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const canvasContainer = document.getElementById('canvas-container');
    const app = new NodeUI(canvasContainer);

    // Load the initial graph from graph.json
    fetch('graph.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text(); // Get as text to pass to the event
        })
        .then(jsonString => {
            console.log('%c[Test]%c Loading initial graph from graph.json', 'color: #8e8e8e; font-weight: bold;', 'color: inherit;');
            events.publish('graph:load-content', jsonString);
        })
        .catch(error => {
            console.error("Could not load initial graph.json:", error);
            // If loading fails, it will still create the default settings node.
        });
}); 