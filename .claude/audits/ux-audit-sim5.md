# UX Audit Report — LGR Rationalisation Engine (Sprint sim-5 features)

## Date
2026-04-22

## Scope
Focused audit of two Sprint sim-5 features:
1. Obligation detail modal ("View migration plan") — `src/features/simulation-panel.js` lines 376–591
2. Action chip edit flow — action chips with pencil + delete buttons, edit pre-fill

Note: Playwright MCP browser tools were unavailable in this environment. All findings are based on thorough static code review of `src/features/simulation-panel.js`, `src/styles.css`, `src/index.html`, `src/simulation/obligations.js`, and the GOV.UK Design System reference (`GOVUK-DESIGN-SYSTEM-REFERENCE.md`). Evidence references are to specific line numbers.

---

## 1. GOV.UK Design System Compliance

### 1.1 Colour Palette

| Finding | Severity | Location | Details |
|---|---|---|---|
| Orange border correct for simulation context | Pass | Modal top border `border-t-8 border-[#f47738]` (index.html:524) | `#f47738` matches GOV.UK orange. Simulation mode uses orange consistently throughout as the simulation signal colour, matching the existing deviation pattern. |
| Severity HIGH uses `#d4351c` (pre-v6 red) | Minor | `sevColour` object in `renderObligationDetailContent` (sim-panel.js:492) and `renderObligationChip` (sim-panel.js:360) | GOV.UK v6.x error red is `#ca3535`; `#d4351c` is the pre-v6 value still in use across the application. Covered by deviation log entry but the deviation log has not been updated to note the v6 mismatch. Since this is consistent across the whole app it is not a new regression. |
| Severity MEDIUM uses `#f47738` (orange) | Minor | `sevColour.medium` (sim-panel.js:360, 492) | GOV.UK orange (`#f47738`) is correct. Used here as "warning" which is appropriate and consistent with the rest of the application. |
| Severity LOW uses `#b1b4b6` (mid-grey) | Pass | `sevColour.low` (sim-panel.js:360, 492) | `#b1b4b6` matches GOV.UK border grey. Suitable for a low-prominence status indicator. |
| Background `bg-red-50` for unresolved rows | Minor | Table row `class="bg-red-50"` (sim-panel.js:575) | `bg-red-50` is a Tailwind approximation of GOV.UK red tint (`#f4d7d7`). Tailwind `red-50` is `#fef2f2`. These are different values. Not a critical issue as both are light red tints, but the inconsistency with the GOV.UK palette is undocumented. |
| `bg-[#fff3cd]` simulation warning amber used on before/after metric cards | Pass | `renderBeforeAfterMetrics` compact mode (sim-panel.js:649–679) | `#fff3cd` is a reasonable warm amber for simulation context, not a GOV.UK standard colour but consistent with the existing simulation mode palette. |
| Success green `#005a30` used for positive deltas | Minor | `.sim-delta-positive` (styles.css:113) | GOV.UK v6 success is `#0f7a52`; the application uses `#005a30` (darker pre-v6 variant). This is a pre-existing deviation consistent across the application. |
| `#942514` used for negative deltas | Minor | `.sim-delta-negative` (styles.css:114) | This is a darker shade of GOV.UK red, not in the extended palette. Low impact — used only for before/after delta indicators. |

**Recommendations:**
1. Add a note to the deviation log (GOVUK-DESIGN-SYSTEM-REFERENCE.md Section 10.2) that `#d4351c` and `#00703c`/`#005a30` are pre-v6 red/green values. This is a documentation gap, not a new code defect.
2. Consider replacing `bg-red-50` (Tailwind) with an inline `background-color: #f4d7d7` (GOV.UK extended red tint-80) on unresolved obligation rows.

---

### 1.2 Typography

