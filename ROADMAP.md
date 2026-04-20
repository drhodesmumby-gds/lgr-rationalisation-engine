# LGR Transition Workspace Engine — Development Roadmap

This document charts the future development direction for the LGR Rationalisation Engine. It is structured around three pillars: deepening the data model to reflect real-world transition complexity, aligning with UK government reference frameworks, and expanding analytical capabilities.

Items are grouped by horizon:

- **Near-term** — next 2–3 development sprints; address immediate capability gaps
- **Medium-term** — next 3–6 months; significant schema or analysis additions
- **Long-term** — strategic direction; may depend on external partnerships or production deployment

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

### Proposed approach

Add an optional `Capability` node type aligned with the LGAM vocabulary:

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

This creates a second analysis dimension in the matrix: alongside function-level rationalisation ("which system per function?"), the engine can run capability-level rationalisation ("which shared platform per capability?"). Capability rows would show all the functions that depend on each platform, making the blast radius of replacement decisions explicit.

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
| **Cross-cutting capabilities** | Modelled as a distinct layer | Not currently modelled (see [Section 2](#2-cross-cutting-capabilities-lgam-capabilities-layer)) |

### Integration opportunities

**Business area mapping.** The LGAM's 12 business areas and 10 corporate areas broadly correspond to ESD function categories but are not formally mapped. A published mapping from LGAM areas to ESD function IDs would benefit both tools. Until then, the engine could offer an optional LGAM-aligned grouping view alongside the ESD taxonomy view.

**Capability vocabulary.** The LGAM's 9 capabilities provide a ready-made taxonomy for the cross-cutting capability nodes proposed in [Section 2](#2-cross-cutting-capabilities-lgam-capabilities-layer). Adopting LGAM capability names ensures the engine's vocabulary aligns with the broader government architecture community.

**Target state planning.** The LGAM describes what a well-structured council technology estate *should* look like. The engine describes what existing estates *actually* look like. A future integration could overlay the LGAM target structure onto the engine's current-state analysis, highlighting where the transition creates an opportunity to align with the target architecture rather than simply replicating predecessor patterns.

---

## 5. Near-Term Enhancements

Items that address immediate capability gaps within the existing architecture. Estimated at 2–3 development sprints.

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

Significant schema or analysis additions. Estimated at 3–6 months.

### Service-level modelling

Implement the full schema extension described in [Section 1](#1-service-level-modelling):
- Embed the ESD service taxonomy (fetched from `https://webservices.esd.org.uk/lists/functions/{id}` for all 176 functions)
- Add Service node type to the architecture editor with autocomplete
- Service-level collision detection in the matrix
- Expandable service sub-rows within function rows
- Progressive refinement: start at function level, drill down to services where councils have mapped them

### Capability-level modelling

Implement the cross-cutting capability layer described in [Section 2](#2-cross-cutting-capabilities-lgam-capabilities-layer):
- Capability node type with LGAM-aligned vocabulary (payments, forms, identity, workflow, booking, email, SMS, telephony, AI)
- `ENABLES` edges from capabilities to functions/services
- `REALIZES` edges from systems to capabilities
- Separate capability rationalisation view showing blast radius of platform replacement decisions
- Dependency mapping: when replacing a payments platform, show all functions affected

### Cost modelling and financial exposure

The engine currently shows per-system annual cost but doesn't aggregate to estate-level financial analysis. Add:

- **Total estate cost by successor** — what each successor inherits in annual IT spend
- **Parallel running estimate** — during transition, both old and new systems run simultaneously; estimate the overlap cost
- **Termination liability** — systems with long notice periods or early termination penalties
- **Cost-per-user comparison** — when choosing between systems for consolidation, normalise cost by user count

### Decision annotation and audit trail

Allow users to attach decisions and rationale to function cells:

```json
{
  "functionId": "142",
  "successor": "North Essex Unitary",
  "decision": "Consolidate on Bartec (from Braintree DC)",
  "rationale": "Largest user base, cloud-hosted, high portability. TCoP aligned.",
  "decidedBy": "Architecture Board",
  "date": "2026-09-15"
}
```

Export includes annotations so the decision register is self-documenting. This transforms the tool from a one-time analysis into a living transition record.

### Transition simulation engine

Move beyond analysis into **forward-looking decision modelling**. Once data and transition config are loaded, users should be able to select actions across the reorganisation and see a model of the impacts.

**The concept.** The current tool answers "what does the estate look like?" The simulation engine answers "what happens if we do *this*?" Users select concrete actions — consolidate on System A, decommission System B, migrate users from C to D, extend contract E — and the engine recalculates the entire estate model to show the consequences.

**Action types:**

| Action | Effect on model |
|---|---|
| **Consolidate on System X** | Removes competing systems from the successor allocation; recalculates cost, user volume, vendor density; shows migration burden for decommissioned systems |
| **Decommission System Y** | Removes system from estate; flags any functions left unserved; recalculates estate metrics |
| **Extend contract** | Moves contract end date; recalculates vesting zone and notice trigger; may demote tier priority |
| **Migrate users** | Transfers user count between systems; recalculates anchor status and user volume signal |
| **Split shared service** | Creates two instances from one shared system; assigns each to a successor; recalculates boundary crossing |
| **Procure replacement** | Adds a new system to a successor with estimated cost, users, and timeline; marks predecessor system for decommission |

**Impact analysis.** After each action (or batch of actions), the engine should show:
- **Before/after estate summary** — system count, total cost, collision count, pre-vesting triggers
- **Changed signals** — which signals improve or worsen as a result of the action
- **Timeline impact** — how procurement and migration activities fit against the vesting date and notice windows
- **Dependency cascade** — if a decommissioned system is depended on by other systems (see system dependency tracking), flag the cascade
- **Cost delta** — net change in annual IT spend, plus estimated one-off migration/procurement costs

**Scenario comparison.** Save named scenarios ("Option A: consolidate on NEC", "Option B: procure new cloud platform") and compare side-by-side across key metrics. This enables programme boards to evaluate trade-offs quantitatively rather than debating in the abstract.

**Decision capture.** When a scenario is approved, its actions become the decision record — feeding directly into the decision annotation system (see above). The simulation becomes the audit trail: "we chose Option A because it reduced annual cost by £200k and avoided a pre-vesting procurement cycle."

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
| **Cross-cutting capabilities** | Not modelled | Capability nodes (LGAM-aligned) | Not modelled | Core layer (9 capabilities) |
| **System-level detail** | Full (vendor, cost, contract, portability) | + confidence annotations | High-level guidance | Deliberately excluded |
| **Disaggregation** | Pattern classification (4 patterns) | + service-level partitioning | Legal/technical/operational guidance | Not addressed |
| **Shared services** | Boundary detection, unwinding signal | + dependency tracking | Unwinding guidance | Dependency modelling only |
| **Cost modelling** | Per-system annual cost | + estate-level financial exposure | "Eye-wateringly expensive" | Not addressed |
| **Data quality** | Self-reported, no validation | + confidence metadata | Process outcome, not precondition | Not addressed |
| **Cyber readiness** | Out of scope | Out of scope | Dedicated theme | Forthcoming |
| **Stakeholder alignment** | Three personas | + decision annotations | Dedicated theme | "Shared language" principle |
| **Tier prioritisation** | Tier 1/2/3 with promotion | Unchanged | Statutory-first sequencing | Not addressed |
| **Vesting timeline** | Vesting zones, critical path | + programme milestones | Thematic sequencing | Not addressed |
| **TCoP alignment** | Points 3, 4, 5, 9, 11 | Unchanged | Not explicit | Forthcoming in wider model |
| **Governance/compliance** | TCoP assessment only | + playbook phase tracking | Implied | Forthcoming |
| **Vendor engagement** | Vendor density signal | Unchanged | Case studies | Core purpose |
| **Target-state planning** | Not modelled | LGAM overlay (long-term) | Not modelled | Core purpose |
| **Transition simulation** | Not modelled | Action modelling, scenario comparison, impact analysis | Not addressed | Not addressed |
| **CMDB integration** | CSV/Excel with auto-detect | ServiceNow/LeanIX presets, relationship table import | Not addressed | Not addressed |

---

## References

- **ESD Standard Function Taxonomy**: https://webservices.esd.org.uk/lists/functions
- **ESD Services per Function**: `https://webservices.esd.org.uk/lists/functions/{functionId}`
- **Local Digital LGR Playbook**: https://www.localdigital.gov.uk/playbook/
- **Local Digital — Collaboration and Baselining**: https://www.localdigital.gov.uk/resources/collaboration-and-baselining/
- **Local Digital — Disaggregating Services and Data**: https://www.localdigital.gov.uk/resources/disaggregating-services-and-data/
- **CDDO Local Government Architecture Model**: https://architecture.cddo.cabinetoffice.gov.uk/gds-local/
- **UK Government Technology Code of Practice**: https://www.gov.uk/guidance/the-technology-code-of-practice
