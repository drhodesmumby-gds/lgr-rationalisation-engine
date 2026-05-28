# Decision Panel Redesign — Successor-First Allocation

## Summary

Replace the current two-axis decision model (System Choice × Operating Model Boundary) with a **successor-first allocation** model where users directly specify what system serves each successor, and the operating model (shared service, independent, disaggregate) is **derived** from the combination of choices.

The panel uses progressive disclosure: simple cases show familiar successor cards; complex multi-function/cross-boundary systems reveal a function navigator and sharing grid.

## Problems Addressed

1. **Cost split misplacement** — currently lives on the system card (Pane 1 informational context) but is actually an outcome of the boundary decision.
2. **"No boundary change — operate within single successor"** — semantically wrong for systems from partial predecessors that already cross boundaries.
3. **Two-axis redundancy** — "Procure replacement (each gets their own)" in Axis 1 is identical to "Independent per successor" in Axis 2.
4. **No way to create multi-function systems** — can disaggregate existing multi-function ERPs but cannot assign a new/existing system to serve additional functions.
5. **Cross-successor visibility** — decisions are made per-successor without seeing what the other successor needs or has decided.

## Design Principles

- **Successor-first**: the user answers "what serves each successor?" not "which system?" then "what boundary?"
- **Operating model is derived**: shared service, disaggregate, independent are inferred from choices, not selected as abstract concepts.
- **Progressive disclosure**: simple cases stay simple; complexity only appears when warranted.
- **Same card pattern in both states**: successor cards with dropdowns are the interaction pattern for system selection in both simple and expanded views.
- **Grid for sharing only**: the checkbox grid shows who participates in what — it does not handle system selection.

## Layout: Three-Pane

| Pane | Simple (State 1) | Expanded (State 2) |
|---|---|---|
| **Pane 1 — Context** | System comparison cards | System info card + function navigator |
| **Pane 2 — Allocation** | Successor cards + "Share with..." toggle | Successor cards for selected function + sharing grid below |
| **Pane 3 — Cost & Impact** | Cost split, decommissions, obligations, rationale | Same, plus transition vs ongoing cost separation, SAP decommission tracker |

## State 1: Simple Case

**Entry:** Matrix cell click — opens for a (function, successor) pair, same as today.

**When:** Single-function system, no ERP, no partial predecessor, no existing shared service.

### Pane 1 — Competing Systems
- System comparison cards with metadata (vendor, cost, users, contract dates, hosting, portability, vesting zone badges).
- Visual highlight on the system selected in the dropdown (Pane 2).

### Pane 2 — Allocation
- One **successor card** per successor authority, each with a dropdown:
  - Options: each competing system (with source council), "Procure new system", "Defer — decide post-vesting"
  - When "Procure new" selected: inline detail form (system name, vendor, annual cost, hosting)
- **"Share with..." toggle**: appears within the primary successor's card after selecting a system. Checkboxes for other successors. Checking one links their card — it becomes read-only/secondary showing the shared system and an "Unlink" escape.
- **Derived label**: shown below cards — "Shared service: Xero Finance (both successors)" or "Independent: different systems per successor".
- **Escalation link**: "Assign [system] to additional functions" — transitions to State 2.

### Pane 3 — Cost & Impact
- **Cost split** (system-level): shown when shared service is established. One % input per successor with auto-calculated £ amounts. Shortcuts: "Auto-weight by users", "Equal", "Auto-weight by functions".
- **Decommissions**: list of systems that will be decommissioned by this decision with annual cost saved.
- **Obligations**: migration tasks and governance obligations generated.
- **Rationale** (optional): free-text textarea for justification. Persisted in FunctionDecision model.

## State 2: Expanded (Multi-Function / Cross-Boundary)

**Entry:** "Expand scope" clicked from State 1, or panel opens directly for a system detected as complex (ERP, partial predecessor, or sharedWith array present).

**When:** System serves multiple functions, or crosses successor boundaries via partial predecessor allocation.

### Pane 1 — System + Function Navigator
- **System card**: compact metadata view (badges, vendor, contract end, notes).
- **Function list**: clickable rows for each function the system serves. Each shows status badge:
  - "Shared ✓" — resolved as shared service
  - "Editing" — currently selected
  - "Pending" — not yet configured
  - "Resolved via [function]" — auto-resolved by multi-function assignment
- Clicking a function loads its allocation into Pane 2.
- **ERP decommission note**: "SAP decommissioned when all N functions resolved away."

### Pane 2 — Allocation + Sharing Grid
- **Successor cards** (top): identical to State 1 — one per successor with dropdown, share toggle, procurement detail form when applicable. These show the allocation for the **currently selected function** from Pane 1.
- **Sharing grid** (bottom): a compact checkbox table showing the sharing picture across **all functions**.
  - Columns: one per function the system serves, plus a "+ Func" button to add new function columns from the LGA taxonomy.
  - Rows: one per successor. Primary row is always checked (disabled). Other rows have checkable boxes.
  - Column headers show the function name and the system assigned (e.g. "Finance (SAP)", "HR (Workday)").
  - Pending functions show disabled/greyed checkboxes.
  - Grid syncs bidirectionally with the "Share with..." toggle in the cards above.
  - Legend: "Greyed = primary · Checked = shared participant · Disabled = pending"

