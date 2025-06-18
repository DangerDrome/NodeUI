class ContextMenu {
    constructor() {
        this.menuElement = null;
        this.init();
    }

    init() {
        this.menuElement = document.createElement('div');
        this.menuElement.id = 'context-menu';
        this.menuElement.classList.add('context-menu');
        document.body.appendChild(this.menuElement);

        // Hide on click outside
        document.addEventListener('click', (event) => {
            if (this.menuElement && !this.menuElement.contains(event.target)) {
                this.hide();
            }
        });
    }

    show(x, y, items) {
        this.menuElement.innerHTML = '';
        
        const itemList = document.createElement('ul');
        items.forEach(item => {
            const li = document.createElement('li');

            if (item.isSeparator) {
                li.className = 'context-menu-separator';
            } else {
                li.className = 'context-menu-item';
                if (item.disabled) {
                    li.classList.add('is-disabled');
                }

                const iconSpan = document.createElement('span');
                iconSpan.className = 'context-menu-icon';
                iconSpan.classList.add(item.iconClass || 'icon-placeholder');
                
                const labelSpan = document.createElement('span');
                labelSpan.textContent = item.label;

                li.appendChild(iconSpan);
                li.appendChild(labelSpan);

                li.addEventListener('click', () => {
                    if (item.action && typeof item.action === 'function' && !item.disabled) {
                        item.action();
                    }
                    this.hide();
                });
            }

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