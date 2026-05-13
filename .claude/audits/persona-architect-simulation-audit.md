# Simulation Red-Team: Enterprise Architect

## Date
2026-04-23

## Executive Summary

The simulation mode shows thoughtful architectural intent -- it has a pure-function action engine, obligation tracking with cross-successor awareness, a Sankey diagram with overlay modes, and before/after metric comparison. For a prototype, the foundation is solid. However, as a CTO preparing a rationalisation plan for a transition board, I would find the tool insufficient for real planning because it lacks the three things that matter most in practice: sequencing/timeline awareness, the ability to compare alternative approaches side-by-side, and guidance on where to start. The simulation answers "what changes if I consolidate on system X?" but does not help me answer "should I consolidate on system X, and if so, in what order relative to my other decisions?" -- which is the actual question an architect faces. The tool currently functions as an impact calculator rather than a planning aid.

## Scenario Findings

### Scenario 05: ERP Entanglement Trap

**Context**: Three councils merging into single unitary (Oakham Council). Three monolithic ERPs -- SAP S/4HANA (6000 users, 2.1M/yr, contract to 2030), Oracle EBS (1200 users, 600k/yr, to 2029), Unit4 Business World (900 users, 450k/yr, to 2028). All three collide on Finance (116) and HR (119). SAP is the natural anchor by user volume but has 18-month notice period and lowest portability.

**What I tried to do as an architect**:

1. My first instinct would be to explore: "What if I consolidate Finance on SAP and decommission Oracle + Unit4 for that function?" I would use the action builder: Consolidate, function = Finance (116), successor = Oakham Council, target = SAP S/4HANA.

2. Then repeat for HR (119): Consolidate on SAP.

3. Then ask: "What happens to Oracle and Unit4 after I've removed them from Finance and HR?" Because Oracle also serves nothing else, and Unit4 also serves nothing else -- they should become decommission candidates. But the consolidate action only removes systems from the function-level allocation, not from the estate entirely, because these ERPs may serve other functions at other councils.

**What the simulation reveals well**:

- The before/after metrics would show system count dropping from 22 to ~18 (removing Oracle and Unit4 from Finance and HR allocations). Spend would drop by ~1.05M/yr.
- The obligation engine correctly generates data-migration obligations: Oracle EBS and Unit4 are both monolithic and low-portability, so the architect persona would see HIGH severity obligations.
- Migration scope bullets would flag: "Data extraction from monolithic ERP -- likely requires specialist ETL tooling", "Low portability -- vendor-specific data formats, manual mapping likely required", "6,000 users to migrate or retrain" (for the Unit4/Oracle users being consolidated onto SAP).
- The Sankey diagram in function drill-down view would show the consolidation visually -- Oracle and Unit4 links disappearing, SAP link getting thicker.

**What the simulation fails to reveal**:

1. **No sequencing insight**: The README explicitly states "Unit4 contract expires soonest (2028), creating a sequencing window for migration." The simulation has no concept of ordering. I cannot express "decommission Unit4 first (contract expires June 2028, 15 months post-vesting), then Oracle (September 2029)." All actions are applied simultaneously. A CTO needs a timeline-aware sequence: extend SAP contract beyond 2030 as insurance, serve notice on Unit4 by June 2027 (pre-vesting), begin Oracle migration in 2028.

2. **No anchor recommendation**: The tool does not proactively identify SAP as the anchor system. The consolidate action requires ME to select the target. A truly useful tool would say: "SAP S/4HANA is the recommended consolidation target: 6x the user base of Oracle EBS, serves 4 functions vs 2, already county-level. However, its 18-month notice period and 2030 expiry mean it is locked in regardless of consolidation decisions."

3. **No ERP-aware grouping**: When I consolidate Finance on SAP, the tool does not prompt me to also consolidate HR on SAP. An ERP serves multiple functions by definition (that is what makes it an ERP), but the simulation forces per-function consolidation decisions. This is architecturally wrong -- the ERP consolidation decision should be holistic: "Choose SAP as the anchor ERP, which means Finance, HR, Procurement, and Legal all consolidate onto it."

4. **Missing migration complexity estimation**: The obligation says "Data extraction from monolithic ERP -- likely requires specialist ETL tooling" which is correct but generic. An architect needs: "Oracle EBS (monolithic, on-prem, low portability) to SAP S/4HANA migration: Estimated 12-18 months based on ERP-to-ERP migration industry benchmarks. Data mapping required for GL chart of accounts, employee master data, supplier records."

