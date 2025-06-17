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

        this.draggingState = {
            isDragging: false,
            targetNode: null,
            startX: 0,
            startY: 0,
            offsetX: 0,
            offsetY: 0
        };

        this.edgeDrawingState = {
            isDrawing: false,
            startNodeId: null,
            startHandlePosition: null,
            tempEdgeElement: null
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

        this.snapToGrid = 20; // Grid size, can be false or a number
        this.snapToObjects = true;
        this.snapThreshold = 5;

        this.contextMenu = new ContextMenu(this.container, events);
        this.longPressTimer = null;

        this.panZoom = {
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            isPanning: false
        };

        this.init();
    }

    /**
     * Initializes the canvas, sets up the SVG element, and binds event listeners.
     */
    init() {
        this.container.innerHTML = ''; // Clear any previous content

        // Create the main SVG canvas
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.classList.add('node-ui-canvas');

        // Create the grid pattern definition
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
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
        defs.appendChild(pattern);
        this.svg.appendChild(defs);

        // Create the rectangle to display the grid
        this.gridRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        this.gridRect.setAttribute('width', '100%');
        this.gridRect.setAttribute('height', '100%');
        this.gridRect.setAttribute('fill', 'url(#grid-pattern)');
        this.svg.appendChild(this.gridRect);

        // Create a group for all pannable/zoomable elements
        this.canvasGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.svg.appendChild(this.canvasGroup);
        
        // Create a group for snapping guides
        this.guideGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.guideGroup.classList.add('guide-group');
        this.canvasGroup.appendChild(this.guideGroup);

        // Create a container for node DOM elements
        this.nodeContainer = document.createElement('div');
        this.nodeContainer.classList.add('node-container');

        // Create the selection box element within the node container
        this.selectionState.selectionBox = document.createElement('div');
        this.selectionState.selectionBox.classList.add('selection-box');
        this.nodeContainer.appendChild(this.selectionState.selectionBox);

        this.container.appendChild(this.svg);
        this.container.appendChild(this.nodeContainer);
        
        this.bindEventListeners();
        this.subscribeToEvents();

        console.log('%c[NodeUI]%c Service initialized.', 'color: #3ecf8e; font-weight: bold;', 'color: inherit;');
    }

    /**
     * Binds DOM event listeners for canvas interactions.
     */
    bindEventListeners() {
        this.nodeContainer.addEventListener('mousedown', this.onMouseDown.bind(this));
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
        
        // Add touch event listeners
        this.nodeContainer.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
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
        events.subscribe('node:create', (options) => this.addNode(new BaseNode(options)));
        events.subscribe('edge:create', (options) => this.addEdge(new BaseEdge(options)));
        events.subscribe('node:delete', (nodeId) => this.removeNode(nodeId));
        events.subscribe('edge:delete', (edgeId) => this.removeEdge(edgeId));
        events.subscribe('snap:grid-toggle', () => this.toggleSnapToGrid());
    }

    /**
     * Adds a node to the canvas and renders it.
     * @param {BaseNode} node - The node instance to add.
     */
    addNode(node) {
        this.nodes.set(node.id, node);
        node.render(this.nodeContainer);
    }

    /**
     * Adds an edge to the canvas and renders it.
     * @param {BaseEdge} edge - The edge instance to add.
     */
    addEdge(edge) {
        this.edges.set(edge.id, edge);
        edge.render(this.canvasGroup); // Edges are SVG elements
        this.updateEdge(edge.id); // Draw it
    }

    /**
     * Removes a node from the canvas.
     * @param {string} nodeId - The ID of the node to remove.
     */
    removeNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (node && node.element) {
            node.element.remove();
            this.nodes.delete(nodeId);
        }
    }

    /**
     * Removes an edge from the canvas.
     * @param {string} edgeId - The ID of the edge to remove.
     */
    removeEdge(edgeId) {
        const edge = this.edges.get(edgeId);
        if (edge && edge.element) {
            edge.element.remove();
            this.edges.delete(edgeId);
        }
    }

    // --- Interaction Event Handlers ---

    /**
     * Handles the mousedown event on the node container.
     * @param {MouseEvent} event 
     */
    onMouseDown(event) {
        if (this.edgeCutState.isCutting) {
            this.startCuttingLine(event);
            return;
        }
        if (event.target.classList.contains('node-handle')) {
            const { nodeId, handlePosition } = event.target.dataset;
            this.startDrawingEdge(nodeId, handlePosition);
            return;
        }

        // If the click is on a title bar, start dragging a node
        if (event.target.classList.contains('node-title-bar')) {
            const nodeId = event.target.closest('.node').id;
            // If the node is not part of a multi-selection, clear the selection.
            // This allows dragging a single unselected node without clearing the current selection.
            if (!this.selectedNodes.has(nodeId)) {
                this.clearSelection();
                this.selectNode(nodeId);
            }
            this.startDrag(nodeId, event.clientX, event.clientY);
            return;
        } 
        // Otherwise, if the click is on the container itself, start panning OR selecting
        else if (event.target === this.nodeContainer) {
            // If shift is held, we pan. Otherwise, we start selecting.
            if (event.shiftKey) {
                this.panZoom.isPanning = true;
                this.draggingState.startX = event.clientX;
                this.draggingState.startY = event.clientY;
            } else {
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

                this.clearSelection();
            }
        } else if (this.edgeDrawingState.isDrawing) {
            const mousePos = this.getMousePosition(event);
            this.updateDrawingEdge(mousePos.x, mousePos.y);
        }
    }

    /**
     * Handles the mousemove event on the document.
     * @param {MouseEvent} event 
     */
    onMouseMove(event) {
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
        
        if (this.draggingState.isDragging) {
            // Raw mouse movement
            const dx = event.clientX - this.draggingState.startX;
            const dy = event.clientY - this.draggingState.startY;

            // Tentative new position
            let newX = this.draggingState.targetNode.originalX + (dx / this.panZoom.scale);
            let newY = this.draggingState.targetNode.originalY + (dy / this.panZoom.scale);

            if (this.snapToObjects) {
                const snapResult = this.checkForSnapping(this.draggingState.targetNode, newX, newY);
                newX = snapResult.x;
                newY = snapResult.y;
            }
            
            if (this.selectedNodes.size > 1 && this.selectedNodes.has(this.draggingState.targetNode.id)) {
                const deltaX = newX - (this.draggingState.targetNode.originalX + (dx / this.panZoom.scale));
                const deltaY = newY - (this.draggingState.targetNode.originalY + (dy / this.panZoom.scale));
                
                // Move all selected nodes
                this.selectedNodes.forEach(nodeId => {
                    const node = this.nodes.get(nodeId);
                    node.x = node.originalX + (dx / this.panZoom.scale) + deltaX;
                    node.y = node.originalY + (dy / this.panZoom.scale) + deltaY;
                    node.element.style.left = `${node.x}px`;
                    node.element.style.top = `${node.y}px`;
                    this.updateConnectedEdges(node.id);
                });
            } else {
                // Move a single node
                const node = this.draggingState.targetNode;
                node.x = newX;
                node.y = newY;
                node.element.style.left = `${node.x}px`;
                node.element.style.top = `${node.y}px`;
                this.updateConnectedEdges(node.id);
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
    }

    /**
     * Handles the mouseup event on the document.
     * @param {MouseEvent} event 
     */
    onMouseUp(event) {
        if (this.edgeCutState.isCutting) {
            this.endCuttingLine();
            // Don't reset isCutting here, it's handled by onKeyUp
            return;
        }
        if (this.selectionState.isSelecting) {
            this.endSelection();
            return;
        }
        if (this.edgeDrawingState.isDrawing) {
            if (event.target.classList.contains('node-handle')) {
                const { nodeId, handlePosition } = event.target.dataset;
                this.endDrawingEdge(nodeId, handlePosition);
            } else {
                this.cancelDrawingEdge();
            }
            return;
        }
        if (this.draggingState.isDragging) {
            this.endDrag();
        }
        if (this.panZoom.isPanning) {
            this.panZoom.isPanning = false;
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

        if (event.target.classList.contains('node-handle')) {
            event.preventDefault(); // Prevent scrolling
            const { nodeId, handlePosition } = event.target.dataset;
            this.startDrawingEdge(nodeId, handlePosition);
            return;
        }
        if (event.target.classList.contains('node-title-bar')) {
            event.preventDefault(); // Prevent scrolling
            const nodeId = event.target.closest('.node').id;
            this.startDrag(nodeId, touch.clientX, touch.clientY);
        } else if (event.target === this.nodeContainer) {
            event.preventDefault(); // Prevent scrolling
            this.panZoom.isPanning = true;
            this.draggingState.startX = touch.clientX;
            this.draggingState.startY = touch.clientY;
        }
    }
    
    /**
     * Handles the touchmove event on the document.
     * @param {TouchEvent} event 
     */
    onTouchMove(event) {
        // If the finger moves, it's not a long press
        clearTimeout(this.longPressTimer);

        if (this.draggingState.isDragging) {
            event.preventDefault(); // Prevent scrolling
            const touch = event.touches[0];
            const node = this.draggingState.targetNode;

            const dx = touch.clientX - this.draggingState.startX;
            const dy = touch.clientY - this.draggingState.startY;

            node.x = this.draggingState.offsetX + (dx / this.panZoom.scale);
            node.y = this.draggingState.offsetY + (dy / this.panZoom.scale);
            
            node.element.style.left = `${node.x}px`;
            node.element.style.top = `${node.y}px`;

            this.updateConnectedEdges(node.id);

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

        if (this.edgeDrawingState.isDrawing) {
            // Touchend doesn't have a target, so we need to find the element at the touch point
            const touch = event.changedTouches[0];
            const endElement = document.elementFromPoint(touch.clientX, touch.clientY);
            
            if (endElement && endElement.classList.contains('node-handle')) {
                const { nodeId, handlePosition } = endElement.dataset;
                this.endDrawingEdge(nodeId, handlePosition);
            } else {
                this.cancelDrawingEdge();
            }
        }
        if (this.draggingState.isDragging) {
            this.endDrag();
        }
        if (this.panZoom.isPanning) {
            this.panZoom.isPanning = false;
        }
        if (this.selectionState.isSelecting) {
            this.endSelection();
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

        if (isModKey && event.key === 'c') {
            event.preventDefault();
            this.copySelection();
        } else if (isModKey && event.key === 'x') {
            event.preventDefault();
            this.cutSelection();
        } else if (isModKey && event.key === 'v') {
            event.preventDefault();
            this.paste();
        } else if (event.key === 'c' && !isModKey) {
            event.preventDefault();
            this.edgeCutState.isCutting = true;
            this.container.classList.add('is-cutting');
        }
    }

    /**
     * Handles key up events for ending states like edge cutting.
     * @param {KeyboardEvent} event 
     */
    onKeyUp(event) {
        if (event.key === 'c') {
            this.edgeCutState.isCutting = false;
            this.container.classList.remove('is-cutting');
            // If a cut line is still present, remove it
            if (this.edgeCutState.cutLine) {
                this.edgeCutState.cutLine.remove();
                this.edgeCutState.cutLine = null;
            }
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
        
        // If we are dragging a group of selected nodes, we need to store their original positions
        if (this.selectedNodes.size > 1 && this.selectedNodes.has(nodeId)) {
            this.selectedNodes.forEach(selectedNodeId => {
                const selectedNode = this.nodes.get(selectedNodeId);
                selectedNode.originalX = selectedNode.x;
                selectedNode.originalY = selectedNode.y;
            });
        } else {
            node.originalX = node.x;
            node.originalY = node.y;
        }
        
        node.element.classList.add('is-dragging');
    }

    /**
     * Ends the current dragging state and publishes the result.
     */
    endDrag() {
        const { targetNode } = this.draggingState;
        if (!targetNode) return;

        targetNode.element.classList.remove('is-dragging');

        let finalX = targetNode.x;
        let finalY = targetNode.y;

        if (this.snapToGrid) {
            finalX = Math.round(finalX / this.snapToGrid) * this.snapToGrid;
            finalY = Math.round(finalY / this.snapToGrid) * this.snapToGrid;
        }

        if (this.snapToObjects) {
            this.clearGuides();
        }

        // Calculate the offset from the original position of the primary node
        const dx = finalX - targetNode.x;
        const dy = finalY - targetNode.y;

        // If multiple nodes are selected, apply the same snapped offset to all of them
        if (this.selectedNodes.size > 1 && this.selectedNodes.has(targetNode.id)) {
            this.selectedNodes.forEach(nodeId => {
                const node = this.nodes.get(nodeId);
                // For the primary node, we use the snapped position directly
                if (node.id === targetNode.id) {
                    node.x = finalX;
                    node.y = finalY;
                } else {
                    // For other nodes, we apply the delta from the original unsnapped position
                    node.x += dx;
                    node.y += dy;
                }
                
                events.publish('node:moved', { nodeId: node.id, x: node.x, y: node.y });
                node.element.style.left = `${node.x}px`;
                node.element.style.top = `${node.y}px`;
                this.updateConnectedEdges(node.id);
            });
        } else {
            // The node's x/y is already in the correct "world" space.
            events.publish('node:moved', {
                nodeId: targetNode.id,
                x: finalX,
                y: finalY
            });
            
            // Update the visual position after snapping
            targetNode.x = finalX;
            targetNode.y = finalY;
            targetNode.element.style.left = `${finalX}px`;
            targetNode.element.style.top = `${finalY}px`;
            this.updateConnectedEdges(targetNode.id);
        }

        // Reset dragging state
        this.draggingState.isDragging = false;
        this.draggingState.targetNode = null;
    }

    // --- Edge Drawing Logic ---

    /**
     * Starts the process of drawing a new edge.
     * @param {string} nodeId - The ID of the starting node.
     * @param {string} handlePosition - The position of the starting handle.
     */
    startDrawingEdge(nodeId, handlePosition) {
        this.edgeDrawingState.isDrawing = true;
        this.edgeDrawingState.startNodeId = nodeId;
        this.edgeDrawingState.startHandlePosition = handlePosition;

        // Create a temporary path element
        const tempEdge = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tempEdge.classList.add('edge', 'edge-drawing');
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

        const startPos = this.getHandlePosition(state.startNodeId, state.startHandlePosition);
        
        const pathData = `M ${startPos.x} ${startPos.y} C ${startPos.x} ${startPos.y + 100}, ${endX} ${endY - 100}, ${endX} ${endY}`;
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
            this.cancelDrawingEdge();
            return;
        }

        events.publish('edge:create', {
            startNodeId: state.startNodeId,
            startHandleId: state.startHandlePosition,
            endNodeId: endNodeId,
            endHandleId: endHandlePosition,
        });

        this.cancelDrawingEdge();
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
            tempEdgeElement: null
        };
    }

    /**
     * Gets the absolute position of a node's handle.
     * @param {string} nodeId - The ID of the node.
     * @param {string} handlePosition - The position of the handle ('top', 'right', 'bottom', 'left').
     * @returns {{x: number, y: number}} The coordinates.
     */
    getHandlePosition(nodeId, handlePosition) {
        const node = this.nodes.get(nodeId);
        if (!node) return { x: 0, y: 0 };
        
        let x = node.x;
        let y = node.y;

        // Get handle center relative to node's top-left corner
        switch (handlePosition) {
            case 'top':
                x += node.width / 2;
                break;
            case 'right':
                x += node.width;
                y += node.height / 2;
                break;
            case 'bottom':
                x += node.width / 2;
                y += node.height;
                break;
            case 'left':
                y += node.height / 2;
                break;
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

        const startPos = this.getHandlePosition(edge.startNodeId, edge.startHandleId);
        const endPos = this.getHandlePosition(edge.endNodeId, edge.endHandleId);

        const pathData = `M ${startPos.x} ${startPos.y} C ${startPos.x} ${startPos.y + 100}, ${endPos.x} ${endPos.y - 100}, ${endPos.x} ${endPos.y}`;
        edge.element.setAttribute('d', pathData);
    }

    /**
     * Applies the current pan and zoom transformation to the canvas elements.
     */
    updateCanvasTransform() {
        // The container holds the nodes, it gets panned and zoomed
        const transform = `translate(${this.panZoom.offsetX}px, ${this.panZoom.offsetY}px) scale(${this.panZoom.scale})`;
        this.nodeContainer.style.transform = transform;
        
        // The SVG is only for the grid and edges, it doesn't move
        const pattern = this.svg.getElementById('grid-pattern');
        if(pattern) {
            // We transform the pattern inside the SVG to give the illusion of an infinite grid
            const gridScale = this.panZoom.scale;
            const gridX = this.panZoom.offsetX;
            const gridY = this.panZoom.offsetY;
            pattern.setAttribute('patternTransform', `translate(${gridX} ${gridY}) scale(${gridScale})`);
        }
    }

    /**
     * Updates all edges connected to a given node.
     * @param {string} nodeId - The ID of the node that has moved.
     */
    updateConnectedEdges(nodeId) {
        this.edges.forEach(edge => {
            if (edge.startNodeId === nodeId || edge.endNodeId === nodeId) {
                this.updateEdge(edge.id);
            }
        });
    }

    // --- Selection Logic ---

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

        events.publish('selection:changed', {
            selectedNodeIds: Array.from(this.selectedNodes)
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
     * Adds a node to the current selection.
     * @param {string} nodeId The ID of the node to select.
     */
    selectNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (node && node.element) {
            this.selectedNodes.add(nodeId);
            node.element.classList.add('is-selected');
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
            }
        });
        this.selectedNodes.clear();
        events.publish('selection:changed', { selectedNodeIds: [] });
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
                this.clipboard.nodes.push({ ...node, element: null, handles: {}});
            }
        });

        // Find and clone edges that connect the selected nodes
        this.edges.forEach(edge => {
            if (this.selectedNodes.has(edge.startNodeId) && this.selectedNodes.has(edge.endNodeId)) {
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
     * Pastes nodes and edges from the clipboard onto the canvas.
     */
    paste() {
        if (this.clipboard.nodes.length === 0) return;

        const idMap = new Map(); // Maps old IDs to new IDs
        const pasteOffset = 20;

        // Create new nodes
        this.clipboard.nodes.forEach(nodeData => {
            const oldId = nodeData.id;
            const newId = crypto.randomUUID();
            idMap.set(oldId, newId);

            events.publish('node:create', {
                ...nodeData,
                id: newId,
                x: nodeData.x + pasteOffset,
                y: nodeData.y + pasteOffset
            });
        });

        // Create new edges with updated node IDs
        this.clipboard.edges.forEach(edgeData => {
            const newStartNodeId = idMap.get(edgeData.startNodeId);
            const newEndNodeId = idMap.get(edgeData.endNodeId);

            if (newStartNodeId && newEndNodeId) {
                events.publish('edge:create', {
                    ...edgeData,
                    id: crypto.randomUUID(),
                    startNodeId: newStartNodeId,
                    endNodeId: newEndNodeId
                });
            }
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

    endCuttingLine() {
        if (!this.edgeCutState.cutLine) return;
        
        const x1 = parseFloat(this.edgeCutState.cutLine.getAttribute('x1'));
        const y1 = parseFloat(this.edgeCutState.cutLine.getAttribute('y1'));
        const x2 = parseFloat(this.edgeCutState.cutLine.getAttribute('x2'));
        const y2 = parseFloat(this.edgeCutState.cutLine.getAttribute('y2'));

        this.edges.forEach(edge => {
            const path = edge.element;
            const len = path.getTotalLength();
            for (let i = 0; i < len; i += 5) {
                const p1 = path.getPointAtLength(i);
                const p2 = path.getPointAtLength(i + 5);
                if (this.lineIntersect(x1, y1, x2, y2, p1.x, p1.y, p2.x, p2.y)) {
                    events.publish('edge:delete', edge.id);
                    break; 
                }
            }
        });

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
            if (Math.abs(draggedBounds.left - staticBounds.left) < this.snapThreshold) { snapX = staticBounds.left; this.drawGuide(staticBounds.left, 'v'); }
            if (Math.abs(draggedBounds.right - staticBounds.right) < this.snapThreshold) { snapX = staticBounds.right - draggedNode.width; this.drawGuide(staticBounds.right, 'v'); }
            if (Math.abs(draggedBounds.hCenter - staticBounds.hCenter) < this.snapThreshold) { snapX = staticBounds.hCenter - draggedNode.width / 2; this.drawGuide(staticBounds.hCenter, 'v'); }
            
            // --- Horizontal Snapping ---
            if (Math.abs(draggedBounds.top - staticBounds.top) < this.snapThreshold) { snapY = staticBounds.top; this.drawGuide(staticBounds.top, 'h'); }
            if (Math.abs(draggedBounds.bottom - staticBounds.bottom) < this.snapThreshold) { snapY = staticBounds.bottom - draggedNode.height; this.drawGuide(staticBounds.bottom, 'h'); }
            if (Math.abs(draggedBounds.vCenter - staticBounds.vCenter) < this.snapThreshold) { snapY = staticBounds.vCenter - draggedNode.height / 2; this.drawGuide(staticBounds.vCenter, 'h'); }
        });

        return { x: snapX, y: snapY };
    }

    drawGuide(val, orientation) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('snap-guide');
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
        this.showContextMenu(event.clientX, event.clientY);
    }

    /**
     * Shows the context menu with relevant options.
     * @param {number} x The screen x-coordinate.
     * @param {number} y The screen y-coordinate.
     */
    showContextMenu(x, y) {
        const worldPos = this.getMousePosition({ clientX: x, clientY: y });
        const items = [
            { label: 'Create Node', event: 'node:create' },
            { label: 'Snap to Grid', event: 'snap:grid-toggle' }
        ];
        this.contextMenu.show(x, y, items);
    }

    /**
     * Toggles the snap-to-grid functionality.
     */
    toggleSnapToGrid() {
        this.snapToGrid = this.snapToGrid ? false : 20;
        console.log(`Snap to grid is now ${this.snapToGrid ? 'enabled' : 'disabled'}`);
    }
}

// Initialize NodeUI once the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('canvas-container');
    const app = new NodeUI(container);

    // --- For Testing ---
    // Remove direct instantiation and use the event bus instead
    console.log('%c[Test]%c Firing test node:create event.', 'color: #8e8e8e; font-weight: bold;', 'color: inherit;');
    events.publish('node:create', { x: 50, y: 50, title: 'Event Node 1' });
    events.publish('node:create', { x: 250, y: 150, title: 'Event Node 2' });
}); 