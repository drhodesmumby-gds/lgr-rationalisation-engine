import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { extractEngine } from '../helpers/extract.js';
import { arbITSystem } from '../generators/arbITSystem.js';

/**
 * Property tests for computeSignals
 *
 * computeSignals(systems, weightsOverride) computes up to 8 signals for a set
 * of IT systems. It reads global state from the engine context:
 *   - transitionStructure
 *   - operatingMode
 *   - signalWeights (used when weightsOverride is null)
 *
 * These tests target structural invariants that hold regardless of time-dependent
 * values (contractUrgency uses new Date() internally).
 */

const ctx = extractEngine();
const computeSignals = ctx.computeSignals;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_SIGNAL_IDS = [
  'contractUrgency',
  'userVolume',
  'dataMonolith',
  'dataPortability',
  'vendorDensity',
  'techDebt',
  'tcopAlignment',
  'sharedService',
];

const SIGNAL_KEYS = VALID_SIGNAL_IDS;

/**
 * Vendor names that collide with Object.prototype methods.
 * The vendorDensity section in computeSignals uses `vm[vendor]` on a plain
 * object ({}), so a vendor name that is an inherited property (e.g. "toString",
 * "valueOf") will find a function rather than undefined, causing `vm[vendor].add`
 * to throw. We must exclude such names from generated inputs.
 */
const OBJECT_PROTOTYPE_KEYS = new Set(Object.getOwnPropertyNames(Object.prototype));

/**
 * Returns true if any system in the array has a vendor name that collides
 * with Object.prototype. Used with fc.pre() to skip such inputs.
 */
function hasPrototypeVendorCollision(systems) {
  return systems.some(s => s.vendor && OBJECT_PROTOTYPE_KEYS.has(s.vendor));
}

// ---------------------------------------------------------------------------
// Helpers for global setup
// ---------------------------------------------------------------------------

/**
 * Reset the engine globals to a known-good discovery mode state before each test.
 */
