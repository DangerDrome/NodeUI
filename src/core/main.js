/**
 * @fileoverview Main application orchestrator that manages the canvas, including rendering nodes, edges,
 * and handling all user interactions like panning, zooming, and dragging.
 */

class Main {
    /**
     * @param {HTMLElement} container - The container element for the canvas.
     */
    constructor(container) {
        if (!container) {
            throw new Error("A container element is required for Main.");
        }
        this.container = container;
        this.nodes = new Map();
        this.edges = new Map();
        this.selectedNodes = new Set();
        this.selectedEdges = new Set();

        // Graph context management for SubGraph navigation
        this.graphContext = {
            currentGraphId: 'main',
            graphStack: ['main'],
            breadcrumbData: []
        };

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
                subgraph: { label: 'SubGraph', iconClass: 'icon-squares-subtract' },
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

        this.contextMenuHandler = new ContextMenu(this);
        this.longPressTimer = null;
        this.openPopoverNodeId = null;
        this.maxGroupZIndex = 100; // Start at 100, max 499 to stay below edges at z-index 500
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

        this.edgeHandler = new Edges(this);

        this.init();
    }

    /**
     * Initializes the canvas, sets up the SVG element, and binds event listeners.
     */
    init() {
        // this.container.innerHTML = ''; // Clear any previous content
        this.canvasRenderer = new Canvas(this);
        this.fileHandler = new File(this);
        this.contextMenuHandler = new ContextMenu(this);
        this.nodeManager = new Nodes(this);
        this.interactionHandler = new Interactions(this);
        this.canvasRenderer.initCanvas();
        this.bindEventListeners();
        this.subscribeToEvents();
        this.startPhysicsLoop(); // Start the physics simulation
        console.log('%c[Main]%c Service initialized.', 'color: #3ecf8e; font-weight: bold;', 'color: inherit;');
    }

    /**
     * Binds DOM event listeners for canvas interactions.
     */
    bindEventListeners() {
        document.addEventListener('mousedown', this.interactionHandler.onMouseDown.bind(this.interactionHandler));
        document.addEventListener('mousemove', this.interactionHandler.onMouseMove.bind(this.interactionHandler));
        document.addEventListener('mouseup', this.interactionHandler.onMouseUp.bind(this.interactionHandler));
        
        // Add touch event listeners
        document.addEventListener('touchstart', this.interactionHandler.onTouchStart.bind(this.interactionHandler), { passive: false });
        document.addEventListener('touchmove', this.interactionHandler.onTouchMove.bind(this.interactionHandler), { passive: false });
        document.addEventListener('touchend', this.interactionHandler.onTouchEnd.bind(this.interactionHandler), { passive: false });

        // Add keyboard event listeners
        document.addEventListener('keydown', this.interactionHandler.onKeyDown.bind(this.interactionHandler));
        document.addEventListener('keyup', this.interactionHandler.onKeyUp.bind(this.interactionHandler));

        // Add wheel event for zooming
        this.container.addEventListener('wheel', this.interactionHandler.onWheel.bind(this.interactionHandler), { passive: false });

        // Add context menu event
        document.addEventListener('contextmenu', this.contextMenuHandler.onContextMenu.bind(this.contextMenuHandler));

        // Add drag and drop listeners for graph files
        this.container.addEventListener('dragover', this.fileHandler.onDragOver.bind(this.fileHandler));
        this.container.addEventListener('dragleave', this.fileHandler.onDragLeave.bind(this.fileHandler));
        this.container.addEventListener('drop', this.fileHandler.onDrop.bind(this.fileHandler));

        // Add paste event listener for URLs
        document.removeEventListener('paste', this.fileHandler.onPaste.bind(this.fileHandler));

        // Add resize event listener for watermark positioning
        window.addEventListener('resize', () => {
            if (this.canvasRenderer && this.versionWatermark) {
                this.canvasRenderer.updateWatermarkPosition(this.versionWatermark);
            }
        });

        events.subscribe('contextmenu:hidden', () => {
            if (this.edgeHandler.isDrawing()) {
                this.edgeHandler.cancelDrawingEdge();
            }
        });
    }

