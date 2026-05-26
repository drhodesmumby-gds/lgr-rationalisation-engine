# Hosting Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `isCloud: boolean` with `hosting: 'cloud'|'on-premise'|'partner-hosted'` plus conditional `hostingPartner: string`, enabling partner-hosted systems to trigger a new hosting continuity signal in transition mode.

**Architecture:** A schema field replacement with backward-compatible migration. The `hosting` enum replaces the binary `isCloud` boolean. When `hosting === 'partner-hosted'`, the `hostingPartner` field names the hosting council/organisation. Analysis checks whether that partner is in the merger's transition structure to determine Day 1 risk level.

**Tech Stack:** ES modules, existing signal/allocation infrastructure, property tests (vitest + fast-check).

---

### Task 1: Schema Definition + Backward-Compat Helper

**Files:**
- Modify: `src/constants/schema-definitions.js`
- Create: `src/analysis/hosting.js`

- [ ] **Step 1: Update schema-definitions.js**

Replace the `isCloud` field definition in `ITSystem.fields` (around line 197) with:

```javascript
{
    name: 'hosting',
    type: 'string',
    required: false,
    description: 'System hosting model',
    enum: ['cloud', 'on-premise', 'partner-hosted'],
    enumDescriptions: {
        'cloud': 'Vendor-hosted SaaS or cloud platform. Council has no infrastructure responsibility.',
        'on-premise': 'Hosted on council-owned infrastructure (data centre, servers).',
        'partner-hosted': 'Hosted by another council or shared service body. Specify partner in hostingPartner field.'
    }
},
{
    name: 'hostingPartner',
    type: 'string',
    required: false,
    description: 'Name of the council or organisation that hosts this system (only when hosting is partner-hosted)'
},
```

Remove the old `isCloud` field definition.

- [ ] **Step 2: Create hosting.js helper module**

Create `src/analysis/hosting.js`:

```javascript
/**
 * Resolves the hosting type from a system node.
 * Handles both new (hosting enum) and legacy (isCloud boolean) data.
 */
export function getHostingType(system) {
    if (system.hosting) return system.hosting;
    if (system.isCloud === true) return 'cloud';
    if (system.isCloud === false) return 'on-premise';
    return null;
}

/**
 * Returns true if the system is NOT cloud-hosted (on-prem or partner-hosted).
 * Drop-in replacement for `!system.isCloud` checks.
 */
export function isNonCloud(system) {
    const type = getHostingType(system);
    return type === 'on-premise' || type === 'partner-hosted';
}

/**
 * Returns true if the system is cloud-hosted.
 */
export function isCloud(system) {
    return getHostingType(system) === 'cloud';
}

/**
 * Detects hosting continuity risk for partner-hosted systems.
 * @param {object} system — ITSystem node with hosting and hostingPartner
 * @param {Map<string, string[]>} councilToSuccessorMap — council name → successor names
 * @returns {{ risk: 'none'|'continuity'|'governance', detail: string }|null}
 */
export function detectHostingRisk(system, councilToSuccessorMap) {
    if (getHostingType(system) !== 'partner-hosted') return null;
    if (!system.hostingPartner) return null;

    const partnerSuccessors = councilToSuccessorMap.get(system.hostingPartner);

    // Partner is not in the merger — external dependency
    if (!partnerSuccessors || partnerSuccessors.length === 0) {
        return {
            risk: 'governance',
            detail: `Hosted by ${system.hostingPartner} (external to this merger). Partnership agreement will need novation to successor authority.`
        };
    }

    // Partner is in the merger — check if same successor
    const sourceCouncil = system._sourceCouncil;
    const sourceSuccessors = councilToSuccessorMap.get(sourceCouncil) || [];

    const sameSuccessor = sourceSuccessors.some(s => partnerSuccessors.includes(s));
    if (sameSuccessor) {
        return { risk: 'none', detail: `Hosted by ${system.hostingPartner} — both map to the same successor.` };
    }

    return {
        risk: 'continuity',
        detail: `Hosted by ${system.hostingPartner} which maps to a different successor. Day 1 hosting continuity agreement required.`
    };
}
```

- [ ] **Step 3: Run build to verify syntax**

