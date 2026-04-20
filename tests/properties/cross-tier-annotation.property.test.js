import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { extractEngine } from '../helpers/extract.js';

/**
 * Property 11: Cross-tier collision annotation
 *
 * Feature: lgr-transition-planning, Property 11: Cross-tier collision annotation
 *
 * Validates: Requirements 10.3
 */

const ctx = extractEngine();
const detectCrossTierCollision = ctx.detectCrossTierCollision;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_TIERS = ['county', 'district', 'unitary'];

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Generate a council name like "Council-A", "Council-B", etc. */
const arbCouncilName = fc.stringMatching(/^Council-[A-Z]{1,3}$/);

/**
 * Generate a system node with a _sourceCouncil drawn from a provided pool.
 */
function arbSystemNode(councilPool) {
  return fc.record({
    id: fc.uuid().map(u => `sys-${u}`),
    label: fc.constant('Test System'),
    type: fc.constant('ITSystem'),
    _sourceCouncil: fc.constantFrom(...councilPool),
  });
}

/**
 * Scenario: systems from councils with DIFFERENT tier values.
 *
 * Generates:
 * - 2–5 unique council names
 * - A councilTierMap where at least 2 councils have different tier values
 * - 2–6 system nodes drawn from those councils, ensuring at least one system
 *   from each of the two differently-tiered councils
 */
const arbDifferentTierScenario = fc
  .tuple(
    fc.uniqueArray(arbCouncilName, { minLength: 2, maxLength: 5, comparator: (a, b) => a === b }),
    // Pick two distinct tiers for the first two councils
    fc.constantFrom(...VALID_TIERS),
    fc.constantFrom(...VALID_TIERS),
  )
  .filter(([, tier1, tier2]) => tier1 !== tier2)
  .chain(([councils, tier1, tier2]) => {
    // Build a councilTierMap where first council gets tier1, second gets tier2,
    // remaining get random tiers
    return fc.array(
      fc.constantFrom(...VALID_TIERS),
      { minLength: Math.max(0, councils.length - 2), maxLength: Math.max(0, councils.length - 2) }
    ).chain(remainingTiers => {
      const councilTierMap = new Map();
      councilTierMap.set(councils[0], tier1);
      councilTierMap.set(councils[1], tier2);
      for (let i = 2; i < councils.length; i++) {
        councilTierMap.set(councils[i], remainingTiers[i - 2]);
      }

      // Generate systems ensuring at least one from councils[0] and one from councils[1]
      return fc.array(
        arbSystemNode(councils),
        { minLength: 0, maxLength: 4 }
      ).map(extraSystems => {
        // Guarantee at least one system from each of the two differently-tiered councils
        const sys1 = { id: 'sys-forced-1', label: 'Test System', type: 'ITSystem', _sourceCouncil: councils[0] };
        const sys2 = { id: 'sys-forced-2', label: 'Test System', type: 'ITSystem', _sourceCouncil: councils[1] };
        return {
          systems: [sys1, sys2, ...extraSystems],
          councilTierMap,
        };
      });
    });
  });

/**
 * Scenario: all systems from councils with the SAME tier value.
 *
 * Generates:
 * - 1–5 unique council names
 * - A single tier value assigned to all councils
 * - 1–6 system nodes drawn from those councils
 */
const arbSameTierScenario = fc
  .tuple(
    fc.uniqueArray(arbCouncilName, { minLength: 1, maxLength: 5, comparator: (a, b) => a === b }),
    fc.constantFrom(...VALID_TIERS),
  )
  .chain(([councils, tier]) => {
    const councilTierMap = new Map();
    councils.forEach(c => councilTierMap.set(c, tier));

    return fc.array(
      arbSystemNode(councils),
      { minLength: 1, maxLength: 6 }
    ).map(systems => ({
      systems,
      councilTierMap,
    }));
  });

/**
 * Scenario: systems from councils with NO tier data in the map.
 *
 * Generates:
 * - 1–5 unique council names
 * - An empty councilTierMap (no tier data at all)
 * - 1–6 system nodes drawn from those councils
 */
const arbNoTierDataScenario = fc
  .uniqueArray(arbCouncilName, { minLength: 1, maxLength: 5, comparator: (a, b) => a === b })
  .chain(councils => {
    return fc.array(
      arbSystemNode(councils),
      { minLength: 1, maxLength: 6 }
    ).map(systems => ({
      systems,
      councilTierMap: new Map(), // no tier data
    }));
  });

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Property 11: Cross-tier collision annotation', {
  tags: [
    'Feature: lgr-transition-planning',
    'Property 11: Cross-tier collision annotation',
  ],
}, () => {

  it('different tier values → cross-tier annotation present', () => {
    fc.assert(
      fc.property(arbDifferentTierScenario, ({ systems, councilTierMap }) => {
        const result = detectCrossTierCollision(systems, councilTierMap);

        expect(result.crossTier).toBe(true);
        expect(Array.isArray(result.tiers)).toBe(true);
        expect(result.tiers.length).toBeGreaterThanOrEqual(2);

        // All returned tiers should be valid tier values
        for (const t of result.tiers) {
          expect(VALID_TIERS).toContain(t);
        }

        // The returned tiers should be unique
        const uniqueTiers = new Set(result.tiers);
        expect(uniqueTiers.size).toBe(result.tiers.length);
      }),
      { numRuns: 200 }
    );
  });

  it('same tier values → no cross-tier annotation', () => {
    fc.assert(
      fc.property(arbSameTierScenario, ({ systems, councilTierMap }) => {
        const result = detectCrossTierCollision(systems, councilTierMap);

        expect(result.crossTier).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it('no tier data → no cross-tier annotation', () => {
    fc.assert(
      fc.property(arbNoTierDataScenario, ({ systems, councilTierMap }) => {
        const result = detectCrossTierCollision(systems, councilTierMap);

        expect(result.crossTier).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

});
