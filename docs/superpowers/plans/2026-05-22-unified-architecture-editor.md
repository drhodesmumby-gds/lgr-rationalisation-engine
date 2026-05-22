# Unified Architecture Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the architecture editor modal, pre-import editor, and Build from Scratch wizard with one unified three-pane editor component (list | properties | relationships) with Focus and Bulk modes.

**Architecture:** A directory of focused modules at `src/features/unified-editor/`. The main `editor.js` orchestrates state and renders the three-pane layout. Each pane is its own module. Smart input behaviours (formatting, chips, autocomplete) are shared utilities. The editor replaces the existing modal and pre-import editor, wired from the same entry points in main.js.

**Tech Stack:** ES modules, Tailwind CSS (CDN), SCHEMA_DEFINITIONS for field metadata, LGA_FUNCTIONS for ESD autocomplete, LGAM_CAPABILITIES for capability pills.

---

### Task 1: Smart Inputs Module

**Files:**
- Create: `src/features/unified-editor/smart-inputs.js`

Shared input behaviours used across all panels. Pure rendering helpers + event wiring utilities.

- [ ] **Step 1: Create smart-inputs.js with formatting utilities**

Exports:
- `formatThousands(value)` — formats number with comma separators and optional £ prefix. Returns display string.
- `parseThousands(displayStr)` — strips £, commas, returns raw number or NaN.
- `renderChipSelector(options)` — returns HTML for a chip/tag input (existing chips + autocomplete input). Options: `{ chips: string[], placeholder, name }`.
- `renderCapabilityPills(options)` — returns HTML for toggleable capability pills. Options: `{ active: string[], vocabulary: string[], allowCustom: boolean }`.
- `renderRadioGroup(options)` — returns HTML for a compact radio group. Options: `{ name, title, options: string[], selected, hint? }`.
- `wireSmartInputs(container)` — attaches event handlers for: thousands formatting on blur/focus, chip add/remove, capability pill toggle, custom capability entry.

Each function returns an HTML string. `wireSmartInputs` attaches delegated events to a container element.

- [ ] **Step 2: Run build to verify syntax**

Run: `node build.js`
Expected: Build succeeds (module not imported yet)

- [ ] **Step 3: Commit**

```bash
git add src/features/unified-editor/smart-inputs.js
git commit -m "feat(editor): add smart-inputs module with formatting and chip utilities"
```

---

### Task 2: List Panel

**Files:**
- Create: `src/features/unified-editor/list-panel.js`

The left pane: domain-grouped system list with search, filter, progress, and + Add.

- [ ] **Step 1: Create list-panel.js**

Imports: `LGA_FUNCTIONS` from constants, `getRootCategoryId` from taxonomy.

Exports:
- `renderListPanel(editorState)` — returns HTML string for the full list panel. Groups systems by their function's ESD root category. Systems without functions go in "Platform / Infrastructure" group.
- `wireListPanel(container, options)` — attaches events. Options: `{ onSelect(nodeIdx), onAdd(), onSearch(query), onFilter(filter) }`.

Domain group headers have tinted backgrounds (CSS classes: `dh-admin`, `dh-health`, `dh-env`, `dh-housing`, `dh-transport`, `dh-platform`).

Each list item shows: name (bold), vendor + function (grey), status indicator (✓/⚠ N/✗ N based on field completeness). Active item has blue left border.

Progress bar shows: complete systems / total systems as percentage.

Search filters by system name or vendor (case-insensitive substring match).

- [ ] **Step 2: Run build**

Run: `node build.js`
Expected: Success

- [ ] **Step 3: Commit**

```bash
git add src/features/unified-editor/list-panel.js
git commit -m "feat(editor): add list-panel with domain groups, search, progress"
```

---

### Task 3: Properties Panel (Centre Pane)

**Files:**
- Create: `src/features/unified-editor/props-panel.js`

The centre pane: system properties form with labelled sections.

- [ ] **Step 1: Create props-panel.js**

Imports: `SCHEMA_DEFINITIONS` for field descriptions/enums, `LGA_FUNCTIONS` for function autocomplete, smart-inputs for rendering helpers.

Exports:
- `renderPropsPanel(system, editorState)` — returns HTML for the selected system's properties. Sections: Identity (name, vendor, users, functions, ERP), Contract & Cost (annual cost, end date, notice), Technical Profile (hosting, partitioning, portability, support model).
- `wirePropsPanel(container, options)` — attaches events. Options: `{ onChange(nodeIdx, field, value), onFunctionAdd(nodeIdx, lgaId), onFunctionRemove(nodeIdx, lgaId) }`.

Field rendering:
- System Name: input, 200px width
- Vendor: input, 120px width
- Users: input with thousands formatting (via smart-inputs)
- Functions: chips with × to remove + autocomplete datalist + add link
- Annual Cost: input with £ + thousands formatting
- Contract End: input, mm/yyyy, 80px
- Notice: input, 40px, "months" hint
- Hosting/Partitioning/Portability: radio groups (via smart-inputs `renderRadioGroup`)
- Support Model: dropdown
- All technical fields include inline hint text from SCHEMA_DEFINITIONS

