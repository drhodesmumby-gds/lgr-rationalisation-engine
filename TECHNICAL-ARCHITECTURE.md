# LGR Transition Workspace Engine — Technical Architecture

## Architecture philosophy

Single-file, zero-dependency. The entire application — HTML structure, embedded CSS, and JavaScript — lives in `lgr-rationalisation-engine.html`. This is an intentional constraint: no build toolchain, no package manager, no server, no deployment infrastructure. The file can be opened directly in any modern browser.

The only external dependency is Tailwind CSS, loaded from CDN. This is acceptable for a tool where network access is assumed during use, and avoids any local installation requirement.

---

## Technology choices

### Tailwind CSS (CDN)
Used for utility-class layout and spacing. The GOV.UK palette is applied via CSS custom properties (`--govuk-blue`, `--govuk-red`, etc.) defined in a `<style>` block, with Tailwind handling structural layout. This gives the tool a credible GDS aesthetic without implementing the full GOV.UK Frontend library, which would require a build pipeline.

### Vanilla JavaScript (no framework)
Direct DOM manipulation with module-level state. No React, Vue, or equivalent. Justified by scope: the application state is a small set of variables with a one-directional pipeline, and a framework would add complexity without value for a single-file tool.

### Embedded LGA/ESD taxonomy
The 176-entry ESD Standard Function Taxonomy is embedded as a JS constant (`LGA_FUNCTIONS`). This eliminates an HTTP dependency at runtime and ensures the taxonomy version is consistent across all sessions. Source: `https://webservices.esd.org.uk/lists/functions` (last modified 2016-09-01). The taxonomy is stable; updates require re-fetching the API and regenerating the constant.

---

## Application state

State is held in module-level variables:

```javascript
// Core workspace state
let rawUploads = [];                    // Parsed council JSON payloads from file upload
let mergedArchitecture = {              // Unified graph after baselining
    nodes: [], edges: [], councils: new Set()
};
let lgaFunctionMap = new Map();         // lgaFunctionId → { lgaId, label, breadcrumb, councils, localNodeIds }

// Transition planning state
let transitionStructure = null;         // { vestingDate, successors[] } or null
let operatingMode = 'discovery';        // 'discovery' | 'transition'
let successorAllocationMap = null;      // Map<successorName, Map<lgaFunctionId, SystemAllocation[]>>
let pendingTransitionConfig = null;     // Auto-detected transition config from file upload
let tierMap = new Map();                // Map<lgaFunctionId, 1|2|3> — playbook tier per function
let councilTierMap = new Map();         // Map<councilName, "county"|"district"|"unitary">
let distressedCouncils = new Set();     // Set<councilName> with financialDistress: true

// Analysis state
let activePersona = 'executive';        // 'executive' | 'commercial' | 'architect'
let activePerspective = 'all';          // 'all' | councilName | successorName
let signalWeights;                      // Current weights per signal; cloned from persona defaults

// Sort/filter state
let activeSortMode = 'tier';            // 'tier' | 'name' | 'collision'
let activeFilters = { tier: 'all', collision: 'all' };
```

State transitions are one-directional through the pipeline (Upload → Transition Config → Baseline → Dashboard). The "Start Over" button clears all state and returns to Stage 1.

---

## Operating modes

The engine operates in one of two modes, determined at Stage 1.5:

### Discovery mode
- Activated by clicking "Skip — use Estate Discovery mode"
- Matrix columns represent predecessor councils
- Perspective dropdown filters by council name
- Timeline uses a fixed date range
- No rationalisation patterns; analysis shows cross-council comparison only

### Transition mode
- Activated by configuring successors and clicking "Proceed with Transition Planning"
- Matrix columns represent successor authorities
- Systems are allocated to successors via `buildSuccessorAllocation()`
- Rationalisation patterns are classified per function row
- Perspective dropdown filters by successor name
- Timeline centres on the vesting date
- Tier promotion applies (Tier 3 → 2 for pre-vesting triggers)
- Critical path panel shows pre-vesting contract decisions

---

## Data model

Council input files describe an IT landscape as a directed graph:

- **Function nodes** — a service capability mapped to an ESD taxonomy ID via `lgaFunctionId`
- **ITSystem nodes** — a concrete software system with associated metadata (users, cost, contract, portability, data layer characteristics)
- **REALIZES edges** — directed from `ITSystem → Function`; one system can realize multiple functions; one function can be served by multiple systems

At ingest time, a `_sourceCouncil` property is added to every node and edge to track provenance through the unified `mergedArchitecture` graph.

### ITSystem node properties

