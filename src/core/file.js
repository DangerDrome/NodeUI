/**
 * @fileoverview Handles all file operations including save/load, drag & drop, 
 * screenshots, and data persistence for the graph application.
 */

const DEFAULT_CONTEXT_MENU_SETTINGS = {
    canvas: {
        changeBackground: { label: "Background", iconClass: "icon-paint-roller" },
        cut: { label: "Cut", iconClass: "icon-scissors" },
        copy: { label: "Copy", iconClass: "icon-copy" },
        paste: { label: "Paste", iconClass: "icon-clipboard" },
        delete: { label: "Delete", iconClass: "icon-trash-2" },
        note: { label: "Note", iconClass: "icon-file-text" },
        routingNode: { label: "Router", iconClass: "icon-network" },
        group: { label: "Group", iconClass: "icon-group" },
        log: { label: "Log", iconClass: "icon-terminal" },
        settings: { label: "Settings", iconClass: "icon-settings" },
        subgraph: { label: "Subgraph", iconClass: "icon-box" },
        threejs: { label: "3D Viewport", iconClass: "icon-cube" },
        snapGrid: { label: "Grid Snap", iconClass: "icon-grid-2x2" },
        snapObject: { label: "Obj Snap", iconClass: "icon-layout-panel-left" }
    },
    edge: {
        edit: { label: "Edit Label", iconClass: "icon-edit" },
        addRoutingNode: { label: "Add Routing Node", iconClass: "icon-network" },
        delete: { label: "Delete", iconClass: "icon-trash-2" }
    }
};

/**
 * AssetDatabase class for managing IndexedDB storage of file assets.
 */
class AssetDatabase {
    constructor(dbName = 'NodeUI-Assets', storeName = 'files') {
        this.dbName = dbName;
        this.storeName = storeName;
        this.db = null;
    }

