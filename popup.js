/**
 * ArticleDoc Popup Script - PDF Generation and User Interface
 *
 * This script handles the browser extension popup functionality, including:
 * - User interface interactions and status updates
 * - Article extraction coordination with content scripts
 * - Advanced PDF generation with Unicode support and emoji rendering
 * - Sophisticated text layout and typography system
 * - Cross-platform compatibility and error handling
 *
 * Architecture Overview:
 * 1. Logging System: Enhanced debugging and performance monitoring
 * 2. UI Management: Status updates and user interaction handling
 * 3. Article Processing: Coordination with content script for extraction
 * 4. PDF Generation: Complex layout engine with Unicode/emoji support
 * 5. Typography System: Text measurement, wrapping, and styling
 * 6. Image Processing: Emoji rendering and inline image handling
 *
 * The script uses jsPDF library for PDF creation and implements a sophisticated
 * text layout system that handles:
 * - Multi-language Unicode text rendering
 * - Emoji and special character processing
 * - Responsive text wrapping and pagination
 * - Typography styling and spacing
 */

/**
 * Enhanced Logging Utility for Popup Script
 *
 * Provides comprehensive logging with timestamps, session tracking, and
 * different log levels for debugging and performance monitoring.
 */
const PopupLogger = {
  // Session tracking for debugging across popup instances
  startTime: Date.now(),
  sessionId: Math.random().toString(36).substr(2, 9),

  /**
   * Logs general information with timestamp and session tracking
   * @param {string} message - Log message
   * @param {Object|null} data - Additional data to include
   */
  log: (message, data = null) => {
    const timestamp = ((Date.now() - PopupLogger.startTime) / 1000).toFixed(2) + 's';
    console.log(`[${timestamp}] 🔵 ${message}`, data ? { session: PopupLogger.sessionId, ...data } : { session: PopupLogger.sessionId });
  },

  /**
   * Logs warnings with timestamp and session tracking
   * @param {string} message - Warning message
   * @param {Object|null} data - Additional context data
   */
  warn: (message, data = null) => {
    const timestamp = ((Date.now() - PopupLogger.startTime) / 1000).toFixed(2) + 's';
    console.warn(`[${timestamp}] ⚠️ ${message}`, data ? { session: PopupLogger.sessionId, ...data } : { session: PopupLogger.sessionId });
  },

  /**
   * Logs errors with detailed error information and stack traces
   * @param {string} message - Error message
   * @param {Error|null} error - Error object with stack trace
   */
  error: (message, error = null) => {
    const timestamp = ((Date.now() - PopupLogger.startTime) / 1000).toFixed(2) + 's';
    console.error(`[${timestamp}] ❌ ${message}`, {
      session: PopupLogger.sessionId,
      error: error?.message || error,
      stack: error?.stack?.split('\n').slice(0, 3).join('\n')
    });
  },

  /**
   * Starts a collapsible console group for organizing related logs
   * @param {string} message - Group label
   */
  group: (message) => {
    console.group(`🚀 ${message}`);
  },

  /**
   * Ends the current console group
   */
  groupEnd: () => {
    console.groupEnd();
  },

  /**
   * Logs successful operations with timestamp and session tracking
   * @param {string} message - Success message
   * @param {Object|null} data - Additional success context
   */
  success: (message, data = null) => {
    const timestamp = ((Date.now() - PopupLogger.startTime) / 1000).toFixed(2) + 's';
    console.log(`[${timestamp}] ✅ ${message}`, data ? { session: PopupLogger.sessionId, ...data } : { session: PopupLogger.sessionId });
  },

  /**
   * Logs informational messages with timestamp and session tracking
   * @param {string} message - Info message
   * @param {Object|null} data - Additional context data
   */
  info: (message, data = null) => {
    const timestamp = ((Date.now() - PopupLogger.startTime) / 1000).toFixed(2) + 's';
    console.info(`[${timestamp}] ℹ️ ${message}`, data ? { session: PopupLogger.sessionId, ...data } : { session: PopupLogger.sessionId });
  }
};

/**
 * Updates the status display in the popup UI
 * @param {string} message - Status message to display
 * @param {string} type - Status type: "info", "error", or "success"
 */
function updateStatus(message, type = "info") {
  try {
    const el = document.getElementById("status");
    if (!el) return;
    // Set color based on status type for visual feedback
    el.style.color = type === "error" ? "#c00" : type === "success" ? "#0a0" : "#666";
    el.textContent = String(message || "");
  } catch (_) {
    // Silently handle any DOM errors
  }
}

// Get reference to the convert button for event handling
let convertBtn = document.getElementById("convert");

/**
 * Main PDF Generation Event Handler
 *
 * Orchestrates the entire article-to-PDF conversion process:
 * 1. Validates active tab and permissions
 * 2. Extracts article content from the page
 * 3. Generates PDF with advanced layout and Unicode support
 * 4. Downloads the resulting PDF file
 * 5. Provides comprehensive error handling and user feedback
 */
convertBtn.addEventListener("click", async () => {
  PopupLogger.group("PDF Generation Process");
  PopupLogger.log("Generate Clean PDF clicked");
  const overallStartTime = performance.now();

  try {
    convertBtn.disabled = true;
    updateStatus("Locating active tab…");

    PopupLogger.group("Tab & Communication Setup");
    const tabs = await queryTabs({ active: true, currentWindow: true });
    const tab = tabs && tabs[0];
    if (!tab) {
      PopupLogger.error("No active tab found");
      updateStatus("No active tab found", "error");
      convertBtn.disabled = false;
      PopupLogger.groupEnd();
      PopupLogger.groupEnd();
      return;
    }
    PopupLogger.success("Active tab found", { id: tab.id, title: tab.title?.substring(0, 50) + '...' });
    PopupLogger.groupEnd();

    updateStatus("Extracting article…");
    PopupLogger.group("Article Extraction");
    const t0 = performance.now();
    let article = null;
    try {
      article = await sendMessageToTab(tab.id, { action: "extractArticle" });
    } catch (e1) {
      article = { error: e1 && e1.message ? e1.message : "extract failed" };
    }
    const t1 = performance.now();

    // Expose for debugging from popup DevTools
    try { window.__lastArticle = article; } catch (_) {}
    PopupLogger.info("Extraction time", { duration: `${(t1 - t0).toFixed(2)}ms` });

    if (!article || article.error) {
      const reason = (article && article.error) || "Unsupported site";
      PopupLogger.warn("Extraction not supported", { reason });
      updateStatus("Site not supported. Enabling Force Generate in 3s…", "error");

      // Show pending state, then enable a Force Generate behavior
      await new Promise(r => setTimeout(r, 3000));

      const originalText = convertBtn.textContent;

      // Clone the button to remove all existing event listeners
      const newButton = convertBtn.cloneNode(true);
      convertBtn.parentNode.replaceChild(newButton, convertBtn);

      // Update the global reference to the new button
      convertBtn = newButton;
      const forceBtn = newButton;

      forceBtn.textContent = "Force Generate";
      forceBtn.disabled = false;

      // One-time forced flow handler
      const onForce = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        // Remove this handler and restore original state
        forceBtn.removeEventListener('click', onForce);

        // Clone again to get a fresh button for the original handler
        const originalButton = forceBtn.cloneNode(true);
        forceBtn.parentNode.replaceChild(originalButton, forceBtn);

        // Update the global reference to the restored button
        convertBtn = originalButton;

        // Restore original state
        originalButton.textContent = originalText;
        originalButton.disabled = true;
        updateStatus("Force extracting…");

        PopupLogger.group("Forced Article Extraction");
        let forced = null;
        const ft0 = performance.now();
        try {
          forced = await sendMessageToTab(tab.id, { action: "forceExtractArticle" });
        } catch (e2) {
          forced = { error: e2 && e2.message ? e2.message : "force extract failed" };
        }
        const ft1 = performance.now();
        PopupLogger.info("Forced extraction time", { duration: `${(ft1 - ft0).toFixed(2)}ms` });
        PopupLogger.groupEnd();

        if (!forced || forced.error) {
          const why = (forced && forced.error) || "Unknown error";
          PopupLogger.error("Forced extraction failed", { reason: why });
          updateStatus("Forced extraction failed: " + why, "error");
          originalButton.disabled = false;
          return;
        }

        // Proceed to PDF generation
        updateStatus("Generating PDF…");
        PopupLogger.group("PDF Generation");
        const t2 = performance.now();
        await generatePDF(forced);
        const t3 = performance.now();
        PopupLogger.info("PDF generation time", { duration: `${(t3 - t2).toFixed(2)}ms` });
        PopupLogger.info("Total process time", { duration: `${(t3 - overallStartTime).toFixed(2)}ms` });
        PopupLogger.groupEnd();

        updateStatus("PDF saved.", "success");
        originalButton.disabled = false;
        PopupLogger.success("PDF generation completed successfully");
        PopupLogger.groupEnd();
      };

      // Replace the click handler with our force handler
      forceBtn.addEventListener('click', onForce);
      console.groupEnd();
      console.groupEnd();
      return;
    }

    PopupLogger.success("Article extracted successfully");
    try {
      const summary = {
        title: article.title?.substring(0, 50) + (article.title && article.title.length > 50 ? '...' : ''),
        url: article.canonicalUrl,
        blocks: (article.blocks || []).length,
        author: article.author,
        mentions: (article.mentions || []).length,
        publishedDate: article.publishedDate,
        readingTime: article.readingTimeMinutes
      };
      PopupLogger.info("Article summary", summary);
    } catch (error) {
      PopupLogger.warn("Could not generate summary table", { error: error.message });
    }
    PopupLogger.groupEnd();

    updateStatus("Generating PDF…");
    PopupLogger.group("PDF Generation");
    const t2 = performance.now();
    await generatePDF(article);
    const t3 = performance.now();
    PopupLogger.info("PDF generation time", { duration: `${(t3 - t2).toFixed(2)}ms` });
    PopupLogger.info("Total process time", { duration: `${(t3 - overallStartTime).toFixed(2)}ms` });
    PopupLogger.groupEnd();

    updateStatus("PDF saved.", "success");
    convertBtn.disabled = false;
    PopupLogger.success("PDF generation completed successfully");
    PopupLogger.groupEnd();

  } catch (err) {
    PopupLogger.error("Unhandled error in PDF generation", err);
    updateStatus("Error: " + (err && err.message ? err.message : String(err)), "error");
    convertBtn.disabled = false;
    PopupLogger.groupEnd();
  }
});

