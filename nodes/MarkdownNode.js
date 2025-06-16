/**
 * @file Custom node definition for a Markdown editor node.
 */

const MarkdownNode = {
    // Unique identifier for this node type
    type: 'markdown-node',
    
    // Default title for new nodes
    title: 'Markdown',
    
    // Lucide icon for the node header
    icon: 'file-text',
    
    // Default properties for the node's data object
    properties: {
        content: '# New Note\n\nStart typing your markdown here.',
        isEditing: false
    },

    // Cache for rendered markdown elements to prevent flickering
    renderCache: new Map(),

    /**
     * Renders the custom content of the markdown node.
     * @param {object} node - The node data object.
     * @param {HTMLElement} nodeBodyEl - The HTML element for the node's body.
     * @param {GraphEditor} graphEditor - The instance of the main graph editor.
     */
    render: function(node, nodeBodyEl, graphEditor) {
        nodeBodyEl.style.padding = '5px';
        const initialContent = node.properties.content || '';

        const cached = this.renderCache.get(node.id);
        if (cached && cached.content === initialContent) {
            nodeBodyEl.appendChild(cached.element);
            return;
        }
        
        const save = () => graphEditor._saveGraphStateToDB();

        const setEditMode = (isEditing) => {
            if (node.properties.isEditing && !isEditing) {
                const editor = nodeBodyEl.querySelector('.markdown-editor');
                if (editor && node.properties.content !== editor.value) {
                    node.properties.content = editor.value;
                    graphEditor._saveStateForUndo('Edit Markdown Note');
                    save();
                }
            }
            if (node.properties.isEditing !== isEditing) {
                node.properties.isEditing = isEditing;
                graphEditor._render();
            }
        };

        if (node.properties.isEditing) {
            const editor = document.createElement('textarea');
            editor.className = 'markdown-editor';
            editor.value = 'Loading...';
            nodeBodyEl.appendChild(editor);

            (async () => {
                let contentToEdit = initialContent;
                if (initialContent.startsWith('file-id://')) {
                    const fileId = initialContent.substring('file-id://'.length);
                    const handle = graphEditor.state.fileHandles.get(fileId) || (graphEditor.state.virtualFileHandles && graphEditor.state.virtualFileHandles.get(fileId));
                    if (handle) {
                        const file = (typeof handle.getFile === 'function') ? await handle.getFile() : handle;
                        contentToEdit = await file.text();
                    } else {
                        contentToEdit = `Error: Could not load file \`${fileId}\`.`;
                    }
                }
                editor.value = contentToEdit;
            })();

            editor.addEventListener('mousedown', e => e.stopPropagation());
            editor.addEventListener('keydown', (e) => {
                e.stopPropagation();
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    editor.blur();
                }
            });
            editor.addEventListener('blur', () => setEditMode(false));
            setTimeout(() => editor.focus(), 0);

        } else {
            const markdownContainer = document.createElement('div');
            markdownContainer.className = 'markdown-content';
            markdownContainer.innerHTML = '<p>Loading content...</p>';
            nodeBodyEl.appendChild(markdownContainer);
            
            (async () => {
                let contentToRender = initialContent;
                if (initialContent.startsWith('file-id://')) {
                    const fileId = initialContent.substring('file-id://'.length);
                    const handle = graphEditor.state.fileHandles.get(fileId) || (graphEditor.state.virtualFileHandles && graphEditor.state.virtualFileHandles.get(fileId));
                    if (handle) {
                        const file = (typeof handle.getFile === 'function') ? await handle.getFile() : handle;
                        contentToRender = await file.text();
                    } else {
                        contentToRender = `Error: Could not load file \`${fileId}\`.`;
                    }
                }
                
                const fileIdRegex = /(file-id:\/\/([^"'\)]+))/g;
                const matches = [...contentToRender.matchAll(fileIdRegex)];

                if (matches.length > 0) {
                    let resolvedContent = contentToRender;
                    for (const match of matches) {
                        const fullUri = match[0];
                        const fileId = match[2];
                        const url = await graphEditor._resolveFileIdToUrl(fileId);
                        if (url) {
                            resolvedContent = resolvedContent.replace(fullUri, url);
                        }
                    }
                    contentToRender = resolvedContent;
                }
                
                if (contentToRender.trim().startsWith('<video')) {
                    markdownContainer.innerHTML = contentToRender;
                } else {
                    markdownContainer.innerHTML = window.marked ? window.marked.parse(contentToRender) : contentToRender.replace(/\n/g, '<br>');
                }
                
                const mediaElements = markdownContainer.querySelectorAll('img, video');
                mediaElements.forEach(media => {
                    media.draggable = false;
                    media.addEventListener('dragstart', e => e.preventDefault());
                });
                
                this.renderCache.set(node.id, { element: markdownContainer, content: initialContent });
            })();

            markdownContainer.addEventListener('mousedown', e => e.stopPropagation());
            markdownContainer.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                setEditMode(true);
            });
        }
    },

    /**
     * Returns a list of custom context menu items for this node type.
     * @param {object} node - The node data object.
     * @param {GraphEditor} graphEditor - The instance of the main graph editor.
     * @param {object} contextData - Additional context, like the node's DOM element.
     * @returns {Array<object>} A list of context menu item definitions.
     */
    getContextMenuItems: function(node, graphEditor, contextData) {
        const isEditing = node.properties.isEditing;
        const save = () => graphEditor._saveGraphStateToDB();

        const toggleEdit = () => {
            if (isEditing) {
                const editor = contextData.nodeElement.querySelector('.markdown-editor');
                 if (editor && node.properties.content !== editor.value) {
                    node.properties.content = editor.value;
                    graphEditor._saveStateForUndo('Edit Markdown Note');
                    save();
                }
            }
            node.properties.isEditing = !isEditing;
            graphEditor._render();
        };

        return [
            {
                label: isEditing ? 'View Markdown' : 'Edit Markdown',
                icon: 'edit-3',
                callback: toggleEdit
            },
            {
                label: 'Clear Content',
                icon: 'trash-2',
                callback: () => {
                    if (confirm('Are you sure you want to clear the content?')) {
                        node.properties.content = '';
                        if (isEditing) {
                            node.properties.isEditing = false;
                        }
                        graphEditor._saveStateForUndo('Clear Markdown Note');
                        save();
                        graphEditor._render();
                    }
                }
            }
        ];
    },

    /**
     * Optional hook that runs when a node of this type is removed.
     * Used here to clean up the render cache.
     * @param {object} node - The node data object that is being removed.
     */
    onNodeRemoved: function(node) {
        this.renderCache.delete(node.id);
    },

    /**
     * Optional hook that runs when a new node of this type is created.
     * @param {object} node - The node data object that has just been created.
     */
    onNodeCreated: function(node) {
        node.properties.isEditing = false;
    }
};

// Add this node definition to a global array for the main editor to pick up.
window.nodeDefinitions = window.nodeDefinitions || [];
window.nodeDefinitions.push(MarkdownNode); 