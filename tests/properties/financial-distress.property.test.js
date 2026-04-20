import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { extractEngine } from '../helpers/extract.js';

/**
 * Property 10: Financial distress propagation
 *
 * Feature: lgr-transition-planning, Property 10: Financial distress propagation
 *
 * Validates: Requirements 9.2
 */

const ctx = extractEngine();
const propagateFinancialDistress = ctx.propagateFinancialDistress;

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Generate a council name like "Council-AB" */
const arbCouncilName = fc.stringMatching(/^Council-[A-Z]{1,3}$/);

/**
 * Generate a council metadata object with random councilName and random
 * financialDistress (true, false, or undefined).
 */
const arbCouncilMetadata = fc.tuple(
  arbCouncilName,
  fc.constantFrom(true, false, undefined),
).map(([councilName, financialDistress]) => {
  const meta = { councilName };
  if (financialDistress !== undefined) {
    meta.financialDistress = financialDistress;
  }
  return meta;
});

/**
 * Generate a list of 2–6 council metadata objects with unique council names.
 */
const arbCouncilMetadataList = fc
  .uniqueArray(arbCouncilName, { minLength: 2, maxLength: 6, comparator: (a, b) => a === b })
  .chain(names =>
    fc.tuple(
      ...names.map(name =>
        fc.constantFrom(true, false, undefined).map(distress => {
          const meta = { councilName: name };
          if (distress !== undefined) {
            meta.financialDistress = distress;
          }
          return meta;
        })
      )
    )
  );

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Property 10: Financial distress propagation', {
  tags: [
    'Feature: lgr-transition-planning',
    'Property 10: Financial distress propagation',
  ],
}, () => {

  it('every council with financialDistress: true appears in the returned Set', () => {
    fc.assert(
      fc.property(arbCouncilMetadataList, (metadataList) => {
        const result = propagateFinancialDistress(metadataList);

        for (const meta of metadataList) {
          if (meta.financialDistress === true) {
            expect(result.has(meta.councilName)).toBe(true);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('no council with financialDistress: false or missing financialDistress appears in the returned Set', () => {
    fc.assert(
      fc.property(arbCouncilMetadataList, (metadataList) => {
        const result = propagateFinancialDistress(metadataList);

        for (const meta of metadataList) {
          if (meta.financialDistress !== true) {
            expect(result.has(meta.councilName)).toBe(false);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('returned Set size equals the number of distressed councils', () => {
    fc.assert(
      fc.property(arbCouncilMetadataList, (metadataList) => {
        const result = propagateFinancialDistress(metadataList);

        const expectedCount = metadataList.filter(m => m.financialDistress === true).length;
        expect(result.size).toBe(expectedCount);
      }),
      { numRuns: 100 }
    );
  });

});
