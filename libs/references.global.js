(function() {
  try {
    var root = (typeof window !== 'undefined') ? window : (typeof self !== 'undefined' ? self : this);
    if (root.__ArticleDocReferences) return;

    function collectReferences(article) {
      // Minimal placeholder collector: dedupe by URL if present, skip empty
      var refs = Array.isArray(article && article.mentions) ? article.mentions : [];
      var seen = new Set();
      var out = [];
      for (var i = 0; i < refs.length; i++) {
        var r = refs[i];
        var url = r && r.url;
        if (!url || seen.has(url)) continue;
        seen.add(url);
        out.push({ id: 'ref_' + (i + 1), label: r.title || url, url: url });
      }
      return out;
    }

    function buildReferencesSection(refs) {
      if (!refs || !refs.length) return null;
      return {
        id: 'references',
        level: 1,
        heading: 'References',
        blocks: refs.map(function(r){ return { type: 'paragraph', text: r.label + ' — ' + r.url }; })
      };
    }

    root.__ArticleDocReferences = {
      collectReferences: collectReferences,
      buildReferencesSection: buildReferencesSection
    };
  } catch (_) {}
})();