5. **No cost modelling for the transition itself**: The before/after spend shows the reduction in ongoing costs. But the architect needs to know: "What will this consolidation COST to execute?" Migration tooling, consultancy, parallel running, data cleansing, retraining -- these are the real costs, and they often exceed the annual savings for the first 2-3 years.

**Utility Assessment**: Medium

The tool correctly identifies what gets removed and generates obligations. The migration scope bullets provide some useful framing. But the lack of sequencing and holistic ERP-level thinking means an architect would still need to do all the hard planning work externally.

**Gaps Identified**:

| # | Gap | Impact | Rationale |
|---|---|---|---|
| 1 | No action sequencing or timeline | Critical | LGR transitions are multi-year programmes. Consolidation decisions have ordering dependencies (you cannot decommission before migration is complete; contracts have notice periods that constrain when you can act). The simulation's simultaneous-apply model misses this entirely. |
| 2 | No ERP-level consolidation action | Major | ERPs serve multiple functions. The per-function consolidation model forces the architect to make N separate consolidation actions for what is logically one decision: "Keep SAP, decommission Oracle and Unit4." |
| 3 | No anchor system recommendation | Major | The tool has all the data needed to identify SAP as the anchor (highest user count, most functions served, county-level). Failing to surface this proactively means the tool adds no analytical value beyond what the architect could calculate themselves. |
| 4 | No transition cost modelling | Major | Before/after spend only shows ongoing cost reduction. The actual decision requires understanding implementation cost, parallel running cost, and time-to-value. |
| 5 | No alternative comparison | Major | Cannot compare "consolidate on SAP" vs "procure new cloud ERP to replace all three." There is no branching, no scenario save/load, no side-by-side comparison. |
| 6 | No guided workflow for ERP entanglement | Minor | Given the tool's domain expertise, it should recognise the triple-ERP pattern and offer a structured workflow: identify anchor, plan migration sequence, model cost/timeline. |

**Misleading or Confusing Elements**:

| # | Element | Issue | Rationale |
|---|---|---|---|
| 1 | Before/after spend delta | Implies a clean saving | Shows "-1,050,000/yr" as if decommissioning Oracle and Unit4 immediately saves that money. In reality, you may be paying for both old and new systems during migration (dual running). The delta is aspirational, not achievable at vesting. |
| 2 | System count reduction | Over-simplifies | Reducing from 22 to 18 systems sounds good, but the remaining 18 systems may have more complex interdependencies. System count is a vanity metric for architects. |

**Strengths**:
- The obligation engine correctly identifies monolithic ERP data migration as HIGH severity for the architect persona (signal weights for dataMonolith and dataPortability are high)
- The migration scope bullets are genuinely useful starting points for scoping work
- The ghost card rendering in the matrix (strikethrough on decommissioned systems) gives clear visual feedback on what changed
- The UNSERVED badge when a function loses all systems is an important safety check -- it prevents the architect from accidentally leaving a function without a realiser

### Scenario 06: Asymmetric Disaggregation (Cross-Successor Dynamics)

**Context**: Five councils disaggregate into two successors (North Alderton, South Chelworth). Northmoor County and Dunstable Borough are partial predecessors of both. Critical issue: Northmoor's Liquidlogic LAS (adult social care, monolithic, 3200 users) must be split across both successors. Oracle ERP (1.8M/yr, 18-month notice, to 2031) also spans both. Dunstable is financially distressed with expired contracts.

**What I tried to do as an architect**:

1. First concern: the Liquidlogic LAS disaggregation. This is the highest-risk item. I would want to: split the shared service into two instances (one per successor), then determine whether each successor needs to procure its own replacement or can operate an independent Liquidlogic instance.

2. I would use "Split Shared Service" on the Liquidlogic system. But wait -- Liquidlogic is NOT listed as a shared service (it has no `sharedWith` property in the data). It is a county system that must be disaggregated because Northmoor is a partial predecessor of both successors. The `sharedWith` field means "shared between councils as a partnership service" -- not "shared because the owning council is splitting."

3. This is a fundamental model confusion. The split-shared-service action conceptually matches what needs to happen to Liquidlogic (split it into per-successor instances), but the UI filters to systems with `sharedWith` arrays, which may hide Liquidlogic from the action builder's system dropdown.

4. Next: the Oracle ERP problem. Same issue -- Oracle is Northmoor's ERP, spanning both successors. But "split shared service" does not semantically match what is happening. What is needed is "disaggregate county system" -- a fundamentally different action that involves data partitioning along geographic or organisational boundaries.

