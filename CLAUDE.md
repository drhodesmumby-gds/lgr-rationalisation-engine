# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A modular web application (~15,000 lines JS) for modelling UK Local Government Reorganisation (LGR) transitions. It helps architecture, commercial, and executive teams analyse what happens when multiple councils merge into new unitary authorities — specifically around IT system consolidation, contract timelines, disaggregation planning, and vendor rationalisation.

## Commands

```bash
npm run build        # Bundle src/ → dist/lgr-rationalisation-engine.html (esbuild)
npm run dev          # Watch mode — rebuilds on src/ changes
npm test             # Run property tests (vitest + fast-check)
npm run test:watch   # Vitest in watch mode
```

**To run the app:** `python3 -m http.server 8765` then open `http://localhost:8765/dist/lgr-rationalisation-engine.html`. Tailwind CSS loads from CDN.

## Architecture

Modular ES modules in `src/`, bundled by esbuild into a single self-contained HTML file (`dist/lgr-rationalisation-engine.html`). The build injects bundled JS and CSS into `src/index.html`.

```
src/
├── index.html              # HTML template ({{STYLES}} and {{BUNDLE}} placeholders)
├── styles.css              # CSS custom properties and component styles
├── main.js                 # Entry point, UI rendering, event wiring (~2600 lines)
├── state.js                # Central state object (exported singleton)
├── taxonomy.js             # ESD function lookups
├── ui-helpers.js           # escHtml, wrapWithTooltip, helpIcon
├── ui-notifications.js     # Toast notification system
├── constants/              # Static data (LGA functions, tier map, signals, docs)
├── analysis/               # Pure analysis functions (allocation, signals, metrics, questions)
├── simulation/             # Decision simulation engine (actions, decisions, projector, obligations, impact)
└── features/               # Feature modules (arch-editor, decision-panel, simulation-panel,
                            #   import-wizard, baseline-report, report-export, scenario-manager, sankey)
build.js                    # esbuild bundler script
dist/                       # Build output (single HTML file, not checked in)
```

### Application Stages

The tool operates as a 4-stage pipeline:

1. **Stage 1 — Ingest** — Users upload one or more council JSON files (architecture data) and optionally a transition configuration file. Files are classified automatically: architecture files (have `nodes` array) go to `rawUploads`; transition configs (have `successors` array, no `nodes`) are stored in `pendingTransitionConfig`. Each uploaded architecture can be inspected/modified via the built-in visual architecture editor.
2. **Stage 1.5 — Transition Structure** — Defines successor authorities, predecessor assignments (full/partial), and vesting date. If `pendingTransitionConfig` was detected during ingest, it auto-populates. Can be skipped to enter **Estate Discovery mode**. Includes import/export of transition config JSON and a "Detect from architecture" auto-discovery button.
3. **Stage 2 — Baselining** — `runBaselining()` merges all uploads into a unified graph, resolves each Function node against the embedded LGA/ESD taxonomy via `lgaFunctionId`, builds `lgaFunctionMap`, extracts council metadata (tier, financial distress), and reports collision/unique function counts. Functions missing `lgaFunctionId` are excluded and flagged.
4. **Stage 3 — Dashboard** — `renderDashboard()` builds the analysis matrix. In **transition mode**, columns represent successor authorities with rationalisation patterns; in **discovery mode**, columns represent predecessor councils for cross-council comparison. Includes signals, TCoP assessment, critical path panel, contract timeline, estate summary, and perspective filtering.

### Operating Modes

- **Discovery mode** (`operatingMode === 'discovery'`) — Matrix columns are predecessor councils. No rationalisation patterns. Timeline uses fixed date range. Perspective filters by council name.
- **Transition mode** (`operatingMode === 'transition'`) — Matrix columns are successor authorities. Systems allocated via `buildSuccessorAllocation()`. Rationalisation patterns classified per function. Tier promotion applies. Critical path panel shows pre-vesting decisions. Timeline centres on vesting date. Perspective filters by successor name.

### Key Modules