    /**
     * Subscribes to application-wide events from the event bus.
     */
    subscribeToEvents() {
        events.subscribe('node:create', (options) => {
            if (options.type === 'GroupNode') {
                this.nodeManager.addNode(new GroupNode(options));
            } else if (options.type === 'RoutingNode') {
                this.nodeManager.addNode(new RoutingNode(options));
            } else if (options.type === 'LogNode') {
                this.nodeManager.addNode(new LogNode(options));
            } else if (options.type === 'SettingsNode') {
                this.nodeManager.addNode(new SettingsNode(options));
            } else if (options.type === 'SubGraphNode') {
                this.nodeManager.addNode(new SubGraphNode(options));
            }
            else {
                this.nodeManager.addNode(new BaseNode(options));
            }
        });
        events.subscribe('edge:create', (options) => this.nodeManager.addEdge(new BaseEdge(options)));
        events.subscribe('node:delete', (nodeId) => this.nodeManager.removeNode(nodeId));
        events.subscribe('edge:delete', (edgeId) => this.nodeManager.removeEdge(edgeId));
        events.subscribe('edge:update', (data) => this.updateEdgeProps(data));
        events.subscribe('snap:grid-toggle', () => this.contextMenuHandler.toggleSnapToGrid());
        events.subscribe('node:update', (data) => this.nodeManager.updateNode(data));
        events.subscribe('snap:object-toggle', this.contextMenuHandler.toggleSnapToObjects.bind(this.contextMenuHandler));
        events.subscribe('node:visual-update', ({ nodeId }) => this.updateConnectedEdges(nodeId));
        events.subscribe('edge:add-routing-node', (data) => this.splitEdgeWithRoutingNode(data));
        events.subscribe('edge:selected', (data) => this.onEdgeSelected(data));
        events.subscribe('edge:create-with-new-node', (data) => this.createNodeAndConnectEdge(data));
        events.subscribe('setting:update', (data) => this.updateSetting(data));
        events.subscribe('edge:edit-label', ({ edgeId }) => {
            const edge = this.edges.get(edgeId);
            if (edge) {
                this.contextMenuHandler.editEdgeLabel(edge);
            }
        });
        events.subscribe('settings:request', () => this.publishSettings());
        events.subscribe('graph:save', () => this.fileHandler.saveGraph());
        events.subscribe('graph:load-content', (json) => this.fileHandler.loadGraph(json));
        events.subscribe('graph:screenshot', () => this.fileHandler.takeScreenshot());

        // SubGraph navigation events
        events.subscribe('subgraph:enter', (data) => this.enterSubGraph(data));
        events.subscribe('subgraph:exit', (data) => this.exitSubGraph(data));
        events.subscribe('subgraph:save', (data) => this.saveSubGraph(data));
        events.subscribe('subgraph:load', (data) => this.loadSubGraph(data));
    }

    /**
     * Adds a node to the canvas and renders it.
     * @param {BaseNode} node - The node instance to add.
     */
    addNode(node) {
        // Moved to NodeManager
        this.nodeManager.addNode(node);
    }

    /**
     * Adds an edge to the canvas and renders it.
     * @param {BaseEdge} edge - The edge instance to add.
     */
    addEdge(edge) {
        // Moved to NodeManager
        this.nodeManager.addEdge(edge);
    }

    /**
     * Removes a node from the canvas and all connected edges.
     * @param {string} nodeId - The ID of the node to remove.
     */
    removeNode(nodeId) {
        // Moved to NodeManager
        this.nodeManager.removeNode(nodeId);
    }

    /**
     * Removes an edge from the canvas.
     * @param {string} edgeId - The ID of the edge to remove.
     */
    removeEdge(edgeId) {
        // Moved to NodeManager
        this.nodeManager.removeEdge(edgeId);
    }

    // --- Interaction Event Handlers ---

    /**
     * Handles the mousedown event on the node container.
     * @param {MouseEvent} event 
     */
    onMouseDown(event) {
        // Moved to InteractionHandler
        this.interactionHandler.onMouseDown(event);
    }

    /**
     * Handles the mousemove event on the document.
     * @param {MouseEvent} event 
     */
    onMouseMove(event) {
        // Moved to InteractionHandler
        this.interactionHandler.onMouseMove(event);
    }

    /**
     * Handles the mouseup event on the document.
     * @param {MouseEvent} event 
     */
    onMouseUp(event) {
        // Moved to InteractionHandler
        this.interactionHandler.onMouseUp(event);
    }

    /**
     * Handles the touchstart event on the node container.
     * @param {TouchEvent} event 
     */
    onTouchStart(event) {
        // Moved to InteractionHandler
        this.interactionHandler.onTouchStart(event);
    }
    
    /**
     * Handles the touchmove event on the document.
     * @param {TouchEvent} event 
     */
    onTouchMove(event) {
        // Moved to InteractionHandler
        this.interactionHandler.onTouchMove(event);
    }

    /**
     * Handles the touchend event on the document.
     * @param {TouchEvent} event 
     */
    onTouchEnd(event) {
        // Moved to InteractionHandler
        this.interactionHandler.onTouchEnd(event);
    }

