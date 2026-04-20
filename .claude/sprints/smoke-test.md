# Browser Smoke Test — LGR Rationalisation Engine

**Date:** 2026-04-17  
**Tester:** evaluator agent  
**Method:** Playwright MCP via local HTTP server (python3 -m http.server 8766)

---

## Re-test Results (Post-Fix)

The duplicate `const alloc` syntax error at line 1185 has been removed. The application is now fully functional.

**Console errors (post-fix session):** 1 — `Failed to load resource: 404` for `/favicon.ico`. No JavaScript errors.

---

## Stage-by-Stage Results

### Stage 1 — Ingest: PASS

**What renders:**
- GOV.UK header bar, "LGR Transition Workspace" title
- "Glossary" button (top right)
- File upload drop zone (dashed border, cloud icon, "Select JSON files")
- "Load Complex LGR Demo Scenario" button

**File upload (real files):** Uploading all four sample JSON files via the file chooser staged them correctly:
- Northshire County (13 nodes)
- Easton District (17 nodes)
- Southby Borough (18 nodes)
- Westampton District (18 nodes)

**Demo loader:** Clicking "Load Complex LGR Demo Scenario" staged three councils:
- Northshire County (4 nodes)
- Westampton District (4 nodes)
- Easton District (4 nodes)

Both paths show the staged file list and "Proceed to Baselining & Reconciliation →" button correctly.

---

### Stage 1.5 — Transition Structure Configuration: PASS

**What renders:**
- Vesting Date date input (accepts ISO date e.g. 2027-04-01)
- "Successor Authorities" section with "+ Add Successor" button
- Each successor row has: name input, Full Predecessors checkboxes (auto-populated from uploaded councils), Partial Predecessors checkboxes, Remove button
- Live validation warning when councils are unassigned: "⚠ Unassigned councils — The following councils are not assigned to any successor..."
- Warning clears when all councils are assigned
- "Proceed with Transition Planning →" button
- "Skip — use Estate Discovery mode" button

**Tested:** Added 2 successors (North Shire Unitary / East Shire Unitary), set vesting date 2027-04-01, assigned predecessors — all worked correctly.

**"+ Add Successor" button:** Works, dynamically adds new successor row with updated predecessor checkboxes.

**"Reconfigure Transition" (from dashboard):** Returns to Stage 1.5 with previous config preserved. PASS.

---

### Stage 2 — LGA Function Taxonomy Alignment: PASS

**Demo data (3 councils):**
- 2 functions appearing in 2+ councils (collision candidates)
- 2 functions unique to one council

**Real files (4 councils):**
- 9 collision functions
- 4 unique functions
- No validation errors (all nodes have valid `lgaFunctionId`)

**"Generate Restructure Matrix" button:** Renders correctly, advances to Stage 3.

---

### Stage 3 — Dashboard: PASS

#### Transition Planning mode (successor columns)

Matrix renders with:
- Successor authority columns (East Shire Unitary, North Shire Unitary)
- Function rows with LGA breadcrumb, ESD ID badge, Tier badge
- Rationalisation pattern tags (Choose & consolidate, Inherit as-is)
- System cards with: system name, provenance label ("from [predecessor council]"), user count, vendor, cost, contract date + notice period, portability rating, data layer
- Anchor System badge on qualifying system
- Analysis & Strategic Considerations column with signal badges
- Estate Summary: 3 predecessors, 6 systems, 2 collisions, 2 successors, 2027-04-01 vesting, 6 pre-vesting notice triggers

#### Estate Discovery mode (original council columns)

Matrix renders with:
- Original council columns (Easton District, Northshire County, Westampton District)
- Perspective dropdown shows per-council options (e.g. "Easton District Perspective")
- System cards render correctly without successor provenance labels
- Estate Summary shows simplified metrics (no transition risk section)

**Real files dashboard:** 9 collision rows + 4 unique rows, rich system cards with costs, contract dates, monolithic data flags, cross-tier collision warnings, TCoP alignment signals.

---

### Persona Switching: PASS

All three personas switch correctly:

| Persona | Banner colour | Banner text | Notes |
|---|---|---|---|
| Executive / Transition Board | Black | "Executive Board View (Consolidated)" | Day 1 survival, contract lock-ins, strategic horizons |
| Commercial / Transition Director | Green | "Commercial & Transition View" | Adds 3 extra estate summary metrics: disaggregation, monolithic+disaggregation, cross-boundary shared services |
| Enterprise Architect (CTO) | Purple | "Enterprise Architect View" | Anchor systems, tech debt, data monoliths, API portability |

Signal defaults change correctly per persona. Perspective filter persists across persona switches.

---

### Perspective Filter: PASS

- "All Successors" / "Unitary (All Councils)" — all columns visible
- Per-successor/council selection — selected column highlighted, others dimmed
- Dropdown populated dynamically from loaded data

---

### Modals: PASS

