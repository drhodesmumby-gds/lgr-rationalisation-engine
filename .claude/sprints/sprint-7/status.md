# Sprint 7 Status: Inline Documentation

**Status:** COMPLETE
**Tests:** 41/41 passing

## What was implemented

### AC-1: Styled Tooltip Component
- Added `.tooltip-wrapper` / `.tooltip-content` CSS block to the `<style>` section (GOV.UK styling: white background, dark text, thin border, subtle shadow, max-width 300px)
- Created `wrapWithTooltip(text, tooltipContent)` function returning a keyboard-accessible `<span>` with `tabindex="0"` and `aria-label`
- Tooltip shows on hover via CSS visibility/opacity transition and on focus via `:focus-within`

### AC-2: Domain Term Tooltips
- Created `DOMAIN_TERMS` object with 16 term definitions
- Applied `wrapWithTooltip()` to:
  - `buildSystemCard()`: Portability label, Data Layer label, Cloud/On-Prem label, Anchor System badge, Shared service tag
  - Matrix rows (both transition and discovery mode): Tier badge labels, Cross-tier annotation
  - `renderEstateSummary()`: Collision count label, Vesting date label

### AC-3: Explanation Modals
- Added `DOCUMENTATION` object with 8 structured entries: `signals`, `patterns`, `tcop`, `tiers`, `perspectives`, `personas`, `metrics`, `timeline`
- Created `openDocModal(key)` function that populates and shows the shared `#docModal`
- Doc modal HTML added near other modals: `fixed inset-0` overlay, `border-t-8 border-[#1d70b8]` panel, close button, click-outside-to-close

### AC-4: Contextual Help Icons
- Created `helpIcon(docKey)` function rendering a `?` circle button (GOV.UK grey, hover blue)
- Help icons added to:
  - Perspective dropdown label → `perspectives` doc
  - Persona selector label → `personas` doc
  - Estate Summary heading → `metrics` doc
  - Signal strip in analysis cells → `signals` doc (via `renderCompactAnalysis`)
  - Pattern tags in analysis cells → `patterns` doc (via `renderPatternTagWithTooltip`)
  - Contract timeline heading → `timeline` doc
- Added `renderPatternTagWithTooltip()` variant that wraps the label in a domain tooltip and appends a help icon

### AC-5: Expanded Glossary
- Replaced original 4-section glossary with 5 organized sections:
  1. **Transition Concepts**: Vesting Date, Predecessor, Successor, Perspective, Collision, Cross-tier
  2. **System Properties**: Portability (High/Medium/Low), Data Layer (Segmented/Monolithic), Cloud/On-Prem, ERP, Shared Service, ESD/LGA Function
  3. **Analysis Signals**: Contract Urgency, Notice Period Action Zone, User Volume, Vendor Density, Tech Debt, TCoP Alignment
  4. **Rationalisation Patterns**: inherit-as-is, choose-and-consolidate, extract-and-partition, extract-partition-and-consolidate
  5. **Governance & Compliance**: TCoP, Tier Classification (1/2/3 + promotion rule), Anchor System

### AC-6: Regression
- All 41 existing property tests pass
- No changes to test files
- Existing modal open/close handlers preserved unchanged
- Tooltip creation uses pure HTML string concatenation — no DOM mutation in rendering hot paths
