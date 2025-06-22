/**
 * @fileoverview Handles file operations including graph save/load, screenshots, 
 * drag & drop, and clipboard paste functionality.
 */

class FileHandler {
    /**
     * @param {NodeUI} nodeUI - Reference to the main NodeUI instance.
     */
    constructor(nodeUI) {
        this.nodeUI = nodeUI;
    }

    /**
     * Saves the current graph state to a JSON file.
     */
    saveGraph() {
        const data = {
            metadata: {
                projectName: this.nodeUI.projectName,
                thumbnailUrl: this.nodeUI.thumbnailUrl,
                contextMenuSettings: this.nodeUI.contextMenuSettings
            },
            nodes: [],
            edges: []
        };

        this.nodeUI.nodes.forEach(node => {
            const nodeData = {
                id: node.id,
                x: node.x,
                y: node.y,
                width: node.width,
                height: node.height,
                title: node.title,
                content: node.content,
                type: node.type,
                color: node.color,
                isPinned: node.isPinned
            };
            if (node instanceof GroupNode) {
                nodeData.containedNodeIds = Array.from(node.containedNodeIds);
            }

            // If node is pinned, its coords are in screen space. Convert to world space for saving.
            if (node.isPinned) {
                nodeData.x = (node.x - this.nodeUI.panZoom.offsetX) / this.nodeUI.panZoom.scale;
                nodeData.y = (node.y - this.nodeUI.panZoom.offsetY) / this.nodeUI.panZoom.scale;
                nodeData.width = node.width / this.nodeUI.panZoom.scale;
                nodeData.height = node.height / this.nodeUI.panZoom.scale;
            }

            data.nodes.push(nodeData);
        });

        this.nodeUI.edges.forEach(edge => {
            data.edges.push({
                id: edge.id,
                startNodeId: edge.startNodeId,
                endNodeId: edge.endNodeId,
                startHandleId: edge.startHandleId,
                endHandleId: edge.endHandleId,
                routingPoints: edge.routingPoints,
                type: edge.type,
                label: edge.label
            });
        });

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'graph.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log("Graph saved.");
    }

    /**
     * Loads a graph from a JSON string.
     * @param {string} json
     */
    loadGraph(json) {
        try {
            const data = JSON.parse(json);
            if (!data.nodes || !data.edges) {
                throw new Error("Invalid graph file format.");
            }

            this.nodeUI.clearAll();

            // Load metadata first, as it's independent of content
            if (data.metadata) {
                this.nodeUI.projectName = data.metadata.projectName || 'Untitled Graph';
                this.nodeUI.thumbnailUrl = data.metadata.thumbnailUrl || '';
                if(data.metadata.contextMenuSettings) {
                    this.nodeUI.contextMenuSettings = this.deepMerge(this.nodeUI.contextMenuSettings, data.metadata.contextMenuSettings);
                }
                this.nodeUI.publishSettings();
            }

            // --- Pre-calculate framing ---
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            let hasContent = false;
            if (data.nodes && data.nodes.length > 0) {
                data.nodes.forEach(node => {
                    // Only consider unpinned nodes for the initial framing calculation
                    if (!node.isPinned) {
                        minX = Math.min(minX, node.x);
                        minY = Math.min(minY, node.y);
                        maxX = Math.max(maxX, node.x + node.width);
                        maxY = Math.max(maxY, node.y + node.height);
                        hasContent = true;
                    }
                });
            }

            if (hasContent) {
                const padding = 100;
                const selectionWidth = (maxX - minX) + padding * 2;
                const selectionHeight = (maxY - minY) + padding * 2;
                const containerRect = this.nodeUI.container.getBoundingClientRect();
                
                const targetScale = Math.min(
                    containerRect.width / selectionWidth, 
                    containerRect.height / selectionHeight,
                    1.5 // Cap max zoom level
                );

                const selectionCenterX = minX + (maxX - minX) / 2;
                const selectionCenterY = minY + (maxY - minY) / 2;
                const targetOffsetX = (containerRect.width / 2) - (selectionCenterX * targetScale);
                const targetOffsetY = (containerRect.height / 2) - (selectionCenterY * targetScale);

                // Set initial state for subtle zoom-in effect
                const initialScale = targetScale * 0.9;
                this.nodeUI.panZoom.scale = initialScale;
                this.nodeUI.panZoom.offsetX = (containerRect.width / 2) - (selectionCenterX * initialScale);
                this.nodeUI.panZoom.offsetY = (containerRect.height / 2) - (selectionCenterY * initialScale);
                this.nodeUI.updateCanvasTransform();

                // Defer node creation and animation
                setTimeout(() => {
                    const idMap = new Map();
                    const nodesToPin = []; // Keep track of nodes to pin after creation

                    data.nodes.forEach(nodeData => {
                        const oldId = nodeData.id;
                        const newId = crypto.randomUUID();
                        idMap.set(oldId, newId);

                        const shouldBePinned = nodeData.isPinned;

                        // Create the node as unpinned initially
                        const newNodeData = { ...nodeData, id: newId, isPinned: false };
                        events.publish('node:create', newNodeData);

                        if (shouldBePinned) {
                            nodesToPin.push(newId);
                        }
                    });

                    this.nodeUI.nodes.forEach(node => {
                        if (node instanceof GroupNode) {
                            const newContainedIds = new Set();
                            node.containedNodeIds.forEach(oldId => {
                                const newId = idMap.get(oldId);
                                if (newId) newContainedIds.add(newId);
                            });
                            node.containedNodeIds = newContainedIds;
                        }
                    });

                    data.edges.forEach(edgeData => {
                        edgeData.startNodeId = idMap.get(edgeData.startNodeId);
                        edgeData.endNodeId = idMap.get(edgeData.endNodeId);
                        if (edgeData.startNodeId && edgeData.endNodeId) {
                            events.publish('edge:create', edgeData);
                        }
                    });

                    // After all nodes are in the DOM, pin the ones that need to be pinned.
                    // This triggers the `reparentNode` logic correctly.
                    nodesToPin.forEach(nodeId => {
                        const node = this.nodeUI.nodes.get(nodeId);
                        if (node) {
                            this.nodeUI.updateNode({ nodeId: nodeId, isPinned: true });
                        }
                    });
                    
                    this.nodeUI.animatePanZoom(targetScale, targetOffsetX, targetOffsetY, 400);
                    console.log("Graph loaded.");
                }, 10);

            } else {
                 // Reset pan and zoom if loading an empty graph
                this.nodeUI.panZoom.scale = 1;
                this.nodeUI.panZoom.offsetX = 0;
                this.nodeUI.panZoom.offsetY = 0;
                this.nodeUI.updateCanvasTransform();
            }

        } catch (error) {
            console.error("Failed to load graph:", error);
            // Optionally, publish a UI notification event here
        }
    }

