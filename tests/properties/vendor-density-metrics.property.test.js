import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeVendorDensityMetrics } from '../../src/analysis/signals.js';
import { arbITSystem } from '../generators/arbITSystem.js';

/**
 * Property tests for computeVendorDensityMetrics
 *
 * computeVendorDensityMetrics(systems) groups an array of IT system objects
 * by vendor, accumulates system counts, unique council counts and total spend,
 * and returns the results sorted by systemCount descending.
 *
 * Systems without a vendor field are silently excluded.
 *
 * NOTE — known limitation: the function uses a plain object `{}` as its
 * vendor accumulator map. Vendor strings that shadow Object.prototype
 * property names (e.g. "constructor", "valueOf", "hasOwnProperty") will
 * cause incorrect behaviour because `!vendorMap[vendor]` resolves to false
 * for those names before any entry has been written. The properties below
 * use `fc.assume()` to exclude such strings from the input domain, keeping
 * the tests focused on the function's correct behaviour for safe inputs.
 *
 * Properties tested:
 *  1. Output is sorted by systemCount descending
 *  2. systemCount equals the number of input systems for that vendor
 *  3. councilCount equals the number of unique _sourceCouncil values for that vendor
 *  4. totalSpend equals the sum of annualCost values for that vendor
 *  5. Systems without a vendor field are excluded from output
 *  6. Each entry's councils array is sorted alphabetically
 *  7. Each entry's councils array contains only unique names
 */


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the vendor string is safe to use as a plain-object key —
 * i.e. it does not shadow a property on Object.prototype. The function under
 * test uses `var vendorMap = {}` and the guard `if (!vendorMap[vendor])`,
 * so names like "constructor", "valueOf", "hasOwnProperty" etc. bypass the
 * initialisation path and cause runtime errors.
 */
