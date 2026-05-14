# LGR Transition Workspace Engine — Development Roadmap

This document charts the future development direction for the LGR Rationalisation Engine. It is structured around three pillars: deepening the data model to reflect real-world transition complexity, aligning with UK government reference frameworks, and expanding analytical capabilities.

Items are grouped by horizon:

- **Near-term** — next 2–3 development sprints; address immediate capability gaps
- **Medium-term** — next 3–6 months; significant schema or analysis additions
- **Long-term** — strategic direction; may depend on external partnerships or production deployment

---

## Current State (May 2026)

### Recently completed

| Feature | Sprint(s) | Description |
|---|---|---|
| **Tabbed navigation** | nav-1 through nav-3 | Stage 3 redesigned from vertical scroll to fixed-viewport tabbed layout (Matrix, Overview, Timeline) with sticky headers and independent scroll per tab |
| **Simulation side panel** | nav-2 | Right-docked collapsible panel (360px) persisting across tabs with decision summary, progress, metrics, and undecided function list |
| **Sankey overlay** | nav-3 | Flow diagram moved from inline to full-viewport-width on-demand overlay accessible from side panel |
| **Collapsible system cards** | cards-1 | Default collapsed single-line view, click to expand, "Expand all" per cell, deliberate collapse action |
| **Capability model redesign** | capabilities-1/2/3/4 | LGAM-aligned: CONSUMES_CAPABILITY edge type, capability dependency graph, blast radius preview, scoped edge-severing projector, contextual boundary options, grouped-by-complexity decision UX |
| **Baseline estate report** | baseline-report | Pre-simulation report for all 3 personas (estate profile, tier distribution, critical path, per-successor, risk indicators) |
| **Decision panel redesign** | sim-decisions | Two-column layout (systems left, options right), cross-successor decision visibility, "Choose same" shortcut, migration complexity badges, contextual boundary filtering |
| **Scenario management** | scenario-mgmt | JSON export/import, auto-detect at Stage 1, impact reconstructed from decisions |
| **Persona-tailored reports** | report-export | Executive, Commercial, Architect reports with procurement timeline, posture narrative, obligation tables |
| **Import wizard** | import-wizard | CSV/Excel with auto-column-detection, clipboard paste, guided manual entry, ESD function suggestions, CONSUMES_CAPABILITY edge import |
| **Quick wins (testing phase)** | quick-wins | Critical path for Commercial persona, aria-labelledby on tabs, orange contrast fixes, tier sort for undecided functions |

### Near-term backlog

| Item | Priority | Description |
|---|---|---|
| **Per-successor metrics breakdown** | High | Side-by-side comparison in Overview tab — allocation map has data, needs aggregation and display |
| **RAG synthesis** | High | Red/Amber/Green per-successor programme governance status from decision progress, pre-vesting triggers, Tier 1 undecided count |
| **Days-until-vesting countdown** | Medium | Add to estate summary — "347 days until vesting" more impactful than "2027-04-01" |
| **Legacy modal ARIA upgrade** | Medium | 6 older modals (Glossary, Signal Options, Tier Mapping, Analysis, Documentation, Architecture Editor) need role="dialog", aria-modal, focus trap, Escape key |
| **Capability fate options** | Medium | When all functions a capability-bearing system serves are decided away, surface decouple/decommission/migrate options (currently informational only) |
| **Cross-successor shared service propagation visibility** | Medium | When one successor establishes a shared service, the other successor's panel should show awareness of the proposal |

### Strategic context

The rationalisation engine is an experimental prototype built during GDS Local's research into LGR technology transitions. It sits within a broader product journey:

1. **LGAM** (Local Government Architecture Model) — a shared vocabulary for describing council technology (in beta)
2. **EA Platform** — a hosted tool for councils to map their estate against the LGAM (preparing for tender)
3. **Rationalisation Engine** — reconciles multiple council estates during LGR and models transition decisions (this tool)

The EA platform creates structured data supply; the rationalisation engine creates demand for it. LGR is the forcing function that makes EA platform adoption urgent. See `docs/ea-platform-decision-paper.md` for the full options analysis on how these products relate and where the rationalisation engine might sit organisationally.

---

## 1. Service-Level Modelling

### The problem

