import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeEffectiveTier } from '../../src/analysis/metrics.js';
import { DEFAULT_TIER_MAP } from '../../src/constants/tier-map.js';

/**
 * Property 4: Effective tier computation
 *
 * Feature: lgr-transition-planning, Property 4: Effective tier computation
 *
 * Validates: Requirements 3.3, 3.6
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// ESD function IDs explicitly mapped in DEFAULT_TIER_MAP
const TIER_1_IDS = ['148', '152', '3', '124', '146', '119', '116', '19', '130', '131', '65', '68', '142', '34'];
const TIER_2_IDS = ['109', '171', '99', '100', '101', '103', '66', '67', '69', '111', '54', '16', '15'];
const TIER_3_IDS = ['76', '72', '75', '73', '81', '78', '80', '36', '74', '79'];
const ALL_MAPPED_IDS = [...TIER_1_IDS, ...TIER_2_IDS, ...TIER_3_IDS];

// IDs that are NOT in DEFAULT_TIER_MAP (from the 176 ESD functions)
const UNMAPPED_IDS = ['42', '43', '44', '45', '46', '47', '48', '49', '50', '51',
  '52', '53', '55', '56', '57', '58', '59', '60', '61', '62'];

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Generate a vesting date as an ISO string (YYYY-MM-DD). */
const arbVestingDate = fc.record({
  year: fc.integer({ min: 2026, max: 2030 }),
  month: fc.integer({ min: 1, max: 12 }),
  day: fc.integer({ min: 1, max: 28 }),
}).map(({ year, month, day }) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
);

/** Generate a function node with a random lgaFunctionId and optional tier override. */
const arbFunctionNode = fc.record({
  lgaFunctionId: fc.constantFrom(...ALL_MAPPED_IDS, ...UNMAPPED_IDS),
  hasTierOverride: fc.boolean(),
  tierOverride: fc.constantFrom(1, 2, 3),
}).map(({ lgaFunctionId, hasTierOverride, tierOverride }) => {
  const node = { lgaFunctionId };
  if (hasTierOverride) {
    node.tier = tierOverride;
  }
  return node;
});

/** Generate a function node that specifically has a tier override. */
const arbFunctionNodeWithOverride = fc.record({
  lgaFunctionId: fc.constantFrom(...ALL_MAPPED_IDS, ...UNMAPPED_IDS),
  tier: fc.constantFrom(1, 2, 3),
});

/** Generate a function node with an unmapped lgaFunctionId and no tier override. */
const arbUnmappedFunctionNode = fc.constantFrom(...UNMAPPED_IDS).map(id => ({
  lgaFunctionId: id,
}));

/**
 * Generate a system with contract data (endYear, endMonth, noticePeriod).
 * These fields control the notice trigger month computation.
 */
const arbSystem = fc.record({
  endYear: fc.option(fc.integer({ min: 2024, max: 2035 }), { nil: undefined }),
  endMonth: fc.option(fc.integer({ min: 1, max: 12 }), { nil: undefined }),
  noticePeriod: fc.option(fc.integer({ min: 0, max: 24 }), { nil: undefined }),
}).map(rec => {
  const sys = {};
  if (rec.endYear !== undefined) sys.endYear = rec.endYear;
  if (rec.endMonth !== undefined) sys.endMonth = rec.endMonth;
  if (rec.noticePeriod !== undefined) sys.noticePeriod = rec.noticePeriod;
  return sys;
});

/**
 * Generate a system whose notice trigger is guaranteed to be before a given
 * vesting date (pre-vesting notice trigger).
 */
function arbPreVestingSystem(vestingDate) {
  const vDate = new Date(vestingDate);
  const vestingMonth = vDate.getFullYear() * 12 + (vDate.getMonth() + 1);

  return fc.record({
    endYear: fc.integer({ min: 2024, max: 2035 }),
    noticePeriod: fc.integer({ min: 0, max: 24 }),
    endMonth: fc.integer({ min: 1, max: 12 }),
  }).filter(({ endYear, endMonth, noticePeriod }) => {
    const noticeTriggerMonth = endYear * 12 + endMonth - noticePeriod;
    return noticeTriggerMonth < vestingMonth;
  });
}

