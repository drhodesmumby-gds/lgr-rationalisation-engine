# LGR Transition Workspace Engine — Implementation Plan

This plan incorporates the findings from the red-team analysis, which tested the tool against real announced reorganisations (Essex, Surrey, Norfolk, Hampshire) from both CTO and Executive Board perspectives. The plan is grounded in the MHCLG Local Digital LGR Playbook and the Technology Code of Practice (TCoP).

The tool operates in two progressive modes:

- **Estate Discovery** (current behaviour, enhanced) — predecessor-column matrix, no transition structure required. Useful for initial baselining.
- **Transition Planning** (new) — successor-column matrix with vesting-anchored analysis, disaggregation patterns, and TCoP-aligned signals. Unlocked when a transition structure is defined.

---

## Priority 1 — Must Have

These changes are load-bearing. Without them the tool answers "what exists?" instead of "what do we need to do?" — a register, not an analysis.

### 1. Transition structure configuration with progressive refinement

Add an optional configuration step (Stage 1.5) where the user defines the successor structure and vesting date. The configuration accepts partial definitions and the tool degrades gracefully:

- **No structure defined** → predecessor-only view (current behaviour)
- **Partial structure** (successors named, allocation incomplete) → show what can be computed, flag ambiguity
- **Full structure** → successor-column matrix with complete analysis

The transition structure is a separate JSON or in-tool configuration:

```json
{
  "vestingDate": "2028-04-01",
  "successors": [
    {
      "name": "North East Essex",
      "fullPredecessors": ["Braintree DC", "Colchester BC", "Tendring DC"],
      "partialPredecessors": ["Essex CC"]
    }
  ]
}
```

Effects:
- Matrix pivots to successor columns in Transition Planning mode
- Systems from `fullPredecessors` are assigned to the successor directly
- Systems from `partialPredecessors` get a disaggregation flag — "this system may serve multiple successors; allocation review required"
- Individual systems can override with `targetAuthorities` on the node (the test-complex-lgr.json already includes this field — the engine must read it)
- If no `targetAuthorities` on a system from a partial predecessor, default to flagging for allocation review

This gives councils a path from coarse ("we know the council is splitting") to granular ("we know which systems go where") as planning progresses.

---

### 2. Vesting-anchored contract analysis

Replace the fixed 2024–2030 timeline and today-relative urgency calculation with vesting-date-anchored analysis. Contract urgency recalculates against the vesting date, not the current date. The timeline centres on the vesting date with four zones:

| Zone | Meaning |
|---|---|
| **Pre-vesting notice required** | Notice trigger falls before vesting. Predecessor must serve notice or the contract auto-renews into a period where the contracting entity has been abolished — legal and commercial risk. |
| **Year 1 successor window** | Notice trigger falls within 12 months after vesting. Successor must act quickly after formation. |
| **Natural expiry window** | Contract expires 1–3 years post-vesting. Playbook-aligned: "rationalise as contracts naturally expire." |
| **Long-tail contracts** | Expiry 3+ years post-vesting. No urgency. Run behind the veneer. |

The timeline visualises these zones with the vesting date as a vertical reference line. The analysis column references the zone, not just the raw date. When no vesting date is configured, fall back to today-relative calculation (current behaviour).

---

### 3. Playbook-aligned tiered prioritisation

Replace the alphabetical-within-collision-group sort with the playbook's tiered prioritisation:

- **Tier 1 (Day 1 critical)** — statutory/safeguarding services: adult social care, children's services, revenues & benefits, elections, payroll/HR/finance. Also: any system with a contract expiring before vesting that covers a statutory service.
- **Tier 2 (High priority)** — systems approaching contract renewal within 12 months of vesting; regulatory compliance datasets.
- **Tier 3 (Post-Day 1)** — everything else. Can run behind the "veneer" and be rationalised when contracts naturally expire.

Implementation: embed a default mapping of ESD function IDs to playbook tiers (176 entries, classifiable by inspection). Allow council override via a `tier` field on each Function node. Publish the default mapping as a visible reference within the tool so practitioners can see and challenge it.

