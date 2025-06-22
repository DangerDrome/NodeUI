/**
 * @fileoverview Handles context menu operations including menu display, 
 * edge editing, and snap settings management.
 */

class ContextMenuHandler {
    /**
     * @param {NodeUI} nodeUI - Reference to the main NodeUI instance.
     */
    constructor(nodeUI) {
        this.nodeUI = nodeUI;
    }

    /**
     * Handles the context menu event.
     * @param {MouseEvent} event 
     */
    onContextMenu(event) {
        // Only show context menu for events inside the app's containers
        const isInsideContainer = event.target.closest('#canvas-container') || event.target.closest('#pinned-node-container');
        if (!isInsideContainer) {
            return;
        }

        event.preventDefault();
        
        const target = event.target;
        const nodeElement = target.closest('.node');
        const edgeHitArea = target.closest('.edge-hit-area');
        
        if (edgeHitArea) {
            const edgeId = edgeHitArea.parentElement.querySelector('.edge').id;
            const edge = this.nodeUI.edges.get(edgeId);

            // If right-clicking on an edge that isn't part of a multi-selection,
            // clear the current selection and select just this edge.
            if (edge && !this.nodeUI.selectedEdges.has(edge.id)) {
                this.nodeUI.clearSelection();
                this.nodeUI.selectEdge(edge.id);
                events.publish('selection:changed', {
                    selectedNodeIds: Array.from(this.nodeUI.selectedNodes),
                    selectedEdgeIds: Array.from(this.nodeUI.selectedEdges)
                });
            }
            this.showEdgeContextMenu(event.clientX, event.clientY, edgeId);
        } else if (nodeElement) {
            const node = this.nodeUI.nodes.get(nodeElement.id);

            // If right-clicking on a node that isn't part of a multi-selection,
            // clear the current selection and select just this node.
            if (!this.nodeUI.selectedNodes.has(node.id)) {
                this.nodeUI.clearSelection();
                this.nodeUI.selectNode(node.id);
                events.publish('selection:changed', {
                    selectedNodeIds: Array.from(this.nodeUI.selectedNodes),
                    selectedEdgeIds: Array.from(this.nodeUI.selectedEdges)
                });
            }

            if (node instanceof RoutingNode) {
                // On right-click, cycle the color.
                this.nodeUI.cycleRoutingNodeColor(node.id);
            } else {
                // For other nodes, show the default canvas menu.
                this.showCanvasContextMenu(event.clientX, event.clientY);
            }
        } else {
            this.showCanvasContextMenu(event.clientX, event.clientY);
        }
    }