| Finding | Severity | Location | Details |
|---|---|---|---|
| Modal heading "Data Migration Plan" uses Tailwind `text-2xl font-bold` | Minor | `renderObligationDetailContent` (sim-panel.js:447) | Not using GOV.UK `govuk-heading-l` class. This is a pre-existing deviation consistent with the rest of the application (deviation log item 1). No regression here. |
| Section headings use `font-bold text-base` | Minor | "Summary" heading (sim-panel.js:455) | `text-base` is 16px. GOV.UK `govuk-heading-s` is 19px. Heading is slightly undersized. |
| "Source system" label uses `text-[10px] font-bold uppercase` | Minor | sim-panel.js:508 | 10px is below the GOV.UK minimum recommendation of 16px for body text. Since this is a label rather than body text and is styled as a UI micro-label (ALLCAPS, bold), it is acceptable but worth monitoring for accessibility at small viewport widths. |
| Table header cells use `font-semibold text-xs` with no explicit `scope` attribute | Major | Obligations table `<th>` elements (sim-panel.js:558–563) | The table has no `scope="col"` on column headers. GOV.UK Design System (Section 6.28) requires `scope="col"` on all column header cells and `scope="row"` on row headers. Screen readers cannot reliably identify column context without this. |
| Table has no `<caption>` element | Minor | Obligations table (sim-panel.js:555–585) | GOV.UK table spec requires a `<caption>` element on all data tables. The section has a nearby `text-[10px]` label "Obligations" but it is a `<div>`, not a `<caption>`. This means screen readers announce the table without a name. |
| Modal header has no visible title element | Major | `obligationDetailModal` (index.html:523) | The modal has `aria-labelledby="obligationDetailTitle"` but there is no element with `id="obligationDetailTitle"` in the HTML. The content is dynamically injected into `#obligationDetailContent` and uses `<h2>` without an id. This breaks the modal's ARIA label. |

**Recommendations:**
1. Add `scope="col"` to all `<th>` elements in the obligations table.
2. Replace the `<div class="text-[10px]">Obligations</div>` header with a proper `<caption>` element.
3. Either add `id="obligationDetailTitle"` to the dynamically rendered `<h2>Data Migration Plan</h2>` element, or assign a static title element in the modal template. This is the highest-priority fix.

---

### 1.3 Components

#### Modal (Obligation Detail)

| Finding | Severity | Location | Details |
|---|---|---|---|
| Modal has `role="dialog"` and `aria-modal="true"` | Pass | index.html:523 | Correct pattern per GOV.UK modal guidance. |
| `aria-labelledby="obligationDetailTitle"` references a non-existent ID | Critical | index.html:523 | The modal declares `aria-labelledby="obligationDetailTitle"` but no element with that ID exists in the DOM (checked both the static template and the dynamically injected content). The dynamically injected `<h2>` does not have this ID. Screen readers will announce the modal without a name, which is a WCAG 2.2 failure (criterion 4.1.2 Name, Role, Value). |
| Escape key closes modal | Pass | sim-panel.js:1479–1483 | `document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !obligationDetailModal.classList.contains('hidden')) ...` — Escape is handled correctly. |
| Click-outside closes modal | Pass | sim-panel.js:1474–1476 | `obligationDetailModal.addEventListener('click', (e) => { if (e.target === obligationDetailModal) ...` — Correct. |
| Close button has `aria-label` | Pass | index.html:525 `aria-label="Close obligation detail"` | Correct. |
| Focus is not trapped inside modal | Major | sim-panel.js:388–390 | When `openObligationDetail()` shows the modal, there is no `focus()` call to move focus into the modal, and no focus trap is implemented. Users pressing Tab from outside the modal can tab through page content behind the overlay. This fails WCAG 2.2 criterion 2.4.3 (Focus Order). |
| Focus is not returned on close | Major | sim-panel.js:1473–1476 | No logic to return focus to the "View migration plan" link when the modal closes. Screen reader users lose their position in the document. |
| Collapsible group uses `onclick` on a non-interactive element | Major | sim-panel.js:496 `<div class="flex items-center gap-2 cursor-pointer ...` | The collapsible group header is a `<div>` with `onclick`. This is not keyboard-accessible — it cannot be reached or activated via Tab/Enter. Should use a `<button>` element. |

#### Action Builder Modal

| Finding | Severity | Location | Details |
|---|---|---|---|
| `aria-labelledby="actionBuilderTitle"` references existing ID | Pass | index.html:509, 512 | The `id="actionBuilderTitle"` element exists in the static HTML. Correct. |
| Title updates to "Edit Action: {type}" on edit | Pass | sim-panel.js:813–815 | `titleEl.textContent = \`Edit Action: ${getActionTypeName(type)}\`` — the title correctly announces the edit context. |
| Focus not trapped in action builder modal | Major | sim-panel.js:785–793 | Same issue as obligation detail — no focus trap or focus-to-modal on open. |