/**
 * Advanced PDF Generation Engine
 *
 * Creates a high-quality PDF from article data with sophisticated features:
 * - Unicode text rendering with proper font support
 * - Emoji processing and inline rendering
 * - Responsive text layout with proper pagination
 * - Typography styling and spacing
 * - Image embedding and positioning
 * - Table of contents generation
 *
 * @param {Object} article - Extracted article data with content, metadata, and styling
 * @returns {Promise<jsPDF>} Generated PDF document ready for download
 */
async function generatePDF(article) {
  const { jsPDF } = window.jspdf;
  // Create PDF with A4 format in points (1/72 inch units)
  const pdf = new jsPDF({ unit: "pt", format: "a4" });

  // Track headings for outline generation
  const outlineHeadings = [];
  let headingCounter = 0;
  let currentPageNumber = 1;

  // Debug: Check what's available on the PDF object for outline generation
  PopupLogger.info("jsPDF object inspection", {
    hasOutline: !!pdf.outline,
    outlineKeys: pdf.outline ? Object.keys(pdf.outline) : null,
    internalKeys: pdf.internal ? Object.keys(pdf.internal).filter(k => k.includes('outline') || k.includes('Outline')) : null
  });

  // Configure Unicode font support for better international character rendering
  try {
    // Use a more Unicode-friendly font if available
    pdf.setFont("helvetica");
    // Enable Unicode support flag for proper character encoding
    pdf.internal.charSet = 'Unicode';
  } catch (e) {
    console.warn("Could not set Unicode font support:", e.message);
  }

  // === Layout and Typography Configuration ===

  // Page layout constants (in points, 1/72 inch)
  const margin = 56; // ~0.78 inches - standard document margin
  const pageH = pdf.internal.pageSize.getHeight(); // A4 height
  const pageW = pdf.internal.pageSize.getWidth();  // A4 width
  const textW = pageW - 2 * margin; // Available text width
  let y = margin; // Current vertical position (starting at top margin)

  // Color scheme for PDF elements (RGB values)
  const COLORS = {
    body: [20, 20, 20],      // Dark gray for body text
    muted: [110, 110, 110],  // Medium gray for metadata
    link: [17, 85, 204],     // Blue for hyperlinks
    hr: [200, 200, 200],     // Light gray for horizontal rules
    quoteBar: [200, 200, 200], // Light gray for quote borders
  };

  // Font sizes for different text elements (in points)
  const SIZES = {
    title: 22,     // Main article title
    subtitle: 14.5, // Article subtitle/tagline
    meta: 11,      // Author, date, reading time
    h2: 16,        // Second-level headings
    h3: 14,        // Third-level headings
    h4: 12.5,      // Fourth-level headings
    body: 11,      // Regular paragraph text
    quote: 11,     // Blockquote text
    code: 10,      // Inline code and code blocks
  };

  // Line heights for different text types (in points)
  const LINE_HEIGHTS = {
    body: 16,   // Standard paragraph line height
    quote: 16,  // Quote line height (same as body)
    code: 14,   // Code line height (tighter for monospace)
  };

  /**
   * Normalizes a URL by resolving it relative to the article's canonical URL
   * @param {string} u - URL to normalize
   * @returns {string} Fully qualified URL or trimmed string if invalid
   */
  function normalizeUrl(u) {
    try {
      // Resolve relative URLs against the article's canonical URL
      return new URL(u, article.canonicalUrl || undefined).href;
    } catch {
      // Return as-is if URL parsing fails
      return String(u || "").trim();
    }
  }

  /**
   * Extracts the domain/hostname from a URL
   * @param {string} u - URL to extract domain from
   * @returns {string} Domain name or original string if extraction fails
   */
  function urlToDomain(u) {
    try {
      const x = new URL(u, article.canonicalUrl || undefined);
      return x.hostname;
    } catch {
      // Fallback regex extraction for malformed URLs
      const s = String(u || "").trim();
      const m = s.match(/^[a-z]+:\/\/([^\/]+)/i);
      return (m && m[1]) || s;
    }
  }

  /**
   * Ensures sufficient vertical space for the next element, adding new page if needed
   * @param {number} h - Height required for the next element
   */
  function ensureSpace(h) {
    if (y + h <= pageH - margin) return; // Enough space on current page
    pdf.addPage(); // Add new page if insufficient space
    currentPageNumber++;
    y = margin; // Reset Y position to top margin of new page
  }

  /**
   * Sets font properties for body text with color and style
   * @param {number} size - Font size (default: SIZES.body)
   * @param {string} style - Font style: "normal", "bold", "italic"
   * @param {boolean} mono - Use monospace font (Courier) if true
   */
  function setBodyFont(size = SIZES.body, style = "normal", mono = false) {
    const family = mono ? "courier" : "helvetica";
    pdf.setFont(family, style);
    pdf.setFontSize(size);
    pdf.setTextColor(...COLORS.body);
  }

  function measure(text) {
    // Normalize Unicode characters before measuring
    const normalizedText = normalizeUnicodeForPDF(text);
    return pdf.getTextWidth(normalizedText);
  }

  function styleFromSeg(seg) {
    if (seg.mono) return { family: "courier", style: "normal" };
    if (seg.bold && seg.italic) return { family: "helvetica", style: "bolditalic" };
    if (seg.bold) return { family: "helvetica", style: "bold" };
    if (seg.italic) return { family: "helvetica", style: "italic" };
    return { family: "helvetica", style: "normal" };
  }

  function withSegFont(seg, size, fn) {
    const prev = { font: pdf.getFont(), size: pdf.getFontSize() };
    const s = styleFromSeg(seg);
    pdf.setFont(s.family, s.style);
    pdf.setFontSize(size);
    try {
      fn();
    } finally {
      pdf.setFont(prev.font.fontName || "helvetica", prev.font.fontStyle || "normal");
      pdf.setFontSize(prev.size);
    }
  }

  // === Advanced Emoji and Unicode Processing System ===

  /**
   * Emoji Processing Cache System
   *
   * Manages canvas resources and caches for efficient emoji rendering:
   * - Canvas for off-screen emoji rendering
   * - Pixel-to-point conversion factors
   * - Rendered emoji data URLs for PDF embedding
   */
  const __emojiCache = {
    canvas: null,        // Shared canvas for emoji rendering
    ctx: null,          // Canvas 2D context
    pxToPtByKey: new Map(),  // Cache for pixel-to-point conversions
    dataUrlByKey: new Map()   // Cache for rendered emoji images
  };

  /**
   * Gets or creates the shared canvas for emoji rendering
   * Reuses existing canvas if already initialized to avoid recreation overhead
   * @returns {Object} Canvas and context reference
   */
  function getCanvas() {
    if (__emojiCache.canvas && __emojiCache.ctx) return __emojiCache;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    __emojiCache.canvas = canvas;
    __emojiCache.ctx = ctx;
    return __emojiCache;
  }

  function fontSignatureForSeg(seg, size) {
    const s = styleFromSeg(seg || {});
    return `${s.family}|${s.style}|${size}`;
  }

  function setCanvasFont(ctx, seg, sizePx) {
    const s = styleFromSeg(seg || {});
    const isMono = s.family === "courier";
    const weight = /bold/.test(s.style) ? "bold" : "normal";
    const italic = /italic/.test(s.style) ? "italic" : "normal";
    const family = isMono ? "monospace" : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', Arial, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Segoe UI Symbol', sans-serif";
    ctx.font = `${italic} ${weight} ${Math.max(1, Math.round(sizePx))}px ${family}`;
    ctx.textBaseline = "alphabetic";
  }

  function getPxToPtFactor(seg, size) {
    const key = fontSignatureForSeg(seg, size);
    if (__emojiCache.pxToPtByKey.has(key)) return __emojiCache.pxToPtByKey.get(key);
    const { ctx } = getCanvas();
    setCanvasFont(ctx, seg, size);
    const px = ctx.measureText("M").width || 1;
    let pt = 0;
    withSegFont(seg, size, () => {
      pt = pdf.getTextWidth("M") || 1;
    });
    const factor = pt / px;
    __emojiCache.pxToPtByKey.set(key, factor);
    return factor;
  }

  /**
   * Advanced Emoji Detection System
   *
   * Detects emoji characters using multiple strategies:
   * - Zero Width Joiner (ZWJ) sequences for compound emoji
   * - Variation Selector-16 for emoji presentation variants
   * - Extended_Pictographic Unicode property for comprehensive coverage
   * - Fallback regex for older JavaScript engines
   */
  function isEmojiGrapheme(gr) {
    if (!gr) return false;
    try {
      // If contains ZWJ, likely an emoji sequence (e.g., family emoji 👨‍👩‍👧‍👦)
      if (gr.indexOf("\u200D") !== -1) return true;
      // Variation Selector-16 indicates emoji presentation (e.g., ⭐ vs *)
      if (/[\uFE0F]/u.test(gr)) return true;
      // Extended_Pictographic covers most emoji code points in modern Unicode
      if (/(\p{Extended_Pictographic})/u.test(gr)) return true;
    } catch (_) {
      // Fallback for engines without Unicode property escapes: common emoji ranges
      if (/[\u2190-\u21FF\u2300-\u27BF\u2600-\u27BF\u1F300-\u1FAFF]/.test(gr)) return true;
    }
    return false;
  }

  /**
   * Unicode Grapheme Segmentation
   *
   * Breaks text into user-perceived characters (graphemes) rather than code points.
   * This is essential for proper handling of:
   * - Emoji with modifiers (👋🏽)
   * - Combining characters (é = e + ´)
   * - Zero-width joiner sequences (👨‍👩‍👧‍👦)
   *
   * Uses modern Intl.Segmenter API when available, falls back to code point splitting.
   *
   * @param {string} text - Text to segment into graphemes
   * @returns {string[]} Array of grapheme clusters
   */
  function segmentGraphemes(text) {
    if (!text) return [];
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      try {
        const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
        return Array.from(seg.segment(text), s => s.segment);
      } catch (_) {}
    }
    // Fallback: split by code points; this won't merge ZWJ sequences perfectly but works as a baseline
    return Array.from(text);
  }

  function measureEmojiWidthPt(emoji, seg, size) {
    const { ctx } = getCanvas();
    setCanvasFont(ctx, seg, size);
    const px = ctx.measureText(emoji).width || size;
    const k = getPxToPtFactor(seg, size);
    // Add a small fudge factor to avoid under-measurement that can cause overflow
    return px * k * 1.08;
  }

  function getEmojiDataUrl(emoji, seg, size) {
    const key = `${emoji}|${fontSignatureForSeg(seg, size)}`;
    if (__emojiCache.dataUrlByKey.has(key)) return __emojiCache.dataUrlByKey.get(key);
    const scale = Math.min(4, Math.max(2, Math.ceil(window.devicePixelRatio || 2)));
    const heightPx = Math.max(8, Math.round(size * scale));
    // Approximate width via measure
    const { ctx, canvas } = getCanvas();
    setCanvasFont(ctx, seg, heightPx);
    const wpx = Math.ceil(ctx.measureText(emoji).width) + Math.ceil(heightPx * 0.15);
    canvas.width = Math.max(1, wpx);
    canvas.height = heightPx + Math.ceil(heightPx * 0.2);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setCanvasFont(ctx, seg, heightPx);
    ctx.fillStyle = "#000";
    // Draw near baseline; approximate alphabetic baseline at ~0.85 of font size
    const baseline = Math.round(heightPx * 0.85);
    ctx.fillText(emoji, 0, baseline);
    const url = canvas.toDataURL("image/png");
    __emojiCache.dataUrlByKey.set(key, url);
    return url;
  }

  function splitTokenIntoFragments(tok, seg, size) {
    // Returns array of { type: 'text'|'emoji', text, width }
    // Normalize Unicode characters in the token before processing
    const normalizedTok = normalizeUnicodeForPDF(tok);
    const graphemes = segmentGraphemes(normalizedTok);
    const out = [];
    let currentText = "";
    let currentW = 0;
    function flushText() {
      if (!currentText) return;
      let w = 0;
      withSegFont(seg, size, () => {
        w = measure(currentText) * 1.02; // conservative fudge to avoid underestimated wraps
      });
      out.push({ type: "text", text: currentText, width: w });
      currentText = "";
      currentW = 0;
    }
    for (const g of graphemes) {
      if (isEmojiGrapheme(g)) {
        flushText();
        const w = measureEmojiWidthPt(g, seg, size);
        out.push({ type: "emoji", text: g, width: w });
      } else {
        currentText += g;
      }
    }
    flushText();
    return out;
  }

  function drawFragments(fragments, x, y, seg, size) {
    for (const f of fragments) {
      if (f.type === "text" && f.text) {
        // Normalize Unicode characters before rendering
        const normalizedText = normalizeUnicodeForPDF(f.text);
        withSegFont(seg, size, () => {
          pdf.text(normalizedText, x, y);
        });
        x += f.width;
      } else if (f.type === "emoji" && f.text) {
        const dataUrl = getEmojiDataUrl(f.text, seg, size);
        const ascent = Math.round(size * 0.8);
        const heightPt = size; // draw 1em high
        const widthPt = f.width || size;
        pdf.addImage(dataUrl, "PNG", x, y - ascent, widthPt, heightPt);
        x += widthPt;
      }
    }
    return x;
  }

  function drawTextWithEmojis(text, x, y, seg, size) {
    const frags = splitTokenIntoFragments(text, seg, size);
    drawFragments(frags, x, y, seg, size);
  }

  function drawUnicodeSafeText(text, x, y, options = {}) {
    if (!text) return x;

    // Apply Unicode character substitution before rendering
    const normalizedText = normalizeUnicodeForPDF(text);

    try {
      // For linked text, use the link-aware method
      if (options.url) {
        pdf.textWithLink(normalizedText, x, y, { url: options.url });
      } else {
        // Use direct text rendering with Unicode support
        pdf.text(normalizedText, x, y);
      }
      return x + pdf.getTextWidth(normalizedText);
    } catch (e) {
      // Fallback: try to render character by character for problematic Unicode
      console.warn("Unicode text rendering failed, using fallback:", e.message);
      return drawUnicodeSafeTextFallback(normalizedText, x, y, options);
    }
  }

  // Unicode character normalization for PDF rendering
  // Maps problematic Unicode characters (especially mathematical symbols) to ASCII equivalents
  const UNICODE_TO_ASCII_MAP = {
    // Mathematical Alphanumeric Symbols - Bold (U+1D5D0-U+1D5FF)
    '𝗔': 'A', '𝗕': 'B', '𝗖': 'C', '𝗗': 'D', '𝗘': 'E', '𝗙': 'F', '𝗚': 'G',
    '𝗛': 'H', '𝗜': 'I', '𝗝': 'J', '𝗞': 'K', '𝗟': 'L', '𝗠': 'M', '𝗡': 'N',
    '𝗢': 'O', '𝗣': 'P', '𝗤': 'Q', '𝗥': 'R', '𝗦': 'S', '𝗧': 'T', '𝗨': 'U',
    '𝗩': 'V', '𝗪': 'W', '𝗫': 'X', '𝗬': 'Y', '𝗭': 'Z',

    // Mathematical Alphanumeric Symbols - Bold Italic (U+1D5DC-U+1D5FF)
    '𝘈': 'A', '𝘉': 'B', '𝘊': 'C', '𝘋': 'D', '𝘌': 'E', '𝘍': 'F', '𝘎': 'G',
    '𝘏': 'H', '𝘐': 'I', '𝘑': 'J', '𝘒': 'K', '𝘓': 'L', '𝘔': 'M', '𝘕': 'N',
    '𝘖': 'O', '𝘗': 'P', '𝘘': 'Q', '𝘙': 'R', '𝘚': 'S', '𝘛': 'T', '𝘜': 'U',
    '𝘝': 'V', '𝘞': 'W', '𝘟': 'X', '𝘠': 'Y', '𝘡': 'Z',

    // Mathematical Alphanumeric Symbols - Italic (U+1D434-U+1D44D)
    '𝐴': 'A', '𝐵': 'B', '𝐶': 'C', '𝐷': 'D', '𝐸': 'E', '𝐹': 'F', '𝐺': 'G',
    '𝐻': 'H', '𝐼': 'I', '𝐽': 'J', '𝐾': 'K', '𝐿': 'L', '𝑀': 'M', '𝑁': 'N',
    '𝑂': 'O', '𝑃': 'P', '𝑄': 'Q', '𝑅': 'R', '𝑆': 'S', '𝑇': 'T', '𝑈': 'U',
    '𝑉': 'V', '𝑊': 'W', '𝑋': 'X', '𝑌': 'Y', '𝑍': 'Z',

    // Mathematical Alphanumeric Symbols - Bold Italic lowercase (U+1D48A-U+1D4A3)
    '𝒂': 'a', '𝒃': 'b', '𝒄': 'c', '𝒅': 'd', '𝒆': 'e', '𝒇': 'f', '𝒈': 'g',
    '𝒉': 'h', '𝒊': 'i', '𝒋': 'j', '𝒌': 'k', '𝒍': 'l', '𝒎': 'm', '𝒏': 'n',
    '𝒐': 'o', '𝒑': 'p', '𝒒': 'q', '𝒓': 'r', '𝒔': 's', '𝒕': 't', '𝒖': 'u',
    '𝒗': 'v', '𝒘': 'w', '𝒙': 'x', '𝒚': 'y', '𝒛': 'z',

    // Mathematical Alphanumeric Symbols - Bold lowercase (U+1D41A-U+1D433)
    '𝐚': 'a', '𝐛': 'b', '𝐜': 'c', '𝐝': 'd', '𝐞': 'e', '𝐟': 'f', '𝐠': 'g',
    '𝐡': 'h', '𝐢': 'i', '𝐣': 'j', '𝐤': 'k', '𝐥': 'l', '𝐦': 'm', '𝐧': 'n',
    '𝐨': 'o', '𝐩': 'p', '𝐪': 'q', '𝐫': 'r', '𝐬': 's', '𝐭': 't', '𝐮': 'u',
    '𝐯': 'v', '𝐰': 'w', '𝐱': 'x', '𝐲': 'y', '𝐳': 'z',

    // Mathematical Alphanumeric Symbols - Italic lowercase (U+1D44E-U+1D467)
    '𝑎': 'a', '𝑏': 'b', '𝑐': 'c', '𝑑': 'd', '𝑒': 'e', '𝑓': 'f', '𝑔': 'g',
    'ℎ': 'h', '𝑖': 'i', '𝑗': 'j', '𝑘': 'k', '𝑙': 'l', '𝑚': 'm', '𝑛': 'n',
    '𝑜': 'o', '𝑝': 'p', '𝑞': 'q', '𝑟': 'r', '𝑠': 's', '𝑡': 't', '𝑢': 'u',
    '𝑣': 'v', '𝑤': 'w', '𝑥': 'x', '𝑦': 'y', '𝑧': 'z',

    // Mathematical Alphanumeric Symbols - Bold Italic lowercase (U+1D4B6-U+1D4CF)
    '𝙖': 'a', '𝙗': 'b', '𝙘': 'c', '𝙙': 'd', '𝙚': 'e', '𝙛': 'f', '𝙜': 'g',
    '𝙝': 'h', '𝙞': 'i', '𝙟': 'j', '𝙠': 'k', '𝙡': 'l', '𝙢': 'm', '𝙣': 'n',
    '𝙤': 'o', '𝙥': 'p', '𝙦': 'q', '𝙧': 'r', '𝙨': 's', '𝙩': 't', '𝙪': 'u',
    '𝙫': 'v', '𝙬': 'w', '𝙭': 'x', '𝙮': 'y', '𝙯': 'z',

    // Common problematic characters
    '–': '-', '—': '-', '…': '...', '"': '"', '"': '"', "'": "'", "'": "'",
    '‚': "'", '„': '"', '‹': '<', '›': '>', '«': '<<', '»': '>>'
  };

  function normalizeUnicodeForPDF(text) {
    if (!text) return text;

    // Step 1: Unicode normalize (NFKD) to decompose styled forms into base letters + combining marks
    // Then remove combining marks so base ASCII letters remain when possible
    let decomposed = "";
    try {
      decomposed = text.normalize ? text.normalize("NFKD") : text;
    } catch (_) {
      decomposed = text; // environments without normalize()
    }
    const withoutCombining = decomposed.replace(/[\p{Mn}\p{Me}\p{Mc}]/gu, "");

    // Step 2: Apply character-by-character substitution for known problematic code points
    return Array.from(withoutCombining).map(char => {
      const code = char.codePointAt(0);

      // Mathematical Alphanumeric Symbols range
      if (code >= 0x1D400 && code <= 0x1D7FF) {
        return UNICODE_TO_ASCII_MAP[char] || char;
      }
      // General Punctuation (em/en dashes, smart quotes, etc.)
      if (code >= 0x2010 && code <= 0x206F) {
        return UNICODE_TO_ASCII_MAP[char] || char;
      }
      // Explicit overrides
      if (UNICODE_TO_ASCII_MAP[char]) return UNICODE_TO_ASCII_MAP[char];

      return char;
    }).join("");
  }

  function drawUnicodeSafeTextFallback(text, x, y, options = {}) {
    if (!text) return x;

    // Split text into individual characters and render them one by one
    // This helps with Unicode characters that jsPDF has trouble with
    const chars = Array.from(text);
    let currentX = x;

    for (const char of chars) {
      try {
        if (options.url) {
          pdf.textWithLink(char, currentX, y, { url: options.url });
        } else {
          pdf.text(char, currentX, y);
        }
        currentX += pdf.getTextWidth(char);
      } catch (e) {
        // If even a single character fails, skip it to avoid complete failure
        console.warn("Skipping problematic character:", char.codePointAt(0));
        currentX += pdf.getTextWidth(" ");
      }
    }

    return currentX;
  }

  function layoutSegmentsIntoLines(segments, maxWidth, size) {
    const lines = [];
    let current = [];
    let lineWidth = 0;

    const pushLine = () => {
      if (current.length) lines.push(current);
      current = [];
      lineWidth = 0;
    };

    function combineSingleCharRuns(tokens) {
      const out = [];
      let buffer = "";
      let trailingSpace = false;
      // Prefer Unicode properties; fallback to ASCII
      const singleCharRe = (() => {
        try {
          return new RegExp("^(?:\\p{L}|\\p{N})\\s?$", "u");
        } catch (_) {
          return /^(?:[A-Za-z0-9])\s?$/;
        }
      })();
      for (const tok of tokens) {
        // Pure whitespace tokens are not combined
        if (/^\s+$/.test(tok)) {
          if (buffer) {
            out.push(buffer + (trailingSpace ? " " : ""));
            buffer = "";
            trailingSpace = false;
          }
          out.push(tok);
          continue;
        }
        if (singleCharRe.test(tok)) {
          // Append the single visible char
          buffer += tok.trim();
          // Track if this single-char token ended with a space
          if (/\s$/.test(tok)) trailingSpace = true;
          continue;
        }
        // Non single-char token → flush buffer then push token
        if (buffer) {
          out.push(buffer + (trailingSpace ? " " : ""));
          buffer = "";
          trailingSpace = false;
        }
        out.push(tok);
      }
      if (buffer) out.push(buffer + (trailingSpace ? " " : ""));
      return out;
    }

    for (const seg of segments) {
      // Normalize Unicode characters in the segment text before processing
      const normalizedText = normalizeUnicodeForPDF(seg.text || "");

      // Force-break on newlines inside segments
      const chunks = String(normalizedText).split(/(\n)/);
      for (const chunk of chunks) {
        if (chunk === "\n") {
          pushLine();
          continue;
        }
        if (!chunk) continue;
        // Split into tokens preserving spaces
        const rawTokens = chunk.match(/\S+\s*|\s+/g) || [];
        const tokens = combineSingleCharRuns(rawTokens);
        for (let tok of tokens) {
          // avoid leading spaces on new lines
          if (!current.length && /^\s+$/.test(tok)) continue;
          // Measure as composition of text and emoji fragments
          const fragments = splitTokenIntoFragments(tok, seg, size);
          const w = fragments.reduce((acc, f) => acc + (f.width || 0), 0);
          if (lineWidth + w > maxWidth && current.length) {
            pushLine();
            if (/^\s+$/.test(tok)) continue; // drop leading whitespace on new line
          }
          current.push({ ...seg, text: tok, width: w, fragments });
          lineWidth += w;
        }
      }
    }
    pushLine();
    return lines;
  }

  function drawParagraph(segments) {
    setBodyFont(SIZES.body, "normal", false);
    pdf.setTextColor(...COLORS.body);
    const lines = layoutSegmentsIntoLines(segments, textW, SIZES.body);
    for (const line of lines) {
      ensureSpace(LINE_HEIGHTS.body);
      let x = margin;
      for (const part of line) {
        const s = styleFromSeg(part);
        pdf.setFont(s.family, s.style);
        pdf.setFontSize(SIZES.body);
        if (part.link) {
          pdf.setTextColor(...COLORS.link);
          if (part.fragments) {
            // Render fragments; textWithLink can't wrap mixed fragments, so use plain text and add link area over the span
            const startX = x;
            x = drawFragments(part.fragments, x, y, part, SIZES.body);
            // Add an invisible link rectangle covering the rendered span
            const linkWidth = x - startX;
            if (linkWidth > 0) {
              // y is baseline; approximate ascent and height
              const ascent = Math.round(SIZES.body * 0.8);
              const height = Math.max(10, Math.round(LINE_HEIGHTS.body * 0.9));
              pdf.link(startX, y - ascent, linkWidth, height, { url: part.link });
            }
          } else {
            // Use Unicode-safe text rendering for linked text
            drawUnicodeSafeText(part.text, x, y, { url: part.link });
            x += part.width;
          }
        } else {
          pdf.setTextColor(...COLORS.body);
          if (part.fragments) {
            x = drawFragments(part.fragments, x, y, part, SIZES.body);
          } else {
            // Use Unicode-safe text rendering
            drawUnicodeSafeText(part.text, x, y);
            x += part.width;
          }
        }
      }
      y += LINE_HEIGHTS.body;
    }
    y += 6;
  }

  function drawList(list) {
    const bulletIndent = 16;
    const numberIndent = 24;
    const baseIndent = list.ordered ? numberIndent : bulletIndent;
    let index = 1;
    for (const itemSegs of list.items) {
      const bullet = list.ordered ? String(index++) + "." : "•";
      // measure bullet width
      let bulletW = 0;
      setBodyFont(SIZES.body, list.ordered ? "bold" : "normal", false);
      bulletW = measure(bullet + " ");

      const lines = layoutSegmentsIntoLines(itemSegs, textW - bulletW - 4, SIZES.body);
      for (let li = 0; li < lines.length; li++) {
        ensureSpace(LINE_HEIGHTS.body);
        let x = margin;
        if (li === 0) {
          pdf.setTextColor(...COLORS.body);
          // Draw bullet with trailing space to match measured width
          pdf.text(bullet + " ", x, y);
        }
        x += bulletW;
        for (const part of lines[li]) {
          const s = styleFromSeg(part);
          pdf.setFont(s.family, s.style);
          pdf.setFontSize(SIZES.body);
          if (part.link) {
            pdf.setTextColor(...COLORS.link);
            if (part.fragments) {
              const startX = x;
              x = drawFragments(part.fragments, x, y, part, SIZES.body);
              const linkWidth = x - startX;
              if (linkWidth > 0) {
                const ascent = Math.round(SIZES.body * 0.8);
                const height = Math.max(10, Math.round(LINE_HEIGHTS.body * 0.9));
                pdf.link(startX, y - ascent, linkWidth, height, { url: part.link });
              }
            } else {
              pdf.textWithLink(part.text, x, y, { url: part.link });
              x += part.width;
            }
          } else {
            pdf.setTextColor(...COLORS.body);
            if (part.fragments) {
              x = drawFragments(part.fragments, x, y, part, SIZES.body);
            } else {
              pdf.text(part.text, x, y);
              x += part.width;
            }
          }
        }
        y += LINE_HEIGHTS.body;
      }
      y += 6;
    }
  }

  function drawQuote(segments) {
    // Indent blockquotes and draw a left vertical bar spanning the quote height
    const quoteIndent = 14; // space between bar and text
    const barOffset = 8; // how far into the left margin the bar is drawn
    const barX = margin - barOffset;
    const maxLineWidth = textW - quoteIndent;

    const lines = layoutSegmentsIntoLines(segments, maxLineWidth, SIZES.quote);
    pdf.setDrawColor(...COLORS.quoteBar);
    pdf.setLineWidth(2);
    for (const line of lines) {
      ensureSpace(LINE_HEIGHTS.quote);
      // Draw bar segment for this line; this naturally continues across pages
      const barY1 = y - LINE_HEIGHTS.quote + 4;
      const barY2 = y + 2;
      pdf.line(barX, barY1, barX, barY2);

      let x = margin + quoteIndent;
      for (const part of line) {
        const s = styleFromSeg(part);
        pdf.setFont(s.family, s.style);
        pdf.setFontSize(SIZES.quote);
        pdf.setTextColor(...(part.link ? COLORS.link : COLORS.muted));
        if (part.link) {
          if (part.fragments) {
            const startX = x;
            x = drawFragments(part.fragments, x, y, part, SIZES.quote);
            const linkWidth = x - startX;
            if (linkWidth > 0) {
              const ascent = Math.round(SIZES.quote * 0.8);
              const height = Math.max(10, Math.round(LINE_HEIGHTS.quote * 0.9));
              pdf.link(startX, y - ascent, linkWidth, height, { url: part.link });
            }
          } else {
            pdf.textWithLink(part.text, x, y, { url: part.link });
            x += part.width;
          }
        } else {
          if (part.fragments) {
            x = drawFragments(part.fragments, x, y, part, SIZES.quote);
          } else {
            pdf.text(part.text, x, y);
            x += part.width;
          }
        }
      }
      y += LINE_HEIGHTS.quote;
    }
    y += 6;
  }

  function drawCodeBlock(code) {
    const raw = String(code.text || "");
    // Normalize spaces and preserve indentation: tabs -> 4 spaces; remove NBSP; drop trailing block newline
    const normalized = raw
      .replace(/\u00A0/g, " ")
      .replace(/\t/g, "    ")
      .replace(/\r?\n$/, "");
    const originalLines = normalized.split(/\r?\n/).map(l => l.replace(/[ \t]+$/, ""));

    const baseSize = SIZES.code;
    const minSize = 7;
    pdf.setFont("courier", "normal");
    pdf.setFontSize(baseSize);
    pdf.setTextColor(...COLORS.body);

    // Prepare render lines with per-line font size to avoid breaking inside very long tokens
    const renderLines = [];
    for (const line of originalLines) {
      // Measure longest non-space token
      const tokens = line.split(/(\s+)/);
      let longest = 0;
      for (const t of tokens) {
        if (!t || /^\s+$/.test(t)) continue;
        const w = pdf.getTextWidth(t);
        if (w > longest) longest = w;
      }
      let size = baseSize;
      if (longest > textW) {
        size = Math.max(minSize, Math.floor(baseSize * (textW / longest)));
      }
      pdf.setFontSize(size);
      const parts = pdf.splitTextToSize(line, textW);
      for (const p of parts) {
        renderLines.push({ text: p, size });
      }
    }

    // Split the code block across pages if needed, drawing a background per chunk
    const padX = 8; // horizontal padding on each side
    const padTop = 8;
    const padBottom = 8;
    const lineHeights = renderLines.map(rl => Math.round(LINE_HEIGHTS.code * (rl.size / baseSize)));

    let i = 0;
    while (i < renderLines.length) {
      // Ensure at least one line fits; if not, move to a new page
      let available = (pageH - margin) - y;
      const minNeeded = padTop + (lineHeights[i] || Math.round(LINE_HEIGHTS.code)) + padBottom;
      if (available < minNeeded) {
        pdf.addPage();
        y = margin;
        available = (pageH - margin) - y;
      }

      // Accumulate as many lines as fit in the remaining vertical space
      let used = padTop + padBottom;
      const start = i;
      let end = i;
      while (end < renderLines.length) {
        const lh = lineHeights[end];
        if (used + lh > available) break;
        used += lh;
        end++;
      }
      if (end === start) {
        // Fallback: force at least one line per page
        end = start + 1;
        used = padTop + lineHeights[start] + padBottom;
      }

      // Draw background for this chunk
      pdf.setDrawColor(230, 230, 230);
      pdf.setFillColor(245, 245, 245);
      pdf.rect(margin - padX, y, textW + padX * 2, used, "F");

      // Draw lines inside the background using an ascent-based baseline for the first line
      const firstAscent = Math.round((renderLines[start]?.size || baseSize) * 0.8);
      let baselineY = y + padTop + firstAscent;
      for (let j = start; j < end; j++) {
        const rl = renderLines[j];
        pdf.setFontSize(rl.size);
        pdf.text(rl.text, margin, baselineY);
        baselineY += lineHeights[j];
      }

      // Advance y for the next chunk or following content
      y += used;
      i = end;
      if (i < renderLines.length) {
        // No extra gap between chunks; start next chunk immediately
      } else {
        // Larger gap after the whole block to avoid background appearing under next line's ascenders
        const afterGap = Math.max(10, Math.round(LINE_HEIGHTS.body * 0.75));
        y += afterGap;
      }
    }

    // restore default code size
    pdf.setFontSize(baseSize);
  }

  async function drawImage(imgItem) {
    try {
      const dataUrl = await convertImageToDataURL(imgItem.src, true);
      const img = new Image();
      img.src = dataUrl;
      await img.decode();

      const maxImgW = textW;
      const scale = img.width > maxImgW ? maxImgW / img.width : 1;
      const imgW = Math.min(maxImgW, img.width * scale);
      const imgH = img.height * (imgW / img.width);

      ensureSpace(imgH + 6);
      const x = margin + (textW - imgW) / 2; // center
      // Use PNG to preserve transparency
      pdf.addImage(dataUrl, "PNG", x, y, imgW, imgH);
      y += imgH + 10;
    } catch (e) {
      // Skip failed images
    }
  }

  function drawHr() {
    ensureSpace(16);
    pdf.setDrawColor(...COLORS.hr);
    pdf.setLineWidth(0.5);
    pdf.line(margin, y, margin + textW, y);
    y += 12;
  }

  function drawCaption(segments) {
    // Center-aligned, grey color; render linked text in blue
    const centerX = margin + textW / 2;
    const size = SIZES.meta; // slightly smaller than body
    const lineHeight = Math.round(size * 1.5);
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(size);
    pdf.setTextColor(...COLORS.muted);

    // Force italic style for measurement/layout so centering is accurate
    const italicSegments = (segments || []).map(s => ({ ...s, italic: true }));
    // Lay out segments into lines but we will center each line by computing width
    const lines = layoutSegmentsIntoLines(italicSegments, textW, size);
    for (const line of lines) {
      ensureSpace(lineHeight);
      // compute total width of this line
      let totalWidth = 0;
      for (const part of line) totalWidth += part.width;
      let x = margin + (textW - totalWidth) / 2;
      for (const part of line) {
        const s = styleFromSeg(part);
        pdf.setFont(s.family, s.style);
        pdf.setFontSize(size);
        if (part.link) {
          pdf.setTextColor(...COLORS.link);
          if (part.fragments) {
            const startX = x;
            x = drawFragments(part.fragments, x, y, part, size);
            const linkWidth = x - startX;
            if (linkWidth > 0) {
              const ascent = Math.round(size * 0.8);
              const height = Math.max(8, Math.round(size * 1.2));
              pdf.link(startX, y - ascent, linkWidth, height, { url: part.link });
            }
          } else {
            drawUnicodeSafeText(part.text, x, y, { url: part.link });
            x += part.width;
          }
        } else {
          pdf.setTextColor(...COLORS.muted);
          if (part.fragments) {
            x = drawFragments(part.fragments, x, y, part, size);
          } else {
            drawUnicodeSafeText(part.text, x, y);
            x += part.width;
          }
        }
      }
      y += lineHeight;
    }
    y += 6;
  }

  function drawHeading(text, level) {
    const size = level === 2 ? SIZES.h2 : level === 3 ? SIZES.h3 : SIZES.h4;
    const lh = Math.round(size * 1.5);

    // Track heading for outline before rendering
    outlineHeadings.push({
      id: ++headingCounter,
      text: text,
      level: level,
      page: currentPageNumber,
      y: y,
      title: text
    });

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(size);
    pdf.setTextColor(...COLORS.body);
    const segs = [{ text, bold: true }];
    const lines = layoutSegmentsIntoLines(segs, textW, size);
    for (const line of lines) {
      ensureSpace(lh);
      let x = margin;
      for (const part of line) {
        if (part.fragments) {
          x = drawFragments(part.fragments, x, y, part, size);
        } else {
          drawUnicodeSafeText(part.text, x, y);
          x += part.width;
        }
      }
      y += lh;
    }
    y += 4;
  }

  // --- Header: Title ---
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(SIZES.title);
  pdf.setTextColor(...COLORS.body);
  const titleSegs = [{ text: article.title, bold: true }];
  const titleLines = layoutSegmentsIntoLines(titleSegs, textW, SIZES.title);
  for (const line of titleLines) {
    ensureSpace(Math.round(SIZES.title * 1.6));
    let x = margin;
    for (const part of line) {
      if (part.fragments) {
        x = drawFragments(part.fragments, x, y, part, SIZES.title);
      } else {
        drawUnicodeSafeText(part.text, x, y);
        x += part.width;
      }
    }
    y += Math.round(SIZES.title * 1.2);
  }

  // --- Header: Subtitle ---
  if (article.subtitle && article.subtitle.trim()) {
    const lh = Math.round(SIZES.subtitle * 1.5);
    ensureSpace(lh);
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(SIZES.subtitle);
    pdf.setTextColor(...COLORS.muted);
    const subSegs = [{ text: article.subtitle.trim(), italic: true }];
    const subLines = layoutSegmentsIntoLines(subSegs, textW, SIZES.subtitle);
    for (const line of subLines) {
      ensureSpace(lh);
      let x = margin;
      for (const part of line) {
        if (part.fragments) {
          x = drawFragments(part.fragments, x, y, part, SIZES.subtitle);
        } else {
          drawUnicodeSafeText(part.text, x, y);
          x += part.width;
        }
      }
      y += lh;
    }
  }

  // Separator after heading+subtitle
  drawHr();

  // --- Header: Meta (center aligned) ---
  const centerX = margin + textW / 2;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(SIZES.meta);
  pdf.setTextColor(...COLORS.muted);
  const metaParts = [];
  if (article.author) metaParts.push(article.author);
  if (article.readingTimeMinutes) metaParts.push(`${article.readingTimeMinutes} min read`);
  if (article.publishedDate) metaParts.push(article.publishedDate);
  if (metaParts.length) {
    ensureSpace(Math.round(SIZES.meta * 1.6));
    const txt = metaParts.join("  •  ");
    // Center align with emoji-aware layout
    const segs = [{ text: txt }];
    const lines = layoutSegmentsIntoLines(segs, textW, SIZES.meta);
    for (const line of lines) {
      let totalWidth = 0;
      for (const part of line) totalWidth += part.width;
      let x = margin + (textW - totalWidth) / 2;
      for (const part of line) {
        if (part.fragments) {
          x = drawFragments(part.fragments, x, y, part, SIZES.meta);
        } else {
          pdf.text(part.text, x, y);
          x += part.width;
        }
      }
    }
    y += 18;
  }

  // --- Header: URL (clickable, center) ---
  if (article.canonicalUrl) {
    ensureSpace(Math.round(SIZES.meta * 1.6));
    pdf.setTextColor(...COLORS.link);
    const urlTxt = article.canonicalUrl;
    const segs = [{ text: urlTxt, link: article.canonicalUrl }];
    const lines = layoutSegmentsIntoLines(segs, textW, SIZES.meta);
    for (const line of lines) {
      let totalWidth = 0;
      for (const part of line) totalWidth += part.width;
      let x = margin + (textW - totalWidth) / 2;
      for (const part of line) {
        if (part.fragments) {
          const startX = x;
          x = drawFragments(part.fragments, x, y, part, SIZES.meta);
          const lw = x - startX;
          if (lw > 0) {
            const ascent = Math.round(SIZES.meta * 0.8);
            const height = Math.max(8, Math.round(SIZES.meta * 1.2));
            pdf.link(startX, y - ascent, lw, height, { url: article.canonicalUrl });
          }
        } else {
          pdf.textWithLink(part.text, x, y, { url: article.canonicalUrl });
          x += part.width;
        }
      }
    }
    y += 18;
  }

  // Separator before hero
  drawHr();

  // --- Header: Hero image (centered) ---
  if (article.heroImage && article.heroImage.src) {
    await drawImage({ type: "image", src: article.heroImage.src, width: article.heroImage.width, height: article.heroImage.height });
  }

  // Track seen images to avoid duplicating the hero image in content
  const seenImageUrls = new Set();
  if (article.heroImage && article.heroImage.src) {
    seenImageUrls.add(normalizeUrl(article.heroImage.src));
  }

  // --- Content ---
  for (const block of article.blocks) {
    try { console.log("[popup] Rendering block:", { heading: block.heading || "", level: block.level || 0, items: (block.content || []).length }); } catch (_) {}
    // Heading
    if (block.heading && block.heading.trim()) {
      drawHeading(block.heading.trim(), Number(block.level || 2));
    }
    for (const item of block.content) {
      if (!item) continue;
      if (item.type === "paragraph") {
        drawParagraph(item.segments || []);
      } else if (item.type === "list") {
        drawList(item);
      } else if (item.type === "quote") {
        drawQuote(item.segments || []);
      } else if (item.type === "code") {
        drawCodeBlock(item);
      } else if (item.type === "hr") {
        drawHr();
      } else if (item.type === "image") {
        const norm = normalizeUrl(item.src);
        if (seenImageUrls.has(norm)) {
          // skip duplicate of hero or previously drawn image
        } else {
          await drawImage(item);
          seenImageUrls.add(norm);
        }
      } else if (item.type === "caption") {
        drawCaption(item.segments || []);
      } else {
        try { console.warn("[popup] Unknown item type skipped:", item && item.type, item); } catch (_) {}
      }
    }
    // subtle spacing between sections
    y += 6;
  }

  // --- Mentions appendix ---
  if (Array.isArray(article.mentions) && article.mentions.length) {
    // A few blank lines
    ensureSpace(LINE_HEIGHTS.body * 3);
    y += LINE_HEIGHTS.body * 3;

    // Horizontal separator
    drawHr();

    // Heading for mentions
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(SIZES.h3);
    pdf.setTextColor(...COLORS.body);
    ensureSpace(Math.round(SIZES.h3 * 1.5));
    drawTextWithEmojis("Other mentions by Author", margin, y, { bold: true, italic: false, mono: false }, SIZES.h3);
    y += Math.round(SIZES.h3 * 1.6);

    // Render: "domain | title" as a single clickable line per mention
    const listItems = article.mentions.map(m => {
      const url = m && m.url ? normalizeUrl(m.url) : null;
      const domain = url ? urlToDomain(url) : "";
      const title = (m && m.title) ? m.title : (url || "");
      const line = `${domain} | ${title}`;
      return [{ text: line, bold: false, link: url }];
    });
    drawList({ ordered: false, items: listItems });
  }

  // --- Filename formatting ---
  function sanitizeTitleForFilename(title) {
    const base = String(title || "").trim()
      .replace(/[–—:\-|]+.*/g, "") // drop subtitle after dash/em dash/colon/pipe
      .replace(/\s+/g, "_");
    // Remove characters illegal in filenames (Windows/macOS)
    return base.replace(/[\\/:*?"<>|]+/g, "").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  }

  function buildFilename(article) {
    const ymd = String(article.publishedDate || "").match(/^\d{4}-\d{2}-\d{2}$/)
      ? article.publishedDate
      : null;
    const safeTitle = sanitizeTitleForFilename(article.title);
    if (ymd) return `${ymd}-${safeTitle}.pdf`;
    return `${safeTitle || "article"}.pdf`;
  }

  // Create PDF outline/bookmarks from tracked headings
  PopupLogger.info(`Creating PDF outline with ${outlineHeadings.length} headings`);
  if (outlineHeadings.length > 0) {
    try {
      createPDFOutline(pdf, outlineHeadings);
      PopupLogger.success("PDF outline created successfully");
    } catch (outlineError) {
      PopupLogger.error("Failed to create PDF outline", outlineError);
    }
  } else {
    PopupLogger.info("No headings found for outline");
  }

  pdf.save(buildFilename(article));
}

function createPDFOutline(pdf, headings) {
  try {
    PopupLogger.info("Attempting to create PDF outline", { headings: headings.length });
    
    // Initialize outline object if it doesn't exist
    if (!pdf.outline) {
      PopupLogger.info("Initializing PDF outline object");
      // Create the outline object structure that jsPDF expects
      pdf.outline = {
        root: { 
          children: [],
          parent: null,
          title: 'Root',
          dest: null
        },
        createNamedDestinations: false,
        
        // Add the render method that jsPDF expects
        render: function() {
          return this.renderOutlineItems(this.root.children, 0);
        },
        
        renderOutlineItems: function(items, level) {
          let result = '';
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            result += `${level} 0 obj\n`;
            result += `<< /Title (${item.title}) `;
            if (item.dest) {
              result += `/Dest [${item.dest.join(' ')}] `;
            }
            if (item.children && item.children.length > 0) {
              result += `/Count ${item.children.length} `;
            }
            result += '>>\nendobj\n';
            
            if (item.children && item.children.length > 0) {
              result += this.renderOutlineItems(item.children, level + 1);
            }
          }
          return result;
        },
        
        makeRef: function(item) {
          return `${item.objId || 0} 0 R`;
        }
      };
    }

    // Clear any existing outline
    pdf.outline.root.children = [];
    
    PopupLogger.info("Creating hierarchical outline structure");

    // Build hierarchical structure
    const rootItems = [];
    const itemStack = []; // Stack to track parent items for hierarchy
    
    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      
      try {
        // Get page info using jsPDF's internal method
        const pageInfo = pdf.internal.getPageInfo(heading.page);
        if (!pageInfo) {
          PopupLogger.warn(`No page info for page ${heading.page}`);
          continue;
        }

        // Convert PDF coordinates properly for navigation
        // jsPDF uses points (pt) and bottom-left origin
        // The Y coordinate in the destination should be from the bottom of the page
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        // For PDF destinations, we want the Y coordinate from the bottom
        // heading.y is from the top, so we need: pageHeight - heading.y
        const destinationY = pageHeight - heading.y;

        // Create outline item
        const outlineItem = {
          title: heading.text,
          dest: [pageInfo.objId, 'XYZ', null, destinationY, null], // Y from bottom of page
          level: heading.level,
          children: [],
          parent: null,
          objId: i + 1
        };

        PopupLogger.info(`Creating outline item: "${heading.text}"`, {
          level: heading.level,
          page: heading.page,
          originalY: heading.y,
          pageHeight: pageHeight,
          destinationY: destinationY,
          pageObjId: pageInfo.objId
        });

        // Find the correct parent based on heading levels
        let parentItem = null;
        
        // Remove items from stack that are at same or higher level
        while (itemStack.length > 0 && itemStack[itemStack.length - 1].level >= heading.level) {
          itemStack.pop();
        }
        
        // If stack is not empty, the top item is our parent
        if (itemStack.length > 0) {
          parentItem = itemStack[itemStack.length - 1];
          parentItem.children.push(outlineItem);
          outlineItem.parent = parentItem;
          PopupLogger.info(`Added "${heading.text}" as child of "${parentItem.title}"`);
        } else {
          // This is a root-level item
          rootItems.push(outlineItem);
          pdf.outline.root.children.push(outlineItem);
          PopupLogger.info(`Added "${heading.text}" as root item`);
        }
        
        // Add this item to the stack for potential future children
        itemStack.push(outlineItem);
        
      } catch (itemError) {
        PopupLogger.error(`Failed to create outline item for "${heading.text}"`, itemError);
      }
    }

    PopupLogger.success(`Successfully created hierarchical outline with ${pdf.outline.root.children.length} root items`);
    
    // Log the hierarchy structure for debugging
    function logHierarchy(items, indent = '') {
      for (const item of items) {
        PopupLogger.info(`${indent}${item.title} (Level ${item.level}, Page ${item.dest[0]}, Y: ${item.dest[3]})`);
        if (item.children && item.children.length > 0) {
          logHierarchy(item.children, indent + '  ');
        }
      }
    }
    
    PopupLogger.group("Outline Hierarchy");
    logHierarchy(pdf.outline.root.children);
    PopupLogger.groupEnd();
    
  } catch (e) {
    PopupLogger.error("Failed to create PDF outline", e);
  }
}