Run: `node build.js`
Expected: Build succeeds (module not imported yet by anything)

- [ ] **Step 4: Commit**

```bash
git add src/constants/schema-definitions.js src/analysis/hosting.js
git commit -m "feat(hosting): schema enum + hosting.js helper with backward compat"
```

---

### Task 2: Signal Updates

**Files:**
- Modify: `src/analysis/signals.js`

- [ ] **Step 1: Import hosting helpers**

At the top of signals.js, add:
```javascript
import { isNonCloud, isCloud, getHostingType, detectHostingRisk } from './hosting.js';
```

- [ ] **Step 2: Update techDebt signal (around line 287)**

Replace:
```javascript
const onPrem = systems.filter(s => !s.isCloud);
```
With:
```javascript
const onPrem = systems.filter(s => isNonCloud(s));
```

- [ ] **Step 3: Update TCoP hosting check (around line 14-16)**

Replace the `isCloud === true` / `isCloud === false` checks with `isCloud(system)` / `isNonCloud(system)`.

- [ ] **Step 4: Add partner-hosting signal**

After the techDebt signal block, add a new signal that fires when partner-hosted systems have hosting continuity risk. Only in transition mode (where we have the transition structure to check against):

```javascript
if (weights.techDebt > 0 && state.operatingMode === 'transition' && state.transitionStructure) {
    const partnerHosted = systems.filter(s => getHostingType(s) === 'partner-hosted' && s.hostingPartner);
    if (partnerHosted.length > 0) {
        const councilToSuccessorMap = new Map();
        state.transitionStructure.successors.forEach(succ => {
            (succ.fullPredecessors || []).forEach(c => {
                if (!councilToSuccessorMap.has(c)) councilToSuccessorMap.set(c, []);
                councilToSuccessorMap.get(c).push(succ.name);
            });
            (succ.partialPredecessors || []).forEach(c => {
                if (!councilToSuccessorMap.has(c)) councilToSuccessorMap.set(c, []);
                councilToSuccessorMap.get(c).push(succ.name);
            });
        });

        const risks = partnerHosted.map(s => detectHostingRisk(s, councilToSuccessorMap)).filter(r => r && r.risk !== 'none');
        if (risks.length > 0) {
            const hasContinuity = risks.some(r => r.risk === 'continuity');
            const parts = risks.map(r => r.detail);
            signals.push({
                id: 'techDebt', weight: weights.techDebt,
                label: 'Partner-hosted risk',
                value: parts.join('; '),
                tag: hasContinuity ? 'tag-red' : 'tag-orange',
                border: hasContinuity ? 'border-[#d4351c]' : 'border-[#f47738]',
                strong: hasContinuity
            });
        }
    }
}
```

- [ ] **Step 5: Run build and tests**

Run: `node build.js && npm test`
Expected: Build succeeds, tests pass (generators still use isCloud but backward compat handles it)

- [ ] **Step 6: Commit**

```bash
git add src/analysis/signals.js
git commit -m "feat(hosting): update techDebt signal to use hosting helpers + partner risk"
```

---

### Task 3: Analysis Module Updates

**Files:**
- Modify: `src/analysis/metrics.js`
- Modify: `src/analysis/questions.js`
- Modify: `src/features/baseline-report.js`

- [ ] **Step 1: Update metrics.js**

Import hosting helpers and replace `system.isCloud === false` (line 308) with `isNonCloud(system)`.

- [ ] **Step 2: Update questions.js**

Import hosting helpers. Replace:
- Line 12: `systems.filter(s => !s.isCloud)` → `systems.filter(s => isNonCloud(s))`
- Line 259: `anchor.isCloud ? 'Cloud-hosted.' : 'On-premise...'` → use `getHostingType(anchor)` for richer text
- Line 329: `systems.filter(s => !s.isCloud)` → `systems.filter(s => isNonCloud(s))`
- Line 380: `s.isCloud ? 'cloud' : 'on-premise'` → `getHostingType(s) || 'unknown'`

- [ ] **Step 3: Update baseline-report.js**

