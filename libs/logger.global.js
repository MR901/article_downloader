(function() {
  try {
    var startTime = Date.now();
    var sessionId = Math.random().toString(36).substr(2, 9);

    function ts() {
      return ((Date.now() - startTime) / 1000).toFixed(2) + 's';
    }

    function fmt(data) {
      return data ? Object.assign({ session: sessionId }, data) : { session: sessionId };
    }

    var GlobalLogger = {
      log: function(message, data) {
        try { console.log('[' + ts() + '] 🔵 ' + message, fmt(data || null)); } catch (_) {}
      },
      info: function(message, data) {
        try { console.info('[' + ts() + '] 🔷 ' + message, fmt(data || null)); } catch (_) {}
      },
      warn: function(message, data) {
        try { console.warn('[' + ts() + '] ⚠️ ' + message, fmt(data || null)); } catch (_) {}
      },
      error: function(message, error) {
        try {
          var payload = { session: sessionId };
          if (error) payload.error = (error.stack || error.message || String(error));
          console.error('[' + ts() + '] 🔴 ' + message, payload);
        } catch (_) {}
      },
      success: function(message, data) {
        try { console.log('[' + ts() + '] ✅ ' + message, fmt(data || null)); } catch (_) {}
      },
      group: function(title) { try { console.group(title); } catch (_) {} },
      groupEnd: function() { try { console.groupEnd(); } catch (_) {} },
      time: function(label) {
        var s = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        return function() {
          var e = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
          var d = (e - s).toFixed(2) + 'ms';
          try { console.log('[' + ts() + '] ⏱ ' + label, { session: sessionId, duration: d }); } catch (_) {}
          return d;
        };
      }
    };

    var root = (typeof window !== 'undefined') ? window : (typeof self !== 'undefined' ? self : this);
    if (!root.__ArticleDocLogger) root.__ArticleDocLogger = GlobalLogger;
  } catch (_) {}
})();


