# NodeUI Scripts

## Version Management

NodeUI uses git tags for versioning. The version is automatically updated in `index.html` before each commit.

### How it works:
1. Git pre-commit hook runs `get-version.js`
2. Script reads the latest git tag (e.g., `v1.2.0`)
3. If there are commits since the tag, it appends dev info (e.g., `v1.2.0-dev.3+abc123`)
4. Updates `window.NODE_UI_VERSION` in index.html
5. Version appears in bottom-right corner of the app

### Setup:
```bash
# Install git hooks (one time only)
./scripts/install-hooks.sh
```

### Creating a new release:
```bash
# Tag a new version
git tag -a v1.2.0 -m "Release v1.2.0: Add awesome feature"
git push --tags

# The version will automatically update to v1.2.0 on next commit
```

### Manual version update:
```bash
node scripts/get-version.js
```