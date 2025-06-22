/**
 * @fileoverview Handles all user interaction events including mouse, touch, 
 * wheel, and keyboard events.
 */

class InteractionHandler {
    /**
     * @param {NodeUI} nodeUI - Reference to the main NodeUI instance.
     */
    constructor(nodeUI) {
        this.nodeUI = nodeUI;
    }

    /**
     * Handles the mousedown event on the node container.
     * @param {MouseEvent} event 
     */
    onMouseDown(event) {
        // Only process events inside the main container or pinned container
        const isInsideContainer = event.target.closest('#canvas-container') || event.target.closest('#pinned-node-container');
        if (!isInsideContainer && !this.nodeUI.draggingState.isDragging && !this.nodeUI.resizingState.isResizing) {
            return;
        }

        // If a popover is open, and the click is not inside it, close it.
        if (this.nodeUI.openPopoverNodeId && !event.target.closest('.node-popover') && !event.target.closest('.node-settings-icon')) {
            this.nodeUI.nodeManager.toggleNodePopover(this.nodeUI.openPopoverNodeId);
        }

        if (event.target.classList.contains('resize-handle')) {
            const { nodeId, direction } = event.target.dataset;
            this.nodeUI.startResize(nodeId, event, direction);
            return;
        }
        if (this.nodeUI.routingHandler.getRoutingCutState().isRouting) {
            this.nodeUI.startRoutingCut(event);
            return;
        }
        if (this.nodeUI.edgeCutState.isCutting) {
            this.nodeUI.startCuttingLine(event);
            return;
        }
        if (event.target.classList.contains('node-handle-zone')) {
            if (event.button !== 0) return; // Only allow left-click to draw edges
            const { nodeId, handlePosition } = event.target.dataset;
            this.nodeUI.startDrawingEdge(nodeId, handlePosition);
            return;
        }

        // Check if the click is on the settings icon
        if (event.target.closest('.node-settings-icon')) {
            const nodeElement = event.target.closest('.node');
            if (nodeElement) {
                // If popover is already shown for this node, hide it. Otherwise, show it.
                if (this.nodeUI.openPopoverNodeId === nodeElement.id) {
                    this.nodeUI.nodeManager.toggleNodePopover(nodeElement.id);
                } else {
                    this.nodeUI.nodeManager.toggleNodePopover(nodeElement.id);
                }
            }
            return;
        }

        // Check if the click is on the cycle color icon
        if (event.target.closest('.node-cycle-color-icon')) {
            const nodeElement = event.target.closest('.node');
            if (nodeElement) {
                this.nodeUI.nodeManager.cycleNodeColor(nodeElement.id);
            }
            return;
        }

        // Check if the click is on a node (but not a handle, which is handled earlier)
        const nodeElement = event.target.closest('.node');
        if (nodeElement) {
            const nodeId = nodeElement.id;
            const node = this.nodeUI.nodes.get(nodeId);

            if (node.isPinned && !(node instanceof SettingsNode)) { // Allow settings node to be dragged even if pinned
                this.nodeUI.dragHandler.startDrag(nodeId, event.clientX, event.clientY, true);
                return;
            }

            this.nodeUI.nodeManager.bringToFront(nodeId); // Bring the node and its hierarchy to the front

            // If the node is not part of a multi-selection, clear the selection.
            // This allows dragging a single unselected node without clearing the current selection.
            if (!this.nodeUI.selectedNodes.has(nodeId)) {
                this.nodeUI.clearSelection();
                this.nodeUI.selectNode(nodeId);
            }
            this.nodeUI.dragHandler.startDrag(nodeId, event.clientX, event.clientY);
            return;
        } 
        
        // If the click wasn't on a handle or title bar, it's a background click.
        // This handles panning and selection.
        if (event.button === 1) { // Middle mouse for panning
            event.preventDefault(); 
            this.nodeUI.panZoom.isPanning = true;
            this.nodeUI.draggingState.startX = event.clientX;
            this.nodeUI.draggingState.startY = event.clientY;
        } else { // Left click for selection
            // Debounce to prevent firing on dblclick
            this.nodeUI.clearSelection(); // Clear previous selection on new mousedown
            this.nodeUI.selectionDebounceTimer = setTimeout(() => {
                this.nodeUI.selectionState.isSelecting = true;
                const mousePos = this.nodeUI.getMousePosition(event);
                this.nodeUI.selectionState.startX = mousePos.x;
                this.nodeUI.selectionState.startY = mousePos.y;
                
                const box = this.nodeUI.selectionState.selectionBox;
                box.style.left = `${mousePos.x}px`;
                box.style.top = `${mousePos.y}px`;
                box.style.width = '0px';
                box.style.height = '0px';
                box.style.display = 'block';

            }, 150);
        }

        if (event.target.classList.contains('edge-routing-handle')) {
            const { edgeId, pointIndex } = event.target.dataset;
            this.nodeUI.routingHandler.startEdgeRouting(edgeId, pointIndex);
            return;
        }
    }

