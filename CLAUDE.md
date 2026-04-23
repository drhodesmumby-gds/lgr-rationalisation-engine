# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a single-file web application (~4,500 lines) for modelling UK Local Government Reorganisation (LGR) transitions. It helps architecture, commercial, and executive teams analyse what happens when multiple councils merge into new unitary authorities — specifically around IT system consolidation, contract timelines, disaggregation planning, and vendor rationalisation.

**To run:** Open `lgr-rationalisation-engine.html` directly in a browser. No build step, no dependencies, no server required. Tailwind CSS loads from CDN.

## Architecture

Everything lives in `lgr-rationalisation-engine.html` — HTML structure, embedded CSS overrides, and all JavaScript (~4,472 lines). Single-file, zero-dependency by design.

### Application Stages

The tool operates as a 4-stage pipeline:

1. **Stage 1 — Ingest** — Users upload one or more council JSON files (architecture data) and optionally a transition configuration file. Files are classified automatically: architecture files (have `nodes` array) go to `rawUploads`; transition configs (have `successors` array, no `nodes`) are stored in `pendingTransitionConfig`. Each uploaded architecture can be inspected/modified via the built-in visual architecture editor.
2. **Stage 1.5 — Transition Structure** — Defines successor authorities, predecessor assignments (full/partial), and vesting date. If `pendingTransitionConfig` was detected during ingest, it auto-populates. Can be skipped to enter **Estate Discovery mode**. Includes import/export of transition config JSON and a "Detect from architecture" auto-discovery button.
3. **Stage 2 — Baselining** — `runBaselining()` merges all uploads into a unified graph, resolves each Function node against the embedded LGA/ESD taxonomy via `lgaFunctionId`, builds `lgaFunctionMap`, extracts council metadata (tier, financial distress), and reports collision/unique function counts. Functions missing `lgaFunctionId` are excluded and flagged.
4. **Stage 3 — Dashboard** — `renderDashboard()` builds the analysis matrix. In **transition mode**, columns represent successor authorities with rationalisation patterns; in **discovery mode**, columns represent predecessor councils for cross-council comparison. Includes signals, TCoP assessment, critical path panel, contract timeline, estate summary, and perspective filtering.

### Operating Modes

- **Discovery mode** (`operatingMode === 'discovery'`) — Matrix columns are predecessor councils. No rationalisation patterns. Timeline uses fixed date range. Perspective filters by council name.
- **Transition mode** (`operatingMode === 'transition'`) — Matrix columns are successor authorities. Systems allocated via `buildSuccessorAllocation()`. Rationalisation patterns classified per function. Tier promotion applies. Critical path panel shows pre-vesting decisions. Timeline centres on vesting date. Perspective filters by successor name.

### Key State Variables

```javascript
// Core workspace
let rawUploads = [];                    // Parsed council JSON payloads from file upload
let mergedArchitecture = {              // Unified graph after baselining
    nodes: [], edges: [], councils: new Set()
};
let lgaFunctionMap = new Map();         // lgaFunctionId → { lgaId, label, breadcrumb, councils, localNodeIds }

// Transition planning
let transitionStructure = null;         // { vestingDate, successors[] } or null
let operatingMode = 'discovery';        // 'discovery' | 'transition'
let successorAllocationMap = null;      // Map<successorName, Map<lgaFunctionId, SystemAllocation[]>>
let pendingTransitionConfig = null;     // Auto-detected transition config from file ingest
let tierMap = new Map();                // Map<lgaFunctionId, 1|2|3> — playbook tier per function
let councilTierMap = new Map();         // Map<councilName, "county"|"district"|"unitary">
let distressedCouncils = new Set();     // Set<councilName> with financialDistress: true

// Analysis
let activePersona = 'executive';        // 'executive' | 'commercial' | 'architect'
let activePerspective = 'all';          // 'all' | councilName | successorName
let signalWeights;                      // Current weights per signal; cloned from persona defaults
let analysisModalData = [];             // Array of analysis cell data for modal drill-down

// Sort/filter
let activeSortMode = 'tier';            // 'tier' | 'name' | 'collision'
let activeFilters = { tier: 'all', collision: 'all' };

// Architecture editor
let archEditorState = null;             // { uploadIdx, data } when editor is open
```

**SystemAllocation structure** (returned by `buildSuccessorAllocation()`):
```javascript
{ system: { ...sysNode }, sourceCouncil, allocationType, needsAllocationReview, isDisaggregation }
```
Note: the system object is nested under `a.system`, not flattened — use `a.system.id`, `a.system.vendor`, etc.

