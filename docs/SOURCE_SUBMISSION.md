# ArticleDoc – Source Submission for AMO Review

This archive contains human‑readable source code and exact build instructions to reproduce the submitted Firefox add-on package.

## 1) Overview

- We do not use bundlers/transpilers (no webpack/rollup/TypeScript/Babel). All first‑party code is plain JavaScript/HTML/CSS.
- One third‑party library is vendored as a prebuilt UMD file:
  - `libs/jspdf.umd.min.js` (official jsPDF UMD build, unmodified)

AMO requires readable source for any minified content. We include provenance and reproduction steps for jsPDF below.

## 2) Files included in the add-on

- manifest.json
- background.js
- content.js
- popup.html
- popup.js
- libs/jspdf.umd.min.js (third-party: official jsPDF UMD build, unmodified)
- icons/icon-48.png
- icons/icon-128.png

## 3) Build environment

- OS: Linux (tested on linux 5.15.x), macOS and Windows also supported
- Node.js: >= 18.x (LTS recommended)
- Tooling: `web-ext` (Mozilla’s official tool)

Install prerequisites:
```bash
npm install -g web-ext
web-ext --version
```

## 4) Reproduce the add-on package

From the project root:
```bash
# 1) Build the extension ZIP exactly as submitted
web-ext build --overwrite-dest

# Output: ./web-ext-artifacts/articledoc-<version>.zip (where <version> matches manifest.json)
```

This output is the same artifact used for submission. We do not perform any additional processing.

## 5) Third‑party dependency provenance (jsPDF)

- File: `libs/jspdf.umd.min.js`
- Source: Official jsPDF UMD distribution (minified) from the jsPDF project
- License: MIT
- Modifications: None (file is vendored as-is)

Reproduction for jsPDF file:
1. Download the official UMD build for the jsPDF release you intend to use from the jsPDF releases page.
2. Place the downloaded `jspdf.umd.min.js` into `libs/`.
3. No further processing is performed by this project.

Verification (optional but recommended):
```bash
# Compute checksum of vendored file
sha256sum libs/jspdf.umd.min.js
# Compare against upstream file checksum you compute locally after download
```

## 6) What the build script does

- `web-ext build` reads `manifest.json` and packages the listed files into a ZIP under `web-ext-artifacts/`.
- No code generation, minification, or concatenation is performed by this project.

## 7) Operating system and requirements

- Linux/macOS/Windows
- Node.js >= 18
- `web-ext` installed globally (`npm install -g web-ext`)

## 8) Notes for Reviewers

- All first‑party code is readable as-is in this archive.
- The only minified file is third‑party `libs/jspdf.umd.min.js`, included verbatim from upstream.
- We do not modify or re-bundle jsPDF.


