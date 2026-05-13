# Simulation Red-Team: Commercial / Transition Director

## Date
2026-04-22

## Executive Summary

The simulation mode provides a useful structural foundation for modelling estate rationalisation, but falls materially short of what a Commercial / Transition Director needs for real procurement planning. The six action types cover system-level operations (consolidate, decommission, extend, migrate, split, procure) but lack the commercial metadata that drives procurement decisions: contract terms, novation implications, early termination penalties, procurement timelines, and vendor negotiation strategy. The before/after metrics show system count and spend deltas, which is a start, but the tool cannot model a phased procurement plan, does not surface "what must happen before vesting day" in the simulation context, and critically lacks any concept of transition cost (the cost of the rationalisation itself, as opposed to the change in running cost). A Commercial Director would find the Sankey diagram and obligation tracking intellectually interesting but would still need a spreadsheet for their actual procurement strategy.

## Scenario Findings

### Scenario 04: Financial Distress Rescue

**Context**: Greyminster Borough (distressed, all legacy on-prem, 7/8 contracts expired or expiring imminently) merging with Westhaven District (cloud-first, healthy, contracts through 2028-2030). Single successor: West Greyminster Council. Vesting: October 2026 -- less than 6 months away.

**What a Commercial Director needs from this scenario**:
- Immediate clarity on which Greyminster contracts are already expired (NEC Revenues: Mar 2025, Oracle ERP: Jun 2025, Capita CRM: Aug 2025, Capita Waste: Sep 2025) -- these are not negotiations, they are emergency exits
- A prioritised action list: which contracts to extend vs exit, in what order, factoring in notice periods
- Understanding of Capita vendor concentration (4 systems) and whether that creates negotiation leverage or dependency risk
- Clear view of "total cost of doing nothing" vs "cost of this rationalisation plan"
- Budget implications: Greyminster is financially distressed, so migration funding must come from Westhaven or central government

**Simulation Testing (code analysis)**:

1. **Extending expired Greyminster contracts**: The extend-contract action only captures new end date (year and month). For Greyminster's expired contracts, a Commercial Director would need to model: (a) whether an extension is even possible given the contract has lapsed, (b) the cost of a bridging arrangement, (c) new terms imposed by the vendor. The tool treats "extend" as simply changing a date -- it does not capture cost changes, term modifications, or the commercial reality that extending an expired contract is fundamentally different from extending one that's still live.

2. **Consolidating onto Westhaven systems**: The consolidate action picks a target system and removes the rest. The tool correctly transfers users to the target system. However, it does not surface: (a) whether the Westhaven contract permits additional users/data (licensing headroom), (b) the novation or new-contract requirement for the successor authority, (c) the cost of additional licences. For example, consolidating Housing onto MRI Housing Cloud (Westhaven, 280k/yr, 260 users) by decommissioning Capita Housing (Greyminster, 80k/yr, 68 users) -- the tool shows a spend reduction of 80k, but in reality adding 68 users to MRI may increase the MRI contract cost, meaning the net saving is different.

3. **Procuring replacements**: The procure-replacement action captures label, vendor, annual cost, and cloud status. This is the bare minimum. Missing: procurement timeline (how long will this take?), implementation cost (separate from annual cost), dependencies on other actions, and contract duration.

4. **Obligation tracking for expired systems**: The obligation modal correctly shows contract end dates and notice periods for commercial/executive persona. The migration scope bullets mention cost ("95k/yr cost associated with source system") and contract dates. However, for Oracle Financials (lapsed Jun 2025, 9-month notice period), the tool should be screaming that this contract lapsed 10 months ago -- the notice period is irrelevant because it has already passed. The obligation severity computation does use contractUrgency signal weight but does not distinguish "notice trigger is coming" from "contract has already expired."

5. **Before/after metrics**: The tool shows system count (16 -> N), annual spend (1122k -> N), pre-vesting triggers, and disaggregation count. For a single-successor scenario with no disaggregation, the disaggregation metric adds no value. The spend metric is useful but shows only the delta in ongoing cost, not the one-off transition cost. There is no concept of: "this rationalisation plan will cost X to implement and save Y per year, with payback in Z years."

**Utility Assessment**: Low-Medium

