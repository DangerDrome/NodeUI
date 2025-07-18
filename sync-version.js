#!/usr/bin/env node

/**
 * Syncs version data from version.json to index.html
 * This is needed because file:// protocol can't fetch JSON files
 */

const fs = require('fs');
const path = require('path');

const versionFile = path.join(__dirname, 'version.json');
const indexFile = path.join(__dirname, 'index.html');

// Read version data
const versionData = JSON.parse(fs.readFileSync(versionFile, 'utf8'));

// Read index.html
let indexContent = fs.readFileSync(indexFile, 'utf8');

// Create the new version script content
const versionScript = `    <!-- Version Management -->
    <script>
        // Embedded version information (updated from version.json)
        window.NODE_UI_VERSION = '${versionData.version}';
        window.NODE_UI_VERSION_DATA = ${JSON.stringify(versionData, null, 12).split('\n').map((line, i) => i === 0 ? line : '        ' + line).join('\n')};
        console.log(\`NodeUI v\${window.NODE_UI_VERSION}\`);
    </script>`;

// Replace the version script in index.html
indexContent = indexContent.replace(
    /<!-- Version Management -->[\s\S]*?<\/script>/,
    versionScript
);

// Write updated index.html
fs.writeFileSync(indexFile, indexContent);

console.log(`Version ${versionData.version} synced to index.html`);
console.log('Run this script after updating version.json');