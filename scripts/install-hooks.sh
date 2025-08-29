#!/bin/bash

# Install git hooks for auto-versioning

echo "Installing git hooks..."

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

# Create pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

# Update version in index.html before each commit
echo "Updating version..."
node scripts/get-version.js

# Stage the updated version.js
git add src/core/version.js

exit 0
EOF

# Make hook executable
chmod +x .git/hooks/pre-commit

echo "Git hooks installed successfully!"
echo "Version will now auto-update on each commit."