# Decision Panel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-axis decision panel (System Choice × Operating Model) with a successor-first allocation model using progressive disclosure across two states (simple cards → expanded grid).

**Architecture:** The 2056-line `decision-panel.js` is completely rewritten. Rendering splits into focused sub-modules for each pane. The data model (`decisions.js`) gains new fields. The projector/obligations/actions modules are unchanged — `boundaryChoice` is auto-derived by the UI before writing, so downstream consumers see no difference.

**Tech Stack:** Vanilla JS (ES modules), Tailwind CSS via CDN, esbuild bundler. Property tests with vitest + fast-check.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/features/decision-panel.js` | **Rewrite** | Entry point: `openDecisionPanel()`, modal scaffolding, state detection (simple vs expanded), footer, close/focus-trap |
| `src/features/decision-panel/pane-systems.js` | **Create** | Pane 1: system comparison cards (State 1) and system info + function navigator (State 2) |
| `src/features/decision-panel/pane-allocation.js` | **Create** | Pane 2: successor cards with dropdowns, "Share with..." toggle, procurement detail form, sharing grid, derived labels |
| `src/features/decision-panel/pane-cost-impact.js` | **Create** | Pane 3: cost split UI, decommission list, obligations preview, SAP decommission tracker, rationale textarea |
| `src/features/decision-panel/apply-decision.js` | **Create** | `applyDecisionFromPanel()`: reads form state, derives boundaryChoice, validates, stores decision, creates propagated decisions, calls recompute |
| `src/features/decision-panel/sharing-grid.js` | **Create** | Sharing grid rendering + interaction (checkbox sync, "+ Func" typeahead, grid ↔ card bidirectional sync) |
| `src/features/decision-panel/helpers.js` | **Create** | Shared helpers: `renderSystemCard()`, `renderTierBadge()`, `getSuccessorNamesForSystem()`, `buildHostingPartnerOptions()`, `describeDecision()`, `computeDerivedBoundary()` |
| `src/simulation/decisions.js` | **Modify** | Add `rationale`, `decidedBy`, `resolvedVia`, `assignedFunctions` fields to `createDecision()` and `validateDecision()` |
| `tests/properties/decisions-model.property.test.js` | **Create** | Property tests for new decision fields and boundary derivation |
| `tests/properties/sharing-grid.property.test.js` | **Create** | Property tests for sharing grid state logic (grid ↔ boundary derivation) |

---

### Task 1: Extend FunctionDecision Data Model

**Files:**
- Modify: `src/simulation/decisions.js`
- Create: `tests/properties/decisions-model.property.test.js`

This task adds the new fields to the decision model. No UI changes yet — just data and tests.

- [ ] **Step 1: Write property tests for new fields**

Create `tests/properties/decisions-model.property.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createDecision, validateDecision, getDecisionKey } from '../../src/simulation/decisions.js';

describe('FunctionDecision new fields', () => {
    const arbDecisionParams = fc.record({
        functionId: fc.stringMatching(/^[0-9]{1,3}$/),
        successorName: fc.string({ minLength: 1, maxLength: 30 }),
        systemChoice: fc.constantFrom('choose', 'procure', 'defer'),
        retainedSystemIds: fc.array(fc.stringMatching(/^sys-[a-z0-9]+$/), { minLength: 0, maxLength: 3 }),
        rationale: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: null }),
        decidedBy: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
        resolvedVia: fc.option(fc.stringMatching(/^[0-9]{1,3}$/), { nil: null }),
        assignedFunctions: fc.option(fc.array(fc.stringMatching(/^[0-9]{1,3}$/), { minLength: 0, maxLength: 5 }), { nil: null })
    });

    it('createDecision includes new fields when provided', () => {
        fc.assert(fc.property(arbDecisionParams, (params) => {
            // Ensure choose has retainedSystemIds
            if (params.systemChoice === 'choose' && params.retainedSystemIds.length === 0) {
                params.retainedSystemIds = ['sys-default'];
            }
            const decision = createDecision(params);
            expect(decision.rationale).toBe(params.rationale);
            expect(decision.decidedBy).toBe(params.decidedBy);
            expect(decision.resolvedVia).toBe(params.resolvedVia);
            expect(decision.assignedFunctions).toEqual(params.assignedFunctions);
        }));
    });

    it('createDecision defaults new fields to null when omitted', () => {
        const decision = createDecision({
            functionId: '148',
            successorName: 'West Elmhurst',
            systemChoice: 'defer'
        });
        expect(decision.rationale).toBeNull();
        expect(decision.decidedBy).toBeNull();
        expect(decision.resolvedVia).toBeNull();
        expect(decision.assignedFunctions).toBeNull();
    });

    it('validateDecision passes with new optional fields', () => {
        fc.assert(fc.property(arbDecisionParams, (params) => {
            if (params.systemChoice === 'choose' && params.retainedSystemIds.length === 0) {
                params.retainedSystemIds = ['sys-default'];
            }
            if (params.systemChoice === 'procure') {
                params.procuredSystem = { label: 'Test System' };
            }
            const decision = createDecision(params);
            const result = validateDecision(decision);
            expect(result.valid).toBe(true);
        }));
    });

    it('validateDecision rejects non-string rationale', () => {
        const decision = createDecision({
            functionId: '148',
            successorName: 'West Elmhurst',
            systemChoice: 'defer'
        });
        decision.rationale = 123;
        const result = validateDecision(decision);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('rationale'))).toBe(true);
    });

    it('validateDecision rejects non-array assignedFunctions', () => {
        const decision = createDecision({
            functionId: '148',
            successorName: 'West Elmhurst',
            systemChoice: 'defer'
        });
        decision.assignedFunctions = 'not-an-array';
        const result = validateDecision(decision);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('assignedFunctions'))).toBe(true);
    });
});

