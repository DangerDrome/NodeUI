/**
 * @fileoverview Handles all canvas rendering operations including SVG manipulation, 
 * visual updates, physics simulation, and canvas transformations.
 */

// NodeUI Version
const NODEUI_VERSION = '2.0.0';

class Canvas {
    constructor(nodeUI) {
        this.nodeUI = nodeUI;
    }

    /**
     * Initializes the SVG/canvas layers and marker definitions.
     */
    initCanvas() {
        const container = this.nodeUI.container;
        container.innerHTML = '';

        // --- Pinned Node Layer (Topmost) ---
        this.nodeUI.pinnedNodeContainer = document.getElementById('pinned-node-container');

        // --- Grid Layer (Bottom) ---
        this.nodeUI.gridSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.nodeUI.gridSvg.classList.add('grid-canvas');

        const gridDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.id = 'grid-pattern';
        pattern.setAttribute('width', '20');
        pattern.setAttribute('height', '20');
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '1');
        circle.setAttribute('cy', '1');
        circle.setAttribute('r', '1');
        circle.classList.add('grid-dot');

        pattern.appendChild(circle);
        gridDefs.appendChild(pattern);
        this.nodeUI.gridSvg.appendChild(gridDefs);

        this.nodeUI.gridRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        this.nodeUI.gridRect.setAttribute('width', '100%');
        this.nodeUI.gridRect.setAttribute('height', '100%');
        this.nodeUI.gridRect.setAttribute('fill', 'url(#grid-pattern)');
        this.nodeUI.gridSvg.appendChild(this.nodeUI.gridRect);

        // --- Edge Layer (Middle) ---
        this.nodeUI.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.nodeUI.svg.classList.add('node-ui-canvas');

        this.createMarkers();
        
        this.nodeUI.canvasGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.nodeUI.svg.appendChild(this.nodeUI.canvasGroup);
        
        this.nodeUI.guideGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.nodeUI.guideGroup.classList.add('guide-group');
        this.nodeUI.canvasGroup.appendChild(this.nodeUI.guideGroup);

        // --- Node Layers (Top) ---
        this.nodeUI.groupContainer = document.createElement('div');
        this.nodeUI.groupContainer.classList.add('group-container');

        this.nodeUI.nodeContainer = document.createElement('div');
        this.nodeUI.nodeContainer.classList.add('node-container');

        this.nodeUI.selectionState.selectionBox = document.createElement('div');
        this.nodeUI.selectionState.selectionBox.classList.add('selection-box');
        this.nodeUI.nodeContainer.appendChild(this.nodeUI.selectionState.selectionBox);

        // --- Final Assembly ---
        container.appendChild(this.nodeUI.gridSvg);
        container.appendChild(this.nodeUI.groupContainer);
        container.appendChild(this.nodeUI.svg);
        container.appendChild(this.nodeUI.nodeContainer);