#### Action Chips (Pencil + Delete)

| Finding | Severity | Location | Details |
|---|---|---|---|
| Chip uses `<span>` as container | Minor | sim-panel.js:137 `<span class="sim-action-chip">` | The chip contains interactive buttons. Using a `<span>` as the outer container is acceptable (the buttons inside are the interactive elements) but the chip text is not in a `<span>` with any screen-reader context. |
| Edit button uses Unicode pencil `&#9998;` without visible label | Major | sim-panel.js:139 `<button ...>&#9998;</button>` | The button has `aria-label="Edit action"` which is correct for screen readers. However the Unicode pencil character (✎) renders at 14px and its visual affordance as an "edit" trigger is weak — it is a less-recognisable icon than a standard pencil SVG. This is a minor visual concern but the ARIA label is present. |
| Delete button `&times;` has `aria-label="Remove action"` | Pass | sim-panel.js:140 | Correct. |
| Both buttons share `.sim-action-chip button` CSS | Minor | styles.css:111 | Both edit and delete buttons are styled identically in red (`color: #d4351c`). The delete action is destructive; the edit action is not. Using the same red colouring for both buttons implies equal danger. The edit button should be visually differentiated — perhaps using the application's blue (`#1d70b8`) rather than red. |
| Chip gap of 6px between buttons | Minor | styles.css:110 `gap: 6px` | The 6px gap is tight for touch targets. GOV.UK recommends 44px minimum touch target. The buttons with 2px padding will produce target areas well below this. |

---

### 1.4 Layout and Spacing

| Finding | Severity | Location | Details |
|---|---|---|---|
| Obligation modal inner scroll has `pr-2` | Minor | index.html:526 `class="overflow-y-auto flex-1 pr-2"` | 8px right padding on the scroll container. This is a small visual detail — the scrollbar will overlap the content edge slightly on Windows (overlapping scrollbars). The padding mitigates this partially. |
| Modal max-width `max-w-4xl` | Pass | index.html:524 | `max-w-4xl` (896px) is wider than the action builder (`max-w-2xl`). Appropriate for the richer content in this modal. |
| Summary metric cards use `grid grid-cols-4 gap-3` | Minor | sim-panel.js:455 | A 4-column grid in a modal that may be 375px wide on mobile will collapse the cards to near-unusable sizes. There is no responsive modifier (`md:grid-cols-4`) — on mobile this will force 4 narrow columns. |
| Source system card uses a `<div class="flex justify-between">` key-value pattern | Pass | sim-panel.js:514–537 | Consistent with the Summary List pattern used elsewhere in the application. The flex layout is readable at the modal width. |
| Section labels use `text-[10px]` | Minor | sim-panel.js:508, 545, 554 | 10px labels ("SOURCE SYSTEM", "MIGRATION SCOPE", "OBLIGATIONS") are very small. These would fail WCAG 2.2 contrast at small sizes without strong colour contrast. Currently on `text-gray-500` (`#6b7280`) on white — contrast ratio is approximately 4.6:1, which passes at normal sizes but may be borderline at 10px (WCAG uses 18pt/14pt bold thresholds). Should be at least 12px. |

---

## 2. General UX Quality

### 2.1 Information Hierarchy

**Obligation Detail Modal**

The modal opens with a "Data Migration Plan" heading followed by a summary metrics strip (4 cards), then grouped source-system cards. This is a good top-down hierarchy: overview first, detail second.

**Issue:** The summary cards show Total / High Severity / Unresolved / Cross-successor but the "Total" card is identical in visual weight to the others. The high-severity and unresolved counts are more actionable — they should be visually dominant. Currently all four cards have the same border-left treatment (only coloured when count > 0), but the styling differs between "has problems" and "clean" state. This is correct directionally but the "Total" card could be de-emphasised with a lighter style.

**Issue:** The modal `<h2>` "Data Migration Plan" is immediately preceded by a caption `<p class="text-xs font-bold uppercase ...">Simulation</p>`. The caption is above the heading, which is correct GOV.UK caption pattern. However "Simulation" is an opaque label — it does not orient the user. A better caption would be "Simulation analysis" or show the active simulation context.

