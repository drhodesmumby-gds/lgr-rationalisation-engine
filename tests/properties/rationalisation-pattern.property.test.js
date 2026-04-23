import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { classifyRationalisationPattern } from '../../src/analysis/metrics.js';

/**
 * Property 5: Rationalisation pattern classification
 *
 * Feature: lgr-transition-planning, Property 5: Rationalisation pattern classification
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_PATTERNS = [
  'inherit-as-is',
  'choose-and-consolidate',
  'extract-and-partition',
  'extract-partition-and-consolidate',
];

const ALLOCATION_TYPES = ['full', 'partial', 'targeted'];

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/**
 * Generate a single SystemAllocation object with random but valid fields.
 */
const arbSystemAllocation = fc.record({
  systemId: fc.stringMatching(/^sys-[a-z0-9]{3,6}$/),
  sourceCouncil: fc.constantFrom('Council-A', 'Council-B', 'Council-C', 'Council-D'),
  allocationType: fc.constantFrom(...ALLOCATION_TYPES),
  needsAllocationReview: fc.boolean(),
  isDisaggregation: fc.boolean(),
}).map(({ systemId, sourceCouncil, allocationType, needsAllocationReview, isDisaggregation }) => ({
  system: { id: systemId, label: `System ${systemId}`, type: 'ITSystem' },
  sourceCouncil,
  allocationType,
  needsAllocationReview,
  isDisaggregation,
}));

/**
 * Generate an array of 1–5 SystemAllocation objects representing a
 * function × successor cell.
 */
const arbAllocations = fc.array(arbSystemAllocation, { minLength: 1, maxLength: 5 });

// ---------------------------------------------------------------------------
// Constrained generators for specific pattern conditions
// ---------------------------------------------------------------------------

/**
 * inherit-as-is: exactly 1 system, isDisaggregation === false
 */
const arbInheritAsIs = arbSystemAllocation.map(a => [{
  ...a,
  isDisaggregation: false,
}]);

/**
 * choose-and-consolidate: 2+ systems, none with isDisaggregation === true
 */
const arbChooseAndConsolidate = fc.array(arbSystemAllocation, { minLength: 2, maxLength: 5 })
  .map(allocs => allocs.map(a => ({
    ...a,
    isDisaggregation: false,
  })));

/**
 * extract-and-partition: 1+ systems with isDisaggregation === true,
 * no competing non-partial systems (no system with allocationType !== "partial" AND isDisaggregation === false)
 *
 * A "competing non-partial" system is one where allocationType !== "partial" AND isDisaggregation === false.
 * So to avoid that, any extra system must either be partial OR have isDisaggregation === true.
 */
const arbNonCompetingExtra = fc.oneof(
  // Option A: partial allocation (disaggregation can be anything)
  arbSystemAllocation.map(a => ({ ...a, allocationType: 'partial' })),
  // Option B: non-partial but with disaggregation (so it's not "competing")
  arbSystemAllocation.map(a => ({ ...a, isDisaggregation: true })),
);

const arbExtractAndPartition = fc.tuple(
  // At least one disaggregation system
  fc.array(arbSystemAllocation, { minLength: 1, maxLength: 3 }).map(allocs =>
    allocs.map(a => ({ ...a, isDisaggregation: true }))
  ),
  // Optional additional systems that are NOT competing non-partial
  fc.array(arbNonCompetingExtra, { minLength: 0, maxLength: 2 }),
).map(([disaggregated, extras]) => [...disaggregated, ...extras]);

/**
 * extract-partition-and-consolidate: 1+ systems with isDisaggregation === true,
 * AND 1+ competing non-partial systems (allocationType !== "partial" AND isDisaggregation === false)
 */
const arbCompetingNonPartial = arbSystemAllocation.map(a => ({
  ...a,
  allocationType: a.allocationType === 'partial' ? 'full' : a.allocationType,
  isDisaggregation: false,
}));

const arbExtractPartitionAndConsolidate = fc.tuple(
  // At least one disaggregation system
  fc.array(arbSystemAllocation, { minLength: 1, maxLength: 2 }).map(allocs =>
    allocs.map(a => ({ ...a, isDisaggregation: true }))
  ),
  // At least one competing non-partial system
  fc.array(arbCompetingNonPartial, { minLength: 1, maxLength: 2 }),
).map(([disaggregated, competing]) => [...disaggregated, ...competing]);

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Property 5: Rationalisation pattern classification', {
  tags: [
    'Feature: lgr-transition-planning',
    'Property 5: Rationalisation pattern classification',
  ],
}, () => {

  it('exactly one valid pattern is returned for any valid allocation set', () => {
    fc.assert(
      fc.property(arbAllocations, (allocations) => {
        const pattern = classifyRationalisationPattern(allocations);

        // Must return exactly one of the four valid patterns
        expect(VALID_PATTERNS).toContain(pattern);
      }),
      { numRuns: 200 }
    );
  });

  it('1 system + no disaggregation → inherit-as-is', () => {
    fc.assert(
      fc.property(arbInheritAsIs, (allocations) => {
        const pattern = classifyRationalisationPattern(allocations);
        expect(pattern).toBe('inherit-as-is');
      }),
      { numRuns: 100 }
    );
  });

  it('2+ systems + none with disaggregation → choose-and-consolidate', () => {
    fc.assert(
      fc.property(arbChooseAndConsolidate, (allocations) => {
        const pattern = classifyRationalisationPattern(allocations);
        expect(pattern).toBe('choose-and-consolidate');
      }),
      { numRuns: 100 }
    );
  });

  it('1+ disaggregation + no competing non-partial systems → extract-and-partition', () => {
    fc.assert(
      fc.property(arbExtractAndPartition, (allocations) => {
        const pattern = classifyRationalisationPattern(allocations);
        expect(pattern).toBe('extract-and-partition');
      }),
      { numRuns: 100 }
    );
  });

  it('1+ disaggregation + 1+ competing non-partial systems → extract-partition-and-consolidate', () => {
    fc.assert(
      fc.property(arbExtractPartitionAndConsolidate, (allocations) => {
        const pattern = classifyRationalisationPattern(allocations);
        expect(pattern).toBe('extract-partition-and-consolidate');
      }),
      { numRuns: 100 }
    );
  });
});
