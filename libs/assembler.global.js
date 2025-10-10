(function() {
  try {
    var root = (typeof window !== 'undefined') ? window : (typeof self !== 'undefined' ? self : this);
    if (root.__ArticleDocAssembler) return;

    function toArticle(payload) {
      // Pass-through shim: map existing content.js payload to a stable Article shape
      // without changing behavior. Keep field names as-is for now; PDF uses these.
      return Object.assign({}, payload);
    }

    root.__ArticleDocAssembler = {
      toArticle: toArticle
    };
  } catch (_) {}
})();