Import hosting helpers. Replace:
- Line 164: `allSystems.filter(s => s.isCloud === false)` → `allSystems.filter(s => isNonCloud(s))`
- Line 366-367: similar replacements for cloud/onPrem counts
- Line 421: `system.isCloud === false` → `isNonCloud(system)`
- Line 430: `system.isCloud === true` → `isCloud(system)`

- [ ] **Step 4: Run build and tests**

Run: `node build.js && npm test`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/analysis/metrics.js src/analysis/questions.js src/features/baseline-report.js
git commit -m "feat(hosting): update analysis modules to use hosting helpers"
```

---

### Task 4: Simulation + Decision Panel Updates

**Files:**
- Modify: `src/simulation/obligations.js`
- Modify: `src/simulation/projector.js`
- Modify: `src/simulation/decisions.js`
- Modify: `src/features/decision-panel.js`
- Modify: `src/features/report-export.js`
- Modify: `src/features/sankey-data.js`
- Modify: `src/main.js` (dashboard rendering)

- [ ] **Step 1: Update simulation/obligations.js**

Import `{ isNonCloud, isCloud }` from `../analysis/hosting.js`. Replace all `!sys.isCloud` with `isNonCloud(sys)` and `!!sys.isCloud` with `isCloud(sys)`. There are ~12 occurrences.

- [ ] **Step 2: Update simulation/projector.js**

Line 352: Replace `isCloud: procuredSystem.isCloud !== undefined ? procuredSystem.isCloud : true` with:
```javascript
hosting: procuredSystem.hosting || 'cloud',
```

- [ ] **Step 3: Update simulation/decisions.js**

Line 22: Replace `@property {boolean} [procuredSystem.isCloud]` with `@property {string} [procuredSystem.hosting]`.

- [ ] **Step 4: Update decision-panel.js**

- Line 429: Replace `sys.isCloud` badge logic with `getHostingType(sys)` to show 'Cloud' / 'On-Premise' / 'Partner-hosted (Name)'.
- Lines 1474/1549/1947: The "procure new" system form — replace the `isCloud` checkbox with a hosting dropdown (cloud/on-premise/partner-hosted).

- [ ] **Step 5: Update report-export.js**

Replace all `sys.isCloud` references (~6 occurrences) with `isCloud(sys)` / `isNonCloud(sys)` / `getHostingType(sys)` as appropriate.

- [ ] **Step 6: Update sankey-data.js**

Line 166: Replace `isCloud: !!sys.isCloud` with `hosting: getHostingType(sys) || 'cloud'`.

- [ ] **Step 7: Update main.js dashboard rendering**

- Lines 3007-3009: Replace `sys.isCloud` badge with `getHostingType(sys)` for Cloud/On-Prem/Partner-hosted labels and colours.
- Line 3219: Replace `systems.filter(s => !s.isCloud)` with `systems.filter(s => isNonCloud(s))`.

- [ ] **Step 8: Run build and tests**

Run: `node build.js && npm test`

- [ ] **Step 9: Commit**

```bash
git add src/simulation/ src/features/decision-panel.js src/features/report-export.js src/features/sankey-data.js src/main.js
git commit -m "feat(hosting): update simulation, decision panel, reports to use hosting enum"
```

---

### Task 5: Editor Updates

**Files:**
- Modify: `src/features/unified-editor/props-panel.js`
- Modify: `src/features/unified-editor/bulk-mode.js`
- Modify: `src/features/unified-editor/editor.js`
- Modify: `src/features/unified-editor/wizard.js`
- Modify: `src/features/unified-editor/list-panel.js`

- [ ] **Step 1: Update props-panel.js**

Replace the Hosting radio group (line ~121) from `['Cloud', 'On-Premise']` to `['Cloud', 'On-Premise', 'Partner-Hosted']`. Map:
- 'Cloud' → `hosting: 'cloud'`
- 'On-Premise' → `hosting: 'on-premise'`
- 'Partner-Hosted' → `hosting: 'partner-hosted'`

Add a conditional `hostingPartner` text input below the radio group, only visible when Partner-Hosted is selected:
```html
<div data-hosting-partner-row class="${system.hosting !== 'partner-hosted' ? 'hidden' : ''}">
    <label>Hosting partner</label>
    <input type="text" data-prop-field="hostingPartner" value="${system.hostingPartner || ''}" placeholder="Council or organisation name" />
