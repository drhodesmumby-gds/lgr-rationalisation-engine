# Sprint 7: Inline Documentation

## Scope

Add comprehensive inline documentation throughout the UI: styled hover tooltips on domain-specific terms, explanation modals for complex logic, and contextual help icons (?) next to key UI elements. Build on the existing Glossary modal and `.tooltip-label` CSS patterns.

## Acceptance Criteria

### AC-1: Styled tooltip component

- [ ] Create a reusable tooltip function `createTooltip(text, tooltipContent)` that wraps text in a `<span>` with dotted underline styling and shows a rich tooltip on hover.
- [ ] Tooltip appears on hover with a brief delay (~200ms), positioned above or below the element.
- [ ] Tooltip uses GOV.UK styling: white background, dark text, thin border, subtle shadow, max-width 300px.
- [ ] Tooltip is keyboard-accessible (shows on focus for screen readers).
- [ ] Upgrade existing bare `title` attributes on system card labels (Portability, Data Layer, Cloud/On-Prem at lines ~1377-1387) to use the new tooltip component.

### AC-2: Domain term tooltips

- [ ] The following terms display rich tooltips wherever they appear in the UI:
  - **Anchor System**: ">50% larger than the second-largest system by user count. Usually the strongest migration consolidation target."
  - **Notice Period Action Zone**: "The window between contract notice deadline and contract end date. Systems in this zone require immediate procurement decisions."
  - **Vendor Density**: "Number of distinct vendors providing systems for the same function across councils. High density = procurement consolidation opportunity."
  - **Collision**: "Two or more councils have IT systems serving the same LGA standard function. Collisions require rationalisation decisions."
  - **Rationalisation Pattern**: "The recommended approach for consolidating systems: inherit-as-is, choose-and-consolidate, extract-and-partition, or extract-partition-and-consolidate."
  - **TCoP**: "Technology Code of Practice — UK Government's 11-point framework for technology decisions. Points 3 (spend), 4 (open standards), 5 (cloud), 9 (modularity), 11 (commercial) are assessed."
  - **Portability** (High/Medium/Low): "How easily a system can be migrated. High = open APIs/REST. Medium = CSV/SQL exports. Low = proprietary lock-in."
  - **Data Layer** (Segmented/Monolithic): "Segmented = data can be partitioned per successor. Monolithic = highly entangled, requires complex ETL for migration."
  - **Tier 1/2/3**: "Day 1 Critical (statutory/safeguarding) / High Priority / Post-Day 1. Determines implementation urgency."
  - **Vesting Date**: "The legal date the new unitary authority comes into existence. All Day 1 critical services must be operational."
  - **Cross-tier**: "Systems from councils with different tier classifications (county vs district). May represent complementary delivery, not duplication."
  - **ERP**: "Enterprise Resource Planning — monolithic business system (finance, HR, payroll). High data entanglement risk during transitions."
  - **Shared Service**: "A system shared across council boundaries. Requires unwinding or re-contracting during reorganisation."
  - **ESD/LGA Function**: "Standard function from the LGA/ESD taxonomy (176 entries). Maps council-specific function names to a common classification."
- [ ] Tooltips appear on term occurrences in: system cards, matrix headers, estate summary, analysis modal, signal pills, pattern tags.

### AC-3: Explanation modals for complex logic

- [ ] "How are signals computed?" modal accessible from the signal strip area in analysis cells:
  - Explains each of the 8 signals: Contract Urgency, User Volume, Data Monolith, Data Portability, Vendor Density, Tech Debt, TCoP Alignment, Shared Service
  - For each: what it measures, inputs used, thresholds, and what Red/Amber/Green means
  - Explains vesting zone classification (pre-vesting / year-1 / natural-expiry / long-tail)
- [ ] "How are rationalisation patterns classified?" modal:
  - Explains the 4 patterns with decision tree: single system → inherit-as-is; multiple systems, no disaggregation → choose-and-consolidate; disaggregation present → extract-and-partition or extract-partition-and-consolidate
  - Explains how signal emphasis changes per pattern (extract boosts data signals, consolidate boosts user/vendor signals)
- [ ] "How is TCoP assessed?" modal:
  - Lists the 5 TCoP points evaluated (3, 4, 5, 9, 11)
  - For each point: what system property is checked, what triggers alignment vs concern
  - Special note on ERP modularity concerns (Point 9)
- [ ] "How are tiers determined?" modal:
  - Default tier mapping from ESD function categories
  - Override mechanism
  - Tier promotion rule: Tier 3 promoted to Tier 2 if notice triggers before vesting
- [ ] All explanation modals reuse the existing modal pattern: `fixed inset-0 bg-black bg-opacity-50 hidden flex items-center justify-center z-50` with `border-t-8 border-[#1d70b8]` panel, close button, click-outside-to-close.

### AC-4: Contextual help icons

