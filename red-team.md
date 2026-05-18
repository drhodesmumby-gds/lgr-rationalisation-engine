# Red Team Analysis: LGR Rationalisation Engine

Original analysis conducted early 2026 against announced reorganisations (Essex, Surrey, Norfolk, Hampshire). Tested as CTO and Executive Board of each council. Updated 2026-05-18 to reflect current implementation state.

---

## Scenarios Tested

| Reorganisation | Complexity | Key challenge |
|---|---|---|
| Essex (15 → 5 unitaries) | County disaggregation 5 ways, Thurrock in S114 distress | Multi-successor split of county services |
| Surrey (12 → 2 unitaries) | Woking S114, accelerated timeline (April 2027) | Time pressure, degraded estate from distressed council |
| Norfolk (8 → 3 unitaries) | County disaggregation 3 ways | County service partitioning |
| Hampshire (16 → 4 + IoW) | Absorbing existing unitaries (Portsmouth, Southampton) | Merger of peer full-stack estates |
| Sussex (proposed) | District-level splits (Lewes across 3, Wealden across 2) | Sub-council disaggregation at ward/parish level |

---

## Gap Analysis: What Was Raised

### Critical Gaps (P1)

| # | Gap | Status |
|---|---|---|
| 1 | No successor structure — matrix shows predecessors not successors | **Implemented** — Stage 1.5 transition config, matrix pivots to successor columns |
| 2 | No vesting date awareness — contract urgency measured from today | **Implemented** — Vesting-anchored zones (pre-vesting, year-1, natural-expiry, long-tail) |
| 3 | No disaggregation modelling — county systems shown as atomic | **Implemented** — Partial predecessors, extract-and-partition pattern, allocation review flags |
| 4 | No playbook tier prioritisation — all functions equal weight | **Implemented** — Tier 1/2/3 with ESD-to-tier default mapping, override support |
| 5 | No rationalisation pattern classification | **Implemented** — Four patterns per cell: inherit / consolidate / extract / extract+consolidate |

### High Gaps (P2)

| # | Gap | Status |
|---|---|---|
| 6 | TCoP not applied to rationalisation decisions | **Implemented** — TCoP signal assessing Points 3, 4, 5, 9, 11 per system |
| 7 | No shared service detection | **Implemented** — `sharedWith` field, cross-successor boundary detection |
| 8 | No estate cost summary | **Implemented** — Estate summary panel with spend, pre-vesting triggers, system counts |
| 9 | Financial distress invisible | **Implemented** — `financialDistress` flag per council, risk badges on system cards |
| 10 | Council tier conflation (county vs district functions) | **Implemented** — Tier metadata, cross-tier collision detection and badges |
| 11 | Signals restate facts rather than generating insight | **Partially addressed** — Persona-specific contextual questions, conditional framing. Not yet full structured fact/temporal/structural/implication output. |
| 12 | No system-to-system dependencies | **Partially addressed** — CONSUMES_CAPABILITY edges model capability dependencies and blast radius. Full integration/interface mapping remains out of scope. |

### Medium Gaps (P3)

| # | Gap | Status |
|---|---|---|
| 13 | No operational decision paths (what does "rationalise" mean?) | **Implemented** — Simulation engine with choose/decommission/defer/disaggregate/establish-shared actions |
| 14 | `targetAuthorities` and `owner` fields ignored by engine | **Implemented** — Both consumed by allocation logic and rendered in UI |
| 15 | `annualCost` numeric field missing | **Implemented** — Schema includes `annualCost: number`, used for cost computations |
| 16 | No concept of Day 1 / transitional / target state | **Partially addressed** — Tier 1 = Day 1 critical, vesting zones distinguish pre/post action windows. No explicit multi-horizon state modelling. |

### Acknowledged Out of Scope

| Gap | Reason |
|---|---|
| Full integration/interface mapping (ArchiMate-level) | Different tool. Data preparation burden disproportionate. Capability edges cover the 80% case. |
| Programme timeline milestones (shadow authority, TUPE, procurement moratorium) | The tool needs vesting date as anchor; full programme Gantt is a project management tool concern. |
| Staffing/TUPE implications | HR-sensitive data in different systems. Tool notes user counts as a proxy for organisational scale. |
| Outsourced service contract modelling (exit charges, IP, TUPE) | The `owner` field distinguishes "council-run" from "vendor-operated". Full contract modelling is procurement workstream. |
| Parish-level geographic data partitioning | Tool flags partial predecessors for allocation review. Which specific records belong to which geography requires system-specific domain knowledge. |

---

## Design Tensions Resolved

### "Neutral signals" vs "genuine insights"

**Resolution:** The tool is neutral about WHICH system to choose but opinionated about WHAT criteria to apply. TCoP alignment is a policy-grounded observation, not a verdict. Playbook tiering is official prioritisation guidance. The tool says "here are the criteria that matter, applied to your data" — the practitioner makes the decision.

### "Data preparation burden" vs "analytical depth"

**Resolution:** Mandatory fields stay minimal (`id`, `label`, `type`, `lgaFunctionId` for functions; `id`, `label`, `type` for systems). Everything else is optional with graceful degradation. A council submitting only system names and vendors gets a useful matrix. Full metadata unlocks full analysis.

### "Geographic allocation is hand-waving"

