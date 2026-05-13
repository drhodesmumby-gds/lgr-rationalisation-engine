# Simulation Red-Team: Executive / Transition Board

## Date
2026-04-22

## Persona Tested
Executive / Transition Board

## Executive Summary

The simulation mode provides genuine but incomplete utility for executive decision-making. Its core strength is the before/after estate metrics panel, which delivers the headline numbers a board needs -- system count reduction, spend impact, pre-vesting trigger changes, and disaggregation resolution. The Sankey diagram is a powerful visual narrative tool that could work in a board presentation for the simpler Scenario 08 (6 councils, 2 successors), but becomes unwieldy at Scenario 10's scale (7 councils, 3 successors, ~75 systems). The most significant gap is the absence of a strategic planning layer: there is no way to compare alternative strategies side-by-side, no readiness assessment, no resource/timeline estimation, and no way to model the "do nothing" scenario as a distinct reference point. The tool currently operates as a tactical system-level modelling workbench dressed in executive-friendly metrics -- it helps an architect plan consolidation moves and then shows the board the impact, but it does not help the board frame the strategic question of "what should our rationalisation strategy be?"

## Scenario Findings

### Scenario 08: Six-Council Mega-Merger into Two Unitaries

**Context**: 6 councils, 2 successor unitaries (West Elmhurst, Ivy Hatherley), ~60 systems. County (Westshire) disaggregated across both. SAP ERP lock-in, extreme vendor diversity (no two councils share a primary stack), Grantham's in-house systems with no vendor/SLA.

**Expected Insights for Executive Persona**:
- Day 1 readiness picture: SAP ERP notice period (18 months) triggers before vesting (2027-04-01), creating a forced decision
- Budget envelope: total estate cost across 6 councils and what consolidation could save
- Asymmetric workload: West Elmhurst inherits 4 predecessors vs Ivy Hatherley's 3 -- resource allocation needs to reflect this
- Grantham's in-house systems represent a "dead-end" risk requiring new procurement
- CRM function has 6 competing products -- highest collision density, potential quick win or major risk depending on approach

**What Simulation Mode Actually Delivers**:

1. **Estate-level Sankey**: Shows predecessor-to-successor flow. Six left-side nodes (councils) flowing to two right-side nodes (West Elmhurst, Ivy Hatherley). Westshire County has flows to both successors (disaggregation visible). At this scale, the Sankey is readable and communicates the high-level picture well. Clicking a successor drills down to function-level detail showing individual systems flowing to function areas.

2. **Action Builder**: The 2-step modal (select type, configure) is functional but requires system-level knowledge. An executive would need to say "consolidate CRM for West Elmhurst onto Microsoft Dynamics 365" -- selecting from a dropdown of ~20 systems. This is architect-level granularity.

3. **Before/After Metrics**: After adding consolidation actions, the panel shows:
   - System count: e.g. 60 -> 48 (reduction highlighted green)
   - Annual spend: shows delta
   - Pre-vesting triggers: count change
   - Disaggregations: count change
   These are the right headline metrics for a board.

4. **Obligation Tracking**: When systems are consolidated/decommissioned, data migration obligations are generated. The "View migration plan" modal groups these by source system with severity ratings (HIGH/MEDIUM/LOW). Cross-successor impacts are flagged with red badges.

5. **Ghost Cards**: In the main dashboard matrix, decommissioned systems appear as struck-through "ghost cards" with the original entry faded, making the impact of each simulation action visible at the function level.

**Utility Assessment**: Medium

The tool provides useful impact visualisation once someone has built a strategy, but building that strategy requires system-level expertise. An executive watching an architect use this tool to walk through a consolidation plan would get value. An executive trying to use this alone to frame "what are our options?" would struggle.

**Gaps Identified**:

