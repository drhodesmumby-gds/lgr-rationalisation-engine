---
title: Editor Internals
order: 5
section: technical
---

# Editor Internals

The Unified Architecture Editor is the tool's data entry interface - a full-screen modal with two editing modes (Focus and Bulk), a dependency matrix view, and an onboarding wizard. This page covers its internal architecture.

## Module Structure

```
src/features/unified-editor/
├── editor.js         # Orchestrator: renderUnifiedEditor + wireUnifiedEditor
├── list-panel.js     # Left pane: domain-grouped system list with search
├── props-panel.js    # Centre pane: property editor for the selected node
├── rel-panel.js      # Right pane: relationships, capabilities, dependencies
├── bulk-mode.js      # Full-width tabular editing with column-group tabs
├── dep-matrix.js     # Read-only heatmap of CONSUMES_CAPABILITY edges
├── smart-inputs.js   # Shared input utilities (formatting, chips, pills, radios)
└── wizard.js         # Step-by-step onboarding for building from scratch
```

## Three-Pane Layout (Focus Mode)

The editor uses a CSS Grid layout with fixed column widths:

```html
<div style="grid-template-columns: 230px 1fr 280px;">
    <div id="ue-list-panel">...</div>    <!-- Left: system list -->
    <div id="ue-props-panel">...</div>   <!-- Centre: property editor -->
    <div id="ue-rel-panel">...</div>     <!-- Right: relationships -->
</div>
```

### List Panel (`list-panel.js`)

Renders a domain-grouped list of ITSystem nodes:

```javascript
export function renderListPanel(editorState, { selectedIdx, searchQuery }) {
    // Groups systems by ESD root category (via getRootCategoryId)
    // Shows per-system completeness progress (key fields filled / total)
    // Highlights the selected system
    // Supports text search filtering
}
```

Key fields tracked for completeness: `vendor`, `annualCost`, `endYear`, `portability`, `dataPartitioning`, `hosting`, `supportModel`.

### Properties Panel (`props-panel.js`)

Renders field editors for the currently selected system node. Field types include text inputs, dropdowns, number inputs with formatting, boolean toggles, and chip selectors.

### Relationships Panel (`rel-panel.js`)

Manages three categories of relationships for the selected system:
1. **REALIZES edges** - which Functions this system serves
2. **Capability provider** - what capabilities this system offers (`capabilityType`)
3. **CONSUMES_CAPABILITY edges** - which systems this one depends on for capabilities

## State Management

### editorState Deep Clone

On editor open, the architecture JSON is deep-cloned via `structuredClone()`:

```javascript
export function wireUnifiedEditor(container, json, options = {}) {
    const editorState = structuredClone(json || {});
    if (!editorState.nodes) editorState.nodes = [];
    if (!editorState.edges) editorState.edges = [];
    if (!editorState.councilMetadata) editorState.councilMetadata = {};
    // ...
}
```

This means edits are non-destructive until the user clicks "Save". The original data is never mutated. If the user clicks "Back", all changes are discarded.

### Local Closure State

The editor maintains additional state within the `wireUnifiedEditor` closure:

```javascript
let selectedIdx = null;    // Index into editorState.nodes for the selected system
let mode = 'focus';        // 'focus' | 'bulk'
let searchQuery = '';      // Current search filter text
```

### Bulk Mode State

Bulk mode adds transient state properties to `editorState`:

```javascript
editorState._bulkActiveTab = 'contract';   // 'contract' | 'technical' | 'relationships'
editorState._bulkFilters = {};              // Column filters
editorState._bulkSort = null;              // { field, direction } or null
```

These underscore-prefixed properties are ephemeral (not saved with the architecture data).

## Re-render Strategy

The editor uses selective panel re-rendering to avoid full-page reflows. Each panel has its own render + wire cycle:

```javascript
function rerenderList() {
    const html = renderListPanel(editorState, { selectedIdx, searchQuery });
    renderPanel(listPanelEl, html);
    wireListPanel(listPanelEl, { onSelect, onAdd, onSearch });
}

function rerenderProps() {
    const system = selectedIdx != null ? editorState.nodes[selectedIdx] : null;
    const html = renderPropsPanel(system, editorState);
    renderPanel(propsPanelEl, html);
    wirePropsPanel(propsPanelEl, { onChange, onFunctionAdd, onFunctionRemove, onDelete });
}

function rerenderRel() {
    const system = selectedIdx != null ? editorState.nodes[selectedIdx] : null;
    const html = renderRelPanel(system, editorState);
    renderPanel(relPanelEl, html);
    wireRelPanel(relPanelEl, { onCapabilityToggle, onConsumerAdd, ... });
}
```

### When Each Panel Re-renders

| Event | List | Props | Rel |
|---|---|---|---|
| Select a system | Yes (highlight) | Yes (new data) | Yes (new data) |
| Edit a field value | No | No (in-place) | No |
| Add/remove function | No | Yes | Yes |
| Add a new system | Yes | Yes | Yes |
| Delete a system | Yes | Yes | Yes |
| Search query change | Yes | No | No |
| Mode switch (Focus/Bulk) | N/A (containers toggled) | N/A | N/A |

The `renderPanel(el, html)` helper is simple `innerHTML` assignment:

```javascript
function renderPanel(panelEl, html) {
    if (!panelEl) return;
    panelEl.innerHTML = html;
}
```

After setting innerHTML, the corresponding `wire*()` function attaches event listeners to the new DOM elements.

## Bulk Mode (`bulk-mode.js`)

A full-width tabular editing view for modifying multiple systems simultaneously.

### Tab Structure

```javascript
const TABS = [
    { id: 'contract', label: 'Contract & Cost' },
    { id: 'technical', label: 'Technical' },
    { id: 'relationships', label: 'Relationships' }
];
```

Each tab shows different columns. The leftmost columns (system name, vendor) are pinned and always visible.

### Cell Types

The bulk table supports multiple cell rendering types:
- **Text input** - plain text editing
- **Number input** - with formatThousands display
- **Select dropdown** - enum fields (portability, hosting, etc.)
- **Chip cell** - multi-value fields (sharedWith, targetAuthorities)
- **Cap-pills** - capability type toggles
- **Dep-cell** - dependency relationship indicators

### Sorting and Filtering

```javascript
// Sorting: click column header to sort
editorState._bulkSort = { field: 'annualCost', direction: 'desc' };

// Filtering: per-column filters
editorState._bulkFilters = { portability: 'Low', hosting: 'cloud' };
```

Fields in `UNSORTABLE_TYPES` (cap-pills, chip-cell, dep-cell) cannot be sorted.

## Smart Inputs Module (`smart-inputs.js`)

Shared input behaviour utilities used across both Focus and Bulk modes.

### Key Exports

```javascript
// Formatting
export function formatThousands(value, opts = {})  // 1234567 -> "1,234,567"
export function parseThousands(displayStr)          // "£1,234,567" -> 1234567

// Rendering
export function renderChipSelector(options)         // Multi-value tag input
export function renderRadioGroup(options)           // Radio button set

// Event wiring
export function wireSmartInputs(container, callbacks)  // Delegation-based listener setup
```

### Delegation Pattern

Smart inputs use event delegation - a single listener on the container handles all child input events:

```javascript
export function wireSmartInputs(container, callbacks) {
    container.addEventListener('input', (e) => {
        const field = e.target.dataset.field;
        if (!field) return;
        callbacks.onChange(field, e.target.value);
    });
    container.addEventListener('click', (e) => {
        const chipRemove = e.target.closest('[data-chip-remove]');
        if (chipRemove) { /* handle chip removal */ }
    });
}
```

This avoids attaching individual listeners to every input element, which would be expensive when re-rendering the props panel.

## Event Wiring Pattern

All editor sub-modules follow the same render/wire pattern:

```javascript
// 1. Pure render function (returns HTML string)
export function renderXxxPanel(data, options) {
    return `<div>...</div>`;
}

// 2. Imperative wire function (attaches event handlers)
export function wireXxxPanel(container, callbacks) {
    container.addEventListener('click', (e) => {
        const action = e.target.closest('[data-ue-action]');
        if (action) {
            const type = action.dataset.ueAction;
            if (type === 'select') callbacks.onSelect(/* ... */);
        }
    });
}
```

