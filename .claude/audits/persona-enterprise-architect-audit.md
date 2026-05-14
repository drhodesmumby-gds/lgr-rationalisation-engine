# Persona Audit: Enterprise Architect (CTO) — LGR Rationalisation Engine

## Date
2026-05-14

## Persona Tested
Enterprise Architect (CTO)

## Scenario Tested
08 — Mega-Merger Six Councils (6 predecessors, 2 successors, SAP ERP with capability dependencies)

## Executive Summary

This tool provides **genuinely valuable decision support** for a CTO navigating LGR. The combination of pattern classification, per-system technical metadata, capability blast radius preview, and TCoP assessment puts it meaningfully ahead of a spreadsheet. The analysis detail modal with architect-specific questions is the standout feature — it synthesises what would otherwise be hours of manual analysis into actionable framing. The simulation decision panel with deferral cost comparison and capability dependency warnings is practical and saves time. The main gaps are: no integration dependency view showing what *consumes* capabilities (only what provides them), no migration sequencing guidance, and the in-house system risk from Grantham is not surfaced with appropriate urgency.

## Scenario Findings

### Expected Insights (from README)

The README says an Enterprise Architect should see:
- SAP ERP lock-in: contract to 2030, 18-month notice, dominant Day 1 constraint for both successors
- Grantham in-house system risk: 5 systems with no vendor, no SLA, no migration path
- County disaggregation complexity: Westshire systems must split between two successors
- NEC stack concentration in Hatherley: 6 functions on NEC products
- Extreme vendor diversity: 6 different CRM systems across councils
- Successor asymmetry: West Elmhurst (4 predecessors, most complex) vs Ivy Hatherley (3 predecessors, most modern)

### Actual Insights Surfaced

**SAP ERP lock-in**: EXCELLENT coverage. SAP is prominently displayed as Anchor system (7000 users), flagged with ERP badge, monolithic data warning, on-premise status, Low portability. The analysis modal explicitly asks "Which system should be the migration anchor?" and identifies SAP. The capability annotations show "Payments, Workflow — serves 3 functions" and the blast radius preview quantifies the dependency ("2 other functions depend on this platform — Human resources, Procurement").

**Grantham in-house risk**: PARTIALLY surfaced. Grantham's In-House systems appear in the matrix with "In-House" vendor labels and correct technical metadata (on-prem, high portability — which is arguably wrong for unsupported in-house systems). However, there is **no special risk flagging** for "no vendor, no SLA" systems. They appear with the same weight as a Civica or Idox system. A CTO needs to know these are orphaned tech debt.

**County disaggregation complexity**: WELL surfaced. The "Extract & partition" and "Extract, partition & consolidate" patterns correctly identify disaggregation needs. The "Partial predecessor" warning badge and "Geographic data partitioning may be feasible" annotation are helpful. The cross-tier collision warning also helps explain why county functions aren't duplications.

**NEC concentration in Hatherley**: PARTIALLY surfaced via Vendor Density signal. The signal fires for functions where NEC appears across multiple councils. However, there's no aggregate "this successor will inherit 6 NEC systems — consider strategic vendor relationship" insight.

**Vendor diversity**: The matrix clearly shows different vendors in each cell. The CRM row (ESD 43) shows 6 different systems from different vendors across the two successor columns, making the consolidation challenge immediately visible.

**Successor asymmetry**: The perspective filter (All / Ivy Hatherley / West Elmhurst) helps compare, and the column layout makes the 3-system vs 4-system difference visually apparent. The estate summary shows this at aggregate level.

### Utility Assessment: High

The tool consistently surfaces technically relevant information. Where it excels is in the *framing* of decisions — "Extract, partition & consolidate" is more actionable than "6 systems from 6 councils". The per-system metadata (portability, data layer, cloud/on-prem, contract position) is exactly what a CTO needs.

## Detailed Evaluation

### Decision Support (Score: 4/5)

**What works well:**
- Three-axis decision model (Choose/Procure/Defer + Operating Model Boundary) covers the real decision space
- System cards in the decision panel show exactly the right metadata: vendor, users, cost, contract end, notice period, portability, data layer, cloud status
- Contract position is classified into vesting zones (Pre-vesting, Year 1, Natural expiry) — immediately tells me which contracts constrain my timeline
- **Deferral cost comparison** is exceptional: "Combined parallel running cost: £2,475,000/yr (3 systems)" with per-system extension warnings gives immediate commercial context
- **Capability platform impact** warning at bottom of decision panel: "1 capability platform in this cell serves 2 other functions. These are managed independently from the function-delivery decision above"
- SAP shown separately in radio options with "⚠ Also provides: Payments, Workflow — used by 3 systems"