The simulation mode helps visualise the estate and model basic system removals, but it cannot answer the Commercial Director's core question for this scenario: "What is the emergency procurement plan for Greyminster, what does it cost, and in what order do I execute it?"

**Gaps Identified**:

| # | Gap | Impact | Rationale |
|---|---|---|---|
| 1 | No concept of expired vs live contracts in extend-contract action | High | Extending a lapsed Oracle contract (Jun 2025) is commercially different from extending a live Westhaven contract (2030). The tool treats both identically -- just a date change. A Commercial Director needs to know which are emergency extensions requiring immediate vendor engagement vs routine renewals. |
| 2 | No transition/implementation cost model | High | The before/after spend shows annual running cost delta but not the cost of migration, data extraction, retraining, procurement, or implementation. A Commercial Director preparing a budget case needs both. For Greyminster's monolithic Oracle ERP, data extraction alone could cost hundreds of thousands. |
| 3 | No licensing headroom or novation concept | High | When consolidating onto Westhaven systems, the tool reduces Greyminster's cost but does not model the increase in Westhaven's contract to accommodate additional users/data. The net saving is overstated. |
| 4 | No procurement timeline | Medium | The procure-replacement action adds a new system instantly. In reality, procurement of a housing system or ERP takes 6-18 months. Without timeline, you cannot determine if a replacement can land before vesting. |
| 5 | Extend-contract captures no cost change | Medium | Extending a contract almost always involves a cost change (premium for short extensions, renegotiated rate for long ones). The action only modifies the end date. |
| 6 | No phased planning view | Medium | Actions are applied simultaneously. A Commercial Director plans in phases: Phase 1 (before vesting), Phase 2 (Year 1), Phase 3 (consolidation). The tool has no concept of action sequencing or phasing. |
| 7 | Financial distress not surfaced in simulation context | Medium | Greyminster's distress flag affects the dashboard signals but is invisible in simulation mode. The Commercial Director needs to know that procurement budgets are constrained because the predecessor is in distress. |

**Misleading or Confusing Elements**:

| # | Element | Issue | Rationale |
|---|---|---|---|
| 1 | Spend delta when consolidating | Overstates savings | Removing Greyminster systems reduces the displayed spend, but does not account for the increased cost on the Westhaven systems that must absorb additional load. The before/after spend metric creates a false impression of savings. |
| 2 | Obligation "resolved" status | May create false confidence | When consolidating, obligations are marked "resolved" if a target system exists. But "resolved" from a data perspective does not mean commercially resolved -- the target contract may need novation, additional licensing, or renegotiation. |

**Strengths**:
- The Sankey diagram provides an effective visual overview of system-to-successor flows that could be useful in transition board presentations
- The obligation modal correctly shows cost and contract end date for commercial/executive persona (persona-aware rendering)
- The contract risk overlay on the Sankey colours systems by vesting zone (pre-vesting/year-1/natural-expiry/long-tail), which is genuinely useful for at-a-glance contract position assessment
- Migration scope bullets provide useful narrative (e.g., "Low portability -- vendor-specific data formats, manual mapping likely required") that a Commercial Director could use in vendor discussions
- Context menus on Sankey nodes provide quick access to relevant actions (extend, decommission, split), reducing the number of clicks

### Scenario 03: Shared Service Partnership Dissolution

**Context**: Three councils (Riverdale, Kingsway, Stonebridge) with shared systems (NEC Revenues, MHR iTrent, Civica Elections) being split across two successors (Riverside Council, Greater Wolds Council). The shared systems must be unwound because Riverdale goes to Riverside while Kingsway goes to Greater Wolds.

**What a Commercial Director needs from this scenario**:
- Clear identification that three shared contracts must be commercially separated
- Understanding of who "owns" each shared contract and whether it can be novated or must be re-procured
- Cost modelling for the separation: NEC Revenues (300k + 240k combined) being split will likely cost more than the combined amount (two separate contracts lose economy of scale)
- Procurement timeline for separation, particularly Civica Elections (ends Jun 2027, 6-month notice period, vesting Apr 2027 -- notice must be served by December 2026)
- Cross-successor contract governance: who manages the shared contract during the transition period?

**Simulation Testing (code analysis)**:

1. **Split Shared Service action**: This is the most commercially relevant action type for this scenario. The split-shared-service action takes a system and creates N new instances, one per successor. It correctly:
   - Divides users proportionally between splits
   - Divides annual cost proportionally between splits
   - Creates new REALIZES edges for each split instance
   - Removes the original system
   
   However, it does NOT:
   - Model the commercial reality that splitting a contract often increases total cost (two separate contracts are more expensive than one shared)
   - Capture who retains the original contract relationship
   - Model the notice period implications for the separation
   - Handle the case where the shared system is monolithic (NEC Revenues: monolithic, low portability) -- splitting the contract does not split the data, and the tool does not flag this distinction
   
2. **Cross-successor impact detection**: The obligation generation correctly identifies cross-successor impact when a system serves multiple successors. If you decommission a system that serves both Riverside and Greater Wolds, the tool generates a "cross-successor-impact" obligation for the other successor. The obligation detail panel highlights these with red "CROSS" badges and dedicated summary counts. This is genuinely useful -- it surfaces the commercial risk of unilateral action.

3. **NEC Revenues separation planning**: NEC Revenues is shared between Riverdale (300k/yr, 120 users, monolithic, low portability, on-prem) and Kingsway (240k/yr, 95 users, same characteristics). If I model splitting this:
   - The split action creates two instances with ~150k and ~150k (or similar cost split)
   - But the commercial reality is: NEC will likely charge 300k for the Riverside instance and 240k for the Greater Wolds instance (or more, because they lose the shared discount)
   - The tool divides cost equally rather than reflecting the actual contract position for each party
   - The tool does not surface that NEC Revenues is monolithic and on-premise, so the "split" at the contract level does not address the data partitioning problem

4. **Civica Elections timing**: Civica Elections ends Jun 2027 with a 6-month notice period. Vesting is Apr 2027. The notice trigger is December 2026 -- before vesting. In the base dashboard, this should be flagged as a pre-vesting notice trigger. In simulation mode, if I use the split action, each new instance inherits the same contract end date and notice period. This is correct behaviour, but the tool does not explicitly warn: "Notice must be served before vesting day -- this shared service must be commercially resolved by December 2026 or the contract will auto-renew and complicate the separation."

**Utility Assessment**: Medium

The simulation mode handles cross-successor impact detection well, which is the single most important commercial concern in a shared service dissolution. However, the split-shared-service action is too simplistic for real commercial planning -- it treats a contract split as a proportional cost division, which never reflects commercial reality.

**Gaps Identified**:

| # | Gap | Impact | Rationale |
|---|---|---|---|
| 1 | Split cost model is proportional, not commercial | High | Splitting a shared NEC Revenues contract (540k total) into two instances will not cost 270k each. Vendors charge more for separate contracts that lose volume. The tool's proportional split misleads the Commercial Director about the cost of separation. |
| 2 | No concept of contract ownership/hosting authority | High | In a shared service, one council is typically the "lead" (contract holder). The split does not capture which council owns the contract and whether the other party needs a new procurement or a novation. |
| 3 | Split does not separate data from contract | High | NEC Revenues is monolithic. Splitting the contract into two instances does not split the monolithic database. The tool should flag that a "split shared service" on a monolithic system requires a data migration project in addition to the contract separation, and the contract cannot be split until the data is separated. |
| 4 | No cost override for split instances | Medium | The tool divides cost proportionally. A Commercial Director should be able to specify expected costs per instance (e.g., 300k for Riverside, 280k for Greater Wolds) based on actual vendor quotes. |
| 5 | No interim governance concept | Medium | During the transition period (pre-vesting), shared services continue to operate. The tool has no concept of interim governance, management responsibility, or cost-sharing during the transition. |
| 6 | Cross-successor obligation does not generate procurement action | Medium | When a cross-successor impact is detected, the obligation says "Cross-successor impact -- removal affects Greater Wolds Council" but does not prompt the user to create a corresponding action for Greater Wolds. The Commercial Director must mentally track this and create a separate action. |

**Misleading or Confusing Elements**:

| # | Element | Issue | Rationale |
|---|---|---|---|
| 1 | Proportional cost split | Creates false cost expectation | Splitting a 540k shared contract shows ~270k per successor. Real vendor pricing will be higher for separate instances. The Commercial Director may use this figure in board papers, creating a budget gap. |
| 2 | Split on monolithic system appears to resolve the issue | Hides data complexity | The split action successfully creates two instances, but for a monolithic NEC system, the data is still in one database. The split creates an illusion of resolution. |

**Strengths**:
- Cross-successor impact detection is the standout feature for this scenario. It correctly identifies when a system serves multiple successors and flags the commercial risk. The red "CROSS" badges in the obligation panel are appropriately alarming.
- The cross-successor Sankey overlay mode highlights affected flows in red dashed lines, making cross-boundary exposure visually clear in board presentations
- The obligation detail modal groups by source system and sorts cross-successor obligations first, which correctly priorities the Commercial Director's attention
- The system select dropdowns group by council (using optgroup), making it easy to identify which council owns which system when building actions

## Commercial Action Assessment

### Available Actions vs Commercial Reality

| Action | Commercial Fitness | What's Missing |
|---|---|---|
| Consolidate | Partial | Shows spend reduction from removing systems but not the cost increase on the target system (additional licences, capacity). Does not model contract novation to successor authority. |
| Decommission | Low-Medium | Removes a system but does not capture early termination costs/penalties or the vendor exit process. No concept of exit obligations beyond data migration. |
| Extend Contract | Low | Changes a date only. Does not capture cost change, term modifications, or the distinction between extending a live contract vs negotiating a bridging arrangement for a lapsed one. |
| Migrate Users | Low | Moves a number between systems. Does not model licence implications, training costs, or the commercial process of adding users to an existing contract. |
| Split Shared Service | Low-Medium | Creates proportional splits but does not model commercial reality of separation (increased total cost, contract ownership, data vs contract split distinction). |
| Procure Replacement | Medium | Captures label, vendor, cost, cloud status. Does not capture implementation timeline, one-off procurement costs, contract duration, or procurement route (framework vs open competition). |

### Missing Commercial Actions

| Missing Action | Importance | Description |
|---|---|---|
| Renegotiate Contract | Critical | Many contracts in LGR will be renegotiated rather than renewed or exited. A new action: renegotiate(systemId, newCost, newEndDate, newTerms). This is the most common commercial action in a transition. |
| Novate Contract | Critical | When a successor inherits a predecessor's contract, the contract must be novated to the new legal entity. This is a distinct commercial event that has cost, legal, and timing implications. |
| Early Termination | High | Exiting a contract before expiry incurs penalties. The decommission action should optionally capture termination cost and penalty amount. |
| Bridge/Waiver Arrangement | High | For expired contracts (Scenario 04), the predecessor may be operating without a valid contract. The commercial action is to establish a short-term bridging arrangement or formal waiver. This is distinct from "extend." |
| Freeze/Maintain | Medium | Some systems need to be kept running in maintenance mode until a replacement lands. This is not the same as "extend" (which implies a commercial contract action) -- it is a decision to continue operating and paying. |

## Cost & Contract Insight Assessment

### What the tool shows
- **Before/after system count**: Useful but basic. Shows net change in systems. Does not weight systems by criticality or commercial complexity.
- **Before/after annual spend**: Shows aggregate running cost delta. This is the most commercially relevant metric shown, but it only captures ongoing cost, not transition cost.
- **Before/after pre-vesting triggers**: Shows change in number of contracts requiring pre-vesting action. Useful as a risk reduction metric.
- **Before/after disaggregation count**: Useful for scenarios with partial predecessors, irrelevant for single-successor or full-predecessor scenarios.

### What the tool does not show
- **Transition cost**: The one-off cost of implementing the rationalisation plan (data migration, procurement, implementation, training, decommission). This is typically the largest budget item in an LGR transition.
- **Total cost of ownership (TCO)**: A comparison of "do nothing" TCO vs "rationalised" TCO over 3-5 years.
- **Procurement timeline**: When each action needs to start and finish relative to vesting day. A Commercial Director cannot plan without this.
- **Contract register summary**: A simple table of all contracts with end dates, notice periods, notice trigger dates, annual cost, and vendor -- sorted by urgency. The dashboard has some of this information scattered across function rows, but there is no consolidated contract view in simulation mode.
- **Vendor consolidation analysis**: If the rationalisation plan results in 60% of spend going to a single vendor, that is a vendor concentration risk. The tool does not compute or warn about this.
- **Budget phasing**: How spend changes over time (Year 0, Year 1, Year 2, steady state). The before/after metrics are a single-point comparison.

