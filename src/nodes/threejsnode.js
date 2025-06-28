/**
 * @fileoverview A specialized node for rendering a 3D viewport using three.js.
 * This node will serve as the main canvas for 3D objects, timelines, and more.
 */

class ThreeJSNode extends BaseNode {
    /**
     * @param {object} [options={}] - The options for the Three.js node.
     */
    constructor(options = {}) {
        // Set defaults specific to a Three.js node
        const defaults = {
            width: 800,
            height: 600,
            title: '3D Viewport',
            type: 'ThreeJSNode',
            color: 'default' // Using default to match group nodes
        };

        // Merge options with defaults
        super({ ...defaults, ...options });

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.gridHelper = null;
        this.axesHelper = null;
        this.isInteracting = false;
        this.animationFrameId = null;
        this.resizeObserver = null;
        this.needsRender = true; // Track if render is needed
        this.isAnimating = false; // Track if animation loop is active
        this.tumblingEnabled = false;
        this.wheelTimeout = null;

        // Timeline state
        this.isPlaying = false;
        this.playDirection = 1; // 1 for forward, -1 for backward
        this.startTime = 1000;
        this.endTime = 1100; // Default to a 100-frame range
        this.currentTime = this.startTime;
        this.timelineMinimizedHeight = 30; // Corresponds to CSS height for header
        this.timelinePadding = 25;
        this.fps = 24;
        this.frameDuration = 1000 / 24;
        this.timelineAnimationId = null;
        this.lastFrameTime = 0;

        // Resizing state for timeline panels
        this.timelineResizingState = {
            isResizing: false,
            target: null, // 'layersPanel' or 'timelineEditor'
            startX: 0,
            startY: 0,
            startWidth: 0,
            startHeight: 0
        };

        // Range interaction state
        this.rangeInteractionState = {
            isActive: false,
            interactionType: null, // 'move', 'resize-start', 'resize-end'
            initialStartTime: 0,
            initialEndTime: 0,
            initialMouseX: 0,
            pixelsPerFrame: 0
        };
    }

    /**
     * Overrides the default render method to add a specific class and icon.
     * @param {HTMLElement} parentElement - The parent element to append the node to.
     * @returns {HTMLElement} The created DOM element for the node.
     */
    render(parentElement) {
        // This will call the BaseNode render, which in turn will call
        // our overridden renderContent() method once.
        super.render(parentElement);

        // After the base is rendered, we can add our specific class and icon.
        this.element.classList.add('threejs-node');
        
        const icon = this.element.querySelector('.node-icon');
        if (icon) {
            icon.classList.remove('icon-file-text'); // BaseNode might add this
            icon.classList.add('icon-cube');
        }

        // The content area's contenteditable needs to be managed here,
        // as BaseNode may set it.
        const contentArea = this.element.querySelector('.node-content');
        if (contentArea) {
            contentArea.contentEditable = 'false';
            // Prevent node drag from content dbl-click, which would try to edit.
            contentArea.addEventListener('dblclick', (e) => e.stopPropagation());
        }

        return this.element;
    }

