# Implementation Plan: LGR Transition Planning

## Overview

Transform the LGR Transition Workspace Engine from an estate discovery register into an analytical transition planning tool. All changes are implemented within the single-file constraint (`lgr-rationalisation-engine.html`) using vanilla JavaScript. The implementation follows the five-phase sequence from PLAN.md, with each phase building on the previous. Pure logic functions are extracted as testable units, and a test harness using fast-check is set up alongside the main file.

## Tasks

- [x] 1. Set up test infrastructure and extract pure function scaffolding
  - [x] 1.1 Initialise test project with fast-check and a test runner
    - Create `package.json` with `vitest` and `fast-check` as dev dependencies
    - Create `vitest.config.js` configured to find tests in `tests/` directory
    - Create `tests/helpers/extract.js` — a utility that reads `lgr-rationalisation-engine.html`, extracts the `<script>` content, and exposes module-level functions for testing (using `vm` module or `Function` constructor)
    - Verify the test runner executes a trivial test successfully
    - _Requirements: N/A (infrastructure)_

  - [x] 1.2 Add new state variables and constants to the engine
    - Add `transitionStructure`, `operatingMode`, `successorAllocationMap`, `tierMap`, `councilTierMap`, `distressedCouncils` state variables to the `<script>` block
    - Add the `DEFAULT_TIER_MAP` constant mapping all 176 ESD function IDs to playbook tiers (Tier 1: 148, 152, 3, 124, 146, 119, 116, 19, 130, 131, 65, 68, 142, 34; Tier 2: 109, 171, 99, 100, 101, 103, 66, 67, 69, 111, 54, 16, 15; Tier 3: 76, 72, 75, 73, 81, 78, 80, 36, 74, 79; unmapped defaults to Tier 2)
    - Add the two new signal definitions (`tcopAlignment`, `sharedService`) to `SIGNAL_DEFS`
    - Extend `PERSONA_DEFAULT_WEIGHTS` with the new signal weights per persona
    - _Requirements: 3.1, 3.5, 5.8, 6.5_

