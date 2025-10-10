// Minimal Node-based test for __ArticleDocReferences
const fs = require('fs');
const vm = require('vm');

function loadGlobal(filePath, context) {
  const code = fs.readFileSync(filePath, 'utf8');
  vm.runInNewContext(code, context, { filename: filePath });
}

function assert(condition, message) {
  if (!condition) {
    console.error('TEST FAIL:', message || 'Assertion failed');
    process.exit(1);
  }
}

(function main() {
  const context = { console, setTimeout, clearTimeout };
  context.window = context; // expose window-like global
  loadGlobal('./libs/references.global.js', context);

  const { __ArticleDocReferences } = context;
  assert(__ArticleDocReferences && typeof __ArticleDocReferences.collectReferences === 'function', 'collector missing');

  const article = {
    mentions: [
      { title: 'One', url: 'https://example.com/a' },
      { title: 'Two', url: 'https://example.com/b' },
      { title: 'Dupe', url: 'https://example.com/a' },
      { title: '', url: '' },
    ]
  };

  const refs = __ArticleDocReferences.collectReferences(article);
  assert(Array.isArray(refs), 'refs not array');
  assert(refs.length === 2, 'expected 2 unique refs');
  assert(refs[0].url === 'https://example.com/a', 'first url mismatch');
  assert(refs[1].url === 'https://example.com/b', 'second url mismatch');

  console.log('TEST OK: references collector basic dedupe');
})();


