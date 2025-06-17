class ContextMenu {
    constructor(container, eventBus) {
        this.container = container;
        this.events = eventBus;
        this.menuElement = null;
        this.init();
    }

    init() {
        this.menuElement = document.createElement('div');
        this.menuElement.id = 'context-menu';
        this.menuElement.classList.add('context-menu');
        this.container.appendChild(this.menuElement);

        // Hide on click outside
        document.addEventListener('click', (event) => {
            if (!this.menuElement.contains(event.target)) {
                this.hide();
            }
        });
    }

    show(x, y, items) {
        this.menuElement.innerHTML = '';
        
        const itemList = document.createElement('ul');
        items.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item.label;
            li.addEventListener('click', () => {
                this.events.publish(item.event, { x, y });
                this.hide();
            });
            itemList.appendChild(li);
        });

        this.menuElement.appendChild(itemList);
        this.menuElement.style.left = `${x}px`;
        this.menuElement.style.top = `${y}px`;
        this.menuElement.style.display = 'block';
    }

    hide() {
        if (this.menuElement) {
            this.menuElement.style.display = 'none';
        }
    }
} 