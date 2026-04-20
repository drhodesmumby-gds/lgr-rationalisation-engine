# Sprint 2: Analysis Column UX Redesign

## Scope

Replace the prose-dump Analysis column with a two-layer rendering system:
1. **Compact in-cell view**: Signal indicator strip + headline + "View full analysis" link
2. **Rich analysis modal**: Persona-specific Q&A with directional recommendations, formatted TCoP checklist, key metrics

The full approved plan is at `../../.claude/plans/elegant-singing-rain.md`.

## Acceptance Criteria

### AC-1: Infrastructure — Modal HTML, CSS, state variable

- [ ] New `#analysisModal` HTML element added between the tier mapping modal (line 266) and `</main>` (line 268). Follows existing modal pattern: fixed overlay, centered white panel, `border-t-8 border-[#1d70b8]`, close button, scrollable content area with `max-h-[85vh]`.
- [ ] Close button wired: clicking `#btnCloseAnalysis` hides the modal.
- [ ] New CSS classes added to the `<style>` block:
  - `.signal-dot` base class + `.signal-dot-red`, `.signal-dot-amber`, `.signal-dot-green`, `.signal-dot-blue`, `.signal-dot-purple`, `.signal-dot-black` — small colored indicator pills
  - `.qa-card` — left-bordered card for Q&A items in the modal
  - `.qa-indicator` + `.qa-indicator-red`, `.qa-indicator-amber`, `.qa-indicator-green`, `.qa-indicator-blue`, `.qa-indicator-neutral` — traffic light dots
- [ ] Module-level `let analysisModalData = [];` state variable added near the other state variables (~line 272).
- [ ] `analysisModalData = [];` reset at the top of `renderDashboard()`.

### AC-2: Compact in-cell view — Replace prose with signal strip

- [ ] New function `renderSignalStrip(signals)` renders all active signals as a horizontal row of small colored indicator pills using `flex flex-wrap gap-1.5`. Each pill shows an abbreviated label + colored background. Full signal text is in the `title` attribute for hover inspection.
- [ ] Signal-to-indicator mapping uses the existing `tag` field from each signal: `tag-red` → `signal-dot-red`, `tag-orange` → `signal-dot-amber`, `tag-blue` → `signal-dot-blue`, `tag-purple` → `signal-dot-purple`, `tag-black` → `signal-dot-black`.
- [ ] New function `getHeadlineMetrics(signals, pattern)` selects 1-2 signals for inline headline display. Prioritizes highest-weighted signal with `strong: true`. Pattern-aware: extract patterns prioritize data signals, consolidate patterns prioritize volume/vendor.
- [ ] New function `renderCompactAnalysis(signals, pattern, systems, anchorSystem, persona, allocations, functionLabel)` assembles: pattern tag (reuse `renderPatternTag()`) + signal strip + headline text + "View full analysis →" link.
- [ ] The "View full analysis" link stores cell data in `analysisModalData[index]` and calls `openAnalysisModal(index)` on click.
- [ ] `buildPersonaAnalysis()` modified to accept `functionLabel` parameter and call `renderCompactAnalysis()` instead of `renderSignalRow()` for the multi-system case.
- [ ] Both call sites in `renderDashboard()` updated to pass `lgaFunc.label` to `buildPersonaAnalysis()`.
- [ ] Single-system cells ("No collision") also use compact signal strip format but without "View full analysis" link.
- [ ] The old `renderSignalRow()` function is preserved (used by export) but no longer called from `buildPersonaAnalysis()`.

### AC-3: Analysis detail modal — Pattern explanation + TCoP + metrics

- [ ] New function `openAnalysisModal(index)` reads from `analysisModalData[index]`, populates `#analysisModalContent`, and shows the modal.
- [ ] Modal header shows: function label, pattern tag, pattern explanation.
- [ ] New function `renderPatternExplanation(pattern)` returns HTML describing what the pattern means and what actions it implies. All 4 patterns covered: inherit-as-is, choose-and-consolidate, extract-and-partition, extract-partition-and-consolidate.
- [ ] New function `renderTcopSection(systems)` renders a formatted per-system TCoP checklist. Each system gets a heading and a list of check marks (alignments) and warning icons (concerns). Calls `computeTcopAssessment()` per system. No semicolon-concatenated prose.
- [ ] New function `renderKeyMetrics(systems, signals)` renders a compact grid showing: total users, combined annual cost, system count, on-prem count, monolithic count.
- [ ] All sections render correctly with the demo data and all 4 sample JSON files.

### AC-4: Persona-specific Q&A engine

- [ ] New function `generatePersonaQuestions(persona, pattern, signals, systems, anchorSystem, allocations)` returns an array of `{ question, answer, indicator, indicatorLabel }` objects.
- [ ] **Executive questions** implemented (4-6 per pattern):
  - "What needs to be operational on Day 1?" — tier-driven
  - "When must contract decisions be made?" — vesting zone
  - "What is the financial exposure?" — cost analysis
  - "Is there a shared service at risk?" — unwinding status
  - (consolidate patterns) "What are the consolidation options?" — anchor, portability, cost
  - (extract patterns) "How complex is the data extraction?" — monolithic, portability