### Key Functions — Pipeline

| Function | Line | Description |
|---|---|---|
| `runBaselining()` | ~1438 | Merges uploads, builds `lgaFunctionMap`, validates schema, populates `councilTierMap` and `distressedCouncils` |
| `renderTransitionConfigPanel()` | ~1041 | Renders Stage 1.5 UI for vesting date and successor/predecessor configuration |
| `buildSuccessorAllocation()` | ~2210 | Maps systems to successors: checks `targetAuthorities` first, falls back to predecessor mapping, marks disaggregation |
| `renderDashboard()` | ~1738 | Iterates `lgaFunctionMap`, builds matrix table, calls signal computation and rendering |
| `renderEstateSummary()` | ~1594 | Renders estate-wide metrics panel (system count, collisions, spend, pre-vesting triggers, etc.) |
| `renderCriticalPathPanel()` | ~2062 | Pre-vesting contract decisions table (Executive persona only); badges: OVERDUE / URGENT |

### Key Functions — Analysis

| Function | Line | Description |
|---|---|---|
| `computeSignals()` | ~2873 | Computes all 8 signals for a set of systems with weight-based rendering |
| `computeSignalEmphasis()` | ~2659 | Adjusts signal weights based on rationalisation pattern (extract boosts data signals, consolidate boosts comparison signals) |
| `classifyRationalisationPattern()` | ~2492 | Classifies function row into 4 patterns: inherit-as-is / choose-and-consolidate / extract-and-partition / extract-partition-and-consolidate |
| `computeTcopAssessment()` | ~2551 | Evaluates system against TCoP Points 3, 4, 5, 9, 11 |
| `computeEffectiveTier()` | ~2441 | Returns tier with promotion rule (Tier 3 → 2 if notice triggers pre-vesting) |
| `classifyVestingZone()` | ~2413 | Classifies contract position: pre-vesting / year-1 / natural-expiry / long-tail |
| `computeEstateSummaryMetrics()` | ~2700 | Computes estate-wide metrics filtered by perspective |
| `detectSharedServiceBoundary()` | ~2589 | Checks if shared services cross successor boundaries |
| `detectCrossTierCollision()` | ~2615 | Detects collisions between systems from different council tiers |
| `computeVendorDensityMetrics()` | ~2681 | Groups systems by vendor across councils for a function |

### Key Functions — Rendering

| Function | Line | Description |
|---|---|---|
| `buildSystemCard()` | ~2105 | Renders per-system metadata card with persona-aware field groups and badges (anchor, ERP, shared service, financial distress, cross-tier) |
| `buildPersonaAnalysis()` | ~3172 | Computes signals and renders analysis cell with persona-specific insight questions |
| `generatePersonaQuestions()` | ~3289 | Generates contextual questions based on persona, pattern, signals, and allocations |
| `drawTimeline()` | ~3714 | Contract expiry timeline with notice period striped zones; vesting-centred in transition mode; perspective filtering via `successorAllocationMap` |
| `exportToHTML()` | ~3884 | Exports Stage 3 as self-contained HTML file |
| `sortFunctionRows()` | ~2471 | Sorts matrix rows by tier priority, name, or collision count |

### Key Functions — Taxonomy & Helpers

| Function | Line | Description |
|---|---|---|
| `getLgaFunction(id)` | ~570 | Looks up ESD function by ID in `LGA_FUNCTIONS` (176 entries) |
| `getLgaBreadcrumb(id)` | ~574 | Returns `"Parent > Label"` for grandchild functions, null for direct children of root |
| `wrapWithTooltip()` | ~645 | Renders dotted-underline span with hover/focus tooltip from `DOMAIN_TERMS` |
| `helpIcon(docKey)` | ~650 | Renders (?) icon that opens documentation modal |

### Key Functions — Architecture Editor

| Function | Line | Description |
|---|---|---|
| `openArchEditor()` | ~4057 | Opens full-screen editor modal for a council upload |
| `renderArchEditorTab()` | ~4071 | Renders one of 4 editor tabs (Council Info, Functions, IT Systems, Edges) |
| `syncEditorFieldsToState()` | ~4249 | Syncs form field changes back to `archEditorState.data` |
| `buildExportData()` | ~4288 | Builds clean JSON export from editor state |

### Key Constants