| # | Gap | Impact | Rationale |
|---|---|---|---|
| 1 | No "do nothing" baseline scenario as explicit reference | High | A board's first question is always "what happens if we change nothing before vesting day?" The tool shows the baseline dashboard but does not frame the cost of inaction as a distinct simulation output (e.g., "If no action taken: 12 pre-vesting triggers unresolved, 3 contracts will lapse, estimated stranded cost of X") |
| 2 | No strategy comparison (scenario A vs scenario B) | High | Executives need to see "aggressive consolidation saves 2.1M/yr but requires 6 migrations before Day 1" vs "extend-and-defer saves 400k/yr but defers risk to Year 1". The tool only holds one action list at a time with no save/compare capability |
| 3 | No resource estimation for the migration plan | High | The obligation tracking says "4,500 users to migrate" and "monolithic data extraction required" but never estimates the effort (time, people, budget) this implies. A board cannot allocate resources without this |
| 4 | No readiness assessment / RAG status | Medium | There is no summary view that says "Day 1 readiness: AMBER -- 3 critical actions required before vesting, 2 of which have insufficient lead time". The board has to synthesise this themselves from scattered metrics |
| 5 | Action builder requires system-level knowledge | Medium | Selecting systems by ID/label from a dropdown is an architect's workflow. An executive would want to say "consolidate all CRM" or "extend all expiring contracts by 12 months" -- batch operations at the function or pattern level |

**Misleading or Confusing Elements**:

| # | Element | Issue | Rationale |
|---|---|---|---|
| 1 | Spend delta shows cost of decommissioned systems as "savings" | Could mislead | Decommissioning a system removes its annual cost from the total, but this is not a real saving unless the contract is actually exited. If a system is decommissioned but its contract runs to 2030, the spend remains. The tool conflates system removal with contract exit |
| 2 | Disaggregation count decrease after simulation | Could mislead | If a county system is decommissioned in the simulation, the disaggregation count drops -- but the data still needs extracting. The obligation tracks this, but the headline metric suggests the problem is "resolved" when it is merely "acknowledged" |

**Strengths**:
- Before/after metrics panel uses the exact headline numbers a board cares about
- Sankey diagram at 2-successor scale is an effective presentation tool
- Ghost cards in the dashboard matrix provide clear visual diff of simulation impact
- Obligation tracking correctly identifies cross-successor impacts (e.g., decommissioning a Westshire system affects both successors)
- Overlay modes (data migration, cross-successor, contract risk) provide meaningful visual filtering

### Scenario 10: Extreme Fragmentation (7 Councils, 3 Successors, ~75 Systems)

**Context**: 7 councils merging into 3 successor authorities. Triple ERP collision (Unit4/SAP/Oracle), county disaggregated 3 ways, Birchwood in financial distress with all contracts expired, Eastbury all-NEC estate, Copperfield split between 2 successors.

**Expected Insights for Executive Persona**:
- The sheer scale of the challenge: ~75 systems, 3 successors, every rationalisation pattern present
- Birchwood's expired contracts are an immediate procurement risk -- the board needs to act NOW
- ERP strategy is the single biggest decision: which of the 3 ERPs (Unit4/SAP/Oracle) becomes the anchor?
- County disaggregation across 3 successors creates unavoidable extraction complexity for Liquidlogic LAS, EHM, Capita One SEN, Unit4 ERP
- Eastbury's NEC concentration gives NEC extreme leverage in Blackwood South negotiations

**What Simulation Mode Actually Delivers at Scale**:

1. **Estate-level Sankey**: Seven predecessor nodes (left) flowing to three successor nodes (right). At this scale, the Sankey diagram becomes dense but still readable at the estate level. The visual clearly shows Greater Blackwood County splitting three ways (thick flows to all three successors). However, the sheer number of link connections (potentially 7x3 = 21 paths, though not all are active) means individual flows are hard to distinguish without hovering.

2. **Function-level drill-down**: Clicking into a specific successor (e.g., Blackwood North) shows systems (left) flowing to functions (right). With Blackwood North inheriting Ashford, Birchwood, partial County, and partial Copperfield -- that is potentially 30+ systems. The diagram height scales to accommodate (22px per node plus padding), creating a very tall SVG that likely requires scrolling. Filter dropdowns (by council, by function) help manage this, but the default view is overwhelming.

3. **Attempting a strategy**: To model a rationalisation strategy at this scale requires many individual actions. If I wanted to consolidate CRM across Blackwood North (which has systems from 4 predecessor councils), I would need to: select Consolidate, pick the function, pick the successor, pick the target system. Repeat for each successor. Then for ERP. Then for housing. Then for revenues. Building a comprehensive strategy requires 20-30 individual actions, each requiring 4-6 form interactions. This is impractical for a board meeting.

