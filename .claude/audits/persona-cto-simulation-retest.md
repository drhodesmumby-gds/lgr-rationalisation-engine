# CTO Persona Retest: Simulation Decision Modelling

## Date
2026-05-14

## Persona Tested
Enterprise Architect / CTO

## Context
Retesting 7 specific areas of recent changes to the simulation decision modelling, using example 08 (mega-merger-six-councils). All tests run via Playwright against the built `dist/lgr-rationalisation-engine.html`.

## Executive Summary

The simulation decision modelling has improved significantly. All 7 tested features are functional and correctly implemented. The two-column layout makes complex decisions scannable. Cross-successor coordination is visible and well-placed. Capability blast radius is the standout addition — it surfaces dependency information that would otherwise require manual architecture graph analysis. Minor issues: the ERP Impact "Retain for all" button is powerful but may need a confirmation step, and the cross-successor banner could be more visually prominent.

---

## Test Results

### Test 1: Capability Consumer Visibility

**Score: 4/5**

**Findings:**
- "Consumed by:" information is rendered in 7-8 system cards across the dashboard matrix
- Shows specific consumer systems and which capabilities they consume: `"Consumed by: Liquidlogic LAS Adult Social Care (Payments), Liquidlogic EHM Children's Services (Payments), Confirm Highways Management (Workflow)"`
- Styled in teal (`#0e7490`) with left border, visually distinct from other system card metadata
- Information is always visible in system cards — no expansion needed

**Strengths:**
- The capability-to-consumer mapping is immediately visible without interaction
- Naming both the consumer system AND the capability consumed is genuinely useful — tells you exactly what dependency exists
- The styling is subtle enough not to overwhelm but distinctive enough to notice

**Gaps:**
| # | Gap | Impact | Rationale |
|---|---|---|---|
| 1 | Consumer count not immediately visible | Low | The full text lists consumers individually, but a lead-in like "Consumed by (3 systems):" would help rapid scanning when there are many consumers |
| 2 | No reverse lookup from consumer to provider | Medium | If I'm looking at Liquidlogic LAS, I can't see what capabilities it consumes. The dependency is only shown on the provider side. |

**Verdict:** Useful. As an architect, seeing "SAP provides Payments and Workflow to 3 systems" is exactly what I need to assess decommissioning risk.

---

### Test 2: Cross-Successor Decision Coordination

**Score: 4/5**

**Findings:**
- After deciding Finance for Ivy Hatherley (chose Unit4), opening Finance for West Elmhurst shows:
  - Grey banner: `"Other successors: Ivy Hatherley Council: Chose: Unit4 Business World Finance"`
- Banner is positioned immediately below the header, above system cards and decision options
- Uses `bg-[#f3f2f1]` (light grey) background with border

**Strengths:**
- Position is correct — you see it before making your own choice
- Includes the specific system name, not just "decided"
- Would correctly show multiple successor decisions if more than 2 existed

**Gaps:**
| # | Gap | Impact | Rationale |
|---|---|---|---|
| 1 | Banner is visually subtle | Low | The grey-on-grey styling could be missed in a hurried review. A stronger left-border or icon would help. But it IS there and positioned correctly. |
| 2 | No link/action to "match" the other successor's decision | Low | Would be useful to have a "Choose same" shortcut, especially for commodity systems where alignment is desirable |

**Verdict:** Functional and well-placed. The information I need for coordination is exactly what's shown.

---

### Test 3: Decision Panel Layout

**Score: 5/5**

**Findings:**
- Two-column layout confirmed: `w-2/5` left (40%) for system cards, `flex-1` right for decision options
- Left column: "Competing Systems (3)" header, then system comparison cards with metadata (vendor, users, cost, contract end, portability, data partitioning)
- Right column: Axis 1 (System Choice), Axis 2 (Operating Model Boundary), ERP Impact
- Both columns independently scrollable (`overflow-y-auto`)
- Border separator between columns (`border-r border-[#b1b4b6]`)

**Strengths:**
- Can see system metadata while making decisions without scrolling between sections
- System cards include all critical metadata: cost, contract end, notice period, portability, data partitioning, ERP badge
- Clear visual hierarchy: systems are reference material (left), decisions are actions (right)
- "Capability platform impact" summary bar at bottom of left column is a nice touch

**Verdict:** Excellent. This is the layout that should have been there from the start. No improvements needed.

---

### Test 4: Cross-Successor Scoping

**Score: 5/5**

**Findings:**
- After deciding Finance for Ivy Hatherley (chose Unit4), opened Finance for West Elmhurst
- West Elmhurst shows 4 available systems: `Civica Financials (Elmhurst)`, `Civica Financials (Fairford)`, `Xero Finance (Grantham)`, `SAP S/4HANA ERP`
- ALL systems have `disabled: false` — none are greyed out or removed
- SAP (which is a shared partial predecessor system serving BOTH successors) is correctly available in BOTH
- Successfully applied SAP as the decision for West Elmhurst while Unit4 remains the decision for Ivy Hatherley

**Strengths:**
- Complete isolation between successor decisions
- Shared systems (SAP from county) correctly appear in both successor columns
- No cross-contamination — choosing a system for one successor does NOT affect availability for others

**Verdict:** Correct behaviour. The regression that was previously present (where decisions in one successor bled into another) is fully resolved.

---

### Test 5: Disaggregation Dropdown

**Score: 4/5**

**Findings:**
- Axis 2 "Operating Model Boundary" section visible when cell contains partial predecessor systems
- "Disaggregate — split system along successor boundaries" option available
- When selected, shows split rows with `<select>` dropdowns (not free text inputs)
- Dropdowns contain: `["Select successor", "West Elmhurst Council", "Ivy Hatherley Council"]`
- Default shows 2 split rows, with "+ Add split" button for more

