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
     * @param {string} [options.color='yellow'] - The color of the node.
     * @param {boolean} [options.isPinned=false] - Whether the node is pinned.
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
        color = 'yellow',
        isPinned = false
    } = {}) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.title = title;
        this.content = content;
        this.type = type;
        this.color = color || 'yellow';
        this.isPinned = isPinned;

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
        this.element.style.setProperty('--node-accent-color', `var(--color-node-${this.color}-border)`);
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
        this.createResizeHandles();
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
        icon.className = 'node-icon icon-file-text';

        const titleText = document.createElement('span');
        titleText.className = 'node-title-text';
        titleText.textContent = this.title;

        const pinIcon = document.createElement('div');
        pinIcon.className = 'node-pin-icon icon-pin';
        pinIcon.addEventListener('click', (event) => {
            event.stopPropagation();
            events.publish('node:update', { nodeId: this.id, isPinned: !this.isPinned });
        });

        const cycleColorIcon = document.createElement('div');
        cycleColorIcon.className = 'node-cycle-color-icon icon-sun-medium';

        const settingsIcon = document.createElement('div');
        settingsIcon.className = 'node-settings-icon icon-more-horizontal';

        titleBar.appendChild(icon);
        titleBar.appendChild(pinIcon);
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
        // Initial render
        this.renderMarkdown(contentArea);

        const saveContent = () => {
            if (!contentArea.isEditing) return;

            contentArea.isEditing = false;
            contentArea.contentEditable = 'false';
            const newContent = contentArea.innerText;

            if (this.content !== newContent) {
                // The update cycle will trigger the re-render.
                events.publish('node:update', { nodeId: this.id, content: newContent });
            } else {
                // If no changes were made, just revert the view back to rendered markdown.
                this.renderMarkdown(contentArea);
            }
        };

        contentArea.addEventListener('dblclick', () => {
            // Don't allow editing on specialized nodes that override this behavior
            if (this.constructor.name === 'BaseNode') {
                contentArea.isEditing = true;
                contentArea.contentEditable = 'true';
                contentArea.innerText = this.content || '';
                contentArea.focus();
                // Place cursor at the end
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(contentArea);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        });

        // Add blur listener to disable editing and save
        contentArea.addEventListener('blur', saveContent);
    }

    /**
     * Renders the node's markdown content into the given element.
     * @param {HTMLElement} contentArea The element to render into.
     */
    renderMarkdown(contentArea) {
        if (typeof marked === 'undefined') {
            console.warn('marked.js is not loaded. Cannot render markdown.');
            contentArea.innerText = this.content || '';
            return;
        }
        // Use 'marked.parse' which is the modern way to call it
        const dirtyHtml = marked.parse(this.content || '');
        contentArea.innerHTML = dirtyHtml;
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
     * Creates the resize handles for all sides and corners of the node.
     */
    createResizeHandles() {
        const handlePositions = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'];
        handlePositions.forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${pos}`;
            handle.dataset.direction = pos;
            handle.dataset.nodeId = this.id;
            this.element.appendChild(handle);
        });
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
        if (data.content !== undefined) {
            this.content = data.content;
            const contentArea = this.element.querySelector('.node-content');
            // Only re-render if the node is not currently being edited to avoid losing focus.
            if (contentArea && !contentArea.isEditing) {
                this.renderMarkdown(contentArea);
            }
        }
        if (data.isPinned !== undefined) {
            this.isPinned = data.isPinned;
            this.element.classList.toggle('is-pinned', this.isPinned);
            needsRedraw = true; // A redraw is needed to update edges
        }
        if (data.color) {
            this.color = data.color;
            this.element.dataset.color = this.color;
            this.element.style.setProperty('--icon-color', `var(--color-node-${this.color}-border)`);
            this.element.style.setProperty('--icon-color-bg', `var(--color-node-${this.color}-bg)`);
            this.element.style.setProperty('--node-accent-color', `var(--color-node-${this.color}-border)`);
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