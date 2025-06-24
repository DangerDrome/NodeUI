/**
 * @fileoverview A specialized node for containing self-contained subgraphs.
 * Similar to Houdini HDAs, these can be shared and have exposed attributes.
 * Extends BaseNode with internal graph management and navigation capabilities.
 */

class SubGraphNode extends BaseNode {
    /**
     * @param {object} [options={}] - The options for the subgraph node.
     * @param {string} [options.subgraphId] - Unique ID for the subgraph data.
     * @param {object} [options.internalGraph] - The internal graph data.
     * @param {object[]} [options.exposedAttributes] - Array of exposed input/output attributes.
     * @param {string} [options.subgraphPath] - Path to the subgraph JSON file.
     */
    constructor(options = {}) {
        // Set defaults specific to a subgraph node
        const defaults = {
            width: 300,
            height: 200,
            title: 'New SubGraph',
            type: 'SubGraphNode',
            color: 'default'
        };

        // Merge options with defaults
        super({ ...defaults, ...options });

        /**
         * Unique identifier for the subgraph data
         * @type {string}
         */
        this.subgraphId = options.subgraphId || crypto.randomUUID();

        /**
         * Path to the subgraph JSON file
         * @type {string}
         */
        this.subgraphPath = options.subgraphPath || `subgraphs/${this.subgraphId}.json`;

        /**
         * Internal graph data (nodes, edges, canvas state)
         * @type {object}
         */
        this.internalGraph = options.internalGraph || {
            nodes: [],
            edges: [],
            canvasState: {
                scale: 1,
                offsetX: 0,
                offsetY: 0
            }
        };

        /**
         * Exposed attributes that can be connected to parent graph
         * @type {object[]}
         */
        this.exposedAttributes = options.exposedAttributes || [];

        /**
         * Preview SVG for rendering internal graph
         * @type {SVGSVGElement}
         */
        this.previewSvg = null;

        /**
         * Whether the subgraph is currently being edited
         * @type {boolean}
         */
        this.isEditing = false;
    }

    /**
     * Overrides the default render method to add subgraph-specific styling and preview.
     * @param {HTMLElement} parentElement - The parent element to append the node to.
     * @returns {HTMLElement} The created DOM element for the node.
     */
    render(parentElement) {
        // Call the parent render method to create the base node structure
        super.render(parentElement);

        // Add a specific class for subgraph styling
        this.element.classList.add('subgraph-node');
        
        // Change the default icon to the subgraph icon
        const icon = this.element.querySelector('.node-icon');
        if (icon) {
            icon.classList.remove('icon-file-text');
            icon.classList.add('icon-squares-subtract');
        }

        // Add exposed attributes as handles
        this.createExposedAttributeHandles();

        // Ensure preview is rendered after the node is fully created
        setTimeout(() => {
            this.renderPreview();
        }, 50);

        return this.element;
    }

    /**
     * Overrides the base method to render subgraph preview and handle double-click navigation.
     * @param {HTMLElement} contentArea - The content area element.
     */
    renderContent(contentArea) {
        // Create preview container
        const previewContainer = document.createElement('div');
        previewContainer.className = 'subgraph-preview-container';
        
        // Create preview SVG
        this.previewSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.previewSvg.classList.add('subgraph-preview-svg');
        
        previewContainer.appendChild(this.previewSvg);
        contentArea.appendChild(previewContainer);

        // Render the preview after a short delay to ensure the SVG is properly sized
        setTimeout(() => {
            this.renderPreview();
        }, 10);

        // Add double-click handler for navigation
        this.element.addEventListener('dblclick', (event) => {
            // Don't trigger if clicking on handles or title bar
            if (event.target.closest('.node-handle') || event.target.closest('.node-title-bar')) {
                return;
            }
            this.enterSubGraph();
        });

        // Add click handler for the preview SVG specifically
        this.previewSvg.addEventListener('dblclick', (event) => {
            event.stopPropagation();
            this.enterSubGraph();
        });
    }

