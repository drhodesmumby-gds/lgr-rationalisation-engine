---
title: Signals and Analysis
order: 4
section: user-guide
---

# Signals and Analysis

The analysis dashboard is the main output of the engine. It presents your combined IT estate as a structured matrix with configurable signals that surface factual observations about risk, complexity, and opportunity - without prescribing conclusions.

## What signals are

Signals are factual observations derived from your data. They are not recommendations. Each signal measures one specific aspect of the systems within a function row and presents it as neutral information for your team to interpret in context.

For example, the "Contract urgency" signal does not tell you *what to do* about an expiring contract. It tells you *when* the notice period triggers relative to your vesting date, so the right people can make that decision with full visibility.

## Why signals matter

In a reorganisation involving multiple councils, the combined estate may have 100+ IT systems across 50+ functions. Without structured signals:

- Contract deadlines are hidden in spreadsheets and discovered too late
- Vendor consolidation opportunities are invisible because data lives in silos
- Data disaggregation complexity is not apparent until migration planning begins
- Shared service dependencies cross successor boundaries without anyone noticing

Signals make these observations visible, filterable, and actionable at the point of decision.

## The 10 signals explained

### Contract urgency

**What it measures:** How soon the earliest notice period trigger fires across all systems in a function row, classified relative to your vesting date.

**Zones:**
- **Pre-vesting** - action required before the new authority exists
- **Year 1** - action required in the first year after vesting
- **Natural expiry** - contract expires naturally within a manageable window
- **Long-tail** - contract runs well beyond the transition period

**Example:** A system with a March 2027 contract end and 12-month notice period has a notice trigger of March 2026. If your vesting date is April 2027, this is a pre-vesting trigger requiring action under the shadow authority arrangements.

**Who cares most:** Executive (what must be resolved before Day 1), Commercial (which contracts expose us to auto-renewal).

### User volume

**What it measures:** The relative scale of competing systems by reported user count, including detection of "anchor" systems.

**Anchor detection:** When one system has at least 50% more users than the next largest, it is flagged as the anchor system - the system with the most gravitational weight that, all else being equal, minimises disruption if adopted.

**Example:** Three councils serve Housing Benefits. Council A has 3,500 users, Council B has 2,200, and Council C has 800. Council A's system is the anchor (3,500 is more than 50% above 2,200).

**Who cares most:** Executive (operational risk of user migration), Architect (migration scale and complexity).

### Monolithic data

**What it measures:** Presence of systems with entangled data structures that would require ETL (Extract, Transform, Load) work to disaggregate.

**Triggered when:** A system has `dataPartitioning: "Monolithic"` or is flagged as an ERP system (`isERP: true`).

**Why it matters:** Monolithic data systems cannot be cleanly split across successor authorities. Data extraction projects are needed before any disaggregation or migration can proceed.

**Example:** A county-wide Oracle ERP with monolithic data partitioning spanning finance, HR, and payroll. When the county is a partial predecessor, all three functions inherit disaggregation complexity.

**Who cares most:** Architect (where will disaggregation be hardest), Executive (operational risk from data entanglement).

### Data portability

**What it measures:** The worst data portability rating present in the function row - specifically Low and Medium portability systems that pose data extraction challenges.

**Ratings:**
- **High** - open APIs, standard formats, vendor provides export tools
- **Medium** - some export capability but may require vendor support or have proprietary elements
- **Low** - proprietary format, no bulk export API, significant vendor lock-in

**Example:** A legacy on-premise planning system with Low portability. Migrating away requires the vendor's active cooperation and likely a bespoke data extraction project.

**Who cares most:** Architect (vendor lock-in risk, migration complexity), Commercial (negotiation leverage with locked-in vendors).

### Vendor density

**What it measures:** Whether the same vendor appears across multiple councils for the same function - a potential consolidation or renegotiation opportunity.

**Example:** Three councils all use Civica for Revenues and Benefits. This signals a potential volume discount negotiation or a simpler consolidation path (same platform, different instances).

**Who cares most:** Commercial (procurement leverage, framework consolidation), Executive (consolidation simplicity).

### On-premise systems (tech debt)

**What it measures:** Systems hosted on council-owned infrastructure rather than cloud/SaaS.

**Why it matters:** On-premise systems create infrastructure transfer obligations. The hosting environment (servers, data centres, network) must either transfer to the successor authority or the system must be migrated to cloud before or during transition.

**Example:** An on-premise Capita Revenues system running on council-owned servers. When that council dissolves, someone must take responsibility for the physical infrastructure - or the system must be moved to cloud.

**Who cares most:** Architect (infrastructure obligations, cloud migration planning).

### TCoP alignment

**What it measures:** How well each system aligns with five points from the UK Government Technology Code of Practice.

**Points assessed:**

| Point | What is checked |
|-------|-----------------|
| Point 3 - Spend controls | Low portability creates spend risk through vendor lock-in |
| Point 4 - Open standards | Portability rating (High = aligned, Low = concern) |
| Point 5 - Cloud first | Whether the system is cloud-hosted |
| Point 9 - Modularity | ERP + monolithic data indicates a modularity concern |
| Point 11 - Commercial | Low portability triggers vendor lock-in concern |

**Example:** A monolithic on-premise ERP with Low portability would flag concerns on Points 3, 4, 5, 9, and 11 - a clear signal for the architecture team.