        // Add version watermark
        this.createVersionWatermark();
    }

    /**
     * Creates a version watermark in the bottom-right corner of the canvas.
     */
    createVersionWatermark() {
        const watermarkGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        watermarkGroup.classList.add('version-watermark');
        watermarkGroup.setAttribute('pointer-events', 'none');

        // Create background rectangle
        const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        background.setAttribute('width', '80');
        background.setAttribute('height', '24');
        background.setAttribute('rx', '4');
        background.setAttribute('fill', 'rgba(0, 0, 0, 0.1)');
        background.setAttribute('stroke', 'rgba(255, 255, 255, 0.2)');
        background.setAttribute('stroke-width', '1');

        // Create text element
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '40');
        text.setAttribute('y', '16');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-family', 'system-ui, -apple-system, sans-serif');
        text.setAttribute('font-size', '11px');
        text.setAttribute('font-weight', '500');
        text.setAttribute('fill', 'rgba(255, 255, 255, 0.7)');
        text.textContent = `NodeUI v${NODEUI_VERSION}`;

        watermarkGroup.appendChild(background);
        watermarkGroup.appendChild(text);
        
        // Position the watermark in the bottom-right corner
        this.updateWatermarkPosition(watermarkGroup);
        
        this.nodeUI.svg.appendChild(watermarkGroup);
        this.nodeUI.versionWatermark = watermarkGroup;
    }

    /**
     * Updates the position of the version watermark to stay in the bottom-right corner.
     * @param {SVGElement} watermarkGroup - The watermark group element.
     */
    updateWatermarkPosition(watermarkGroup) {
        const container = this.nodeUI.container;
        const rect = container.getBoundingClientRect();
        const padding = 28;
        
        // Position in bottom-right corner
        const x = rect.width - 90 - padding; // 90 = width + padding
        const y = rect.height - 34 - padding; // 34 = height + padding
        
        watermarkGroup.setAttribute('transform', `translate(${x}, ${y})`);
    }

    /**
     * Creates SVG markers for edge arrowheads for each color state.
     */
    createMarkers() {
        const edgeDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const colors = ['default', 'red', 'green', 'blue', 'yellow', 'purple'];
        const states = ['border', 'border-hover'];

        colors.forEach(color => {
            states.forEach(state => {
                const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
                marker.id = `arrowhead-${color}-${state}`;
                marker.setAttribute('viewBox', '0 0 10 10');
                marker.setAttribute('refX', '8');
                marker.setAttribute('refY', '5');
                marker.setAttribute('markerWidth', '6');
                marker.setAttribute('markerHeight', '6');
                marker.setAttribute('orient', 'auto-start-reverse');
                
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
                path.style.fill = `var(--color-node-${color}-${state})`;
                
                marker.appendChild(path);
                edgeDefs.appendChild(marker);
            });
        });

        this.nodeUI.svg.appendChild(edgeDefs);
    }

    /**
     * Updates the visual representation of an edge.
     * @param {string} edgeId - The ID of the edge to update.
     */
    updateEdge(edgeId) {
        const edge = this.nodeUI.edges.get(edgeId);
        if (!edge) return;

        const startPos = edge.startPosition;
        const endPos = edge.endPosition;

        if (!startPos || !endPos) return;

        // Calculate the path for the edge
        let pathD;
        if (edge.routingPoints && edge.routingPoints.length > 0) {
            pathD = this.calculateSpline([startPos, ...edge.routingPoints, endPos], edge.startHandleId, edge.endHandleId);
        } else {
            pathD = this.calculateCurve(startPos, endPos, edge.startHandleId, edge.endHandleId);
        }

        edge.element.setAttribute('d', pathD);
        edge.hitArea.setAttribute('d', pathD);

        // Update label position, content, and background
        if (edge.labelElement && edge.labelBackgroundElement) {
            edge.labelElement.textContent = edge.label;
            const path = edge.element;
            const len = path.getTotalLength();
            if (len > 0 && edge.label) {
                const midPoint = path.getPointAtLength(len / 2);
                edge.labelElement.setAttribute('x', midPoint.x);
                edge.labelElement.setAttribute('y', midPoint.y); // Offset a bit above the line

                edge.labelBackgroundElement.style.display = 'block';

                // Use a minimal timeout to allow the browser to compute the bounding box of the text
                setTimeout(() => {
                    try {
                        const labelBBox = edge.labelElement.getBBox();
                        const padding = 4;
                        edge.labelBackgroundElement.setAttribute('x', labelBBox.x - padding);
                        edge.labelBackgroundElement.setAttribute('y', labelBBox.y - padding);
                        edge.labelBackgroundElement.setAttribute('width', labelBBox.width + (padding * 2));
                        edge.labelBackgroundElement.setAttribute('height', labelBBox.height + (padding * 2));
                        edge.labelBackgroundElement.setAttribute('rx', 3); // rounded corners
                    } catch (e) {
                        // In case of an error (e.g., element not rendered), hide the background
                        edge.labelBackgroundElement.style.display = 'none';
                    }
                }, 0);

            } else {
                // Hide background if there's no label text
                edge.labelBackgroundElement.style.display = 'none';
            }
        }
    }

    /**
     * Calculates a spline path through multiple routing points.
     * @param {Array} points - Array of {x, y} points.
     * @param {string} startHandle - The orientation of the start handle.
     * @param {string} endHandle - The orientation of the end handle.
     * @returns {string} The SVG path `d` attribute string.
     */
    calculateSpline(points, startHandle, endHandle) {
        if (points.length < 2) return '';

        const maxPadding = parseInt(getComputedStyle(this.nodeUI.container).getPropertyValue('--edge-padding')) || 8;
        let path = '';

        // Start from the first point with padding
        const firstPoint = { ...points[0] };
        switch (startHandle) {
            case 'top':    firstPoint.y -= maxPadding; break;
            case 'bottom': firstPoint.y += maxPadding; break;
            case 'left':   firstPoint.x -= maxPadding; break;
            case 'right':  firstPoint.x += maxPadding; break;
        }
        path += `M ${firstPoint.x} ${firstPoint.y}`;

        // Add line segments through routing points
        for (let i = 1; i < points.length - 1; i++) {
            path += ` L ${points[i].x} ${points[i].y}`;
        }

        // End at the last point with padding
        const lastPoint = { ...points[points.length - 1] };
        switch (endHandle) {
            case 'top':    lastPoint.y -= maxPadding; break;
            case 'bottom': lastPoint.y += maxPadding; break;
            case 'left':   lastPoint.x -= maxPadding; break;
            case 'right':  lastPoint.x += maxPadding; break;
        }
        path += ` L ${lastPoint.x} ${lastPoint.y}`;

        return path;
    }

    /**
     * Calculates a curved path between two points with optional sag.
     * @param {{x:number, y:number}} startPos The start point.
     * @param {{x:number, y:number}} endPos The end point.
     * @param {string} startHandle The orientation of the start handle.
     * @param {string} endHandle The orientation of the end handle.
     * @returns {string} The SVG path `d` attribute string.
     */
    calculateCurve(startPos, endPos, startHandle, endHandle) {
        const edge = this.nodeUI.findEdgeByPositions(startPos, endPos);
        let sag = 0;

        if (this.nodeUI.edgeGravity > 0 && edge) {
            if (edge.physics.isSettled) {
                const dist = Math.hypot(endPos.x - startPos.x, endPos.y - startPos.y);
                sag = (dist / 150) * this.nodeUI.edgeGravity;
                edge.physics.sag = sag; // Set initial resting sag
            } else {
                sag = edge.physics.sag;
            }
        }
        
        return this._getCurvedPathD(startPos, endPos, startHandle, endHandle, sag);
    }

    /**
     * A pure function to calculate the SVG path data for a cubic Bézier curve,
     * with an optional vertical sag.
     * @param {{x:number, y:number}} startPos The start point.
     * @param {{x:number, y:number}} endPos The end point.
     * @param {string} startHandle The orientation of the start handle.
     * @param {string} endHandle The orientation of the end handle.
     * @param {number} [sag=0] - The amount of vertical sag to apply.
     * @returns {string} The SVG path `d` attribute string.
     */
    _getCurvedPathD(startPos, endPos, startHandle, endHandle, sag = 0) {
        // P0 and P3 are the start and end points of the edge, but we will draw from p1 to p2.
        const p0 = { ...startPos };
        const p3 = { ...endPos };

        // Determine the padded start/end points (p1/p2) for the S-curve.
        const maxPadding = parseInt(getComputedStyle(this.nodeUI.container).getPropertyValue('--edge-padding')) || 8;
        const distance = Math.hypot(p3.x - p0.x, p3.y - p0.y);
        const padding = Math.min(maxPadding, distance / 2.5);

        let p1 = { ...p0 }; // This will be the padded start point of the visible curve
        let p2 = { ...p3 }; // This will be the padded end point of the visible curve

        switch (startHandle) {
            case 'top':    p1.y -= padding; break;
            case 'bottom': p1.y += padding; break;
            case 'left':   p1.x -= padding; break;
            case 'right':  p1.x += padding; break;
        }

        switch (endHandle) {
            case 'top':    p2.y -= padding; break;
            case 'bottom': p2.y += padding; break;
            case 'left':   p2.x -= padding; break;
            case 'right':  p2.x += padding; break;
        }

        // Determine the control points for the Bezier curve
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

        // Apply tapered sag. The sag is reduced for vertical connections to
        // create a more natural exit angle from the node before hanging.
        if (sag > 0) {
            let sag1 = sag;
            let sag2 = sag;

            // Reduce sag effect on the control point if the handle is vertical.
            if (startHandle === 'top' || startHandle === 'bottom') {
                sag1 *= 0.25;
            }
            if (endHandle === 'top' || endHandle === 'bottom') {
                sag2 *= 0.25;
            }

            cp1.y += sag1;
            cp2.y += sag2;
        }

        // The path starts from the padded point (p1), not the handle center (p0).
        return `M ${p1.x} ${p1.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p2.x} ${p2.y}`;
    }

    /**
     * Applies the current pan and zoom transformation to the canvas elements.
     */
    updateCanvasTransform() {
        // Create the transform strings for CSS (for HTML nodes) and SVG (for edges)
        const transformCss = `translate(${this.nodeUI.panZoom.offsetX}px, ${this.nodeUI.panZoom.offsetY}px) scale(${this.nodeUI.panZoom.scale})`;
        const transformSvg = `translate(${this.nodeUI.panZoom.offsetX}, ${this.nodeUI.panZoom.offsetY}) scale(${this.nodeUI.panZoom.scale})`;

        // Apply transform to the HTML containers for nodes
        this.nodeUI.groupContainer.style.transform = transformCss;
        this.nodeUI.nodeContainer.style.transform = transformCss;
        
        // Apply the same transform to the SVG group for edges to keep them in sync
        this.nodeUI.canvasGroup.setAttribute('transform', transformSvg);
        
        // The grid pattern is transformed separately to give the illusion of an infinite grid.
        const pattern = this.nodeUI.gridSvg.getElementById('grid-pattern');
        if(pattern) {
            // We transform the pattern inside the SVG definition.
            const gridX = this.nodeUI.panZoom.offsetX;
            const gridY = this.nodeUI.panZoom.offsetY;
            pattern.setAttribute('patternTransform', `translate(${gridX} ${gridY}) scale(${this.nodeUI.panZoom.scale})`);
        }

        // Update watermark position to stay in viewport
        if (this.nodeUI.versionWatermark) {
            this.updateWatermarkPosition(this.nodeUI.versionWatermark);
        }

        // Force-update edges connected to pinned nodes so they follow the pan/zoom
        this.nodeUI.pinnedNodes.forEach(nodeId => {
            this.nodeUI.updateConnectedEdges(nodeId, false); // Don't pluck during simple pan/zoom
        });
    }

    /**
     * Animates the pan and zoom transformation to target values.
     * @param {number} targetScale - The target scale value.
     * @param {number} targetOffsetX - The target X offset.
     * @param {number} targetOffsetY - The target Y offset.
     * @param {number} [duration=300] - The animation duration in milliseconds.
     */
    animatePanZoom(targetScale, targetOffsetX, targetOffsetY, duration = 300) {
        const startScale = this.nodeUI.panZoom.scale;
        const startOffsetX = this.nodeUI.panZoom.offsetX;
        const startOffsetY = this.nodeUI.panZoom.offsetY;

        const scaleDiff = targetScale - startScale;
        const offsetXDiff = targetOffsetX - startOffsetX;
        const offsetYDiff = targetOffsetY - startOffsetY;

        let startTime = null;

        const animationStep = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);

            this.nodeUI.panZoom.scale = startScale + scaleDiff * ease;
            this.nodeUI.panZoom.offsetX = startOffsetX + offsetXDiff * ease;
            this.nodeUI.panZoom.offsetY = startOffsetY + offsetYDiff * ease;

            this.updateCanvasTransform();

            if (progress < 1) {
                requestAnimationFrame(animationStep);
            }
        };

        requestAnimationFrame(animationStep);
    }

    /**
     * Draws a snap guide line on the canvas.
     * @param {number} val - The position value (x for vertical, y for horizontal).
     * @param {string} orientation - 'v' for vertical, 'h' for horizontal.
     * @param {string} [color='var(--color-danger)'] - The color of the guide line.
     */
    drawGuide(val, orientation, color = 'var(--color-danger)') {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('snap-guide');
        line.style.stroke = color;
        if (orientation === 'v') {
            line.setAttribute('x1', val);
            line.setAttribute('y1', -10000);
            line.setAttribute('x2', val);
            line.setAttribute('y2', 10000);
        } else {
            line.setAttribute('x1', -10000);
            line.setAttribute('y1', val);
            line.setAttribute('x2', 10000);
            line.setAttribute('y2', val);
        }
        this.nodeUI.guideGroup.appendChild(line);
    }
    
    /**
     * Clears all snap guide lines from the canvas.
     */
    clearGuides() {
        while (this.nodeUI.guideGroup.firstChild) {
            this.nodeUI.guideGroup.removeChild(this.nodeUI.guideGroup.firstChild);
        }
    }

    /**
     * Finishes the selection process and identifies selected nodes.
     */
    endSelection() {
        this.nodeUI.selectionState.isSelecting = false;
        this.nodeUI.selectionState.selectionBox.style.display = 'none';

        const box = this.nodeUI.selectionState.selectionBox;
        const selectionRect = {
            left: parseFloat(box.style.left),
            top: parseFloat(box.style.top),
            right: parseFloat(box.style.left) + parseFloat(box.style.width),
            bottom: parseFloat(box.style.top) + parseFloat(box.style.height)
        };
        
        this.nodeUI.nodes.forEach(node => {
            if (this.isNodeInSelection(node, selectionRect)) {
                this.nodeUI.selectNode(node.id);
            }
        });

        this.nodeUI.edges.forEach(edge => {
            if (this.isEdgeInSelection(edge, selectionRect)) {
                this.nodeUI.selectEdge(edge.id);
            }
        });

        events.publish('selection:changed', {
            selectedNodeIds: Array.from(this.nodeUI.selectedNodes),
            selectedEdgeIds: Array.from(this.nodeUI.selectedEdges)
        });
    }

    /**
     * Checks if a node is within the selection rectangle.
     * @param {BaseNode} node The node to check.
     * @param {DOMRect} selectionRect The bounding rectangle of the selection box.
     * @returns {boolean} True if the node is inside the selection.
     */
    isNodeInSelection(node, selectionRect) {
        // Simple overlap check in world space
        return (
            node.x < selectionRect.right &&
            (node.x + node.width) > selectionRect.left &&
            node.y < selectionRect.bottom &&
            (node.y + node.height) > selectionRect.top
        );
    }

    /**
     * Checks if an edge intersects with the selection rectangle.
     * This is done by sampling points along the edge's path.
     * @param {BaseEdge} edge The edge to check.
     * @param {object} selectionRect The selection rectangle in world space.
     * @returns {boolean} True if the edge intersects the selection.
     */
    isEdgeInSelection(edge, selectionRect) {
        if (!edge.element) return false;

        const path = edge.element;
        const len = path.getTotalLength();
        if (len === 0) return false;

        // Sample points along the path
        for (let i = 0; i < len; i += 10) {
            const point = path.getPointAtLength(i);
            if (
                point.x > selectionRect.left &&
                point.x < selectionRect.right &&
                point.y > selectionRect.top &&
                point.y < selectionRect.bottom
            ) {
                return true;
            }
        }
        return false;
    }

    /**
     * Starts the physics simulation loop for edge sagging.
     */
    startPhysicsLoop() {
        const stiffness = 0.02;
        const damping = 0.90;

        const update = () => {
            let hasUnsettledEdges = false;

            this.nodeUI.edges.forEach(edge => {
                if (edge.physics.isSettled) return;

                // If gravity is turned off mid-simulation, settle the edge.
                if (this.nodeUI.edgeGravity === 0) {
                    edge.physics.isSettled = true;
                    edge.physics.sag = 0;
                    edge.physics.velocity = 0;
                    this.updateEdge(edge.id);
                    return;
                }

                hasUnsettledEdges = true;

                if (edge.routingPoints.length > 0) {
                    edge.physics.isSettled = true;
                    return;
                }
                
                const startPos = edge.startPosition;
                const endPos = edge.endPosition;
                const dist = Math.hypot(endPos.x - startPos.x, endPos.y - startPos.y);
                const restingSag = (dist / 150) * this.nodeUI.edgeGravity;

                const force = (restingSag - edge.physics.sag) * stiffness;
                
                edge.physics.velocity += force;
                edge.physics.velocity *= damping;
                edge.physics.sag += edge.physics.velocity;
                
                const pathData = this._getCurvedPathD(edge.startPosition, edge.endPosition, edge.startHandleId, edge.endHandleId, edge.physics.sag);
                if (edge.element) {
                    edge.element.setAttribute('d', pathData);
                    edge.hitArea.setAttribute('d', pathData);
                }

                if (Math.abs(edge.physics.velocity) < 0.01 && Math.abs(restingSag - edge.physics.sag) < 0.01) {
                    edge.physics.isSettled = true;
                    this.updateEdge(edge.id);
                }
            });

            if (hasUnsettledEdges) {
                requestAnimationFrame(update);
            }
        };

        events.subscribe('physics:start', () => {
            requestAnimationFrame(update);
        });
    }

    /**
     * "Plucks" an edge, giving its control point velocity and starting the physics simulation.
     * @param {BaseEdge} edge 
     */
    pluckEdge(edge) {
        if (!edge || this.nodeUI.edgeGravity === 0) return;
        
        // Give it a little push when plucked
        edge.physics.velocity += 2;
        
        if (edge.physics.isSettled) {
            edge.physics.isSettled = false;
            events.publish('physics:start');
        }
    }

    /**
     * Starts the edge cutting line drawing.
     * @param {MouseEvent} event 
     */
    startCuttingLine(event) {
        const mousePos = this.getMousePosition(event);
        this.nodeUI.edgeCutState.startX = mousePos.x;
        this.nodeUI.edgeCutState.startY = mousePos.y;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('cut-line');
        line.setAttribute('x1', mousePos.x);
        line.setAttribute('y1', mousePos.y);
        line.setAttribute('x2', mousePos.x);
        line.setAttribute('y2', mousePos.y);
        
        this.nodeUI.canvasGroup.appendChild(line);
        this.nodeUI.edgeCutState.cutLine = line;
    }

    /**
     * Updates the edge cutting line as the mouse moves.
     * @param {MouseEvent} event 
     */
    updateCuttingLine(event) {
        if (!this.nodeUI.edgeCutState.cutLine) return;
        const mousePos = this.getMousePosition(event);
        this.nodeUI.edgeCutState.cutLine.setAttribute('x2', mousePos.x);
        this.nodeUI.edgeCutState.cutLine.setAttribute('y2', mousePos.y);
    }

    /**
     * Ends the edge cutting line and performs the cut if requested.
     * @param {boolean} performCut - Whether to actually perform the cut operation.
     */
    endCuttingLine(performCut = true) {
        if (!this.nodeUI.edgeCutState.cutLine) return;
        
        if (performCut) {
            const x1 = parseFloat(this.nodeUI.edgeCutState.cutLine.getAttribute('x1'));
            const y1 = parseFloat(this.nodeUI.edgeCutState.cutLine.getAttribute('y1'));
            const x2 = parseFloat(this.nodeUI.edgeCutState.cutLine.getAttribute('x2'));
            const y2 = parseFloat(this.nodeUI.edgeCutState.cutLine.getAttribute('y2'));
    
            this.nodeUI.edges.forEach(edge => {
                const path = edge.element;
                const len = path.getTotalLength();
                for (let i = 0; i < len; i += 5) {
                    const p1 = path.getPointAtLength(i);
                    const p2 = path.getPointAtLength(i + 5 > len ? len : i + 5);
                    if (this.lineIntersect(x1, y1, x2, y2, p1.x, p1.y, p2.x, p2.y)) {
                        events.publish('edge:delete', edge.id);
                        break; 
                    }
                }
            });
        }

        this.nodeUI.edgeCutState.cutLine.remove();
        this.nodeUI.edgeCutState.cutLine = null;
    }

    /**
     * Checks if two line segments intersect.
     * @param {number} x1 - Start x of first line.
     * @param {number} y1 - Start y of first line.
     * @param {number} x2 - End x of first line.
     * @param {number} y2 - End y of first line.
     * @param {number} x3 - Start x of second line.
     * @param {number} y3 - Start y of second line.
     * @param {number} x4 - End x of second line.
     * @param {number} y4 - End y of second line.
     * @returns {boolean} True if the lines intersect.
     */
    lineIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
        const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (den === 0) {
            return false;
        }
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;

        return t > 0 && t < 1 && u > 0 && u < 1;
    }

    /**
     * Starts the routing cut line drawing.
     * @param {MouseEvent} event 
     */
    startRoutingCut(event) {
        const mousePos = this.getMousePosition(event);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('routing-cut-line');
        line.setAttribute('x1', mousePos.x);
        line.setAttribute('y1', mousePos.y);
        line.setAttribute('x2', mousePos.x);
        line.setAttribute('y2', mousePos.y);
        this.nodeUI.canvasGroup.appendChild(line);
        this.nodeUI.edgeHandler.getRoutingCutState().cutLine = line;
    }

    /**
     * Updates the routing cut line as the mouse moves.
     * @param {MouseEvent} event 
     */
    updateRoutingCut(event) {
        if (!this.nodeUI.edgeHandler.getRoutingCutState().cutLine) return;
        const mousePos = this.getMousePosition(event);
        this.nodeUI.edgeHandler.getRoutingCutState().cutLine.setAttribute('x2', mousePos.x);
        this.nodeUI.edgeHandler.getRoutingCutState().cutLine.setAttribute('y2', mousePos.y);
    }

    /**
     * Ends the routing cut line and creates a routing node at the intersection.
     */
    endRoutingCut() {
        if (!this.nodeUI.edgeHandler.getRoutingCutState().cutLine) return;

        const line = this.nodeUI.edgeHandler.getRoutingCutState().cutLine;
        const p1 = { x: parseFloat(line.getAttribute('x1')), y: parseFloat(line.getAttribute('y1')) };
        const p2 = { x: parseFloat(line.getAttribute('x2')), y: parseFloat(line.getAttribute('y2')) };
        let hasCut = false;

        this.nodeUI.edges.forEach(edge => {
            if (hasCut) return; // Only cut the first intersected edge

            const path = edge.element;
            const len = path.getTotalLength();
            for (let i = 0; i < len; i += 5) {
                const point1 = path.getPointAtLength(i);
                const point2 = path.getPointAtLength(i + 5 > len ? len : i + 5);
                const intersection = this.getLineIntersection(p1, p2, point1, point2);
                if (intersection) {
                    const routingNode = new RoutingNode({ x: intersection.x, y: intersection.y });
                    this.nodeUI.addNode(routingNode);
                    
                    // Create two new edges
                    events.publish('edge:create', { startNodeId: edge.startNodeId, startHandleId: edge.startHandleId, endNodeId: routingNode.id, endHandleId: 'left' });
                    events.publish('edge:create', { startNodeId: routingNode.id, startHandleId: 'right', endNodeId: edge.endNodeId, endHandleId: edge.endHandleId });
                    
                    // Delete the original edge
                    events.publish('edge:delete', edge.id);
                    
                    hasCut = true;
                    break;
                }
            }
        });

        line.remove();
        this.nodeUI.edgeHandler.getRoutingCutState().cutLine = null;
    }

    /**
     * Calculates the intersection point of two line segments.
     * @param {{x: number, y: number}} p0 - Start point of first line.
     * @param {{x: number, y: number}} p1 - End point of first line.
     * @param {{x: number, y: number}} p2 - Start point of second line.
     * @param {{x: number, y: number}} p3 - End point of second line.
     * @returns {{x: number, y: number}|null} The intersection point or null if no intersection.
     */
    getLineIntersection(p0, p1, p2, p3) {
        const s1_x = p1.x - p0.x;
        const s1_y = p1.y - p0.y;
        const s2_x = p3.x - p2.x;
        const s2_y = p3.y - p2.y;
    
        const s = (-s1_y * (p0.x - p2.x) + s1_x * (p0.y - p2.y)) / (-s2_x * s1_y + s1_x * s2_y);
        const t = ( s2_x * (p0.y - p2.y) - s2_y * (p0.x - p2.x)) / (-s2_x * s1_y + s1_x * s2_y);
    
        if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
            // Collision detected
            return {
                x: p0.x + (t * s1_x),
                y: p0.y + (t * s1_y)
            };
        }
        return null; // No collision
    }

    /**
     * Gets the absolute position of a node's handle.
     * The position is the center of the visible handle, offset from the node's border.
     * @param {string} nodeId - The ID of the node.
     * @param {string} handlePosition - The position of the handle ('top', 'right', 'bottom', 'left').
     * @returns {{x: number, y: number}} The coordinates in world space.
     */
    getHandlePosition(nodeId, handlePosition) {
        const node = this.nodeUI.nodes.get(nodeId);
        if (!node) return { x: 0, y: 0 };

        let x = node.x;
        let y = node.y;

        const offsetMult = parseFloat(getComputedStyle(this.nodeUI.container).getPropertyValue('--handle-offset-mult')) || 1;
        const baseOffset = 10;
        const offset = baseOffset * offsetMult;
        
        if (node.isPinned) {
             // For pinned nodes, calculations are in screen space first
             let screenX = node.x;
             let screenY = node.y;

             switch (handlePosition) {
                case 'top':    screenX += node.width / 2; screenY -= offset; break;
                case 'right':  screenX += node.width + offset; screenY += node.height / 2; break;
                case 'bottom': screenX += node.width / 2; screenY += node.height + offset; break;
                case 'left':   screenX -= offset; screenY += node.height / 2; break;
            }

            // Then convert final screen coordinates to world coordinates for the SVG
            const worldX = (screenX - this.nodeUI.panZoom.offsetX) / this.nodeUI.panZoom.scale;
            const worldY = (screenY - this.nodeUI.panZoom.offsetY) / this.nodeUI.panZoom.scale;
            return { x: worldX, y: worldY };

        } else {
            // For regular nodes, all calculations are in world space
            switch (handlePosition) {
                case 'top':    x += node.width / 2; y -= offset; break;
                case 'right':  x += node.width + offset; y += node.height / 2; break;
                case 'bottom': x += node.width / 2; y += node.height + offset; break;
                case 'left':   x -= offset; y += node.height / 2; break;
            }
            return { x, y };
        }
    }

    /**
     * Gets the mouse position relative to the SVG canvas.
     * @param {MouseEvent} event 
     * @returns {{x: number, y: number}}
     */
    getMousePosition(event) {
        const svgRect = this.nodeUI.svg.getBoundingClientRect();
        const x = (event.clientX - svgRect.left - this.nodeUI.panZoom.offsetX) / this.nodeUI.panZoom.scale;
        const y = (event.clientY - svgRect.top - this.nodeUI.panZoom.offsetY) / this.nodeUI.panZoom.scale;
        return { x, y };
    }

    /**
     * Calculates the shortest distance from a point to a line segment.
     * @param {{x,y}} p The point.
     * @param {{x,y}} v The start of the line segment.
     * @param {{x,y}} w The end of the line segment.
     * @returns {number} The distance.
     */
    distanceToSegment(p, v, w) {
        const l2 = (v.x - w.x)**2 + (v.y - w.y)**2;
        if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        const closestX = v.x + t * (w.x - v.x);
        const closestY = v.y + t * (w.y - v.y);
        return Math.hypot(p.x - closestX, p.y - closestY);
    }
}

// Attach to window for global access
window.Canvas = Canvas; 