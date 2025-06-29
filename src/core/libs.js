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

// Load other external libraries
function loadExternalLibraries() {
    // Icon Library
    const lucideScript = document.createElement('script');
    lucideScript.src = 'https://unpkg.com/lucide@latest';
    document.head.appendChild(lucideScript);

    // Utility Libraries
    const html2canvasScript = document.createElement('script');
    html2canvasScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    document.head.appendChild(html2canvasScript);

    const dompurifyScript = document.createElement('script');
    dompurifyScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js';
    document.head.appendChild(dompurifyScript);

    // Syntax Highlighting CSS
    const highlightCSS = document.createElement('link');
    highlightCSS.rel = 'stylesheet';
    highlightCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css';
    document.head.appendChild(highlightCSS);

    console.log('External libraries loaded successfully');
}

// Load import map immediately, then other libraries when DOM is ready
loadImportMap();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadExternalLibraries);
} else {
    loadExternalLibraries();
} 