### Contract Risk Overlay
The Sankey contract risk overlay colours system nodes and links by vesting zone (pre-vesting red, year-1 orange, natural-expiry green, long-tail grey). This is genuinely useful for at-a-glance assessment of where the commercial urgency lies. However:
- It only works in the Sankey drill-down (function-level view), not at the estate level
- It shows the zone but does not show the actual dates or notice periods on the diagram
- It does not distinguish expired contracts from pre-vesting notice triggers -- both show as red

## Mental Model Gaps

### How a Commercial Director thinks vs how the tool works

A Commercial Director approaches LGR transition planning through contracts, not systems. Their mental model is:

1. **Contract register**: What contracts do we have, when do they expire, what are the notice periods, who is the vendor, what is the annual cost?
2. **Decision matrix**: For each contract, what is the decision (renew/exit/extend/novate/renegotiate) and by when?
3. **Procurement pipeline**: What new procurements are needed, in what order, and what is the timeline?
4. **Budget**: What is the transition cost and what are the ongoing savings?
5. **Vendor strategy**: Are there opportunities to consolidate vendors? Are there concentration risks?
6. **Governance**: Who makes the decision? Who manages the transition?

The tool's mental model is:

1. **Systems by function**: What systems serve each function, grouped by successor authority?
2. **Rationalisation pattern**: Inherit, consolidate, extract, or extract+consolidate?
3. **Actions on systems**: Decommission, consolidate, extend, migrate, split, procure.
4. **Impact metrics**: How do system count and spend change?

The gap between these models is significant. The tool thinks in systems and functions; the Commercial Director thinks in contracts and vendors. A system may have multiple contracts (e.g., software licence + support + hosting), and a contract may cover multiple systems (e.g., an ERP bundle). The tool's one-system-one-contract assumption is a simplification that limits commercial utility.

### Specific mental model gaps:

1. **No contract-centric view**: The simulation workspace shows the Sankey (system flows) and the action panel (system-level actions). There is no contract timeline or register view within simulation mode. The base dashboard's contract timeline exists but does not reflect simulated state.

2. **Actions are instantaneous**: In the tool, applying an action immediately changes the estate. In reality, every action has a lead time (procurement takes months, migration takes weeks, notice periods are measured in months). The simulation mode has no temporal dimension.

3. **No dependency modelling**: "Procure replacement for Housing" depends on "Extend existing Housing contract to bridge the gap." The tool allows both actions to be added independently but does not model their dependency.

4. **No decision points**: The Commercial Director needs to know "by date X, decide whether to extend or exit contract Y." The critical path panel in the base dashboard surfaces pre-vesting notice triggers for the Executive persona, but simulation mode does not generate new decision points based on simulated actions.

## Recommendations (prioritised)

### Critical -- blocks real utility

1. **Add a transition cost field to each action type**
   **Rationale**: Every simulation action has an implementation cost (data migration, procurement, retraining, decommission). Without this, the Commercial Director cannot build a budget case. The before/after spend metric currently only shows changes in recurring cost. Adding a `transitionCost` field to each action and summing them in the impact metrics would transform the tool's commercial utility. Example: consolidating Housing from Capita to MRI requires data extraction (estimated 50k), migration (40k), retraining (15k) = 105k transition cost, against a recurring saving of 80k/yr. This changes the payback calculation entirely.

2. **Add a contract register / procurement timeline view in simulation mode**
   **Rationale**: The Sankey diagram is useful for system flow visualisation but is not how a Commercial Director plans procurement. A simple table showing: System | Vendor | Contract End | Notice Period | Notice Trigger | Decision | Status -- filtered to the active perspective and reflecting simulated changes (e.g., extended contracts show new dates) -- would be the single most valuable addition for this persona. Sort by notice trigger date to create a natural procurement timeline.

