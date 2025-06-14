document.addEventListener('DOMContentLoaded', () => {
    const svg = document.getElementById('graph-svg');
    const addNodeBtn = document.getElementById('add-node-btn');
    const addGroupBtn = document.getElementById('add-group-btn');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const edgeTypeSelect = document.getElementById('edge-type-select');
    const graphContainer = document.getElementById('graph-container');
    const selectionBox = document.getElementById('selection-box');
    const contextMenu = document.getElementById('context-menu');
    const addNodeOption = document.getElementById('add-node-option');
    const addGroupOption = document.getElementById('add-group-option-context');
    const renameOption = document.getElementById('rename-option');
    const deleteNodeOption = document.getElementById('delete-node-option');
    const disableNodeOption = document.getElementById('disable-node-option');
    const propertiesOption = document.getElementById('properties-option');
    const deleteEdgeOption = document.getElementById('delete-edge-option');
    const addRoutingPointOption = document.getElementById('add-routing-point-option');
    const infoBar = document.getElementById('info-bar');
    const propertiesPanel = document.getElementById('properties-panel');
    const nodeNameInput = document.getElementById('node-name');
    const nodeColorInput = document.getElementById('node-color');
    const closePropertiesBtn = document.getElementById('close-properties-btn');

    let nodes = [];
    let edges = [];
    let nodeIdCounter = 0;
    let contextNode = null;
    let contextEdge = null;
    let selectedNodeIds = [];
    let selectedEdgeIndexes = [];
    let viewbox = { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
    const gridSize = 20;
    const minZoom = 0.2;
    const maxZoom = 3;

    let dragging = false;
    let resizing = false;
    let connecting = false;
    let panning = false;
    let selecting = false;
    let draggingRoutingPoint = false;
    let cutting = false;
    let mouseDown = false;
    let dragStart = { x: 0, y: 0 };
    let draggedNodes = [];
    let draggedRoutingPoint = null;
    let resizeDirection = null;
    let originalNode = null;
    let connectionStartSocket = null;
    let tempLine = null;
    let cutLine = null;

    function log(message) {
        infoBar.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    }

    function addNode(x, y, type = 'default') {
        const snappedX = Math.round(x / gridSize) * gridSize;
        const snappedY = Math.round(y / gridSize) * gridSize;
        const newNode = {
            id: nodeIdCounter++,
            x: snappedX,
            y: snappedY,
            width: type === 'group' ? 200 : 100,
            height: type === 'group' ? 150 : 80,
            disabled: false,
            title: type === 'group' ? `Group ${nodeIdCounter}` : `Node ${nodeIdCounter}`,
            icon: type === 'group' ? 'box-select' : 'box',
            type: type,
            children: type === 'group' ? [] : undefined,
            parent: undefined,
            color: getComputedStyle(document.body).getPropertyValue('--node-fill-color'),
            sockets: [
                { id: 0, x: snappedX, y: snappedY - (type === 'group' ? 85 : 50) },
                { id: 1, x: snappedX, y: snappedY + (type === 'group' ? 85 : 50) },
                { id: 2, x: snappedX - (type === 'group' ? 110 : 60), y: snappedY },
                { id: 3, x: snappedX + (type === 'group' ? 110 : 60), y: snappedY },
            ]
        };
        nodes.push(newNode);
        log(`Added ${type} ${newNode.id}`);
        render();
    }

    function removeNode(nodeToRemove) {
        nodes = nodes.filter(node => node.id !== nodeToRemove.id);
        edges = edges.filter(edge => edge.source.nodeId !== nodeToRemove.id && edge.target.nodeId !== nodeToRemove.id);
        log(`Removed node ${nodeToRemove.id}`);
        render();
    }

    function createEdge(sourceSocket, targetSocket) {
        if (sourceSocket.nodeId === targetSocket.nodeId) return;
        const existingEdge = edges.find(edge =>
            (edge.source.nodeId === sourceSocket.nodeId && edge.source.socketId === sourceSocket.socketId &&
             edge.target.nodeId === targetSocket.nodeId && edge.target.socketId === targetSocket.socketId) ||
            (edge.source.nodeId === targetSocket.nodeId && edge.source.socketId === targetSocket.socketId &&
             edge.target.nodeId === sourceSocket.nodeId && edge.target.socketId === sourceSocket.socketId)
        );
        if (!existingEdge) {
            edges.push({ source: sourceSocket, target: targetSocket, type: edgeTypeSelect.value, points: [] });
            log(`Created edge between node ${sourceSocket.nodeId} and node ${targetSocket.nodeId}`);
        }
    }

    function render() {
        svg.innerHTML = '';
        svg.setAttribute('viewBox', `${viewbox.x} ${viewbox.y} ${viewbox.w} ${viewbox.h}`);

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '7');
        marker.setAttribute('refX', '8');
        marker.setAttribute('refY', '3.5');
        marker.setAttribute('orient', 'auto');
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
        polygon.style.fill = 'var(--arrow-color)';
        marker.appendChild(polygon);
        defs.appendChild(marker);

        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.setAttribute('id', 'grid');
        pattern.setAttribute('width', gridSize);
        pattern.setAttribute('height', gridSize);
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${gridSize/2 - 2} ${gridSize/2} L ${gridSize/2 + 2} ${gridSize/2} M ${gridSize/2} ${gridSize/2 - 2} L ${gridSize/2} ${gridSize/2 + 2}`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'var(--grid-stroke-color)');
        path.setAttribute('stroke-width', '1');
        pattern.appendChild(path);
        defs.appendChild(pattern);
        svg.appendChild(defs);

        const gridRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        gridRect.setAttribute('x', viewbox.x);
        gridRect.setAttribute('y', viewbox.y);
        gridRect.setAttribute('width', viewbox.w);
        gridRect.setAttribute('height', viewbox.h);
        gridRect.setAttribute('fill', 'url(#grid)');
        svg.appendChild(gridRect);

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        svg.appendChild(g);

        edges.forEach((edge, index) => {
            const sourceNode = nodes.find(node => node.id === edge.source.nodeId);
            const targetNode = nodes.find(node => node.id === edge.target.nodeId);
            if (sourceNode && targetNode) {
                const sourceSocket = sourceNode.sockets[edge.source.socketId];
                const targetSocket = targetNode.sockets[edge.target.socketId];
                let d = `M ${sourceSocket.x} ${sourceSocket.y}`;
                if (edge.type === 'step') {
                    let lastPoint = sourceSocket;
                    edge.points.forEach(point => {
                        const midX = lastPoint.x + (point.x - lastPoint.x) / 2;
                        d += ` L ${midX} ${lastPoint.y} L ${midX} ${point.y}`;
                        lastPoint = point;
                    });
                    const midX = lastPoint.x + (targetSocket.x - lastPoint.x) / 2;
                    d += ` L ${midX} ${lastPoint.y} L ${midX} ${targetSocket.y} L ${targetSocket.x} ${targetSocket.y}`;
                } else if (edge.type === 'bezier') {
                    let lastPoint = sourceSocket;
                    edge.points.forEach(point => {
                        const dx = Math.abs(lastPoint.x - point.x) * 0.5;
                        const dy = Math.abs(lastPoint.y - point.y) * 0.5;
                        const cp1x = lastPoint.x + dx;
                        const cp1y = lastPoint.y;
                        const cp2x = point.x - dx;
                        const cp2y = point.y;
                        d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${point.x} ${point.y}`;
                        lastPoint = point;
                    });
                    const dx = Math.abs(lastPoint.x - targetSocket.x) * 0.5;
                    const dy = Math.abs(lastPoint.y - targetSocket.y) * 0.5;
                    const cp1x = lastPoint.x + dx;
                    const cp1y = lastPoint.y;
                    const cp2x = targetSocket.x - dx;
                    const cp2y = targetSocket.y;
                    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${targetSocket.x} ${targetSocket.y}`;
                } else {
                    edge.points.forEach(point => {
                        d += ` L ${point.x} ${point.y}`;
                    });
                    d += ` L ${targetSocket.x} ${targetSocket.y}`;
                }

                const edgeElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                edgeElement.setAttribute('d', d);
                edgeElement.setAttribute('fill', 'none');
                edgeElement.setAttribute('class', 'edge');
                if (selectedEdgeIndexes.includes(index)) {
                    edgeElement.classList.add('selected');
                }
                if (cutting) {
                    edgeElement.classList.add('cuttable');
                }
                edgeElement.dataset.index = index;
                edgeElement.setAttribute('marker-end', 'url(#arrowhead)');
                g.appendChild(edgeElement);

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

        if (tempLine) {
            g.appendChild(tempLine);
        }

        if (cutLine) {
            g.appendChild(cutLine);
        }

        const sortedNodes = [...nodes].sort((a, b) => {
            if (a.type === 'group' && b.type !== 'group') return -1;
            if (a.type !== 'group' && b.type === 'group') return 1;
            if (selectedNodeIds.includes(a.id)) return 1;
            if (selectedNodeIds.includes(b.id)) return -1;
            return 0;
        });

        sortedNodes.forEach(node => {
            const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            nodeGroup.setAttribute('class', 'node-group');
            g.appendChild(nodeGroup);

            const hoverRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            hoverRect.setAttribute('x', node.x - node.width / 2 - 10);
            hoverRect.setAttribute('y', node.y - node.height / 2 - 10);
            hoverRect.setAttribute('width', node.width + 20);
            hoverRect.setAttribute('height', node.height + 20);
            hoverRect.setAttribute('fill', 'transparent');
            nodeGroup.appendChild(hoverRect);

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
            if (selectedNodeIds.includes(node.id)) {
                rect.classList.add('selected');
            }
            rect.dataset.id = node.id;
            rect.style.fill = node.color;
            nodeGroup.appendChild(rect);

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
                contextNode = node;
                contextMenu.style.display = 'block';
                contextMenu.style.left = `${e.clientX}px`;
                contextMenu.style.top = `${e.clientY}px`;
                addNodeOption.style.display = 'none';
                addGroupOption.style.display = 'none';
                renameOption.style.display = 'block';
                deleteNodeOption.style.display = 'none';
                disableNodeOption.style.display = 'none';
                propertiesOption.style.display = 'none';
                deleteEdgeOption.style.display = 'none';
                addRoutingPointOption.style.display = 'none';
            });

            nodeHeader.appendChild(nodeTitle);
            
            const nodeBody = document.createElement('div');
            nodeBody.setAttribute('class', 'node-body');

            nodeContent.appendChild(nodeHeader);
            nodeContent.appendChild(nodeBody);

            foreignObject.appendChild(nodeContent);
            nodeGroup.appendChild(foreignObject);
            lucide.createIcons();

            if (selectedNodeIds.includes(node.id) && !node.disabled) {
                const handleSize = 8;
                const resizeHandles = [
                    { x: node.x - node.width / 2, y: node.y - node.height / 2, class: 'nw' },
                    { x: node.x + node.width / 2, y: node.y - node.height / 2, class: 'ne' },
                    { x: node.x - node.width / 2, y: node.y + node.height / 2, class: 'sw' },
                    { x: node.x + node.width / 2, y: node.y + node.height / 2, class: 'se' },
                    { x: node.x, y: node.y - node.height / 2, class: 'n' },
                    { x: node.x, y: node.y + node.height / 2, class: 's' },
                    { x: node.x - node.width / 2, y: node.y, class: 'w' },
                    { x: node.x + node.width / 2, y: node.y, class: 'e' },
                ];

                resizeHandles.forEach(handleData => {
                    const handle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    handle.setAttribute('x', handleData.x - handleSize / 2);
                    handle.setAttribute('y', handleData.y - handleSize / 2);
                    handle.setAttribute('width', handleSize);
                    handle.setAttribute('height', handleSize);
                    handle.setAttribute('class', `resize-handle ${handleData.class}`);
                    handle.dataset.direction = handleData.class;
                    nodeGroup.appendChild(handle);
                });
            }

            if (!node.disabled) {
                node.sockets.forEach(socket => {
                    const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    handle.setAttribute('cx', socket.x);
                    handle.setAttribute('cy', socket.y);
                    handle.setAttribute('r', 5);
                    handle.setAttribute('class', 'connection-handle-visible');
                    handle.dataset.nodeId = node.id;
                    handle.dataset.socketId = socket.id;
                    nodeGroup.appendChild(handle);
                    
                    const connectionZone = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    connectionZone.setAttribute('cx', socket.x);
                    connectionZone.setAttribute('cy', socket.y);
                    connectionZone.setAttribute('r', getComputedStyle(document.documentElement).getPropertyValue('--connection-zone-radius'));
                    connectionZone.setAttribute('fill', 'transparent');
                    connectionZone.setAttribute('class', 'connection-handle');
                    connectionZone.dataset.nodeId = node.id;
                    connectionZone.dataset.socketId = socket.id;
                    nodeGroup.appendChild(connectionZone);
                });
            }
        });

        if (cutting) {
            svg.style.cursor = 'crosshair';
            log('Cut mode: Drag over edges to delete them');
        } else {
            svg.style.cursor = '';
        }
    }

    function lineIntersects(p1, p2, p3, p4) {
        function orientation(p, q, r) {
            const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
            if (val === 0) return 0;
            return (val > 0) ? 1 : 2;
        }

        function onSegment(p, q, r) {
            return (q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
                    q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y));
        }

        const o1 = orientation(p1, p2, p3);
        const o2 = orientation(p1, p2, p4);
        const o3 = orientation(p3, p4, p1);
        const o4 = orientation(p3, p4, p2);

        if (o1 !== o2 && o3 !== o4) {
            return true;
        }

        if (o1 === 0 && onSegment(p1, p3, p2)) return true;
        if (o2 === 0 && onSegment(p1, p4, p2)) return true;
        if (o3 === 0 && onSegment(p3, p1, p4)) return true;
        if (o4 === 0 && onSegment(p3, p2, p4)) return true;

        return false;
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'c' && !cutting) {
            cutting = true;
            render();
        }
        if ((e.key === 'Delete' || e.key === 'Backspace')) {
            if (selectedEdgeIndexes.length > 0) {
                log(`Deleted ${selectedEdgeIndexes.length} edges`);
                edges = edges.filter((edge, index) => !selectedEdgeIndexes.includes(index));
                selectedEdgeIndexes = [];
            }
            if (selectedNodeIds.length > 0) {
                log(`Deleted ${selectedNodeIds.length} nodes`);
                nodes = nodes.filter(node => !selectedNodeIds.includes(node.id));
                edges = edges.filter(edge => !selectedNodeIds.includes(edge.source.nodeId) && !selectedNodeIds.includes(edge.target.nodeId));
                selectedNodeIds = [];
            }
            render();
        }
        if (e.key === 'd' && selectedNodeIds.length > 0) {
            selectedNodeIds.forEach(nodeId => {
                const node = nodes.find(n => n.id === nodeId);
                if (node) {
                    node.disabled = !node.disabled;
                    log(`Toggled disabled state for node ${nodeId}`);
                }
            });
            render();
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'c') {
            cutting = false;
            render();
        }
    });

    svg.addEventListener('mousedown', (e) => {
        mouseDown = true;
        const target = e.target;
        if (cutting) {
            const pt = svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
            cutLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            cutLine.setAttribute('x1', svgP.x);
            cutLine.setAttribute('y1', svgP.y);
            cutLine.setAttribute('x2', svgP.x);
            cutLine.setAttribute('y2', svgP.y);
            cutLine.setAttribute('class', 'edge');
            cutLine.style.stroke = 'red';
            return;
        }
        
        if (e.shiftKey) {
            if (target.classList.contains('node')) {
                e.stopPropagation();
                const nodeId = parseInt(target.dataset.id);
                if (selectedNodeIds.includes(nodeId)) {
                    selectedNodeIds = selectedNodeIds.filter(id => id !== nodeId);
                } else {
                    selectedNodeIds.push(nodeId);
                }
                log(`Toggled selection for node ${nodeId}`);
            } else if (target.classList.contains('edge')) {
                e.stopPropagation();
                const edgeIndex = parseInt(target.dataset.index);
                if (selectedEdgeIndexes.includes(edgeIndex)) {
                    selectedEdgeIndexes = selectedEdgeIndexes.filter(index => index !== edgeIndex);
                } else {
                    selectedEdgeIndexes.push(edgeIndex);
                }
                log(`Toggled selection for edge ${edgeIndex}`);
            } else {
                selecting = true;
                selectionBox.style.display = 'block';
                dragStart.x = e.clientX;
                dragStart.y = e.clientY;
                selectionBox.style.left = `${dragStart.x}px`;
                selectionBox.style.top = `${dragStart.y}px`;
                selectionBox.style.width = '0px';
                selectionBox.style.height = '0px';
                log('Started selection box');
            }
        } else if (e.button === 1 || (e.button === 0 && !target.classList.contains('node') && !target.classList.contains('resize-handle') && !target.classList.contains('connection-handle') && !target.classList.contains('edge') && !target.classList.contains('routing-handle'))) {
            panning = true;
            dragStart.x = e.clientX;
            dragStart.y = e.clientY;
            selectedNodeIds = [];
            selectedEdgeIndexes = [];
            contextMenu.style.display = 'none';
            log('Started panning');
        } else if (target.classList.contains('node')) {
            e.stopPropagation();
            const nodeId = parseInt(target.dataset.id);
            if (!selectedNodeIds.includes(nodeId)) {
                selectedNodeIds = [nodeId];
                selectedEdgeIndexes = [];
            }
            log(`Selected node ${nodeId}`);
            const node = nodes.find(n => n.id === nodeId);
            if (propertiesPanel.style.display === 'block') {
                contextNode = node;
                nodeNameInput.value = contextNode.title;
                nodeColorInput.value = contextNode.color;
            }
            if (!node.disabled) {
                dragging = true;
                draggedNodes = selectedNodeIds.map(id => nodes.find(n => n.id === id));
                const pt = svg.createSVGPoint();
                pt.x = e.clientX;
                pt.y = e.clientY;
                const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
                dragStart.x = svgP.x;
                dragStart.y = svgP.y;
                log(`Started dragging node(s)`);
            }
        } else if (target.classList.contains('resize-handle')) {
            e.stopPropagation();
            resizing = true;
            resizeDirection = target.dataset.direction;
            originalNode = { ...nodes.find(n => n.id === selectedNodeIds[0]) };
            const pt = svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
            dragStart.x = svgP.x;
            dragStart.y = svgP.y;
            log(`Started resizing node ${originalNode.id}`);
        } else if (target.classList.contains('connection-handle')) {
            e.stopPropagation();
            connecting = true;
            const nodeId = parseInt(target.dataset.nodeId);
            const socketId = parseInt(target.dataset.socketId);
            connectionStartSocket = { nodeId, socketId };
            const startNode = nodes.find(n => n.id === nodeId);
            const startSocketPos = startNode.sockets[socketId];
            tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            tempLine.setAttribute('x1', startSocketPos.x);
            tempLine.setAttribute('y1', startSocketPos.y);
            tempLine.setAttribute('x2', startSocketPos.x);
            tempLine.setAttribute('y2', startSocketPos.y);
            tempLine.setAttribute('class', 'edge');
            tempLine.setAttribute('marker-end', 'url(#arrowhead)');
            log(`Started connecting from node ${nodeId}`);
        } else if (target.classList.contains('edge')) {
            e.stopPropagation();
            const edgeIndex = parseInt(target.dataset.index);
            if (!selectedEdgeIndexes.includes(edgeIndex)) {
                selectedEdgeIndexes = [edgeIndex];
                selectedNodeIds = [];
            }
            log(`Selected edge ${edgeIndex}`);
        } else if (target.classList.contains('routing-handle')) {
            e.stopPropagation();
            draggingRoutingPoint = true;
            const edgeIndex = parseInt(target.dataset.edgeIndex);
            const pointIndex = parseInt(target.dataset.pointIndex);
            draggedRoutingPoint = { edgeIndex, pointIndex };
            log(`Started dragging routing point on edge ${edgeIndex}`);
        } else {
            selectedNodeIds = [];
            selectedEdgeIndexes = [];
        }
        render();
    });

    svg.addEventListener('mousemove', (e) => {
        if (cutting && mouseDown) {
            const pt = svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
            cutLine.setAttribute('x2', svgP.x);
            cutLine.setAttribute('y2', svgP.y);
            render();
            return;
        }
        
        if (selecting) {
            const x = Math.min(e.clientX, dragStart.x);
            const y = Math.min(e.clientY, dragStart.y);
            const width = Math.abs(e.clientX - dragStart.x);
            const height = Math.abs(e.clientY - dragStart.y);
            selectionBox.style.left = `${x}px`;
            selectionBox.style.top = `${y}px`;
            selectionBox.style.width = `${width}px`;
            selectionBox.style.height = `${height}px`;
        } else if (panning) {
            const dx = (e.clientX - dragStart.x) * (viewbox.w / window.innerWidth);
            const dy = (e.clientY - dragStart.y) * (viewbox.h / window.innerHeight);
            viewbox.x -= dx;
            viewbox.y -= dy;
            dragStart.x = e.clientX;
            dragStart.y = e.clientY;
            render();
        } else if (dragging) {
            const pt = svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
            const dx = svgP.x - dragStart.x;
            const dy = svgP.y - dragStart.y;
            draggedNodes.forEach(node => {
                node.x += dx;
                node.y += dy;
                // Update socket positions
                const socketYOffset = node.type === 'group' ? node.height / 2 + 10 : node.height / 2 + 10;
                const socketXOffset = node.type === 'group' ? node.width / 2 + 10 : node.width / 2 + 10;
                node.sockets[0] = { id: 0, x: node.x, y: node.y - socketYOffset };
                node.sockets[1] = { id: 1, x: node.x, y: node.y + socketYOffset };
                node.sockets[2] = { id: 2, x: node.x - socketXOffset, y: node.y };
                node.sockets[3] = { id: 3, x: node.x + socketXOffset, y: node.y };

                if (node.type === 'group') {
                    node.children.forEach(childId => {
                        const childNode = nodes.find(n => n.id === childId);
                        if (childNode) {
                            childNode.x += dx;
                            childNode.y += dy;
                            childNode.sockets.forEach(socket => {
                                socket.x += dx;
                                socket.y += dy;
                            });
                        }
                    });
                }
            });
            dragStart.x = svgP.x;
            dragStart.y = svgP.y;
            render();
        } else if (resizing) {
            const node = nodes.find(n => n.id === selectedNodeIds[0]);
            const pt = svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
            const dx = svgP.x - dragStart.x;
            const dy = svgP.y - dragStart.y;

            let newX = originalNode.x;
            let newY = originalNode.y;
            let newWidth = originalNode.width;
            let newHeight = originalNode.height;

            if (resizeDirection.includes('n')) {
                newHeight -= dy;
                newY += dy / 2;
            }
            if (resizeDirection.includes('s')) {
                newHeight += dy;
                newY += dy / 2;
            }
            if (resizeDirection.includes('w')) {
                newWidth -= dx;
                newX += dx / 2;
            }
            if (resizeDirection.includes('e')) {
                newWidth += dx;
                newX += dx / 2;
            }

            if (newWidth > gridSize && newHeight > gridSize) {
                node.x = newX;
                node.y = newY;
                node.width = newWidth;
                node.height = newHeight;
                // Update socket positions
                const socketYOffset = node.type === 'group' ? node.height / 2 + 10 : node.height / 2 + 10;
                const socketXOffset = node.type === 'group' ? node.width / 2 + 10 : node.width / 2 + 10;
                node.sockets[0] = { id: 0, x: node.x, y: node.y - socketYOffset };
                node.sockets[1] = { id: 1, x: node.x, y: node.y + socketYOffset };
                node.sockets[2] = { id: 2, x: node.x - socketXOffset, y: node.y };
                node.sockets[3] = { id: 3, x: node.x + socketXOffset, y: node.y };
                render();
            }
        } else if (connecting) {
            const pt = svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
            tempLine.setAttribute('x2', svgP.x);
            tempLine.setAttribute('y2', svgP.y);
            render();
        } else if (draggingRoutingPoint) {
            const edge = edges[draggedRoutingPoint.edgeIndex];
            const point = edge.points[draggedRoutingPoint.pointIndex];
            const pt = svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
            point.x = Math.round(svgP.x / gridSize) * gridSize;
            point.y = Math.round(svgP.y / gridSize) * gridSize;
            render();
        }
    });

    svg.addEventListener('mouseup', (e) => {
        mouseDown = false;
        if (dragging) {
            draggedNodes.forEach(node => {
                if (node.type !== 'group') {
                    const group = nodes.find(g => 
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
                            const parentGroup = nodes.find(g => g.id === node.parent);
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
        if (cutting) {
            const p1 = { x: parseFloat(cutLine.getAttribute('x1')), y: parseFloat(cutLine.getAttribute('y1')) };
            const p2 = { x: parseFloat(cutLine.getAttribute('x2')), y: parseFloat(cutLine.getAttribute('y2')) };
            const edgesToDelete = [];
            edges.forEach((edge, index) => {
                const sourceNode = nodes.find(n => n.id === edge.source.nodeId);
                const targetNode = nodes.find(n => n.id === edge.target.nodeId);
                if (sourceNode && targetNode) {
                    const sourceSocket = sourceNode.sockets[edge.source.socketId];
                    const targetSocket = targetNode.sockets[edge.target.socketId];
                    if (lineIntersects(p1, p2, sourceSocket, targetSocket)) {
                        edgesToDelete.push(index);
                    }
                }
            });
            if (edgesToDelete.length > 0) {
                log(`Cut ${edgesToDelete.length} edges`);
                edges = edges.filter((edge, index) => !edgesToDelete.includes(index));
            }
            cutLine = null;
        }
        if (selecting) {
            selecting = false;
            selectionBox.style.display = 'none';
            const selectionRect = selectionBox.getBoundingClientRect();
            const svgRect = svg.getBoundingClientRect();
            const selectionStart = {
                x: (selectionRect.left - svgRect.left) * (viewbox.w / svgRect.width) + viewbox.x,
                y: (selectionRect.top - svgRect.top) * (viewbox.h / svgRect.height) + viewbox.y
            };
            const selectionEnd = {
                x: (selectionRect.right - svgRect.left) * (viewbox.w / svgRect.width) + viewbox.x,
                y: (selectionRect.bottom - svgRect.top) * (viewbox.h / svgRect.height) + viewbox.y
            };

            selectedNodeIds = nodes.filter(node =>
                node.x >= selectionStart.x && node.x <= selectionEnd.x &&
                node.y >= selectionStart.y && node.y <= selectionEnd.y
            ).map(node => node.id);

            selectedEdgeIndexes = edges.filter((edge, index) => {
                const sourceNode = nodes.find(n => n.id === edge.source.nodeId);
                const targetNode = nodes.find(n => n.id === edge.target.nodeId);
                return selectedNodeIds.includes(sourceNode.id) && selectedNodeIds.includes(targetNode.id);
            }).map((edge, index) => index);
            log(`Selected ${selectedNodeIds.length} nodes and ${selectedEdgeIndexes.length} edges`);

        } else if (connecting) {
            const targetElement = document.elementFromPoint(e.clientX, e.clientY);
            if (targetElement && targetElement.classList.contains('connection-handle')) {
                const nodeId = parseInt(targetElement.dataset.nodeId);
                const socketId = parseInt(targetElement.dataset.socketId);
                const targetSocket = { nodeId, socketId };
                createEdge(connectionStartSocket, targetSocket);
            }
        }
        dragging = false;
        draggedNodes = [];
        resizing = false;
        panning = false;
        resizeDirection = null;
        originalNode = null;
        connecting = false;
        connectionStartSocket = null;
        tempLine = null;
        draggingRoutingPoint = false;
        draggedRoutingPoint = null;
        render();
    });

    svg.addEventListener('dblclick', (e) => {
        const target = e.target;
        if (target.classList.contains('edge')) {
            const edgeIndex = parseInt(target.dataset.index);
            const edge = edges[edgeIndex];
            const pt = svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
            edge.points.push({ x: svgP.x, y: svgP.y });
            log(`Added routing point to edge ${edgeIndex}`);
            render();
        }
    });

    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        const newColor = getComputedStyle(document.body).getPropertyValue('--node-fill-color');
        nodes.forEach(node => {
            node.color = newColor.trim();
        });
        log('Toggled theme');
        render();
    });

    addNodeBtn.addEventListener('click', () => {
        const x = viewbox.x + viewbox.w / 2;
        const y = viewbox.y + viewbox.h / 2;
        addNode(x, y);
    });

    addGroupBtn.addEventListener('click', () => {
        const x = viewbox.x + viewbox.w / 2;
        const y = viewbox.y + viewbox.h / 2;
        addNode(x, y, 'group');
    });

    zoomInBtn.addEventListener('click', () => {
        const newWidth = viewbox.w * 0.8;
        const newHeight = viewbox.h * 0.8;
        if (newWidth / window.innerWidth > minZoom) {
            viewbox.x += (viewbox.w - newWidth) / 2;
            viewbox.y += (viewbox.h - newHeight) / 2;
            viewbox.w = newWidth;
            viewbox.h = newHeight;
            log('Zoomed in');
            render();
        }
    });

    zoomOutBtn.addEventListener('click', () => {
        const newWidth = viewbox.w * 1.2;
        const newHeight = viewbox.h * 1.2;
        if (newWidth / window.innerWidth < maxZoom) {
            viewbox.x += (viewbox.w - newWidth) / 2;
            viewbox.y += (viewbox.h - newHeight) / 2;
            viewbox.w = newWidth;
            viewbox.h = newHeight;
            log('Zoomed out');
            render();
        }
    });

    graphContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = svg.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const svgX = viewbox.x + (mouseX / rect.width) * viewbox.w;
        const svgY = viewbox.y + (mouseY / rect.height) * viewbox.h;

        const zoomFactor = e.deltaY < 0 ? 0.9 : 1.1;
        const newWidth = viewbox.w * zoomFactor;
        const newHeight = viewbox.h * zoomFactor;

        if (newWidth / window.innerWidth > minZoom && newWidth / window.innerWidth < maxZoom) {
            viewbox.x = svgX - (mouseX / rect.width) * newWidth;
            viewbox.y = svgY - (mouseY / rect.height) * newHeight;
            viewbox.w = newWidth;
            viewbox.h = newHeight;

            render();
        }
    });

    svg.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const target = e.target;
        if (target.classList.contains('node')) {
            contextNode = nodes.find(n => n.id == target.dataset.id);
            addNodeOption.style.display = 'none';
            addGroupOption.style.display = 'none';
            renameOption.style.display = 'block';
            deleteNodeOption.style.display = 'block';
            disableNodeOption.style.display = 'block';
            propertiesOption.style.display = 'block';
            deleteEdgeOption.style.display = 'none';
            addRoutingPointOption.style.display = 'none';
        } else if (target.classList.contains('edge')) {
            contextEdge = parseInt(target.dataset.index);
            addNodeOption.style.display = 'none';
            addGroupOption.style.display = 'none';
            renameOption.style.display = 'none';
            deleteNodeOption.style.display = 'none';
            disableNodeOption.style.display = 'none';
            propertiesOption.style.display = 'none';
            deleteEdgeOption.style.display = 'block';
            addRoutingPointOption.style.display = 'block';
        } else {
            contextNode = null;
            contextEdge = null;
            addNodeOption.style.display = 'block';
            addGroupOption.style.display = 'block';
            renameOption.style.display = 'none';
            deleteNodeOption.style.display = 'none';
            disableNodeOption.style.display = 'none';
            propertiesOption.style.display = 'none';
            deleteEdgeOption.style.display = 'none';
            addRoutingPointOption.style.display = 'none';
        }
        contextMenu.style.display = 'block';
        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.style.top = `${e.clientY}px`;
    });

    addNodeOption.addEventListener('click', () => {
        const rect = svg.getBoundingClientRect();
        const pt = svg.createSVGPoint();
        pt.x = parseFloat(contextMenu.style.left) - rect.left;
        pt.y = parseFloat(contextMenu.style.top) - rect.top;
        const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
        addNode(svgP.x, svgP.y);
        contextMenu.style.display = 'none';
    });

    addGroupOption.addEventListener('click', () => {
        const rect = svg.getBoundingClientRect();
        const pt = svg.createSVGPoint();
        pt.x = parseFloat(contextMenu.style.left) - rect.left;
        pt.y = parseFloat(contextMenu.style.top) - rect.top;
        const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
        addNode(svgP.x, svgP.y, 'group');
        contextMenu.style.display = 'none';
    });

    renameOption.addEventListener('click', () => {
        if (contextNode) {
            const newName = prompt('Enter new name:', contextNode.title);
            if (newName) {
                contextNode.title = newName;
                render();
            }
        }
        contextMenu.style.display = 'none';
    });

    deleteNodeOption.addEventListener('click', () => {
        if (contextNode) {
            removeNode(contextNode);
            contextNode = null;
            contextMenu.style.display = 'none';
        }
    });

    disableNodeOption.addEventListener('click', () => {
        if (contextNode) {
            contextNode.disabled = !contextNode.disabled;
            log(`Toggled disabled state for node ${contextNode.id}`);
            contextNode = null;
            contextMenu.style.display = 'none';
            render();
        }
    });

    propertiesOption.addEventListener('click', () => {
        if (selectedNodeIds.length === 1) {
            contextNode = nodes.find(n => n.id === selectedNodeIds[0]);
        }
        if (contextNode) {
            propertiesPanel.style.display = 'block';
            nodeNameInput.value = contextNode.title;
            nodeColorInput.value = contextNode.color;
        }
        contextMenu.style.display = 'none';
    });

    deleteEdgeOption.addEventListener('click', () => {
        if (contextEdge !== null) {
            edges.splice(contextEdge, 1);
            log(`Deleted edge ${contextEdge}`);
            contextEdge = null;
            contextMenu.style.display = 'none';
            render();
        }
    });

    addRoutingPointOption.addEventListener('click', () => {
        if (contextEdge !== null) {
            const edge = edges[contextEdge];
            const sourceNode = nodes.find(n => n.id === edge.source.nodeId);
            const targetNode = nodes.find(n => n.id === edge.target.nodeId);
            if (sourceNode && targetNode) {
                const sourceSocket = sourceNode.sockets[edge.source.socketId];
                const targetSocket = targetNode.sockets[edge.target.socketId];
                const x = (sourceSocket.x + targetSocket.x) / 2;
                const y = (sourceSocket.y + targetSocket.y) / 2;
                edge.points.push({ x, y });
                log(`Added routing point to edge ${contextEdge}`);
                render();
            }
            contextEdge = null;
            contextMenu.style.display = 'none';
        }
    });

    closePropertiesBtn.addEventListener('click', () => {
        propertiesPanel.style.display = 'none';
    });

    nodeNameInput.addEventListener('input', (e) => {
        if (contextNode) {
            contextNode.title = e.target.value;
            render();
        }
    });

    nodeColorInput.addEventListener('input', (e) => {
        if (contextNode) {
            contextNode.color = e.target.value;
            render();
        }
    });

    window.addEventListener('click', (e) => {
        if (!e.target.closest('.context-menu')) {
            contextMenu.style.display = 'none';
        }
    });

    // Drag and drop file handling
    graphContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        graphContainer.style.backgroundColor = '#e0e0e0';
    });

    graphContainer.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        graphContainer.style.backgroundColor = 'transparent';
    });

    graphContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        graphContainer.style.backgroundColor = 'transparent';

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (data.nodes && data.edges) {
                        nodes = data.nodes;
                        edges = data.edges;
                        nodeIdCounter = Math.max(...nodes.map(n => n.id)) + 1;
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

    render();
});