- [ ] **Step 2: Run build**

Run: `node build.js`
Expected: Success

- [ ] **Step 3: Commit**

```bash
git add src/features/unified-editor/props-panel.js
git commit -m "feat(editor): add props-panel with form sections and smart inputs"
```

---

### Task 4: Relationships Panel (Right Pane)

**Files:**
- Create: `src/features/unified-editor/rel-panel.js`

The right pane: capabilities, consuming systems, dependencies, sharing.

- [ ] **Step 1: Create rel-panel.js**

Imports: `LGAM_CAPABILITIES` for pill vocabulary, smart-inputs for chip selector.

Exports:
- `renderRelPanel(system, editorState)` — returns HTML for the selected system's relationships. Sections: Capabilities provided (toggleable pills + custom entry), Systems consuming from this (per-consumer row with capability pill subsets), Depends on (list), Shared with (chip selector).
- `wireRelPanel(container, options)` — attaches events. Options: `{ onCapabilityToggle(nodeIdx, capId, active), onCustomCapability(nodeIdx, capId), onConsumerAdd(nodeIdx, consumerSysId), onConsumerRemove(nodeIdx, consumerSysId), onConsumerCapToggle(nodeIdx, consumerSysId, capId, active), onDependencyAdd(nodeIdx, providerSysId, caps), onDependencyRemove(nodeIdx, edgeIdx), onSharedWithChange(nodeIdx, councils) }`.

Consuming systems section:
- Each consumer is a row with: system name (bold) + × remove button
- Below name: the provider's active capability pills rendered as small toggles (on = consumer uses this cap, off = doesn't)
- "+ add consuming system" link: shows dropdown of other systems in the estate

Empty state: "No relationships defined. Select capabilities above if this system provides services to other systems."

- [ ] **Step 2: Run build**

Run: `node build.js`
Expected: Success

- [ ] **Step 3: Commit**

```bash
git add src/features/unified-editor/rel-panel.js
git commit -m "feat(editor): add rel-panel with capabilities, consumers, dependencies"
```

---

### Task 5: Main Editor Orchestrator

**Files:**
- Create: `src/features/unified-editor/editor.js`

Orchestrates state, renders the three-pane layout, handles mode toggle.

- [ ] **Step 1: Create editor.js**

Exports:
- `renderUnifiedEditor(json, options)` — returns HTML for the full editor. Options: `{ source: 'scratch'|'edit'|'validator', title? }`.
- `wireUnifiedEditor(container, json, options)` — manages `editorState`, wires all three panels + mode toggle + back/save/export buttons. Options: `{ onSave(data), onBack(), source }`.

State management:
- `editorState` = deep clone of input JSON (ensured to have `.nodes`, `.edges`, `.councilMetadata`)
- Selected system index tracked in local state
- All panel change callbacks update `editorState` and re-render affected panels

Layout HTML:
- Header: title + mode toggle [Focus|Bulk] + action buttons (Back, Save/Apply, Export JSON)
- Three-pane grid (Focus mode): 230px | 1fr | 280px
- Re-renders list panel when systems change (add/remove/regroup)
- Re-renders props panel when selected system changes or its fields update
- Re-renders rel panel when selected system changes or edges/capabilities change

- [ ] **Step 2: Run build**

Run: `node build.js`
Expected: Success

- [ ] **Step 3: Commit**

```bash
git add src/features/unified-editor/editor.js
git commit -m "feat(editor): add main orchestrator with three-pane layout and state management"
```

---

### Task 6: Bulk Mode

**Files:**
- Create: `src/features/unified-editor/bulk-mode.js`

Table view with pinned columns and column group tabs.

- [ ] **Step 1: Create bulk-mode.js**

Exports:
- `renderBulkMode(editorState)` — returns HTML for the bulk table view with column group tabs.
- `wireBulkMode(container, editorState, options)` — attaches events. Options: `{ onChange(nodeIdx, field, value) }`.

Structure:
- Tab bar: "Contract & Cost" | "Technical" | "Relationships"
- Table with sticky header row
- Pinned columns (sticky left): System Name, Vendor, Function — always visible
- Column group determines remaining editable columns:
  - Contract & Cost: Annual Cost, Contract End, Notice Period
  - Technical: Hosting (dropdown), Partitioning (dropdown), Portability (dropdown), Support Model (dropdown)
  - Relationships: Shared With, Capabilities (comma text), Depends On (text)
- Status column (✓/⚠/✗) pinned right
- Values use thousands formatting for cost fields

- [ ] **Step 2: Run build**

Run: `node build.js`
Expected: Success

- [ ] **Step 3: Commit**

```bash
git add src/features/unified-editor/bulk-mode.js
git commit -m "feat(editor): add bulk-mode table with pinned columns and column groups"
```

---

### Task 7: Wizard Onboarding

