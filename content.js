/**
 * Content Script for ArticleDoc Browser Extension
 *
 * This script runs on web pages to extract article content for PDF generation.
 * It coordinates with the popup script and provider system to identify and
 * extract structured article data from supported websites.
 *
 * Key responsibilities:
 * - Article content extraction and parsing
 * - Provider system integration for site-specific logic
 * - Cross-origin communication with popup script
 * - Performance monitoring and error handling
 * - DOM manipulation and content analysis
 */

/**
 * Enhanced Logging Utility for Content Script
 *
 * Provides comprehensive logging with session tracking, timestamps, and
 * different log levels for debugging article extraction processes.
 */
const Logger = {
  // Session tracking for correlating logs across extraction sessions
  startTime: Date.now(),
  sessionId: Math.random().toString(36).substr(2, 9),

  /**
   * Logs general information with timestamp and session context
   * @param {string} message - Log message
   * @param {Object|null} data - Additional structured data
   */
  log: (message, data = null) => {
    const timestamp = ((Date.now() - Logger.startTime) / 1000).toFixed(2) + 's';
    console.log(`[${timestamp}] 🔵 ${message}`, data ? { session: Logger.sessionId, ...data } : { session: Logger.sessionId });
  },

  /**
   * Logs warnings with context information
   * @param {string} message - Warning message
   * @param {Object|null} data - Additional context data
   */
  warn: (message, data = null) => {
    const timestamp = ((Date.now() - Logger.startTime) / 1000).toFixed(2) + 's';
    console.warn(`[${timestamp}] ⚠️ ${message}`, data ? { session: Logger.sessionId, ...data } : { session: Logger.sessionId });
  },

  /**
   * Logs errors with detailed error information and stack traces
   * @param {string} message - Error message
   * @param {Error|null} error - Error object with stack trace
   */
  error: (message, error = null) => {
    const timestamp = ((Date.now() - Logger.startTime) / 1000).toFixed(2) + 's';
    console.error(`[${timestamp}] ❌ ${message}`, {
      session: Logger.sessionId,
      error: error?.message || error,
      stack: error?.stack?.split('\n').slice(0, 3).join('\n')
    });
  },

  /**
   * Starts a collapsible console group for organizing related logs
   * @param {string} message - Group label
   */
  group: (message) => {
    console.group(`🔍 ${message}`);
  },

  /**
   * Ends the current console group
   */
  groupEnd: () => {
    console.groupEnd();
  },

  /**
   * Logs successful operations with context
   * @param {string} message - Success message
   * @param {Object|null} data - Additional success context
   */
  success: (message, data = null) => {
    const timestamp = ((Date.now() - Logger.startTime) / 1000).toFixed(2) + 's';
    console.log(`[${timestamp}] ✅ ${message}`, data ? { session: Logger.sessionId, ...data } : { session: Logger.sessionId });
  },

  /**
   * Logs informational messages with context
   * @param {string} message - Info message
   * @param {Object|null} data - Additional context data
   */
  info: (message, data = null) => {
    const timestamp = ((Date.now() - Logger.startTime) / 1000).toFixed(2) + 's';
    console.info(`[${timestamp}] ℹ️ ${message}`, data ? { session: Logger.sessionId, ...data } : { session: Logger.sessionId });
  }
};

/**
 * Performance Monitoring System
 *
 * Tracks execution time and memory usage during article extraction.
 * Helps identify performance bottlenecks and memory leaks.
 */
const PerformanceMonitor = {
  // Track when performance monitoring started
  startTime: performance.now(),

  /**
   * Measures elapsed time for a completed operation
   * @param {string} label - Description of the completed operation
   * @returns {number} Elapsed time in milliseconds
   */
  measure: (label) => {
    const elapsed = performance.now() - PerformanceMonitor.startTime;
    Logger.info(`${label} completed`, { duration: `${elapsed.toFixed(2)}ms` });
    return elapsed;
  },

  /**
   * Gets current memory usage information if available
   * @returns {Object|null} Memory usage stats or null if not supported
   */
  memory: () => {
    if (performance.memory) {
      return {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),   // MB
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024), // MB
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)  // MB
      };
    }
    return null;
  }
};