### 2.2 Scannability

**Obligations table**

The compact obligations table in each group has 5 columns: Severity / Function / Target / Successor / Type. At the `text-xs` (12px) size inside a card that may be 300px wide, this table will be very cramped. The "Type" column only ever shows a "CROSS" badge or nothing. Consider:
- Merging "Severity" into a left border colour only (remove the Severity column)
- Or keeping Severity as a small coloured dot with no text
- The "Type" column could be collapsed into the severity badge or a row background colour

**Source system card**

The source system card sections (users, cost, contract, hosting, data, portability) render clearly as key-value rows with `flex justify-between`. This is readable. The persona-conditional rendering (commercial/executive vs architect/executive) is a good progressive disclosure pattern.

**Collapsible group header**

The group header shows: chevron + severity badge + system label + obligation count + optional CROSS-SUCCESSOR badge. This is a well-composed information row. The chevron (`&#x25BE;` / `&#x25B8;`) is a Unicode triangle character. These characters have inconsistent rendering across platforms — a CSS-styled `>` character or SVG chevron would be more reliable.

### 2.3 Cognitive Load

The modal opens with all groups expanded (`_expandedObligationGroups = new Set(systemIds)`). For a complex scenario like 08-mega-merger with many systems and actions, this could present a wall of content. For users with many obligations, collapsing to headers-only on open would reduce initial cognitive load. Re-expanding all is low cost (one click per group, or an "Expand all" button).

The before/after metrics panel (rendered inside the action panel with `compact: true`) uses a 2-column grid and renders up to 4 cells (systems / IT spend / pre-vesting / disaggregations). At 360px action panel width these cells are legible. The `compact` format (showing `Before → After delta`) is an efficient presentation.

### 2.4 Consistency

**Action chip buttons**

Both edit and delete buttons use the same `color: #d4351c` red. This is inconsistent with the application's general pattern where red indicates risk/danger (the delete action) and blue indicates navigation/edit. The pencil button should use blue.

**Modal border colour**

The action builder modal and obligation detail modal both use `border-t-8 border-[#f47738]` (orange). Other modals in the application use `border-t-8 border-[#1d70b8]` (blue). The orange is intentional for simulation context and is a documented simulation colour signal. This is acceptable as a simulation-specific convention but it is not documented in the deviation log as a new component variant.

**Heading in `renderObligationDetailContent`**

The modal content uses `<h2>` for the main "Data Migration Plan" heading and `<h3>` for per-system group headings. This is correct heading hierarchy within the modal. However the "Summary" section uses `<h3 class="font-bold text-base">Summary</h3>` rather than consistent HTML heading levels — a `<h3>` before the system-level `<h3>` headings means two `<h3>` elements at the same level for different purposes (summary section vs. source system). Should use `<h3>` for summary and `<h4>` for system groups, or restructure.

### 2.5 "View migration plan" link affordance

The "View migration plan →" link in the action panel is rendered as:
```html
<a class="text-xs text-[#1d70b8] underline font-bold cursor-pointer mt-2 block" onclick="window._simOpenObligationDetail()">
    View migration plan →
</a>
```

This `<a>` has no `href` attribute. Using `<a>` without `href` means it is not focusable by keyboard by default. Users cannot tab to it and press Enter. This is a WCAG 2.2 failure. It should either be a `<button>` or have `href="#"` with `e.preventDefault()` and `tabindex="0"`.

---

## 3. Accessibility

### 3.1 Keyboard Navigation

| Finding | Severity | Issue |
|---|---|---|
| `<a>` without `href` for "View migration plan" | Critical | Not keyboard-focusable. Use `<button>` instead. (sim-panel.js:353) |
| Collapsible group header `<div>` not keyboard-accessible | Major | `onclick` on `<div>` — cannot tab to or activate with keyboard. Must be `<button>`. (sim-panel.js:496) |
| No focus trap in obligation detail modal | Major | Focus can leave the modal while it is open. |
| No focus trap in action builder modal | Major | Same issue. |
| No return focus on modal close | Major | Both modals fail to return focus to trigger element on close. |
| Action chip edit button icon (`&#9998;`) | Pass | Has `aria-label="Edit action"` — screen reader accessible despite icon-only visual. |

### 3.2 Screen Reader Compatibility

