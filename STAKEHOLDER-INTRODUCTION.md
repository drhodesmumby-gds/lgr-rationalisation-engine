# LGR Transition Workspace Engine — Stakeholder Introduction

## The problem this tool addresses

When English local authorities merge under Local Government Reorganisation, the combined IT estate of the predecessor councils must be rationalised. This is harder than it looks.

Each council has different systems doing the same jobs, often with different names. Contracts have fixed end dates and notice periods that create legal deadlines entirely independent of programme timelines. Some systems hold data that cannot easily be extracted or split across successor authorities. Shared services that span council boundaries must be unwound or re-contracted. And different members of the programme team — executive, commercial, architecture — need to see the same data through different lenses at different levels of detail.

Before this tool, this analysis was typically done in spreadsheets. Data was inconsistent, insights were manual, and different teams were working from different versions of the truth. The result was that contract deadlines were missed, consolidation opportunities were not identified early enough, and programme boards lacked a shared baseline.

---

## What this tool is

The LGR Transition Workspace Engine is a browser-based tool that takes structured IT landscape data from each predecessor council, merges it into a single baseline, models the transition structure (which predecessors vest into which successors), and presents a configurable analysis matrix with rationalisation patterns for programme, commercial, and architecture teams.

It does not require installation, a server, or any technical infrastructure. Open `lgr-rationalisation-engine.html` in a browser and it runs immediately.

---

## How it works

The tool operates in four stages.

### Stage 1 — Ingest

Each participating council exports a structured description of their IT systems: which systems they run, what services those systems support, what their contracts look like, and key technical characteristics. These are uploaded as JSON files.

The engine accepts any number of council files simultaneously and merges them into a unified workspace. If a transition configuration file is included alongside the architecture files, it is automatically detected and applied at the next stage. A built-in demo loads example data without requiring file preparation.

Each uploaded file can be inspected and modified using the built-in **visual architecture editor** before proceeding.

### Stage 1.5 — Transition structure

This stage defines *how* the predecessor councils will reorganise into successor authorities:

- **Vesting date** — the legal date on which the new unitary authorities come into existence
- **Successor authorities** — each named successor with its assigned predecessors:
  - **Full predecessors** — the entire estate of a council transfers to one successor
  - **Partial predecessors** — a council's estate must be split across multiple successors (disaggregation)

The tool validates that every council is accounted for and that assignments are consistent. Transition configurations can be imported from and exported to JSON files for reuse across sessions.

This stage can be skipped to use **Estate Discovery mode** — a simpler cross-council comparison without transition modelling.

### Stage 2 — Taxonomy alignment

This is the critical reconciliation step. Different councils will call the same service different things: "Refuse Operations", "Waste Collection", and "Household Waste" might all refer to the same statutory function. Without a common reference, comparing councils is unreliable.

The engine resolves each council's functions against the **LGA/ESD Standard Function Taxonomy** — a nationally agreed list of 176 local government service functions published by the Local Government Association. Functions that share the same ESD identifier are grouped into a single row in the analysis matrix, regardless of how each council labels them locally.

The stage reports:

- How many functions appear in two or more councils — these require a rationalisation decision
- How many are unique to one council — these can be inherited on Day 1 without conflict

Any function that cannot be matched to the national taxonomy is flagged and excluded from analysis, making gaps in data quality visible rather than hiding them.

### Stage 3 — Dashboard

The main output: a matrix with every function as a row and every successor authority (or predecessor council, in discovery mode) as a column. Each cell shows which system (or systems) will serve that function for that successor, along with relevant metadata.

The matrix includes:
- **Sticky headers** so column labels remain visible while scrolling
- **Sort and filter controls** — sort by tier priority, collision count, or name; filter by tier or collision status
- **Estate summary** — total systems, collisions, annual spend, pre-vesting triggers, disaggregation count
- **Rationalisation patterns** — each function row is classified and colour-tagged
- **Analysis column** — configurable signals, TCoP assessment, and persona-specific insight questions
- **Critical path panel** — pre-vesting contract decisions requiring immediate action
- **Contract timeline** — centred on the vesting date, with notice period zones striped in red
- **Perspective filtering** — view the entire estate or filter to a specific successor authority's view

---

## Rationalisation patterns

In transition mode, every function row is classified into one of four patterns:

**Inherit as-is** — only one system serves this function across all predecessors. No rationalisation decision needed; focus on contract novation to the successor authority.

**Choose and consolidate** — multiple systems from different councils serve the same function, but none require disaggregation. The successor must choose which system to retain and plan decommissioning of the others.