4. **Before/After at Scale**: The metrics panel still works well -- "75 systems -> 52 systems, spend from X to Y" is exactly what a board needs. But getting to that end state requires the laborious action-by-action approach described above.

5. **Obligation tracking at scale**: With 20+ consolidation actions, the obligation list could easily exceed 40-50 entries. The migration plan modal groups by source system and allows expand/collapse, which helps. But the Summary section (4 tiles: Total, High severity, Unresolved, Cross-successor) remains useful regardless of scale.

**Utility Assessment**: Low-Medium

The tool's UI does not collapse under the weight of 75 systems -- it remains functional. But the cognitive load on an executive trying to use it is too high. The scale gap between "I need to make 3 strategic decisions" (ERP, shared services, Day 1 critical) and "I need to configure 30 individual system actions" is the fundamental problem.

**Gaps Identified**:

| # | Gap | Impact | Rationale |
|---|---|---|---|
| 1 | No batch operations or strategy templates | Critical | At 75 systems, configuring individual actions is impractical. An executive needs "consolidate all CRM systems for Blackwood North onto X" as a single operation, or better yet, strategy templates: "Aggressive consolidation", "Extend and defer", "Minimum viable Day 1" |
| 2 | Sankey becomes information-dense at scale | Medium | The function drill-down for a successor with 30+ systems creates a tall, dense diagram. The filter controls help but the default view overwhelms. Aggregation options (e.g., group by vendor, group by pattern) would help |
| 3 | No prioritisation guidance | High | With ~75 systems, the executive needs to know "which 5 decisions matter most?" The critical path panel (in the main dashboard) addresses this for contracts, but the simulation mode does not carry this prioritisation into its action planning |
| 4 | Cannot model Birchwood's distress scenario | Medium | Birchwood has all contracts expired (2025). This is an immediate procurement risk. But the simulation's "extend contract" action does not distinguish between "extend an active contract" and "procure emergency replacement for an expired contract". The urgency is lost |
| 5 | No aggregate cost-of-change estimate | High | The tool shows cost deltas for the ongoing estate but not the one-time transition costs. A board needs to know "this strategy costs X to implement over 18 months" not just "this saves Y per year ongoing" |

**Misleading or Confusing Elements**:

| # | Element | Issue | Rationale |
|---|---|---|---|
| 1 | System count as primary metric | Misleading at scale | "75 systems -> 52 systems" sounds like significant progress, but if the 23 removed systems are all low-cost district CRMs while the 3 monolithic ERPs remain unresolved, the metric overstates progress. Weighting by cost or risk tier would be more meaningful |
| 2 | Equal visual weight for all Sankey links | Distorts priority | In the estate Sankey, the flow from Birchwood (8 expired-contract systems) looks similar to the flow from Copperfield (10 modern cloud systems). There is no visual urgency encoding at the estate level |

**Strengths**:
- Council colour legend in function drill-down clearly distinguishes system provenance
- Filter dropdowns (council, function) in drill-down view are essential at this scale and work correctly
- Overlay modes remain useful: contract risk overlay would correctly show Birchwood's systems as all red/expired
- Cross-successor overlay correctly highlights the spillover effects of county disaggregation
- The obligation modal's expand/collapse grouping by source system scales adequately

## Strategic Framing Assessment

**Does the tool help frame the programme-level picture?**

Partially. The estate summary metrics (system count, spend, pre-vesting triggers, disaggregations) are the right headline numbers. The Sankey diagram provides a visual narrative of "where systems go" that works well for presentation at moderate scale. However, the tool does not frame the three questions an executive board actually asks:

1. **"What is the cost of doing nothing?"** -- There is no explicit "inaction risk" view. The baseline dashboard shows the current state, and the critical path panel shows pre-vesting contract triggers, but there is no synthesised "if we take no action before vesting day, here are the consequences" summary. The board must mentally aggregate these signals.

2. **"What are our strategic options?"** -- The tool supports building one action plan at a time. There is no way to define, save, name, and compare alternative strategies. A real board meeting would want to see "Option A: Full consolidation (saves X, costs Y, requires Z migrations)" vs "Option B: Minimal Day 1 (lower cost, higher ongoing risk)" side by side.

3. **"What must we decide NOW?"** -- The critical path panel (outside simulation mode) does address this for contract notice periods. But simulation mode does not inherit this urgency framing. When building simulation actions, there is no guidance about which actions are time-critical vs which can wait.