The engine currently models the relationship between IT systems and council functions at the ESD function level (176 entries). In practice, a single IT system rarely maps cleanly to one function. A waste management system might handle household waste collection, bulky waste, garden waste, and waste container management — four distinct services under ESD function 142 — while a separate clinical waste contractor handles clinical household waste (a fifth service under the same function).

This matters for transition because:

- **Disaggregation at function level is too coarse.** When a county's waste management system must be partitioned across two successor unitaries, the question is not "does the successor get waste?" but "which waste services does each successor need, and which are served by which contract?"
- **Rationalisation decisions depend on service overlap.** Two districts might both have a "housing" system (function 159), but one handles allocations and repairs while the other handles homelessness and temporary accommodation. They're not duplicates — they're complementary. The function-level view shows a collision; the service-level view shows no overlap.
- **Contract boundaries follow services, not functions.** A council's benefits processing contract might cover Housing Benefit (a service under function 3) but not Council Tax Reduction (a separate service under the same function, handled by a different system).

### The ESD services taxonomy

The LGA/ESD taxonomy includes a service layer beneath functions. Services for any function are accessible via:

```
https://webservices.esd.org.uk/lists/functions/{functionId}
```

Examples:

| Function | ID | Services |
|---|---|---|
| Adult social care | 148 | 16 services (care needs assessment, care at home, safeguarding, mental health support, etc.) |
| Household waste | 142 | 10 services (collection, containers, bulky waste, garden waste, clinical waste, etc.) |
| Fostering and adoption | 153 | 4 services (fostering, adoption, staying put, adoption support) |

Each service has an identifier, label, and description. Services are flat under functions (no sub-hierarchy).

### Proposed schema extension

Add an optional `Service` node type:

```json
{
  "id": "svc-waste-collection",
  "label": "Household waste collection",
  "type": "Service",
  "lgaServiceId": "524",
  "lgaFunctionId": "142"
}
```

New edge types:

```json
{ "source": "fn-waste", "target": "svc-waste-collection", "relationship": "CONTAINS" }
{ "source": "sys-bartec", "target": "svc-waste-collection", "relationship": "REALIZES" }
```

**Backward compatibility**: The existing `lgaFunctionId`-only model remains fully valid. Services are optional enrichment. Councils that map at function level only continue to work unchanged; those that map at service level get deeper analysis.

### Embedding strategy

Two options for making services available in the engine:

1. **Embed the full service taxonomy** — fetch services for all 176 functions at build time and embed as a JS constant alongside `LGA_FUNCTIONS`. Enables offline use and service autocomplete in the architecture editor.
2. **Lazy-load per function** — fetch services from the ESD API when a function is first encountered. Reduces embedded data size but requires network access.

Option 1 is consistent with the existing approach (embedded taxonomy) and preferred for a zero-dependency tool.

### Matrix implications

- Function-level rows remain the primary view
- Service-level detail is shown as expandable sub-rows within each function row
- Service-level collision detection: two councils might both have systems realizing the same function but different services — this is complementary delivery, not duplication
- Service-level disaggregation: when partitioning a system across successors, the tool can show which services transfer to which successor

### The resource tension

Mapping services is significantly more work for councils preparing their architecture exports. A council might have 30 systems across 20 functions (manageable) but those 20 functions contain 150+ services, and mapping which system serves which service requires deep operational knowledge.

On the other hand, councils will almost certainly need this mapping during transition anyway — the question is whether they do it in the tool (where it becomes part of the shared baseline) or in spreadsheets (where it stays siloed). The tool should make service mapping *easier*, not just *possible*: autocomplete from the ESD taxonomy, suggested mappings based on system labels, and the ability to start at function level and refine to service level progressively.

---

## 2. Cross-Cutting Capabilities (LGAM Capabilities Layer)

### The problem

Some IT systems don't serve a single function or service — they provide cross-cutting infrastructure consumed by many. A payments gateway (e.g. Capita Pay360, Civica Pay) processes payments for revenues, planning fees, parking, licensing, and any other service that takes money. A forms platform (Jadu, Granicus, OpenForms) collects data across every customer-facing service. A citizen identity system authenticates users across the entire digital estate.