| Property | Type | Notes |
|---|---|---|
| `users` | number | User count — used for anchor detection and volume signals |
| `vendor` | string | Used for vendor density signal |
| `cost` | string | Display only (free-form, e.g. "£950k/yr") |
| `annualCost` | number | Numeric cost value; used for estate spend calculations |
| `endYear` / `endMonth` | number | Contract expiry; used for urgency signal, timeline, and vesting zone classification |
| `noticePeriod` | number | Months notice required; determines notice zone start and vesting zone |
| `portability` | `"High"` / `"Medium"` / `"Low"` | Data extraction capability; used for portability signal and TCoP assessment |
| `dataPartitioning` | `"Segmented"` / `"Monolithic"` | Whether data is cleanly partitionable; used for monolith signal |
| `isCloud` | boolean | Cloud/SaaS vs on-premise; drives tech debt signal and TCoP Point 5 |
| `isERP` | boolean | Triggers additional monolithic treatment and TCoP Point 9 concern |
| `sharedWith` | string[] | Other council names sharing this system instance; triggers shared service signal |
| `targetAuthorities` | string[] | Explicit successor assignment; overrides default predecessor-based allocation |

### Council metadata

| Property | Type | Effect |
|---|---|---|
| `councilMetadata.tier` | string | Stored in `councilTierMap`; used for cross-tier collision detection and tier badges on system cards |
| `councilMetadata.financialDistress` | boolean | Council added to `distressedCouncils`; systems flagged with risk warning on cards |

### Transition structure

```javascript
{
    vestingDate: "YYYY-MM-DD",
    successors: [
        {
            name: "Successor Authority Name",
            fullPredecessors: ["Council A"],       // Entire estate transfers
            partialPredecessors: ["Council B"]     // Estate split across successors
        }
    ]
}
```

### Successor allocation

`buildSuccessorAllocation()` maps every system to one or more successors:

1. Builds a council-to-successor lookup from `fullPredecessors` and `partialPredecessors`
2. For each system, checks `targetAuthorities` first (explicit override)
3. Falls back to predecessor mapping via `_sourceCouncil`
4. Marks `isDisaggregation = true` if a system is allocated to 2+ successors
5. Returns `Map<successorName, Map<lgaFunctionId, SystemAllocation[]>>`

Each `SystemAllocation` contains: `{ system, sourceCouncil, allocationType, needsAllocationReview, isDisaggregation }`

---

## Pipeline

### Stage 1 — Ingest

File reading uses the native `FileReader` API via `<input type="file" multiple accept=".json">`. Each file is parsed as JSON and classified:

- **Architecture files** (have `nodes` array): pushed to `rawUploads`; displayed with node count and "Edit Architecture" button
- **Transition config files** (have `successors` array, no `nodes`): stored as `pendingTransitionConfig`; displayed distinctly with successor count

A demo loader provides hardcoded council payloads without requiring file upload.

### Stage 1.5 — Transition Structure Configuration

Renders a configuration panel for defining:
- Vesting date (date picker)
- Successor authorities with predecessor assignments (checkboxes with mutual exclusion constraints)

If `pendingTransitionConfig` was detected during ingest, it is automatically applied — populating the vesting date, successor names, and predecessor checkboxes.

Buttons: **Detect from architecture** (auto-discovers councils), **Import Configuration** (file dialog), **Export Configuration** (JSON download).

The panel enforces constraints: a council assigned as a full predecessor to one successor cannot be assigned to another; a council cannot be both full and partial predecessor of the same successor.

### Stage 2 — Baselining (`runBaselining()`)

1. Iterates all uploaded council payloads
2. Extracts `councilMetadata` — populates `councilTierMap` and `distressedCouncils`
3. For each Function node: validates `lgaFunctionId` is present; missing IDs are collected as validation errors
4. Builds `lgaFunctionMap` — a `Map<lgaFunctionId, entry>` accumulating `councils` (Set) and `localNodeIds` (Set) across all uploads
5. `getLgaBreadcrumb(id)` returns `"Parent > Label"` only for grandchildren; direct root children return null
6. Reports collision count vs. unique function count

### Stage 3 — Dashboard (`renderDashboard()`)

**Transition mode rendering:**

1. Calls `buildSuccessorAllocation()` to compute `successorAllocationMap`
2. Populates Perspective dropdown with successor names
3. Builds table headers — one column per successor, plus analysis column
4. Computes effective tiers via `computeEffectiveTier()` with promotion rule
5. For each function row: gathers allocations per successor, classifies rationalisation pattern, detects anchor system, computes signals with pattern-adjusted emphasis
6. Calls `renderCriticalPathPanel()` for Executive persona
7. Calls `drawTimeline()` with vesting-centred date range

**Discovery mode rendering:**

1. Populates Perspective dropdown with council names
2. Builds table headers — one column per council, plus analysis column
3. For each function row: identifies relevant systems via edge traversal, builds system cards per council column and analysis cell
4. Calls `drawTimeline()` with fixed date range

