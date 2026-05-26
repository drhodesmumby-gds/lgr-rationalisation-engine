---
title: Simulation
order: 5
section: user-guide
---

# Simulation

Simulation mode lets you model rationalisation decisions and see their projected impact on the combined estate before committing to a plan. It translates high-level choices ("keep this system, decommission that one") into concrete obligations with full before/after impact analysis.

## What simulation does

From the Stage 3 dashboard, entering simulation mode opens a decision-driven workflow. For each function in each successor authority, you answer two questions:

1. **Which system(s) should the successor use?** - choose from existing systems, procure a replacement, or defer
2. **What happens to the operating model boundary?** - disaggregate, maintain a shared service, or establish a new one

The engine then projects the consequences: what data needs to move, what governance arrangements are needed, how the estate metrics change, and where decisions in one successor affect systems shared with another.

## Types of decisions

### Choose system

Select one or more systems to retain for this function. Other systems are marked for decommissioning. The engine calculates migration obligations (users moving between systems) and surfaces data complexity based on portability and partitioning.

### Decommission

Explicitly mark a system for retirement. The engine generates obligations for data migration, user transition, and any capability dependencies that need resolving first.

### Defer

Mark a function as "decision deferred" - the team is not ready to decide yet. Deferred functions appear in reports with their notice trigger dates so Commercial teams can track which deferrals have time-sensitive deadlines.

### Procure new

Indicate that the successor will procure a replacement system rather than adopting any existing one. All current systems are marked for eventual decommissioning, with appropriate migration obligations.

## Decision panel UI

When you click **Decide** on a function cell, the decision panel opens showing:

- **All competing systems** for that function in that successor
- **System metadata** - vendor, users, cost, contract dates, portability, data partitioning
- **Signal summary** - relevant signals for this specific decision context
- **Radio buttons** for system selection (choose, decommission, defer, procure)
- **Operating model boundary options** - only those valid for the current context

### Blast radius preview

Before confirming a decision, the panel shows a **blast radius preview** - a summary of what would be affected:

- Systems that consume capabilities from the system being decommissioned
- Users that would need to migrate
- Data extraction complexity (based on portability and partitioning ratings)
- Cross-successor impacts where a system is shared with other successor authorities

> **Note:** The blast radius preview is informational. You can still proceed with the decision - it ensures you make it with full visibility of the downstream consequences.

## Obligations generated

Each decision generates concrete obligations that appear in the simulation workspace:

### Migration obligations

Generated when users or data must move between systems. Include:

- **Source and target system** - where data/users are coming from and going to
- **Severity** - based on data complexity (monolithic + low portability = high severity)
- **User count** - how many users are affected
- **Data complexity flags** - ERP status, portability rating, partitioning type

### Governance obligations

Generated when shared service arrangements need formal governance:

- **Shared service continuation** - existing shared service maintained across successor boundaries
- **New shared service establishment** - fresh governance arrangement required
- **Cross-successor coordination** - decisions that affect systems in multiple successors

### Capability gap obligations

Generated when decommissioning a system that provides capabilities consumed by other systems:

- **Affected consumers** - which systems lose a capability dependency
- **Capability type** - what capability is at risk (payments, forms, identity, etc.)
- **Resolution required** - the consuming systems need an alternative provider

## Scenario management

Decisions are not permanent. The engine supports full scenario management:

### Save scenario

Export your current set of decisions as a JSON file. The file captures what was decided for each function in each successor - but not the full impact analysis (that is reconstructed on load).

### Load scenario

Import a previously saved scenario file. The engine re-applies all decisions and reconstructs the projected impact from your current architecture data.

### Multiple scenarios

You can save different scenario files representing alternative approaches (e.g., "aggressive consolidation" vs "minimal disruption") and compare their estate-level impacts by loading them sequentially.

### Sharing scenarios

Scenario files are portable JSON. Share them with colleagues who have the same architecture data loaded - they will see the same projected impact. This enables asynchronous decision-making across teams.

## Report export

From simulation mode, generate persona-tailored HTML reports:

### Executive report

- Estate posture summary (before/after metrics with deltas)
- Decision overview grouped by tier priority
- Cost impact analysis
- Timeline summary of transition actions

### Commercial report

- Contract detail per decision (vendor, dates, notice periods)
- Date-ordered procurement action timeline with vesting-relative deadlines
- Deferred system notice triggers (so nothing slips)
- Vendor consolidation analysis (volume and leverage opportunities)

### Architect report

- Technical posture narrative (e.g., "ERP footprint reduces from 4 to 2")
- Obligation tables with migration severity and data complexity flags
- System-level detail for each decision
- Capability dependency impacts

> **Note:** Reports are self-contained HTML files that can be shared with stakeholders who do not have access to the tool. They include all relevant context for their target audience.

## Cross-successor decisions

Some decisions affect multiple successor authorities - particularly when dealing with:

- **Partial predecessors** - a system from a county council allocated to multiple successors
- **Shared services** - systems shared between councils assigned to different successors
- **Capability providers** - platform systems that provide capabilities consumed by systems in other successors

The engine surfaces these cross-successor impacts explicitly. When you decommission a system in one successor, you see whether it has implications for other successors. This prevents decisions made in isolation from creating invisible problems elsewhere.

## Tips for effective simulation

| Tip | Rationale |
|-----|-----------|
| Start with Tier 1 functions | Day 1 Critical services need decisions first - and their impacts cascade to other decisions |
| Review blast radius before confirming | A single ERP decommission can trigger capability gaps in 5+ downstream systems |
| Use "Defer" liberally in early sessions | Not every decision needs to be made immediately - mark what you are not ready to decide |
| Save scenarios frequently | Export after each session so you can return to previous decision states |
| Switch personas when reviewing | The same decisions look different through Executive, Commercial, and Architect lenses |
| Check cross-successor impacts last | After making within-successor decisions, review the cross-successor view for spillover effects |