**What's missing:**
| # | Gap | Impact | Rationale |
|---|---|---|---|
| 1 | No migration effort indicator | High | A CTO needs to distinguish "move 45 users off Xero (trivial)" from "move 7000 users off SAP (multi-year programme)". User counts are shown but not translated into migration complexity |
| 2 | No "recommend" option or ranking of alternatives | Medium | The tool presents options neutrally. A CTO would want: "Based on portability, cost, and user base, the recommended target is X" |
| 3 | No sequencing suggestion | Medium | For extract-partition-consolidate, there's no guidance on "do this first, then this". The analysis modal's Key Actions are generic |
| 4 | Cannot express "retain for now, decide later" with a review date | Low | Defer is available but doesn't capture *why* or *when to revisit* |

### Capability Model Clarity (Score: 4/5)

**What works well:**
- Capability badges (Payments, Workflow, Forms, Identity, SMS, Email) clearly visible on system cards
- "serves 3 functions" annotation shows cross-function scope
- Blast radius preview after selection: "Blast radius: 2 other functions depend on this platform — Human resources, Procurement. Removing this platform would generate capability-gap obligations"
- Capability Platforms summary in Overview tab shows all 6 capability types, which systems provide them, and competition status (Competing/Single provider)

**What's missing:**
| # | Gap | Impact | Rationale |
|---|---|---|---|
| 1 | No view of what CONSUMES capabilities | High | The tool shows SAP provides Payments/Workflow, but doesn't show "Liquidlogic LAS consumes Payments from SAP, Confirm Highways consumes Workflow from SAP". A CTO needs to know exactly which downstream systems break when a capability provider is removed |
| 2 | No capability gap resolution options shown | Medium | When a blast radius is triggered, there's no suggestion of "alternatives that could provide Payments capability" |
| 3 | Cross-successor capability impact not explicit | Medium | SAP provides Workflow as single provider. If West Elmhurst decides to replace SAP, Ivy Hatherley's Workflow capability is also impacted. This cross-successor cascade isn't surfaced |

### Cross-Successor Coherence (Score: 4/5)

**What works well:**
- SAP correctly appears in BOTH successor columns for Finance, HR, and Procurement
- "Partial predecessor" badge clearly warns: "this system may serve multiple successors. Allocation review required"
- After making a decision for one successor, the system remains available in the other successor's column (verified: chose Xero for West Elmhurst Finance, SAP still shows in Ivy Hatherley Finance)
- The ERP Status tracker in the simulation sidebar ("SAP S/4HANA ERP: 0/6 decided") shows cross-function awareness

**What's missing:**
| # | Gap | Impact | Rationale |
|---|---|---|---|
| 1 | No "impact on other successor" warning when making a disaggregation decision | Medium | When I choose to disaggregate SAP in Ivy Hatherley, there's no indication of what that means for West Elmhurst's SAP instance. Both successors need disaggregation — the decisions are linked |
| 2 | Cannot see decisions made for the OTHER successor | Medium | When deciding HR for Ivy Hatherley, I can't see what was already decided for HR in West Elmhurst. This is essential for coherent architecture planning |

### Information Completeness (Score: 3/5)

**What's present and useful:**
- Full TCoP assessment per-system against Points 3, 4, 5, 9, 11 (excellent)
- Data layer (Monolithic/Segmented) immediately relevant for migration planning
- Portability rating (High/Medium/Low) helps assess vendor lock-in
- Cost per system enables financial modelling
- Contract timeline with notice period zones
- Architect-specific questions in analysis modal are well-chosen

**What's missing for a CTO:**
| # | Gap | Impact | Rationale |
|---|---|---|---|
| 1 | No integration/API dependency map | Critical | Systems don't exist in isolation. SAP talks to Liquidlogic via CONSUMES_CAPABILITY edges. When I choose to decommission SAP, I need to know every integration point that breaks. The data exists in the JSON (edges array) but isn't visualised |
| 2 | In-house system risk not differentiated | High | Grantham's 5 in-house systems have no vendor support, no roadmap, no migration path. They should be flagged as "high technical risk" alongside the financial distress indicator. Currently they look equivalent to commercial products |
| 3 | No data volume/complexity indicator | Medium | "Monolithic" tells me the data is entangled but not HOW entangled. A 15-year-old SAP with 7000 users has vastly more complex data than a 3-year-old Xero with 45 users |
| 4 | No technology maturity assessment | Medium | Cloud-native Arcus Global vs 15-year on-prem SAP vs unsupported in-house tools — these have fundamentally different supportability and future trajectories |
| 5 | No network/infrastructure dependencies | Low | For on-prem systems, migration planning needs: hosting location, network topology, DR arrangements. Not in scope for this tool but noted as gap |

