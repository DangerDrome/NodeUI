/**
 * @file This file contains the main logic for nodeUI
 * @version 2.0.0
 * @summary A refactored and simplified version of the original script.
 */

class GraphEditor {
    constructor(svgId) {
        // =================================================================================================
        // Settings
        // =================================================================================================
        this.settings = {
            gridSize: 20,
            minZoom: 0.1,
            maxZoom: 2,
            defaultNodeWidth: 300,
            defaultNodeHeight: 200,
            defaultGroupWidth: 600,
            defaultGroupHeight: 500,
            defaultMarkdownNodeWidth: 400,
            defaultMarkdownNodeHeight: 300,
            groupPadding: 200,
            propertiesPanelWidth: 300,
            propertiesPanelOffset: 50,
            connectionZoneRadius: 50,
            edgeStrokeWidth: 4,
            edgeStartOffset: 10,
            bezierOffset: 50,
            bezierStraightLineDistance: 5,
            connectionHandleOffset: 15,
            arrowSize: 15,
            arrowWidth: 15,
            arrowOffset: -10,
            arrowGap: 0,
            connectionHandleSize: 6,
        };

        this.defaultSettings = { ...this.settings };

        this.defaultColors = [];

        this.fileTypes = {
            json: ['.json'],
            image: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'],
            video: ['.mp4', '.webm', '.mov', '.avi'],
            markdown: ['.md', '.markdown'],
        };
        this.allowedExtensions = Object.values(this.fileTypes).flat();

        // =================================================================================================
        // DOM Elements
        // =================================================================================================
        this.dom = {
            svg: document.getElementById(svgId),
            leftPanel: {
                panel: document.getElementById('left-panel'),
                toggleBtn: document.getElementById('left-panel-toggle'),
                fileTree: document.getElementById('file-tree'),
                loadFolderBtn: document.getElementById('load-folder-btn'),
                refreshFileTreeBtn: document.getElementById('refresh-file-tree-btn'),
                resizer: document.getElementById('left-panel-resizer'),
                dragOverlay: document.getElementById('left-panel-drag-overlay'),
            },
            bottomPanel: {
                panel: document.getElementById('bottom-panel'),
                toggleBtn: document.getElementById('bottom-panel-toggle'),
            },
            rightPanel: {
                panel: document.getElementById('right-panel'),
                toggleBtn: document.getElementById('right-panel-toggle'),
            },
            addNodeBtn: document.getElementById('add-node-btn'),
            addGroupBtn: document.getElementById('add-group-btn'),
            addMarkdownNodeBtn: document.getElementById('add-markdown-node-btn'),
            zoomInBtn: document.getElementById('zoom-in-btn'),
            zoomOutBtn: document.getElementById('zoom-out-btn'),
            zoomToSelectionBtn: document.getElementById('zoom-to-selection-btn'),
            themeToggleBtn: document.getElementById('theme-toggle-btn'),
            settingsBtn: document.getElementById('settings-btn'),
            edgeTypeSelect: document.getElementById('edge-type-select'),
            graphContainer: document.getElementById('graph-container'),
            selectionBox: document.getElementById('selection-box'),
            contextMenu: {
                menu: document.getElementById('context-menu'),
                list: document.querySelector('#context-menu ul'),
            },
            infoBar: document.getElementById('info-bar'),
            propertiesPanel: {
                panel: document.getElementById('properties-panel'),
                nodeNameInput: document.getElementById('node-name'),
                nodeColorSwatches: document.getElementById('node-color-swatches'),
                deleteBtn: document.getElementById('delete-node-btn-prop'),
            },
            settingsPanel: {
                panel: document.getElementById('settings-panel'),
                gridSize: document.getElementById('grid-size'),
                minZoom: document.getElementById('min-zoom'),
                maxZoom: document.getElementById('max-zoom'),
                defaultNodeWidth: document.getElementById('default-node-width'),
                defaultNodeHeight: document.getElementById('default-node-height'),
                defaultGroupWidth: document.getElementById('default-group-width'),
                defaultGroupHeight: document.getElementById('default-group-height'),
                groupPadding: document.getElementById('group-padding'),
                propertiesPanelWidth: document.getElementById('default-properties-width'),
                propertiesPanelOffset: document.getElementById('properties-panel-offset'),
                connectionZoneRadius: document.getElementById('connection-zone-radius'),
                connectionHandleOffset: document.getElementById('connection-handle-offset'),
                edgeStrokeWidth: document.getElementById('edge-stroke-width'),
                edgeStartOffset: document.getElementById('edge-start-offset'),
                connectionHandleSize: document.getElementById('connection-handle-size'),
                resetBtn: document.getElementById('reset-settings-btn')
            },
        };

        // =================================================================================================
        // State
        // =================================================================================================
        this.state = {
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
                didDrag: false,
                rewiring: false,
                snapping: false,
                snapToObjects: true,
            },
            dragStart: { x: 0, y: 0 },
            dragOffset: { x: 0, y: 0 },
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
            rewiringEdge: null,
            snapLines: [],
            fileHandles: new Map(),
            treeData: null,
            rootDirectoryHandle: null,
            virtualFileHandles: null,
            resolvedUrlCache: new Map(),
        };

