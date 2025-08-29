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
    
    // Clean version (remove 'v' prefix if exists)
    let version = latestTag.replace(/^v/, '');
    
    // Get commit count since last tag
    const commitsSinceTag = execSync(`git rev-list ${latestTag}..HEAD --count`, { encoding: 'utf8' }).trim();
    
    // If there are commits since last tag, increment patch version
    // Add 1 because pre-commit runs BEFORE the commit exists
    if (commitsSinceTag !== '0') {
      const parts = version.split('.');
      const patch = parseInt(parts[2] || '0') + parseInt(commitsSinceTag) + 1;
      version = `${parts[0]}.${parts[1]}.${patch}`;
    } else {
      // Even if no commits since tag, we're about to make one
      const parts = version.split('.');
      const patch = parseInt(parts[2] || '0') + 1;
      version = `${parts[0]}.${parts[1]}.${patch}`;
    }
    
    return version;
  } catch (error) {
    // No tags exist yet
    console.warn('No git tags found, using 1.0.0');
    return '1.0.0';
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