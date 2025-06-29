/**
 * @fileoverview ImageSequenceNode for displaying and scrubbing through image sequences.
 * This node displays a thumbnail from an image sequence and allows scrubbing through frames.
 */

class ImageSequenceNode extends BaseNode {
    /**
     * @param {object} [options={}] - The options for the node.
     * @param {string[]} [options.imageSequence=[]] - Array of image file paths.
     * @param {number} [options.currentFrame=0] - Current frame index.
     * @param {number} [options.width=300] - The width of the node.
     * @param {number} [options.height=200] - The height of the node.
     */
    constructor({
        imageSequence = [],
        currentFrame = 0,
        width = 300,
        height = 200,
        ...baseOptions
    } = {}) {
        super({
            type: 'ImageSequenceNode',
            title: 'Image Sequence',
            width,
            height,
            ...baseOptions
        });

        this.imageSequence = imageSequence;
        this.currentFrame = Math.max(0, Math.min(currentFrame, imageSequence.length - 1));
        this.isScrubbing = false;
        this.thumbnailElement = null;
        
        // Animation state
        this.isPlaying = false;
        this.animationInterval = null;
        this.fps = 24; // Default 24 FPS
        this.frameDuration = 1000 / this.fps; // Duration in milliseconds
    }

    /**
     * Creates the title bar for the node.
     * @returns {HTMLElement} The title bar element.
     */
    createTitleBar() {
        const titleBar = document.createElement('div');
        titleBar.className = 'node-title-bar';

        // Create icon (only change: use icon-image-play instead of icon-file-text)
        const icon = document.createElement('div');
        icon.className = 'node-icon icon-image-play';
        titleBar.appendChild(icon);

        // Create pin icon (same as BaseNode)
        const pinIcon = document.createElement('div');
        pinIcon.className = 'node-pin-icon icon-pin';
        pinIcon.addEventListener('click', (event) => {
            event.stopPropagation();
            events.publish('node:update', { nodeId: this.id, isPinned: !this.isPinned });
        });
        titleBar.appendChild(pinIcon);

        // Create title text (same as BaseNode)
        const titleText = document.createElement('span');
        titleText.className = 'node-title-text';
        titleText.textContent = this.title;
        titleBar.appendChild(titleText);

        // Create cycle color icon (same as BaseNode)
        const cycleColorIcon = document.createElement('div');
        cycleColorIcon.className = 'node-cycle-color-icon icon-sun-medium';
        cycleColorIcon.addEventListener('click', (event) => {
            event.stopPropagation();
            events.publish('node:cycle-color', { nodeId: this.id });
        });
        titleBar.appendChild(cycleColorIcon);

        // Create settings icon (same as BaseNode)
        const settingsIcon = document.createElement('div');
        settingsIcon.className = 'node-settings-icon icon-more-horizontal';
        settingsIcon.addEventListener('click', (event) => {
            event.stopPropagation();
            events.publish('node:toggle-popover', { nodeId: this.id });
        });
        titleBar.appendChild(settingsIcon);

        return titleBar;
    }

    /**
     * Renders the specific content of the node.
     * @param {HTMLElement} contentArea - The element to render content into.
     */
    renderContent(contentArea) {
        // Clear existing content
        contentArea.innerHTML = '';

        // Create thumbnail container
        const thumbnailContainer = document.createElement('div');
        thumbnailContainer.className = 'image-sequence-thumbnail-container';

        // Create thumbnail image
        this.thumbnailElement = document.createElement('img');
        this.thumbnailElement.className = 'image-sequence-thumbnail';

        // Create frame indicator
        const frameIndicator = document.createElement('div');
        frameIndicator.className = 'image-sequence-frame-indicator';
        this.frameIndicatorElement = frameIndicator;

        // Create placeholder for empty sequences
        const placeholder = document.createElement('div');
        placeholder.className = 'image-sequence-placeholder';
        placeholder.innerHTML = `
            <div class="icon">📷</div>
            <div>No images in sequence</div>
            <div style="font-size: 10px; margin-top: 4px;">Drop multiple images to create a sequence</div>
        `;

        // Assemble the content
        thumbnailContainer.appendChild(this.thumbnailElement);
        thumbnailContainer.appendChild(frameIndicator);
        thumbnailContainer.appendChild(placeholder);
        contentArea.appendChild(thumbnailContainer);

        // Add scrubbing functionality
        this.addScrubbingListeners(thumbnailContainer);
        
        // Make the node focusable for keyboard navigation
        this.element.setAttribute('tabindex', '0');

        // Update the display
        this.updateThumbnailDisplay();
        
        // Add keyboard navigation after a short delay to ensure the element is fully rendered
        setTimeout(() => {
            this.addKeyboardListeners();
        }, 0);
    }