| Finding | Severity | Issue |
|---|---|---|
| `aria-labelledby="obligationDetailTitle"` references non-existent ID | Critical | Modal has no accessible name. (index.html:523) |
| Obligations table has no `<caption>` | Minor | Table announced without name to screen readers. (sim-panel.js:555) |
| Table `<th>` cells missing `scope="col"` | Major | Column headers not associated with cells. (sim-panel.js:558–563) |
| Severity badge inline styles only | Minor | Severity (HIGH/MEDIUM/LOW) uses background colour + white text only. Text is present so colour is not the only indicator, but the badge has no `aria-label` or role. Screen readers will read "HIGH", "MEDIUM", "LOW" as plain text — acceptable. |
| CROSS-SUCCESSOR badge | Minor | Rendered as `<span style="background:#d4351c;color:#fff;...">Cross-successor</span>` — text is present, no ARIA role needed. Screen readers will read the text. Acceptable. |
| Chevron Unicode characters | Minor | `&#x25BE;` (filled down triangle) / `&#x25B8;` (filled right triangle) — these will be read by screen readers. Their meaning as expand/collapse indicators is not announced. Should add `aria-expanded` attribute on the toggle button (once converted from `<div>` to `<button>`). |

### 3.3 Colour Contrast

| Element | Foreground | Background | Estimated Ratio | Pass/Fail |
|---|---|---|---|---|
| HIGH severity badge | `#ffffff` | `#d4351c` | ~4.5:1 | Pass (borderline) |
| MEDIUM severity badge | `#ffffff` | `#f47738` | ~2.9:1 | Fail — white on orange does not meet 4.5:1 for normal text |
| LOW severity badge | `#ffffff` | `#b1b4b6` | ~1.9:1 | Fail — white on mid-grey is well below 4.5:1 |
| Section labels `text-gray-500` | `#6b7280` | `#ffffff` | ~4.6:1 | Pass (barely) at normal sizes; at 10px these are below large-text threshold |
| Unresolved row "Unresolved" `text-[#d4351c]` | `#d4351c` | `#fef2f2` (bg-red-50) | ~3.8:1 | Fail — red on light red background does not meet 4.5:1 |
| Sim delta positive `#005a30` on white | `#005a30` | `#ffffff` | ~9.0:1 | Pass |
| Sim delta negative `#942514` on white | `#942514` | `#ffffff` | ~7.0:1 | Pass |
| `text-[#1d70b8]` "View migration plan" link on `#fff3cd` | `#1d70b8` | `#fff3cd` | ~4.7:1 | Pass |

**Critical failures:**
- MEDIUM severity badge: white text on `#f47738` orange fails WCAG AA contrast (4.5:1). Use `#0b0c0c` (black) text on orange — this matches the application's own convention for `tag-orange` (styles.css:17 `color: var(--govuk-black)`) but the inline badge style does not follow this.
- LOW severity badge: white text on `#b1b4b6` mid-grey fails WCAG AA contrast severely. Use `#0b0c0c` text.
- "Unresolved" text in red on red-tinted background fails contrast.

---

## 4. Responsive Behaviour

(Code-based assessment; browser resize not performed — Playwright MCP unavailable)

### 4.1 Obligation Detail Modal

The modal uses `max-w-4xl w-full mx-4`. On 375px viewport, the effective width is 375 - 32px (mx-4) = 343px. This is usable but tight.

**Issues at 375px:**
- Summary metrics `grid grid-cols-4 gap-3` — 4 columns at ~74px each. The 2xl font-bold numbers will likely be fine but "High severity" and "Cross-successor" labels will be very cramped or truncate. No responsive grid modifier present.
- Obligations table with 5 columns at xs text will be extremely cramped — likely causes horizontal overflow within the card. No `overflow-x-auto` wrapper on the table.
- Source system card `flex justify-between` rows are fine for narrow widths.
- Group header `flex items-center gap-2` with severity badge + long system name + CROSS badge will likely wrap. The `flex-1` on the heading handles this but the CROSS badge (`flex-shrink:0`) may push items.

**Issues at 768px:**
- No specific responsive issues expected. The modal width caps at 896px (max-w-4xl) and at 768px the `mx-4` gives 736px of width — comfortable.

### 4.2 Action Panel (sim-action-panel)

