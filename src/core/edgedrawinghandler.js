/**
 * @fileoverview Manages edge drawing operations including starting, updating, and finishing edge creation.
 */

class EdgeDrawingHandler {
    /**
     * @param {NodeUI} nodeUI - The main NodeUI instance.
     */
    constructor(nodeUI) {
        this.nodeUI = nodeUI;
        this.edgeDrawingState = {
            isDrawing: false,
            startNodeId: null,
            startHandlePosition: null,
            startPosition: null,
            tempEdgeElement: null
        };
    }

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
    getState() {
        return this.edgeDrawingState;
    }

    /**
     * Checks if currently drawing an edge.
     * @returns {boolean} True if currently drawing an edge.
     */
    isDrawing() {
        return this.edgeDrawingState.isDrawing;
    }
} 