    /**
     * Renders the 3D canvas and timeline controls into the node's content area.
     * @param {HTMLElement} contentArea - The element to render content into.
     */
    renderContent(contentArea) {
        contentArea.innerHTML = '';
        contentArea.style.padding = '0';
        contentArea.style.overflow = 'hidden';
        contentArea.style.display = 'flex';
        contentArea.style.flexDirection = 'column';

        // --- 1. Canvas Container (3D Viewport) ---
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'threejs-canvas-container';
        
        const statusIndicator = document.createElement('div');
        statusIndicator.className = 'threejs-status-indicator';
        statusIndicator.innerHTML = 'NOT ACTIVE<br><span class="status-subtitle">(double click to activate)</span>';
        statusIndicator.classList.toggle('active', this.tumblingEnabled);
        canvasContainer.appendChild(statusIndicator);

        // --- 2. Timeline Editor Container ---
        const timelineEditorContainer = document.createElement('div');
        timelineEditorContainer.className = 'timeline-editor-container';

        // 2.0 Horizontal Resize Handle
        const horizontalResizeHandle = document.createElement('div');
        horizontalResizeHandle.className = 'timeline-resize-handle horizontal';
        timelineEditorContainer.appendChild(horizontalResizeHandle);

        // 2a. Scene Outline Panel (Left)
        const sceneOutlinePanel = document.createElement('div');
        sceneOutlinePanel.className = 'scene-outline-panel';
        sceneOutlinePanel.innerHTML = `
            <div class="scene-outline-header">Scene</div>
            <div class="scene-outline-list">
                <div class="scene-item" data-level="0">
                    <span class="scene-item-toggle"></span>
                    <span class="scene-item-icon icon-globe"></span>
                    <span class="scene-item-label">World</span>
                </div>
            </div>
        `;
        timelineEditorContainer.appendChild(sceneOutlinePanel);

        // 2ab. Vertical Resize Handle
        const verticalResizeHandle = document.createElement('div');
        verticalResizeHandle.className = 'timeline-resize-handle vertical';
        timelineEditorContainer.appendChild(verticalResizeHandle);

        // 2b. Main Panel (Right)
        const mainPanel = document.createElement('div');
        mainPanel.className = 'timeline-main-panel';

        // Header
        const timelineHeader = document.createElement('div');
        timelineHeader.className = 'timeline-header';
        
        const startFrameGroup = document.createElement('div');
        startFrameGroup.className = 'frame-input-group';
        startFrameGroup.innerHTML = `
            <label for="start-frame-${this.id}">Start</label>
            <input type="number" id="start-frame-${this.id}" class="frame-input" data-range="start" value="${this.startTime}">
        `;

        const centerControls = document.createElement('div');
        centerControls.className = 'timeline-center-controls';

        const timelineControls = document.createElement('div');
        timelineControls.className = 'timeline-controls';
        timelineControls.innerHTML = `
            <button class="timeline-btn" data-action="skip-to-start" title="Skip to Start"><span class="icon-skip-back"></span></button>
            <button class="timeline-btn" data-action="play-backward" title="Play Backward"><span class="icon-rewind"></span></button>
            <button class="timeline-btn" data-action="play-forward" title="Play/Pause"><span class="icon-play"></span></button>
            <button class="timeline-btn" data-action="skip-to-end" title="Skip to End"><span class="icon-skip-forward"></span></button>
        `;
        
        const fpsGroup = document.createElement('div');
        fpsGroup.className = 'frame-input-group';
        fpsGroup.innerHTML = `
            <label for="fps-select-${this.id}">FPS</label>
            <select id="fps-select-${this.id}" class="frame-input fps-select">
                <option value="24">24</option>
                <option value="25">25</option>
                <option value="30">30</option>
                <option value="60">60</option>
                <option value="120">120</option>
            </select>
        `;
        fpsGroup.querySelector('select').value = this.fps;
        
        centerControls.appendChild(timelineControls);
        centerControls.appendChild(fpsGroup);

        const endFrameGroup = document.createElement('div');
        endFrameGroup.className = 'frame-input-group';
        endFrameGroup.innerHTML = `
            <label for="end-frame-${this.id}">End</label>
            <input type="number" id="end-frame-${this.id}" class="frame-input" data-range="end" value="${this.endTime}">
        `;
        
        timelineHeader.appendChild(startFrameGroup);
        timelineHeader.appendChild(centerControls);
        timelineHeader.appendChild(endFrameGroup);
        mainPanel.appendChild(timelineHeader);

        // Body
        const timelineBody = document.createElement('div');
        timelineBody.className = 'timeline-body';
        
        const timelineRuler = document.createElement('div');
        timelineRuler.className = 'timeline-ruler'; // Will be populated by a new renderTimelineGrid method
        
        const keyframeGrid = document.createElement('div');
        keyframeGrid.className = 'timeline-keyframe-grid';
        
        const rangeOverlay = document.createElement('div');
        rangeOverlay.className = 'timeline-range-overlay';
        rangeOverlay.innerHTML = `
            <div class="timeline-range-handle" data-handle-type="start">
                <div class="range-handle-indicator"></div>
            </div>
            <div class="timeline-range-handle" data-handle-type="end">
                <div class="range-handle-indicator"></div>
            </div>
        `;
        keyframeGrid.appendChild(rangeOverlay);
        
        const playhead = document.createElement('div');
        playhead.className = 'playhead';
        playhead.style.left = '50%'; // Placeholder
        playhead.innerHTML = `
            <div class="playhead-head">${this.currentTime}</div>
            <div class="playhead-line"></div>
        `;
        
        keyframeGrid.appendChild(playhead);
        timelineBody.appendChild(timelineRuler);
        timelineBody.appendChild(keyframeGrid);
        mainPanel.appendChild(timelineBody);
        
        timelineEditorContainer.appendChild(mainPanel);

        // --- Final Assembly ---
        contentArea.appendChild(canvasContainer);
        contentArea.appendChild(timelineEditorContainer);

        // Render ruler and grid, and the new overlay
        this.renderTimelineGrid();
        this.updateTimelineRangeOverlay();

        // Add timeline event listeners
        this.addTimelineListeners(timelineEditorContainer);
        this.addRangeInteractionListeners(rangeOverlay);
        this.initResizeListeners(timelineEditorContainer, sceneOutlinePanel, verticalResizeHandle, horizontalResizeHandle);

        // Initialize the three.js scene in the canvas container
        this.initScene(canvasContainer);
    }