The matrix sorts by tier first, then by collision count within tier. The board sees the most dangerous rows at the top.

---

### 4. Rationalisation pattern classification

For each function × successor cell (in Transition Planning mode), classify the rationalisation pattern using operational language aligned with the playbook:

| Pattern | Description | When it applies |
|---|---|---|
| **Inherit as-is** | Only one predecessor contributes this function. Successor inherits it. No action unless contract/TCoP issues. | Single-source function |
| **Choose and consolidate** | Multiple predecessors each have a system. Successor must pick one, consolidate, or re-procure. | Standard aggregation collision |
| **Extract and partition** | A partial predecessor's system must be disaggregated. Data extraction required. Playbook Section 5 applies. | County system serving multiple successors |
| **Extract, partition, AND consolidate** | A partial predecessor's system is disaggregated AND collides with another predecessor's system in the same successor. Two-step action: extract data, then decide target system. | e.g. Essex CC social care + Southend's existing social care in the same successor |

Visual treatment: colour-coded pattern tag at the top of each cell. The pattern determines which signals are most relevant — disaggregation cells emphasise data partitioning and portability; aggregation cells emphasise user volume and vendor density.

---

## Priority 2 — Should Have

These significantly improve the tool's analytical value and are feasible within the PoC scope.

### 5. TCoP alignment signal

Add a new signal computed from existing schema fields, framed as policy observation (not recommendation):

| Field | TCoP-aligned | TCoP concern |
|---|---|---|
| `isCloud: true` | Cloud first (Point 5) | — |
| `isCloud: false` | — | On-premise: consider cloud migration path |
| `portability: "High"` | Open standards (Point 4) | — |
| `portability: "Low"` | — | Vendor lock-in risk (Points 3, 4, 11) |
| `isERP: true` + `dataPartitioning: "Monolithic"` | — | Monolithic architecture (Point 9: modular components) |

Signal output framing: "System A meets cloud-first (Point 5) and open standards (Point 4). System B: on-premise, proprietary data format — does not currently meet Points 4 and 5. These are factors to consider alongside operational, commercial, and service-specific requirements."

This is factual and policy-grounded without telling anyone which system to buy.

---

### 6. Shared service detection

Add `sharedWith: string[]` to the ITSystem schema. If a system lists councils it's shared with, the tool flags:

- "This system is shared between [councils]."
- Under transition structure: "These councils will be in [same/different] successor(s)."
- If different successors: "Shared service unwinding required — review contract, data partition, hosting arrangements."

Shared service unwinding is one of the most operationally complex parts of LGR and easy to miss in a system-by-system review. The playbook's baselining section identifies "unclear contract ownership across collaborative arrangements" as a key risk category.

---

### 7. Disaggregation flag for partial predecessors

When a system belongs to a `partialPredecessor` and has no `targetAuthorities` override, surface the playbook Section 5 analysis:

- Flag: "Partial predecessor — this system may serve multiple successors. Allocation review required."
- Cross-reference `dataPartitioning`: Monolithic data + disaggregation = highest risk combination.
- Note: "The playbook recommends migration typically occurs by postcode. Verify whether this system's data can be filtered geographically."

The tool's job is to surface the problem and quantify it, not solve it. Geographic case allocation requires system-specific domain knowledge.

---

### 8. Estate summary panel

Add a dashboard header panel showing aggregate metrics:

```
ESTATE OVERVIEW                              TRANSITION RISK
Total predecessor IT spend: £X.Xm/yr         Contracts with notice trigger before vesting: N
Systems requiring disaggregation: N           Systems with Monolithic data + disaggregation: N
Shared services crossing successors: N        Estimated parallel running (Year 1): £Xm
```

This is the view that earns a seat at the programme board table — the answer to "how big is this problem?" before drilling into the matrix.

Requires `annualCost: number` alongside the existing display `cost` string for computation.

---

## Priority 3 — Could Have

Incremental improvements that enhance the tool but are not essential for the PoC to demonstrate value.

### 9. Financial distress flag

Add optional `financialDistress: boolean` to council-level metadata. If true, every system from that council gets a warning: "Predecessor in financial distress — verify system currency, support status, and licence compliance." This is a risk modifier that adjusts confidence in all metadata from that council.