**What the simulation reveals well**:

- The obligation engine's cross-successor-impact detection is the standout feature. When I consolidate a system in North Alderton that also serves South Chelworth (because Northmoor is a partial predecessor of both), the obligation engine correctly generates a CROSS-SUCCESSOR-IMPACT obligation. This is genuinely valuable -- it surfaces the ripple effect that would otherwise be invisible.
- The Sankey diagram in estate view correctly shows Northmoor County Council with links to BOTH successors, making the disaggregation requirement visually obvious.
- The cross-successor overlay mode on the Sankey highlights the affected flows in red, which is effective.

**What the simulation fails to reveal**:

1. **Disaggregation vs shared service confusion**: The "Split Shared Service" action divides users and cost equally across splits (`Math.round(original.users / splits.length)`). But disaggregation is NEVER equal -- it follows geographic/demographic lines. Northmoor's Liquidlogic data might be 60% North Alderton / 40% South Chelworth by caseload. Equal splitting is actively misleading.

2. **No data partitioning strategy**: The core architect question for Liquidlogic is: "Can the data be partitioned at all? Is there a clean data boundary (e.g., by postcode, by team, by case ID range)?" The tool has the `dataPartitioning` field (Monolithic vs Segmented) but does not use it to inform the split strategy. Monolithic data means you cannot simply "split" -- you need to extract, transform, and load into two separate instances.

3. **Financial distress systems are invisible in simulation**: Dunstable's expired contracts (2025-2026) mean some systems may already be running without contracts or on month-to-month terms. The simulation does not surface these as priorities. An architect would want to model emergency procurement for Dunstable's systems as the FIRST simulation actions, before tackling the more complex disaggregation work.

4. **No dependency graph between actions**: In reality, you must split Liquidlogic BEFORE you can consolidate adult social care in each successor. The simulation does not enforce or even suggest ordering. An architect could accidentally model "consolidate adult social care in North Alderton on a new system" before splitting Liquidlogic, which would create an impossible plan.

5. **Cross-successor impact lacks resolution guidance**: The obligation says "Cross-successor impact -- removal affects South Chelworth Council" but does not suggest what South Chelworth should do about it. An architect needs: "This system was also allocated to South Chelworth via Northmoor County. South Chelworth will need either: (a) its own Liquidlogic instance (split), (b) a different social care system, or (c) a shared service agreement with North Alderton."

**Utility Assessment**: Medium-Low

The cross-successor impact detection is genuinely valuable and non-obvious. But the disaggregation workflow is fundamentally broken -- the split-shared-service action does not model disaggregation correctly, and the equal-split assumption is misleading. An architect would get a false sense of confidence from the tool.

**Gaps Identified**:

| # | Gap | Impact | Rationale |
|---|---|---|---|
| 1 | No dedicated disaggregation action | Critical | County system disaggregation is the hardest problem in LGR, and the simulation has no action type for it. "Split Shared Service" is semantically wrong and mechanically misleading (equal splits). |
| 2 | Equal user/cost splitting | Major | `Math.round(original.users / splits.length)` assumes equal distribution. Real disaggregation follows geographic/demographic lines, often 60/40 or 70/30. The split action should accept proportional allocations. |
| 3 | No data partitioning strategy guidance | Major | The tool knows a system is Monolithic but does not use this to warn that splitting is non-trivial. Monolithic + Low Portability + 3200 users should trigger a "This system cannot be trivially split -- data extraction and transformation required" warning. |
| 4 | No action dependency enforcement or suggestion | Major | Actions are applied simultaneously with no ordering. For disaggregation scenarios, ordering is critical: split first, then consolidate per successor. |
| 5 | Financial distress systems not prioritised in simulation | Medium | Dunstable's expired contracts should appear as suggested first actions. The simulation has no concept of "recommended next action." |
| 6 | Cross-successor impact lacks resolution options | Medium | Detecting the impact is half the problem. The other half is suggesting what to do about it. |

**Misleading or Confusing Elements**:

| # | Element | Issue | Rationale |
|---|---|---|---|
| 1 | Split Shared Service equal division | Actively misleading | An architect seeing "1600 users per split" for a 3200-user system might believe the disaggregation is balanced. Real caseloads are geographically uneven. |
| 2 | System count reduction after split | Counterintuitive | Splitting 1 system into 2 increases system count. An architect might think "my plan is making things worse" when in fact splitting is a necessary prerequisite for consolidation. |
| 3 | Missing simulation-aware pattern tags | Confusing | After simulation actions, the matrix cell still shows baseline pattern classifications. If I split Liquidlogic and then consolidate in North Alderton, the pattern tag should update, but the classification uses post-simulation allocations which may not reflect the intended final state. |

