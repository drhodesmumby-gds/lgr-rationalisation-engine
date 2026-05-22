# Unified Architecture Editor — Design Spec

## Problem

Three separate editing experiences exist for architecture data (Build from Scratch wizard, Edit Architecture modal, Pre-import editor from validator). They have different interaction patterns, inconsistent fields, and different UX quality levels. The modal is space-constrained with undiscoverable horizontal scroll. The wizard doesn't scale past a few systems. The pre-import editor is the best but isn't reused elsewhere.

## Solution

One unified editor component used across all entry points:
- "Build from Scratch" → wizard onboarding → transitions into editor
- "Edit Architecture" after import → editor directly
- "Open in Editor" from validator → editor with validated data

The editor uses a **three-pane layout** (list | properties | relationships) in **Focus mode** (default), with a **Bulk mode** toggle for spreadsheet-density editing.

---

## Layout: Three-Pane Focus Mode

```
┌─────────────────┬───────────────────────────┬─────────────────────────┐
│  SYSTEM LIST    │  SYSTEM PROPERTIES        │  CAPABILITIES &         │
│                 │                           │  RELATIONSHIPS          │
│  Domain-grouped │  Identity                 │                         │
│  with tinted    │  Contract & Cost          │  Capabilities provided  │
│  headers        │  Technical Profile        │  Consuming systems      │
│                 │                           │  Depends on             │
│  Search/filter  │  (facts about THIS        │  Shared with            │
│  Progress bar   │   system)                 │                         │
│  + Add          │                           │  (how it connects to    │
│                 │                           │   OTHER systems)        │
└─────────────────┴───────────────────────────┴─────────────────────────┘
```

### Left Pane: System List

- **Domain-grouped** with collapsible sections, each with a distinct tinted background:
  - Administration & Government → blue tint
  - Health & Social Care → green tint
  - Environmental Protection → orange tint
  - Transport & Highways → cyan tint
  - Housing → purple tint
  - Platform / Infrastructure → grey tint (systems with no function)
- **Sticky header** with: system count, search input, filter dropdown (All / Incomplete / Has issues), + Add button
- **Progress bar** below header: "10/14 complete — 71%"
- **Each list item** shows: system name (bold), vendor + function (grey subtext), completeness status (✓ / ⚠ N / ✗ N)
- **Active item** highlighted with blue left border
- **Platform/infrastructure systems** (no REALIZES edge) grouped separately at bottom

### Centre Pane: System Properties

Labelled sections on a single scrollable panel. All fields visible without tabs.

**Header**: System name as title, vendor + users + cost as subtitle line.

**Section: Identity**
- System Name (200px), Vendor (120px), Users (70px, thousands-formatted)
- Functions served: chips with × to remove each, + add (with ESD autocomplete datalist). Remove all = marks as platform/infrastructure.
- ERP checkbox: "This is an ERP system"

**Section: Contract & Cost**
- Annual Cost (120px, auto-formatted with £ and thousands separators)
- Contract End (80px, mm/yyyy single field)
- Notice period (40px, "months" hint)

**Section: Technical Profile**
- Hosting: radio (Cloud / On-prem)
- Data Partitioning: radio (Segmented / Monolithic) + inline hint
- Portability: radio (High / Med / Low) + inline hint
- Support Model: dropdown (Vendor-supported / Community-supported / Unsupported) + hint

**Inline guidance**: Technical terms have brief explanations directly below them:
- Data Partitioning: "Segmented = data can be split cleanly. Monolithic = entangled, needs ETL."
- Portability: "High = open APIs, standard exports. Low = proprietary, vendor lock-in."
- Support Model: "Who maintains this going forward?"

### Right Pane: Capabilities & Relationships

**Section: Capabilities this system provides**
- Toggleable pills from LGAM vocabulary (click to activate/deactivate)
- Custom capability entry: text input + "+" button
- Active pills shown solid/filled, inactive pills shown bordered with hover highlight
- Label includes "(click to toggle)" affordance hint

**Section: Systems consuming from this**
- One row per consuming system
- Each row shows: system name (bold) + × to remove
- Below the name: the provider's active capability pills shown as small toggles — activated for whichever capabilities that consumer uses
- "+ add consuming system" link at bottom → opens system dropdown
- This section only appears if capabilities are defined above

**Section: This system depends on**
- List of provider systems with their capability tags
- "+ add dependency" → pick system + tick which of ITS capabilities this system consumes

**Section: Shared with**
- Chip/tag selector with autocomplete from councils in the programme
- × to remove each

**Empty state**: When no capabilities are defined and no dependencies exist, show: "No relationships defined. Select capabilities above if this system provides services to other systems."

---

