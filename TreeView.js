class TreeView {
    constructor(container) {
        this.container = container;
        this.tree = null;
        this.selectedFiles = new Set();
        this.lastSelectedFile = null;

        // For selection box
        this.isBoxSelecting = false;
        this.selectionBox = null;
        this.selectionStartPoint = { x: 0, y: 0 };
        this.didDrag = false;

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
        this.container.addEventListener('mousedown', e => {
            const li = e.target.closest('li');
            // If the click is on the background, not an item, start selection box.
            if (!li || !this.container.contains(li)) {
                this._handleBackgroundMouseDown(e);
            }
        });

        this.container.addEventListener('click', (e) => {
            // If we just finished a drag-selection, don't process a click.
            if (this.didDrag) {
                this.didDrag = false;
                return;
            }

            const li = e.target.closest('li');
            if (!li || !this.container.contains(li)) return;
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
            e.preventDefault();
            const li = e.target.closest('li');
        
            let detail;
            if (li && this.container.contains(li)) {
                detail = {
                    id: li.dataset.id,
                    isFolder: li.classList.contains('folder'),
                    isBackground: false,
                    x: e.clientX,
                    y: e.clientY
                };
            } else {
                // Background click
                detail = {
                    id: this.tree?.querySelector('li')?.dataset.id.split('/')[0] || '', // Root ID
                    isFolder: true, // Treat as a folder for context menu purposes
                    isBackground: true,
                    x: e.clientX,
                    y: e.clientY
                };
            }
        
            if (detail.id !== null) {
                this.container.dispatchEvent(new CustomEvent('file-contextmenu', {
                    detail,
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

    _handleBackgroundMouseDown(e) {
        // Prevent starting selection on scrollbar
        if (e.offsetX >= this.container.clientWidth || e.offsetY >= this.container.clientHeight) {
            return;
        }
        
        e.preventDefault();
        this.didDrag = false; 
        this.isBoxSelecting = true;

        if (!e.ctrlKey && !e.metaKey) {
            this._clearSelection();
        }
        
        const containerRect = this.container.getBoundingClientRect();
        this.selectionStartPoint = {
            x: e.clientX - containerRect.left + this.container.scrollLeft,
            y: e.clientY - containerRect.top + this.container.scrollTop,
        };

        this.selectionBox = document.createElement('div');
        this.selectionBox.className = 'tree-selection-box';
        this.container.appendChild(this.selectionBox);

        const onMouseMove = this._handleSelectionMouseMove.bind(this);
        const onMouseUp = () => {
            this._handleSelectionMouseUp(e.ctrlKey || e.metaKey);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    _handleSelectionMouseMove(e) {
        if (!this.isBoxSelecting) return;
        this.didDrag = true;
        e.preventDefault();

        const containerRect = this.container.getBoundingClientRect();
        const currentPoint = {
            x: e.clientX - containerRect.left + this.container.scrollLeft,
            y: e.clientY - containerRect.top + this.container.scrollTop,
        };

        const x = Math.min(this.selectionStartPoint.x, currentPoint.x);
        const y = Math.min(this.selectionStartPoint.y, currentPoint.y);
        const width = Math.abs(this.selectionStartPoint.x - currentPoint.x);
        const height = Math.abs(this.selectionStartPoint.y - currentPoint.y);

        this.selectionBox.style.left = `${x}px`;
        this.selectionBox.style.top = `${y}px`;
        this.selectionBox.style.width = `${width}px`;
        this.selectionBox.style.height = `${height}px`;

        const selectionRect = { left: x, top: y, right: x + width, bottom: y + height };
        const allFiles = this.container.querySelectorAll('li.file');

        allFiles.forEach(fileEl => {
            const fileRect = {
                left: fileEl.offsetLeft,
                top: fileEl.offsetTop,
                right: fileEl.offsetLeft + fileEl.offsetWidth,
                bottom: fileEl.offsetTop + fileEl.offsetHeight
            };
            
            const intersects = !(fileRect.right < selectionRect.left || 
                                 fileRect.left > selectionRect.right || 
                                 fileRect.bottom < selectionRect.top || 
                                 fileRect.top > selectionRect.bottom);
            
            if (intersects) {
                if (!this.selectedFiles.has(fileEl)) {
                    fileEl.classList.add('selected');
                    this.selectedFiles.add(fileEl);
                }
            } else {
                if (this.selectedFiles.has(fileEl) && !(e.ctrlKey || e.metaKey)) {
                    fileEl.classList.remove('selected');
                    this.selectedFiles.delete(fileEl);
                }
            }
        });
    }

    _handleSelectionMouseUp(isCtrlKey) {
        if (!this.isBoxSelecting) return;
        this.isBoxSelecting = false;
        
        if (this.selectionBox) {
            this.selectionBox.remove();
            this.selectionBox = null;
        }

        // If it was just a click on the background (no drag), clear selection
        // unless Ctrl was held.
        if (!this.didDrag && !isCtrlKey) {
           this._clearSelection();
        }
        
        this._dispatchSelectionChange();
    }

    _clearSelection() {
        this.selectedFiles.forEach(el => el.classList.remove('selected'));
        this.selectedFiles.clear();
    }

    _dispatchSelectionChange() {
        const selectedIds = Array.from(this.selectedFiles).map(el => el.dataset.id);
        const event = new CustomEvent('file-selection-changed', {
            detail: { ids: selectedIds },
            bubbles: true,
            composed: true
        });
        this.container.dispatchEvent(event);
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
        this._dispatchSelectionChange();
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

    promptNewFolder(parentId) {
        let parentUl;
        if (parentId === '') {
            parentUl = this.tree;
        } else {
            const parentLi = this.container.querySelector(`li[data-id="${parentId}"]`);
            if (!parentLi) return;
            
            if (parentLi.classList.contains('collapsed')) {
                this._toggleFolder(parentLi);
            }
            parentUl = parentLi.querySelector('ul');
        }
    
        if (!parentUl) return;
    
        const tempId = `temp-folder-${Date.now()}`;
        const li = this._createNode({
            id: tempId,
            name: '',
            children: []
        }, new Set());
    
        parentUl.appendChild(li);
        this.startRename(tempId, true, parentId);
    }

    startRename(itemId, isNewItem = false, parentId = null) {
        const li = this.container.querySelector(`li[data-id="${itemId}"]`);
        if (!li) return;
    
        const contentDiv = li.querySelector('.tree-node-content');
        const span = contentDiv.querySelector('span');
        const originalName = span.textContent;
    
        // Hide the original span and its icon to make space for the input
        span.style.display = 'none';
        const icon = contentDiv.querySelector('i[data-lucide]');
        if (icon) icon.style.display = 'none';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'tree-rename-input';
        input.value = originalName;
        
        // Insert input after the chevron icon/placeholder
        const chevron = contentDiv.querySelector('.chevron-icon, .chevron-placeholder');
        if (chevron) {
            chevron.after(input);
        } else {
            contentDiv.prepend(input);
        }
    
        input.focus();
        input.select();
    
        const finishRename = (isCancelled = false) => {
            document.removeEventListener('mousedown', onDocumentMouseDown, true);
            const newName = input.value.trim();
            
            if (isNewItem) {
                li.remove();
            } else {
                input.remove();
                span.style.display = '';
                if (icon) icon.style.display = '';
            }
    
            if (isCancelled || newName === '') {
                return; // No change, do nothing
            }
            
            if (isNewItem) {
                this.container.dispatchEvent(new CustomEvent('folder-created', {
                    detail: { parentId, newName },
                    bubbles: true,
                    composed: true
                }));
            } else {
                if (newName === originalName) {
                    return;
                }
                this.container.dispatchEvent(new CustomEvent('item-renamed', {
                    detail: { id: itemId, newName },
                    bubbles: true,
                    composed: true
                }));
            }
        };
    
        const onDocumentMouseDown = (e) => {
            if (e.target !== input) {
                finishRename();
            }
        };

        input.addEventListener('blur', () => finishRename());
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                finishRename();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                finishRename(true);
            }
        });

        // Use a timeout to avoid the same click that opened the menu from blurring the input
        setTimeout(() => {
            document.addEventListener('mousedown', onDocumentMouseDown, true);
        }, 100);
    }
} 