/**
 * Cross-Origin Message Handler
 *
 * Handles communication between content script and popup/background scripts.
 * Processes extraction requests and responds with article data or error information.
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Health check ping from other extension components
  if (msg && msg.type === "ping") {
    sendResponse({ ok: true, scope: "content" });
    return true; // Indicates async response handler
  }

  // Log incoming message details for debugging
  Logger.info("Message received", {
    action: msg.action,
    sender: sender?.id,
    url: location?.href?.substring(0, 100) + '...'
  });

  // Handle article extraction requests (supports multiple action types for compatibility)
  if (msg.action === "extractArticle" || msg.action === "forceExtractArticle" || msg.action === "extractMediumArticle") {
    Logger.group("Article Extraction Process");
    Logger.log("Starting article extraction", {
      action: msg.action,
      url: location?.href,
      hostname: location?.hostname
    });
    const startTime = performance.now();

    const isForce = msg.action === "forceExtractArticle";

    /**
     * Provider System Integration
     *
     * Uses the global provider registry to determine the appropriate extraction strategy:
     * - Checks if current URL matches any registered provider patterns
     * - Falls back to default Medium extraction logic if no provider matches
     * - Can be bypassed with "force" mode for debugging/troubleshooting
     */
    if (!isForce) {
      try {
        const href = (typeof location !== 'undefined' && location.href) ? location.href : null;
        const registry = window.__ArticleDocProviderRegistry;
        const provider = registry && href ? registry.findProviderByUrl(href) : null;
        if (!provider) {
          const host = String(location.hostname || "");
          Logger.warn("No provider matched", { hostname: host });
          Logger.info("Using Medium extraction as fallback");
          // Continue with extraction using Medium logic as fallback
        } else {
          // Check allowed action
          const action = msg.action === "extractMediumArticle" ? "extractArticle" : msg.action;
          if (!provider.isActionAllowed(action)) {
            Logger.error("Action not allowed by provider", { provider: provider.id, action });
            Logger.groupEnd();
            return sendResponse({ error: "Action not allowed for this site" });
          }
          Logger.success("Provider matched", { id: provider.id, name: provider.name });
        }
      } catch (_) {
        // If registry not available for some reason, continue with legacy allowlist (backward compat)
        const host = String(location.hostname || "");
        const isAllowed = /(^|\.)medium\.com$/i.test(host)
          || /^blog\.stackademic\.com$/i.test(host)
          || /^towardsdatascience\.com$/i.test(host);
        if (!isAllowed) {
          Logger.warn("No provider matched (legacy)", { hostname: host });
          Logger.info("Using Medium extraction as fallback");
          // Continue with extraction using Medium logic as fallback
        } else {
          Logger.success("Site supported (fallback allowlist)", { hostname: host });
        }
      }
    } else {
      Logger.info("Force extraction requested: using Medium logic as fallback");
    }

    /**
     * Intelligent Article Container Detection
     *
     * Uses heuristic scoring to identify the main article content area:
     * 1. Finds all paragraph elements on the page
     * 2. Scores potential container elements based on paragraph density
     * 3. Prefers containers with longer, substantive paragraphs
     * 4. Considers semantic HTML elements (article, main, section)
     */
    function findBestArticleContainerHeuristic() {
      Logger.log("Searching for best article container using heuristics");
      try {
        const paragraphs = Array.from(document.querySelectorAll("p"));
        const candidateScoreByElement = new Map();

        // Score potential container elements based on paragraph content
        for (const p of paragraphs) {
          const text = (p.innerText || "").trim();
          if (text.length < 80) continue; // prefer substantive paragraphs (>80 chars)
          let ancestor = p;

          // Walk up the DOM tree to find potential container elements
          for (let i = 0; i < 6 && ancestor; i++) {
            ancestor = ancestor.parentElement;
            if (!ancestor) break;
            // Only consider semantic container elements
            if (!/^(ARTICLE|MAIN|SECTION|DIV)$/i.test(ancestor.tagName)) continue;
            const prev = candidateScoreByElement.get(ancestor) || 0;
            candidateScoreByElement.set(ancestor, prev + 1);
          }
        }

        // Find the container with highest score
        let best = null;
        let maxScore = 0;
        for (const [el, score] of candidateScoreByElement.entries()) {
          if (score > maxScore) { maxScore = score; best = el; }
        }
        if (best) {
          Logger.success("Found container via heuristic", { tag: best.tagName, score: maxScore });
        }
        return best || null;
      } catch (error) {
        Logger.warn("Heuristic container search failed", { error: error.message });
        return null;
      }
    }

    Logger.group("Article Container Selection");
    const selectors = [
      "article",
      "main article",
      "div[data-test-id=\"post-content\"]",
      "div[data-testid=\"storyContent\"]",
      "section[data-testid=\"storyContent\"]",
      "div[data-testid=\"postContent\"]",
      "div[role=\"main\"] article",
      "main",
      "div[role=\"main\"]",
      "h1.closest(article, main, section, div)",
      "findBestArticleContainerHeuristic()"
    ];

    let originalArticle = null;
    for (let i = 0; i < selectors.length && !originalArticle; i++) {
      const selector = selectors[i];
      if (typeof selector === 'string') {
        originalArticle = document.querySelector(selector);
        if (originalArticle) {
          Logger.success(`Found container via selector ${i + 1}`, { selector });
          break;
        }
      } else {
        originalArticle = findBestArticleContainerHeuristic();
        if (originalArticle) break;
      }
    }

    if (!originalArticle) {
      Logger.error("No article container found");
      Logger.groupEnd();
      Logger.groupEnd();
      return sendResponse({ error: "No article found" });
    }

    // Container details
    const containerInfo = {
      tag: originalArticle.tagName,
      id: originalArticle.id || null,
      className: (originalArticle.getAttribute("class") || "").substring(0, 100),
      childCount: originalArticle.children.length,
      textLength: (originalArticle.textContent || "").length
    };
    Logger.info("Container details", containerInfo);
    Logger.groupEnd();

    // Work on a clone to avoid mutating the live DOM
    const article = originalArticle.cloneNode(true);

    Logger.group("Content Pruning Phase");
    // Remove clearly irrelevant elements (measure removals)
    const tagPruneSelector = "aside, footer, header, nav, form, script, style, noscript, iframe, svg, button";
    const tagPruneEls = Array.from(article.querySelectorAll(tagPruneSelector));
    for (const el of tagPruneEls) el.remove();
    Logger.info("Pruned by tag", { selector: tagPruneSelector, count: tagPruneEls.length });

    // Remove common Medium noise blocks by class name (be conservative)
    const CLASS_PRUNE_RE = /(^|\b)(promo|responses|metered|recommend|footer|bottom|clap|paywall|signup|response|js-stickyFooter)(\b|$)/i;
    let removedByClass = 0;
    const lastFew = [];
    article.querySelectorAll("div").forEach(el => {
      const className = el.className || "";
      if (CLASS_PRUNE_RE.test(className)) {
        removedByClass++;
        if (lastFew.length < 5) lastFew.push((className || "").toString().split(/\s+/).slice(0, 3).join(" "));
        el.remove();
      }
    });
    Logger.info("Pruned by class", { count: removedByClass, sampleClasses: lastFew });

    // Show remaining content stats after pruning
    const remainingElements = article.querySelectorAll("*").length;
    const remainingTextLength = (article.textContent || "").length;
    Logger.info("After pruning", { elements: remainingElements, textLength: remainingTextLength });
    Logger.groupEnd();
    // Keep figure captions for PDF rendering

    // --- Metadata helpers ---
    function toYYYYMMDD(dateInput) {
      const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
      if (Number.isNaN(date.getTime())) return null;
      const pad = n => String(n).padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    function findPublishedISOFromMeta() {
      const m1 = document.querySelector('meta[property="article:published_time"]')?.content;
      if (m1) return m1;
      const m2 = document.querySelector('meta[name="pubdate"]')?.content;
      if (m2) return m2;
      const m3 = document.querySelector('meta[name="date"]')?.content;
      if (m3) return m3;
      return null;
    }

    function findPublishedISOFromJSONLD() {
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      for (const s of scripts) {
        try {
          const txt = s.textContent || s.innerText || "";
          if (!txt.trim()) continue;
          const data = JSON.parse(txt);
          const candidates = Array.isArray(data) ? data : [data];
          for (const obj of candidates) {
            if (!obj || typeof obj !== "object") continue;
            if (obj.datePublished) return obj.datePublished;
            if (obj["@graph"]) {
              for (const g of obj["@graph"]) {
                if (g && g.datePublished) return g.datePublished;
              }
            }
          }
        } catch (_) {
          // ignore malformed JSON-LD blocks
        }
      }
      return null;
    }

    function findPublishedISOFromTime() {
      const t = document.querySelector("time[datetime]");
      if (t && t.getAttribute("datetime")) return t.getAttribute("datetime");
      return null;
    }

    function getPublishedDate() {
      const iso =
        findPublishedISOFromMeta() ||
        findPublishedISOFromJSONLD() ||
        findPublishedISOFromTime();
      if (!iso) return null;
      const d = new Date(iso);
      if (!Number.isNaN(d.getTime())) return toYYYYMMDD(d);
      const m = String(iso).match(/(\d{4}-\d{2}-\d{2})/);
      return m ? m[1] : null;
    }

    // --- Helpers ---
    const DROP_TEXT_PATTERNS = [
      /press\s+enter\s+or\s+click\s+to\s+view\s+image\s+in\s+full\s+size/i,
      /^\s*(?:🔒\s*)?members?[-\s]?only\s+story\s*$/i
    ];

    // Treat bare "Introduction" (optionally with trailing punctuation) as non-content heading
    const INTRO_HEADING_RE = /^\s*introduction\s*[:.\-—–]*\s*$/i;

    function shouldDropText(text) {
      if (!text) return true;
      const t = text.trim();
      if (!t) return true;
      return DROP_TEXT_PATTERNS.some(r => r.test(t));
    }

    function getSegmentsFromNode(node, base = { bold: false, italic: false, mono: false, link: null }) {
      const segments = [];
      if (!node) return segments;
      if (node.nodeType === Node.TEXT_NODE) {
        // Preserve whitespace and newlines when inside <code> (mono)
        const raw = String(node.nodeValue || "");
        const text = base.mono
          ? raw.replace(/\u00A0/g, " ") // keep spaces/newlines as-is for code
          : raw.replace(/[\s\u00A0]+/g, " ");
        if (!shouldDropText(text)) segments.push({ text, bold: base.bold, italic: base.italic, mono: base.mono, link: base.link });
        return segments;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node;
        const tag = el.tagName;
        const next = { ...base };
        if (tag === "STRONG" || tag === "B") next.bold = true;
        if (tag === "EM" || tag === "I") next.italic = true;
        if (tag === "CODE") next.mono = true;
        if (tag === "A") {
          const href = el.getAttribute("href");
          try {
            next.link = href ? new URL(href, location.href).href : null;
          } catch {
            next.link = href || null;
          }
        }
        if (tag === "BR") {
          segments.push({ text: "\n", bold: next.bold, italic: next.italic, mono: next.mono, link: next.link });
          return segments;
        }
        for (const child of Array.from(el.childNodes)) {
          segments.push(...getSegmentsFromNode(child, next));
        }
        return segments;
      }
      return segments;
    }

    function extractParagraph(el) {
      const segs = getSegmentsFromNode(el, {});
      // Merge adjacent segments with identical styles to reduce chatter
      const merged = [];
      for (const s of segs) {
        const last = merged[merged.length - 1];
        if (last && last.bold === s.bold && last.italic === s.italic && last.mono === s.mono && last.link === s.link) {
          last.text += s.text;
        } else {
          merged.push({ ...s });
        }
      }
      // Remove if all text is droppable or empty
      const combined = merged.map(s => s.text).join("").trim();
      if (shouldDropText(combined)) return null;
      return { type: "paragraph", segments: merged };
    }

    function extractList(listEl) {
      const ordered = listEl.tagName === "OL";
      const items = [];
      for (const li of Array.from(listEl.querySelectorAll(":scope > li"))) {
        const para = extractParagraph(li);
        if (para && para.segments && para.segments.length) items.push(para.segments);
      }
      if (!items.length) return null;
      return { type: "list", ordered, items };
    }

    function extractQuote(el) {
      const para = extractParagraph(el);
      if (!para) return null;
      return { type: "quote", segments: para.segments };
    }

    function getTextWithLineBreaksForCode(element) {
      // Clone to avoid mutating live DOM
      const clone = element.cloneNode(true);
      // Convert <br> to explicit newlines
      clone.querySelectorAll("br").forEach(br => {
        br.replaceWith(document.createTextNode("\n"));
      });
      // Append newline at the end of common block-like wrappers used by highlighters
      clone.querySelectorAll("div, p, li, pre").forEach(block => {
        // Avoid double-appending if the last node already is a newline
        const last = block.lastChild;
        const needsNewline = !last || !(last.nodeType === Node.TEXT_NODE && /\n$/.test(String(last.nodeValue)));
        if (needsNewline) block.appendChild(document.createTextNode("\n"));
      });
      // Fallback to textContent which now includes our injected newlines
      return clone.textContent || "";
    }

    function extractCodeBlock(el) {
      // Prefer inner <code> if present to detect language
      const codeEl = el.querySelector("code") || el;
      let lang = null;
      const cls = String(codeEl.getAttribute("class") || el.getAttribute("class") || "");
      const dataLang = codeEl.getAttribute("data-lang") || el.getAttribute("data-lang");
      const m = cls.match(/language-([A-Za-z0-9+#]+)/) || cls.match(/lang-([A-Za-z0-9+#]+)/);
      if (dataLang) lang = String(dataLang).toLowerCase();
      else if (m) lang = String(m[1]).toLowerCase();

      // Build text preserving line breaks across <br> and common block wrappers
      let text = getTextWithLineBreaksForCode(codeEl);
      if (!/\n/.test(text)) {
        // Heuristic fallback: innerText sometimes includes visual line breaks
        text = codeEl.innerText || text;
      }
      // Normalize NBSP and CR, collapse 3+ blank lines, and trim trailing block whitespace
      const t = text
        .replace(/\u00A0/g, " ")
        .replace(/\r/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/\s+$/, "");
      if (!t.trim()) return null;
      return { type: "code", text: t, lang };
    }

    function isCodeLike(el) {
      if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
      // Treat a real PRE as the canonical code block
      if (el.tagName === "PRE") return true;
      // If this node lives inside an existing PRE/CODE, skip to avoid duplicates
      if (el.closest("pre, code")) return false;
      // If this node contains a PRE anywhere inside, let the PRE instance handle it
      if (el.querySelector("pre")) return false;
      // Highlight.js style spans inside indicate code formatting
      const hasHljs = !!el.querySelector('[class*="hljs-"]');
      if (!hasHljs) return false;
      // Require at least one <br> (multi-line) or at least two hljs spans to reduce false positives
      const numBr = el.querySelectorAll("br").length;
      const numHljsSpans = el.querySelectorAll('[class*="hljs-"]').length;
      return numBr >= 1 || numHljsSpans >= 2;
    }

    function looksLikeAvatar(el) {
      const alt = (el.getAttribute("alt") || "").toLowerCase();
      const cls = (el.getAttribute("class") || "").toLowerCase();
      const w = Number(el.getAttribute("width")) || el.naturalWidth || 0;
      const h = Number(el.getAttribute("height")) || el.naturalHeight || 0;
      if (/avatar|author|profile|face|userpic/.test(alt + " " + cls)) return true;
      if (w && h && Math.abs(w - h) <= 4 && Math.max(w, h) <= 128) return true; // small square heads
      return false;
    }

    function extractImage(el) {
      const src = el.getAttribute("src") || el.src;
      if (!src) return null;
      const width = Number(el.getAttribute("width")) || el.naturalWidth || null;
      const height = Number(el.getAttribute("height")) || el.naturalHeight || null;
      if (looksLikeAvatar(el)) return null; // drop author/avatar images
      return { type: "image", src, width, height };
    }

    function toAbsoluteUrl(href) {
      if (!href) return null;
      try {
        return new URL(href, location.href).href;
      } catch (_) {
        return href;
      }
    }

    function normalizeMentionUrl(href) {
      if (!href) return null;
      try {
        const u = new URL(href, location.href);

        // Unwrap common redirectors before stripping query params
        // Medium redirector: https://medium.com/r/?url=<target>
        try {
          const host = String(u.hostname || "").toLowerCase();
          const path = String(u.pathname || "");
          if ((/(^|\.)medium\.com$/i.test(host) && /^\/r\//.test(path)) || (/^\/redirect$/i.test(path))) {
            const inner = u.searchParams.get('url') || u.searchParams.get('to');
            if (inner) return normalizeMentionUrl(inner);
          }
          // Google redirector: https://www.google.com/url?q=<target>
          if (/(^|\.)google\.com$/i.test(host) && /^\/url$/i.test(path)) {
            const q = u.searchParams.get('q');
            if (q) return normalizeMentionUrl(q);
          }
          // AMP canonical: https://amp.<domain>/<...> or /amp/s/<domain>/<...>
          if (/^\/amp\/s\//i.test(path)) {
            const rest = path.replace(/^\/amp\/s\//i, "");
            return normalizeMentionUrl('https://' + rest);
          }
        } catch (_) {}

        // Strip tracking parameters and hash fragments universally
        u.search = "";
        u.hash = "";
        return u.href;
      } catch (_) {
        const s = String(href);
        const noHash = s.split("#")[0];
        return noHash.split("?")[0];
      }
    }

    function canonicalizeUrlForDedupe(href) {
      if (!href) return null;
      try {
        const u = new URL(href, location.href);
        let protocol = 'https:'; // normalize to https
        let host = String(u.hostname || '').toLowerCase();
        if (host.startsWith('www.')) host = host.substring(4);
        // Remove default ports
        let port = u.port ? String(u.port) : '';
        if ((protocol === 'https:' && port === '443') || (protocol === 'http:' && port === '80')) port = '';
        // Normalize path: collapse multiple slashes, remove trailing slash, lowercase for stability
        let path = String(u.pathname || '/').replace(/\/+/g, '/');
        // decode percent-encodings where safe
        try { path = decodeURIComponent(path); } catch (_) {}
        path = path.replace(/\/+/g, '/');
        if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
        // Many servers are case-sensitive, but for dedupe we prefer forgiving normalization
        path = path;
        // Build canonical string without query/hash
        return protocol + '//' + host + (port ? (':' + port) : '') + path;
      } catch (_) {
        // Fallback: basic trimming and www normalization
        const s = String(href).trim();
        return s.replace(/^https?:\/\//i, 'https://').replace(/^(https:\/\/)?www\./i, '$1').replace(/\/$/, '');
      }
    }

    // CardDetector utility class for detecting and extracting mention cards
    class CardDetector {
      constructor() {
        this.processedElements = new Set();
        this.results = [];
      }

      // Detect if an element has the characteristic Medium card structure
      hasCardStructure(element) {
        // Check for the typical Medium card classes (obfuscated q* classnames and r*)
        const className = String(element.className || "");
        const cardClasses = /\bq[a-z]\b|\br[a-z]\b/; // broader match for obfuscated Medium classes like qd, qi, qv, qw, qx, qy, qz, ra, etc.
        if (cardClasses.test(className)) return true;

        // Fallback: structural detection — a link card usually has an <a> with an <h2> (title)
        // and optionally an <h3> (subtitle) and a <p> (domain) somewhere inside
        const hasAnchorWithH2 = !!element.querySelector('a[href] h2');
        if (hasAnchorWithH2) return true;

        // Or at least both an anchor and an h2 within the same container
        const hasAnchor = !!element.querySelector('a[href]');
        const hasH2 = !!element.querySelector('h2');
        if (hasAnchor && hasH2) return true;

        return false;
      }

      // Extract card information from an anchor element
      extractFromAnchor(anchor) {
        if (this.processedElements.has(anchor)) return null;

        const titleEl = anchor.querySelector('h2');
        const subtitleEl = anchor.querySelector('h3');
        const domainEl = anchor.querySelector('p');

        const title = titleEl ? String(titleEl.innerText || '').trim() : null;
        const subtitle = subtitleEl ? String(subtitleEl.innerText || '').trim() : null;
        const domain = domainEl ? String(domainEl.innerText || '').trim() : null;
        const url = normalizeMentionUrl(toAbsoluteUrl(anchor.getAttribute('href')));

        // Skip discovery/recirculation anchors and post preview widgets
        try {
          if (anchor.hasAttribute && anchor.hasAttribute('data-discover')) return null;
          const href = anchor.getAttribute && anchor.getAttribute('href');
          if (href && /(author_recirc|read_next_recirc|post_responses)/i.test(String(href))) return null;
          if (anchor.closest && anchor.closest('[data-testid="post-preview"]')) return null;
        } catch (_) {}

        if (title && url) {
          const card = { title, subtitle, domain, url };
          Logger.info("Found mention card (anchor)", card);
          this.results.push(card);
          this.processedElements.add(anchor);
          return card;
        }
        return null;
      }

      // Extract card information from a div element (fallback)
      extractFromDiv(div) {
        if (this.processedElements.has(div)) return null;

        const titleEl = div.querySelector('h2');
        const subtitleEl = div.querySelector('h3');
        const linkEl = div.querySelector('a[href]');
        const domainEl = div.querySelector('p');

        const title = titleEl ? String(titleEl.innerText || '').trim() : null;
        const subtitle = subtitleEl ? String(subtitleEl.innerText || '').trim() : null;
        const domain = domainEl ? String(domainEl.innerText || '').trim() : null;
        const url = linkEl ? normalizeMentionUrl(toAbsoluteUrl(linkEl.getAttribute('href'))) : null;

        // Validate card structure
        if (!title || title.length > 100 || !url) return null;

        // Skip sections that look like article conclusions or author bios
        if (/\b(conclusion|summary|references?|about|author|bio)\b/i.test(title)) {
          return null;
        }

        // Skip Medium's built-in sections that aren't actual "mentions by author"
        if (/\bmore from\s+\w+\b/i.test(title)) {
          return null; // Skip "More from [Author]" sections
        }
        if (/\brecommended from medium\b/i.test(title)) {
          return null; // Skip "Recommended from Medium" sections
        }

        // Skip known post preview containers and recirculation anchors
        try {
          if (div.getAttribute && div.getAttribute('data-testid') === 'post-preview') return null;
          if (div.closest && div.closest('[data-testid="post-preview"]')) return null;
          if (linkEl) {
            if (linkEl.hasAttribute && linkEl.hasAttribute('data-discover')) return null;
            const href = linkEl.getAttribute && linkEl.getAttribute('href');
            if (href && /(author_recirc|read_next_recirc|post_responses)/i.test(String(href))) return null;
          }
        } catch (_) {}

        // Avoid enormous containers (likely the whole article wrapper)
        const childCount = div.children ? div.children.length : 0;
        if (childCount > 20) return null;

        const card = { title, subtitle, domain, url };
        Logger.info("Found mention card (div)", { ...card, className: div.className });
        this.results.push(card);
        this.processedElements.add(div);
        return card;
      }

      // Remove a card element safely
      removeCard(cardElement, root) {
        let cardRoot = cardElement.closest('div[class*="q"]');
        if (!cardRoot) {
          cardRoot = cardElement.parentElement;
          // Climb to the nearest DIV container but stop at root
          while (cardRoot && cardRoot !== root && cardRoot.tagName !== 'DIV') {
            cardRoot = cardRoot.parentElement;
          }
        }

        let removed = false;
        if (cardRoot && root.contains(cardRoot)) {
          // Only remove the container if it doesn't contain other likely article content outside the card
          const others = Array.from(cardRoot.querySelectorAll(
            "p, h2, h3, h4, h5, h6, pre, ul, ol, blockquote, img, figcaption, div[data-selectable-paragraph], span[data-selectable-paragraph]"
          )).filter(n => !cardElement.contains(n));

          if (others.length === 0) {
            cardRoot.remove();
            removed = true;
            console.log("[content] Removed card container:", cardRoot.className);
          }
        }

        if (!removed) {
          cardElement.remove();
          console.log("[content] Removed card element only");
        }
      }

      // Main detection method
      detectCards(root) {
        this.results = [];
        this.processedElements = new Set();

        // Pass 1: Detect cards by their characteristic structure (div containers)
        const cardContainers = Array.from(root.querySelectorAll('div')).filter(div =>
          this.hasCardStructure(div) && div.querySelector('h2')
        );

        for (const container of cardContainers) {
          if (this.processedElements.has(container)) continue;

          const anchor = container.querySelector('a[href]');
          if (anchor) {
            // This is an anchor-based card
            const card = this.extractFromAnchor(anchor);
            if (card) {
              this.removeCard(anchor, root);
            }
          } else {
            // This is a div-based card (fallback)
            const card = this.extractFromDiv(container);
            if (card) {
              container.remove();
            }
          }
        }

        // Pass 2: Anchor-first detection for cases where the anchor itself is the card root
        // Example: <div class="..."><a href="..."><div> <h2>...</h2> <h3>...</h3> <p>domain</p> ... </div></a></div>
        const anchorCandidates = Array.from(root.querySelectorAll('a[href]')).filter(a => a.querySelector('h2'));
        for (const a of anchorCandidates) {
          if (this.processedElements.has(a)) continue;
          const card = this.extractFromAnchor(a);
          if (card) {
            this.removeCard(a, root);
          }
        }

        return this.results;
      }
    }

    function extractMentionsAndPrune(root) {
      const cardDetector = new CardDetector();
      return cardDetector.detectCards(root);
    }

    // Scan live document for Medium redirect/link cards that appear visually after the article
    function extractMentionsAfterArticle(articleEl) {
      const cardDetector = new CardDetector();
      const results = [];
      if (!articleEl || typeof articleEl.getBoundingClientRect !== "function") return results;

      function isInResponsesArea(node) {
        try {
          let cur = node;
          let steps = 0;
          while (cur && cur !== document.body && steps < 12) {
            steps++;
            const cls = String(cur.className || "");
            const testid = (cur.getAttribute && cur.getAttribute('data-testid')) || "";
            const ariaLabel = (cur.getAttribute && cur.getAttribute('aria-label')) || "";
            // Class or attributes indicating responses/comments
            if (/\b(responses?|comments?|post_responses)\b/i.test(cls)) return true;
            if (/responses?/i.test(String(testid))) return true;
            if (/responses?/i.test(String(ariaLabel))) return true;
            // A nearby heading explicitly saying "Responses (...)"
            const h2 = cur.querySelector && (cur.querySelector(':scope > h2') || cur.querySelector('h2'));
            const h2Text = h2 ? String(h2.innerText || '').trim() : '';
            if (/^responses\s*\(/i.test(h2Text)) return true;
            cur = cur.parentElement;
          }
        } catch (_) {}
        return false;
      }

      function hasRecirculationMarker(href) {
        if (!href) return false;
        try {
          const raw = String(href);
          // Medium appends source markers for various recirculation widgets
          if (/(post_responses|author_recirc|read_next_recirc)/i.test(raw)) return true;
          const u = new URL(href, location.href);
          const search = String(u.search || "");
          if (/(post_responses|author_recirc|read_next_recirc)/i.test(search)) return true;
          return false;
        } catch (_) {
          return /(post_responses|author_recirc|read_next_recirc)/i.test(String(href));
        }
      }

      let articleBottom = 0;
      try {
        articleBottom = articleEl.getBoundingClientRect().bottom;
      } catch (_) {
        articleBottom = 0;
      }

      // Collect div-based candidates (structural or class-based)
      const divCandidates = Array.from(document.querySelectorAll("div")).filter(div => {
        if (!div) return false;
        if (articleEl.contains(div)) return false; // inside-article handled elsewhere
        if (isInResponsesArea(div)) return false; // exclude comment/response areas
        // Exclude known recirculation container types
        if (div.getAttribute && div.getAttribute('data-testid') === 'post-preview') return false;
        if (!cardDetector.hasCardStructure(div)) return false;
        const hasH2 = !!div.querySelector(":scope > h2") || !!div.querySelector("h2");
        if (!hasH2) return false;
        const txt = (div.innerText || "").trim();
        if (!txt) return false;
        const childCount = div.children ? div.children.length : 0;
        if (childCount > 20) return false;
        let top = 0;
        try { top = div.getBoundingClientRect().top; } catch (_) { top = 0; }
        if (top <= articleBottom) return false;
        const style = window.getComputedStyle(div);
        if (style && (style.position === "fixed" || style.position === "sticky")) return false;
        return true;
      });

      // Collect anchor-based candidates directly (for wrappers where only the <a> has the card structure)
      const anchorCandidates = Array.from(document.querySelectorAll('a[href]')).filter(a => {
        if (!a) return false;
        if (articleEl.contains(a)) return false;
        if (isInResponsesArea(a)) return false; // exclude responses/comments
        if (!a.querySelector('h2')) return false;
        // Exclude discovery/recirc links
        if (a.hasAttribute('data-discover')) return false;
        if (hasRecirculationMarker(a.getAttribute('href'))) return false;
        // Must be visually after article
        let top = 0;
        try { top = a.getBoundingClientRect().top; } catch (_) { top = 0; }
        if (top <= articleBottom) return false;
        // Not sticky/fixed
        const style = window.getComputedStyle(a);
        if (style && (style.position === 'fixed' || style.position === 'sticky')) return false;
        return true;
      });

      const candidates = [...divCandidates, ...anchorCandidates];

      for (const card of candidates) {
        if (cardDetector.processedElements.has(card)) continue;

        const titleEl = card.querySelector(":scope > h2") || card.querySelector("h2");
        const subtitleEl = card.querySelector("h3");
        const linkEl = card.tagName === 'A' ? card : card.querySelector("a[href]");
        const domainEl = card.querySelector("p");

        const title = titleEl ? String(titleEl.innerText || "").trim() : null;
        const subtitle = subtitleEl ? String(subtitleEl.innerText || "").trim() : null;
        const domain = domainEl ? String(domainEl.innerText || "").trim() : null;
        const hrefRaw = linkEl ? linkEl.getAttribute("href") : null;
        if (hrefRaw && hasRecirculationMarker(hrefRaw)) {
          continue; // skip links marked as coming from responses
        }
        const url = linkEl ? normalizeMentionUrl(toAbsoluteUrl(hrefRaw)) : null;

        // Skip sections that look like author bios or references
        if (/\b(conclusion|summary|references?|about|author|bio)\b/i.test(String(title || ""))) {
          continue;
        }

        // Skip Medium's built-in sections that aren't actual "mentions by author"
        if (/\bmore from\s+\w+\b/i.test(String(title || ""))) {
          continue; // Skip "More from [Author]" sections
        }
        if (/\brecommended from medium\b/i.test(String(title || ""))) {
          continue; // Skip "Recommended from Medium" sections
        }

        // Skip post-preview cards (these are Medium's article preview widgets)
        if (card.querySelector && card.querySelector('[data-testid="post-preview"]')) {
          continue;
        }

        if (title && url) {
          const cardData = { title, subtitle, domain, url };
          console.log("[content] Found mention card (after article):", cardData);
          results.push(cardData);
          cardDetector.processedElements.add(card);
        }
      }
      return results;
    }

    function dedupeMentions(arr) {
      const out = [];
      const seen = new Set();
      for (const m of arr || []) {
        if (!m) continue;
        const url = m.url ? normalizeMentionUrl(m.url) : null;
        const canon = url ? canonicalizeUrlForDedupe(url) : null;
        const titleKey = (m.title || "").trim().toLowerCase();
        // Prefer URL-based key; scheme-insensitive, no www, no trailing slash
        const key = canon ? ("u:" + canon) : ("t:" + titleKey);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(m);
      }
      return out;
    }

    // --- Extract metadata ---
    const title = document.querySelector("h1")?.innerText?.trim() || document.title;
    const subtitle = (function () {
      // Medium often uses h2 right under h1 as subtitle or a styled paragraph after h1
      const h2 = article.querySelector("h2");
      if (h2) {
        const t = h2.innerText.trim();
        if (t && t.length > 0 && !INTRO_HEADING_RE.test(t)) return t;
      }
      const p = article.querySelector("p");
      if (p) {
        const t = p.innerText.trim();
        if (t && t.length > 0 && t.length <= 200) return t; // heuristically short intro line
      }
      return null;
    })();
    const author =
      document.querySelector('meta[name="author"]')?.content ||
      document.querySelector("a.ds-link")?.innerText ||
      "Unknown";
    const publishedDate = getPublishedDate();
    const readingTimeMinutes = (function () {
      // Medium exposes reading time in JSON-LD sometimes
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      for (const s of scripts) {
        try {
          const data = JSON.parse(s.textContent || s.innerText || "{}");
          const nodes = Array.isArray(data) ? data : [data];
          for (const n of nodes) {
            if (n && typeof n === "object" && n.timeRequired) {
              // ISO 8601 duration like PT7M
              const m = String(n.timeRequired).match(/PT(\d+)M/);
              if (m) return Number(m[1]);
            }
          }
        } catch (_) {}
      }
      // Fallback: estimate by words (200 wpm)
      const text = (article.innerText || "").replace(/\s+/g, " ").trim();
      const words = text ? text.split(/\s+/).length : 0;
      return words ? Math.max(1, Math.round(words / 200)) : null;
    })();

    const canonicalUrl = (function () {
      const c = document.querySelector('link[rel="canonical"]')?.href;
      if (c) return c;
      try { return location.href; } catch { return null; }
    })();

    const heroImage = (function () {
      // Prefer first <figure> or first <img> in the article
      const imgs = Array.from(article.querySelectorAll("figure img, img"));
      const img = imgs.find(i => !looksLikeAvatar(i));
      if (!img) return null;
      const src = img.getAttribute("src") || img.src;
      if (!src) return null;
      const width = Number(img.getAttribute("width")) || img.naturalWidth || null;
      const height = Number(img.getAttribute("height")) || img.naturalHeight || null;
      return { src, width, height };
    })();

    Logger.group("Mention Cards Detection & Pruning");
    // --- Extract mentions (link cards) and prune from article ---
    const mentionsInside = extractMentionsAndPrune(article);
    // --- Also capture any similar cards that appear after the article on the page ---
    const mentionsAfter = extractMentionsAfterArticle(originalArticle);
    const mentions = dedupeMentions([...(mentionsInside || []), ...(mentionsAfter || [])]);
    Logger.info("Mentions summary", {
      inside: (mentionsInside || []).length,
      after: (mentionsAfter || []).length,
      deduped: (mentions || []).length
    });

    if (mentions.length > 0) {
      Logger.info("Mentions table", mentions.map((m, i) => ({
        '#': i + 1,
        title: (m.title || '').substring(0, 50) + (m.title && m.title.length > 50 ? '...' : ''),
        url: (m.url || '').substring(0, 50) + (m.url && m.url.length > 50 ? '...' : ''),
        subtitle: (m.subtitle || '').substring(0, 30) + (m.subtitle && m.subtitle.length > 30 ? '...' : '') || 'N/A'
      })));
    }
    Logger.groupEnd();

    Logger.group("Content Block Building");
    // --- Walk DOM in order and build blocks (group by headings) ---
    const blocks = [];
    let current = { heading: "", level: 0, content: [] };
    const stats = {
      blocks: 0,
      items: { paragraph: 0, list: 0, quote: 0, code: 0, hr: 0, image: 0, caption: 0 },
      headings: { h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 }
    };
    Logger.log("Processing DOM nodes to build content blocks");

    const nodes = Array.from(article.querySelectorAll(
      "h2, h3, h4, h5, h6, p, ul, ol, blockquote, img, figcaption, hr, pre, div[data-selectable-paragraph], span[data-selectable-paragraph]"
    ));
    for (const el of nodes) {
      const tag = el.tagName;
      // Capture code-like blocks that Medium sometimes wraps without <pre>
      if (isCodeLike(el)) {
        const cd = extractCodeBlock(el);
        if (cd) {
          const last = current.content[current.content.length - 1];
          if (!(last && last.type === "code" && last.text === cd.text)) {
            current.content.push(cd);
          }
        }
        continue;
      }
      if (/^H[2-6]$/.test(tag)) {
        const headingText = el.innerText.trim();
        if (INTRO_HEADING_RE.test(headingText)) {
          // Skip generic "Introduction" headings and keep accumulating content
          continue;
        }
        if (current.content.length) blocks.push(current);
        const lvl = Number(tag.substring(1));
        current = { heading: headingText, level: lvl, content: [] };
        try { if (lvl >= 2 && lvl <= 6) stats.headings["h" + lvl]++; } catch (_) {}
        continue;
      }
      // Medium sometimes uses div/span with data-selectable-paragraph as paragraph wrappers
      if (el.matches && el.matches("div[data-selectable-paragraph], span[data-selectable-paragraph]")) {
        if (el.closest("blockquote, ul, ol, li, pre, code, figure, figcaption")) {
          continue;
        }
        const para = extractParagraph(el);
        if (para) current.content.push(para);
        continue;
      }
      if (tag === "P") {
        // Skip paragraphs that live inside containers we handle separately to avoid duplicates
        // e.g., blockquotes, lists, and code blocks often wrap their own <p> nodes
        if (el.closest("blockquote, ul, ol, li, pre, code, figure, figcaption")) {
          continue;
        }
        const para = extractParagraph(el);
        if (para) { current.content.push(para); stats.items.paragraph++; }
        continue;
      }
      if (tag === "UL" || tag === "OL") {
        const lst = extractList(el);
        if (lst) { current.content.push(lst); stats.items.list++; }
        continue;
      }
      if (tag === "BLOCKQUOTE") {
        const qt = extractQuote(el);
        if (qt) { current.content.push(qt); stats.items.quote++; }
        continue;
      }
      if (tag === "PRE") {
        const cd = extractCodeBlock(el);
        if (cd) {
          const last = current.content[current.content.length - 1];
          if (!(last && last.type === "code" && last.text === cd.text)) {
            current.content.push(cd);
            stats.items.code++;
          }
        }
        continue;
      }
      if (tag === "HR") {
        current.content.push({ type: "hr" });
        stats.items.hr++;
        continue;
      }
      if (tag === "IMG") {
        const img = extractImage(el);
        if (img) { current.content.push(img); stats.items.image++; }
        continue;
      }
      if (tag === "FIGCAPTION") {
        const para = extractParagraph(el);
        if (para && para.segments && para.segments.length) {
          current.content.push({ type: "caption", segments: para.segments });
          stats.items.caption++;
        }
        continue;
      }
    }
    if (current.content.length) blocks.push(current);

    stats.blocks = blocks.length;
    const lastBlock = blocks[blocks.length - 1] || null;
    const lastTypes = lastBlock ? (lastBlock.content || []).map(i => i.type) : [];
    const tailParagraphs = blocks.slice(-2).flatMap(b => (b.content || [])
      .filter(c => c.type === "paragraph").slice(-2)
      .map(p => (p.segments || []).map(s => s.text).join("")));

    Logger.group("Extraction Summary");
    Logger.success("Extraction completed successfully");
    Logger.info("Final statistics", {
      title: title?.substring(0, 60) + (title && title.length > 60 ? '...' : ''),
      url: canonicalUrl,
      blocks: stats.blocks,
      headings: stats.headings,
      items: stats.items,
      lastBlockHeading: lastBlock && lastBlock.heading ? lastBlock.heading.substring(0, 40) + '...' : null,
      lastBlockTypes: lastTypes,
      tailParagraphs: tailParagraphs.map(p => p.substring(0, 60) + (p.length > 60 ? '...' : ''))
    });

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    Logger.info("Total extraction time", {
      duration: `${totalTime.toFixed(2)}ms`,
      memory: PerformanceMonitor.memory()
    });

    Logger.groupEnd();
    Logger.groupEnd(); // Close Content Block Building group
    Logger.groupEnd(); // Close Article Extraction Process group

    sendResponse({ title, subtitle, author, blocks, publishedDate, readingTimeMinutes, canonicalUrl, heroImage, mentions });
  }
  return true;
});