**Strengths**:
- Cross-successor impact detection in the obligation engine is genuinely non-obvious and valuable
- The Sankey cross-successor overlay mode visually highlights the problem counties with red dashed lines
- Ghost cards showing removed systems provide clear audit trail of changes
- The obligation detail modal groups by source system, which matches how an architect thinks about decommissioning

## Action Model Assessment

### Fitness of the Six Action Types

| Action Type | Fitness for Architect | Rationale |
|---|---|---|
| Consolidate | Partial | Correct concept but wrong granularity. Should support consolidation at ERP/system level, not just per-function. Also lacks the ability to specify which competing systems to remove (it removes ALL others). UPDATE: The code shows `removeSystemIds` IS supported -- the builder computes it automatically. This is better but still forces per-function thinking. |
| Decommission | Good | Clean and correct. Properly warns about unserved functions. The drag-to-decommission UX in the Sankey is a nice touch. |
| Extend Contract | Good | Simple and correct. Useful for modelling "extend SAP beyond vesting to buy migration time." |
| Migrate Users | Partial | Correct for user transfer modelling but lacks context. Why am I migrating users? What is the timeline? Is this a cutover or a phased migration? The action is mechanical, not strategic. |
| Split Shared Service | Poor for disaggregation | Conflates two very different operations: unwinding a shared service partnership (correct use case) and disaggregating a county system (wrong model, wrong assumptions). Equal splitting is architecturally incorrect for disaggregation. |
| Procure Replacement | Good | Useful for modelling "replace Oracle EBS with a new cloud ERP." The ability to specify vendor, cost, and cloud-hosted status is sufficient. |

### What is Missing

1. **Disaggregate County System**: A dedicated action that accepts proportional splits (e.g., 60/40), understands that monolithic data cannot be trivially partitioned, and generates appropriate data extraction obligations.

2. **Multi-function Consolidation / ERP Consolidation**: "Choose SAP for all corporate functions" as a single atomic action, rather than N separate consolidation actions per function.

3. **Phased Migration**: "Migrate users in batches: 500 by Month 3, 500 by Month 6, remainder by Month 9." The current migrate-users is a single instantaneous transfer.

4. **Parallel Running**: "Keep both systems running for 6 months while validating the migration." This is standard practice for critical systems and has cost implications the tool should surface.

5. **Extend and Renegotiate**: Extending a contract often involves renegotiation (reduced scope, different pricing). The extend-contract action only changes dates, not cost or scope.

6. **Conditional/Contingency Actions**: "If SAP migration fails, fall back to Oracle." Real plans have contingencies.

### Sequencing Gaps

The simulation applies all actions simultaneously against the baseline. This means:

- You cannot model "extend SAP, THEN consolidate Finance, THEN decommission Oracle" as a phased plan
- Action ordering does not matter in the current implementation (actions are applied sequentially in code, but each reads from the evolving state -- so order DOES technically matter but this is an implementation detail, not a planning feature)
- There is no timeline axis -- you cannot say "this action happens in Q3 2027, this one in Q1 2028"
- The before/after comparison shows only two states: baseline and post-all-actions. There is no intermediate state visibility.

## Insight Quality Assessment

### Before/After Metrics

**System count**: Useful directionally but misleading in isolation. System count reduction is not always positive (splitting increases count; that is correct and necessary). The metric should distinguish between "systems serving the estate" and "systems being decommissioned."

**Annual IT spend**: Useful but incomplete. Shows ongoing savings but not transition cost. An architect needs: "Annual saving: -1.05M. Estimated transition cost: 2.5M. Break-even: Year 3." The tool cannot compute transition cost, but it could at least note "This metric shows ongoing savings only -- migration and implementation costs are not included."

**Pre-vesting triggers**: Genuinely useful. Tells the architect how many contracts need pre-vesting decisions. The delta correctly shows whether simulation actions resolve or create new pre-vesting issues.

**Disaggregation count**: Useful for the architect. Shows how many county systems still need splitting. The delta after split actions correctly reduces this count.

### Obligation Tracking

The obligation engine is the strongest part of the simulation system. It correctly:
- Generates per-function obligations for removed systems
- Detects cross-successor impact via baseline allocation comparison
- Computes persona-aware severity (architect gets high severity for monolithic + low portability)
- Groups by source system in the detail modal (matching architect mental model)