**Glossary modal:**
- Opens from header button
- Renders 4 sections: Notice Period Action Zone, Anchor System (Gravity), Vendor Density / Enterprise Agreement, Data Layer & Portability
- Closes via × button

**Signal Options modal:**
- Opens from "Signal Options" button in dashboard toolbar
- Shows 8 signals: Contract urgency, User volume, Monolithic data, Data portability, Vendor density, On-premise systems, TCoP alignment, Shared service
- Each has Off/Low/Med/High radio buttons with per-persona defaults pre-selected
- "Apply & refresh" and "Reset to persona defaults" buttons present
- Closes via × button

**Playbook Tier Mapping modal:**
- Opens from "View Tier Mapping" button in dashboard
- Shows TIER 1 — DAY 1 CRITICAL functions table with ESD IDs
- Also accessible from Stage 2 (appears in background when Reconfigure Transition is clicked while modal is open — minor cosmetic issue)
- Closes via × button

---

### Contract Notice & Expiry Timeline: PASS

- Appears below matrix in Executive and Commercial persona views (hidden for Architect)
- Horizontal bar chart showing all systems sorted by contract proximity
- Each bar labelled with system name + council, expiry date
- Striped zone visualises mandatory notice period
- Timeline spans 2024–2030 based on data
- "STRIPED ZONE" legend with explanation rendered correctly

---

### Export: PASS

- Opens new browser tab titled "LGR Transition Workspace — Export"
- Static HTML snapshot includes: generation timestamp, active persona, operating mode, signal weights table, estate summary metrics, full matrix

---

### Start Over: PASS

- Returns to Stage 1 with clean state
- All state variables reset (councils, transition structure, operating mode)

---

## Minor Issues Found

### Bug 1: Tier Mapping modal persists when navigating to Stage 1.5
- **Severity:** Minor (cosmetic)
- **Steps to reproduce:** Open Tier Mapping modal from dashboard → click "Reconfigure Transition"
- **Expected:** Modal closes before navigating back to Stage 1.5
- **Actual:** Modal remains open overlaid on Stage 1.5 content; user must manually close it

### Bug 2: Persona dropdown requires JS `dispatchEvent` to trigger re-render
- **Severity:** Minor / informational
- **Note:** The persona and perspective selects are wrapped in styled divs; Playwright's standard `select_option` tool fails on them. The `change` event fires correctly via JS evaluation. This is not a user-facing bug — real users interact with the native select element directly.

---

## Console Errors Summary

| Session | Errors | Details |
|---|---|---|
| Pre-fix (port 8765) | 2 | `Identifier 'alloc' has already been declared` (CRITICAL — killed all JS); favicon 404 |
| Post-fix (port 8766) | 1 | favicon 404 only — harmless |

---

## Overall Assessment

**Application state: FULLY FUNCTIONAL**

All stages, both operating modes, all three personas, all modals, timeline, export, file upload, and demo loader work correctly. The codebase is production-quality for its scope. The single minor bug (Tier Mapping modal not closing on Reconfigure Transition) is cosmetic and does not affect any analysis workflow.

**Verdict: PASS** — ready for sprint work to build on top of.

---

## Feature Coverage Matrix

| Feature | Status | Notes |
|---|---|---|
| Stage 1: File upload | PASS | Multi-file, correct node count display |
| Stage 1: Demo loader | PASS | 3-council complex scenario |
| Stage 1.5: Vesting date | PASS | ISO date input |
| Stage 1.5: Successor config | PASS | Add/remove rows, full/partial predecessor assignment |
| Stage 1.5: Unassigned warning | PASS | Live validation |
| Stage 2: Collision/unique counts | PASS | Correct counts for both demo and real files |
| Stage 2: Validation errors | PASS | No errors on valid files |
| Stage 3: Matrix (discovery mode) | PASS | Council columns, function rows, system cards |
| Stage 3: Matrix (transition mode) | PASS | Successor columns, pattern tags, provenance labels |
| Stage 3: Estate summary | PASS | All metrics correct per mode |
| Stage 3: Transition risk metrics | PASS | Vesting date, successor count, notice triggers |
| Persona: Executive | PASS | Contract urgency signals, timeline |
| Persona: Commercial | PASS | Extra disaggregation/shared service metrics |
| Persona: Architect | PASS | Monolithic/portability/TCoP signals, no timeline |
| Perspective filter | PASS | Column highlight/dim |
| Glossary modal | PASS | 4 terms, closes correctly |
| Signal Options modal | PASS | 8 signals, per-persona defaults, apply/reset |
| Tier Mapping modal | PASS | ESD ID table, minor close-on-navigate issue |
| Timeline | PASS | Bar chart, notice period striped zones |
| Export | PASS | New tab, complete static snapshot |
| Reconfigure Transition | PASS | Returns to 1.5 with config preserved |
| Start Over | PASS | Full state reset |
