// Provider system for site-specific extraction logic and URL matching

// Base class that providers can extend for site-specific behavior
class BaseProvider {
  constructor(config) {
    this.id = config.id;
    this.name = config.name || config.id;
    this.urlPatterns = config.urlPatterns || []; // array of RegExp
    this.allowedActions = new Set(config.allowedActions || []);
  }

  matchesUrl(url) {
    try {
      const u = typeof url === "string" ? new URL(url) : url;
      const href = u.href || String(url);
      return this.urlPatterns.some((re) => re.test(href));
    } catch (_) {
      const s = String(url || "");
      return this.urlPatterns.some((re) => re.test(s));
    }
  }

  isActionAllowed(action) {
    return this.allowedActions.has(action);
  }

  // Providers may override to implement custom extraction.
  // The default implementation expects the content script to handle extraction.
  async extractArticle() {
    throw new Error("extractArticle not implemented in provider");
  }
}

class ProviderRegistry {
  constructor() {
    this.providers = [];
  }

  register(provider) {
    if (provider) this.providers.push(provider);
  }

  findProviderByUrl(url) {
    for (const p of this.providers) {
      try {
        if (p.matchesUrl(url)) return p;
      } catch (_) {}
    }
    return null;
  }
}

// Instantiate a global registry on the window so both popup/content can access
;(function initGlobalRegistry() {
  try {
    if (!window.__ArticleDocProviderRegistry) {
      window.__ArticleDocProviderRegistry = new ProviderRegistry();
    }
  } catch (_) {
    // Non-window contexts will not set the registry
  }
})();

// Register Medium-family provider with URL templates and allowed actions
;(function registerMediumFamily() {
  try {
    const registry = window.__ArticleDocProviderRegistry;
    if (!registry) return;

    const mediumProvider = new BaseProvider({
      id: "medium",
      name: "Medium",
      urlPatterns: [
        /(^|\.)medium\.com\//i,
        /^https?:\/\/towardsdatascience\.com\//i,
        /^https?:\/\/blog\.stackademic\.com\//i,
      ],
      allowedActions: ["extractArticle"],
    });

    registry.register(mediumProvider);
  } catch (_) {}
})();

// Expose classes for potential future use/debugging
try {
  window.ArticleDocProviders = { BaseProvider, ProviderRegistry };
} catch (_) {}