The migration scope bullets are genuinely useful starting points:
- "Data extraction from monolithic ERP -- likely requires specialist ETL tooling" is actionable
- "Low portability -- vendor-specific data formats, manual mapping likely required" is relevant
- "6,000 users to migrate or retrain" quantifies the human impact

However, the bullets are static templates that do not adapt to the specific systems involved. "Data extraction from monolithic ERP" is the same bullet whether it is SAP (extremely complex, specialist market) or Unit4 (smaller, more tractable). Real utility would require system-specific or at least tier-specific bullet generation.

### Sankey Diagram

**Estate view (predecessors to successors)**: Useful for understanding the overall flow of systems. In scenario 06, it clearly shows Northmoor County Council contributing to both successors. The size toggle (count vs cost) adds a useful dimension. Click-to-drill-down is intuitive.

**Function drill-down**: Shows systems mapped to functions within a successor. Useful for understanding which systems serve which functions. The council colour coding helps identify provenance. However, the drill-down loses the cross-successor context -- you can only see one successor at a time, which is exactly the wrong view for disaggregation planning where you need to see BOTH successors simultaneously.

**Overlay modes**:
- Default: Shows system flows, adequate
- Data migration: Dashed lines on affected systems with severity colouring. Genuinely useful for identifying high-risk migrations at a glance.
- Cross-successor: Highlights cross-boundary flows in red. This is the most valuable overlay for the architect -- it shows where decisions in one successor ripple into another.
- Contract risk: Colours by vesting zone (pre-vesting red, year-1 amber, etc.). Useful for timeline awareness but limited by the Sankey's inability to show temporal sequencing.

**Overall Sankey assessment**: The diagram is the right PRIMARY visualisation for an architect. It answers "what flows where?" effectively. But it should not be the ONLY visualisation. For planning, a timeline/Gantt view showing action sequencing would be far more useful than a static flow diagram.

### Obligation Detail Modal

The modal is well-structured for the architect:
- Summary counts (total, high severity, unresolved, cross-successor) are the right headline metrics
- Per-source-system grouping matches how architects think about decommissioning
- Severity badges are correctly persona-weighted
- Obligations table within each group shows function, target, successor, and type

However:
- The modal does not group by migration PHASE. An architect wants: "Phase 1 (pre-vesting): these 5 obligations. Phase 2 (year 1): these 8 obligations."
- There is no dependency tracking between obligations. "Migrate Oracle HR data to SAP" depends on "SAP extended beyond 2030" -- but this dependency is invisible.
- The "resolved" status is binary. In reality, an obligation may be partially resolved (e.g., "data migration planned but not yet executed").

## Mental Model Gaps

### How an Architect Actually Approaches LGR System Rationalisation