### "+ Function" Button
- Opens a typeahead/dropdown filtered to LGA taxonomy functions not already in the grid.
- Adding a function creates a new column — primary row auto-checked, participant rows start unchecked.
- The newly added function is auto-resolved: it uses the same system as the function it was added from (the currently selected function in Pane 1).
- Creates REALIZES edges from the system → the new function.
- Status in Pane 1 shows "Resolved via [function]".
- Sharing for the new function is configured independently via the grid or by navigating to it.

### Pane 3 — Cost & Impact
- **Transition cost**: the old system's costs shared during migration. System-level split with % per successor and auto-weight shortcuts.
- **Ongoing cost**: the new/retained system's shared service cost. Separate section when a new shared service is established.
- **Obligations**: data migration, procurement, shared governance — listed with colour-coded severity dots.
- **SAP decommission status**: per-function resolution tracker (✓/○) with summary ("2 of 3 resolved — not yet decommissioned").
- **Rationale** (optional): same textarea as State 1.

## Sharing Semantics

### Linked vs coincidentally-same
- Two successors selecting the same system without linking = **coincidentally same** (implies separate instances, possible disaggregation, no shared governance).
- Two successors linked via "Share with..." = **genuine shared service** (governance obligations generated, cost split applies, changes propagate).

### Sharing is per-function
- Multi-function assignment ("Also assign Workday to Procurement") sets what the **primary successor** uses.
- Sharing is configured per-function — Ivy Hatherley might share Workday for HR but not for Procurement.
- The sharing grid makes this visible across all functions at once.

## Cost Splitting

- **System-level**: one percentage per successor for the entire system contract. Editable inputs.
- **Smart defaults**: "Auto-weight by functions" (proportional to how many functions each successor uses), "Equal" (even split), "Auto-weight by users" (proportional to user counts).
- **Two cost types** when relevant:
  - *Transition cost* — old system costs shared during migration (temporary, ends when migration completes)
  - *Ongoing cost* — new/retained system's shared service cost (permanent, post-transition)
- Cost split is shown in Pane 3, not on system cards or in the allocation section.

## Decision Rationale

- Optional free-text field in Pane 3 below obligations.
- Persisted as a new `rationale` field on the `FunctionDecision` model.
- Optional `decidedBy` field (string — person or governance body).
- Exported in scenario JSON and shown in persona-tailored reports.

## Transition Between States

| Trigger | Direction |
|---|---|
| "Assign to additional functions" link | State 1 → State 2 |
| "Expand scope" banner (shown when system is multi-function or cross-boundary) | State 1 → State 2 |
| Panel opens for ERP, partial predecessor, or sharedWith system | Direct to State 2 |
| (No backward transition needed — State 2 is a superset) | — |

## Bulk Decisions (Separate Feature)

Not part of this modal redesign. Bulk decisions ("defer all Tier 3", "choose same system across domain") will be a separate entry point from the matrix toolbar. Shares the successor-first mental model but is a fundamentally different workflow — selecting across the matrix, not drilling into one system.

## Data Model Changes

### FunctionDecision (extended)

```javascript
{
  // Existing fields...
  functionId, successorName, timestamp,
  systemChoice, retainedSystemIds, procuredSystem,
  boundaryChoice, disaggregationSplits, sharedWithSuccessors,
  sharedServiceOrigin, contractExtensions,
  
  // New fields
  rationale: String|null,           // Free-text justification
  decidedBy: String|null,           // Person or governance body
  resolvedVia: String|null,         // functionId if auto-resolved by multi-function assignment
  assignedFunctions: String[]|null  // Additional function IDs this system was assigned to (on the originating decision only)
}
```

### boundaryChoice (backward compatibility)

The existing `boundaryChoice` field is **retained** but **auto-derived** by the UI from the successor allocation state:
- Both successors select the same system AND are linked → `'maintain-shared'` or `'establish-shared'`
- One successor selects "Keep SAP", the other does not, linked → `'establish-shared'`
- Both select same system, NOT linked → `'disaggregate'` (implies separate instances)
- Only one successor is relevant (no cross-boundary) → `'none'`

The projector continues to read `boundaryChoice` unchanged. The UI writes it automatically from the derived state — users never see or select it directly.

### State additions

```javascript
state.costSplitOverrides  // Already exists — per-system cost split percentages
// No new top-level state needed; sharing links are expressed via sharedWithSuccessors + sharedServiceOrigin
```

## Backlog Items Addressed

| Item | Resolution |
|---|---|
| Cost split placement & intent | Moved to Pane 3; semantically tied to sharing/transition decisions |
| "No boundary change" label | Eliminated — no abstract boundary selection exists |
| Cross-successor visibility | Both successors visible simultaneously in successor cards |
| Per-successor metrics | Cost & Impact pane shows per-successor breakdown |
| Multi-function system creation | "+ Func" in grid + multi-function assignment |
| Decision rationale (roadmap) | Text field + decidedBy in Pane 3 |
| Bulk decisions (backlog #1) | Separate feature, not this modal |

## Out of Scope

- Capability system handling (blast radius, CONSUMES_CAPABILITY) — preserved from current implementation, not redesigned.
- Cross-successor decommission preview — preserved as-is.
- Propagated shared-service read-only view — preserved as-is.
- ERP impact section — preserved; shown below allocation in State 2 when system is ERP.
- Bulk decisions toolbar — separate spec.

## Mockups

Visual mockups are saved in `.superpowers/brainstorm/6265-1779915563/content/`:
- `final-design-v2.html` — the approved final design showing both states
- `sharing-granularity-options.html` — the sharing grid concept exploration
- `concept-b-sharing.html` — the "Share with..." linking mechanism
- `concept-b-successor-first.html` — the successor-first allocation concept