        this.mainGroup = null;
        this.gridRect = null;
        this.zoomTimer = null;
        this.treeView = null;
        this.nodeTypes = new Map();
        this.domCache = new Map();
    }

    // =================================================================================================
    // Public API
    // =================================================================================================

    /**
     * Initializes the graph editor.
     */
    async init() {
        await this._initDB();
        await this._loadFromDB();
        this._initCanvas();
        this._initTreeView();
        this._initNodeTypes();
        this._updateDefaultColors();
        this._setupEventListeners();
        this._render();
    }

    /**
     * Reverts the graph to the previous state in the undo stack.
     */
    undo() {
        if (this.state.undoStack.length === 0) {
            this._log('Nothing to undo.');
            return;
        }

        const currentState = {
            nodes: JSON.parse(JSON.stringify(this.state.nodes)),
            edges: JSON.parse(JSON.stringify(this.state.edges)),
            nodeIdCounter: this.state.nodeIdCounter,
            actionName: this.state.undoStack[this.state.undoStack.length - 1].actionName
        };
        this.state.redoStack.push(currentState);
        
        const previousState = this.state.undoStack.pop();
        this.state.nodes = previousState.nodes;
        this.state.edges = previousState.edges;
        this.state.nodeIdCounter = previousState.nodeIdCounter;

        this.state.selectedNodeIds = [];
        this.state.selectedEdgeIndexes = [];

        this._log(`Undid: ${previousState.actionName}`);
        this._render();
    }

    /**
     * Re-applies a previously undone action from the redo stack.
     */
    redo() {
        if (this.state.redoStack.length === 0) {
            this._log('Nothing to redo.');
            return;
        }

        const currentState = {
            nodes: JSON.parse(JSON.stringify(this.state.nodes)),
            edges: JSON.parse(JSON.stringify(this.state.edges)),
            nodeIdCounter: this.state.nodeIdCounter,
            actionName: this.state.redoStack[this.state.redoStack.length - 1].actionName
        };
        this.state.undoStack.push(currentState);

        const nextState = this.state.redoStack.pop();
        this.state.nodes = nextState.nodes;
        this.state.edges = nextState.edges;
        this.state.nodeIdCounter = nextState.nodeIdCounter;

        this.state.selectedNodeIds = [];
        this.state.selectedEdgeIndexes = [];
        
        this._log(`Redid: ${nextState.actionName}`);
        this._render();
    }

    // =================================================================================================
    // Initialization
    // =================================================================================================

    /**
     * Initializes the IndexedDB database.
     */
    async _initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('NodeUIDB', 1);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('files')) {
                    db.createObjectStore('files', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('graphState')) {
                    db.createObjectStore('graphState', { keyPath: 'key' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                this._log('Database initialized.');
                resolve();
            };

            request.onerror = (event) => {
                console.error('Database error:', event.target.error);
                this._log('Error initializing database.');
                reject(event.target.error);
            };
        });
    }

    async _loadFromDB() {
        const graphState = await this._getDB('graphState', 'currentGraph');
        if (graphState) {
            this.state.nodes = graphState.nodes;
            this.state.edges = graphState.edges;
            this.state.nodeIdCounter = graphState.nodeIdCounter;
            this.state.treeData = graphState.treeData;
            this._log('Loaded graph state from database.');
        }

        const files = await this._getAllDB('files');
        if (files && files.length > 0) {
            this.state.virtualFileHandles = new Map();
            files.forEach(fileRecord => {
                this.state.virtualFileHandles.set(fileRecord.id, fileRecord.file);
            });
            this._log(`Loaded ${files.length} files from database.`);
        }
    }

    async _getDB(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async _getAllDB(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Initializes the SVG canvas, definitions, and grid.
     */
    _initCanvas() {
        const defs = this._createSVGElement('defs');
        
        // Arrowhead marker
        const marker = this._createSVGElement('marker', {
            id: 'arrowhead',
            markerWidth: this.settings.arrowSize,
            markerHeight: this.settings.arrowWidth,
            refX: this.settings.arrowSize + this.settings.arrowOffset,
            refY: this.settings.arrowWidth / 2,
            orient: 'auto',
            markerUnits: 'userSpaceOnUse',
        });
        const polygon = this._createSVGElement('polygon', { points: `0 0, ${this.settings.arrowSize} ${this.settings.arrowWidth / 2}, 0 ${this.settings.arrowWidth}` });
        polygon.style.fill = 'var(--arrow-color)';
        marker.appendChild(polygon);
        defs.appendChild(marker);

        // Grid pattern
        const pattern = this._createSVGElement('pattern', {
            id: 'grid',
            width: this.settings.gridSize,
            height: this.settings.gridSize,
            patternUnits: 'userSpaceOnUse',
        });
        const path = this._createSVGElement('path', {
            d: `M ${this.settings.gridSize/2 - 2} ${this.settings.gridSize/2} L ${this.settings.gridSize/2 + 2} ${this.settings.gridSize/2} M ${this.settings.gridSize/2} ${this.settings.gridSize/2 - 2} L ${this.settings.gridSize/2} ${this.settings.gridSize/2 + 2}`,
            fill: 'none',
            stroke: 'var(--grid-stroke-color)',
            'stroke-width': '1',
        });
        pattern.appendChild(path);
        defs.appendChild(pattern);
        this.dom.svg.appendChild(defs);
        this._createArrowMarker();

        // Grid background
        this.gridRect = this._createSVGElement('rect', { fill: 'url(#grid)' });
        this.dom.svg.appendChild(this.gridRect);
        
        this.mainGroup = this._createSVGElement('g');
        this.dom.svg.appendChild(this.mainGroup);

        this._updateView();
    }

    _createArrowMarker() {
        const marker = this._createSVGElement('marker', {
            id: 'arrowhead',
            markerWidth: this.settings.arrowSize,
            markerHeight: this.settings.arrowWidth,
            refX: this.settings.arrowSize + this.settings.arrowOffset,
            refY: this.settings.arrowWidth / 2,
            orient: 'auto',
            markerUnits: 'userSpaceOnUse',
        });
        const polygon = this._createSVGElement('polygon', { points: `0 0, ${this.settings.arrowSize} ${this.settings.arrowWidth / 2}, 0 ${this.settings.arrowWidth}` });
        polygon.style.fill = 'var(--arrow-color)';
        marker.appendChild(polygon);
        this.dom.svg.appendChild(marker);
    }

    _initNodeTypes() {
        // Register built-in types
        this.registerNodeType({
            type: 'default',
            title: 'Node',
            icon: 'box',
            properties: {}
        });
        this.registerNodeType({
            type: 'group',
            title: 'Group',
            icon: 'box-select',
            properties: {}
        });

        // Register custom node types defined in other files
        if (window.nodeDefinitions) {
            window.nodeDefinitions.forEach(nodeDef => {
                this.registerNodeType(nodeDef);
            });
        }
    }

    /**
     * Sets up all event listeners for the application.
     */
    _setupEventListeners() {
        // Keyboard
        document.addEventListener('keydown', this._handleKeyDown.bind(this));
        document.addEventListener('keyup', this._handleKeyUp.bind(this));

        // Mouse on SVG
        this.dom.svg.addEventListener('mousedown', this._handleMouseDown.bind(this));
        this.dom.svg.addEventListener('mousemove', this._handleMouseMove.bind(this));
        this.dom.svg.addEventListener('mouseup', this._handleMouseUp.bind(this));
        this.dom.svg.addEventListener('dblclick', this._handleDoubleClick.bind(this));
        this.dom.svg.addEventListener('contextmenu', this._handleContextMenu.bind(this));

        // Zoom/Wheel
        this.dom.graphContainer.addEventListener('wheel', this._handleWheel.bind(this));

        // UI Buttons
        this.dom.addNodeBtn.addEventListener('click', () => {
            const { x, y, w, h } = this.state.viewbox;
            this._addNode(x + w / 2, y + h / 2);
        });
        this.dom.leftPanel.toggleBtn.addEventListener('click', this._toggleLeftPanel.bind(this));
        this.dom.leftPanel.resizer.addEventListener('mousedown', this._startResizeLeftPanel.bind(this));
        this.dom.leftPanel.refreshFileTreeBtn.addEventListener('click', () => this._refreshFileTree());
        document.getElementById('import-graph-btn').addEventListener('click', () => this._importGraph());
        document.getElementById('export-graph-btn').addEventListener('click', () => this._exportGraph());
        this.dom.bottomPanel.toggleBtn.addEventListener('click', this._toggleBottomPanel.bind(this));
        this.dom.rightPanel.toggleBtn.addEventListener('click', this._toggleRightPanel.bind(this));
        this.dom.addGroupBtn.addEventListener('click', () => {
            const { x, y, w, h } = this.state.viewbox;
            this._addNode(x + w / 2, y + h / 2, 'group');
        });
        this.dom.addMarkdownNodeBtn.addEventListener('click', () => {
            const { x, y, w, h } = this.state.viewbox;
            this._addNode(x + w / 2, y + h / 2, 'markdown-node');
        });
        this.dom.zoomInBtn.addEventListener('click', () => this._zoom(0.8));
        this.dom.zoomOutBtn.addEventListener('click', () => this._zoom(1.2));
        this.dom.zoomToSelectionBtn.addEventListener('click', () => this._zoomToSelected());
        this.dom.themeToggleBtn.addEventListener('click', this._toggleTheme.bind(this));
        this.dom.settingsBtn.addEventListener('click', () => this._toggleSettingsPanel());
        this.dom.edgeTypeSelect.addEventListener('change', this._handleChangeEdgeType.bind(this));
        this.dom.leftPanel.loadFolderBtn.addEventListener('click', () => this._loadFolder());

        // Context Menu
        this._setupContextMenuListeners();
        
        // Properties Panel
        this._setupPropertiesPanelListeners();
        
        // Settings Panel
        this._setupSettingsPanelListeners();
        
        // Global Click
        window.addEventListener('click', (e) => {
            if (this.dom.contextMenu.menu.style.display === 'block' && !e.target.closest('#context-menu')) {
                this._hideContextMenu();
            }
        }, true);
        
        // Drag and Drop
        this._setupFileTreeDragAndDrop();

        // Canvas drag and drop
        this.dom.graphContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.dom.graphContainer.classList.add('dragover');
        });

        this.dom.graphContainer.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.dom.graphContainer.classList.remove('dragover');
        });

        this.dom.graphContainer.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.dom.graphContainer.classList.remove('dragover');

            // Handle internal file tree drag
            const nodeuiFilesData = e.dataTransfer.getData('application/nodeuifiles');
            if (nodeuiFilesData) {
                try {
                    const files = JSON.parse(nodeuiFilesData);
                    if (files.length === 0) return;

                    const dropPoint = this._getSVGCoords(e);
                    
                    if (files.length === 1) {
                        await this._activateFile(files[0].id, dropPoint);
                    } else {
                        const PADDING = 300;
                        const nodeWidth = this.settings.defaultMarkdownNodeWidth;
                        const nodeHeight = this.settings.defaultMarkdownNodeHeight;
                        
                        const numFiles = files.length;
                        const cols = Math.ceil(Math.sqrt(numFiles));
                        
                        for (let i = 0; i < files.length; i++) {
                            const file = files[i];
                            const row = Math.floor(i / cols);
                            const col = i % cols;
                    
                            const x = dropPoint.x + col * (nodeWidth + PADDING);
                            const y = dropPoint.y + row * (nodeHeight + PADDING);
                            
                            await this._activateFile(file.id, { x, y });
                        }
                    }
                } catch (error) {
                    console.error('Could not handle dropped file(s) from tree:', error);
                    this._log('Error dropping file(s) from tree.');
                }
                return;
            }

            // This is different from the file tree drop, we handle files directly
            let file;
            if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
                const item = e.dataTransfer.items[0];
                if (item.kind === 'file') {
                    file = item.getAsFile();
                }
            } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                file = e.dataTransfer.files[0];
            }

            if (file) {
                this._handleDroppedFileOnCanvas(file, e.clientX, e.clientY);
            }
        });
    }

    _setupFileTreeDragAndDrop() {
        const dropZone = this.dom.leftPanel.panel;
        const overlay = this.dom.leftPanel.dragOverlay;

        const showOverlay = () => overlay.style.display = 'flex';
        const hideOverlay = () => overlay.style.display = 'none';

        let dragEnterCounter = 0;

        dropZone.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const isInternalDrag = e.dataTransfer.types.includes('application/nodeuifile');
            const hasFiles = e.dataTransfer.types.includes('Files');
            
            if (!isInternalDrag && hasFiles) {
                if (dragEnterCounter === 0) {
                    showOverlay();
                }
                dragEnterCounter++;
            }
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            dragEnterCounter--;
            if (dragEnterCounter === 0) {
                hideOverlay();
            }
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            hideOverlay();
            dragEnterCounter = 0;
            
            if (!e.dataTransfer) return;

            const isInternalDrag = e.dataTransfer.types.includes('application/nodeuifile');
            if (isInternalDrag) return;

            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                let filesAdded = 0;
                for (const file of files) {
                    const extension = `.${file.name.split('.').pop().toLowerCase()}`;
                    
                    if (this.allowedExtensions.includes(extension)) {
                        let fileType = 'file';
                        for (const type in this.fileTypes) {
                            if (this.fileTypes[type].includes(extension)) {
                                fileType = type;
                                break;
                            }
                        }
                        this._addFileToTree(file, fileType);
                        filesAdded++;
                    }
                }
                if (filesAdded > 0) {
                    this._log(`Added ${filesAdded} file(s) to the project.`);
                }
            }
        });
    }

    _toggleLeftPanel() {
        const panel = this.dom.leftPanel.panel;
        const icon = this.dom.leftPanel.toggleBtn.querySelector('i');
        panel.classList.toggle('open');
        const isOpen = panel.classList.contains('open');
        icon.setAttribute('data-lucide', isOpen ? 'chevron-left' : 'chevron-right');
        lucide.createIcons({ nodes: [this.dom.leftPanel.toggleBtn] });
    }

    _toggleRightPanel() {
        const panel = this.dom.rightPanel.panel;
        panel.classList.toggle('open');
        const isOpen = panel.classList.contains('open');

        const icon = this.dom.rightPanel.toggleBtn.querySelector('i');
        icon.setAttribute('data-lucide', isOpen ? 'chevron-right' : 'chevron-left');
        lucide.createIcons({ nodes: [this.dom.rightPanel.toggleBtn] });
        
        if (isOpen) {
            this._loadSettingsToUI();
        }
    }

    _toggleBottomPanel() {
        const panel = this.dom.bottomPanel.panel;
        const icon = this.dom.bottomPanel.toggleBtn.querySelector('i');
        panel.classList.toggle('open');
        const isOpen = panel.classList.contains('open');
        icon.setAttribute('data-lucide', isOpen ? 'chevron-down' : 'chevron-up');
        lucide.createIcons({ nodes: [this.dom.bottomPanel.toggleBtn] });
    }

    _setupContextMenuListeners() {
        const handlers = {
            'add-node-option': () => this._handleContextMenuAddNode(),
            'add-group-option-context': () => this._handleContextMenuAddNode('group'),
            'add-markdown-node-option-context': () => this._handleContextMenuAddNode('markdown-node'),
            'delete-node-option': () => this._handleContextMenuDeleteNode(),
            'lock-node-option': () => this._handleContextMenuLockNode(),
            'delete-edge-option': () => this._handleContextMenuDeleteEdge(),
            'add-routing-point-option': () => this._handleContextMenuAddRoutingPoint(),
            'group-option': () => this._handleContextMenuGroup(),
            'toggle-snap-option': () => this._handleContextMenuToggleSnap(),
            'toggle-snap-obj-option': () => this._handleContextMenuToggleSnapToObjects(),
        };

        Object.entries(handlers).forEach(([id, handler]) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('click', handler.bind(this));
            }
        });
    }
    
    _setupPropertiesPanelListeners() {
        this.dom.propertiesPanel.deleteBtn.addEventListener('click', () => {
            if (this.state.contextNode) {
                this._removeNode(this.state.contextNode);
            }
        });

        this.dom.propertiesPanel.nodeNameInput.addEventListener('input', (e) => {
            if (this.state.contextNode) {
                this.state.contextNode.title = e.target.value;
                this._render();
            }
        });
        this.dom.propertiesPanel.nodeNameInput.addEventListener('focus', () => {
            if (this.state.contextNode) {
                this.state.contextNode.preEditTitle = this.state.contextNode.title;
            }
        });
        this.dom.propertiesPanel.nodeNameInput.addEventListener('blur', () => {
            if (this.state.contextNode && this.state.contextNode.preEditTitle !== this.state.contextNode.title) {
                this._saveStateForUndo('Rename Node');
                delete this.state.contextNode.preEditTitle;
                this._saveGraphStateToDB();
            }
        });
    }

    _toggleSettingsPanel() {
        this._toggleRightPanel();
    }

    _loadSettingsToUI() {
        for (const key in this.dom.settingsPanel) {
            if (key !== 'panel' && this.settings.hasOwnProperty(key)) {
                if (this.dom.settingsPanel[key]) {
                    this.dom.settingsPanel[key].value = this.settings[key];
                }
            }
        }
    }

    _setupSettingsPanelListeners() {
        this.dom.settingsPanel.resetBtn.addEventListener('click', () => this._resetSettingsToDefault());

        const setupListener = (element, settingKey, isRender, isUpdateView) => {
            if (!element) return;
            element.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value)) {
                    this.settings[settingKey] = value;
                    this._log(`Set ${settingKey} to ${value}`);
                    if (settingKey === 'gridSize') {
                        const pattern = document.getElementById('grid');
                        if (pattern) {
                            pattern.setAttribute('width', value);
                            pattern.setAttribute('height', value);
                            const path = pattern.querySelector('path');
                            if (path) {
                                path.setAttribute('d', `M ${value/2 - 2} ${value/2} L ${value/2 + 2} ${value/2} M ${value/2} ${value/2 - 2} L ${value/2} ${value/2 + 2}`);
                            }
                        }
                    }
                    if(settingKey === 'edgeStrokeWidth') {
                        document.documentElement.style.setProperty('--edge-stroke-width', `${value}px`);
                    }
                    if (isRender) this._render();
                    if (isUpdateView) this._updateView();
                }
            });
        };

        setupListener(this.dom.settingsPanel.gridSize, 'gridSize', false, true);
        setupListener(this.dom.settingsPanel.minZoom, 'minZoom');
        setupListener(this.dom.settingsPanel.maxZoom, 'maxZoom');
        setupListener(this.dom.settingsPanel.defaultNodeWidth, 'defaultNodeWidth');
        setupListener(this.dom.settingsPanel.defaultNodeHeight, 'defaultNodeHeight');
        setupListener(this.dom.settingsPanel.defaultGroupWidth, 'defaultGroupWidth');
        setupListener(this.dom.settingsPanel.defaultGroupHeight, 'defaultGroupHeight');
        setupListener(this.dom.settingsPanel.groupPadding, 'groupPadding');
        setupListener(this.dom.settingsPanel.propertiesPanelWidth, 'propertiesPanelWidth', true);
        setupListener(this.dom.settingsPanel.propertiesPanelOffset, 'propertiesPanelOffset', true);
        setupListener(this.dom.settingsPanel.connectionZoneRadius, 'connectionZoneRadius', true);
        setupListener(this.dom.settingsPanel.connectionHandleOffset, 'connectionHandleOffset', true);
        setupListener(this.dom.settingsPanel.edgeStrokeWidth, 'edgeStrokeWidth', true);
        setupListener(this.dom.settingsPanel.edgeStartOffset, 'edgeStartOffset', true);
        setupListener(this.dom.settingsPanel.connectionHandleSize, 'connectionHandleSize', true);
    }

    _setupDragAndDropListeners() {
        const container = this.dom.graphContainer;
        container.addEventListener('dragover', e => {
            e.preventDefault();
            e.stopPropagation();
            container.style.backgroundColor = '#e0e0e0';
        });
        container.addEventListener('dragleave', e => {
            e.preventDefault();
            e.stopPropagation();
            container.style.backgroundColor = 'transparent';
        });
        container.addEventListener('drop', e => {
            e.preventDefault();
            e.stopPropagation();
            container.style.backgroundColor = 'transparent';
            this._handleFileDrop(e);
        });
    }
    
    // =================================================================================================
    // State Management
    // =================================================================================================

    /**
     * Saves the current graph state for undo functionality.
     * @param {string} actionName - A description of the action being performed.
     */
    _saveStateForUndo(actionName) {
        const currentState = {
            nodes: JSON.parse(JSON.stringify(this.state.nodes)),
            edges: JSON.parse(JSON.stringify(this.state.edges)),
            nodeIdCounter: this.state.nodeIdCounter,
            actionName: actionName
        };
        this.state.undoStack.push(currentState);
        this.state.redoStack = [];
    }

    // =================================================================================================
    // Core Actions
    // =================================================================================================

    _addNode(x, y, type = 'default') {
        this._saveStateForUndo(`Add ${type}`);

        const nodeDef = this.nodeTypes.get(type) || this.nodeTypes.get('default');

        const snappedX = this.state.interaction.snapping ? Math.round(x / this.settings.gridSize) * this.settings.gridSize : x;
        const snappedY = this.state.interaction.snapping ? Math.round(y / this.settings.gridSize) * this.settings.gridSize : y;
        
        let width, height;
        if (type === 'group') {
            width = this.settings.defaultGroupWidth;
            height = this.settings.defaultGroupHeight;
        } else if (type === 'markdown-node') {
            width = this.settings.defaultMarkdownNodeWidth;
            height = this.settings.defaultMarkdownNodeHeight;
        } else {
            width = this.settings.defaultNodeWidth;
            height = this.settings.defaultNodeHeight;
        }
        
        this.state.nodeIdCounter++;
        const newNode = {
            id: this.state.nodeIdCounter,
            x: snappedX,
            y: snappedY,
            width,
            height,
            locked: false,
            title: `${nodeDef.title} ${this.state.nodeIdCounter}`,
            icon: nodeDef.icon,
            type: type,
            properties: JSON.parse(JSON.stringify(nodeDef.properties || {})),
            children: type === 'group' ? [] : undefined,
            parent: undefined,
            color: getComputedStyle(document.body).getPropertyValue('--node-fill-color').trim(),
            sockets: [],
        };

        if (nodeDef.onNodeCreated) {
            nodeDef.onNodeCreated(newNode);
        }

        this._updateNodeSockets(newNode);
        this.state.nodes.push(newNode);
        this._log(`Added ${type} ${newNode.id}`);
        this._saveGraphStateToDB();
        this._render();
        return newNode;
    }

    _removeNode(nodeToRemove) {
        this._saveStateForUndo('Remove Node');
        
        // --- Cache Cleanup Hook ---
        const nodeDef = this.nodeTypes.get(nodeToRemove.type);
        if (nodeDef && nodeDef.onNodeRemoved) {
            nodeDef.onNodeRemoved(nodeToRemove);
        }
        // -------------------------

        this.state.nodes = this.state.nodes.filter(node => node.id !== nodeToRemove.id);
        this.state.edges = this.state.edges.filter(edge => edge.source.nodeId !== nodeToRemove.id && edge.target.nodeId !== nodeToRemove.id);
        this._log(`Removed node ${nodeToRemove.id}`);
        this._saveGraphStateToDB();
        this._render();
    }

    _createEdge(sourceSocket, targetSocket) {
        if (sourceSocket.nodeId === targetSocket.nodeId) return;

        const edgeExists = this.state.edges.some(edge =>
            (edge.source.nodeId === sourceSocket.nodeId && edge.source.socketId === sourceSocket.socketId &&
             edge.target.nodeId === targetSocket.nodeId && edge.target.socketId === targetSocket.socketId) ||
            (edge.source.nodeId === targetSocket.nodeId && edge.source.socketId === targetSocket.socketId &&
             edge.target.nodeId === sourceSocket.nodeId && edge.target.socketId === sourceSocket.socketId)
        );

        if (!edgeExists) {
            this._saveStateForUndo('Create Edge');
            this.state.edges.push({ source: sourceSocket, target: targetSocket, type: this.dom.edgeTypeSelect.value, points: [] });
            this._log(`Created edge between node ${sourceSocket.nodeId} and node ${targetSocket.nodeId}`);
            this._saveGraphStateToDB();
        }
    }

    _copySelected() {
        if (this.state.selectedNodeIds.length === 0) {
            this.state.clipboard = null;
            return;
        }

        const selectedNodes = this.state.nodes.filter(node => this.state.selectedNodeIds.includes(node.id));
        const copiedNodes = JSON.parse(JSON.stringify(selectedNodes));
        const copiedNodeIds = copiedNodes.map(n => n.id);

        const containedEdges = this.state.edges.filter(edge =>
            copiedNodeIds.includes(edge.source.nodeId) &&
            copiedNodeIds.includes(edge.target.nodeId)
        );
        const copiedEdges = JSON.parse(JSON.stringify(containedEdges));

        const basePosition = copiedNodes.reduce((acc, node) => ({
            x: Math.min(acc.x, node.x),
            y: Math.min(acc.y, node.y)
        }), { x: Infinity, y: Infinity });

        this.state.clipboard = {
            nodes: copiedNodes,
            edges: copiedEdges,
            basePosition,
        };
        
        this._log(`Copied ${copiedNodes.length} nodes and ${copiedEdges.length} edges.`);
    }

    _paste() {
        if (!this.state.clipboard) return;

        this._saveStateForUndo('Paste Nodes');

        const { nodes: copiedNodes, edges: copiedEdges, basePosition } = this.state.clipboard;
        
        const mouseX = this.state.mousePosition.x;
        const mouseY = this.state.mousePosition.y;

        const pastePosition = {
            x: this.state.interaction.snapping ? Math.round(mouseX / this.settings.gridSize) * this.settings.gridSize : mouseX,
            y: this.state.interaction.snapping ? Math.round(mouseY / this.settings.gridSize) * this.settings.gridSize : mouseY,
        };

        const idMap = new Map();
        const newNodes = [];
        const newSelectedIds = [];

        copiedNodes.forEach(copiedNode => {
            const newNode = JSON.parse(JSON.stringify(copiedNode));
            const oldId = newNode.id;
            
            this.state.nodeIdCounter++;
            newNode.id = this.state.nodeIdCounter;
            newNode.title = `${newNode.title} copy`;
            idMap.set(oldId, newNode.id);

            newNode.x = pastePosition.x + (copiedNode.x - basePosition.x);
            newNode.y = pastePosition.y + (copiedNode.y - basePosition.y);
            
            this._updateNodeSockets(newNode);

            newNodes.push(newNode);
            newSelectedIds.push(newNode.id);
        });

        newNodes.forEach(newNode => {
            if (newNode.parent !== undefined) {
                newNode.parent = idMap.get(newNode.parent);
            }
            if (newNode.type === 'group' && newNode.children) {
                newNode.children = newNode.children.map(childId => idMap.get(childId)).filter(id => id !== undefined);
            }
        });

        const newEdges = copiedEdges.map(copiedEdge => {
            const newEdge = JSON.parse(JSON.stringify(copiedEdge));
            newEdge.source.nodeId = idMap.get(newEdge.source.nodeId);
            newEdge.target.nodeId = idMap.get(newEdge.target.nodeId);
            return newEdge;
        });

        this.state.selectedNodeIds = newSelectedIds;
        this.state.selectedEdgeIndexes = [];

        this.state.nodes.push(...newNodes);
        this.state.edges.push(...newEdges);

        this._log(`Pasted ${newNodes.length} nodes and ${newEdges.length} edges.`);
        this._saveGraphStateToDB();
        this._render();
    }
    
    _cutSelected() {
        if (this.state.selectedNodeIds.length === 0) {
            this._log("Select nodes to cut.");
            return;
        }

        this._saveStateForUndo('Cut Selection');

        // Logic from _copySelected to populate clipboard without logging
        const selectedNodes = this.state.nodes.filter(node => this.state.selectedNodeIds.includes(node.id));
        const copiedNodes = JSON.parse(JSON.stringify(selectedNodes));
        const copiedNodeIds = copiedNodes.map(n => n.id);

        const containedEdges = this.state.edges.filter(edge =>
            copiedNodeIds.includes(edge.source.nodeId) &&
            copiedNodeIds.includes(edge.target.nodeId)
        );
        const copiedEdges = JSON.parse(JSON.stringify(containedEdges));

        const basePosition = copiedNodes.reduce((acc, node) => ({
            x: Math.min(acc.x, node.x),
            y: Math.min(acc.y, node.y)
        }), { x: Infinity, y: Infinity });

        this.state.clipboard = {
            nodes: copiedNodes,
            edges: copiedEdges,
            basePosition,
        };
        
        const nodesCutCount = copiedNodes.length;
        const edgesCutCount = copiedEdges.length;

        // Call delete without it saving to undo stack or logging
        this._deleteSelected(false);
        
        this._log(`Cut ${nodesCutCount} nodes and ${edgesCutCount} edges.`);
        this._saveGraphStateToDB();
    }
    
    _groupSelectedNodes() {
        if (this.state.selectedNodeIds.length <= 1) return;

        this._saveStateForUndo('Group Nodes');

        const selectedNodes = this.state.nodes.filter(node => this.state.selectedNodeIds.includes(node.id));

        const bounds = selectedNodes.reduce((acc, node) => ({
            minX: Math.min(acc.minX, node.x - node.width / 2),
            minY: Math.min(acc.minY, node.y - node.height / 2),
            maxX: Math.max(acc.maxX, node.x + node.width / 2),
            maxY: Math.max(acc.maxY, node.y + node.height / 2),
        }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
        
        const padding = this.settings.groupPadding;
        const groupWidth = bounds.maxX - bounds.minX + padding * 2;
        const groupHeight = bounds.maxY - bounds.minY + padding * 2;
        const groupX = bounds.minX + groupWidth / 2 - padding;
        const groupY = bounds.minY + groupHeight / 2 - padding;
        
        const newGroup = this._addNode(groupX, groupY, 'group');
        newGroup.width = groupWidth;
        newGroup.height = groupHeight;
        this._updateNodeSockets(newGroup);

        selectedNodes.forEach(node => {
            node.parent = newGroup.id;
            newGroup.children.push(node.id);
        });

        this.state.selectedNodeIds = [newGroup.id];
        this.state.selectedEdgeIndexes = [];

        this._log(`Grouped ${selectedNodes.length} nodes into new group ${newGroup.id}.`);
        this._saveGraphStateToDB();
        this._render();
    }

    /**
     * Updates a node's socket positions based on its current geometry.
     * @param {object} node - The node to update.
     */
    _updateNodeSockets(node) {
        const { x, y, width, height } = node;
        const { connectionHandleOffset } = this.settings;
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        
        node.sockets = [
            { id: 0, x, y: y - halfHeight - connectionHandleOffset }, // Top
            { id: 1, x, y: y + halfHeight + connectionHandleOffset }, // Bottom
            { id: 2, x: x - halfWidth - connectionHandleOffset, y },   // Left
            { id: 3, x: x + halfWidth + connectionHandleOffset, y },    // Right
        ];
    }
    
    // =================================================================================================
    // Rendering
    // =================================================================================================

    _render() {
        if (!this.mainGroup) return;
        this.mainGroup.innerHTML = '';

        this._renderNodes();
        this._renderEdges();
        
        this.state.snapLines.forEach(line => this.mainGroup.appendChild(line));
        
        if (this.state.tempLine) this.mainGroup.appendChild(this.state.tempLine);
        if (this.state.cutLine) this.mainGroup.appendChild(this.state.cutLine);

        this.dom.svg.style.cursor = this.state.interaction.cutting ? 'crosshair' : '';
    }
    
    _renderNodes() {
        const visibleNodeIds = this._getVisibleNodeIds();
        const sortedNodes = [...this.state.nodes]
            .filter(node => visibleNodeIds.has(node.id))
            .sort((a, b) => this._compareNodesForRender(a, b));

        sortedNodes.forEach(node => {
            const nodeGroup = this._createSVGElement('g', { class: 'node-group' });

            this._createNodeHoverRect(node, nodeGroup);
            this._createNodeRect(node, nodeGroup);
            this._createNodeContent(node, nodeGroup);

            if (!node.locked) {
                this._createResizeHandles(node, nodeGroup);
                this._createConnectionHandles(node, nodeGroup);
            }
            
            this.mainGroup.appendChild(nodeGroup);
        });

        // By scoping createIcons to the mainGroup, we avoid a full-document scan,
        // which becomes very slow when a large file tree is loaded.
        lucide.createIcons({ nodes: [this.mainGroup] });
        this._updatePropertiesPanel();
    }
    
    _renderEdges() {
        const visibleNodeIds = this._getVisibleNodeIds();
        
        this.state.edges.forEach((edge, index) => {
            if (!visibleNodeIds.has(edge.source.nodeId) && !visibleNodeIds.has(edge.target.nodeId)) {
                return; // Skip edge if both nodes are off-screen
            }

            const sourceNode = this.state.nodes.find(node => node.id === edge.source.nodeId);
            const targetNode = this.state.nodes.find(node => node.id === edge.target.nodeId);

            if (sourceNode && targetNode) {
                const sourceSocket = sourceNode.sockets[edge.source.socketId];
                const originalTargetSocket = targetNode.sockets[edge.target.socketId];
                
                let d = this._calculateEdgePath(edge, sourceSocket, originalTargetSocket);

                // Hitbox for easier selection
                const edgeHitbox = this._createSVGElement('path', { d, class: 'edge-hitbox edge', 'data-index': index });
                this.mainGroup.appendChild(edgeHitbox);
                
                // Visible edge
                const edgeElement = this._createSVGElement('path', {
                    d,
                    fill: 'none',
                    class: `edge ${this.state.selectedEdgeIndexes.includes(index) ? 'selected' : ''} ${this.state.interaction.cutting ? 'cuttable' : ''}`,
                    'data-index': index,
                    'marker-end': 'url(#arrowhead)',
                });
                this.mainGroup.appendChild(edgeElement);
                
                // Routing handles
                edge.points.forEach((point, pointIndex) => {
                    const handle = this._createSVGElement('circle', {
                        cx: point.x,
                        cy: point.y,
                        r: 5,
                        class: 'routing-handle',
                        'data-edge-index': index,
                        'data-point-index': pointIndex,
                    });
                    this.mainGroup.appendChild(handle);
                });
            }
        });

        lucide.createIcons({ nodes: [this.dom.leftPanel.toggleBtn] });
    }

    _calculateEdgePath(edge, sourceSocket, originalTargetSocket) {
        const { arrowGap, bezierStraightLineDistance, edgeStartOffset } = this.settings;
        
        const startPoint = this._getStraightPoint(sourceSocket, edge.source.socketId, edgeStartOffset);

        let gappedTargetSocket = { ...originalTargetSocket };

        // Calculate gap for arrowhead
        const lastPoint = edge.points.length > 0 ? edge.points[edge.points.length - 1] : startPoint;
        let controlPointForGap = lastPoint;

        if (edge.type === 'bezier') {
            const handleOffset = 75;
            // Use a point before the target to calculate the tangent correctly
            controlPointForGap = this._getControlPoint(originalTargetSocket, edge.target.socketId, handleOffset);
        }

        const dx = originalTargetSocket.x - controlPointForGap.x;
        const dy = originalTargetSocket.y - controlPointForGap.y;
        const dist = Math.hypot(dx, dy);

        if (dist > arrowGap) {
            const ratio = (dist - arrowGap) / dist;
            gappedTargetSocket.x = controlPointForGap.x + dx * ratio;
            gappedTargetSocket.y = controlPointForGap.y + dy * ratio;
        }

        let d = `M ${startPoint.x} ${startPoint.y}`;

        if (edge.type === 'step') {
            let lastPointStep = startPoint;
            [...edge.points, gappedTargetSocket].forEach(point => {
                const midX = lastPointStep.x + (point.x - lastPointStep.x) / 2;
                d += ` L ${midX} ${lastPointStep.y} L ${midX} ${point.y}`;
                lastPointStep = point;
            });
             d += ` L ${gappedTargetSocket.x} ${gappedTargetSocket.y}`;
        } else if (edge.type === 'bezier') {
            const straightSourcePoint = this._getStraightPoint(startPoint, edge.source.socketId, bezierStraightLineDistance);
            const straightTargetPoint = this._getStraightPoint(gappedTargetSocket, edge.target.socketId, bezierStraightLineDistance);
            d += ` L ${straightSourcePoint.x} ${straightSourcePoint.y}`;

            let lastBezierPoint = straightSourcePoint;
            let cp1 = this._getControlPoint(straightSourcePoint, edge.source.socketId);

            edge.points.forEach(point => {
                const cp2x = point.x - (point.x - lastBezierPoint.x) * 0.5;
                const cp2y = point.y - (point.y - lastBezierPoint.y) * 0.5;
                d += ` C ${cp1.x} ${cp1.y}, ${cp2x} ${cp2y}, ${point.x} ${point.y}`;
                cp1 = { x: point.x + (point.x - lastBezierPoint.x) * 0.5, y: point.y + (point.y - lastBezierPoint.y) * 0.5 };
                lastBezierPoint = point;
            });
            
            const cp2 = this._getControlPoint(straightTargetPoint, edge.target.socketId);
            d += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${straightTargetPoint.x} ${straightTargetPoint.y}`;
            d += ` L ${gappedTargetSocket.x} ${gappedTargetSocket.y}`;
        } else { // 'straight'
            edge.points.forEach(point => { d += ` L ${point.x} ${point.y}`; });
            d += ` L ${gappedTargetSocket.x} ${gappedTargetSocket.y}`;
        }
        
        return d;
    }

    _getVisibleNodeIds() {
        const paddingX = this.state.viewbox.w * 0.25;
        const paddingY = this.state.viewbox.h * 0.25;
        const viewboxWithPadding = {
            x: this.state.viewbox.x - paddingX,
            y: this.state.viewbox.y - paddingY,
            w: this.state.viewbox.w + paddingX * 2,
            h: this.state.viewbox.h + paddingY * 2,
        };
        const visibleNodeIds = new Set();
        this.state.nodes.forEach(node => {
            const nodeRight = node.x + node.width / 2;
            const nodeLeft = node.x - node.width / 2;
            const nodeBottom = node.y + node.height / 2;
            const nodeTop = node.y - node.height / 2;

            if (nodeRight >= viewboxWithPadding.x && nodeLeft <= viewboxWithPadding.x + viewboxWithPadding.w &&
                nodeBottom >= viewboxWithPadding.y && nodeTop <= viewboxWithPadding.y + viewboxWithPadding.h)
            {
                visibleNodeIds.add(node.id);
            }
        });
        return visibleNodeIds;
    }
    
    _compareNodesForRender(a, b) {
        const getDepth = (nodeId) => {
            let depth = 0;
            let node = this.state.nodes.find(n => n.id === nodeId);
            while (node && node.parent !== undefined) {
                depth++;
                node = this.state.nodes.find(n => n.id === node.parent);
            }
            return depth;
        };

        const depthA = getDepth(a.id);
        const depthB = getDepth(b.id);
        if (depthA !== depthB) return depthA - depthB;
        
        if (a.type === 'group' && b.type !== 'group') return -1;
        if (a.type !== 'group' && b.type === 'group') return 1;

        const aSelected = this.state.selectedNodeIds.includes(a.id);
        const bSelected = this.state.selectedNodeIds.includes(b.id);
        if (aSelected && !bSelected) return 1;
        if (!aSelected && bSelected) return -1;
        
        return 0;
    }

    _createNodeHoverRect(node, parent) {
        const { x, y, width, height } = node;
        const hoverRect = this._createSVGElement('rect', {
            x: x - width / 2 - 10,
            y: y - height / 2 - 10,
            width: width + 20,
            height: height + 20,
            fill: 'transparent'
        });
        parent.appendChild(hoverRect);
    }
    
    _createNodeRect(node, parent) {
        const { x, y, width, height, type, locked, id, color } = node;
        const classes = ['node'];
        if (type === 'group') classes.push('group');
        if (locked) classes.push('locked');
        if (this.state.selectedNodeIds.includes(id)) classes.push('selected');

        const rect = this._createSVGElement('rect', {
            x: x - width / 2,
            y: y - height / 2,
            width, height,
            rx: 5, ry: 5,
            class: classes.join(' '),
            'data-id': id
        });
        rect.style.fill = color;
        rect.style.stroke = color;
        parent.appendChild(rect);
    }

    _createNodeContent(node, parent) {
        const { x, y, width, height, icon, title, id } = node;
        const foreignObject = this._createSVGElement('foreignObject', {
            x: x - width / 2,
            y: y - height / 2,
            width, height
        });
        foreignObject.style.pointerEvents = 'none';
        
        const nodeContent = document.createElement('div');
        nodeContent.className = 'node-content';
        
        const nodeBody = document.createElement('div');
        nodeBody.className = 'node-body';
        
        nodeContent.innerHTML = `
            <div class="node-header">
                <i class="node-icon" data-lucide="${icon}"></i>
                <div class="node-title">${title}</div>
            </div>
            <div class="node-footer">ID: ${id}</div>
        `;
        
        nodeContent.insertBefore(nodeBody, nodeContent.querySelector('.node-footer'));
        
        // --- Custom Node Rendering ---
        const nodeDef = this.nodeTypes.get(node.type);

        if (nodeDef && nodeDef.render) {
            nodeDef.render(node, nodeBody, this);
        }
        // -------------------------

        if (node.locked) {
            const lockIndicator = document.createElement('div');
            lockIndicator.className = 'lock-indicator';
            lockIndicator.innerHTML = `<i data-lucide="lock"></i>`;
            nodeContent.appendChild(lockIndicator);
        }
        
        const nodeTitleEl = nodeContent.querySelector('.node-title');
        nodeTitleEl.style.pointerEvents = 'all';
        nodeTitleEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.state.contextNode = node;
            this._showContextMenu(e.clientX, e.clientY, 'node');
        });

        foreignObject.appendChild(nodeContent);
        parent.appendChild(foreignObject);
    }
    
    _createResizeHandles(node, parent) {
        const { x, y, width, height, id } = node;
        const handleThickness = 12;
        const cornerSize = 16;
        const halfW = width / 2, halfH = height / 2;

        const handlesData = [
            { class: 'n', x: x - halfW, y: y - halfH - handleThickness / 2, width: width, height: handleThickness },
            { class: 's', x: x - halfW, y: y + halfH - handleThickness / 2, width: width, height: handleThickness },
            { class: 'w', x: x - halfW - handleThickness / 2, y: y - halfH, width: handleThickness, height: height },
            { class: 'e', x: x + halfW - handleThickness / 2, y: y - halfH, width: handleThickness, height: height },
            { class: 'nw', x: x - halfW - cornerSize / 2, y: y - halfH - cornerSize / 2, width: cornerSize, height: cornerSize },
            { class: 'ne', x: x + halfW - cornerSize / 2, y: y - halfH - cornerSize / 2, width: cornerSize, height: cornerSize },
            { class: 'sw', x: x - halfW - cornerSize / 2, y: y + halfH - cornerSize / 2, width: cornerSize, height: cornerSize },
            { class: 'se', x: x + halfW - cornerSize / 2, y: y + halfH - cornerSize / 2, width: cornerSize, height: cornerSize },
        ];

        handlesData.forEach(data => {
            const handle = this._createSVGElement('rect', {
                ...data,
                class: `resize-handle ${data.class}`,
                'data-direction': data.class,
                'data-node-id': id,
            });
            parent.appendChild(handle);
        });
    }

    _createConnectionHandles(node, parent) {
        const { id } = node;
        node.sockets.forEach(socket => {
            const isConnectedAsSource = this.state.edges.some(edge =>
                edge.source.nodeId === id && edge.source.socketId === socket.id
            );
            const isConnectedAsTarget = this.state.edges.some(edge =>
                edge.target.nodeId === id && edge.target.socketId === socket.id
            );

            const classes = ['connection-handle-visible'];
            if (isConnectedAsSource) {
                classes.push('connected');
            }
            if (isConnectedAsTarget && !isConnectedAsSource) {
                classes.push('is-target');
            }

            const handle = this._createSVGElement('circle', {
                cx: socket.x, cy: socket.y, r: this.settings.connectionHandleSize,
                class: classes.join(' '),
                'data-node-id': id,
                'data-socket-id': socket.id
            });
            parent.appendChild(handle);

            if (handle) {
                handle.style.fill = node.color;
            }

            const connectionZone = this._createSVGElement('circle', {
                cx: socket.x,
                cy: socket.y,
                r: this.settings.connectionZoneRadius,
                fill: 'transparent',
                class: 'connection-handle',
                'data-node-id': id,
                'data-socket-id': socket.id
            });
            parent.appendChild(connectionZone);
        });
    }

    /**
     * Updates the SVG viewbox and grid to reflect the current pan and zoom state.
     */
    _updateView() {
        const { x, y, w, h } = this.state.viewbox;
        this.dom.svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
        if (this.gridRect) {
            this.gridRect.setAttribute('x', x);
            this.gridRect.setAttribute('y', y);
            this.gridRect.setAttribute('width', w);
            this.gridRect.setAttribute('height', h);
        }
    }
    
    // =================================================================================================
    // Event Handlers
    // =================================================================================================
    
    _handleKeyDown(e) {
        const isEditingText = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

        if (e.ctrlKey || e.metaKey) {
            if (isEditingText) return;
            switch (e.key.toLowerCase()) {
                case 'c': e.preventDefault(); this._copySelected(); break;
                case 'x': e.preventDefault(); this._cutSelected(); break;
                case 'v': e.preventDefault(); this._paste(); break;
                case 'z': e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); break;
                case 'y': e.preventDefault(); this.redo(); break;
                case 'a':
                    e.preventDefault();
                    this.state.selectedNodeIds = this.state.nodes.map(node => node.id);
                    this.state.selectedEdgeIndexes = this.state.edges.map((_, index) => index);
                    this._log(`Selected all ${this.state.selectedNodeIds.length} nodes and ${this.state.selectedEdgeIndexes.length} edges.`);
                    this._render();
                    break;

            }
            return;
        }

        switch (e.key.toLowerCase()) {
            case 'c':
                if (!this.state.interaction.cutting) {
                    this.state.interaction.cutting = true;
                    this._render();
                }
                break;
            case 'g':
                if (!isEditingText) {
                    e.preventDefault();
                    this._groupSelectedNodes();
                }
                break;
            case 'Delete':
            case 'Backspace':
                this._deleteSelected();
                break;
            case 'd':
                if (this.state.selectedNodeIds.length > 0) {
                    this._toggleLockSelected();
                }
                break;
            case 'p':
                if (!isEditingText) {
                    e.preventDefault();
                }
                break;
            case 'f':
                if (!isEditingText) {
                    e.preventDefault();
                    this._zoomToSelected();
                }
                break;
        }
    }

    _handleKeyUp(e) {
        if (e.key === 'c') {
            this.state.interaction.cutting = false;
            this._render();
        }
    }
    
    _zoomToSelected() {
        if (this.state.selectedNodeIds.length === 0) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        this.state.selectedNodeIds.forEach(nodeId => {
            const node = this.state.nodes.find(n => n.id === nodeId);
            if (node) {
                minX = Math.min(minX, node.x);
                minY = Math.min(minY, node.y);
                maxX = Math.max(maxX, node.x + node.width);
                maxY = Math.max(maxY, node.y + node.height);
            }
        });

        if (minX === Infinity) return;

        const padding = 100;
        const selectionWidth = maxX - minX;
        const selectionHeight = maxY - minY;

        const svgRect = this.dom.svg.getBoundingClientRect();
        const zoomX = svgRect.width / (selectionWidth + padding * 2);
        const zoomY = svgRect.height / (selectionHeight + padding * 2);
        let zoomLevel = Math.min(zoomX, zoomY);

        zoomLevel = Math.max(this.settings.minZoom, Math.min(this.settings.maxZoom, zoomLevel));
        
        this.state.viewbox.w = svgRect.width / zoomLevel;
        this.state.viewbox.h = svgRect.height / zoomLevel;

        const centerX = minX + selectionWidth / 2;
        const centerY = minY + selectionHeight / 2;
        
        this.state.viewbox.x = centerX - this.state.viewbox.w / 2;
        this.state.viewbox.y = centerY - this.state.viewbox.h / 2;

        this._updateView();
        this._render();
        this._log(`Zoomed to selection`);
    }
    
    _handleMouseDown(e) {
        this.state.interaction.mouseDown = true;
        const target = e.target;
        const classList = target.classList;

        const isBackground = !classList.contains('node') && !classList.contains('resize-handle') &&
                             !classList.contains('connection-handle') && !classList.contains('edge') &&
                             !classList.contains('routing-handle');

        if (isBackground && this.dom.contextMenu.menu.style.display === 'block') {
            this._hideContextMenu();
            return;
        }
        
        if (this.state.interaction.cutting) {
            this._startCutting(e);
            return;
        }
        
        if (e.shiftKey || e.ctrlKey || (e.button === 0 && isBackground)) {
            this._handleSelectionMouseDown(e);
        } else if (e.button === 1) { // Middle mouse for panning
            this._startPanning(e);
        } else if (classList.contains('node')) {
            this._startDragging(e, target);
        } else if (classList.contains('resize-handle')) {
            this._startResizing(e, target);
        } else if (classList.contains('connection-handle')) {
            this._startConnecting(e, target);
        } else if (classList.contains('edge') || classList.contains('edge-hitbox')) {
            this._startRewiring(e, target);
        } else if (classList.contains('routing-handle')) {
            this._startDraggingRoutingPoint(e, target);
        } else {
            this.state.selectedNodeIds = [];
            this.state.selectedEdgeIndexes = [];
        }
        this._render();
    }
    
    _handleMouseMove(e) {
        this.state.mousePosition = this._getSVGCoords(e);
        
        if (this.state.interaction.cutting && this.state.interaction.mouseDown) this._updateCutLine();
        else if (this.state.interaction.selecting) this._updateSelectionBox(e);
        else if (this.state.interaction.panning) this._pan(e);
        else if (this.state.interaction.dragging) this._dragNodes();
        else if (this.state.interaction.resizing) this._resizeNode();
        else if (this.state.interaction.connecting) this._updateTempLine();
        else if (this.state.interaction.draggingRoutingPoint) this._dragRoutingPoint();
    }
    
    _handleMouseUp(e) {
        this.state.interaction.mouseDown = false;
        
        if (this.state.snapLines.length > 0) {
            this.state.snapLines = [];
            this._render();
        }

        if (this.state.interaction.connecting) this._stopConnecting(e);
        if (this.state.interaction.dragging) this._stopDragging();
        if (this.state.interaction.cutting) this._stopCutting();
        if (this.state.interaction.selecting) this._stopSelecting();

        if (this.state.interaction.resizing || this.state.interaction.draggingRoutingPoint) {
            this._saveGraphStateToDB();
        }

        this._resetInteractionState();
        this._render();
    }
    
    _handleDoubleClick(e) {
        const target = e.target;
        if (target.classList.contains('edge-hitbox')) {
            this._addRoutingPoint(e, target);
        }
    }
    
    _handleContextMenu(e) {
        e.preventDefault();
        const target = e.target;
        const nodeGroup = target.closest('.node-group');
        const edgeHitbox = target.closest('.edge-hitbox');
    
        if (nodeGroup) {
            const nodeRect = nodeGroup.querySelector('.node');
            if (!nodeRect) return;

            const nodeId = parseInt(nodeRect.dataset.id);
            this.state.contextNode = this.state.nodes.find(n => n.id === nodeId);
            if (this.state.contextNode) {
                this._showContextMenu(e.clientX, e.clientY, 'node', { nodeElement: nodeGroup });
            }
        } else if (edgeHitbox) {
            this.state.contextEdge = parseInt(edgeHitbox.dataset.index);
            this._showContextMenu(e.clientX, e.clientY, 'edge');
        } else {
            this.state.contextNode = null;
            this.state.contextEdge = null;
            this._showContextMenu(e.clientX, e.clientY, 'canvas');
        }
    }
    
    _handleWheel(e) {
        e.preventDefault();
        const rect = this.dom.svg.getBoundingClientRect();
        const svgCoords = this._screenToSVGCoords(e.clientX, e.clientY, rect);
        const zoomFactor = e.deltaY < 0 ? 0.9 : 1.1;
        this._zoom(zoomFactor, svgCoords);
    }
    
    _handleFileDrop(e) {
        const file = e.dataTransfer.files[0];
        if (!file) return;

        const pt = this._getSVGCoords(e);
        const extension = `.${file.name.split('.').pop().toLowerCase()}`;

        if (this.fileTypes.json.includes(extension)) {
            const reader = new FileReader();
            reader.onload = (event) => {
                    const data = JSON.parse(event.target.result);
                this._loadGraphData(data, file.name);
            };
            reader.readAsText(file);
        } else if (this.fileTypes.markdown.includes(extension)) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const newNode = this._addNode(pt.x, pt.y, 'markdown-node');
                newNode.properties.content = event.target.result;
                newNode.title = file.name;
                        this._render();
            };
            reader.readAsText(file);
        } else if (this.fileTypes.image.includes(extension)) {
            const objectURL = URL.createObjectURL(file);
            const newNode = this._addNode(pt.x, pt.y, 'markdown-node');
            
            newNode.properties.content = `![image](${objectURL})`;
            newNode.title = file.name;
            newNode.width = 740;
            newNode.height = 540;

            this._render();
        } else {
            this._log(`Unsupported file type dropped: ${file.name}`);
            alert('Unsupported file type.');
        }
    }

    // =================================================================================================
    // Interaction Handlers
    // =================================================================================================

    _startPanning(e) {
        this.state.interaction.panning = true;
        this.state.dragStart = { x: e.clientX, y: e.clientY };
        this.state.selectedNodeIds = [];
        this.state.selectedEdgeIndexes = [];
        this._hideContextMenu();
        this._log('Started panning');
    }

    _pan(e) {
        const dx = (e.clientX - this.state.dragStart.x) * (this.state.viewbox.w / window.innerWidth);
        const dy = (e.clientY - this.state.dragStart.y) * (this.state.viewbox.h / window.innerHeight);
        this.state.viewbox.x -= dx;
        this.state.viewbox.y -= dy;
        this.state.dragStart = { x: e.clientX, y: e.clientY };
        this._updateView();
    }
    
    _startDragging(e, target) {
        e.stopPropagation();
        const nodeId = parseInt(target.dataset.id);
        if (!this.state.selectedNodeIds.includes(nodeId)) {
            this.state.selectedNodeIds = [nodeId];
            this.state.selectedEdgeIndexes = [];
        }
        this._log(`Selected node ${nodeId}`);
        const node = this.state.nodes.find(n => n.id === nodeId);

        if (!node.locked) {
            this.state.interaction.dragging = true;
            this.state.interaction.didDrag = false;
            this.state.draggedNodes = this.state.selectedNodeIds.map(id => this.state.nodes.find(n => n.id === id));
            this.state.dragStart = this._getSVGCoords(e);
            
            if (this.state.draggedNodes.length > 0) {
                const primaryNode = this.state.draggedNodes[0];
                this.state.dragOffset = {
                    x: this.state.dragStart.x - primaryNode.x,
                    y: this.state.dragStart.y - primaryNode.y
                };
            }

            this._log('Started dragging node(s)');
        }
    }
    
    _dragNodes() {
        if (!this.state.interaction.didDrag) {
            this._saveStateForUndo('Move Nodes');
            this.state.interaction.didDrag = true;
        }

        if (this.state.draggedNodes.length === 0) return;

        const primaryNode = this.state.draggedNodes[0];
        
        let targetX = this.state.mousePosition.x - this.state.dragOffset.x;
        let targetY = this.state.mousePosition.y - this.state.dragOffset.y;

        let snapResult = { x: null, y: null, snapLineX: null, snapLineY: null };
        if (this.state.interaction.snapToObjects) {
            snapResult = this._getObjectSnap(primaryNode, targetX, targetY);
            if (snapResult.x !== null) targetX = snapResult.x;
            if (snapResult.y !== null) targetY = snapResult.y;
        }
        
        this._updateSnapLines(snapResult);
        
        const finalX = this.state.interaction.snapping
            ? Math.round(targetX / this.settings.gridSize) * this.settings.gridSize
            : targetX;
        
        const finalY = this.state.interaction.snapping
            ? Math.round(targetY / this.settings.gridSize) * this.settings.gridSize
            : targetY;

        const dx = finalX - primaryNode.x;
        const dy = finalY - primaryNode.y;

        if (dx === 0 && dy === 0) return;

        const nodesToMove = new Set();
        this.state.draggedNodes.forEach(draggedNode => {
            this._getAllDescendants(draggedNode.id, nodesToMove);
        });

        nodesToMove.forEach(node => {
            node.x += dx;
            node.y += dy;
            this._updateNodeSockets(node);
        });

        this._render();
    }
    
    _stopDragging() {
        if (this.state.interaction.didDrag) {
            this._saveGraphStateToDB();
        }
        this.state.draggedNodes.forEach(node => {
            const oldParent = this.state.nodes.find(g => g.id === node.parent);
            const newParent = this.state.nodes.find(g =>
                g.type === 'group' && g.id !== node.id &&
                !this._isDescendant(g.id, node.id) && // Prevent dropping a group into its own descendant
                this.state.mousePosition.x >= g.x - g.width / 2 && this.state.mousePosition.x <= g.x + g.width / 2 &&
                this.state.mousePosition.y >= g.y - g.height / 2 && this.state.mousePosition.y <= g.y + g.height / 2
            );

            if (newParent && (!oldParent || oldParent.id !== newParent.id)) {
                if (oldParent) {
                    oldParent.children = oldParent.children.filter(id => id !== node.id);
                }
                newParent.children.push(node.id);
                node.parent = newParent.id;
                this._log(`Moved node ${node.id} to group ${newParent.id}`);
            } else if (!newParent && oldParent) {
                oldParent.children = oldParent.children.filter(id => id !== node.id);
                node.parent = undefined;
                this._log(`Removed node ${node.id} from group ${oldParent.id}`);
            }
        });
    }

    _startResizing(e, target) {
        e.stopPropagation();
        this._saveStateForUndo('Resize Node');
        this.state.interaction.resizing = true;
        this.state.resizeDirection = target.dataset.direction;
        const nodeId = parseInt(target.dataset.nodeId, 10);
        this.state.originalNode = JSON.parse(JSON.stringify(this.state.nodes.find(n => n.id === nodeId)));
        if (!this.state.selectedNodeIds.includes(nodeId)) {
            this.state.selectedNodeIds = [nodeId];
            this.state.selectedEdgeIndexes = [];
        }
        this.state.dragStart = this._getSVGCoords(e);
        this._log(`Started resizing node ${nodeId}`);
    }

    _resizeNode() {
        const node = this.state.nodes.find(n => n.id === this.state.originalNode.id);
        const dx = this.state.mousePosition.x - this.state.dragStart.x;
        const dy = this.state.mousePosition.y - this.state.dragStart.y;

        const { x, y, width, height } = this.state.originalNode;
        const dir = this.state.resizeDirection;

        // Calculate potential new boundaries based on deltas
        let newLeft = x - width / 2;
        let newRight = x + width / 2;
        let newTop = y - height / 2;
        let newBottom = y + height / 2;

        if (dir.includes('e')) newRight += dx;
        if (dir.includes('w')) newLeft += dx;
        if (dir.includes('s')) newBottom += dy;
        if (dir.includes('n')) newTop += dy;

        let snapLineX = null;
        let snapLineY = null;
        let didSnapX = false;
        let didSnapY = false;

        // Object snapping has priority
        if (this.state.interaction.snapToObjects) {
            const snapThreshold = 10;
            const snapTargets = this._getSnapTargets(node.id);
            let minDx = snapThreshold;
            let minDy = snapThreshold;

            if (dir.includes('e') || dir.includes('w')) {
                const edgeToSnap = dir.includes('e') ? newRight : newLeft;
                snapTargets.x.forEach(target => {
                    const d = Math.abs(edgeToSnap - target);
                    if (d < minDx) {
                        minDx = d;
                        const adjustment = target - edgeToSnap;
                        if (dir.includes('e')) newRight += adjustment;
                        if (dir.includes('w')) newLeft += adjustment;
                        snapLineX = target;
                    }
                });
                if (minDx < snapThreshold) didSnapX = true;
            }
            if (dir.includes('s') || dir.includes('n')) {
                const edgeToSnap = dir.includes('s') ? newBottom : newTop;
                 snapTargets.y.forEach(target => {
                    const d = Math.abs(edgeToSnap - target);
                    if (d < minDy) {
                        minDy = d;
                        const adjustment = target - edgeToSnap;
                        if (dir.includes('s')) newBottom += adjustment;
                        if (dir.includes('n')) newTop += adjustment;
                        snapLineY = target;
                    }
                });
                if (minDy < snapThreshold) didSnapY = true;
            }
        }
        
        this._updateSnapLines({ snapLineX, snapLineY });

        // Grid snapping (if object snap didn't occur on that axis)
        if (this.state.interaction.snapping) {
            if (!didSnapX) {
                if (dir.includes('e')) newRight = Math.round(newRight / this.settings.gridSize) * this.settings.gridSize;
                if (dir.includes('w')) newLeft = Math.round(newLeft / this.settings.gridSize) * this.settings.gridSize;
            }
            if (!didSnapY) {
                if (dir.includes('s')) newBottom = Math.round(newBottom / this.settings.gridSize) * this.settings.gridSize;
                if (dir.includes('n')) newTop = Math.round(newTop / this.settings.gridSize) * this.settings.gridSize;
            }
        }

        let newWidth = newRight - newLeft;
        let newHeight = newBottom - newTop;

        if (newWidth >= this.settings.gridSize && newHeight >= this.settings.gridSize) {
            node.width = newWidth;
            node.height = newHeight;
            node.x = newLeft + newWidth / 2;
            node.y = newTop + newHeight / 2;
    
            this._updateNodeSockets(node);
            this._render();
        }
    }

    _startConnecting(e, target) {
        e.stopPropagation();
        this.state.interaction.connecting = true;
        const nodeId = parseInt(target.dataset.nodeId);
        const socketId = parseInt(target.dataset.socketId);
        this.state.connectionStartSocket = { nodeId, socketId };
        
        const startNode = this.state.nodes.find(n => n.id === nodeId);
        const startSocketPos = startNode.sockets[socketId];

        this.state.tempLine = this._createSVGElement('path', {
            d: `M ${startSocketPos.x} ${startSocketPos.y} L ${startSocketPos.x} ${startSocketPos.y}`,
            class: 'edge',
            fill: 'none',
            'marker-end': 'url(#arrowhead)',
        });
        this._log(`Started connecting from node ${nodeId}`);
    }

    _updateTempLine() {
        const startNode = this.state.nodes.find(n => n.id === this.state.connectionStartSocket.nodeId);
        const startSocketPos = startNode.sockets[this.state.connectionStartSocket.socketId];
        this.state.tempLine.setAttribute('d', `M ${startSocketPos.x} ${startSocketPos.y} L ${this.state.mousePosition.x} ${this.state.mousePosition.y}`);
        this._render();
    }
    
    _stopConnecting(e) {
        const targetElement = document.elementFromPoint(e.clientX, e.clientY);
        if (targetElement && targetElement.classList.contains('connection-handle')) {
            const nodeId = parseInt(targetElement.dataset.nodeId);
            const socketId = parseInt(targetElement.dataset.socketId);
            this._createEdge(this.state.connectionStartSocket, { nodeId, socketId });
        } else {
            if (this.state.interaction.rewiring) {
                this.state.edges.splice(this.state.rewiringEdge.originalIndex, 0, this.state.rewiringEdge.edge);
                this._log('Rewiring cancelled');
            } else {
                if (this.dom.contextMenu.menu.style.display !== 'block') {
                    this.state.connectionEndPosition = this._getSVGCoords(e);
                    this._showContextMenu(e.clientX, e.clientY, 'connecting');
                    return; // Don't reset interaction state yet
                }
            }
        }
        this._resetConnectionState();
    }

    _startRewiring(e, target) {
        e.stopPropagation();
        const edgeIndex = parseInt(target.dataset.index);
        const edge = this.state.edges[edgeIndex];
        if (!edge) return;

        this._saveStateForUndo('Rewire Edge');
        
        // Temporarily remove the edge and store it
        this.state.rewiringEdge = { edge: this.state.edges.splice(edgeIndex, 1)[0], originalIndex: edgeIndex };
        this.state.interaction.rewiring = true;
        this.state.interaction.connecting = true; // Use existing connection logic
        
        // Drag the target end
        this.state.connectionStartSocket = edge.source;
        
        const fixedSocketNode = this.state.nodes.find(n => n.id === this.state.connectionStartSocket.nodeId);
        const fixedSocketPos = fixedSocketNode.sockets[this.state.connectionStartSocket.socketId];
        const svgP = this._getSVGCoords(e);

        this.state.tempLine = this._createSVGElement('path', {
            d: `M ${fixedSocketPos.x} ${fixedSocketPos.y} L ${svgP.x} ${svgP.y}`,
            class: 'edge', fill: 'none', 'marker-end': 'url(#arrowhead)'
        });
        this._log(`Rewiring edge ${edgeIndex}`);
    }

    _startDraggingRoutingPoint(e, target) {
        e.stopPropagation();
        this._saveStateForUndo('Move Routing Point');
        this.state.interaction.draggingRoutingPoint = true;
        this.state.draggedRoutingPoint = {
            edgeIndex: parseInt(target.dataset.edgeIndex),
            pointIndex: parseInt(target.dataset.pointIndex),
        };
        this._log(`Started dragging routing point`);
    }

    _dragRoutingPoint() {
        const { edgeIndex, pointIndex } = this.state.draggedRoutingPoint;
        const point = this.state.edges[edgeIndex].points[pointIndex];
        const mouseX = this.state.mousePosition.x;
        const mouseY = this.state.mousePosition.y;
        point.x = this.state.interaction.snapping ? Math.round(mouseX / this.settings.gridSize) * this.settings.gridSize : mouseX;
        point.y = this.state.interaction.snapping ? Math.round(mouseY / this.settings.gridSize) * this.settings.gridSize : mouseY;
        this._render();
    }

    _startCutting(e) {
        const svgP = this._getSVGCoords(e);
        this.state.cutLine = this._createSVGElement('path', {
            d: `M ${svgP.x} ${svgP.y}`,
            class: 'cut-line',
        });
    }
    
    _updateCutLine() {
        if (!this.state.cutLine) return;
        const d = this.state.cutLine.getAttribute('d');
        this.state.cutLine.setAttribute('d', `${d} L ${this.state.mousePosition.x} ${this.state.mousePosition.y}`);
        this._render();
    }
    
    _stopCutting() {
        if (!this.state.cutLine) return;
        
        const d = this.state.cutLine.getAttribute('d');
        if (d && d.includes('L')) { // Check if the line was actually dragged
            const points = d.substring(1).trim().split('L').map(pStr => {
                const coords = pStr.trim().split(/\s+/);
                return { x: parseFloat(coords[0]), y: parseFloat(coords[1]) };
            });

            if (points.length > 1) {
                const edgesToDelete = new Set();
                this.state.edges.forEach((edge, index) => {
                    const sourceNode = this.state.nodes.find(n => n.id === edge.source.nodeId);
                    const targetNode = this.state.nodes.find(n => n.id === edge.target.nodeId);
                    if (sourceNode && targetNode) {
                        const sourceSocket = sourceNode.sockets[edge.source.socketId];
                        let lastPoint = sourceSocket;
                        const edgeSegments = [...edge.points, targetNode.sockets[edge.target.socketId]];

                        for (const segmentEnd of edgeSegments) {
                            for (let i = 0; i < points.length - 1; i++) {
                                if (this._lineIntersects(points[i], points[i+1], lastPoint, segmentEnd)) {
                                    edgesToDelete.add(index);
                                    break; 
                                }
                            }
                            if(edgesToDelete.has(index)) break;
                            lastPoint = segmentEnd;
                        }
                    }
                });

                if (edgesToDelete.size > 0) {
                    this._saveStateForUndo('Cut Edges');
                    this._log(`Cut ${edgesToDelete.size} edges`);
                    this.state.edges = this.state.edges.filter((_, index) => !edgesToDelete.has(index));
                    this._saveGraphStateToDB();
                }
            }
        }
        this.state.cutLine = null;
    }
    
    _handleSelectionMouseDown(e) {
        const target = e.target;
        if ((e.shiftKey || e.ctrlKey) && target.classList.contains('node')) {
            e.stopPropagation();
            const nodeId = parseInt(target.dataset.id);
            this.state.selectedNodeIds = this.state.selectedNodeIds.includes(nodeId)
                ? this.state.selectedNodeIds.filter(id => id !== nodeId)
                : [...this.state.selectedNodeIds, nodeId];
            this._log(`Toggled selection for node ${nodeId}`);
        } else if ((e.shiftKey || e.ctrlKey) && (target.classList.contains('edge') || target.classList.contains('edge-hitbox'))) {
            e.stopPropagation();
            const edgeIndex = parseInt(target.dataset.index);
            this.state.selectedEdgeIndexes = this.state.selectedEdgeIndexes.includes(edgeIndex)
                ? this.state.selectedEdgeIndexes.filter(index => index !== edgeIndex)
                : [...this.state.selectedEdgeIndexes, edgeIndex];
            this._log(`Toggled selection for edge ${edgeIndex}`);
        } else {
            this._startSelectionBox(e);
        }
    }

    _startSelectionBox(e) {
        this.state.interaction.selecting = true;
        this.dom.selectionBox.style.display = 'block';
        this.state.dragStart = { x: e.clientX, y: e.clientY };
        Object.assign(this.dom.selectionBox.style, {
            left: `${e.clientX}px`,
            top: `${e.clientY}px`,
            width: '0px',
            height: '0px',
        });
        this._log('Started selection box');
    }

    _updateSelectionBox(e) {
        const x = Math.min(e.clientX, this.state.dragStart.x);
        const y = Math.min(e.clientY, this.state.dragStart.y);
        const width = Math.abs(e.clientX - this.state.dragStart.x);
        const height = Math.abs(e.clientY - this.state.dragStart.y);
        Object.assign(this.dom.selectionBox.style, {
            left: `${x}px`,
            top: `${y}px`,
            width: `${width}px`,
            height: `${height}px`,
        });
    }
    
    _stopSelecting() {
        const selectionRect = this.dom.selectionBox.getBoundingClientRect();
        this.dom.selectionBox.style.display = 'none';
        
        const svgRect = this.dom.svg.getBoundingClientRect();
        const selectionStart = this._screenToSVGCoords(selectionRect.left, selectionRect.top, svgRect);
        const selectionEnd = this._screenToSVGCoords(selectionRect.right, selectionRect.bottom, svgRect);

        this.state.selectedNodeIds = this.state.nodes.filter(node => {
            const nodeRect = {
                left: node.x - node.width / 2,
                right: node.x + node.width / 2,
                top: node.y - node.height / 2,
                bottom: node.y + node.height / 2,
            };
            return nodeRect.right > selectionStart.x && nodeRect.left < selectionEnd.x &&
                   nodeRect.bottom > selectionStart.y && nodeRect.top < selectionEnd.y;
        }).map(node => node.id);

        const newSelectedEdgeIndexes = new Set();
        this.state.edges.forEach((edge, index) => {
            if (this.state.selectedNodeIds.includes(edge.source.nodeId) && this.state.selectedNodeIds.includes(edge.target.nodeId)) {
                newSelectedEdgeIndexes.add(index);
            }
        });
        
        // Also select edges intersecting the selection box
        const edgeHitboxes = this.mainGroup.querySelectorAll('.edge-hitbox');
        edgeHitboxes.forEach(hitbox => {
            const edgeBBox = hitbox.getBBox();
            if (edgeBBox.x < selectionEnd.x &&
                edgeBBox.x + edgeBBox.width > selectionStart.x &&
                edgeBBox.y < selectionEnd.y &&
                edgeBBox.y + edgeBBox.height > selectionStart.y)
            {
                const index = parseInt(hitbox.dataset.index, 10);
                newSelectedEdgeIndexes.add(index);
            }
        });
        
        this.state.selectedEdgeIndexes = [...newSelectedEdgeIndexes];
        this._log(`Selected ${this.state.selectedNodeIds.length} nodes and ${this.state.selectedEdgeIndexes.length} edges`);
    }

    _resetInteractionState() {
        this.state.interaction = {
            ...this.state.interaction,
            dragging: false,
            resizing: false,
            panning: false,
            selecting: false,
            draggingRoutingPoint: false,
            rewiring: false,
        };
        
        if (!this.state.interaction.connecting) { // connecting state is handled separately
            this._resetConnectionState();
        }

        this.state.draggedNodes = [];
        this.state.resizeDirection = null;
        this.state.originalNode = null;
        this.state.draggedRoutingPoint = null;
        this.state.rewiringEdge = null;
    }

    _resetConnectionState() {
        this.state.interaction.connecting = false;
        this.state.connectionStartSocket = null;
        this.state.tempLine = null;
        this.state.connectionEndPosition = null;
    }
    
    // =================================================================================================
    // UI Actions
    // =================================================================================================

    _zoom(factor, pivot = null) {
        if (this.dom.propertiesPanel.panel.style.display === 'flex') {
            this.dom.propertiesPanel.panel.style.display = 'none';
        }

        if (this.zoomTimer) {
            clearTimeout(this.zoomTimer);
        }
        this.zoomTimer = setTimeout(() => {
            this._render();
            this.zoomTimer = null;
        }, 200);

        const { minZoom, maxZoom } = this.settings;
        const newWidth = this.state.viewbox.w * factor;
        const newHeight = this.state.viewbox.h * factor;
        const currentZoomX = window.innerWidth / newWidth;
        const currentZoomY = window.innerHeight / newHeight;
        
        if ((factor < 1 && (currentZoomX > maxZoom || currentZoomY > maxZoom)) ||
            (factor > 1 && (currentZoomX < minZoom || currentZoomY < minZoom))) {
            return;
        }
        
        const p = pivot || { x: this.state.viewbox.x + this.state.viewbox.w / 2, y: this.state.viewbox.y + this.state.viewbox.h / 2 };

        this.state.viewbox.x = p.x - (p.x - this.state.viewbox.x) * factor;
        this.state.viewbox.y = p.y - (p.y - this.state.viewbox.y) * factor;
        this.state.viewbox.w = newWidth;
        this.state.viewbox.h = newHeight;
        
        this._log(`Zoom ${factor < 1 ? 'in' : 'out'}`);
        this._updateView();
    }
    
    _handleChangeEdgeType(e) {
        this._saveStateForUndo('Change Edge Style');
        const newType = e.target.value;
        this.state.edges.forEach(edge => { edge.type = newType; });
        this._log(`Changed all edges to ${newType} style`);
        this._saveGraphStateToDB();
        this._render();
    }
    
    _toggleTheme() {
        const bodyClass = document.body.classList;
        if (bodyClass.contains('dark-theme')) {
            bodyClass.remove('dark-theme');
            bodyClass.add('grayscale-theme');
            this._log('Switched to grayscale theme');
        } else if (bodyClass.contains('grayscale-theme')) {
            bodyClass.remove('grayscale-theme');
            this._log('Switched to light theme');
        } else {
            bodyClass.add('dark-theme');
            this._log('Switched to dark theme');
        }
        
        const newColor = getComputedStyle(document.body).getPropertyValue('--node-fill-color').trim();
        this.state.nodes.forEach(node => { node.color = newColor; });
        this._updateDefaultColors();
        this._render();
    }
    
    _deleteSelected(saveUndo = true) {
        if (this.state.selectedEdgeIndexes.length === 0 && this.state.selectedNodeIds.length === 0) return;
        
        if (saveUndo) {
        this._saveStateForUndo('Delete Selection');
        }
        
        if (this.state.selectedEdgeIndexes.length > 0) {
            if (saveUndo) this._log(`Deleted ${this.state.selectedEdgeIndexes.length} edges`);
            this.state.edges = this.state.edges.filter((_, index) => !this.state.selectedEdgeIndexes.includes(index));
            this.state.selectedEdgeIndexes = [];
        }
        if (this.state.selectedNodeIds.length > 0) {
            if (saveUndo) this._log(`Deleted ${this.state.selectedNodeIds.length} nodes`);
            const selectedIdsSet = new Set(this.state.selectedNodeIds);
            
            // --- Cache Cleanup Hook ---
            this.state.nodes.forEach(node => {
                if (selectedIdsSet.has(node.id)) {
                    const nodeDef = this.nodeTypes.get(node.type);
                    if (nodeDef && nodeDef.onNodeRemoved) {
                        nodeDef.onNodeRemoved(node);
                    }
                }
            });
            // -------------------------

            this.state.nodes = this.state.nodes.filter(node => !selectedIdsSet.has(node.id));
            this.state.edges = this.state.edges.filter(edge => !selectedIdsSet.has(edge.source.nodeId) && !selectedIdsSet.has(edge.target.nodeId));
            this.state.selectedNodeIds = [];
        }
        if (saveUndo) {
            this._saveGraphStateToDB();
        }
        this._render();
    }
    
    _toggleLockSelected() {
        this._saveStateForUndo('Toggle Lock');
        this.state.selectedNodeIds.forEach(nodeId => {
            const node = this.state.nodes.find(n => n.id === nodeId);
            if (node) {
                node.locked = !node.locked;
                this._log(`Toggled lock state for node ${nodeId}`);
            }
        });
        this.state.selectedEdgeIndexes = [];
        this._saveGraphStateToDB();
        this._render();
    }
    
    _addRoutingPoint(e, target) {
        this._saveStateForUndo('Add Routing Point');
        const edgeIndex = parseInt(target.dataset.index);
        const edge = this.state.edges[edgeIndex];
        const svgP = this._getSVGCoords(e);
        edge.points.push({ x: svgP.x, y: svgP.y });
        this._log(`Added routing point to edge ${edgeIndex}`);
        this._saveGraphStateToDB();
        this._render();
    }

    // =================================================================================================
    // Context Menu Handlers
    // =================================================================================================

    _showContextMenu(x, y, type, contextData = {}) {
        let items = [];
        if (type === 'node') {
            const node = this.state.contextNode;
            const defaultItems = this._getDefaultNodeContextMenuItems(node);
            const nodeDef = this.nodeTypes.get(node.type);

            if (nodeDef && nodeDef.getContextMenuItems) {
                const customItems = nodeDef.getContextMenuItems(node, this, contextData);
                items = customItems.concat([{ separator: true }], defaultItems);
            } else {
                items = defaultItems;
            }
        } else if (type === 'edge') {
            items = this._getEdgeContextMenuItems();
        } else if (type === 'canvas' || type === 'connecting') {
            items = this._getCanvasContextMenuItems(type === 'connecting');
        } else if (type === 'custom' && contextData.items) {
            items = contextData.items;
        }

        if (items.length === 0) return;

        this._populateContextMenu(items);
        Object.assign(this.dom.contextMenu.menu.style, { display: 'block', left: `${x}px`, top: `${y}px` });
    }
    
    _hideContextMenu() {
        this.dom.contextMenu.menu.style.display = 'none';
        if (this.state.interaction.connecting) {
            this._resetConnectionState();
            this._render();
        }
    }
    
    _getDefaultNodeContextMenuItems(node) {
        const items = [
            {
                label: `Lock: ${node.locked ? 'On' : 'Off'}`,
                icon: 'lock',
                callback: () => this._handleContextMenuLockNode()
            },
            {
                label: 'Delete Node',
                icon: 'trash-2',
                callback: () => this._handleContextMenuDeleteNode()
            }
        ];
        // Add group option if multiple nodes are selected
        if (this.state.selectedNodeIds.length > 1) {
            items.push({
                label: 'Group Selection',
                icon: 'group',
                callback: () => this._handleContextMenuGroup()
            });
        }
        return items;
    }

    _getEdgeContextMenuItems() {
        return [
            { label: 'Add Routing Point', icon: 'spline', callback: () => this._handleContextMenuAddRoutingPoint() },
            { label: 'Delete Edge', icon: 'trash-2', callback: () => this._handleContextMenuDeleteEdge() },
        ];
    }

    _getCanvasContextMenuItems(isConnecting) {
        const items = [
            { label: 'Add Node', icon: 'box', callback: () => this._handleContextMenuAddNode('default') },
            { label: 'Add Group', icon: 'box-select', callback: () => this._handleContextMenuAddNode('group') },
            { label: 'Add Markdown Note', icon: 'file-text', callback: () => this._handleContextMenuAddNode('markdown-node') },
        ];
        if (!isConnecting) {
            items.push({ separator: true });
            items.push({
                label: `Snapping: ${this.state.interaction.snapping ? 'On' : 'Off'}`,
                icon: 'grid',
                callback: () => this._handleContextMenuToggleSnap()
            });
            items.push({
                label: `Snap To Objects: ${this.state.interaction.snapToObjects ? 'On' : 'Off'}`,
                icon: 'magnet',
                callback: () => this._handleContextMenuToggleSnapToObjects()
            });
        }
        return items;
    }

    _handleContextMenuDeleteNode() {
        if (this.state.contextNode) {
            this._removeNode(this.state.contextNode);
            this.state.contextNode = null;
        }
        this._hideContextMenu();
    }
    
    _handleContextMenuLockNode() {
        if (this.state.contextNode) {
            this._saveStateForUndo('Toggle Lock');
            this.state.contextNode.locked = !this.state.contextNode.locked;
            this._log(`Toggled lock state for node ${this.state.contextNode.id}`);
            this.state.contextNode = null;
            this._saveGraphStateToDB();
            this._render();
        }
        this._hideContextMenu();
    }
    
    _handleContextMenuDeleteEdge() {
        if (this.state.contextEdge !== null) {
            this._saveStateForUndo('Delete Edge');
            this.state.edges.splice(this.state.contextEdge, 1);
            this._log(`Deleted edge ${this.state.contextEdge}`);
            this.state.contextEdge = null;
            this._saveGraphStateToDB();
        }
        this._hideContextMenu();
    }

    _handleContextMenuAddRoutingPoint() {
        if (this.state.contextEdge === null) return;
        
        const edge = this.state.edges[this.state.contextEdge];
        const sourceNode = this.state.nodes.find(n => n.id === edge.source.nodeId);
        const targetNode = this.state.nodes.find(n => n.id === edge.target.nodeId);

        if (sourceNode && targetNode) {
            const sourceSocket = sourceNode.sockets[edge.source.socketId];
            const targetSocket = targetNode.sockets[edge.target.socketId];
            const x = (sourceSocket.x + targetSocket.x) / 2;
            const y = (sourceSocket.y + targetSocket.y) / 2;
            this._saveStateForUndo('Add Routing Point');
            edge.points.push({ x, y });
            this._log(`Added routing point to edge ${this.state.contextEdge}`);
            this._saveGraphStateToDB();
            this._render();
        }
        this.state.contextEdge = null;
        this._hideContextMenu();
    }
    
    _handleContextMenuGroup() {
        this._groupSelectedNodes();
        this._hideContextMenu();
    }

    _handleContextMenuToggleSnap() {
        this.state.interaction.snapping = !this.state.interaction.snapping;
        this._log(`Snapping ${this.state.interaction.snapping ? 'enabled' : 'disabled'}`);
        this._hideContextMenu();
    }

    _handleContextMenuToggleSnapToObjects() {
        this.state.interaction.snapToObjects = !this.state.interaction.snapToObjects;
        this._log(`Snap to objects ${this.state.interaction.snapToObjects ? 'enabled' : 'disabled'}`);
        this._hideContextMenu();
    }

    _handleContextMenuAddNode(type = 'default') {
        if (this.state.interaction.connecting) {
            const newNode = this._addNode(this.state.connectionEndPosition.x, this.state.connectionEndPosition.y, type);
            const startNode = this.state.nodes.find(n => n.id === this.state.connectionStartSocket.nodeId);
            const startSocket = startNode.sockets[this.state.connectionStartSocket.socketId];

            const closestSocketInfo = newNode.sockets.reduce((closest, socket) => {
                const socketPos = { x: newNode.x + socket.x, y: newNode.y + socket.y };
                const startSocketPos = { x: startNode.x + startSocket.x, y: startNode.y + startSocket.y };
                const distance = Math.hypot(socketPos.x - startSocketPos.x, socketPos.y - startSocketPos.y);
                if (distance < closest.minDistance) {
                    return { socket, minDistance: distance };
                }
                return closest;
            }, { socket: null, minDistance: Infinity });

            this._createEdge(this.state.connectionStartSocket, { nodeId: newNode.id, socketId: closestSocketInfo.socket.id });
            this._resetConnectionState();
        } else {
            const rect = this.dom.svg.getBoundingClientRect();
            const { left, top } = this.dom.contextMenu.menu.style;
            const svgP = this._screenToSVGCoords(parseFloat(left), parseFloat(top), rect);
            this._addNode(svgP.x, svgP.y, type);
        }
        this._hideContextMenu();
        this._render();
    }

    // =================================================================================================
    // Properties Panel
    // =================================================================================================

    _updatePropertiesPanel() {
        if (this.state.selectedNodeIds.length !== 1) {
            this.dom.propertiesPanel.panel.style.display = 'none';
            this.state.contextNode = null;
            return;
        }

        const nodeId = this.state.selectedNodeIds[0];
        const node = this.state.nodes.find(n => n.id === nodeId);
        if (!node) {
            this.dom.propertiesPanel.panel.style.display = 'none';
            return;
        }

        if (this.state.contextNode?.id !== node.id) {
             this.state.contextNode = node;
             this.dom.propertiesPanel.nodeNameInput.value = node.title;
             this._populateColorSwatches(node.color);
        }

        const nodeTop = node.y - node.height / 2;
        
        const svgRect = this.dom.svg.getBoundingClientRect();
        const screenX = (node.x - this.state.viewbox.x) * (svgRect.width / this.state.viewbox.w) + svgRect.left;
        const screenY = (nodeTop - this.state.viewbox.y) * (svgRect.height / this.state.viewbox.h) + svgRect.top;

        const panel = this.dom.propertiesPanel.panel;
        panel.style.width = `${this.settings.propertiesPanelWidth}px`;
        panel.style.display = 'flex';
        panel.style.left = `${screenX}px`;
        panel.style.top = `${screenY}px`;
        panel.style.transform = `translate(-50%, -100%) translateY(-${this.settings.propertiesPanelOffset}px)`;
    }

    _populateColorSwatches(currentColor) {
        const swatchesContainer = this.dom.propertiesPanel.nodeColorSwatches;
        swatchesContainer.innerHTML = '';
        this.defaultColors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            if (color === currentColor) {
                swatch.classList.add('selected');
            }
            swatch.addEventListener('click', () => {
                if (this.state.contextNode.color !== color) {
                    this._saveStateForUndo('Change Node Color');
                    this.state.contextNode.color = color;
                    this._saveGraphStateToDB();
                    this._render();
                }
            });
            swatchesContainer.appendChild(swatch);
        });
    }

    // =================================================================================================
    // Utilities
    // =================================================================================================

    _log(message) {
        this.dom.infoBar.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    }

    _createSVGElement(tag, attributes = {}) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const key in attributes) {
            el.setAttribute(key, attributes[key]);
        }
        return el;
    }

    _getSVGCoords(e) {
        const pt = this.dom.svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        return pt.matrixTransform(this.dom.svg.getScreenCTM().inverse());
    }

    _screenToSVGCoords(x, y, svgRect) {
        const { w, h, x: vx, y: vy } = this.state.viewbox;
        return {
            x: (x - svgRect.left) * (w / svgRect.width) + vx,
            y: (y - svgRect.top) * (h / svgRect.height) + vy,
        };
    }

    _getOrientation(p, q, r) {
        const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
        if (val === 0) return 0; // Collinear
        return (val > 0) ? 1 : 2; // Clockwise or Counterclockwise
    }

    _onSegment(p, q, r) {
        return (q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
                q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y));
    }

    _lineIntersects(p1, q1, p2, q2) {
        const o1 = this._getOrientation(p1, q1, p2);
        const o2 = this._getOrientation(p1, q1, q2);
        const o3 = this._getOrientation(p2, q2, p1);
        const o4 = this._getOrientation(p2, q2, q1);

        if (o1 !== o2 && o3 !== o4) return true;

        if (o1 === 0 && this._onSegment(p1, p2, q1)) return true;
        if (o2 === 0 && this._onSegment(p1, q2, q1)) return true;
        if (o3 === 0 && this._onSegment(p2, p1, q2)) return true;
        if (o4 === 0 && this._onSegment(p2, q1, q2)) return true;

        return false;
    }
    
    _getAllDescendants(nodeId, nodesSet) {
        const node = this.state.nodes.find(n => n.id === nodeId);
        if (!node || nodesSet.has(node)) return;

        nodesSet.add(node);

        if (node.type === 'group' && node.children) {
            node.children.forEach(childId => this._getAllDescendants(childId, nodesSet));
        }
    }
    
    _isDescendant(childIdToFind, parentId) {
        const parentNode = this.state.nodes.find(n => n.id === parentId);
        if (!parentNode || parentNode.type !== 'group' || !parentNode.children) {
            return false;
        }
        for (const childId of parentNode.children) {
            if (childId === childIdToFind || this._isDescendant(childIdToFind, childId)) {
                return true;
            }
        }
        return false;
    }
    
    _isNodeInGroup(nodeId, groupId) {
        const group = this.state.nodes.find(n => n.id === groupId);
        if (!group || group.type !== 'group' || !group.children) return false;

        const queue = [...group.children];
        while (queue.length > 0) {
            const currentId = queue.shift();
            if (currentId === nodeId) return true;
            
            const currentNode = this.state.nodes.find(n => n.id === currentId);
            if (currentNode?.type === 'group' && currentNode.children) {
                queue.push(...currentNode.children);
            }
        }
        return false;
    }
    
    _getControlPoint(point, socketId, offset = 75) {
        switch (socketId) {
            case 0: return { x: point.x, y: point.y - offset }; // Top
            case 1: return { x: point.x, y: point.y + offset }; // Bottom
            case 2: return { x: point.x - offset, y: point.y }; // Left
            case 3: return { x: point.x + offset, y: point.y }; // Right
            default: return { x: point.x + offset, y: point.y };
        }
    }
    
    _getStraightPoint(point, socketId, distance) {
        switch (socketId) {
            case 0: return { x: point.x, y: point.y - distance }; // Top
            case 1: return { x: point.x, y: point.y + distance }; // Bottom
            case 2: return { x: point.x - distance, y: point.y }; // Left
            case 3: return { x: point.x + distance, y: point.y }; // Right
            default: return { ...point };
        }
    }

    _getSnapTargets(draggedNodeId) {
        const targets = { x: [], y: [] };
        this.state.nodes.forEach(node => {
            if (node.id === draggedNodeId || this.state.selectedNodeIds.includes(node.id)) return;
            const halfW = node.width / 2;
            const halfH = node.height / 2;
            targets.x.push(node.x - halfW, node.x, node.x + halfW);
            targets.y.push(node.y - halfH, node.y, node.y + halfH);
        });
        return targets;
    }

    _getObjectSnap(node, targetX, targetY) {
        const snapThreshold = 10;
        const snapTargets = this._getSnapTargets(node.id);
        const halfW = node.width / 2;
        const halfH = node.height / 2;
        
        const nodeEdgesX = [targetX - halfW, targetX, targetX + halfW];
        const nodeEdgesY = [targetY - halfH, targetY, targetY + halfH];
        
        let bestSnap = { x: null, y: null, snapLineX: null, snapLineY: null };
        let minDx = snapThreshold;
        let minDy = snapThreshold;

        nodeEdgesX.forEach((edgeX, i) => {
            snapTargets.x.forEach(target => {
                const d = Math.abs(edgeX - target);
                if (d < minDx) {
                    minDx = d;
                    bestSnap.x = target - (nodeEdgesX[i] - targetX);
                    bestSnap.snapLineX = target;
                }
            });
        });

        nodeEdgesY.forEach((edgeY, i) => {
            snapTargets.y.forEach(target => {
                const d = Math.abs(edgeY - target);
                if (d < minDy) {
                    minDy = d;
                    bestSnap.y = target - (nodeEdgesY[i] - targetY);
                    bestSnap.snapLineY = target;
                }
            });
        });

        return bestSnap;
    }

    _updateSnapLines(snapResult) {
        this.state.snapLines = [];
        if (!this.state.interaction.snapToObjects) return;

        if (snapResult.snapLineX !== null) {
            const line = this._createSVGElement('line', {
                x1: snapResult.snapLineX, y1: -10000,
                x2: snapResult.snapLineX, y2: 10000,
                class: 'snap-line'
            });
            this.state.snapLines.push(line);
        }
        if (snapResult.snapLineY !== null) {
            const line = this._createSVGElement('line', {
                x1: -10000, y1: snapResult.snapLineY,
                x2: 10000, y2: snapResult.snapLineY,
                class: 'snap-line'
            });
            this.state.snapLines.push(line);
        }
    }

    _updateDefaultColors() {
        this.defaultColors = [];
        const style = getComputedStyle(document.body);
        for (let i = 1; i <= 8; i++) {
            const color = style.getPropertyValue(`--swatch-${i}`).trim();
            if (color) {
                this.defaultColors.push(color);
            }
        }
    }

    _resetSettingsToDefault() {
        this.settings = { ...this.defaultSettings };
        this._loadSettingsToUI();
        this._render();
        this._updateView();
        this._log('Settings reset to default');
    }

    _getAllFolderIds(node, ids = new Set()) {
        if (!node) return ids;

        if (Array.isArray(node.children)) {
            if (node.id !== undefined) {
                ids.add(node.id);
            }
            node.children.forEach(child => this._getAllFolderIds(child, ids));
        }
        return ids;
    }

    _initTreeView() {
        this.treeView = new TreeView(this.dom.leftPanel.fileTree);
        
        // Render with data from DB if it exists
        const initialData = this.state.treeData ? [this.state.treeData] : [];
        const expandedIds = this._getAllFolderIds(this.state.treeData);
        this.treeView.render(initialData, expandedIds);

        this.dom.leftPanel.fileTree.addEventListener('file-selected', (e) => {
            this._log(`File selected: ${e.detail.id}`);
        });

        this.dom.leftPanel.fileTree.addEventListener('file-activated', (e) => {
            this._activateFile(e.detail.id);
        });

        this.dom.leftPanel.fileTree.addEventListener('file-contextmenu', (e) => {
            const { id, isFolder, x, y, isBackground } = e.detail;
            
            const items = [];

            // 'New Folder' is available when clicking a folder or the background
            if (isFolder || isBackground) {
                items.push({
                    label: 'New Folder',
                    icon: 'folder-plus',
                    // if background, parent is root (''), otherwise it's the clicked folder id
                    callback: () => this.treeView.promptNewFolder(isBackground ? '' : id)
                });
            }

            // 'Rename' and 'Delete' are only for existing items
            if (!isBackground) {
                // Add separator if 'New Folder' was also added
                if (items.length > 0) {
                    items.push({ separator: true });
                }
                items.push({
                    label: 'Rename',
                    icon: 'edit-3',
                    callback: () => this.treeView.startRename(id)
                });
                
                if (!isFolder) {
                    items.push({
                        label: 'Delete File',
                        icon: 'trash-2',
                        callback: () => this._deleteFileFromTree(id)
                    });
                }
            } else if (id === null) {
                // Don't show a menu for a right click on the background of an empty tree.
                return;
            }
            
            this._showContextMenu(x, y, 'custom', { items });
        });

        this.dom.leftPanel.fileTree.addEventListener('item-renamed', async (e) => {
            const { id, newName } = e.detail;
            await this._handleRenameItem(id, newName);
        });

        this.dom.leftPanel.fileTree.addEventListener('folder-created', (e) => {
            const { parentId, newName } = e.detail;
            this._handleCreateFolder(parentId, newName);
        });
    }

    async _loadFolder() {
        if (!window.showDirectoryPicker) {
            this._log('File System Access API is not supported in this browser.');
            alert('Your browser does not support the File System Access API.');
            return;
        }

        try {
            const directoryHandle = await window.showDirectoryPicker();
            this.state.fileHandles.clear();
            this.state.resolvedUrlCache.clear();
            this.state.rootDirectoryHandle = directoryHandle;
            const treeData = await this._buildFileTree(directoryHandle);
            this.state.treeData = treeData;
            const expandedIds = this._getAllFolderIds(treeData);
            this.treeView.render([treeData], expandedIds);
            this._log(`Loaded directory: ${directoryHandle.name}`);
        } catch (err) {
            if (err.name !== 'AbortError') {
                this._log(`Error loading directory: ${err.message}`);
                console.error(err);
            } else {
                this._log('Directory selection cancelled.');
            }
        }
    }

    async _buildFileTree(directoryHandle, path = []) {
        const children = [];
        for await (const entry of directoryHandle.values()) {
            const currentPath = [...path, entry.name];
            const id = currentPath.join('/');
            
            const parts = entry.name.split('.');
            const extension = parts.length > 1 ? `.${parts.pop().toLowerCase()}` : '';

            if (entry.kind === 'file' && this.allowedExtensions.includes(extension)) {
                let fileType = 'file';
                for (const type in this.fileTypes) {
                    if (this.fileTypes[type].includes(extension)) {
                        fileType = type;
                        break;
                    }
                }
                this.state.fileHandles.set(id, entry);
                children.push({ id, name: entry.name, type: fileType });
            } else if (entry.kind === 'directory') {
                children.push(await this._buildFileTree(entry, currentPath));
            }
        }
        return {
            id: path.join('/'),
            name: path.length > 0 ? path[path.length - 1] : directoryHandle.name,
            children: children.sort((a, b) => {
                const aIsFolder = a.children != null;
                const bIsFolder = b.children != null;
                if (aIsFolder === bIsFolder) {
                    return a.name.localeCompare(b.name);
                }
                return aIsFolder ? -1 : 1;
            })
        };
    }

    async _loadFile(fileId) {
        const handle = this.state.fileHandles.get(fileId) || (this.state.virtualFileHandles && this.state.virtualFileHandles.get(fileId));
        if (!handle) {
            this._log(`File handle not found for ${fileId}`);
            return;
        }

        const parts = handle.name.split('.');
        const extension = parts.length > 1 ? `.${parts.pop().toLowerCase()}` : '';
        if (!this.fileTypes.json.includes(extension)) {
            this._log(`Cannot open non-JSON file: ${handle.name}`);
            return;
        }

        try {
            const getFileObject = async (h) => {
                if (typeof h.getFile === 'function') {
                    return await h.getFile();
                }
                return h;
            };
            const file = await getFileObject(handle);
            const content = await file.text();
            const data = JSON.parse(content);
            this._loadGraphData(data, file.name);
        } catch (err) {
            this._log(`Error loading file: ${err.message}`);
            console.error(err);
        }
    }

    _startResizeLeftPanel(e) {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = this.dom.leftPanel.panel.offsetWidth;

        const doDrag = (e) => {
            const newWidth = startWidth + e.clientX - startX;
            const minWidth = 300;
            const maxWidth = 800;
            this.dom.leftPanel.panel.style.width = `${Math.max(minWidth, Math.min(newWidth, maxWidth))}px`;
        };

        const stopDrag = () => {
            document.documentElement.removeEventListener('mousemove', doDrag, false);
            document.documentElement.removeEventListener('mouseup', stopDrag, false);
        };

        document.documentElement.addEventListener('mousemove', doDrag, false);
        document.documentElement.addEventListener('mouseup', stopDrag, false);
    }

    _zoomToFit() {
        if (this.state.nodes.length === 0) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        this.state.nodes.forEach(node => {
            minX = Math.min(minX, node.x - node.width / 2);
            minY = Math.min(minY, node.y - node.height / 2);
            maxX = Math.max(maxX, node.x + node.width / 2);
            maxY = Math.max(maxY, node.y + node.height / 2);
        });

        if (minX === Infinity) return;

        const padding = 100;
        const selectionWidth = maxX - minX;
        const selectionHeight = maxY - minY;

        const svgRect = this.dom.svg.getBoundingClientRect();
        const zoomX = svgRect.width / (selectionWidth + padding * 2);
        const zoomY = svgRect.height / (selectionHeight + padding * 2);
        let zoomLevel = Math.min(zoomX, zoomY);

        zoomLevel = Math.max(this.settings.minZoom, Math.min(this.settings.maxZoom, zoomLevel));
        
        this.state.viewbox.w = svgRect.width / zoomLevel;
        this.state.viewbox.h = svgRect.height / zoomLevel;

        const centerX = minX + selectionWidth / 2;
        const centerY = minY + selectionHeight / 2;
        
        this.state.viewbox.x = centerX - this.state.viewbox.w / 2;
        this.state.viewbox.y = centerY - this.state.viewbox.h / 2;

        this._updateView();
    }
    
    async _importGraph() {
        if (!window.showOpenFilePicker) {
            this._log('File System Access API is not supported in your browser.');
            alert('Your browser does not support this feature.');
            return;
        }
        try {
            const [fileHandle] = await window.showOpenFilePicker({
                types: [{
                    description: 'JSON Files',
                    accept: { 'application/json': ['.json'] },
                }],
                excludeAcceptAllOption: true,
                multiple: false,
            });
            const file = await fileHandle.getFile();
            const content = await file.text();
            const data = JSON.parse(content);
            this._loadGraphData(data, file.name);
        } catch (err) {
            if (err.name !== 'AbortError') {
                this._log(`Error opening file: ${err.message}`);
                console.error(err);
            } else {
                this._log('File selection cancelled.');
            }
        }
    }

    _exportGraph() {
        const data = {
            nodes: this.state.nodes,
            edges: this.state.edges,
            tree: this.state.treeData,
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href",     dataStr);
        downloadAnchorNode.setAttribute("download", "graph.json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        this._log('Graph exported as graph.json');
    }

    _loadGraphData(data, sourceName = 'file') {
        if (data && Array.isArray(data.nodes) && Array.isArray(data.edges)) {
            this._saveStateForUndo(`Load from ${sourceName}`);
            this.state.nodes = data.nodes;
            this.state.edges = data.edges;
            this.state.nodeIdCounter = Math.max(0, ...this.state.nodes.map(n => n.id)) + 1;
            
            this._log(`Loaded graph from ${sourceName}`);
            
            if (data.tree) {
                this.state.treeData = data.tree;
                const expandedIds = this._getAllFolderIds(this.state.treeData);
                this.treeView.render([this.state.treeData], expandedIds);
                this.state.fileHandles.clear();
                this._log('File tree restored. Please use "Load Folder" to re-enable file access.');
            } else {
                this.state.treeData = null;
                this.treeView.render([]);
            }

            this._render();
            this._zoomToFit();
        } else {
             alert('Invalid JSON format for graph data.');
        }
    }

    async _refreshFileTree() {
        if (!this.state.rootDirectoryHandle) {
            this._log('No folder loaded to refresh.');
            return;
        }
        this._log('Refreshing file tree...');
        try {
            this.state.fileHandles.clear();
            const treeData = await this._buildFileTree(this.state.rootDirectoryHandle);
            this.state.treeData = treeData;
            const expandedIds = this._getAllFolderIds(treeData);
            this.treeView.render([treeData], expandedIds);
            this._log('File tree refreshed.');
        } catch (err) {
            this._log(`Error refreshing file tree: ${err.message}`);
            console.error(err);
        }
    }

    registerNodeType(nodeDefinition) {
        if (!nodeDefinition.type) {
            console.error('Node definition must have a type.', nodeDefinition);
            return;
        }
        this.nodeTypes.set(nodeDefinition.type, nodeDefinition);
        this._log(`Registered custom node type: ${nodeDefinition.type}`);
    }

    _populateContextMenu(items) {
        this.dom.contextMenu.list.innerHTML = '';
        items.forEach(item => {
            if (item.separator) {
                const separator = document.createElement('li');
                separator.className = 'context-menu-separator';
                this.dom.contextMenu.list.appendChild(separator);
                return;
            }
    
            const li = document.createElement('li');
            if (item.icon) {
                li.innerHTML = `<i data-lucide="${item.icon}"></i><span>${item.label}</span>`;
            } else {
                li.innerHTML = `<span>${item.label}</span>`;
            }

            if(item.disabled) {
                li.classList.add('disabled');
            } else {
                li.addEventListener('click', (e) => {
                    e.stopPropagation();
                    item.callback();
                    this._hideContextMenu();
                });
            }
            this.dom.contextMenu.list.appendChild(li);
        });
        lucide.createIcons({ nodes: [this.dom.contextMenu.list] });
    }

    async _activateFile(fileId, position = null) {
        const handle = this.state.fileHandles.get(fileId) || (this.state.virtualFileHandles && this.state.virtualFileHandles.get(fileId));
        if (!handle) {
            this._log(`File handle not found for ${fileId}`);
            return;
        }

        const getFileObject = async (h) => {
            if (typeof h.getFile === 'function') {
                return await h.getFile();
            }
            return h;
        };

        const { x, y } = position || { 
            x: this.state.viewbox.x + this.state.viewbox.w / 2, 
            y: this.state.viewbox.y + this.state.viewbox.h / 2 
        };

        const parts = handle.name.split('.');
        const extension = parts.length > 1 ? `.${parts.pop().toLowerCase()}` : '';

        if (this.fileTypes.markdown.includes(extension)) {
            const newNode = this._addNode(x, y, 'markdown-node');
            newNode.properties.content = `file-id://${fileId}`;
            newNode.title = handle.name;
            this._saveGraphStateToDB();
            this._log(`Opened ${handle.name} as a markdown node.`);
            this._render();
        } else if (this.fileTypes.image.includes(extension)) {
            const newNode = this._addNode(x, y, 'markdown-node');
            newNode.properties.content = `![image](file-id://${fileId})`;
            newNode.title = handle.name;
            newNode.width = 740;
            newNode.height = 540;
            this._saveGraphStateToDB();
            this._log(`Opened ${handle.name} as an image node.`);
            this._render();
        } else if (this.fileTypes.video.includes(extension)) {
            try {
                const file = await getFileObject(handle);
                const newNode = this._addNode(x, y, 'markdown-node');
                
                newNode.properties.content = `<video controls width="100%"><source src="file-id://${fileId}" type="${file.type}"></video>`;
                newNode.title = file.name;
                newNode.width = 740;
                newNode.height = 540;
                this._saveGraphStateToDB();
                this._log(`Opened ${file.name} as a video node.`);
                this._render();
            } catch (err) {
                this._log(`Error reading video file: ${err.message}`);
                console.error(err);
            }
        } else if (this.fileTypes.json.includes(extension)) {
            await this._loadFile(fileId);
        } else {
            this._log(`Cannot open file type: ${handle.name}`);
        }
    }

    async _handleDroppedFileOnCanvas(file, clientX, clientY) {
        const extension = `.${file.name.split('.').pop().toLowerCase()}`;
        const pt = this._screenToSVGCoords(clientX, clientY, this.dom.svg.getBoundingClientRect());

        if (this.fileTypes.json.includes(extension)) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    this._loadGraphData(data, file.name);
                    this._addFileToTree(file, 'json');
                } catch (error) {
                    this._log(`Error parsing JSON file: ${error.message}`);
                }
            };
            reader.readAsText(file);
        } else if (this.fileTypes.markdown.includes(extension)) {
            this._addFileToTree(file, 'markdown');
            const newNode = this._addNode(pt.x, pt.y, 'markdown-node');
            newNode.properties.content = `file-id://${file.name}`;
            newNode.title = file.name;
            this._saveGraphStateToDB();
            this._render();
        } else if (this.fileTypes.image.includes(extension)) {
            this._addFileToTree(file, 'image');
            const newNode = this._addNode(pt.x, pt.y, 'markdown-node');
            
            newNode.properties.content = `![image](file-id://${file.name})`;
            newNode.title = file.name;
            newNode.width = 740;
            newNode.height = 540;
            this._saveGraphStateToDB();
            this._log(`Opened ${file.name} as an image node.`);
            this._render();
        } else if (this.fileTypes.video.includes(extension)) {
            this._addFileToTree(file, 'video');
            const newNode = this._addNode(pt.x, pt.y, 'markdown-node');

            newNode.properties.content = `<video controls width="100%"><source src="file-id://${file.name}" type="${file.type}"></video>`;
            newNode.title = file.name;
            newNode.width = 740;
            newNode.height = 540;
            this._saveGraphStateToDB();
            this._log(`Opened ${file.name} as a video node.`);
            this._render();
        } else {
            this._log(`Unsupported file type dropped on canvas: ${file.name}`);
        }
    }

    _addFileToTree(file, fileType) {
        if (!this.state.treeData) {
            this.state.treeData = {
                id: 'root',
                name: 'Project Files',
                children: [],
                isVirtual: true,
            };
            this.state.fileHandles.clear(); // Clear out old handles from directory-based loading
        }

        const fileId = file.name;
        
        const targetFolder = this.state.treeData;
        if (targetFolder.children.some(child => child.id === fileId)) {
            this._log(`File "${file.name}" already exists in the root directory.`);
            return;
        }

        targetFolder.children.push({
            id: fileId,
            name: file.name,
            type: fileType
        });
        
        if (!this.state.virtualFileHandles) {
            this.state.virtualFileHandles = new Map();
        }
        this.state.virtualFileHandles.set(fileId, file);
        
        const expandedIds = this.treeView.getExpansionState();
        this.treeView.render([this.state.treeData], expandedIds);
        
        // Save to IndexedDB
        this._putDB('files', { id: fileId, file: file, type: fileType });
        this._saveGraphStateToDB(); // Also save the tree structure
    }

    async _saveGraphStateToDB() {
        try {
            const state = {
                key: 'currentGraph',
                nodes: this.state.nodes,
                edges: this.state.edges,
                nodeIdCounter: this.state.nodeIdCounter,
                treeData: this.state.treeData
            };
            await this._putDB('graphState', state);
            this._log('Graph state saved to database.');
        } catch (error) {
            console.error('Failed to save graph state:', error);
            this._log('Error saving graph state to database.');
        }
    }

    async _putDB(storeName, item) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(item);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async _deleteDB(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    _deleteFileFromTree(fileId) {
        if (!this.state.treeData || !this.state.treeData.children) return;

        const removeChildRecursive = (children) => {
            const index = children.findIndex(child => child.id === fileId);
            if (index > -1) {
                children.splice(index, 1);
                return true;
            }
            for (const child of children) {
                if (child.children && removeChildRecursive(child.children)) {
                    return true;
                }
            }
            return false;
        };

        if (removeChildRecursive(this.state.treeData.children)) {
            if (this.state.virtualFileHandles && this.state.virtualFileHandles.has(fileId)) {
                this.state.virtualFileHandles.delete(fileId);
            }
            
            const expandedIds = this.treeView.getExpansionState();
            
            this._deleteDB('files', fileId);
            this._saveGraphStateToDB();
            this.treeView.render([this.state.treeData], expandedIds);
            this._log(`Deleted file: ${fileId}`);
        }
    }

    async _resolveFileIdToUrl(fileId) {
        if (this.state.resolvedUrlCache.has(fileId)) {
            return this.state.resolvedUrlCache.get(fileId);
        }

        const handle = this.state.fileHandles.get(fileId) || (this.state.virtualFileHandles && this.state.virtualFileHandles.get(fileId));
        if (!handle) {
            console.warn(`Could not resolve file ID: ${fileId}`);
            return 'about:blank#error';
        }

        const getFileObject = async (h) => {
            if (typeof h.getFile === 'function') {
                return await h.getFile();
            }
            return h;
        };

        try {
            const file = await getFileObject(handle);
            const url = URL.createObjectURL(file);
            this.state.resolvedUrlCache.set(fileId, url);
            return url;
        } catch (err) {
            console.error(`Error creating object URL for ${fileId}:`, err);
            return 'about:blank#error';
        }
    }

    async _handleRenameItem(oldId, newName) {
        this._saveStateForUndo('Rename Item');
    
        let itemToRename = null;
        let parentFolder = null;
    
        const findItemRecursive = (folder) => {
            if (!folder || !folder.children) return;
            for (const item of folder.children) {
                if (item.id === oldId) {
                    itemToRename = item;
                    parentFolder = folder;
                    return;
                }
                if (item.children) {
                    findItemRecursive(item);
                }
            }
        };
        findItemRecursive(this.state.treeData);
    
        if (!itemToRename) {
            this._log(`Error: Could not find item with ID ${oldId} to rename.`);
            return;
        }
    
        if (parentFolder.children.some(child => child.name === newName && child.id !== oldId)) {
            this._log(`Error: An item named "${newName}" already exists here.`);
            alert(`An item named "${newName}" already exists here.`);
            const expansionState = this.treeView.getExpansionState();
            this.treeView.render([this.state.treeData], expansionState);
            return;
        }
    
        const oldPathPrefix = oldId;
        const newPathPrefix = oldId.substring(0, oldId.lastIndexOf('/') + 1) + newName;
        const itemsToUpdate = [];
    
        const collectItems = (item) => {
            itemsToUpdate.push(item);
            if (item.children) {
                item.children.forEach(collectItems);
            }
        };
        collectItems(itemToRename);
        
        const idUpdateMap = new Map();
    
        for (const item of itemsToUpdate) {
            const oldItemId = item.id;
            const newItemId = oldItemId.replace(oldPathPrefix, newPathPrefix);
            
            idUpdateMap.set(oldItemId, newItemId);
            item.id = newItemId;
            
            const virtualHandle = this.state.virtualFileHandles && this.state.virtualFileHandles.get(oldItemId);
            if (virtualHandle) {
                this.state.virtualFileHandles.delete(oldItemId);
                this.state.virtualFileHandles.set(newItemId, virtualHandle);
                await this._deleteDB('files', oldItemId);
                await this._putDB('files', { id: newItemId, file: virtualHandle, type: item.type });
            }

            const realHandle = this.state.fileHandles.get(oldItemId);
            if (realHandle) {
                this.state.fileHandles.delete(oldItemId);
                this.state.fileHandles.set(newItemId, realHandle);
            }
        }
        
        itemToRename.name = newName;
    
        for (const node of this.state.nodes) {
            if (node.properties && node.properties.content && typeof node.properties.content === 'string') {
                let newContent = node.properties.content;
                for (const [oldRefId, newRefId] of idUpdateMap.entries()) {
                    newContent = newContent.replace(new RegExp(`file-id://${oldRefId}`, 'g'), `file-id://${newRefId}`);
                }
                node.properties.content = newContent;
            }
        }
        
        await this._saveGraphStateToDB();
        const expansionState = this.treeView.getExpansionState();
        this.treeView.render([this.state.treeData], expansionState);
        this._log(`Renamed "${oldId}" to "${newName}".`);
    }

    async _handleCreateFolder(parentId, newName) {
        this._saveStateForUndo('Create Folder');
    
        let parentFolder = null;
    
        if (parentId === '') {
            if (!this.state.treeData) {
                 this.state.treeData = {
                    id: '',
                    name: 'Project Files',
                    children: []
                };
            }
            parentFolder = this.state.treeData;
        } else {
            const findParentRecursive = (currentFolder) => {
                if (currentFolder.id === parentId) {
                    return currentFolder;
                }
                if (currentFolder.children) {
                    for (const child of currentFolder.children) {
                        if (child.children) {
                             const found = findParentRecursive(child);
                             if (found) return found;
                        }
                    }
                }
                return null;
            };
            parentFolder = findParentRecursive(this.state.treeData);
        }
    
        if (!parentFolder) {
            this._log(`Error: Could not find parent folder with ID ${parentId}.`);
            return;
        }
        
        if (!parentFolder.children) {
            parentFolder.children = [];
        }
    
        if (parentFolder.children.some(child => child.name === newName)) {
            this._log(`Error: An item named "${newName}" already exists here.`);
            alert(`An item named "${newName}" already exists here.`);
            return;
        }
    
        const newFolderId = parentId ? `${parentId}/${newName}` : newName;
        const newFolder = {
            id: newFolderId,
            name: newName,
            children: []
        };
    
        parentFolder.children.push(newFolder);
        
        parentFolder.children.sort((a, b) => {
            const aIsFolder = a.children != null;
            const bIsFolder = b.children != null;
            if (aIsFolder === bIsFolder) {
                return a.name.localeCompare(b.name);
            }
            return aIsFolder ? -1 : 1;
        });
    
        (async () => {
            await this._saveGraphStateToDB();
            const expansionState = this.treeView.getExpansionState();
            expansionState.add(parentId); 
            this.treeView.render([this.state.treeData], expansionState);
            this._log(`Created folder "${newName}".`);
        })();
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const editor = new GraphEditor('graph-svg');
    await editor.init();
}); 