describe('boundaryChoice derivation', () => {
    it('getDecisionKey produces consistent keys', () => {
        fc.assert(fc.property(
            fc.stringMatching(/^[0-9]{1,3}$/),
            fc.string({ minLength: 1, maxLength: 30 }),
            (funcId, successor) => {
                const key = getDecisionKey(funcId, successor);
                expect(key).toBe(`${funcId}::${successor}`);
                expect(key.split('::').length).toBeGreaterThanOrEqual(2);
            }
        ));
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/properties/decisions-model.property.test.js`
Expected: FAIL — `rationale`, `decidedBy`, `resolvedVia`, `assignedFunctions` not yet in `createDecision`.

- [ ] **Step 3: Add new fields to createDecision and validateDecision**

In `src/simulation/decisions.js`, modify `createDecision()` — add after the `contractExtensions` line in the return object:

```javascript
        rationale: rationale || null,
        decidedBy: decidedBy || null,
        resolvedVia: resolvedVia || null,
        assignedFunctions: assignedFunctions || null,
```

Add `rationale`, `decidedBy`, `resolvedVia`, `assignedFunctions` to the destructured params.

In `validateDecision()`, add after the `contractExtensions` check:

```javascript
    if (decision.rationale !== undefined && decision.rationale !== null) {
        if (typeof decision.rationale !== 'string') {
            errors.push('rationale must be a string or null');
        }
    }

    if (decision.decidedBy !== undefined && decision.decidedBy !== null) {
        if (typeof decision.decidedBy !== 'string') {
            errors.push('decidedBy must be a string or null');
        }
    }

    if (decision.resolvedVia !== undefined && decision.resolvedVia !== null) {
        if (typeof decision.resolvedVia !== 'string') {
            errors.push('resolvedVia must be a string or null');
        }
    }

    if (decision.assignedFunctions !== undefined && decision.assignedFunctions !== null) {
        if (!Array.isArray(decision.assignedFunctions)) {
            errors.push('assignedFunctions must be an array or null');
        } else if (decision.assignedFunctions.some(f => typeof f !== 'string')) {
            errors.push('assignedFunctions must contain only strings');
        }
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/properties/decisions-model.property.test.js`
Expected: All PASS.

- [ ] **Step 5: Run full test suite to ensure no regressions**

Run: `npm test`
Expected: All existing tests still pass (the new fields default to null so existing decision creation is unaffected).

- [ ] **Step 6: Commit**

```bash
git add src/simulation/decisions.js tests/properties/decisions-model.property.test.js
git commit -m "feat(decisions): add rationale, decidedBy, resolvedVia, assignedFunctions fields"
```

---

### Task 2: Create Decision Panel Helpers Module

**Files:**
- Create: `src/features/decision-panel/helpers.js`

Extract shared utility functions that both the old panel (during migration) and new panes will need. This is a refactor-only step — the old panel continues to work.

- [ ] **Step 1: Create helpers module**

Create `src/features/decision-panel/helpers.js`:

```javascript
/**
 * Decision Panel Helpers — shared utilities for pane rendering.
 */

import { state } from '../../state.js';
import { escHtml } from '../../ui-helpers.js';
import { classifyVestingZone, computeNoticeDeadline } from '../../analysis/allocation.js';
import { getHostingType } from '../../analysis/hosting.js';
import { computeMigrationComplexity } from '../../analysis/metrics.js';
import { LGAM_CAPABILITIES } from '../../constants/capabilities.js';
import { getDecisionKey } from '../../simulation/decisions.js';

/**
 * Renders a tier badge span element.
 * @param {1|2|3} tier
 * @returns {string} HTML
 */
export function renderTierBadge(tier) {
    const tierConfig = {
        1: { label: 'Tier 1 — Day 1 Critical', bg: '#d4351c', fg: 'white' },
        2: { label: 'Tier 2 — High Priority', bg: '#f47738', fg: '#0b0c0c' },
        3: { label: 'Tier 3 — Post-Day 1', bg: '#b1b4b6', fg: '#0b0c0c' }
    };
    const cfg = tierConfig[tier] || tierConfig[2];
    return `<span style="background:${cfg.bg};color:${cfg.fg};font-size:11px;padding:2px 8px;font-weight:bold;">${escHtml(cfg.label)}</span>`;
}

/**
 * Returns the successor names that have a given system in their allocations.
 * @param {string} sysId
 * @returns {string[]}
 */
export function getSuccessorNamesForSystem(sysId) {
    const names = [];
    const allocMap = state.successorAllocationMap;
    if (!allocMap) return names;
    for (const [successorName, fnMap] of allocMap) {
        for (const [, allocations] of fnMap) {
            if (allocations.some(a => a.system && a.system.id === sysId)) {
                names.push(successorName);
                break;
            }
        }
    }
    return names;
}

/**
 * Builds datalist options for hosting partner suggestions.
 * @returns {string} HTML option elements
 */
export function buildHostingPartnerOptions() {
    const names = new Set();
    const predecessors = new Set();

    if (state.transitionStructure && state.transitionStructure.successors) {
        for (const s of state.transitionStructure.successors) {
            for (const p of (s.fullPredecessors || [])) predecessors.add(p);
            for (const p of (s.partialPredecessors || [])) predecessors.add(p);
            if (s.name) names.add(s.name);
        }
    }

    if (state.mergedArchitecture && state.mergedArchitecture.nodes) {
        for (const node of state.mergedArchitecture.nodes) {
            if (node.sharedWith) {
                node.sharedWith.forEach(c => { if (!predecessors.has(c)) names.add(c); });
            }
            if (node.hostingPartner && !predecessors.has(node.hostingPartner)) {
                names.add(node.hostingPartner);
            }
        }
    }

    return [...names].sort().map(n => `<option value="${escHtml(n)}">`).join('');
}

/**
 * Short description of a decision for display in cross-successor context.
 * @param {Object} decision
 * @returns {string}
 */
export function describeDecision(decision) {
    if (!decision) return '';
    switch (decision.systemChoice) {
        case 'choose':
            return `Keep ${(decision.retainedSystemIds || []).length} system(s)`;
        case 'procure':
            return `Procure: ${decision.procuredSystem ? decision.procuredSystem.label : 'new system'}`;
        case 'defer':
            return 'Deferred';
        default:
            return decision.systemChoice;
    }
}

/**
 * Derives the boundaryChoice value from the current panel state.
 *
 * Rules:
 * - Both successors select same system AND linked → 'establish-shared' (new) or 'maintain-shared' (existing sharedWith)
 * - One successor keeps, other does not, linked → 'establish-shared'
 * - Both select same, NOT linked → 'disaggregate'
 * - Only one successor relevant → 'none'
 *
 * @param {Object} params
 * @param {string} params.systemChoice - 'choose' | 'procure' | 'defer'
 * @param {string[]} params.sharedWithSuccessors - successor names linked into shared service
 * @param {boolean} params.hasExistingSharedWith - whether the chosen system has sharedWith in its data
 * @param {boolean} params.isDisaggregation - whether the system is from a partial predecessor
 * @param {boolean} params.hasMultipleSuccessors - whether transition has >1 successor
 * @returns {'none'|'disaggregate'|'maintain-shared'|'establish-shared'}
 */
export function computeDerivedBoundary({
    systemChoice,
    sharedWithSuccessors,
    hasExistingSharedWith,
    isDisaggregation,
    hasMultipleSuccessors
}) {
    if (systemChoice === 'defer') return 'none';
    if (!hasMultipleSuccessors) return 'none';

    if (sharedWithSuccessors && sharedWithSuccessors.length > 0) {
        if (hasExistingSharedWith) return 'maintain-shared';
        return 'establish-shared';
    }

    if (isDisaggregation) return 'disaggregate';

    return 'none';
}

/**
 * Renders a single system card with metadata badges and contract info.
 * @param {Object} sys - system node with metadata
 * @param {string|null} vestingDate - ISO date string
 * @param {Object} [options]
 * @param {boolean} [options.compact] - render a compact card (for Pane 1 in State 2)
 * @returns {string} HTML
 */
export function renderSystemCard(sys, vestingDate, options = {}) {
    const isErp = sys.isERP || false;
    const cardBorder = isErp ? 'border-[#d4351c] border-2' : 'border border-gray-300';

    const hostingType = getHostingType(sys);
    const cloudBadge = hostingType === 'cloud'
        ? `<span class="inline-block text-xs px-1.5 py-0.5 bg-[#cce2d8] text-[#00703c] font-bold border border-[#00703c]">Cloud</span>`
        : hostingType === 'partner-hosted'
        ? `<span class="inline-block text-xs px-1.5 py-0.5 bg-[#fde68a] text-[#f47738] font-bold border border-[#f47738]">Partner</span>`
        : `<span class="inline-block text-xs px-1.5 py-0.5 bg-[#f3d9c9] text-[#f47738] font-bold border border-[#f47738]">On-prem</span>`;

    const portColors = { High: '#00703c', Medium: '#f47738', Low: '#d4351c' };
    const portBg = { High: '#cce2d8', Medium: '#fde68a', Low: '#fce4e1' };
    const portLabel = sys.portability || 'Unknown';
    const portBadge = `<span class="inline-block text-xs px-1.5 py-0.5 font-bold border" style="background:${portBg[portLabel]||'#f3f2f1'};color:${portColors[portLabel]||'#505a5f'};border-color:${portColors[portLabel]||'#b1b4b6'}">Port: ${escHtml(portLabel)}</span>`;

    const dataLabel = sys.dataPartitioning || 'Unknown';
    const dataBadge = dataLabel === 'Monolithic'
        ? `<span class="inline-block text-xs px-1.5 py-0.5 bg-[#fce4e1] text-[#d4351c] font-bold border border-[#d4351c]">Monolithic</span>`
        : `<span class="inline-block text-xs px-1.5 py-0.5 bg-[#f3f2f1] text-gray-600 font-bold border border-gray-300">${escHtml(dataLabel)}</span>`;

    const erpBadge = isErp
        ? `<span class="inline-block text-xs px-1.5 py-0.5 bg-[#d4351c] text-white font-bold">ERP</span>`
        : '';

    let contractHtml = '';
    if (sys.endYear) {
        const endStr = `${sys.endYear}-${String(sys.endMonth || 12).padStart(2, '0')}`;
        let zoneBadge = '';
        if (vestingDate) {
            const zone = classifyVestingZone(sys.endYear, sys.endMonth || 12, sys.noticePeriod || 0, vestingDate);
            const zoneColors = {
                'pre-vesting': { bg: '#fce4e1', fg: '#d4351c', label: 'Pre-vesting' },
                'year-1': { bg: '#fde68a', fg: '#0b0c0c', label: 'Year 1' },
                'natural-expiry': { bg: '#cce2d8', fg: '#00703c', label: 'Natural expiry' },
                'long-tail': { bg: '#f3f2f1', fg: '#0b0c0c', label: 'Long-tail' }
            };
            const z = zoneColors[zone] || zoneColors['long-tail'];
            zoneBadge = `<span class="inline-block text-xs px-1.5 py-0.5 font-bold border mt-1" style="background:${z.bg};color:${z.fg};border-color:${z.fg}">${z.label}</span>`;
        }
        const deadline = computeNoticeDeadline(sys);
        const deadlineBadge = deadline ? `<span class="text-[10px] ml-1 font-bold border border-gray-400 px-1">Notice: ${deadline.formatted}</span>` : '';
        contractHtml = `<div class="text-xs text-gray-600 mt-1">Ends: <strong>${escHtml(endStr)}</strong>${sys.noticePeriod ? ` (${sys.noticePeriod}m notice)` : ''}${deadlineBadge}</div>${zoneBadge}`;
    }

    const costDisplay = sys.annualCost != null
        ? `<div class="text-xs text-gray-600">Cost: <strong>£${Number(sys.annualCost).toLocaleString()}/yr</strong></div>`
        : '';

    if (options.compact) {
        return `
            <div class="${cardBorder} p-2 bg-white" data-system-id="${escHtml(sys.id || '')}">
                <div class="flex flex-wrap gap-1 mb-1">${cloudBadge}${portBadge}${dataBadge}${erpBadge}</div>
                <div class="text-xs text-gray-600">Vendor: <strong>${escHtml([sys.vendor, sys.version].filter(Boolean).join(' · '))}</strong></div>
                ${costDisplay}
                ${contractHtml}
                ${sys.notes ? `<p class="text-[10px] text-[#505a5f] italic mt-1 border-l-2 border-[#b1b4b6] pl-1">${escHtml(sys.notes)}</p>` : ''}
            </div>
        `;
    }

    return `
        <div class="${cardBorder} p-3 bg-white w-full" data-system-id="${escHtml(sys.id || '')}">
            <div class="font-bold text-sm mb-0.5">${escHtml(sys.label || 'Unnamed')}</div>
            <div class="text-xs text-gray-500 mb-2">${escHtml(sys.sourceCouncil || sys._sourceCouncil || 'Unknown council')}</div>
            <div class="flex flex-wrap gap-1 mb-2">${cloudBadge}${portBadge}${dataBadge}${erpBadge}</div>
            ${sys.vendor || sys.version ? `<div class="text-xs text-gray-600">Vendor: <strong>${escHtml([sys.vendor, sys.version].filter(Boolean).join(' · '))}</strong></div>` : ''}
            ${sys.users != null ? `<div class="text-xs text-gray-600">Users: <strong>${Number(sys.users).toLocaleString()}</strong></div>` : ''}
            ${costDisplay}
            ${contractHtml}
            ${sys.notes ? `<p class="text-xs text-[#505a5f] italic mt-1 border-l-2 border-[#b1b4b6] pl-2">${escHtml(sys.notes)}</p>` : ''}
        </div>
    `;
}
```

- [ ] **Step 2: Verify module imports correctly**

Run: `node build.js`
Expected: Build succeeds (module isn't imported yet, but syntax must be valid ES module).

- [ ] **Step 3: Write a property test for computeDerivedBoundary**

Add to `tests/properties/decisions-model.property.test.js`:

```javascript
import { computeDerivedBoundary } from '../../src/features/decision-panel/helpers.js';

describe('computeDerivedBoundary', () => {
    it('returns none for defer regardless of other params', () => {
        fc.assert(fc.property(
            fc.boolean(),
            fc.boolean(),
            fc.boolean(),
            fc.array(fc.string(), { minLength: 0, maxLength: 3 }),
            (hasExisting, isDisagg, hasMultiple, shared) => {
                const result = computeDerivedBoundary({
                    systemChoice: 'defer',
                    sharedWithSuccessors: shared,
                    hasExistingSharedWith: hasExisting,
                    isDisaggregation: isDisagg,
                    hasMultipleSuccessors: hasMultiple
                });
                expect(result).toBe('none');
            }
        ));
    });

    it('returns establish-shared when linked and no existing sharedWith', () => {
        fc.assert(fc.property(
            fc.constantFrom('choose', 'procure'),
            fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 3 }),
            (choice, shared) => {
                const result = computeDerivedBoundary({
                    systemChoice: choice,
                    sharedWithSuccessors: shared,
                    hasExistingSharedWith: false,
                    isDisaggregation: false,
                    hasMultipleSuccessors: true
                });
                expect(result).toBe('establish-shared');
            }
        ));
    });

    it('returns maintain-shared when linked and has existing sharedWith', () => {
        fc.assert(fc.property(
            fc.constantFrom('choose', 'procure'),
            fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 3 }),
            (choice, shared) => {
                const result = computeDerivedBoundary({
                    systemChoice: choice,
                    sharedWithSuccessors: shared,
                    hasExistingSharedWith: true,
                    isDisaggregation: false,
                    hasMultipleSuccessors: true
                });
                expect(result).toBe('maintain-shared');
            }
        ));
    });

    it('returns disaggregate for partial predecessor with no sharing', () => {
        fc.assert(fc.property(
            fc.constantFrom('choose', 'procure'),
            (choice) => {
                const result = computeDerivedBoundary({
                    systemChoice: choice,
                    sharedWithSuccessors: [],
                    hasExistingSharedWith: false,
                    isDisaggregation: true,
                    hasMultipleSuccessors: true
                });
                expect(result).toBe('disaggregate');
            }
        ));
    });

    it('returns none when single successor', () => {
        fc.assert(fc.property(
            fc.constantFrom('choose', 'procure'),
            (choice) => {
                const result = computeDerivedBoundary({
                    systemChoice: choice,
                    sharedWithSuccessors: [],
                    hasExistingSharedWith: false,
                    isDisaggregation: false,
                    hasMultipleSuccessors: false
                });
                expect(result).toBe('none');
            }
        ));
    });
});
```

- [ ] **Step 4: Run tests**

Run: `npm test -- --run tests/properties/decisions-model.property.test.js`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/decision-panel/helpers.js tests/properties/decisions-model.property.test.js
git commit -m "feat(decision-panel): extract helpers module with computeDerivedBoundary"
```

---

### Task 3: Create Pane 1 — Systems & Function Navigator

**Files:**
- Create: `src/features/decision-panel/pane-systems.js`

Renders the left pane: system comparison cards in State 1, system info + function navigator in State 2.

- [ ] **Step 1: Create pane-systems.js**

```javascript
/**
 * Pane 1 — System context and function navigation.
 *
 * State 1 (simple): renders system comparison cards.
 * State 2 (expanded): renders compact system info + function navigator list.
 */

import { state } from '../../state.js';
import { escHtml } from '../../ui-helpers.js';
import { renderSystemCard, renderTierBadge } from './helpers.js';
import { getDecisionKey } from '../../simulation/decisions.js';
import { isCapabilitySystem } from '../../analysis/allocation.js';
import { LGAM_CAPABILITIES } from '../../constants/capabilities.js';

/**
 * Renders Pane 1 for State 1 (simple case): system comparison cards.
 *
 * @param {Array} systems - competing systems in the cell
 * @param {string|null} vestingDate
 * @returns {string} HTML
 */
export function renderPane1Simple(systems, vestingDate) {
    if (!systems || systems.length === 0) {
        return `
            <div class="pane-label">Systems</div>
            <div class="p-4 bg-[#f3f2f1] border border-[#b1b4b6] text-sm text-gray-600 italic">
                No systems allocated to this function for this successor.
            </div>`;
    }

    const cards = systems.map(sys => renderSystemCard(sys, vestingDate)).join('');

    return `
        <div class="pane-label">Competing Systems (${systems.length})</div>
        <div class="flex flex-col gap-3">
            ${cards}
        </div>
    `;
}

/**
 * Renders Pane 1 for State 2 (expanded): compact system card + function navigator.
 *
 * @param {Object} primarySystem - the system being decided upon
 * @param {Array<{funcId: string, label: string}>} functions - functions this system serves
 * @param {string} currentFunctionId - currently selected function
 * @param {string} successorName - primary successor
 * @param {string|null} vestingDate
 * @returns {string} HTML
 */
export function renderPane1Expanded(primarySystem, functions, currentFunctionId, successorName, vestingDate) {
    const decisions = state.simulationState ? state.simulationState.decisions : new Map();

    const systemCardHtml = renderSystemCard(primarySystem, vestingDate, { compact: true });

    const funcRows = functions.map(f => {
        const isCurrent = f.funcId === currentFunctionId;
        const key = getDecisionKey(f.funcId, successorName);
        const existing = decisions.get(key);

        let statusBadge;
        if (isCurrent) {
            statusBadge = '<span class="text-[9px] px-1.5 py-0.5 font-bold bg-[#f0f4ff] text-[#1d70b8]">Editing</span>';
        } else if (existing && existing.resolvedVia) {
            statusBadge = '<span class="text-[9px] px-1.5 py-0.5 font-bold bg-[#f3f2f1] text-[#505a5f]">Resolved</span>';
        } else if (existing && existing.sharedServiceOrigin) {
            statusBadge = '<span class="text-[9px] px-1.5 py-0.5 font-bold bg-[#cce2d8] text-[#00703c]">Shared ✓</span>';
        } else if (existing) {
            statusBadge = '<span class="text-[9px] px-1.5 py-0.5 font-bold bg-[#cce2d8] text-[#00703c]">Done ✓</span>';
        } else {
            statusBadge = '<span class="text-[9px] px-1.5 py-0.5 font-bold bg-[#f3f2f1] text-[#505a5f]">Pending</span>';
        }

        const selectedClass = isCurrent ? 'border-[#1d70b8] bg-[#f0f4ff] border-2' : 'border-[#b1b4b6] bg-[#fafafa]';

        return `
            <div class="flex items-center p-1.5 border ${selectedClass} mb-0.5 cursor-pointer text-xs func-nav-row" data-func-id="${escHtml(f.funcId)}">
                <span class="flex-1 font-semibold">${escHtml(f.label)}</span>
                ${statusBadge}
            </div>`;
    }).join('');

    const isErp = primarySystem.isERP || false;
    const decommNote = isErp
        ? `<div class="mt-2 p-1.5 bg-[#fff7e6] border-l-3 border-[#f47738] text-[10px]">
            <strong>ERP:</strong> Decommissioned when all ${functions.length} functions resolved away.
           </div>`
        : '';

    return `
        <div class="pane-label">System</div>
        <div class="mb-3">
            <div class="font-bold text-sm mb-1">${escHtml(primarySystem.label || 'Unnamed')}</div>
            <div class="text-xs text-gray-500 mb-2">${escHtml(primarySystem.sourceCouncil || primarySystem._sourceCouncil || '')}</div>
            ${systemCardHtml}
        </div>
        <div class="text-[10px] font-bold uppercase text-[#505a5f] mb-1">Functions</div>
        ${funcRows}
        ${decommNote}
    `;
}
```

- [ ] **Step 2: Verify build**

Run: `node build.js`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/features/decision-panel/pane-systems.js
git commit -m "feat(decision-panel): add Pane 1 rendering (systems + function navigator)"
```

---

### Task 4: Create Pane 2 — Successor Allocation Cards

**Files:**
- Create: `src/features/decision-panel/pane-allocation.js`

The core of the new UX: successor cards with dropdowns, "Share with..." toggle, procurement detail, derived labels.

- [ ] **Step 1: Create pane-allocation.js**

```javascript
/**
 * Pane 2 — Successor allocation cards.
 *
 * Renders one card per successor with system selection dropdown and
 * "Share with..." toggle. Handles derived label computation and escalation link.
 */

import { state } from '../../state.js';
import { escHtml } from '../../ui-helpers.js';
import { getDecisionKey } from '../../simulation/decisions.js';
import { buildHostingPartnerOptions } from './helpers.js';

/**
 * Renders Pane 2 for the given function — successor cards with allocation dropdowns.
 *
 * @param {Object} params
 * @param {string} params.functionId
 * @param {string} params.primarySuccessorName - the successor that opened the panel
 * @param {Array} params.systems - competing systems for this (function, primarySuccessor) cell
 * @param {Object|null} params.existingDecision
 * @param {boolean} params.isExpanded - true if in State 2
 * @returns {string} HTML
 */
export function renderPane2Allocation({
    functionId,
    primarySuccessorName,
    systems,
    existingDecision,
    isExpanded
}) {
    const successors = state.transitionStructure ? state.transitionStructure.successors : [];
    const allSuccessorNames = successors.map(s => s.name);
    const decisions = state.simulationState ? state.simulationState.decisions : new Map();

    // Build dropdown options from competing systems
    const systemOptions = systems.map(sys => {
        const label = `${sys.label || 'Unnamed'} (${sys.sourceCouncil || sys._sourceCouncil || 'Unknown'})`;
        return { id: sys.id, label };
    });

    // Determine existing shared state
    const sharedSuccessors = existingDecision ? (existingDecision.sharedWithSuccessors || []) : [];
    const primaryIsLinked = sharedSuccessors.length > 0;

    // Build cards
    let cardsHtml = '';

    // Primary successor card
    const primarySelectedId = existingDecision && existingDecision.systemChoice === 'choose' && existingDecision.retainedSystemIds.length > 0
        ? existingDecision.retainedSystemIds[0]
        : null;
    const primaryChoice = existingDecision ? existingDecision.systemChoice : null;

    cardsHtml += renderSuccessorCard({
        successorName: primarySuccessorName,
        isPrimary: true,
        isLinked: primaryIsLinked,
        systemOptions,
        selectedSystemId: primarySelectedId,
        selectedChoice: primaryChoice,
        existingDecision,
        functionId,
        allSuccessorNames: allSuccessorNames.filter(n => n !== primarySuccessorName),
        sharedSuccessors
    });

    // Other successor cards
    for (const succName of allSuccessorNames) {
        if (succName === primarySuccessorName) continue;

        const isSecondary = sharedSuccessors.includes(succName);
        const otherKey = getDecisionKey(functionId, succName);
        const otherDecision = decisions.get(otherKey);

        if (isSecondary) {
            // Linked/secondary card — read-only
            const sharedSystemLabel = primaryChoice === 'choose' && primarySelectedId
                ? (systems.find(s => s.id === primarySelectedId)?.label || primarySelectedId)
                : primaryChoice === 'procure' && existingDecision?.procuredSystem
                    ? existingDecision.procuredSystem.label
                    : 'shared system';

            cardsHtml += `
                <div class="border-2 border-dashed border-[#00703c] p-2.5 mb-2 bg-[#f8fdf9] rounded-sm">
                    <div class="font-bold text-xs mb-1">${escHtml(succName)}
                        <span class="inline-block text-[9px] px-1.5 py-0.5 font-bold bg-[#cce2d8] text-[#00703c] border border-[#00703c] ml-1.5">Shared</span>
                    </div>
                    <div class="text-xs text-[#00703c] p-1.5 bg-[#f0fdf4] border border-[#cce2d8]">
                        <strong>${escHtml(sharedSystemLabel)}</strong> — shared with ${escHtml(primarySuccessorName)}
                    </div>
                    <div class="text-[10px] text-[#505a5f] mt-1">
                        <a href="#" class="text-[#d4351c] underline unlink-shared-btn" data-successor="${escHtml(succName)}">Unlink</a> — make independent decision
                    </div>
                </div>`;
        } else {
            // Independent card — has its own dropdown
            const otherAllocMap = state.simulationState?.baselineAllocation || state.successorAllocationMap;
            const otherSuccMap = otherAllocMap ? otherAllocMap.get(succName) : null;
            const otherAllocations = otherSuccMap ? (otherSuccMap.get(functionId) || []) : [];
            const otherSystems = otherAllocations.map(a => ({
                id: a.system.id,
                label: `${a.system.label || 'Unnamed'} (${a.sourceCouncil || 'Unknown'})`
            }));

            const otherSelectedId = otherDecision && otherDecision.systemChoice === 'choose' && otherDecision.retainedSystemIds.length > 0
                ? otherDecision.retainedSystemIds[0] : null;

            cardsHtml += renderSuccessorCard({
                successorName: succName,
                isPrimary: false,
                isLinked: false,
                systemOptions: otherSystems,
                selectedSystemId: otherSelectedId,
                selectedChoice: otherDecision ? otherDecision.systemChoice : null,
                existingDecision: otherDecision,
                functionId,
                allSuccessorNames: [],
                sharedSuccessors: []
            });
        }
    }

    // Derived label
    const derivedHtml = renderDerivedLabel(primaryChoice, sharedSuccessors, primarySelectedId, systems, existingDecision);

    // Escalation link (State 1 only — in State 2 we're already expanded)
    const escalationHtml = !isExpanded
        ? `<div class="mt-3 p-2 border-2 border-dashed border-[#1d70b8] text-center rounded bg-[#f0f4ff] cursor-pointer" id="escalateToExpanded">
            <div class="text-xs font-bold text-[#1d70b8]">↗ Assign system to additional functions</div>
            <div class="text-[10px] text-[#505a5f]">Opens expanded view for multi-function allocation</div>
           </div>`
        : '';

    return `
        <div class="pane-label">Allocation${isExpanded ? ': ' + escHtml(state.lgaFunctionMap?.get(functionId)?.label || functionId) : ''}</div>
        <div class="text-xs text-[#505a5f] mb-2">For each successor, what system serves this function?</div>
        ${cardsHtml}
        ${derivedHtml}
        ${escalationHtml}
    `;
}

function renderSuccessorCard({
    successorName, isPrimary, isLinked, systemOptions,
    selectedSystemId, selectedChoice, existingDecision, functionId,
    allSuccessorNames, sharedSuccessors
}) {
    const borderClass = isLinked
        ? 'border-2 border-[#00703c] bg-[#f8fdf9]'
        : 'border border-[#b1b4b6] bg-white';

    const primaryBadge = isPrimary && isLinked
        ? '<span class="inline-block text-[9px] px-1.5 py-0.5 font-bold bg-[#cce2d8] text-[#00703c] border border-[#00703c] ml-1.5">Primary</span>'
        : '';

    // Dropdown options
    let optionsHtml = systemOptions.map(opt =>
        `<option value="${escHtml(opt.id)}" ${opt.id === selectedSystemId ? 'selected' : ''}>${escHtml(opt.label)}</option>`
    ).join('');
    optionsHtml += `<option value="__procure__" ${selectedChoice === 'procure' ? 'selected' : ''}>Procure new system</option>`;
    optionsHtml += `<option value="__defer__" ${selectedChoice === 'defer' ? 'selected' : ''}>Defer — decide post-vesting</option>`;

    // Procurement detail (shown when procure selected)
    const showProcure = selectedChoice === 'procure';
    const ps = existingDecision?.procuredSystem || {};
    const procureDetailHtml = `
        <div class="mt-1.5 p-2 bg-[#fafafa] border border-[#e5e5e5] text-xs ${showProcure ? '' : 'hidden'}" data-procure-detail>
            <div class="flex justify-between items-center mb-1"><span>System:</span><input class="border border-[#b1b4b6] px-1.5 py-0.5 text-xs w-32 procure-field" data-field="label" value="${escHtml(ps.label || '')}"></div>
            <div class="flex justify-between items-center mb-1"><span>Vendor:</span><input class="border border-[#b1b4b6] px-1.5 py-0.5 text-xs w-32 procure-field" data-field="vendor" value="${escHtml(ps.vendor || '')}"></div>
            <div class="flex justify-between items-center mb-1"><span>Annual cost:</span><input type="number" class="border border-[#b1b4b6] px-1.5 py-0.5 text-xs w-32 procure-field" data-field="annualCost" value="${ps.annualCost || ''}"></div>
            <div class="flex justify-between items-center"><span>Hosting:</span>
                <select class="border border-[#b1b4b6] px-1 py-0.5 text-xs w-32 procure-field" data-field="hosting">
                    <option value="cloud" ${(ps.hosting || 'cloud') === 'cloud' ? 'selected' : ''}>Cloud</option>
                    <option value="on-premise" ${ps.hosting === 'on-premise' ? 'selected' : ''}>On-premise</option>
                    <option value="partner-hosted" ${ps.hosting === 'partner-hosted' ? 'selected' : ''}>Partner-hosted</option>
                </select>
            </div>
        </div>`;

    // "Share with..." toggle (only on primary card when a system is selected)
    let shareToggleHtml = '';
    if (isPrimary && allSuccessorNames.length > 0 && selectedChoice !== 'defer') {
        const checkboxes = allSuccessorNames.map(name => {
            const checked = sharedSuccessors.includes(name) ? 'checked' : '';
            return `<div class="flex items-center gap-1.5 text-xs py-0.5"><input type="checkbox" class="share-successor-cb" data-successor="${escHtml(name)}" ${checked}><label>${escHtml(name)}</label></div>`;
        }).join('');

        shareToggleHtml = `
            <div class="mt-1.5 p-2 bg-[#f0fdf4] border border-[#00703c] rounded-sm" data-share-toggle>
                <div class="text-[10px] font-bold text-[#00703c] mb-1">⟷ Share with other successors</div>
                ${checkboxes}
            </div>`;
    }

    return `
        <div class="${borderClass} p-2.5 mb-2 rounded-sm successor-card" data-successor="${escHtml(successorName)}" data-is-primary="${isPrimary}">
            <div class="font-bold text-xs mb-1.5">${escHtml(successorName)}${primaryBadge}</div>
            <select class="w-full border border-[#0b0c0c] p-1.5 text-xs bg-white successor-system-select" data-successor="${escHtml(successorName)}">
                ${optionsHtml}
            </select>
            ${procureDetailHtml}
            ${shareToggleHtml}
        </div>`;
}

function renderDerivedLabel(primaryChoice, sharedSuccessors, selectedSystemId, systems, existingDecision) {
    if (!primaryChoice || primaryChoice === 'defer') return '';

    if (sharedSuccessors.length > 0) {
        const sysLabel = primaryChoice === 'choose' && selectedSystemId
            ? (systems.find(s => s.id === selectedSystemId)?.label || 'selected system')
            : primaryChoice === 'procure' && existingDecision?.procuredSystem
                ? existingDecision.procuredSystem.label
                : 'new system';
        return `<div class="flex items-center gap-1.5 p-1.5 mt-2 rounded-sm text-[10px] font-bold bg-[#f0fdf4] border border-[#00703c] text-[#00703c]">
            <span>⟷</span> Shared service: ${escHtml(sysLabel)} (${sharedSuccessors.length + 1} successors)
        </div>`;
    }

    return '';
}
```

- [ ] **Step 2: Verify build**

Run: `node build.js`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/features/decision-panel/pane-allocation.js
git commit -m "feat(decision-panel): add Pane 2 successor allocation cards with sharing"
```

---

### Task 5: Create Pane 3 — Cost & Impact

**Files:**
- Create: `src/features/decision-panel/pane-cost-impact.js`

- [ ] **Step 1: Create pane-cost-impact.js**

```javascript
/**
 * Pane 3 — Cost split, decommissions, obligations, rationale.
 */

import { state } from '../../state.js';
import { escHtml } from '../../ui-helpers.js';
import { getSuccessorNamesForSystem } from './helpers.js';
import { getDecisionKey } from '../../simulation/decisions.js';

/**
 * Renders Pane 3: cost split, decommissions, obligations, decommission tracker, rationale.
 *
 * @param {Object} params
 * @param {string} params.functionId
 * @param {string} params.primarySuccessorName
 * @param {Array} params.systems - all systems in cell
 * @param {string|null} params.selectedSystemId - currently chosen system
 * @param {string} params.systemChoice - 'choose' | 'procure' | 'defer'
 * @param {string[]} params.sharedWithSuccessors - linked successors
 * @param {Object|null} params.procuredSystem
 * @param {Object|null} params.existingDecision
 * @param {boolean} params.isExpanded
 * @param {Object|null} params.primarySystem - the ERP/complex system (State 2 only)
 * @param {Array} params.allFunctions - functions served by primary system (State 2 only)
 * @returns {string} HTML
 */
export function renderPane3CostImpact({
    functionId, primarySuccessorName, systems, selectedSystemId,
    systemChoice, sharedWithSuccessors, procuredSystem, existingDecision,
    isExpanded, primarySystem, allFunctions
}) {
    let html = '<div class="pane-label">Cost & Impact</div>';

    // --- Cost split section ---
    if (sharedWithSuccessors.length > 0 || (selectedSystemId && getSuccessorNamesForSystem(selectedSystemId).length > 1)) {
        const costSystem = selectedSystemId ? systems.find(s => s.id === selectedSystemId) : null;
        const annualCost = costSystem ? costSystem.annualCost : (procuredSystem ? procuredSystem.annualCost : 0);
        const systemLabel = costSystem ? costSystem.label : (procuredSystem ? procuredSystem.label : 'System');

        if (annualCost) {
            const participants = [primarySuccessorName, ...sharedWithSuccessors];
            const overrides = selectedSystemId ? (state.costSplitOverrides[selectedSystemId] || {}) : {};
            const equalProp = 1 / participants.length;

            html += `<div class="text-xs font-bold mb-1">${escHtml(systemLabel)} — £${Number(annualCost).toLocaleString()}/yr</div>`;
            html += `<div class="text-[10px] text-[#505a5f] mb-1.5">${sharedWithSuccessors.length > 0 ? 'Shared service' : 'Transition'} cost split:</div>`;

            for (const name of participants) {
                const prop = overrides[name] != null ? overrides[name] : equalProp;
                const pct = Math.round(prop * 100);
                const amount = Math.round(annualCost * prop);
                html += `<div class="flex justify-between items-center py-0.5 text-xs">
                    <span>${escHtml(name)}</span>
                    <span><input type="number" min="0" max="100" value="${pct}" class="w-11 border border-[#b1b4b6] px-1 py-0.5 text-[10px] text-right cost-split-input" data-system-id="${escHtml(selectedSystemId || '')}" data-successor="${escHtml(name)}">% → £${amount.toLocaleString()}</span>
                </div>`;
            }

            html += `<div class="text-[10px] text-right mt-1">
                <a href="#" class="text-[#1d70b8] underline cost-split-shortcut" data-action="equal">Equal</a> ·
                <a href="#" class="text-[#1d70b8] underline cost-split-shortcut" data-action="by-users">By users</a> ·
                <a href="#" class="text-[#1d70b8] underline cost-split-shortcut" data-action="by-functions">By functions</a>
            </div>`;

            html += '<div class="border-t border-[#e5e5e5] my-2.5"></div>';
        }
    }

    // --- Decommissions ---
    if (systemChoice === 'choose' && selectedSystemId) {
        const toDecommission = systems.filter(s => s.id !== selectedSystemId && !s.isERP);
        if (toDecommission.length > 0) {
            const totalSaved = toDecommission.reduce((sum, s) => sum + (s.annualCost || 0), 0);
            html += '<div class="text-xs font-bold mb-1">Decommissions</div>';
            html += toDecommission.map(s =>
                `<div class="text-xs text-[#d4351c]">• ${escHtml(s.label)}${s.annualCost ? ` — £${Number(s.annualCost).toLocaleString()}/yr saved` : ''}</div>`
            ).join('');
            if (totalSaved > 0) {
                html += `<div class="text-xs font-bold text-[#00703c] mt-0.5">Total saving: £${totalSaved.toLocaleString()}/yr</div>`;
            }
            html += '<div class="border-t border-[#e5e5e5] my-2.5"></div>';
        }
    }

    // --- Obligations preview ---
    html += '<div class="text-xs font-bold mb-1">Obligations</div>';
    const obligations = [];
    if (systemChoice === 'choose' && selectedSystemId) {
        const migrateFrom = systems.filter(s => s.id !== selectedSystemId);
        migrateFrom.forEach(s => {
            if (s.users > 0) obligations.push({ color: '#d4351c', text: `Data migration: ${s.label}` });
        });
    }
    if (systemChoice === 'procure') {
        obligations.push({ color: '#f47738', text: `Procurement: ${procuredSystem ? procuredSystem.label : 'new system'}` });
    }
    if (sharedWithSuccessors.length > 0) {
        obligations.push({ color: '#1d70b8', text: 'Shared service governance agreement' });
    }
    if (obligations.length === 0) {
        html += '<div class="text-xs text-[#505a5f] italic">No obligations for deferred decisions.</div>';
    } else {
        html += obligations.map(o =>
            `<div class="text-xs leading-relaxed"><span style="color:${o.color}">●</span> ${escHtml(o.text)}</div>`
        ).join('');
    }

    // --- ERP decommission tracker (State 2 only) ---
    if (isExpanded && primarySystem && allFunctions && allFunctions.length > 0) {
        const decisions = state.simulationState ? state.simulationState.decisions : new Map();
        html += '<div class="border-t border-[#e5e5e5] my-2.5"></div>';
        html += `<div class="text-xs font-bold mb-1">${escHtml(primarySystem.label)} decommission</div>`;

        let resolvedCount = 0;
        html += allFunctions.map(f => {
            const key = getDecisionKey(f.funcId, primarySuccessorName);
            const dec = decisions.get(key);
            const isCurrent = f.funcId === functionId;
            if (dec || isCurrent) resolvedCount++;

            if (isCurrent) return `<div class="text-xs"><span class="text-[#1d70b8]">◆</span> ${escHtml(f.label)} — editing</div>`;
            if (dec) return `<div class="text-xs"><span class="text-[#00703c]">✓</span> ${escHtml(f.label)} — resolved</div>`;
            return `<div class="text-xs"><span class="text-[#b1b4b6]">○</span> ${escHtml(f.label)} — pending</div>`;
        }).join('');

        const remaining = allFunctions.length - resolvedCount;
        if (remaining > 0) {
            html += `<div class="text-[10px] text-[#f47738] font-bold mt-1">${remaining} pending — not yet decommissioned</div>`;
        } else {
            html += `<div class="text-[10px] text-[#00703c] font-bold mt-1">All resolved — decommission triggered</div>`;
        }
    }

    // --- Rationale ---
    html += '<div class="border-t border-[#e5e5e5] my-2.5"></div>';
    const existingRationale = existingDecision ? (existingDecision.rationale || '') : '';
    html += `<div class="text-xs font-bold mb-1">Rationale <span class="font-normal text-[#86868b]">(optional)</span></div>`;
    html += `<textarea id="decisionRationale" class="w-full border border-[#b1b4b6] p-1.5 text-xs h-10 resize-y" placeholder="e.g. Cloud-first strategy, board decision 2026-06-01.">${escHtml(existingRationale)}</textarea>`;

    return html;
}
```

- [ ] **Step 2: Verify build**

Run: `node build.js`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/features/decision-panel/pane-cost-impact.js
git commit -m "feat(decision-panel): add Pane 3 cost split, obligations, rationale"
```

---

### Task 6: Create Sharing Grid Module

**Files:**
- Create: `src/features/decision-panel/sharing-grid.js`
- Create: `tests/properties/sharing-grid.property.test.js`

- [ ] **Step 1: Write property tests**

Create `tests/properties/sharing-grid.property.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeGridState, deriveSharedGroupsFromGrid } from '../../src/features/decision-panel/sharing-grid.js';