    /**
     * Opens and initializes the IndexedDB database.
     * @returns {Promise<IDBDatabase>} A promise that resolves with the database instance.
     */
    async open() {
        if (this.db) {
            return this.db;
        }
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error("IndexedDB error:", event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Saves a file to the database.
     * @param {File} file The file to save.
     * @returns {Promise<string>} A promise that resolves with the unique ID of the saved file.
     */
    async saveFile(file) {
        const db = await this.open();
        const id = crypto.randomUUID();
        const data = { id, file };

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(data);

            request.onsuccess = () => {
                resolve(id);
            };

            request.onerror = (event) => {
                console.error('Error saving file:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Retrieves a file from the database by its ID.
     * @param {string} id The unique ID of the file.
     * @returns {Promise<File>} A promise that resolves with the retrieved file.
     */
    async getFile(id) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(id);

            request.onsuccess = (event) => {
                if (event.target.result) {
                    resolve(event.target.result.file);
                } else {
                    reject(new Error(`File with id ${id} not found.`));
                }
            };

            request.onerror = (event) => {
                console.error('Error retrieving file:', event.target.error);
                reject(event.target.error);
            };
        });
    }
}

class File {
    /**
     * @param {NodeUI} nodeUI - Reference to the main NodeUI instance.
     */
    constructor(nodeUI) {
        this.nodeUI = nodeUI;
        this.assetDb = new AssetDatabase();
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
                    // Start with a fresh copy of the defaults, then merge the loaded settings on top.
                    this.nodeUI.contextMenuSettings = this.deepMerge(
                        JSON.parse(JSON.stringify(DEFAULT_CONTEXT_MENU_SETTINGS)), 
                        data.metadata.contextMenuSettings
                    );
                } else {
                    this.nodeUI.contextMenuSettings = JSON.parse(JSON.stringify(DEFAULT_CONTEXT_MENU_SETTINGS));
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
        const files = Array.from(event.dataTransfer.files);

        // Check if we have multiple image files for an image sequence
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length > 1) {
            // Create an ImageSequenceNode with multiple images
            this.createImageSequenceNode(imageFiles, position);
            return;
        }

        // Process all dropped files individually
        files.forEach((file, index) => {
            const filePosition = {
                x: position.x + index * 20, // Offset subsequent files
                y: position.y + index * 20
            };

            // Handle graph loading with overlay for JSON files
            if (file.type === 'application/json' || file.name.endsWith('.json')) {
                this.showJsonDropOverlay(file, filePosition);
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

            // Handle single image embedding (always as BaseNode, never as ImageSequenceNode)
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
     * Shows the drag-and-drop overlay for JSON files with options to replace graph or create SubGraph.
     * @param {File} file - The JSON file that was dropped.
     * @param {object} position - The drop position {x, y}.
     */
    showJsonDropOverlay(file, position) {
        // Create overlay element
        const overlay = document.createElement('div');
        overlay.className = 'drop-overlay';
        overlay.innerHTML = `
            <div class="drop-overlay-content">
                <div class="drop-overlay-title">Import Graph File</div>
                <div class="drop-overlay-subtitle">Choose how to import "${file.name}"</div>
                <div class="drop-overlay-options">
                    <div class="drop-overlay-option" data-action="replace">
                        <div class="drop-overlay-option-icon">
                            <i class="icon-refresh-cw"></i>
                        </div>
                        <div class="drop-overlay-option-text">Replace Current Graph</div>
                    </div>
                    <div class="drop-overlay-option" data-action="subgraph">
                        <div class="drop-overlay-option-icon">
                            <i class="icon-squares-subtract"></i>
                        </div>
                        <div class="drop-overlay-option-text">Create SubGraph Node</div>
                    </div>
                </div>
                <button class="drop-overlay-cancel">Cancel</button>
            </div>
        `;

        // Add event listeners
        const replaceOption = overlay.querySelector('[data-action="replace"]');
        const subgraphOption = overlay.querySelector('[data-action="subgraph"]');
        const cancelButton = overlay.querySelector('.drop-overlay-cancel');

        replaceOption.addEventListener('click', () => {
            this.handleJsonFileReplace(file);
            document.body.removeChild(overlay);
        });

        subgraphOption.addEventListener('click', () => {
            this.handleJsonFileSubGraph(file, position);
            document.body.removeChild(overlay);
        });

        cancelButton.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        // Close overlay when clicking outside
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });

        // Add to DOM
        document.body.appendChild(overlay);
    }

    /**
     * Handles replacing the current graph with the dropped JSON file.
     * @param {File} file - The JSON file to load.
     */
    handleJsonFileReplace(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            events.publish('graph:load-content', e.target.result);
        };
        reader.readAsText(file);
    }

    /**
     * Handles creating a SubGraph node from the dropped JSON file.
     * @param {File} file - The JSON file to create SubGraph from.
     * @param {object} position - The position to place the SubGraph node.
     */
    handleJsonFileSubGraph(file, position) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const graphData = JSON.parse(e.target.result);
                const subgraphId = `subgraph_${Date.now()}`;
                const subgraphPath = `subgraphs/${file.name.replace('.json', '')}_${subgraphId}.json`;
                
                // Create SubGraph node
                events.publish('node:create', {
                    x: position.x - 100, // Center the node
                    y: position.y - 60,
                    width: 200,
                    height: 120,
                    title: file.name.replace('.json', ''),
                    content: '',
                    type: 'SubGraphNode',
                    color: 'default',
                    subgraphId: subgraphId,
                    subgraphPath: subgraphPath,
                    internalGraph: graphData
                });

                // Save the SubGraph data
                events.publish('subgraph:save', {
                    path: subgraphPath,
                    data: {
                        id: subgraphId,
                        title: file.name.replace('.json', ''),
                        internalGraph: graphData,
                        exposedAttributes: [],
                        metadata: {
                            created: new Date().toISOString(),
                            lastModified: new Date().toISOString()
                        }
                    }
                });

            } catch (error) {
                console.error('Failed to parse JSON file:', error);
                alert('Invalid JSON file format');
            }
        };
        reader.readAsText(file);
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
        return item && typeof item === 'object' && !Array.isArray(item);
    }

    // --- SubGraph File Operations ---

    /**
     * Saves a SubGraph to its JSON file.
     * @param {string} path - The file path for the SubGraph.
     * @param {object} data - The SubGraph data to save.
     */
    saveSubGraph(path, data) {
        try {
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = path.split('/').pop() || 'subgraph.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            console.log(`SubGraph saved to ${path}`);
        } catch (error) {
            console.error('Failed to save SubGraph:', error);
        }
    }

    /**
     * Loads a SubGraph from its JSON file.
     * @param {string} path - The file path for the SubGraph.
     * @param {function} callback - Callback function with loaded data.
     */
    loadSubGraph(path, callback) {
        try {
            // For now, we'll use a simple file input approach
            // In a real implementation, you might want to use the File System Access API
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.style.display = 'none';
            
            input.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const data = JSON.parse(e.target.result);
                            if (callback) {
                                callback(data);
                            }
                        } catch (error) {
                            console.error('Failed to parse SubGraph file:', error);
                            if (callback) {
                                callback(null);
                            }
                        }
                    };
                    reader.readAsText(file);
                }
                document.body.removeChild(input);
            });
            
            document.body.appendChild(input);
            input.click();
        } catch (error) {
            console.error('Failed to load SubGraph:', error);
            if (callback) {
                callback(null);
            }
        }
    }

    /**
     * Creates a SubGraph file from the current selection.
     * @param {string} subgraphId - The SubGraph ID.
     * @param {string} title - The SubGraph title.
     * @returns {object} The SubGraph data.
     */
    createSubGraphFromSelection(subgraphId, title) {
        const selectedNodes = Array.from(this.nodeUI.selectedNodes);
        const selectedEdges = Array.from(this.nodeUI.selectedEdges);
        
        // Get all edges that connect selected nodes
        const internalEdges = [];
        this.nodeUI.edges.forEach(edge => {
            if (selectedNodes.includes(edge.startNodeId) && selectedNodes.includes(edge.endNodeId)) {
                internalEdges.push({
                    id: edge.id,
                    startNodeId: edge.startNodeId,
                    endNodeId: edge.endNodeId,
                    startHandle: edge.startHandle,
                    endHandle: edge.endHandle,
                    label: edge.label
                });
            }
        });

        // Create node data for selected nodes
        const nodes = selectedNodes.map(nodeId => {
            const node = this.nodeUI.nodes.get(nodeId);
            return {
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
        });

        return {
            id: subgraphId,
            title: title,
            internalGraph: {
                nodes: nodes,
                edges: internalEdges,
                canvasState: {
                    scale: 1,
                    offsetX: 0,
                    offsetY: 0
                }
            },
            exposedAttributes: [],
            metadata: {
                created: new Date().toISOString(),
                lastModified: new Date().toISOString()
            }
        };
    }

    /**
     * Creates an ImageSequenceNode from multiple image files.
     * @param {File[]} imageFiles - Array of image files.
     * @param {object} position - The drop position {x, y}.
     * @param {boolean} isSequenceDetected - Whether this was detected as part of a sequence.
     */
    createImageSequenceNode(imageFiles, position, isSequenceDetected = false) {
        // Sort files by name to ensure consistent ordering
        const sortedFiles = imageFiles.sort((a, b) => a.name.localeCompare(b.name));
        
        // Convert files to data URLs
        const imagePromises = sortedFiles.map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file);
            });
        });

        Promise.all(imagePromises).then(imageUrls => {
            // Create a descriptive title from the file names
            const baseName = sortedFiles[0].name.replace(/\.[^/.]+$/, ''); // Remove extension
            let title;
            
            if (isSequenceDetected && imageFiles.length === 1) {
                // This is a single image detected as part of a sequence
                title = `${baseName} (Sequence Frame)`;
            } else if (imageFiles.length > 1) {
                title = `${baseName} Sequence (${imageFiles.length} frames)`;
            } else {
                title = `${baseName} (Single Frame)`;
            }

            // Create the ImageSequenceNode
            events.publish('node:create', {
                x: position.x - 150, // Center the node
                y: position.y - 100,
                width: 300,
                height: 200,
                title: title,
                type: 'ImageSequenceNode',
                color: 'blue',
                imageSequence: imageUrls,
                currentFrame: 0
            });
        });
    }

    /**
     * Detects if an image filename suggests it's part of a sequence.
     * @param {string} filename - The filename to check.
     * @returns {boolean} True if the filename suggests it's part of a sequence.
     */
    isLikelySequenceImage(filename) {
        const name = filename.toLowerCase();
        
        // Common sequence patterns
        const sequencePatterns = [
            // Frame numbers with underscores: image_0001.jpg, shot_001.png
            /_[0-9]{3,4}\.[a-z]+$/,
            // Frame numbers with dashes: image-0001.jpg, shot-001.png
            /-[0-9]{3,4}\.[a-z]+$/,
            // Frame numbers with dots: image.0001.jpg, shot.001.png
            /\.[0-9]{3,4}\.[a-z]+$/,
            // Frame numbers in brackets: image[0001].jpg, shot[001].png
            /\[[0-9]{3,4}\]\.[a-z]+$/,
            // Frame numbers in parentheses: image(0001).jpg, shot(001).png
            /\([0-9]{3,4}\)\.[a-z]+$/,
            // Keywords that suggest sequences
            /(frame|shot|seq|anim|sequence|clip)[-_]?[0-9]*\.[a-z]+$/,
            // Timecode patterns: image_00_00_01_000.jpg
            /_[0-9]{2}_[0-9]{2}_[0-9]{2}_[0-9]{3}\.[a-z]+$/,
            // Simple numbered sequences: image1.jpg, shot2.png
            /[0-9]{1,4}\.[a-z]+$/
        ];
        
        return sequencePatterns.some(pattern => pattern.test(name));
    }
}

// Create a global instance for the app to use
const assetDb = new AssetDatabase();

// Attach to window for global access
window.AssetDatabase = AssetDatabase;
window.File = File; 