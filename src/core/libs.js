/**
 * External Libraries Loader
 * Dynamically loads all external dependencies for NodeUI
 */

// Load Three.js Module Map immediately (must be before any module scripts)
function loadImportMap() {
    const importMapScript = document.createElement('script');
    importMapScript.type = 'importmap';
    importMapScript.textContent = JSON.stringify({
        imports: {
            "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
            "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
        }
    });
    document.head.appendChild(importMapScript);
}

// Lazy loading promises for libraries
let html2canvasPromise = null;
let dompurifyPromise = null;

// Lazy load html2canvas when needed
window.loadHtml2Canvas = function() {
    if (!html2canvasPromise) {
        html2canvasPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.onload = () => {
                console.log('html2canvas loaded successfully');
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    return html2canvasPromise;
};

// Lazy load DOMPurify when needed
window.loadDOMPurify = function() {
    if (!dompurifyPromise) {
        dompurifyPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js';
            script.onload = () => {
                console.log('DOMPurify loaded successfully');
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    return dompurifyPromise;
};

// Load minimal external resources
function loadExternalLibraries() {
    // Syntax Highlighting CSS (lightweight, non-blocking)
    const highlightCSS = document.createElement('link');
    highlightCSS.rel = 'stylesheet';
    highlightCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css';
    document.head.appendChild(highlightCSS);

    console.log('Minimal external resources loaded');
}

// Load import map immediately, then other libraries when DOM is ready
loadImportMap();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadExternalLibraries);
} else {
    loadExternalLibraries();
} 