describe('sharing grid state', () => {
    const arbFunction = fc.record({
        funcId: fc.stringMatching(/^[0-9]{1,3}$/),
        label: fc.string({ minLength: 1, maxLength: 20 }),
        systemLabel: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
        decided: fc.boolean()
    });

    const arbSuccessor = fc.string({ minLength: 1, maxLength: 20 });

    it('primary successor is always checked for all decided functions', () => {
        fc.assert(fc.property(
            fc.array(arbFunction.map(f => ({ ...f, decided: true })), { minLength: 1, maxLength: 5 }),
            arbSuccessor,
            fc.array(arbSuccessor, { minLength: 1, maxLength: 3 }),
            (functions, primary, others) => {
                const gridState = computeGridState(functions, primary, others, new Map());
                for (const func of functions) {
                    expect(gridState[func.funcId][primary]).toBe(true);
                }
            }
        ));
    });

    it('undecided functions have disabled state for non-primary', () => {
        fc.assert(fc.property(
            fc.array(arbFunction.map(f => ({ ...f, decided: false })), { minLength: 1, maxLength: 5 }),
            arbSuccessor,
            fc.array(arbSuccessor, { minLength: 1, maxLength: 3 }),
            (functions, primary, others) => {
                const gridState = computeGridState(functions, primary, others, new Map());
                for (const func of functions) {
                    for (const other of others) {
                        expect(gridState[func.funcId][other]).toBe('disabled');
                    }
                }
            }
        ));
    });
});
```

- [ ] **Step 2: Create sharing-grid.js**

```javascript
/**
 * Sharing Grid — checkbox matrix showing who participates in which function.
 *
 * The grid syncs bidirectionally with the "Share with..." toggles in the
 * successor cards. It provides the bird's-eye view across all functions.
 */