    /**
     * Captures the current graph view as a Base64 PNG image using html2canvas.
     */
    async takeScreenshot() {
        console.log("Starting screenshot with html2canvas...");
        try {
            const padding = 50;

            // 1. Calculate bounding box of all non-pinned content
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            let hasContent = false;

            this.nodeUI.nodes.forEach(node => {
                if (!node.isPinned) {
                    minX = Math.min(minX, node.x);
                    minY = Math.min(minY, node.y);
                    maxX = Math.max(maxX, node.x + node.width);
                    maxY = Math.max(maxY, node.y + node.height);
                    hasContent = true;
                }
            });

            if (!hasContent) {
                console.warn("No non-pinned content to screenshot.");
                return;
            }

            // Also consider edges in the bounding box calculation
            this.nodeUI.edges.forEach(edge => {
                if(this.nodeUI.nodes.get(edge.startNodeId)?.isPinned || this.nodeUI.nodes.get(edge.endNodeId)?.isPinned) return;
                const points = [edge.startPosition, ...edge.routingPoints, edge.endPosition];
                points.forEach(p => {
                    minX = Math.min(minX, p.x);
                    minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x);
                    maxY = Math.max(maxY, p.y);
                });
            });

            // 2. Prepare for screenshot
            const captureArea = this.nodeUI.container;
            const originalScroll = { x: captureArea.scrollLeft, y: captureArea.scrollTop };
            const { scale, offsetX, offsetY } = this.nodeUI.panZoom;
            
            // The capture dimensions in world coordinates
            const captureWidth = (maxX - minX) + (padding * 2);
            const captureHeight = (maxY - minY) + (padding * 2);

            // 3. Temporarily hide non-graph elements and apply styles
            this.nodeUI.selectionState.selectionBox.style.display = 'none';
            document.querySelectorAll('.resize-handle').forEach(h => h.style.display = 'none');
            
            const canvas = await html2canvas(captureArea, {
                backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-bg-default').trim(),
                x: (minX - padding) * scale + offsetX,
                y: (minY - padding) * scale + offsetY,
                width: captureWidth * scale,
                height: captureHeight * scale,
                scale: 2 // Increase resolution
            });

            // 4. Restore UI elements
            this.nodeUI.selectionState.selectionBox.style.display = 'block';
            document.querySelectorAll('.resize-handle').forEach(h => h.style.display = '');

            // 5. Update thumbnail
            const dataUrl = canvas.toDataURL('image/png');
            this.nodeUI.thumbnailUrl = dataUrl;
            events.publish('setting:update', { key: 'thumbnailUrl', value: dataUrl });
            console.log("Screenshot captured and thumbnail updated via html2canvas.");

        } catch (error) {
            console.error("Error taking screenshot with html2canvas:", error);
        }
    }

    /**
     * Handles the dragover event for file drops.
     * @param {DragEvent} event
     */
    onDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Check if the dragged item is a file
        if (event.dataTransfer.types.includes('Files')) {
            this.nodeUI.container.classList.add('is-drop-target');
        }
    }

    /**
     * Handles the dragleave event for file drops.
     * @param {DragEvent} event
     */
    onDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        this.nodeUI.container.classList.remove('is-drop-target');
    }

    /**
     * Handles the drop event for files, supporting graph loading and image embedding.
     * @param {DragEvent} event
     */
    onDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        this.nodeUI.container.classList.remove('is-drop-target');

        if (!event.dataTransfer || !event.dataTransfer.files.length) {
            return;
        }

        const position = this.nodeUI.getMousePosition(event);

        // Process all dropped files
        Array.from(event.dataTransfer.files).forEach((file, index) => {
            const filePosition = {
                x: position.x + index * 20, // Offset subsequent files
                y: position.y + index * 20
            };

            // Handle graph loading
            if (file.type === 'application/json' || file.name.endsWith('.json')) {
                const reader = new FileReader();
                reader.onload = (e) => events.publish('graph:load-content', e.target.result);
                reader.readAsText(file);
                return;
            }

            // Handle video embedding
            if (file.type.startsWith('video/')) {
                assetDb.saveFile(file).then(fileId => {
                    const nodeWidth = 350;
                    const nodeHeight = 300;

                    events.publish('node:create', {
                        x: filePosition.x - nodeWidth / 2,
                        y: filePosition.y - nodeHeight / 2,
                        width: nodeWidth,
                        height: nodeHeight,
                        title: file.name,
                        content: `![video](local-video://${fileId})`,
                        type: 'BaseNode',
                        color: 'default'
                    });
                }).catch(error => {
                    console.error('Failed to save video to asset database:', error);
                });
                return;
            }

            // Handle image embedding
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const dataUrl = e.target.result;
                    
                    // Create an in-memory image to get its dimensions
                    const img = new Image();
                    img.onload = () => {
                        const nodeWidth = 200;
                        const contentPadding = 16;
                        const titleBarHeight = 48; 
                        const imageMarginTop = 8;
                        
                        // Calculate image aspect ratio
                        const aspectRatio = img.height / img.width;
                        const imageWidthInNode = nodeWidth - (contentPadding * 2);
                        const imageHeightInNode = imageWidthInNode * aspectRatio;

                        // Calculate total node height
                        const totalContentHeight = contentPadding + imageMarginTop + imageHeightInNode + contentPadding;
                        const nodeHeight = titleBarHeight + totalContentHeight;

                        events.publish('node:create', {
                            x: filePosition.x - nodeWidth / 2,
                            y: filePosition.y - nodeHeight / 2,
                            width: nodeWidth,
                            height: nodeHeight,
                            title: file.name,
                            content: `![${file.name}](${dataUrl})`,
                            type: 'BaseNode',
                            color: 'default'
                        });
                    };
                    img.src = dataUrl;
                };
                reader.readAsDataURL(file);
                return;
            }

            // Handle markdown file embedding
            if (file.type === 'text/markdown' || file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const markdownContent = e.target.result;
                    const nodeWidth = 200;
                    const nodeHeight = 120;

                    events.publish('node:create', {
                        x: filePosition.x - nodeWidth / 2,
                        y: filePosition.y - nodeHeight / 2,
                        width: nodeWidth,
                        height: nodeHeight,
                        title: file.name.replace(/\.(md|markdown)$/i, ''),
                        content: markdownContent,
                        type: 'BaseNode',
                        color: 'default'
                    });
                };
                reader.readAsText(file);
                return;
            }

            console.warn("Unsupported file type dropped:", file.name, file.type);
        });
    }

    /**
     * Handles pasting content from the clipboard, such as URLs.
     * @param {ClipboardEvent} event
     */
    onPaste(event) {
        // Ignore paste events if the user is editing text inside an input or a node.
        if (event.target.isContentEditable || event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }

        // Get pasted text from clipboard
        const pastedText = event.clipboardData.getData('text/plain').trim();
        if (!pastedText) return;

        // Regex to specifically check for video links (YouTube, .mp4, etc.)
        const videoUrlRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+|(\.mp4|\.webm|\.ogg)$/i;

        if (videoUrlRegex.test(pastedText)) {
            event.preventDefault(); // We're handling it, so prevent default paste.
            
            const position = this.nodeUI.getMousePosition(this.nodeUI.lastMousePosition);
            const nodeWidth = 350;
            const nodeHeight = 300; // Give it a bit more height for video controls

            events.publish('node:create', {
                x: position.x - nodeWidth / 2,
                y: position.y - nodeHeight / 2,
                width: nodeWidth,
                height: nodeHeight,
                title: 'Pasted Video',
                content: `![video](${pastedText})`,
                type: 'BaseNode',
                color: 'default' // Or a specific color for videos
            });
        }
    }

    /**
     * Deeply merges two objects. The source object's properties overwrite the target's.
     * @param {object} target The target object.
     * @param {object} source The source object.
     * @returns {object} The merged object.
     */
    deepMerge(target, source) {
        const output = { ...target };
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target)) {
                        Object.assign(output, { [key]: source[key] });
                    } else {
                        output[key] = this.deepMerge(target[key], source[key]);
                    }
                } else {
                    Object.assign(output, { [key]: source[key] });
                }
            });
        }
        return output;
    }
    
    /**
     * Utility to check if a variable is a non-null object.
     * @param {*} item The variable to check.
     * @returns {boolean}
     */
    isObject(item) {
        return (item && typeof item === 'object' && !Array.isArray(item));
    }
} 