# Gap Analysis: Spec vs Implementation

**Date**: 2026-04-17
**Analysed file**: `lgr-rationalisation-engine.html` (2,357 lines)
**Spec sources**: `requirements.md`, `design.md`, `PLAN.md`, `TECHNICAL-ARCHITECTURE.md`

---

## CRITICAL BUG — Application-Breaking

### Duplicate `const alloc` declaration in `buildSystemCard()` (lines 1161, 1185)

The function `buildSystemCard()` (line 1147) declares `const alloc = allocations ? allocations[idx] : null;` twice within the same `forEach` callback scope:
- **Line 1161**: Used for provenance label rendering
- **Line 1185**: Used for disaggregation flag rendering

This is a **`SyntaxError`** in strict mode and will crash in many browsers. Since `buildSystemCard()` is called during both transition planning and estate discovery rendering (lines 1048, 1133), this bug could break the entire Stage 3 dashboard, particularly in transition planning mode where `allocations` is passed.

**Severity**: BLOCKER — must be fixed before any other work.

---

## Requirement-by-Requirement Analysis

### Requirement 1: Transition Structure Configuration — MOSTLY IMPLEMENTED

| AC | Status | Evidence |
|---|---|---|
| 1.1 Accept optional Transition_Structure | IMPLEMENTED | `transitionStructure` state var (line 280), `collectTransitionStructure()` (line 572) |
| 1.2 Estate Discovery when no structure | IMPLEMENTED | `deriveOperatingMode()` (line 624), fallback in `renderDashboard()` (line 1071) |
| 1.3 Transition Planning with successor columns | IMPLEMENTED | Lines 974–1069, successor columns rendered |
| 1.4 Full predecessor → direct assignment | IMPLEMENTED | `buildSuccessorAllocation()` lines 1330–1338 |
| 1.5 Partial predecessor → allocation review flag | IMPLEMENTED | Lines 1341–1349, `needsAllocationReview: true` |
| 1.6 `targetAuthorities` override | IMPLEMENTED | Lines 1309–1321 |
| 1.7 Multi-successor `targetAuthorities` → disaggregation | IMPLEMENTED | `isDisaggregation` computed at line 1418 |
| 1.8 Partial structure accepted | IMPLEMENTED | `collectTransitionStructure()` handles empty successors (line 640) |
| 1.9 Recompute without full reload | IMPLEMENTED | "Reconfigure Transition" button (line 669) triggers `renderDashboard()` |

**Verdict**: Fully implemented structurally, but the duplicate `const alloc` bug (above) will crash transition mode rendering.

### Requirement 2: Vesting-Anchored Contract Analysis — FULLY IMPLEMENTED

| AC | Status | Evidence |
|---|---|---|
| 2.1 Four zones computed relative to vesting | IMPLEMENTED | `classifyVestingZone()` line 1445 |
| 2.2 Timeline centred on vesting date | IMPLEMENTED | `drawTimeline()` lines 2074–2104, dynamic range `vestingDate - 2 years` to `+ 4 years` |
| 2.3 Pre-vesting notice → predecessor must serve notice | IMPLEMENTED | Signal text includes "predecessor must serve notice" (line 1853) |
| 2.4 Fallback to today-relative without vesting | IMPLEMENTED | Lines 1866–1882 |
| 2.5 Zone label in signal output | IMPLEMENTED | Lines 1852–1863 include zone label |
| 2.6 Timeline adapts date range to vesting | IMPLEMENTED | Lines 2075–2087 |

**Verdict**: Fully implemented and clean.

### Requirement 3: Playbook-Aligned Tiered Prioritisation — FULLY IMPLEMENTED