    /**
     * Handles the wheel event for zooming.
     * @param {WheelEvent} event 
     */
    onWheel(event) {
        // Moved to InteractionHandler
        this.interactionHandler.onWheel(event);
    }

    /**
     * Handles keyboard shortcuts for cut, copy, and paste.
     * @param {KeyboardEvent} event 
     */
    async onKeyDown(event) {
        // Moved to InteractionHandler
        this.interactionHandler.onKeyDown(event);
    }

    /**
     * Handles key up events for ending states like edge cutting.
     * @param {KeyboardEvent} event 
     */
    onKeyUp(event) {
        // Moved to InteractionHandler
        this.interactionHandler.onKeyUp(event);
    }

    // --- Drag Logic ---

    /**
     * Initiates the dragging state for a node.
     * @param {string} nodeId - The ID of the node to drag.
     * @param {number} clientX - The clientX from the triggering event.
     * @param {number} clientY - The clientY from the triggering event.
     */
    startDrag(nodeId, clientX, clientY, isPinned = false) {
        this.interactionHandler.startDrag(nodeId, clientX, clientY, isPinned);
    }

    /**
     * Ends the current dragging state and publishes the result.
     */
    endDrag() {
        this.interactionHandler.endDrag();
    }

    /**
     * Traverses the node hierarchy (groups and selection) to determine all nodes that should move together.
     * @param {string} startNodeId The ID of the node initiating the drag.
     * @returns {Set<string>} A set of node IDs that should be moved.
     */
    getNodesToMove(startNodeId) {
        return this.interactionHandler.getNodesToMove(startNodeId);
    }

    /**
     * Checks for and applies grouping changes after a drag operation.
     */
    updateGroupingForMovedNodes() {
        this.interactionHandler.updateGroupingForMovedNodes();
    }

    /**
     * Finds the group that a given node should be placed in based on its position.
     * It prioritizes the smallest, topmost group.
     * @param {BaseNode} node The node to find a parent for.
     * @returns {GroupNode|null} The best target group or null if none.
     */
    findBestTargetGroup(node) {
        return this.interactionHandler.findBestTargetGroup(node);
    }

    /**
     * Checks if a point (from a node's center) is on an edge.
     * @param {BaseNode} node The node (acting as the point).
     * @param {BaseEdge} edge The edge to check against.
     * @returns {boolean}
     */
    isPointOnEdge(node, edge) {
        return this.interactionHandler.isPointOnEdge(node, edge);
    }

    /**
     * Splits an edge by inserting a node.
     * @param {BaseEdge} edge The edge to split.
     * @param {BaseNode} node The node to insert.
     * @param {boolean} removeOriginalEdge Whether to remove the original edge
     */
    splitEdgeWithNode(edge, node, removeOriginalEdge = true) {
        this.interactionHandler.splitEdgeWithNode(edge, node, removeOriginalEdge);
    }

    // --- Edge Drawing Logic ---

    /**
     * Starts the process of drawing a new edge.
     * @param {string} nodeId - The ID of the starting node.
     * @param {string} handlePosition - The position of the starting handle.
     */
    startDrawingEdge(nodeId, handlePosition) {
        this.edgeHandler.startDrawingEdge(nodeId, handlePosition);
    }

    /**
     * Updates the temporary edge path as the user drags.
     * @param {number} endX - The current X-coordinate of the mouse.
     * @param {number} endY - The current Y-coordinate of the mouse.
     */
    updateDrawingEdge(endX, endY) {
        this.edgeHandler.updateDrawingEdge(endX, endY);
    }

    /**
     * Finishes drawing an edge if the drop is valid.
     * @param {string} endNodeId - The ID of the node where the edge ends.
     * @param {string} endHandlePosition - The position of the handle where the edge ends.
     */
    endDrawingEdge(endNodeId, endHandlePosition) {
        this.edgeHandler.endDrawingEdge(endNodeId, endHandlePosition);
    }

    /**
     * Cancels the current edge drawing operation.
     */
    cancelDrawingEdge() {
        this.edgeHandler.cancelDrawingEdge();
    }

    /**
     * Gets the absolute position of a node's handle.
     * The position is the center of the visible handle, offset from the node's border.
     * @param {string} nodeId - The ID of the node.
     * @param {string} handlePosition - The position of the handle ('top', 'right', 'bottom', 'left').
     * @returns {{x: number, y: number}} The coordinates in world space.
     */
    getHandlePosition(nodeId, handlePosition) {
        // Moved to CanvasRenderer
        return this.canvasRenderer.getHandlePosition(nodeId, handlePosition);
    }