- [ ] Small (?) icon rendered next to each of these UI elements, opening relevant documentation on click:
  - **Perspective dropdown** → explains Unitary vs Multi-Council views, per-successor filtering
  - **Persona selector** → explains Executive/Commercial/Architect personas and how signal weights differ
  - **Estate summary metric boxes** → brief explanation of each metric (predecessors, systems, collisions, annual spend, pre-vesting triggers, disaggregation)
  - **Matrix column headers** → explains what each column represents (council/successor, function mapping)
  - **Timeline bars** → explains contract expiry visualisation and notice period striped zones
- [ ] Help icons use a consistent style: `text-[#505a5f] hover:text-[#1d70b8]` with `cursor-pointer`, 16px size.
- [ ] Help content can be shown as either a tooltip (for short explanations) or modal (for complex topics).

### AC-5: Expanded glossary

- [ ] Glossary modal expanded from 5 term groups to include all domain terms listed in AC-2.
- [ ] Terms organized into sections: Transition Concepts, System Properties, Analysis Signals, Rationalisation Patterns, Governance & Compliance.
- [ ] Each section has a colored header consistent with existing glossary styling.

### AC-6: Regression

- [ ] All existing property tests pass.
- [ ] Zero JS console errors.
- [ ] Existing tooltips (`title` attributes) still function if not yet upgraded.
- [ ] All existing modals (Glossary, Tier Mapping, Analysis, Options) still open and close correctly.
- [ ] Dashboard rendering performance not noticeably degraded (tooltip creation shouldn't add visible delay).

## Implementation Notes

### Tooltip component

```javascript
function createTooltip(text, content) {
    const wrapper = document.createElement('span');
    wrapper.className = 'tooltip-label relative inline-block';
    wrapper.textContent = text;
    wrapper.setAttribute('tabindex', '0');
    wrapper.setAttribute('aria-label', content);

    const tip = document.createElement('span');
    tip.className = 'tooltip-content absolute hidden bg-white text-sm text-[#0b0c0c] border border-[#b1b4b6] shadow-md rounded px-3 py-2 z-50 max-w-[300px] whitespace-normal';
    tip.textContent = content;
    wrapper.appendChild(tip);

    let timeout;
    wrapper.addEventListener('mouseenter', () => { timeout = setTimeout(() => tip.classList.remove('hidden'), 200); });
    wrapper.addEventListener('mouseleave', () => { clearTimeout(timeout); tip.classList.add('hidden'); });
    wrapper.addEventListener('focus', () => tip.classList.remove('hidden'));
    wrapper.addEventListener('blur', () => tip.classList.add('hidden'));
    return wrapper;
}
```

Add CSS for positioning:
```css
.tooltip-content {
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 6px;
    pointer-events: none;
}
```

### Help icon helper

```javascript
function createHelpIcon(modalId) {
    const icon = document.createElement('span');
    icon.className = 'inline-flex items-center justify-center w-4 h-4 text-xs rounded-full border border-[#505a5f] text-[#505a5f] hover:text-[#1d70b8] hover:border-[#1d70b8] cursor-pointer ml-1 align-middle';
    icon.textContent = '?';
    icon.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById(modalId).classList.remove('hidden');
    });
    return icon;
}
```

### Explanation modal content

Store modal content as structured data objects to keep rendering clean:
```javascript
const DOCUMENTATION = {
    signals: { title: 'How Signals Are Computed', sections: [...] },
    patterns: { title: 'Rationalisation Patterns', sections: [...] },
    tcop: { title: 'TCoP Assessment Criteria', sections: [...] },
    tiers: { title: 'Tier Classification', sections: [...] }
};
```

Render with a generic `openDocModal(key)` function that creates/populates a shared documentation modal.

### Where to apply tooltips

In `buildSystemCard()` (~line 1303): replace bare text labels with `createTooltip()` calls.
In `renderDashboard()` matrix headers: wrap tier badges and column labels.
In `renderEstateSummary()` (~line 917): wrap metric labels.
In `buildPersonaAnalysis()` signal strip: add help icon linking to signals explanation modal.

## Key Locations

- Existing `.tooltip-label` CSS: line ~43
- Glossary modal HTML: lines 244-274
- Glossary open/close: lines 387-393
- Modal pattern (all 4): lines 219-292
- `buildSystemCard()`: line ~1303 (portability/data layer/cloud labels at 1377-1387)
- `renderEstateSummary()`: line ~917
- Signal pills rendering: line ~2221
- Persona selector: line ~84
- Perspective dropdown: line ~79
- Pattern tag: line ~1164
- Anchor badge: line ~1308
- Timeline rendering: `drawTimeline()` line ~2808

## Test Plan

1. All existing property tests pass
2. Hover over "Anchor System" badge → tooltip appears after ~200ms delay with explanation
3. Hover over "Portability: High" in system card → rich tooltip replaces old title attribute
4. Click (?) next to perspective dropdown → help tooltip/modal appears
5. Click (?) next to signal strip → "How Signals Are Computed" modal opens with all 8 signals explained
6. Open Glossary modal → verify expanded from 5 to 14+ term groups in organized sections
7. Tab through tooltips with keyboard → verify focus triggers tooltip display
8. Click outside explanation modal → closes
9. Load demo data → navigate all stages → zero console errors
10. Switch personas → help icons and tooltips consistent across all three