    /**
     * Renders the grid lines, background bands, and frame numbers for the timeline.
     */
    renderTimelineGrid() {
        const ruler = this.element.querySelector('.timeline-ruler');
        const grid = this.element.querySelector('.timeline-keyframe-grid');
        if (!ruler || !grid) return;

        // Ensure containers for lines and background exist, in the correct order (bg first)
        let gridBg = grid.querySelector('.timeline-grid-background');
        if (!gridBg) {
            gridBg = document.createElement('div');
            gridBg.className = 'timeline-grid-background';
            grid.prepend(gridBg);
        }

        let gridLines = grid.querySelector('.timeline-grid-lines');
        if (!gridLines) {
            gridLines = document.createElement('div');
            gridLines.className = 'timeline-grid-lines';
            grid.prepend(gridLines);
        }

        // Clear previous contents
        ruler.innerHTML = '';
        gridLines.innerHTML = '';
        gridBg.innerHTML = '';

        const displayStartTime = this.startTime - this.timelinePadding;
        const displayEndTime = this.endTime + this.timelinePadding;
        const displayRange = displayEndTime - displayStartTime;
        if (displayRange <= 0) return;

        let majorTickSpacing = 10;
        if (displayRange > 200) majorTickSpacing = 25;
        if (displayRange > 500) majorTickSpacing = 50;

        const minorTickSpacing = 5;

        for (let i = displayStartTime; i <= displayEndTime; i++) {
            const position = ((i - displayStartTime) / displayRange) * 100;

            // --- 1. Ruler Ticks and Labels ---
            const rulerTick = document.createElement('div');
            rulerTick.className = 'ruler-tick';
            rulerTick.style.left = `${position}%`;

            if (i % majorTickSpacing === 0) {
                rulerTick.classList.add('major');
                const tickLabel = document.createElement('div');
                tickLabel.className = 'ruler-tick-label';
                tickLabel.textContent = i;
                tickLabel.style.left = `${position}%`;
                ruler.appendChild(tickLabel);
            } else if (i % minorTickSpacing === 0) {
                rulerTick.classList.add('minor');
            } else {
                rulerTick.classList.add('frame');
            }
            ruler.appendChild(rulerTick);

            // --- 2. Vertical Grid Lines ---
            if (i % majorTickSpacing === 0) {
                const line = document.createElement('div');
                line.className = 'timeline-grid-line major';
                line.style.left = `${position}%`;
                gridLines.appendChild(line);
            } else if (i % minorTickSpacing === 0) {
                const line = document.createElement('div');
                line.className = 'timeline-grid-line minor';
                line.style.left = `${position}%`;
                gridLines.appendChild(line);
            }
        }

        // --- 3. Background Bands ---
        // Align bands with major ticks, creating an alternating pattern
        for (let i = displayStartTime - (displayStartTime % (majorTickSpacing * 2)); i < displayEndTime; i += (majorTickSpacing * 2)) {
            const bandStartFrame = Math.max(i, displayStartTime);
            const bandEndFrame = Math.min(i + majorTickSpacing, displayEndTime);

            if (bandStartFrame >= bandEndFrame) continue;

            const bandStartPos = ((bandStartFrame - displayStartTime) / displayRange) * 100;
            const bandEndPos = ((bandEndFrame - displayStartTime) / displayRange) * 100;

            const band = document.createElement('div');
            band.className = 'timeline-grid-band';
            band.style.left = `${bandStartPos}%`;
            band.style.width = `${bandEndPos - bandStartPos}%`;
            gridBg.appendChild(band);
        }
    }