Callbacks flow **up** to the orchestrator (`editor.js`), which holds the authoritative `editorState` and decides which panels to re-render.

## Dependency Matrix (`dep-matrix.js`)

A read-only heatmap showing capability dependency relationships:

```javascript
export function renderDepMatrix(editorState) {
    // Rows: consumer systems (source of CONSUMES_CAPABILITY edges)
    // Columns: provider systems (target of CONSUMES_CAPABILITY edges)
    // Cells: capabilities consumed (from edge.capabilities array)
}
```

Activated via the "Dependencies" button in the editor header. Shows nothing if no CONSUMES_CAPABILITY edges exist.

## Wizard (`wizard.js`)

A 2-step onboarding flow for creating architecture from scratch:

| Step | Content |
|---|---|
| Step 1 | Council name, tier, financial distress flag |
| Step 2 | First IT system (optional): label, vendor, hosting, cost |

```javascript
export function renderWizard(step) {
    if (step === 1) return renderStep1();
    if (step === 2) return renderStep2();
    return '';
}

export function wireWizard(container, { onComplete, onBack }) {
    // Validates inputs, advances steps, calls onComplete with constructed JSON
}
```

The wizard produces a minimal but valid architecture JSON that the editor can then enrich.

## Integration with main.js

The editor is opened as a full-screen overlay from `main.js`:

```javascript
import { renderUnifiedEditor, wireUnifiedEditor } from './features/unified-editor/editor.js';

function openUnifiedEditor(uploadEntry, options = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-50 bg-white';
    overlay.innerHTML = renderUnifiedEditor(uploadEntry.data, {
        title: uploadEntry.data.councilName,
        source: 'edit',
        allUploads: state.rawUploads,
        currentUploadIdx: idx
    });
    document.body.appendChild(overlay);

    const api = wireUnifiedEditor(overlay, uploadEntry.data, {
        onSave: (updatedData) => {
            // Apply changes back to state.rawUploads[idx]
            uploadEntry.data = updatedData;
            overlay.remove();
            renderStage1();
        },
        onBack: () => {
            overlay.remove();  // Discard changes
        }
    });
}
```

### Multi-Council Switching

When multiple uploads exist, the editor header shows a `<select>` dropdown to switch between councils:

```javascript
if (allUploads.length > 1) {
    // Renders a dropdown with all uploaded council names
    // data-ue-action="switch-council" triggers save of current + load of new
}
```

### Return Value

`wireUnifiedEditor()` returns an API object:

```javascript
return {
    getState() { return editorState; },  // Current editor state (for testing)
    destroy() { /* cleanup listeners */ }
};
```

## How to Add a New Editor Field

1. Add the field to the ITSystem schema in `src/constants/schema-definitions.js`
2. Add rendering in `props-panel.js`:
   ```javascript
   // In the appropriate field group section
   html += renderField({ label: 'My Field', name: 'myField', type: 'text', value: system.myField });
   ```
3. Add bulk mode column in `bulk-mode.js` (in the appropriate tab's columns array)
4. Ensure `wirePropsPanel` handles the field change via `onChange` callback
5. If the field affects signals, update `src/analysis/signals.js`
6. Update the `arbITSystem` test generator to include the new field

## How to Add a New Editor Panel Tab

For a new section in Bulk Mode:

1. Add to the `TABS` array in `bulk-mode.js`:
   ```javascript
   { id: 'myTab', label: 'My Tab' }
   ```
2. Define the columns for your tab in the column-rendering logic
3. Add cell type renderers if needed

For an entirely new pane in Focus Mode:

1. Add the pane container in `renderUnifiedEditor()` (editor.js)
2. Create `my-panel.js` with `renderMyPanel()` and `wireMyPanel()`
3. Add the rerender function in `wireUnifiedEditor()`
4. Wire the panel's callbacks back to the orchestrator
