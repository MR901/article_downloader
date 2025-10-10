# Testing & Linting

Run minimal Node-based tests:

```bash
make test
```

What it covers now:
- `tests/references.test.js`: basic dedupe for references
- `tests/toc.test.js`: TOC building and filtering

Run linter and build package:

```bash
make build   # runs web-ext lint, then builds
```

Tips:
- Use popup DevTools for runtime debugging (Right-click popup → Inspect)
- Use browser console to monitor background/content logs
