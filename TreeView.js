class TreeView {
    constructor(container) {
        this.container = container;
        this.tree = null;
        this.selectedFiles = new Set();
        this.lastSelectedFile = null;
        this._addEventListeners();
    }

    // Public method to render the tree with given data
    render(data, expandedIds = new Set()) {
        this.tree = document.createElement('ul');
        this.tree.className = 'tree-view';
        
        data.forEach(nodeData => {
            this.tree.appendChild(this._createNode(nodeData, expandedIds));
        });

        this.container.innerHTML = '';
        this.container.appendChild(this.tree);
        
        lucide.createIcons();
    }

    // Create a single tree node (file or folder)
    _createNode(nodeData, expandedIds) {
        const li = document.createElement('li');
        li.dataset.id = nodeData.id;
        
        const isFolder = Array.isArray(nodeData.children);
        li.className = isFolder ? 'folder' : 'file';
        if (isFolder && !expandedIds.has(nodeData.id)) {
            li.classList.add('collapsed');
        }

        if (!isFolder) {
            li.draggable = true;
            li.dataset.type = nodeData.type;
        }

        const nodeContent = document.createElement('div');
        nodeContent.className = 'tree-node-content';
        
        let iconName;
        let prefixHTML = '';

        if (isFolder) {
            const isCollapsed = !expandedIds.has(nodeData.id);
            iconName = 'folder';
            prefixHTML = `<i data-lucide="${isCollapsed ? 'chevron-right' : 'chevron-down'}" class="chevron-icon"></i>`;
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
                childrenUl.appendChild(this._createNode(child, expandedIds));
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
                this._handleFileSelection(li, e.ctrlKey || e.metaKey, e.shiftKey);
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

        this.container.addEventListener('contextmenu', e => {
            const li = e.target.closest('li');
            if (li && this.container.contains(li)) {
                e.preventDefault();
                this.container.dispatchEvent(new CustomEvent('file-contextmenu', {
                    detail: {
                        id: li.dataset.id,
                        isFolder: li.classList.contains('folder'),
                        x: e.clientX,
                        y: e.clientY
                    },
                    bubbles: true,
                    composed: true
                }));
            }
        });

        this.container.addEventListener('dragstart', e => {
            const li = e.target.closest('li.file');
            if (li && this.container.contains(li)) {
                // If the dragged item is not part of the current selection, make it the sole selection.
                if (!this.selectedFiles.has(li)) {
                    this._handleFileSelection(li, false, false);
                }
        
                const filesToDrag = Array.from(this.selectedFiles).map(fileEl => ({
                    id: fileEl.dataset.id,
                    type: fileEl.dataset.type
                }));

                if (filesToDrag.length > 0) {
                    e.dataTransfer.setData('application/nodeuifiles', JSON.stringify(filesToDrag));
                    e.dataTransfer.effectAllowed = 'copy';
                    this._createMultiDragImage(e);
                } else {
                    e.preventDefault();
                }
            } else {
                e.preventDefault();
            }
        });
    }

    _createMultiDragImage(event) {
        const dragImageContainer = document.createElement('div');
        dragImageContainer.style.position = 'absolute';
        dragImageContainer.style.top = '-1000px';
        document.body.appendChild(dragImageContainer);
    
        const count = this.selectedFiles.size;
        const primaryElement = this.selectedFiles.values().next().value;
    
        const dragImage = document.createElement('div');
        Object.assign(dragImage.style, {
            backgroundColor: 'var(--context-menu-bg-color)',
            border: '1px solid var(--graph-border-color)',
            color: 'var(--text-color)',
            borderRadius: '4px',
            padding: '5px 10px',
            fontFamily: 'sans-serif',
            fontSize: '14px'
        });
        
        dragImage.textContent = count > 1 ? `${count} files` : primaryElement.querySelector('span').textContent;
        
        dragImageContainer.appendChild(dragImage);
        
        event.dataTransfer.setDragImage(dragImage, 10, 10);
    
        setTimeout(() => document.body.removeChild(dragImageContainer), 0);
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
    _handleFileSelection(fileElement, ctrlKey, shiftKey) {
        const allFiles = Array.from(this.container.querySelectorAll('li.file'));

        if (shiftKey && this.lastSelectedFile && allFiles.includes(this.lastSelectedFile)) {
            // Range selection with Shift.
            // This clears the previous selection and selects the new range.
            const lastIndex = allFiles.indexOf(this.lastSelectedFile);
            const currentIndex = allFiles.indexOf(fileElement);
            const start = Math.min(lastIndex, currentIndex);
            const end = Math.max(lastIndex, currentIndex);
            
            this.selectedFiles.forEach(el => el.classList.remove('selected'));
            this.selectedFiles.clear();

            for (let i = start; i <= end; i++) {
                const fileInRange = allFiles[i];
                fileInRange.classList.add('selected');
                this.selectedFiles.add(fileInRange);
            }
        } else if (ctrlKey) {
            // Toggle individual file with Ctrl.
            if (this.selectedFiles.has(fileElement)) {
                fileElement.classList.remove('selected');
                this.selectedFiles.delete(fileElement);
            } else {
                fileElement.classList.add('selected');
                this.selectedFiles.add(fileElement);
            }
            this.lastSelectedFile = fileElement;
        } else {
            // Simple click: clear all, select one, set anchor.
            this.selectedFiles.forEach(el => el.classList.remove('selected'));
            this.selectedFiles.clear();
            
            fileElement.classList.add('selected');
            this.selectedFiles.add(fileElement);
            this.lastSelectedFile = fileElement;
        }
        
        // Dispatch a custom event with all selected IDs.
        const selectedIds = Array.from(this.selectedFiles).map(el => el.dataset.id);
        const event = new CustomEvent('file-selection-changed', {
            detail: { ids: selectedIds },
            bubbles: true,
            composed: true
        });
        this.container.dispatchEvent(event);
    }

    getExpansionState() {
        const expandedFolderIds = new Set();
        const folders = this.container.querySelectorAll('.folder:not(.collapsed)');
        folders.forEach(folder => {
            if (folder.dataset.id) {
                expandedFolderIds.add(folder.dataset.id);
            }
        });
        return expandedFolderIds;
    }
} 