import { state } from '../../state.js';
import { escHtml } from '../../ui-helpers.js';
import { LGA_FUNCTIONS } from '../../constants/lga-functions.js';
import { getDecisionKey } from '../../simulation/decisions.js';

/**
 * Computes the grid state: for each (function, successor) pair, returns
 * true (checked), false (unchecked), or 'disabled' (function not yet decided).
 *
 * @param {Array<{funcId, label, systemLabel, decided}>} functions
 * @param {string} primarySuccessor
 * @param {string[]} otherSuccessors
 * @param {Map} decisions - the decisions map
 * @returns {Object} - { [funcId]: { [successorName]: true|false|'disabled' } }
 */
export function computeGridState(functions, primarySuccessor, otherSuccessors, decisions) {
    const grid = {};

    for (const func of functions) {
        grid[func.funcId] = {};
        grid[func.funcId][primarySuccessor] = true; // primary always checked

        for (const other of otherSuccessors) {
            if (!func.decided) {
                grid[func.funcId][other] = 'disabled';
            } else {
                const key = getDecisionKey(func.funcId, other);
                const dec = decisions.get(key);
                grid[func.funcId][other] = !!(dec && dec.sharedServiceOrigin);
            }
        }
    }

    return grid;
}

/**
 * Renders the sharing grid HTML.
 *
 * @param {Array<{funcId, label, systemLabel, decided}>} functions
 * @param {string} primarySuccessor
 * @param {string[]} otherSuccessors
 * @returns {string} HTML
 */