- [ ] **Commercial questions** implemented (4-5 per pattern):
  - "Can we leverage vendor commonality?" — vendor density
  - "What notice constraints apply?" — per-system notice periods
  - "What are the cost paths?" — cost differential analysis
  - "Is there a procurement consolidation opportunity?" — vendor + expiry alignment
  - (consolidate) "What is the recommended procurement approach?"
- [ ] **Architect questions** implemented (4-6 per pattern):
  - "Which system should be the migration anchor?" — user volume, portability, TCoP trade-offs
  - "What data complexity exists?" — per-system partitioning and portability
  - "Which approach aligns with TCoP?" — per-option comparison
  - "What is the on-premise exposure?" — cloud vs on-prem
  - (extract) "What is the data extraction strategy?"
  - (consolidate) "What are the API and integration implications?"
- [ ] Each answer is a synthesized directional recommendation using signal data. Frames trade-offs without prescribing specific system choices.
- [ ] Each question-answer pair has a traffic-light indicator: red (action needed urgently), amber (attention required), green (on track/low risk), blue (informational), neutral (no data).
- [ ] Answers handle null/missing data gracefully (null checks, fallback text for missing users/cost/portability).
- [ ] Q&A renders in the modal as styled cards with indicator dots.

### AC-5: Regression and compatibility

- [ ] All 41 existing property tests pass (`npm test`).
- [ ] Zero JavaScript console errors when loading demo data and navigating all stages.
- [ ] Works in both Estate Discovery and Transition Planning modes.
- [ ] Works for all 3 personas (executive, commercial, architect).
- [ ] HTML export still functions (compact view in export is acceptable — non-functional "View Analysis" links are OK for PoC).
- [ ] Glossary, Signal Options, and Tier Mapping modals still work.
- [ ] No existing pure functions modified (`computeSignals`, `computeTcopAssessment`, `classifyRationalisationPattern`, `computeSignalEmphasis`, etc.).

## Implementation Notes

### Phase order
1. **Infrastructure** (AC-1): Modal HTML, CSS, state variable
2. **Compact view** (AC-2): Signal strip, headline, replace prose — immediate visual improvement
3. **Modal content** (AC-3): Pattern explanation, TCoP checklist, metrics grid
4. **Persona Q&A** (AC-4): The core analytical engine — largest new piece
5. **Regression** (AC-5): Test everything

### Key patterns to follow
- Modal HTML pattern: copy structure from `#tierMappingModal` (lines 259-266)
- Dynamic modal content: follow `renderTierMappingModal()` pattern (line 370)
- Event handler registration: follow existing `addEventListener` pattern (~line 365)
- `analysisModalData` state pattern: store data during render, read at click time

### Data flow for modal
```
renderDashboard() resets analysisModalData = []
  → buildPersonaAnalysis() calls renderCompactAnalysis()
    → renderCompactAnalysis() pushes to analysisModalData[], returns HTML with onclick
      → User clicks "View full analysis →"
        → openAnalysisModal(index) reads analysisModalData[index], populates modal
```

### Answer generation approach
Each persona question has a generator function that:
1. Extracts relevant data from signals/systems/allocations
2. Builds a narrative sentence using template literals with conditionals
3. Assigns indicator color based on clear heuristics (e.g. pre-vesting = red, year-1 = amber)
4. Returns `{ question, answer, indicator, indicatorLabel }`

Null checks on every data access — systems may lack `users`, `annualCost`, `portability`, etc.

## Test Plan

### Property tests
- All 41 must pass. No pure functions are modified.

### Browser tests
1. Load demo data → verify compact signal strip renders in analysis cells (not prose)
2. Click "View full analysis" on a collision row → verify modal opens with pattern explanation, Q&A, TCoP, metrics
3. Switch to each persona → verify different question sets in the modal
4. Test `inherit-as-is` cell (single system in successor) → verify no "View Analysis" for no-collision cells
5. Test `choose-and-consolidate` → verify consolidation-specific questions appear
6. Test `extract-and-partition` → verify extraction-specific questions appear
7. Test Transition Planning mode → verify pattern-aware analysis
8. Test Estate Discovery mode → verify compact view works without pattern context
9. Verify export button still works
10. Check console for JS errors throughout

## Risk Notes

- **File size**: Will grow from ~2,360 to ~2,800-2,900 lines. Acceptable for single-file PoC.
- **Export**: "View Analysis" links non-functional in export. Acceptable for now.
- **Answer quality edge cases**: 0 users, missing annualCost, undefined portability. Every template needs null guards.
- **`generatePersonaQuestions` complexity**: This is the largest new function. If running low on context, implement Executive questions first (broadest audience), then Architect (most data-intensive), then Commercial.
- **Update `status.md` frequently** — this is a large sprint. Write status before/after each phase.
