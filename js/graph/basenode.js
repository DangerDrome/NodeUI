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
     * @param {number} [options.width=150] - The width of the node.
     * @param {number} [options.height=100] - The height of the node.
     * @param {string} [options.title='New Node'] - The title of the node.
     * @param {string} [options.content=''] - The markdown content of the node.
     * @param {string} [options.type='BaseNode'] - The type of the node.
     */
    constructor({
        id = crypto.randomUUID(),
        x = 0,
        y = 0,
        width = 150,
        height = 100,
        title = 'New Node',
        content = '',
        type = 'BaseNode'
    } = {}) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.title = title;
        this.content = content;
        this.type = type;

        this.element = null; // To hold the DOM element
        this.handles = {}; // To hold handle elements
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

        return this.element;
    }

    /**
     * Creates the title bar element for the node.
     * @returns {HTMLElement} The title bar element.
     */
    createTitleBar() {
        const titleBar = document.createElement('div');
        titleBar.className = 'node-title-bar';
        titleBar.textContent = this.title;
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
     * Creates connection handles on the node.
     */
    createHandles() {
        const handlePositions = ['top', 'right', 'bottom', 'left'];
        handlePositions.forEach(position => {
            const handle = document.createElement('div');
            handle.className = `node-handle ${position}`;
            handle.dataset.nodeId = this.id;
            handle.dataset.handlePosition = position;
            
            this.handles[position] = handle;
            this.element.appendChild(handle);
        });
    }
} 