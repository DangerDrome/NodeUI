class TreeView {
    constructor(container) {
        this.container = container;
        this.tree = null;
        this.selectedFile = null;
        this._addEventListeners();
    }

    // Public method to render the tree with given data
    render(data) {
        this.tree = document.createElement('ul');
        this.tree.className = 'tree-view';
        
        data.forEach(nodeData => {
            this.tree.appendChild(this._createNode(nodeData));
        });

        this.container.innerHTML = '';
        this.container.appendChild(this.tree);
        
        lucide.createIcons();
    }

    // Create a single tree node (file or folder)
    _createNode(nodeData) {
        const li = document.createElement('li');
        li.dataset.id = nodeData.id;
        
        const isFolder = Array.isArray(nodeData.children);
        li.className = isFolder ? 'folder collapsed' : 'file';

        const nodeContent = document.createElement('div');
        nodeContent.className = 'tree-node-content';
        
        let iconName;
        let prefixHTML = '';

        if (isFolder) {
            iconName = 'folder';
            prefixHTML = `<i data-lucide="chevron-right" class="chevron-icon"></i>`;
        } else {
            iconName = 'file';
            switch (nodeData.type) {
                case 'json': iconName = 'file-json'; break;
                case 'image': iconName = 'image'; break;
                case 'video': iconName = 'video'; break;
                case 'markdown': iconName = 'file-text'; break;
            }
            prefixHTML = `<span class="chevron-placeholder"></span>`;
        }
        
        nodeContent.innerHTML = `${prefixHTML}<i data-lucide="${iconName}"></i><span>${nodeData.name}</span>`;
        li.appendChild(nodeContent);

        if (isFolder) {
            const childrenUl = document.createElement('ul');
            nodeData.children.forEach(child => {
                childrenUl.appendChild(this._createNode(child));
            });
            li.appendChild(childrenUl);
        }

        return li;
    }

    // Add event listeners for tree interactions
    _addEventListeners() {
        this.container.addEventListener('click', (e) => {
            const li = e.target.closest('li');

            if (!li || !this.container.contains(li)) return;
            
            // If the direct target of the click is a UL, we do nothing.
            // This is to avoid toggling folders when clicking in the empty space of a list.
            if (e.target.tagName === 'UL') return;

            if (li.classList.contains('folder')) {
                this._toggleFolder(li);
            } else if (li.classList.contains('file')) {
                this._selectFile(li);
            }
        });

        this.container.addEventListener('dblclick', e => {
            const li = e.target.closest('li.file');
            if (li && this.container.contains(li)) {
                this.container.dispatchEvent(new CustomEvent('file-activated', {
                    detail: { id: li.dataset.id },
                    bubbles: true,
                    composed: true
                }));
            }
        });
    }

    // Toggle folder open/closed state
    _toggleFolder(folderElement) {
        folderElement.classList.toggle('collapsed');
        const chevron = folderElement.querySelector('.chevron-icon');
        if (chevron) {
            const isCollapsed = folderElement.classList.contains('collapsed');
            chevron.setAttribute('data-lucide', isCollapsed ? 'chevron-right' : 'chevron-down');
            lucide.createIcons();
        }
    }

    // Handle file selection
    _selectFile(fileElement) {
        if (this.selectedFile) {
            this.selectedFile.classList.remove('selected');
        }
        this.selectedFile = fileElement;
        this.selectedFile.classList.add('selected');
        
        // Dispatch a custom event when a file is selected
        const event = new CustomEvent('file-selected', {
            detail: { id: fileElement.dataset.id },
            bubbles: true,
            composed: true
        });
        this.container.dispatchEvent(event);
    }
} 