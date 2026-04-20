# Requirements Document

## Introduction

The LGR Transition Workspace Engine is a single-file, browser-based tool for analysing the combined IT estate of merging English local authorities during Local Government Reorganisation (LGR). It currently operates as an estate discovery tool — ingesting council architecture exports, reconciling them against the LGA/ESD Standard Function Taxonomy, and rendering a configurable signal matrix with predecessor councils as columns.

This requirements document describes the Transition Planning feature set: the capabilities needed to transform the tool from an estate register into an analytical workspace that helps programme teams make technical rearchitecturing decisions. The feature set is grounded in the MHCLG Local Digital LGR Playbook and the Technology Code of Practice (TCoP), and was validated through red-team analysis against four real announced reorganisations (Essex 15→5, Surrey 12→2, Norfolk 8→3, Hampshire 16→4+IoW).

The tool will operate in two progressive modes:
- **Estate Discovery** (current, enhanced) — predecessor-column matrix, no transition structure required
- **Transition Planning** (new) — successor-column matrix with vesting-anchored analysis, disaggregation patterns, and playbook-aligned signals

All new schema fields are optional. The mandatory schema remains minimal to avoid adoption friction. The tool degrades gracefully with partial data.

## Glossary

- **Engine**: The LGR Transition Workspace Engine application (`lgr-rationalisation-engine.html`)
- **Predecessor_Council**: A local authority that will cease to exist after LGR vesting day (county councils, district councils, existing unitaries being absorbed)
- **Successor_Authority**: A new unitary authority created by the Structural Change Order, inheriting services and systems from one or more Predecessor_Councils
- **Vesting_Date**: The legal date on which Successor_Authorities come into existence and Predecessor_Councils are abolished
- **Transition_Structure**: The configuration defining which Predecessor_Councils map to which Successor_Authorities, including the Vesting_Date
- **Full_Predecessor**: A Predecessor_Council whose entire estate transfers to a single Successor_Authority
- **Partial_Predecessor**: A Predecessor_Council whose estate must be split across multiple Successor_Authorities (e.g. a county council in a multi-unitary reorganisation)
- **Disaggregation**: The process of partitioning a Partial_Predecessor's system and data across multiple Successor_Authorities
- **Notice_Trigger**: The date by which contractual notice must be served to avoid auto-renewal, calculated as contract expiry minus notice period
- **Playbook**: The MHCLG Local Digital LGR Playbook — authoritative guidance for IT rearchitecturing during LGR
- **TCoP**: The Technology Code of Practice — government policy defining standards for technology decisions (cloud-first, open standards, modular architecture, etc.)
- **Veneer_Strategy**: The Playbook's recommended Day 1 approach — a unified website front door over retained legacy systems, deferring big-bang migration
- **Signal**: A neutral, factual observation derived from estate data, rendered in the analysis column with configurable weight
- **Rationalisation_Pattern**: The classification of what action is required for a given function within a given Successor_Authority (inherit, consolidate, extract, or extract-and-consolidate)
- **ESD_Function**: A service function from the LGA/ESD Standard Function Taxonomy (176 entries), used as the common reference for reconciling council services
- **Anchor_System**: The system with the highest user count in a function row, identified when it exceeds the next-largest system by at least 50%
- **Estate_Discovery_Mode**: The operating mode where no Transition_Structure is defined; the matrix shows Predecessor_Council columns (current behaviour)
- **Transition_Planning_Mode**: The operating mode where a Transition_Structure is defined; the matrix pivots to Successor_Authority columns with vesting-anchored analysis
- **Shared_Service**: An IT system jointly operated or contracted by two or more Predecessor_Councils
- **Annual_Cost**: A numeric representation of a system's yearly operating cost, used for aggregation and computation
- **Financial_Distress**: A flag indicating a Predecessor_Council is under Section 114 notice or equivalent financial stress, affecting confidence in all metadata from that council

## Requirements

### Requirement 1: Transition Structure Configuration

**User Story:** As a programme team member, I want to define the successor authority structure and vesting date, so that the Engine can analyse the estate from the perspective of what each successor needs rather than what each predecessor has.

#### Acceptance Criteria

