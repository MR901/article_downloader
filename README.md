# ArticleDoc

<p align="center">
  <img src="icons/icon-128.png" alt="ArticleDoc icon" width="96" height="96">
  <br/>
  <em>Transform articles into clean, readable PDFs</em>
</p>

[![Version](https://img.shields.io/badge/version-0.1.1-blue.svg)](https://github.com/MR901/articledoc)
[![Firefox Extension](https://img.shields.io/badge/Firefox-Extension-orange.svg)](https://addons.mozilla.org/en-US/firefox/addon/articledoc/)

> **ArticleDoc** - A Firefox extension that converts Medium articles into clean, formatted PDFs with selectable text and preserved images.

## Features

- **Clean Extraction** - Removes ads, footers, and clutter, keeping only essential content
- **Image Preservation** - Includes images from articles for reliable PDF embedding
- **Smart Pagination** - Automatically formats long articles for clean A4 page layouts
- **Selectable Text** - Generated PDFs contain searchable, selectable text
- **Offline Ready** - Works completely offline after installation
- **Medium Focused** - Optimized specifically for Medium articles and their layout

## Quick Start

### Installation (Temporary Add-on)

1. **Download & Build**:
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
   - Select the built extension: `web-ext-artifacts/articledoc-0.1.1.zip`

3. **Start Using**:
   - The ArticleDoc icon will appear in your Firefox toolbar
   - Navigate to any Medium article
   - Click the extension icon and select "Generate Clean PDF"

### One-Click Install (Coming Soon)
*Official Firefox Add-ons submission in progress for permanent installation.*

### Publishing to Firefox Add-ons (AMO)

AMO stands for 'addons.mozilla.org' — the Firefox Add-ons site.

1. Prerequisites
   - Create an AMO developer account and generate API keys: `addons.mozilla.org` → Developer Hub → Credentials.
   - Export credentials in your shell:
     ```bash
     export AMO_JWT_ISSUER=your_amo_api_key
     export AMO_JWT_SECRET=your_amo_api_secret
     ```
   - Ensure `manifest.json` includes Firefox fields:
     - `browser_specific_settings.gecko.id` (temporary ID for first upload; AMO may assign an ID)
     - `strict_min_version`
     - `homepage_url`

2. Sign for self-distribution (unlisted)
   ```bash
   # Builds and requests signing; outputs a signed .xpi
   make sign-unlisted
   ```

3. Submit for listing (public AMO page)
   ```bash
   # Triggers AMO listed-channel submission and review
   make sign-listed
   ```

4. After approval
   - Your add-on will have an AMO listing URL and automatic update hosting.
   - Future uploads with the same `gecko.id` will version-increment and update users.

#### Detailed AMO submission steps (with links)

1. Visit the Firefox Add-ons Developer Hub: [Firefox Add-ons Developer Hub](https://addons.mozilla.org/en-US/developers/addons) (AMO Developer Hub)
2. Click "Submit a New Add-on" and choose your channel:
   - Listed (public listing on AMO)
   - Unlisted (self-distribution; signed XPI for manual install)
3. Upload your built package:
   - Build it first: `make build`
   - Upload: `web-ext-artifacts/articledoc-0.1.1.zip`
4. License choice (private code)
   - If you want it private, choose "All Rights Reserved" in AMO’s license selector.
   - Keep third-party licenses (e.g., jsPDF MIT) in your source archive.
5. Upload source code (required when minified/processed files are included)
   - Create source archive: `make source-zip`
   - Upload the generated file: `web-ext-artifacts/articledoc-source-0.1.1.zip`
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

## 📁 Project Structure

```
articledoc/
├── manifest.json          # Extension configuration (MV2 for Firefox)
├── Makefile              # Build system and development commands
├── popup.html            # Extension popup interface
├── popup.js              # PDF generation logic using jsPDF
├── content.js            # Article extraction and content scraping
├── background.js         # Minimal background script (MV2)
├── distribution.html     # Landing page for distribution
├── deploy.sh             # Alternative build script
├── libs/
│   └── jspdf.umd.min.js  # Bundled jsPDF library for offline use
├── icons/                # Extension icons (48x48, 128x128)
│   ├── icon-48.png
│   └── icon-128.png
└── web-ext-artifacts/    # Built extension packages
    └── articledoc-0.1.1.zip
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

### Architecture

- **MV3 Compliance**: Built for Manifest V3 with modern Firefox extension standards
- **Offline-First**: All dependencies bundled - works without internet after installation
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

### Development Commands

| Command | Description |
|---------|-------------|
| `make help` | Show all available commands |
| `make build` | Build the extension package |
| `make clean` | Remove build artifacts |
| `make install` | Build and install in Firefox for testing |
| `make serve` | Serve distribution page locally |
| `make info` | Show project information |
| `make check-deps` | Check if required tools are installed |
| `make version-bump` | Update version number in manifest.json |
| `make release` | Build and create GitHub release |
| `make release-notes` | Show release notes template |

### Building from Source

**Option 1: Using Make (Recommended)**
```bash
# Install dependencies (one-time)
npm install -g web-ext

# Build the extension
make build

# Output: web-ext-artifacts/articledoc-0.1.1.zip
```

**Option 2: Using web-ext directly**
```bash
# Install web-ext globally
npm install -g web-ext

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
- **`popup.js`**: PDF generation, layout, download triggering
- **`popup.html`**: Simple UI with single action button
- **`manifest.json`**: Extension metadata, permissions, file mappings

## Installation & Distribution

### Option 1: Development Build (Temporary)

For developers and testing:

1. **Clone & Build**:
   ```bash
   git clone https://github.com/MR901/articledoc.git
   cd articledoc
   make build
   ```

2. **Install Temporarily**:
   - Open Firefox → `about:debugging`
   - Click "This Firefox" → "Load Temporary Add-on"
   - Select `web-ext-artifacts/articledoc-0.1.1.zip`

### Option 2: Direct Download

- **Download**: [`web-ext-artifacts/articledoc-0.1.1.zip`](web-ext-artifacts/articledoc-0.1.1.zip)
- **Distribution Page**: [distribution.html](distribution.html)

### Option 3: One-Click Install (Coming Soon)
*Official submission to [Firefox Add-ons](https://addons.mozilla.org) in progress for permanent installation with automatic updates.*

## GitHub Releases

### What are GitHub Releases?

GitHub Releases provide a professional way to distribute your software with:
- **Organized Downloads**: Each release contains your built extension package
- **Release Notes**: Detailed changelog and installation instructions
- **Version Tagging**: Proper semantic versioning with git tags
- **Permanent Links**: Stable URLs for sharing and automation
- **Download Analytics**: Track how many people download your releases

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
gh release create v0.1.1 \
  --title "ArticleDoc v0.1.1" \
  --notes "Your release notes here" \
  web-ext-artifacts/articledoc-0.1.1.zip
```

#### 4. **Share Your Release**
Once created, you'll get a permanent link like:
```
https://github.com/MR901/articledoc/releases/tag/v0.1.1
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
# ArticleDoc v0.1.1

## What's New

- New feature description
- Bug fixes and improvements
- Updated documentation

## Installation

1. Download: `articledoc-0.1.1.zip`
2. Install in Firefox via `about:debugging`
3. Load the downloaded ZIP file as a temporary add-on

## Files

- `articledoc-0.1.1.zip` - Firefox extension package

---
*For more information, see the [README](README.md)*
```

### Benefits for Your Project

- **Stable URLs**: Releases never change, perfect for documentation
- **Version History**: Clear progression of your project
- **User Trust**: Professional presentation builds confidence
- **Automation Ready**: Can be integrated into CI/CD pipelines
- **Analytics**: See download counts and trends

### Integration with Your Build System

The `Makefile` includes automated release creation:
- **`make release`**: Builds and creates GitHub release automatically
- **`make release-notes`**: Shows template for manual releases
- **Version Detection**: Automatically uses version from manifest.json
- **Error Handling**: Checks for required tools and tokens

## Troubleshooting

### Common Issues

**"Extraction failed" error**
- Ensure you're on a Medium article page (URL contains `medium.com`)
- Medium occasionally changes their layout - the `<article>` element might need selector updates
- Check browser console for specific errors

**Images not appearing in PDF**
- Some Medium images block cross-origin access
- The extension converts images via canvas with `crossOrigin="anonymous"`
- Failed images are silently skipped (check Network tab in DevTools)

**Popup shows but nothing happens**
- Verify all permissions are granted in `manifest.json`
- Check popup DevTools console (F12) for JavaScript errors
- Ensure `downloads` permission is allowed by Firefox

**Service worker issues**
- MV3 service workers are minimal - main logic runs in popup and content scripts
- If issues persist, reload the extension in `about:debugging`

### Getting Help

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

## Contributing

We welcome contributions! Here's how to get involved:

### Development Setup

1. **Fork** the repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/MR901/articledoc.git
   cd articledoc
   ```

3. **Install dependencies**:
   ```bash
   npm install -g web-ext
   ```

4. **Make changes** and test:
   ```bash
   make build
   # Load in Firefox for testing
   ```

### Contribution Guidelines

- **Bug Reports**: Use GitHub Issues with clear reproduction steps
- **Features**: Discuss in Issues before implementing
- **Documentation**: Improvements to README, comments, or help text
- **Testing**: Test on various Medium article types and lengths

### Code Style

- **ES6+ JavaScript**: Modern syntax, arrow functions, async/await
- **Clear comments**: Explain complex logic and Medium-specific workarounds
- **Error handling**: Graceful degradation for missing elements
- **Performance**: Process large articles in chunks


## Acknowledgments

- **jsPDF**: Amazing library for client-side PDF generation
- **Medium**: The platform that inspired this tool
- **Mozilla**: Firefox extension platform and web-ext tools
- **Open Source Community**: For the countless utilities and inspiration

## Links & Resources

- **Firefox Add-ons (AMO) listing**: [ArticleDoc on AMO](https://addons.mozilla.org/en-US/firefox/addon/articledoc/)
- **NPM**: [web-ext](https://www.npmjs.com/package/web-ext) - Build tool
- **jsPDF**: [jspdf](https://parall.ax/products/jspdf) - PDF generation library
- **Releases**: [GitHub Releases](https://github.com/MR901/articledoc/releases) - Download stable versions


