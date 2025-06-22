/**
 * @fileoverview Handles edge drawing, routing cut operations, and edge routing 
 * point manipulation for the graph application.
 */

class Edges {
    /**
     * @param {NodeUI} nodeUI - The main NodeUI instance.
     */
    constructor(nodeUI) {
        this.nodeUI = nodeUI;
        
        // Edge drawing state
        this.edgeDrawingState = {
            isDrawing: false,
            startNodeId: null,
            startHandlePosition: null,
            startPosition: null,
            tempEdgeElement: null
        };

        // Routing cut state
        this.routingCutState = {
            isRouting: false,
            cutLine: null
        };

        // Edge routing state
        this.routingState = {
            isRouting: false,
            edgeId: null,
            pointIndex: -1
        };
    }

    // --- Edge Drawing Methods ---

    /**
     * Starts the process of drawing a new edge.
     * @param {string} nodeId - The ID of the starting node.
     * @param {string} handlePosition - The position of the starting handle.
     */
    startDrawingEdge(nodeId, handlePosition) {
        const startNode = this.nodeUI.nodes.get(nodeId);
        if (!startNode) return;

        this.edgeDrawingState.isDrawing = true;
        this.edgeDrawingState.startNodeId = nodeId;
        this.edgeDrawingState.startHandlePosition = handlePosition;
        this.edgeDrawingState.startPosition = this.nodeUI.canvasRenderer.getHandlePosition(nodeId, handlePosition);

        // Create a temporary path element
        const tempEdge = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tempEdge.classList.add('edge', 'edge-drawing');

        const nodeColor = startNode.color || 'default';
        // Use the hover state for the marker since this is an active interaction
        tempEdge.setAttribute('marker-end', `url(#arrowhead-${nodeColor}-border-hover)`);
        
        // Set the --edge-draw-color variable for this specific edge to match the start node's hover color
        const drawColor = getComputedStyle(document.documentElement).getPropertyValue(`--color-node-${nodeColor}-border-hover`).trim();
        tempEdge.style.setProperty('--edge-draw-color', drawColor);
        
        this.nodeUI.canvasGroup.appendChild(tempEdge);
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
        const pathData = this.nodeUI.canvasRenderer.calculateCurve(startPos, {x: endX, y: endY}, state.startHandlePosition, 'auto');
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
     * Gets the current edge drawing state.
     * @returns {Object} The current edge drawing state.
     */
    getDrawingState() {
        return this.edgeDrawingState;
    }

    /**
     * Checks if currently drawing an edge.
     * @returns {boolean} True if currently drawing an edge.
     */
    isDrawing() {
        return this.edgeDrawingState.isDrawing;
    }

    // --- Routing Cut Methods ---

    /**
     * Starts the routing cut line drawing.
     * @param {MouseEvent} event 
     */
    startRoutingCut(event) {
        this.routingCutState.isRouting = true;
        // Delegate to CanvasRenderer for visual
        this.nodeUI.canvasRenderer.startRoutingCut(event);
    }

    /**
     * Updates the routing cut line as the mouse moves.
     * @param {MouseEvent} event 
     */
    updateRoutingCut(event) {
        if (!this.routingCutState.isRouting) return;
        this.nodeUI.canvasRenderer.updateRoutingCut(event);
    }

    /**
     * Ends the routing cut line and creates a routing node at the intersection.
     */
    endRoutingCut() {
        if (!this.routingCutState.isRouting) return;
        this.nodeUI.canvasRenderer.endRoutingCut();
        this.routingCutState.isRouting = false;
    }

    /**
     * Gets the routing cut state.
     * @returns {Object} The routing cut state.
     */
    getRoutingCutState() {
        return this.routingCutState;
    }

    // --- Edge Routing Methods ---

    /**
     * Starts edge routing for a specific edge and point.
     * @param {string} edgeId - The ID of the edge to route.
     * @param {number} pointIndex - The index of the routing point.
     */
    startEdgeRouting(edgeId, pointIndex) {
        this.routingState.isRouting = true;
        this.routingState.edgeId = edgeId;
        this.routingState.pointIndex = parseInt(pointIndex);
    }

    /**
     * Updates edge routing as the mouse moves.
     * @param {MouseEvent} event 
     */
    updateEdgeRouting(event) {
        if (!this.routingState.isRouting) return;
        const edge = this.nodeUI.edges.get(this.routingState.edgeId);
        if (edge) {
            const point = this.nodeUI.getMousePosition(event);
            edge.routingPoints[this.routingState.pointIndex] = point;
            this.nodeUI.updateEdge(edge.id);
            this.nodeUI.renderRoutingPoints(edge);
        }
    }

    /**
     * Ends edge routing.
     */
    endEdgeRouting() {
        this.routingState.isRouting = false;
    }

    /**
     * Gets the edge routing state.
     * @returns {Object} The edge routing state.
     */
    getRoutingState() {
        return this.routingState;
    }
}

// Attach to window for global access
window.Edges = Edges; 