1. THE Engine SHALL accept an optional Transition_Structure configuration containing a Vesting_Date and an array of Successor_Authorities, where each Successor_Authority has a name, an array of Full_Predecessors, and an array of Partial_Predecessors.
2. WHEN no Transition_Structure is defined, THE Engine SHALL operate in Estate_Discovery_Mode with Predecessor_Council columns (current behaviour preserved).
3. WHEN a Transition_Structure is defined with Successor_Authorities and a Vesting_Date, THE Engine SHALL operate in Transition_Planning_Mode with Successor_Authority columns.
4. WHEN operating in Transition_Planning_Mode, THE Engine SHALL assign systems from Full_Predecessors directly to the corresponding Successor_Authority column.
5. WHEN operating in Transition_Planning_Mode, THE Engine SHALL flag every system from a Partial_Predecessor as requiring allocation review, unless that system has a `targetAuthorities` override on the node.
6. WHEN a system node includes a `targetAuthorities` array, THE Engine SHALL use that array to assign the system to the specified Successor_Authorities, overriding the Partial_Predecessor default.
7. WHEN a system from a Partial_Predecessor has `targetAuthorities` listing multiple Successor_Authorities, THE Engine SHALL display that system in each listed Successor_Authority column with a Disaggregation indicator.
8. THE Engine SHALL accept partial Transition_Structure definitions where Successor_Authorities are named but predecessor allocation is incomplete, and SHALL display available analysis while flagging ambiguous allocations.
9. WHEN the user updates the Transition_Structure (adding successors, moving predecessors, changing the Vesting_Date), THE Engine SHALL recompute the matrix and all signals without requiring a full data reload.

### Requirement 2: Vesting-Anchored Contract Analysis

**User Story:** As a programme board member, I want contract urgency measured relative to the vesting date rather than today's date, so that I can distinguish between contracts requiring predecessor action before vesting and contracts the successor will inherit.

#### Acceptance Criteria

1. WHEN a Vesting_Date is configured, THE Engine SHALL compute each system's Notice_Trigger relative to the Vesting_Date and classify it into one of four zones: pre-vesting notice required, Year 1 successor window (within 12 months after vesting), natural expiry window (1–3 years post-vesting), or long-tail contract (3+ years post-vesting).
2. WHEN a Vesting_Date is configured, THE Engine SHALL render the contract timeline centred on the Vesting_Date with a vertical reference line marking vesting day.
3. WHEN a Notice_Trigger falls before the Vesting_Date, THE Engine SHALL display a signal indicating that the Predecessor_Council must serve notice or the contract auto-renews into a post-vesting period where the contracting entity will have been abolished.
4. WHEN no Vesting_Date is configured, THE Engine SHALL fall back to the current today-relative contract urgency calculation.
5. THE Engine SHALL display the timeline zone classification (pre-vesting, Year 1, natural expiry, long-tail) in the contract urgency signal output alongside the raw date.
6. WHEN a Vesting_Date is configured, THE Engine SHALL adapt the timeline date range to centre on the Vesting_Date rather than using the fixed 2024–2030 range.

### Requirement 3: Playbook-Aligned Tiered Prioritisation

**User Story:** As a transition board member, I want the matrix sorted by statutory criticality and Day 1 risk rather than alphabetically, so that the most dangerous rationalisation decisions appear at the top of the screen.

#### Acceptance Criteria

1. THE Engine SHALL embed a default mapping of ESD_Function identifiers to Playbook tiers: Tier 1 (Day 1 critical — statutory and safeguarding services), Tier 2 (high priority — approaching contract renewal or regulatory compliance), and Tier 3 (post-Day 1 — can run behind the veneer).
2. THE Engine SHALL sort the matrix by Playbook tier first (Tier 1 at top), then by collision count within each tier, then alphabetically within each collision group.
3. WHEN a Function node includes a `tier` field, THE Engine SHALL use that value to override the default ESD-to-tier mapping for that function.
4. THE Engine SHALL display the tier classification visually in each function row header.
5. THE Engine SHALL publish the default ESD-to-tier mapping as a visible reference within the tool so that practitioners can inspect and challenge the classification.
6. WHEN a Vesting_Date is configured and a system covers a Tier 3 function but has a contract expiring before vesting, THE Engine SHALL promote that function row to Tier 2 for sorting purposes.