function convertImageToDataURL(url, preferPng) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      // Clear canvas to transparent and draw; this preserves alpha when exporting PNG
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      if (preferPng) {
        resolve(canvas.toDataURL("image/png"));
      } else {
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      }
    };
    img.onerror = reject;
    img.src = url;
  });
}

// --- Chrome MV2-safe Promise wrappers ---
function queryTabs(queryInfo) {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.query(queryInfo, tabs => {
        const err = chrome.runtime && chrome.runtime.lastError;
        if (err) {
          reject(new Error(err.message || "tabs.query failed"));
          return;
        }
        resolve(tabs);
      });
    } catch (e) {
      reject(e);
    }
  });
}

// Inject content scripts at runtime for pages not covered by manifest matches (MV2-compatible)
function executeScriptMV2(tabId, file) {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.executeScript(tabId, { file }, () => {
        const err = chrome.runtime && chrome.runtime.lastError;
        if (err) {
          reject(new Error(err.message || "executeScript failed"));
          return;
        }
        resolve();
      });
    } catch (e) {
      reject(e);
    }
  });
}

function ensureContentScripts(tabId) {
  PopupLogger.info("Injecting content scripts into active tab (fallback)");
  try { updateStatus("Preparing extractor on this page…"); } catch (_) {}
  // Best effort: inject providers first (content depends on it), ignore if already present
  return executeScriptMV2(tabId, "providers.js")
    .catch(() => {})
    .then(() => executeScriptMV2(tabId, "content.js"))
    .then(() => {
      try { updateStatus("Extractor ready. Retrying…"); } catch (_) {}
      return new Promise(r => setTimeout(r, 100)); // allow listener to register
    });
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    function shouldTryInject(msg) {
      if (!msg) return false;
      const m = String(msg);
      return /Receiving end does not exist|Could not establish connection|The message port closed/i.test(m);
    }

    let timeoutId = null;

    const attempt = (hasRetried) => {
      let finished = false;
      try {
        chrome.tabs.sendMessage(tabId, message, response => {
          const err = chrome.runtime && chrome.runtime.lastError;
          if (timeoutId) { try { clearTimeout(timeoutId); } catch (_) {} }
          if (err) {
            if (!hasRetried && shouldTryInject(err.message)) {
              ensureContentScripts(tabId)
                .then(() => attempt(true))
                .catch(injectErr => {
                  reject(new Error((err.message || "sendMessage failed") + "; inject failed: " + (injectErr.message || injectErr)));
                });
              return;
            }
            reject(new Error(err.message || "sendMessage failed"));
            return;
          }
          finished = true;
          resolve(response);
        });

        // Timeout safeguard; if it fires and we haven't retried yet, attempt injection once
        timeoutId = setTimeout(() => {
          if (finished) return;
          if (!hasRetried) {
            ensureContentScripts(tabId)
              .then(() => attempt(true))
              .catch(e => reject(new Error("Timed out waiting for content script response; inject failed: " + (e.message || e))));
          } else {
            reject(new Error("Timed out waiting for content script response"));
          }
        }, 5000);
      } catch (e) {
        if (!hasRetried && shouldTryInject(e && e.message)) {
          ensureContentScripts(tabId)
            .then(() => attempt(true))
            .catch(injectErr => reject(new Error((e.message || "sendMessage failed") + "; inject failed: " + (injectErr.message || injectErr))));
          return;
        }
        reject(e);
      }
    };

    attempt(false);
  });
}
