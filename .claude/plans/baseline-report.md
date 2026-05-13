# Sprint baseline-report: Baseline Estate Report

## Context

All three personas need a structured analytical report summarising the estate *before* any simulation decisions are made -- for board briefings, procurement assessments, and architectural risk profiles. The current "Export" button (`btnExportHTML`) does a DOM clone which produces a raw visual dump -- not structured for stakeholder consumption. The "Export Report" button only appears during simulation and requires decisions.

**Decision:** Replace the existing `btnExportHTML` DOM-clone export with a structured "Baseline Report" that generates an analytical document from state data. The DOM-clone approach (copying `estateSummaryPanel.innerHTML`, `dashboardMatrix.outerHTML`, `timelineSection.innerHTML` verbatim) is not useful for offline circulation. The new Baseline Report serves the same button position but produces genuinely useful output.

When simulation is active, the separate "Export Report" button (in `simButtonGroup`) continues to produce the decision-impact report. The Baseline Report remains available at all times -- it shows the estate *before* any decisions, regardless of simulation state.

## Scope

- Replace `exportToHTML()` with `exportBaselineReport()` on the existing "Export" button
- Remove `exportToHTML()` function from `src/main.js`
- New file `src/features/baseline-report.js` containing the structured report generator
- Persona-tailored content with per-successor breakdown in transition mode

## Implementation

### 1. New file: `src/features/baseline-report.js`

**Imports:**
```javascript
import { state } from '../state.js';
import { computeEstateSummaryMetrics, classifyRationalisationPattern } from '../analysis/metrics.js';
import { computeSignals, computeTcopAssessment, computeVendorDensityMetrics } from '../analysis/signals.js';
import { classifyVestingZone, detectSharedServiceBoundary } from '../analysis/allocation.js';
import { SIGNAL_DEFS } from '../constants/signals.js';
import {
    formatCost, escHtml, tierLabel, tierColour,
    personaLabel, personaColour, computeNoticeTrigger, formatVestingRelative
} from './report-export.js';
```

All referenced helpers are already exported from `src/features/report-export.js` (lines 25-210).

### 2. Report structure per persona

#### Executive Baseline Report

| # | Section | Data Source | Content |
|---|---|---|---|
| 1 | Estate Profile | `computeEstateSummaryMetrics()` | Predecessor count, system count, collision count, total annual spend |
| 2 | Transition Risk Summary | `computeEstateSummaryMetrics()` | Pre-vesting notice triggers, disaggregation candidates, monolithic+disaggregation, cross-boundary shared services |
| 3 | Tier Distribution | `state.lgaFunctionMap` + `state.tierMap` | Count of functions per tier; Tier 1 function names listed explicitly |
| 4 | Critical Path Items | `computeEstateSummaryMetrics().criticalPathSystems` | Table sorted by trigger date: system, vendor, council, notice trigger, months before vesting |
| 5 | Per-Successor Summary | `state.successorAllocationMap` | Comparison table: system count, spend, disaggregation count, Tier 1 function count per successor |
| 6 | Key Risk Indicators | Iterate `lgaFunctionMap`, compute signals | Top 10 functions by strongest signal (function name, headline signal, tier badge) |

#### Commercial Baseline Report

| # | Section | Data Source | Content |
|---|---|---|---|
| 1 | Contract Landscape | `computeEstateSummaryMetrics()` + system iteration | Total spend, system count, contracts with notice periods, pre-vesting triggers |
| 2 | Vendor Landscape | `computeVendorDensityMetrics(allSystems)` | Table: vendor, system count, council count, spend, consolidation opportunity |
| 3 | Contract Timeline | All systems with `endYear` | Table sorted by notice trigger: system, vendor, council, contract end, vesting zone |
| 4 | Pre-Vesting Actions Required | Systems in pre-vesting zone | Critical subset requiring predecessor action before vesting |
| 5 | Per-Successor Procurement Profile | `state.successorAllocationMap` | For each successor: top vendors by spend, contract urgency count, shared service count |
| 6 | Shared Service Contracts | Systems with `sharedWith` | Table with boundary-crossing analysis |

#### Architect Baseline Report