---

### 10. Council tier metadata

Add `tier: "county" | "district" | "unitary"` to the council JSON. Use this to:

- Separate county-level and district-level functions that share an ESD ID (strategic planning vs development control) — reducing false collisions
- Visually distinguish the tier of origin in system cards
- Flag where a district successor is inheriting county-tier functions it has never delivered before (risk indicator)

The tier field is metadata, not a hard constraint. Flag it as indicative; let practitioners override.

---

### 11. Export for governance packs

A structured export — at minimum a well-formed HTML print view — that produces a baseline register suitable for a programme board. This is what turns the tool from a demo into something that earns trust inside a real LGR programme team.

---

## Schema evolution

All new fields are OPTIONAL. The mandatory schema stays minimal to avoid adoption friction:

**Mandatory** (unchanged): `id`, `label`, `type`, `lgaFunctionId` (functions), `id`, `label`, `type` (systems)

**New optional fields on ITSystem**: `annualCost` (number), `owner` (string — who operates it), `sharedWith` (string[]), `targetAuthorities` (string[])

**New optional fields on council-level metadata**: `tier`, `financialDistress`

**New configuration (separate from council data)**: transition structure with `vestingDate`, `successors[]`, `fullPredecessors[]`, `partialPredecessors[]`

A council that submits only system names and vendors still gets a useful (if limited) matrix. A council that submits full metadata gets the full analysis.

---

## Revised signal system

| Signal | What it computes | Playbook alignment |
|---|---|---|
| Contract urgency (vesting-anchored) | Months from notice trigger to vesting date. Zones: pre-vesting, Year 1, natural expiry, long-tail | "Rationalise as contracts naturally expire" |
| Rationalisation pattern | Inherit / consolidate / extract / extract+consolidate per cell | Section 5: Disaggregation tiers |
| TCoP alignment | Cloud, portability, modular assessment per system | Technology Code of Practice |
| Vendor density | Same vendor across predecessors feeding same successor | Section 3: Supplier capacity constraints |
| Data partition risk | Monolithic data + disaggregation pattern = highest risk | Section 5: "Migrating data is eye-wateringly expensive" |
| User volume | Proportionality indicator (anchor system) | — |
| Shared service exposure | Shared systems crossing successor boundaries | Section 3: "Unclear contract ownership across collaborative arrangements" |

Each signal output includes: the observation, the temporal context (relative to vesting), and the policy frame (which playbook section or TCoP point applies). The signal system moves from restating facts to framing rearchitecturing decisions in playbook and TCoP language.

---

## What is deliberately out of scope

- **System-to-system dependencies** — requires a full enterprise architecture repository (ArchiMate, TOGAF). A separate workstream.
- **Staffing/TUPE** — the tool is about technology, not people. User counts serve as a proxy for organisational scale.
- **Parish-level data partitioning** — the tool flags that a system requires allocation review. It cannot compute which case records belong to which parish.
- **Full outsourcing contract modelling** — the `owner` field distinguishes "council runs it" from "Capita runs it." Full exit charge / IP / TUPE modelling is beyond scope.
- **Programme timeline integration** — the tool needs the vesting date, not the entire programme Gantt chart.

---

## Implementation sequence

The sequence matters. Each step builds on the previous:

1. **Transition structure + vesting date** (Plan items 1, 2) — the foundation everything else depends on. Without successor awareness and a vesting date, the tool answers yesterday's question.
2. **Playbook tiering + pattern classification** (Plan items 3, 4) — transforms the matrix from an alphabetical list into a risk-prioritised decision queue with actionable pattern labels.
3. **TCoP signal + shared service detection** (Plan items 5, 6) — the cross-cutting analytical signals that a spreadsheet can't replicate.
4. **Disaggregation flags + estate summary** (Plan items 7, 8) — surfaces the highest-risk patterns and gives the programme board the "how big is this problem?" answer.
5. **Tier metadata + financial distress + export** (Plan items 9, 10, 11) — incremental refinements and the output format that gets the tool used in practice.