## Decision Support Assessment

**Can you make real decisions with this?**

The tool supports tactical decisions well ("should we keep Liquidlogic or System C for adult social care?") but not strategic ones ("what is our overall rationalisation posture?"). Specific findings:

**What works for decision support:**
- Before/after metrics give clear impact quantification for any set of actions
- Obligation tracking surfaces the hidden costs of consolidation (data migration, cross-successor impact)
- Ghost cards in the matrix make it easy to verify that a consolidation decision does not leave functions unserved (UNSERVED tag appears)
- Warnings surface when a function becomes unserved after simulation, which is a critical safety net

**What falls short:**
- No cost-benefit framing: the tool shows what changes but not whether the change is worth the effort
- No timeline modelling: when does each migration need to happen? What is the sequencing? The tool shows the end state but not the transition path
- No dependency modelling: consolidating ERP may be a prerequisite for migrating finance functions, but the tool does not capture or enforce ordering
- No resource modelling: "migrate 8,500 ERP users" is stated as a fact, but no estimation of effort (months, FTEs, cost) is provided

## Scale and Presentation Assessment

**Does it work at board level?**

At Scenario 08's scale (2 successors, ~60 systems), the Sankey diagram is an effective board presentation tool. An executive could screen-share the estate Sankey, drill into each successor, and narrate the consolidation story. The before/after metrics panel is board-ready.

At Scenario 10's scale (3 successors, ~75 systems), the tool transitions from "boardroom presentation" to "working-level analysis tool". The Sankey becomes dense, the action list long, and the cognitive load high. A board member would need the output pre-prepared by an architect, not the tool used live.

**Information hierarchy**: The simulation workspace layout (action panel left, Sankey right) is well-structured. The collapsible action panel is a good design. However, the action panel mixes operational detail (action chips showing "Consolidate CRM in Blackwood North -> keep Microsoft Dynamics") with strategic summary (before/after metrics and obligations). These should be more clearly separated.

**Sankey overlay modes** are genuinely useful for different presentation narratives:
- "Default" for the overall flow picture
- "Data migration" for post-consolidation obligations
- "Cross-successor" for shared predecessor spillover risk
- "Contract risk" for temporal urgency

These provide exactly the kind of "same data, different lens" capability an executive values.

## Mental Model Gaps

The tool's mental model is: "start from baseline, add actions one at a time, see the impact accumulate." An executive's mental model is: "I have a strategy goal (Day 1 ready, minimum cost, maximum consolidation), what actions achieve it, and what is the risk/cost/timeline trade-off?"

Key divergences:

1. **Bottom-up vs top-down**: The tool builds strategies bottom-up (action by action). Executives think top-down (goal first, then break into workstreams).

2. **Individual actions vs workstreams**: An executive thinks in terms of "ERP workstream", "shared service unwinding workstream", "expired contract remediation workstream". The tool has a flat list of actions with no grouping or workstream concept.

3. **Impact vs effort**: The tool quantifies the post-action state but not the transition effort. "52 systems after consolidation" is an outcome; "18 months of parallel-running, 3 data migration projects, estimated 2.4M transition cost" is the decision input a board actually needs.

4. **Static end-state vs phased plan**: Real LGR transitions are phased -- pre-vesting Day 1 essentials, Year 1 consolidation, post-Year 1 optimisation. The simulation models a single end state with no temporal phasing. An action to consolidate in Year 2 looks the same as one needed before Day 1.

## Recommendations (prioritised)

### Critical -- blocks real utility for executive decision-making

1. **Add strategy comparison capability**
   **Rationale**: Without the ability to save, name, and compare alternative action plans side-by-side, the tool cannot support the most fundamental board conversation: "what are our options?" Currently the tool holds one mutable action list. Adding save/load for named strategies (e.g., "Aggressive consolidation", "Extend and defer", "Minimum viable Day 1") and a comparison view showing their before/after metrics in columns would transform this from a planning scratchpad into a genuine decision-support tool.

2. **Add batch operations and strategy templates**
   **Rationale**: At Scenario 10 scale (75 systems), building a strategy one action at a time requires 20-30 individual modal interactions. This is impractical for an executive. Batch operations ("consolidate all instances of function X across all successors onto highest-user system") and pre-built strategy templates ("extend all contracts expiring before vesting by 12 months") would reduce the interaction cost by an order of magnitude.