    /**
     * Gets the mouse position relative to the SVG canvas.
     * @param {MouseEvent} event 
     * @returns {{x: number, y: number}}
     */
    getMousePosition(event) {
        // Moved to CanvasRenderer
        return this.canvasRenderer.getMousePosition(event);
    }

    /**
     * Updates the visual representation of an edge.
     * @param {string} edgeId - The ID of the edge to update.
     */
    updateEdge(edgeId) {
        // Moved to CanvasRenderer
        this.canvasRenderer.updateEdge(edgeId);
    }

    /**
     * Calculates a spline path through multiple routing points.
     * @param {Array} points - Array of {x, y} points.
     * @param {string} startHandle - The orientation of the start handle.
     * @param {string} endHandle - The orientation of the end handle.
     * @returns {string} The SVG path `d` attribute string.
     */
    calculateSpline(points, startHandle, endHandle) {
        // Moved to CanvasRenderer
        return this.canvasRenderer.calculateSpline(points, startHandle, endHandle);
        }

    /**
     * Calculates a curved path between two points with optional sag.
     * @param {{x:number, y:number}} startPos The start point.
     * @param {{x:number, y:number}} endPos The end point.
     * @param {string} startHandle The orientation of the start handle.
     * @param {string} endHandle The orientation of the end handle.
     * @returns {string} The SVG path `d` attribute string.
     */
    calculateCurve(startPos, endPos, startHandle, endHandle) {
        // Moved to CanvasRenderer
        return this.canvasRenderer.calculateCurve(startPos, endPos, startHandle, endHandle);
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
        // Moved to CanvasRenderer
        return this.canvasRenderer._getCurvedPathD(startPos, endPos, startHandle, endHandle, sag);
    }

    /**
     * Applies the current pan and zoom transformation to the canvas elements.
     */
    updateCanvasTransform() {
        // Moved to CanvasRenderer
        this.canvasRenderer.updateCanvasTransform();
    }

    /**
     * Animates the pan and zoom transformation to target values.
     * @param {number} targetScale - The target scale value.
     * @param {number} targetOffsetX - The target X offset.
     * @param {number} targetOffsetY - The target Y offset.
     * @param {number} [duration=300] - The animation duration in milliseconds.
     */
    animatePanZoom(targetScale, targetOffsetX, targetOffsetY, duration = 300) {
        // Moved to CanvasRenderer
        this.canvasRenderer.animatePanZoom(targetScale, targetOffsetX, targetOffsetY, duration);
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
        this.interactionHandler.selectAll();
    }

    /**
     * Finishes the selection process and identifies selected nodes.
     */
    endSelection() {
        this.interactionHandler.endSelection();
    }

    /**
     * Checks if a node is within the selection rectangle.
     * @param {BaseNode} node The node to check.
     * @param {DOMRect} selectionRect The bounding rectangle of the selection box.
     * @returns {boolean} True if the node is inside the selection.
     */
    isNodeInSelection(node, selectionRect) {
        return this.interactionHandler.isNodeInSelection(node, selectionRect);
    }

    /**
     * Checks if an edge intersects with the selection rectangle.
     * This is done by sampling points along the edge's path.
     * @param {BaseEdge} edge The edge to check.
     * @param {object} selectionRect The selection rectangle in world space.
     * @returns {boolean} True if the edge intersects the selection.
     */
    isEdgeInSelection(edge, selectionRect) {
        return this.interactionHandler.isEdgeInSelection(edge, selectionRect);
    }

    /**
     * Adds a node to the current selection.
     * @param {string} nodeId The ID of the node to select.
     */
    selectNode(nodeId) {
        this.interactionHandler.selectNode(nodeId);
    }

    /**
     * Adds an edge to the current selection.
     * @param {string} edgeId The ID of the edge to select.
     */
    selectEdge(edgeId) {
        this.interactionHandler.selectEdge(edgeId);
    }

    /**
     * Clears the current selection.
     */
    clearSelection() {
        this.interactionHandler.clearSelection();
    }

    // --- Clipboard Logic ---

    /**
     * Copies the selected nodes and their connecting edges to the clipboard.
     */
    copySelection() {
        this.interactionHandler.copySelection();
    }

    /**
     * Cuts the selected nodes by copying them and then deleting them.
     */
    cutSelection() {
        this.interactionHandler.cutSelection();
    }

    /**
     * Pastes nodes and edges from the clipboard onto the canvas at the mouse location.
     */
    paste() {
        this.interactionHandler.paste();
    }

    /**
     * Removes an edge from the current selection.
     * @param {string} edgeId The ID of the edge to deselect.
     */
    deselectEdge(edgeId) {
        this.interactionHandler.deselectEdge(edgeId);
    }