### UX Clarity (Score: 4/5)

**What works well:**
- GOV.UK-style design is familiar and professional for UK public sector
- Pattern colour coding (green=inherit, blue=consolidate, red=extract, purple=extract+consolidate) is immediately readable
- Tier badges (red T1, amber T2, grey T3) with clear descriptions
- Collapsible system cards reduce noise — default collapsed is good for 4+ systems
- Tooltips for domain terms (hover/focus) are non-intrusive
- Persona select dropdown with immediate view refresh
- Signal indicators in analysis column provide at-a-glance risk summary
- Decision panel modal is clean and well-structured

**Confusion points:**
| # | Element | Issue | Rationale |
|---|---|---|---|
| 1 | Baseline Report button | Didn't produce visible output | Clicking the button didn't open a visible modal in automated testing. May be a rendering issue or it opens as a different view |
| 2 | Timeline hidden for Architect | Partially confusing | I understand the rationale (architects care about structure, not dates) but contract timelines ARE relevant for migration sequencing. The decision panel partially compensates with per-system contract dates |
| 3 | "View full analysis" link is small | May be missed | The primary way to get deep insight is via this link, but it's a small text link at the bottom of the analysis column cell. Should be more prominent |
| 4 | Signal Options modal opens accidentally | Minor UX issue | Clicking certain buttons in the matrix can inadvertently open the Signal Options modal rather than the intended target |

## Signal Effectiveness

| Signal | Relevance to Architect | Effectiveness | Notes |
|---|---|---|---|
| Monolithic Data | Critical | Effective | Correctly flags SAP as highest-risk combination with disaggregation. Drives ETL planning awareness |
| Data Portability | Critical | Effective | Per-system portability ratings help assess vendor lock-in and migration feasibility |
| On-Premise | High | Effective | Clearly badges on-prem systems. 4/6 finance systems being on-prem is immediately visible |
| TCoP Alignment | High | Effective | Per-system assessment against specific TCoP points provides compliance evidence for business cases |
| User Volume | Medium | Partially effective | Shows user counts and anchor detection, but doesn't translate into migration complexity |
| Contract Urgency | Medium | Effective in decision panel | Vesting zone classification (pre-vesting/year-1/natural-expiry) directly informs sequencing |
| Vendor Density | Medium | Partially effective | Fires when same vendor across councils, useful for consolidation. Doesn't show vendor concentration risk within a successor |
| Shared Service | Low for this scenario | N/A | No cross-boundary shared services in scenario 08 (0 shown). Would be higher relevance in shared-service-heavy scenarios |

## Rationalisation Patterns Assessment

The four patterns are well-defined and correctly applied:
- **Inherit-as-is**: Only appears for Town Centre Management (single system, only in West Elmhurst) — correct
- **Choose-and-consolidate**: Benefits, Democratic services, Environmental health, Waste, Planning, Housing — all correct (multiple district systems, no county involvement)
- **Extract-and-partition**: Adult social care, Children's services, Highways, Libraries, Registration, Procurement — all correct (county-only systems that must be partitioned to both successors)
- **Extract-partition-and-consolidate**: Finance, HR, CRM, Parking — correct (county system shared + district systems competing)

The pattern classification is genuinely useful for framing the architectural approach. It immediately tells me whether I'm solving a data partitioning problem, a consolidation problem, or both.

## Persona-Specific Questions Assessment

The analysis detail modal generates 6 questions for the Enterprise Architect persona. For Finance (ESD 116):

1. "Which system should be the migration anchor?" — **Excellent**. Identifies SAP by proportionality, notes portability risk, flags on-prem and ERP complexity
2. "What data complexity exists?" — **Good**. Per-system data layer breakdown. Could go further on volume/age
3. "Which approach aligns with TCoP?" — **Excellent**. Per-system assessment against specific TCoP points with explanations
4. "What is the on-premise exposure?" — **Good**. Lists on-prem systems and explains migration implications
5. "What is the data extraction strategy?" — **Good**. Sequenced approach (map, verify, build, test, cut over). Generic but correctly adapted to pattern
6. "What are the API and integration implications?" — **Partially useful**. Lists portability per system but doesn't show actual integrations. Would be much more useful if it said "SAP has 3 inbound CONSUMES_CAPABILITY edges from Liquidlogic, Confirm, and Parking"