| AC | Status | Evidence |
|---|---|---|
| 3.1 DEFAULT_TIER_MAP embedded | IMPLEMENTED | Lines 308–320, maps ESD IDs to tiers 1/2/3 |
| 3.2 Sort by tier → collision → alpha | IMPLEMENTED | `sortFunctionRows()` line 1503 |
| 3.3 Function-level `tier` override | IMPLEMENTED | `computeEffectiveTier()` line 1473 checks `functionNode.tier` |
| 3.4 Tier badge in row header | IMPLEMENTED | Lines 1003–1009, 1104–1109 |
| 3.5 Tier mapping reference modal | IMPLEMENTED | `renderTierMappingModal()` line 370, "View Tier Mapping" button line 410 |
| 3.6 Tier 3 → Tier 2 promotion | IMPLEMENTED | Lines 1481–1495 in `computeEffectiveTier()` |

**Verdict**: Fully implemented. `DEFAULT_TIER_MAP` entries match spec (14 Tier 1, 13 Tier 2, 10 Tier 3).

### Requirement 4: Rationalisation Pattern Classification — FULLY IMPLEMENTED (with rendering bug)

| AC | Status | Evidence |
|---|---|---|
| 4.1 Four patterns classified | IMPLEMENTED | `classifyRationalisationPattern()` line 1515 |
| 4.2 Single-source → inherit-as-is | IMPLEMENTED | Lines 1522–1524 |
| 4.3 Multi-predecessor → choose-and-consolidate | IMPLEMENTED | Lines 1526–1528 |
| 4.4 Partial predecessor disaggregation → extract-and-partition | IMPLEMENTED | Line 1540 |
| 4.5 Disaggregation + competing → extract-partition-and-consolidate | IMPLEMENTED | Lines 1536–1537 |
| 4.6 Colour-coded pattern tag | IMPLEMENTED | `renderPatternTag()` line 1546 |
| 4.7 Extract patterns → emphasise data signals | IMPLEMENTED | `computeSignalEmphasis()` line 1670 |
| 4.8 Consolidate pattern → emphasise volume signals | IMPLEMENTED | Lines 1682–1684 |

**Verdict**: Logic is fully implemented, but rendering is blocked by the `buildSystemCard` duplicate-const bug.

### Requirement 5: TCoP Alignment Signal — FULLY IMPLEMENTED

| AC | Status | Evidence |
|---|---|---|
| 5.1 Compute TCoP from existing fields | IMPLEMENTED | `computeTcopAssessment()` line 1562 |
| 5.2 `isCloud: true` → Point 5 aligned | IMPLEMENTED | Line 1568 |
| 5.3 `isCloud: false` → Point 5 concern | IMPLEMENTED | Line 1569 |
| 5.4 `portability: "High"` → Point 4 aligned | IMPLEMENTED | Line 1574 |
| 5.5 `portability: "Low"` → Points 3,4,11 concern | IMPLEMENTED | Lines 1579–1583 |
| 5.6 Monolithic ERP → Point 9 concern | IMPLEMENTED | Line 1586 |
| 5.7 Neutral framing with TCoP disclaimer | IMPLEMENTED | Line 1970 includes "These are factors to consider..." |
| 5.8 Configurable per-persona weights | IMPLEMENTED | Lines 335–338, tcopAlignment weights per persona |

**Verdict**: Fully implemented.

### Requirement 6: Shared Service Detection — PARTIALLY IMPLEMENTED

| AC | Status | Evidence |
|---|---|---|
| 6.1 Accept `sharedWith` array | IMPLEMENTED | Read at runtime (line 1986 filters for it) |
| 6.2 Display shared service indicator on card | **MISSING** | `buildSystemCard()` does NOT render any `sharedWith` indicator on the system card itself |
| 6.3 Unwinding flag when councils → different successors | IMPLEMENTED | `detectSharedServiceBoundary()` line 1600, signal at line 2008 |
| 6.4 Continuation note when same successor | IMPLEMENTED | Signal at line 2010 |
| 6.5 Configurable per-persona weights | IMPLEMENTED | Lines 335–338, sharedService weights |

**Gap**: The shared service detection works in the signal/analysis column, but there is no visual indicator on the **system card itself** showing which councils share the system (Requirement 6.2). The spec says "THE Engine SHALL display a shared service indicator on that system's card showing which councils share the system."