    // --- Edge Cutting Logic ---

    startCuttingLine(event) {
        // Moved to CanvasRenderer
        this.canvasRenderer.startCuttingLine(event);
    }

    updateCuttingLine(event) {
        // Moved to CanvasRenderer
        this.canvasRenderer.updateCuttingLine(event);
    }

    endCuttingLine(performCut = true) {
        // Moved to CanvasRenderer
        this.canvasRenderer.endCuttingLine(performCut);
    }

    lineIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
        // Moved to CanvasRenderer
        return this.canvasRenderer.lineIntersect(x1, y1, x2, y2, x3, y3, x4, y4);
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

    /**
     * Draws a snap guide line on the canvas.
     * @param {number} val - The position value (x for vertical, y for horizontal).
     * @param {string} orientation - 'v' for vertical, 'h' for horizontal.
     * @param {string} [color='var(--color-danger)'] - The color of the guide line.
     */
    drawGuide(val, orientation, color = 'var(--color-danger)') {
        // Moved to CanvasRenderer
        this.canvasRenderer.drawGuide(val, orientation, color);
    }
    
    /**
     * Clears all snap guide lines from the canvas.
     */
    clearGuides() {
        // Moved to CanvasRenderer
        this.canvasRenderer.clearGuides();
    }

    /**
     * Handles the context menu event.
     * @param {MouseEvent} event 
     */
    onContextMenu(event) {
        // Moved to ContextMenuHandler
        this.contextMenuHandler.onContextMenu(event);
    }

    /**
     * Shows the main canvas context menu.
     * @param {number} x The screen x-coordinate.
     * @param {number} y The screen y-coordinate.
     * @param {object|null} edgeStartInfo - Information about a pending edge connection.
     */
    showCanvasContextMenu(x, y, edgeStartInfo = null) {
        // Moved to ContextMenuHandler
        this.contextMenuHandler.showCanvasContextMenu(x, y, edgeStartInfo);
    }

    /**
     * Shows the context menu for a specific edge.
     * @param {number} x The screen x-coordinate.
     * @param {number} y The screen y-coordinate.
     * @param {string} edgeId The ID of the edge.
     */
    showEdgeContextMenu(x, y, edgeId) {
        // Moved to ContextMenuHandler
        this.contextMenuHandler.showEdgeContextMenu(x, y, edgeId);
    }

    /**
     * Creates an inline editor for an edge's label.
     * @param {BaseEdge} edge The edge to edit.
     */
    editEdgeLabel(edge) {
        // Moved to ContextMenuHandler
        this.contextMenuHandler.editEdgeLabel(edge);
    }

    /**
     * Toggles the snap-to-grid functionality.
     * @param {boolean} [force] - Optional boolean to force a state.
     */
    toggleSnapToGrid(force) {
        // Moved to ContextMenuHandler
        this.contextMenuHandler.toggleSnapToGrid(force);
    }

    /**
     * Toggles the snap-to-objects functionality.
     * @param {boolean} [force] - Optional boolean to force a state.
     */
    toggleSnapToObjects(force) {
        // Moved to ContextMenuHandler
        this.contextMenuHandler.toggleSnapToObjects(force);
    }

    /**
     * Determines the most logical handle on an end node for a new connection
     * based on the relative position of the start node.
     * @param {BaseNode} startNode The node where the edge originates.
     * @param {BaseNode} endNode The newly created node where the edge will terminate.
     * @returns {string} The handle position ('top', 'right', 'bottom', 'left').
     */
    getOptimalHandle(startNode, endNode) {
        // Moved to ContextMenuHandler
        return this.contextMenuHandler.getOptimalHandle(startNode, endNode);
    }

    /**
     * Updates a node's properties based on an event.
     * @param {{nodeId: string, [key: string]: any}} data The update data.
     */
    updateNode(data) {
        // Moved to NodeManager
        this.nodeManager.updateNode(data);
    }

    /**
     * Recursively gets all nodes contained within a group, including those in nested groups.
     * @param {GroupNode} groupNode The parent group.
     * @returns {Set<BaseNode>} A set of all contained node instances.
     */
    getAllContainedNodes(groupNode) {
        // Moved to NodeManager
        return this.nodeManager.getAllContainedNodes(groupNode);
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
        // Moved to NodeManager
        this.nodeManager.toggleNodePopover(nodeId);
    }

