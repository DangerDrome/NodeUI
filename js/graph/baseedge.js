/**
 * @fileoverview Base class for all edges connecting nodes on the canvas.
 * This class handles common properties like ID and the connected node/handle IDs.
 * It is intended to be extended by more complex edge types in the future.
 */

class BaseEdge {
    /**
     * @param {object} [options={}] - The options for the edge.
     * @param {string} [options.id] - A unique identifier. Defaults to a generated UUID.
     * @param {string} [options.startNodeId=null] - The ID of the node where the edge starts.
     * @param {string} [options.endNodeId=null] - The ID of the node where the edge ends.
     * @param {string} [options.startHandleId=null] - The ID of the specific handle on the start node.
     * @param {string} [options.endHandleId=null] - The ID of the specific handle on the end node.
     * @param {string} [options.type='BaseEdge'] - The type of the edge.
     */
    constructor({
        id = crypto.randomUUID(),
        startNodeId = null,
        endNodeId = null,
        startHandleId = null,
        endHandleId = null,
        type = 'BaseEdge'
    } = {}) {
        this.id = id;
        this.startNodeId = startNodeId;
        this.endNodeId = endNodeId;
        this.startHandleId = startHandleId;
        this.endHandleId = endHandleId;
        this.type = type;

        this.element = null; // To hold the DOM element (e.g., an SVG path)
    }

    /**
     * Renders the edge on the canvas.
     * This creates the SVG path element for the edge.
     * @param {SVGElement} svgGroup - The main SVG group element to draw on.
     */
    render(svgGroup) {
        this.element = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.element.id = this.id;
        this.element.classList.add('edge');
        svgGroup.appendChild(this.element);
    }
} 