function setDiscoveryMode() {
  ctx.transitionStructure = null;
  ctx.operatingMode = 'discovery';
  ctx.signalWeights = {
    contractUrgency: 3,
    userVolume: 2,
    dataMonolith: 2,
    dataPortability: 2,
    vendorDensity: 2,
    techDebt: 1,
    tcopAlignment: 1,
    sharedService: 2,
  };
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const COUNCIL_NAMES = ['Council Alpha', 'Council Beta', 'Council Gamma'];

/**
 * A single arbitrary IT system drawn from a fixed council pool.
 */
const arbSystem = arbITSystem({ councilNames: COUNCIL_NAMES, prefix: 'sys' });

/**
 * An array of 1–5 IT systems.
 */
const arbSystemArray = fc.array(arbSystem, { minLength: 1, maxLength: 5 });

/**
 * A full weights override object with each signal weight in 1–3 (all active).
 */
const arbActiveWeights = fc.record(
  Object.fromEntries(SIGNAL_KEYS.map(key => [key, fc.integer({ min: 1, max: 3 })]))
);

/**
 * A weights override object with each signal weight in 0–3 (any may be off).
 */
const arbAnyWeights = fc.record(
  Object.fromEntries(SIGNAL_KEYS.map(key => [key, fc.integer({ min: 0, max: 3 })]))
);

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('computeSignals', () => {

  beforeEach(() => {
    setDiscoveryMode();
  });

  // -------------------------------------------------------------------------
  // 1. Result is always an array
  // -------------------------------------------------------------------------
  it('always returns an array (never null or undefined)', () => {
    fc.assert(
      fc.property(arbSystemArray, arbAnyWeights, (systems, weights) => {
        fc.pre(!hasPrototypeVendorCollision(systems));
        const result = computeSignals(systems, weights);
        expect(Array.isArray(result)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  // -------------------------------------------------------------------------
  // 2. Signals are sorted by weight descending
  // -------------------------------------------------------------------------
  it('signals are sorted by weight descending', () => {
    fc.assert(
      fc.property(arbSystemArray, arbAnyWeights, (systems, weights) => {
        fc.pre(!hasPrototypeVendorCollision(systems));
        const result = computeSignals(systems, weights);
        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i].weight).toBeGreaterThanOrEqual(result[i + 1].weight);
        }
      }),
      { numRuns: 200 }
    );
  });

  // -------------------------------------------------------------------------
  // 3. Each signal has the required shape
  // -------------------------------------------------------------------------
  it('each signal has required shape fields: id, weight, label, value, tag, border, strong', () => {
    fc.assert(
      fc.property(arbSystemArray, arbActiveWeights, (systems, weights) => {
        fc.pre(!hasPrototypeVendorCollision(systems));
        const result = computeSignals(systems, weights);
        for (const sig of result) {
          expect(typeof sig.id).toBe('string');
          expect(typeof sig.weight).toBe('number');
          expect(typeof sig.label).toBe('string');
          expect(typeof sig.value).toBe('string');
          expect(typeof sig.tag).toBe('string');
          expect(typeof sig.border).toBe('string');
          expect(typeof sig.strong).toBe('boolean');
        }
      }),
      { numRuns: 200 }
    );
  });

  // -------------------------------------------------------------------------
  // 4. Signal IDs are from the known set of 8
  // -------------------------------------------------------------------------
  it('every signal id is one of the 8 valid signal identifiers', () => {
    fc.assert(
      fc.property(arbSystemArray, arbAnyWeights, (systems, weights) => {
        fc.pre(!hasPrototypeVendorCollision(systems));
        const result = computeSignals(systems, weights);
        for (const sig of result) {
          expect(VALID_SIGNAL_IDS).toContain(sig.id);
        }
      }),
      { numRuns: 200 }
    );
  });

  // -------------------------------------------------------------------------
  // 5. No duplicate signal IDs in a single result
  // -------------------------------------------------------------------------
  it('no duplicate signal IDs in the result', () => {
    fc.assert(
      fc.property(arbSystemArray, arbAnyWeights, (systems, weights) => {
        fc.pre(!hasPrototypeVendorCollision(systems));
        const ids = computeSignals(systems, weights).map(s => s.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
      }),
      { numRuns: 200 }
    );
  });

  // -------------------------------------------------------------------------
  // 6. Zero-weight signals are excluded from the result
  // -------------------------------------------------------------------------
  it('signals with weight=0 are never included in the result', () => {
    fc.assert(
      fc.property(arbSystemArray, arbAnyWeights, (systems, weights) => {
        fc.pre(!hasPrototypeVendorCollision(systems));
        const result = computeSignals(systems, weights);
        for (const sig of result) {
          expect(sig.weight).toBeGreaterThan(0);
        }
      }),
      { numRuns: 200 }
    );
  });

  // -------------------------------------------------------------------------
  // 7. dataMonolith signal fires when a system has Monolithic data partitioning
  // -------------------------------------------------------------------------
  it('dataMonolith signal appears when a system has Monolithic data partitioning', () => {
    const arbMonolithSystem = arbSystem
      .map(sys => ({ ...sys, dataPartitioning: 'Monolithic' }))
      .filter(sys => !OBJECT_PROTOTYPE_KEYS.has(sys.vendor));

    const arbMonolithArray = fc.array(arbMonolithSystem, { minLength: 1, maxLength: 3 });

    fc.assert(
      fc.property(arbMonolithArray, (systems) => {
        fc.pre(!hasPrototypeVendorCollision(systems));
        const weights = { ...ctx.signalWeights, dataMonolith: 2 };
        const signalIds = computeSignals(systems, weights).map(s => s.id);
        expect(signalIds).toContain('dataMonolith');
      }),
      { numRuns: 200 }
    );
  });

  it('dataMonolith signal appears when a system has isERP=true', () => {
    const arbErpSystem = arbSystem
      .map(sys => ({ ...sys, isERP: true }))
      .filter(sys => !OBJECT_PROTOTYPE_KEYS.has(sys.vendor));

    const arbErpArray = fc.array(arbErpSystem, { minLength: 1, maxLength: 3 });

    fc.assert(
      fc.property(arbErpArray, (systems) => {
        fc.pre(!hasPrototypeVendorCollision(systems));
        const weights = { ...ctx.signalWeights, dataMonolith: 2 };
        const signalIds = computeSignals(systems, weights).map(s => s.id);
        expect(signalIds).toContain('dataMonolith');
      }),
      { numRuns: 200 }
    );
  });

  it('dataMonolith signal is absent when no systems have Monolithic partitioning or isERP', () => {
    const arbCleanSystem = arbSystem.map(sys => {
      const cleaned = { ...sys };
      cleaned.dataPartitioning = 'Segmented';
      delete cleaned.isERP;
      return cleaned;
    });
    const arbCleanArray = fc.array(arbCleanSystem, { minLength: 1, maxLength: 4 });

    fc.assert(
      fc.property(arbCleanArray, (systems) => {
        fc.pre(!hasPrototypeVendorCollision(systems));
        const weights = { ...ctx.signalWeights, dataMonolith: 2 };
        const signalIds = computeSignals(systems, weights).map(s => s.id);
        expect(signalIds).not.toContain('dataMonolith');
      }),
      { numRuns: 200 }
    );
  });

  // -------------------------------------------------------------------------
  // 8. techDebt signal fires when a system is on-premise (!isCloud)
  // -------------------------------------------------------------------------
  it('techDebt signal appears when at least one system has isCloud absent (on-premise)', () => {
    const arbOnPremSystem = arbSystem.map(sys => {
      const cleaned = { ...sys };
      delete cleaned.isCloud;
      return cleaned;
    });
    const arbOnPremArray = fc.array(arbOnPremSystem, { minLength: 1, maxLength: 3 });

    fc.assert(
      fc.property(arbOnPremArray, (systems) => {
        fc.pre(!hasPrototypeVendorCollision(systems));
        const weights = { ...ctx.signalWeights, techDebt: 2 };
        const signalIds = computeSignals(systems, weights).map(s => s.id);
        expect(signalIds).toContain('techDebt');
      }),
      { numRuns: 200 }
    );
  });

  it('techDebt signal is absent when ALL systems have isCloud=true and weight > 0', () => {
    const arbCloudSystem = arbSystem.map(sys => ({ ...sys, isCloud: true }));
    const arbCloudArray = fc.array(arbCloudSystem, { minLength: 1, maxLength: 4 });

    fc.assert(
      fc.property(arbCloudArray, (systems) => {
        fc.pre(!hasPrototypeVendorCollision(systems));
        const weights = { ...ctx.signalWeights, techDebt: 2 };
        const signalIds = computeSignals(systems, weights).map(s => s.id);
        expect(signalIds).not.toContain('techDebt');
      }),
      { numRuns: 200 }
    );
  });

  // -------------------------------------------------------------------------
  // 9. dataPortability signal fires when a system has Low or Medium portability
  // -------------------------------------------------------------------------
  it('dataPortability signal appears when at least one system has portability Low', () => {
    const arbLowPortSystem = arbSystem.map(sys => ({ ...sys, portability: 'Low' }));
    const arbLowPortArray = fc.array(arbLowPortSystem, { minLength: 1, maxLength: 3 });

    fc.assert(
      fc.property(arbLowPortArray, (systems) => {
        fc.pre(!hasPrototypeVendorCollision(systems));
        const weights = { ...ctx.signalWeights, dataPortability: 2 };
        const signalIds = computeSignals(systems, weights).map(s => s.id);
        expect(signalIds).toContain('dataPortability');
      }),
      { numRuns: 200 }
    );
  });

  it('dataPortability signal appears when at least one system has portability Medium', () => {
    const arbMedPortSystem = arbSystem.map(sys => ({ ...sys, portability: 'Medium' }));
    const arbMedPortArray = fc.array(arbMedPortSystem, { minLength: 1, maxLength: 3 });

    fc.assert(
      fc.property(arbMedPortArray, (systems) => {
        fc.pre(!hasPrototypeVendorCollision(systems));
        const weights = { ...ctx.signalWeights, dataPortability: 2 };
        const signalIds = computeSignals(systems, weights).map(s => s.id);
        expect(signalIds).toContain('dataPortability');
      }),
      { numRuns: 200 }
    );
  });

  it('dataPortability signal is absent when all systems have portability High and weight > 0', () => {
    const arbHighPortSystem = arbSystem.map(sys => ({ ...sys, portability: 'High' }));
    const arbHighPortArray = fc.array(arbHighPortSystem, { minLength: 1, maxLength: 4 });

    fc.assert(
      fc.property(arbHighPortArray, (systems) => {
        fc.pre(!hasPrototypeVendorCollision(systems));
        const weights = { ...ctx.signalWeights, dataPortability: 2 };
        const signalIds = computeSignals(systems, weights).map(s => s.id);
        expect(signalIds).not.toContain('dataPortability');
      }),
      { numRuns: 200 }
    );
  });

  // -------------------------------------------------------------------------
  // 10. userVolume signal appears with 1+ systems having users > 0
  // -------------------------------------------------------------------------
  it('userVolume signal appears when at least one system has users > 0', () => {
    const arbSystemWithUsers = arbSystem.map(sys => ({ ...sys, users: 100 }));
    const arbArrayWithUsers = fc.array(arbSystemWithUsers, { minLength: 1, maxLength: 4 });

    fc.assert(
      fc.property(arbArrayWithUsers, (systems) => {
        fc.pre(!hasPrototypeVendorCollision(systems));
        const weights = { ...ctx.signalWeights, userVolume: 2 };
        const signalIds = computeSignals(systems, weights).map(s => s.id);
        expect(signalIds).toContain('userVolume');
      }),
      { numRuns: 200 }
    );
  });

  it('userVolume signal is absent when no system has users > 0 and weight > 0', () => {
    const arbNoUsersSystem = arbSystem.map(sys => {
      const cleaned = { ...sys };
      delete cleaned.users;
      return cleaned;
    });
    const arbNoUsersArray = fc.array(arbNoUsersSystem, { minLength: 1, maxLength: 4 });

    fc.assert(
      fc.property(arbNoUsersArray, (systems) => {
        fc.pre(!hasPrototypeVendorCollision(systems));
        const weights = { ...ctx.signalWeights, userVolume: 2 };
        const signalIds = computeSignals(systems, weights).map(s => s.id);
        expect(signalIds).not.toContain('userVolume');
      }),
      { numRuns: 200 }
    );
  });

  // -------------------------------------------------------------------------
  // 11. Empty systems array always produces an empty signals array
  // -------------------------------------------------------------------------
  it('empty systems array always returns empty signals array', () => {
    fc.assert(
      fc.property(arbAnyWeights, (weights) => {
        const result = computeSignals([], weights);
        expect(result).toEqual([]);
      }),
      { numRuns: 200 }
    );
  });

  // -------------------------------------------------------------------------
  // 12. vendorDensity signal fires when same vendor appears across 2+ councils
  // -------------------------------------------------------------------------
  it('vendorDensity signal appears when same vendor spans 2+ different councils', () => {
    // Use a safe vendor name that is definitely not an Object.prototype key
    const safeVendors = ['Civica', 'MicrosoftCorp', 'SapSystems', 'OracleTech', 'SalesforceInc'];

    fc.assert(
      fc.property(fc.constantFrom(...safeVendors), (vendor) => {
        const systems = [
          { id: 'sys-1', label: 'System One', type: 'ITSystem', vendor, _sourceCouncil: 'Council Alpha' },
          { id: 'sys-2', label: 'System Two', type: 'ITSystem', vendor, _sourceCouncil: 'Council Beta' },
        ];
        const weights = { ...ctx.signalWeights, vendorDensity: 2 };
        const signalIds = computeSignals(systems, weights).map(s => s.id);
        expect(signalIds).toContain('vendorDensity');
      }),
      { numRuns: 200 }
    );
  });

  it('vendorDensity signal is absent when each vendor appears from only one council', () => {
    // Two systems with guaranteed-distinct safe vendor names
    fc.assert(
      fc.property(
        fc.tuple(
          fc.constantFrom('Civica', 'NortgatePublic', 'SapSystems', 'MicrosoftCorp'),
          fc.constantFrom('OracleTech', 'SalesforceInc', 'OpenTextCorp', 'ServiceNowInc')
        ),
        ([vendorA, vendorB]) => {
          const systems = [
            { id: 'sys-1', label: 'System One', type: 'ITSystem', vendor: vendorA, _sourceCouncil: 'Council Alpha' },
            { id: 'sys-2', label: 'System Two', type: 'ITSystem', vendor: vendorB, _sourceCouncil: 'Council Beta' },
          ];
          const weights = { ...ctx.signalWeights, vendorDensity: 2 };
          const signalIds = computeSignals(systems, weights).map(s => s.id);
          expect(signalIds).not.toContain('vendorDensity');
        }
      ),
      { numRuns: 200 }
    );
  });

  // -------------------------------------------------------------------------
  // 13. sharedService signal fires in discovery mode when systems have sharedWith
  // -------------------------------------------------------------------------
  it('sharedService signal appears in discovery mode when systems have non-empty sharedWith', () => {
    const arbSharedSystem = arbSystem.map(sys => ({
      ...sys,
      sharedWith: ['Council Beta'],
      _sourceCouncil: 'Council Alpha',
    }));
    const arbSharedArray = fc.array(arbSharedSystem, { minLength: 1, maxLength: 3 });

    fc.assert(
      fc.property(arbSharedArray, (systems) => {
        fc.pre(!hasPrototypeVendorCollision(systems));
        ctx.operatingMode = 'discovery';
        ctx.transitionStructure = null;
        const weights = { ...ctx.signalWeights, sharedService: 2 };
        const signalIds = computeSignals(systems, weights).map(s => s.id);
        expect(signalIds).toContain('sharedService');
      }),
      { numRuns: 200 }
    );
  });

  it('sharedService signal is absent in discovery mode when no systems have sharedWith', () => {
    const arbNoShareSystem = arbSystem.map(sys => {
      const cleaned = { ...sys };
      delete cleaned.sharedWith;
      return cleaned;
    });
    const arbNoShareArray = fc.array(arbNoShareSystem, { minLength: 1, maxLength: 4 });

    fc.assert(
      fc.property(arbNoShareArray, (systems) => {
        fc.pre(!hasPrototypeVendorCollision(systems));
        ctx.operatingMode = 'discovery';
        ctx.transitionStructure = null;
        const weights = { ...ctx.signalWeights, sharedService: 2 };
        const signalIds = computeSignals(systems, weights).map(s => s.id);
        expect(signalIds).not.toContain('sharedService');
      }),
      { numRuns: 200 }
    );
  });

  // -------------------------------------------------------------------------
  // 14. Transition mode: sharedService signal appears for systems with sharedWith
  // -------------------------------------------------------------------------
  it('sharedService signal appears in transition mode when systems have non-empty sharedWith', () => {
    const transitionStructure = {
      vestingDate: '2027-04-01',
      successors: [
        {
          name: 'North Unitary',
          fullPredecessors: ['Council Alpha'],
          partialPredecessors: [],
        },
        {
          name: 'South Unitary',
          fullPredecessors: ['Council Beta'],
          partialPredecessors: [],
        },
      ],
    };

    const arbSharedSystem = arbSystem.map(sys => ({
      ...sys,
      sharedWith: ['Council Beta'],
      _sourceCouncil: 'Council Alpha',
    }));
    const arbSharedArray = fc.array(arbSharedSystem, { minLength: 1, maxLength: 3 });

    fc.assert(
      fc.property(arbSharedArray, (systems) => {
        fc.pre(!hasPrototypeVendorCollision(systems));
        ctx.operatingMode = 'transition';
        ctx.transitionStructure = transitionStructure;
        const weights = { ...ctx.signalWeights, sharedService: 2 };
        const signalIds = computeSignals(systems, weights).map(s => s.id);
        expect(signalIds).toContain('sharedService');
      }),
      { numRuns: 200 }
    );
  });

  // -------------------------------------------------------------------------
  // 15. Signal weight in result equals the weight from the weightsOverride
  // -------------------------------------------------------------------------
  it('each signal carries the weight value from weightsOverride', () => {
    // Guaranteed monolith system so dataMonolith always fires
    const systems = [
      {
        id: 'sys-1',
        label: 'Test ERP',
        type: 'ITSystem',
        dataPartitioning: 'Monolithic',
        _sourceCouncil: 'Council Alpha',
      },
    ];

    fc.assert(
      fc.property(fc.integer({ min: 1, max: 3 }), (w) => {
        const weights = { ...ctx.signalWeights, dataMonolith: w };
        const result = computeSignals(systems, weights);
        const monolithSignal = result.find(s => s.id === 'dataMonolith');
        expect(monolithSignal).toBeDefined();
        expect(monolithSignal.weight).toBe(w);
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // 16. contractUrgency signal appears when a system has endYear and weight > 0
  // -------------------------------------------------------------------------
  it('contractUrgency signal appears when at least one system has endYear and weight > 0', () => {
    const arbDatedSystem = arbSystem.map(sys => ({
      ...sys,
      endYear: 2028,
      endMonth: 6,
      noticePeriod: 6,
    }));
    const arbDatedArray = fc.array(arbDatedSystem, { minLength: 1, maxLength: 3 });

    fc.assert(
      fc.property(arbDatedArray, (systems) => {
        fc.pre(!hasPrototypeVendorCollision(systems));
        ctx.transitionStructure = null;
        ctx.operatingMode = 'discovery';
        const weights = { ...ctx.signalWeights, contractUrgency: 2 };
        const signalIds = computeSignals(systems, weights).map(s => s.id);
        expect(signalIds).toContain('contractUrgency');
      }),
      { numRuns: 200 }
    );
  });

  it('contractUrgency signal is absent when no systems have endYear and weight > 0', () => {
    const arbNoDatedSystem = arbSystem.map(sys => {
      const cleaned = { ...sys };
      delete cleaned.endYear;
      delete cleaned.endMonth;
      delete cleaned.noticePeriod;
      return cleaned;
    });
    const arbNoDatedArray = fc.array(arbNoDatedSystem, { minLength: 1, maxLength: 4 });

    fc.assert(
      fc.property(arbNoDatedArray, (systems) => {
        fc.pre(!hasPrototypeVendorCollision(systems));
        ctx.transitionStructure = null;
        ctx.operatingMode = 'discovery';
        const weights = { ...ctx.signalWeights, contractUrgency: 2 };
        const signalIds = computeSignals(systems, weights).map(s => s.id);
        expect(signalIds).not.toContain('contractUrgency');
      }),
      { numRuns: 200 }
    );
  });

  // -------------------------------------------------------------------------
  // 17. contractUrgency signal appears in transition mode with vestingDate
  // -------------------------------------------------------------------------
  it('contractUrgency signal appears in transition mode when systems have endYear', () => {
    const transitionStructure = {
      vestingDate: '2027-04-01',
      successors: [
        {
          name: 'North Unitary',
          fullPredecessors: ['Council Alpha'],
          partialPredecessors: [],
        },
      ],
    };

    const systems = [
      {
        id: 'sys-1',
        label: 'Legacy CRM',
        type: 'ITSystem',
        endYear: 2027,
        endMonth: 1,
        noticePeriod: 6,
        _sourceCouncil: 'Council Alpha',
      },
    ];

    fc.assert(
      fc.property(fc.integer({ min: 1, max: 3 }), (w) => {
        ctx.transitionStructure = transitionStructure;
        ctx.operatingMode = 'transition';
        const weights = { ...ctx.signalWeights, contractUrgency: w };
        const signalIds = computeSignals(systems, weights).map(s => s.id);
        expect(signalIds).toContain('contractUrgency');
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // 18. Result count never exceeds 8 (one per signal)
  // -------------------------------------------------------------------------
  it('result contains at most 8 signals (one per signal type)', () => {
    fc.assert(
      fc.property(arbSystemArray, arbAnyWeights, (systems, weights) => {
        fc.pre(!hasPrototypeVendorCollision(systems));
        const result = computeSignals(systems, weights);
        expect(result.length).toBeLessThanOrEqual(8);
      }),
      { numRuns: 200 }
    );
  });

  // -------------------------------------------------------------------------
  // 19. Weights-off: when all weights are 0, result is always empty
  // -------------------------------------------------------------------------
  it('when all signal weights are 0, result is always empty', () => {
    const zeroWeights = Object.fromEntries(SIGNAL_KEYS.map(k => [k, 0]));

    fc.assert(
      fc.property(arbSystemArray, (systems) => {
        fc.pre(!hasPrototypeVendorCollision(systems));
        const result = computeSignals(systems, zeroWeights);
        expect(result).toEqual([]);
      }),
      { numRuns: 200 }
    );
  });

  // -------------------------------------------------------------------------
  // 20. Signal value and label fields are non-empty strings when signal fires
  // -------------------------------------------------------------------------
  it('every signal in the result has a non-empty value and label string', () => {
    fc.assert(
      fc.property(arbSystemArray, arbActiveWeights, (systems, weights) => {
        fc.pre(!hasPrototypeVendorCollision(systems));
        const result = computeSignals(systems, weights);
        for (const sig of result) {
          expect(sig.value.length).toBeGreaterThan(0);
          expect(sig.label.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 200 }
    );
  });
});
