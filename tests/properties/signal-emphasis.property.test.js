import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { extractEngine } from '../helpers/extract.js';

/**
 * Property 6: Signal emphasis matches rationalisation pattern
 *
 * Feature: lgr-transition-planning, Property 6: Signal emphasis matches rationalisation pattern
 *
 * Validates: Requirements 4.7, 4.8
 */

const ctx = extractEngine();
const computeSignalEmphasis = ctx.computeSignalEmphasis;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_PATTERNS = [
  'inherit-as-is',
  'choose-and-consolidate',
  'extract-and-partition',
  'extract-partition-and-consolidate',
];

const SIGNAL_KEYS = [
  'contractUrgency',
  'userVolume',
  'dataMonolith',
  'dataPortability',
  'vendorDensity',
  'techDebt',
  'tcopAlignment',
  'sharedService',
];

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/**
 * Generate a random pattern from the four valid rationalisation patterns.
 */
const arbPattern = fc.constantFrom(...VALID_PATTERNS);

/**
 * Generate a signal weights object with values 0–3 for each signal key.
 */
const arbWeights = fc.record(
  Object.fromEntries(SIGNAL_KEYS.map(key => [key, fc.integer({ min: 0, max: 3 })]))
);

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Property 6: Signal emphasis matches rationalisation pattern', {
  tags: [
    'Feature: lgr-transition-planning',
    'Property 6: Signal emphasis matches rationalisation pattern',
  ],
}, () => {

  it('emphasis adjustments match the pattern-to-signal mapping exactly', () => {
    fc.assert(
      fc.property(arbPattern, arbWeights, (pattern, weights) => {
        const result = computeSignalEmphasis(pattern, weights);

        if (pattern === 'extract-and-partition' || pattern === 'extract-partition-and-consolidate') {
          // dataMonolith and dataPortability get +1 (capped at 3)
          expect(result.dataMonolith).toBe(Math.min(weights.dataMonolith + 1, 3));
          expect(result.dataPortability).toBe(Math.min(weights.dataPortability + 1, 3));
          // All other signals remain unchanged
          for (const key of SIGNAL_KEYS) {
            if (key !== 'dataMonolith' && key !== 'dataPortability') {
              expect(result[key]).toBe(weights[key]);
            }
          }
        } else if (pattern === 'choose-and-consolidate') {
          // userVolume, vendorDensity, tcopAlignment get +1 (capped at 3)
          expect(result.userVolume).toBe(Math.min(weights.userVolume + 1, 3));
          expect(result.vendorDensity).toBe(Math.min(weights.vendorDensity + 1, 3));
          expect(result.tcopAlignment).toBe(Math.min(weights.tcopAlignment + 1, 3));
          // All other signals remain unchanged
          for (const key of SIGNAL_KEYS) {
            if (key !== 'userVolume' && key !== 'vendorDensity' && key !== 'tcopAlignment') {
              expect(result[key]).toBe(weights[key]);
            }
          }
        } else {
          // inherit-as-is → no changes
          for (const key of SIGNAL_KEYS) {
            expect(result[key]).toBe(weights[key]);
          }
        }
      }),
      { numRuns: 200 }
    );
  });

  it('weights never exceed 3 after emphasis', () => {
    fc.assert(
      fc.property(arbPattern, arbWeights, (pattern, weights) => {
        const result = computeSignalEmphasis(pattern, weights);

        for (const key of SIGNAL_KEYS) {
          expect(result[key]).toBeLessThanOrEqual(3);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('inherit-as-is produces no weight changes', () => {
    fc.assert(
      fc.property(arbWeights, (weights) => {
        const result = computeSignalEmphasis('inherit-as-is', weights);

        for (const key of SIGNAL_KEYS) {
          expect(result[key]).toBe(weights[key]);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('does not mutate the input weights object', () => {
    fc.assert(
      fc.property(arbPattern, arbWeights, (pattern, weights) => {
        const original = { ...weights };
        computeSignalEmphasis(pattern, weights);

        for (const key of SIGNAL_KEYS) {
          expect(weights[key]).toBe(original[key]);
        }
      }),
      { numRuns: 100 }
    );
  });
});
