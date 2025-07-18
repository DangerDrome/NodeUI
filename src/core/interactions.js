/**
 * @fileoverview Handles all user interaction events including mouse, touch, 
 * wheel, and keyboard events.
 */

class Interactions {
    /**
     * @param {NodeUI} nodeUI - Reference to the main NodeUI instance.
     */
    constructor(nodeUI) {
        this.nodeUI = nodeUI;
        
        // Throttle edge collision detection for performance
        this.edgeCollisionThrottle = {
            lastCheck: 0,
            checkInterval: 8, // ~120fps for more responsive feedback
            pendingCheck: false
        };
    }

    /**
     * Handles the mousedown event on the node container.
     * @param {MouseEvent} event 
     */
    onMouseDown(event) {
        // Only process events inside the main container or pinned container
        const isInsideContainer = event.target.closest('#nodeui-canvas-container') || event.target.closest('#nodeui-pinned-node-container');
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
        if (this.nodeUI.edgeHandler.getRoutingCutState().isRouting) {
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

            // Handle double-click to enter subgraphs
            if (event.detail === 2 && node instanceof SubGraphNode) {
                event.stopPropagation();
                event.preventDefault();
                const newStack = [...this.nodeUI.graphContext.graphStack, node.id];
                const newPath = newStack.map(id => (id === 'main' ? 'main' : `sg_${id.substring(0, 8)}`)).join('/');
                window.location.hash = newPath;
                return;
            }

            if (node.isPinned && !(node instanceof SettingsNode)) { // Allow settings node to be dragged even if pinned
                this.startDrag(nodeId, event.clientX, event.clientY, true);
                return;
            }

            this.nodeUI.nodeManager.bringToFront(nodeId); // Bring the node and its hierarchy to the front

            // If the node is not part of a multi-selection, clear the selection.
            // This allows dragging a single unselected node without clearing the current selection.
            if (!this.nodeUI.selectedNodes.has(nodeId)) {
                this.nodeUI.clearSelection();
                this.nodeUI.selectNode(nodeId);
            }
            this.startDrag(nodeId, event.clientX, event.clientY);
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
            this.nodeUI.edgeHandler.startEdgeRouting(edgeId, pointIndex);
            return;
        }
    }

