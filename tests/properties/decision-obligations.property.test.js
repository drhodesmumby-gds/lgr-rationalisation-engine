/**
 * Property tests for the decision-derived obligation system.
 *
 * Tests that:
 * - defer decisions generate deferral-cost obligations
 * - choose decisions generate data-migration obligations for removed systems
 * - deferral obligations have the correct shape and are always unresolved
 * - computeObligationSeverity handles deferral-cost type
 * - generateMigrationScopeBullets generates appropriate bullets for deferral-cost
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateDeferralObligations, computeObligationSeverity, generateMigrationScopeBullets } from '../../src/simulation/obligations.js';
import { projectDecisions } from '../../src/simulation/projector.js';
import { getDecisionKey } from '../../src/simulation/decisions.js';
import { applyAllActions } from '../../src/simulation/actions.js';

// --- Inline generators ---

const arbSystem = fc.record({
    id: fc.stringMatching(/^sys-[a-z0-9]{3,8}$/),
    label: fc.string({ minLength: 1, maxLength: 30 }),
    users: fc.integer({ min: 0, max: 10000 }),
    annualCost: fc.integer({ min: 1000, max: 500000 }),
    endYear: fc.option(fc.integer({ min: 2025, max: 2035 }), { nil: undefined }),
    endMonth: fc.option(fc.integer({ min: 1, max: 12 }), { nil: undefined }),
    isCloud: fc.boolean(),
    isERP: fc.constant(false),
    dataPartitioning: fc.constantFrom('Segmented', 'Monolithic'),
    portability: fc.constantFrom('High', 'Medium', 'Low'),
    _sourceCouncil: fc.constantFrom('Council-A', 'Council-B', 'Council-C'),
}).map(fields => {
    const sys = { ...fields, type: 'ITSystem' };
    for (const key of Object.keys(sys)) {
        if (sys[key] === undefined) delete sys[key];
    }
    return sys;
});

const arbErpSystem = arbSystem.map(s => ({
    ...s,
    isERP: true,
    dataPartitioning: 'Monolithic',
    annualCost: s.annualCost || 500000
}));

const arbFunction = fc.record({
    id: fc.stringMatching(/^fn-[a-z0-9]{3,8}$/),
    label: fc.string({ minLength: 1, maxLength: 30 }),
    lgaFunctionId: fc.constantFrom('1', '2', '3', '4', '5'),
    _sourceCouncil: fc.constantFrom('Council-A', 'Council-B', 'Council-C'),
}).map(f => ({ ...f, type: 'Function' }));

const arbWeights = fc.record({
    contractUrgency: fc.integer({ min: 0, max: 3 }),
    userVolume: fc.integer({ min: 0, max: 3 }),
    dataMonolith: fc.integer({ min: 0, max: 3 }),
    dataPortability: fc.integer({ min: 0, max: 3 }),
    vendorDensity: fc.integer({ min: 0, max: 3 }),
    techDebt: fc.integer({ min: 0, max: 3 }),
    tcopAlignment: fc.integer({ min: 0, max: 3 }),
    sharedService: fc.integer({ min: 0, max: 3 }),
});

/**
 * Builds a minimal baseline allocation map for a single (successor, function) cell.
 */
function buildSingleCellBaseline(systems, fn, successorName) {
    const nodes = [...systems, fn];
    const edges = systems.map(sys => ({
        source: sys.id, target: fn.id, relationship: 'REALIZES'
    }));
    const funcMap = new Map();
    funcMap.set(fn.lgaFunctionId, systems.map(sys => ({
        system: sys,
        sourceCouncil: sys._sourceCouncil || 'Council-A',
        allocationType: 'full',
        needsAllocationReview: false,
        isDisaggregation: false
    })));
    const allocation = new Map();
    allocation.set(successorName, funcMap);
    return { baselineNodes: nodes, baselineEdges: edges, baselineAllocation: allocation };
}

