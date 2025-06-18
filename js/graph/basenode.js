/**
 * @fileoverview Base class for all nodes on the canvas.
 * This class handles common properties and functionalities like
 * ID, position, size, and basic rendering of the node's container.
 * It is intended to be extended by specialized node types.
 */

class BaseNode {
    /**
     * @param {object} [options={}] - The options for the node.
     * @param {string} [options.id] - A unique identifier. Defaults to a generated UUID.
     * @param {number} [options.x=0] - The x-coordinate of the node.
     * @param {number} [options.y=0] - The y-coordinate of the node.
     * @param {number} [options.width=200] - The width of the node.
     * @param {number} [options.height=120] - The height of the node.
     * @param {string} [options.title='New Node'] - The title of the node.
     * @param {string} [options.content=''] - The markdown content of the node.
     * @param {string} [options.type='BaseNode'] - The type of the node.
     * @param {string} [options.color='default'] - The color of the node.
     */
    constructor({
        id = crypto.randomUUID(),
        x = 0,
        y = 0,
        width = 200,
        height = 120,
        title = 'New Node',
        content = '',
        type = 'BaseNode',
        color = 'default'
    } = {}) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.title = title;
        this.content = content;
        this.type = type;
        this.color = color || 'default';

        this.element = null; // To hold the DOM element
        this.popoverElement = null; // Container for the popover
        this.handles = {}; // To hold handle elements
        this.connections = new Map(); // Maps handlePosition to a Set of edgeIds
    }

    /**
     * Renders the node's main container and appends it to a parent element.
     * This method should be called by the main canvas renderer.
     * @param {HTMLElement} parentElement - The parent element to append the node to.
     * @returns {HTMLElement} The created DOM element for the node.
     */
    render(parentElement) {
        this.element = document.createElement('div');
        this.element.id = this.id;
        this.element.className = 'node';
        this.element.dataset.color = this.color;
        this.element.style.setProperty('--icon-color', `var(--color-node-${this.color}-border)`);
        this.element.style.setProperty('--icon-color-bg', `var(--color-node-${this.color}-bg)`);
        this.element.style.left = `${this.x}px`;
        this.element.style.top = `${this.y}px`;
        this.element.style.width = `${this.width}px`;
        this.element.style.height = `${this.height}px`;

        const titleBar = this.createTitleBar();
        const contentArea = this.createContentArea();
        
        this.element.appendChild(titleBar);
        this.element.appendChild(contentArea);

        parentElement.appendChild(this.element);
        
        this.renderContent(contentArea);
        this.createHandles();
        this.createResizeHandle();
        this.createPopoverContainer();

        return this.element;
    }

    /**
     * Creates the title bar element for the node.
     * @returns {HTMLElement} The title bar element.
     */
    createTitleBar() {
        const titleBar = document.createElement('div');
        titleBar.className = 'node-title-bar';

        const icon = document.createElement('div');
        icon.className = 'node-icon icon-box';

        const titleText = document.createElement('span');
        titleText.className = 'node-title-text';
        titleText.textContent = this.title;

        const cycleColorIcon = document.createElement('div');
        cycleColorIcon.className = 'node-cycle-color-icon icon-sun-medium';

        const settingsIcon = document.createElement('div');
        settingsIcon.className = 'node-settings-icon icon-more-horizontal';

        titleBar.appendChild(icon);
        titleBar.appendChild(titleText);
        titleBar.appendChild(cycleColorIcon);
        titleBar.appendChild(settingsIcon);

        return titleBar;
    }

    /**
     * Creates the content area for the node.
     * @returns {HTMLElement} The content area element.
     */
    createContentArea() {
        const contentArea = document.createElement('div');
        contentArea.className = 'node-content';
        return contentArea;
    }

    /**
     * Renders the specific content of the node.
     * This method is intended to be overridden by subclasses.
     * @param {HTMLElement} contentArea - The element to render content into.
     */
    renderContent(contentArea) {
        // Base implementation does nothing.
        // Subclasses like MarkdownNode or ImageNode will override this.
        contentArea.textContent = 'This is a base node.';
    }

    /**
     * Creates the container for the slide-out popover.
     */
    createPopoverContainer() {
        this.popoverElement = document.createElement('div');
        this.popoverElement.className = 'node-popover';
        this.element.appendChild(this.popoverElement);
    }

    /**
     * Populates the popover with content and returns it.
     */
    getPopoverContent() {
        let content = `
            <div class="popover-section">
                <input type="text" class="popover-input" value="${this.title}">
            </div>
            <div class="popover-section">
                <div class="popover-color-palette">
        `;
        const colors = ['default', 'red', 'green', 'blue', 'yellow', 'purple'];
        colors.forEach(color => {
            content += `<div class="popover-color-swatch" data-color="${color}" style="background-color: var(--color-node-${color}-bg);"></div>`;
        });
        content += `
                </div>
            </div>
            <div class="popover-section popover-section-divider"></div>
            <div class="popover-section">
                <button class="popover-delete-button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                    Delete Node
                </button>
            </div>
        `;
        return content;
    }

    /**
     * Creates the resize handle for the node.
     */
    createResizeHandle() {
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'node-resize-handle';
        this.element.appendChild(resizeHandle);
    }

    /**
     * Creates connection handles on the node.
     */
    createHandles() {
        const handlePositions = ['top', 'right', 'bottom', 'left'];
        handlePositions.forEach(position => {
            const handleZone = document.createElement('div');
            handleZone.className = `node-handle-zone ${position}`;
            handleZone.dataset.nodeId = this.id;
            handleZone.dataset.handlePosition = position;
            
            // Create the visible handle and append it inside the zone
            const handle = document.createElement('div');
            handle.className = 'node-handle';
            handleZone.appendChild(handle);
            
            this.handles[position] = handleZone;
            this.element.appendChild(handleZone);
        });
        this.updateHandleColors(); // Set initial colors
    }

    /**
     * Updates the custom color property on the handles.
     */
    updateHandleColors() {
        for (const position in this.handles) {
            const handleZone = this.handles[position];
            handleZone.style.setProperty('--handle-color', `var(--color-node-${this.color}-border)`);
        }
    }

    /**
     * Registers a new connection to a specific handle.
     * @param {string} handlePosition - The position of the handle ('top', 'right', 'bottom', 'left').
     * @param {string} edgeId - The ID of the edge being connected.
     */
    addConnection(handlePosition, edgeId) {
        if (!this.connections.has(handlePosition)) {
            this.connections.set(handlePosition, new Set());
        }
        this.connections.get(handlePosition).add(edgeId);

        const handleZone = this.handles[handlePosition];
        if (handleZone) {
            const handle = handleZone.querySelector('.node-handle');
            if (handle) {
                handle.classList.add('is-connected');
            }
        }
    }

    /**
     * Removes a connection from a specific handle.
     * @param {string} handlePosition - The position of the handle to disconnect.
     * @param {string} edgeId - The ID of the edge to disconnect.
     */
    removeConnection(handlePosition, edgeId) {
        const edgeSet = this.connections.get(handlePosition);
        if (edgeSet) {
            edgeSet.delete(edgeId);
            if (edgeSet.size === 0) {
                this.connections.delete(handlePosition);
                const handleZone = this.handles[handlePosition];
                if (handleZone) {
                    const handle = handleZone.querySelector('.node-handle');
                    if (handle) {
                        handle.classList.remove('is-connected');
                    }
                }
            }
        }
    }

    /**
     * Updates the node's properties and re-renders its view.
     * @param {{[key: string]: any}} data The data to update.
     */
    update(data) {
        let needsRedraw = false;
        if (data.title !== undefined) {
            this.title = data.title;
            const titleElement = this.element.querySelector('.node-title-text');
            if (titleElement) {
                titleElement.textContent = this.title;
            }
        }
        if (data.color) {
            this.color = data.color;
            this.element.dataset.color = this.color;
            this.element.style.setProperty('--icon-color', `var(--color-node-${this.color}-border)`);
            this.element.style.setProperty('--icon-color-bg', `var(--color-node-${this.color}-bg)`);
            this.updateHandleColors();
            needsRedraw = true;
        }
        if (data.width) {
            this.width = data.width;
            this.element.style.width = `${this.width}px`;
            needsRedraw = true;
        }
        if (data.height) {
            this.height = data.height;
            this.element.style.height = `${this.height}px`;
            needsRedraw = true;
        }
        if (needsRedraw) {
            // Use a generic event for any visual update
            events.publish('node:visual-update', { nodeId: this.id });
        }
    }

    /**
     * Checks all handles and updates their visibility based on connections.
     */
    checkConnections() {
        for (const position in this.handles) {
            const handleZone = this.handles[position];
            const handle = handleZone.querySelector('.node-handle');
            if (handle) {
                const connectionSet = this.connections.get(position);
                if (connectionSet && connectionSet.size > 0) {
                    handle.classList.add('is-connected');
                } else {
                    handle.classList.remove('is-connected');
                }
            }
        }
    }
} 