Fixed at 360px wide. At 375px viewport this leaves only 15px for the Sankey panel — the `sim-workspace-layout` is `display:flex` with no wrapping. The action panel and Sankey panel will overflow horizontally at mobile widths.

There is no responsive breakpoint in `.sim-workspace-layout` or `.sim-action-panel` to stack vertically on mobile. The entire simulation workspace is likely unusable at 375px.

### 4.3 Action Builder Modal

Uses `max-w-2xl w-full mx-4`. At 375px: 375 - 32 = 343px. The 2-column "New End Year / New End Month" grid in extend-contract (`grid grid-cols-2 gap-4`) is fine at this width. The `overflow-y-auto flex-1` on content means the modal scrolls internally. Acceptable.

---

## 5. Edit Flow — Pre-fill and Modal Title

**Edit action title:** The `editAction()` function calls `openActionBuilderWithContext()` which sets `_editingActionIndex = idx` before calling the function. Inside `openActionBuilderWithContext()`, `_editingActionIndex` is already set when `titleEl.textContent = \`Edit Action: ${getActionTypeName(type)}\`` executes. This works correctly.

**Pre-fill timing:** Pre-fill uses `requestAnimationFrame()` to wait for DOM updates, with a nested `requestAnimationFrame()` for the `targetSystemId` in consolidate mode. This is fragile — if the DOM update takes longer than one animation frame (e.g., on a slow device), the pre-fill will fail silently. A more robust pattern would be to check element existence in a retry loop or observe DOM mutations.

**Edit vs. apply logic:** When `_editingActionIndex !== null`, the action is replaced in-place at `state.simulationState.actions[_editingActionIndex]`. If the user cancels, `_editingActionIndex` is cleared by the cancel/close handlers. This is correct.

**Edge case — editing after recompute:** The edit function calls `editAction(idx)` using the action's index. If the user has actions A, B, C and edits B (index 1), the replacement is correct. But the `getActionLabel()` for A and C uses `getSimulatedITSystems()` which returns current simulation state — after editing B, the simulation recomputes and system labels may have changed. This is a functional concern rather than a UX one, but it could cause action chips to show stale labels momentarily before recompute.

---

## 6. Summary of Gaps

| # | Gap | Severity | Category | Recommendation |
|---|---|---|---|---|
| 1 | `aria-labelledby="obligationDetailTitle"` points to non-existent ID | Critical | Accessibility | Add `id="obligationDetailTitle"` to the `<h2>Data Migration Plan</h2>` in `renderObligationDetailContent` |
| 2 | "View migration plan" `<a>` has no `href` — not keyboard-focusable | Critical | Accessibility | Change to `<button class="...">` element |
| 3 | MEDIUM severity badge: white on orange fails contrast (2.9:1) | Critical | Accessibility | Use `color:#0b0c0c` on `#f47738` background — consistent with `tag-orange` |
| 4 | LOW severity badge: white on grey fails contrast (1.9:1) | Critical | Accessibility | Use `color:#0b0c0c` on `#b1b4b6` |
| 5 | Collapsible group header `<div onclick>` not keyboard-accessible | Major | Accessibility | Replace with `<button>` and add `aria-expanded` |
| 6 | No focus trap in obligation detail modal | Major | Accessibility | Implement focus trap (keep Tab within modal while open) |
| 7 | No focus returned to trigger on modal close | Major | Accessibility | Store reference to opener; `opener.focus()` on close |
| 8 | Obligations table `<th>` cells missing `scope="col"` | Major | Accessibility | Add `scope="col"` to all column headers |
| 9 | Obligations table missing `<caption>` element | Minor | Accessibility | Add `<caption class="govuk-visually-hidden">Obligations for {system label}</caption>` |
| 10 | Unresolved text red on red-tinted background fails contrast (~3.8:1) | Major | Accessibility | Use `color:#0b0c0c` on red-tinted row, or `bg-white` for unresolved rows |
| 11 | Summary metrics `grid-cols-4` has no mobile breakpoint | Major | Responsive | Add `sm:grid-cols-2 grid-cols-2` or `md:grid-cols-4 grid-cols-2` |
| 12 | Obligations table has no `overflow-x-auto` wrapper | Major | Responsive | Wrap table in `<div class="overflow-x-auto">` |
| 13 | Simulation workspace layout does not stack on mobile | Major | Responsive | Add `flex-col` at small breakpoints for `.sim-workspace-layout` |
| 14 | Edit and delete buttons both use red — no visual differentiation | Minor | UX | Apply `color:#1d70b8` to edit (pencil) button, keep red only for delete |
| 15 | Section sub-labels use 10px text | Minor | UX/Accessibility | Increase to 12px minimum |
| 16 | H3/H4 hierarchy in modal content | Minor | UX | "Summary" section heading and system group headings are both `<h3>` — system groups should be `<h4>` |
| 17 | All groups expanded on first open | Minor | UX | Default to collapsed for scenarios with 5+ groups; add "Expand all" button |
| 18 | Unicode chevron characters for expand/collapse | Minor | UX/Accessibility | Replace with CSS-styled arrow or SVG; add `aria-expanded` once `<button>` is used |
| 19 | Pre-fill uses `requestAnimationFrame` double-nesting | Minor | Technical/UX | Fragile on slow devices; could fail silently with no user feedback |

