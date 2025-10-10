/**
 * Provider System for Site-Specific Article Extraction
 *
 * This module implements a pluggable provider architecture that allows the extension
 * to support multiple article platforms with different extraction strategies.
 * Each provider defines URL patterns and extraction logic for specific websites.
 *
 * Architecture:
 * - BaseProvider: Abstract base class defining the provider interface
 * - ProviderRegistry: Manages collection of providers and URL matching
 * - Global registry: Shared instance accessible by both popup and content scripts
 */

/**
 * Base Provider Class
 *
 * Defines the interface that all site-specific providers must implement.
 * Providers can extend this class to add custom extraction logic for different platforms.
 */
class BaseProvider {
  /**
   * Creates a new provider instance
   * @param {Object} config - Provider configuration
   * @param {string} config.id - Unique provider identifier
   * @param {string} config.name - Human-readable provider name
   * @param {RegExp[]} config.urlPatterns - Array of regex patterns for URL matching
   * @param {string[]} config.allowedActions - Array of allowed action types
   */
  constructor(config) {
    this.id = config.id;
    this.name = config.name || config.id;
    this.urlPatterns = config.urlPatterns || []; // Array of RegExp patterns for URL matching
    this.allowedActions = new Set(config.allowedActions || []); // Set of permitted actions
  }

  /**
   * Tests if a URL matches this provider's patterns
   * @param {string|URL} url - URL to test for matching
   * @returns {boolean} True if URL matches any of the provider's patterns
   */
  matchesUrl(url) {
    try {
      // Handle both string URLs and URL objects
      const u = typeof url === "string" ? new URL(url) : url;
      const href = u.href || String(url);
      return this.urlPatterns.some((re) => re.test(href));
    } catch (_) {
      // Fallback for malformed URLs or non-URL inputs
      const s = String(url || "");
      return this.urlPatterns.some((re) => re.test(s));
    }
  }

  /**
   * Checks if a specific action is allowed for this provider
   * @param {string} action - Action to check (e.g., "extractArticle")
   * @returns {boolean} True if action is permitted
   */
  isActionAllowed(action) {
    return this.allowedActions.has(action);
  }

  /**
   * Abstract method for article extraction - providers should override this
   * The default implementation throws an error to indicate it must be implemented
   * @returns {Promise<Object>} Extracted article data
   * @throws {Error} If not implemented by subclass
   */
  async extractArticle() {
    throw new Error("extractArticle not implemented in provider");
  }
}

/**
 * Provider Registry Class
 *
 * Manages a collection of providers and provides URL-based provider lookup.
 * Acts as the central coordinator for the provider system.
 */
class ProviderRegistry {
  /**
   * Creates a new empty provider registry
   */
  constructor() {
    this.providers = [];
  }

  /**
   * Registers a new provider with the registry
   * @param {BaseProvider} provider - Provider instance to register
   */
  register(provider) {
    if (provider) this.providers.push(provider);
  }

  /**
   * Finds the appropriate provider for a given URL
   * @param {string|URL} url - URL to find provider for
   * @returns {BaseProvider|null} Matching provider or null if none found
   */
  findProviderByUrl(url) {
    for (const p of this.providers) {
      try {
        if (p.matchesUrl(url)) return p;
      } catch (_) {
        // Continue to next provider if current one fails
      }
    }
    return null;
  }
}

/**
 * Global Registry Initialization
 *
 * Creates a shared provider registry instance accessible by both popup and content scripts.
 * This allows coordination between different parts of the extension.
 */
;(function initGlobalRegistry() {
  try {
    // Only initialize if registry doesn't already exist
    if (!window.__ArticleDocProviderRegistry) {
      window.__ArticleDocProviderRegistry = new ProviderRegistry();
    }
  } catch (_) {
    // Silently fail in non-window contexts (service workers, etc.)
    // Non-window contexts will not set the registry
  }
})();

/**
 * Medium Platform Provider Registration
 *
 * Registers a provider for Medium.com and related platforms.
 * This provider uses generic URL pattern matching and delegates extraction to the content script.
 */
;(function registerMediumFamily() {
  try {
    const registry = window.__ArticleDocProviderRegistry;
    if (!registry) return;

    // Create provider for Medium ecosystem sites
    const mediumProvider = new BaseProvider({
      id: "medium",
      name: "Medium",
      // URL patterns for Medium and related platforms
      urlPatterns: [
        /(^|\.)medium\.com\//i,                    // Medium.com and subdomains
        /^https?:\/\/towardsdatascience\.com\//i,  // Towards Data Science
        /^https?:\/\/blog\.stackademic\.com\//i,   // Stackademic blog
      ],
      allowedActions: ["extractArticle"],
    });

    registry.register(mediumProvider);
  } catch (_) {
    // Silently fail if registration encounters issues
  }
})();

/**
 * Global Exports for Debugging and Extension
 *
 * Exposes provider classes globally for potential debugging, testing, or future extensions.
 * This allows external scripts to inspect or extend the provider system.
 */
try {
  window.ArticleDocProviders = { BaseProvider, ProviderRegistry };
} catch (_) {
  // Silently fail in non-window contexts
}