The CDDO Local Government Architecture Model (see [Section 4](#4-cddo-local-government-architecture-model)) identifies 9 cross-cutting capabilities:

| Capability | Examples in councils |
|---|---|
| Payments | Capita Pay360, Civica Pay, GoCardless, Stripe |
| Forms | Jadu, Granicus, OpenForms, Microsoft Forms |
| Identity | GOV.UK One Login, local citizen accounts, staff SSO |
| Workflow | K2, Camunda, built-in case management engines |
| Booking | local booking systems, Bookingbug |
| Email | Microsoft 365, Google Workspace |
| SMS | GOV.UK Notify, Twilio, local gateway |
| Telephony | Mitel, RingCentral, local VOIP |
| Agentic AI | emerging; chatbots, AI triage, automated processing |

These don't map to a single ESD function. The engine currently models a payments gateway as "System X REALIZES Function Y" for whichever function it was associated with in the council's export — but it actually *enables* dozens of functions.

### Why this matters for transition

Replacing a payments gateway has blast radius across every service that takes payments. If two merging councils have different payments platforms, the "consolidation" decision affects not just the payments team but every service team that depends on it. The current function-level view doesn't show this dependency.

### Current implementation

A simpler first implementation is complete (see [Section 6 — Capability-level modelling](#capability-level-modelling-partially-implemented) for full details). Rather than introducing a new `Capability` node type, capability systems are modelled as regular `ITSystem` nodes with a `capabilityType` array using the LGAM vocabulary. They connect to functions via standard `REALIZES` edges. The engine detects them, filters them from decision alternatives, generates gap obligations on removal, and surfaces blast radius in the decision panel.

### Future: explicit capability nodes

A richer model would add a dedicated `Capability` node type:

```json
{
  "id": "cap-payments",
  "label": "Payments processing",
  "type": "Capability",
  "lgamCapability": "payments"
}
```

New edge type:

```json
{ "source": "cap-payments", "target": "fn-revenues", "relationship": "ENABLES" }
{ "source": "cap-payments", "target": "fn-planning", "relationship": "ENABLES" }
{ "source": "sys-capita-pay", "target": "cap-payments", "relationship": "REALIZES" }
```

This would create a second analysis dimension in the matrix: alongside function-level rationalisation ("which system per function?"), the engine could run capability-level rationalisation ("which shared platform per capability?"). Capability rows would show all the functions that depend on each platform, making the blast radius of replacement decisions explicit. This remains a future enhancement — the current `capabilityType` array approach covers the most important use cases without schema complexity.

---

## 3. Local Digital LGR Playbook Alignment

### Overview

The [Local Digital LGR Playbook](https://www.localdigital.gov.uk/playbook/) is the UK government's primary guidance for councils undertaking Local Government Reorganisation. Published by Local Digital (MHCLG), it covers five themes:

1. **Collaboration and Baselining** — establishing a shared view of systems, contracts, data, and capabilities
2. **Disaggregating Services and Data** — safely separating shared systems when councils split
3. **Cyber Readiness** — security and operational continuity for day-one launch
4. **Managing Expectations** — stakeholder alignment and communication
5. **Being Ready for Day One** — digital maturity assessment and prioritisation

### Where the engine aligns

| Playbook concept | Engine implementation |
|---|---|
| "Clear, shared view of the systems, contracts, data and capabilities" | Stage 2 taxonomy reconciliation creates a unified baseline from council exports |
| Statutory/safety-critical services prioritised first | Tier 1 (Day 1 Critical) classification with automatic tier promotion for contract urgency |
| "Whether splitting or replacing the system is more cost-effective" | Four rationalisation patterns: inherit-as-is, choose-and-consolidate, extract-and-partition, extract-partition-and-consolidate |
| Contract notice period awareness | Vesting zone classification (pre-vesting / year-1 / natural-expiry / long-tail) with critical path panel |
| Different audiences need different views | Three personas (Executive, Commercial, Architect) with configurable signal weights |
| Shared service unwinding | Shared service signal with cross-successor boundary detection |
| "Migrating data is eye-wateringly expensive" | Data portability signal, monolithic data signal, TCoP alignment assessment |

### Where the engine diverges

**Data maturity assumptions.** The playbook acknowledges that many councils have poor visibility into their own estates: "unsupported legacy systems, hidden dependencies, unclear contracts." The engine requires structured data upfront — vendor names, user counts, contract dates, portability assessments. For councils that don't have this data, the tool produces either incomplete analysis or no analysis at all.

*Opportunity: add a data quality assessment at Stage 1 that flags missing fields, suggests estimates based on peer benchmarks, and surfaces data collection priorities ("you have contract dates for 8 of 12 systems — prioritise the remaining 4").*

**Cyber readiness.** The playbook dedicates a full theme to security and operational continuity. The engine does not model security posture, access control, or threat surface. This is appropriately out of scope for an estate rationalisation tool, but the roadmap should note it as a complementary workstream.

**Cultural and organisational change.** The playbook emphasises knowledge silos, staff resistance, and organisational alignment. The engine focuses exclusively on system-level analysis. Personnel transition (TUPE, redeployment, training) affects which rationalisation options are viable — a technically optimal consolidation that requires retraining 500 staff may not be practical in a pre-vesting window.

**Temporal precision vs. thematic guidance.** The playbook structures transition thematically (baselining → cyber → day-one preparation). The engine provides temporal precision (this notice period triggers 4 months before vesting; this system is in the year-1 zone). These are complementary: the playbook says *what* to think about; the engine says *when* it becomes urgent.

### Opportunities

- **Playbook phase alignment**: extend the programme timeline feature to map playbook phases alongside contract and vesting milestones
- **Data maturity scoring**: surface a per-council completeness score at ingest, aligned with the playbook's baselining guidance
- **Risk register integration**: the playbook's risk categories (unsupported systems, hidden dependencies, knowledge silos) could become additional signals or annotations

---

## 4. CDDO Local Government Architecture Model

### Overview

The [CDDO Local Government Architecture Model](https://architecture.cddo.cabinetoffice.gov.uk/gds-local/) (beta, April 2026) is a shared vocabulary for describing local government technology estates. Published by GDS/Cabinet Office, it defines five layers:

```
Public Channels (in-person, phone, online, email, SMS, social media, video, smart devices)
    ↓
Council Interfaces (apps, API gateways, staff, websites, automated phones, public devices)
    ↓
Capabilities (payments, forms, identity, workflow, booking, email, SMS, telephony, AI)
    ↓
Business Areas (12: adult/children's social care, democratic services, education, highways, 
                housing, leisure, licensing, planning, public health, revenues/benefits, waste)
    ↓
Corporate Areas (10: business planning, communications, governance, CRM, facilities,
                 financial, geographical, legal, HR/workforce, procurement)
```

### Relationship to the engine

The engine and LGAM occupy different but complementary roles:

| Dimension | LGAM | Engine |
|---|---|---|
| **Purpose** | Define a shared vocabulary for capability planning and vendor engagement | Analyse the current estate and model transition decisions |
| **Granularity** | Capability categories | Concrete systems with contracts, users, costs |
| **Taxonomy** | Own business/corporate area classification | ESD Standard Function Taxonomy (176 functions) |
| **Transition planning** | Not addressed | Core purpose — vesting zones, rationalisation patterns, tier prioritisation |
| **System detail** | Deliberately excluded | Core data — vendors, costs, portability, data layer |
| **Cross-cutting capabilities** | Modelled as a distinct layer | `capabilityType` array on ITSystem nodes using LGAM vocabulary; capability summary panel with competing platform detection (see [Section 2](#2-cross-cutting-capabilities-lgam-capabilities-layer)) |

### Integration opportunities

**Business area mapping.** The LGAM's 12 business areas and 10 corporate areas broadly correspond to ESD function categories but are not formally mapped. A published mapping from LGAM areas to ESD function IDs would benefit both tools. Until then, the engine could offer an optional LGAM-aligned grouping view alongside the ESD taxonomy view.

**Capability vocabulary.** The LGAM's 9 capabilities provide a ready-made taxonomy for the cross-cutting capability nodes proposed in [Section 2](#2-cross-cutting-capabilities-lgam-capabilities-layer). Adopting LGAM capability names ensures the engine's vocabulary aligns with the broader government architecture community.

**Target state planning.** The LGAM describes what a well-structured council technology estate *should* look like. The engine describes what existing estates *actually* look like. A future integration could overlay the LGAM target structure onto the engine's current-state analysis, highlighting where the transition creates an opportunity to align with the target architecture rather than simply replicating predecessor patterns.

---

## 5. Near-Term Enhancements

Items that address immediate capability gaps within the existing architecture. Prioritised from persona testing (2026-04-29).

### Baseline estate report (pre-simulation)

All three personas (Executive, Commercial, Architect) need a report that works BEFORE simulation decisions are made. Currently the tool requires entering simulation mode and making decisions before any export is available, blocking initial board briefings, procurement landscape assessments, and architectural risk profiles.

- **Executive**: estate profile, risk summary, decisions needed, successor comparison
- **Commercial**: contract landscape, all notice triggers, vendor relationships, spend by successor
- **Architect**: technical posture, data complexity assessment, TCoP gaps, capability platform map

This is the single highest-priority gap across all personas.

### Per-successor metrics breakdown

The estate summary currently shows aggregate metrics. Users want side-by-side comparison: "West Elmhurst inherits X systems, £Y spend, Z pre-vesting triggers vs Ivy Hatherley inherits A systems, £B spend, C triggers." The allocation map already contains this data — it needs aggregation and display in the Overview tab.

### RAG synthesis for programme governance

Every programme board pack needs a Red/Amber/Green status. The tool has all inputs needed (decision progress, pre-vesting triggers outstanding, Tier 1 undecided count) but does not synthesise them. Add per-successor RAG computation based on weighted criteria and display in the estate summary + executive report.

### Days-until-vesting countdown

Add a countdown metric alongside the vesting date in the estate summary. "347 days until vesting" creates urgency in a way that "2027-04-01" does not.

### Legacy modal ARIA upgrade

Six older modals (Glossary, Signal Options, Tier Mapping, Analysis Detail, Documentation, Architecture Editor) lack `role="dialog"`, `aria-modal="true"`, focus trap, and Escape key handler. The pattern is already implemented for newer modals (Decision Panel, Obligation Detail, Sankey Overlay, Import Wizard) — needs retroactive application.

### Data confidence annotations

Add optional confidence metadata per system field:

```json
{
  "users": 3500,
  "usersConfidence": "verified",
  "endYear": 2028,
  "endYearConfidence": "contract",
  "annualCost": 950000,
  "annualCostConfidence": "estimated"
}
```

Three levels: `"verified"` (from authoritative source), `"reported"` (from council staff), `"estimated"` (assumption or benchmark). Surface in system cards as inline annotations. Adjust signal confidence display when data quality is low.

### Enhanced disaggregation risk modelling

The current binary `dataPartitioning` field (`Segmented` / `Monolithic`) doesn't capture the real complexity of data separation. A revenues system (property-based) can be partitioned by postcode; a case management system (team-based) cannot. Both might be marked `Segmented` today.

Add optional `partitioningMethod` field:

```json
{
  "dataPartitioning": "Segmented",
  "partitioningMethod": "geographic",
  "partitioningNotes": "Data partitionable by postcode/ward boundary"
}
```

Values: `"geographic"` (postcode, ward, parish), `"organisational"` (team, department), `"temporal"` (by date range), `"none"` (requires full ETL). This informs disaggregation feasibility and estimated lead time.

### CMDB-aware import *(CSV/Excel import already implemented)*

Basic CSV/Excel import with auto-column-detection, clipboard paste, and manual entry are already implemented in the import wizard. The next step is **CMDB-specific format support** for common platforms:

**ServiceNow default schema.** ServiceNow exports use a standard CMDB table structure (`cmdb_ci_server`, `cmdb_ci_appl`, `cmdb_ci_service`) with predictable column names (`name`, `vendor`, `operational_status`, `cost`, `support_group`, `u_contract_end_date`). Add a "ServiceNow" preset to the column mapping step that auto-maps these fields without user intervention.

**Relationship table import.** CMDBs typically store relationships in a separate table (`cmdb_rel_ci` in ServiceNow, relationship exports in LeanIX). The engine currently requires edges to be embedded in the same file as nodes. Add support for importing a **second file** at the column mapping step that maps relationship rows (source CI, target CI, relationship type) to the engine's edge model. This is critical for councils whose CMDB exports separate the "what systems exist" data from the "which systems serve which functions" data.

**Proposed UX:**
- Step 1 of the import wizard gains a "CMDB format" selector: Generic CSV, ServiceNow, LeanIX
- Selecting a format pre-fills column mappings and optionally prompts for a relationships file
- Auto-detection still works as fallback — if a user uploads a ServiceNow export without selecting the preset, the regex rules should still match most columns

**Schema mapping for common CMDB fields:**

| ServiceNow field | Engine field |
|---|---|
| `name` | System label |
| `vendor` / `manufacturer` | Vendor |
| `operational_status` | (filter: only import active CIs) |
| `u_annual_cost` / `cost` | Annual cost |
| `u_contract_end_date` | End year/month |
| `u_notice_period` | Notice period |
| `hosted_on` / `cloud` | Is cloud |
| `support_group` / `assignment_group` | Department (for function mapping) |

### Programme timeline milestones

Accept optional milestones alongside the vesting date:

```json
{
  "vestingDate": "2027-04-01",
  "milestones": [
    { "date": "2026-05-15", "label": "Shadow Elections" },
    { "date": "2026-09-01", "label": "Shadow Authority Formed" },
    { "date": "2026-11-01", "label": "Procurement Moratorium Begins" },
    { "date": "2027-04-01", "label": "Legal Vesting" }
  ]
}
```

Display on the contract timeline. Flag systems whose notice windows overlap with procurement moratoriums. Align with playbook phase structure.

---

## 6. Medium-Term Development

Significant schema or analysis additions. Some items in this section have been fully or partially implemented (marked accordingly); the rest remain on the roadmap.

### Service-level modelling

Implement the full schema extension described in [Section 1](#1-service-level-modelling):
- Embed the ESD service taxonomy (fetched from `https://webservices.esd.org.uk/lists/functions/{id}` for all 176 functions)
- Add Service node type to the architecture editor with autocomplete
- Service-level collision detection in the matrix
- Expandable service sub-rows within function rows
- Progressive refinement: start at function level, drill down to services where councils have mapped them

### Capability-level modelling *(partially implemented)*

The capability layer is modelled as an optional `capabilityType` array on ITSystem nodes (not a new node type), using the LGAM vocabulary of 9 values: payments, forms, identity, workflow, booking, email, sms, telephony, ai. Systems use existing REALIZES edges to connect to multiple functions.

**Implemented (capabilities-1):**
- `capabilityType` array on ITSystem schema, fully backward-compatible
- LGAM vocabulary constant (`src/constants/capabilities.js`)
- Capability badges on system cards (collapsed and expanded views) with teal styling
- Capability Platforms summary panel in estate summary (competing vs single-provider detection)
- Architecture editor: Capabilities column for tagging systems
- Import wizard: column detection and array coercion for CSV/Excel
- Cross-function annotation: "serves N functions" on capability systems in expanded cards

**Implemented (capabilities-2):**
- Capability systems filtered from decision panel alternatives (shown in separate "Supporting Capability Platforms" section)
- Projector excludes capability systems from implicit decommission on consolidation decisions
- Capability-gap obligation generation when a capability system is removed (one per affected function)
- Severity boost for payments (PCI-DSS) and identity (authentication) capability gaps
- Matrix pattern classification and decidable counts exclude capability systems

**Implemented (capabilities-3):**
- Blast radius preview in decision panel — `<details>` disclosure per capability system listing affected functions, summary banner above Apply button
- Report export integration — Architect: Type + Capability columns in obligations table; Commercial: capability-gap type annotation + procurement timeline entries; Executive: Capability Gaps count in estate impact table

### Cost modelling and financial exposure *(partially implemented)*

The engine computes total estate cost by successor and cost deltas from simulation decisions. Before/after spend comparisons appear in the simulation impact panel and persona-tailored reports. Per-system annual cost is displayed throughout.

**Remaining:**

- **Parallel running estimate** — during transition, both old and new systems run simultaneously; estimate the overlap cost
- **Termination liability** — systems with long notice periods or early termination penalties; no penalty field in system schema
- **Cost-per-user normalisation** — when choosing between systems for consolidation, show cost normalised by user count

### Decision annotation and audit trail *(partially implemented)*

The engine captures structured decisions via the `FunctionDecision` model (`src/simulation/decisions.js`). Each decision records: function ID, successor, system choice (choose/procure/defer), operating model boundary (disaggregate/maintain-shared/establish-shared), retained system IDs, contract extensions, and a timestamp. Decisions are serialised to JSON via scenario export and can be re-imported to reconstruct the full projected impact.

**Remaining:**

- **Rationale field** — free-text justification for why a decision was made (e.g., "Largest user base, cloud-hosted, high portability")
- **decidedBy field** — attribution to a person or governance body (e.g., "Architecture Board")
- **UI for entering rationale** — the decision panel currently captures the technical decision but not the narrative justification

Adding these fields to the `FunctionDecision` schema and the decision panel UI would transform scenario exports into self-documenting decision registers suitable for governance audit trails.

### Transition simulation engine *(implemented)*

The simulation engine is fully implemented across five core modules in `src/simulation/`:

| Module | Size | Purpose |
|---|---|---|
| `actions.js` | 28 KB | Applies simulation actions to the estate model |
| `projector.js` | 22 KB | Translates high-level decisions into concrete action sequences |
| `obligations.js` | 25 KB | Generates data migration and governance obligations from actions |
| `impact.js` | 4 KB | Computes before/after estate metrics and deltas |
| `decisions.js` | 7 KB | FunctionDecision model with validation |

Supporting UI in `src/features/`:
- `decision-panel.js` (73 KB) — full modal decision UI with system comparison, ERP impact analysis, and operating model boundary selection
- `simulation-panel.js` — simulation workspace with before/after metrics, decision list, and Sankey flow visualisation
- `scenario-manager.js` — scenario save/load with validation and auto-detection at Stage 1
- `report-export.js` — persona-tailored HTML report export (Executive, Commercial, Architect) with procurement timeline, technical posture narrative, obligation tables, and vesting-relative date framing

**Implemented action types:**

| Action | Implementation |
|---|---|
| **Consolidate on System X** | `applyConsolidate()` — retains chosen systems, decommissions others, generates migration obligations |
| **Decommission System Y** | `applyDecommission()` — removes system, recalculates estate metrics |
| **Extend contract** | `extend-contract` action — moves contract end date, recalculates vesting zone |
| **Migrate users** | `migrate-users` action — transfers user counts between systems |
| **Split shared service** | `applySplitSharedService()` — creates successor-specific instances from shared system |
| **Procure replacement** | `applyProcureReplacement()` — adds new system, marks predecessors for decommission |
| **Consolidate ERP** | `consolidate-erp` — multi-function ERP consolidation with cross-function blast radius |
| **Disaggregate** | `disaggregate` — data partitioning across successor authorities |
| **Establish shared service** | `establish-shared-service` — creates new shared arrangements across successors |

**Implemented impact analysis:**
- Before/after estate summary (system count, total spend, collision count, pre-vesting triggers, disaggregation count)
- Cost delta with currency formatting
- Per-decision obligation generation (migration plan, governance arrangements, shared service obligations)
- Cross-successor decommission preview (warns when removing a system affects other successors via shared predecessors)

**Scenario management:**
- Save decisions as JSON with metadata (persona, vesting date, successor names, decision count)
- Load and validate scenarios with warning banners for environment mismatches
- Auto-detect scenario files uploaded at Stage 1 alongside architecture data
- Impact fully reconstructed from decisions on import (no computed state persisted)

**Remaining:**

- **Scenario comparison** — save and compare named scenarios side-by-side across key metrics. Currently scenarios can be saved and loaded individually, but there is no UI for loading two scenarios simultaneously and comparing them.
- **Cross-successor impact visibility** — when a simulation action in successor A removes a system from a shared predecessor, the system disappears from successor B's allocation with no per-successor breakdown of the impact. The cross-successor decommission preview partially addresses this but full per-successor metric deltas are not yet computed.
- **Dependency cascade** — no `DEPENDS_ON` edge type between systems (see system dependency tracking below), so blast radius from system removal is not modelled

### System dependency tracking

Add an optional `DEPENDS_ON` edge type between systems:

```json
{ "source": "sys-revenue", "target": "sys-payments", "relationship": "DEPENDS_ON" }
```

This enables blast radius analysis: replacing the payments platform affects not just the payments capability but every system that depends on it. Critical for capability-level rationalisation decisions.

---

## 7. Long-Term Vision

Strategic direction that may depend on production deployment, external partnerships, or broader adoption.

### Multi-user collaboration

Move from single-user browser sessions to shared workspaces where multiple team members can work concurrently:
- Shared baseline that updates in real time
- Role-based access (Executive can annotate decisions; Architect can modify system data)
- Change history and conflict resolution

### API integration with council tools

Reduce manual data preparation by consuming data directly from common council platforms via API:
- ServiceNow CMDB API (live CI and relationship queries — beyond the near-term file-based ServiceNow import)
- LeanIX architecture repository API
- Jira/Confluence project data
- Direct contract register imports
- Atkins/Faithful+Gould asset management systems

### Programme board reporting

Generate structured outputs for governance:
- PDF programme board pack (executive summary, critical path, risk register, decisions needed)
- Action register export (JIRA/Trello-compatible)
- Risk register aligned with playbook categories
- Progress tracking against playbook phases

### Living transition document

Transform the tool from a point-in-time analysis into a continuously updated transition record:
- Decisions captured as they're made
- System status updated as migrations complete
- Progress dashboard showing rationalisation completion by tier, successor, and pattern
- Automated alerts when contract notice deadlines approach

### CDDO LGAM target-state overlay

Overlay the LGAM capability model onto the current-state analysis to show where transition creates opportunities to align with the target architecture:
- Identify where successor authorities could adopt shared capability platforms (national or regional)
- Highlight where the current estate already aligns with LGAM patterns
- Show where transition from legacy systems to LGAM-aligned architecture is possible within the natural contract renewal window

---

## 8. Framework Alignment Summary

How the engine's current and planned capabilities map against the two reference frameworks:

| Dimension | Engine (current) | Engine (roadmap) | Local Digital Playbook | CDDO LGAM |
|---|---|---|---|---|
| **ESD function taxonomy** | Embedded, mandatory | Unchanged | Assumed | Not referenced |
| **ESD service taxonomy** | Not modelled | Service-level nodes | Not referenced | Not referenced |
| **Cross-cutting capabilities** | LGAM-aligned capabilityType array on systems; capability summary panel; competing platform detection | + simulation blast radius obligations | Not modelled | Core layer (9 capabilities) |
| **System-level detail** | Full (vendor, cost, contract, portability) | + confidence annotations | High-level guidance | Deliberately excluded |
| **Disaggregation** | Pattern classification (4 patterns); first-class simulation action with obligation generation | + service-level partitioning, partitioningMethod field | Legal/technical/operational guidance | Not addressed |
| **Shared services** | Boundary detection, unwinding signal, establish/maintain/disaggregate decisions, cross-successor preview | + dependency tracking | Unwinding guidance | Dependency modelling only |
| **Cost modelling** | Per-system annual cost; estate-level before/after spend with deltas; procurement action timeline | + parallel running estimate, termination liability | "Eye-wateringly expensive" | Not addressed |
| **Data quality** | Self-reported, no validation | + confidence metadata | Process outcome, not precondition | Not addressed |
| **Cyber readiness** | Out of scope | Out of scope | Dedicated theme | Forthcoming |
| **Stakeholder alignment** | Three personas with configurable signal weights; persona-tailored report export (Executive, Commercial, Architect) | + decision rationale/attribution | Dedicated theme | "Shared language" principle |
| **Tier prioritisation** | Tier 1/2/3 with promotion | Unchanged | Statutory-first sequencing | Not addressed |
| **Vesting timeline** | Vesting zones, critical path, vesting-relative date framing in reports | + programme milestones | Thematic sequencing | Not addressed |
| **TCoP alignment** | Points 3, 4, 5, 9, 11 | Unchanged | Not explicit | Forthcoming in wider model |
| **Governance/compliance** | TCoP assessment; migration and governance obligation generation | + playbook phase tracking | Implied | Forthcoming |
| **Vendor engagement** | Vendor density signal; vendor consolidation in reports | Unchanged | Case studies | Core purpose |
| **Target-state planning** | Not modelled | LGAM overlay (long-term) | Not modelled | Core purpose |
| **Transition simulation** | Full action engine (9 action types), decision capture, impact analysis, scenario save/load, obligation generation, persona-tailored report export | + scenario comparison, cross-successor impact visibility, dependency cascade | Not addressed | Not addressed |
| **CMDB integration** | CSV/Excel with auto-detect, clipboard paste, manual entry | + ServiceNow/LeanIX presets, relationship table import | Not addressed | Not addressed |

---

## References

- **ESD Standard Function Taxonomy**: https://webservices.esd.org.uk/lists/functions
- **ESD Services per Function**: `https://webservices.esd.org.uk/lists/functions/{functionId}`
- **Local Digital LGR Playbook**: https://www.localdigital.gov.uk/playbook/
- **Local Digital — Collaboration and Baselining**: https://www.localdigital.gov.uk/resources/collaboration-and-baselining/
- **Local Digital — Disaggregating Services and Data**: https://www.localdigital.gov.uk/resources/disaggregating-services-and-data/
- **CDDO Local Government Architecture Model**: https://architecture.cddo.cabinetoffice.gov.uk/gds-local/
- **UK Government Technology Code of Practice**: https://www.gov.uk/guidance/the-technology-code-of-practice
