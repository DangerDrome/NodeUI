#!/usr/bin/env node

/**
 * Simple version update utility for NodeUI
 * Usage: node update-version.js [major|minor|patch] "Description of changes"
 */

const fs = require('fs');
const path = require('path');

const versionFile = path.join(__dirname, 'version.json');

// Read current version
let versionData;
try {
    versionData = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
} catch (err) {
    console.error('Error reading version.json:', err);
    process.exit(1);
}

// Parse command line arguments
const [,, bumpType, description] = process.argv;

if (!bumpType || !['major', 'minor', 'patch'].includes(bumpType)) {
    console.log('Usage: node update-version.js [major|minor|patch] "Description of changes"');
    process.exit(1);
}

// Parse current version
const [major, minor, patch] = versionData.version.split('.').map(Number);

// Calculate new version
let newVersion;
switch (bumpType) {
    case 'major':
        newVersion = `${major + 1}.0.0`;
        break;
    case 'minor':
        newVersion = `${major}.${minor + 1}.0`;
        break;
    case 'patch':
        newVersion = `${major}.${minor}.${patch + 1}`;
        break;
}

// Update version data
versionData.version = newVersion;
versionData.lastUpdated = new Date().toISOString().split('T')[0];

// Add new version to changes log
if (!versionData.changes[newVersion]) {
    versionData.changes[newVersion] = {
        date: versionData.lastUpdated,
        description: description || `${bumpType} version bump`,
        changes: []
    };
}

// Write updated version.json
fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2) + '\n');

console.log(`Version updated: ${versionData.version}`);
console.log(`Don't forget to add specific changes to version.json!`);