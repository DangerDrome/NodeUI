/**
 * @fileoverview Handles selection, multi-select, clipboard, and grouping logic.
 */

class SelectionManager {
    /**
     * @param {NodeUI} nodeUI - Reference to the main NodeUI instance.
     */
    constructor(nodeUI) {
        this.nodeUI = nodeUI;
    }

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
                const nodeData = { 
                    ...node,
                    element: null, 
                    handles: {},
                    connections: new Map()
                };
                if (node.isPinned) {
                    nodeData.x = (node.x - this.nodeUI.panZoom.offsetX) / this.nodeUI.panZoom.scale;
                    nodeData.y = (node.y - this.nodeUI.panZoom.offsetY) / this.nodeUI.panZoom.scale;
                }
                if (node instanceof GroupNode) {
                    nodeData.containedNodeIds = Array.from(node.containedNodeIds);
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
            if (nodeData.type === 'GroupNode' && nodeData.containedNodeIds) {
                newNodeData.containedNodeIds = nodeData.containedNodeIds.map(oldChildId => 
                    idMap.get(oldChildId) || oldChildId
                ).filter(id => id);
            }
            if (newNodeData.type === 'RoutingNode') {
                this.nodeUI.nodeManager.addNode(new RoutingNode(newNodeData));
            } else if (newNodeData.type === 'GroupNode') {
                this.nodeUI.nodeManager.addNode(new GroupNode(newNodeData));
            } else if (newNodeData.type === 'LogNode') {
                this.nodeUI.nodeManager.addNode(new LogNode(newNodeData));
            } else if (newNodeData.type === 'SettingsNode') {
                this.nodeUI.nodeManager.addNode(new SettingsNode(newNodeData));
            }
            else {
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
} 