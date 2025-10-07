#!/bin/bash

# ArticleDoc - Deployment Script
# Builds and packages the extension for distribution

set -e

echo "Building ArticleDoc Extension..."

# Build the extension
echo "Building extension package..."
web-ext build --overwrite-dest

# Check if build was successful (dynamic artifact name)
VERSION=$(grep '"version"' manifest.json | cut -d '"' -f4)
NAME=$(grep '"name"' manifest.json | cut -d '"' -f4 | tr ' ' '-' | tr '[:upper:]' '[:lower:]')
ARTIFACT="web-ext-artifacts/${NAME}-${VERSION}.zip"

if [ -f "$ARTIFACT" ]; then
    echo "Extension built successfully!"
    echo "Package location: $ARTIFACT"
    echo ""
    echo "Distribution page: distribution.html"
    echo "README: README.md"
    echo ""
    echo "Ready for distribution!"
    echo "   - Share the distribution.html page with users"
    echo "   - Or upload the ZIP file to GitHub Releases"
    echo "   - Users can install via about:debugging in Firefox"
else
    echo "Build failed!"
    exit 1
fi
