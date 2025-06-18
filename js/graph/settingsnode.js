/**
 * @fileoverview A specialized node for viewing and modifying application settings.
 */

class SettingsNode extends BaseNode {
    /**
     * @param {object} [options={}] - The options for the settings node.
     */
    constructor(options = {}) {
        const defaults = {
            title: 'Settings',
            type: 'SettingsNode',
            color: 'default',
            width: 450,
            height: 600,
        };
        super({ ...defaults, ...options });

        this.nodeUiSettings = {};
        this.cssVariables = [];
        this.settingsSubscription = null;
        this.fileInput = null; // To hold the file input element

        this.collectCssVariables();
    }

    /**
     * Overrides the default render method to add specific elements for settings.
     * @param {HTMLElement} parentElement - The parent element to append the node to.
     * @returns {HTMLElement} The created DOM element for the node.
     */
    render(parentElement) {
        super.render(parentElement);
        this.element.classList.add('settings-node');
        
        const icon = this.element.querySelector('.node-icon');
        if (icon) {
            icon.classList.remove('icon-box');
            icon.classList.add('icon-settings');
        }

        // Subscribe to settings updates from NodeUI
        if (this.settingsSubscription) {
            this.settingsSubscription.unsubscribe();
        }
        this.settingsSubscription = events.subscribe('settings:response', (settings) => {
            this.nodeUiSettings = settings;
            this.updateFormValues();
        });

        // Request current settings
        events.publish('settings:request');

        return this.element;
    }

    /**
     * Renders the content area with settings controls.
     * @param {HTMLElement} contentArea - The element to render content into.
     */
    renderContent(contentArea) {
        contentArea.innerHTML = ''; // Clear base content
        
        const wrapper = document.createElement('div');
        wrapper.className = 'settings-container-wrapper';

        const container = document.createElement('div');
        container.className = 'settings-container';
        
        container.appendChild(this.createGraphActionsSection());
        container.appendChild(this.createUISettingsSection());
        container.appendChild(this.createThemeSection());
        
        wrapper.appendChild(container);
        contentArea.appendChild(wrapper);

        this.addEventListeners();
    }

    /**
     * Creates the "Graph Actions" section with Save and Load buttons.
     * @returns {HTMLElement}
     */
    createGraphActionsSection() {
        const section = document.createElement('div');
        section.className = 'settings-section';
        section.innerHTML = '<h3>Graph</h3>';

        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'button-group';

        const saveButton = this.createButton('Save Graph', 'icon-download', 'save-graph-button');
        const loadButton = this.createButton('Load Graph', 'icon-upload', 'load-graph-button');
        
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = '.json';
        this.fileInput.style.display = 'none';

        buttonGroup.appendChild(saveButton);
        buttonGroup.appendChild(loadButton);
        section.appendChild(buttonGroup);
        section.appendChild(this.fileInput);
        
        return section;
    }

    /**
     * Creates the "UI Settings" section.
     * @returns {HTMLElement}
     */
    createUISettingsSection() {
        const section = document.createElement('div');
        section.className = 'settings-section';
        section.innerHTML = '<h3>UI Settings</h3>';

        section.appendChild(this.createToggle('snapToObjects', 'Snap to Objects'));
        section.appendChild(this.createToggle('snapToGrid', 'Snap to Grid'));
        section.appendChild(this.createSlider('snapThreshold', 'Snap Threshold', 1, 20, 1));
        section.appendChild(this.createSlider('shakeSensitivity', 'Shake Sensitivity', 1, 10, 0.5));

        return section;
    }

    /**
     * Creates the "Theme" section with CSS variable controls.
     * @returns {HTMLElement}
     */
    createThemeSection() {
        const section = document.createElement('div');
        section.className = 'settings-section';
        section.innerHTML = '<h3>Theme Colors</h3>';

        this.cssVariables.forEach(({ name, value }) => {
            if (name.startsWith('--color-')) {
                 section.appendChild(this.createColorPicker(name, this.formatVarName(name)));
            } else if (name.startsWith('--font-') || name.startsWith('--radius-')) {
                 section.appendChild(this.createTextInput(name, this.formatVarName(name)));
            }
        });

        return section;
    }