**Extract and partition** — a system serving this function must be split across multiple successors because the owning council is a partial predecessor. Data extraction and partitioning is required.

**Extract, partition and consolidate** — the most complex case. A system must be split across successors AND the receiving successor also has competing systems from other predecessors. Requires both disaggregation and consolidation planning.

---

## The signal system

Rather than prescribing conclusions, the tool surfaces configurable signals. Each signal is a factual observation derived from the data:

| Signal | What it tells you |
|---|---|
| **Contract urgency** | How soon the earliest notice period trigger fires, classified relative to the vesting date — is action needed before the new authority exists, in its first year, or later? |
| **User volume** | Which system is largest by user count, and by what margin — identifying the "anchor" system that minimises disruption if adopted |
| **Monolithic data** | Systems with highly entangled data that would require complex extraction work before migration or disaggregation |
| **Data portability** | Systems where bulk data extraction is difficult — proprietary formats, vendor lock-in, or no open API |
| **Vendor density** | Where the same vendor appears across multiple councils for the same function — a potential consolidation or renegotiation opportunity |
| **On-premise systems** | Systems running on council servers rather than in the cloud — hosting and support must transfer |
| **TCoP alignment** | How well each system aligns with the UK Government Technology Code of Practice across five key points (spend controls, open standards, cloud first, modularity, commercial) |
| **Shared service** | Systems shared across council boundaries that will need unwinding or re-contracting during transition |

Each signal has a weight that controls how prominently it appears: **High** (colour-coded badge, prominent display), **Medium** (visible with label), **Low** (small grey note), or **Off** (hidden). Weights can be adjusted in the Signal Options panel to suit the current meeting or decision context. Changing persona resets weights to that persona's defaults.

---

## The three personas

Three role-based views are available over the same underlying data. Switching persona changes which signals are prominent — the data itself does not change.

### Executive / Transition Board

Emphasises contract urgency, data entanglement, user volume, and shared service risks. Includes a **critical path panel** highlighting contracts that must be resolved before vesting day.

Primary questions: *What must be resolved before vesting day? Where is the highest operational risk? Which shared services cross successor boundaries?*

### Commercial / Transition Director

Emphasises notice periods, vendor density, and shared services. Designed to support procurement strategy, contract renegotiation, and shared service unwinding.

Primary questions: *Where can we consolidate vendor agreements before migration begins? Which contracts expose us to auto-renewal if we miss the notice window? Which shared services require re-contracting?*

### Enterprise Architect (CTO)

Emphasises monolithic data, portability risk, on-premise systems, and Technology Code of Practice alignment. Designed for technical due diligence and migration sequencing.

Primary questions: *Where will data disaggregation be hardest? Which systems carry the most technical risk? Where are we locked in to proprietary platforms?*

---

## The tier system

Functions are classified into three priority tiers:

| Tier | Label | What it means |
|---|---|---|
| **Tier 1** | Day 1 Critical | Statutory and safeguarding services that must be operational on vesting day (adult social care, children's services, benefits, finance, HR, environmental health) |
| **Tier 2** | High Priority | Services that should be resolved within the first year (highways, planning, housing, public transport) |
| **Tier 3** | Post-Day 1 | Services that can be addressed after the initial transition period (libraries, leisure, arts, tourism) |

The tool applies an automatic **tier promotion rule**: if a Tier 3 function has a contract notice period that triggers before vesting day, it is promoted to Tier 2. This prevents commercially urgent services from being deprioritised simply because the service category is not statutory.

---

## The contract timeline

The Executive and Commercial views include a contract expiry timeline centred on the vesting date. Each system with a known contract date appears as a coloured bar, colour-coded by predecessor council.

The **striped red zone** on each bar represents the mandatory notice period. Action must be taken before the striped zone begins — once inside the notice window, avoiding auto-renewal requires immediate engagement with the vendor.

When a specific successor perspective is selected, systems allocated to that successor are shown at full opacity while others are dimmed, making it easy to see that successor's contract landscape at a glance.

---

## The critical path panel

For the Executive persona, a dedicated panel below the matrix highlights **pre-vesting contract decisions** — systems whose notice period triggers before the vesting date, sorted by urgency. Each entry shows the system, vendor, predecessor council, notice trigger date, and months remaining. Entries are badged as **OVERDUE** (trigger date passed) or **URGENT** (trigger within 6 months).

---

## Anchor system indicator

Where one system has significantly more users than any other (at least 50% more), it is marked with an **Anchor System** badge. This is a proportionality indicator: it identifies the system with the most gravitational weight — the system that, all else being equal, minimises disruption if adopted as the migration target for that function. It is one signal among many, not a recommendation.

---

## TCoP assessment

Each system is assessed against five points from the UK Government Technology Code of Practice:

| Point | What is checked |
|---|---|
| **Point 3** — Spend controls | Does the system's portability create spend risk through vendor lock-in? |
| **Point 4** — Open standards | Does the system use open APIs and standard data formats? |
| **Point 5** — Cloud first | Is the system cloud-hosted or on-premise? |
| **Point 9** — Modularity | Is the system a monolithic ERP with entangled data? |
| **Point 11** — Commercial | Does the commercial arrangement risk lock-in? |

This gives architecture and commercial teams a quick alignment check against national technology standards during system selection.

---

## What data is required

Each council prepares a JSON file describing their IT estate. The key information per system is:

- System name and vendor
- Which service function it supports (referenced against the ESD taxonomy)
- Number of users
- Annual cost
- Contract expiry date and notice period in months
- Portability rating — High (open API), Medium (batch/CSV), Low (proprietary lock-in)
- Data layer — Segmented (cleanly partitionable) or Monolithic (entangled, requires ETL)
- Whether the system is cloud-hosted or on-premise
- Whether it is an ERP system
- Which other councils share the system (if applicable)

Additionally, the council's **tier** (county/district/borough/unitary) and **financial distress** status can be specified. Councils in financial distress have their systems flagged with risk warnings throughout the analysis.

A separate transition configuration file defines the vesting date and successor authority structure.

Data is self-reported by councils. The engine does not validate field values — it surfaces what it is given. Data quality is the responsibility of the contributing council.

---

## Example scenarios

The tool ships with 10 curated example scenarios in the `examples/` directory, ranging from simple two-council mergers to complex seven-council disaggregations:

| Scenario | What it demonstrates |
|---|---|
| **Simple district merger** | Two districts merging — the simplest possible transition |
| **County absorbs districts** | County council absorbing three districts; county systems as natural anchors |
| **Shared service unwinding** | Three councils with shared services that must be untangled |
| **Financial distress rescue** | A distressed borough merged with a stable district; risk propagation |
| **ERP entanglement trap** | Monolithic ERP spanning multiple functions across three councils |
| **Asymmetric disaggregation** | County splitting across four districts with uneven service allocation |
| **Cloud-first modernisation** | Modern cloud stack meets legacy on-premise — TCoP contrast |
| **Mega-merger (6 councils)** | Large-scale merger into three successor unitaries |
| **Pre-allocated systems** | Systems with explicit `targetAuthorities` overrides |
| **Extreme fragmentation** | Seven councils disaggregating into three successors with maximum complexity |

Each scenario includes council architecture files, a transition configuration, and a README explaining what it tests.

---

## Export capabilities

- **Transition configuration** — export and import the transition structure as JSON, enabling reuse across sessions and sharing between team members
- **HTML export** — generate a self-contained HTML file of the full analysis from Stage 3
- **Architecture JSON** — export modified architecture data from the visual editor

---

## Current limitations

- Data is self-reported by councils; the engine performs no validation of the values themselves
- User counts may not be comparable across councils (concurrent vs named vs total users)
- No data confidence annotation — field values are treated as equivalent regardless of whether they are verified, assumed, or estimated
- No live data connections; all data must be prepared as JSON manually
- The anchor system badge is a proportionality indicator, not a migration recommendation

---

## What this demonstrates

This tool demonstrates several things that are difficult to achieve with spreadsheets:

- **Taxonomy-grounded reconciliation**: two councils calling the same service different things appear in the same matrix row automatically, without manual alignment
- **Transition-aware analysis**: the matrix adapts to show each successor authority's estate, with disaggregation and rationalisation patterns classified automatically
- **Cross-council contract visibility**: notice period deadlines across the entire combined estate are visible in a single timeline, centred on the vesting date
- **Shared service boundary detection**: systems shared across councils are automatically checked for successor boundary crossings that require unwinding
- **Role-appropriate emphasis**: the same baseline data is presented differently for different audiences without maintaining separate documents
- **Signal configurability**: the analysis is not a fixed verdict — practitioners can adjust emphasis to match the current decision or meeting context
- **TCoP alignment checking**: systems are automatically assessed against the Technology Code of Practice, giving immediate governance visibility
- **Automatic priority adjustment**: tier promotion ensures commercially urgent services are not hidden in a low-priority tier
