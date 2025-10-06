#!/bin/bash

# ArticleDoc - Deployment Script
# Builds and packages the extension for distribution

set -e

echo "Building ArticleDoc Extension..."

# Build the extension
echo "Building extension package..."
web-ext build --overwrite-dest

# Check if build was successful
if [ -f "web-ext-artifacts/articledoc-0.1.0.zip" ]; then
    echo "Extension built successfully!"
    echo "Package location: web-ext-artifacts/articledoc-0.1.0.zip"
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
