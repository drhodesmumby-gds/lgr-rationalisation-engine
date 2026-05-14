# Persona Audit: Enterprise Architect (CTO) — Simulation Decision Modelling

## Date
2026-05-14

## Persona Tested
Enterprise Architect / CTO — stress-testing decision modelling fidelity and utility

## Scenario
08-mega-merger-six-councils: Six councils (1 county, 5 districts) into 2 successors. Maximum vendor diversity, county disaggregation, ERP lock-in.

## Executive Summary

The simulation decision modelling is **architecturally sound and provides genuine utility** for an Enterprise Architect making rationalisation decisions. The decision panel correctly surfaces system metadata, capability blast radius, decommission previews, and deferral cost analysis. Cross-successor scoping works correctly — each successor shows its own allocation. However, critical gaps remain around **cross-successor decision coordination**, **shared service propagation visibility**, and **boundary option contextual filtering**. The tool is at the stage where it helps frame decisions correctly but doesn't yet help sequence or coordinate them across organisational boundaries.

---

## Test Results by Function

### Finance (ESD 116) — Ivy Hatherley Council

**Systems present**: SAP S/4HANA ERP (Westshire County, £2.3m/yr, 7000 users, on-prem, monolithic, ERP), Unit4 Business World Finance (Hatherley District, £140k/yr, 95 users, on-prem), Xero Finance (Ivybridge Borough, £35k/yr, 45 users, cloud)

**Pattern classification**: Extract, partition & consolidate — CORRECT (disaggregation from county + competing systems from districts)

#### Test 1: Choose Xero

| Aspect | Finding | Assessment |
|--------|---------|------------|
| Decommission preview | "SAP S/4HANA ERP (ERP — edge severed only if serving other functions) — 7,000 users to migrate" + "Unit4 Business World Finance — 95 users to migrate" | Correct and useful |
| Capability impact | "SAP provides Payments, Workflow to 3 systems. These capabilities will need alternative provision" | Excellent |
| Blast radius | "Serves 3 functions in Ivy Hatherley Council — 0/3 decided: [x]Finance THIS DECISION, [ ]Human resources, [ ]Procurement" | Genuinely valuable — shows cross-function consequences |
| Deferral comparison | "Combined parallel running cost: £2,475,000/yr (3 systems)" with contract extension warnings | Practical and actionable |
| SAP treatment | Separated under "Systems with capability dependencies" with ERP badge and warning | Correct design decision |

**Utility**: HIGH. The tool correctly surfaces that choosing Xero doesn't just replace a finance system — it potentially orphans Payments and Workflow capabilities for 3 consuming systems. An architect seeing this would immediately ask about capability replacement strategy.

#### Test 2: Choose SAP

| Aspect | Finding | Assessment |
|--------|---------|------------|
| Decommission preview | "Unit4 Business World Finance — 95 users to migrate" + "Xero Finance — 45 users to migrate" | Correct |
| ERP section | Dedicated "ERP Impact" section appears | Correct |
| Monolithic flag | Shown in system card badges | Visible but not actionable |
| Cross-function display | "Serves 3 functions in Ivy Hatherley Council" checklist | Same blast radius view |

**Utility**: MEDIUM. Shows correct decommission list but doesn't address the key architect question: "If I keep SAP, do I need to disaggregate its data across both successors?" The boundary options (Axis 2) exist for this, but the connection between "choosing SAP" and "needing disaggregation" isn't explicitly surfaced.

#### Test 3: Procure Replacement

| Aspect | Finding | Assessment |
|--------|---------|------------|
| Form fields | System name, Vendor, Annual cost, Cloud-hosted toggle | Adequate |
| Decommission statement | "All current systems for this function will be decommissioned and replaced" | Correct |
| Specific decommission list | Not explicitly listed (implied "all") | Minor gap — should list them |

**Utility**: MEDIUM. The form captures the replacement system details, but doesn't help with the procurement decision itself. An architect would want: "What are the market options? What integration constraints apply? What's the procurement timeline given the vesting date?"

#### Test 4: Defer

| Aspect | Finding | Assessment |
|--------|---------|------------|
| Combined cost | "£2,475,000/yr" | Correct |
| Contract extensions | "Xero Finance: ends 2028-03 — Year 1 — extension likely needed" | Useful |
| Operational overhead note | "running parallel systems increases support, licensing, and integration burden" | Present but generic |

