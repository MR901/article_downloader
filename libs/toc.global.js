(function() {
  try {
    var root = (typeof window !== 'undefined') ? window : (typeof self !== 'undefined' ? self : this);
    if (root.__ArticleDocTOC) return;

    function buildTOC(headings, maxLevel) {
      if (!headings || !headings.length) return null;
      var ml = (typeof maxLevel === 'number' && maxLevel >= 1) ? maxLevel : 3;
      var items = [];
      for (var i = 0; i < headings.length; i++) {
        var h = headings[i];
        if (h.level <= ml) items.push({ level: h.level, text: h.text, page: h.page });
      }
      if (!items.length) return null;
      return {
        id: 'toc',
        level: 1,
        heading: 'Table of Contents',
        blocks: items.map(function(it){ return { type: 'paragraph', text: Array(it.level - 1).fill('  ').join('') + it.text + ' ........ ' + (it.page || 1) }; })
      };
    }

    root.__ArticleDocTOC = { buildTOC: buildTOC };
  } catch (_) {}
})();