### Requirement 7: Disaggregation Flag — IMPLEMENTED (blocked by bug)

| AC | Status | Evidence |
|---|---|---|
| 7.1 Allocation review flag | IMPLEMENTED | Lines 1187–1197, flag text matches spec |
| 7.2 Monolithic + disaggregation highlight | IMPLEMENTED | Line 1190 |
| 7.3 Segmented → geographic partitioning note | IMPLEMENTED | Line 1192 |
| 7.4 Flag in every successor column | IMPLEMENTED | Via allocation metadata passed to `buildSystemCard` |

**Verdict**: Logic is correct, but the duplicate `const alloc` bug at line 1185 will crash before this code executes.

### Requirement 8: Estate Summary Panel — FULLY IMPLEMENTED

| AC | Status | Evidence |
|---|---|---|
| 8.1 Summary panel above matrix | IMPLEMENTED | `renderEstateSummary()` line 800, positioned at line 180 |
| 8.2 Predecessor count, successor count, vesting date | IMPLEMENTED | Lines 817–862 |
| 8.3 Total systems, collision count | IMPLEMENTED | Lines 822–832 |
| 8.4 Total annual spend from `annualCost` | IMPLEMENTED | Lines 834–840, `computeEstateSummaryMetrics()` lines 1714–1719 |
| 8.5 Pre-vesting notice trigger count | IMPLEMENTED | Lines 864–870 |
| 8.6 Disaggregation and monolithic+disagg counts | IMPLEMENTED | Lines 872–886 |
| 8.7 Cross-boundary shared service count | IMPLEMENTED | Lines 888–894 |
| 8.8 Accept `annualCost` numeric field | IMPLEMENTED | Read at line 1716 |

**Verdict**: Fully implemented.

### Requirement 9: Financial Distress Flag — FULLY IMPLEMENTED

| AC | Status | Evidence |
|---|---|---|
| 9.1 Accept `financialDistress` on council metadata | IMPLEMENTED | Read at line 725 during baselining |
| 9.2 Warning on every system card from distressed council | IMPLEMENTED | Lines 1173–1176 in `buildSystemCard()` |
| 9.3 Warning on column header | IMPLEMENTED | Line 1082 in estate discovery mode column headers |

**Minor gap**: In transition planning mode (successor columns), distressed council warnings appear on system cards (correct), but there is no column-header-level warning since columns are successor authorities, not predecessor councils. The spec says "display a warning indicator on the council column header" — this only applies in Estate Discovery mode where columns are predecessor councils. The implementation is **correct for the design**.

**Verdict**: Fully implemented.

### Requirement 10: Council Tier Metadata — FULLY IMPLEMENTED

| AC | Status | Evidence |
|---|---|---|
| 10.1 Accept `tier` on council metadata | IMPLEMENTED | Read at line 719, stored in `councilTierMap` |
| 10.2 Display tier on cards and headers | IMPLEMENTED | Card: lines 1167–1171, Headers: lines 1080–1081 |
| 10.3 Cross-tier collision annotation | IMPLEMENTED | `detectCrossTierCollision()` line 1626, rendered at lines 1017–1023, 1117–1124 |

**Verdict**: Fully implemented.

### Requirement 11: Export for Governance Packs — FULLY IMPLEMENTED

| AC | Status | Evidence |
|---|---|---|
| 11.1 HTML print view with matrix, summary, timeline | IMPLEMENTED | `exportToHTML()` line 2202, includes all three |
| 11.2 Include persona, weights, transition metadata | IMPLEMENTED | Lines 2220–2255 |
| 11.3 Respect current filter state | IMPLEMENTED | Clones current DOM elements which reflect current state |

**Verdict**: Fully implemented. Includes inline CSS (no CDN dependency) for offline use.

---

## Summary of Gaps

### BLOCKER (must fix first)