| Constant | Description |
|---|---|
| `LGA_FUNCTIONS` | 176-entry ESD taxonomy array `{id, label, parentId}`; sourced from `https://webservices.esd.org.uk/lists/functions` |
| `DEFAULT_TIER_MAP` | `Map<lgaFunctionId, 1|2|3>` — statutory/operational priority per ESD function |
| `SIGNAL_DEFS` | Array of 8 signal definitions `{id, label, desc}` |
| `PERSONA_DEFAULT_WEIGHTS` | Per-persona signal weight defaults (executive/commercial/architect) |
| `DOMAIN_TERMS` | Rich tooltip content for 16 domain terms |
| `DOCUMENTATION` | Structured content for 7 inline documentation topics |

### Signal System

Eight configurable signals, each with weight levels (Off=0, Low=1, Med=2, High=3):

| Signal ID | What it measures |
|---|---|
| `contractUrgency` | Months until notice trigger; classified by vesting zone |
| `userVolume` | Relative user counts; anchor detection (top ≥ 1.5× second) |
| `dataMonolith` | Systems with `dataPartitioning === 'Monolithic'` or `isERP` |
| `dataPortability` | Worst portability tier present (Low > Medium) |
| `vendorDensity` | Same vendor across 2+ councils for a function |
| `techDebt` | Systems where `!isCloud` (on-premise) |
| `tcopAlignment` | TCoP Points 3, 4, 5, 9, 11 assessment |
| `sharedService` | `sharedWith` arrays; cross-boundary detection in transition mode |

Changing persona resets weights to that persona's defaults. Weights can be manually adjusted in the Signal Options panel.

### Rationalisation Patterns (Transition Mode Only)

| Pattern | Condition | Colour |
|---|---|---|
| `inherit-as-is` | Single system, no disaggregation | Green |
| `choose-and-consolidate` | Multiple systems, no disaggregation | Blue |
| `extract-and-partition` | Disaggregation present, no competing systems | Red |
| `extract-partition-and-consolidate` | Disaggregation + competing systems | Purple |

### Personas

Three role-based views over the same data, each with different signal weight defaults:
- **Executive/Transition Board** — Emphasises contract urgency, monolithic data, user volume, shared services. Includes critical path panel.
- **Commercial/Transition Director** — Emphasises contract urgency, vendor density, shared services. Designed for procurement strategy.
- **Enterprise Architect (CTO)** — Emphasises monolithic data, portability, on-premise, TCoP alignment. Timeline hidden for this persona.

### Modals

Six modal types, all using the same pattern (`fixed inset-0 bg-black bg-opacity-50` with `border-t-8 border-[#1d70b8]` panel):

1. **Glossary** — domain terminology in 5 sections
2. **Signal Options** — radio groups per signal for weight selection
3. **Tier Mapping** — ESD function to tier assignments
4. **Analysis Detail** — drill-down for a selected function cell
5. **Documentation** — explanation modals for complex logic (triggered by help icons)
6. **Architecture Editor** — full-screen visual editor with 4 tabs (Council Info, Functions, IT Systems, Edges)

## Input Data Format

### Council architecture file

```json
{
  "councilName": "String",
  "councilMetadata": {
    "tier": "county" | "district" | "borough" | "unitary",
    "financialDistress": false
  },
  "nodes": [
    { "id": "fn-1", "label": "Adult Social Care", "type": "Function", "lgaFunctionId": "148" },
    {
      "id": "sys-1", "label": "Liquidlogic LAS", "type": "ITSystem",
      "vendor": "System C", "users": 3500, "cost": "£950k/yr", "annualCost": 950000,
      "endYear": 2028, "endMonth": 3, "noticePeriod": 12,
      "portability": "High" | "Medium" | "Low",
      "dataPartitioning": "Segmented" | "Monolithic",
      "isCloud": true, "isERP": false,
      "sharedWith": ["Other Council"],
      "targetAuthorities": ["Successor Name"]
    }
  ],
  "edges": [
    { "source": "sys-1", "target": "fn-1", "relationship": "REALIZES" }
  ]
}
```

**Function nodes must include `lgaFunctionId`** — a valid ESD function identifier. Nodes missing this field are excluded and flagged at Stage 2.

### Transition configuration file

```json
{
  "vestingDate": "2027-04-01",
  "successors": [
    {
      "name": "North Essex Unitary",
      "fullPredecessors": ["Braintree District"],
      "partialPredecessors": ["Essex County"]
    }
  ]
}
```

Auto-detected at Stage 1 if uploaded alongside architecture files (has `successors` array, no `nodes`).

