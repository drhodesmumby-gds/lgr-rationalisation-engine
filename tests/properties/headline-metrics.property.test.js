import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getHeadlineMetrics } from '../../src/analysis/metrics.js';

/**
 * Property tests for getHeadlineMetrics(signals, pattern)
 *
 * getHeadlineMetrics selects the most contextually-relevant signal for
 * inline display in the compact analysis cell. It applies pattern-aware
 * priority rules before falling back to the first strong signal.
 *
 * Logic summary:
 *   1. If signals is empty or null, return null.
 *   2. Compute a fallback candidate: first strong signal, or signals[0].
 *   3. If pattern is extract-and-partition or extract-partition-and-consolidate,
 *      return the first dataMonolith or dataPortability signal if one exists.
 *   4. If pattern is choose-and-consolidate, return the first userVolume or
 *      vendorDensity signal if one exists.
 *   5. Otherwise return the candidate.
 *
 * Properties tested:
 *   1. Null/empty guard — returns null for falsy or empty signals input.
 *   2. Result is always a member of the input array (referential identity).
 *   3. Extract patterns prefer data signals when one is present.
 *   4. Consolidate pattern prefers volume/vendor signals when one is present.
 *   5. When no pattern-specific signal is present, strong signals are
 *      preferred over non-strong signals.
 *   6. When signals is non-empty, result is always non-null.
 */


// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const SIGNAL_IDS = [
  'contractUrgency',
  'userVolume',
  'dataMonolith',
  'dataPortability',
  'vendorDensity',
  'techDebt',
  'tcopAlignment',
  'sharedService',
];

const DATA_SIGNAL_IDS = ['dataMonolith', 'dataPortability'];
const VOL_VENDOR_IDS = ['userVolume', 'vendorDensity'];
const EXTRACT_PATTERNS = ['extract-and-partition', 'extract-partition-and-consolidate'];

/**
 * Generate a single signal object with all fields the function reads.
 * 'strong' is a boolean that affects fallback candidate selection.
 */
const arbSignal = fc.record({
  id: fc.constantFrom(...SIGNAL_IDS),
  weight: fc.integer({ min: 1, max: 3 }),
  label: fc.string({ minLength: 1, maxLength: 30 }),
  value: fc.string({ minLength: 1, maxLength: 100 }),
  tag: fc.constantFrom('tag-red', 'tag-orange', 'tag-blue', 'tag-purple', 'tag-black', 'tag-green'),
  border: fc.string(),
  strong: fc.boolean(),
});

/**
 * Generate an array of 1-8 signals (non-empty, to exercise non-null path).
 */
const arbSignals = fc.array(arbSignal, { minLength: 1, maxLength: 8 });

/**
 * Generate any valid pattern value including null.
 */
