# Unified Architecture Editor — UX & Accessibility Audit

**Date:** 2026-05-22

## Critical Failures (fix before release)

| # | Issue | Location | Fix |
|---|---|---|---|
| 1 | Count badge: white on #b1b4b6 = 1.9:1 contrast | `list-panel.js` | Change to `bg-[#0b0c0c] text-white` |
| 2 | Overlay: no `role="dialog"`, no focus trap, no Escape, no focus-on-open | `main.js` + `editor.js` | Add dialog semantics + focus management |
| 3 | Inactive capability pills: #505a5f on #f3f2f1 at 10px = 4.2:1 | `smart-inputs.js`, `rel-panel.js` | Change to `text-[#0b0c0c]` |
| 4 | Dep matrix medium/low cells fail contrast (3.7:1, 4.1:1) | `dep-matrix.js` | Use darker blues or restructure encoding |

## Important Issues (next sprint)

| # | Issue | Location | Fix |
|---|---|---|---|
| 5 | Bulk mode inputs: 1px grey border (inconsistent with 2px black in Focus) | `bulk-mode.js` | Change to `border-2 border-[#0b0c0c]` |
| 6 | Props panel inputs: no `id`/`for` label association | `props-panel.js fieldRow()` | Generate unique IDs |
| 7 | Mode toggle: no `aria-pressed` state | `editor.js setMode()` | Add aria-pressed updates |
| 8 | Chip selector input: no `aria-label` | `smart-inputs.js` | Add ariaLabel option |
| 9 | Bulk table: missing `scope="col"` on headers | `bulk-mode.js` | Add scope attributes |
| 10 | No unsaved changes warning on Back | `editor.js` | Track dirty state, confirm before Back |
| 11 | Section headings are `<div>` not `<h3>` | `props-panel.js`, `rel-panel.js` | Convert to `<h3>` |
| 12 | Capability pill text at 10px | `rel-panel.js`, `bulk-mode.js` | Increase to 14px (`text-sm`) |

## Minor Issues

- Off-palette banner background colours (should use GOV.UK tint-80 values)
- Back button should follow GOV.UK Back Link pattern (← prefix)
- Emoji status icons verbosely announced by screen readers
- Delete system uses browser `confirm()` (inconsistent with app visual language)
- Dep matrix "Edit" links are `<a href="#">` (should be `<button>`)
- No mobile/tablet responsive handling (minimum ~700px viewport needed)

## What Passes

- GDS primary/secondary button styling correct
- Focus ring (yellow #ffdd00) correctly applied
- Radio groups use proper `<fieldset>/<legend>` pattern
- Chip remove buttons have `aria-label`
- Capability pills use `aria-pressed` correctly
- Alternating table row colours use GDS palette
- Tab pattern matches broader application (3px border-bottom active state)
- Three-pane layout information hierarchy is effective
