# Sprint 5 Status: Architecture JSON Visual Editor + Export

## Status: COMPLETE

## Test Results
All 41 property tests pass (`npm test` clean).

## What was implemented

### AC-1: Editor modal/panel UI
- "Edit Architecture" button added to each file item in Stage 1 (upload list) — wired directly at creation time
- "Edit Architecture" buttons added to Stage 2 header area via `stage2EditButtons` container (populated in `runBaselining()`)
- Full-screen modal `#architectureEditorModal` with GDS pattern (blue top border `border-t-8 border-[#1d70b8]`, close button, scrollable content area, flex layout)
- Demo loader updated to render per-council edit buttons

### AC-2: Functions tab
- Table with ID (read-only), Label, lgaFunctionId columns
- Inline editing via text inputs
- `<datalist id="lgaFunctionsDatalist">` auto-populated from `LGA_FUNCTIONS` array for autocomplete on lgaFunctionId field
- "Add Function" button creates new Function node with generated UUID-like ID
- "Remove" button per row — prompts confirmation if edges reference the function, then removes both node and its edges

### AC-3: IT Systems tab
- Table with all ITSystem properties: label, vendor, users, cost, annualCost, endYear, endMonth, noticePeriod, portability (dropdown), dataPartitioning (dropdown), isCloud (checkbox), isERP (checkbox), sharedWith (comma-separated), owner
- Each field editable inline
- "Add System" button creates new ITSystem node
- "Remove System" removes node and all referencing edges

### AC-4: Edges tab
- Table showing system label → REALIZES → function label
- "Add Edge" with system and function dropdowns
- Duplicate edge prevention
- "Remove" button per edge

### AC-5: Export JSON
- "Export JSON" button triggers download of `{councilName}.json`
- Output matches CLAUDE.md schema: `{ councilName, councilMetadata, nodes, edges }`
- Undefined/null/empty fields stripped from output

### AC-6: Apply Changes
- "Apply Changes" syncs editor state from current tab, updates `rawUploads[uploadIdx].data`
- Re-runs `runBaselining()` if Stage 2 or Stage 3 is visible
- Re-runs `renderDashboard()` if Stage 3 is visible
- Shows green confirmation message briefly, then closes modal

### Technical notes
- `archEditorState = { uploadIdx, data, activeTab }` module-level variable
- Deep clone on open: `JSON.parse(JSON.stringify(upload.data))`
- Used `wireEditArchBtn(btn)` helper function (hoisted function declaration) instead of `document.addEventListener` delegation — avoids breaking the test harness which lacks `document.addEventListener`
- `populateLgaDatalist()` IIFE runs at parse time to fill the datalist
- All editor JS placed before `btnReset` handler at end of `<script>` block