</div>
```

In `wirePropsPanel`, handle radio change for hosting: when value is 'Partner-Hosted', show the partner input; otherwise hide it. Call `onChange(nodeIdx, 'hosting', value.toLowerCase())`.

- [ ] **Step 2: Update bulk-mode.js**

Replace the `isCloud` column definition in the Technical tab:
```javascript
{ field: 'hosting', label: 'Hosting', type: 'select', width: 120,
    options: [{ value: 'cloud', label: 'Cloud' }, { value: 'on-premise', label: 'On-Premise' }, { value: 'partner-hosted', label: 'Partner-Hosted' }] },
```

Update `KEY_FIELDS` array: replace `'isCloud'` with `'hosting'`.
Update `KEY_FIELD_LABELS`: replace `isCloud: 'Hosting (Cloud/On-Prem)'` with `hosting: 'Hosting'`.
Remove the `isCloud` special case in `parseFieldValue` and `getSelectValue` — the select now directly uses string values.
Update `compareField` case: rename from `'isCloud'` to `'hosting'`, compare as simple strings.

- [ ] **Step 3: Update list-panel.js KEY_FIELDS**

Replace `'isCloud'` with `'hosting'` in the KEY_FIELDS array.

- [ ] **Step 4: Update editor.js new system template**

In `handleAdd()` (line ~206): replace `isCloud: null` with `hosting: ''`.

- [ ] **Step 5: Update wizard.js**

Replace the Cloud/On-Premise hosting radio with three options. Map selected value to `hosting` field instead of `isCloud`.

- [ ] **Step 6: Run build and tests**

Run: `node build.js && npm test`

- [ ] **Step 7: Commit**

```bash
git add src/features/unified-editor/
git commit -m "feat(hosting): update editor, bulk mode, wizard to hosting enum"
```

---

### Task 6: Import Wizard + Pre-Import Editor + Template Converter

**Files:**
- Modify: `src/features/import-wizard.js`
- Modify: `src/features/pre-import-editor.js`
- Modify: `src/features/template-converter.js`

- [ ] **Step 1: Update import-wizard.js**

- Line 25: Change field id from `'isCloud'` to `'hosting'`, label to `'Hosting'`
- Line 51: Update auto-detect regex pattern
- Line 109-110: Replace `parseBool` logic with hosting enum parsing (map 'cloud'/'yes'/'true' → 'cloud', 'on-prem'/'on-premise'/'no'/'false' → 'on-premise', 'partner'/'partner-hosted'/'shared' → 'partner-hosted')
- Lines 482/556/560/635: Update the manual entry form from isCloud radio to hosting dropdown
- Line 978: Replace `'isCloud'` in field list with `'hosting'`

- [ ] **Step 2: Update pre-import-editor.js**

- Line 264: Replace the isCloud Yes/No dropdown with a hosting enum select (cloud/on-premise/partner-hosted)
- Lines 502/521: Update field change handlers

- [ ] **Step 3: Update template-converter.js**

- Line 372-373: Replace `parseBool` isCloud logic with hosting enum parsing from the Excel column value.

- [ ] **Step 4: Run build and tests**

Run: `node build.js && npm test`

- [ ] **Step 5: Commit**

```bash
git add src/features/import-wizard.js src/features/pre-import-editor.js src/features/template-converter.js
git commit -m "feat(hosting): update import wizard and template converter"
```

---

### Task 7: Documentation + Constants

**Files:**
- Modify: `src/constants/documentation.js`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update documentation.js**

Line 34: Replace the techDebt signal documentation text from `isCloud=false` to reference the `hosting` field:
```
Identifies systems where hosting is 'on-premise' or 'partner-hosted'. On-premise hosting may complicate licencing and continuity. Partner-hosted systems where the partner maps to a different successor require Day 1 continuity agreements.
```

Line 41: Update TCoP Point 5 reference.

- [ ] **Step 2: Update CLAUDE.md**

Replace `isCloud` references in the Input Data Format section with the new `hosting` and `hostingPartner` fields. Update the example JSON.

- [ ] **Step 3: Commit**

```bash
git add src/constants/documentation.js CLAUDE.md
git commit -m "docs: update documentation for hosting enum"
```

---

### Task 8: Migrate Example Data + In-Built Demo

**Files:**
- Modify: All `examples/**/*.json` files (47 files)
- Modify: `src/main.js` (in-built demo data)

- [ ] **Step 1: Write migration script**

Python script to process all JSON files:
```python
# For each node with type 'ITSystem':
# - if isCloud === true → hosting: 'cloud', delete isCloud
# - if isCloud === false → hosting: 'on-premise', delete isCloud
# - if isCloud is missing → leave hosting unset
# Add hostingPartner to 2-3 systems per relevant scenario
```

- [ ] **Step 2: Run migration on examples/**

Execute the script. Verify with `git diff --stat`.

- [ ] **Step 3: Migrate in-built demo data in main.js**

Replace all `isCloud: true` with `hosting: 'cloud'` and `isCloud: false` with `hosting: 'on-premise'` in the demo data objects (lines 3424-3507). Add `hosting: 'partner-hosted', hostingPartner: 'County Council'` to one or two systems that currently have `sharedWith` indicating a hosting relationship (e.g. `sys-confirm-highways-d1`).

- [ ] **Step 4: Run build and tests**

Run: `node build.js && npm test`

- [ ] **Step 5: Commit**

```bash
git add examples/ src/main.js dist/
git commit -m "data: migrate all examples and demo from isCloud to hosting enum"
```

---

### Task 9: Test Updates

**Files:**
- Modify: `tests/generators/arbITSystem.js`
- Modify: `tests/generators/unified-editor-generators.js`
- Modify: All test files referencing `isCloud`
- Create: `tests/properties/hosting.property.test.js`

- [ ] **Step 1: Update test generators**

In `tests/generators/arbITSystem.js` line 30, replace:
```javascript
isCloud: fc.option(fc.boolean(), { nil: undefined }),
```
With:
```javascript
hosting: fc.option(fc.constantFrom('cloud', 'on-premise', 'partner-hosted'), { nil: undefined }),
hostingPartner: fc.option(fc.string({ minLength: 3, maxLength: 20 }), { nil: undefined }),
```

Same change in `tests/generators/unified-editor-generators.js` (lines 40 and 153).

- [ ] **Step 2: Update existing tests that reference isCloud**

Search all test files for `isCloud` and replace with `hosting` equivalent. Most are in generators or test data fixtures.

- [ ] **Step 3: Write hosting.property.test.js**

```javascript
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getHostingType, isNonCloud, isCloud, detectHostingRisk } from '../../src/analysis/hosting.js';

