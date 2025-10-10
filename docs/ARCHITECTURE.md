# ArticleDoc Architecture

## Overview

ArticleDoc is a Firefox extension that extracts article content and generates high-quality PDFs in the popup context. The codebase is modularized for maintainability, testability, and AMO compliance.

## Entry Points

- `popup.html` → loads globals (`libs/*.global.js`), PDF lib, and `popup.js`
- `content_scripts` → `libs/*`, `providers.js`, `content.js`
- `background.js` → minimal lifecycle and health checks

## Global Modules (non-module scripts)

- `libs/logger.global.js` → unified logger available as `window.__ArticleDocLogger`
- `libs/messaging.global.js` → tab query, message send with MV2 injection, timeouts
- `libs/providers.global.js` → provider base/registry + shared global registry
- `libs/assembler.global.js` → pass-through seam for DOM→Article mapping
- `libs/features.global.js` → feature flags (refs/related/TOC)
- `libs/references.global.js` → reference collection and section builder
- `libs/related.global.js` → related mentions collection using provider hints
- `libs/pdf.global.js` → filename and outline builders
- `libs/toc.global.js` → simple TOC builder
- `libs/ui.global.js` → UI helpers for status and disabled state

## Core Scripts

- `providers.js`
  - Defines `BaseProvider`, `ProviderRegistry`
  - Registers Medium-family provider with hints and URL patterns
  - Populates global registry `window.__ArticleDocProviderRegistry`

- `content.js`
  - Receives extract request, picks container, prunes content
  - Builds payload and passes through `__ArticleDocAssembler.toArticle`
  - Optionally enriches with References/Related when flags are enabled

- `popup.js`
  - Orchestrates tab lookup, messaging, extraction
  - `generatePDF(article)` renders the PDF via jsPDF
  - Uses `__ArticleDocPDF.createOutline` and optional `__ArticleDocTOC`

## Data Model (JS typedefs in `libs/types.shared.js`)

- `Article`, `Section`, `Block`, `Reference`, `RelatedMention`

## Testing

- Minimal Node-based tests live in `tests/`
- Example: `tests/references.test.js` covers dedupe logic

## AMO Compliance

- Keep permissions host-specific and minimal per `manifest.json`
- Build and validate with `web-ext lint` before packaging

## Future Work

- Swap to a CSP-safe vendor build for PDF (or wrap `pdf-lib`)
- Expand tests (content assembly, providers, outline)
- TypeScript migration behind current entry points
