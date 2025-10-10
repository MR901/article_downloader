# Feature Flags

Toggle optional features at runtime without code changes.

Enable flags in the popup DevTools console or page console:

```js
window.__ArticleDocFeatures.enableOutlineAndTOC = true;      // Adds a TOC page using captured headings
window.__ArticleDocFeatures.enableReferencesSection = true;  // Appends a "References" block (if mentions exist)
window.__ArticleDocFeatures.enableRelatedMentions = true;    // Appends "Other mentions by author" (provider hints)
```

Notes:
- References and Related are assembled in the content script using `libs/references.global.js` and `libs/related.global.js`.
- TOC is assembled in the popup using `libs/toc.global.js` and appended as a new page.
