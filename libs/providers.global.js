(function() {
  try {
    var root = (typeof window !== 'undefined') ? window : (typeof self !== 'undefined' ? self : this);
    if (root.ArticleDocProviders) return; // already provided

    function BaseProvider(config) {
      this.id = config.id;
      this.name = config.name || config.id;
      this.urlPatterns = config.urlPatterns || [];
      this.allowedActions = new Set(config.allowedActions || []);
    }
    BaseProvider.prototype.matchesUrl = function(url) {
      try {
        var u = typeof url === 'string' ? new URL(url) : url;
        var href = u && (u.href || String(url));
        for (var i = 0; i < this.urlPatterns.length; i++) {
          if (this.urlPatterns[i].test(href)) return true;
        }
        return false;
      } catch (_e) {
        var s = String(url || '');
        for (var j = 0; j < this.urlPatterns.length; j++) {
          if (this.urlPatterns[j].test(s)) return true;
        }
        return false;
      }
    };
    BaseProvider.prototype.isActionAllowed = function(action) {
      return this.allowedActions.has(action);
    };
    BaseProvider.prototype.extractArticle = function() {
      throw new Error('extractArticle not implemented in provider');
    };

    function ProviderRegistry() {
      this.providers = [];
    }
    ProviderRegistry.prototype.register = function(provider) {
      if (provider) this.providers.push(provider);
    };
    ProviderRegistry.prototype.findProviderByUrl = function(url) {
      for (var i = 0; i < this.providers.length; i++) {
        var p = this.providers[i];
        try { if (p.matchesUrl(url)) return p; } catch (_e) {}
      }
      return null;
    };

    // Expose
    root.ArticleDocProviders = { BaseProvider: BaseProvider, ProviderRegistry: ProviderRegistry };

    // Shared global registry if not set
    if (!root.__ArticleDocProviderRegistry) {
      root.__ArticleDocProviderRegistry = new ProviderRegistry();
    }
  } catch (_) {}
})();


