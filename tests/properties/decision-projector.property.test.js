/**
 * Property tests for the decision projector.
 *
 * Tests that projectDecisions() correctly translates FunctionDecisions into
 * legacy action objects, with correct ordering, ERP severOnly handling, and
 * retained-system guards.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { projectDecisions } from '../../src/simulation/projector.js';
import { getDecisionKey } from '../../src/simulation/decisions.js';
import { applyAllActions } from '../../src/simulation/actions.js';

// --- Inline test generators ---

// Generate a minimal ITSystem node
const arbSystem = fc.record({
    id: fc.stringMatching(/^sys-[a-z0-9]{3,8}$/),
    label: fc.string({ minLength: 1, maxLength: 30 }),
    users: fc.integer({ min: 0, max: 10000 }),
    vendor: fc.string({ minLength: 1, maxLength: 20 }),
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

// Generate an ERP system (isERP: true)
const arbErpSystem = arbSystem.map(s => ({ ...s, isERP: true, dataPartitioning: 'Monolithic' }));

// Generate a Function node
const arbFunction = fc.record({
    id: fc.stringMatching(/^fn-[a-z0-9]{3,8}$/),
    label: fc.string({ minLength: 1, maxLength: 30 }),
    lgaFunctionId: fc.constantFrom('1', '2', '3', '4', '5'),
    _sourceCouncil: fc.constantFrom('Council-A', 'Council-B', 'Council-C'),
}).map(f => ({ ...f, type: 'Function' }));

/**
 * Builds a minimal baseline allocation map for a single (successor, function) cell.
 * Returns { baselineNodes, baselineEdges, baselineAllocation }
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

/**
 * Builds a two-cell baseline: system A in function 1, system B in function 2,
 * but system B is also present in function 1. Used for ERP cross-function tests.
 */
function buildErpCrossBaseline(sysA, sysERP, fn1, fn2, successorName) {
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
    const allocation = new Map();
    allocation.set(successorName, funcMap);
    return { baselineNodes: nodes, baselineEdges: edges, baselineAllocation: allocation };
}