| # | Section | Data Source | Content |
|---|---|---|---|
| 1 | Technical Posture | All system nodes | Cloud vs on-prem count/%, monolithic count, low portability count, ERP count |
| 2 | TCoP Assessment | `computeTcopAssessment()` per system | Aggregate concern counts, table of top concerns (system, TCoP point, description) |
| 3 | Data Complexity Heatmap | `lgaFunctionMap` + allocation | Functions with monolithic/low-portability systems, rationalisation pattern, affected councils |
| 4 | Capability Platform Map | Systems with `capabilityType` | Capability types in use, competing platforms across councils |
| 5 | Per-Successor Technical Profile | `state.successorAllocationMap` | For each successor: on-prem %, monolithic count, ERP count, worst TCoP concerns |
| 6 | Rationalisation Complexity | `classifyRationalisationPattern()` per cell | Count by pattern type; explicit list of extract-and-partition / extract-partition-and-consolidate functions |

### 3. UI Changes

**Replace existing Export button behaviour.** The button at `src/index.html` line 169:

```html
<button id="btnExportHTML" class="gds-btn-secondary px-3 py-1.5 text-sm font-bold hover:bg-gray-100">Export</button>
```

Rename to `btnBaselineReport` and change label:

```html
<button id="btnBaselineReport" class="gds-btn-secondary px-3 py-1.5 text-sm font-bold hover:bg-gray-100">Baseline Report</button>
```

**In `src/main.js`:**
- Remove the `exportToHTML()` function (lines 2540-2677) entirely
- Remove the event listener at line 2538: `document.getElementById('btnExportHTML').addEventListener('click', exportToHTML);`
- Add new import and listener:
```javascript
import { exportBaselineReport } from './features/baseline-report.js';
document.getElementById('btnBaselineReport').addEventListener('click', () => exportBaselineReport());
```

### 4. Function signature

```javascript
/**
 * Generates a persona-tailored baseline estate report and opens in new window.
 * Available whenever Stage 3 is active (lgaFunctionMap populated).
 * Does NOT require simulation state -- reports estate as-is.
 */
export function exportBaselineReport() {
    const persona = state.activePersona || 'executive';
    // Build HTML per persona from state data
    // Open in new window
}
```

### 5. HTML Document Pattern

Match `report-export.js` approach:
- Self-contained HTML with inline CSS (no Tailwind CDN, no external dependencies)
- GOV.UK-inspired typography and table styling (reuse the `buildReportDocStart` pattern)
- Persona-branded header bar (black for executive, green for commercial, purple for architect)
- Print media query for clean PDF generation
- Open via `window.open('', '_blank')` + `document.write()`
- Title: "LGR Baseline Estate Report -- {persona label}"

Header metadata section:
- Generated timestamp
- Operating mode (Discovery / Transition Planning)
- Vesting date (if set)
- Successor authorities (if set)
- Predecessor councils (list)
- Active signal weights summary

### 6. Per-Successor Breakdown Logic

In transition mode, iterate `state.successorAllocationMap`:

```javascript
state.successorAllocationMap.forEach((funcMap, successorName) => {
    const seenSystems = new Set();
    let spend = 0, disaggCount = 0, tier1Count = 0, preVestingCount = 0;
    let onPremCount = 0, monolithicCount = 0, erpCount = 0;

    funcMap.forEach((allocations, functionId) => {
        const tier = state.tierMap.get(functionId) || 3;
        if (tier === 1) tier1Count++;
        allocations.forEach(alloc => {
            if (!alloc.system || seenSystems.has(alloc.system.id)) return;
            seenSystems.add(alloc.system.id);
            if (typeof alloc.system.annualCost === 'number') spend += alloc.system.annualCost;
            if (alloc.isDisaggregation) disaggCount++;
            if (!alloc.system.isCloud) onPremCount++;
            if (alloc.system.dataPartitioning === 'Monolithic') monolithicCount++;
            if (alloc.system.isERP) erpCount++;
            // Pre-vesting check using computeNoticeTrigger + vestingDate
        });
    });
});
```

### 7. Discovery Mode Handling