    /**
     * Creates handles for exposed attributes that can connect to the parent graph.
     */
    createExposedAttributeHandles() {
        // Clear existing exposed handles
        const existingHandles = this.element.querySelectorAll('.exposed-handle');
        existingHandles.forEach(handle => handle.remove());

        // Create handles for each exposed attribute
        this.exposedAttributes.forEach((attr, index) => {
            const handle = document.createElement('div');
            handle.className = `node-handle exposed-handle ${attr.direction}-handle`;
            handle.dataset.position = `${attr.direction}-${index}`;
            handle.dataset.attributeId = attr.id;
            handle.dataset.attributeName = attr.name;
            handle.dataset.attributeType = attr.type;
            
            // Position handles based on direction
            if (attr.direction === 'input') {
                handle.style.left = '0px';
                handle.style.top = `${40 + (index * 20)}px`;
            } else {
                handle.style.right = '0px';
                handle.style.top = `${40 + (index * 20)}px`;
            }

            // Add tooltip
            handle.title = `${attr.direction}: ${attr.name} (${attr.type})`;

            this.element.appendChild(handle);
            this.handles[`${attr.direction}-${index}`] = handle;
        });
    }

    /**
     * Renders a simplified preview of the internal graph on the preview SVG.
     */
    renderPreview() {
        if (!this.previewSvg) return;

        const svg = this.previewSvg;
        const svgNS = 'http://www.w3.org/2000/svg';
        
        // Clear SVG content
        svg.innerHTML = '';
        svg.removeAttribute('width');
        svg.removeAttribute('height');

        // Set background to match the node's color
        const nodeColor = this.color || 'default';
        const bgColorMap = {
            'default': 'rgba(58, 58, 58, 0.1)',
            'red': 'rgba(229, 72, 77, 0.1)',
            'green': 'rgba(62, 207, 142, 0.1)',
            'blue': 'rgba(0, 144, 255, 0.1)',
            'yellow': 'rgba(249, 199, 79, 0.1)',
            'purple': 'rgba(157, 78, 221, 0.1)'
        };
        const bgRect = document.createElementNS(svgNS, 'rect');
        bgRect.setAttribute('width', '100%');
        bgRect.setAttribute('height', '100%');
        bgRect.setAttribute('fill', bgColorMap[nodeColor]);
        svg.appendChild(bgRect);

        // If no nodes, show placeholder text and exit
        if (!this.internalGraph.nodes || this.internalGraph.nodes.length === 0) {
            const text = document.createElementNS(svgNS, 'text');
            text.setAttribute('x', '50%');
            text.setAttribute('y', '50%');
            text.setAttribute('dy', '0.3em');
            text.setAttribute('fill', 'rgba(255, 255, 255, 0.3)');
            text.setAttribute('font-family', 'system-ui, sans-serif');
            text.setAttribute('font-size', '14');
            text.setAttribute('text-anchor', 'middle');
            text.textContent = 'Empty SubGraph';
            svg.appendChild(text);
            return;
        }

        // --- Calculate Bounding Box of Internal Graph ---
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        this.internalGraph.nodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + (node.width || 200));
            maxY = Math.max(maxY, node.y + (node.height || 120));
        });

        const padding = 50; // Add padding around the content
        const contentWidth = (maxX - minX) + padding * 2;
        const contentHeight = (maxY - minY) + padding * 2;
        
        if (contentWidth <= 0 || contentHeight <= 0) {
            // Handle case with empty or invalid graph bounds
            return;
        }

        // Set viewBox to frame the content
        svg.setAttribute('viewBox', `${minX - padding} ${minY - padding} ${contentWidth} ${contentHeight}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        // Draw nodes
        this.internalGraph.nodes.forEach(node => {
            const colorMap = {
                'default': { bg: 'rgba(58, 58, 58, 0.5)', border: 'rgba(90, 90, 90, 0.8)' },
                'red': { bg: 'rgba(229, 72, 77, 0.2)', border: 'rgba(229, 72, 77, 0.8)' },
                'green': { bg: 'rgba(62, 207, 142, 0.2)', border: 'rgba(62, 207, 142, 0.8)' },
                'blue': { bg: 'rgba(0, 144, 255, 0.2)', border: 'rgba(0, 144, 255, 0.8)' },
                'yellow': { bg: 'rgba(249, 199, 79, 0.2)', border: 'rgba(249, 199, 79, 0.8)' },
                'purple': { bg: 'rgba(157, 78, 221, 0.2)', border: 'rgba(157, 78, 221, 0.8)' }
            };
            
            const colors = colorMap[node.color || 'default'];
            const radius = 8;
            
            const rect = document.createElementNS(svgNS, 'rect');
            rect.setAttribute('x', node.x);
            rect.setAttribute('y', node.y);
            rect.setAttribute('width', node.width);
            rect.setAttribute('height', node.height);
            rect.setAttribute('rx', radius);
            rect.setAttribute('ry', radius);
            rect.setAttribute('fill', colors.bg);
            rect.setAttribute('stroke', colors.border);
            rect.setAttribute('stroke-width', '1.5'); // Use slightly thicker lines for visibility at scale
            svg.appendChild(rect);
        });

        // Draw edges
        this.internalGraph.edges.forEach(edge => {
            const startNode = this.internalGraph.nodes.find(n => n.id === edge.startNodeId);
            const endNode = this.internalGraph.nodes.find(n => n.id === edge.endNodeId);
            
            if (startNode && endNode) {
                const startPos = this.getHandlePosition(startNode, edge.startHandleId);
                const endPos = this.getHandlePosition(endNode, edge.endHandleId);
                this.drawCurvedEdge(svg, startPos, endPos, edge.startHandleId, edge.endHandleId, startNode.color || 'default');
            }
        });
    }

    /**
     * Gets the position of a handle on a node.
     * @param {object} node - The node object.
     * @param {string} handleId - The handle ID.
     * @returns {object} The handle position {x, y}.
     */
    getHandlePosition(node, handleId) {
        switch (handleId) {
            case 'top':
                return { x: node.x + node.width / 2, y: node.y };
            case 'right':
                return { x: node.x + node.width, y: node.y + node.height / 2 };
            case 'bottom':
                return { x: node.x + node.width / 2, y: node.y + node.height };
            case 'left':
                return { x: node.x, y: node.y + node.height / 2 };
            default:
                return { x: node.x + node.width, y: node.y + node.height / 2 };
        }
    }

    /**
     * Draws a curved edge between two points on the preview SVG.
     * @param {SVGSVGElement} svg - The parent SVG element.
     * @param {object} startPos - The starting position {x, y}.
     * @param {object} endPos - The ending position {x, y}.
     * @param {string} startHandle - The starting handle position.
     * @param {string} endHandle - The ending handle position.
     * @param {string} startNodeColor - The color of the start node.
     */
    drawCurvedEdge(svg, startPos, endPos, startHandle, endHandle, startNodeColor = 'default') {
        const svgNS = 'http://www.w3.org/2000/svg';
        const colorMap = {
            'default': '#5a5a5a',
            'red': '#e5484d',
            'green': '#3ecf8e',
            'blue': '#0090ff',
            'yellow': '#f9c74f',
            'purple': '#9d4edd'
        };
        
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', this.getCurvedEdgePath(startPos, endPos, startHandle, endHandle));
        path.setAttribute('stroke', colorMap[startNodeColor] || colorMap.default);
        path.setAttribute('stroke-width', '2'); // Consistent with node stroke width
        path.setAttribute('fill', 'none');
        svg.appendChild(path);
    }

    getCurvedEdgePath(startPos, endPos, startHandle, endHandle) {
        const distance = Math.sqrt(Math.pow(endPos.x - startPos.x, 2) + Math.pow(endPos.y - startPos.y, 2));
        const actualPadding = 5;
        let p1 = { ...startPos };
        let p2 = { ...endPos };

        switch (startHandle) {
            case 'top':    p1.y -= actualPadding; break;
            case 'bottom': p1.y += actualPadding; break;
            case 'left':   p1.x -= actualPadding; break;
            case 'right':  p1.x += actualPadding; break;
        }

        switch (endHandle) {
            case 'top':    p2.y -= actualPadding; break;
            case 'bottom': p2.y += actualPadding; break;
            case 'left':   p2.x -= actualPadding; break;
            case 'right':  p2.x += actualPadding; break;
        }

        const offset = Math.min(100, distance / 2);
        let cp1 = { ...p1 };
        let cp2 = { ...p2 };

        switch (startHandle) {
            case 'top':    cp1.y -= offset; break;
            case 'bottom': cp1.y += offset; break;
            case 'left':   cp1.x -= offset; break;
            case 'right':  cp1.x += offset; break;
        }

        switch (endHandle) {
            case 'top':    cp2.y -= offset; break;
            case 'bottom': cp2.y += offset; break;
            case 'left':   cp2.x -= offset; break;
            case 'right':  cp2.x += offset; break;
        }

        return `M ${p1.x} ${p1.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p2.x} ${p2.y}`;
    }

    /**
     * Navigates into the subgraph for editing.
     */
    enterSubGraph() {
        if (this.isEditing) return;
        
        this.isEditing = true;
        events.publish('subgraph:enter', {
            subgraphId: this.subgraphId,
            subgraphPath: this.subgraphPath,
            internalGraph: this.internalGraph,
            parentNodeId: this.id
        });
    }

    /**
     * Exits the subgraph and returns to parent graph.
     */
    exitSubGraph() {
        this.isEditing = false;
        events.publish('subgraph:exit', {
            subgraphId: this.subgraphId,
            parentNodeId: this.id
        });
    }

    /**
     * Updates the internal graph data and re-renders preview.
     * @param {object} graphData - The new graph data.
     */
    updateInternalGraph(graphData) {
        this.internalGraph = { ...this.internalGraph, ...graphData };
        
        // Re-render the preview after updating the data
        setTimeout(() => {
            this.renderPreview();
        }, 10);
        
        // Save the updated subgraph
        // this.saveSubGraph();
    }

    /**
     * Updates the preview when the internal graph changes.
     * This method can be called externally to force a preview update.
     */
    updatePreview() {
        if (this.previewSvg) {
            this.renderPreview();
        }
    }

    /**
     * Saves the subgraph data to its JSON file.
     */
    async saveSubGraph() {
        try {
            const subgraphData = {
                id: this.subgraphId,
                title: this.title,
                internalGraph: this.internalGraph,
                exposedAttributes: this.exposedAttributes,
                metadata: {
                    created: new Date().toISOString(),
                    lastModified: new Date().toISOString()
                }
            };

            // Use the file handler to save the subgraph
            events.publish('subgraph:save', {
                path: this.subgraphPath,
                data: subgraphData
            });
        } catch (error) {
            console.error('Failed to save subgraph:', error);
        }
    }

    /**
     * Loads the subgraph data from its JSON file.
     */
    async loadSubGraph() {
        try {
            events.publish('subgraph:load', {
                path: this.subgraphPath,
                callback: (data) => {
                    if (data) {
                        this.internalGraph = data.internalGraph || this.internalGraph;
                        this.exposedAttributes = data.exposedAttributes || this.exposedAttributes;
                        this.title = data.title || this.title;
                        this.renderPreview();
                        this.createExposedAttributeHandles();
                    }
                }
            });
        } catch (error) {
            console.error('Failed to load subgraph:', error);
        }
    }

    /**
     * Adds an exposed attribute that can be connected to the parent graph.
     * @param {object} attribute - The attribute to expose.
     * @param {string} attribute.id - Unique identifier for the attribute.
     * @param {string} attribute.name - Display name for the attribute.
     * @param {string} attribute.type - Data type of the attribute.
     * @param {string} attribute.direction - 'input' or 'output'.
     */
    addExposedAttribute(attribute) {
        this.exposedAttributes.push(attribute);
        this.createExposedAttributeHandles();
        this.saveSubGraph();
    }

    /**
     * Removes an exposed attribute.
     * @param {string} attributeId - The ID of the attribute to remove.
     */
    removeExposedAttribute(attributeId) {
        this.exposedAttributes = this.exposedAttributes.filter(attr => attr.id !== attributeId);
        this.createExposedAttributeHandles();
        this.saveSubGraph();
    }

    /**
     * Gets the value of an exposed attribute from the internal graph.
     * @param {string} attributeId - The ID of the attribute.
     * @returns {any} The attribute value.
     */
    getExposedAttributeValue(attributeId) {
        const attribute = this.exposedAttributes.find(attr => attr.id === attributeId);
        if (!attribute) return null;

        // This would need to be implemented based on how the internal graph
        // exposes its data. For now, return a placeholder.
        return `subgraph_${this.subgraphId}_${attributeId}`;
    }

    /**
     * Sets the value of an exposed attribute in the internal graph.
     * @param {string} attributeId - The ID of the attribute.
     * @param {any} value - The value to set.
     */
    setExposedAttributeValue(attributeId, value) {
        const attribute = this.exposedAttributes.find(attr => attr.id === attributeId);
        if (!attribute) return;

        // This would need to be implemented based on how the internal graph
        // accepts external data. For now, just log the action.
        console.log(`Setting ${attributeId} to ${value} in subgraph ${this.subgraphId}`);
    }

    /**
     * Forces a re-render of the preview.
     */
    forceRenderPreview() {
        if (this.previewSvg) {
            this.renderPreview();
        }
    }
} 