**Utility**: HIGH. The deferral comparison is well-designed — it automatically calculates the parallel running cost and identifies which contracts need extension. This is the exact information a CFO would ask the architect to produce.

#### Test 5: Edit Decision

| Aspect | Finding | Assessment |
|--------|---------|------------|
| Edit badge | "Editing existing decision" clearly shown in green | Correct |
| Pre-fill | Xero radio pre-selected when editing after choosing Xero | Correct |
| Change to Unit4 | Successfully re-selects different system | Works |
| Re-confirm | "Apply Decision" button works for edited decision | Works |

**Utility**: HIGH. Edit flow is clean and intuitive. An architect iterating on decisions won't get confused.

---

### Finance (ESD 116) — West Elmhurst Council

**Systems present**: SAP S/4HANA ERP (Westshire County, same instance — disaggregation), Civica Financials (Elmhurst District, £130k/yr, 100 users), Civica Financials (Fairford Borough, £120k/yr, 85 users), Xero Finance (Grantham District, £45k/yr, 60 users, Pre-vesting contract end)

#### Test 6: Cross-successor independence

| Aspect | Finding | Assessment |
|--------|---------|------------|
| Correct successor shown | "Successor: West Elmhurst Council" | Correct |
| System count | "Competing Systems (4)" | Correct |
| SAP still appears | Yes, as "Partial predecessor system" | Correct — disaggregation means both successors see it |
| Civica x2 shown separately | Elmhurst (100 users) and Fairford (85 users) as distinct options | Correct |
| Xero (Grantham) flagged Pre-vesting | "Ends: 2027-06 (3m notice) Pre-vesting" | Critical info correctly surfaced |
| Independent from Ivy Hatherley decision | No contamination from prior decision | Correct |

**Utility**: HIGH. The tool correctly scopes each successor's view independently. SAP appearing in both successor panels (as partial predecessor) is architecturally correct — both successors inherit a claim on the SAP instance.

**Key gap**: No indication that Ivy Hatherley already made a Finance decision. If they chose SAP + "Establish shared service", West Elmhurst should see that proposal. Instead, it presents a blank slate. This is a significant coordination gap.

#### Test 7: Choose one Civica (same vendor, different councils)

Both Civica Financials instances appear as separate radio options. Selecting either would decommission the other. The tool correctly treats them as distinct systems despite sharing a vendor name.

---

### Environmental Health (ESD 34) — Ivy Hatherley Council

**Systems present**: NEC Environmental Services (Hatherley District, £65k/yr, 42 users, on-prem, Year 1 contract end), Arcus Global Environmental Health (Ivybridge Borough, £50k/yr, 25 users, cloud, Natural expiry)

| Aspect | Finding | Assessment |
|--------|---------|------------|
| Pattern classification | Choose & consolidate | Correct (2 systems, no disaggregation) |
| System comparison | Clear cards with all metadata | Works |
| Deferral cost | "Combined parallel running cost: £115,000/yr (2 systems)" | Correct |
| Contract extension | "NEC Environmental Services: ends 2028-09 — extension likely needed" | Useful |
| Simpler decision | No ERP, no capability dependencies, straightforward | Correctly simpler panel |

**Utility**: MEDIUM. For a straightforward 2-system consolidation, the panel provides adequate information but doesn't add much beyond what the system cards already show. The value proposition is lower for simple consolidations.

---

### Boundary Options (Axis 2)

#### Disaggregate

| Aspect | Finding | Assessment |
|--------|---------|------------|
| Shown when | Always (all 4 options shown regardless of context) | **BUG** — should only show when system crosses boundaries |
| Form content | "Define how the system will be split. Each successor gets its own instance" with split name fields | Adequate structure |
| Mentions successors | Yes — "split along successor boundaries" | Correct |

#### Establish Shared Service

| Aspect | Finding | Assessment |
|--------|---------|------------|
| Selection | Works, shows "Establish shared service requires at least one other successor to share with" | Correct validation message |
| Names other successor | Shows "West Elmhurst Council" as share target | Correct |
| After confirmation | Decision recorded | Works |
| Propagation to other successor | West Elmhurst panel does NOT show propagated shared service decision | **BUG** — critical coordination gap |

#### Maintain Shared Service

