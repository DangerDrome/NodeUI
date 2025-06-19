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
     * @param {string} [options.startPosition=null] - The position of the start handle.
     * @param {string} [options.endPosition=null] - The position of the end handle.
     * @param {string} [options.type='BaseEdge'] - The type of the edge.
     * @param {string} [options.label=''] - The text label for the edge.
     */
    constructor({
        id = crypto.randomUUID(),
        startNodeId = null,
        endNodeId = null,
        startHandleId = null,
        endHandleId = null,
        type = 'BaseEdge',
        label = ''
    } = {}) {
        this.id = id;
        this.startNodeId = startNodeId;
        this.endNodeId = endNodeId;
        this.startHandleId = startHandleId;
        this.endHandleId = endHandleId;
        this.startPosition = null; // Calculated in addEdge
        this.endPosition = null;   // Calculated in addEdge
        this.routingPoints = []; // Array of {x, y} points
        this.type = type;
        this.label = label;

        this.element = null; // To hold the DOM element (e.g., an SVG path)
        this.hitArea = null; // A thicker, invisible path for easier interaction
        this.groupElement = null; // The parent <g> element
        this.routingPointElements = []; // Array of routing point DOM elements
        this.labelElement = null;
        this.labelBackgroundElement = null;
    }

    /**
     * Renders the edge on the canvas.
     * This creates the SVG path element for the edge.
     * @param {SVGElement} svgGroup - The main SVG group element to draw on.
     */
    render(svgGroup) {
        // Create a group for the edge and its hit area
        this.groupElement = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        
        // Create the visible edge path
        this.element = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.element.id = this.id;
        this.element.classList.add('edge');

        // Create the invisible hit area
        this.hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.hitArea.classList.add('edge-hit-area');
        
        // Create the label background element
        this.labelBackgroundElement = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        this.labelBackgroundElement.classList.add('edge-label-background');

        // Create the label element
        this.labelElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        this.labelElement.classList.add('edge-label');
        this.labelElement.setAttribute('text-anchor', 'middle');
        this.labelElement.textContent = this.label;

        // Manual dblclick detection for the label
        let lastLabelClickTime = 0;
        const handleLabelClick = (event) => {
            event.stopPropagation();
            const now = Date.now();
            if (now - lastLabelClickTime < 300) {
                events.publish('edge:edit-label', { edgeId: this.id });
            }
            lastLabelClickTime = now;
        };
        this.labelElement.addEventListener('mousedown', handleLabelClick);
        this.labelBackgroundElement.addEventListener('mousedown', handleLabelClick);

        // The hit area must be the last element to be on top and receive clicks
        this.groupElement.appendChild(this.element);
        this.groupElement.appendChild(this.labelBackgroundElement);
        this.groupElement.appendChild(this.labelElement);
        this.groupElement.appendChild(this.hitArea);
        
        // Set the color attribute based on the start node for pure CSS styling
        const startNodeEl = document.getElementById(this.startNodeId);
        if (startNodeEl) {
            const nodeColor = startNodeEl.dataset.color || 'default';
            this.groupElement.dataset.color = nodeColor;
            this.element.setAttribute('marker-end', 'url(#arrowhead)');
        }

        // Add hover effects to the group to show routing handles and trigger CSS changes
        this.hitArea.addEventListener('mouseenter', () => this.groupElement.classList.add('is-hovered'));
        this.hitArea.addEventListener('mouseleave', () => this.groupElement.classList.remove('is-hovered'));
        
        this.hitArea.addEventListener('click', (event) => {
            event.stopPropagation();
            const isSelected = this.element.classList.contains('is-selected');
            events.publish('edge:selected', { 
                edgeId: this.id, 
                isSelected: !isSelected,
                isMultiSelect: event.shiftKey 
            });
        });

        // Manual dblclick detection on the hit area
        let lastClickTime = 0;
        this.hitArea.addEventListener('mousedown', (event) => {
            event.stopPropagation(); // Prevent canvas mousedown from firing
            const now = Date.now();
            if (now - lastClickTime < 300) { // 300ms threshold for dblclick
                event.stopPropagation();
                events.publish('edge:add-routing-node', { edgeId: this.id, event });
            }
            lastClickTime = now;
        });

        svgGroup.appendChild(this.groupElement);

        // Make the handles visible
        const startHandle = document.querySelector(`[data-node-id="${this.startNodeId}"] .node-handle-zone[data-handle-position="${this.startHandleId}"] .node-handle`);
        const endHandle = document.querySelector(`[data-node-id="${this.endNodeId}"] .node-handle-zone[data-handle-position="${this.endHandleId}"] .node-handle`);
        if (startHandle) startHandle.classList.add('connected');
        if (endHandle) endHandle.classList.add('connected');
    }
} 