## Bulk Mode (Toggle)

Toggle button in the header: [Focus] [Bulk]

Table layout with:
- **Pinned columns** (always visible, sticky left): System Name, Vendor, Function
- **Column group tabs**: Contract & Cost | Technical | Relationships
- Switching tabs swaps the editable columns (same data, different field groups)
- Status column (✓/⚠/✗) always visible on the right
- Thousands-formatted cost, mm/yyyy dates
- All systems in one flat table (no domain grouping — bulk is for scanning all)

---

## Onboarding: Build from Scratch

A short wizard that teaches the schema, then transitions into the editor.

**Step 1: Council Info** (30 seconds)
- Council name, tier dropdown, financial distress toggle
- "Next" proceeds to Step 2

**Step 2: Your First System** (2-3 minutes)
- Card-style form (like existing Build from Scratch UI) with full field explanations
- Fills in one system with maximum guidance
- Explains each field in context
- "Add another" or "Continue to editor"

**Step 3: Editor** (ongoing)
- Transitions to the three-pane Focus mode with the data entered so far
- "Skip wizard" available at any point — drops directly into editor with empty state

**Empty state** in editor: "No systems added yet. Click + Add to enter your first system, or use the wizard for guided entry."

---

## Dependency Matrix (Estate-wide view)

A separate action accessible from the editor toolbar: "View dependency matrix"

Opens a full-page view showing:
- Provider systems as columns
- Consumer systems as rows
- Capabilities at intersections (heatmap — colour intensity = number of capabilities)
- Helps identify: "everything depends on SAP" patterns

Not editable directly — read-only visualisation. "Edit" link per cell jumps back to the relevant system in Focus mode.

---

## Smart Input Behaviours

- **Users / Annual Cost**: display with thousands separators (7,000 / £2,300,000). Strip formatting on focus for raw editing. Re-format on blur.
- **Contract End**: single mm/yyyy input. Validates month 1-12, year 2020-2040.
- **Shared With**: chip selector with autocomplete from other councils in `state.rawUploads` (council names already uploaded). Free text fallback for councils not yet in the system.
- **Functions**: ESD autocomplete datalist (176 entries). Shows "ID — Label" format. Multiple allowed. × to remove each.
- **Capabilities provided**: clickable pill toggles from LGAM vocabulary + custom entry. Each pill has clear active (filled) vs inactive (bordered) states.

---

## Navigation & Context

- **Entry points** all route to the same component:
  - "Build from Scratch" → wizard → editor (with `state.archEditorState.source = 'scratch'`)
  - "Edit Architecture" → editor (with `state.archEditorState.source = 'edit', uploadIdx`)
  - "Open in Editor" from validator → editor (with `state.archEditorState.source = 'validator'`)
- **Full-page view** — replaces Stage 1 content (not a modal). Back navigation returns to previous context.
- **Save/Apply**: depends on source. Edit → updates `state.rawUploads[idx]`. Validator/Scratch → creates new entry in `state.rawUploads`.
- **Export JSON**: always available — downloads the current state as formatted JSON.

---

## Replaces

This unified editor replaces:
- `src/features/arch-editor.js` (modal) — removed entirely
- `src/features/pre-import-editor.js` (full-page) — replaced by this component
- The "Build from Scratch" wizard in `src/features/import-wizard.js` — replaced by the onboarding flow

The architecture editor modal (`#architectureEditorModal` in index.html) is removed.

---

## File Structure

| File | Purpose |
|---|---|
| `src/features/unified-editor/editor.js` | Main component: three-pane layout, mode toggle, state management |
| `src/features/unified-editor/list-panel.js` | System list with domain groups, search, progress |
| `src/features/unified-editor/props-panel.js` | Centre pane: system properties form |
| `src/features/unified-editor/rel-panel.js` | Right pane: capabilities & relationships |
| `src/features/unified-editor/bulk-mode.js` | Bulk table view |
| `src/features/unified-editor/wizard.js` | Onboarding wizard (Steps 1-2) |
| `src/features/unified-editor/dep-matrix.js` | Dependency matrix visualisation |
| `src/features/unified-editor/smart-inputs.js` | Shared input behaviours (formatting, autocomplete, chips) |

---

## Constraints

- Full-page view (not modal) — no horizontal scroll in Focus mode
- Sticky list header + sticky column headers in Bulk mode
- Three panes resize gracefully — on narrow screens, right pane collapses below centre
- All data lives in a single `editorState` object (deep clone of architecture JSON)
- Changes are not persisted until explicit Save/Apply action
- Must handle 50+ systems without performance degradation
- Inline guidance text must come from `SCHEMA_DEFINITIONS` (single source of truth for field descriptions)
