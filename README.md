# LGR Transition Workspace Engine

A single-file, browser-based tool for analysing the combined IT estate of merging English local authorities during Local Government Reorganisation (LGR). It ingests council architecture exports, reconciles them against the LGA/ESD Standard Function Taxonomy, models transition structures (predecessor-to-successor mappings and vesting dates), and renders a configurable signal matrix with rationalisation patterns for programme, commercial, and architecture audiences.

## Getting started

Open `lgr-rationalisation-engine.html` in any modern browser. No build step, no server, no dependencies to install. Tailwind CSS loads from CDN; the LGA/ESD taxonomy (176 functions) is embedded.

Sample datasets are included — see [Sample datasets](#sample-datasets) and [Example scenarios](#example-scenarios).

---

## Data format

Each council prepares a JSON file following the schema below. The engine enforces this schema strictly: function nodes missing `lgaFunctionId` are excluded from analysis and flagged in Stage 2.

### Top-level structure

```json
{
  "councilName": "Northshire County",
  "councilMetadata": {
    "tier": "county",
    "financialDistress": false
  },
  "nodes": [ ...function and system nodes... ],
  "edges": [ ...REALIZES relationships... ]
}
```

| Field | Type | Description |
|---|---|---|
| `councilName` | string | Display name for the council |
| `councilMetadata.tier` | `"county"` / `"district"` / `"borough"` / `"unitary"` | Council tier classification; used for cross-tier collision detection |
| `councilMetadata.financialDistress` | boolean | Optional. If `true`, systems from this council are flagged with a risk warning |

### Function node

```json
{
  "id": "local-unique-id",
  "label": "Adult Social Care",
  "type": "Function",
  "lgaFunctionId": "148"
}
```

`lgaFunctionId` must be a valid identifier from the [LGA/ESD Standard Function Taxonomy](https://webservices.esd.org.uk/lists/functions). The engine uses this to group functions across councils — two councils that call the same service different things will appear in the same matrix row if they share an ESD ID. Any valid level of the hierarchy is accepted; the breadcrumb (`Parent > Label`) is shown in the matrix for functions more than one level below a root category.

### ITSystem node

```json
{
  "id": "local-unique-id",
  "label": "Liquidlogic LAS",
  "type": "ITSystem",
  "vendor": "System C",
  "users": 3500,
  "cost": "£950k/yr",
  "annualCost": 950000,
  "endYear": 2028,
  "endMonth": 3,
  "noticePeriod": 12,
  "portability": "Medium",
  "dataPartitioning": "Segmented",
  "isCloud": true,
  "isERP": false,
  "sharedWith": ["Easton District Council"],
  "targetAuthorities": ["North Essex Unitary"]
}
```

| Field | Type | Description |
|---|---|---|
| `vendor` | string | Software vendor name |
| `users` | number | Reported user count (concurrent, named, or total — be consistent within an exercise) |
| `cost` | string | Annual operating cost (display only) |
| `annualCost` | number | Annual cost as a number; used for estate spend calculations |
| `endYear` / `endMonth` | number | Contract expiry date |
| `noticePeriod` | number | Months of notice required before expiry |
| `portability` | `"High"` / `"Medium"` / `"Low"` | Data extraction capability: High = open API/native interop; Medium = batch/CSV/SQL; Low = proprietary lock-in |
| `dataPartitioning` | `"Segmented"` / `"Monolithic"` | Whether data can be cleanly partitioned (e.g. by ward/department) or is entangled across domains |
| `isCloud` | boolean | SaaS / cloud-hosted vs on-premise |
| `isERP` | boolean | Enterprise Resource Planning system (triggers additional monolithic risk treatment) |
| `sharedWith` | string[] | Optional. Other council names sharing this system instance; triggers shared service analysis |
| `targetAuthorities` | string[] | Optional. Explicit successor authority assignment; overrides default allocation logic |

### Edge

```json
{ "source": "system-id", "target": "function-id", "relationship": "REALIZES" }
```

One or more systems can REALIZE the same function within a council (e.g. an ERP covering both finance and HR appears in two rows).

### Transition configuration

A separate JSON file can define the transition structure:

```json
{
  "vestingDate": "2027-04-01",
  "successors": [
    {
      "name": "North Essex Unitary",
      "fullPredecessors": ["Braintree District Council"],
      "partialPredecessors": ["Essex County Council"]
    }
  ]
}
```

Transition configs can be imported at Stage 1.5, or uploaded alongside architecture files at Stage 1 (the engine detects and separates them automatically).

---

## Application stages

### Stage 1 — Ingest

Upload one or more council JSON files. The engine parses and stages them for baselining. If a transition configuration file is included in the upload, it is automatically detected and applied at Stage 1.5. The built-in demo loads sample councils automatically.

Each staged file offers an **Edit Architecture** button opening a visual editor for modifying council data before proceeding.

### Stage 1.5 — Transition Structure Configuration

Define the successor authorities and vesting date for transition planning analysis. This stage enables the engine to analyse the estate from each successor's perspective.

- **Vesting date** — the legal date successor authorities come into existence
- **Successor authorities** — each with a name and predecessor assignments:
  - **Full predecessors** — entire estate transfers to this successor
  - **Partial predecessors** — estate must be split across multiple successors (disaggregation)
- **Detect from architecture** — auto-discovers councils from uploaded files
- **Import/Export configuration** — round-trip transition structure as JSON

Skip this stage to use **Estate Discovery mode** (flat cross-council comparison without transition modelling).

### Stage 2 — LGA Function Taxonomy Alignment

`runBaselining()` merges all uploads into a unified graph. For each `Function` node, it looks up the `lgaFunctionId` in the embedded `LGA_FUNCTIONS` taxonomy and groups councils that share the same ESD ID into a single `lgaFunctionMap` entry. Schema errors (missing `lgaFunctionId`) are surfaced here.

The stage shows:
- **Functions appearing in 2+ councils** — cross-council collision candidates requiring rationalisation decisions
- **Functions unique to one council** — no collision, safe Day 1 inheritance

### Stage 3 — Dashboard

`renderDashboard()` builds the restructure matrix. In **transition mode**, columns represent successor authorities; in **discovery mode**, columns represent predecessor councils. Each row is driven by `lgaFunctionMap`.

Features:
- **Sticky headers** — table header and first column remain visible during scroll
- **Sort controls** — tier priority (default), collision count, alphabetical, contract urgency
- **Filter controls** — by tier (1/2/3), by collision status (all/collisions only/unique only)
- **Estate summary panel** — predecessor count, system count, collisions, annual spend, pre-vesting triggers, disaggregation count
- **Analysis column** — rationalisation patterns, configurable signals, TCoP assessment, persona-specific insight questions
- **Critical path panel** — pre-vesting contract decisions requiring immediate action (Executive persona)
- **Contract timeline** — all systems with contract dates, centred on the vesting date, with notice period zones striped in red
- **Perspective filtering** — view the estate through a specific successor's lens; non-relevant systems are dimmed

---

## The signal system

The analysis column surfaces **neutral, factual observations** rather than prescriptive verdicts. Each signal has a configurable weight that controls visibility and prominence.

### Signals

| Signal | ID | What it measures |
|---|---|---|
| Contract urgency | `contractUrgency` | Months until the earliest notice period trigger; classified by vesting zone (pre-vesting / year-1 / natural-expiry / long-tail) |
| User volume | `userVolume` | Relative user counts — which system is largest and by what ratio |
| Monolithic data | `dataMonolith` | Presence of systems with entangled data that would require ETL disaggregation |
| Data portability | `dataPortability` | Low/Medium portability systems that pose data extraction challenges |
| Vendor density | `vendorDensity` | Same vendor appearing across multiple councils for this function |
| On-premise systems | `techDebt` | Systems hosted on council servers rather than cloud/SaaS |
| TCoP alignment | `tcopAlignment` | Assessment against the Technology Code of Practice (Points 3, 4, 5, 9, 11) |
| Shared service | `sharedService` | Systems shared across council boundaries requiring unwinding or re-contracting |

### Weight levels

| Weight | Display behaviour |
|---|---|
| **Off** (0) | Signal not shown |
| **Low** (1) | Small grey note at bottom of cell |
| **Med** (2) | Plain text with label, no badge |
| **High** (3) | Coloured badge + bordered text block |

Access the Signal Options panel via the **Signal Options** button in the header controls (visible in Stage 3).

### Per-persona defaults

Changing persona resets signal weights to that persona's defaults:

| Signal | Executive | Commercial | Architect |
|---|---|---|---|
| Contract urgency | High | High | Low |
| User volume | Med | Low | Med |
| Monolithic data | High | Low | High |
| Data portability | Low | Off | High |
| Vendor density | Med | High | Low |
| On-premise | Low | Off | High |
| TCoP alignment | Low | Off | High |
| Shared service | Med | High | Low |

---

## Rationalisation patterns

In transition mode, each function row is classified into one of four rationalisation patterns based on the system allocations:

| Pattern | Condition | Action |
|---|---|---|
| **Inherit as-is** | Single system, no disaggregation | Contract novation only |
| **Choose & consolidate** | Multiple systems, no disaggregation | Select target system; decommission others |
| **Extract & partition** | Disaggregation present, no competing systems | Split system data across successors |
| **Extract, partition & consolidate** | Disaggregation + competing systems | Split AND consolidate within each successor |

Signal emphasis adjusts automatically per pattern — extract patterns boost data signals; consolidate patterns boost user/vendor signals.

---

## Tier system

Functions are classified into three priority tiers based on statutory and operational criticality:

| Tier | Label | Examples |
|---|---|---|
| **Tier 1** | Day 1 Critical | Adult social care, children's services, benefits, finance, HR, environmental health |
| **Tier 2** | High Priority | Highways, planning, housing, public transport, community safety |
| **Tier 3** | Post-Day 1 | Libraries, leisure, arts, tourism, museums, parks |

**Tier promotion rule**: Tier 3 functions are automatically promoted to Tier 2 if any system's contract notice period triggers before the vesting date — ensuring commercially urgent services are not deprioritised.

---

## The three personas

| Persona | Default emphasis | Primary questions |
|---|---|---|
| **Executive / Transition Board** | Contract urgency, monolithic data, user volume, shared services | What must we resolve before vesting day? Where is the highest operational risk? |
| **Commercial / Transition Director** | Contract urgency, vendor density, shared services | Where can we renegotiate before migration? Which contracts expose us to auto-renewal? |
| **Enterprise Architect** | Monolithic data, data portability, on-premise, TCoP alignment | Where will data disaggregation be hardest? Which systems carry the most technical risk? |

---

## TCoP assessment

Each system is assessed against five points from the UK Government Technology Code of Practice:

| Point | What is checked |
|---|---|
| **Point 3** — Spend controls | Low portability triggers spend concern |
| **Point 4** — Open standards | Portability rating (High = alignment, Low = concern) |
| **Point 5** — Cloud first | `isCloud` flag |
| **Point 9** — Modularity | ERP + Monolithic data flags a modularity concern |
| **Point 11** — Commercial | Low portability triggers vendor lock-in concern |

---

## Codebase reference

The entire application is in `lgr-rationalisation-engine.html`. There is no build system.

### Key state variables

| Variable | Description |
|---|---|
| `rawUploads[]` | Parsed council JSON payloads |
| `mergedArchitecture` | Unified graph `{nodes, edges, councils}` after baselining |
| `lgaFunctionMap` | `Map<lgaFunctionId, {lgaId, label, breadcrumb, councils: Set, localNodeIds: Set}>` — drives matrix rows |
| `activePersona` | `"executive"` \| `"commercial"` \| `"architect"` |
| `activePerspective` | `"all"`, a council name, or a successor name |
| `signalWeights` | Current weight values per signal; reset to persona defaults on persona change |
| `transitionStructure` | `{vestingDate, successors[]}` or null |
| `operatingMode` | `"discovery"` \| `"transition"` |
| `successorAllocationMap` | `Map<successorName, Map<lgaFunctionId, SystemAllocation[]>>` or null |
| `tierMap` | `Map<lgaFunctionId, 1\|2\|3>` — playbook tier per function |
| `councilTierMap` | `Map<councilName, "county"\|"district"\|...>` — council tier classification |
| `distressedCouncils` | `Set<councilName>` — councils with `financialDistress: true` |
| `activeSortMode` | `"tier"` \| `"name"` \| `"collision"` — current sort order |
| `activeFilters` | `{tier, collision}` — current filter state |

### Key functions

| Function | Description |
|---|---|
| `runBaselining()` | Merges uploads into `mergedArchitecture`, builds `lgaFunctionMap`, validates schema |
| `renderDashboard()` | Iterates `lgaFunctionMap` and builds the matrix table; handles both transition and discovery modes |
| `buildSuccessorAllocation()` | Maps systems to successor authorities based on transition structure |
| `classifyRationalisationPattern()` | Classifies function rows into one of four rationalisation patterns |
| `computeSignals()` | Computes all active signals for a set of systems |
| `computeTcopAssessment()` | Evaluates a system against TCoP points 3, 4, 5, 9, 11 |
| `computeEffectiveTier()` | Returns tier with promotion rule (Tier 3 → 2 if notice triggers pre-vesting) |
| `classifyVestingZone()` | Classifies a system's notice trigger as pre-vesting / year-1 / natural-expiry / long-tail |
| `computeEstateSummaryMetrics()` | Computes estate-wide metrics for the summary panel |
| `renderCriticalPathPanel()` | Renders pre-vesting contract decisions table (Executive persona) |
| `buildSystemCard()` | Renders per-system metadata card with badges and risk flags |
| `buildPersonaAnalysis()` | Calls `computeSignals()` and renders the analysis cell with persona-specific insight questions |
| `drawTimeline()` | Renders the contract expiry timeline centred on vesting date |
| `renderTransitionConfigPanel()` | Renders the Stage 1.5 transition configuration UI |
| `exportToHTML()` | Exports the full analysis as a self-contained HTML file |
| `getLgaFunction(id)` | Looks up an ESD function by ID in `LGA_FUNCTIONS` |
| `getLgaBreadcrumb(id)` | Returns `"Parent > Label"` for grandchild functions, null for direct children of root |

### LGA_FUNCTIONS

Embedded JS constant of all 176 ESD taxonomy entries: `{id: string, label: string, parentId: string|null}`. Source: `https://webservices.esd.org.uk/lists/functions`. Last modified 2016-09-01. The taxonomy is stable; update by re-fetching the API and regenerating the constant.

---

## Sample datasets

Five original development sample files are in `examples/00-legacy-samples/`:

| File | Scenario |
|---|---|
| `northshire-county.json` | County council with Oracle ERP monolith (8,000 users), System C vendor density across ASC and Children's |
| `easton-district.json` | District with Unit4 ERP monolith; shares NEC Revenues with Southby |
| `southby-borough.json` | Borough with a long-term waste contract (2032 expiry, 12-month notice); shares NEC Revenues with Easton |
| `westampton-district.json` | Modular cloud stack (Xero + Workday); Idox Planning collision with Southby |
| `test-complex-lgr.json` | Asymmetric disaggregation: Council A splits services across three successor unitaries; social care system is monolithic, requiring disaggregation |

---

## Example scenarios

The `examples/` directory contains 10 curated scenarios, each in its own subfolder with council architecture files, a transition configuration, and a README:

| Scenario | Description | Councils |
|---|---|---|
| `01-simple-district-merger` | Two districts merging into a single unitary — simplest possible transition | 2 |
| `02-county-absorbs-districts` | County council absorbing three districts; county systems become anchors | 4 |
| `03-shared-service-unwinding` | Three councils with shared service contracts that must be unwound during transition | 3 |
| `04-financial-distress-rescue` | Borough in financial distress merged with a stable district; risk flags throughout | 2 |
| `05-erp-entanglement-trap` | County ERP monolith spanning finance, HR, and payroll entangled across three councils | 3 |
| `06-asymmetric-disaggregation` | County disaggregating across four districts with asymmetric service allocation | 5 |
| `07-cloud-first-modernisation` | Modern cloud-first district merging with legacy on-premise borough | 2 |
| `08-mega-merger-six-councils` | Large-scale merger of one county and five districts into three successor unitaries | 6 |
| `09-already-allocated` | Pre-allocated systems using `targetAuthorities` overrides | 3 |
| `10-extreme-fragmentation` | Seven councils (county + six districts) disaggregating into three successors with maximum complexity | 7 |

Each scenario can be loaded by uploading all files (architecture JSONs + transition config) simultaneously at Stage 1.

---

## Known limitations

- Data is self-reported by councils; the engine performs no validation of the values themselves
- User counts may not be comparable across councils (concurrent vs named vs total users)
- The anchor system badge (>50% user volume margin) is a visual indicator only — it is one signal, not a migration recommendation
- No live data connections; all data must be prepared as JSON manually
- No data confidence annotation: field values are treated as equivalent regardless of whether they are verified, assumed, or estimated
- Linear search for taxonomy lookup: `getLgaFunction()` uses `Array.find()` over 176 entries — acceptable at this scale
