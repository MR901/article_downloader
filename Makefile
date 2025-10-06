# ArticleDoc - Browser Extension Makefile
# Build, test, and manage the ArticleDoc Firefox extension

.PHONY: help build package clean install serve test lint version-bump release release-notes

# Default target
help: ## Show this help message
	@echo "ArticleDoc - Firefox Extension Build System"
	@echo ""
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# Build the extension package
build: ## Build the extension package using web-ext
	@echo "Building ArticleDoc Extension..."
	@echo "Creating extension package..."
	@command -v web-ext >/dev/null 2>&1 || { echo "web-ext is not installed. Run: npm install -g web-ext"; exit 1; }
	@web-ext build --overwrite-dest
	@if [ -f "web-ext-artifacts/articledoc-0.1.0.zip" ]; then \
		echo "Extension built successfully!"; \
		echo "Package location: web-ext-artifacts/articledoc-0.1.0.zip"; \
		echo ""; \
		echo "Distribution page: distribution.html"; \
		echo "README: README.md"; \
		echo ""; \
		echo "Ready for distribution!"; \
		echo "   - Share the distribution.html page with users"; \
		echo "   - Or upload the ZIP file to GitHub Releases"; \
		echo "   - Users can install via about:debugging in Firefox"; \
	else \
		echo "Build failed!"; \
		exit 1; \
	fi

# Alias for build
package: build ## Alias for build target

# Clean build artifacts
clean: ## Remove build artifacts and temporary files
	@echo "Cleaning build artifacts..."
	@rm -rf web-ext-artifacts/*.zip
	@echo "Build artifacts cleaned"

# Install extension in Firefox for testing
install: build ## Build and install extension in Firefox (requires Firefox to be running)
	@echo "Installing extension in Firefox..."
	@if [ -f "web-ext-artifacts/articledoc-0.1.0.zip" ]; then \
		web-ext run --source-dir=. --firefox-profile=dev-edition-default; \
	else \
		echo "No built extension found. Run 'make build' first."; \
		exit 1; \
	fi

# Serve distribution page locally
serve: ## Serve the distribution page locally for testing
	@echo "Serving distribution page locally..."
	@echo "Open http://localhost:8000/distribution.html in your browser"
	@cd web-ext-artifacts && python3 -m http.server 8000 &
	@echo "Server started (PID: $$!). Press Ctrl+C to stop"

# Basic linting (if you have eslint or similar tools)
lint: ## Run basic linting (requires eslint to be installed)
	@echo "Running lint checks..."
	@if command -v eslint >/dev/null 2>&1; then \
		eslint popup.js content.js background.js; \
	else \
		echo "eslint not installed. Install with: npm install -g eslint"; \
	fi

# Version management
version-bump: ## Bump version number in manifest.json and related files
	@echo "Current version: $$(grep '"version"' manifest.json | cut -d'"' -f4)"
	@read -p "Enter new version: " new_version; \
	sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$$new_version\"/" manifest.json; \
	echo "Version updated to $$new_version"

# GitHub release management
release: build ## Create a GitHub release (requires GITHUB_TOKEN and gh CLI)
	@echo "Creating GitHub release..."
	@if [ -z "$$GITHUB_TOKEN" ]; then \
		echo "GITHUB_TOKEN environment variable not set"; \
		echo "   Get your token from: https://github.com/settings/tokens"; \
		echo "   Set it with: export GITHUB_TOKEN=your_token_here"; \
		exit 1; \
	fi
	@if ! command -v gh >/dev/null 2>&1; then \
		echo "GitHub CLI (gh) not installed"; \
		echo "   Install from: https://cli.github.com/"; \
		exit 1; \
	fi
	@VERSION=$$(grep '"version"' manifest.json | cut -d'"' -f4); \
	echo "Creating release for v$$VERSION..."; \
	gh release create v$$VERSION \
		--title "ArticleDoc v$$VERSION" \
		--generate-notes \
		web-ext-artifacts/articledoc-$$VERSION.zip || { \
		echo "Failed to create release. You may need to:"; \
		echo "   1. Create the release manually with: make release-notes"; \
		echo "   2. Then upload the file manually via GitHub web interface"; \
		exit 1; \
	}
	@echo "GitHub release v$$VERSION created successfully!"

release-notes: ## Show release notes template for manual creation
	@echo "Release Notes Template for ArticleDoc:"
	@echo ""
	@VERSION=$$(grep '"version"' manifest.json | cut -d'"' -f4); \
	echo "# ArticleDoc v$$VERSION"; \
	echo ""; \
	echo "## What's New"; \
	echo ""; \
	echo "[Describe the key changes and improvements in this version]"; \
	echo ""; \
	echo "## Installation"; \
	echo ""; \
	echo "1. Download: articledoc-$$VERSION.zip"; \
	echo "2. Install in Firefox via about:debugging"; \
	echo "3. Load the downloaded ZIP file as a temporary add-on"; \
	echo ""; \
	echo "## Files"; \
	echo ""; \
	echo "- articledoc-$$VERSION.zip - Firefox extension package"; \
	echo ""; \
	echo "## Checksums"; \
	echo ""; \
	echo "\`\`\`bash"; \
	echo "# Verify file integrity (optional)"; \
	echo "md5sum articledoc-$$VERSION.zip"; \
	echo "sha256sum articledoc-$$VERSION.zip"; \
	echo "\`\`\` "; \
	echo ""; \
	echo "---"; \
	echo "*For more information, see the [README](README.md)*"

# Show project info
info: ## Show project information
	@echo "ArticleDoc Extension Info"
	@echo "=========================="
	@echo "Name: $$(grep '"name"' manifest.json | cut -d'"' -f4)"
	@echo "Version: $$(grep '"version"' manifest.json | cut -d'"' -f4)"
	@echo "Description: $$(grep '"description"' manifest.json | cut -d'"' -f4)"
	@echo ""
	@echo "Project structure:"
	@find . -name "*.json" -o -name "*.js" -o -name "*.html" | grep -v node_modules | sort

# Check dependencies
check-deps: ## Check if required tools are installed
	@echo "Checking dependencies..."
	@echo -n "web-ext: "
	@command -v web-ext >/dev/null 2>&1 && echo "Installed" || echo "Not installed (npm install -g web-ext)"
	@echo -n "Python3: "
	@command -v python3 >/dev/null 2>&1 && echo "Installed" || echo "Not installed"

# Default target when just running 'make'
.DEFAULT_GOAL := help
