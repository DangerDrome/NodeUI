/**
 * @fileoverview A specialized node for displaying application event logs.
 * It subscribes to the global event bus and displays event information in real-time.
 */

class LogNode extends BaseNode {
    /**
     * @param {object} [options={}] - The options for the log node.
     */
    constructor(options = {}) {
        const defaults = {
            title: 'Event Log',
            type: 'LogNode',
            color: 'default',
            width: 400,
            height: 300,
        };
        super({ ...defaults, ...options });
        this.logContainer = null;
        this.eventSubscription = null;
    }

    /**
     * Overrides the default render method to add specific elements for logging.
     * @param {HTMLElement} parentElement - The parent element to append the node to.
     * @returns {HTMLElement} The created DOM element for the node.
     */
    render(parentElement) {
        super.render(parentElement);
        this.element.classList.add('log-node');
        
        const icon = this.element.querySelector('.node-icon');
        if (icon) {
            icon.classList.remove('icon-box');
            icon.classList.add('icon-terminal');
        }

        // Unsubscribe from any previous subscriptions to prevent memory leaks
        if (this.eventSubscription) {
            this.eventSubscription.unsubscribe();
        }

        // Subscribe to all events
        this.eventSubscription = events.subscribe('*', this.logEventHandler.bind(this));

        events.subscribe('log:info', this.addLogEntry.bind(this));
        events.subscribe('clipboard:changed', (data) => this.updateClipboardView(data));

        return this.element;
    }

    /**
     * Renders the content area with a container for log entries.
     * @param {HTMLElement} contentArea - The element to render content into.
     */
    renderContent(contentArea) {
        contentArea.innerHTML = ''; // Clear base content
        
        const wrapper = document.createElement('div');
        wrapper.className = 'log-container-wrapper';

        this.logContainer = document.createElement('div');
        this.logContainer.className = 'log-container';
        
        wrapper.appendChild(this.logContainer);
        contentArea.appendChild(wrapper);

        this.logContainer.addEventListener('dblclick', () => {
            if (this.logContainer.isContentEditable) {
                return;
            }
            this.logContainer.contentEditable = true;
            this.logContainer.focus();

            const exitEditMode = () => {
                this.logContainer.contentEditable = false;
                this.logContainer.removeEventListener('blur', exitEditMode);
                this.logContainer.removeEventListener('keydown', handleKeyDown);
            };

            const handleKeyDown = (ev) => {
                if (ev.key === 'Escape') {
                    ev.preventDefault();
                    exitEditMode();
                }
            };

            this.logContainer.addEventListener('blur', exitEditMode);
            this.logContainer.addEventListener('keydown', handleKeyDown);
        });

        // Prevent node dragging when interacting with the log container text.
        this.logContainer.addEventListener('mousedown', (e) => {
            if (this.logContainer.isContentEditable) {
                e.stopPropagation();
            }
        });
    }

    /**
     * Handles incoming events and appends them to the log container.
     * @param {string} eventName - The name of the event.
     * @param {*} data - The event data.
     */
    logEventHandler(eventName, data) {
        if (!this.logContainer) return;

        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';

        const eventNameSpan = document.createElement('span');
        eventNameSpan.className = 'log-event-name';
        eventNameSpan.textContent = `[${eventName}]`;

        const eventDataSpan = document.createElement('span');
        eventDataSpan.className = 'log-event-data';
        try {
            // Use a replacer to handle circular structures
            const getCircularReplacer = () => {
                const seen = new WeakSet();
                return (key, value) => {
                    if (typeof value === "object" && value !== null) {
                        if (seen.has(value)) {
                            return "[Circular]";
                        }
                        seen.add(value);
                    }
                    return value;
                };
            };
            eventDataSpan.textContent = JSON.stringify(data, getCircularReplacer(), 2);
        } catch (e) {
            eventDataSpan.textContent = 'Unserializable data';
        }

        logEntry.appendChild(eventNameSpan);
        logEntry.appendChild(document.createTextNode(' '));
        logEntry.appendChild(eventDataSpan);

        this.logContainer.appendChild(logEntry);

        // Auto-scroll to the bottom
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }

    /**
     * Cleans up the event subscription when the node is removed.
     */
    destroy() {
        if (this.eventSubscription) {
            this.eventSubscription.unsubscribe();
            this.eventSubscription = null;
        }
    }

    /**
     * Updates the clipboard view with the current items.
     * @param {object} [clipboardData={nodes: [], edges: []}]
     */
    updateClipboardView(clipboardData = { nodes: [], edges: [] }) {
        const { nodes = [], edges = [] } = clipboardData;
        
        let content = '<h3>Clipboard</h3><div class="log-clipboard-content">';
        if (nodes.length === 0 && edges.length === 0) {
            content += '<span class="log-clipboard-empty">Clipboard is empty.</span>';
        } else {
            if (nodes.length > 0) {
                content += `<div><strong>Nodes (${nodes.length}):</strong><ul>`;
                nodes.forEach(node => {
                    content += `<li>${node.title || 'Untitled Node'}</li>`;
                });
                content += '</ul></div>';
            }
            if (edges.length > 0) {
                content += `<div><strong>Edges (${edges.length})</strong></div>`;
            }
        }
        content += '</div>';
        
        this.clipboardContainer.innerHTML = content;
    }
} 