<div align="center">

<h1>Firefox Extension: ArticleDoc</h1>

<p align="center">
  <a href="https://addons.mozilla.org/en-GB/android/addon/articledoc/">
    <img src="icons/icon-128.png" alt="ArticleDoc icon" width="96" height="96">
  </a>
  <br/>
  <em>Transform articles into clean, readable PDFs</em>
</p>

[![Firefox Extension](https://img.shields.io/badge/Firefox-Extension-orange.svg)](https://addons.mozilla.org/en-US/firefox/addon/articledoc/) ![Medium](https://img.shields.io/badge/Medium-12100E) [![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](https://github.com/MR901/articledoc)


</div>

<br>

**ArticleDoc** - A Firefox extension that converts Medium articles into clean, formatted PDFs with selectable text and preserved images.

## Features

- **Clean Extraction** - Removes ads, footers, and clutter, keeping only essential content
- **Image Preservation** - Includes images from articles for reliable PDF embedding
- **Smart Pagination** - Automatically formats long articles for clean A4 page layouts
- **Selectable Text** - Generated PDFs contain searchable, selectable text
- **Offline Ready** - Works completely offline after installation
- **Medium Focused** - Optimized specifically for Medium articles and their layout

## Quick Start

### One-Click Install
[Install from Firefox browser add-on store](https://addons.mozilla.org/en-GB/android/addon/articledoc/)

### Direct Download

- **Download**: [`web-ext-artifacts/articledoc-<version>.zip`](web-ext-artifacts/articledoc-<version>.zip)
- **Distribution Page**: [distribution.html](distribution.html)


### Installation (Temporary Add-on)

1. **Clone & Build**:
   ```bash
   # Clone or download the project
   git clone https://github.com/MR901/articledoc.git
   cd articledoc

   # Build the extension
   make build
   ```

2. **Install in Firefox**:
   - Open Firefox and navigate to `about:debugging`
   - Click "This Firefox" in the left sidebar
   - Click "Load Temporary Add-on..."
   - Select the built extension: `web-ext-artifacts/articledoc-<version>.zip`
     
3. **Start Using**:
   - The ArticleDoc icon will appear in your Firefox toolbar
   - Navigate to any Medium article
   - Click the extension icon and select "Generate Clean PDF"


## Project Structure

```
articledoc/
├── manifest.json          # Extension configuration (MV2 for Firefox)
├── Makefile              # Build system and development commands
├── popup.html            # Extension popup interface
├── popup.js              # PDF generation logic using jsPDF
├── content.js            # Article extraction and content scraping
├── background.js         # Minimal background script (MV2)
├── distribution.html     # Landing page for distribution
├── libs/                 # Global helper modules and third-party libraries
│   ├── jspdf.umd.min.js  # Bundled jsPDF library for offline use
│   ├── *.global.js       # Global helper modules (logger, messaging, PDF, etc.)
│   └── types.shared.js   # Shared TypeScript definitions
├── icons/                # Extension icons (48x48, 128x128)
│   ├── icon-48.png
│   └── icon-128.png
├── docs/                 # Documentation files
│   ├── ARCHITECTURE.md   # System architecture overview
│   ├── feature-flags.md  # Feature flag documentation
│   ├── providers.md      # Provider system documentation
│   └── testing.md        # Testing guidelines
└── web-ext-artifacts/    # Built extension packages
    └── articledoc-<version>.zip
```

## Technical Details

### How It Works

1. **Content Extraction**: When you click the extension icon on a Medium article, `content.js` analyzes the page DOM
2. **Smart Cleaning**: Removes ads, navigation, footers, and other non-content elements
3. **Image Processing**: Downloads and converts images to canvas for CORS compliance
4. **PDF Generation**: Uses jsPDF to create properly formatted A4 pages with:
   - Extracted text content with proper typography
   - Images embedded at appropriate sizes
   - Automatic pagination for long articles
   - Selectable, searchable text output



### Feature Flags (advanced)

You can toggle optional features at runtime for experimentation: ([feature-flags documentation](docs/feature-flags.md))

```js
// In popup DevTools console or content page console (depending on feature)
window.__ArticleDocFeatures.enableOutlineAndTOC = true;      // Adds a TOC page using captured headings
window.__ArticleDocFeatures.enableReferencesSection = true;  // Appends a \"References\" block (if mentions exist)
window.__ArticleDocFeatures.enableRelatedMentions = true;    // Appends \"Other mentions by author\" (provider hints)
```

Notes:
- References/Related are built in the content script from available data and provider hints.
- TOC is rendered in the popup during PDF generation.

- **MV3 Compliance**: Built for Manifest V3 with modern Firefox extension standards
- **Offline-First**: Dependencies are bundled or lazy-loaded within the extension
- **Memory Efficient**: Processes content in chunks to handle large articles
- **Error Resilient**: Graceful handling of missing elements and failed image loads

### Permissions Explained

| Permission | Purpose |
|------------|---------|
| `activeTab` | Read current tab content for article extraction |
| `downloads` | Save generated PDF files to your downloads folder |
| `tabs` | Query tab information for proper extension context |
| `host_permissions` | Access Medium domains and image CDN for content |

## Development

### Prerequisites

- **Node.js** (for web-ext)
- **Firefox** (for testing)
- **Make** (optional, for build automation)

### Development Setup

1. **Clone** the repository:
   ```bash
   git clone https://github.com/MR901/articledoc.git
   cd articledoc
   ```

2. **Install dependencies**:
   ```bash
   npm install -g web-ext
   ```

3. **Make changes** and test:
   ```bash
   make build
   # Load in Firefox for testing
   ```

### Development Commands

| Command | Description |
|---------|-------------|
| `make help` | Show all available commands |
| `make build` | Build the extension package |
| `make clean` | Remove build artifacts |
| `make install` | Build and install in Firefox for testing |
| `make serve` | Serve distribution page locally |
| `make test` | Run minimal tests (Node-based) |
| `make lint` | Run basic linting (requires eslint) |
| `make info` | Show project information |
| `make check-deps` | Check if required tools are installed |
| `make version-bump` | Update version number in manifest.json |
| `make release` | Build and create GitHub release |
| `make release-notes` | Show release notes template |
| `make source-zip` | Package source for AMO submission |
| `make sign` | Sign extension with AMO (interactive) |

### Building from Source

Install dependencies

```bash
npm install -g web-ext
```

**Option 1: Using Make (Recommended)**
```bash
# Build the extension
make build

# Output: web-ext-artifacts/articledoc-<version>.zip
```

**Option 2: Using web-ext directly**
```bash
# Build the extension
web-ext build --overwrite-dest
```

### Testing & Debugging

1. **Load Temporary Add-on**:
   ```bash
   # Build first, then:
   # 1. Open Firefox → about:debugging
   # 2. Click "This Firefox" → "Load Temporary Add-on"
   # 3. Select manifest.json or built .zip file
   ```

2. **Debug Console**:
   - Open extension popup → Right-click → "Inspect"
   - Check browser console for errors
   - Network tab shows image loading issues

### Code Organization

- **`content.js`**: Article extraction, DOM parsing, content cleaning
- **`popup.js`**: PDF generation, layout, download triggering (lazy-loads jsPDF)
- **`popup.html`**: Simple UI with single action button
- **`manifest.json`**: Extension metadata, permissions, file mappings

### Publishing to Firefox Add-ons (AMO)

AMO ('addons.mozilla.org' — the Firefox Add-ons site) submission steps:

1. Visit the Firefox Add-ons Developer Hub: [Firefox Add-ons Developer Hub](https://addons.mozilla.org/en-US/developers/addons) (AMO Developer Hub)
2. Click "Submit a New Add-on" and choose your channel:
   - Listed (public listing on AMO)
   - Unlisted (self-distribution; signed XPI for manual install)
3. Upload your built package:
   - Build it first: `make build`
   - Upload: `web-ext-artifacts/articledoc-<version>.zip`
4. License choice (private code)
   - If you want it private, choose "All Rights Reserved" in AMO’s license selector.
   - Keep third-party licenses (e.g., jsPDF MIT) in your source archive.
5. Upload source code (required when minified/processed files are included)
   - Create source archive: `make source-zip`
   - Upload the generated file: `web-ext-artifacts/articledoc-source-<version>.zip`
   - This includes `SOURCE_SUBMISSION.md` with environment and exact build steps.
6. Reviewer notes (paste a brief summary)
   ```text
   All first-party code is plain JS/HTML and human-readable.
   Third-party: libs/jspdf.umd.min.js is the official jsPDF UMD build, unmodified (MIT).
   Build steps: Node >=18, install web-ext, then `web-ext build --overwrite-dest`.
   Source archive includes SOURCE_SUBMISSION.md with reproduction details.
   ```
7. IDs and updates
   - Listed: omit `browser_specific_settings.gecko.id` and AMO will assign one.
   - Unlisted: keep a stable `gecko.id` (email-like or GUID) for updates.
8. After review
   - Listed: copy your AMO listing URL and share it.
   - Unlisted: download the signed XPI provided by AMO for distribution.
9. After approval
   - Your add-on will have an AMO listing URL and automatic update hosting.
   - Future uploads with the same `gecko.id` will version-increment and update users.


### Quick Start with GitHub Releases

#### 1. **Prerequisites**
```bash
# Install GitHub CLI (one-time setup)
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update && sudo apt install gh

# Authenticate with GitHub
gh auth login

# Set up token for automation
export GITHUB_TOKEN=your_personal_access_token_here
```

#### 2. **Create and push a Git tag**
```bash
# If the repository has moved/been renamed, update origin
git remote set-url origin git@github.com:MR901/articledoc.git

# Create an annotated tag from version in manifest.json
VERSION=$(sed -n 's/.*"version": *"\([^"\n]*\)".*/\1/p' manifest.json)
git tag -a "v$VERSION" -m "Release v$VERSION"

# Push just this tag
git push origin "v$VERSION"

# Or push all tags
git push origin --tags
```

#### 3. **Create a Release**
```bash
# Build and release automatically
make release

# Or create manually:
make release-notes  # Shows template
gh release create v0.2.0 \
  --title "ArticleDoc v0.2.0" \
  --notes "Your release notes here" \
  web-ext-artifacts/articledoc-0.2.0.zip
```

#### 4. **Share Your Release**
Once created, you'll get a permanent link like:
```
https://github.com/MR901/articledoc/releases/tag/v0.2.0
```

Users can download from there, and you can link to it in your documentation.

### Release Workflow

#### For New Versions:
1. **Update Version**: `make version-bump` (updates manifest.json)
2. **Build Extension**: `make build` (creates new ZIP)
3. **Create Release**: `make release` (uploads to GitHub)
4. **Share**: Update links in README and distribution page

#### Release Notes Template:
```markdown
# ArticleDoc v0.2.0

## What's New

- New feature description
- Bug fixes and improvements
- Updated documentation

## Installation

1. Download: `articledoc-0.2.0.zip`
2. Install in Firefox via `about:debugging`
3. Load the downloaded ZIP file as a temporary add-on

## Files

- `articledoc-0.2.0.zip` - Firefox extension package

---
*For more information, see the [README](README.md)*
```

### Integration with Your Build System

The `Makefile` includes automated release creation:
- **`make release`**: Builds and creates GitHub release automatically
- **`make release-notes`**: Shows template for manual releases
- **Version Detection**: Automatically uses version from manifest.json
- **Error Handling**: Checks for required tools and tokens

## Troubleshooting

1. **Check the console**: Open popup → Right-click → "Inspect" → Console tab
2. **Network tab**: Monitor for failed image loads or API calls
3. **Browser console**: Main Firefox console may show extension errors

## Changelog

### [0.1.0] - 2025-10-07
- **Initial Release**
- Medium article PDF extraction
- Image preservation and embedding
- Smart pagination and A4 formatting
- Selectable, searchable text output
- Offline functionality
- Complete build system with Makefile

### [0.1.1] - 2025-10-08
- AMO support with minor fixes.

### [0.2.0] - 2025-10-10
- **Major Architectural Refactoring**: Complete modularization with global helper modules
- **Enhanced Provider System**: Provider-based architecture for easy extensibility to new sites
- **Improved Code Organization**: Split large files into smaller, maintainable modules with single responsibility
- **Global Helper Modules**: Added comprehensive helper modules in `libs/` directory (logger, messaging, PDF, TOC, UI, etc.)
- **Better Documentation**: Added comprehensive documentation in `docs/` directory covering architecture, features, providers, and testing
- **Shared Types and Configuration**: Added `src/shared/` directory with common types and configuration
- **Test Infrastructure**: Added test files and testing framework setup
- **Improved Maintainability**: Enhanced error handling, logging, and code organization for easier maintenance
- **Build System Improvements**: Better development workflow with enhanced Makefile commands

## Links & Resources

- **Firefox Add-ons (AMO) listing**: [ArticleDoc on AMO](https://addons.mozilla.org/en-US/firefox/addon/articledoc/)
- **NPM**: [web-ext](https://www.npmjs.com/package/web-ext) - Build tool
- **jsPDF**: [jspdf](https://parall.ax/products/jspdf) - PDF generation library
- **Releases**: [GitHub Releases](https://github.com/MR901/articledoc/releases) - Download stable versions


