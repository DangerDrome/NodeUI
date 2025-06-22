/**
 * @fileoverview Handles routing cut and edge routing logic for NodeUI.
 */

class RoutingHandler {
    /**
     * @param {NodeUI} nodeUI - The main NodeUI instance.
     */
    constructor(nodeUI) {
        this.nodeUI = nodeUI;
        this.routingCutState = {
            isRouting: false,
            cutLine: null
        };
        this.routingState = {
            isRouting: false,
            edgeId: null,
            pointIndex: -1
        };
    }

    startRoutingCut(event) {
        this.routingCutState.isRouting = true;
        // Delegate to CanvasRenderer for visual
        this.nodeUI.canvasRenderer.startRoutingCut(event);
    }

    updateRoutingCut(event) {
        if (!this.routingCutState.isRouting) return;
        this.nodeUI.canvasRenderer.updateRoutingCut(event);
    }

    endRoutingCut() {
        if (!this.routingCutState.isRouting) return;
        this.nodeUI.canvasRenderer.endRoutingCut();
        this.routingCutState.isRouting = false;
    }

    // Edge routing state management
    startEdgeRouting(edgeId, pointIndex) {
        this.routingState.isRouting = true;
        this.routingState.edgeId = edgeId;
        this.routingState.pointIndex = parseInt(pointIndex);
    }

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

    endEdgeRouting() {
        this.routingState.isRouting = false;
    }

    getRoutingCutState() {
        return this.routingCutState;
    }

    getRoutingState() {
        return this.routingState;
    }
} 