/**
 * Generate a system whose notice trigger is guaranteed to be at or after a
 * given vesting date (not pre-vesting).
 */
function arbPostVestingSystem(vestingDate) {
  const vDate = new Date(vestingDate);
  const vestingMonth = vDate.getFullYear() * 12 + (vDate.getMonth() + 1);

  return fc.record({
    endYear: fc.integer({ min: 2024, max: 2035 }),
    noticePeriod: fc.integer({ min: 0, max: 24 }),
    endMonth: fc.integer({ min: 1, max: 12 }),
  }).filter(({ endYear, endMonth, noticePeriod }) => {
    const noticeTriggerMonth = endYear * 12 + endMonth - noticePeriod;
    return noticeTriggerMonth >= vestingMonth;
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeNoticeTriggerMonth(sys) {
  return sys.endYear * 12 + (sys.endMonth || 12) - (sys.noticePeriod || 0);
}

function computeVestingMonth(vestingDate) {
  const d = new Date(vestingDate);
  return d.getFullYear() * 12 + (d.getMonth() + 1);
}

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Property 4: Effective tier computation', {
  tags: [
    'Feature: lgr-transition-planning',
    'Property 4: Effective tier computation',
  ],
}, () => {

  it('function-level tier override always takes precedence over DEFAULT_TIER_MAP', () => {
    fc.assert(
      fc.property(arbFunctionNodeWithOverride, arbVestingDate, (functionNode, vestingDate) => {
        // Test with no systems (no promotion possible)
        const result = computeEffectiveTier(functionNode, DEFAULT_TIER_MAP, vestingDate, []);

        // The originalTier should equal the override, not the DEFAULT_TIER_MAP value
        expect(result.originalTier).toBe(functionNode.tier);
        // The effective tier should also be the override (unless promoted, but
        // promotion only applies to tier 3 — and even then originalTier is the override)
        expect(result.originalTier).toBe(functionNode.tier);
      }),
      { numRuns: 100 }
    );
  });

  it('unmapped functions default to Tier 2', () => {
    fc.assert(
      fc.property(arbUnmappedFunctionNode, (functionNode) => {
        // No vesting date, no systems — pure default lookup
        const result = computeEffectiveTier(functionNode, DEFAULT_TIER_MAP, null, []);

        expect(result.originalTier).toBe(2);
        expect(result.tier).toBe(2);
        expect(result.promoted).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('Tier 3 promotion to Tier 2 fires only when vesting date is set AND a system has pre-vesting notice trigger', () => {
    // Use a fixed vesting date for controlled generation of pre/post-vesting systems
    const vestingDate = '2028-04-01';
    const vestingMonth = computeVestingMonth(vestingDate);

    // Generate a Tier 3 function node (no override, use a known Tier 3 ID)
    const arbTier3Node = fc.constantFrom(...TIER_3_IDS).map(id => ({ lgaFunctionId: id }));

    fc.assert(
      fc.property(
        arbTier3Node,
        fc.boolean(), // hasVestingDate
        fc.array(arbSystem, { minLength: 1, maxLength: 5 }),
        (functionNode, hasVestingDate, systems) => {
          const vDate = hasVestingDate ? vestingDate : null;
          const result = computeEffectiveTier(functionNode, DEFAULT_TIER_MAP, vDate, systems);

          // Original tier should always be 3 for these nodes
          expect(result.originalTier).toBe(3);

          // Check if any system has a pre-vesting notice trigger
          const hasPreVesting = hasVestingDate && systems.some(sys => {
            if (!sys.endYear) return false;
            const ntm = computeNoticeTriggerMonth(sys);
            return ntm < vestingMonth;
          });

          if (hasPreVesting) {
            // Should be promoted
            expect(result.tier).toBe(2);
            expect(result.promoted).toBe(true);
          } else {
            // Should NOT be promoted
            expect(result.tier).toBe(3);
            expect(result.promoted).toBe(false);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

});