const arbPattern = fc.constantFrom(
  null,
  'inherit-as-is',
  'choose-and-consolidate',
  'extract-and-partition',
  'extract-partition-and-consolidate'
);

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('getHeadlineMetrics', () => {

  // Property 1: null/empty guard
  it('returns null for null signals', () => {
    fc.assert(
      fc.property(arbPattern, (pattern) => {
        expect(getHeadlineMetrics(null, pattern)).toBeNull();
      }),
      { numRuns: 200 }
    );
  });

  it('returns null for empty signals array', () => {
    fc.assert(
      fc.property(arbPattern, (pattern) => {
        expect(getHeadlineMetrics([], pattern)).toBeNull();
      }),
      { numRuns: 200 }
    );
  });

  // Property 2: result is always a member of the input array
  it('always returns one of the input signals by reference', () => {
    fc.assert(
      fc.property(arbSignals, arbPattern, (signals, pattern) => {
        const result = getHeadlineMetrics(signals, pattern);
        expect(signals).toContain(result);
      }),
      { numRuns: 200 }
    );
  });

  // Property 3: extract patterns prefer data signals
  it('extract patterns return a data signal when one exists', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...EXTRACT_PATTERNS),
        arbSignals,
        (pattern, signals) => {
          const hasDataSignal = signals.some(s => DATA_SIGNAL_IDS.includes(s.id));
          if (!hasDataSignal) return; // skip inputs that don't have a data signal

          const result = getHeadlineMetrics(signals, pattern);
          expect(DATA_SIGNAL_IDS).toContain(result.id);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('extract patterns return the FIRST data signal in the array', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...EXTRACT_PATTERNS),
        arbSignals,
        (pattern, signals) => {
          const firstDataSignal = signals.find(s => DATA_SIGNAL_IDS.includes(s.id));
          if (!firstDataSignal) return; // skip inputs without a data signal

          const result = getHeadlineMetrics(signals, pattern);
          expect(result).toBe(firstDataSignal);
        }
      ),
      { numRuns: 200 }
    );
  });

  // Property 4: choose-and-consolidate prefers volume/vendor signals
  it('choose-and-consolidate returns a volume/vendor signal when one exists', () => {
    fc.assert(
      fc.property(arbSignals, (signals) => {
        const hasVolVendorSignal = signals.some(s => VOL_VENDOR_IDS.includes(s.id));
        if (!hasVolVendorSignal) return; // skip inputs without a vol/vendor signal

        const result = getHeadlineMetrics(signals, 'choose-and-consolidate');
        expect(VOL_VENDOR_IDS).toContain(result.id);
      }),
      { numRuns: 200 }
    );
  });

  it('choose-and-consolidate returns the FIRST volume/vendor signal in the array', () => {
    fc.assert(
      fc.property(arbSignals, (signals) => {
        const firstVolVendorSignal = signals.find(s => VOL_VENDOR_IDS.includes(s.id));
        if (!firstVolVendorSignal) return; // skip inputs without a vol/vendor signal

        const result = getHeadlineMetrics(signals, 'choose-and-consolidate');
        expect(result).toBe(firstVolVendorSignal);
      }),
      { numRuns: 200 }
    );
  });

  // Property 5: strong signals preferred when no pattern-specific override applies
  it('when no pattern-specific signal exists, returns first strong signal if one exists', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, 'inherit-as-is'),
        arbSignals,
        (pattern, signals) => {
          const firstStrong = signals.find(s => s.strong);
          if (!firstStrong) return; // skip inputs with no strong signal

          const result = getHeadlineMetrics(signals, pattern);
          expect(result).toBe(firstStrong);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('when no pattern-specific signal and no strong signal exists, returns signals[0]', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, 'inherit-as-is'),
        // Produce a signals array where none are strong
        fc.array(
          arbSignal.map(s => ({ ...s, strong: false })),
          { minLength: 1, maxLength: 8 }
        ),
        (pattern, signals) => {
          const result = getHeadlineMetrics(signals, pattern);
          expect(result).toBe(signals[0]);
        }
      ),
      { numRuns: 200 }
    );
  });

  // Property 6: non-empty input always produces a non-null result
  it('never returns null for a non-empty signals array', () => {
    fc.assert(
      fc.property(arbSignals, arbPattern, (signals, pattern) => {
        const result = getHeadlineMetrics(signals, pattern);
        expect(result).not.toBeNull();
      }),
      { numRuns: 200 }
    );
  });

  // Edge case: extract pattern with no data signals falls back to candidate
  it('extract pattern with no data signals falls back to strong or first signal', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...EXTRACT_PATTERNS),
        // Signals guaranteed to have none with dataMonolith or dataPortability id
        fc.array(
          arbSignal.filter(s => !DATA_SIGNAL_IDS.includes(s.id)).map(s => ({
            ...s,
            id: fc.sample(
              fc.constantFrom('contractUrgency', 'userVolume', 'vendorDensity', 'techDebt', 'tcopAlignment', 'sharedService'),
              1
            )[0],
          })),
          { minLength: 1, maxLength: 8 }
        ),
        (pattern, signals) => {
          const hasDataSignal = signals.some(s => DATA_SIGNAL_IDS.includes(s.id));
          if (hasDataSignal) return; // skip if by chance a data signal crept in

          const firstStrong = signals.find(s => s.strong);
          const expected = firstStrong ?? signals[0];

          const result = getHeadlineMetrics(signals, pattern);
          expect(result).toBe(expected);
        }
      ),
      { numRuns: 200 }
    );
  });

  // Edge case: choose-and-consolidate with no vol/vendor signals falls back to candidate
  it('choose-and-consolidate with no volume/vendor signals falls back to strong or first signal', () => {
    fc.assert(
      fc.property(
        // Signals guaranteed to have none with userVolume or vendorDensity id
        fc.array(
          arbSignal.map(s => ({
            ...s,
            id: fc.sample(
              fc.constantFrom('contractUrgency', 'dataMonolith', 'dataPortability', 'techDebt', 'tcopAlignment', 'sharedService'),
              1
            )[0],
          })),
          { minLength: 1, maxLength: 8 }
        ),
        (signals) => {
          const hasVolVendorSignal = signals.some(s => VOL_VENDOR_IDS.includes(s.id));
          if (hasVolVendorSignal) return; // skip if by chance a vol/vendor signal crept in

          const firstStrong = signals.find(s => s.strong);
          const expected = firstStrong ?? signals[0];

          const result = getHeadlineMetrics(signals, 'choose-and-consolidate');
          expect(result).toBe(expected);
        }
      ),
      { numRuns: 200 }
    );
  });
});