    /**
     * Shows the main canvas context menu.
     * @param {number} x The screen x-coordinate.
     * @param {number} y The screen y-coordinate.
     * @param {object|null} edgeStartInfo - Information about a pending edge connection.
     */
    showCanvasContextMenu(x, y, edgeStartInfo = null) {
        const worldPos = this.nodeUI.getMousePosition({ clientX: x, clientY: y });
        let items = [];

        // Define potential node types to create
        const nodeCreationActions = [
            { 
                key: 'note',
                type: 'BaseNode',
            },
            {
                key: 'group',
                type: 'GroupNode',
            },
            {
                key: 'routingNode',
                type: 'RoutingNode',
            },
            {
                key: 'settings',
                type: 'SettingsNode',
            },
            {
                key: 'log',
                type: 'LogNode',
            }
        ];

        nodeCreationActions.forEach(action => {
            const menuConfig = this.nodeUI.contextMenuSettings.canvas[action.key];
            if (!menuConfig) return;

            items.push({
                label: menuConfig.label,
                iconClass: menuConfig.iconClass,
                action: () => {
                    let newNode;
                    if (action.type === 'RoutingNode') {
                        newNode = new RoutingNode({ x: worldPos.x, y: worldPos.y });
                    } else if (action.type === 'GroupNode') {
                        newNode = new GroupNode({ x: worldPos.x, y: worldPos.y });
                    } else if (action.type === 'LogNode') {
                        newNode = new LogNode({ x: worldPos.x, y: worldPos.y });
                    } else if (action.type === 'SettingsNode') {
                        newNode = new SettingsNode({ x: worldPos.x, y: worldPos.y });
                    }
                    else {
                        newNode = new BaseNode({ x: worldPos.x, y: worldPos.y, title: menuConfig.label, type: action.type });
                    }
                    this.nodeUI.addNode(newNode);

                    if (edgeStartInfo) {
                        const startNode = this.nodeUI.nodes.get(edgeStartInfo.startNodeId);
                        if (startNode) {
                            const endHandlePosition = this.getOptimalHandle(startNode, newNode);
                            events.publish('edge:create', {
                                startNodeId: edgeStartInfo.startNodeId,
                                startHandleId: edgeStartInfo.startHandleId,
                                endNodeId: newNode.id,
                                endHandleId: endHandlePosition
                            });
                        }
                    }
                    if (this.nodeUI.edgeDrawingHandler.isDrawing) {
                        this.nodeUI.cancelDrawingEdge();
                    }
                }
            });
        });
        
        // Add other context menu items if not in edge-draw mode
        if (!edgeStartInfo) {
            // Background color submenu
            const backgroundSubmenu = [];
            const colors = ['default', 'red', 'green', 'blue', 'yellow', 'purple'];
            
            colors.forEach(color => {
                // The value to set for the overlay. 'transparent' for default, or the var for others.
                const finalValue = color === 'default' ? 'transparent' : `var(--color-bg-canvas-${color})`;
            
                // The color for the swatch preview. The actual color for colored ones, the base color for default.
                const swatchColorVar = color === 'default' ? '--color-bg-default' : `--color-bg-canvas-${color}`;
                
                backgroundSubmenu.push({
                    label: color.charAt(0).toUpperCase() + color.slice(1),
                    iconHtml: `<span class="context-menu-swatch" style="background-color: var(${swatchColorVar})"></span>`,
                    action: () => {
                        document.documentElement.style.setProperty('--color-bg-canvas', finalValue);
                    }
                });
            });

            // Snap settings
            items.push({ isSeparator: true });
            items.push({
                label: this.nodeUI.contextMenuSettings.canvas.changeBackground.label,
                iconClass: this.nodeUI.contextMenuSettings.canvas.changeBackground.iconClass,
                submenu: backgroundSubmenu
            });
            const snapGridLabel = `${this.nodeUI.contextMenuSettings.canvas.snapGrid.label}: ${this.nodeUI.snapToGrid ? 'On' : 'Off'}`;
            const snapObjectLabel = `${this.nodeUI.contextMenuSettings.canvas.snapObject.label}: ${this.nodeUI.snapToObjects ? 'On' : 'Off'}`;
            
            items.push(
                { 
                    label: snapGridLabel,
                    iconClass: this.nodeUI.contextMenuSettings.canvas.snapGrid.iconClass,
                    action: () => events.publish('snap:grid-toggle') 
                },
                {
                    label: snapObjectLabel,
                    iconClass: this.nodeUI.contextMenuSettings.canvas.snapObject.iconClass,
                    action: () => events.publish('snap:object-toggle')
                }
            );

            // Clipboard actions
            items.push({ isSeparator: true });
            const hasSelection = this.nodeUI.selectedNodes.size > 0 || this.nodeUI.selectedEdges.size > 0;
            const clipboardHasContent = this.nodeUI.clipboard.nodes.length > 0;
            const menu = this.nodeUI.contextMenuSettings.canvas;

            items.push({
                label: menu.cut.label,
                iconClass: menu.cut.iconClass,
                action: () => this.nodeUI.cutSelection(),
                disabled: !hasSelection
            });
            items.push({
                label: menu.copy.label,
                iconClass: menu.copy.iconClass,
                action: () => this.nodeUI.copySelection(),
                disabled: !hasSelection
            });
            items.push({
                label: menu.paste.label,
                iconClass: menu.paste.iconClass,
                action: () => this.nodeUI.paste(),
                disabled: !clipboardHasContent
            });
            items.push({
                label: menu.delete.label,
                iconClass: menu.delete.iconClass,
                action: () => this.nodeUI.deleteSelection(),
                disabled: !hasSelection
            });
        }

        this.nodeUI.contextMenu.show(x, y, items);
    }

    /**
     * Shows the context menu for a specific edge.
     * @param {number} x The screen x-coordinate.
     * @param {number} y The screen y-coordinate.
     * @param {string} edgeId The ID of the edge.
     */
    showEdgeContextMenu(x, y, edgeId) {
        const edge = this.nodeUI.edges.get(edgeId);
        if (!edge) return;

        const hasSelection = this.nodeUI.selectedNodes.size > 0 || this.nodeUI.selectedEdges.size > 0;
        const menu = this.nodeUI.contextMenuSettings.edge;

        const items = [
            {
                label: menu.edit.label,
                iconClass: menu.edit.iconClass,
                inlineEdit: true,
                initialValue: edge.label,
                onEdit: (newLabel) => {
                    events.publish('edge:update', { edgeId: edge.id, label: newLabel });
                }
            },
            {
                label: menu.addRoutingNode.label,
                iconClass: menu.addRoutingNode.iconClass,
                action: () => {
                    // Find the midpoint of the edge to place the new node
                    const p1 = edge.startPosition;
                    const p2 = edge.endPosition;
                    const midX = (p1.x + p2.x) / 2;
                    const midY = (p1.y + p2.y) / 2;

                    const routingNode = new RoutingNode({ x: midX, y: midY });
                    this.nodeUI.addNode(routingNode);
                    
                    // Create two new edges connecting to the new routing node
                    events.publish('edge:create', { startNodeId: edge.startNodeId, startHandleId: edge.startHandleId, endNodeId: routingNode.id, endHandleId: 'left' });
                    events.publish('edge:create', { startNodeId: routingNode.id, startHandleId: 'right', endNodeId: edge.endNodeId, endHandleId: edge.endHandleId });
                    
                    // Delete the original edge
                    events.publish('edge:delete', edge.id);
                }
            },
            { isSeparator: true },
            {
                label: menu.delete.label,
                iconClass: menu.delete.iconClass,
                action: () => this.nodeUI.deleteSelection(),
                disabled: !hasSelection
            }
        ];
        this.nodeUI.contextMenu.show(x, y, items);
    }