### Requirement 4: Rationalisation Pattern Classification

**User Story:** As a CTO, I want each function cell in the successor matrix classified by its rationalisation pattern, so that I can immediately see whether a function requires inheritance, consolidation, data extraction, or a combination.

#### Acceptance Criteria

1. WHEN operating in Transition_Planning_Mode, THE Engine SHALL classify each function × Successor_Authority cell into one of four Rationalisation_Patterns: inherit-as-is, choose-and-consolidate, extract-and-partition, or extract-partition-and-consolidate.
2. WHEN only one Predecessor_Council contributes a function to a Successor_Authority, THE Engine SHALL classify that cell as inherit-as-is.
3. WHEN multiple Predecessor_Councils each contribute a system for the same function to a Successor_Authority and none are Partial_Predecessors, THE Engine SHALL classify that cell as choose-and-consolidate.
4. WHEN a Partial_Predecessor's system must be disaggregated to serve a Successor_Authority and no other Predecessor_Council contributes a competing system for that function, THE Engine SHALL classify that cell as extract-and-partition.
5. WHEN a Partial_Predecessor's system must be disaggregated to serve a Successor_Authority AND another Predecessor_Council also contributes a system for the same function, THE Engine SHALL classify that cell as extract-partition-and-consolidate.
6. THE Engine SHALL display the Rationalisation_Pattern as a colour-coded tag at the top of each cell in Transition_Planning_Mode.
7. WHEN a cell is classified as extract-and-partition or extract-partition-and-consolidate, THE Engine SHALL emphasise the data partitioning and portability signals for systems in that cell.
8. WHEN a cell is classified as choose-and-consolidate, THE Engine SHALL emphasise the user volume, vendor density, and TCoP alignment signals for systems in that cell.

### Requirement 5: TCoP Alignment Signal

**User Story:** As an enterprise architect, I want each system assessed against the Technology Code of Practice criteria, so that rationalisation decisions are framed in government policy language suitable for governance papers.

#### Acceptance Criteria

1. THE Engine SHALL compute a TCoP alignment assessment for each system using the existing schema fields: `isCloud`, `portability`, `isERP`, and `dataPartitioning`.
2. WHEN a system has `isCloud: true`, THE Engine SHALL note alignment with TCoP Point 5 (cloud first).
3. WHEN a system has `isCloud: false`, THE Engine SHALL note a TCoP concern regarding on-premise hosting (Point 5).
4. WHEN a system has `portability: "High"`, THE Engine SHALL note alignment with TCoP Point 4 (open standards).
5. WHEN a system has `portability: "Low"`, THE Engine SHALL note a TCoP concern regarding vendor lock-in risk (Points 3, 4, 11).
6. WHEN a system has `isERP: true` and `dataPartitioning: "Monolithic"`, THE Engine SHALL note a TCoP concern regarding monolithic architecture (Point 9: modular components).
7. THE Engine SHALL frame TCoP signal output as policy observation, not recommendation — stating which TCoP points a system meets or does not meet, followed by "These are factors to consider alongside operational, commercial, and service-specific requirements."
8. THE Engine SHALL integrate the TCoP alignment signal into the existing signal weight system with configurable weight per persona.

### Requirement 6: Shared Service Detection

**User Story:** As a commercial lead, I want shared services between predecessor councils identified and analysed against the successor structure, so that shared service unwinding requirements are surfaced before they become programme risks.

#### Acceptance Criteria

1. THE Engine SHALL accept an optional `sharedWith` array of council name strings on ITSystem nodes.
2. WHEN a system has a `sharedWith` array, THE Engine SHALL display a shared service indicator on that system's card showing which councils share the system.
3. WHEN operating in Transition_Planning_Mode and a shared system's councils are assigned to different Successor_Authorities, THE Engine SHALL flag that shared service unwinding is required — reviewing contract ownership, data partition, and hosting arrangements.
4. WHEN operating in Transition_Planning_Mode and a shared system's councils are assigned to the same Successor_Authority, THE Engine SHALL note that the shared service continues within the same successor.
5. THE Engine SHALL integrate shared service exposure as a signal in the analysis column with configurable weight per persona.

