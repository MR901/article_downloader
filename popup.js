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

  // --- Emoji support helpers ---
  // Cache for canvas, conversions and rendered emoji images
  const __emojiCache = {
    canvas: null,
    ctx: null,
    pxToPtByKey: new Map(),
    dataUrlByKey: new Map()
  };

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

  // Basic emoji detection per grapheme (Extended_Pictographic or VS-16 or ZWJ sequences)
  function isEmojiGrapheme(gr) {
    if (!gr) return false;
    try {
      // If contains ZWJ, likely an emoji sequence
      if (gr.indexOf("\u200D") !== -1) return true;
      // Variation Selector-16 indicates emoji presentation
      if (/[\uFE0F]/u.test(gr)) return true;
      // Extended_Pictographic covers most emoji code points
      if (/(\p{Extended_Pictographic})/u.test(gr)) return true;
    } catch (_) {
      // Fallback for engines without Unicode property escapes: common emoji ranges
      if (/[\u2190-\u21FF\u2300-\u27BF\u2600-\u27BF\u1F300-\u1FAFF]/.test(gr)) return true;
    }
    return false;
  }

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
    const graphemes = segmentGraphemes(tok);
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
        withSegFont(seg, size, () => {
          pdf.text(f.text, x, y);
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
            pdf.textWithLink(part.text, x, y, { url: part.link });
            x += part.width;
          }
        } else {
          pdf.setTextColor(...COLORS.muted);
          if (part.fragments) {
            x = drawFragments(part.fragments, x, y, part, size);
          } else {
            pdf.text(part.text, x, y);
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
          pdf.text(part.text, x, y);
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
        pdf.text(part.text, x, y);
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
          pdf.text(part.text, x, y);
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
