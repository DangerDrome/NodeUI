#!/usr/bin/env node

/**
 * Gets the current version from git tags
 * Falls back to package version or 0.0.0 if no tags exist
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getVersionFromGit() {
  try {
    // Get the latest tag
    const latestTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
    
    // Get commit count since last tag
    const commitsSinceTag = execSync(`git rev-list ${latestTag}..HEAD --count`, { encoding: 'utf8' }).trim();
    
    // Get current commit hash (short)
    const commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    
    // Clean version (remove 'v' prefix if exists)
    let version = latestTag.replace(/^v/, '');
    
    // If there are commits since last tag, append dev info
    if (commitsSinceTag !== '0') {
      version = `${version}-dev.${commitsSinceTag}+${commitHash}`;
    }
    
    return version;
  } catch (error) {
    // No tags exist yet
    console.warn('No git tags found, using 0.0.0');
    return '0.0.0';
  }
}

// Get version
const version = getVersionFromGit();

// Update version.js with the version
const versionPath = path.join(__dirname, '..', 'src', 'core', 'version.js');
const versionContent = `/**
 * Version information for NodeUI
 * This file is automatically updated by git hooks
 */

window.NODE_UI_VERSION = '${version}';`;

fs.writeFileSync(versionPath, versionContent);
console.log(`Version updated to: ${version}`);

module.exports = { getVersionFromGit };