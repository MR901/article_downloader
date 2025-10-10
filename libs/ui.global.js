(function() {
  try {
    var root = (typeof window !== 'undefined') ? window : (typeof self !== 'undefined' ? self : this);
    if (root.__ArticleDocUI) return;

    function byId(id) {
      try { return document.getElementById(id); } catch (_) { return null; }
    }

    function resolveEl(elOrId) {
      if (!elOrId) return null;
      if (typeof elOrId === 'string') return byId(elOrId);
      return elOrId;
    }

    function setStatus(elOrId, message, type) {
      var el = resolveEl(elOrId);
      if (!el) return;
      try {
        el.style.color = type === 'error' ? '#c00' : (type === 'success' ? '#0a0' : '#666');
        el.textContent = String(message || '');
      } catch (_) {}
    }

    function setDisabled(elOrId, disabled) {
      var el = resolveEl(elOrId);
      if (!el) return;
      try { el.disabled = !!disabled; } catch (_) {}
    }

    root.__ArticleDocUI = {
      setStatus: setStatus,
      setDisabled: setDisabled
    };
  } catch (_) {}
})();