export function renderSharingGrid(functions, primarySuccessor, otherSuccessors) {
    const decisions = state.simulationState ? state.simulationState.decisions : new Map();
    const gridState = computeGridState(functions, primarySuccessor, otherSuccessors, decisions);

    // Column headers
    let headerCells = '<th></th>';
    for (const func of functions) {
        const sysNote = func.systemLabel ? `<br><span style="font-size:9px;font-weight:normal;">(${escHtml(func.systemLabel)})</span>` : '';
        headerCells += `<th>${escHtml(func.label)}${sysNote}</th>`;
    }
    headerCells += '<th><button class="bg-transparent border-2 border-dashed border-[#1d70b8] text-[#1d70b8] text-[9px] font-bold px-1.5 py-0.5 cursor-pointer rounded-sm add-func-btn">+ Func</button></th>';

    // Rows
    let rows = '';

    // Primary row
    rows += `<tr class="bg-[#f0fdf4]"><td class="font-semibold">${escHtml(primarySuccessor)}<br><span class="text-[9px] text-[#00703c] font-bold">Primary</span></td>`;
    for (const func of functions) {
        rows += `<td><input type="checkbox" checked disabled class="w-4 h-4"></td>`;
    }
    rows += '<td></td></tr>';

    // Other successor rows
    for (const other of otherSuccessors) {
        rows += `<tr><td class="font-semibold">${escHtml(other)}</td>`;
        for (const func of functions) {
            const cellState = gridState[func.funcId][other];
            if (cellState === 'disabled') {
                rows += `<td><input type="checkbox" disabled class="w-4 h-4 opacity-30"></td>`;
            } else {
                const checked = cellState ? 'checked' : '';
                rows += `<td><input type="checkbox" ${checked} class="w-4 h-4 cursor-pointer grid-share-cb" data-func-id="${escHtml(func.funcId)}" data-successor="${escHtml(other)}"></td>`;
            }
        }
        rows += '<td></td></tr>';
    }

    return `
        <div class="mt-3 p-2 bg-[#f0fdf4] border border-[#00703c] rounded-sm" id="sharingGridSection">
            <div class="text-[10px] font-bold text-[#00703c] mb-1.5">⟷ Sharing overview — all functions</div>
            <table class="w-full border-collapse text-xs">
                <thead><tr class="border-b border-[#b1b4b6]">${headerCells}</tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="text-[10px] text-[#505a5f] mt-1">Primary = always uses it · Checked = shared participant · Disabled = pending</div>
        </div>`;
}

