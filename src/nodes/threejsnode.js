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
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.screenSpacePanning = false;
            this.controls.minDistance = 1;
            this.controls.maxDistance = 500;
            this.controls.enabled = false; // Disabled by default

            // Lighting
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
            this.scene.add(ambientLight);
            const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
            directionalLight.position.set(5, 10, 7.5);
            this.scene.add(directionalLight);

            // Helpers
            this.gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x888888);
            this.scene.add(this.gridHelper);

            this.axesHelper = new THREE.AxesHelper(5);
            this.scene.add(this.axesHelper);

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
     * Adds listeners to handle interaction with the 3D canvas.
     * @param {HTMLElement} container The canvas container.
     */
    addInteractionListeners(container) {
        // Enable controls on click
        container.addEventListener('mousedown', () => {
            this.isInteracting = true;
            if (this.controls) {
                this.controls.enabled = true;
            }
            this.startAnimation();
        });

        // Disable controls when the mouse leaves the canvas area
        container.addEventListener('mouseleave', () => {
            this.isInteracting = false;
            if (this.controls) {
                this.controls.enabled = false;
            }
            this.stopAnimation();
        });

         // Also disable on global mouse up if not over the canvas
         window.addEventListener('mouseup', () => {
            this.isInteracting = false;
            if (this.controls) {
                this.controls.enabled = false;
            }
            this.stopAnimation();
        }, true); // Use capture to get event first
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
        
        // Only update controls if they're enabled and we're interacting
        if (this.controls && this.controls.enabled && this.isInteracting) {
            this.controls.update();
            needsUpdate = true;
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