    /**
     * Adds event listeners to the controls.
     */
    addEventListeners() {
        // Graph Actions
        this.element.querySelector('#save-graph-button').addEventListener('click', () => {
            events.publish('graph:save');
        });

        this.element.querySelector('#load-graph-button').addEventListener('click', () => {
            this.fileInput.click();
        });

        this.fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    events.publish('graph:load-content', e.target.result);
                };
                reader.readAsText(file);
                // Reset file input to allow loading the same file again
                event.target.value = ''; 
            }
        });

        // UI Settings
        this.element.querySelector('#snapToObjects-toggle').addEventListener('change', (e) => {
            events.publish('snap:object-toggle', e.target.checked);
        });
        this.element.querySelector('#snapToGrid-toggle').addEventListener('change', (e) => {
            events.publish('snap:grid-toggle', e.target.checked);
        });
        this.element.querySelector('#snapThreshold-slider').addEventListener('input', (e) => {
            events.publish('setting:update', { key: 'snapThreshold', value: parseFloat(e.target.value) });
            this.updateSliderLabel('snapThreshold', e.target.value);
        });
        this.element.querySelector('#shakeSensitivity-slider').addEventListener('input', (e) => {
            events.publish('setting:update', { key: 'shakeSensitivity', value: parseFloat(e.target.value) });
            this.updateSliderLabel('shakeSensitivity', e.target.value);
        });

        // Theme
        this.cssVariables.forEach(({ name }) => {
            const input = this.element.querySelector(`[data-variable="${name}"]`);
            if (input) {
                input.addEventListener('input', (e) => {
                    document.documentElement.style.setProperty(name, e.target.value);
                });
            }
        });
    }

    /**
     * Updates the form input values based on the received settings.
     */
    updateFormValues() {
        if (!this.element) return;

        // UI Settings
        this.element.querySelector('#snapToObjects-toggle').checked = this.nodeUiSettings.snapToObjects;
        this.element.querySelector('#snapToGrid-toggle').checked = this.nodeUiSettings.snapToGrid > 0;
        this.element.querySelector('#snapThreshold-slider').value = this.nodeUiSettings.snapThreshold;
        this.element.querySelector('#shakeSensitivity-slider').value = this.nodeUiSettings.shakeSensitivity;
        
        this.updateSliderLabel('snapThreshold', this.nodeUiSettings.snapThreshold);
        this.updateSliderLabel('shakeSensitivity', this.nodeUiSettings.shakeSensitivity);
    }

    /**
     * Helper to create a toggle switch.
     * @param {string} id - The base ID for the control.
     * @param {string} label - The text label.
     * @returns {HTMLElement}
     */
    createToggle(id, label) {
        const row = document.createElement('div');
        row.className = 'setting-row';
        row.innerHTML = `
            <label for="${id}-toggle">${label}</label>
            <label class="switch">
                <input type="checkbox" id="${id}-toggle">
                <span class="slider round"></span>
            </label>
        `;
        return row;
    }

    /**
     * Helper to create a range slider.
     * @param {string} id - The base ID for the control.
     * @param {string} label - The text label.
     * @param {number} min - The minimum value.
     * @param {number} max - The maximum value.
     * @param {number} step - The step value.
     * @returns {HTMLElement}
     */
    createSlider(id, label, min, max, step) {
        const row = document.createElement('div');
        row.className = 'setting-row';
        row.innerHTML = `
            <label for="${id}-slider">${label}</label>
            <div class="slider-container">
                <input type="range" id="${id}-slider" min="${min}" max="${max}" step="${step}">
                <span id="${id}-label" class="slider-label"></span>
            </div>
        `;
        return row;
    }
    
    /**
     * Helper to create a color picker.
     * @param {string} varName - The CSS variable name.
     * @param {string} label - The text label.
     * @returns {HTMLElement}
     */
    createColorPicker(varName, label) {
        const row = document.createElement('div');
        row.className = 'setting-row';
        const initialValue = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
        row.innerHTML = `
            <label for="${varName}-color">${label}</label>
            <input type="color" id="${varName}-color" data-variable="${varName}" value="${initialValue}">
        `;
        return row;
    }
    
    /**
     * Helper to create a text input.
     * @param {string} varName - The CSS variable name.
     * @param {string} label - The text label.
     * @returns {HTMLElement}
     */
    createTextInput(varName, label) {
        const row = document.createElement('div');
        row.className = 'setting-row';
        const initialValue = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
        row.innerHTML = `
            <label for="${varName}-input">${label}</label>
            <input type="text" id="${varName}-input" class="settings-input" data-variable="${varName}" value="${initialValue}">
        `;
        return row;
    }

    /**
     * Helper to create a styled button.
     * @param {string} text - The button text.
     * @param {string} iconClass - The class for the icon.
     * @param {string} id - The button's ID.
     * @returns {HTMLButtonElement}
     */
    createButton(text, iconClass, id) {
        const button = document.createElement('button');
        button.id = id;
        button.className = 'settings-button';
        button.innerHTML = `<span class="${iconClass}"></span> ${text}`;
        return button;
    }

    /**
     * Formats a CSS variable name into a readable label.
     * e.g., "--color-bg-default" -> "Color Bg Default"
     * @param {string} varName
     * @returns {string}
     */
    formatVarName(varName) {
        return varName
            .replace('--', '')
            .replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * Updates the label for a range slider.
     * @param {string} id
     * @param {string} value
     */
    updateSliderLabel(id, value) {
        const label = this.element.querySelector(`#${id}-label`);
        if (label) {
            label.textContent = value;
        }
    }

    /**
     * Scans all stylesheets to collect root CSS variables.
     */
    collectCssVariables() {
        this.cssVariables = [];
        try {
            for (const sheet of document.styleSheets) {
                // Check if the sheet is accessible
                if (sheet.href && sheet.href.startsWith(window.location.origin)) {
                    for (const rule of sheet.cssRules) {
                        if (rule.type === CSSRule.STYLE_RULE && rule.selectorText === ':root') {
                            for (const style of rule.style) {
                                if (style.startsWith('--')) {
                                    this.cssVariables.push({
                                        name: style,
                                        value: rule.style.getPropertyValue(style).trim()
                                    });
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.warn("Could not access stylesheets to collect CSS variables.", e);
        }
    }

    /**
     * Cleans up subscriptions when the node is removed.
     */
    destroy() {
        if (this.settingsSubscription) {
            this.settingsSubscription.unsubscribe();
            this.settingsSubscription = null;
        }
    }
} 