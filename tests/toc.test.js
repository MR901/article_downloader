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
  loadGlobal('./libs/toc.global.js', context);

  const { __ArticleDocTOC } = context;
  assert(__ArticleDocTOC && typeof __ArticleDocTOC.buildTOC === 'function', 'TOC builder missing');

  const headings = [
    { level: 1, text: 'Intro', page: 1, y: 700 },
    { level: 2, text: 'Part A', page: 2, y: 600 },
    { level: 3, text: 'Detail', page: 3, y: 500 },
    { level: 4, text: 'Too deep', page: 4, y: 400 }
  ];

  const toc = __ArticleDocTOC.buildTOC(headings, 3);
  assert(toc && toc.blocks && toc.blocks.length === 3, 'Expected TOC with three items');
  assert(toc.blocks[0].text.includes('Intro'), 'Missing Intro');
  assert(toc.blocks[2].text.includes('Detail'), 'Missing Detail');

  console.log('TEST OK: TOC builder basic filter and format');
})();