**Files:**
- Create: `src/features/unified-editor/wizard.js`

Short onboarding flow for Build from Scratch.

- [ ] **Step 1: Create wizard.js**

Exports:
- `renderWizard(step)` — returns HTML for the current wizard step.
- `wireWizard(container, options)` — attaches events. Options: `{ onComplete(data), onSkip() }`.

Steps:
1. **Council Info**: name input, tier dropdown, distress toggle. "Next" button.
2. **First System**: card-style form with full explanations per field (reuses props-panel section structure but with more guidance text). "Add to editor" or "Skip — go to editor".

On complete: passes `{ councilName, councilMetadata, nodes: [...], edges: [...] }` to callback.
On skip: passes `{ councilName: '', councilMetadata: {}, nodes: [], edges: [] }`.

- [ ] **Step 2: Run build**

Run: `node build.js`
Expected: Success

- [ ] **Step 3: Commit**

```bash
git add src/features/unified-editor/wizard.js
git commit -m "feat(editor): add wizard onboarding for Build from Scratch"
```

---

### Task 8: Integration into main.js + index.html

**Files:**
- Modify: `src/main.js` (replace arch-editor and pre-import-editor references)
- Modify: `src/index.html` (remove modal HTML, update button wiring)
- Remove: `src/features/arch-editor.js`
- Remove: `src/features/pre-import-editor.js`

- [ ] **Step 1: Wire unified editor into all entry points**

In `src/main.js`:
- Replace `import { ... } from './features/arch-editor.js'` with `import { renderUnifiedEditor, wireUnifiedEditor } from './features/unified-editor/editor.js'`
- Replace `import { renderPreImportEditor, wirePreImportEditor, ... } from './features/pre-import-editor.js'` with the unified editor import
- Import wizard: `import { renderWizard, wireWizard } from './features/unified-editor/wizard.js'`

Update each entry point:
- "Edit Architecture" buttons → call `openUnifiedEditor(uploadIdx, 'edit')`
- "Open in Editor" from validator → call `openUnifiedEditor(validatedJson, 'validator')`
- "Build from Scratch" button → call `openWizardFlow()`

`openUnifiedEditor(dataOrIdx, source)`:
- Hides Stage 1 content (same pattern as current validator)
- Renders editor in `#validatorContainer` (reuse the container)
- Wires with `onSave` that updates `state.rawUploads` and returns to Stage 1
- Wires with `onBack` that returns to previous context

`openWizardFlow()`:
- Renders wizard, on complete transitions to `openUnifiedEditor(wizardData, 'scratch')`

- [ ] **Step 2: Remove old modal HTML from index.html**

Remove the `#architectureEditorModal` div and all its contents.

- [ ] **Step 3: Remove old files**

Delete `src/features/arch-editor.js` and `src/features/pre-import-editor.js`.

- [ ] **Step 4: Run tests and build**

Run: `npm test && node build.js`
Expected: All tests pass, build succeeds. (Property tests for template-converter and schema-validator are unaffected. The pre-import-editor had no tests.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(editor): integrate unified editor, remove modal and pre-import editor"
```

---

### Task 9: Dependency Matrix

**Files:**
- Create: `src/features/unified-editor/dep-matrix.js`

Estate-wide dependency visualisation (read-only).

- [ ] **Step 1: Create dep-matrix.js**

Exports:
- `renderDepMatrix(editorState)` — returns HTML for the full-page matrix view.
- `wireDepMatrix(container, options)` — attaches events. Options: `{ onBack(), onJumpToSystem(nodeIdx) }`.

Matrix structure:
- Provider systems as column headers (only systems with `capabilityType` set)
- Consumer systems as row headers (only systems that are source in a CONSUMES_CAPABILITY edge)
- Cell content: capability names at intersection, colour intensity based on count
- "Edit" link per cell → calls `onJumpToSystem` for the consumer
- Back button returns to editor

- [ ] **Step 2: Run build**

Run: `node build.js`
Expected: Success

- [ ] **Step 3: Commit**

```bash
git add src/features/unified-editor/dep-matrix.js
git commit -m "feat(editor): add dependency matrix heatmap visualisation"
```

---

### Task 10: Browser Verification + Cleanup

**Files:** None (testing only) + final dist build

- [ ] **Step 1: Serve and test all entry points**

Start: `python3 -m http.server 8765`

Test each flow:
1. Upload JSON → "Edit Architecture" → unified editor opens in Focus mode
2. Validator → "Open in Editor" → unified editor opens
3. "Build from Scratch" → wizard → transitions to editor
4. Toggle Focus ↔ Bulk mode
5. Add/remove systems, edit properties, toggle capabilities
6. Dependency relationships: add consumer, toggle caps
7. Export JSON → verify output is valid
8. Save/Apply → verify data persists in staged files
9. "View dependency matrix" action

- [ ] **Step 2: Final build and commit**

```bash
node build.js
git add dist/
git commit -m "build: include unified editor in dist output"
```