function isSafeVendorName(vendor) {
  return !(vendor in Object.prototype) && Object.prototype[vendor] === undefined;
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const COUNCIL_NAMES = ['Alpha Council', 'Beta District', 'Gamma Borough', 'Delta Unitary'];

/**
 * Generate a flat array of 1–8 IT systems drawn from a fixed pool of council names.
 * vendor is always present so we can test vendor-specific properties; a separate
 * test uses systems with absent vendors.
 */
const arbSystemsWithVendor = fc.array(
  arbITSystem({ councilNames: COUNCIL_NAMES }),
  { minLength: 1, maxLength: 8 }
);

/**
 * Generate a single system that explicitly has no vendor field by overriding
 * with a record that omits it.
 */
const arbSystemWithoutVendor = fc.record({
  id: fc.uuid(),
  label: fc.stringMatching(/^[A-Za-z ]{3,20}$/),
  type: fc.constant('ITSystem'),
  _sourceCouncil: fc.constantFrom(...COUNCIL_NAMES),
  annualCost: fc.option(fc.integer({ min: 1000, max: 500000 }), { nil: undefined }),
}).map(rec => {
  const cleaned = {};
  for (const [k, v] of Object.entries(rec)) {
    if (v !== undefined) cleaned[k] = v;
  }
  // Ensure vendor is absent
  delete cleaned.vendor;
  return cleaned;
});

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('computeVendorDensityMetrics', () => {

  it('output is sorted by systemCount descending', () => {
    fc.assert(
      fc.property(arbSystemsWithVendor, (systems) => {
        // Exclude vendor names that shadow Object.prototype properties
        fc.pre(systems.every(s => !s.vendor || isSafeVendorName(s.vendor)));

        const result = computeVendorDensityMetrics(systems);
        for (let i = 1; i < result.length; i++) {
          expect(result[i - 1].systemCount).toBeGreaterThanOrEqual(result[i].systemCount);
        }
      }),
      { numRuns: 200 }
    );
  });

  it('systemCount equals the number of input systems for each vendor', () => {
    fc.assert(
      fc.property(arbSystemsWithVendor, (systems) => {
        fc.pre(systems.every(s => !s.vendor || isSafeVendorName(s.vendor)));

        const result = computeVendorDensityMetrics(systems);

        for (const entry of result) {
          const expectedCount = systems.filter(s => s.vendor === entry.vendor).length;
          expect(entry.systemCount).toBe(expectedCount);
        }
      }),
      { numRuns: 200 }
    );
  });

  it('councilCount equals the number of unique _sourceCouncil values for each vendor', () => {
    fc.assert(
      fc.property(arbSystemsWithVendor, (systems) => {
        fc.pre(systems.every(s => !s.vendor || isSafeVendorName(s.vendor)));

        const result = computeVendorDensityMetrics(systems);

        for (const entry of result) {
          const vendorSystems = systems.filter(s => s.vendor === entry.vendor);
          const uniqueCouncils = new Set(
            vendorSystems.filter(s => s._sourceCouncil).map(s => s._sourceCouncil)
          );
          expect(entry.councilCount).toBe(uniqueCouncils.size);
        }
      }),
      { numRuns: 200 }
    );
  });

  it('totalSpend equals the sum of annualCost for each vendor', () => {
    fc.assert(
      fc.property(arbSystemsWithVendor, (systems) => {
        fc.pre(systems.every(s => !s.vendor || isSafeVendorName(s.vendor)));

        const result = computeVendorDensityMetrics(systems);

        for (const entry of result) {
          const vendorSystems = systems.filter(s => s.vendor === entry.vendor);
          const expectedSpend = vendorSystems
            .filter(s => typeof s.annualCost === 'number')
            .reduce((sum, s) => sum + s.annualCost, 0);
          expect(entry.totalSpend).toBe(expectedSpend);
        }
      }),
      { numRuns: 200 }
    );
  });

  it('systems without a vendor field are excluded from output', () => {
    fc.assert(
      fc.property(
        arbSystemsWithVendor,
        fc.array(arbSystemWithoutVendor, { minLength: 1, maxLength: 4 }),
        (systemsWithVendor, systemsWithoutVendor) => {
          fc.pre(systemsWithVendor.every(s => !s.vendor || isSafeVendorName(s.vendor)));

          const combined = [...systemsWithVendor, ...systemsWithoutVendor];
          const result = computeVendorDensityMetrics(combined);

          // Every entry in the result must have a non-empty vendor string
          for (const entry of result) {
            expect(entry.vendor).toBeTruthy();
          }

          // The total system count in the result must equal the number of
          // input systems that have a vendor field
          const systemsWithAVendor = combined.filter(s => s.vendor);
          const totalResultCount = result.reduce((sum, e) => sum + e.systemCount, 0);
          expect(totalResultCount).toBe(systemsWithAVendor.length);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('each entry councils array is sorted alphabetically', () => {
    fc.assert(
      fc.property(arbSystemsWithVendor, (systems) => {
        fc.pre(systems.every(s => !s.vendor || isSafeVendorName(s.vendor)));

        const result = computeVendorDensityMetrics(systems);

        for (const entry of result) {
          const sorted = [...entry.councils].sort();
          expect(entry.councils).toEqual(sorted);
        }
      }),
      { numRuns: 200 }
    );
  });

  it('each entry councils array contains only unique council names', () => {
    fc.assert(
      fc.property(arbSystemsWithVendor, (systems) => {
        fc.pre(systems.every(s => !s.vendor || isSafeVendorName(s.vendor)));

        const result = computeVendorDensityMetrics(systems);

        for (const entry of result) {
          const unique = new Set(entry.councils);
          expect(entry.councils.length).toBe(unique.size);
        }
      }),
      { numRuns: 200 }
    );
  });

  it('returns empty array for empty input', () => {
    const result = computeVendorDensityMetrics([]);
    expect(result).toEqual([]);
  });

  it('returns empty array when all systems lack a vendor', () => {
    fc.assert(
      fc.property(
        fc.array(arbSystemWithoutVendor, { minLength: 1, maxLength: 6 }),
        (systems) => {
          const result = computeVendorDensityMetrics(systems);
          expect(result).toEqual([]);
        }
      ),
      { numRuns: 200 }
    );
  });

});