    /**
     * Creates an inline editor for an edge's label.
     * @param {BaseEdge} edge The edge to edit.
     */
    editEdgeLabel(edge) {
        if (!edge || !edge.labelElement) return;

        // Hide the SVG label
        edge.labelElement.style.visibility = 'hidden';

        // Get the position of the SVG label to place the editor
        // We use getBoundingClientRect because it gives us the final screen position after all SVG transforms
        const labelRect = edge.labelElement.getBoundingClientRect();
        const containerRect = this.nodeUI.container.getBoundingClientRect();

        // Create the editor element
        const editor = document.createElement('input');
        editor.type = 'text';
        editor.className = 'edge-label-editor';
        editor.value = edge.label || '';
        document.body.appendChild(editor);

        // Position the editor over the now-hidden SVG label
        const editorWidth = Math.max(80, labelRect.width + 20);
        editor.style.width = `${editorWidth}px`;
        editor.style.left = `${labelRect.left + (labelRect.width / 2) - (editorWidth / 2) - containerRect.left}px`;
        editor.style.top = `${labelRect.top + (labelRect.height / 2) - (editor.offsetHeight / 2) - containerRect.top}px`;
        
        editor.focus();
        editor.select();

        const finishEditing = (saveChanges) => {
            if (saveChanges) {
                const newLabel = editor.value;
                if (newLabel !== edge.label) {
                    events.publish('edge:update', { edgeId: edge.id, label: newLabel });
                }
            }
            // Cleanup
            document.body.removeChild(editor);
            edge.labelElement.style.visibility = 'visible';
        };

        // Use a one-time event listener for blur to prevent issues
        const blurHandler = () => {
            finishEditing(true);
            editor.removeEventListener('blur', blurHandler);
        };
        editor.addEventListener('blur', blurHandler);

        editor.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                finishEditing(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                finishEditing(false);
            }
        });
    }

    /**
     * Toggles the snap-to-grid functionality.
     * @param {boolean} [force] - Optional boolean to force a state.
     */
    toggleSnapToGrid(force) {
        if (typeof force === 'boolean') {
            this.nodeUI.snapToGrid = force ? 20 : 0;
        } else {
            this.nodeUI.snapToGrid = this.nodeUI.snapToGrid ? 0 : 20;
        }
        console.log(`Snap to grid is now ${this.nodeUI.snapToGrid ? 'enabled' : 'disabled'}`);
        this.nodeUI.publishSettings();
    }

    /**
     * Toggles the snap-to-objects functionality.
     * @param {boolean} [force] - Optional boolean to force a state.
     */
    toggleSnapToObjects(force) {
        if (typeof force === 'boolean') {
            this.nodeUI.snapToObjects = force;
        } else {
            this.nodeUI.snapToObjects = !this.nodeUI.snapToObjects;
        }
        console.log(`Snap to objects is now ${this.nodeUI.snapToObjects ? 'enabled' : 'disabled'}`);
        this.nodeUI.publishSettings();
    }

    /**
     * Determines the most logical handle on an end node for a new connection
     * based on the relative position of the start node.
     * @param {BaseNode} startNode The node where the edge originates.
     * @param {BaseNode} endNode The newly created node where the edge will terminate.
     * @returns {string} The handle position ('top', 'right', 'bottom', 'left').
     */
    getOptimalHandle(startNode, endNode) {
        const dx = (endNode.x + endNode.width / 2) - (startNode.x + startNode.width / 2);
        const dy = (endNode.y + endNode.height / 2) - (startNode.y + startNode.height / 2);

        if (Math.abs(dx) > Math.abs(dy)) {
            // More horizontal than vertical
            return dx > 0 ? 'left' : 'right';
        } else {
            // More vertical than horizontal
            return dy > 0 ? 'top' : 'bottom';
        }
    }
} 