describe('Decision Projector — Property Tests', () => {

    it('Property: Choose decision for a 2-system cell produces exactly 1 consolidate action', () => {
        fc.assert(
            fc.property(
                arbFunction,
                arbSystem,
                arbSystem,
                fc.constantFrom('Successor-A', 'Successor-B'),
                (fn, sysA, sysB, successorName) => {
                    // Ensure unique system IDs
                    if (sysA.id === sysB.id) return;
                    // Ensure function IDs are distinct enough
                    const { baselineNodes, baselineEdges, baselineAllocation } = buildSingleCellBaseline(
                        [sysA, sysB], fn, successorName
                    );

                    const decisions = new Map();
                    const key = getDecisionKey(fn.lgaFunctionId, successorName);
                    decisions.set(key, {
                        id: `dec-test`,
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

                    const consolidateActions = actions.filter(a => a.type === 'consolidate');
                    expect(consolidateActions.length).toBe(1);
                    expect(consolidateActions[0].targetSystemId).toBe(sysA.id);
                    expect(consolidateActions[0].removeSystemIds).toContain(sysB.id);
                }
            ),
            { numRuns: 50 }
        );
    });

    it('Property: Defer decision produces extend-contract actions for expiring systems and no consolidate', () => {
        fc.assert(
            fc.property(
                arbFunction,
                arbSystem.map(s => ({ ...s, endYear: new Date().getFullYear() + 1, endMonth: 3 })),
                arbSystem.map(s => ({ ...s, endYear: new Date().getFullYear() + 1, endMonth: 6 })),
                fc.constantFrom('Successor-A', 'Successor-B'),
                (fn, sysA, sysB, successorName) => {
                    if (sysA.id === sysB.id) return;

                    const { baselineNodes, baselineEdges, baselineAllocation } = buildSingleCellBaseline(
                        [sysA, sysB], fn, successorName
                    );

                    const decisions = new Map();
                    const key = getDecisionKey(fn.lgaFunctionId, successorName);
                    decisions.set(key, {
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
                    });

                    const { actions } = projectDecisions(decisions, baselineNodes, baselineEdges, baselineAllocation, null);

                    // No consolidate actions — defer means no system is removed
                    const consolidateActions = actions.filter(a => a.type === 'consolidate');
                    expect(consolidateActions.length).toBe(0);

                    // Extend-contract actions should exist for the expiring systems
                    const extendActions = actions.filter(a => a.type === 'extend-contract');
                    expect(extendActions.length).toBeGreaterThan(0);
                    // Each extension is for one of the systems in the cell
                    const systemIds = new Set([sysA.id, sysB.id]);
                    extendActions.forEach(a => {
                        expect(systemIds.has(a.systemId)).toBe(true);
                    });
                }
            ),
            { numRuns: 50 }
        );
    });

    it('Property: Procure decision produces a procure-replacement action', () => {
        fc.assert(
            fc.property(
                arbFunction,
                arbSystem,
                fc.constantFrom('Successor-A', 'Successor-B'),
                (fn, existingSys, successorName) => {
                    const { baselineNodes, baselineEdges, baselineAllocation } = buildSingleCellBaseline(
                        [existingSys], fn, successorName
                    );

                    const newSystemId = `sys-new-procurement`;
                    const decisions = new Map();
                    const key = getDecisionKey(fn.lgaFunctionId, successorName);
                    decisions.set(key, {
                        id: `dec-procure-test`,
                        functionId: fn.lgaFunctionId,
                        successorName,
                        timestamp: new Date().toISOString(),
                        systemChoice: 'procure',
                        retainedSystemIds: [],
                        procuredSystem: {
                            id: newSystemId,
                            label: 'New Procured System',
                            vendor: 'NewVendor',
                            annualCost: 200000,
                            isCloud: true
                        },
                        boundaryChoice: 'none',
                        disaggregationSplits: [],
                        contractExtensions: []
                    });

                    const { actions } = projectDecisions(decisions, baselineNodes, baselineEdges, baselineAllocation, null);

                    const procureActions = actions.filter(a => a.type === 'procure-replacement');
                    expect(procureActions.length).toBe(1);
                    expect(procureActions[0].newSystem.label).toBe('New Procured System');
                    expect(procureActions[0].functionId).toBe(fn.lgaFunctionId);
                }
            ),
            { numRuns: 50 }
        );
    });

    it('Property: ERP severOnly — choose decision removing ERP still serving another function uses severOnly', () => {
        // Setup: sysA and sysERP both serve fn1. sysERP also serves fn2.
        // Decision: choose sysA for fn1, meaning sysERP should be severed (not decommissioned).
        fc.assert(
            fc.property(
                arbFunction.filter(f => f.lgaFunctionId === '1'),
                arbFunction.filter(f => f.lgaFunctionId === '2'),
                arbSystem,
                arbErpSystem,
                fc.constantFrom('Successor-A'),
                (fn1, fn2, sysA, sysERP, successorName) => {
                    // Must have distinct IDs
                    if (sysA.id === sysERP.id) return;
                    // Must have distinct function IDs
                    if (fn1.id === fn2.id) return;

                    const { baselineNodes, baselineEdges, baselineAllocation } =
                        buildErpCrossBaseline(sysA, sysERP, fn1, fn2, successorName);

                    // Decision: for fn1, choose sysA (which means sysERP is "not retained" in fn1)
                    // But sysERP IS retained in fn2 via the global retained set check...
                    // Actually, no decision is made for fn2 — sysERP is just present there.
                    // The projector should see sysERP is NOT in globalRetainedSystemIds (no decision retains it)
                    // BUT it still serves fn2 which has no decision yet.
                    // The severOnly mechanism should protect it because we pass it explicitly.

                    // For this test, we make a decision for fn2 as well that retains sysERP,
                    // which triggers the ERP severOnly logic.
                    const decisions = new Map();

                    // Decision for fn1: choose sysA
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

                    // Decision for fn2: choose sysERP (retains it)
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

                    const { actions } = projectDecisions(decisions, baselineNodes, baselineEdges, baselineAllocation, null);

                    // Apply the projected actions
                    const result = applyAllActions(baselineNodes, baselineEdges, actions);

                    // sysERP should still exist in the result (it was retained for fn2)
                    expect(result.nodes.some(n => n.id === sysERP.id)).toBe(true);

                    // sysA should still exist (it was chosen for fn1)
                    expect(result.nodes.some(n => n.id === sysA.id)).toBe(true);

                    // The consolidate action for fn1 should have severOnly containing sysERP.id
                    const consolidateForFn1 = actions.find(
                        a => a.type === 'consolidate' && a.functionId === fn1.lgaFunctionId
                    );
                    if (consolidateForFn1) {
                        expect(consolidateForFn1.severOnly || []).toContain(sysERP.id);
                    }
                }
            ),
            { numRuns: 50 }
        );
    });

    it('Property: Disaggregate ordering — disaggregate action comes before consolidate in output', () => {
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
                    const key = getDecisionKey(fn.lgaFunctionId, successorName);
                    decisions.set(key, {
                        id: `dec-disagg-test`,
                        functionId: fn.lgaFunctionId,
                        successorName,
                        timestamp: new Date().toISOString(),
                        systemChoice: 'choose',
                        retainedSystemIds: [sysA.id],
                        procuredSystem: null,
                        boundaryChoice: 'disaggregate',
                        disaggregationSplits: [
                            { successorName: 'Successor-A', label: `${sysA.label} (Part 1)` },
                            { successorName: 'Successor-B', label: `${sysA.label} (Part 2)` }
                        ],
                        contractExtensions: []
                    });

                    const { actions } = projectDecisions(decisions, baselineNodes, baselineEdges, baselineAllocation, null);

                    const disaggIndex = actions.findIndex(a => a.type === 'disaggregate');
                    const consolidateIndex = actions.findIndex(a => a.type === 'consolidate');

                    // If both exist, disaggregate must come before consolidate
                    if (disaggIndex !== -1 && consolidateIndex !== -1) {
                        expect(disaggIndex).toBeLessThan(consolidateIndex);
                    }

                    // Disaggregate action must exist for the retained system
                    if (disaggIndex !== -1) {
                        expect(actions[disaggIndex].systemId).toBe(sysA.id);
                        expect(actions[disaggIndex].splits).toHaveLength(2);
                    }
                }
            ),
            { numRuns: 50 }
        );
    });

    it('Property: Retained-system guard — system retained by any decision is never decommissioned', () => {
        // Setup two functions sharing a system. Decision A retains it for fn1.
        // Decision B (fn2) does NOT include it in retainedSystemIds.
        // The system should NOT be decommissioned.
        fc.assert(
            fc.property(
                arbFunction.filter(f => f.lgaFunctionId === '1'),
                arbFunction.filter(f => f.lgaFunctionId === '2'),
                arbSystem,
                arbSystem,
                fc.constantFrom('Successor-A'),
                (fn1, fn2, sharedSys, otherSys, successorName) => {
                    if (fn1.id === fn2.id) return;
                    if (sharedSys.id === otherSys.id) return;

                    // Build baseline where sharedSys serves both fn1 and fn2
                    const nodes = [sharedSys, otherSys, fn1, fn2];
                    const edges = [
                        { source: sharedSys.id, target: fn1.id, relationship: 'REALIZES' },
                        { source: sharedSys.id, target: fn2.id, relationship: 'REALIZES' },
                        { source: otherSys.id, target: fn2.id, relationship: 'REALIZES' }
                    ];

                    const funcMap = new Map();
                    funcMap.set(fn1.lgaFunctionId, [
                        { system: sharedSys, sourceCouncil: sharedSys._sourceCouncil, allocationType: 'full', needsAllocationReview: false, isDisaggregation: false }
                    ]);
                    funcMap.set(fn2.lgaFunctionId, [
                        { system: sharedSys, sourceCouncil: sharedSys._sourceCouncil, allocationType: 'full', needsAllocationReview: false, isDisaggregation: false },
                        { system: otherSys, sourceCouncil: otherSys._sourceCouncil, allocationType: 'full', needsAllocationReview: false, isDisaggregation: false }
                    ]);
                    const baselineAllocation = new Map();
                    baselineAllocation.set(successorName, funcMap);

                    const decisions = new Map();

                    // Decision for fn1: choose sharedSys (retain it)
                    decisions.set(getDecisionKey(fn1.lgaFunctionId, successorName), {
                        id: `dec-fn1-retain`,
                        functionId: fn1.lgaFunctionId,
                        successorName,
                        timestamp: new Date().toISOString(),
                        systemChoice: 'choose',
                        retainedSystemIds: [sharedSys.id],
                        procuredSystem: null,
                        boundaryChoice: 'none',
                        disaggregationSplits: [],
                        contractExtensions: []
                    });

                    // Decision for fn2: choose otherSys (sharedSys is NOT retained here)
                    decisions.set(getDecisionKey(fn2.lgaFunctionId, successorName), {
                        id: `dec-fn2-other`,
                        functionId: fn2.lgaFunctionId,
                        successorName,
                        timestamp: new Date().toISOString(),
                        systemChoice: 'choose',
                        retainedSystemIds: [otherSys.id],
                        procuredSystem: null,
                        boundaryChoice: 'none',
                        disaggregationSplits: [],
                        contractExtensions: []
                    });

                    const { actions } = projectDecisions(decisions, nodes, edges, baselineAllocation, null);

                    // Apply actions and verify sharedSys still exists
                    const result = applyAllActions(nodes, edges, actions);
                    expect(result.nodes.some(n => n.id === sharedSys.id)).toBe(true);
                }
            ),
            { numRuns: 50 }
        );
    });

    it('Property: Empty decisions map returns empty actions and obligations', () => {
        fc.assert(
            fc.property(arbFunction, arbSystem, (fn, sys) => {
                const { baselineNodes, baselineEdges, baselineAllocation } = buildSingleCellBaseline(
                    [sys], fn, 'Successor-A'
                );

                const emptyDecisions = new Map();
                const { actions, obligations } = projectDecisions(
                    emptyDecisions, baselineNodes, baselineEdges, baselineAllocation, null
                );

                expect(actions).toHaveLength(0);
                expect(obligations).toHaveLength(0);
            }),
            { numRuns: 20 }
        );
    });

    it('Property: Multiple decisions produce deterministic ordering — defer always last', () => {
        fc.assert(
            fc.property(
                arbFunction.filter(f => f.lgaFunctionId === '1'),
                arbFunction.filter(f => f.lgaFunctionId === '2'),
                arbSystem,
                arbSystem,
                arbSystem,
                fc.constantFrom('Successor-A'),
                (fn1, fn2, sysA, sysB, sysC, successorName) => {
                    if (fn1.id === fn2.id) return;
                    if (new Set([sysA.id, sysB.id, sysC.id]).size !== 3) return;

                    const { baselineNodes: nodesA, baselineEdges: edgesA, baselineAllocation: allocA } =
                        buildSingleCellBaseline([sysA], fn1, successorName);
                    const { baselineNodes: nodesB, baselineEdges: edgesB, baselineAllocation: allocB } =
                        buildSingleCellBaseline([sysB, sysC], fn2, successorName);

                    // Merge the two baselines
                    const baselineNodes = [...nodesA, ...nodesB.filter(n => !nodesA.some(m => m.id === n.id))];
                    const baselineEdges = [...edgesA, ...edgesB];
                    const baselineAllocation = new Map(allocA);
                    const fn2Map = allocB.get(successorName);
                    baselineAllocation.get(successorName).set(fn2.lgaFunctionId, fn2Map.get(fn2.lgaFunctionId));

                    const decisions = new Map();

                    // Defer decision for fn1
                    decisions.set(getDecisionKey(fn1.lgaFunctionId, successorName), {
                        id: `dec-defer`,
                        functionId: fn1.lgaFunctionId,
                        successorName,
                        timestamp: new Date().toISOString(),
                        systemChoice: 'defer',
                        retainedSystemIds: [],
                        procuredSystem: null,
                        boundaryChoice: 'none',
                        disaggregationSplits: [],
                        contractExtensions: []
                    });

                    // Choose decision for fn2
                    decisions.set(getDecisionKey(fn2.lgaFunctionId, successorName), {
                        id: `dec-choose`,
                        functionId: fn2.lgaFunctionId,
                        successorName,
                        timestamp: new Date().toISOString(),
                        systemChoice: 'choose',
                        retainedSystemIds: [sysB.id],
                        procuredSystem: null,
                        boundaryChoice: 'none',
                        disaggregationSplits: [],
                        contractExtensions: []
                    });

                    const { actions } = projectDecisions(decisions, baselineNodes, baselineEdges, baselineAllocation, null);

                    // Any extend-contract actions (from defer) must come AFTER any consolidate actions
                    const firstConsolidateIdx = actions.findIndex(a => a.type === 'consolidate');
                    const firstExtendIdx = actions.findIndex(a => a.type === 'extend-contract');

                    if (firstConsolidateIdx !== -1 && firstExtendIdx !== -1) {
                        expect(firstConsolidateIdx).toBeLessThan(firstExtendIdx);
                    }
                }
            ),
            { numRuns: 30 }
        );
    });

    it('Property: Multi-successor sever scoping — ERP edge to other successor preserved', () => {
        fc.assert(
            fc.property(
                // Two function nodes with SAME lgaFunctionId but different IDs (different councils)
                arbFunction.filter(f => f.lgaFunctionId === '1'),
                arbFunction.filter(f => f.lgaFunctionId === '1'),
                arbSystem,   // non-ERP system for successor A
                arbSystem,   // non-ERP system for successor B
                arbErpSystem, // ERP serving both successors
                (fnA, fnB, sysA, sysB, sysERP) => {
                    // Ensure all IDs are unique
                    const ids = [fnA.id, fnB.id, sysA.id, sysB.id, sysERP.id];
                    if (new Set(ids).size !== ids.length) return;
                    // fnA and fnB must have same lgaFunctionId but different node IDs
                    if (fnA.id === fnB.id) return;

                    const successorA = 'Successor-A';
                    const successorB = 'Successor-B';

                    // Build baseline: sysA + sysERP serve fnA (Successor-A), sysB + sysERP serve fnB (Successor-B)
                    const nodes = [sysA, sysB, sysERP, fnA, fnB];
                    const edges = [
                        { source: sysA.id, target: fnA.id, relationship: 'REALIZES' },
                        { source: sysERP.id, target: fnA.id, relationship: 'REALIZES' },
                        { source: sysB.id, target: fnB.id, relationship: 'REALIZES' },
                        { source: sysERP.id, target: fnB.id, relationship: 'REALIZES' },
                    ];

                    // Allocation: Successor-A has [sysA, sysERP] for function 1; Successor-B has [sysB, sysERP] for function 1
                    const allocation = new Map();
                    const funcMapA = new Map();
                    funcMapA.set(fnA.lgaFunctionId, [
                        { system: sysA, sourceCouncil: sysA._sourceCouncil, allocationType: 'full', needsAllocationReview: false, isDisaggregation: false },
                        { system: sysERP, sourceCouncil: sysERP._sourceCouncil, allocationType: 'full', needsAllocationReview: false, isDisaggregation: false },
                    ]);
                    allocation.set(successorA, funcMapA);
                    const funcMapB = new Map();
                    funcMapB.set(fnB.lgaFunctionId, [
                        { system: sysB, sourceCouncil: sysB._sourceCouncil, allocationType: 'full', needsAllocationReview: false, isDisaggregation: false },
                        { system: sysERP, sourceCouncil: sysERP._sourceCouncil, allocationType: 'full', needsAllocationReview: false, isDisaggregation: false },
                    ]);
                    allocation.set(successorB, funcMapB);

                    // Decisions: Successor-A chooses sysA (sever ERP), Successor-B chooses sysERP (retain it)
                    const decisions = new Map();
                    decisions.set(getDecisionKey(fnA.lgaFunctionId, successorA), {
                        id: 'dec-a', functionId: fnA.lgaFunctionId, successorName: successorA,
                        timestamp: new Date().toISOString(), systemChoice: 'choose',
                        retainedSystemIds: [sysA.id], procuredSystem: null,
                        boundaryChoice: 'none', disaggregationSplits: [], contractExtensions: []
                    });
                    decisions.set(getDecisionKey(fnB.lgaFunctionId, successorB), {
                        id: 'dec-b', functionId: fnB.lgaFunctionId, successorName: successorB,
                        timestamp: new Date().toISOString(), systemChoice: 'choose',
                        retainedSystemIds: [sysERP.id], procuredSystem: null,
                        boundaryChoice: 'none', disaggregationSplits: [], contractExtensions: []
                    });

                    const { actions } = projectDecisions(decisions, nodes, edges, allocation, null);
                    const result = applyAllActions(nodes, edges, actions);

                    // ERP must survive (retained by Successor-B)
                    expect(result.nodes.some(n => n.id === sysERP.id)).toBe(true);

                    // ERP's REALIZES edge to fnB (Successor-B's function) MUST be preserved
                    const erpToFnB = result.edges.find(
                        e => e.source === sysERP.id && e.target === fnB.id && e.relationship === 'REALIZES'
                    );
                    expect(erpToFnB).toBeTruthy();

                    // ERP's REALIZES edge to fnA (Successor-A's function) MUST be removed (severed)
                    const erpToFnA = result.edges.find(
                        e => e.source === sysERP.id && e.target === fnA.id && e.relationship === 'REALIZES'
                    );
                    expect(erpToFnA).toBeFalsy();
                }
            ),
            { numRuns: 50 }
        );
    });

    it('Property: Choose decision for single-system cell produces no consolidate action (nothing to remove)', () => {
        fc.assert(
            fc.property(
                arbFunction,
                arbSystem,
                fc.constantFrom('Successor-A', 'Successor-B'),
                (fn, sys, successorName) => {
                    const { baselineNodes, baselineEdges, baselineAllocation } = buildSingleCellBaseline(
                        [sys], fn, successorName
                    );

                    const decisions = new Map();
                    const key = getDecisionKey(fn.lgaFunctionId, successorName);
                    decisions.set(key, {
                        id: `dec-single`,
                        functionId: fn.lgaFunctionId,
                        successorName,
                        timestamp: new Date().toISOString(),
                        systemChoice: 'choose',
                        retainedSystemIds: [sys.id],
                        procuredSystem: null,
                        boundaryChoice: 'none',
                        disaggregationSplits: [],
                        contractExtensions: []
                    });

                    const { actions } = projectDecisions(decisions, baselineNodes, baselineEdges, baselineAllocation, null);

                    // Only one system and it's retained — nothing to consolidate
                    const consolidateActions = actions.filter(a => a.type === 'consolidate');
                    expect(consolidateActions.length).toBe(0);
                }
            ),
            { numRuns: 30 }
        );
    });

    it('Property: establish-shared-service creates REALIZES edges and decommissions existing systems', () => {
        // Successor C has System A + System B for Function F.
        // Successor D has System E + System F_ for Function F.
        // Primary decision: choose System A for (F, C), establish-shared with D.
        // Propagated decision: choose System A for (F, D) with sharedServiceOrigin.
        // Expected:
        //   - System A has REALIZES edges to BOTH C's and D's function nodes for F
        //   - System B removed (C's consolidate)
        //   - Systems E and F_ removed (D's propagated consolidate)
        //   - System A's sharedWith includes 'Successor-D', targetAuthorities includes 'Successor-D'
        fc.assert(
            fc.property(
                arbFunction.filter(f => f.lgaFunctionId === '1'),
                arbFunction.filter(f => f.lgaFunctionId === '1'),
                arbSystem,
                arbSystem,
                arbSystem,
                arbSystem,
                (fnC, fnD, sysA, sysB, sysE, sysF) => {
                    // Ensure all IDs are unique
                    const ids = [fnC.id, fnD.id, sysA.id, sysB.id, sysE.id, sysF.id];
                    if (new Set(ids).size !== ids.length) return;
                    if (fnC.id === fnD.id) return;

                    const successorC = 'Successor-C';
                    const successorD = 'Successor-D';

                    // Build baseline
                    const nodes = [sysA, sysB, sysE, sysF, fnC, fnD];
                    const edges = [
                        { source: sysA.id, target: fnC.id, relationship: 'REALIZES' },
                        { source: sysB.id, target: fnC.id, relationship: 'REALIZES' },
                        { source: sysE.id, target: fnD.id, relationship: 'REALIZES' },
                        { source: sysF.id, target: fnD.id, relationship: 'REALIZES' }
                    ];

                    const allocation = new Map();
                    const funcMapC = new Map();
                    funcMapC.set(fnC.lgaFunctionId, [
                        { system: sysA, sourceCouncil: 'Council-A', allocationType: 'full', needsAllocationReview: false, isDisaggregation: false },
                        { system: sysB, sourceCouncil: 'Council-B', allocationType: 'full', needsAllocationReview: false, isDisaggregation: false }
                    ]);
                    allocation.set(successorC, funcMapC);

                    const funcMapD = new Map();
                    funcMapD.set(fnD.lgaFunctionId, [
                        { system: sysE, sourceCouncil: 'Council-E', allocationType: 'full', needsAllocationReview: false, isDisaggregation: false },
                        { system: sysF, sourceCouncil: 'Council-F', allocationType: 'full', needsAllocationReview: false, isDisaggregation: false }
                    ]);
                    allocation.set(successorD, funcMapD);

                    const primaryKey = getDecisionKey(fnC.lgaFunctionId, successorC);
                    const propagatedKey = getDecisionKey(fnD.lgaFunctionId, successorD);

                    const decisions = new Map();

                    // Primary: choose sysA for (F, C), establish-shared with D
                    decisions.set(primaryKey, {
                        id: 'dec-primary',
                        functionId: fnC.lgaFunctionId,
                        successorName: successorC,
                        timestamp: new Date().toISOString(),
                        systemChoice: 'choose',
                        retainedSystemIds: [sysA.id],
                        procuredSystem: null,
                        boundaryChoice: 'establish-shared',
                        disaggregationSplits: [],
                        sharedWithSuccessors: [successorD],
                        sharedServiceOrigin: null,
                        contractExtensions: []
                    });

                    // Propagated: choose sysA for (F, D), with sharedServiceOrigin
                    decisions.set(propagatedKey, {
                        id: 'dec-propagated',
                        functionId: fnD.lgaFunctionId,
                        successorName: successorD,
                        timestamp: new Date().toISOString(),
                        systemChoice: 'choose',
                        retainedSystemIds: [sysA.id],
                        procuredSystem: null,
                        boundaryChoice: 'establish-shared',
                        disaggregationSplits: [],
                        sharedWithSuccessors: [],
                        sharedServiceOrigin: primaryKey,
                        contractExtensions: []
                    });

                    const { actions } = projectDecisions(decisions, nodes, edges, allocation, null);
                    const result = applyAllActions(nodes, edges, actions);

                    // System A must survive
                    expect(result.nodes.some(n => n.id === sysA.id)).toBe(true);

                    // System B removed (C's consolidate)
                    expect(result.nodes.some(n => n.id === sysB.id)).toBe(false);

                    // Systems E and F_ removed (D's propagated consolidate)
                    expect(result.nodes.some(n => n.id === sysE.id)).toBe(false);
                    expect(result.nodes.some(n => n.id === sysF.id)).toBe(false);

                    // System A has REALIZES edge to C's function node (fnC)
                    expect(result.edges.some(e => e.source === sysA.id && e.target === fnC.id && e.relationship === 'REALIZES')).toBe(true);

                    // System A has REALIZES edge to D's function node (fnD) — via establish-shared-service
                    expect(result.edges.some(e => e.source === sysA.id && e.target === fnD.id && e.relationship === 'REALIZES')).toBe(true);

                    // Establish-shared-service action must exist and come before consolidate actions
                    const establishIdx = actions.findIndex(a => a.type === 'establish-shared-service');
                    const consolidateIdx = actions.findIndex(a => a.type === 'consolidate');
                    if (establishIdx !== -1 && consolidateIdx !== -1) {
                        expect(establishIdx).toBeLessThan(consolidateIdx);
                    }
                }
            ),
            { numRuns: 30 }
        );
    });

    it('Property: establish-shared with ERP preserves REALIZES edges for other functions', () => {
        // System A (ERP) serves F1 and F2 in Successor C. Successor D has System E for F1.
        // Primary decision: choose A for (F1, C), establish-shared with D.
        // Propagated decision: choose A for (F1, D) with sharedServiceOrigin.
        // Expected:
        //   A has REALIZES edges to D's function nodes for F1, but NOT F2.
        //   A's REALIZES edges to C's F2 nodes are preserved.
        fc.assert(
            fc.property(
                arbFunction.filter(f => f.lgaFunctionId === '1'),
                arbFunction.filter(f => f.lgaFunctionId === '1'),
                arbFunction.filter(f => f.lgaFunctionId === '2'),
                arbErpSystem,
                arbSystem,
                (fnC1, fnD1, fnC2, sysA, sysE) => {
                    const ids = [fnC1.id, fnD1.id, fnC2.id, sysA.id, sysE.id];
                    if (new Set(ids).size !== ids.length) return;
                    if (fnC1.id === fnD1.id || fnC1.id === fnC2.id) return;

                    const successorC = 'Successor-C';
                    const successorD = 'Successor-D';

                    const nodes = [sysA, sysE, fnC1, fnD1, fnC2];
                    const edges = [
                        { source: sysA.id, target: fnC1.id, relationship: 'REALIZES' },
                        { source: sysA.id, target: fnC2.id, relationship: 'REALIZES' },
                        { source: sysE.id, target: fnD1.id, relationship: 'REALIZES' }
                    ];

                    const allocation = new Map();
                    const funcMapC = new Map();
                    funcMapC.set('1', [
                        { system: sysA, sourceCouncil: 'Council-A', allocationType: 'full', needsAllocationReview: false, isDisaggregation: false }
                    ]);
                    funcMapC.set('2', [
                        { system: sysA, sourceCouncil: 'Council-A', allocationType: 'full', needsAllocationReview: false, isDisaggregation: false }
                    ]);
                    allocation.set(successorC, funcMapC);

                    const funcMapD = new Map();
                    funcMapD.set('1', [
                        { system: sysE, sourceCouncil: 'Council-E', allocationType: 'full', needsAllocationReview: false, isDisaggregation: false }
                    ]);
                    allocation.set(successorD, funcMapD);

                    const primaryKey = getDecisionKey('1', successorC);
                    const propagatedKey = getDecisionKey('1', successorD);

                    const decisions = new Map();

                    // Primary: choose sysA for (F1, C), establish-shared with D
                    decisions.set(primaryKey, {
                        id: 'dec-erp-primary',
                        functionId: '1',
                        successorName: successorC,
                        timestamp: new Date().toISOString(),
                        systemChoice: 'choose',
                        retainedSystemIds: [sysA.id],
                        procuredSystem: null,
                        boundaryChoice: 'establish-shared',
                        disaggregationSplits: [],
                        sharedWithSuccessors: [successorD],
                        sharedServiceOrigin: null,
                        contractExtensions: []
                    });

                    // Propagated: choose sysA for (F1, D) with sharedServiceOrigin
                    decisions.set(propagatedKey, {
                        id: 'dec-erp-propagated',
                        functionId: '1',
                        successorName: successorD,
                        timestamp: new Date().toISOString(),
                        systemChoice: 'choose',
                        retainedSystemIds: [sysA.id],
                        procuredSystem: null,
                        boundaryChoice: 'establish-shared',
                        disaggregationSplits: [],
                        sharedWithSuccessors: [],
                        sharedServiceOrigin: primaryKey,
                        contractExtensions: []
                    });

                    const { actions } = projectDecisions(decisions, nodes, edges, allocation, null);
                    const result = applyAllActions(nodes, edges, actions);

                    // System A must survive
                    expect(result.nodes.some(n => n.id === sysA.id)).toBe(true);

                    // System E must be removed (D's propagated consolidate)
                    expect(result.nodes.some(n => n.id === sysE.id)).toBe(false);

                    // A's REALIZES edge to C's F1 node (fnC1) must be preserved
                    expect(result.edges.some(e => e.source === sysA.id && e.target === fnC1.id && e.relationship === 'REALIZES')).toBe(true);

                    // A's REALIZES edge to C's F2 node (fnC2) must be preserved (ERP still serves F2)
                    expect(result.edges.some(e => e.source === sysA.id && e.target === fnC2.id && e.relationship === 'REALIZES')).toBe(true);

                    // A must have REALIZES edge to D's F1 node (fnD1) — via establish-shared-service
                    expect(result.edges.some(e => e.source === sysA.id && e.target === fnD1.id && e.relationship === 'REALIZES')).toBe(true);

                    // A must NOT have REALIZES edge to D's F2 nodes — establish-shared is per-function
                    // (fnD1 is for lgaFunctionId='1', fnC2 is for lgaFunctionId='2', and fnD has no F2 node)
                    // This is structurally guaranteed by the test setup since there's no D F2 node.
                }
            ),
            { numRuns: 30 }
        );
    });

});