describe('Decision Obligations — Property Tests', () => {

    it('Property: generateDeferralObligations produces deferral-cost obligations for defer decisions', () => {
        fc.assert(
            fc.property(
                arbFunction,
                arbSystem,
                arbSystem,
                fc.constantFrom('Successor-A', 'Successor-B'),
                (fn, sysA, sysB, successorName) => {
                    if (sysA.id === sysB.id) return;

                    const { baselineAllocation } = buildSingleCellBaseline([sysA, sysB], fn, successorName);

                    const deferDecision = {
                        id: `dec-defer-test`,
                        functionId: fn.lgaFunctionId,
                        successorName,
                        timestamp: new Date().toISOString(),
                        systemChoice: 'defer',
                        retainedSystemIds: [],
                        procuredSystem: null,
                        boundaryChoice: 'none',
                        disaggregationSplits: [],
                        contractExtensions: []
                    };

                    const lgaFunctionMap = new Map();
                    lgaFunctionMap.set(fn.lgaFunctionId, { label: fn.label, lgaId: fn.lgaFunctionId });

                    const obligations = generateDeferralObligations(deferDecision, baselineAllocation, lgaFunctionMap);

                    // Must produce at least one obligation
                    expect(obligations.length).toBeGreaterThan(0);

                    // All generated obligations must be of type 'deferral-cost'
                    obligations.forEach(obl => {
                        expect(obl.type).toBe('deferral-cost');
                    });

                    // Must contain parallel systems info
                    obligations.forEach(obl => {
                        expect(Array.isArray(obl.parallelSystems)).toBe(true);
                        expect(obl.parallelSystems.length).toBeGreaterThan(0);
                    });
                }
            ),
            { numRuns: 50 }
        );
    });

    it('Property: Deferral obligations are always unresolved', () => {
        fc.assert(
            fc.property(
                arbFunction,
                fc.array(arbSystem, { minLength: 1, maxLength: 4 }),
                fc.constantFrom('Successor-A', 'Successor-B'),
                (fn, systems, successorName) => {
                    // Filter out duplicate IDs
                    const uniqueSystems = systems.filter((s, i, arr) =>
                        arr.findIndex(x => x.id === s.id) === i
                    );
                    if (uniqueSystems.length === 0) return;

                    const { baselineAllocation } = buildSingleCellBaseline(uniqueSystems, fn, successorName);

                    const deferDecision = {
                        id: `dec-defer`,
                        functionId: fn.lgaFunctionId,
                        successorName,
                        timestamp: new Date().toISOString(),
                        systemChoice: 'defer',
                        retainedSystemIds: [],
                        procuredSystem: null,
                        boundaryChoice: 'none',
                        disaggregationSplits: [],
                        contractExtensions: []
                    };

                    const obligations = generateDeferralObligations(deferDecision, baselineAllocation, null);

                    // Deferral obligations must always be unresolved
                    obligations.forEach(obl => {
                        expect(obl.resolved).toBe(false);
                        expect(obl.toSystem).toBeNull();
                    });
                }
            ),
            { numRuns: 50 }
        );
    });

    it('Property: Choose decision via projectDecisions generates data-migration obligations for removed systems', () => {
        fc.assert(
            fc.property(
                arbFunction,
                arbSystem,
                arbSystem,
                fc.constantFrom('Successor-A', 'Successor-B'),
                (fn, sysA, sysB, successorName) => {
                    if (sysA.id === sysB.id) return;

                    const { baselineNodes, baselineEdges, baselineAllocation } = buildSingleCellBaseline(
                        [sysA, sysB], fn, successorName
                    );

                    const decisions = new Map();
                    decisions.set(getDecisionKey(fn.lgaFunctionId, successorName), {
                        id: `dec-choose`,
                        functionId: fn.lgaFunctionId,
                        successorName,
                        timestamp: new Date().toISOString(),
                        systemChoice: 'choose',
                        retainedSystemIds: [sysA.id],
                        procuredSystem: null,
                        boundaryChoice: 'none',
                        disaggregationSplits: [],
                        contractExtensions: []
                    });

                    const { actions } = projectDecisions(decisions, baselineNodes, baselineEdges, baselineAllocation, null);

                    // Apply actions with obligation generation
                    const result = applyAllActions(baselineNodes, baselineEdges, actions, baselineAllocation, null);

                    // sysB was removed — there should be obligation tracking for it
                    expect(result.obligations.length).toBeGreaterThan(0);

                    // Each obligation should reference the removed system
                    result.obligations.forEach(obl => {
                        expect(obl.fromSystem).toBeTruthy();
                        expect(obl.fromSystem.id).toBeTruthy();
                    });
                }
            ),
            { numRuns: 50 }
        );
    });

    it('Property: Deferral obligation combinedAnnualCost is sum of parallel system costs', () => {
        fc.assert(
            fc.property(
                arbFunction,
                fc.array(
                    fc.tuple(arbSystem, fc.integer({ min: 50000, max: 350000 }))
                        .map(([s, cost]) => ({ ...s, annualCost: cost })),
                    { minLength: 1, maxLength: 4 }
                ),
                fc.constantFrom('Successor-A'),
                (fn, systems, successorName) => {
                    const uniqueSystems = systems.filter((s, i, arr) =>
                        arr.findIndex(x => x.id === s.id) === i
                    );
                    if (uniqueSystems.length === 0) return;

                    const { baselineAllocation } = buildSingleCellBaseline(uniqueSystems, fn, successorName);

                    const deferDecision = {
                        id: `dec-defer-cost`,
                        functionId: fn.lgaFunctionId,
                        successorName,
                        timestamp: new Date().toISOString(),
                        systemChoice: 'defer',
                        retainedSystemIds: [],
                        procuredSystem: null,
                        boundaryChoice: 'none',
                        disaggregationSplits: [],
                        contractExtensions: []
                    };

                    const obligations = generateDeferralObligations(deferDecision, baselineAllocation, null);

                    if (obligations.length === 0) return;

                    const obl = obligations[0];
                    // combinedAnnualCost must equal the sum of all parallelSystems costs
                    const parallelSum = (obl.parallelSystems || []).reduce((sum, s) => sum + (s.annualCost || 0), 0);
                    expect(obl.combinedAnnualCost).toBe(parallelSum);
                }
            ),
            { numRuns: 50 }
        );
    });

    it('Property: computeObligationSeverity returns valid severity for deferral-cost obligations', () => {
        fc.assert(
            fc.property(
                arbFunction,
                arbSystem,
                arbSystem,
                arbWeights,
                fc.constantFrom('Successor-A'),
                (fn, sysA, sysB, weights, successorName) => {
                    if (sysA.id === sysB.id) return;

                    const { baselineAllocation } = buildSingleCellBaseline([sysA, sysB], fn, successorName);

                    const deferDecision = {
                        id: `dec-defer-severity`,
                        functionId: fn.lgaFunctionId,
                        successorName,
                        timestamp: new Date().toISOString(),
                        systemChoice: 'defer',
                        retainedSystemIds: [],
                        procuredSystem: null,
                        boundaryChoice: 'none',
                        disaggregationSplits: [],
                        contractExtensions: []
                    };

                    const obligations = generateDeferralObligations(deferDecision, baselineAllocation, null);
                    if (obligations.length === 0) return;

                    const severity = computeObligationSeverity(obligations[0], weights);
                    expect(['high', 'medium', 'low']).toContain(severity);
                }
            ),
            { numRuns: 50 }
        );
    });

    it('Property: generateMigrationScopeBullets produces non-empty array for deferral-cost obligations', () => {
        fc.assert(
            fc.property(
                arbFunction,
                arbSystem,
                arbSystem,
                fc.constantFrom('Successor-A'),
                (fn, sysA, sysB, successorName) => {
                    if (sysA.id === sysB.id) return;

                    const { baselineAllocation } = buildSingleCellBaseline([sysA, sysB], fn, successorName);

                    const deferDecision = {
                        id: `dec-defer-bullets`,
                        functionId: fn.lgaFunctionId,
                        successorName,
                        timestamp: new Date().toISOString(),
                        systemChoice: 'defer',
                        retainedSystemIds: [],
                        procuredSystem: null,
                        boundaryChoice: 'none',
                        disaggregationSplits: [],
                        contractExtensions: []
                    };

                    const obligations = generateDeferralObligations(deferDecision, baselineAllocation, null);
                    if (obligations.length === 0) return;

                    const bullets = generateMigrationScopeBullets(obligations[0]);
                    expect(Array.isArray(bullets)).toBe(true);
                    expect(bullets.length).toBeGreaterThan(0);

                    // Must include the deferral conclusion bullet
                    const hasResolutionBullet = bullets.some(b =>
                        b.toLowerCase().includes('deferral') || b.toLowerCase().includes('consolidation')
                    );
                    expect(hasResolutionBullet).toBe(true);
                }
            ),
            { numRuns: 50 }
        );
    });

    it('Property: ERP partial removal — system retained for fn2 survives choose decision for fn1', () => {
        fc.assert(
            fc.property(
                arbFunction.filter(f => f.lgaFunctionId === '1'),
                arbFunction.filter(f => f.lgaFunctionId === '2'),
                arbSystem,
                arbErpSystem,
                fc.constantFrom('Successor-A'),
                (fn1, fn2, sysA, sysERP, successorName) => {
                    if (sysA.id === sysERP.id) return;
                    if (fn1.id === fn2.id) return;

                    // sysERP serves both fn1 and fn2
                    // sysA serves fn1 only
                    const nodes = [sysA, sysERP, fn1, fn2];
                    const edges = [
                        { source: sysA.id, target: fn1.id, relationship: 'REALIZES' },
                        { source: sysERP.id, target: fn1.id, relationship: 'REALIZES' },
                        { source: sysERP.id, target: fn2.id, relationship: 'REALIZES' }
                    ];

                    const funcMap = new Map();
                    funcMap.set(fn1.lgaFunctionId, [
                        { system: sysA, sourceCouncil: sysA._sourceCouncil, allocationType: 'full', needsAllocationReview: false, isDisaggregation: false },
                        { system: sysERP, sourceCouncil: sysERP._sourceCouncil, allocationType: 'full', needsAllocationReview: false, isDisaggregation: false }
                    ]);
                    funcMap.set(fn2.lgaFunctionId, [
                        { system: sysERP, sourceCouncil: sysERP._sourceCouncil, allocationType: 'full', needsAllocationReview: false, isDisaggregation: false }
                    ]);
                    const baselineAllocation = new Map([[successorName, funcMap]]);

                    // Decisions: choose sysA for fn1 (removing sysERP from fn1)
                    // AND choose sysERP for fn2 (retaining it for fn2)
                    const decisions = new Map();

                    decisions.set(getDecisionKey(fn1.lgaFunctionId, successorName), {
                        id: `dec-fn1`,
                        functionId: fn1.lgaFunctionId,
                        successorName,
                        timestamp: new Date().toISOString(),
                        systemChoice: 'choose',
                        retainedSystemIds: [sysA.id],
                        procuredSystem: null,
                        boundaryChoice: 'none',
                        disaggregationSplits: [],
                        contractExtensions: []
                    });

                    decisions.set(getDecisionKey(fn2.lgaFunctionId, successorName), {
                        id: `dec-fn2`,
                        functionId: fn2.lgaFunctionId,
                        successorName,
                        timestamp: new Date().toISOString(),
                        systemChoice: 'choose',
                        retainedSystemIds: [sysERP.id],
                        procuredSystem: null,
                        boundaryChoice: 'none',
                        disaggregationSplits: [],
                        contractExtensions: []
                    });

                    const { actions } = projectDecisions(decisions, nodes, edges, baselineAllocation, null);
                    const result = applyAllActions(nodes, edges, actions);

                    // sysERP must survive — it's retained for fn2
                    expect(result.nodes.some(n => n.id === sysERP.id)).toBe(true);

                    // sysERP's REALIZES edge to fn2 must be preserved
                    const erpFn2Edge = result.edges.find(
                        e => e.source === sysERP.id && e.target === fn2.id && e.relationship === 'REALIZES'
                    );
                    expect(erpFn2Edge).toBeTruthy();
                }
            ),
            { numRuns: 50 }
        );
    });

});