    /**
     * Updates the thumbnail display based on current frame.
     */
    updateThumbnailDisplay() {
        const thumbnail = this.thumbnailElement;
        const frameIndicator = this.element?.querySelector('.image-sequence-frame-indicator');
        const placeholder = this.element?.querySelector('.image-sequence-placeholder');

        if (!this.imageSequence.length) {
            if (thumbnail) thumbnail.style.display = 'none';
            if (frameIndicator) frameIndicator.style.display = 'none';
            if (placeholder) placeholder.style.display = 'flex';
            return;
        }

        if (placeholder) placeholder.style.display = 'none';
        if (frameIndicator) frameIndicator.style.display = 'block';

        const currentImagePath = this.imageSequence[this.currentFrame];
        if (currentImagePath && thumbnail) {
            thumbnail.style.display = 'block';
            thumbnail.src = currentImagePath;
            thumbnail.alt = `Frame ${this.currentFrame + 1}`;
        }

        if (frameIndicator) {
            const playStatus = this.isPlaying ? ' ▶' : '';
            frameIndicator.textContent = `${this.currentFrame + 1} / ${this.imageSequence.length}${playStatus}`;
        }
    }

    /**
     * Adds scrubbing event listeners to the thumbnail container.
     * @param {HTMLElement} container - The thumbnail container element.
     */
    addScrubbingListeners(container) {
        let startX = 0;
        let startFrame = 0;

        const handleMouseDown = (event) => {
            if (!this.imageSequence.length) return;
            
            // Pause playback when scrubbing starts
            if (this.isPlaying) {
                this.pause();
            }
            
            this.isScrubbing = true;
            startX = event.clientX;
            startFrame = this.currentFrame;
            
            container.classList.add('is-scrubbing');
            event.preventDefault();
            event.stopPropagation(); // Prevent event from bubbling to node drag handlers
        };

        const handleMouseMove = (event) => {
            if (!this.isScrubbing || !this.imageSequence.length) return;

            const deltaX = event.clientX - startX;
            const containerWidth = container.offsetWidth;
            const frameDelta = Math.round((deltaX / containerWidth) * this.imageSequence.length);
            
            const newFrame = Math.max(0, Math.min(this.imageSequence.length - 1, startFrame + frameDelta));
            this.setFrame(newFrame);
            
            event.preventDefault();
            event.stopPropagation();
        };

        const handleMouseUp = (event) => {
            if (this.isScrubbing) {
                this.isScrubbing = false;
                container.classList.remove('is-scrubbing');
            }
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
        };

        const handleMouseLeave = (event) => {
            if (this.isScrubbing) {
                this.isScrubbing = false;
                container.classList.remove('is-scrubbing');
            }
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
        };

        container.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        container.addEventListener('mouseleave', handleMouseLeave);

        // Store listeners for cleanup
        this.scrubbingListeners = {
            container,
            handleMouseDown,
            handleMouseMove,
            handleMouseUp,
            handleMouseLeave
        };
    }

    /**
     * Adds keyboard event listeners for arrow key navigation and space bar play/pause.
     */
    addKeyboardListeners() {
        const handleKeyDown = (event) => {
            if (!this.imageSequence.length) return;
            
            switch (event.key) {
                case 'ArrowLeft':
                    event.preventDefault();
                    event.stopPropagation();
                    this.previousFrame();
                    break;
                case 'ArrowRight':
                    event.preventDefault();
                    event.stopPropagation();
                    this.nextFrame();
                    break;
                case ' ':
                    event.preventDefault();
                    event.stopPropagation();
                    this.togglePlayPause();
                    break;
            }
        };

        // Add keyboard listener to the node element
        this.element.addEventListener('keydown', handleKeyDown);
        
        // Store listener for cleanup
        this.keyboardListener = handleKeyDown;
    }

    /**
     * Toggles play/pause state of the image sequence.
     */
    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    /**
     * Starts playing the image sequence.
     */
    play() {
        if (this.isPlaying || this.imageSequence.length <= 1) return;
        
        this.isPlaying = true;
        this.animationInterval = setInterval(() => {
            this.nextFrame();
        }, this.frameDuration);
        
        this.updateThumbnailDisplay();
        events.publish('imagesequence:play', { nodeId: this.id });
    }

