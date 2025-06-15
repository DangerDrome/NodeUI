/**
 * @file This file contains the main logic for a node-based graph editor.
 * @author [Your Name]
 * @version 1.0.0
 */

document.addEventListener('DOMContentLoaded', () => {
    // =================================================================================================
    // Settings
    // =================================================================================================

    /**
     * @typedef {object} Settings
     * @property {number} gridSize - The size of the grid in pixels.
     * @property {number} minZoom - The minimum zoom level.
     * @property {number} maxZoom - The maximum zoom level.
     * @property {number} connectionZoneRadius - The radius of the connection handles.
     * @property {number} defaultNodeWidth - The default width of a new node.
     * @property {number} defaultNodeHeight - The default height of a new node.
     * @property {number} defaultGroupWidth - The default width of a new group.
     * @property {number} defaultGroupHeight - The default height of a new group.
     * @property {number} arrowSize - The size of the arrowhead.
     * @property {number} arrowWidth - The width of the arrowhead.
     * @property {number} arrowOffset - The offset of the arrowhead from the edge.
     * @property {number} arrowGap - The gap between the arrowhead and the node.
     * @property {number} bezierStraightLineDistance - The length of the straight segment at the start/end of a Bezier edge.
     */

    /** @type {Settings} */
    const settings = {
        gridSize: 20,
        minZoom: 0.01,
        maxZoom: 3,
        connectionZoneRadius: 15,
        defaultNodeWidth: 300,
        defaultNodeHeight: 200,
        defaultGroupWidth: 600,
        defaultGroupHeight: 500,
        arrowSize: 20,
        arrowWidth: 20,
        arrowOffset: 0,
        arrowGap: 5,
        bezierStraightLineDistance: 20,
    };

    // =================================================================================================
    // DOM Elements
    // =================================================================================================

    const dom = {
        svg: document.getElementById('graph-svg'),
        addNodeBtn: document.getElementById('add-node-btn'),
        addGroupBtn: document.getElementById('add-group-btn'),
        zoomInBtn: document.getElementById('zoom-in-btn'),
        zoomOutBtn: document.getElementById('zoom-out-btn'),
        themeToggleBtn: document.getElementById('theme-toggle-btn'),
        edgeTypeSelect: document.getElementById('edge-type-select'),
        graphContainer: document.getElementById('graph-container'),
        selectionBox: document.getElementById('selection-box'),
        contextMenu: {
            menu: document.getElementById('context-menu'),
            addNode: document.getElementById('add-node-option'),
            addGroup: document.getElementById('add-group-option-context'),
            rename: document.getElementById('rename-option'),
            deleteNode: document.getElementById('delete-node-option'),
            disableNode: document.getElementById('disable-node-option'),
            properties: document.getElementById('properties-option'),
            deleteEdge: document.getElementById('delete-edge-option'),
            addRoutingPoint: document.getElementById('add-routing-point-option'),
        },
        infoBar: document.getElementById('info-bar'),
        propertiesPanel: {
            panel: document.getElementById('properties-panel'),
            nodeNameInput: document.getElementById('node-name'),
            nodeColorInput: document.getElementById('node-color'),
            closeBtn: document.getElementById('close-properties-btn'),
        },
    };

    // =================================================================================================
    // State
    // =================================================================================================

    /**
     * @typedef {object} State
     * @property {Array<object>} nodes - The array of nodes in the graph.
     * @property {Array<object>} edges - The array of edges in the graph.
     * @property {number} nodeIdCounter - The counter for generating unique node IDs.
     * @property {object|null} contextNode - The node currently under the context menu.
     * @property {number|null} contextEdge - The index of the edge currently under the context menu.
     * @property {Array<number>} selectedNodeIds - The IDs of the selected nodes.
     * @property {Array<number>} selectedEdgeIndexes - The indexes of the selected edges.
     * @property {object} viewbox - The viewbox of the SVG canvas.
     * @property {object} interaction - The current interaction state (dragging, resizing, etc.).
     * @property {object} dragStart - The starting position of a drag operation.
     * @property {Array<object>} draggedNodes - The nodes being dragged.
     * @property {object|null} draggedRoutingPoint - The routing point being dragged.
     * @property {string|null} resizeDirection - The direction of a resize operation.
     * @property {object|null} originalNode - The original state of a node before resizing.
     * @property {object|null} connectionStartSocket - The starting socket of a new connection.
     * @property {SVGElement|null} tempLine - The temporary line shown when creating a new connection.
     * @property {SVGElement|null} cutLine - The line shown when cutting edges.
     * @property {object|null} connectionEndPosition - The coordinates when a connection is released onto an empty area.
     * @property {object|null} clipboard - The clipboard content.
     * @property {object} mousePosition - The current mouse position in SVG coordinates.
     * @property {Array<object>} undoStack - The stack for storing undo actions.
     * @property {Array<object>} redoStack - The stack for storing redo actions.
     */

    /** @type {State} */
    let state = {
        nodes: [],
        edges: [],
        nodeIdCounter: 0,
        contextNode: null,
        contextEdge: null,
        selectedNodeIds: [],
        selectedEdgeIndexes: [],
        viewbox: { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight },
        interaction: {
            dragging: false,
            resizing: false,
            connecting: false,
            panning: false,
            selecting: false,
            draggingRoutingPoint: false,
            cutting: false,
            mouseDown: false,
        },
        dragStart: { x: 0, y: 0 },
        draggedNodes: [],
        draggedRoutingPoint: null,
        resizeDirection: null,
        originalNode: null,
        connectionStartSocket: null,
        tempLine: null,
        cutLine: null,
        connectionEndPosition: null,
        clipboard: null,
        mousePosition: { x: 0, y: 0 },
        undoStack: [],
        redoStack: [],
    };

    // =================================================================================================
    // Utility Functions
    // =================================================================================================

    /**
     * Logs a message to the info bar.
     * @param {string} message - The message to log.
     */
    function log(message) {
        dom.infoBar.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    }

    /**
     * Calculates the orientation of the triplet (p, q, r).
     * @returns {number} 0 if colinear, 1 if clockwise, 2 if counterclockwise.
     */
    function getOrientation(p, q, r) {
        const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
        if (val === 0) return 0;
        return (val > 0) ? 1 : 2;
    }

    /**
     * Checks if point q lies on segment pr.
     */
    function onSegment(p, q, r) {
        return (q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
                q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y));
    }

    /**
     * Checks if line segment 'p1q1' and 'p2q2' intersect.
     */
    function lineIntersects(p1, q1, p2, q2) {
        const o1 = getOrientation(p1, q1, p2);
        const o2 = getOrientation(p1, q1, q2);
        const o3 = getOrientation(p2, q2, p1);
        const o4 = getOrientation(p2, q2, q1);

        if (o1 !== o2 && o3 !== o4) {
            return true;
        }

        if (o1 === 0 && onSegment(p1, p2, q1)) return true;
        if (o2 === 0 && onSegment(p1, q2, q1)) return true;
        if (o3 === 0 && onSegment(p2, p1, q2)) return true;
        if (o4 === 0 && onSegment(p2, q1, q2)) return true;

        return false;
    }

    /**
     * Saves the current graph state for undo functionality.
     * @param {string} actionName - A description of the action being performed.
     */
    function saveStateForUndo(actionName) {
        // Deep clone the current state of nodes and edges
        const currentState = {
            nodes: JSON.parse(JSON.stringify(state.nodes)),
            edges: JSON.parse(JSON.stringify(state.edges)),
            nodeIdCounter: state.nodeIdCounter,
            actionName: actionName
        };
        state.undoStack.push(currentState);
        // Once a new action is taken, the redo stack should be cleared
        state.redoStack = [];
    }

    /**
     * Reverts the graph to the previous state in the undo stack.
     */
    function undo() {
        if (state.undoStack.length === 0) {
            log('Nothing to undo.');
            return;
        }

        const currentState = {
            nodes: JSON.parse(JSON.stringify(state.nodes)),
            edges: JSON.parse(JSON.stringify(state.edges)),
            nodeIdCounter: state.nodeIdCounter,
            actionName: state.undoStack[state.undoStack.length - 1].actionName
        };
        state.redoStack.push(currentState);
        
        const previousState = state.undoStack.pop();
        state.nodes = previousState.nodes;
        state.edges = previousState.edges;
        state.nodeIdCounter = previousState.nodeIdCounter;

        state.selectedNodeIds = [];
        state.selectedEdgeIndexes = [];

        log(`Undid: ${previousState.actionName}`);
        render();
    }

    /**
     * Re-applies a previously undone action from the redo stack.
     */
    function redo() {
        if (state.redoStack.length === 0) {
            log('Nothing to redo.');
            return;
        }

        const currentState = {
            nodes: JSON.parse(JSON.stringify(state.nodes)),
            edges: JSON.parse(JSON.stringify(state.edges)),
            nodeIdCounter: state.nodeIdCounter,
            actionName: state.redoStack[state.redoStack.length - 1].actionName
        };
        state.undoStack.push(currentState);

        const nextState = state.redoStack.pop();
        state.nodes = nextState.nodes;
        state.edges = nextState.edges;
        state.nodeIdCounter = nextState.nodeIdCounter;

        state.selectedNodeIds = [];
        state.selectedEdgeIndexes = [];
        
        log(`Redid: ${nextState.actionName}`);
        render();
    }

    // =================================================================================================
    // Core Functions
    // =================================================================================================

    /**
     * Adds a new node or group to the graph.
     * @param {number} x - The x-coordinate.
     * @param {number} y - The y-coordinate.
     * @param {string} [type='default'] - The type of node ('default' or 'group').
     */
    function addNode(x, y, type = 'default') {
        saveStateForUndo(`Add ${type}`);
        const snappedX = Math.round(x / settings.gridSize) * settings.gridSize;
        const snappedY = Math.round(y / settings.gridSize) * settings.gridSize;
        const newNode = {
            id: state.nodeIdCounter++,
            x: snappedX,
            y: snappedY,
            width: type === 'group' ? settings.defaultGroupWidth : settings.defaultNodeWidth,
            height: type === 'group' ? settings.defaultGroupHeight : settings.defaultNodeHeight,
            disabled: false,
            title: type === 'group' ? `Group ${state.nodeIdCounter}` : `Node ${state.nodeIdCounter}`,
            icon: type === 'group' ? 'box-select' : 'box',
            type: type,
            children: type === 'group' ? [] : undefined,
            parent: undefined,
            color: getComputedStyle(document.body).getPropertyValue('--node-fill-color'),
            sockets: [
                { id: 0, x: snappedX, y: snappedY - (type === 'group' ? settings.defaultGroupHeight / 2 + 10 : settings.defaultNodeHeight / 2 + 10) },
                { id: 1, x: snappedX, y: snappedY + (type === 'group' ? settings.defaultGroupHeight / 2 + 10 : settings.defaultNodeHeight / 2 + 10) },
                { id: 2, x: snappedX - (type === 'group' ? settings.defaultGroupWidth / 2 + 10 : settings.defaultNodeWidth / 2 + 10), y: snappedY },
                { id: 3, x: snappedX + (type === 'group' ? settings.defaultGroupWidth / 2 + 10 : settings.defaultNodeWidth / 2 + 10), y: snappedY },
            ]
        };
        state.nodes.push(newNode);
        log(`Added ${type} ${newNode.id}`);
        render();
        return newNode;
    }

    /**
     * Removes a node and its connected edges from the graph.
     * @param {object} nodeToRemove - The node object to remove.
     */
    function removeNode(nodeToRemove) {
        saveStateForUndo('Remove Node');
        state.nodes = state.nodes.filter(node => node.id !== nodeToRemove.id);
        state.edges = state.edges.filter(edge => edge.source.nodeId !== nodeToRemove.id && edge.target.nodeId !== nodeToRemove.id);
        log(`Removed node ${nodeToRemove.id}`);
        render();
    }

    /**
     * Copies selected nodes and their edges to the clipboard.
     */
    function copySelectedNodes() {
        if (state.selectedNodeIds.length === 0) {
            state.clipboard = null;
            return;
        }

        const selectedNodes = state.nodes.filter(node => state.selectedNodeIds.includes(node.id));
        const copiedNodes = JSON.parse(JSON.stringify(selectedNodes));
        const copiedNodeIds = copiedNodes.map(n => n.id);
        const containedEdges = state.edges.filter(edge =>
            copiedNodeIds.includes(edge.source.nodeId) &&
            copiedNodeIds.includes(edge.target.nodeId)
        );
        const copiedEdges = JSON.parse(JSON.stringify(containedEdges));

        const basePosition = copiedNodes.reduce((acc, node) => ({
            x: Math.min(acc.x, node.x),
            y: Math.min(acc.y, node.y)
        }), { x: Infinity, y: Infinity });

        state.clipboard = {
            nodes: copiedNodes,
            edges: copiedEdges,
            basePosition: basePosition
        };
        
        log(`Copied ${copiedNodes.length} nodes and ${copiedEdges.length} edges.`);
    }

    /**
     * Pastes nodes and edges from the clipboard onto the canvas.
     */
    function pasteNodes() {
        if (!state.clipboard) return;

        const { nodes: copiedNodes, edges: copiedEdges, basePosition } = state.clipboard;
        const pastePosition = {
            x: Math.round(state.mousePosition.x / settings.gridSize) * settings.gridSize,
            y: Math.round(state.mousePosition.y / settings.gridSize) * settings.gridSize,
        };

        const idMap = new Map();
        const newNodes = [];
        const newSelectedIds = [];

        copiedNodes.forEach(copiedNode => {
            const newNode = JSON.parse(JSON.stringify(copiedNode));
            const oldId = newNode.id;
            
            newNode.id = state.nodeIdCounter++;
            idMap.set(oldId, newNode.id);

            const offsetX = copiedNode.x - basePosition.x;
            const offsetY = copiedNode.y - basePosition.y;

            newNode.x = pastePosition.x + offsetX;
            newNode.y = pastePosition.y + offsetY;
            
            const socketYOffset = newNode.type === 'group' ? newNode.height / 2 + 10 : newNode.height / 2 + 10;
            const socketXOffset = newNode.type === 'group' ? newNode.width / 2 + 10 : newNode.width / 2 + 10;
            newNode.sockets[0] = { id: 0, x: newNode.x, y: newNode.y - socketYOffset };
            newNode.sockets[1] = { id: 1, x: newNode.x, y: newNode.y + socketYOffset };
            newNode.sockets[2] = { id: 2, x: newNode.x - socketXOffset, y: newNode.y };
            newNode.sockets[3] = { id: 3, x: newNode.x + socketXOffset, y: newNode.y };

            newNodes.push(newNode);
            newSelectedIds.push(newNode.id);
        });

        const newEdges = copiedEdges.map(copiedEdge => {
            const newEdge = JSON.parse(JSON.stringify(copiedEdge));
            newEdge.source.nodeId = idMap.get(newEdge.source.nodeId);
            newEdge.target.nodeId = idMap.get(newEdge.target.nodeId);
            return newEdge;
        });

        state.selectedNodeIds = newSelectedIds;
        state.selectedEdgeIndexes = [];

        state.nodes.push(...newNodes);
        state.edges.push(...newEdges);

        log(`Pasted ${newNodes.length} nodes and ${newEdges.length} edges.`);
        render();
    }

    /**
     * Creates a new edge between two sockets.
     * @param {object} sourceSocket - The source socket.
     * @param {object} targetSocket - The target socket.
     */
    function createEdge(sourceSocket, targetSocket) {
        if (sourceSocket.nodeId === targetSocket.nodeId) return;
        const existingEdge = state.edges.find(edge =>
            (edge.source.nodeId === sourceSocket.nodeId && edge.source.socketId === sourceSocket.socketId &&
             edge.target.nodeId === targetSocket.nodeId && edge.target.socketId === targetSocket.socketId) ||
            (edge.source.nodeId === targetSocket.nodeId && edge.source.socketId === targetSocket.socketId &&
             edge.target.nodeId === sourceSocket.nodeId && edge.target.socketId === sourceSocket.socketId)
        );
        if (!existingEdge) {
            saveStateForUndo('Create Edge');
            state.edges.push({ source: sourceSocket, target: targetSocket, type: dom.edgeTypeSelect.value, points: [] });
            log(`Created edge between node ${sourceSocket.nodeId} and node ${targetSocket.nodeId}`);
        }
    }

    /**
     * Renders the entire graph, including nodes, edges, and grid.
     */
    function render() {
        dom.svg.innerHTML = '';
        dom.svg.setAttribute('viewBox', `${state.viewbox.x} ${state.viewbox.y} ${state.viewbox.w} ${state.viewbox.h}`);

        // Defs for arrowhead and grid pattern
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', settings.arrowSize);
        marker.setAttribute('markerHeight', settings.arrowWidth);
        marker.setAttribute('refX', settings.arrowSize + settings.arrowOffset);
        marker.setAttribute('refY', settings.arrowWidth / 2);
        marker.setAttribute('orient', 'auto');
        marker.setAttribute('markerUnits', 'userSpaceOnUse');
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', `0 0, ${settings.arrowSize} ${settings.arrowWidth / 2}, 0 ${settings.arrowWidth}`);
        polygon.style.fill = 'var(--arrow-color)';
        marker.appendChild(polygon);
        defs.appendChild(marker);

        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.setAttribute('id', 'grid');
        pattern.setAttribute('width', settings.gridSize);
        pattern.setAttribute('height', settings.gridSize);
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${settings.gridSize/2 - 2} ${settings.gridSize/2} L ${settings.gridSize/2 + 2} ${settings.gridSize/2} M ${settings.gridSize/2} ${settings.gridSize/2 - 2} L ${settings.gridSize/2} ${settings.gridSize/2 + 2}`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'var(--grid-stroke-color)');
        path.setAttribute('stroke-width', '1');
        pattern.appendChild(path);
        defs.appendChild(pattern);
        dom.svg.appendChild(defs);

        // Grid background
        const gridRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        gridRect.setAttribute('x', state.viewbox.x);
        gridRect.setAttribute('y', state.viewbox.y);
        gridRect.setAttribute('width', state.viewbox.w);
        gridRect.setAttribute('height', state.viewbox.h);
        gridRect.setAttribute('fill', 'url(#grid)');
        dom.svg.appendChild(gridRect);

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        dom.svg.appendChild(g);

        // Render edges
        state.edges.forEach((edge, index) => {
            const sourceNode = state.nodes.find(node => node.id === edge.source.nodeId);
            const targetNode = state.nodes.find(node => node.id === edge.target.nodeId);
            if (sourceNode && targetNode) {
                const sourceSocket = sourceNode.sockets[edge.source.socketId];
                const originalTargetSocket = targetNode.sockets[edge.target.socketId];
                let gappedTargetSocket = originalTargetSocket;

                // Calculate the gap before the arrowhead
                const lastPoint = edge.points.length > 0 ? edge.points[edge.points.length - 1] : sourceSocket;
                if (edge.type === 'bezier') {
                    const handleOffset = 75;
                    const getControlPoint = (point, socketId) => {
                        if (socketId === 0) return { x: point.x, y: point.y - handleOffset };
                        if (socketId === 1) return { x: point.x, y: point.y + handleOffset };
                        if (socketId === 2) return { x: point.x - handleOffset, y: point.y };
                        if (socketId === 3) return { x: point.x + handleOffset, y: point.y };
                        return { x: point.x + handleOffset, y: point.y };
                    };
                    const p2 = getControlPoint(originalTargetSocket, edge.target.socketId);
                    const tangentX = originalTargetSocket.x - p2.x;
                    const tangentY = originalTargetSocket.y - p2.y;
                    const tangentLength = Math.sqrt(tangentX * tangentX + tangentY * tangentY);

                    if (tangentLength > 0 && tangentLength > settings.arrowGap) {
                        const unitTangentX = tangentX / tangentLength;
                        const unitTangentY = tangentY / tangentLength;
                        gappedTargetSocket = {
                            x: originalTargetSocket.x - unitTangentX * settings.arrowGap,
                            y: originalTargetSocket.y - unitTangentY * settings.arrowGap
                        };
                    }
                } else { // For 'straight' and 'step' edges
                    const dx = originalTargetSocket.x - lastPoint.x;
                    const dy = originalTargetSocket.y - lastPoint.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance > settings.arrowGap) {
                        const ratio = (distance - settings.arrowGap) / distance;
                        gappedTargetSocket = {
                            x: lastPoint.x + dx * ratio,
                            y: lastPoint.y + dy * ratio
                        };
                    }
                }

                let d = `M ${sourceSocket.x} ${sourceSocket.y}`;

                if (edge.type === 'step') {
                    let lastPointStep = sourceSocket;
                    edge.points.forEach(point => {
                        const midX = lastPointStep.x + (point.x - lastPointStep.x) / 2;
                        d += ` L ${midX} ${lastPointStep.y} L ${midX} ${point.y}`;
                        lastPointStep = point;
                    });
                    const midX = lastPointStep.x + (originalTargetSocket.x - lastPointStep.x) / 2;
                    d += ` L ${midX} ${lastPointStep.y} L ${midX} ${originalTargetSocket.y} L ${gappedTargetSocket.x} ${gappedTargetSocket.y}`;
                } else if (edge.type === 'bezier') {
                    const handleOffset = 75;

                    const getStraightPoint = (point, socketId, distance) => {
                        if (socketId === 0) return { x: point.x, y: point.y - distance };
                        if (socketId === 1) return { x: point.x, y: point.y + distance };
                        if (socketId === 2) return { x: point.x - distance, y: point.y };
                        if (socketId === 3) return { x: point.x + distance, y: point.y };
                        return { x: point.x, y: point.y };
                    };
                    
                    const straightSourcePoint = getStraightPoint(sourceSocket, edge.source.socketId, settings.bezierStraightLineDistance);
                    const straightTargetPoint = getStraightPoint(gappedTargetSocket, edge.target.socketId, settings.bezierStraightLineDistance);
                    
                    d += ` L ${straightSourcePoint.x} ${straightSourcePoint.y}`;

                    let lastBezierPoint = straightSourcePoint;

                    const getControlPoint = (point, socketId) => {
                        if (socketId === 0) return { x: point.x, y: point.y - handleOffset };
                        if (socketId === 1) return { x: point.x, y: point.y + handleOffset };
                        if (socketId === 2) return { x: point.x - handleOffset, y: point.y };
                        if (socketId === 3) return { x: point.x + handleOffset, y: point.y };
                        return { x: point.x + handleOffset, y: point.y };
                    };

                    let cp1 = getControlPoint(straightSourcePoint, edge.source.socketId);

                    edge.points.forEach(point => {
                        const cp2x = point.x - (point.x - lastBezierPoint.x) * 0.5;
                        const cp2y = point.y - (point.y - lastBezierPoint.y) * 0.5;
                        d += ` C ${cp1.x} ${cp1.y}, ${cp2x} ${cp2y}, ${point.x} ${point.y}`;
                        
                        cp1 = { 
                            x: point.x + (point.x - lastBezierPoint.x) * 0.5, 
                            y: point.y + (point.y - lastBezierPoint.y) * 0.5
                        };
                        lastBezierPoint = point;
                    });
                    
                    const cp2 = getControlPoint(straightTargetPoint, edge.target.socketId);
                    d += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${straightTargetPoint.x} ${straightTargetPoint.y}`;
                    d += ` L ${gappedTargetSocket.x} ${gappedTargetSocket.y}`;
                } else { // 'straight' edges
                    edge.points.forEach(point => {
                        d += ` L ${point.x} ${point.y}`;
                    });
                    d += ` L ${gappedTargetSocket.x} ${gappedTargetSocket.y}`;
                }

                // Hitbox for easier selection
                const edgeHitbox = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                edgeHitbox.setAttribute('d', d);
                edgeHitbox.setAttribute('class', 'edge-hitbox edge'); // 'edge' class for event listeners
                edgeHitbox.dataset.index = index;
                g.appendChild(edgeHitbox);

                const edgeElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                edgeElement.setAttribute('d', d);
                edgeElement.setAttribute('fill', 'none');
                edgeElement.setAttribute('class', 'edge');
                if (state.selectedEdgeIndexes.includes(index)) {
                    edgeElement.classList.add('selected');
                }
                if (state.interaction.cutting) {
                    edgeElement.classList.add('cuttable');
                }
                edgeElement.dataset.index = index;
                edgeElement.setAttribute('marker-end', 'url(#arrowhead)');
                g.appendChild(edgeElement);

                // Render routing handles
                edge.points.forEach((point, pointIndex) => {
                    const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    handle.setAttribute('cx', point.x);
                    handle.setAttribute('cy', point.y);
                    handle.setAttribute('r', 5);
                    handle.setAttribute('class', 'routing-handle');
                    handle.dataset.edgeIndex = index;
                    handle.dataset.pointIndex = pointIndex;
                    g.appendChild(handle);
                });
            }
        });

        if (state.tempLine) {
            g.appendChild(state.tempLine);
        }

        if (state.cutLine) {
            g.appendChild(state.cutLine);
        }

        // Sort nodes to render groups first, then selected nodes on top
        const sortedNodes = [...state.nodes].sort((a, b) => {
            if (a.type === 'group' && b.type !== 'group') return -1;
            if (a.type !== 'group' && b.type === 'group') return 1;
            if (state.selectedNodeIds.includes(a.id)) return 1;
            if (state.selectedNodeIds.includes(b.id)) return -1;
            return 0;
        });

        // Render nodes
        sortedNodes.forEach(node => {
            const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            nodeGroup.setAttribute('class', 'node-group');
            g.appendChild(nodeGroup);

            // Hover rectangle for easier selection
            const hoverRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            hoverRect.setAttribute('x', node.x - node.width / 2 - 10);
            hoverRect.setAttribute('y', node.y - node.height / 2 - 10);
            hoverRect.setAttribute('width', node.width + 20);
            hoverRect.setAttribute('height', node.height + 20);
            hoverRect.setAttribute('fill', 'transparent');
            nodeGroup.appendChild(hoverRect);

            // Main node rectangle
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', node.x - node.width / 2);
            rect.setAttribute('y', node.y - node.height / 2);
            rect.setAttribute('width', node.width);
            rect.setAttribute('height', node.height);
            rect.setAttribute('rx', 5);
            rect.setAttribute('ry', 5);
            rect.setAttribute('class', 'node');
            if (node.type === 'group') {
                rect.classList.add('group');
            }
            if (node.disabled) {
                rect.classList.add('disabled');
            }
            if (state.selectedNodeIds.includes(node.id)) {
                rect.classList.add('selected');
            }
            rect.dataset.id = node.id;
            rect.style.fill = node.color;
            nodeGroup.appendChild(rect);

            // Node content (title, icon, etc.)
            const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
            foreignObject.setAttribute('x', node.x - node.width / 2);
            foreignObject.setAttribute('y', node.y - node.height / 2);
            foreignObject.setAttribute('width', node.width);
            foreignObject.setAttribute('height', node.height);
            foreignObject.style.pointerEvents = 'none';
            
            const nodeContent = document.createElement('div');
            nodeContent.setAttribute('class', 'node-content');
            
            const nodeHeader = document.createElement('div');
            nodeHeader.setAttribute('class', 'node-header');
            nodeHeader.innerHTML = `<i data-lucide="${node.icon}"></i>`;
            
            const nodeTitle = document.createElement('div');
            nodeTitle.setAttribute('class', 'node-title');
            nodeTitle.textContent = node.title;
            nodeTitle.style.pointerEvents = 'all';
            nodeTitle.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                state.contextNode = node;
                showContextMenu(e.clientX, e.clientY, 'node');
            });

            nodeHeader.appendChild(nodeTitle);
            
            const nodeBody = document.createElement('div');
            nodeBody.setAttribute('class', 'node-body');

            const nodeFooter = document.createElement('div');
            nodeFooter.setAttribute('class', 'node-footer');
            nodeFooter.textContent = `ID: ${node.id}`;

            nodeContent.appendChild(nodeHeader);
            nodeContent.appendChild(nodeBody);
            nodeContent.appendChild(nodeFooter);

            foreignObject.appendChild(nodeContent);
            nodeGroup.appendChild(foreignObject);
            lucide.createIcons();

            // Render resize handles
            if (!node.disabled) {
                const handleThickness = 12;
                const cornerSize = 16;

                const handles = [
                    // Sides
                    {
                        class: 'n',
                        x: node.x - node.width / 2,
                        y: node.y - node.height / 2 - handleThickness / 2,
                        width: node.width,
                        height: handleThickness,
                    },
                    {
                        class: 's',
                        x: node.x - node.width / 2,
                        y: node.y + node.height / 2 - handleThickness / 2,
                        width: node.width,
                        height: handleThickness,
                    },
                    {
                        class: 'w',
                        x: node.x - node.width / 2 - handleThickness / 2,
                        y: node.y - node.height / 2,
                        width: handleThickness,
                        height: node.height,
                    },
                    {
                        class: 'e',
                        x: node.x + node.width / 2 - handleThickness / 2,
                        y: node.y - node.height / 2,
                        width: handleThickness,
                        height: node.height,
                    },
                    // Corners
                    {
                        class: 'nw',
                        x: node.x - node.width / 2 - cornerSize / 2,
                        y: node.y - node.height / 2 - cornerSize / 2,
                        width: cornerSize,
                        height: cornerSize,
                    },
                    {
                        class: 'ne',
                        x: node.x + node.width / 2 - cornerSize / 2,
                        y: node.y - node.height / 2 - cornerSize / 2,
                        width: cornerSize,
                        height: cornerSize,
                    },
                    {
                        class: 'sw',
                        x: node.x - node.width / 2 - cornerSize / 2,
                        y: node.y + node.height / 2 - cornerSize / 2,
                        width: cornerSize,
                        height: cornerSize,
                    },
                    {
                        class: 'se',
                        x: node.x + node.width / 2 - cornerSize / 2,
                        y: node.y + node.height / 2 - cornerSize / 2,
                        width: cornerSize,
                        height: cornerSize,
                    },
                ];

                handles.forEach(handleData => {
                    const handle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    handle.setAttribute('x', handleData.x);
                    handle.setAttribute('y', handleData.y);
                    handle.setAttribute('width', handleData.width);
                    handle.setAttribute('height', handleData.height);
                    handle.setAttribute('class', `resize-handle ${handleData.class}`);
                    handle.dataset.direction = handleData.class;
                    handle.dataset.nodeId = node.id;
                    nodeGroup.appendChild(handle);
                });
            }

            // Render connection handles
            if (!node.disabled) {
                node.sockets.forEach(socket => {
                    const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    handle.setAttribute('cx', socket.x);
                    handle.setAttribute('cy', socket.y);
                    handle.setAttribute('r', 5);
                    handle.setAttribute('class', 'connection-handle-visible');
                    handle.dataset.nodeId = node.id;
                    handle.dataset.socketId = socket.id;

                    const isConnected = state.edges.some(edge => 
                        (edge.source.nodeId === node.id && edge.source.socketId === socket.id) ||
                        (edge.target.nodeId === node.id && edge.target.socketId === socket.id)
                    );

                    if (isConnected) {
                        handle.classList.add('connected');
                    }

                    nodeGroup.appendChild(handle);
                    
                    const connectionZone = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    connectionZone.setAttribute('cx', socket.x);
                    connectionZone.setAttribute('cy', socket.y);
                    connectionZone.setAttribute('r', settings.connectionZoneRadius);
                    connectionZone.setAttribute('fill', 'transparent');
                    connectionZone.setAttribute('class', 'connection-handle');
                    connectionZone.dataset.nodeId = node.id;
                    connectionZone.dataset.socketId = socket.id;
                    nodeGroup.appendChild(connectionZone);
                });
            }
        });

        // Update cursor for cutting mode
        if (state.interaction.cutting) {
            dom.svg.style.cursor = 'crosshair';
            log('Cut mode: Drag over edges to delete them');
        } else {
            dom.svg.style.cursor = '';
        }
    }

    /**
     * Shows the context menu at the specified coordinates.
     * @param {number} x - The x-coordinate.
     * @param {number} y - The y-coordinate.
     * @param {string} type - The type of context ('node', 'edge', or 'canvas').
     */
    function showContextMenu(x, y, type) {
        const { menu, addNode, addGroup, rename, deleteNode, disableNode, properties, deleteEdge, addRoutingPoint } = dom.contextMenu;
        
        addNode.style.display = (type === 'canvas' || type === 'connecting') ? 'block' : 'none';
        addGroup.style.display = (type === 'canvas' || type === 'connecting') ? 'block' : 'none';
        rename.style.display = type === 'node' ? 'block' : 'none';
        deleteNode.style.display = type === 'node' ? 'block' : 'none';
        disableNode.style.display = type === 'node' ? 'block' : 'none';
        properties.style.display = type === 'node' ? 'block' : 'none';
        deleteEdge.style.display = type === 'edge' ? 'block' : 'none';
        addRoutingPoint.style.display = type === 'edge' ? 'block' : 'none';

        menu.style.display = 'block';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
    }

    /**
     * Shows the properties panel for a given node.
     * @param {object} node - The node to show properties for.
     */
    function showPropertiesPanel(node) {
        if (!node) return;
        state.contextNode = node;
        dom.propertiesPanel.panel.style.display = 'block';
        dom.propertiesPanel.nodeNameInput.value = node.title;
        dom.propertiesPanel.nodeColorInput.value = node.color;
        log(`Showing properties for node ${node.id}`);
    }

    /**
     * Hides the properties panel.
     */
    function hidePropertiesPanel() {
        dom.propertiesPanel.panel.style.display = 'none';
        state.contextNode = null;
        log('Hid properties panel');
    }

    // =================================================================================================
    // Event Handlers
    // =================================================================================================

    function setupEventListeners() {
        // Keyboard events
        document.addEventListener('keydown', (e) => {
            const isEditingText = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

            if (e.ctrlKey || e.metaKey) {
                if (e.key.toLowerCase() === 'c') {
                    if (isEditingText) return;
                    e.preventDefault();
                    copySelectedNodes();
                    return;
                }
                if (e.key.toLowerCase() === 'v') {
                    if (isEditingText) return;
                    e.preventDefault();
                    pasteNodes();
                    return;
                }
                if (e.key.toLowerCase() === 'z') {
                    if (isEditingText) return;
                    e.preventDefault();
                    if (e.shiftKey) {
                        redo();
                    } else {
                        undo();
                    }
                    return;
                }
                if (e.key.toLowerCase() === 'y') {
                    if (isEditingText) return;
                    e.preventDefault();
                    redo();
                    return;
                }
            }

            if (e.key === 'c' && !state.interaction.cutting) {
                state.interaction.cutting = true;
                render();
            }
            if ((e.key === 'Delete' || e.key === 'Backspace')) {
                if (state.selectedEdgeIndexes.length > 0 || state.selectedNodeIds.length > 0) {
                    saveStateForUndo('Delete Selection');
                }
                if (state.selectedEdgeIndexes.length > 0) {
                    log(`Deleted ${state.selectedEdgeIndexes.length} edges`);
                    state.edges = state.edges.filter((edge, index) => !state.selectedEdgeIndexes.includes(index));
                    state.selectedEdgeIndexes = [];
                }
                if (state.selectedNodeIds.length > 0) {
                    log(`Deleted ${state.selectedNodeIds.length} nodes`);
                    state.nodes = state.nodes.filter(node => !state.selectedNodeIds.includes(node.id));
                    state.edges = state.edges.filter(edge => !state.selectedNodeIds.includes(edge.source.nodeId) && !state.selectedNodeIds.includes(edge.target.nodeId));
                    state.selectedNodeIds = [];
                }
                render();
            }
            if (e.key === 'd' && state.selectedNodeIds.length > 0) {
                saveStateForUndo('Toggle Disable');
                state.selectedNodeIds.forEach(nodeId => {
                    const node = state.nodes.find(n => n.id === nodeId);
                    if (node) {
                        node.disabled = !node.disabled;
                        log(`Toggled disabled state for node ${nodeId}`);
                    }
                });
                state.selectedEdgeIndexes = [];
            }
            if (e.key === 'p') {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                e.preventDefault();
                if (state.selectedNodeIds.length === 1) {
                    const selectedNode = state.nodes.find(n => n.id === state.selectedNodeIds[0]);
                    if (dom.propertiesPanel.panel.style.display === 'block' && state.contextNode?.id === selectedNode.id) {
                        hidePropertiesPanel();
                    } else {
                        showPropertiesPanel(selectedNode);
                    }
                } else if (dom.propertiesPanel.panel.style.display === 'block') {
                    hidePropertiesPanel();
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === 'c') {
                state.interaction.cutting = false;
                render();
            }
        });

        // Mouse events on SVG
        dom.svg.addEventListener('mousedown', (e) => {
            state.interaction.mouseDown = true;
            const target = e.target;

            const isBackground = !target.classList.contains('node') &&
                                 !target.classList.contains('resize-handle') &&
                                 !target.classList.contains('connection-handle') &&
                                 !target.classList.contains('edge') &&
                                 !target.classList.contains('routing-handle');

            // If the context menu is open, any click on the background should close it and do nothing else.
            if (isBackground && dom.contextMenu.menu.style.display === 'block') {
                dom.contextMenu.menu.style.display = 'none';
                if (state.interaction.connecting) {
                    state.interaction.connecting = false;
                    state.connectionStartSocket = null;
                    state.tempLine = null;
                    state.connectionEndPosition = null;
                    render();
                }
                return;
            }

            if (state.interaction.cutting) {
                const pt = dom.svg.createSVGPoint();
                pt.x = e.clientX;
                pt.y = e.clientY;
                const svgP = pt.matrixTransform(dom.svg.getScreenCTM().inverse());
                state.cutLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                state.cutLine.setAttribute('d', `M ${svgP.x} ${svgP.y}`);
                state.cutLine.setAttribute('class', 'cut-line');
                return;
            }
            
            if ((e.shiftKey || e.ctrlKey) || (e.button === 0 && isBackground)) {
                if ((e.shiftKey || e.ctrlKey) && target.classList.contains('node')) {
                    e.stopPropagation();
                    const nodeId = parseInt(target.dataset.id);
                    if (state.selectedNodeIds.includes(nodeId)) {
                        state.selectedNodeIds = state.selectedNodeIds.filter(id => id !== nodeId);
                    } else {
                        state.selectedNodeIds.push(nodeId);
                    }
                    log(`Toggled selection for node ${nodeId}`);
                } else if ((e.shiftKey || e.ctrlKey) && target.classList.contains('edge')) {
                    e.stopPropagation();
                    const edgeIndex = parseInt(target.dataset.index);
                    if (state.selectedEdgeIndexes.includes(edgeIndex)) {
                        state.selectedEdgeIndexes = state.selectedEdgeIndexes.filter(index => index !== edgeIndex);
                    } else {
                        state.selectedEdgeIndexes.push(edgeIndex);
                    }
                    log(`Toggled selection for edge ${edgeIndex}`);
                } else {
                    state.interaction.selecting = true;
                    dom.selectionBox.style.display = 'block';
                    state.dragStart.x = e.clientX;
                    state.dragStart.y = e.clientY;
                    dom.selectionBox.style.left = `${state.dragStart.x}px`;
                    dom.selectionBox.style.top = `${state.dragStart.y}px`;
                    dom.selectionBox.style.width = '0px';
                    dom.selectionBox.style.height = '0px';
                    log('Started selection box');
                }
            } else if (e.button === 1) { // Pan with middle mouse button only
                state.interaction.panning = true;
                state.dragStart.x = e.clientX;
                state.dragStart.y = e.clientY;
                state.selectedNodeIds = [];
                state.selectedEdgeIndexes = [];
                dom.contextMenu.menu.style.display = 'none';
                log('Started panning');
            } else if (target.classList.contains('node')) {
                e.stopPropagation();
                const nodeId = parseInt(target.dataset.id);
                if (!state.selectedNodeIds.includes(nodeId)) {
                    state.selectedNodeIds = [nodeId];
                    state.selectedEdgeIndexes = [];
                }
                log(`Selected node ${nodeId}`);
                const node = state.nodes.find(n => n.id === nodeId);
                if (dom.propertiesPanel.panel.style.display === 'block') {
                    showPropertiesPanel(node);
                }
                if (!node.disabled) {
                    saveStateForUndo('Move Nodes');
                    state.interaction.dragging = true;
                    state.draggedNodes = state.selectedNodeIds.map(id => state.nodes.find(n => n.id === id));
                    const pt = dom.svg.createSVGPoint();
                    pt.x = e.clientX;
                    pt.y = e.clientY;
                    const svgP = pt.matrixTransform(dom.svg.getScreenCTM().inverse());
                    state.dragStart.x = svgP.x;
                    state.dragStart.y = svgP.y;
                    log(`Started dragging node(s)`);
                }
            } else if (target.classList.contains('resize-handle')) {
                e.stopPropagation();
                saveStateForUndo('Resize Node');
                state.interaction.resizing = true;
                state.resizeDirection = target.dataset.direction;
                const nodeId = parseInt(target.dataset.nodeId, 10);
                state.originalNode = { ...state.nodes.find(n => n.id === nodeId) };
                if (!state.selectedNodeIds.includes(nodeId)) {
                    state.selectedNodeIds = [nodeId];
                    state.selectedEdgeIndexes = [];
                }
                const pt = dom.svg.createSVGPoint();
                pt.x = e.clientX;
                pt.y = e.clientY;
                const svgP = pt.matrixTransform(dom.svg.getScreenCTM().inverse());
                state.dragStart.x = svgP.x;
                state.dragStart.y = svgP.y;
                log(`Started resizing node ${nodeId}`);
            } else if (target.classList.contains('connection-handle')) {
                e.stopPropagation();
                state.interaction.connecting = true;
                const nodeId = parseInt(target.dataset.nodeId);
                const socketId = parseInt(target.dataset.socketId);
                state.connectionStartSocket = { nodeId, socketId };
                const startNode = state.nodes.find(n => n.id === nodeId);
                const startSocketPos = startNode.sockets[socketId];
                state.tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                state.tempLine.setAttribute('d', `M ${startSocketPos.x} ${startSocketPos.y} L ${startSocketPos.x} ${startSocketPos.y}`);
                state.tempLine.setAttribute('class', 'edge');
                state.tempLine.setAttribute('fill', 'none');
                state.tempLine.setAttribute('marker-end', 'url(#arrowhead)');
                log(`Started connecting from node ${nodeId}`);
            } else if (target.classList.contains('edge')) {
                e.stopPropagation();
                const edgeIndex = parseInt(target.dataset.index);
                if (!state.selectedEdgeIndexes.includes(edgeIndex)) {
                    state.selectedEdgeIndexes = [edgeIndex];
                    state.selectedNodeIds = [];
                }
                log(`Selected edge ${edgeIndex}`);
            } else if (target.classList.contains('routing-handle')) {
                e.stopPropagation();
                saveStateForUndo('Move Routing Point');
                state.interaction.draggingRoutingPoint = true;
                const edgeIndex = parseInt(target.dataset.edgeIndex);
                const pointIndex = parseInt(target.dataset.pointIndex);
                state.draggedRoutingPoint = { edgeIndex, pointIndex };
                log(`Started dragging routing point on edge ${edgeIndex}`);
            } else {
                state.selectedNodeIds = [];
                state.selectedEdgeIndexes = [];
            }
            render();
        });

        dom.svg.addEventListener('mousemove', (e) => {
            const pt = dom.svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const svgP = pt.matrixTransform(dom.svg.getScreenCTM().inverse());
            state.mousePosition.x = svgP.x;
            state.mousePosition.y = svgP.y;

            if (state.interaction.cutting && state.interaction.mouseDown) {
                if (!state.cutLine) return;
                const d = state.cutLine.getAttribute('d');
                let lastPointStr;
                const lastLIndex = d.lastIndexOf('L');
                if (lastLIndex !== -1) {
                    lastPointStr = d.substring(lastLIndex + 1);
                } else {
                    lastPointStr = d.substring(d.lastIndexOf('M') + 1);
                }
                const coords = lastPointStr.trim().split(/\s+/);
                const lastPoint = { x: parseFloat(coords[0]), y: parseFloat(coords[1]) };

                const smoothingFactor = 0.4;
                const smoothedX = lastPoint.x * (1 - smoothingFactor) + svgP.x * smoothingFactor;
                const smoothedY = lastPoint.y * (1 - smoothingFactor) + svgP.y * smoothingFactor;

                const scribbleAmount = 8;
                const scribbleX = smoothedX + (Math.random() - 0.5) * scribbleAmount;
                const scribbleY = smoothedY + (Math.random() - 0.5) * scribbleAmount;
                
                state.cutLine.setAttribute('d', `${d} L ${scribbleX} ${scribbleY}`);

                render();
                return;
            }
            
            if (state.interaction.selecting) {
                const x = Math.min(e.clientX, state.dragStart.x);
                const y = Math.min(e.clientY, state.dragStart.y);
                const width = Math.abs(e.clientX - state.dragStart.x);
                const height = Math.abs(e.clientY - state.dragStart.y);
                dom.selectionBox.style.left = `${x}px`;
                dom.selectionBox.style.top = `${y}px`;
                dom.selectionBox.style.width = `${width}px`;
                dom.selectionBox.style.height = `${height}px`;
            } else if (state.interaction.panning) {
                const dx = (e.clientX - state.dragStart.x) * (state.viewbox.w / window.innerWidth);
                const dy = (e.clientY - state.dragStart.y) * (state.viewbox.h / window.innerHeight);
                state.viewbox.x -= dx;
                state.viewbox.y -= dy;
                state.dragStart.x = e.clientX;
                state.dragStart.y = e.clientY;
                render();
            } else if (state.interaction.dragging) {
                const pt = dom.svg.createSVGPoint();
                pt.x = e.clientX;
                pt.y = e.clientY;
                const svgP = pt.matrixTransform(dom.svg.getScreenCTM().inverse());
                const dx = svgP.x - state.dragStart.x;
                const dy = svgP.y - state.dragStart.y;
                
                const nodesToMove = new Set();
                state.draggedNodes.forEach(draggedNode => {
                    nodesToMove.add(draggedNode);
                    if (draggedNode.type === 'group') {
                        draggedNode.children.forEach(childId => {
                            const childNode = state.nodes.find(n => n.id === childId);
                            if (childNode) {
                                nodesToMove.add(childNode);
                            }
                        });
                    }
                });

                nodesToMove.forEach(node => {
                    node.x += dx;
                    node.y += dy;
                    const socketYOffset = node.type === 'group' ? node.height / 2 + 10 : node.height / 2 + 10;
                    const socketXOffset = node.type === 'group' ? node.width / 2 + 10 : node.width / 2 + 10;
                    node.sockets[0] = { id: 0, x: node.x, y: node.y - socketYOffset };
                    node.sockets[1] = { id: 1, x: node.x, y: node.y + socketYOffset };
                    node.sockets[2] = { id: 2, x: node.x - socketXOffset, y: node.y };
                    node.sockets[3] = { id: 3, x: node.x + socketXOffset, y: node.y };
                });

                state.dragStart.x = svgP.x;
                state.dragStart.y = svgP.y;
            render();
            } else if (state.interaction.resizing) {
                const node = state.nodes.find(n => n.id === state.originalNode.id);
                const pt = dom.svg.createSVGPoint();
                pt.x = e.clientX;
                pt.y = e.clientY;
                const svgP = pt.matrixTransform(dom.svg.getScreenCTM().inverse());
                const dx = svgP.x - state.dragStart.x;
                const dy = svgP.y - state.dragStart.y;

                let newX = state.originalNode.x;
                let newY = state.originalNode.y;
                let newWidth = state.originalNode.width;
                let newHeight = state.originalNode.height;

                if (state.resizeDirection.includes('n')) {
                    newHeight -= dy;
                    newY += dy / 2;
                }
                if (state.resizeDirection.includes('s')) {
                    newHeight += dy;
                    newY += dy / 2;
                }
                if (state.resizeDirection.includes('w')) {
                    newWidth -= dx;
                    newX += dx / 2;
                }
                if (state.resizeDirection.includes('e')) {
                    newWidth += dx;
                    newX += dx / 2;
                }

                if (newWidth > settings.gridSize && newHeight > settings.gridSize) {
                    node.x = newX;
                    node.y = newY;
                    node.width = newWidth;
                    node.height = newHeight;
                    const socketYOffset = node.type === 'group' ? node.height / 2 + 10 : node.height / 2 + 10;
                    const socketXOffset = node.type === 'group' ? node.width / 2 + 10 : node.width / 2 + 10;
                    node.sockets[0] = { id: 0, x: node.x, y: node.y - socketYOffset };
                    node.sockets[1] = { id: 1, x: node.x, y: node.y + socketYOffset };
                    node.sockets[2] = { id: 2, x: node.x - socketXOffset, y: node.y };
                    node.sockets[3] = { id: 3, x: node.x + socketXOffset, y: node.y };
                    render();
                }
            } else if (state.interaction.connecting) {
                const pt = dom.svg.createSVGPoint();
                pt.x = e.clientX;
                pt.y = e.clientY;
                const svgP = pt.matrixTransform(dom.svg.getScreenCTM().inverse());
                const startNode = state.nodes.find(n => n.id === state.connectionStartSocket.nodeId);
                const startSocketPos = startNode.sockets[state.connectionStartSocket.socketId];
                state.tempLine.setAttribute('d', `M ${startSocketPos.x} ${startSocketPos.y} L ${svgP.x} ${svgP.y}`);
                render();
            } else if (state.interaction.draggingRoutingPoint) {
                const edge = state.edges[state.draggedRoutingPoint.edgeIndex];
                const point = edge.points[state.draggedRoutingPoint.pointIndex];
                const pt = dom.svg.createSVGPoint();
                pt.x = e.clientX;
                pt.y = e.clientY;
                const svgP = pt.matrixTransform(dom.svg.getScreenCTM().inverse());
                point.x = Math.round(svgP.x / settings.gridSize) * settings.gridSize;
                point.y = Math.round(svgP.y / settings.gridSize) * settings.gridSize;
                render();
            }
        });

        dom.svg.addEventListener('mouseup', (e) => {
            state.interaction.mouseDown = false;

            if (state.interaction.connecting) {
                const targetElement = document.elementFromPoint(e.clientX, e.clientY);
                if (targetElement && targetElement.classList.contains('connection-handle')) {
                    const nodeId = parseInt(targetElement.dataset.nodeId);
                    const socketId = parseInt(targetElement.dataset.socketId);
                    const targetSocket = { nodeId, socketId };
                    createEdge(state.connectionStartSocket, targetSocket);
                } else {
                    // Not a valid target. If the menu isn't open, show it and wait.
                    if (dom.contextMenu.menu.style.display !== 'block') {
                        const pt = dom.svg.createSVGPoint();
                        pt.x = e.clientX;
                        pt.y = e.clientY;
                        const svgP = pt.matrixTransform(dom.svg.getScreenCTM().inverse());
                        state.connectionEndPosition = svgP;
                        showContextMenu(e.clientX, e.clientY, 'connecting');
                        // By returning here, we skip the state reset at the end of the function,
                        // allowing the global click handler or a context menu action to take over.
                        return;
                    }
                    // if the menu is already open, this mouseup is part of the click to dismiss it.
                    // We should do nothing and let the global click handler manage it.
                    return;
                }
            }

            if (state.interaction.dragging) {
                state.draggedNodes.forEach(node => {
                    if (node.type !== 'group') {
                        const group = state.nodes.find(g => 
                            g.type === 'group' &&
                            node.x > g.x - g.width / 2 &&
                            node.x < g.x + g.width / 2 &&
                            node.y > g.y - g.height / 2 &&
                            node.y < g.y + g.height / 2
                        );
                        if (group) {
                            if (!group.children.includes(node.id)) {
                                group.children.push(node.id);
                                node.parent = group.id;
                                log(`Added node ${node.id} to group ${group.id}`);
                            }
                        } else {
                            if (node.parent) {
                                const parentGroup = state.nodes.find(g => g.id === node.parent);
                                if (parentGroup) {
                                    parentGroup.children = parentGroup.children.filter(id => id !== node.id);
                                    node.parent = undefined;
                                    log(`Removed node ${node.id} from group ${parentGroup.id}`);
                                }
                            }
                        }
                    }
                });
            }
            if (state.interaction.cutting) {
                if (state.cutLine) {
                    const d = state.cutLine.getAttribute('d');
                    if (d) {
                        const pointsStr = d.substring(1).trim().split('L');
                        const points = pointsStr.map(pStr => {
                            const coords = pStr.trim().split(/\s+/);
                            return { x: parseFloat(coords[0]), y: parseFloat(coords[1]) };
                        });

                        if (points.length > 1) {
                            const edgesToDelete = [];
                            state.edges.forEach((edge, index) => {
                                const sourceNode = state.nodes.find(n => n.id === edge.source.nodeId);
                                const targetNode = state.nodes.find(n => n.id === edge.target.nodeId);
                                if (sourceNode && targetNode) {
                                    const sourceSocket = sourceNode.sockets[edge.source.socketId];
                                    const targetSocket = targetNode.sockets[edge.target.socketId];
                                    
                                    for (let i = 0; i < points.length - 1; i++) {
                                        const p1 = points[i];
                                        const p2 = points[i+1];
                                        if (lineIntersects(p1, p2, sourceSocket, targetSocket)) {
                                            if (!edgesToDelete.includes(index)) {
                                                edgesToDelete.push(index);
                                            }
                                            break; 
                                        }
                                    }
                                }
                            });

                            if (edgesToDelete.length > 0) {
                                saveStateForUndo('Cut Edges');
                                log(`Cut ${edgesToDelete.length} edges`);
                                state.edges = state.edges.filter((_, index) => !edgesToDelete.includes(index));
                            }
                        }
                    }
                }
                state.cutLine = null;
            }
            if (state.interaction.selecting) {
                const selectionRect = dom.selectionBox.getBoundingClientRect();
                state.interaction.selecting = false;
                dom.selectionBox.style.display = 'none';
                const svgRect = dom.svg.getBoundingClientRect();
                const selectionStart = {
                    x: (selectionRect.left - svgRect.left) * (state.viewbox.w / svgRect.width) + state.viewbox.x,
                    y: (selectionRect.top - svgRect.top) * (state.viewbox.h / svgRect.height) + state.viewbox.y
                };
                const selectionEnd = {
                    x: (selectionRect.right - svgRect.left) * (state.viewbox.w / svgRect.width) + state.viewbox.x,
                    y: (selectionRect.bottom - svgRect.top) * (state.viewbox.h / svgRect.height) + state.viewbox.y
                };

                state.selectedNodeIds = state.nodes.filter(node => {
                    const nodeLeft = node.x - node.width / 2;
                    const nodeRight = node.x + node.width / 2;
                    const nodeTop = node.y - node.height / 2;
                    const nodeBottom = node.y + node.height / 2;

                    return nodeRight > selectionStart.x && nodeLeft < selectionEnd.x &&
                           nodeBottom > selectionStart.y && nodeTop < selectionEnd.y;
                }).map(node => node.id);

                const newSelectedEdgeIndexes = [];

                // Add edges with both nodes selected
                state.edges.forEach((edge, index) => {
                    if (state.selectedNodeIds.includes(edge.source.nodeId) && state.selectedNodeIds.includes(edge.target.nodeId)) {
                        newSelectedEdgeIndexes.push(index);
                    }
                });

                // Add edges intersecting the selection box
                const selectionSVGRect = {
                    x: selectionStart.x,
                    y: selectionStart.y,
                    width: selectionEnd.x - selectionStart.x,
                    height: selectionEnd.y - selectionStart.y
                };
                const edgeHitboxes = dom.svg.querySelectorAll('.edge-hitbox');
                edgeHitboxes.forEach(hitbox => {
                    const edgeBBox = hitbox.getBBox();
                    
                    // Check for intersection of two rectangles
                    if (edgeBBox.x < selectionSVGRect.x + selectionSVGRect.width &&
                        edgeBBox.x + edgeBBox.width > selectionSVGRect.x &&
                        edgeBBox.y < selectionSVGRect.y + selectionSVGRect.height &&
                        edgeBBox.y + edgeBBox.height > selectionSVGRect.y)
                    {
                        const index = parseInt(hitbox.dataset.index, 10);
                        newSelectedEdgeIndexes.push(index);
                    }
                });

                state.selectedEdgeIndexes = [...new Set(newSelectedEdgeIndexes)];
                log(`Selected ${state.selectedNodeIds.length} nodes and ${state.selectedEdgeIndexes.length} edges`);

            } else if (state.interaction.connecting) {
                const targetElement = document.elementFromPoint(e.clientX, e.clientY);
                if (targetElement && targetElement.classList.contains('connection-handle')) {
                    const nodeId = parseInt(targetElement.dataset.nodeId);
                    const socketId = parseInt(targetElement.dataset.socketId);
                    const targetSocket = { nodeId, socketId };
                    createEdge(state.connectionStartSocket, targetSocket);
                }
            }

            // Reset interaction state
            state.interaction.dragging = false;
            state.draggedNodes = [];
            state.interaction.resizing = false;
            state.interaction.panning = false;
            state.resizeDirection = null;
            state.originalNode = null;
            state.interaction.connecting = false;
            state.connectionStartSocket = null;
            state.tempLine = null;
            state.interaction.draggingRoutingPoint = false;
            state.draggedRoutingPoint = null;
            render();
        });

        dom.svg.addEventListener('dblclick', (e) => {
            const target = e.target;
            if (target.classList.contains('edge')) {
                const edgeIndex = parseInt(target.dataset.index);
                const edge = state.edges[edgeIndex];
                const pt = dom.svg.createSVGPoint();
                pt.x = e.clientX;
                pt.y = e.clientY;
                const svgP = pt.matrixTransform(dom.svg.getScreenCTM().inverse());
                edge.points.push({ x: svgP.x, y: svgP.y });
                log(`Added routing point to edge ${edgeIndex}`);
                render();
            }
        });

        dom.svg.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const target = e.target;
            if (target.classList.contains('node')) {
                state.contextNode = state.nodes.find(n => n.id == target.dataset.id);
                showContextMenu(e.clientX, e.clientY, 'node');
            } else if (target.classList.contains('edge')) {
                state.contextEdge = parseInt(target.dataset.index);
                showContextMenu(e.clientX, e.clientY, 'edge');
            } else {
                state.contextNode = null;
                state.contextEdge = null;
                showContextMenu(e.clientX, e.clientY, 'canvas');
            }
        });

        // UI button events
        dom.themeToggleBtn.addEventListener('click', () => {
            if (document.body.classList.contains('dark-theme')) {
                document.body.classList.remove('dark-theme');
                document.body.classList.add('grayscale-theme');
                log('Switched to grayscale theme');
            } else if (document.body.classList.contains('grayscale-theme')) {
                document.body.classList.remove('grayscale-theme');
                log('Switched to light theme');
            } else {
                document.body.classList.add('dark-theme');
                log('Switched to dark theme');
            }
            
            const newColor = getComputedStyle(document.body).getPropertyValue('--node-fill-color');
            state.nodes.forEach(node => {
                node.color = newColor.trim();
            });
            render();
        });

        dom.addNodeBtn.addEventListener('click', () => {
            const x = state.viewbox.x + state.viewbox.w / 2;
            const y = state.viewbox.y + state.viewbox.h / 2;
            addNode(x, y);
        });

        dom.addGroupBtn.addEventListener('click', () => {
            const x = state.viewbox.x + state.viewbox.w / 2;
            const y = state.viewbox.y + state.viewbox.h / 2;
            addNode(x, y, 'group');
        });

        dom.edgeTypeSelect.addEventListener('change', (e) => {
            saveStateForUndo('Change Edge Style');
            const newType = e.target.value;
            state.edges.forEach(edge => {
                edge.type = newType;
            });
            log(`Changed all edges to ${newType} style`);
            render();
        });

        dom.zoomInBtn.addEventListener('click', () => {
            const newWidth = state.viewbox.w * 0.8;
            const newHeight = state.viewbox.h * 0.8;
            if (newWidth / window.innerWidth > settings.minZoom) {
                state.viewbox.x += (state.viewbox.w - newWidth) / 2;
                state.viewbox.y += (state.viewbox.h - newHeight) / 2;
                state.viewbox.w = newWidth;
                state.viewbox.h = newHeight;
                log('Zoomed in');
                render();
            }
        });

        dom.zoomOutBtn.addEventListener('click', () => {
            const newWidth = state.viewbox.w * 1.2;
            const newHeight = state.viewbox.h * 1.2;
            if (newWidth / window.innerWidth < settings.maxZoom) {
                state.viewbox.x += (state.viewbox.w - newWidth) / 2;
                state.viewbox.y += (state.viewbox.h - newHeight) / 2;
                state.viewbox.w = newWidth;
                state.viewbox.h = newHeight;
                log('Zoomed out');
                render();
            }
        });

        // Zoom with mouse wheel
        dom.graphContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = dom.svg.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const svgX = state.viewbox.x + (mouseX / rect.width) * state.viewbox.w;
            const svgY = state.viewbox.y + (mouseY / rect.height) * state.viewbox.h;

            const zoomFactor = e.deltaY < 0 ? 0.9 : 1.1;
            const newWidth = state.viewbox.w * zoomFactor;
            const newHeight = state.viewbox.h * zoomFactor;

            if (newWidth / window.innerWidth > settings.minZoom && newWidth / window.innerWidth < settings.maxZoom) {
                state.viewbox.x = svgX - (mouseX / rect.width) * newWidth;
                state.viewbox.y = svgY - (mouseY / rect.height) * newHeight;
                state.viewbox.w = newWidth;
                state.viewbox.h = newHeight;

                render();
            }
        });

        // Context menu events
        function handleConnectToNewNode(type = 'default') {
            const newNode = addNode(state.connectionEndPosition.x, state.connectionEndPosition.y, type);
            const startNode = state.nodes.find(n => n.id === state.connectionStartSocket.nodeId);
            const startSocket = startNode.sockets[state.connectionStartSocket.socketId];

            let closestSocket = null;
            let minDistance = Infinity;
            newNode.sockets.forEach(socket => {
                const dx = socket.x - startSocket.x;
                const dy = socket.y - startSocket.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestSocket = socket;
                }
            });

            createEdge(state.connectionStartSocket, { nodeId: newNode.id, socketId: closestSocket.id });

            state.interaction.connecting = false;
            state.connectionStartSocket = null;
            state.tempLine = null;
            state.connectionEndPosition = null;

            dom.contextMenu.menu.style.display = 'none';
            render();
        }

        dom.contextMenu.addNode.addEventListener('click', () => {
            if (state.interaction.connecting) {
                handleConnectToNewNode('default');
            } else {
                const rect = dom.svg.getBoundingClientRect();
                const pt = dom.svg.createSVGPoint();
                pt.x = parseFloat(dom.contextMenu.menu.style.left) - rect.left;
                pt.y = parseFloat(dom.contextMenu.menu.style.top) - rect.top;
                const svgP = pt.matrixTransform(dom.svg.getScreenCTM().inverse());
                addNode(svgP.x, svgP.y);
                dom.contextMenu.menu.style.display = 'none';
            }
        });

        dom.contextMenu.addGroup.addEventListener('click', () => {
            if (state.interaction.connecting) {
                handleConnectToNewNode('group');
            } else {
                const rect = dom.svg.getBoundingClientRect();
                const pt = dom.svg.createSVGPoint();
                pt.x = parseFloat(dom.contextMenu.menu.style.left) - rect.left;
                pt.y = parseFloat(dom.contextMenu.menu.style.top) - rect.top;
                const svgP = pt.matrixTransform(dom.svg.getScreenCTM().inverse());
                addNode(svgP.x, svgP.y, 'group');
                dom.contextMenu.menu.style.display = 'none';
            }
        });

        dom.contextMenu.rename.addEventListener('click', () => {
            if (state.contextNode) {
                const newName = prompt('Enter new name:', state.contextNode.title);
                if (newName) {
                    saveStateForUndo('Rename Node');
                    state.contextNode.title = newName;
                    render();
                }
            }
            dom.contextMenu.menu.style.display = 'none';
        });

        dom.contextMenu.deleteNode.addEventListener('click', () => {
            if (state.contextNode) {
                removeNode(state.contextNode);
                state.contextNode = null;
                dom.contextMenu.menu.style.display = 'none';
            }
        });

        dom.contextMenu.disableNode.addEventListener('click', () => {
            if (state.contextNode) {
                saveStateForUndo('Toggle Disable');
                state.contextNode.disabled = !state.contextNode.disabled;
                log(`Toggled disabled state for node ${state.contextNode.id}`);
                state.contextNode = null;
                dom.contextMenu.menu.style.display = 'none';
                render();
            }
        });

        dom.contextMenu.properties.addEventListener('click', () => {
            if (state.selectedNodeIds.length === 1) {
                state.contextNode = state.nodes.find(n => n.id === state.selectedNodeIds[0]);
            }
            if (state.contextNode) {
                showPropertiesPanel(state.contextNode);
            }
            dom.contextMenu.menu.style.display = 'none';
        });

        dom.contextMenu.deleteEdge.addEventListener('click', () => {
            if (state.contextEdge !== null) {
                saveStateForUndo('Delete Edge');
                state.edges.splice(state.contextEdge, 1);
                log(`Deleted edge ${state.contextEdge}`);
                state.contextEdge = null;
                dom.contextMenu.menu.style.display = 'none';
            }
        });

        dom.contextMenu.addRoutingPoint.addEventListener('click', () => {
            if (state.contextEdge !== null) {
                const edge = state.edges[state.contextEdge];
                const sourceNode = state.nodes.find(n => n.id === edge.source.nodeId);
                const targetNode = state.nodes.find(n => n.id === edge.target.nodeId);
                if (sourceNode && targetNode) {
                    const sourceSocket = sourceNode.sockets[edge.source.socketId];
                    const targetSocket = targetNode.sockets[edge.target.socketId];
                    const x = (sourceSocket.x + targetSocket.x) / 2;
                    const y = (sourceSocket.y + targetSocket.y) / 2;
                    saveStateForUndo('Add Routing Point');
                    edge.points.push({ x, y });
                    log(`Added routing point to edge ${state.contextEdge}`);
                    render();
                }
                state.contextEdge = null;
                dom.contextMenu.menu.style.display = 'none';
            }
        });

        // Properties panel events
        dom.propertiesPanel.closeBtn.addEventListener('click', () => {
            hidePropertiesPanel();
        });

        dom.propertiesPanel.nodeNameInput.addEventListener('input', (e) => {
            if (state.contextNode) {
                if (!state.contextNode.preEditTitle) {
                    state.contextNode.preEditTitle = state.contextNode.title;
                }
                state.contextNode.title = e.target.value;
                render();
            }
        });

        dom.propertiesPanel.nodeNameInput.addEventListener('focus', (e) => {
            if (state.contextNode) {
                state.contextNode.preEditTitle = state.contextNode.title;
            }
        });

        dom.propertiesPanel.nodeNameInput.addEventListener('blur', (e) => {
            if (state.contextNode && state.contextNode.preEditTitle !== state.contextNode.title) {
                saveStateForUndo('Rename Node');
                delete state.contextNode.preEditTitle;
            }
        });

        dom.propertiesPanel.nodeColorInput.addEventListener('input', (e) => {
            if (state.contextNode) {
                state.contextNode.color = e.target.value;
                render();
            }
        });

        dom.propertiesPanel.nodeColorInput.addEventListener('focus', (e) => {
            if (state.contextNode) {
                state.contextNode.preEditColor = state.contextNode.color;
            }
        });

        dom.propertiesPanel.nodeColorInput.addEventListener('blur', (e) => {
            if (state.contextNode && state.contextNode.preEditColor !== state.contextNode.color) {
                saveStateForUndo('Change Node Color');
                delete state.contextNode.preEditColor;
            }
        });

        // Global click to hide context menu
        window.addEventListener('click', (e) => {
            if (dom.contextMenu.menu.style.display === 'block' && !e.target.closest('#context-menu')) {
                dom.contextMenu.menu.style.display = 'none';
                if (state.interaction.connecting) {
                    state.interaction.connecting = false;
                    state.connectionStartSocket = null;
                    state.tempLine = null;
                    state.connectionEndPosition = null;
                    render();
                }
            }
        }, true);

        // Drag and drop file handling
        dom.graphContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dom.graphContainer.style.backgroundColor = '#e0e0e0';
        });

        dom.graphContainer.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dom.graphContainer.style.backgroundColor = 'transparent';
        });

        dom.graphContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dom.graphContainer.style.backgroundColor = 'transparent';

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const data = JSON.parse(event.target.result);
                        if (data.nodes && data.edges) {
                            state.nodes = data.nodes;
                            state.edges = data.edges;
                            state.nodeIdCounter = Math.max(...state.nodes.map(n => n.id)) + 1;
                            log('Loaded graph from file');
                            render();
                        } else {
                            alert('Invalid JSON format for graph data.');
                        }
                    } catch (error) {
                        alert('Error parsing JSON file.');
                    }
                };
                reader.readAsText(file);
            }
        });
    }

    // =================================================================================================
    // Initialization
    // =================================================================================================

    /**
     * Initializes the application.
     */
    function init() {
        setupEventListeners();
        render();
    }

    init();
});