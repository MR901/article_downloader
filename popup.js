document.getElementById("convert").addEventListener("click", async () => {
  console.log("[popup] Generate Clean PDF clicked");
  try {
    const tabs = await queryTabs({ active: true, currentWindow: true });
    const tab = tabs && tabs[0];
    if (!tab) {
      console.error("[popup] No active tab found");
      alert("No active tab found");
      return;
    }

    const article = await sendMessageToTab(tab.id, { action: "extractMediumArticle" });
    console.log("[popup] Article response:", article);

    if (!article || article.error) {
      const reason = (article && article.error) || "Unknown error";
      console.error("[popup] Extraction failed:", reason);
      alert("Failed to extract article: " + reason);
      return;
    }

    await generatePDF(article);
    console.log("[popup] PDF generated successfully");
  } catch (err) {
    console.error("[popup] Unhandled error:", err);
    alert("Error: " + (err && err.message ? err.message : String(err)));
  }
});

async function generatePDF(article) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "pt", format: "a4" });

  // --- Layout and Style ---
  const margin = 56; // ~0.78in
  const pageH = pdf.internal.pageSize.getHeight();
  const pageW = pdf.internal.pageSize.getWidth();
  const textW = pageW - 2 * margin;
  let y = margin;

  const COLORS = {
    body: [20, 20, 20],
    muted: [110, 110, 110],
    link: [17, 85, 204],
    hr: [200, 200, 200],
    quoteBar: [200, 200, 200],
  };

  const SIZES = {
    title: 22,
    subtitle: 14.5,
    meta: 11,
    h2: 16,
    h3: 14,
    h4: 12.5,
    body: 11,
    quote: 11,
    code: 10,
  };

  const LINE_HEIGHTS = {
    body: 16,
    quote: 16,
    code: 14,
  };

  function normalizeUrl(u) {
    try {
      return new URL(u, article.canonicalUrl || undefined).href;
    } catch {
      return String(u || "").trim();
    }
  }

  function urlToDomain(u) {
    try {
      const x = new URL(u, article.canonicalUrl || undefined);
      return x.hostname;
    } catch {
      const s = String(u || "").trim();
      const m = s.match(/^[a-z]+:\/\/([^\/]+)/i);
      return (m && m[1]) || s;
    }
  }

  function ensureSpace(h) {
    if (y + h <= pageH - margin) return;
    pdf.addPage();
    y = margin;
  }

  function setBodyFont(size = SIZES.body, style = "normal", mono = false) {
    const family = mono ? "courier" : "helvetica";
    pdf.setFont(family, style);
    pdf.setFontSize(size);
    pdf.setTextColor(...COLORS.body);
  }

  function measure(text) {
    return pdf.getTextWidth(text);
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

  function layoutSegmentsIntoLines(segments, maxWidth, size) {
    const lines = [];
    let current = [];
    let lineWidth = 0;

    const pushLine = () => {
      if (current.length) lines.push(current);
      current = [];
      lineWidth = 0;
    };

    for (const seg of segments) {
      // Force-break on newlines inside segments
      const chunks = String(seg.text || "").split(/(\n)/);
      for (const chunk of chunks) {
        if (chunk === "\n") {
          pushLine();
          continue;
        }
        if (!chunk) continue;
        // Split into tokens preserving spaces
        const tokens = chunk.match(/\S+\s*|\s+/g) || [];
        for (let tok of tokens) {
          // avoid leading spaces on new lines
          if (!current.length && /^\s+$/.test(tok)) continue;
          let w = 0;
          withSegFont(seg, size, () => {
            w = measure(tok);
          });
          if (lineWidth + w > maxWidth && current.length) {
            pushLine();
            if (/^\s+$/.test(tok)) continue; // drop leading whitespace on new line
          }
          current.push({ ...seg, text: tok, width: w });
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
          pdf.textWithLink(part.text, x, y, { url: part.link });
        } else {
          pdf.setTextColor(...COLORS.body);
          pdf.text(part.text, x, y);
        }
        x += part.width;
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
          pdf.text(bullet, x, y);
        }
        x += bulletW;
        for (const part of lines[li]) {
          const s = styleFromSeg(part);
          pdf.setFont(s.family, s.style);
          pdf.setFontSize(SIZES.body);
          if (part.link) {
            pdf.setTextColor(...COLORS.link);
            pdf.textWithLink(part.text, x, y, { url: part.link });
          } else {
            pdf.setTextColor(...COLORS.body);
            pdf.text(part.text, x, y);
          }
          x += part.width;
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
          pdf.textWithLink(part.text, x, y, { url: part.link });
        } else {
          pdf.text(part.text, x, y);
        }
        x += part.width;
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

    // Compute background height using per-line heights
    let totalH = 12; // vertical padding
    for (const rl of renderLines) {
      const lh = Math.round(LINE_HEIGHTS.code * (rl.size / baseSize));
      totalH += lh;
    }

    // Draw background
    const firstLineH = Math.round(LINE_HEIGHTS.code * (renderLines.length ? renderLines[0].size / baseSize : 1));
    ensureSpace(totalH);
    pdf.setDrawColor(230, 230, 230);
    pdf.setFillColor(245, 245, 245);
    pdf.rect(margin - 6, y - firstLineH + 4, textW + 12, totalH, "F");

    // Draw text lines
    for (const rl of renderLines) {
      const lh = Math.round(LINE_HEIGHTS.code * (rl.size / baseSize));
      ensureSpace(lh);
      pdf.setFontSize(rl.size);
      pdf.text(rl.text, margin, y);
      y += lh;
    }
    // restore default code size
    pdf.setFontSize(baseSize);
    y += 4;
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
          pdf.textWithLink(part.text, x, y, { url: part.link });
        } else {
          pdf.setTextColor(...COLORS.muted);
          pdf.text(part.text, x, y);
        }
        x += part.width;
      }
      y += lineHeight;
    }
    y += 6;
  }

  function drawHeading(text, level) {
    const size = level === 2 ? SIZES.h2 : level === 3 ? SIZES.h3 : SIZES.h4;
    const lh = Math.round(size * 1.5);
    ensureSpace(lh);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(size);
    pdf.setTextColor(...COLORS.body);
    const wrapped = pdf.splitTextToSize(text, textW);
    for (const line of wrapped) {
      ensureSpace(lh);
      pdf.text(line, margin, y);
      y += lh;
    }
    y += 4;
  }

  // --- Header: Title ---
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(SIZES.title);
  pdf.setTextColor(...COLORS.body);
  const titleLines = pdf.splitTextToSize(article.title, textW);
  for (const line of titleLines) {
    ensureSpace(Math.round(SIZES.title * 1.6));
    pdf.text(line, margin, y);
    y += Math.round(SIZES.title * 1.2);
  }

  // --- Header: Subtitle ---
  if (article.subtitle && article.subtitle.trim()) {
    const lh = Math.round(SIZES.subtitle * 1.5);
    ensureSpace(lh);
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(SIZES.subtitle);
    pdf.setTextColor(...COLORS.muted);
    const subLines = pdf.splitTextToSize(article.subtitle.trim(), textW);
    for (const line of subLines) {
      ensureSpace(lh);
      pdf.text(line, margin, y);
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
    pdf.text(metaParts.join("  •  "), centerX, y, { align: "center" });
    y += 18;
  }

  // --- Header: URL (clickable, center) ---
  if (article.canonicalUrl) {
    ensureSpace(Math.round(SIZES.meta * 1.6));
    pdf.setTextColor(...COLORS.link);
    pdf.textWithLink(article.canonicalUrl, centerX, y, { align: "center", url: article.canonicalUrl });
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
    pdf.text("Other mentions by Author", margin, y);
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

  pdf.save(buildFilename(article));
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

function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    let completed = false;
    try {
      chrome.tabs.sendMessage(tabId, message, response => {
        const err = chrome.runtime && chrome.runtime.lastError;
        if (err) {
          reject(new Error(err.message || "sendMessage failed"));
          return;
        }
        completed = true;
        resolve(response);
      });
      // Failsafe timeout in case no content script is present
      setTimeout(() => {
        if (!completed) {
          reject(new Error("Timed out waiting for content script response"));
        }
      }, 5000);
    } catch (e) {
      reject(e);
    }
  });
}