**Resolution:** The tool doesn't pretend to compute geographic allocation. It flags the NEED for allocation (partial predecessor → allocation review required) and surfaces the complexity (data layer, user count, capability dependencies). Practitioners bring the domain knowledge about which cases/records belong where.

### "Same system can be both aggregation AND disaggregation"

**Resolution:** Pattern classification is per-cell (successor × function), not per-row. The "extract-partition-and-consolidate" pattern explicitly covers the case where a county system must be disaggregated AND competes with a district system in the same successor.

### "Sub-council disaggregation (ward/parish splits)"

**Resolution:** A split district (e.g., Lewes across 3 unitaries) is modelled identically to a disaggregating county — it's a partial predecessor. The tool doesn't need parish-level detail; it flags "this council's systems serve multiple successors, allocation review required." The existing mechanism covers this case without schema changes.

---

---

## Fresh Red-Team (2026-05-18) — Current Implementation

Tested against Essex (15→5), Surrey (12→2 accelerated), Hampshire (16→4 absorbing unitaries), Sussex (district splits).

### Killer Gap

**No aggregated readiness posture.** The tool computes detailed per-function signals but never synthesises into "Are we on track? What's blocked? What needs a decision this week?" Without a programme-board-ready RAG status, the tool stays in the architect's browser and never influences actual governance decisions.

Fix: A "Programme Status" card computing headline indicators from existing data (Tier 1 decision coverage, unresolved obligations, pre-vesting contract actions outstanding) with simple RAG logic.

### Per-Persona Findings

#### CTO (county, 5-way disaggregation)
- **Works:** targetAuthorities allocation, vesting zone classification, extract-partition-consolidate pattern, blast radius via CONSUMES_CAPABILITY
- **Missing:** Weighted disaggregation cost splits (equal division is misleading for budget planning); bulk decision application (250 individual clicks is prohibitive); "undecidable/contested" allocation status
- **Decision:** Implement weighted cost splits in disaggregation UI (default equal, editable proportions). User count split is not meaningful — migration is migration regardless of scale.

#### Programme Board Executive (DLUHC reporting)
- **Works:** Estate summary metrics, decision progress %, persona-tailored report export, financial distress flagging
- **Missing:** RAG readiness score; decision velocity/trajectory tracking; workstream grouping (programme organises by "Finance workstream" not "ESD function 116")
- **Misleads:** Decision labels ("Choose existing") appear definitive in exports when they are provisional. No conditions/caveats model.

#### Commercial Director (vendor negotiations)
- **Works:** Vendor density metrics, commercial persona questions, notice period sequencing, contract extension modelling
- **Missing:** Vendor-level aggregate view (data is computed but only shown within function cells — no "Vendor Dashboard" tab); transition cost modelling (exit fees, dual-running); framework/route-to-market annotation
- **Misleads:** Cost savings shown without exit costs. Self-reported `annualCost` values treated as like-for-like across councils when definitions vary.

#### District Architect (receiving new responsibilities)
- **Works:** Pattern classification frames challenge correctly, TCoP assessment, migration complexity T-shirt sizing, capability dependency visibility
- **Missing:** "Receiving authority" perspective (tool is biased toward disaggregating authority); capability gap analysis for services never previously delivered; minimum viable Day 1 architecture concept
- **Misleads:** "Inherit as-is" label masks disaggregation complexity happening at the county level; `needsAllocationReview` flag significance not adequately surfaced

### Cross-Cutting Gaps

| Gap | Description | Severity |
|---|---|---|
| No temporal/phasing model | Before/after only — no 18-month transition with parallel running, staged decommissions, dependency ordering | High |
| No data quality indicator | All input treated as equally reliable. Sparse district data looks as authoritative as precise county data | Medium |
| No programme-level aggregation | Function-cell level only. No workstream grouping, no vendor-first view, no per-successor readiness | High |
| No multi-user collaboration | Single browser tab. No decision attribution, contested allocations, or joint decision-making | Medium (design exists, unimplemented) |
| "Users" metric overloaded | Anchor detection and complexity scoring lean on user count as proxy for significance — misleading for systems where case volume matters more | Low |

### Prioritised Fixes

| # | Fix | Effort | Impact |
|---|---|---|---|
| 1 | Weighted disaggregation cost splits (UI, default equal) | Small | Fixes misleading budget figures |
| 2 | Data completeness badge per council | Small | Prevents over-trusting sparse data |
| 3 | Vendor summary tab (data already computed) | Medium | Unlocks commercial director persona |
| 4 | RAG readiness score per successor | Medium | The "killer gap" fix — board-ready output |
| 5 | Transition cost rough-estimate (exit cost multiplier) | Small | Prevents savings-without-costs mislead |
| 6 | Bulk decision application ("auto-confirm Tier 3 inherit") | Medium | Prevents 250-click abandonment |

### What the Tool Gets Right

- ESD taxonomy grounding (solves the "different names for same service" problem spreadsheets can't)
- Vesting-anchored urgency (pre-vesting/year-1/natural-expiry zones)
- Capability blast radius (CONSUMES_CAPABILITY makes decommission impact visible)
- TCoP-grounded observations (policy language for governance papers)
- Pattern classification per cell (frames the decision type before the detail)
- Persona-specific signal weighting and contextual questions
- Zero-dependency browser delivery (no procurement, no install, no admin access needed)
