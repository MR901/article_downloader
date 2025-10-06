chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "ping") {
    sendResponse({ ok: true, scope: "content" });
    return true;
  }
  console.log("[content] onMessage:", msg);
  if (msg.action === "extractMediumArticle") {
    console.log("[content] Extracting article with formatting...");
    const isMedium = /medium\.com/.test(location.hostname);
    if (!isMedium) return sendResponse({ error: "Not a Medium article" });

    const originalArticle = document.querySelector("article");
    if (!originalArticle) return sendResponse({ error: "No article found" });

    // Work on a clone to avoid mutating the live DOM
    const article = originalArticle.cloneNode(true);

    // Remove clearly irrelevant elements
    article.querySelectorAll(
      "aside, footer, header, nav, form, script, style, noscript, iframe, svg, button"
    ).forEach(el => el.remove());
    // Remove common Medium noise blocks by class name
    article.querySelectorAll("div").forEach(el => {
      const className = el.className || "";
      if (/(promo|responses|metered|recommend|footer|bottom|clap|paywall|notes|signup|response|js-stickyFooter)/i.test(className)) {
        el.remove();
      }
    });
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
      /press\s+enter\s+or\s+click\s+to\s+view\s+image\s+in\s+full\s+size/i
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
      if (el.tagName === "PRE" || el.querySelector("pre")) return true;
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

    function extractMentionsAndPrune(root) {
      const results = [];
      const seen = new Set();
      const domainRegex = /\b[a-z0-9.-]+\.(?:medium\.com|[a-z]{2,})(?:\b|\s|$)/i;

      const candidates = Array.from(root.querySelectorAll("div")).filter(div => {
        // Must look like a compact card with a title (h2) and show a domain line somewhere
        // Restrict to a direct child h2 to avoid matching large article containers
        const hasH2 = !!div.querySelector(":scope > h2");
        if (!hasH2) return false;
        const txt = (div.innerText || "").trim();
        if (!txt) return false;
        if (!domainRegex.test(txt)) return false;
        // Avoid enormous containers (likely the whole article wrapper)
        const childCount = div.children ? div.children.length : 0;
        if (childCount > 12) return false;
        return true;
      });

      for (const card of candidates) {
        if (seen.has(card)) continue;
        const titleEl = card.querySelector(":scope > h2") || card.querySelector("h2");
        const subtitleEl = card.querySelector("h3");
        const linkEl = card.querySelector("a[href]");
        const title = titleEl ? String(titleEl.innerText || "").trim() : null;
        const subtitle = subtitleEl ? String(subtitleEl.innerText || "").trim() : null;
        const url = linkEl ? toAbsoluteUrl(linkEl.getAttribute("href")) : null;

        // Require at least a title and a URL to produce a clickable mention
        if (title && url) {
          results.push({ title, subtitle, url });
          seen.add(card);
          card.remove();
        }
      }
      return results;
    }

    // Scan live document for Medium redirect/link cards that appear visually after the article
    function extractMentionsAfterArticle(articleEl) {
      const results = [];
      const seen = new Set();
      const domainRegex = /\b[a-z0-9.-]+\.(?:medium\.com|[a-z]{2,})(?:\b|\s|$)/i;
      if (!articleEl || typeof articleEl.getBoundingClientRect !== "function") return results;

      let articleBottom = 0;
      try {
        articleBottom = articleEl.getBoundingClientRect().bottom;
      } catch (_) {
        articleBottom = 0;
      }

      const candidates = Array.from(document.querySelectorAll("div")).filter(div => {
        if (!div) return false;
        // Skip anything within the article itself (those are handled by extractMentionsAndPrune)
        if (articleEl.contains(div)) return false;
        // Title presence: either direct h2 or nested h2
        const hasH2 = !!div.querySelector(":scope > h2") || !!div.querySelector("h2");
        if (!hasH2) return false;
        const txt = (div.innerText || "").trim();
        if (!txt) return false;
        if (!domainRegex.test(txt)) return false;
        // Avoid enormous containers
        const childCount = div.children ? div.children.length : 0;
        if (childCount > 12) return false;
        // Only consider elements that render below the bottom of the article
        let top = 0;
        try { top = div.getBoundingClientRect().top; } catch (_) { top = 0; }
        if (top <= articleBottom) return false;
        // Avoid sticky/fixed overlays
        const style = window.getComputedStyle(div);
        if (style && (style.position === "fixed" || style.position === "sticky")) return false;
        return true;
      });

      for (const card of candidates) {
        if (seen.has(card)) continue;
        const titleEl = card.querySelector(":scope > h2") || card.querySelector("h2");
        const subtitleEl = card.querySelector("h3");
        const linkEl = card.querySelector("a[href]");
        const title = titleEl ? String(titleEl.innerText || "").trim() : null;
        const subtitle = subtitleEl ? String(subtitleEl.innerText || "").trim() : null;
        const url = linkEl ? toAbsoluteUrl(linkEl.getAttribute("href")) : null;

        if (title && url) {
          results.push({ title, subtitle, url });
          seen.add(card);
        }
      }
      return results;
    }

    function dedupeMentions(arr) {
      const out = [];
      const seen = new Set();
      for (const m of arr || []) {
        if (!m) continue;
        let url = null;
        try { url = m.url ? new URL(m.url, location.href).href : null; } catch (_) { url = m.url || null; }
        const titleKey = (m.title || "").trim().toLowerCase();
        const key = url ? ("u:" + url) : ("t:" + titleKey);
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

    // --- Extract mentions (link cards) and prune from article ---
    const mentionsInside = extractMentionsAndPrune(article);
    // --- Also capture any similar cards that appear after the article on the page ---
    const mentionsAfter = extractMentionsAfterArticle(originalArticle);
    const mentions = dedupeMentions([...(mentionsInside || []), ...(mentionsAfter || [])]);

    // --- Walk DOM in order and build blocks (group by headings) ---
    const blocks = [];
    let current = { heading: "", level: 0, content: [] };

    const nodes = Array.from(article.querySelectorAll(
      "h2, h3, h4, p, ul, ol, blockquote, img, figcaption, hr, pre, div[data-selectable-paragraph], span[data-selectable-paragraph]"
    ));
    for (const el of nodes) {
      const tag = el.tagName;
      // Capture code-like blocks that Medium sometimes wraps without <pre>
      if (isCodeLike(el)) {
        const cd = extractCodeBlock(el);
        if (cd) current.content.push(cd);
        continue;
      }
      if (/^H[2-4]$/.test(tag)) {
        const headingText = el.innerText.trim();
        if (INTRO_HEADING_RE.test(headingText)) {
          // Skip generic "Introduction" headings and keep accumulating content
          continue;
        }
        if (current.content.length) blocks.push(current);
        current = { heading: headingText, level: Number(tag.substring(1)), content: [] };
        continue;
      }
      if (tag === "P") {
        // Skip paragraphs that live inside containers we handle separately to avoid duplicates
        // e.g., blockquotes, lists, and code blocks often wrap their own <p> nodes
        if (el.closest("blockquote, ul, ol, li, pre, code, figure, figcaption")) {
          continue;
        }
        const para = extractParagraph(el);
        if (para) current.content.push(para);
        continue;
      }
      if (tag === "UL" || tag === "OL") {
        const lst = extractList(el);
        if (lst) current.content.push(lst);
        continue;
      }
      if (tag === "BLOCKQUOTE") {
        const qt = extractQuote(el);
        if (qt) current.content.push(qt);
        continue;
      }
      if (tag === "PRE") {
        const cd = extractCodeBlock(el);
        if (cd) current.content.push(cd);
        continue;
      }
      if (tag === "HR") {
        current.content.push({ type: "hr" });
        continue;
      }
      if (tag === "IMG") {
        const img = extractImage(el);
        if (img) current.content.push(img);
        continue;
      }
      if (tag === "FIGCAPTION") {
        const para = extractParagraph(el);
        if (para && para.segments && para.segments.length) {
          current.content.push({ type: "caption", segments: para.segments });
        }
        continue;
      }
    }
    if (current.content.length) blocks.push(current);

    console.log("[content] Extraction complete. Blocks:", blocks.length);
    sendResponse({ title, subtitle, author, blocks, publishedDate, readingTimeMinutes, canonicalUrl, heroImage, mentions });
  }
  return true;
});