    /**
     * Pauses the image sequence playback.
     */
    pause() {
        if (!this.isPlaying) return;
        
        this.isPlaying = false;
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }
        
        this.updateThumbnailDisplay();
        events.publish('imagesequence:pause', { nodeId: this.id });
    }

    /**
     * Sets the playback speed (FPS).
     * @param {number} fps - Frames per second.
     */
    setFPS(fps) {
        this.fps = Math.max(1, Math.min(60, fps)); // Clamp between 1 and 60 FPS
        this.frameDuration = 1000 / this.fps;
        
        // Restart animation if currently playing
        if (this.isPlaying) {
            this.pause();
            this.play();
        }
    }

    /**
     * Steps to the next frame in the sequence.
     */
    nextFrame() {
        if (this.imageSequence.length > 0) {
            const nextFrame = (this.currentFrame + 1) % this.imageSequence.length;
            this.setFrame(nextFrame);
        }
    }

    /**
     * Steps to the previous frame in the sequence.
     */
    previousFrame() {
        if (this.imageSequence.length > 0) {
            const prevFrame = this.currentFrame === 0 ? this.imageSequence.length - 1 : this.currentFrame - 1;
            this.setFrame(prevFrame);
        }
    }

    /**
     * Sets the current frame and updates the display.
     * @param {number} frame - The frame index to set.
     */
    setFrame(frame) {
        if (this.imageSequence.length === 0) return;
        
        this.currentFrame = Math.max(0, Math.min(this.imageSequence.length - 1, frame));
        this.updateThumbnailDisplay();
        
        // Publish frame change event
        events.publish('imagesequence:frame-changed', {
            nodeId: this.id,
            frame: this.currentFrame,
            totalFrames: this.imageSequence.length
        });
    }

    /**
     * Sets the image sequence and resets to frame 0.
     * @param {string[]} imageSequence - Array of image file paths.
     */
    setImageSequence(imageSequence) {
        // Stop any current playback
        this.pause();
        
        this.imageSequence = imageSequence || [];
        this.currentFrame = 0;
        this.updateThumbnailDisplay();
    }

    /**
     * Ensures keyboard listeners are properly attached.
     * This is useful for nodes that might have lost their listeners during updates.
     */
    ensureKeyboardListeners() {
        // Remove existing listeners first to prevent duplicates
        if (this.keyboardListener) {
            this.element.removeEventListener('keydown', this.keyboardListener);
            this.keyboardListener = null;
        }
        
        // Re-attach keyboard listeners
        this.addKeyboardListeners();
    }

    /**
     * Updates the node with new data.
     * @param {object} data - The update data.
     */
    update(data) {
        super.update(data);

        if (data.imageSequence !== undefined) {
            this.setImageSequence(data.imageSequence);
        }

        if (data.currentFrame !== undefined) {
            this.setFrame(data.currentFrame);
        }

        if (data.fps !== undefined) {
            this.setFPS(data.fps);
        }
        
        // Ensure keyboard listeners are still attached after updates
        if (this.element) {
            this.ensureKeyboardListeners();
        }
    }

    /**
     * Gets the node data for serialization.
     * @returns {object} The node data.
     */
    serialize() {
        const baseData = {
            id: this.id,
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            title: this.title,
            content: this.content,
            type: this.type,
            color: this.color,
            isPinned: this.isPinned
        };
        
        // Add ImageSequenceNode specific properties
        const imageSequenceData = {
            imageSequence: this.imageSequence || [],
            currentFrame: this.currentFrame || 0,
            fps: this.fps || 24
        };
        
        return { ...baseData, ...imageSequenceData };
    }

    /**
     * Cleanup method for the ImageSequenceNode.
     */
    destroy() {
        // Clear animation interval if playing
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }

        // Remove keyboard listeners
        if (this.keyboardListener) {
            this.element.removeEventListener('keydown', this.keyboardListener);
            this.keyboardListener = null;
        }

        // Remove scrubbing listeners
        if (this.scrubbingListeners) {
            const { container, handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave } = this.scrubbingListeners;
            container.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            container.removeEventListener('mouseleave', handleMouseLeave);
            this.scrubbingListeners = null;
        }

        // Remove focus
        this.element.removeAttribute('tabindex');
    }
} 