**Both modes:**
- Sort/filter controls applied via `sortFunctionRows()` and `activeFilters`
- Estate summary rendered via `computeEstateSummaryMetrics()`
- Sticky table headers (CSS `position: sticky`)

---

## Signal system

Signals replace hardcoded verdicts with neutral, factual observations.

### Signal computation (`computeSignals()`)

| Signal ID | Key logic |
|---|---|
| `contractUrgency` | Sorts by notice trigger month; classifies by vesting zone (pre-vesting / year-1 / natural-expiry / long-tail) |
| `userVolume` | Sorts by `users` descending; computes anchor ratio `top.users / second.users` |
| `dataMonolith` | Filters `dataPartitioning === 'Monolithic' \|\| isERP` |
| `dataPortability` | Identifies worst portability tier present (`Low` > `Medium`) |
| `vendorDensity` | Groups by `vendor`; flags vendor present across 2+ councils for this function |
| `techDebt` | Filters `!isCloud` |
| `tcopAlignment` | Calls `computeTcopAssessment()` per system; aggregates alignments and concerns across TCoP Points 3, 4, 5, 9, 11 |
| `sharedService` | Checks `sharedWith` array; in transition mode, detects whether shared services cross successor boundaries |

### Signal emphasis adjustment

`computeSignalEmphasis()` adjusts signal weights based on the classified rationalisation pattern:
- **Extract patterns** boost data-related signals (monolith, portability)
- **Consolidate patterns** boost comparison signals (user volume, vendor density)

### Per-persona weight defaults

```javascript
const PERSONA_DEFAULT_WEIGHTS = {
    executive:  { contractUrgency: 3, userVolume: 2, dataMonolith: 3, dataPortability: 1, vendorDensity: 2, techDebt: 1, tcopAlignment: 1, sharedService: 2 },
    commercial: { contractUrgency: 3, userVolume: 1, dataMonolith: 1, dataPartability: 0, vendorDensity: 3, techDebt: 0, tcopAlignment: 0, sharedService: 3 },
    architect:  { contractUrgency: 1, userVolume: 2, dataMonolith: 3, dataPortability: 3, vendorDensity: 1, techDebt: 3, tcopAlignment: 3, sharedService: 1 }
};
```

---

## Rationalisation patterns

`classifyRationalisationPattern(allocations)` classifies each function row based on the allocation set:

| Pattern | Condition |
|---|---|
| `inherit-as-is` | Single system, no disaggregation |
| `choose-and-consolidate` | Multiple systems, no disaggregation |
| `extract-and-partition` | Disaggregation present, no competing non-partial systems |
| `extract-partition-and-consolidate` | Disaggregation + competing systems |

Pattern tags are colour-coded: green (inherit), blue (consolidate), red (extract), purple (extract + consolidate).

---

## Tier system and promotion

`DEFAULT_TIER_MAP` maps ESD function IDs to tiers 1/2/3 based on statutory and operational criticality.

`computeEffectiveTier()` applies a promotion rule: if the default tier is 3 and any system's contract notice period triggers before the vesting date, the function is promoted to Tier 2. This ensures commercially urgent services are not deprioritised in the matrix sort order.

---

## Vesting zone classification

`classifyVestingZone(endYear, endMonth, noticePeriod, vestingDate)` classifies a system's contract position relative to vesting:

| Zone | Condition | Implication |
|---|---|---|
| `pre-vesting` | Notice trigger before vesting | Predecessor must act now |
| `year-1` | Notice trigger within 12 months of vesting | Successor handles in first year |
| `natural-expiry` | Notice trigger within 12–36 months of vesting | Natural renewal window |
| `long-tail` | Notice trigger 36+ months after vesting | No imminent action needed |

---

## TCoP assessment

`computeTcopAssessment(system)` evaluates each system against five UK Government Technology Code of Practice points:

| Point | Check | Alignment | Concern |
|---|---|---|---|
| 5 — Cloud first | `isCloud` | true | false |
| 4 — Open standards | `portability` | High | Low |
| 3, 4, 11 — Vendor lock-in | `portability` | — | Low (triple concern) |
| 9 — Modularity | `isERP && dataPartitioning` | — | ERP + Monolithic |

Returns `{ alignments: [{point, description}], concerns: [{point, description}] }`.

---

## Anchor system detection

Within `renderDashboard()`, for each function row: systems are sorted by `users` descending. If `top.users >= second.users * 1.5` and `top.users > 0`, that system is declared the anchor for the row. The yellow badge and border are applied in `buildSystemCard()`. This is a proportionality indicator only — a visual signal, not a migration recommendation.

---

## System card rendering (`buildSystemCard()`)

