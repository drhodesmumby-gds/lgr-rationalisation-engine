# Sprint 5: Architecture JSON Visual Editor + Export

## Scope

Add a visual editor for viewing, editing, and exporting council architecture JSON files. Users should be able to modify uploaded architectures without hand-editing JSON — add/remove/edit nodes and edges, then export the result.

## Acceptance Criteria

### AC-1: Editor modal/panel UI

- [ ] New "Edit Architecture" button appears in Stage 1 (Ingest) next to each staged file, and accessible from Stage 2 header.
- [ ] Clicking opens a full-screen modal or panel showing the architecture data in an editable form.
- [ ] Modal follows existing GDS modal pattern (blue top border, close button, scrollable).
- [ ] Editor shows council name and metadata at the top (editable).

### AC-2: Node editor — Functions

- [ ] All Function nodes displayed in a list/table with columns: ID, Label, lgaFunctionId.
- [ ] Each Function node is editable (label, lgaFunctionId) via inline editing or edit row.
- [ ] "Add Function" button creates a new Function node with generated ID.
- [ ] "Remove" button on each Function node removes it (with confirmation if edges reference it).
- [ ] lgaFunctionId field has autocomplete/validation against the LGA_FUNCTIONS taxonomy.

### AC-3: Node editor — IT Systems

- [ ] All ITSystem nodes displayed in a list/table with columns: Label, Vendor, Users, Cost, Contract dates, Portability, etc.
- [ ] Each field is editable via inline editing or edit form.
- [ ] All ITSystem properties supported: label, users, vendor, cost, annualCost, endYear, endMonth, noticePeriod, portability (dropdown: High/Medium/Low), dataPartitioning (dropdown: Segmented/Monolithic), isCloud (toggle), isERP (toggle), sharedWith (multi-value), owner.
- [ ] "Add System" button creates a new ITSystem node.
- [ ] "Remove System" button removes the node and its edges.

### AC-4: Edge editor

- [ ] REALIZES edges displayed showing which systems realize which functions.
- [ ] Visual indicator (e.g. table or connection lines) showing system → function mappings.
- [ ] "Add Edge" — select a system and a function to connect them.
- [ ] "Remove Edge" button on each edge.

### AC-5: Export to JSON

- [ ] "Export JSON" button in the editor generates a valid council JSON file matching the schema in CLAUDE.md.
- [ ] Exported JSON includes councilName, councilMetadata, nodes, edges.
- [ ] Downloads as `{councilName}.json` file.
- [ ] Exported JSON is re-importable into the tool.

### AC-6: Apply changes to session

- [ ] "Apply Changes" button updates the `rawUploads[]` entry for the edited council.
- [ ] If on Stage 2+, re-triggers baselining with the updated data.
- [ ] Visual confirmation that changes have been applied.

### AC-7: Regression

- [ ] All 41 existing property tests pass.
- [ ] Zero JS console errors.
- [ ] Existing upload, baseline, and dashboard flows unaffected.

## Implementation Notes

### Modal pattern
Follow `#analysisModal` pattern: fixed overlay, centered white panel, border-t-8 border-[#1d70b8], close button, scrollable content.

### Data binding
The editor should read from and write to the `rawUploads[]` array entry for the selected council. Each upload entry has `{ filename, data }` where `data` is the parsed JSON object.

### LGA Function autocomplete
Use the existing `LGA_FUNCTIONS` const array (176 entries) for autocomplete/validation on the lgaFunctionId field.

### Form layout
Use tabs or sections: "Council Info" | "Functions" | "IT Systems" | "Edges"

## Key Locations

- `rawUploads[]`: state variable ~line 296
- `LGA_FUNCTIONS`: embedded const with all 176 ESD entries
- Schema: CLAUDE.md JSON schema section
- Stage 1 HTML: lines 100-115
- `runBaselining()`: line 712+ (re-trigger after apply)

## Test Plan

1. All 41 property tests pass
2. Upload a JSON file → click "Edit Architecture" → verify all nodes/edges displayed
3. Edit a system's vendor → Apply → verify change appears in dashboard
4. Add a new Function node → add REALIZES edge → Apply → verify in baseline
5. Remove a system → Apply → verify it disappears from dashboard
6. Export JSON → re-import the exported file → verify identical results
7. Demo loader data → edit → verify no errors