    /**
     * Updates the visual overlay for the active timeline range.
     */
    updateTimelineRangeOverlay() {
        const overlay = this.element.querySelector('.timeline-range-overlay');
        if (!overlay) return;

        const displayStartTime = this.startTime - this.timelinePadding;
        const displayEndTime = this.endTime + this.timelinePadding;
        const displayRange = displayEndTime - displayStartTime;

        if (displayRange <= 0) {
            overlay.style.display = 'none';
            return;
        }

        overlay.style.display = 'block';

        const left = ((this.startTime - displayStartTime) / displayRange) * 100;
        const width = ((this.endTime - this.startTime) / displayRange) * 100;

        overlay.style.left = `${left}%`;
        overlay.style.width = `calc(${width}% + 1px)`;
    }

    /**
     * Adds event listeners for interacting with the timeline range overlay.
     * @param {HTMLElement} rangeOverlay The overlay element.
     */
    addRangeInteractionListeners(rangeOverlay) {
        rangeOverlay.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();

            this.rangeInteractionState.isActive = true;
            this.rangeInteractionState.initialMouseX = e.clientX;
            this.rangeInteractionState.initialStartTime = this.startTime;
            this.rangeInteractionState.initialEndTime = this.endTime;

            const grid = this.element.querySelector('.timeline-keyframe-grid');
            const gridWidth = grid.offsetWidth;
            const displayRange = (this.endTime + this.timelinePadding) - (this.startTime - this.timelinePadding);
            this.rangeInteractionState.pixelsPerFrame = gridWidth / displayRange;

            const handle = e.target.closest('.timeline-range-handle');
            if (handle) {
                this.rangeInteractionState.interactionType = handle.dataset.handleType === 'start' ? 'resize-start' : 'resize-end';
            } else {
                this.rangeInteractionState.interactionType = 'move';
            }

            const onMouseMove = (moveEvent) => {
                if (!this.rangeInteractionState.isActive) return;

                const dx = moveEvent.clientX - this.rangeInteractionState.initialMouseX;
                const dFrames = Math.round(dx / this.rangeInteractionState.pixelsPerFrame);
                
                let newStartTime = this.rangeInteractionState.initialStartTime;
                let newEndTime = this.rangeInteractionState.initialEndTime;

                if (this.rangeInteractionState.interactionType === 'move') {
                    newStartTime += dFrames;
                    newEndTime += dFrames;
                } else if (this.rangeInteractionState.interactionType === 'resize-start') {
                    newStartTime += dFrames;
                    if (newStartTime >= newEndTime) {
                        newStartTime = newEndTime - 1;
                    }
                } else if (this.rangeInteractionState.interactionType === 'resize-end') {
                    newEndTime += dFrames;
                    if (newEndTime <= newStartTime) {
                        newEndTime = newStartTime + 1;
                    }
                }

                this.startTime = newStartTime;
                this.endTime = newEndTime;
                
                // Update input fields
                this.element.querySelector(`[data-range="start"]`).value = this.startTime;
                this.element.querySelector(`[data-range="end"]`).value = this.endTime;

                // Redraw UI
                this.renderTimelineGrid();
                this.updateTimelineRangeOverlay();
                this.updatePlayheadPosition();
            };

            const onMouseUp = () => {
                this.rangeInteractionState.isActive = false;
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });
    }

    /**
     * Adds event listeners to the timeline controls.
     * @param {HTMLElement} timelineContainer 
     */
    addTimelineListeners(timelineContainer) {
        // Prevent node dragging when interacting with timeline
        timelineContainer.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });

        const playForwardBtn = timelineContainer.querySelector('[data-action="play-forward"]');
        const playBackwardBtn = timelineContainer.querySelector('[data-action="play-backward"]');
        const skipToStartBtn = timelineContainer.querySelector('[data-action="skip-to-start"]');
        const skipToEndBtn = timelineContainer.querySelector('[data-action="skip-to-end"]');

        const updatePlayIcons = () => {
            const playForwardIcon = playForwardBtn.querySelector('span');
            const playBackwardIcon = playBackwardBtn.querySelector('span');

            if (this.isPlaying && this.playDirection === 1) {
                playForwardIcon.className = 'icon-pause';
                playBackwardIcon.className = 'icon-rewind';
            } else if (this.isPlaying && this.playDirection === -1) {
                playForwardIcon.className = 'icon-play';
                playBackwardIcon.className = 'icon-pause';
            } else { // Paused
                playForwardIcon.className = 'icon-play';
                playBackwardIcon.className = 'icon-rewind';
            }
        };

        playForwardBtn.addEventListener('click', () => {
            if (this.isPlaying && this.playDirection === 1) {
                this.stopTimeline();
            } else {
                this.playDirection = 1;
                this.startTimeline();
            }
            updatePlayIcons();
        });

        playBackwardBtn.addEventListener('click', () => {
            if (this.isPlaying && this.playDirection === -1) {
                this.stopTimeline();
            } else {
                this.playDirection = -1;
                this.startTimeline();
            }
            updatePlayIcons();
        });
        
        skipToStartBtn.addEventListener('click', () => {
            this.currentTime = this.startTime;
            this.updatePlayheadPosition();
        });
        
        skipToEndBtn.addEventListener('click', () => {
            this.currentTime = this.endTime;
            this.updatePlayheadPosition();
        });

        // Listeners for start/end frame inputs
        const frameInputs = timelineContainer.querySelectorAll('.frame-input');
        frameInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                const rangeType = e.target.dataset.range;
                let value = parseInt(e.target.value, 10);

                if (rangeType === 'start') {
                    this.startTime = value;
                } else if (rangeType === 'end') {
                    this.endTime = value;
                }
                
                // Re-render ruler and update other parts of UI if necessary
                this.renderTimelineGrid();
                this.updateTimelineRangeOverlay();
                // We might need to update the playhead position if the range changes
                this.updatePlayheadPosition();
            });
        });

        const fpsSelect = timelineContainer.querySelector('.fps-select');
        fpsSelect.addEventListener('change', (e) => {
            this.fps = parseInt(e.target.value, 10);
            this.frameDuration = 1000 / this.fps;
        });

        // Listener for playhead dragging
        const playheadHead = timelineContainer.querySelector('.playhead-head');
        playheadHead.addEventListener('mousedown', (e) => {
            e.preventDefault();
            
            const timelineBody = timelineContainer.querySelector('.timeline-body');
            const timelineRect = timelineBody.getBoundingClientRect();

            const onMouseMove = (moveEvent) => {
                const newX = moveEvent.clientX - timelineRect.left;
                const percentage = Math.max(0, Math.min(1, newX / timelineRect.width));
                
                const displayStartTime = this.startTime - this.timelinePadding;
                const displayEndTime = this.endTime + this.timelinePadding;
                const displayRange = displayEndTime - displayStartTime;

                let newTime = Math.round(displayStartTime + (percentage * displayRange));
                
                // Clamp to the actual start/end time, not the padded range
                this.currentTime = Math.max(this.startTime, Math.min(this.endTime, newTime));
                
                this.updatePlayheadPosition();

                // If playing, we need to make sure the 3D view updates
                if (this.isPlaying) {
                    this.needsRender = true;
                }
            };

            const onMouseUp = () => {
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });
    }

    /**
     * Initializes listeners for resizing the timeline panels.
     * @param {HTMLElement} timelineEditor - The main timeline container.
     * @param {HTMLElement} layersPanel - The layers panel.
     * @param {HTMLElement} verticalHandle - The handle to resize the layers panel width.
     * @param {HTMLElement} horizontalHandle - The handle to resize the timeline editor height.
     */
    initResizeListeners(timelineEditor, layersPanel, verticalHandle, horizontalHandle) {
        const onMouseDown = (event, target) => {
            event.preventDefault();
            this.timelineResizingState.isResizing = true;
            this.timelineResizingState.target = target;
            this.timelineResizingState.startX = event.clientX;
            this.timelineResizingState.startY = event.clientY;

            if (target === 'layersPanel') {
                this.timelineResizingState.startWidth = layersPanel.offsetWidth;
            } else if (target === 'timelineEditor') {
                this.timelineResizingState.startHeight = timelineEditor.offsetHeight;
            }

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        };

        const onMouseMove = (event) => {
            if (!this.timelineResizingState.isResizing) return;

            const { target, startX, startY, startWidth, startHeight } = this.timelineResizingState;

            if (target === 'layersPanel') {
                const dx = event.clientX - startX;
                const newWidth = Math.max(150, startWidth + dx); // Min width 150px
                layersPanel.style.width = `${newWidth}px`;
            } else if (target === 'timelineEditor') {
                const dy = event.clientY - startY;
                // We are resizing from the top, so we subtract dy
                const newHeight = Math.max(this.timelineMinimizedHeight, startHeight - dy); // Min height
                timelineEditor.style.height = `${newHeight}px`;
                this.onResize(); // We need to trigger a resize for the 3D canvas
            }
        };

        const onMouseUp = () => {
            this.timelineResizingState.isResizing = false;
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        verticalHandle.addEventListener('mousedown', (e) => onMouseDown(e, 'layersPanel'));
        horizontalHandle.addEventListener('mousedown', (e) => onMouseDown(e, 'timelineEditor'));
    }

    /**
     * Starts the timeline playback loop.
     */
    startTimeline() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.timelineAnimationId = requestAnimationFrame((t) => this.timelineLoop(t));
    }

    /**
     * Stops the timeline playback loop.
     */
    stopTimeline() {
        this.isPlaying = false;
        if (this.timelineAnimationId) {
            cancelAnimationFrame(this.timelineAnimationId);
            this.timelineAnimationId = null;
        }
        this.lastFrameTime = 0; // Reset for next playback
    }

    /**
     * The main timeline animation loop, driven by requestAnimationFrame.
     * @param {DOMHighResTimeStamp} timestamp 
     */
    timelineLoop(timestamp) {
        if (!this.isPlaying) return;

        // Schedule the next frame
        this.timelineAnimationId = requestAnimationFrame((t) => this.timelineLoop(t));

        if (!this.lastFrameTime) {
            this.lastFrameTime = timestamp;
        }

        const elapsed = timestamp - this.lastFrameTime;

        if (elapsed >= this.frameDuration) {
            this.lastFrameTime = timestamp - (elapsed % this.frameDuration);
            this.advanceFrame();
        }
    }
    
    /**
     * Advances the timeline by one frame based on play direction.
     */
    advanceFrame() {
        this.currentTime += this.playDirection;

        if (this.playDirection === 1 && this.currentTime > this.endTime) {
            this.currentTime = this.startTime;
        } else if (this.playDirection === -1 && this.currentTime < this.startTime) {
            this.currentTime = this.endTime;
        }

        this.updatePlayheadPosition();
        this.needsRender = true; // Mark for 3D viewport update
    }

    /**
     * Updates the visual position and displayed frame number of the playhead.
     */
    updatePlayheadPosition() {
        const playhead = this.element.querySelector('.playhead');
        const playheadHead = this.element.querySelector('.playhead-head');
        if (!playhead || !playheadHead) return;

        const displayStartTime = this.startTime - this.timelinePadding;
        const displayEndTime = this.endTime + this.timelinePadding;
        const displayRange = displayEndTime - displayStartTime;
        
        const position = displayRange > 0 ? ((this.currentTime - displayStartTime) / displayRange) * 100 : 0;
        
        playhead.style.left = `${position}%`;
        playheadHead.textContent = this.currentTime;
    }

    /**
     * Initializes the Three.js scene, renderer, camera, and controls.
     * @param {HTMLElement} container - The container for the renderer's DOM element.
     */
    async initScene(container) {
        try {
            // Dynamically import three.js modules
            const THREE = await import('three');
            const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
            const { Line2 } = await import('three/addons/lines/Line2.js');
            const { LineGeometry } = await import('three/addons/lines/LineGeometry.js');
            const { LineMaterial } = await import('three/addons/lines/LineMaterial.js');

            const width = container.clientWidth;
            const height = container.clientHeight;

            // Scene
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x1a1a1a); // Dark background

            // Camera
            this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
            this.camera.setFocalLength(50); // Set to 50mm camera equivalent
            this.camera.position.set(20, 16, 20);
            this.camera.lookAt(0, 0, 0);

            // Renderer
            this.renderer = new THREE.WebGLRenderer({ 
                antialias: true,
                powerPreference: "high-performance",
                preserveDrawingBuffer: false,
                stencil: false,
                depth: true
            });
            this.renderer.setSize(width, height);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for performance
            this.renderer.shadowMap.enabled = false; // Disable shadows for better performance
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            container.appendChild(this.renderer.domElement);

            // Controls
            this.controls = new OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = false;
            this.controls.dampingFactor = 0.01;
            this.controls.screenSpacePanning = false;
            this.controls.minDistance = 1;
            this.controls.maxDistance = 500;
            this.controls.enabled = false; // Disabled by default
            this.controls.mouseButtons = {
                LEFT: THREE.MOUSE.ROTATE,
                MIDDLE: THREE.MOUSE.PAN,
                RIGHT: THREE.MOUSE.DOLLY
            };

            // Lighting
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
            this.scene.add(ambientLight);
            const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
            directionalLight.position.set(5, 10, 7.5);
            this.scene.add(directionalLight);

            // Helpers
            this.gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x888888);
            this.gridHelper.position.y = -0.01; // Offset to prevent z-fighting
            this.gridHelper.material.blending = THREE.AdditiveBlending;
            this.scene.add(this.gridHelper);

            // Add a larger, lower density grid
            this.largeGridHelper = new THREE.GridHelper(50, 10, 0x222222, 0x444444);
            this.largeGridHelper.position.y = -0.02; // Offset further to prevent z-fighting
            this.largeGridHelper.material.blending = THREE.AdditiveBlending;
            this.scene.add(this.largeGridHelper);

            this.createAxisHelpers(THREE);

            // Add infinite lines along Z and X axes
            this.createInfiniteLines(THREE, { Line2, LineGeometry, LineMaterial });

            // Start animation loop
            this.animate();

            // Add interaction listeners
            this.addInteractionListeners(container);

            // Add resize observer
            this.resizeObserver = new ResizeObserver(() => this.onResize());
            this.resizeObserver.observe(container);

        } catch (error) {
            console.error("Failed to load Three.js modules:", error);
            container.innerText = "Error initializing 3D view. See console for details.";
        }
    }

    /**
     * Creates and adds axis helpers with arrows and labels to the scene.
     * @param {object} THREE - The THREE.js library instance.
     */
    createAxisHelpers(THREE) {
        const axisLength = 2.5;

        const axes = [
            { dir: new THREE.Vector3(1, 0, 0), color: 0xff0000, label: 'X' },
            { dir: new THREE.Vector3(0, 1, 0), color: 0x00ff00, label: 'Y' },
            { dir: new THREE.Vector3(0, 0, 1), color: 0x0000ff, label: 'Z' }
        ];

        axes.forEach(({ dir, color, label }) => {
            const headLength = axisLength * 0.1;
            const headWidth = headLength * 0.5;
            
            const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(0,0,0), axisLength, color, headLength, headWidth);
            arrow.line.material.linewidth = 4;
            this.scene.add(arrow);

            const textSprite = this.makeTextSprite(THREE, label, { color });
            textSprite.position.copy(dir).multiplyScalar(axisLength + 0.3);
            this.scene.add(textSprite);
        });
    }

    /**
     * Creates a text sprite.
     * @param {object} THREE - The THREE.js library instance.
     * @param {string} message - The text message.
     * @param {object} parameters - The styling parameters.
     * @returns {THREE.Sprite} The created sprite.
     */
    makeTextSprite(THREE, message, parameters = {}) {
        const fontface = parameters.fontface || 'Arial';
        const fontsize = parameters.fontsize || 32;
        const color = new THREE.Color(parameters.color !== undefined ? parameters.color : 0xffffff);

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        const font = `Bold ${fontsize}px ${fontface}`;
        context.font = font;
        const metrics = context.measureText(message);
        const textWidth = Math.ceil(metrics.width);
        canvas.width = textWidth;
        canvas.height = fontsize;
        
        context.font = font;
        context.fillStyle = color.getStyle();
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(message, textWidth / 2, fontsize / 2);

        const texture = new THREE.CanvasTexture(canvas);

        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true 
        });
        const sprite = new THREE.Sprite(spriteMaterial);

        const spriteWidth = textWidth * 0.01;
        const spriteHeight = fontsize * 0.01;
        sprite.scale.set(spriteWidth, spriteHeight, 1);

        return sprite;
    }

    /**
     * Creates infinite lines along the Z and X axes.
     * @param {object} THREE - The THREE.js library instance.
     * @param {object} lineModules - The line modules for creating thick lines.
     */
    createInfiniteLines(THREE, { Line2, LineGeometry, LineMaterial }) {
        const lineLength = 1000; // Very long lines to appear infinite
        
        const lineMaterial = new LineMaterial({
            color: 0x888888,
            linewidth: 2, // in pixels
            transparent: true,
            opacity: 0.3,
            dashed: false,
            blending: THREE.AdditiveBlending,
            // resolution must be set for the line to render correctly
            resolution: new THREE.Vector2(this.renderer.domElement.width, this.renderer.domElement.height) 
        });

        // Z-axis line
        const zGeometry = new LineGeometry();
        zGeometry.setPositions([-lineLength, 0, 0, lineLength, 0, 0]);
        const zLine = new Line2(zGeometry, lineMaterial);
        zLine.rotation.y = Math.PI / 2; // Rotate to align with Z-axis
        zLine.computeLineDistances();
        zLine.scale.set(1, 1, 1);
        this.scene.add(zLine);

        // X-axis line
        const xGeometry = new LineGeometry();
        xGeometry.setPositions([-lineLength, 0, 0, lineLength, 0, 0]);
        const xLine = new Line2(xGeometry, lineMaterial);
        xLine.computeLineDistances();
        xLine.scale.set(1, 1, 1);
        this.scene.add(xLine);
    }

    /**
     * Adds listeners to handle interaction with the 3D canvas.
     * @param {HTMLElement} container The canvas container.
     */
    addInteractionListeners(container) {
        // Toggle tumbling controls on double-click
        container.addEventListener('dblclick', () => {
            this.tumblingEnabled = !this.tumblingEnabled;
            
            const statusIndicator = this.element.querySelector('.threejs-status-indicator');
            if (statusIndicator) {
                statusIndicator.innerHTML = this.tumblingEnabled ? 'ACTIVE<br><span class="status-subtitle">(double click to deactivate)</span>' : 'NOT ACTIVE<br><span class="status-subtitle">(double click to activate)</span>';
                statusIndicator.classList.toggle('active', this.tumblingEnabled);
            }

            if (this.controls) {
                this.controls.enabled = this.tumblingEnabled;
            }

            if (this.tumblingEnabled) {
                this.startAnimation();
            } else {
                // Stop animation only if timeline is not playing
                if (!this.isPlaying) {
                    this.stopAnimation();
                }
            }
        });

        // Stop wheel events from propagating, and manage animation loop for smooth zooming.
        container.addEventListener('wheel', (e) => {
            e.stopPropagation();
            this.startAnimation(); // Ensure the animation loop is running for zoom changes.

            // Clear the previous timeout to reset the timer.
            clearTimeout(this.wheelTimeout);

            // Set a new timeout to stop the animation after scrolling has paused.
            this.wheelTimeout = setTimeout(() => {
                // Only stop if no other interaction (dragging, tumbling, playing) is active.
                if (!this.isInteracting && !this.tumblingEnabled && !this.isPlaying) {
                    this.stopAnimation();
                }
            }, 150); // A 150ms delay is a good balance.
        });

        // The original listeners are kept for timeline interaction state
        container.addEventListener('mousedown', (e) => {
            if (this.tumblingEnabled) {
                e.stopPropagation();
            }
            this.isInteracting = true;
            this.startAnimation();
        });

        container.addEventListener('mouseleave', () => {
            this.isInteracting = false;
            if (!this.tumblingEnabled && !this.isPlaying) {
                this.stopAnimation();
            }
        });

         window.addEventListener('mouseup', () => {
            this.isInteracting = false;
            if (!this.tumblingEnabled && !this.isPlaying) {
                this.stopAnimation();
            }
        }, true);
    }

    /**
     * Starts the animation loop if not already running.
     */
    startAnimation() {
        if (!this.isAnimating) {
            this.isAnimating = true;
            this.animate();
        }
    }

    /**
     * Stops the animation loop.
     */
    stopAnimation() {
        this.isAnimating = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * The main animation loop.
     */
    animate() {
        if (!this.isAnimating) return;
        
        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
        
        let needsUpdate = false;
        
        // Update controls and check if they transformed the camera
        if (this.controls && this.controls.enabled) {
            if (this.controls.enableDamping) {
                if (this.controls.update()) {
                    needsUpdate = true;
                }
            } else {
                // When damping is disabled, we need to render on every frame during interaction
            needsUpdate = true;
            }
        }

        // Only render if something changed or we need an initial render
        if (this.renderer && this.scene && this.camera && (needsUpdate || this.needsRender)) {
            this.renderer.render(this.scene, this.camera);
            this.needsRender = false;
        }
    }

    /**
     * Handles resizing of the node.
     */
    onResize() {
        if (!this.renderer || !this.camera) return;

        const contentArea = this.element.querySelector('.node-content');
        const canvasContainer = contentArea.querySelector('.threejs-canvas-container');
        const width = canvasContainer.clientWidth;
        const height = canvasContainer.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        
        // Mark that we need to render after resize
        this.needsRender = true;
        
        // Start animation briefly to render the resize
        if (!this.isAnimating) {
            this.startAnimation();
            // Stop after one frame
            setTimeout(() => this.stopAnimation(), 16);
        }
    }
    
    /**
     * Overrides the update method to handle resizing.
     */
    update(data) {
        super.update(data);
        // The ResizeObserver now handles this automatically.
        // No need to call onResize from here.
    }

    /**
     * Cleans up resources when the node is destroyed.
     */
    destroy() {
        this.stopAnimation();
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        if (this.renderer) {
            this.renderer.dispose();
        }
        if (this.scene) {
            // Dispose geometries, materials, textures
        }
    }
} 