# Providers & Hints

Providers determine which sites are supported and optionally supply extraction hints.

## Base concepts
- BaseProvider(config): `{ id, name, urlPatterns: RegExp[], allowedActions: string[], hints? }`
- ProviderRegistry: `register(provider)`, `findProviderByUrl(url)`
- Global registry: `window.__ArticleDocProviderRegistry`

## Hints (optional)
Providers can include `hints` used by the content script to enrich data (e.g., related mentions):
- `bylineSelectors`: CSS selectors for author/byline
- `relatedSectionSelectors`: CSS selectors for sections that may contain related links
- `linkSelectors`: CSS selectors for links worth capturing

## Adding a provider
Register in `providers.js` (uses global constructors when available):
```js
const provider = new BaseProvider({
  id: "example",
  name: "Example",
  urlPatterns: [/^https?:\/\/example\.com\//i],
  allowedActions: ["extractArticle"],
  hints: {
    bylineSelectors: ['a[rel="author"]'],
    relatedSectionSelectors: ['section', 'aside'],
    linkSelectors: ['a[href^="https://example.com/"]']
  }
});
window.__ArticleDocProviderRegistry.register(provider);
```