- [x] 2. Implement transition structure configuration and successor allocation (Phase 1)
  - [x] 2.1 Implement the Transition Configuration UI (Stage 1.5)
    - Render a configuration panel between Stage 1 (Ingest) and Stage 2 (Baselining) after files are uploaded
    - Include a date input for `vestingDate`, an "Add Successor" button, and per-successor fields: name text input, full predecessor checkboxes, partial predecessor checkboxes (populated from `mergedArchitecture.councils`)
    - Include a "Skip — use Estate Discovery mode" link that sets `transitionStructure = null` and proceeds
    - Include a "Reconfigure Transition" button in the Stage 3 header that re-opens this panel without re-uploading
    - Validate that every uploaded council is assigned to at least one successor (warn, don't block)
    - Store the result in `transitionStructure` and derive `operatingMode` from it
    - _Requirements: 1.1, 1.2, 1.3, 1.8, 1.9_

  - [x] 2.2 Implement `buildSuccessorAllocation()` pure function
    - Accept `mergedArchitecture.nodes`, `mergedArchitecture.edges`, and `transitionStructure` as inputs
    - For each ITSystem node: if `targetAuthorities` is set, assign to those successors with `allocationType: "targeted"`; if source council is a full predecessor, assign with `allocationType: "full"`; if partial predecessor, assign to all successors listing that council as partial with `needsAllocationReview: true`
    - Set `isDisaggregation: true` when a system appears in 2+ successor columns
    - Return `Map<successorName, Map<lgaFunctionId, SystemAllocation[]>>`
    - Handle edge cases: unallocated systems (warn in UI), `targetAuthorities` referencing unknown successors (display warning)
    - _Requirements: 1.4, 1.5, 1.6, 1.7, 7.1_

  - [x] 2.3 Write property test for successor allocation correctness
    - **Property 1: Successor allocation correctness**
    - Create `tests/generators/arbITSystem.js`, `tests/generators/arbCouncil.js`, `tests/generators/arbTransitionStructure.js`
    - Create `tests/properties/successor-allocation.property.test.js`
    - Test: full predecessor systems appear in exactly one successor with `allocationType: "full"` and `needsAllocationReview: false`
    - Test: partial predecessor systems without `targetAuthorities` appear in every successor listing that council as partial, with `needsAllocationReview: true` and `isDisaggregation: true` when in 2+ successors
    - Test: `targetAuthorities` overrides predecessor allocation; `isDisaggregation: true` when listing 2+ successors
    - **Validates: Requirements 1.4, 1.5, 1.6, 1.7, 7.1, 7.4**

  - [x] 2.4 Implement `classifyVestingZone()` pure function
    - Accept `endYear`, `endMonth`, `noticePeriod`, and `vestingDate` (ISO string)
    - Compute notice trigger month: `endYear * 12 + (endMonth || 12) - noticePeriod`
    - Compute vesting month from the ISO date string
    - Return exactly one zone: `pre-vesting`, `year-1`, `natural-expiry`, or `long-tail`
    - _Requirements: 2.1, 2.5_

  - [x] 2.5 Write property test for vesting zone classification
    - **Property 2: Vesting-anchored zone classification**
    - Create `tests/properties/vesting-zones.property.test.js`
    - Test: every system with contract data and a vesting date classifies into exactly one zone
    - Test: zone boundaries are correct (pre-vesting < vesting month; year-1 within 12 months after; natural-expiry 12–36 months after; long-tail 36+ months after)
    - **Validates: Requirements 2.1, 2.3, 2.5**

  - [x] 2.6 Integrate vesting-anchored contract analysis into `computeSignals()`
    - Branch contract urgency computation: if `transitionStructure?.vestingDate` is set, use `classifyVestingZone()`; otherwise fall back to today-relative calculation
    - Update signal value text to include zone label and vesting relationship
    - Update `drawTimeline()`: when vesting date is set, centre on vesting date (vesting - 2 years to vesting + 4 years), draw vertical red dashed line at vesting day; when no vesting date, preserve fixed 2024–2030 range
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement playbook tiering and rationalisation pattern classification (Phase 2)
  - [x] 4.1 Implement `computeEffectiveTier()` pure function
    - Accept a function node (with optional `tier` override field), the `DEFAULT_TIER_MAP`, a vesting date (optional), and the set of systems serving that function
    - If function node has a `tier` field, use that override; otherwise look up `DEFAULT_TIER_MAP` (default to Tier 2 if unmapped)
    - If effective tier is 3 AND vesting date is set AND any system has a notice trigger before vesting, promote to Tier 2 for sorting (preserve original tier for display)
    - Return `{ tier, promoted, originalTier }`
    - _Requirements: 3.1, 3.3, 3.6_

  - [x] 4.2 Write property test for effective tier computation
    - **Property 4: Effective tier computation**
    - Create `tests/properties/effective-tier.property.test.js`
    - Test: function-level `tier` override always takes precedence over DEFAULT_TIER_MAP
    - Test: unmapped functions default to Tier 2
    - Test: Tier 3 promotion to Tier 2 fires only when vesting date is set AND a system has pre-vesting notice trigger
    - **Validates: Requirements 3.3, 3.6**

  - [x] 4.3 Implement `sortFunctionRows()` pure function
    - Accept an array of function row objects with `{ tier, collisionCount, label }`
    - Sort by: tier ascending (Tier 1 first), then collision count descending, then label alphabetically
    - _Requirements: 3.2_

  - [x] 4.4 Write property test for tier-based matrix sorting
    - **Property 3: Tier-based matrix sorting**
    - Create `tests/properties/tier-sorting.property.test.js`
    - Test: for every adjacent pair (row_i, row_j), either tier_i < tier_j, or same tier with collisionCount_i >= collisionCount_j, or same tier and count with label_i <= label_j
    - **Validates: Requirements 3.2**

  - [x] 4.5 Integrate tier system into `renderDashboard()`
    - Compute effective tier for each function row during rendering
    - Sort rows using `sortFunctionRows()` logic
    - Display tier badge (Tier 1 / Tier 2 / Tier 3) in each function row header with colour coding
    - Show "Tier 3 → promoted to Tier 2" annotation when promotion applies
    - Add "View Tier Mapping" button in dashboard header that opens a reference modal showing the full DEFAULT_TIER_MAP
    - _Requirements: 3.1, 3.2, 3.4, 3.5_

  - [x] 4.6 Implement `classifyRationalisationPattern()` pure function
    - Accept a `SystemAllocation[]` array for a function × successor cell
    - Return one of: `inherit-as-is`, `choose-and-consolidate`, `extract-and-partition`, `extract-partition-and-consolidate`
    - Logic: 1 system + no disaggregation → inherit-as-is; 2+ systems + none partial/disaggregation → choose-and-consolidate; 1+ disaggregation + no competing non-partial systems → extract-and-partition; 1+ disaggregation + 1+ competing non-partial systems → extract-partition-and-consolidate
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 4.7 Write property test for rationalisation pattern classification
    - **Property 5: Rationalisation pattern classification**
    - Create `tests/properties/rationalisation-pattern.property.test.js`
    - Test: exactly one pattern is returned for any valid allocation set
    - Test: each pattern condition maps correctly to the expected classification
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

  - [x] 4.8 Integrate rationalisation patterns into Transition Planning matrix
    - In Transition Planning mode, render the pattern tag (colour-coded: green for inherit-as-is, blue for choose-and-consolidate, red for extract-and-partition, purple for extract-partition-and-consolidate) at the top of each function × successor cell
    - _Requirements: 4.6_

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement TCoP signal and shared service detection (Phase 3)
  - [x] 6.1 Implement `computeTcopAssessment()` pure function
    - Accept an ITSystem node
    - Return an object with `alignments` and `concerns` arrays, each containing `{ point, description }`
    - Logic: `isCloud === true` → alignment Point 5; `isCloud === false` → concern Point 5; `portability === "High"` → alignment Point 4; `portability === "Low"` → concern Points 3, 4, 11; `isERP === true && dataPartitioning === "Monolithic"` → concern Point 9
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 6.2 Write property test for TCoP assessment correctness
    - **Property 7: TCoP assessment correctness**
    - Create `tests/properties/tcop-assessment.property.test.js`
    - Test: each field combination produces exactly the expected alignments and concerns
    - Test: no spurious alignments or concerns for unrelated field combinations
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**

  - [x] 6.3 Integrate TCoP signal into `computeSignals()` and rendering
    - Add TCoP alignment computation to the signal pipeline
    - Render TCoP signal output with the standard framing: "These are factors to consider alongside operational, commercial, and service-specific requirements."
    - Respect per-persona weight defaults (executive: 1, commercial: 0, architect: 3)
    - _Requirements: 5.7, 5.8_

  - [x] 6.4 Implement `detectSharedServiceBoundary()` pure function
    - Accept a system node (with `sharedWith` array and `_sourceCouncil`), and the `successorAllocationMap`
    - Resolve each council in `[_sourceCouncil, ...sharedWith]` to its successor
    - If all map to the same successor → return `{ unwinding: false }`
    - If 2+ different successors → return `{ unwinding: true, successors: [...] }`
    - _Requirements: 6.3, 6.4_

  - [x] 6.5 Write property test for shared service boundary detection
    - **Property 8: Shared service boundary detection**
    - Create `tests/properties/shared-service-boundary.property.test.js`
    - Test: all councils in same successor → no unwinding flag
    - Test: councils in different successors → unwinding required
    - **Validates: Requirements 6.3, 6.4**

  - [x] 6.6 Integrate shared service signal into `computeSignals()` and rendering
    - Add shared service computation to the signal pipeline
    - In Estate Discovery mode: note which councils share the system
    - In Transition Planning mode: show unwinding requirement or continuation status
    - Read `sharedWith` array from system nodes during baselining
    - Respect per-persona weight defaults (executive: 2, commercial: 3, architect: 1)
    - _Requirements: 6.1, 6.2, 6.5_

  - [x] 6.7 Implement `computeSignalEmphasis()` pure function
    - Accept a `RationalisationPattern` and the current `signalWeights` object
    - Return adjusted weights: extract patterns → +1 to dataMonolith, dataPortability (capped at 3); choose-and-consolidate → +1 to userVolume, vendorDensity, tcopAlignment (capped at 3); inherit-as-is → no changes
    - _Requirements: 4.7, 4.8_

  - [x] 6.8 Write property test for signal emphasis rules
    - **Property 6: Signal emphasis matches rationalisation pattern**
    - Create `tests/properties/signal-emphasis.property.test.js`
    - Test: emphasis adjustments match the pattern-to-signal mapping exactly
    - Test: weights never exceed 3 after emphasis
    - Test: inherit-as-is produces no weight changes
    - **Validates: Requirements 4.7, 4.8**

  - [x] 6.9 Integrate signal emphasis into Transition Planning mode rendering
    - Apply `computeSignalEmphasis()` per cell when rendering the analysis column in Transition Planning mode
    - Emphasis is display-time only — does not modify user-configured weights
    - _Requirements: 4.7, 4.8_

- [x] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement disaggregation flags and estate summary panel (Phase 4)
  - [x] 8.1 Implement disaggregation flag rendering
    - In `buildSystemCard()`: when a system has `needsAllocationReview: true`, display the flag: "Partial predecessor — this system may serve multiple successors. Allocation review required."
    - Cross-reference `dataPartitioning`: if `"Monolithic"` → highlight as highest-risk combination; if `"Segmented"` → note geographic partitioning may be feasible
    - Display the flag in every successor column where the partial predecessor's system appears
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 8.2 Implement `computeEstateSummaryMetrics()` pure function
    - Accept `mergedArchitecture`, `lgaFunctionMap`, `transitionStructure`, and `successorAllocationMap`
    - Compute: total predecessor count, total system count, collision count, total annual spend (if any `annualCost` present), pre-vesting notice trigger count (if vesting date set), disaggregation count (if transition mode), monolithic-disaggregation count, cross-boundary shared service count
    - Return a metrics object with all computed values
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x] 8.3 Write property test for estate summary metrics
    - **Property 9: Estate summary metrics correctness**
    - Create `tests/generators/arbEstate.js`
    - Create `tests/properties/estate-summary.property.test.js`
    - Test: predecessor count equals `mergedArchitecture.councils.size`
    - Test: system count equals count of ITSystem nodes
    - Test: collision count equals lgaFunctionMap entries with councils.size > 1
    - Test: annual spend equals sum of all `annualCost` values
    - Test: pre-vesting count matches systems with notice trigger before vesting month
    - Test: disaggregation count matches systems with `isDisaggregation: true`
    - Test: monolithic-disaggregation count matches systems with both flags
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.5, 8.6, 8.7**

  - [x] 8.4 Implement `renderEstateSummary()` and integrate into Stage 3
    - Render the Estate Overview section (always shown): predecessor count, total systems, collision count, total annual spend (if available)
    - Render the Transition Risk section (Transition Planning mode only): successor count, vesting date, pre-vesting notice triggers, disaggregation count, monolithic + disaggregation count, cross-boundary shared services
    - Position the panel above the matrix in Stage 3
    - Accept `annualCost` numeric field on ITSystem nodes during baselining
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

