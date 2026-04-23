import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { classifyVestingZone } from '../../src/analysis/allocation.js';

/**
 * Property 2: Vesting-anchored zone classification
 *
 * Feature: lgr-transition-planning, Property 2: Vesting-anchored zone classification
 *
 * Validates: Requirements 2.1, 2.3, 2.5
 */

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/**
 * Generate random contract and vesting parameters that cover all zone
 * boundaries.
 *
 * - endYear:      2024–2035
 * - endMonth:     1–12
 * - noticePeriod: 0–24
 * - vestingDate:  ISO date string between 2026-01-01 and 2030-12-31
 */
/**
 * Generate a vesting date as an ISO string (YYYY-MM-DD) by composing
 * year and month integers. This avoids fc.date() shrinking issues where
 * invalid Date objects can be produced.
 */
const arbVestingDate = fc.record({
  year: fc.integer({ min: 2026, max: 2030 }),
  month: fc.integer({ min: 1, max: 12 }),
  day: fc.integer({ min: 1, max: 28 }), // cap at 28 to avoid invalid dates
}).map(({ year, month, day }) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
);

const arbVestingScenario = fc.record({
  endYear: fc.integer({ min: 2024, max: 2035 }),
  endMonth: fc.integer({ min: 1, max: 12 }),
  noticePeriod: fc.integer({ min: 0, max: 24 }),
  vestingDate: arbVestingDate,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute the notice trigger month the same way the engine does. */
function computeNoticeTriggerMonth(endYear, endMonth, noticePeriod) {
  return endYear * 12 + (endMonth || 12) - noticePeriod;
}

/** Compute the vesting month from an ISO date string (1-indexed). */
function computeVestingMonth(vestingDate) {
  const d = new Date(vestingDate);
  return d.getFullYear() * 12 + (d.getMonth() + 1);
}

const VALID_ZONES = ['pre-vesting', 'year-1', 'natural-expiry', 'long-tail'];

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Property 2: Vesting-anchored zone classification', {
  tags: [
    'Feature: lgr-transition-planning',
    'Property 2: Vesting-anchored zone classification',
  ],
}, () => {

  it('every system with contract data and a vesting date classifies into exactly one zone', () => {
    fc.assert(
      fc.property(arbVestingScenario, ({ endYear, endMonth, noticePeriod, vestingDate }) => {
        const zone = classifyVestingZone(endYear, endMonth, noticePeriod, vestingDate);

        // Must return exactly one of the four valid zones
        expect(VALID_ZONES).toContain(zone);
      }),
      { numRuns: 200 }
    );
  });

  it('zone boundaries are correct relative to vesting month', () => {
    fc.assert(
      fc.property(arbVestingScenario, ({ endYear, endMonth, noticePeriod, vestingDate }) => {
        const zone = classifyVestingZone(endYear, endMonth, noticePeriod, vestingDate);
        const noticeTriggerMonth = computeNoticeTriggerMonth(endYear, endMonth, noticePeriod);
        const vestingMonth = computeVestingMonth(vestingDate);
        const diff = noticeTriggerMonth - vestingMonth;

        switch (zone) {
          case 'pre-vesting':
            // noticeTriggerMonth < vestingMonth  →  diff < 0
            expect(diff).toBeLessThan(0);
            break;

          case 'year-1':
            // noticeTriggerMonth >= vestingMonth AND < vestingMonth + 12
            // → 0 <= diff < 12
            expect(diff).toBeGreaterThanOrEqual(0);
            expect(diff).toBeLessThan(12);
            break;

          case 'natural-expiry':
            // noticeTriggerMonth >= vestingMonth + 12 AND < vestingMonth + 36
            // → 12 <= diff < 36
            expect(diff).toBeGreaterThanOrEqual(12);
            expect(diff).toBeLessThan(36);
            break;

          case 'long-tail':
            // noticeTriggerMonth >= vestingMonth + 36  →  diff >= 36
            expect(diff).toBeGreaterThanOrEqual(36);
            break;

          default:
            // Should never reach here — caught by the first property test
            expect.unreachable(`Unexpected zone: ${zone}`);
        }
      }),
      { numRuns: 200 }
    );
  });
});
