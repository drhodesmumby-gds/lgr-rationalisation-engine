import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { sortFunctionRows } from '../../src/analysis/metrics.js';

/**
 * Property 3: Tier-based matrix sorting
 *
 * Feature: lgr-transition-planning, Property 3: Tier-based matrix sorting
 *
 * Validates: Requirements 3.2
 */

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Generate a short alphabetic label string (1–8 lowercase chars). */
const arbLabel = fc.array(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'),
  { minLength: 1, maxLength: 8 }
).map(chars => chars.join(''));

/**
 * Generate a single function row object with random tier (1–3),
 * collisionCount (0–10), and a short alphabetic label.
 */
const arbFunctionRow = fc.record({
  tier: fc.integer({ min: 1, max: 3 }),
  collisionCount: fc.integer({ min: 0, max: 10 }),
  label: arbLabel,
});

/**
 * Generate an array of 1–20 function row objects.
 */
const arbFunctionRows = fc.array(arbFunctionRow, { minLength: 1, maxLength: 20 });

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Property 3: Tier-based matrix sorting', {
  tags: [
    'Feature: lgr-transition-planning',
    'Property 3: Tier-based matrix sorting',
  ],
}, () => {

  it('for every adjacent pair, either tier_i < tier_j, or same tier with collisionCount_i >= collisionCount_j, or same tier and count with label_i <= label_j', () => {
    fc.assert(
      fc.property(arbFunctionRows, (rows) => {
        const sorted = sortFunctionRows(rows);

        // Check every adjacent pair satisfies the sort invariant
        for (let i = 0; i < sorted.length - 1; i++) {
          const a = sorted[i];
          const b = sorted[i + 1];

          if (a.tier < b.tier) {
            // Tier ascending — valid ordering
            continue;
          }

          // Same tier: collision count must be descending
          expect(a.tier).toBe(b.tier);

          if (a.collisionCount > b.collisionCount) {
            // Collision count descending within same tier — valid
            continue;
          }

          // Same tier and same collision count: label must be alphabetically <=
          expect(a.collisionCount).toBe(b.collisionCount);
          expect(a.label.localeCompare(b.label)).toBeLessThanOrEqual(0);
        }
      }),
      { numRuns: 200 }
    );
  });

});
