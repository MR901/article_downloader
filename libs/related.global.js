(function() {
  try {
    var root = (typeof window !== 'undefined') ? window : (typeof self !== 'undefined' ? self : this);
    if (root.__ArticleDocRelated) return;

    function collectRelatedMentions(doc, author, hints) {
      // Placeholder: use hints to search links in likely related sections
      try {
        var results = [];
        var sectionSelectors = (hints && hints.relatedSectionSelectors) || [];
        var linkSelectors = (hints && hints.linkSelectors) || [];
        var scopes = [];
        for (var i = 0; i < sectionSelectors.length; i++) {
          try {
            var nodes = doc.querySelectorAll(sectionSelectors[i]);
            for (var j = 0; j < nodes.length; j++) scopes.push(nodes[j]);
          } catch (_) {}
        }
        if (!scopes.length) scopes = [doc];
        var seen = new Set();
        for (var s = 0; s < scopes.length; s++) {
          var scope = scopes[s];
          for (var k = 0; k < linkSelectors.length; k++) {
            try {
              var links = scope.querySelectorAll(linkSelectors[k]);
              for (var m = 0; m < links.length; m++) {
                var a = links[m];
                var url = a.getAttribute('href');
                var title = (a.textContent || '').trim();
                if (!url || seen.has(url)) continue;
                seen.add(url);
                if (title) results.push({ title: title, url: url, source: 'provider-hint' });
              }
            } catch (_) {}
          }
        }
        return results;
      } catch (_) { return []; }
    }

    function buildRelatedSection(items) {
      if (!items || !items.length) return null;
      return {
        id: 'related',
        level: 1,
        heading: 'Other mentions by author',
        blocks: items.map(function(i){ return { type: 'paragraph', text: i.title + ' — ' + i.url }; })
      };
    }

    root.__ArticleDocRelated = {
      collectRelatedMentions: collectRelatedMentions,
      buildRelatedSection: buildRelatedSection
    };
  } catch (_) {}
})();