## Perspective Filtering

Filtering between "All Successors", "Ivy Hatherley Council Perspective", and "West Elmhurst Council Perspective" works correctly. The matrix columns reduce to show only the selected successor. The estate summary and timeline should also filter (not tested). 

For a CTO, the "All" view is most useful because you need to see cross-successor dependencies. The filtered views are useful for focused analysis of a single successor's estate.

## Progressive Disclosure

The information architecture is well-layered:
1. **Matrix level**: Pattern tag + system count + key signals — quick scan
2. **Expanded cards**: Full technical metadata per system — assessment
3. **Analysis column**: Signal badges + primary insight + "View full analysis" link
4. **Analysis modal**: Full signal breakdown, pattern explanation, key questions, TCoP assessment — deep dive
5. **Decision panel (simulation)**: Complete decision context with competing systems, cost comparison, capability impact

This is the right layering for a CTO who needs to scan 21 functions and then drill into the 4-5 critical ones.

## Summary of Gaps (All Phases)

| # | Gap | Severity | Phase | Rationale | Recommendation |
|---|---|---|---|---|---|
| 1 | No integration dependency map showing CONSUMES_CAPABILITY relationships | Critical | Phase 3 | A CTO cannot assess decommission impact without knowing what systems consume capabilities from a platform. The data exists in the JSON edges but isn't visualised | Show "consumed by: Liquidlogic LAS, Confirm Highways, Parking" when SAP is shown as a capability provider. In decision panel, show full dependency chain when selecting a system |
| 2 | In-house systems not flagged as high-risk | Major | Phase 1 | Grantham's 5 in-house systems have no vendor, no SLA, no support contract. They represent undocumented tech debt that a successor inherits with no migration support. Currently displayed identically to commercial products | Add "No vendor support" risk badge. Consider a specific signal or special card treatment for unsupported in-house systems |
| 3 | No migration effort/complexity indicator | Major | Phase 2 | User count alone doesn't convey migration complexity. Moving 7000 users from an on-prem monolithic ERP is a multi-year programme; moving 45 from cloud Xero is a weekend. CTOs need this distinction | Add migration complexity heuristic based on (users * portability_inverse * monolithic_flag * on_prem_flag) or similar |
| 4 | Cross-successor decision visibility | Major | Phase 2 | When deciding HR for Ivy Hatherley, I cannot see what was decided for HR in West Elmhurst. Architecture decisions across successors must be coherent | Show "Other successor decisions" reference in the decision panel when the same function has a decision in the other successor |
| 5 | Baseline Report button non-functional | Major | Phase 1 | The baseline report button exists but didn't produce visible output during testing. This is a key feature for establishing initial posture | Investigate rendering issue — may be opening behind another element or routing to an invisible view |
| 6 | No vendor strategic relationship view | Minor | Phase 1 | NEC appears in 6 functions for Hatherley. SAP spans 3 functions. Civica spans 4 functions for Fairford. A CTO needs to understand vendor portfolio concentration per successor to plan strategic relationships | Add a "Vendor Portfolio" view showing per-successor vendor concentration and strategic implications |
| 7 | No capability gap resolution suggestions | Minor | Phase 2 | Blast radius preview shows impact but not alternatives. "You lose Payments capability" should be followed by "available alternatives: Stripe, Capita Pay360" | When showing blast radius, also show systems in the estate that provide the same capability type |
| 8 | "View full analysis" link insufficiently prominent | Minor | Phase 3 | The richest architect-relevant content is behind a small text link at the bottom of the analysis cell | Make it a button or larger clickable area. Consider auto-expanding for Tier 1 functions |

## Recommendations (Prioritised)

### Critical — Undermines utility for this persona
1. **Surface CONSUMES_CAPABILITY dependencies in the decision panel**
   **Rationale**: When a CTO is choosing to decommission SAP, they need to see exactly which systems will lose Payments and Workflow capabilities. The data exists (3 CONSUMES_CAPABILITY edges pointing to SAP) but is invisible in the decision context. Without this, the CTO must go back to the raw JSON to understand decommission impact — defeating the purpose of the tool.

