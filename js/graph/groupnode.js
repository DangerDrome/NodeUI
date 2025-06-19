/**
 * @fileoverview A specialized node for grouping other nodes.
 * It extends BaseNode but has a distinct visual style to act as a container.
 */

class GroupNode extends BaseNode {
    /**
     * @param {object} [options={}] - The options for the group node.
     * @param {string[]} [options.containedNodeIds=[]] - Array of node IDs this group contains.
     */
    constructor(options = {}) {
        // Set defaults specific to a group node
        const defaults = {
            width: 400,
            height: 300,
            title: 'New Group',
            type: 'GroupNode',
            color: 'default'
        };

        // Merge options with defaults
        super({ ...defaults, ...options });

        /**
         * A set of node IDs that are contained within this group.
         * @type {Set<string>}
         */
        this.containedNodeIds = new Set(options.containedNodeIds || []);
    }

    /**
     * Overrides the default render method to add a specific class for styling.
     * @param {HTMLElement} parentElement - The parent element to append the node to.
     * @returns {HTMLElement} The created DOM element for the node.
     */
    render(parentElement) {
        // Call the parent render method to create the base node structure
        super.render(parentElement);

        // Add a specific class for group styling
        this.element.classList.add('group-node');
        
        // Change the default icon to the group icon
        const icon = this.element.querySelector('.node-icon');
        if (icon) {
            icon.classList.remove('icon-file-text');
            icon.classList.add('icon-group');
        }

        return this.element;
    }

    /**
     * Overrides the base method to prevent any content from being rendered inside the group node body.
     * @param {HTMLElement} contentArea - The content area element.
     */
    renderContent(contentArea) {
        // Group nodes should not have a content body, so we remove the element.
        contentArea.remove();
    }

    /**
     * Adds a node ID to the set of contained nodes.
     * @param {string} nodeId - The ID of the node to contain.
     */
    addContainedNode(nodeId) {
        this.containedNodeIds.add(nodeId);
        // Optionally, publish an event
        // events.publish('group:node:added', { groupId: this.id, nodeId: nodeId });
    }

    /**
     * Removes a node ID from the set of contained nodes.
     * @param {string} nodeId - The ID of the node to release.
     */
    removeContainedNode(nodeId) {
        this.containedNodeIds.delete(nodeId);
        // Optionally, publish an event
        // events.publish('group:node:removed', { groupId: this.id, nodeId: nodeId });
    }
} 