| Aspect | Finding | Assessment |
|--------|---------|------------|
| Shown when | Always | **BUG** — should only show when system has existing `sharedWith` arrangement |
| Relevance | SAP has no existing shared service; showing this option is misleading | Incorrect |

**Overall Boundary Assessment**: The boundary options exist and the disaggregate/establish-shared flows work mechanically. However, the contextual filtering (only showing relevant options) is not implemented, and the cross-successor propagation of shared service decisions is not visible when opening the other successor's panel.

---

## Scoring (1-5)

### 1. Decision Modelling Accuracy: 4/5

The impacts correctly reflect what would happen in most cases:
- Decommission lists are accurate
- Capability blast radius correctly tracks cross-function dependencies
- Deferral costs sum correctly
- User migration counts are shown

**Deduction**: The "Procure replacement" option doesn't explicitly list what gets decommissioned (only says "all current systems"). The shared service propagation doesn't update the other successor's view.

### 2. Information Surfacing: 4/5

The tool tells you most of what you need at decision time:
- System metadata is complete and well-organized
- Capability dependencies are clearly flagged
- Contract positions and vesting zones are shown
- Deferral comparison is automatically computed

**Deduction**: Missing integration dependency view (system-to-system, not just function-to-system). No cost comparison table across options. No timeline sequencing guidance.

### 3. Cross-Decision Coherence: 2/5

Multiple decisions across functions and successors do NOT interact sufficiently:
- After Ivy Hatherley decides on SAP + "Establish shared service", West Elmhurst's Finance panel shows no awareness of this
- The blast radius shows "0/3 decided" for SAP functions, which is good, but doesn't update after decisions on those other functions in the same session
- No mechanism to see "If I choose SAP here, what does that mean for the same SAP instance in West Elmhurst?"
- Decision state not accessible via the global state object (module closure), making it harder to audit programmatically

**This is the critical weakness.** An architect needs to make coordinated decisions across 2 successors sharing a disaggregated county. The tool currently treats each decision as independent.

### 4. Boundary Options Utility: 3/5

The options exist and the mechanics work, but:
- All 4 options always shown regardless of context (violates conditional display principle)
- "Maintain shared service" appears when there's no shared service to maintain
- "Disaggregate" appears even for cloud systems from full predecessors (where it makes no sense)
- Shared service establishment works but propagation is invisible
- Disaggregate form collects split names but the impact preview is minimal

### 5. Edit/Iteration Flow: 5/5

Excellent:
- "Editing existing decision" clearly indicated
- Previous selection pre-filled
- Can change to different system or option type
- "Apply Decision" confirms edit
- Matrix updates correctly (shows "1 of 2 decided")
- No confusion about which decision you're editing

---

## Critical Gaps

| # | Gap | Severity | Impact on Architect |
|---|---|---|---|
| 1 | Cross-successor decision coordination | Critical | Cannot see that the other successor has already proposed sharing SAP; makes coordinated architecture impossible |
| 2 | Shared service propagation not visible | Critical | "Establish shared" is recorded but the other successor sees no evidence of it — defeats the purpose |
| 3 | Boundary options not contextually filtered | Major | "Maintain shared" shown when no shared service exists; misleading for architects unfamiliar with the model |
| 4 | No integration dependency chain | Major | Choosing Xero over SAP might break integrations with 3 capability-consuming systems, but tool doesn't show system-to-system links |
| 5 | No cross-decision state visibility | Major | After making 3 decisions, no summary view of "decisions made so far and their cumulative impact" |
| 6 | Procure replacement doesn't list decommissions | Minor | Says "all current systems" but should explicitly list them with costs |
| 7 | No timeline sequencing after decision | Minor | After choosing Xero, no guidance on "start SAP exit process by X date" |

## Strengths

| # | Strength | Why It Matters |
|---|---|---|
| 1 | Capability blast radius with function checklist | Prevents siloed decisions — architect sees cross-function consequences immediately |
| 2 | Automatic deferral cost calculation | Saves manual calculation; frames the "cost of inaction" automatically |
| 3 | SAP separated as "capability platform" | Correctly distinguishes ERP from ordinary systems; different risk profile |
| 4 | Contract extension warnings in defer | Identifies which contracts need extension before vesting — actionable |
| 5 | "Partial predecessor system" badge | Immediately signals disaggregation complexity |
| 6 | Per-successor scoping correctness | West Elmhurst sees its own 4 systems; Ivy Hatherley sees its 3. No contamination |
| 7 | Edit flow with pre-fill | Iteration is frictionless — architects rarely get a decision right first time |
| 8 | Cross-tier badge on Finance row | "county and district functions may represent complementary delivery, not duplication" — sophisticated framing |
| 9 | Vesting zone badges on contracts | "Pre-vesting", "Year 1", "Natural expiry" — instantly communicates urgency |
| 10 | "1 of 2 decided" progress indicator | Clear progress tracking per function |

