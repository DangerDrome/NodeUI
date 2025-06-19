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

                if (item.inlineEdit) {
                    li.addEventListener('click', (event) => {
                        event.stopPropagation();
                        if (item.disabled) return;
                        this.transformToInput(li, item);
                    });
                } else {
                    li.addEventListener('click', () => {
                        if (item.action && typeof item.action === 'function' && !item.disabled) {
                            item.action();
                        }
                        this.hide();
                    });
                }
            }

            itemList.appendChild(li);
        });

        this.menuElement.appendChild(itemList);
        this.menuElement.style.left = `${x}px`;
        this.menuElement.style.top = `${y}px`;
        this.menuElement.style.display = 'block';
    }

    /**
     * Transforms a context menu item into an input field for inline editing.
     * @param {HTMLLIElement} liElement - The list item element to transform.
     * @param {object} item - The menu item configuration object.
     */
    transformToInput(liElement, item) {
        liElement.innerHTML = ''; // Clear icon and label
        liElement.style.padding = '4px';
        liElement.style.gap = '0';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'context-menu-input';
        input.value = item.initialValue || '';

        liElement.appendChild(input);
        input.focus();
        input.select();

        const finishEditing = (save) => {
            if (save && item.onEdit) {
                item.onEdit(input.value);
            }
            this.hide();
        };

        const onBlur = () => {
            finishEditing(true);
            input.removeEventListener('blur', onBlur);
            input.removeEventListener('keydown', onKeyDown);
        };

        const onKeyDown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur(); // Triggers blur which saves and hides
            } else if (e.key === 'Escape') {
                e.preventDefault();
                finishEditing(false);
            }
        };

        input.addEventListener('blur', onBlur);
        input.addEventListener('keydown', onKeyDown);
    }

    hide() {
        if (this.menuElement) {
            this.menuElement.style.display = 'none';
        }
    }
} 