1. **Duplicate `const alloc` in `buildSystemCard()`** (lines 1161, 1185) — `SyntaxError` will crash the application in transition planning mode and potentially in all dashboard rendering.

### MISSING (feature not implemented)

2. **Requirement 6.2: Shared service indicator on system card** — The shared service signal appears only in the analysis column. There is no visual indicator on the system card itself showing which councils share the system. The spec requires: "THE Engine SHALL display a shared service indicator on that system's card showing which councils share the system."

### SAMPLE DATA GAPS (no runtime impact, but prevents end-to-end testing)

3. **No sample JSON files include the new optional fields**: `sharedWith`, `annualCost`, `councilMetadata` (with `tier` and `financialDistress`). The 5 existing JSON files exercise the baseline schema but none of the Transition Planning schema extensions. This means:
   - Shared service detection cannot be tested with existing sample data
   - Financial distress warnings cannot be seen with existing sample data
   - Council tier badges won't appear with existing sample data
   - Annual cost aggregation has no data to aggregate
   - The demo loader (line 2147) also lacks these fields

### DOCUMENTATION MISMATCH (non-blocking)

4. **CLAUDE.md JSON schema vs actual data format**: CLAUDE.md documents system properties nested under a `properties` object (`node.properties.users`), but both the code and all sample JSON files use top-level properties on the node (`node.users`). The code is correct; the documentation should be updated.

---

## Pure Functions — Fully Extracted and Testable

All 12 pure functions specified in the design are implemented and available for testing:

| Function | Line | Status |
|---|---|---|
| `buildSuccessorAllocation()` | 1242 | Implemented |
| `classifyVestingZone()` | 1445 | Implemented |
| `computeEffectiveTier()` | 1473 | Implemented |
| `sortFunctionRows()` | 1503 | Implemented |
| `classifyRationalisationPattern()` | 1515 | Implemented |
| `computeTcopAssessment()` | 1562 | Implemented |
| `detectSharedServiceBoundary()` | 1600 | Implemented |
| `detectCrossTierCollision()` | 1626 | Implemented |
| `propagateFinancialDistress()` | 1651 | Implemented |
| `computeSignalEmphasis()` | 1670 | Implemented |
| `computeEstateSummaryMetrics()` | 1695 | Implemented |
| `computeSignals()` | 1809 | Implemented |

---

## Test Infrastructure

Property-based tests exist for all 12 properties specified in the design:
- `tests/properties/` contains 12 test files matching the spec
- `tests/generators/` contains 4 generators (`arbITSystem`, `arbCouncil`, `arbTransitionStructure`, `arbEstate`)
- `tests/helpers/extract.js` extracts functions from the HTML file for testing
- `tests/setup.test.js` is a basic setup verification test

**Test suite status**: Not yet verified (needs `npm test` run).

---

## Prioritised Fix List

| Priority | Item | Effort |
|---|---|---|
| P0 | Fix duplicate `const alloc` in `buildSystemCard()` | 5 min |
| P1 | Add shared service indicator to system card (Req 6.2) | 30 min |
| P2 | Update sample JSON files with new optional fields | 1 hr |
| P2 | Update demo loader with new optional fields | 30 min |
| P3 | Fix CLAUDE.md JSON schema documentation | 15 min |

---

## Overall Assessment

The implementation is **substantially complete** — 10 out of 11 requirements are fully implemented, and the 11th (Shared Service Detection) is 4/5 acceptance criteria implemented. All 12 pure functions are correctly extracted. The signal system, tier system, transition structure configuration, vesting-anchored analysis, rationalisation patterns, estate summary, financial distress, council tiers, and HTML export are all present and match the spec.

However, the application has a **critical blocker**: the duplicate `const alloc` declaration in `buildSystemCard()` will cause a JavaScript error that prevents the dashboard from rendering properly. This must be fixed before anything else.

The secondary gap is the missing shared service indicator on system cards (Req 6.2), and the lack of sample data exercising the new schema fields.