### Requirement 7: Disaggregation Flag for Partial Predecessors

**User Story:** As a CTO, I want systems from partial predecessors flagged with Playbook Section 5 analysis, so that I can identify which systems require data extraction planning and assess the risk based on their data characteristics.

#### Acceptance Criteria

1. WHEN a system belongs to a Partial_Predecessor and has no `targetAuthorities` override, THE Engine SHALL display a flag: "Partial predecessor — this system may serve multiple successors. Allocation review required."
2. WHEN a flagged system has `dataPartitioning: "Monolithic"`, THE Engine SHALL highlight this as the highest-risk combination (monolithic data requiring disaggregation).
3. WHEN a flagged system has `dataPartitioning: "Segmented"`, THE Engine SHALL note that geographic data partitioning may be feasible, referencing the Playbook recommendation that migration typically occurs by postcode.
4. THE Engine SHALL display the disaggregation flag in every Successor_Authority column where the Partial_Predecessor's system appears.

### Requirement 8: Estate Summary Panel

**User Story:** As a programme board member, I want an aggregate overview of the combined estate and transition risk metrics, so that I can answer "how big is this problem?" before drilling into the matrix.

#### Acceptance Criteria

1. THE Engine SHALL display a summary panel above the matrix in Stage 3 showing estate overview metrics.
2. THE Engine SHALL compute and display the total number of predecessor councils, successor authorities (if configured), and the Vesting_Date (if configured).
3. THE Engine SHALL compute and display the total number of systems and the number of ESD_Functions with cross-council collisions.
4. WHEN systems have `annualCost` numeric values, THE Engine SHALL compute and display the total annual IT spend across all predecessors.
5. WHEN a Vesting_Date is configured, THE Engine SHALL compute and display the count of contracts with Notice_Triggers falling before vesting.
6. WHEN operating in Transition_Planning_Mode, THE Engine SHALL compute and display the count of systems requiring disaggregation and the count of systems with monolithic data combined with a disaggregation pattern.
7. WHEN operating in Transition_Planning_Mode and shared services are present, THE Engine SHALL compute and display the count of shared services crossing Successor_Authority boundaries.
8. THE Engine SHALL accept an optional `annualCost` numeric field on ITSystem nodes alongside the existing display `cost` string, using the numeric value for computation.

### Requirement 9: Financial Distress Flag

**User Story:** As a programme board member, I want predecessor councils under financial distress flagged, so that I can adjust confidence in the metadata from those councils and account for likely system degradation.

#### Acceptance Criteria

1. THE Engine SHALL accept an optional `financialDistress` boolean field on council-level metadata.
2. WHEN a council has `financialDistress: true`, THE Engine SHALL display a warning indicator on every system card from that council: "Predecessor in financial distress — verify system currency, support status, and licence compliance."
3. WHEN a council has `financialDistress: true`, THE Engine SHALL display a warning indicator on the council column header.

### Requirement 10: Council Tier Metadata

**User Story:** As a CTO, I want each predecessor council's tier (county, district, unitary) recorded and visible, so that the tool can distinguish county-level and district-level functions sharing the same ESD identifier and flag where a successor is inheriting functions from a tier it has not previously operated.

#### Acceptance Criteria

1. THE Engine SHALL accept an optional `tier` field on council-level metadata with values "county", "district", or "unitary".
2. WHEN a council has a `tier` value, THE Engine SHALL display the tier visually on system cards and column headers.
3. WHEN two systems in the same function row originate from councils of different tiers (e.g. county and district), THE Engine SHALL annotate the collision to indicate that these may represent complementary tier-level delivery rather than a true duplication.

### Requirement 11: Export for Governance Packs

**User Story:** As a programme manager, I want to export the matrix and summary as a structured document, so that I can include the analysis in programme board papers and governance packs without relying on screen captures.

#### Acceptance Criteria

1. THE Engine SHALL provide an export function that produces a well-formed HTML print view of the current matrix, summary panel, and signal analysis.
2. THE Engine SHALL include the active persona, signal weight configuration, and Transition_Structure metadata in the export output.
3. WHEN the user triggers export, THE Engine SHALL generate the output reflecting the current filter state (active persona, perspective, signal weights).