/**
 * Derives which sharing groups exist from grid state.
 * Returns a summary string for display.
 *
 * @param {Object} gridState
 * @param {Array} functions
 * @param {string} primarySuccessor
 * @param {string[]} otherSuccessors
 * @returns {string}
 */
export function deriveSharedGroupsFromGrid(gridState, functions, primarySuccessor, otherSuccessors) {
    const parts = [];
    for (const func of functions) {
        if (!func.decided) {
            parts.push(`${func.label}: Pending`);
            continue;
        }
        const shared = otherSuccessors.filter(s => gridState[func.funcId][s] === true);
        if (shared.length > 0) {
            parts.push(`${func.label}: Shared (${[primarySuccessor, ...shared].join(' + ')})`);
        } else {
            parts.push(`${func.label}: ${primarySuccessor} only`);
        }
    }
    return parts.join(' · ');
}
```

- [ ] **Step 3: Run tests**

Run: `npm test -- --run tests/properties/sharing-grid.property.test.js`
Expected: All PASS.

- [ ] **Step 4: Verify build**

Run: `node build.js`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/features/decision-panel/sharing-grid.js tests/properties/sharing-grid.property.test.js
git commit -m "feat(decision-panel): add sharing grid module with property tests"
```

---

### Task 7: Create Apply Decision Module

