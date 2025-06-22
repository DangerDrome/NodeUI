class ContextMenu {
    constructor() {
        this.menuElement = null;
        this.activeSubmenu = null;
        this.submenuHideTimer = null;
        this.init();
    }

    init() {
        this.menuElement = document.createElement('div');
        this.menuElement.id = 'context-menu';
        this.menuElement.classList.add('context-menu');
        document.body.appendChild(this.menuElement);

        document.addEventListener('mousedown', (event) => {
            if (this.menuElement.style.display === 'block' && !this.menuElement.contains(event.target)) {
                if (this.activeSubmenu && this.activeSubmenu.contains(event.target)) return;
                this.hide();
            }
        });
    }

    show(x, y, items) {
        this.hide(); // Hide any existing menu before showing a new one
        this.menuElement.innerHTML = '';
        
        const itemList = document.createElement('ul');
        items.forEach(item => {
            const li = this.createMenuItem(item);
            itemList.appendChild(li);
        });

        this.menuElement.appendChild(itemList);
        this.menuElement.style.left = `${x}px`;
        this.menuElement.style.top = `${y}px`;
        this.menuElement.style.display = 'block';
    }

    createMenuItem(item) {
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
            if (item.iconClass) {
                iconSpan.classList.add(item.iconClass);
            } else if (item.iconHtml) {
                iconSpan.innerHTML = item.iconHtml;
            }
            
            const labelSpan = document.createElement('span');
            labelSpan.textContent = item.label;

            li.appendChild(iconSpan);
            li.appendChild(labelSpan);

            if (item.submenu) {
                li.classList.add('has-submenu');
                const arrow = document.createElement('span');
                arrow.className = 'submenu-arrow';
                arrow.innerHTML = '<span class="icon-play"></span>';
                li.appendChild(arrow);
                
                li.addEventListener('mouseenter', () => this.showSubmenu(li, item.submenu));
                li.addEventListener('mouseleave', () => this.scheduleHideSubmenu());

            } else if (item.inlineEdit) {
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
        return li;
    }

    showSubmenu(parentLi, submenuItems) {
        if (this.activeSubmenu) {
            this.hideSubmenu();
        }
        clearTimeout(this.submenuHideTimer);

        const submenuElement = document.createElement('div');
        submenuElement.className = 'context-menu'; // Submenus are just another context menu
        
        const itemList = document.createElement('ul');
        submenuItems.forEach(item => {
            const li = this.createMenuItem(item);
            itemList.appendChild(li);
        });
        submenuElement.appendChild(itemList);

        submenuElement.addEventListener('mouseenter', () => clearTimeout(this.submenuHideTimer));
        submenuElement.addEventListener('mouseleave', () => this.scheduleHideSubmenu());

        this.activeSubmenu = submenuElement;
        document.body.appendChild(this.activeSubmenu);

        const parentRect = parentLi.getBoundingClientRect();
        const subRect = submenuElement.getBoundingClientRect();

        let subX = parentRect.right;
        let subY = parentRect.top;

        if (subX + subRect.width > window.innerWidth) {
            subX = parentRect.left - subRect.width;
        }
        if (subY + subRect.height > window.innerHeight) {
            subY = window.innerHeight - subRect.height;
        }

        submenuElement.style.left = `${subX}px`;
        submenuElement.style.top = `${subY}px`;
        submenuElement.style.display = 'block';
    }

    scheduleHideSubmenu() {
        this.submenuHideTimer = setTimeout(() => {
            this.hideSubmenu();
        }, 300);
    }
    
    hideSubmenu() {
        if (this.activeSubmenu) {
            this.activeSubmenu.remove();
            this.activeSubmenu = null;
        }
    }

    transformToInput(liElement, item) {
        this.hideSubmenu(); // Hide any open submenu when starting an edit
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
        if (this.menuElement && this.menuElement.style.display !== 'none') {
            this.menuElement.style.display = 'none';
            this.hideSubmenu();
            events.publish('contextmenu:hidden');
        }
    }
} 