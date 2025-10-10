## PDF Engine Migration Note

This repository currently uses jsPDF for PDF generation. During AMO hardening, experimental scaffolding for PDF-lib was added and is now parked under `libs/niu/`:

- `libs/niu/pdf-pdflib.global.js` (prototype adapter, not wired)
- `libs/niu/pdf-lib.min.js` (vendored build, not loaded)

Rationale:
- AMO flags jsPDF’s internal use of `document.write`/`innerHTML` with warnings, but they are non-blocking.
- We may migrate to PDF-lib later to eliminate those warnings entirely.

High-level migration plan (future):
1. Introduce a `PdfEngine` interface and implement `JsPdfEngine` and `PdfLibEngine` behind it.
2. Update `popup.js` `generatePDF(article)` to depend only on the interface; inject chosen engine.
3. Port features: text layout/wrapping, links, images, outline/TOC hooks, emoji rendering, and measurement utilities.
4. Embed fonts explicitly (Unicode coverage), ensure pagination parity and performance.
5. Remove jsPDF when feature parity is achieved and AMO validation is clean.

Status: No runtime changes rely on PDF-lib today; jsPDF remains the active engine. The `niu` files are retained only as a staging area and should be excluded from packaging if possible.

# ArticleDoc Refactoring - Executive Summary

> **Purpose**: This document provides a quick summary of the refactoring proposals for the ArticleDoc Firefox extension.

---

## Quick Comparison: 6 Refactoring Proposals

### 🟢 Proposal A: Minimal-Safe Modularization + Bundling (MV2)
- **Time**: 1-2 days
- **Risk**: 🟢 Low  
- **Best For**: Quick wins, immediate maintainability
- **Key Benefit**: Split large files into modules without changing behavior
- **Tools**: Vite/esbuild, TypeScript, ESLint

### 🟡 Proposal B: MV3 Migration
- **Time**: 2-3 days
- **Risk**: 🟡 Medium
- **Best For**: Future-proofing Firefox compatibility
- **Key Benefit**: Align with Firefox's long-term direction
- **Challenges**: Different APIs, service worker lifecycle

### 🟢 Proposal C: TypeScript + Comprehensive Testing + Linting
- **Time**: 2-3 days
- **Risk**: 🟢 Low-Medium
- **Best For**: Catching bugs early, safe refactoring
- **Key Benefit**: Type safety + 80%+ test coverage
- **Tools**: TypeScript, Vitest, ESLint, Prettier, CI/CD

### 🟡 Proposal D: Provider-First Extraction Architecture
- **Time**: 2-3 days
- **Risk**: 🟡 Medium
- **Best For**: Easy extension to new sites
- **Key Benefit**: Isolated, testable site-specific logic
- **Result**: Adding new sites = 1 day of work

### 🔴 Proposal E: Layered Architecture with Clean Boundaries
- **Time**: 5-7 days
- **Risk**: 🔴 High
- **Best For**: Enterprise-grade architecture
- **Key Benefit**: Maximum separation of concerns
- **Challenges**: Over-engineering risk, steep learning curve

### 🟡 **Proposal F: Hybrid Pragmatic Approach** ⭐ **RECOMMENDED**
- **Time**: 4 weeks (phased)
- **Risk**: 🟡 Medium
- **Best For**: Balanced approach, maximum practical benefit
- **Key Benefit**: 80% of benefits, manageable risk
- **Combines**: A + C + D with clear phases

---

## The Recommended Path: Proposal F (Hybrid)

### Why Hybrid?
1. ✅ **Addresses All Pain Points**: Maintainability, testability, extensibility
2. ✅ **Manageable Risk**: Phased approach with incremental value
3. ✅ **Best ROI**: Maximum gain for reasonable effort
4. ✅ **Team-Friendly**: Clear deliverables each week

### 4-Week Phased Implementation

```
┌─────────────────────────────────────────────────────────────┐
│ WEEK 1: FOUNDATION                                          │
│ - Vite + TypeScript setup                                  │
│ - ESLint + Prettier + Vitest                               │
│ - CI/CD pipeline (GitHub Actions)                          │
│ - Core type definitions                                    │
│ Deliverable: Build system + first unit test passing       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ WEEK 2: CONTENT EXTRACTION REFACTOR                         │
│ - Split content.js into 8-10 modules                       │
│ - Create IProvider interface                               │
│ - Implement MediumProvider + HeuristicProvider             │
│ - Unit tests for extraction logic                          │
│ Deliverable: Testable content extraction with 80% coverage │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ WEEK 3: PDF GENERATION REFACTOR                             │
│ - Split popup.js into 8-10 modules                         │
│ - Extract PDF, image, emoji, unicode logic                 │
│ - Unit tests for PDF generation                            │
│ Deliverable: Testable PDF generation with 70% coverage    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ WEEK 4: INTEGRATION & LAUNCH                                │
│ - End-to-end tests                                         │
│ - Performance benchmarks                                    │
│ - Documentation update                                      │
│ - Release v1.0.0                                           │
│ Deliverable: Production-ready refactored extension        │
└─────────────────────────────────────────────────────────────┘
```