## Sample Data

- **`examples/` directory**: 10 curated scenarios (01 through 10), each with council architecture files, transition config, and README. Scenarios range from simple 2-council mergers to 7-council disaggregation with maximum complexity.
- **`examples/00-legacy-samples/`**: 5 original development sample files (`northshire-county.json`, `easton-district.json`, `southby-borough.json`, `westampton-district.json`, `test-complex-lgr.json`). Referenced in historical sprint artifacts.

## Design Conventions

- Styled to approximate the **GOV.UK Design System** (crown palette, GDS tag colours via CSS custom properties)
- Persona colour schemes: blue (executive), green (commercial), purple/black (architect)
- Monolithic ERP systems get distinct visual treatment (red borders, risk flags) throughout
- Pattern tags are colour-coded: green (inherit), blue (consolidate), red (extract), purple (extract + consolidate)
- Tier badges: red (Tier 1 Day 1 Critical), amber (Tier 2 High Priority), grey (Tier 3 Post-Day 1)
- **Domain term tooltips**: `DOMAIN_TERMS` object defines rich hover tooltips for 16 key terms, rendered via `wrapWithTooltip()`
- **Help icons**: `helpIcon(docKey)` renders (?) icons throughout that open the documentation modal with content from `DOCUMENTATION` constant
- All modals use consistent styling: `border-t-8 border-[#1d70b8]`, click-outside-to-close

## Development Approach

### Multi-Agent Team Structure

Sprint-based development uses a team lead + specialist agent pattern. The team lead (parent Opus session) orchestrates all work — it does NOT write code directly. See `.claude/team-protocol.md` for full details.

**Development agents:**
- **Planner** (Opus) — Designs implementation approaches. Spawned to keep design exploration out of the team lead's context window.
- **Generator** (Sonnet, `bypassPermissions`, `isolation: "worktree"`) — Implements code changes in an isolated worktree.
- **Evaluator** (Sonnet, `bypassPermissions`) — Verifies implementation via Playwright MCP browser testing and `npm test`.

**Quality agents:**
- **Test Writer** (Sonnet) — Expands property test suite after sprints adding pure functions
- **UX Auditor** (Sonnet) — GOV.UK Design System compliance, accessibility, responsive behaviour
- **Persona Tester** (Opus) — Tests utility from Enterprise Architect, Commercial, or Executive perspective

**Sprint workflow:**
1. DESIGN — Spawn Planner for complex work (or use plan mode for simple tasks)
2. BUILD — `TeamCreate` → spawn Generator → wait for completion
3. TEST — Spawn Evaluator → wait for results → iterate if needed
4. SHIP — Commit, clean up core team
5. QUALITY — Trigger quality agents based on what changed:
   - UI changes → UX Auditor
   - Analysis/signal changes → Persona Testers (up to 3 in parallel)
   - New pure functions → Test Writer

**Key rules:**
- All communication flows through the team lead — agents never message each other
- Team lead provides complete context in spawn prompts
- Generator works in worktrees; Evaluator and quality agents test against main branch
- Team lead delegates implementation, never writes code directly
- Team lead proactively triggers quality testing after each sprint

### Testing

The application is tested by serving via a local HTTP server (`python3 -m http.server 8765`) and using Playwright MCP tools for browser interaction. The `file:///` protocol is blocked by Playwright — always serve over HTTP.

**IMPORTANT — Browser testing must use Playwright MCP tools only.** Do NOT write custom Node.js scripts that import `playwright` or `playwright-core` from `node_modules` — the project only has `@playwright/test` as a dev dependency and direct imports will fail with `ERR_MODULE_NOT_FOUND`. Instead, use the MCP tools directly: `mcp__playwright__browser_navigate`, `mcp__playwright__browser_snapshot`, `mcp__playwright__browser_click`, `mcp__playwright__browser_type`, `mcp__playwright__browser_file_upload`, `mcp__playwright__browser_evaluate`, `mcp__playwright__browser_take_screenshot`, `mcp__playwright__browser_wait_for`, `mcp__playwright__browser_console_messages`, etc.

### Documentation

Four documentation files are maintained alongside the code:
- `README.md` — technical reference for developers
- `TECHNICAL-ARCHITECTURE.md` — detailed architecture documentation
- `STAKEHOLDER-INTRODUCTION.md` — non-technical introduction for programme teams
- `ROADMAP.md` — future development direction (service-level modelling, LGAM alignment, playbook alignment)

These should be updated when significant features are added or changed.