Cards are persona-aware. Conditional field groups:

- **Commercial / Executive**: renders cost, contract expiry, and notice period
- **Architect / Executive**: renders cloud/on-prem tag, portability, and data layer

Additional badges:
- **Anchor System** — yellow badge for user-volume dominant systems
- **ERP** — red-bordered warning for enterprise resource planning systems
- **Shared Service** — indicator showing which councils share the system
- **Financial Distress** — risk warning if the source council has `financialDistress: true`
- **Cross-tier** — indicator when systems from different council tiers collide

---

## Contract timeline (`drawTimeline()`)

### Date range
- **With vesting date** (transition mode): centres on vesting date; range = vesting year - 2 to vesting year + 4
- **Without vesting date** (discovery mode): fixed 2024–2030

### Rendering
- Year markers along the horizontal axis
- Vesting date vertical line (dashed red) with label
- Bar per system, width proportional to contract end date
- Notice zone striped overlay (red/white 45-degree stripes)
- Bar colour indexed by council position in sorted council array

### Perspective filtering
- In transition mode: uses `successorAllocationMap` to determine which systems belong to the selected successor perspective; matching systems at full opacity, others dimmed to 0.3
- In discovery mode: matches by `_sourceCouncil` name

The timeline is hidden for the Architect persona.

---

## Estate summary metrics

`computeEstateSummaryMetrics()` computes:

| Metric | Scope |
|---|---|
| Predecessor count | Always |
| System count | Always (filtered by perspective) |
| Collision count | Always |
| Total annual spend | When `annualCost` data is available |
| Pre-vesting notice triggers | When vesting date is set |
| Disaggregation count | Transition mode only |
| Monolithic disaggregation count | Transition mode only |
| Cross-boundary shared services | Transition mode only |
| Critical path systems | When vesting date is set |

---

## Critical path panel

`renderCriticalPathPanel()` renders a table of systems whose contract notice period triggers before the vesting date, sorted by trigger date. Shown only for the Executive persona. Includes status badges:
- **OVERDUE** (red) — trigger date has already passed
- **URGENT** (orange) — trigger date within 6 months

---

## Modals

Six modal overlays, all using the same pattern (`fixed inset-0 bg-black bg-opacity-50 hidden flex z-50` with `border-t-8 border-[#1d70b8]` panel, close button, click-outside-to-close):

1. **Glossary** — domain terminology organised in 5 sections (Transition Concepts, System Properties, Analysis Signals, Rationalisation Patterns, Governance & Compliance); accessible via header button
2. **Signal Options** — radio groups per signal for weight selection; Apply & Refresh; Reset to Persona Defaults
3. **Tier Mapping** — shows which ESD functions fall into Tier 1/2/3 with explanations
4. **Analysis Detail** — dynamic content for a selected function cell; shows full signal breakdown, pattern, systems, and TCoP assessment
5. **Documentation** — explanation modals for complex logic (signals, patterns, TCoP, tiers, perspectives, personas, timeline); triggered by (?) help icons
6. **Architecture Editor** — full-screen visual editor for council JSON data with 4 tabs (Council Info, Functions, IT Systems, Edges); Apply Changes + Export JSON

---

## Inline documentation

### Domain term tooltips
`DOMAIN_TERMS` defines rich tooltip content for 16 key terms (Anchor System, Notice Period Action Zone, Vendor Density, Collision, Rationalisation Pattern, TCoP, Portability, Data Layer, Tiers, Vesting Date, Cross-tier, ERP, Shared Service, ESD Function). `wrapWithTooltip()` renders these as dotted-underline spans with hover/focus tooltips.

### Help icons
`helpIcon(docKey)` renders a (?) icon that opens the documentation modal with content from the `DOCUMENTATION` constant. Applied next to: perspective dropdown, persona selector, estate summary metrics, signal strip, timeline section, tier badges.

### Explanation modals
The `DOCUMENTATION` constant contains structured content for 7 topics: signal computation methodology, rationalisation pattern decision tree, TCoP assessment criteria, tier classification rules, perspective filtering, persona descriptions, and timeline interpretation.

---

## Export capabilities

- **Transition config export** — downloads `transition-config.json` from Stage 1.5
- **HTML export** — self-contained HTML file with embedded analysis data from Stage 3
- **Architecture JSON export** — from the architecture editor modal

---

## Known constraints

- No live data connections; all data must be prepared as JSON manually
- No data confidence annotation; field values are treated as equivalent regardless of verification status
- Linear search for taxonomy lookup: `getLgaFunction()` uses `Array.find()` over 176 entries — acceptable at this scale
- Data is self-reported by councils; the engine performs no validation of the values themselves
- User counts may not be comparable across councils (concurrent vs named vs total users)