- [x] 9. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement tier metadata, financial distress, and export (Phase 5)
  - [x] 10.1 Implement council tier metadata display
    - Read `councilMetadata.tier` during `runBaselining()` and store in `councilTierMap`
    - Display tier badge ("COUNTY", "DISTRICT", "UNITARY") on system cards in `buildSystemCard()`
    - Display tier label in matrix column headers
    - _Requirements: 10.1, 10.2_

  - [x] 10.2 Implement `detectCrossTierCollision()` pure function
    - Accept a function row's systems and the `councilTierMap`
    - If systems originate from councils with different tier values → return `{ crossTier: true, tiers: [...] }`
    - If all same tier or no tier data → return `{ crossTier: false }`
    - _Requirements: 10.3_

  - [x] 10.3 Write property test for cross-tier collision annotation
    - **Property 11: Cross-tier collision annotation**
    - Create `tests/properties/cross-tier-annotation.property.test.js`
    - Test: different tier values → cross-tier annotation present
    - Test: same tier values or no tier data → no annotation
    - **Validates: Requirements 10.3**

  - [x] 10.4 Integrate cross-tier annotation into matrix rendering
    - In collision rows where systems originate from different council tiers, display: "⚠ Cross-tier: county and district functions may represent complementary delivery, not duplication"
    - _Requirements: 10.3_

  - [x] 10.5 Implement `propagateFinancialDistress()` pure function
    - Accept a list of council metadata objects
    - Return a `Set<councilName>` of councils with `financialDistress: true`
    - _Requirements: 9.1, 9.2_

  - [x] 10.6 Write property test for financial distress propagation
    - **Property 10: Financial distress propagation**
    - Create `tests/properties/financial-distress.property.test.js`
    - Test: every system from a distressed council has the warning; no system from a non-distressed council has the warning
    - **Validates: Requirements 9.2**

  - [x] 10.7 Integrate financial distress into baselining and rendering
    - Read `councilMetadata.financialDistress` during `runBaselining()` and populate `distressedCouncils` Set
    - In `buildSystemCard()`: if `sys._sourceCouncil` is in `distressedCouncils`, render warning banner: "⚠ Predecessor in financial distress — verify system currency, support status, and licence compliance."
    - In matrix column header: append warning icon and tooltip for distressed councils
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 10.8 Implement Transition Planning matrix rendering (successor columns)
    - In `renderDashboard()`, when `operatingMode === 'transition'`: render one column per successor authority, plus the Analysis column
    - Switch the Perspective dropdown to successor names instead of predecessor names
    - Each cell shows systems allocated to that successor for that function, with the rationalisation pattern tag at the top and provenance (source predecessor) on each system card
    - Analysis column computes signals per-successor-cell with emphasis rules applied
    - In Estate Discovery mode, preserve existing rendering with tier-based sorting added
    - _Requirements: 1.3, 1.4, 4.6, 4.7, 4.8_

  - [x] 10.9 Write property test for transition structure round-trip
    - **Property 12: Transition structure round-trip**
    - Create `tests/properties/transition-structure-roundtrip.property.test.js`
    - Test: storing a valid transition structure and reading it back preserves all fields
    - Test: partial structures (successors with empty predecessor arrays) are accepted without error
    - **Validates: Requirements 1.1, 1.8**

  - [x] 10.10 Implement `exportToHTML()` function
    - Generate a standalone HTML document containing: estate summary panel, current matrix (respecting active persona, perspective, signal weights), contract timeline (if visible), metadata header (persona, weights, transition structure, timestamp)
    - Use `window.open()` to create a new window with the generated HTML
    - Include inline styles (no CDN dependency) for offline use
    - Add an "Export" button to the Stage 3 header
    - _Requirements: 11.1, 11.2, 11.3_

- [x] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each implementation phase
- Property tests validate universal correctness properties from the design document using fast-check
- All implementation is within the single file `lgr-rationalisation-engine.html` — no build system, no framework
- Pure functions are extracted as testable units that can be imported by the test harness
- The implementation sequence follows PLAN.md: transition structure → tiering + patterns → signals → disaggregation + summary → metadata + export