3. **Distinguish expired contracts from pre-vesting triggers**
   **Rationale**: In Scenario 04, NEC Revenues expired March 2025 -- over a year ago. This is not a "pre-vesting notice trigger"; it is a lapsed contract requiring immediate commercial action. The tool should flag systems where `endYear * 12 + endMonth < currentMonth` differently from systems where the notice trigger is before vesting but the contract is still live. An "EXPIRED" badge alongside "OVERDUE" and "URGENT" would suffice.

### Major -- significantly limits value

4. **Allow cost modification on extend-contract and split-shared-service actions**
   **Rationale**: Extending a contract almost always changes the cost (vendors charge premiums for short extensions). Splitting a shared service almost always increases total cost (loss of volume discount). The extend action should accept an optional new annual cost. The split action should allow per-instance cost override instead of proportional division.

5. **Add a "renegotiate contract" action type**
   **Rationale**: Renegotiation is the most common commercial action in LGR transition. It changes cost, terms, and potentially scope without changing the system. The current action set forces the user to model this as either "extend" (wrong: only changes date) or "procure replacement" (wrong: implies a new system). A renegotiate action: `{ type: 'renegotiate', systemId, newAnnualCost, newEndYear, newEndMonth, notes }`.

6. **Flag monolithic data when split-shared-service is applied**
   **Rationale**: Splitting a shared service contract on a monolithic system creates an illusion of resolution. The system should warn: "This system has monolithic data partitioning. Splitting the contract does not split the data. A data migration or partitioning project is required before the service can be commercially separated." This could be a warning in the simulation warnings panel.

7. **Add action phasing / temporal dimension**
   **Rationale**: A Commercial Director plans in phases (pre-vesting, Year 1, Year 2). Allow actions to be tagged with a target date or phase, and show the impact metrics as a timeline rather than a single before/after snapshot. This transforms the tool from "what if?" to "when should we?"

### Enhancement -- would meaningfully improve

8. **Add vendor concentration analysis to impact metrics**
   **Rationale**: After simulating a rationalisation plan, show the resulting vendor distribution (e.g., "Westhaven vendors: 45% Arcus Global, 25% Access Group, 15% MRI, 15% Other"). If any vendor exceeds a threshold (e.g., 40% of spend), flag a concentration risk. This is directly actionable for procurement strategy.

9. **Link cross-successor obligations to action creation**
   **Rationale**: When a cross-successor impact is detected (e.g., splitting NEC Revenues affects Greater Wolds), provide a button to "Create action for Greater Wolds" that opens the action builder pre-populated with the affected system and successor. Currently, the Commercial Director must remember to do this manually.

10. **Add procurement route field to procure-replacement**
    **Rationale**: In UK public sector, procurement route matters (G-Cloud, DOS, open competition, direct award, framework). The route affects timeline (G-Cloud: weeks, open competition: months), cost, and compliance risk. A dropdown for procurement route would help the Commercial Director plan realistically.

11. **Show the base dashboard's contract timeline reflecting simulated state**
    **Rationale**: The non-simulation dashboard includes a contract timeline view. In simulation mode, extended contracts and new procurements should update that timeline, providing a familiar visual of contract positions that reflects the planned rationalisation.

## Overall Verdict

**Utility Score**: 2/5

**Justification**: The simulation mode demonstrates sound engineering -- it correctly models system removal, user transfer, shared service splitting, and data migration obligations. The cross-successor impact detection is genuinely valuable and the Sankey visualisation is an effective presentation tool. However, from a Commercial Director's perspective, the tool operates at the wrong level of abstraction. It models IT systems rather than contracts, treats actions as instantaneous rather than phased, and tracks recurring cost changes without transition costs. The most common commercial actions in LGR (renegotiation, novation, bridging arrangements) are missing entirely. The extend-contract action is a date change with no cost implications. The split-shared-service action divides costs proportionally rather than reflecting commercial reality. A Commercial Director using this tool would gain some structural insight into the estate but would need to build their procurement strategy, budget case, and decision timeline entirely outside the tool. The simulation mode adds limited incremental value over the base dashboard for this persona, because the base dashboard's signals, contract timeline, and critical path panel already surface most of the same contract risk information without requiring the user to manually build a simulation.
