/**
 * @fileoverview Manages node and edge lifecycle including creation, deletion, 
 * updates, grouping, and hierarchy management.
 */

class Nodes {
    /**
     * @param {NodeUI} nodeUI - Reference to the main NodeUI instance.
     */
    constructor(nodeUI) {
        this.nodeUI = nodeUI;
    }

    /**
     * Adds a node to the canvas and renders it.
     * @param {BaseNode} node - The node instance to add.
     */
    addNode(node) {
        this.nodeUI.nodes.set(node.id, node);
        if (node instanceof GroupNode) {
            node.render(this.nodeUI.groupContainer);
        } else {
            node.render(this.nodeUI.nodeContainer);
        }
    }

    /**
     * Adds an edge to the canvas and renders it.
     * @param {BaseEdge} edge - The edge instance to add.
     */
    addEdge(edge) {
        this.nodeUI.edges.set(edge.id, edge);
        edge.render(this.nodeUI.canvasGroup); // Edges are SVG elements
        
        // Update node-edge mapping for fast lookups
        this._addToNodeEdgeMapping(edge.startNodeId, edge.id);
        this._addToNodeEdgeMapping(edge.endNodeId, edge.id);
        
        // Calculate initial positions and draw the edge immediately
        const startNode = this.nodeUI.nodes.get(edge.startNodeId);
        const endNode = this.nodeUI.nodes.get(edge.endNodeId);
        
        if (startNode && endNode) {
            edge.startPosition = this.nodeUI.getHandlePosition(edge.startNodeId, edge.startHandleId);
            edge.endPosition = this.nodeUI.getHandlePosition(edge.endNodeId, edge.endHandleId);
            this.nodeUI.updateEdge(edge.id);

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
        const node = this.nodeUI.nodes.get(nodeId);
        if (!node) return;

        // If the node has a custom destroy method, call it for cleanup
        if (typeof node.destroy === 'function') {
            node.destroy();
        }

        // Find and remove all connected edges first
        const edgesToRemove = [];
        this.nodeUI.edges.forEach(edge => {
            if (edge.startNodeId === nodeId || edge.endNodeId === nodeId) {
                edgesToRemove.push(edge.id);
            }
        });
        edgesToRemove.forEach(edgeId => this.removeEdge(edgeId));
        
        // Remove the node element itself
        if (node.element) {
            node.element.remove();
        }
        this.nodeUI.nodes.delete(nodeId);
    }

    /**
     * Removes an edge from the canvas.
     * @param {string} edgeId - The ID of the edge to remove.
     */
    removeEdge(edgeId) {
        const edge = this.nodeUI.edges.get(edgeId);
        if (!edge) return;

        // Update node-edge mapping for fast lookups
        this._removeFromNodeEdgeMapping(edge.startNodeId, edge.id);
        this._removeFromNodeEdgeMapping(edge.endNodeId, edge.id);

        // Update node connection states before removing the edge
        const startNode = this.nodeUI.nodes.get(edge.startNodeId);
        const endNode = this.nodeUI.nodes.get(edge.endNodeId);
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
        this.nodeUI.edges.delete(edgeId);
    }

    /**
     * Updates a node's properties based on an event.
     * @param {{nodeId: string, [key: string]: any}} data The update data.
     */
    updateNode(data) {
        const node = this.nodeUI.nodes.get(data.nodeId);
        if (node) {
            const oldPinnedState = node.isPinned;
            node.update(data);

            // If the title changed, and the node is in the current navigation path,
            // re-render the breadcrumbs to show the new title.
            if (data.title !== undefined && this.nodeUI.graphContext.graphStack.includes(node.id)) {
                this.nodeUI.showBreadcrumb();
            }

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
            const node = this.nodeUI.nodes.get(nodeId);
            if (node) {
                allNodes.add(node);
                if (node instanceof GroupNode) {
                    node.containedNodeIds.forEach(childId => queue.push(childId));
                }
            }
        }
        return allNodes;
    }

    /**
     * Toggles the visibility of a node's popover.
     * @param {string} nodeId The ID of the node to toggle the popover for.
     */
    toggleNodePopover(nodeId) {
        const currentlyOpenNodeId = this.nodeUI.openPopoverNodeId;
        
        // Close any currently open popover
        if (currentlyOpenNodeId && currentlyOpenNodeId !== nodeId) {
            const oldNode = this.nodeUI.nodes.get(currentlyOpenNodeId);
            if (oldNode) {
                oldNode.element.classList.remove('is-popover-open');
                oldNode.popoverElement.innerHTML = ''; // Clear content
            }
        }
        
        const node = this.nodeUI.nodes.get(nodeId);
        if (!node) return;

        const isOpen = node.element.classList.toggle('is-popover-open');
        
        if (isOpen) {
            this.nodeUI.openPopoverNodeId = nodeId;
            node.popoverElement.innerHTML = node.getPopoverContent();
            this.addPopoverListeners(node);
        } else {
            this.nodeUI.openPopoverNodeId = null;
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
     * Cycles through the available colors for a given node.
     * @param {string} nodeId The ID of the node to cycle the color for.
     */
    cycleNodeColor(nodeId) {
        const node = this.nodeUI.nodes.get(nodeId);
        if (!node) return;

        const colors = ['default', 'red', 'green', 'blue', 'yellow', 'purple'];
        const currentIndex = colors.indexOf(node.color);
        const nextIndex = (currentIndex + 1) % colors.length;
        const newColor = colors[nextIndex];

        events.publish('node:update', { nodeId, color: newColor });
    }

    /**
     * Cycles through the available colors for a given routing node on right-click.
     * @param {string} routingNodeId The ID of the routing node to cycle.
     */
    cycleRoutingNodeColor(routingNodeId) {
        const routingNode = this.nodeUI.nodes.get(routingNodeId);
        if (!routingNode) return;

        // --- Cycle Color ---
        const colors = ['default', 'red', 'green', 'blue', 'yellow', 'purple'];
        const currentIndex = colors.indexOf(routingNode.color);
        const newColor = colors[(currentIndex + 1) % colors.length];
        
        // Use the public update event to change the color
        events.publish('node:update', { nodeId: routingNodeId, color: newColor });
    }

    /**
     * Creates a new BaseNode at the last known mouse position.
     */
    createNodeAtMousePosition() {
        const position = this.nodeUI.getMousePosition(this.nodeUI.lastMousePosition);
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
        const position = this.nodeUI.getMousePosition(this.nodeUI.lastMousePosition);
        events.publish('node:create', {
            type: 'RoutingNode',
            x: position.x - 15, // Center the small node on the cursor
            y: position.y - 15
        });
    }

    /**
     * Brings a node and all its children (if it's a group) or all selected nodes to the front.
     * @param {string} startNodeId The ID of the node initiating the action.
     */
    bringToFront(startNodeId) {
        const nodesToFront = this.nodeUI.interactionHandler.getNodesToMove(startNodeId);
        
        const groups = [];
        const regularNodes = [];

        // Separate nodes into groups and regular nodes
        nodesToFront.forEach(nodeId => {
            const node = this.nodeUI.nodes.get(nodeId);
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
            if (this.nodeUI.interactionHandler.isDescendant(b, a)) return -1; // a contains b, so a should be first
            if (this.nodeUI.interactionHandler.isDescendant(a, b)) return 1;  // b contains a, so b should be first
            return 0;
        });
        
        // Assign z-indices to groups from the group pool (max 499 to stay below edges)
        groups.forEach(node => {
            if(node.element) {
                node.element.style.zIndex = this.nodeUI.maxGroupZIndex++;
                // Ensure groups never exceed z-index 499 to stay below edges
                if (this.nodeUI.maxGroupZIndex > 499) {
                    this.nodeUI.maxGroupZIndex = 100; // Reset to start of range
                }
            }
        });
        
        // Then assign z-indices to regular nodes from the node pool
        regularNodes.forEach(node => {
            if(node.element) node.element.style.zIndex = this.nodeUI.maxNodeZIndex++;
        });
    }

    /**
     * Creates a new group node around the currently selected nodes.
     */
    groupSelection() {
        if (this.nodeUI.selectedNodes.size < 1) return;

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        this.nodeUI.selectedNodes.forEach(nodeId => {
            const node = this.nodeUI.nodes.get(nodeId);
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

        const containedNodeIds = Array.from(this.nodeUI.selectedNodes);

        // Remove newly contained nodes from any previous parent
        containedNodeIds.forEach(nodeId => {
            const oldParent = this.nodeUI.interactionHandler.findParentGroup(nodeId);
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
        this.nodeUI.clearSelection();
        this.nodeUI.selectNode(newGroup.id);
        events.publish('selection:changed', {
            selectedNodeIds: Array.from(this.nodeUI.selectedNodes),
            selectedEdgeIds: Array.from(this.nodeUI.selectedEdges)
        });
    }

    /**
     * Moves a node between the main container and the pinned container based on its state.
     * @param {string} nodeId The ID of the node to reparent.
     */
    reparentNode(nodeId) {
        const node = this.nodeUI.nodes.get(nodeId);
        if (!node || !node.element) return;

        if (node.isPinned) {
            // Pinning the node: Move from world container to pinned container
            const rect = node.element.getBoundingClientRect();
            const containerRect = this.nodeUI.container.getBoundingClientRect();

            // Convert world coords and size to screen coords for pinning
            node.x = rect.left - containerRect.left;
            node.y = rect.top - containerRect.top;
            node.width = rect.width;
            node.height = rect.height;
            
            this.nodeUI.pinnedNodeContainer.appendChild(node.element);
            node.element.style.left = `${node.x}px`;
            node.element.style.top = `${node.y}px`;
            node.element.style.width = `${node.width}px`;
            node.element.style.height = `${node.height}px`;
            this.nodeUI.pinnedNodes.add(nodeId);

        } else {
            // Unpinning the node: Move from pinned container to world container
            // Convert screen coords and size back to world coords
            const worldX = (node.x - this.nodeUI.panZoom.offsetX) / this.nodeUI.panZoom.scale;
            const worldY = (node.y - this.nodeUI.panZoom.offsetY) / this.nodeUI.panZoom.scale;
            const worldWidth = node.width / this.nodeUI.panZoom.scale;
            const worldHeight = node.height / this.nodeUI.panZoom.scale;

            node.x = worldX;
            node.y = worldY;
            node.width = worldWidth;
            node.height = worldHeight;

            const targetContainer = node instanceof GroupNode ? this.nodeUI.groupContainer : this.nodeUI.nodeContainer;
            targetContainer.appendChild(node.element);
            node.element.style.left = `${node.x}px`;
            node.element.style.top = `${node.y}px`;
            node.element.style.width = `${node.width}px`;
            node.element.style.height = `${node.height}px`;
            this.nodeUI.pinnedNodes.delete(nodeId);
        }
        this.nodeUI.updateConnectedEdges(nodeId);
    }

    /**
     * Helper method to add an edge to the node-edge mapping.
     * @param {string} nodeId - The ID of the node.
     * @param {string} edgeId - The ID of the edge.
     */
    _addToNodeEdgeMapping(nodeId, edgeId) {
        if (!this.nodeUI.nodeEdges.has(nodeId)) {
            this.nodeUI.nodeEdges.set(nodeId, new Set());
        }
        this.nodeUI.nodeEdges.get(nodeId).add(edgeId);
    }

    /**
     * Helper method to remove an edge from the node-edge mapping.
     * @param {string} nodeId - The ID of the node.
     * @param {string} edgeId - The ID of the edge.
     */
    _removeFromNodeEdgeMapping(nodeId, edgeId) {
        const edgeSet = this.nodeUI.nodeEdges.get(nodeId);
        if (edgeSet) {
            edgeSet.delete(edgeId);
            if (edgeSet.size === 0) {
                this.nodeUI.nodeEdges.delete(nodeId);
            }
        }
    }
}

// Attach to window for global access
window.Nodes = Nodes; 