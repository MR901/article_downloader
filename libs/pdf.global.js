(function() {
  try {
    var root = (typeof window !== 'undefined') ? window : (typeof self !== 'undefined' ? self : this);
    if (root.__ArticleDocPDF) return;

    function buildFilename(article) {
      try {
        var ymd = (article && article.publishedDate && /^\d{4}-\d{2}-\d{2}$/.test(String(article.publishedDate)))
          ? article.publishedDate
          : null;
        var title = (article && (article.title || article.subtitle)) || 'article';
        var safe = String(title)
          .trim()
          .replace(/[–—:\-|]+.*/g, '')
          .replace(/\s+/g, '_')
          .replace(/[\\\/:*?"<>|]+/g, '')
          .replace(/_+/g, '_')
          .replace(/^_+|_+$/g, '')
          .slice(0, 80);
        var base = (safe || 'article') + '.pdf';
        return ymd ? (ymd + '-' + (safe || 'article') + '.pdf') : base;
      } catch (_){ return 'article.pdf'; }
    }

    function createOutline(pdf, headings, logger) {
      try {
        if (!headings || !headings.length) return;
        // If jsPDF outline plugin is present, prefer its API so /Dest entries are emitted
        var hasPlugin = pdf && pdf.outline && typeof pdf.outline.add === 'function';

        if (!pdf.outline) {
          // Minimal structure for fallback renderer
          pdf.outline = { root: { children: [], parent: null, title: 'Root', dest: null }, createNamedDestinations: false };
        }

        // reset existing outline tree
        pdf.outline.root.children = [];

        // Build hierarchical structure using heading levels
        var stack = [];
        for (var i = 0; i < headings.length; i++) {
          var h = headings[i];
          try {
            // Pop stack until we find a valid parent level
            while (stack.length > 0 && stack[stack.length - 1].level >= h.level) stack.pop();

            if (hasPlugin) {
              // Use plugin API for hierarchy, but also compute explicit Y destination for precision
              var parentNode = stack.length > 0 ? stack[stack.length - 1].node : pdf.outline.root;
              var pageInfoP = pdf.internal.getPageInfo(h.page);
              if (!pageInfoP) {
                // Fallback to adding without a destination if page missing
                var orphan = pdf.outline.add(parentNode, h.text, { pageNumber: h.page });
                stack.push({ level: h.level, node: orphan });
                continue;
              }
              var pageHP = pdf.internal.pageSize.getHeight();
              var destYP = pageHP - h.y;
              // Add node for hierarchy
              var newNode = pdf.outline.add(parentNode, h.text, { pageNumber: h.page });
              // If the outline object supports internal rendering props, store precise dest for renderer
              try { newNode.__dest = [pageInfoP.objId, 'XYZ', null, destYP, null]; } catch (_) {}
              // Track for hierarchy
              stack.push({ level: h.level, node: newNode });
            } else {
              // Legacy fallback: compute explicit destination array
              var pageInfo = pdf.internal.getPageInfo(h.page);
              if (!pageInfo) continue;
              var pageH = pdf.internal.pageSize.getHeight();
              var destY = pageH - h.y;
              var item = { title: h.text, dest: [pageInfo.objId, 'XYZ', null, destY, null], level: h.level, children: [], parent: null, objId: i + 1 };
              if (stack.length > 0) {
                var parent = stack[stack.length - 1];
                parent.children.push(item);
                item.parent = parent;
              } else {
                pdf.outline.root.children.push(item);
              }
              stack.push(item);
            }
          } catch (ie) {
            if (logger && logger.warn) logger.warn('Outline item failed', { error: String(ie && (ie.message || ie)) });
          }
        }
      } catch (e) {
        if (logger && logger.error) logger.error('Outline build failed', e);
      }
    }

    root.__ArticleDocPDF = {
      buildFilename: buildFilename,
      createOutline: createOutline
    };
  } catch (_) {}
})();