**Files:**
- Create: `src/features/decision-panel/apply-decision.js`

Extracts the `applyDecisionFromPanel()` function, updated to read from the new successor-first form structure and auto-derive `boundaryChoice`.

- [ ] **Step 1: Create apply-decision.js**

This module reads form state from the new panel layout (successor cards, sharing checkboxes, rationale) and produces a FunctionDecision. It uses `computeDerivedBoundary()` to set `boundaryChoice` automatically.

The implementation follows the same logic as the current `applyDecisionFromPanel()` (lines 1555-1783 of the old file) but reads from the new DOM structure:
- System choice comes from the primary successor's dropdown (`successor-system-select`)
- Procurement details from inline fields (`.procure-field`)
- Shared successors from `.share-successor-cb:checked`
- Rationale from `#decisionRationale`
- BoundaryChoice is derived, never read from a radio

Full code for this module should follow the pattern of the existing `applyDecisionFromPanel()` with these adaptations. The function signature and exports remain the same so `simulation-panel.js` can import it.

- [ ] **Step 2: Verify build**

Run: `node build.js`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/features/decision-panel/apply-decision.js
git commit -m "feat(decision-panel): add apply-decision module with derived boundaryChoice"
```

---

### Task 8: Rewrite Decision Panel Entry Point

**Files:**
- Rewrite: `src/features/decision-panel.js`

This is the integration task. The new `decision-panel.js` becomes a thin orchestrator that:
1. Detects simple vs expanded state
2. Renders the three-pane layout using sub-modules
3. Wires interactivity (dropdown changes, share toggles, grid checkboxes, escalation)
4. Delegates apply to `apply-decision.js`

- [ ] **Step 1: Rewrite decision-panel.js**

The new file should:
- Import from `./decision-panel/pane-systems.js`, `./decision-panel/pane-allocation.js`, `./decision-panel/pane-cost-impact.js`, `./decision-panel/sharing-grid.js`, `./decision-panel/apply-decision.js`, `./decision-panel/helpers.js`
- Keep `openDecisionPanel()` as the public API
- Detect state: `isExpanded` = system is ERP OR is partial predecessor (isDisaggregation) OR has sharedWith OR serves multiple functions in this successor
- Render three-pane layout: `<div class="flex gap-0 flex-1 min-h-0">` with widths ~22% / 46% / 32% (expanded) or ~28% / 40% / 32% (simple)
- Wire interactivity: successor dropdown changes re-render Pane 3; share checkbox changes update grid and re-render; escalation button switches to expanded state
- Keep the modal HTML shell (header, footer with Apply/Cancel, close button, focus trap, Escape key) — same pattern as current
- Preserve `window._simOpenDecision` hook for matrix cell clicks
- Preserve `window._simUnlinkSharedService` and `window._simBulkApplyErp` hooks
- Preserve the propagated shared-service read-only view

- [ ] **Step 2: Verify build passes**

Run: `node build.js`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Start dev server and test in browser**

Run: `python3 -m http.server 8765` and open `http://localhost:8765/dist/lgr-rationalisation-engine.html`