1. **Survey the estate**: What do we have? (The dashboard handles this well.)
2. **Identify the hard problems**: Which collisions are the most complex? (Signals partially address this.)
3. **Identify anchor systems**: For each function or service area, which system is the natural consolidation target? (The tool does not do this.)
4. **Plan the disaggregation**: For county systems serving multiple successors, how do we split? (The tool's split action is wrong for this.)
5. **Sequence the plan**: What must happen before vesting? What can wait? What depends on what? (The tool has no sequencing.)
6. **Cost the plan**: What will this cost to implement? When does the investment break even? (The tool shows ongoing savings only.)
7. **Identify risks and contingencies**: What happens if SAP migration overruns? What is the fallback? (The tool has no contingency modelling.)
8. **Communicate the plan**: Present to the transition board with clear decisions, timelines, costs, and risks. (The export functionality helps but the plan itself cannot be constructed in the tool.)

The simulation currently helps with step 1 (via the dashboard, not the simulation specifically) and partially with steps 2-3 (via signals and the consolidate action). Steps 4-8 are completely unsupported.

### Where the Tool's Model Diverges from Reality

1. **Actions are instantaneous**: In reality, a consolidation takes 6-18 months. The tool shows the end state but not the journey.
2. **Actions are independent**: In reality, action A may be a prerequisite for action B. The tool does not model dependencies.
3. **Actions are certain**: In reality, migrations fail, vendors negotiate, timelines slip. The tool assumes 100% success.
4. **Cost is ongoing only**: In reality, the transition itself is the dominant cost. The tool ignores implementation cost.
5. **Users are numbers**: In reality, 6000 SAP users means 6000 people who need retraining, change management, and communication. The tool treats users as integers.

## Recommendations (Prioritised)

### Critical -- Blocks Real Utility

1. **Add timeline/sequencing to actions**
   **Rationale**: Every action in a real LGR plan has a target date. "Extend SAP by Q4 2030" and "begin Oracle migration in Q2 2028" are the actual planning artefacts. Without temporal sequencing, the simulation is an impact calculator, not a planning tool. This could be as simple as a "target quarter" field on each action and a Gantt-like view alongside the Sankey.

2. **Create a dedicated disaggregation action type**
   **Rationale**: County system disaggregation is the highest-risk, highest-complexity operation in LGR, and the tool has no correct action for it. The split-shared-service action has the wrong semantics (it models partnership unwinding, not geographic/demographic splitting) and the wrong mechanics (equal division). A disaggregation action should accept proportional splits, flag monolithic data as a complication, and generate disaggregation-specific obligations.

### Major -- Significantly Limits Value

3. **Support multi-function consolidation (ERP-level actions)**
   **Rationale**: An ERP consolidation is a single strategic decision affecting 2-8 functions simultaneously. Forcing per-function consolidation actions creates unnecessary friction and fails to capture the holistic nature of the decision. An "ERP consolidation" action type that identifies all functions served by the ERP and consolidates them together would match the architect's mental model.

4. **Add what-if branching / scenario comparison**
   **Rationale**: The architect's core question is often "should I consolidate on SAP or procure a new cloud ERP?" Testing both options requires clearing all actions and rebuilding from scratch. A "save scenario" + "compare scenarios" feature would transform the tool from single-path to exploratory. Even simple A/B comparison (two named action sets with side-by-side metrics) would be transformative.

5. **Add proportional splitting to the split action**
   **Rationale**: The equal division assumption (`users / splits.length`) is actively misleading for disaggregation. At minimum, the split action should accept user count and cost per split. Better still, the tool could suggest proportions based on population data or system metadata.

6. **Generate recommended actions / starting points**
   **Rationale**: The tool has the data to identify the highest-impact actions: "Consolidate Finance on SAP (saves 1.05M/yr, affects 8100 users)" or "Emergency procurement needed for Dunstable's expired systems." Surfacing these as suggested starting points would reduce the architect's cognitive load and ensure critical issues are not missed.

### Enhancement -- Would Meaningfully Improve

7. **Add transition cost estimation**
   **Rationale**: Even rough estimates ("ERP-to-ERP migration typically costs 1-3x annual system cost") would help architects scope the investment. The tool could use data characteristics (monolithic, low portability, on-prem) to generate cost complexity multipliers.

8. **Show a dual-successor view for disaggregation planning**
   **Rationale**: The Sankey drill-down shows one successor at a time, but disaggregation planning requires seeing both successors simultaneously. A split-view or overlay showing both successors' allocations for a county system would directly address the core disaggregation planning challenge.

9. **Add action dependency arrows / prerequisite warnings**
   **Rationale**: "You are consolidating Adult Social Care before splitting Liquidlogic -- this split should happen first" would prevent architects from building impossible plans.

10. **Add obligation resolution workflow**
    **Rationale**: Currently, obligations are informational. An architect should be able to mark obligations as "planned," "in progress," or "resolved" and associate them with specific actions or external work items.

11. **Distinguish migration cost from operational savings in before/after metrics**
    **Rationale**: Add a note or separate metric: "Annual savings: -1.05M. Note: Migration implementation costs not included." This prevents false confidence in the financial case.

## Overall Verdict

**Utility Score**: 2.5/5

**Justification**: The simulation mode demonstrates genuine architectural thinking -- the obligation engine with cross-successor awareness, the persona-weighted severity scoring, and the Sankey overlay modes show real domain understanding. The data migration scope bullets and ghost card diff rendering are useful touches. However, the tool falls significantly short of being useful for real planning because it lacks the three pillars of architectural planning: sequencing (when do things happen?), alternatives comparison (which option is better?), and guided workflow (where should I start?). The simulation currently answers "what is the end state if I make these changes?" but an architect needs "what is the optimal path from current state to target state, in what order, at what cost, with what risks?" The disaggregation model's equal-split assumption is actively misleading for the highest-risk scenario type. The tool is positioned between "interesting prototype that surfaces useful data" (score 2) and "tool that consistently provides actionable insights" (score 3). With the critical additions of timeline awareness and disaggregation modelling, it could reach score 4.