## Recommendations (Prioritised)

### Critical — Undermines utility for coordinated decisions

1. **Implement cross-successor decision visibility**
   **Rationale**: When Ivy Hatherley establishes SAP as a shared service, West Elmhurst's Finance panel must show "Ivy Hatherley has proposed SAP S/4HANA as a shared service for this function. Accept / Decline / Decide independently." Without this, the shared service feature is conceptually present but practically useless.

2. **Show other successor's decisions in panel header**
   **Rationale**: When opening Finance for West Elmhurst, show a note like "Ivy Hatherley: Decided — Xero Finance (retained)". This allows the architect to make informed decisions without switching perspectives back and forth.

### Major — Significantly reduces architectural confidence

3. **Filter boundary options contextually**
   **Rationale**: "Maintain shared service" only makes sense when `sharedWith` is populated. "Disaggregate" only makes sense for partial predecessor systems. Showing all options regardless creates false equivalence and confuses the decision space.

4. **Add cumulative decision summary**
   **Rationale**: After making 5+ decisions, an architect needs a summary: "3 systems retained, 7 decommissioned, 2 shared services established, estimated £4.2m annual savings vs £800k migration cost." The simulation panel exists but needs this synthesis.

5. **Show system-to-system integration dependencies**
   **Rationale**: SAP "provides Payments, Workflow" is function-level. But which specific systems CONSUME these capabilities? If I decommission SAP, which systems lose their payment gateway? The CONSUMES_CAPABILITY edges exist in the model — surface them in the decision panel.

### Enhancement — Would meaningfully improve decision quality

6. **Add decision timeline implications**
   **Rationale**: After choosing Xero, show: "SAP notice period: 18 months. To exit SAP by vesting (Apr 2027), notice must be served by Oct 2025 (OVERDUE). Migration of 7,000 users from SAP to Xero requires planning." Frame the time dimension of the decision.

7. **Cost comparison table across options**
   **Rationale**: Present a table: "Keep SAP: £2.3m/yr ongoing, 0 users to migrate | Keep Xero: £35k/yr ongoing, 7,095 users to migrate | Procure: £TBD + all 7,140 users | Defer: £2.475m/yr parallel running". Currently the user must mentally construct this comparison.

8. **Procure replacement explicit decommission list**
   **Rationale**: When selecting "Procure replacement", list "Will decommission: SAP S/4HANA ERP (7,000 users), Unit4 (95 users), Xero (45 users)" — same format as "Choose existing" decommission preview.

### Nice-to-have

9. **Decision confidence indicator**: Let the architect mark a decision as "firm" vs "exploratory". Exploration decisions shouldn't propagate shared service proposals.

10. **Undo last decision**: Quick undo without opening the panel, editing, and re-confirming.

---

## Overall Verdict

**Utility Score: 3.5/5**

- The tool provides **genuine, actionable value** for individual decisions within a single successor. The system comparison cards, blast radius, deferral comparison, and decommission preview are all well-designed and useful.
- The critical weakness is **cross-successor coordination**. In a mega-merger with 2+ successors sharing a disaggregated county, decisions cannot be made in isolation — they are inherently interdependent. The tool currently treats them as independent, which means the most important architectural decisions (SAP strategy, shared services, county disaggregation) can't be properly modelled.
- The **boundary options infrastructure exists** but lacks the contextual intelligence to guide the architect toward the right option. Showing "Maintain shared" when there's no shared service, or "Disaggregate" for a cloud system from a full predecessor, dilutes trust.

**Bottom line**: I would use this tool to structure and record my decisions, and the blast radius / deferral analysis genuinely saves time. But for the hardest decisions — cross-boundary SAP strategy, shared service negotiations — I'd still need a whiteboard session because the tool can't model the interdependencies between successor authorities.