Test:
1. Upload example data from `examples/06-county-disaggregation/`
2. Enter simulation mode
3. Click a matrix cell (simple function) → verify three-pane layout with cards
4. Select a system → verify cost split appears in Pane 3
5. Check "Share with..." → verify secondary card appears linked
6. Click Apply → verify decision stores correctly
7. Click an ERP function cell → verify expanded state with function navigator + sharing grid
8. Navigate between functions in Pane 1 → verify Pane 2/3 update

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All tests pass (property tests don't test rendering, so existing tests should be unaffected).

- [ ] **Step 5: Commit**

```bash
git add src/features/decision-panel.js
git commit -m "feat(decision-panel): rewrite with successor-first allocation model"
```

---

### Task 9: Wire Sharing Grid Interactivity & Bidirectional Sync

**Files:**
- Modify: `src/features/decision-panel.js` (add event wiring for grid)

- [ ] **Step 1: Wire grid checkbox ↔ card share toggle sync**

In the interactivity wiring section of `decision-panel.js`, add:
- `.grid-share-cb` change events → update the corresponding `.share-successor-cb` in the cards above, then re-render Pane 3
- `.share-successor-cb` change events → update the corresponding `.grid-share-cb` in the grid below
- `.add-func-btn` click → open a typeahead dropdown with LGA functions not already in the grid

- [ ] **Step 2: Wire function navigator click**

- `.func-nav-row` click events → update `_currentFunctionId`, re-render Pane 2 and Pane 3 for the newly selected function, update the selected highlight in Pane 1

- [ ] **Step 3: Wire escalation button**

- `#escalateToExpanded` click → switch `_isExpanded` to true, re-render all three panes in expanded mode

- [ ] **Step 4: Test in browser**

Verify:
1. Checking a grid cell checks the corresponding "Share with..." checkbox in the card
2. Checking a "Share with..." checkbox checks the corresponding grid cell
3. Clicking a function in the navigator updates Pane 2 with that function's allocation
4. Clicking "Assign to additional functions" transitions from cards to expanded + grid

- [ ] **Step 5: Commit**

```bash
git add src/features/decision-panel.js
git commit -m "feat(decision-panel): wire sharing grid bidirectional sync and navigation"
```

---

### Task 10: Integration Testing & Polish

**Files:**
- Modify: `src/features/decision-panel.js` (any fixes)
- Run: `node build.js`

- [ ] **Step 1: Test scenario roundtrip**

1. Make decisions using the new panel
2. Export scenario (from simulation panel)
3. Reload page, re-upload architecture data
4. Import the scenario
5. Verify all decisions restore correctly (including rationale, shared service links)

- [ ] **Step 2: Test cross-successor propagation**

1. In the new panel, select a system and check "Share with [other successor]"
2. Apply
3. Open the other successor's decision for the same function
4. Verify it shows the propagated read-only view ("This function is served by a shared service")

- [ ] **Step 3: Test ERP expanded workflow**

1. Open decision for an ERP function
2. Verify auto-expanded state with function navigator
3. Make a decision for one function
4. Navigate to another function in the same ERP
5. Verify the sharing grid updates to show the first function as decided
6. Make all decisions → verify "SAP decommission triggered" in Pane 3

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All 493+ tests pass.

- [ ] **Step 5: Build final dist**

Run: `node build.js`
Expected: Build succeeds. `dist/lgr-rationalisation-engine.html` is updated.

- [ ] **Step 6: Commit final state**

```bash
git add src/ dist/lgr-rationalisation-engine.html
git commit -m "feat(decision-panel): complete successor-first redesign with sharing grid"
```

---

## Implementation Notes for the Engineer

1. **The old `decision-panel.js` is 2056 lines.** Don't try to incrementally modify it — the rendering logic is fundamentally different. Rewrite it as a thin orchestrator that delegates to sub-modules.

2. **`boundaryChoice` backward compatibility is critical.** The projector (`src/simulation/projector.js`) reads `boundaryChoice` to determine what actions to project. The new UI must write the correct derived value before storing the decision. If `computeDerivedBoundary()` returns the wrong value, the simulation will break silently.

3. **The modal HTML shell already exists in `src/main.js`** (the `decisionPanelModal` div with header, content, footer). Don't recreate it — render into `#decisionPanelContent` as the current code does.

4. **Capability system handling is preserved as-is.** The `renderCapabilityPlatformsSection()` and blast radius preview can be included in Pane 1 below the system cards. Don't redesign this — just port it.

5. **Window hooks must be preserved.** `window._simOpenDecision`, `window._simUnlinkSharedService`, `window._simBulkApplyErp` are called from other modules. Keep them working.

6. **The `state.costSplitOverrides` object already exists** and uses the pattern `{ [systemId]: { [successorName]: proportion } }`. The new Pane 3 cost UI should read/write this same structure.

7. **Test with example scenario 06** (`examples/06-county-disaggregation/`) — it has a county council as a partial predecessor with systems allocated to two successors. This is the primary test case for the cross-boundary expanded state.