---

## Risk vs Gain Analysis

### Visual Summary (from charts)

The scatter plot shows:
- **X-axis**: Implementation Risk (1-10)
- **Y-axis**: Expected Gain (1-10)
- **Bubble size**: Implementation Effort

**Key Insights**:
1. **Proposal F (Hybrid)** offers the best balance: Medium risk, high gain
2. **Proposal E (Layered)** has the highest gain but also the highest risk
3. **Proposals A, B, C** are lower risk but provide partial solutions
4. **Proposal D (Provider)** focuses specifically on extensibility

---

## Decision Matrix

| Priority | If You Need... | Choose |
|----------|----------------|--------|
| **Urgent** | Quick maintainability win in 1 week | **A + C (Mini-Phase)** |
| **Balanced** | Best ROI with managed risk | **F (Hybrid)** ⭐ |
| **Future-Proof** | MV3 compliance ASAP | **B (MV3 Migration)** |
| **Extensibility** | Easy addition of new sites | **D (Provider Architecture)** |
| **Enterprise** | Maximum architectural quality | **E (Layered)** |

---

## Alternative: Mini-Phase Approach (1 Week)

If 4 weeks is too much commitment, start with this:

### Days 1-2: Tooling Setup
- ✅ Vite + TypeScript + ESLint
- ✅ Basic type definitions
- ✅ First build passing

### Days 3-4: Modularize popup.js
- ✅ Split into 5 focused modules
- ✅ PDF generation, image processing, UI separated
- ✅ Unit tests for critical paths

### Days 5: Modularize content.js
- ✅ Split into 5 focused modules
- ✅ Container detection, pruning, block building separated
- ✅ Unit tests for extraction logic

### Days 6-7: Testing & Documentation
- ✅ Integration tests
- ✅ Update README
- ✅ Release v0.2.0

**Result**: 70% of benefit in 25% of time

---

## Success Criteria

### Immediate Goals (Proposal F)
- [ ] 80%+ test coverage
- [ ] All CI checks passing
- [ ] TypeScript compilation with no errors
- [ ] Build size same or smaller
- [ ] PDF generation unchanged
- [ ] New provider addable in < 1 day

### Long-Term Goals
- [ ] MV3 migration path documented
- [ ] Maintainability score improved
- [ ] Code complexity reduced
- [ ] Community contributions enabled

---

## Next Steps

### 1. Review & Decide (This Week)
- Team reviews REFACTORING_ANALYSIS.md
- Discuss priorities and constraints
- Choose primary proposal
- Allocate developer time

### 2. Kickoff (Week 1)
- Set up development environment
- Initialize Phase 1 tasks
- Establish regular check-ins

### 3. Execute (Weeks 1-4)
- Follow phased plan
- Weekly demos
- Continuous integration

### 4. Launch (End of Week 4)
- Final testing
- Documentation update
- Release v1.0.0
- Celebrate! 🎉

---

## Questions to Consider

1. **Timeline**: Can we allocate 4 weeks, or should we start with 1-week mini-phase?
2. **Team Size**: How many developers are available?
3. **Priority**: Maintainability, extensibility, or future-proofing?
4. **Risk Tolerance**: Conservative (Proposal A) or ambitious (Proposal E)?
5. **MV3 Urgency**: How soon do we need Manifest V3 compliance?

---

## Resources Needed

### Human Resources
- **1-2 developers** (full-time for 4 weeks)
- **Optional**: 1 QA engineer for testing phase

### Tools & Services
- **Free**: Vite, TypeScript, ESLint, Prettier, Vitest
- **Free**: GitHub Actions (CI/CD)
- **Optional**: Visual regression testing tools

### Training
- TypeScript basics (if team is new)
- Testing best practices
- Provider pattern understanding

---

## Conclusion

The **Hybrid Approach (Proposal F)** offers the best balance of:
- ✅ Immediate maintainability improvements
- ✅ Long-term extensibility
- ✅ Type safety and testing
- ✅ Manageable implementation risk
- ✅ Clear phased delivery

**Alternative**: If time is constrained, start with the **1-week mini-phase** to get 70% of the benefits quickly, then expand later.

---

**Ready to Begin?** Review the full analysis in `REFACTORING_ANALYSIS.md` and let's plan the kickoff! 🚀