    /**
     * Handles the mousemove event on the document.
     * @param {MouseEvent} event 
     */
    onMouseMove(event) {
        this.nodeUI.lastMousePosition = { clientX: event.clientX, clientY: event.clientY };

        if (this.nodeUI.routingHandler.getRoutingCutState().isRouting && this.nodeUI.routingHandler.getRoutingCutState().cutLine) {
            this.nodeUI.updateRoutingCut(event);
            return;
        }
        if (this.nodeUI.edgeCutState.isCutting && this.nodeUI.edgeCutState.cutLine) {
            this.nodeUI.updateCuttingLine(event);
            return;
        }
        if (this.nodeUI.selectionState.isSelecting) {
            const mousePos = this.nodeUI.getMousePosition(event);
            const { startX, startY } = this.nodeUI.selectionState;

            const newX = Math.min(mousePos.x, startX);
            const newY = Math.min(mousePos.y, startY);

            const box = this.nodeUI.selectionState.selectionBox;
            box.style.left = `${newX}px`;
            box.style.top = `${newY}px`;
            box.style.width = `${Math.abs(mousePos.x - startX)}px`;
            box.style.height = `${Math.abs(mousePos.y - startY)}px`;
            return;
        }
        
        if (this.nodeUI.resizingState.isResizing) {
            const { targetNode, startX, startY, originalX, originalY, originalWidth, originalHeight, direction } = this.nodeUI.resizingState;
            const scale = targetNode.isPinned ? 1 : this.nodeUI.panZoom.scale;
            const dx = (event.clientX - startX) / scale;
            const dy = (event.clientY - startY) / scale;
        
            const minWidth = parseInt(getComputedStyle(this.nodeUI.container).getPropertyValue('--panel-width'));
            const minHeight = parseInt(getComputedStyle(this.nodeUI.container).getPropertyValue('--panel-height'));
        
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

            if (this.nodeUI.snapToObjects && !targetNode.isPinned) {
                const snapResult = this.nodeUI.checkForResizeSnapping(targetNode, newX, newY, newWidth, newHeight, direction);
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
        
            this.nodeUI.updateConnectedEdges(targetNode.id);
            return;
        }

        if (this.nodeUI.draggingState.isDragging) {
            // Handle dragging for pinned nodes (screen space)
            if (this.nodeUI.draggingState.isDraggingPinned) {
                const primaryNode = this.nodeUI.draggingState.targetNode;
                const dx = event.clientX - this.nodeUI.draggingState.startX;
                const dy = event.clientY - this.nodeUI.draggingState.startY;

                const nodesToMove = this.nodeUI.dragHandler.getNodesToMove(primaryNode.id);
                nodesToMove.forEach(nodeId => {
                    const node = this.nodeUI.nodes.get(nodeId);
                    if (node) {
                        node.x = node.originalX + dx;
                        node.y = node.originalY + dy;
                        node.element.style.left = `${node.x}px`;
                        node.element.style.top = `${node.y}px`;
                        this.nodeUI.updateConnectedEdges(nodeId);
                    }
                });
                return;
            }
            
            // Handle dragging for regular nodes (world space)
            const primaryNode = this.nodeUI.draggingState.targetNode;

            // 1. Calculate base delta from mouse movement
            const dx = (event.clientX - this.nodeUI.draggingState.startX) / this.nodeUI.panZoom.scale;
            const dy = (event.clientY - this.nodeUI.draggingState.startY) / this.nodeUI.panZoom.scale;

            // 2. Calculate primary node's potential new position
            let primaryNewX = primaryNode.originalX + dx;
            let primaryNewY = primaryNode.originalY + dy;

            // 3. Apply snapping to the primary node's position
            if (this.nodeUI.snapToGrid) {
                primaryNewX = Math.round(primaryNewX / this.nodeUI.snapToGrid) * this.nodeUI.snapToGrid;
                primaryNewY = Math.round(primaryNewY / this.nodeUI.snapToGrid) * this.nodeUI.snapToGrid;
            }
            if (this.nodeUI.snapToObjects) {
                const snapResult = this.nodeUI.checkForSnapping(primaryNode, primaryNewX, primaryNewY);
                primaryNewX = snapResult.x;
                primaryNewY = snapResult.y;
            }

            // 4. The final delta for ALL nodes is based on the primary node's snapped movement
            const finalDeltaX = primaryNewX - primaryNode.originalX;
            const finalDeltaY = primaryNewY - primaryNode.originalY;

            const nodesToMove = this.nodeUI.dragHandler.getNodesToMove(primaryNode.id);

            // 5. Apply the consistent delta to all nodes in the group/selection
            nodesToMove.forEach(nodeId => {
                const node = this.nodeUI.nodes.get(nodeId);
                if (node) {
                    node.x = node.originalX + finalDeltaX;
                    node.y = node.originalY + finalDeltaY;
                    node.element.style.left = `${node.x}px`;
                    node.element.style.top = `${node.y}px`;
                    this.nodeUI.updateConnectedEdges(nodeId);
                }
            });

            // Record shake history
            const now = Date.now();
            if (now - this.nodeUI.draggingState.lastShakeTime > 50) { // Sample every 50ms
                this.nodeUI.draggingState.shakeHistory.push({x: primaryNewX, y: primaryNewY});
                if (this.nodeUI.draggingState.shakeHistory.length > 10) {
                    this.nodeUI.draggingState.shakeHistory.shift(); // Keep history to a manageable size
                }
                this.nodeUI.draggingState.lastShakeTime = now;
            }

            // Check for shake in real-time
            this.nodeUI.checkForShake(primaryNode);

            // Clear previous droppable state
            if (this.nodeUI.draggingState.droppableEdge) {
                this.nodeUI.draggingState.droppableEdge.classList.remove('is-droppable');
                this.nodeUI.draggingState.droppableEdge = null;
            }

            // Check for new droppable edge
            let foundDroppable = false;
            for (const edge of this.nodeUI.edges.values()) {
                if (this.nodeUI.dragHandler.isPointOnEdge(primaryNode, edge)) {
                    edge.element.classList.add('is-droppable');
                    this.nodeUI.draggingState.droppableEdge = edge.element;
                    foundDroppable = true;
                    break;
                }
            }

            return;
        }

        if (this.nodeUI.panZoom.isPanning) {
            const dx = event.clientX - this.nodeUI.draggingState.startX;
            const dy = event.clientY - this.nodeUI.draggingState.startY;

            this.nodeUI.panZoom.offsetX += dx;
            this.nodeUI.panZoom.offsetY += dy;

            this.nodeUI.updateCanvasTransform();

            this.nodeUI.draggingState.startX = event.clientX;
            this.nodeUI.draggingState.startY = event.clientY;

            this.nodeUI.clearGuides();
        } else if (this.nodeUI.edgeDrawingHandler.isDrawing()) {
            const mousePos = this.nodeUI.getMousePosition(event);
            this.nodeUI.updateDrawingEdge(mousePos.x, mousePos.y);
        }

        if (this.nodeUI.edgeCutState.isCutting) {
            this.nodeUI.endCuttingLine();
            return;
        }
        if (this.nodeUI.selectionState.isSelecting) {
            this.nodeUI.endSelection();
            this.nodeUI.cancelDrawingEdge();
        }

        if (this.nodeUI.draggingState.isDragging && this.nodeUI.snapToObjects) {
            this.nodeUI.checkForSnapping(this.nodeUI.draggingState.targetNode, this.nodeUI.draggingState.targetNode.x, this.nodeUI.draggingState.targetNode.y);
        }

        if (this.nodeUI.routingHandler.getRoutingState().isRouting) {
            const edge = this.nodeUI.edges.get(this.nodeUI.routingHandler.getRoutingState().edgeId);
            if (edge) {
                const point = this.nodeUI.getMousePosition(event);
                edge.routingPoints[this.nodeUI.routingHandler.getRoutingState().pointIndex] = point;
                this.nodeUI.updateEdge(edge.id);
                this.nodeUI.renderRoutingPoints(edge); // Re-render points to update their position
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
        clearTimeout(this.nodeUI.selectionDebounceTimer);

        if (this.nodeUI.routingHandler.getRoutingCutState().isRouting) {
            this.nodeUI.endRoutingCut();
            return;
        }

        // The order of these checks is critical.
        if (this.nodeUI.edgeDrawingHandler.isDrawing()) {
            if (event.target.classList.contains('node-handle-zone')) {
                const { nodeId, handlePosition } = event.target.dataset;
                this.nodeUI.endDrawingEdge(nodeId, handlePosition);
            } else {
                // If the mouseup is on the context menu, let the menu handle it.
                if (event.target.closest('#context-menu')) {
                    return;
                }

                const state = this.nodeUI.edgeDrawingHandler.getState();
                const edgeStartInfo = {
                    startNodeId: state.startNodeId,
                    startHandleId: state.startHandlePosition
                };
                // Keep the temp edge visually connected to where the menu will appear
                const mousePos = this.nodeUI.getMousePosition(event);
                this.nodeUI.updateDrawingEdge(mousePos.x, mousePos.y);

                this.nodeUI.contextMenuHandler.showCanvasContextMenu(event.clientX, event.clientY, edgeStartInfo);
            }
            return;
        }

        if (this.nodeUI.edgeCutState.isCutting) {
            this.nodeUI.endCuttingLine();
            // isCutting is reset by onKeyUp
            return;
        }
        if (this.nodeUI.resizingState.isResizing) {
            this.nodeUI.endResize();
            return;
        }
        if (this.nodeUI.selectionState.isSelecting) {
            this.nodeUI.endSelection();
            return;
        }
        if (this.nodeUI.draggingState.isDragging) {
            this.nodeUI.dragHandler.endDrag();
        }
        if (this.nodeUI.panZoom.isPanning) {
            this.nodeUI.panZoom.isPanning = false;
            this.nodeUI.container.classList.remove('is-panning');
        }

        if (this.nodeUI.routingHandler.getRoutingState().isRouting) {
            this.nodeUI.routingHandler.endEdgeRouting();
            return;
        }

        this.nodeUI.container.classList.remove('is-panning');
    }

    /**
     * Handles the touchstart event on the node container.
     * @param {TouchEvent} event 
     */
    onTouchStart(event) {
        // Handle pinch-to-zoom
        if (event.touches.length === 2) {
            event.preventDefault(); // Prevent default browser actions
            this.nodeUI.panZoom.isPanning = false; // Stop panning when pinching
            this.nodeUI.draggingState.isDragging = false; // Stop dragging when pinching
            this.nodeUI.isPinching = true;
            this.nodeUI.initialPinchDistance = this.nodeUI.getPinchDistance(event);
            this.nodeUI.initialScale = this.nodeUI.panZoom.scale;
            return;
        }

        // Only process events inside the main container or pinned container
        const isInsideContainer = event.target.closest('#canvas-container') || event.target.closest('#pinned-node-container');
        if (!isInsideContainer && !this.nodeUI.draggingState.isDragging && !this.nodeUI.resizingState.isResizing) {
            return;
        }

        const touch = event.touches[0];

        // Start a timer for long-press
        this.nodeUI.longPressTimer = setTimeout(() => {
            this.nodeUI.contextMenuHandler.showCanvasContextMenu(touch.clientX, touch.clientY);
            this.nodeUI.longPressTimer = null; // Prevent firing twice
        }, 500); // 500ms for a long press

        if (event.target.classList.contains('node-handle-zone')) {
            event.preventDefault(); // Prevent scrolling
            const { nodeId, handlePosition } = event.target.dataset;
            this.nodeUI.startDrawingEdge(nodeId, handlePosition);
            return;
        }
        
        // Check if the touch is on a node (but not a handle, which is handled earlier)
        const nodeElement = event.target.closest('.node');
        if (nodeElement) {
            event.preventDefault(); // Prevent scrolling
            const nodeId = nodeElement.id;
            this.nodeUI.dragHandler.startDrag(nodeId, touch.clientX, touch.clientY);
            return;
        } 
        
        // If the touch wasn't on a handle or title bar, it's a background touch for panning.
        event.preventDefault(); // Prevent scrolling
        this.nodeUI.panZoom.isPanning = true;
        this.nodeUI.container.classList.add('is-panning');
        this.nodeUI.draggingState.startX = touch.clientX;
        this.nodeUI.draggingState.startY = touch.clientY;
    }
    
    /**
     * Handles the touchmove event on the document.
     * @param {TouchEvent} event 
     */
    onTouchMove(event) {
        // Handle pinch-to-zoom
        if (event.touches.length === 2) {
            event.preventDefault();
            const currentPinchDistance = this.nodeUI.getPinchDistance(event);
            const scaleFactor = currentPinchDistance / this.nodeUI.initialPinchDistance;
            let newScale = this.nodeUI.initialScale * scaleFactor;

            // Clamp the scale to prevent zooming too far in or out
            newScale = Math.max(0.1, Math.min(3, newScale));

            // Get the center of the pinch gesture
            const rect = this.nodeUI.container.getBoundingClientRect();
            const pinchCenterX = (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left;
            const pinchCenterY = (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top;

            // Adjust offset to zoom towards the pinch center
            this.nodeUI.panZoom.offsetX = pinchCenterX - (pinchCenterX - this.nodeUI.panZoom.offsetX) * (newScale / this.nodeUI.panZoom.scale);
            this.nodeUI.panZoom.offsetY = pinchCenterY - (pinchCenterY - this.nodeUI.panZoom.offsetY) * (newScale / this.nodeUI.panZoom.scale);
            this.nodeUI.panZoom.scale = newScale;

            this.nodeUI.updateCanvasTransform();
            return;
        }

        // If the finger moves, it's not a long press
        clearTimeout(this.nodeUI.longPressTimer);

        if (this.nodeUI.resizingState.isResizing) {
            event.preventDefault();
            const touch = event.touches[0];
            const { targetNode, startX, startY, originalX, originalY, originalWidth, originalHeight, direction } = this.nodeUI.resizingState;
            const scale = targetNode.isPinned ? 1 : this.nodeUI.panZoom.scale;
            const dx = (touch.clientX - startX) / scale;
            const dy = (touch.clientY - startY) / scale;

            const minWidth = parseInt(getComputedStyle(this.nodeUI.container).getPropertyValue('--panel-width'));
            const minHeight = parseInt(getComputedStyle(this.nodeUI.container).getPropertyValue('--panel-height'));

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

            if (this.nodeUI.snapToObjects && !targetNode.isPinned) {
                const snapResult = this.nodeUI.checkForResizeSnapping(targetNode, newX, newY, newWidth, newHeight, direction);
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
            this.nodeUI.updateConnectedEdges(targetNode.id);

        } else if (this.nodeUI.draggingState.isDragging) {
            event.preventDefault(); // Prevent scrolling
            const touch = event.touches[0];
            const node = this.nodeUI.draggingState.targetNode;

            const dx = (touch.clientX - this.nodeUI.draggingState.startX) / this.nodeUI.panZoom.scale;
            const dy = (touch.clientY - this.nodeUI.draggingState.startY) / this.nodeUI.panZoom.scale;

            let newX = node.originalX + dx;
            let newY = node.originalY + dy;

            if (this.nodeUI.snapToGrid) {
                newX = Math.round(newX / this.nodeUI.snapToGrid) * this.nodeUI.snapToGrid;
                newY = Math.round(newY / this.nodeUI.snapToGrid) * this.nodeUI.snapToGrid;
            }
            
            if (this.nodeUI.snapToObjects) {
                const snapResult = this.nodeUI.checkForSnapping(node, newX, newY);
                newX = snapResult.x;
                newY = snapResult.y;
            }

            // Update the visual position of all selected nodes based on the primary dragged node
            if (this.nodeUI.selectedNodes.size > 1 && this.nodeUI.selectedNodes.has(this.nodeUI.draggingState.targetNode.id)) {
                const deltaX = newX - node.originalX;
                const deltaY = newY - node.originalY;

                this.nodeUI.selectedNodes.forEach(nodeId => {
                    const selected = this.nodeUI.nodes.get(nodeId);
                    if(selected) {
                        selected.x = selected.originalX + deltaX;
                        selected.y = selected.originalY + deltaY;
                        selected.element.style.left = `${selected.x}px`;
                        selected.element.style.top = `${selected.y}px`;
                        this.nodeUI.updateConnectedEdges(selected.id);
                    }
                });
            } else {
                node.x = newX;
                node.y = newY;
                node.element.style.left = `${newX}px`;
                node.element.style.top = `${newY}px`;
                this.nodeUI.updateConnectedEdges(node.id);
            }
            
            return;

        } else if (this.nodeUI.panZoom.isPanning) {
            event.preventDefault(); // Prevent scrolling
            const touch = event.touches[0];
            const dx = touch.clientX - this.nodeUI.draggingState.startX;
            const dy = touch.clientY - this.nodeUI.draggingState.startY;

            this.nodeUI.panZoom.offsetX += dx;
            this.nodeUI.panZoom.offsetY += dy;

            this.nodeUI.updateCanvasTransform();

            this.nodeUI.draggingState.startX = touch.clientX;
            this.nodeUI.draggingState.startY = touch.clientY;
        } else if (this.nodeUI.edgeDrawingHandler.isDrawing()) {
            event.preventDefault(); // Prevent scrolling
            const touch = event.touches[0];
            const mousePos = this.nodeUI.getMousePosition(touch);
            this.nodeUI.updateDrawingEdge(mousePos.x, mousePos.y);
        }
    }

    /**
     * Handles the touchend event on the document.
     * @param {TouchEvent} event 
     */
    onTouchEnd(event) {
        // If the gesture was a pinch, prevent it from being treated as a tap
        if (this.nodeUI.isPinching) {
            // This logic ensures that when the two fingers from a pinch are lifted,
            // it doesn't accidentally trigger a double-tap action.
            if (event.touches.length < 2) {
                this.nodeUI.isPinching = false;
                this.nodeUI.lastTap = 0; // Invalidate the tap history
            }
            return;
        }

        // Double tap to zoom or fit view
        const now = new Date().getTime();
        const timesince = now - this.nodeUI.lastTap;
        if ((timesince < 300) && (timesince > 0)) {
            const touch = event.changedTouches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            
            const tappedNodeElement = target.closest('.node');

            if (tappedNodeElement) {
                // A node was double-tapped.
                // The first tap should have already selected it via onTouchStart -> onMouseDown.
                // We ensure it's the *only* thing selected, then frame it.
                if (!this.nodeUI.selection.nodes.has(tappedNodeElement.id) || this.nodeUI.selection.nodes.size > 1) {
                    this.nodeUI.clearSelection();
                    this.nodeUI.toggleNodeSelection(tappedNodeElement.id, true);
                }
                this.nodeUI.frameSelection();
            } else {
                // On background: incrementally zoom in towards the tap point
                const oldScale = this.nodeUI.panZoom.scale;
                const newScale = Math.min(3, oldScale + 0.4); // Zoom in, capped at 3x

                const rect = this.nodeUI.container.getBoundingClientRect();
                const mouseX = touch.clientX - rect.left;
                const mouseY = touch.clientY - rect.top;

                // Calculate the target offset without modifying the current state
                const targetOffsetX = mouseX - (mouseX - this.nodeUI.panZoom.offsetX) * (newScale / oldScale);
                const targetOffsetY = mouseY - (mouseY - this.nodeUI.panZoom.offsetY) * (newScale / oldScale);
                
                this.nodeUI.animatePanZoom(newScale, targetOffsetX, targetOffsetY, 150);
            }

            this.nodeUI.lastTap = 0; // Reset tap time to prevent triple-tap issues
            return; 
        }
        this.nodeUI.lastTap = now;

        // If the touch ends before the timer, it's not a long press
        clearTimeout(this.nodeUI.longPressTimer);

        // If a pinch gesture was active, reset the state
        if (event.touches.length < 2) {
            this.nodeUI.initialPinchDistance = null;
        }

        // Same logic as onMouseUp: handle the most specific state first.
        if (this.nodeUI.edgeDrawingHandler.isDrawing()) {
            const touch = event.changedTouches[0];
            const endElement = document.elementFromPoint(touch.clientX, touch.clientY);
            
            if (endElement && endElement.classList.contains('node-handle-zone')) {
                const { nodeId, handlePosition } = endElement.dataset;
                this.nodeUI.endDrawingEdge(nodeId, handlePosition);
            } else {
                const state = this.nodeUI.edgeDrawingHandler.getState();
                const edgeStartInfo = {
                    startNodeId: state.startNodeId,
                    startHandleId: state.startHandlePosition
                };
                // Keep the temp edge visually connected to where the menu will appear
                const mousePos = this.nodeUI.getMousePosition(touch);
                this.nodeUI.updateDrawingEdge(mousePos.x, mousePos.y);

                this.nodeUI.contextMenuHandler.showCanvasContextMenu(touch.clientX, touch.clientY, edgeStartInfo);
            }
            return;
        }

        if (this.nodeUI.resizingState.isResizing) {
            this.nodeUI.endResize();
        }
        if (this.nodeUI.draggingState.isDragging) {
            this.nodeUI.dragHandler.endDrag();
        }
        if (this.nodeUI.panZoom.isPanning) {
            this.nodeUI.panZoom.isPanning = false;
            this.nodeUI.container.classList.remove('is-panning');
        }
        if (this.nodeUI.selectionState.isSelecting) {
            this.nodeUI.endSelection();
        }

        if (this.nodeUI.routingHandler.getRoutingState().isRouting) {
            this.nodeUI.routingHandler.endEdgeRouting();
            return;
        }

        this.nodeUI.container.classList.remove('is-panning');

        // Handle single tap for selection, but only if it wasn't a drag
        const dx = this.nodeUI.lastMousePosition.clientX - this.nodeUI.draggingState.startX;
        const dy = this.nodeUI.lastMousePosition.clientY - this.nodeUI.draggingState.startY;
        const isDrag = Math.sqrt(dx * dx + dy * dy) > this.nodeUI.DRAG_THRESHOLD;

        if (!isDrag) {
            this.nodeUI.handleSelection(event);
        }

        // Defer clearing the dragging state until after we've checked for drag
        this.nodeUI.draggingState.isDragging = false;
        this.nodeUI.draggingState.hasDragged = false;
    }

    /**
     * Handles the wheel event for zooming.
     * @param {WheelEvent} event 
     */
    onWheel(event) {
        event.preventDefault();
        
        const zoomIntensity = 0.1;
        const oldScale = this.nodeUI.panZoom.scale;

        // Determine the direction of the scroll
        const scroll = event.deltaY < 0 ? 1 : -1;
        
        // Calculate the new scale
        const newScale = Math.max(0.1, Math.min(3, oldScale + scroll * zoomIntensity * oldScale));
        
        // Get the mouse position relative to the container
        const rect = this.nodeUI.container.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // Adjust the offset to zoom towards the mouse position
        this.nodeUI.panZoom.offsetX = mouseX - (mouseX - this.nodeUI.panZoom.offsetX) * (newScale / oldScale);
        this.nodeUI.panZoom.offsetY = mouseY - (mouseY - this.nodeUI.panZoom.offsetY) * (newScale / oldScale);
        this.nodeUI.panZoom.scale = newScale;
        
        this.nodeUI.updateCanvasTransform();
    }

    /**
     * Handles keyboard shortcuts for cut, copy, and paste.
     * @param {KeyboardEvent} event 
     */
    async onKeyDown(event) {
        // Use event.metaKey for Command key on macOS
        const isModKey = event.ctrlKey || event.metaKey;
        const target = event.target;
        const isEditingContent = target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
        const key = event.key.toLowerCase();

        if (isModKey && key === 'a' && !isEditingContent) {
            event.preventDefault();
            this.nodeUI.selectAll();
        } else if (isModKey && key === 'c' && !isEditingContent) {
            event.preventDefault();
            this.nodeUI.copySelection();
        } else if (isModKey && key === 'x' && !isEditingContent) {
            event.preventDefault();
            this.nodeUI.cutSelection();
        } else if (isModKey && key === 'v' && !isEditingContent) {
            event.preventDefault();
            
            // Priority 1: If the internal clipboard has nodes, paste them.
            if (this.nodeUI.clipboard.nodes.length > 0) {
                this.nodeUI.paste();
                return;
            }

            // Priority 2: If internal clipboard is empty, try to paste from the system clipboard.
            try {
                const clipboardText = await navigator.clipboard.readText();
                if (!clipboardText) return; // Nothing to paste

                const videoUrlRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+|(\.mp4|\.webm|\.ogg)$/i;
    
                // Determine position for new node
                const position = this.nodeUI.getMousePosition(this.nodeUI.lastMousePosition);
                let nodeData;

                if (videoUrlRegex.test(clipboardText)) {
                    // It's a video link
                    events.publish('log:info', `Pasting video from system clipboard.`);
                    nodeData = {
                        width: 350,
                        height: 300,
                        title: 'Pasted Video',
                        content: `![video](${clipboardText})`
                    };
                } else {
                    // It's regular text
                    events.publish('log:info', `Pasting text from system clipboard.`);
                    nodeData = {
                        width: 250,
                        height: 150,
                        title: 'Pasted Text',
                        content: clipboardText
                    };
                }

                // Create the new node
                events.publish('node:create', {
                    x: position.x - nodeData.width / 2,
                    y: position.y - nodeData.height / 2,
                    width: nodeData.width,
                    height: nodeData.height,
                    title: nodeData.title,
                    content: nodeData.content,
                    type: 'BaseNode',
                    color: 'default'
                });

            } catch (err) {
                // This can happen if clipboard is empty or doesn't contain text.
                console.warn('Could not read from system clipboard or content was not text.', err);
            }
        } else if (key === 'g' && !isModKey && !isEditingContent) {
            event.preventDefault();
            this.nodeUI.nodeManager.groupSelection();
        } else if (key === 'f' && !isModKey && !isEditingContent) {
            event.preventDefault();
            this.nodeUI.frameSelection();
        } else if (key === 'n' && !isModKey && !isEditingContent) {
            event.preventDefault();
            this.nodeUI.nodeManager.createNodeAtMousePosition();
        } else if (key === 'm' && !isModKey && !isEditingContent) {
            event.preventDefault();
            this.nodeUI.nodeManager.createRoutingNodeAtMousePosition();
        } else if ((key === 'delete' || key === 'backspace') && !isEditingContent) {
            event.preventDefault();
            this.nodeUI.deleteSelection();
        } else if ((key === 'c' || key === 'y') && !isModKey && !isEditingContent) {
            event.preventDefault();
            this.nodeUI.edgeCutState.isCutting = true;
            this.nodeUI.container.classList.add('is-cutting');
        } else if (key === 'r' && !isModKey && !isEditingContent) {
            event.preventDefault();
            this.nodeUI.routingHandler.getRoutingCutState().isRouting = true;
            this.nodeUI.container.classList.add('is-routing');
        }
    }

    /**
     * Handles key up events for ending states like edge cutting.
     * @param {KeyboardEvent} event 
     */
    onKeyUp(event) {
        const key = event.key.toLowerCase();
        if (key === 'c' || key === 'y') {
            this.nodeUI.edgeCutState.isCutting = false;
            this.nodeUI.container.classList.remove('is-cutting');
            // If a cut line is still present (e.g., key released before mouseup), clean it up without cutting.
            if (this.nodeUI.edgeCutState.cutLine) {
                this.nodeUI.endCuttingLine(false);
            }
        } else if (key === 'r') {
            this.nodeUI.routingHandler.getRoutingCutState().isRouting = false;
            this.nodeUI.container.classList.remove('is-routing');
            // If a routing cut line is still present (e.g., key released before mouseup), clean it up without cutting.
            if (this.nodeUI.routingHandler.getRoutingCutState().cutLine) {
                this.nodeUI.endRoutingCut();
            }
        }
    }
} 