**Strengths:**
- Using dropdowns prevents typos and ensures data integrity
- All successor names are correct and populated from the transition config
- The "Define how the system will be split. Each successor gets its own instance:" copy is clear

**Gaps:**
| # | Gap | Impact | Rationale |
|---|---|---|---|
| 1 | No label field immediately visible for the split instance | Low | The split rows should show what the resulting system will be called (e.g., "SAP Finance - North") — need to scroll or the field may be cut off |
| 2 | "Select successor" placeholder allows incomplete submission | Low | Should probably validate that all split rows have a successor selected before allowing Apply |

**Verdict:** Good implementation. The dropdown approach is correct and the successor names match the transition config.

---

### Test 6: Capability Blast Radius

**Score: 5/5**

**Findings:**
- When choosing Unit4 (non-SAP) in a cell containing SAP:
  - Red "Will decommission:" section shows what systems will be decommissioned and user migration counts
  - SAP correctly marked as "(ERP — also serves other functions, won't be fully decommissioned)"
  - Teal "Capability impact:" section appears: `"SAP S/4HANA ERP provides Payments, Workflow to 3 systems. These capabilities will need alternative provision if the above system is fully decommissioned."`
- Additionally, a "Capability platform impact" summary at the bottom of the left column states: `"1 capability platform in this cell serves 2 other functions. These are managed independently from the function-delivery decision above."`
- Systems that provide capabilities are clearly separated in the system choice list with header: "Systems that provide capabilities to other systems:"

**Strengths:**
- Three-layer visibility: (1) system list separation, (2) inline blast radius on non-provider selection, (3) summary bar
- The capability names are specific (Payments, Workflow) not just a count
- The consumer count (3 systems) tells me the blast radius magnitude
- The italicised note "These capabilities will need alternative provision..." is appropriately cautious — flags the issue without prescribing a solution
- The "won't be fully decommissioned" note on ERP systems prevents misunderstanding

**Verdict:** This is the strongest addition. As a CTO, this is exactly the information I need to avoid unintended cascading failures from system decisions.

---

### Test 7: ERP Impact Section

**Score: 4/5**

**Findings:**
- ERP Impact section renders with header "ERP Impact"
- Shows: `"SAP S/4HANA ERP — SAP"` with red ERP badge
- Content: `"Serves 3 functions in Ivy Hatherley Council — 0/3 decided:"`
- Checklist shows: `[x] Finance — THIS DECISION`, `[ ] Human resources — Undecided`
- Bulk action: `"Retain SAP S/4HANA ERP for all 2 undecided functions?"` with explanation and button
- Explanatory note: `"Removing this ERP from one function does not decommission it — it continues to serve other functions unless all are decided away."`

**Strengths:**
- "Retain for all N undecided functions" is clearer than the old "Apply to all" — it specifies what "all" means
- The explanation of what the button does (lists the specific functions) prevents misunderstanding
- The "won't decommission unless all decided away" note is critical for ERP understanding
- Checklist format shows progress at a glance

**Gaps:**
| # | Gap | Impact | Rationale |
|---|---|---|---|
| 1 | No confirmation step for "Retain for all" bulk action | Medium | One click applies decisions to potentially many functions. A confirmation dialog ("This will set SAP as the chosen system for Human resources and Highways. Continue?") would add safety for irreversible-feeling actions. |
| 2 | Counter shows "0/3 decided" but one is "THIS DECISION" | Low | Slightly confusing — if the current decision hasn't been applied yet, is it 0 or 1 decided? The `[x]` checkbox next to "THIS DECISION" implies it's decided, but the counter says 0/3. |

**Verdict:** Good. The wording change from "Apply to all" to "Retain [system] for all N undecided functions" is a genuine improvement in clarity.

---

## Overall Scoring

| Area | Score | Notes |
|---|---|---|
| 1. Capability visibility | 4/5 | Shows what depends on what, correctly placed in system cards |
| 2. Cross-successor awareness | 4/5 | Banner works, correctly positioned, could be slightly more prominent |
| 3. Layout and readability | 5/5 | Two-column is excellent, system cards as reference while deciding |
| 4. Correctness | 5/5 | No cross-contamination, decisions are fully isolated |
| 5. Overall utility | 4/5 | Would genuinely help make real decisions; blast radius is standout |

**Overall: 4.4/5**

---

## Critical Issues

None. All tested features work correctly.

## Recommendations (prioritised)

### High value — Would meaningfully improve utility
1. **Confirmation dialog for "Retain for all" bulk ERP action**
   **Rationale**: One click applies decisions across multiple functions. The current design shows what will happen (lists the functions), but there's no "Are you sure?" step. For an action with this blast radius, a confirmation is warranted.

2. **Reverse capability lookup on consumer systems**
   **Rationale**: Currently, only provider systems show "Consumed by:". Consumer systems don't show "Depends on: SAP (Payments)". This bidirectional visibility would help when deciding a function where the consumer lives but the provider is in a different function row.

### Medium value — Nice to have
3. **Slightly stronger visual weight on cross-successor banner**
   **Rationale**: The grey banner works but could be missed under time pressure. A left border in the GDS blue (`#1d70b8`) or a small icon would help without being intrusive.

4. **"Match other successor" shortcut button**
   **Rationale**: When cross-successor banner shows another successor chose a commodity system, a "Choose same" button would streamline alignment decisions.

### Low priority
5. **Consumer count in "Consumed by" header**
   **Rationale**: "Consumed by (3):" would aid rapid scanning vs. reading the full list.

6. **ERP Impact counter clarification**
   **Rationale**: The "0/3 decided" counter while showing `[x] THIS DECISION` creates a minor cognitive mismatch.
