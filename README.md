# Medium → Clean PDF (Firefox Extension)
download Medium articles as formatted, selectable-text PDFs


Overview

- Works on any Medium article (`*.medium.com/*` and `https://medium.com/*`).
- Extracts clean text, headings, and inline images (GIF → first frame).
- Automatically paginates long content for A4 pages.
- Produces selectable-text PDFs using jsPDF.
- Handles CORS images from Medium CDN.
- Runs offline after install (library bundled in `libs/`).


Install (Temporary add-on in Firefox)

1. Open `about:debugging` in Firefox.
2. Go to “This Firefox”.
3. Click “Load Temporary Add-on…”.
4. Select the project folder (or pick `manifest.json` inside it).
5. You should now see the extension icon appear in the toolbar.


Usage

1. Open a Medium article in a tab.
2. Click the extension icon → the popup shows “Generate Clean PDF”.
3. Click “Generate Clean PDF”.
4. A PDF will be generated and downloaded (or prompt to save) named after the article title.


Project Structure

- `manifest.json` — Extension manifest (MV3). Declares permissions and scripts.
- `background.js` — Minimal MV3 service worker (no-op + health check).
- `content.js` — Extracts article content (title, author, blocks of text/images).
- `popup.html` — Popup UI with the button to trigger conversion.
- `popup.js` — Uses jsPDF to format and generate the PDF from extracted data.
- `libs/jspdf.umd.min.js` — Bundled jsPDF UMD build for offline use.
- `icons/` — Extension icon.


Permissions

- `activeTab` — allows interacting with the current tab.
- `scripting` — allows sending messages/exec scripts with content script.
- `downloads` — allows saving the generated PDF.
- `tabs` — needed for `chrome.tabs.query` in the popup.
- `host_permissions` — Medium domains and Medium image CDN.


How it works (flow)

1. You click the extension button in a Medium article tab.
2. `popup.js` sends a message to the `content.js` content script to extract the article.
3. `content.js` scrapes `<article>`, cleans non-content elements, and returns structured blocks.
4. `popup.js` lays out text and images via jsPDF (A4, margins, pagination) and triggers download.
5. `background.js` exists only as MV3 service worker scaffolding.


Development

- Keep the jsPDF file in `libs/jspdf.umd.min.js` to avoid network fetches.
- If you update to a new jsPDF version, replace that file from the official CDN:
  - `https://cdn.jsdelivr.net/npm/jspdf@<version>/dist/jspdf.umd.min.js`
- After changes, reload from `about:debugging` → “This Firefox” → “Reload” on the extension.


Troubleshooting

- The button says extraction failed:
  - Ensure you are on a Medium article page (URL matches Medium domain).
  - Medium’s layout changes occasionally; if `<article>` is missing, update `content.js` selectors.
- Images don’t appear in the PDF:
  - Some images block cross-origin access. We convert via canvas with `crossOrigin="anonymous"`.
  - If some images still fail, they are skipped silently; check the network panel.
- The popup shows but nothing happens:
  - Confirm permissions in `manifest.json` include `tabs` and `downloads`.
  - Open the popup, press F12 to open the popup devtools, and check for errors.
- Service worker inactive:
  - That’s expected; the extension logic runs in popup and content scripts.


Publishing (optional)

- For AMO (addons.mozilla.org), follow their MV3 guidelines.
- Provide 128×128 and 48×48 icons in `icons/`.
- Ensure no remote code execution or network-fetched libraries at runtime.