When `state.operatingMode === 'discovery'`:
- Skip sections that require `successorAllocationMap` (per-successor breakdown, rationalisation patterns)
- Replace "Transition Risk" with "Cross-Council Comparison" (per-council metrics from `state.mergedArchitecture.councils`)
- Contract timeline uses today-relative analysis only (no vesting zone)
- Replace vesting language with planning horizon language

### 8. Key Risk Indicators Logic (Executive Section 6)

To avoid excessive computation, iterate `lgaFunctionMap` and compute signals only for functions with collisions (councils.size > 1) or Tier 1/2 classification:

```javascript
const riskRows = [];
state.lgaFunctionMap.forEach((entry, functionId) => {
    const systems = getAllSystemsForFunction(entry); // gather from mergedArchitecture
    if (systems.length === 0) return;
    const signals = computeSignals(systems);
    const strongSignals = signals.filter(s => s.strong);
    if (strongSignals.length === 0) return;
    riskRows.push({ functionId, label: entry.label, tier: state.tierMap.get(functionId) || 3, signals: strongSignals });
});
riskRows.sort((a, b) => a.tier - b.tier || b.signals.length - a.signals.length);
// Take top 10-15
```

## Acceptance Criteria

- [ ] The existing "Export" button (btnExportHTML) is replaced by "Baseline Report" (btnBaselineReport)
- [ ] The `exportToHTML()` DOM-clone function is removed from `src/main.js`
- [ ] "Baseline Report" button is visible whenever Stage 3 is active, regardless of simulation state
- [ ] Clicking generates a self-contained HTML report in a new browser window
- [ ] Report content is tailored to the active persona with different section structures
- [ ] Executive report contains all 6 sections: estate profile, transition risk, tier distribution, critical path, per-successor summary, key risk indicators
- [ ] Commercial report contains all 6 sections: contract landscape, vendor landscape, contract timeline, pre-vesting actions, per-successor procurement, shared services
- [ ] Architect report contains all 6 sections: technical posture, TCoP assessment, data complexity, capability platforms, per-successor technical, rationalisation complexity
- [ ] In discovery mode, per-successor sections become per-council equivalents
- [ ] Report uses no external dependencies (self-contained inline CSS)
- [ ] Report renders correctly for print/PDF
- [ ] All sections handle missing optional data gracefully
- [ ] The simulation "Export Report" button (btnExportReport in simButtonGroup) continues to work unchanged

## Files Modified

| File | Change |
|---|---|
| `src/features/baseline-report.js` | **NEW** -- Structured baseline report generation (~500 lines) |
| `src/index.html` | Rename `btnExportHTML` to `btnBaselineReport`, update label text |
| `src/main.js` | Remove `exportToHTML()` (~140 lines), remove old listener, add import + new listener for `exportBaselineReport` |

## Verification

1. **Build:** `node build.js` completes without errors
2. **Unit tests:** `npm test` passes (nothing currently tests exportToHTML, so removal is safe)
3. **Manual test -- transition mode:**
   - Load example scenario 08 (complex, multi-successor)
   - Confirm "Baseline Report" button visible where "Export" used to be
   - Click for each persona -- verify report opens with correct sections
   - Verify per-successor breakdown shows correct data
4. **Manual test -- discovery mode:**
   - Load 2+ councils, skip transition config
   - Verify per-council breakdown, no successor sections, no vesting-relative language
5. **Simulation coexistence:**
   - Enter simulation mode
   - Verify "Baseline Report" still works (shows pre-decision estate)
   - Verify "Export Report" (in simButtonGroup) still works (shows decisions/impact)
6. **Print test:** Ctrl+P on generated report -- tables paginate cleanly

## Risk Notes

- **Removing exportToHTML:** Check if any test files reference `exportToHTML` or `btnExportHTML`. Quick grep suggests no unit tests cover it, but verify before removing.
- **Performance:** Computing signals for "Key Risk Indicators" iterates full lgaFunctionMap. Cap output at top 10-15 functions. For estates with 100+ functions this should still be fast (<100ms).
- **Button ID change:** Any code referencing `btnExportHTML` must be updated. Grep shows only `src/main.js` line 2538 uses it.
- **No state mutation:** Report generation is a pure read -- no side effects.
