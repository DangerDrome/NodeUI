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
            width: 500,
            height: 400,
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
        this.startTime = 1000;
        this.endTime = 1100; // Default to a 100-frame range
        this.currentTime = this.startTime;
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
        contentArea.innerHTML = ''; // Clear base content
        contentArea.style.padding = '0';
        contentArea.style.overflow = 'hidden';

        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'threejs-canvas-container';
        
        const timelineContainer = document.createElement('div');
        timelineContainer.className = 'threejs-timeline-container';
        timelineContainer.innerHTML = `
            <div class="timeline-controls">
                <button class="timeline-btn" data-action="play"><span class="icon-play"></span></button>
            </div>
            <div class="timeline-slider">
                <div class="time-marker start">${this.startTime}</div>
                <input type="range" min="${this.startTime}" max="${this.endTime}" value="${this.currentTime}" class="slider">
                <div class="time-marker end">${this.endTime}</div>
            </div>
            <div class="timeline-current-frame">
                <input type="number" value="${this.currentTime}">
            </div>
        `;

        contentArea.appendChild(canvasContainer);
        contentArea.appendChild(timelineContainer);

        // Add timeline event listeners
        this.addTimelineListeners(timelineContainer);

        // Initialize the three.js scene
        this.initScene(canvasContainer);
    }

    /**
     * Adds event listeners to the timeline controls.
     * @param {HTMLElement} timelineContainer 
     */
    addTimelineListeners(timelineContainer) {
        const playBtn = timelineContainer.querySelector('[data-action="play"]');
        const slider = timelineContainer.querySelector('.slider');
        const frameInput = timelineContainer.querySelector('.timeline-current-frame input');

        playBtn.addEventListener('click', () => {
            this.isPlaying = !this.isPlaying;
            playBtn.innerHTML = this.isPlaying ? '<span class="icon-pause"></span>' : '<span class="icon-play"></span>';
            if (this.isPlaying) {
                this.startAnimation();
                this.runTimeline();
            } else {
                // Keep animation running for smooth interaction
                if (!this.isInteracting) {
                    this.stopAnimation();
                }
            }
        });

        slider.addEventListener('input', (e) => {
            this.currentTime = parseInt(e.target.value, 10);
            frameInput.value = this.currentTime;
            this.needsRender = true;
            
            // Ensure animation is running to render the change
            if (!this.isAnimating) {
                this.startAnimation();
                // Stop after one frame if not playing or interacting
                if (!this.isPlaying && !this.isInteracting) {
                    setTimeout(() => this.stopAnimation(), 16);
                }
            }
        });

        frameInput.addEventListener('change', (e) => {
            let value = parseInt(e.target.value, 10);
            if (isNaN(value)) value = this.startTime;
            this.currentTime = Math.max(this.startTime, Math.min(this.endTime, value));
            e.target.value = this.currentTime;
            slider.value = this.currentTime;
            this.needsRender = true;
            
            // Ensure animation is running to render the change
            if (!this.isAnimating) {
                this.startAnimation();
                // Stop after one frame if not playing or interacting
                if (!this.isPlaying && !this.isInteracting) {
                    setTimeout(() => this.stopAnimation(), 16);
                }
            }
        });
    }

    /**
     * Runs the timeline animation.
     */
    runTimeline() {
        if (!this.isPlaying) return;

        this.currentTime++;
        if (this.currentTime > this.endTime) {
            this.currentTime = this.startTime;
        }

        const slider = this.element.querySelector('.slider');
        const frameInput = this.element.querySelector('.timeline-current-frame input');
        slider.value = this.currentTime;
        frameInput.value = this.currentTime;
        
        // Mark that we need to render
        this.needsRender = true;
        
        // Loop using requestAnimationFrame for better performance
        if (this.isPlaying) {
            requestAnimationFrame(() => this.runTimeline());
        }
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