describe('getHostingType', () => {
    it('returns hosting field when present', ...);
    it('maps legacy isCloud:true to cloud', ...);
    it('maps legacy isCloud:false to on-premise', ...);
    it('returns null when neither hosting nor isCloud present', ...);
});

describe('isNonCloud', () => {
    it('true for on-premise', ...);
    it('true for partner-hosted', ...);
    it('false for cloud', ...);
});

describe('detectHostingRisk', () => {
    it('returns null for non-partner-hosted systems', ...);
    it('returns governance risk for external partner', ...);
    it('returns continuity risk when partner maps to different successor', ...);
    it('returns none when partner maps to same successor', ...);
});
```

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All tests pass, zero skipped

- [ ] **Step 5: Commit**

```bash
git add tests/
git commit -m "test: update generators and add hosting property tests"
```

---

### Task 10: Final Build + Verification

- [ ] **Step 1: Full build**

Run: `node build.js`
Expected: Success

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: All pass

- [ ] **Step 3: Browser verification**

Start server: `python3 -m http.server 8765`

Test:
1. Load demo → verify systems show Cloud/On-Premise/Partner-Hosted badges in matrix
2. Open editor → select system → verify hosting radio has 3 options
3. Select "Partner-Hosted" → verify hostingPartner input appears
4. Switch to Bulk mode Technical tab → verify Hosting dropdown has 3 options
5. Proceed to analysis → verify techDebt signal fires for on-premise systems
6. Verify no console errors

- [ ] **Step 4: Commit dist**

```bash
git add dist/
git commit -m "build: include hosting expansion in dist"
```