| Module | Description |
|---|---|
| `src/state.js` | Central state singleton — all mutable app state lives here |
| `src/main.js` | Entry point: UI rendering, event wiring, pipeline orchestration |
| `src/analysis/allocation.js` | `buildSuccessorAllocation()`, vesting zones, shared service boundary detection |
| `src/analysis/signals.js` | `computeSignals()`, TCoP assessment, vendor density, signal emphasis |
| `src/analysis/metrics.js` | Estate summary metrics, effective tier, rationalisation patterns, migration complexity |
| `src/analysis/questions.js` | `generatePersonaQuestions()` — contextual insight questions per persona |
| `src/simulation/actions.js` | Simulation action application (choose system, decommission, defer) |
| `src/simulation/decisions.js` | Decision state management and validation |
| `src/simulation/projector.js` | Projects simulation state from saved decisions |
| `src/simulation/obligations.js` | Generates obligations/impacts from decisions (migration, governance, capability gap) |
| `src/features/decision-panel.js` | Decision UI — grouped radio buttons, blast radius preview, cross-successor |
| `src/features/simulation-panel.js` | Simulation side panel — decision list, progress, undo, scenario management |
| `src/features/arch-editor.js` | Architecture editor modal (4 tabs: Council, Functions, Systems, Edges) |
| `src/features/import-wizard.js` | Multi-format import (CSV, Excel, clipboard, guided manual entry) |
| `src/features/baseline-report.js` | Pre-simulation estate report for all 3 personas |
| `src/features/report-export.js` | Persona-tailored formatted report export |
| `src/features/scenario-manager.js` | Save/load/export decision scenarios |
| `src/features/sankey-diagram.js` | Sankey flow overlay for system-to-successor visualisation |

**SystemAllocation structure** (returned by `buildSuccessorAllocation()`):
```javascript
{ system: { ...sysNode }, sourceCouncil, allocationType, needsAllocationReview, isDisaggregation }
```
Note: the system object is nested under `a.system`, not flattened — use `a.system.id`, `a.system.vendor`, etc.

### Key Constants (in `src/constants/`)

| Constant | File | Description |
|---|---|---|
| `LGA_FUNCTIONS` | `lga-functions.js` | 176-entry ESD taxonomy array `{id, label, parentId}` |
| `DEFAULT_TIER_MAP` | `tier-map.js` | `Map<lgaFunctionId, 1|2|3>` — statutory/operational priority |
| `SIGNAL_DEFS` / `PERSONA_DEFAULT_WEIGHTS` | `signals.js` | Signal definitions and per-persona weight defaults |
| `LGAM_CAPABILITIES` | `capabilities.js` | Standard capability vocabulary (payments, forms, sms, etc.) |
| `DOMAIN_TERMS` | `domain-terms.js` | Rich tooltip content for domain terminology |
| `DOCUMENTATION` | `documentation.js` | Structured content for inline documentation modals |

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
      "targetAuthorities": ["Successor Name"],
      "capabilityType": ["payments"]
    }
  ],
  "edges": [
    { "source": "sys-1", "target": "fn-1", "relationship": "REALIZES" },
    { "source": "sys-2", "target": "sys-1", "relationship": "CONSUMES_CAPABILITY", "capabilities": ["payments"] }
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

### Build System

esbuild bundles `src/main.js` (and all imports) into a single IIFE, injects it along with `src/styles.css` into `src/index.html`, and writes the result to `dist/`. The output is a self-contained HTML file that can be opened directly or served over HTTP.

```bash
node build.js           # Single build
node build.js --watch   # Watch mode (requires chokidar)
```

### Multi-Agent Team Structure

Sprint-based development uses a team lead + specialist agent pattern. The team lead (parent Opus session) orchestrates all work — it does NOT write code directly.

**Development agents:**
- **Planner** (Opus) — Designs implementation approaches
- **Generator** (Sonnet, `bypassPermissions`) — Implements code changes. Do NOT use `isolation: "worktree"` — changes get lost on cleanup.
- **Evaluator** (Sonnet, `bypassPermissions`) — Verifies implementation via Playwright MCP browser testing and `npm test`

**Quality agents:**
- **Test Writer** (Sonnet) — Expands property test suite for new pure functions
- **UX Auditor** (Sonnet) — GOV.UK Design System compliance, accessibility
- **Persona Tester** (Opus) — Tests utility from Enterprise Architect, Commercial, or Executive perspective

**Key rules:**
- Team lead delegates implementation, never writes code directly
- Generator must NOT run git commands — team lead handles all commits
- All communication flows through the team lead

### Testing

**Property tests** (pure functions):
```bash
npm test                          # vitest + fast-check
```
Tests live in `tests/properties/`. Generators in `tests/generators/`.

**Browser testing** — serve via `python3 -m http.server 8765` and use Playwright MCP tools. The `file:///` protocol is blocked — always serve over HTTP.

**IMPORTANT:** Do NOT write custom Node.js scripts that import `playwright` from `node_modules` — only `@playwright/test` is installed. Use MCP tools directly: `mcp__playwright__browser_navigate`, `mcp__playwright__browser_snapshot`, `mcp__playwright__browser_click`, etc.

### Documentation

- `README.md` — technical reference for developers
- `TECHNICAL-ARCHITECTURE.md` — detailed architecture documentation
- `STAKEHOLDER-INTRODUCTION.md` — non-technical introduction for programme teams
- `ROADMAP.md` — future development direction