    /**
     * Adds event listeners to the controls inside a node's popover.
     * @param {BaseNode} node The node whose popover needs listeners.
     */
    addPopoverListeners(node) {
        // Moved to NodeManager
        this.nodeManager.addPopoverListeners(node);
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
        // Moved to NodeManager
        this.nodeManager.cycleNodeColor(nodeId);
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
        // Moved to CanvasRenderer
        return this.canvasRenderer.distanceToSegment(p, v, w);
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

    // --- Routing Cut Logic ---

    startRoutingCut(event) {
        this.edgeHandler.startRoutingCut(event);
    }

    updateRoutingCut(event) {
        this.edgeHandler.updateRoutingCut(event);
    }

    endRoutingCut() {
        this.edgeHandler.endRoutingCut();
    }

    // Edge routing state management
    startEdgeRouting(edgeId, pointIndex) {
        this.edgeHandler.startEdgeRouting(edgeId, pointIndex);
    }

    updateEdgeRouting(event) {
        this.edgeHandler.updateEdgeRouting(event);
    }

    endEdgeRouting() {
        this.edgeHandler.endEdgeRouting();
    }

    getRoutingCutState() {
        return this.edgeHandler.getRoutingCutState();
    }

    getRoutingState() {
        return this.edgeHandler.getRoutingState();
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
        this.nodeManager.addNode(routingNode);

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
        // Moved to NodeManager
        this.nodeManager.bringToFront(startNodeId);
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
            const oldParent = this.interactionHandler.findParentGroup(nodeId);
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
        // Moved to NodeManager
        this.nodeManager.createNodeAtMousePosition();
    }

    /**
     * Creates a new RoutingNode at the last known mouse position.
     */
    createRoutingNodeAtMousePosition() {
        // Moved to NodeManager
        this.nodeManager.createRoutingNodeAtMousePosition();
    }

    /**
     * Cycles through the available colors for a given routing node on right-click.
     * @param {string} routingNodeId The ID of the routing node to cycle.
     */
    cycleRoutingNodeColor(routingNodeId) {
        // Moved to NodeManager
        this.nodeManager.cycleRoutingNodeColor(routingNodeId);
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
     * Publishes the current state of Main settings.
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
        // Moved to FileHandler
        this.fileHandler.saveGraph();
    }

    /**
     * Loads a graph from a JSON string.
     * @param {string} json
     */
    loadGraph(json) {
        // Moved to FileHandler
        this.fileHandler.loadGraph(json);
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
        this.maxGroupZIndex = 100;
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
        // Moved to FileHandler
        this.fileHandler.takeScreenshot();
    }

    /**
     * Deeply merges two objects. The source object's properties overwrite the target's.
     * @param {object} target The target object.
     * @param {object} source The source object.
     * @returns {object} The merged object.
     */
    deepMerge(target, source) {
        // Moved to FileHandler
        return this.fileHandler.deepMerge(target, source);
    }
    
    /**
     * Utility to check if a variable is a non-null object.
     * @param {*} item The variable to check.
     * @returns {boolean}
     */
    isObject(item) {
        // Moved to FileHandler
        return this.fileHandler.isObject(item);
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
        // Moved to FileHandler
        this.fileHandler.onDragOver(event);
    }

    /**
     * Handles the dragleave event for file drops.
     * @param {DragEvent} event
     */
    onDragLeave(event) {
        // Moved to FileHandler
        this.fileHandler.onDragLeave(event);
    }

    /**
     * Handles the drop event for files, supporting graph loading and image embedding.
     * @param {DragEvent} event
     */
    onDrop(event) {
        // Moved to FileHandler
        this.fileHandler.onDrop(event);
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
        // Moved to CanvasRenderer
        this.canvasRenderer.startPhysicsLoop();
    }

    /**
     * "Plucks" an edge, giving its control point velocity and starting the physics simulation.
     * @param {BaseEdge} edge 
     */
    pluckEdge(edge) {
        // Moved to CanvasRenderer
        this.canvasRenderer.pluckEdge(edge);
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

    /**
     * Handles pasting content from the clipboard, such as URLs.
     * @param {ClipboardEvent} event
     */
    onPaste(event) {
        this.interactionHandler.onPaste(event);
    }

    /**
     * Serializes the current graph state, including type-specific properties.
     * @returns {object} The serialized graph state.
     */
    serializeCurrentGraph() {
        return {
            nodes: Array.from(this.nodes.values()).map(node => {
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

                // Add type-specific properties
                if (node.type === 'SubGraphNode') {
                    nodeData.internalGraph = node.internalGraph;
                    nodeData.subgraphPath = node.subgraphPath;
                    nodeData.subgraphId = node.subgraphId;
                }
                if (node.type === 'GroupNode') {
                    nodeData.containedNodeIds = Array.from(node.containedNodeIds);
                }

                return nodeData;
            }),
            edges: Array.from(this.edges.values()).map(edge => ({
                id: edge.id,
                startNodeId: edge.startNodeId,
                endNodeId: edge.endNodeId,
                startHandleId: edge.startHandleId,
                endHandleId: edge.endHandleId,
                label: edge.label,
                routingPoints: edge.routingPoints || []
            })),
            canvasState: {
                scale: this.panZoom.scale,
                offsetX: this.panZoom.offsetX,
                offsetY: this.panZoom.offsetY
            }
        };
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

    // --- SubGraph Navigation Methods ---

    /**
     * Navigates into a SubGraph for editing.
     * @param {object} data - SubGraph entry data.
     * @param {string} data.subgraphId - The SubGraph ID.
     * @param {string} data.subgraphPath - Path to the SubGraph JSON file.
     * @param {object} data.internalGraph - The internal graph data.
     * @param {string} data.parentNodeId - The parent SubGraph node ID.
     */
    enterSubGraph(data) {
        const { subgraphId, subgraphPath, internalGraph, parentNodeId } = data;

        // Save a deep copy of the current graph state
        const currentGraphState = JSON.parse(JSON.stringify(this.serializeCurrentGraph()));

        // Update graph context
        this.graphContext.graphStack.push(subgraphId);
        this.graphContext.currentGraphId = subgraphId;
        this.graphContext.breadcrumbData.push({
            graphId: subgraphId,
            title: this.nodes.get(parentNodeId)?.title || 'SubGraph',
            parentNodeId: parentNodeId,
            graphState: currentGraphState
        });

        // Clear current canvas
        this.clearAll();

        // Load internal graph data
        if (internalGraph) {
            this.loadInternalGraph(internalGraph);
        } else {
            // Load from file if no internal data provided
            this.loadSubGraph({ path: subgraphPath });
        }

        // Update UI for SubGraph mode
        this.container.classList.add('subgraph-editor-mode');
        this.showBreadcrumb();
    }

    /**
     * Exits the current SubGraph and returns to the parent graph.
     * @param {object} data - SubGraph exit data.
     * @param {string} data.subgraphId - The SubGraph ID.
     * @param {string} data.parentNodeId - The parent SubGraph node ID.
     */
    exitSubGraph(data) {
        if (this.graphContext.graphStack.length <= 1) {
            console.warn("Attempted to exit base graph. Operation aborted.");
            return;
        }

        const { subgraphId, parentNodeId } = data;

        // Save current SubGraph state
        const currentGraphState = this.serializeCurrentGraph();

        // Pop from graph context stack
        this.graphContext.graphStack.pop();
        this.graphContext.currentGraphId = this.graphContext.graphStack[this.graphContext.graphStack.length - 1];
        const breadcrumbItem = this.graphContext.breadcrumbData.pop();

        // Clear current canvas
        this.clearAll();

        // Restore parent graph state
        if (breadcrumbItem && breadcrumbItem.graphState) {
            this.loadInternalGraph(breadcrumbItem.graphState);
        }

        // Update the parent SubGraph node with the new internal graph data
        // We need to find the parent node in the restored graph
        const parentNode = this.nodes.get(parentNodeId);
        if (parentNode && parentNode.updateInternalGraph) {
            parentNode.updateInternalGraph(currentGraphState);
            // Force re-render of the preview
            if (parentNode.forceRenderPreview) {
                parentNode.forceRenderPreview();
            }
            // Also update the preview
            if (parentNode.updatePreview) {
                parentNode.updatePreview();
            }
        }

        // Update UI for the new context
        if (this.graphContext.currentGraphId === 'main') {
            // We are back at the root graph.
            this.container.classList.remove('subgraph-editor-mode');
            this.hideBreadcrumb();
            this.graphContext.graphStack = ['main'];
            this.graphContext.breadcrumbData = [];
        } else {
            // We are in a parent subgraph, so re-render the breadcrumbs for the new level.
            this.showBreadcrumb();
        }
    }

    /**
     * Loads graph data into the current canvas.
     * @param {object} graphData - The graph data to load.
     */
    loadInternalGraph(graphData) {
        // Load nodes first
        if (graphData.nodes) {
            graphData.nodes.forEach(nodeData => {
                const node = this.createNodeFromData(nodeData);
                if (node) {
                    this.nodeManager.addNode(node);
                }
            });
        }

        // Load edges after nodes are created and rendered
        if (graphData.edges) {
            graphData.edges.forEach(edgeData => {
                const edge = new BaseEdge({
                    id: edgeData.id,
                    startNodeId: edgeData.startNodeId,
                    endNodeId: edgeData.endNodeId,
                    startHandleId: edgeData.startHandleId,
                    endHandleId: edgeData.endHandleId,
                    label: edgeData.label || '',
                    routingPoints: edgeData.routingPoints || []
                });
                this.nodeManager.addEdge(edge);
            });

            // Update all edges to ensure proper rendering
            this.edges.forEach(edge => {
                this.updateEdge(edge.id);
            });
        }

        // Restore canvas state
        if (graphData.canvasState) {
            this.panZoom.scale = graphData.canvasState.scale || 1;
            this.panZoom.offsetX = graphData.canvasState.offsetX || 0;
            this.panZoom.offsetY = graphData.canvasState.offsetY || 0;
            this.canvasRenderer.updateCanvasTransform();
        }
    }

    /**
     * Creates a node instance from node data.
     * @param {object} nodeData - The node data.
     * @returns {BaseNode} The created node instance.
     */
    createNodeFromData(nodeData) {
        switch (nodeData.type) {
            case 'GroupNode':
                return new GroupNode(nodeData);
            case 'RoutingNode':
                return new RoutingNode(nodeData);
            case 'LogNode':
                return new LogNode(nodeData);
            case 'SettingsNode':
                return new SettingsNode(nodeData);
            case 'SubGraphNode':
                return new SubGraphNode(nodeData);
            default:
                return new BaseNode(nodeData);
        }
    }

    /**
     * Shows the breadcrumb navigation.
     */
    showBreadcrumb() {
        // Remove existing breadcrumb
        this.hideBreadcrumb();

        const breadcrumbContainer = document.createElement('div');
        breadcrumbContainer.className = 'breadcrumb-container';

        // Add a "Main" breadcrumb item
        const mainItem = document.createElement('a');
        mainItem.className = 'breadcrumb-item';
        mainItem.href = '#';
        mainItem.innerHTML = `
            <span class="icon icon-network"></span>
            <span>Main</span>
        `;
        mainItem.addEventListener('click', (event) => {
            event.preventDefault();
            this.navigateToBreadcrumb(-1); // Use -1 to signify the root
        });
        breadcrumbContainer.appendChild(mainItem);

        // Add breadcrumb items for each subgraph
        this.graphContext.breadcrumbData.forEach((item, index) => {
            const separator = document.createElement('span');
            separator.className = 'breadcrumb-separator';
            separator.textContent = '>';
            breadcrumbContainer.appendChild(separator);

            const breadcrumbItem = document.createElement('a');
            breadcrumbItem.className = 'breadcrumb-item';
            breadcrumbItem.href = '#';
            breadcrumbItem.innerHTML = `
                <span class="icon icon-squares-subtract"></span>
                <span>${item.title}</span>
            `;
            breadcrumbItem.addEventListener('click', (event) => {
                event.preventDefault();
                this.navigateToBreadcrumb(index);
            });
            breadcrumbContainer.appendChild(breadcrumbItem);
        });

        document.body.appendChild(breadcrumbContainer);
        this.breadcrumbElement = breadcrumbContainer;
    }

    /**
     * Hides the breadcrumb navigation.
     */
    hideBreadcrumb() {
        if (this.breadcrumbElement) {
            this.breadcrumbElement.remove();
            this.breadcrumbElement = null;
        }
    }

    /**
     * Navigates to a specific breadcrumb level.
     * @param {number} index - The breadcrumb index to navigate to. -1 for the root.
     */
    navigateToBreadcrumb(index) {
        const currentLevel = this.graphContext.breadcrumbData.length - 1;
        const levelsToExit = currentLevel - index;

        for (let i = 0; i < levelsToExit; i++) {
            const currentBreadcrumb = this.graphContext.breadcrumbData[this.graphContext.breadcrumbData.length - 1];
            if (currentBreadcrumb) {
                this.exitSubGraph({
                    subgraphId: currentBreadcrumb.graphId,
                    parentNodeId: currentBreadcrumb.parentNodeId
                });
            }
        }
    }

    /**
     * Saves a SubGraph to its JSON file.
     * @param {object} data - Save data.
     * @param {string} data.path - The file path.
     * @param {object} data.data - The SubGraph data.
     */
    saveSubGraph(data) {
        this.fileHandler.saveSubGraph(data.path, data.data);
    }

    /**
     * Loads a SubGraph from its JSON file.
     * @param {object} data - Load data.
     * @param {string} data.path - The file path.
     * @param {function} data.callback - Callback function with loaded data.
     */
    loadSubGraph(data) {
        this.fileHandler.loadSubGraph(data.path, data.callback);
    }
}

// Initialize Main once the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const canvasContainer = document.getElementById('canvas-container');
    const app = new Main(canvasContainer);

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

// Attach to window for global access
window.Main = Main;