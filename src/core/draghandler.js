/**
 * @fileoverview Handles drag and drop operations including node dragging, 
 * grouping, and edge splitting logic.
 */

class DragHandler {
    /**
     * @param {NodeUI} nodeUI - Reference to the main NodeUI instance.
     */
    constructor(nodeUI) {
        this.nodeUI = nodeUI;
    }

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
        if (this.nodeUI.draggingState.droppableEdge) {
            this.nodeUI.draggingState.droppableEdge.classList.remove('is-droppable');
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
} 