**Who cares most:** Architect (technology standards compliance, technical risk assessment).

### Shared service

**What it measures:** Systems jointly operated by multiple predecessor councils that will need unwinding or re-contracting during transition.

**Boundary crossing:** In transition mode, the engine checks whether a shared system crosses successor authority boundaries - that is, whether the sharing councils are assigned to different successors. This is flagged distinctly because it requires inter-authority governance arrangements.

**Example:** NEC Revenues shared between Easton District and Southby Borough. If Easton goes to North Unitary and Southby goes to South Unitary, the shared service crosses a successor boundary and needs a formal governance decision.

**Who cares most:** Commercial (contract re-negotiation), Executive (governance arrangements across successors).

### Support model

**What it measures:** The sustainability of system maintenance arrangements - whether the system has a commercial vendor SLA, is community-maintained, or has no active support.

**Ratings:**
- **Vendor-supported** - commercial vendor with SLA, support contract, and product roadmap
- **Community-supported** - maintained collaboratively (multi-council consortium, open source, shared digital team)
- **Unsupported** - no active maintenance agreement (developer left, product end-of-life, no SLA)

**Example:** A bespoke scheduling system built by a developer who has since left the council, with no documentation and no support contract. Flagged as unsupported - a Day 1 risk if it fails during transition.

**Who cares most:** Architect (sustainability risk), Executive (operational continuity).

### Same-vendor consolidation

**What it measures:** Where all or most systems serving a function come from the same vendor, suggesting consolidation may be simpler.

**Why it matters:** When multiple councils use the same vendor for the same function (potentially different versions or configurations), the consolidation path is often an instance merge or upgrade rather than a full platform migration.

**Example:** Four councils all run Civica for Council Tax. Consolidation likely means merging instances rather than migrating data between different platforms.

**Who cares most:** Commercial (vendor negotiation strategy, volume licensing), Executive (simpler consolidation path).

## Persona-specific weight defaults

Each persona starts with different signal weights reflecting their professional concerns:

| Signal | Executive | Commercial | Architect |
|--------|-----------|------------|-----------|
| Contract urgency | High | High | Low |
| User volume | Medium | Low | Medium |
| Monolithic data | High | Low | High |
| Data portability | Low | Off | High |
| Vendor density | Medium | High | Low |
| On-premise | Low | Off | High |
| TCoP alignment | Low | Off | High |
| Shared service | Medium | High | Low |
| Support model | Low | Low | Medium |
| Same-vendor consolidation | Medium | High | Medium |

Weight levels control visibility: **High** shows a coloured badge, **Medium** shows plain text, **Low** shows a small grey note, **Off** hides the signal entirely.

## How to adjust signal weights

1. Click **Signal Options** in the header controls (visible in Stage 3)
2. For each signal, select a weight: Off, Low, Medium, or High
3. The dashboard updates immediately to reflect your choices
4. Switching persona resets weights to that persona's defaults

> **Note:** Custom weight settings are useful when focusing a specific meeting or workshop. For example, set everything to Off except Contract urgency and Shared service when running a commercial strategy session.

## Reading the analysis dashboard

### The matrix

The main view is a matrix with:
- **Rows** - one per ESD function that appears in your uploaded data
- **Columns** - one per successor authority (transition mode) or predecessor council (discovery mode)
- **Cells** - show which system(s) serve that function, with metadata badges

### Sort and filter

- **Sort by:** Tier priority (default), collision count, alphabetical, or contract urgency
- **Filter by tier:** Show only Tier 1, Tier 2, or Tier 3 functions
- **Filter by collision status:** All functions, collisions only (2+ systems), or unique only (single system)

### Estate summary panel

At the top of the dashboard, summary metrics show:
- Total predecessor councils
- Total IT systems in scope
- Functions with cross-council collisions
- Combined annual spend
- Pre-vesting contract triggers
- Disaggregation count (systems requiring data splitting)

### Perspective filtering

Use the perspective dropdown to view the estate through a specific successor's lens. Non-relevant systems are dimmed, making it easy to see what belongs to each new authority.

## Rationalisation patterns

In transition mode, every function row is classified into one of four patterns:

| Pattern | Colour | Condition | What it means |
|---------|--------|-----------|---------------|
| **Inherit as-is** | Green | Single system, no disaggregation | No rationalisation decision needed. Focus on contract novation to the successor. |
| **Choose and consolidate** | Blue | Multiple systems, no disaggregation | Successor must pick which system to keep and plan decommissioning of others. |
| **Extract and partition** | Red | Disaggregation present, no competing systems | System must be split across successors. Data extraction project required. |
| **Extract, partition and consolidate** | Purple | Disaggregation + competing systems | Most complex: data must be split AND the receiving successor has competing systems to resolve. |

Patterns are assigned automatically based on the system allocations. They tell you the *type* of work required, not what decision to make.

## TCoP assessment

The Technology Code of Practice (TCoP) assessment gives architecture teams a quick compliance check. Each system is scored against five points, with concerns flagged when:

- Portability is Low (Points 3, 4, 11)
- System is not cloud-hosted (Point 5)
- System is an ERP with monolithic data (Point 9)

TCoP results appear in the analysis column at Medium or High weight for the Architect persona. They help prioritise which systems need modernisation investment during or after transition.
