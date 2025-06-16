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
        content: '# New Note\n\nStart typing your markdown here.'
    },

    /**
     * Renders the custom content of the markdown node.
     * @param {object} node - The node data object.
     * @param {HTMLElement} nodeBodyEl - The HTML element for the node's body.
     * @param {GraphEditor} graphEditor - The instance of the main graph editor.
     */
    render: function(node, nodeBodyEl, graphEditor) {
        nodeBodyEl.style.padding = '0'; // Use custom padding inside

        const toolbar = document.createElement('div');
        toolbar.className = 'markdown-toolbar';
        
        const toggleButton = document.createElement('button');
        toggleButton.className = 'panel-button';

        const editor = document.createElement('textarea');
        editor.className = 'markdown-editor';
        editor.value = node.properties.content || '';
        editor.style.display = 'none';

        const markdownContainer = document.createElement('div');
        markdownContainer.className = 'markdown-content';
        if (window.marked) {
            markdownContainer.innerHTML = marked.parse(node.properties.content || '');
        }

        // --- Toggling Logic ---
        const setEditMode = (isEditing) => {
            if (isEditing) {
                markdownContainer.style.display = 'none';
                editor.style.display = 'block';
                toggleButton.innerHTML = `<i data-lucide="eye"></i>`;
                editor.focus();
            } else {
                if (graphEditor && node.properties.content !== editor.value) {
                    node.properties.content = editor.value;
                    graphEditor._saveStateForUndo('Edit Markdown Note');
                }
                markdownContainer.innerHTML = marked.parse(editor.value);
                markdownContainer.style.display = 'block';
                editor.style.display = 'none';
                toggleButton.innerHTML = `<i data-lucide="edit-3"></i>`;
            }
            lucide.createIcons({ nodes: [toggleButton] });
        };
        
        // --- Event Handlers ---
        toggleButton.addEventListener('mousedown', e => e.stopPropagation());
        toggleButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const isCurrentlyEditing = editor.style.display !== 'none';
            setEditMode(!isCurrentlyEditing);
        });

        markdownContainer.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            setEditMode(true);
        });

        editor.addEventListener('blur', () => {
            setEditMode(false);
        });
        
        markdownContainer.addEventListener('mousedown', e => e.stopPropagation());
        editor.addEventListener('mousedown', e => e.stopPropagation());
        editor.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                setEditMode(false);
                editor.blur();
            }
        });
        
        // --- Assemble ---
        toolbar.appendChild(toggleButton);
        nodeBodyEl.appendChild(toolbar);
        nodeBodyEl.appendChild(editor);
        nodeBodyEl.appendChild(markdownContainer);

        setEditMode(false); // Initial state
    },

    /**
     * Returns a list of custom context menu items for this node type.
     * @param {object} node - The node data object.
     * @param {GraphEditor} graphEditor - The instance of the main graph editor.
     * @param {object} contextData - Additional context, like the node's DOM element.
     * @returns {Array<object>} A list of context menu item definitions.
     */
    getContextMenuItems: function(node, graphEditor, contextData) {
        const nodeElement = contextData.nodeElement;
        if (!nodeElement) return [];

        const editor = nodeElement.querySelector('.markdown-editor');
        const isEditing = editor && editor.style.display !== 'none';

        const toggleEdit = () => {
            const toggleButton = nodeElement.querySelector('.markdown-toolbar button');
            if (toggleButton) {
                toggleButton.click();
            }
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
                        editor.value = '';
                        markdownContainer.innerHTML = marked.parse('');
                        graphEditor._saveStateForUndo('Clear Markdown Note');
                    }
                }
            }
        ];
    },

    /**
     * Optional hook that runs when a new node of this type is created.
     * @param {object} node - The node data object that has just been created.
     */
    onNodeCreated: function(node) {
        // You could, for example, set a unique default title
        // node.title = `Note - ${new Date().toLocaleTimeString()}`;
    }
};

// Add this node definition to a global array for the main editor to pick up.
window.nodeDefinitions = window.nodeDefinitions || [];
window.nodeDefinitions.push(MarkdownNode); 