---

## 7. Recommendations (Prioritised)

### Immediate (Critical)

1. **Fix `aria-labelledby` on obligation detail modal.** Add `id="obligationDetailTitle"` to the `<h2>` rendered by `renderObligationDetailContent()`. One-line fix in `src/features/simulation-panel.js` line 447.

2. **Change "View migration plan" from `<a>` to `<button>`.** The anchor has no `href` making it inaccessible to keyboard. Change `<a class="text-xs text-[#1d70b8] underline font-bold cursor-pointer mt-2 block" onclick="...">` to `<button class="text-xs text-[#1d70b8] underline font-bold cursor-pointer mt-2 block text-left" onclick="...">`. Remove `cursor-pointer` if using a button (browsers provide this by default).

3. **Fix MEDIUM and LOW severity badge contrast.** In `renderObligationChip()` and `renderObligationDetailContent()`, the `sevColour` object produces white text on orange and white text on grey. The application's own `tag-orange` class already uses black text on orange — apply the same logic: use `#0b0c0c` as font colour when background is `#f47738` or `#b1b4b6`.

4. **Fix collapsible group header: `<div>` to `<button>`.** The group header `<div class="flex items-center gap-2 cursor-pointer ...` must become a `<button>` element to be keyboard-accessible. Also add `aria-expanded={isExpanded}` to indicate state.

### Short-term (Major)

5. **Implement focus trapping for both modals.** When either modal opens, move focus to the first focusable element inside the modal. Trap Tab/Shift-Tab within the modal. On close, return focus to the element that opened the modal.

6. **Add `scope="col"` to obligations table headers.** Three-character change per `<th>` element.

7. **Fix unresolved row contrast.** Either use `bg-white` for unresolved rows (text contrast then fine) or change the red text to `#0b0c0c` on the tinted background.

8. **Add responsive summary metrics grid.** Change `grid-cols-4` to `grid-cols-2 md:grid-cols-4` in the summary metrics section.

9. **Wrap obligations table in `overflow-x-auto`.** Prevents horizontal scroll breakout on narrow viewports.

10. **Stack simulation workspace on mobile.** In `.sim-workspace-layout`, add a media query or Tailwind responsive class to use `flex-direction: column` below 768px.

### Long-term (Minor/Nice-to-have)

11. **Differentiate edit vs. delete button colours in action chips.** Edit pencil button should use blue (`#1d70b8`), delete X should remain red. This communicates the destructive vs. non-destructive distinction.

12. **Add table caption.** Use `<caption class="sr-only">Obligations: {system label}</caption>` for screen reader accessibility.

13. **Default obligation groups to collapsed for 5+ groups.** Reduce initial cognitive load when many obligations exist.

14. **Replace Unicode chevrons with CSS/SVG.** More reliable cross-platform rendering and allows `aria-expanded` to be added.

15. **Increase section sub-label font size from 10px to 12px.** Slight legibility improvement especially on non-retina displays.

16. **Add obligation modal to deviation log.** The orange `border-t-8 border-[#f47738]` is a new variant within the modal system (existing modals use blue). Document this as a simulation-specific variant in GOVUK-DESIGN-SYSTEM-REFERENCE.md Section 10.2.