3. **Add a "cost of inaction" summary**
   **Rationale**: The board's first question is always "what happens if we do nothing?" The tool should explicitly compute and display the inaction scenario: how many contracts lapse before vesting, how many pre-vesting notice windows are missed, what is the estimated stranded-cost exposure, how many shared services require emergency unwinding on Day 1.

### Major -- significantly limits value

4. **Add readiness assessment / RAG dashboard**
   **Rationale**: After building a simulation strategy, the tool should provide a synthesised readiness verdict: "Day 1 readiness: AMBER. 3 of 12 Tier 1 functions still have unresolved system allocations. 2 pre-vesting notice triggers will be missed under this plan. Estimated 85% of users migrated before vesting." This is the single slide that a board member takes to MHCLG.

5. **Add temporal phasing to actions**
   **Rationale**: Each simulation action should optionally carry a phase tag: "Pre-vesting", "Year 1", "Post-Year 1". The before/after metrics should then show the state at each phase boundary. This maps to how real transition programmes are structured and allows the board to focus on "what must happen before April 2027" separately from "what can wait until 2028."

6. **Separate spend reduction from contract exit**
   **Rationale**: Currently, decommissioning a system removes its annual cost from the "after" total, implying a saving. But if the contract runs until 2030 and the system is decommissioned in 2027, the spend continues for 3 years. The tool should distinguish between "systems decommissioned" and "costs actually saved" by checking whether the contract end date falls before or after the proposed decommission date. The current approach could lead a board to approve a strategy based on overstated savings.

### Enhancement -- would meaningfully improve utility

7. **Add workstream grouping for actions**
   **Rationale**: Allow tagging actions into workstreams (e.g., "ERP consolidation", "Shared service unwinding", "Expired contract remediation"). Show obligation counts and cost impact per workstream. This maps to how programme boards track and resource the transition.

8. **Add effort estimation guidance**
   **Rationale**: When an obligation is generated (e.g., "migrate 4,500 users from monolithic on-prem system with low portability"), provide indicative effort bands: "High complexity -- typically 12-18 months, specialist ETL tooling required." These do not need to be precise but should give the board a sense of scale. The obligation already carries all the relevant flags (monolithic, low portability, user count, on-prem) -- translating these into rough effort bands is tractable.

9. **Add Sankey aggregation modes at scale**
   **Rationale**: At Scenario 10 scale, the function drill-down Sankey for a single successor can show 30+ system nodes. An aggregation mode that groups systems by vendor or by rationalisation pattern (rather than showing each individually) would maintain the narrative clarity of the smaller-scale diagram while working at real-world LGR scale.

10. **Surface prioritisation in simulation mode**
    **Rationale**: The critical path panel (pre-vesting contract decisions) exists outside simulation mode. Simulation mode should inherit and extend this: when the user enters simulation mode, highlight which function areas have the highest urgency, suggest which actions to take first, and flag when a simulation action does not address a critical-path item.

## Overall Verdict

**Utility Score**: 3/5

**Justification**: The simulation mode provides moderate utility for an Executive / Transition Board member. Its core strengths -- before/after estate metrics, visual Sankey narrative, obligation tracking, and cross-successor impact detection -- deliver real insight that goes beyond simply restating the input data. The ghost card / UNSERVED visual diff in the dashboard matrix is particularly effective for verifying that a consolidation plan does not leave gaps. At Scenario 08's 2-successor scale, an executive could plausibly use this tool in a board meeting to walk through a consolidation strategy and its impact.

However, the tool falls significantly short of enabling strategic decision-making at the level a transition board requires. The absence of strategy comparison, readiness assessment, temporal phasing, batch operations, and effort estimation means that the tool operates as an "impact calculator" rather than a "decision-support system." An executive can see what happens if they take specific actions, but they cannot easily explore "what should we do?" or "which of our options is best?" The action-by-action workflow breaks down at Scenario 10's scale of 75 systems, where building a comprehensive strategy requires dozens of individual modal interactions.

The tool is best characterised as a powerful analytical engine with an architect-facing interface and executive-facing output metrics. It delivers its maximum value when used by an architect to build and test strategies, with the before/after metrics and Sankey diagram presented to the board as the output. It does not yet function as a tool an executive would use directly to frame strategic choices.
