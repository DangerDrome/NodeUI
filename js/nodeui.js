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
            droppableEdge: null // Track which edge we can drop onto
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

        this.snapToGrid = 20; // Grid size, can be false or a number
        this.snapToObjects = true;
        this.snapThreshold = 5;

        this.contextMenu = new ContextMenu();
        this.longPressTimer = null;
        this.openPopoverNodeId = null;
        this.maxGroupZIndex = 0;
        this.maxNodeZIndex = 10000; // Large offset to separate node/group layers
        this.selectionDebounceTimer = null;

        this.panZoom = {
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            isPanning: false
        };

        this.lastMousePosition = { clientX: 0, clientY: 0 };

        this.init();
    }

    /**
     * Initializes the canvas, sets up the SVG element, and binds event listeners.
     */
    init() {
        this.container.innerHTML = ''; // Clear any previous content

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

        const edgeDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const colors = ['default', 'red', 'green', 'blue', 'yellow', 'purple'];
        
        colors.forEach(color => {
            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
            marker.id = `arrowhead-${color}`;
            marker.setAttribute('viewBox', '0 0 10 10');
            marker.setAttribute('refX', '8');
            marker.setAttribute('refY', '5');
            marker.setAttribute('markerWidth', '6');
            marker.setAttribute('markerHeight', '6');
            marker.setAttribute('orient', 'auto-start-reverse');
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
            path.style.fill = `var(--color-node-${color}-border)`;
            marker.appendChild(path);
            edgeDefs.appendChild(marker);
        });

        const markerDrawing = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        markerDrawing.id = 'arrowhead-drawing';
        markerDrawing.setAttribute('viewBox', '0 0 10 10');
        markerDrawing.setAttribute('refX', '8');
        markerDrawing.setAttribute('refY', '5');
        markerDrawing.setAttribute('markerWidth', '6');
        markerDrawing.setAttribute('markerHeight', '6');
        markerDrawing.setAttribute('orient', 'auto-start-reverse');
        const pathDrawing = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathDrawing.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        pathDrawing.classList.add('arrowhead-drawing');
        markerDrawing.appendChild(pathDrawing);
        edgeDefs.appendChild(markerDrawing);
        
        this.svg.appendChild(edgeDefs);

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

        console.log('%c[NodeUI]%c Service initialized.', 'color: #3ecf8e; font-weight: bold;', 'color: inherit;');
    }

    /**
     * Binds DOM event listeners for canvas interactions.
     */
    bindEventListeners() {
        this.container.addEventListener('mousedown', this.onMouseDown.bind(this));
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
        
        // Add touch event listeners
        this.container.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.onTouchEnd.bind(this));

        // Add keyboard event listeners
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));

        // Add wheel event for zooming
        this.container.addEventListener('wheel', this.onWheel.bind(this), { passive: false });

        // Add context menu event
        this.container.addEventListener('contextmenu', this.onContextMenu.bind(this));
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
            }
            else {
                this.addNode(new BaseNode(options));
            }
        });
        events.subscribe('edge:create', (options) => this.addEdge(new BaseEdge(options)));
        events.subscribe('node:delete', (nodeId) => this.removeNode(nodeId));
        events.subscribe('edge:delete', (edgeId) => this.removeEdge(edgeId));
        events.subscribe('snap:grid-toggle', () => this.toggleSnapToGrid());
        events.subscribe('node:update', (data) => this.updateNode(data));
        events.subscribe('snap:object-toggle', this.toggleSnapToObjects.bind(this));
        events.subscribe('node:visual-update', ({ nodeId }) => this.updateConnectedEdges(nodeId));
        events.subscribe('edge:add-routing-node', (data) => this.splitEdgeWithRoutingNode(data));
        events.subscribe('edge:selected', (data) => this.onEdgeSelected(data));
        events.subscribe('edge:create-with-new-node', (data) => this.createNodeAndConnectEdge(data));
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

            // Special handler for left-clicking a routing node's icon to cycle color
            if (node instanceof RoutingNode && event.target.closest('.node-icon')) {
                this.cycleNodeColor(nodeId);
                return; // Prevent starting a drag operation
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
            const dx = (event.clientX - startX) / this.panZoom.scale;
            const dy = (event.clientY - startY) / this.panZoom.scale;
        
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
                this.cancelDrawingEdge();
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
    }

    /**
     * Handles the touchstart event on the node container.
     * @param {TouchEvent} event 
     */
    onTouchStart(event) {
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
        // If the finger moves, it's not a long press
        clearTimeout(this.longPressTimer);

        if (this.resizingState.isResizing) {
            event.preventDefault();
            const touch = event.touches[0];
            const { targetNode, startX, startY, originalWidth, originalHeight } = this.resizingState;
            const dx = (touch.clientX - startX) / this.panZoom.scale;
            const dy = (touch.clientY - startY) / this.panZoom.scale;

            const minWidth = parseInt(getComputedStyle(this.container).getPropertyValue('--panel-width'));
            const minHeight = parseInt(getComputedStyle(this.container).getPropertyValue('--panel-height'));

            let newWidth = Math.max(minWidth, originalWidth + dx);
            let newHeight = Math.max(minHeight, originalHeight + dy);

            if (this.snapToObjects) {
                const snapResult = this.checkForResizeSnapping(targetNode, newWidth, newHeight);
                newWidth = snapResult.width;
                newHeight = snapResult.height;
            }

            targetNode.width = newWidth;
            targetNode.height = newHeight;
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
        // If the touch ends before the timer, it's not a long press
        clearTimeout(this.longPressTimer);

        // Same logic as onMouseUp: handle the most specific state first.
        if (this.edgeDrawingState.isDrawing) {
            const touch = event.changedTouches[0];
            const endElement = document.elementFromPoint(touch.clientX, touch.clientY);
            
            if (endElement && endElement.classList.contains('node-handle-zone')) {
                const { nodeId, handlePosition } = endElement.dataset;
                this.endDrawingEdge(nodeId, handlePosition);
            } else {
                this.cancelDrawingEdge();
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
        const targetIsInput = event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA';
        const key = event.key.toLowerCase();

        if (isModKey && key === 'a') {
            event.preventDefault();
            this.selectAll();
        } else if (isModKey && key === 'c') {
            event.preventDefault();
            this.copySelection();
        } else if (isModKey && key === 'x') {
            event.preventDefault();
            this.cutSelection();
        } else if (isModKey && key === 'v') {
            event.preventDefault();
            this.paste();
        } else if (key === 'g' && !isModKey && !targetIsInput) {
            event.preventDefault();
            this.groupSelection();
        } else if (key === 'n' && !isModKey && !targetIsInput) {
            event.preventDefault();
            this.createNodeAtMousePosition();
        } else if (key === 'm' && !isModKey && !targetIsInput) {
            event.preventDefault();
            this.createRoutingNodeAtMousePosition();
        } else if ((key === 'c' || key === 'y') && !isModKey && !targetIsInput) {
            event.preventDefault();
            this.edgeCutState.isCutting = true;
            this.container.classList.add('is-cutting');
        } else if (key === 'r' && !isModKey && !targetIsInput) {
            event.preventDefault();
            this.routingCutState.isRouting = true;
            this.container.classList.add('is-routing');
        } else if ((key === 'delete' || key === 'backspace') && !targetIsInput) {
            if (this.selectedNodes.size > 0 || this.selectedEdges.size > 0) {
                event.preventDefault();
                this.selectedNodes.forEach(nodeId => {
                    events.publish('node:delete', nodeId);
                });
                this.selectedEdges.forEach(edgeId => {
                    events.publish('edge:delete', edgeId);
                });
                this.clearSelection();
            }
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
    startDrag(nodeId, clientX, clientY) {
        const node = this.nodes.get(nodeId);
        if (!node) return;

        this.draggingState.isDragging = true;
        this.draggingState.targetNode = node;
        
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
        tempEdge.setAttribute('marker-end', 'url(#arrowhead-drawing)');
        
        // Set the drawing color based on the start node's color
        // This is applied to the main container so the SVG marker def can inherit it.
        const drawColor = getComputedStyle(startNode.element).getPropertyValue(`--color-node-${startNode.color}-border`);
        this.container.style.setProperty('--edge-draw-color', drawColor);

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
        // Clean up the drawing color variable
        this.container.style.removeProperty('--edge-draw-color');
        
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
        const baseOffset = 10; // The base distance from the node edge to the handle's center
        const offset = baseOffset * offsetMult;

        switch (handlePosition) {
            case 'top':    x += node.width / 2; y -= offset; break;
            case 'right':  x += node.width + offset; y += node.height / 2; break;
            case 'bottom': x += node.width / 2; y += node.height + offset; break;
            case 'left':   x -= offset; y += node.height / 2; break;
        }
    
        return { x, y };
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

        // Use Catmull-Rom for the intermediate points
        for (let i = 0; i < points.length - 1; i++) {
            let p0 = i > 0 ? points[i - 1] : points[i];
            let p1 = points[i];
            let p2 = points[i + 1];
            let p3 = i < points.length - 2 ? points[i + 2] : p2;

            let cp1x = p1.x + (p2.x - p0.x) / 6;
            let cp1y = p1.y + (p2.y - p0.y) / 6;
            let cp2x = p2.x - (p3.x - p1.x) / 6;
            let cp2y = p2.y - (p3.y - p1.y) / 6;

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
        const maxPadding = parseInt(getComputedStyle(this.container).getPropertyValue('--edge-padding')) || 8;
        
        const distance = Math.hypot(endPos.x - startPos.x, endPos.y - startPos.y);
        const padding = Math.min(maxPadding, distance / 2.5);

        let paddedStartPos = { ...startPos };
        let paddedEndPos = { ...endPos };

        switch (startHandle) {
            case 'top':    paddedStartPos.y -= padding; break;
            case 'bottom': paddedStartPos.y += padding; break;
            case 'left':   paddedStartPos.x -= padding; break;
            case 'right':  paddedStartPos.x += padding; break;
        }

        switch (endHandle) {
            case 'top':    paddedEndPos.y -= padding; break;
            case 'bottom': paddedEndPos.y += padding; break;
            case 'left':   paddedEndPos.x -= padding; break;
            case 'right':  paddedEndPos.x -= padding; break;
            case 'auto':   break; // No padding for auto-oriented end
        }

        const offset = Math.min(100, Math.hypot(paddedEndPos.x - paddedStartPos.x, paddedEndPos.y - paddedStartPos.y) / 2);
        let cp1x = paddedStartPos.x;
        let cp1y = paddedStartPos.y;
        let cp2x = paddedEndPos.x;
        let cp2y = paddedEndPos.y;

        switch (startHandle) {
            case 'top': cp1y -= offset; break;
            case 'bottom': cp1y += offset; break;
            case 'left': cp1x -= offset; break;
            case 'right': cp1x += offset; break;
        }

        switch (endHandle) {
            case 'top':    cp2y -= offset; break;
            case 'bottom': cp2y += offset; break;
            case 'left':   cp2x -= offset; break;
            case 'right':  cp2x += offset; break;
            // No special control point for 'auto'
        }

        return `M ${paddedStartPos.x} ${paddedStartPos.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${paddedEndPos.x} ${paddedEndPos.y}`;
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
    }

    /**
     * Updates all edges connected to a given node.
     * @param {string} nodeId - The ID of the node that has moved.
     */
    updateConnectedEdges(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        
        // This method is called on visual updates (move, resize, color change)
        this.edges.forEach(edge => {
            if (edge.startNodeId === nodeId) {
                // If the node is the start of an edge, its position and color change.
                edge.startPosition = this.getHandlePosition(edge.startNodeId, edge.startHandleId);
                
                const nodeColor = node.color || 'default';
                const startNodeColorVar = `var(--color-node-${nodeColor}-border)`;
                edge.element.style.setProperty('--edge-color', startNodeColorVar);
                edge.element.setAttribute('marker-end', `url(#arrowhead-${nodeColor})`);
                
                this.updateEdge(edge.id);
            } else if (edge.endNodeId === nodeId) {
                // If the node is the end of an edge, only its position changes.
                // The color is determined by the start node.
                edge.endPosition = this.getHandlePosition(edge.endNodeId, edge.endHandleId);
                this.updateEdge(edge.id);
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

        // Deep clone the node data, ensuring color is preserved
        this.selectedNodes.forEach(nodeId => {
            const node = this.nodes.get(nodeId);
            if (node) {
                // Serialize containedNodeIds if it's a GroupNode
                const nodeData = { 
                    ...node,
                    element: null, 
                    handles: {},
                    connections: new Map() // Connections are not copied
                };

                if (node instanceof GroupNode) {
                    nodeData.containedNodeIds = Array.from(node.containedNodeIds);
                }

                this.clipboard.nodes.push(nodeData);
            }
        });

        // Find and clone ANY edge connected to the selection
        this.edges.forEach(edge => {
            if (this.selectedNodes.has(edge.startNodeId) || this.selectedNodes.has(edge.endNodeId)) {
                this.clipboard.edges.push({ ...edge, element: null });
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
        const pasteOffset = 20; // A small offset to avoid direct overlap

        // For a more predictable paste, let's use a fixed point if mouse is not over canvas
        const pasteCenter = this.getMousePosition(this.lastMousePosition) || { x: 100, y: 100 };
        
        // Find the geometric center of the copied nodes
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

            // Calculate new position relative to the group's center
            const offsetX = nodeData.x - groupCenterX;
            const offsetY = nodeData.y - groupCenterY;

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
                containedNodeIds: nodeData.containedNodeIds
            };

            // Instantiate the correct class based on the node type
            if (newNodeData.type === 'RoutingNode') {
                this.addNode(new RoutingNode(newNodeData));
            } else if (newNodeData.type === 'GroupNode') {
                this.addNode(new GroupNode(newNodeData));
            } else {
                this.addNode(new BaseNode(newNodeData));
            }
        });

        // Create new edges with updated node IDs and positions
        this.clipboard.edges.forEach(edgeData => {
            // Determine the start and end node IDs for the new edge.
            // If an endpoint was part of the copy, use its new ID.
            // Otherwise, use the original ID to connect to an existing node.
            const newStartNodeId = idMap.get(edgeData.startNodeId) || edgeData.startNodeId;
            const newEndNodeId = idMap.get(edgeData.endNodeId) || edgeData.endNodeId;

            // Only create the new edge if at least one of its endpoints is a new node.
            // This prevents duplicating edges that connect two un-copied nodes.
            if (idMap.has(edgeData.startNodeId) || idMap.has(edgeData.endNodeId)) {
                events.publish('edge:create', {
                    startNodeId: newStartNodeId,
                    endNodeId: newEndNodeId,
                    startHandleId: edgeData.startHandleId,
                    endHandleId: edgeData.endHandleId
                });
            }
        });

        // Select the newly pasted nodes
        this.clearSelection();
        idMap.forEach(newNodeId => this.selectNode(newNodeId));

        events.publish('selection:changed', {
            selectedNodeIds: Array.from(this.selectedNodes)
        });

        console.log(`Pasted ${this.clipboard.nodes.length} nodes and ${this.clipboard.edges.length} edges.`);
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
        event.preventDefault();
        
        const target = event.target;
        const nodeElement = target.closest('.node');
        const edgeHitArea = target.closest('.edge-hit-area');
        
        if (edgeHitArea) {
            const edgeId = edgeHitArea.parentElement.querySelector('.edge').id;
            this.showEdgeContextMenu(event.clientX, event.clientY, edgeId);
        } else if (nodeElement) {
            const node = this.nodes.get(nodeElement.id);
            if (node instanceof RoutingNode) {
                // Directly cycle the input connection on right-click.
                this.cycleRoutingNodeConnections(node.id);
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
                type: 'BaseNode',
                label: 'Create Node',
                iconClass: 'icon-plus-square'
            },
            {
                type: 'RoutingNode',
                label: 'Create Routing Node',
                iconClass: 'icon-git-commit'
            },
            {
                type: 'GroupNode',
                label: 'Create Group',
                iconClass: 'icon-group'
            }
        ];

        nodeCreationActions.forEach(action => {
            items.push({
                label: action.label,
                iconClass: action.iconClass,
                action: () => {
                    let newNode;
                    if (action.type === 'RoutingNode') {
                        newNode = new RoutingNode({ x: worldPos.x, y: worldPos.y });
                    } else if (action.type === 'GroupNode') {
                        newNode = new GroupNode({ x: worldPos.x, y: worldPos.y });
                    } else {
                        newNode = new BaseNode({ x: worldPos.x, y: worldPos.y, title: action.label, type: action.type });
                    }
                    this.addNode(newNode);

                    if (edgeStartInfo) {
                        const startNode = this.nodes.get(edgeStartInfo.startNodeId);
                        if (startNode) {
                            const endHandlePosition = this.getOptimalHandle(startNode, newNode);
                            // Add a small delay to ensure the new node is in the DOM
                            setTimeout(() => {
                                events.publish('edge:create', {
                                    startNodeId: edgeStartInfo.startNodeId,
                                    startHandleId: edgeStartInfo.startHandleId,
                                    endNodeId: newNode.id,
                                    endHandleId: endHandlePosition
                                });
                            }, 0);
                        }
                    }
                }
            });
        });

        // Add a separator if there were creation actions and we are not in edge-draw mode
        if (items.length > 0 && !edgeStartInfo) {
            items.push({ isSeparator: true });
        }
        
        // Add other context menu items if not in edge-draw mode
        if (!edgeStartInfo) {
            items.push(
                { 
                    label: `Snap to Grid: ${this.snapToGrid ? 'On' : 'Off'}`,
                    iconClass: 'icon-grid-2x2',
                    action: () => events.publish('snap:grid-toggle') 
                },
                {
                    label: `Snap to Object: ${this.snapToObjects ? 'On' : 'Off'}`,
                    iconClass: 'icon-magnet',
                    action: () => events.publish('snap:object-toggle')
                }
            );
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

        const items = [
            {
                label: 'Add Routing Node',
                iconClass: 'icon-git-commit',
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
            {
                label: 'Delete Edge',
                iconClass: 'icon-trash-2',
                action: () => {
                    events.publish('edge:delete', edgeId);
                }
            }
        ];
        this.contextMenu.show(x, y, items);
    }

    /**
     * Toggles the snap-to-grid functionality.
     * @param {string} edgeId The ID of the edge to add a point to.
     */
    toggleSnapToGrid(edgeId) {
        this.snapToGrid = this.snapToGrid ? false : 20;
        console.log(`Snap to grid is now ${this.snapToGrid ? 'enabled' : 'disabled'}`);
    }

    /**
     * Toggles the snap-to-objects functionality.
     */
    toggleSnapToObjects() {
        this.snapToObjects = !this.snapToObjects;
        console.log(`Snap to objects is now ${this.snapToObjects ? 'enabled' : 'disabled'}`);
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
            node.update(data);
        }
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
    checkForResizeSnapping(resizingNode, currentWidth, currentHeight) {
        this.clearGuides();
        let snappedWidth = currentWidth;
        let snappedHeight = currentHeight;

        const resizingBounds = {
            right: resizingNode.x + currentWidth,
            bottom: resizingNode.y + currentHeight
        };

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

            // Check right edge against static node's vertical lines
            if (Math.abs(resizingBounds.right - staticBounds.left) < this.snapThreshold) {
                snappedWidth = staticBounds.left - resizingNode.x;
                this.drawGuide(staticBounds.left, 'v', nodeColor);
            }
            if (Math.abs(resizingBounds.right - staticBounds.right) < this.snapThreshold) {
                snappedWidth = staticBounds.right - resizingNode.x;
                this.drawGuide(staticBounds.right, 'v', nodeColor);
            }
            if (Math.abs(resizingBounds.right - staticBounds.hCenter) < this.snapThreshold) {
                snappedWidth = staticBounds.hCenter - resizingNode.x;
                this.drawGuide(staticBounds.hCenter, 'v', nodeColor);
            }

            // Check bottom edge against static node's horizontal lines
            if (Math.abs(resizingBounds.bottom - staticBounds.top) < this.snapThreshold) {
                snappedHeight = staticBounds.top - resizingNode.y;
                this.drawGuide(staticBounds.top, 'h', nodeColor);
            }
            if (Math.abs(resizingBounds.bottom - staticBounds.bottom) < this.snapThreshold) {
                snappedHeight = staticBounds.bottom - resizingNode.y;
                this.drawGuide(staticBounds.bottom, 'h', nodeColor);
            }
            if (Math.abs(resizingBounds.bottom - staticBounds.vCenter) < this.snapThreshold) {
                snappedHeight = staticBounds.vCenter - resizingNode.y;
                this.drawGuide(staticBounds.vCenter, 'h', nodeColor);
            }
        });

        return { width: snappedWidth, height: snappedHeight };
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
        if (directionChanges > 3) {
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
            title: 'New Node'
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
     * For a given routing node, finds all connected edges and cycles their
     * connection points clockwise to the next available handle on the routing node itself.
     * @param {string} routingNodeId The ID of the routing node to cycle.
     */
    cycleRoutingNodeConnections(routingNodeId) {
        const routingNode = this.nodes.get(routingNodeId);
        if (!routingNode) return;

        const connectedEdges = Array.from(this.edges.values()).filter(
            edge => edge.startNodeId === routingNodeId || edge.endNodeId === routingNodeId
        );

        if (connectedEdges.length === 0) return;

        const clockwiseHandles = ['top', 'right', 'bottom', 'left'];
        const edgeUpdates = [];

        // Step 1: Determine the new handle for each edge based on the current state.
        connectedEdges.forEach(edge => {
            const isStartNode = edge.startNodeId === routingNodeId;
            const oldHandle = isStartNode ? edge.startHandleId : edge.endHandleId;
            
            const currentIndex = clockwiseHandles.indexOf(oldHandle);
            // Cycle to the next handle in the clockwise direction.
            const newHandle = clockwiseHandles[(currentIndex + 1) % clockwiseHandles.length];

            edgeUpdates.push({ edge, oldHandle, newHandle, isStartNode });
        });

        // Step 2: Apply all updates. This two-pass process prevents conflicts
        // where one edge moves to a handle occupied by another edge in the same cycle.
        edgeUpdates.forEach(({ edge, oldHandle }) => {
            routingNode.removeConnection(oldHandle, edge.id);
        });

        edgeUpdates.forEach(({ edge, newHandle, isStartNode }) => {
            routingNode.addConnection(newHandle, edge.id);
            if (isStartNode) {
                edge.startHandleId = newHandle;
            } else {
                edge.endHandleId = newHandle;
            }
        });

        // --- Cycle Icon ---
        if (routingNode.element) {
            const iconEl = routingNode.element.querySelector('.node-icon');
            if (iconEl) {
                const icons = ['icon-git-commit', 'icon-refresh-cw', 'icon-plus'];
                
                // Remove any of the possible icon classes
                iconEl.classList.remove(...icons);

                // Increment state and apply the new icon class
                routingNode.iconState = (routingNode.iconState + 1) % icons.length;
                iconEl.classList.add(icons[routingNode.iconState]);
            }
        }

        // Trigger a visual update for all edges connected to the routing node.
        this.updateConnectedEdges(routingNodeId);
    }
}

// Initialize NodeUI once the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const canvasContainer = document.getElementById('canvas-container');
    const app = new NodeUI(canvasContainer);

    // --- For Testing ---
    // Center the initial nodes on the canvas
    const { width: containerWidth, height: containerHeight } = canvasContainer.getBoundingClientRect();
    const nodeWidth = 200; // Default from BaseNode
    const nodeHeight = 120; // Default from BaseNode
    const gap = 50;
    
    const x1 = (containerWidth / 2) - nodeWidth - (gap / 2);
    const x2 = (containerWidth / 2) + (gap / 2);
    const y = (containerHeight / 2) - (nodeHeight / 2);

    console.log('%c[Test]%c Firing test node:create event.', 'color: #8e8e8e; font-weight: bold;', 'color: inherit;');
    events.publish('node:create', { x: x1, y: y, title: 'Welcome!' });
    events.publish('node:create', { x: x2, y: y, title: 'Connect Me!' });
    events.publish('node:create', { type: 'GroupNode', x: x1 - 50, y: y - 50, width: 550, height: 250 });
}); 