### Major — Significantly reduces value
2. **Flag in-house/unsupported systems as high-risk technical debt**
   **Rationale**: Grantham's 5 in-house systems are fundamentally different from commercial products — no vendor to call for migration support, no upgrade path, no SLA. A CTO needs to know "these systems are orphaned and must be replaced before or at vesting" rather than discovering this through operational failure.

3. **Show cross-successor decision state in the decision panel**
   **Rationale**: During testing, I could make a decision for Finance in West Elmhurst without knowing what was decided for Finance in Ivy Hatherley. For shared-predecessor systems like SAP, these decisions are architecturally linked. Showing "West Elmhurst chose: Xero" in the Ivy Hatherley decision panel would prevent incoherent architecture planning.

4. **Investigate baseline report rendering issue**
   **Rationale**: The baseline report button (#btnBaselineReport) exists and is clickable but produced no visible modal content during testing. This feature is essential for establishing the initial technical posture before entering simulation.

### Enhancement — Would meaningfully improve utility
5. **Add migration complexity heuristic per system**
   **Rationale**: A simple indicator (e.g., Low/Medium/High/Critical based on users, portability, data layer, and on-prem status) would help CTOs immediately prioritise which migrations are "quick wins" vs "multi-year programmes". Currently requires mental calculation from raw attributes.

6. **Add capability gap resolution suggestions**
   **Rationale**: When blast radius shows "2 functions lose Payments capability", showing "Stripe and Capita Pay360 also provide Payments in this estate" would make the tool a one-stop decision aid rather than requiring external research.

### Nice-to-have — Minor improvements
7. **Make "View full analysis" link more prominent**
   **Rationale**: The analysis detail modal is the single most valuable architect feature in the tool. Its entry point should match its importance — consider a button rather than a text link.

8. **Add vendor portfolio aggregation per successor**
   **Rationale**: "Ivy Hatherley inherits 6 NEC products" is a strategic insight that would inform vendor negotiations and standardisation decisions. Currently requires manual counting.

## Strengths (Documented for Regression Prevention)

1. **Pattern classification is accurate and actionable** — "Extract, partition & consolidate" immediately tells me the architectural challenge
2. **System cards have exactly the right metadata** — Portability, data layer, cloud/on-prem, cost, users, contract, notice period
3. **Capability blast radius preview** — "2 other functions depend on this platform" with function names is genuinely useful
4. **Deferral cost comparison** — "Combined parallel running cost: £2,475,000/yr" immediately contextualises the "do nothing" option
5. **TCoP assessment per-system** — Ready-made evidence for business cases
6. **Architect-specific questions in analysis modal** — Well-chosen, detailed answers, actionable
7. **Cross-tier collision explanation** — "county and district functions may represent complementary delivery, not duplication" prevents wrong conclusions
8. **SAP shown with full context everywhere** — ERP badge, serves 3 functions, capability types, 18m notice, partial predecessor warning
9. **Three-axis decision model** — Choose/Procure/Defer + Operating Model Boundary covers the real decision space
10. **Progressive disclosure** — Matrix -> Cards -> Analysis -> Modal -> Decision Panel is well-layered

## Overall Verdict

**Utility Score**: 4/5

**Decision Support Utility**: 4/5 — The tool helps make better decisions than a spreadsheet. The deferral cost comparison, capability blast radius, and structured decision axes provide genuine analytical value.

**Capability Model Clarity**: 4/5 — Capability providers and their dependencies are well-shown. The gap is showing what *consumes* capabilities, not just what provides them.

**Cross-Successor Coherence**: 4/5 — Systems correctly appear in both successors, decisions don't prematurely remove options from other successors. Missing: visibility of other successor's decisions.

**Information Completeness**: 3/5 — Technical metadata is excellent but integration dependencies, in-house risk, and migration complexity indicators are missing.

**UX Clarity**: 4/5 — Clean, professional, well-layered. The timeline being hidden for architects is debatable but reasonable.

**Justification**: This tool is clearly useful for a CTO navigating LGR. It takes what would otherwise be a massive spreadsheet exercise (63 systems across 6 councils, 21 functions, 2 successors) and frames it as a structured decision process with appropriate technical context. The pattern classification alone saves significant analytical time. The main reason it's 4/5 rather than 5/5 is the missing integration dependency view — for an Enterprise Architect, understanding the full dependency graph (what consumes SAP's capabilities? what integrates with Liquidlogic?) is essential for confident decommissioning decisions. The tool has this data in its JSON edges but doesn't surface it in the architect view. Fixing this single gap would move it close to 5/5 for this persona.
