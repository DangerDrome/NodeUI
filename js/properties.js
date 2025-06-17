class PropertiesPanel {
    constructor(container, eventBus) {
        this.container = container;
        this.events = eventBus;
        this.selectedId = null;
        this.selectedType = null; // 'node' or 'edge'
        
        this.init();
        this.subscribeToEvents();
    }

    init() {
        this.container.innerHTML = `<h2>Properties</h2><div class="properties-content"><p>No item selected</p></div>`;
    }

    subscribeToEvents() {
        this.events.subscribe('selection:changed', (data) => this.onSelectionChanged(data));
        this.events.subscribe('response:node-data', (node) => this.render(node));
    }

    onSelectionChanged(data) {
        const { selectedNodeIds } = data;
        
        // For now, only handle single selection
        if (selectedNodeIds.length === 1) {
            this.selectedId = selectedNodeIds[0];
            this.selectedType = 'node'; // Simplification
            this.events.publish('request:node-data', this.selectedId);
        } else {
            this.selectedId = null;
            this.selectedType = null;
            this.clearPanel();
        }
    }

    render(node) {
        if (!node) {
            this.clearPanel();
            return;
        }

        const content = this.container.querySelector('.properties-content');
        content.innerHTML = `
            <div><strong>ID:</strong> ${node.id}</div>
            <div><strong>Type:</strong> ${node.type}</div>
            <div><strong>Title:</strong> <input type="text" class="prop-input" id="prop-title" value="${node.title}"></div>
            <div class="prop-color-palette"></div>
        `;

        this.renderColorPalette(content.querySelector('.prop-color-palette'), node.id);

        // Add event listener for the title input
        content.querySelector('#prop-title').addEventListener('change', (e) => {
            this.events.publish('node:update', { nodeId: node.id, title: e.target.value });
        });
    }

    renderColorPalette(container, nodeId) {
        const colors = ['default', 'red', 'green', 'blue', 'yellow', 'purple'];
        colors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.dataset.color = color;
            swatch.style.backgroundColor = `var(--color-node-${color})`;
            swatch.addEventListener('click', () => {
                this.events.publish('node:update', { nodeId, color });
            });
            container.appendChild(swatch);
        });
    }

    clearPanel() {
        const content = this.container.querySelector('.properties-content');
        if (content) {
            content.innerHTML = '<p>No item selected</p>';
        }
    }
} 