    /**
     * Handles the mousemove event on the document.
     * @param {MouseEvent} event 
     */
    onMouseMove(event) {
        this.nodeUI.lastMousePosition = { clientX: event.clientX, clientY: event.clientY };

        if (this.nodeUI.edgeHandler.getRoutingCutState().isRouting && this.nodeUI.edgeHandler.getRoutingCutState().cutLine) {
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

                const nodesToMove = this.getNodesToMove(primaryNode.id);
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

            const nodesToMove = this.getNodesToMove(primaryNode.id);

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
            if (this.nodeUI.checkForShake) {
                this.nodeUI.checkForShake(primaryNode);
            }

            // Check edge collision on every frame for smooth feedback
            this.checkEdgeCollision(primaryNode);

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
        } else if (this.nodeUI.edgeHandler.isDrawing()) {
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

        if (this.nodeUI.edgeHandler.getRoutingState().isRouting) {
            const edge = this.nodeUI.edges.get(this.nodeUI.edgeHandler.getRoutingState().edgeId);
            if (edge) {
                const point = this.nodeUI.getMousePosition(event);
                edge.routingPoints[this.nodeUI.edgeHandler.getRoutingState().pointIndex] = point;
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

        if (this.nodeUI.edgeHandler.getRoutingCutState().isRouting) {
            this.nodeUI.endRoutingCut();
            return;
        }

        // The order of these checks is critical.
        if (this.nodeUI.edgeHandler.isDrawing()) {
            if (event.target.classList.contains('node-handle-zone')) {
                const { nodeId, handlePosition } = event.target.dataset;
                this.nodeUI.endDrawingEdge(nodeId, handlePosition);
            } else {
                // If the mouseup is on the context menu, let the menu handle it.
                if (event.target.closest('#context-menu')) {
                    return;
                }

                const state = this.nodeUI.edgeHandler.getDrawingState();
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
            this.endDrag();
        }
        if (this.nodeUI.panZoom.isPanning) {
            this.nodeUI.panZoom.isPanning = false;
            this.nodeUI.container.classList.remove('is-panning');
        }

        if (this.nodeUI.edgeHandler.getRoutingState().isRouting) {
            this.nodeUI.edgeHandler.endEdgeRouting();
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
        const isInsideContainer = event.target.closest('#nodeui-canvas-container') || event.target.closest('#nodeui-pinned-node-container');
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
            this.startDrag(nodeId, touch.clientX, touch.clientY);
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
        } else if (this.nodeUI.edgeHandler.isDrawing()) {
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
        if (this.nodeUI.edgeHandler.isDrawing()) {
            const touch = event.changedTouches[0];
            const endElement = document.elementFromPoint(touch.clientX, touch.clientY);
            
            if (endElement && endElement.classList.contains('node-handle-zone')) {
                const { nodeId, handlePosition } = endElement.dataset;
                this.nodeUI.endDrawingEdge(nodeId, handlePosition);
            } else {
                const state = this.nodeUI.edgeHandler.getDrawingState();
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
            this.endDrag();
        }
        if (this.nodeUI.panZoom.isPanning) {
            this.nodeUI.panZoom.isPanning = false;
            this.nodeUI.container.classList.remove('is-panning');
        }
        if (this.nodeUI.selectionState.isSelecting) {
            this.nodeUI.endSelection();
        }

        if (this.nodeUI.edgeHandler.getRoutingState().isRouting) {
            this.nodeUI.edgeHandler.endEdgeRouting();
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
        const isEditingContent = event.target.closest('[contenteditable="true"]');
        if (isEditingContent && event.key !== 'Escape') {
            return; // Don't process keyboard shortcuts while editing
        }
        
        const isModKey = event.ctrlKey || event.metaKey;

        if (isModKey) {
            switch (event.key.toLowerCase()) {
                case 's':
                    event.preventDefault();
                    this.nodeUI.fileHandler.saveGraph();
                    break;
                case 'c':
                    this.copySelection();
                    break;
                case 'x':
                    this.cutSelection();
                    break;
                case 'v':
                    this.paste();
                    break;
                case 'a':
                    event.preventDefault();
                    this.selectAll();
                    break;
                case 'z':
                    // TODO: Implement undo/redo functionality
                    break;
            }
        }

        switch (event.key) {
            case 'Escape':
                if (this.nodeUI.edgeHandler.isDrawing()) {
                    this.nodeUI.endDrawingEdge();
                }
                break;
            case 'Delete':
            case 'Backspace':
                this.nodeUI.deleteSelection();
                break;
            case 'c':
                if (!isModKey && !isEditingContent) {
                    this.nodeUI.edgeCutState.isCutting = true;
                    this.nodeUI.container.classList.add('is-cutting');
                }
                break;
            case 'r':
                if (!isModKey && !isEditingContent) {
                    this.nodeUI.edgeHandler.getRoutingCutState().isRouting = true;
                    this.nodeUI.container.classList.add('is-routing');
                }
                break;
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
            this.nodeUI.edgeHandler.getRoutingCutState().isRouting = false;
            this.nodeUI.container.classList.remove('is-routing');
            // If a routing cut line is still present (e.g., key released before mouseup), clean it up without cutting.
            if (this.nodeUI.edgeHandler.getRoutingCutState().cutLine) {
                this.nodeUI.endRoutingCut();
            }
        }
    }

    // --- Selection Methods ---

    /**
     * Selects all nodes on the canvas.
     */
    selectAll() {
        this.nodeUI.clearSelection();
        this.nodeUI.nodes.forEach(node => this.selectNode(node.id));
        events.publish('selection:changed', {
            selectedNodeIds: Array.from(this.nodeUI.selectedNodes)
        });
    }

    /**
     * Adds a node to the current selection.
     * @param {string} nodeId The ID of the node to select.
     */
    selectNode(nodeId) {
        const node = this.nodeUI.nodes.get(nodeId);
        if (node && node.element) {
            this.nodeUI.selectedNodes.add(nodeId);
            node.element.classList.add('is-selected');
        }
    }

    /**
     * Adds an edge to the current selection.
     * @param {string} edgeId The ID of the edge to select.
     */
    selectEdge(edgeId) {
        const edge = this.nodeUI.edges.get(edgeId);
        if (edge && edge.element) {
            this.nodeUI.selectedEdges.add(edgeId);
            edge.element.classList.add('is-selected');
        }
    }

    /**
     * Clears the current selection.
     */
    clearSelection() {
        this.nodeUI.selectedNodes.forEach(nodeId => {
            const node = this.nodeUI.nodes.get(nodeId);
            if (node && node.element) {
                node.element.classList.remove('is-selected');
            }
        });
        this.nodeUI.selectedNodes.clear();

        this.nodeUI.selectedEdges.forEach(edgeId => {
            const edge = this.nodeUI.edges.get(edgeId);
            if (edge && edge.element) {
                edge.element.classList.remove('is-selected');
            }
        });
        this.nodeUI.selectedEdges.clear();
        
        events.publish('selection:changed', { selectedNodeIds: [], selectedEdgeIds: [] });
    }

    /**
     * Removes an edge from the current selection.
     * @param {string} edgeId The ID of the edge to deselect.
     */
    deselectEdge(edgeId) {
        const edge = this.nodeUI.edges.get(edgeId);
        if (edge && edge.element) {
            this.nodeUI.selectedEdges.delete(edgeId);
            edge.element.classList.remove('is-selected');
        }
    }

    /**
     * Finishes the selection process and identifies selected nodes.
     */
    endSelection() {
        this.nodeUI.canvasRenderer.endSelection();
    }

    /**
     * Checks if a node is within the selection rectangle.
     * @param {BaseNode} node The node to check.
     * @param {DOMRect} selectionRect The bounding rectangle of the selection box.
     * @returns {boolean} True if the node is inside the selection.
     */
    isNodeInSelection(node, selectionRect) {
        return this.nodeUI.canvasRenderer.isNodeInSelection(node, selectionRect);
    }

    /**
     * Checks if an edge intersects with the selection rectangle.
     * @param {BaseEdge} edge The edge to check.
     * @param {object} selectionRect The selection rectangle in world space.
     * @returns {boolean} True if the edge intersects the selection.
     */
    isEdgeInSelection(edge, selectionRect) {
        return this.nodeUI.canvasRenderer.isEdgeInSelection(edge, selectionRect);
    }

    /**
     * Copies the selected nodes and their connecting edges to the clipboard.
     */
    copySelection() {
        this.nodeUI.clipboard.nodes = [];
        this.nodeUI.clipboard.edges = [];

        if (this.nodeUI.selectedNodes.size === 0) return;

        this.nodeUI.selectedNodes.forEach(nodeId => {
            const node = this.nodeUI.nodes.get(nodeId);
            if (node) {
                let nodeData;
                
                // Try to use the node's serialize method, with fallback
                if (typeof node.serialize === 'function') {
                    try {
                        nodeData = node.serialize();
                    } catch (error) {
                        console.warn('Error serializing node:', error);
                        nodeData = { ...node };
                    }
                } else {
                    // Fallback to basic object spread
                    nodeData = { ...node };
                }
                
                // Remove DOM-specific properties that shouldn't be copied
                delete nodeData.element;
                delete nodeData.handles;
                delete nodeData.connections;
                delete nodeData.keyboardListener;
                delete nodeData.scrubbingListeners;
                delete nodeData.animationInterval;
                delete nodeData.thumbnailElement;
                
                if (node.isPinned) {
                    nodeData.x = (node.x - this.nodeUI.panZoom.offsetX) / this.nodeUI.panZoom.scale;
                    nodeData.y = (node.y - this.nodeUI.panZoom.offsetY) / this.nodeUI.panZoom.scale;
                }
                
                this.nodeUI.clipboard.nodes.push(nodeData);
            }
        });

        this.nodeUI.edges.forEach(edge => {
            if (this.nodeUI.selectedNodes.has(edge.startNodeId) || this.nodeUI.selectedNodes.has(edge.endNodeId)) {
                this.nodeUI.clipboard.edges.push({ ...edge, element: null, groupElement: null, hitArea: null, labelElement: null });
            }
        });
        
        events.publish('log:info', `Copied ${this.nodeUI.clipboard.nodes.length} nodes and ${this.nodeUI.clipboard.edges.length} edges to internal clipboard.`);
        events.publish('clipboard:changed', this.nodeUI.clipboard);
    }

    /**
     * Cuts the selected nodes by copying them and then deleting them.
     */
    cutSelection() {
        this.copySelection();
        this.nodeUI.selectedNodes.forEach(nodeId => events.publish('node:delete', nodeId));
        this.nodeUI.clipboard.edges.forEach(edge => events.publish('edge:delete', edge.id));
        this.clearSelection();
        events.publish('clipboard:changed', this.nodeUI.clipboard);
    }

    /**
     * Pastes nodes and edges from the clipboard onto the canvas at the mouse location.
     */
    paste() {
        if (this.nodeUI.clipboard.nodes.length === 0) return;
        const pasteCount = this.nodeUI.clipboard.nodes.length;
        events.publish('log:info', `Pasting ${pasteCount} nodes from internal clipboard.`);

        const idMap = new Map();
        const nodesToPin = [];
        const pasteCenter = this.nodeUI.getMousePosition(this.nodeUI.lastMousePosition) || { x: 100, y: 100 };
        let totalX = 0, totalY = 0;
        this.nodeUI.clipboard.nodes.forEach(node => {
            totalX += node.x + node.width / 2;
            totalY += node.y + node.height / 2;
        });
        const groupCenterX = totalX / this.nodeUI.clipboard.nodes.length;
        const groupCenterY = totalY / this.nodeUI.clipboard.nodes.length;

        this.nodeUI.clipboard.nodes.forEach(nodeData => {
            const oldId = nodeData.id;
            const newId = crypto.randomUUID();
            idMap.set(oldId, newId);
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
                isPinned: false,
                containedNodeIds: nodeData.containedNodeIds
            };

            // Add type-specific properties
            if (nodeData.type === 'GroupNode' && nodeData.containedNodeIds) {
                newNodeData.containedNodeIds = nodeData.containedNodeIds.map(oldChildId => 
                    idMap.get(oldChildId) || oldChildId
                ).filter(id => id);
            }

            // Add ImageSequenceNode specific properties
            if (nodeData.type === 'ImageSequenceNode') {
                newNodeData.imageSequence = nodeData.imageSequence;
                newNodeData.currentFrame = nodeData.currentFrame;
                newNodeData.fps = nodeData.fps;
            }

            if (newNodeData.type === 'RoutingNode') {
                this.nodeUI.nodeManager.addNode(new RoutingNode(newNodeData));
            } else if (newNodeData.type === 'GroupNode') {
                this.nodeUI.nodeManager.addNode(new GroupNode(newNodeData));
            } else if (newNodeData.type === 'LogNode') {
                this.nodeUI.nodeManager.addNode(new LogNode(newNodeData));
            } else if (newNodeData.type === 'SettingsNode') {
                this.nodeUI.nodeManager.addNode(new SettingsNode(newNodeData));
            } else if (newNodeData.type === 'ImageSequenceNode') {
                this.nodeUI.nodeManager.addNode(new ImageSequenceNode(newNodeData));
            } else if (newNodeData.type === 'SubGraphNode') {
                this.nodeUI.nodeManager.addNode(new SubGraphNode(newNodeData));
            } else if (newNodeData.type === 'ThreeJSNode') {
                this.nodeUI.nodeManager.addNode(new ThreeJSNode(newNodeData));
            } else {
                this.nodeUI.nodeManager.addNode(new BaseNode(newNodeData));
            }
            if (nodeData.isPinned) {
                nodesToPin.push(newId);
            }
        });
        this.nodeUI.clipboard.edges.forEach(edgeData => {
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
        nodesToPin.forEach(nodeId => {
            this.nodeUI.nodeManager.updateNode({ nodeId: nodeId, isPinned: true });
        });
        this.clearSelection();
        idMap.forEach(newNodeId => this.selectNode(newNodeId));
        events.publish('selection:changed', {
            selectedNodeIds: Array.from(this.nodeUI.selectedNodes)
        });
        this.nodeUI.clipboard = { nodes: [], edges: [] };
        events.publish('clipboard:changed', this.nodeUI.clipboard);
        console.log(`Pasted ${pasteCount} nodes.`);
    }

    // --- Drag Methods ---

    /**
     * Initiates the dragging state for a node.
     * @param {string} nodeId - The ID of the node to drag.
     * @param {number} clientX - The clientX from the triggering event.
     * @param {number} clientY - The clientY from the triggering event.
     */
    startDrag(nodeId, clientX, clientY, isPinned = false) {
        const node = this.nodeUI.nodes.get(nodeId);
        if (!node) return;

        this.nodeUI.draggingState.isDragging = true;
        this.nodeUI.draggingState.targetNode = node;
        this.nodeUI.draggingState.isDraggingPinned = isPinned;
        
        // Store initial mouse position and node's original position
        this.nodeUI.draggingState.startX = clientX;
        this.nodeUI.draggingState.startY = clientY;
        
        const nodesToMove = this.getNodesToMove(nodeId);
        
        nodesToMove.forEach(nodeToMoveId => {
            const nodeToMove = this.nodeUI.nodes.get(nodeToMoveId);
            if (nodeToMove) {
                nodeToMove.originalX = nodeToMove.x;
                nodeToMove.originalY = nodeToMove.y;
            }
        });

        this.nodeUI.draggingState.shakeHistory = [];
        this.nodeUI.draggingState.lastShakeTime = Date.now();
        
        node.element.classList.add('is-dragging');
    }

    /**
     * Ends the current dragging state and publishes the result.
     */
    endDrag() {
        const { targetNode } = this.nodeUI.draggingState;
        if (!targetNode) return;

        this.updateGroupingForMovedNodes();

        // Clear any final droppable state
        const droppableEdge = this.nodeUI.draggingState.droppableEdge;
        if (droppableEdge && droppableEdge.element) {
            droppableEdge.element.classList.remove('is-droppable');
            this.nodeUI.draggingState.droppableEdge = null;
        }

        const nodesMoved = this.getNodesToMove(targetNode.id);

        // If any node is dropped on an edge, split the edge
        // Skip edge splitting for GroupNodes to prevent breaking connections to contained nodes
        if (!(targetNode instanceof GroupNode)) {
            let edgeToSplit = null;
            const nodesToCheckForSplitting = nodesMoved;
            
            for (const edge of this.nodeUI.edges.values()) {
                // Don't split edges connected to any node that's being moved
                if (nodesToCheckForSplitting.has(edge.startNodeId) || nodesToCheckForSplitting.has(edge.endNodeId)) {
                    continue;
                }
                
                if (this.isPointOnEdge(targetNode, edge)) {
                    edgeToSplit = edge;
                    break;
                }
            }
            if (edgeToSplit) {
                this.splitEdgeWithNode(edgeToSplit, targetNode, true);
            }
        }

        targetNode.element.classList.remove('is-dragging');

        // Always clear guides when drag ends, regardless of snap settings
        this.nodeUI.clearGuides();

        // Publish 'moved' for all affected nodes
        nodesMoved.forEach(nodeId => {
            const node = this.nodeUI.nodes.get(nodeId);
            if (node) {
                events.publish('node:moved', { nodeId: node.id, x: node.x, y: node.y });
            }
        });

        // Reset dragging state
        this.nodeUI.draggingState.isDragging = false;
        this.nodeUI.draggingState.targetNode = null;
        this.nodeUI.draggingState.shakeCooldown = false; // Reset cooldown
        this.nodeUI.draggingState.isDraggingPinned = false;
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
        if (this.nodeUI.selectedNodes.has(startNodeId)) {
            this.nodeUI.selectedNodes.forEach(id => queue.push(id));
        } else {
            queue.push(startNodeId);
        }

        while (queue.length > 0) {
            const currentId = queue.shift();
            if (nodesToMove.has(currentId)) {
                continue;
            }
            nodesToMove.add(currentId);

            const node = this.nodeUI.nodes.get(currentId);
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
        const movedNodes = this.getNodesToMove(this.nodeUI.draggingState.targetNode.id);
        
        movedNodes.forEach(nodeId => {
            const node = this.nodeUI.nodes.get(nodeId);
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

        for (const potentialParent of this.nodeUI.nodes.values()) {
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
        for (const node of this.nodeUI.nodes.values()) {
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
            const childNode = this.nodeUI.nodes.get(childId);
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
    /**
     * Edge collision detection for smooth visual feedback during drag.
     * @param {BaseNode} node - The node being dragged.
     */
    checkEdgeCollision(node) {
        // Clear previous droppable state
        const prevDroppable = this.nodeUI.draggingState.droppableEdge;
        if (prevDroppable) {
            if (prevDroppable.element) prevDroppable.element.classList.remove('is-droppable');
            this.nodeUI.draggingState.droppableEdge = null;
        }

        // Check for new droppable edge
        for (const edge of this.nodeUI.edges.values()) {
            if (this.isPointNearEdgeSimple(node, edge)) {
                edge.element.classList.add('is-droppable');
                this.nodeUI.draggingState.droppableEdge = edge;
                break;
            }
        }
    }

    /**
     * Simple fast edge detection for drag feedback.
     * @param {BaseNode} node - The node to check.
     * @param {BaseEdge} edge - The edge to check against.
     * @returns {boolean} True if node is near the edge.
     */
    isPointNearEdgeSimple(node, edge) {
        if (!edge.element || !edge.startPosition || !edge.endPosition) return false;

        const nodeCenter = { x: node.x + node.width / 2, y: node.y + node.height / 2 };
        
        // Simple distance to line segment calculation
        const A = nodeCenter.x - edge.startPosition.x;
        const B = nodeCenter.y - edge.startPosition.y;
        const C = edge.endPosition.x - edge.startPosition.x;
        const D = edge.endPosition.y - edge.startPosition.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) return false;

        let param = dot / lenSq;
        param = Math.max(0, Math.min(1, param));

        const xx = edge.startPosition.x + param * C;
        const yy = edge.startPosition.y + param * D;

        const dx = nodeCenter.x - xx;
        const dy = nodeCenter.y - yy;
        
        return Math.sqrt(dx * dx + dy * dy) <= 50; // Generous 50px tolerance
    }

    /**
     * Optimized edge collision detection with bounding box pre-filtering.
     * @param {BaseNode} node - The node to check collision for.
     * @param {BaseEdge} edge - The edge to check collision against.
     * @returns {boolean} True if the node overlaps with the edge.
     */
    isPointOnEdgeOptimized(node, edge) {
        if (!edge.element || !edge.startPosition || !edge.endPosition) return false;

        const nodeCenter = { x: node.x + node.width / 2, y: node.y + node.height / 2 };
        const tolerance = 40; // Generous tolerance for easier edge targeting

        // Quick bounding box check first - add extra padding for curved edges
        const boundingPadding = 50; // Account for curve control points
        const minX = Math.min(edge.startPosition.x, edge.endPosition.x) - boundingPadding;
        const maxX = Math.max(edge.startPosition.x, edge.endPosition.x) + boundingPadding;
        const minY = Math.min(edge.startPosition.y, edge.endPosition.y) - boundingPadding;
        const maxY = Math.max(edge.startPosition.y, edge.endPosition.y) + boundingPadding;

        if (nodeCenter.x < minX || nodeCenter.x > maxX || nodeCenter.y < minY || nodeCenter.y > maxY) {
            return false; // Quick rejection - not even close to the edge
        }

        // For edges with routing points, use more precise but still efficient detection
        if (edge.routingPoints && edge.routingPoints.length > 0) {
            return this.isPointOnRoutedEdge(nodeCenter, edge, tolerance);
        }

        // For simple edges, check against the actual curve path
        // Since edges are curved, we need to sample a few points along the curve
        return this.isPointNearCurvedEdge(nodeCenter, edge, tolerance);
    }

    /**
     * Check if point is near a curved edge using limited sampling.
     * @param {Object} point - The point to check.
     * @param {BaseEdge} edge - The edge to check against.
     * @param {number} tolerance - Maximum distance to consider as collision.
     * @returns {boolean} True if point is within tolerance of the edge.
     */
    isPointNearCurvedEdge(point, edge, tolerance) {
        if (!edge.element) return false;
        
        const path = edge.element;
        const len = path.getTotalLength();
        if (len === 0) return false;

        // Sample at 10 strategic points along the curve for good coverage
        // This is much less than the original which sampled every 5 pixels
        const samples = 10;
        const step = len / samples;

        for (let i = 0; i <= samples; i++) {
            const p = path.getPointAtLength(i * step);
            if (Math.hypot(p.x - point.x, p.y - point.y) <= tolerance) {
                return true;
            }
        }

        return false;
    }

    /**
     * Efficient point-to-line distance calculation.
     * @param {Object} point - The point to check.
     * @param {Object} lineStart - Start point of the line.
     * @param {Object} lineEnd - End point of the line.
     * @param {number} tolerance - Maximum distance to consider as collision.
     * @returns {boolean} True if point is within tolerance of the line.
     */
    isPointNearLine(point, lineStart, lineEnd, tolerance) {
        const A = point.x - lineStart.x;
        const B = point.y - lineStart.y;
        const C = lineEnd.x - lineStart.x;
        const D = lineEnd.y - lineStart.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) return Math.hypot(A, B) <= tolerance;

        const param = dot / lenSq;
        let xx, yy;

        if (param < 0) {
            xx = lineStart.x;
            yy = lineStart.y;
        } else if (param > 1) {
            xx = lineEnd.x;
            yy = lineEnd.y;
        } else {
            xx = lineStart.x + param * C;
            yy = lineStart.y + param * D;
        }

        const dx = point.x - xx;
        const dy = point.y - yy;
        return Math.hypot(dx, dy) <= tolerance;
    }

    /**
     * Check collision with routed edges (edges with routing points).
     * @param {Object} point - The point to check.
     * @param {BaseEdge} edge - The edge with routing points.
     * @param {number} tolerance - Maximum distance to consider as collision.
     * @returns {boolean} True if point is within tolerance of any edge segment.
     */
    isPointOnRoutedEdge(point, edge, tolerance) {
        const points = [edge.startPosition, ...edge.routingPoints, edge.endPosition];
        
        for (let i = 0; i < points.length - 1; i++) {
            if (this.isPointNearLine(point, points[i], points[i + 1], tolerance)) {
                return true;
            }
        }
        return false;
    }

    isPointOnEdge(node, edge) {
        // Legacy method - redirect to optimized version
        return this.isPointOnEdgeOptimized(node, edge);
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
}

// Attach to window for global access
window.Interactions = Interactions; 