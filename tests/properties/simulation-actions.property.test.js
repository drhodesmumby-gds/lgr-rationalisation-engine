import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
    applyAllActions,
    applyAction,
    applyConsolidate,
    applyDecommission,
    applyExtendContract,
    applyMigrateUsers,
    applySplitSharedService,
    applyProcureReplacement
} from '../../src/simulation/actions.js';

// --- Inline generators ---

// Generate a minimal ITSystem node
const arbSystem = fc.record({
    id: fc.stringMatching(/^sys-[a-z0-9]{3,8}$/),
    label: fc.string({ minLength: 1, maxLength: 30 }),
    users: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: undefined }),
    vendor: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
    annualCost: fc.option(fc.integer({ min: 1000, max: 500000 }), { nil: undefined }),
    endYear: fc.option(fc.integer({ min: 2025, max: 2035 }), { nil: undefined }),
    endMonth: fc.option(fc.integer({ min: 1, max: 12 }), { nil: undefined }),
    noticePeriod: fc.option(fc.integer({ min: 0, max: 24 }), { nil: undefined }),
    isCloud: fc.boolean(),
    _sourceCouncil: fc.constantFrom('Council-A', 'Council-B', 'Council-C'),
}).map(fields => {
    const sys = { ...fields, type: 'ITSystem' };
    // Strip undefined values
    for (const key of Object.keys(sys)) {
        if (sys[key] === undefined) delete sys[key];
    }
    return sys;
});

// Generate a Function node
const arbFunction = fc.record({
    id: fc.stringMatching(/^fn-[a-z0-9]{3,8}$/),
    label: fc.string({ minLength: 1, maxLength: 30 }),
    lgaFunctionId: fc.constantFrom('1', '2', '3', '4', '5'),
    _sourceCouncil: fc.constantFrom('Council-A', 'Council-B', 'Council-C'),
}).map(f => ({ ...f, type: 'Function' }));

// Generate a small estate with systems and REALIZES edges
// Returns { nodes, edges } with at least one system and one function connected
const arbEstate = fc.tuple(
    fc.array(arbSystem, { minLength: 1, maxLength: 5 }),
    fc.array(arbFunction, { minLength: 1, maxLength: 3 })
).filter(([systems, functions]) => {
    // Ensure unique IDs across systems
    const sysIds = systems.map(s => s.id);
    const fnIds = functions.map(f => f.id);
    return new Set(sysIds).size === sysIds.length && new Set(fnIds).size === fnIds.length;
}).map(([systems, functions]) => {
    // Create REALIZES edges: connect at least the first system to all functions
    const edges = [];
    systems.forEach((sys, i) => {
        functions.forEach(fn => {
            // Connect every system to every function for simple test estates
            edges.push({ source: sys.id, target: fn.id, relationship: 'REALIZES' });
        });
    });
    return { nodes: [...systems, ...functions], edges };
});

describe('Simulation Action Engine — Property Tests', () => {

    it('Property: Identity — empty action list returns deep-equal structure', () => {
        fc.assert(
            fc.property(arbEstate, ({ nodes, edges }) => {
                const result = applyAllActions(nodes, edges, []);

                // Deep-equal values
                expect(result.nodes).toEqual(nodes);
                expect(result.edges).toEqual(edges);
                expect(result.warnings).toEqual([]);
                expect(result.appliedCount).toBe(0);

                // Not reference-equal (deep copy)
                expect(result.nodes).not.toBe(nodes);
                expect(result.edges).not.toBe(edges);
            })
        );
    });

    it('Property: Purity — original arrays never mutated by any action', () => {
        fc.assert(
            fc.property(arbEstate, ({ nodes, edges }) => {
                const originalNodes = JSON.parse(JSON.stringify(nodes));
                const originalEdges = JSON.parse(JSON.stringify(edges));

                const firstSys = nodes.find(n => n.type === 'ITSystem');
                if (!firstSys) return;

                const actions = [
                    { type: 'decommission', systemId: firstSys.id },
                ];

                applyAllActions(nodes, edges, actions);

                // Originals should be unchanged
                expect(nodes).toEqual(originalNodes);
                expect(edges).toEqual(originalEdges);
            })
        );
    });

    it('Property: Consolidate reduces system count', () => {
        // Build an estate with 2+ systems serving the same lgaFunctionId
        const arbConsolidateEstate = fc.tuple(
            arbFunction,
            fc.array(arbSystem, { minLength: 2, maxLength: 4 })
        ).filter(([fn, systems]) => {
            const sysIds = systems.map(s => s.id);
            return new Set(sysIds).size === sysIds.length;
        }).map(([fn, systems]) => {
            const edges = systems.map(sys => ({
                source: sys.id,
                target: fn.id,
                relationship: 'REALIZES'
            }));
            return { nodes: [...systems, fn], edges, fn, systems };
        });

        fc.assert(
            fc.property(arbConsolidateEstate, ({ nodes, edges, fn, systems }) => {
                const targetSystem = systems[0];
                const competingCount = systems.length - 1;
                const removeSystemIds = systems.filter(s => s.id !== targetSystem.id).map(s => s.id);

                const result = applyConsolidate(nodes, edges, {
                    type: 'consolidate',
                    functionId: fn.lgaFunctionId,
                    targetSystemId: targetSystem.id,
                    removeSystemIds,
                });

                const resultSystems = result.nodes.filter(n => n.type === 'ITSystem');
                expect(resultSystems.length).toBe(systems.length - competingCount);
                expect(result.nodes.some(n => n.id === targetSystem.id)).toBe(true);
            })
        );
    });

    it('Property: Consolidate preserves total users', () => {
        const arbConsolidateWithUsers = fc.tuple(
            arbFunction,
            fc.array(
                arbSystem.map(s => ({ ...s, users: s.users !== undefined ? s.users : 100 })),
                { minLength: 2, maxLength: 4 }
            )
        ).filter(([fn, systems]) => {
            const sysIds = systems.map(s => s.id);
            return new Set(sysIds).size === sysIds.length &&
                systems.every(s => typeof s.users === 'number');
        }).map(([fn, systems]) => {
            const edges = systems.map(sys => ({
                source: sys.id,
                target: fn.id,
                relationship: 'REALIZES'
            }));
            return { nodes: [...systems, fn], edges, fn, systems };
        });

        fc.assert(
            fc.property(arbConsolidateWithUsers, ({ nodes, edges, fn, systems }) => {
                const targetSystem = systems[0];
                const totalUsersBefore = systems.reduce((sum, s) => sum + (s.users || 0), 0);
                const removeSystemIds = systems.filter(s => s.id !== targetSystem.id).map(s => s.id);

                const result = applyConsolidate(nodes, edges, {
                    type: 'consolidate',
                    functionId: fn.lgaFunctionId,
                    targetSystemId: targetSystem.id,
                    removeSystemIds,
                });

                const resultSystems = result.nodes.filter(n => n.type === 'ITSystem');
                const totalUsersAfter = resultSystems.reduce((sum, s) => sum + (s.users || 0), 0);

                // Total users after should be >= total before (users transferred to target)
                expect(totalUsersAfter).toBeGreaterThanOrEqual(totalUsersBefore);
            })
        );
    });

    it('Property: Consolidate with removeSystemIds only removes specified systems', () => {
        // Build estate with 3+ systems but only specify 1 to remove
        const arbPartialConsolidate = fc.tuple(
            arbFunction,
            fc.array(arbSystem, { minLength: 3, maxLength: 5 })
        ).filter(([fn, systems]) => {
            const sysIds = systems.map(s => s.id);
            return new Set(sysIds).size === sysIds.length;
        }).map(([fn, systems]) => {
            const edges = systems.map(sys => ({
                source: sys.id,
                target: fn.id,
                relationship: 'REALIZES'
            }));
            return { nodes: [...systems, fn], edges, fn, systems };
        });

        fc.assert(
            fc.property(arbPartialConsolidate, ({ nodes, edges, fn, systems }) => {
                const targetSystem = systems[0];
                // Only remove one of the competing systems, not all
                const removeSystemIds = [systems[1].id];

                const result = applyConsolidate(nodes, edges, {
                    type: 'consolidate',
                    functionId: fn.lgaFunctionId,
                    targetSystemId: targetSystem.id,
                    removeSystemIds,
                });

                const resultSystems = result.nodes.filter(n => n.type === 'ITSystem');
                // Should have removed exactly 1, keeping target + remaining
                expect(resultSystems.length).toBe(systems.length - 1);
                expect(result.nodes.some(n => n.id === targetSystem.id)).toBe(true);
                expect(result.nodes.some(n => n.id === systems[1].id)).toBe(false);
                // systems[2] and beyond should still be present
                for (let i = 2; i < systems.length; i++) {
                    expect(result.nodes.some(n => n.id === systems[i].id)).toBe(true);
                }
            })
        );
    });

    it('Property: Decommission removes exactly one system and its edges', () => {
        fc.assert(
            fc.property(arbEstate, ({ nodes, edges }) => {
                const systems = nodes.filter(n => n.type === 'ITSystem');
                if (systems.length === 0) return;

                const targetSystem = systems[0];
                const originalNodeCount = nodes.length;
                const originalSysEdgesCount = edges.filter(e => e.source === targetSystem.id).length;

                const result = applyDecommission(nodes, edges, {
                    type: 'decommission',
                    systemId: targetSystem.id,
                });

                expect(result.nodes.length).toBe(originalNodeCount - 1);
                expect(result.nodes.some(n => n.id === targetSystem.id)).toBe(false);
                expect(result.edges.some(e => e.source === targetSystem.id)).toBe(false);
            })
        );
    });

    it('Property: ExtendContract modifies only target system dates', () => {
        fc.assert(
            fc.property(
                arbEstate,
                fc.integer({ min: 2026, max: 2040 }),
                fc.integer({ min: 1, max: 12 }),
                ({ nodes, edges }, newEndYear, newEndMonth) => {
                    const systems = nodes.filter(n => n.type === 'ITSystem');
                    if (systems.length === 0) return;

                    const targetSystem = systems[0];
                    const originalNodes = JSON.parse(JSON.stringify(nodes));

                    const result = applyExtendContract(nodes, edges, {
                        type: 'extend-contract',
                        systemId: targetSystem.id,
                        newEndYear,
                        newEndMonth,
                    });

                    // Target system has updated dates
                    const updatedTarget = result.nodes.find(n => n.id === targetSystem.id);
                    expect(updatedTarget.endYear).toBe(newEndYear);
                    expect(updatedTarget.endMonth).toBe(newEndMonth);

                    // All other nodes unchanged
                    result.nodes.forEach(n => {
                        if (n.id !== targetSystem.id) {
                            const original = originalNodes.find(o => o.id === n.id);
                            expect(n).toEqual(original);
                        }
                    });

                    // Edges unchanged
                    expect(result.edges).toEqual(edges);
                }
            )
        );
    });

    it('Property: MigrateUsers conserves total users', () => {
        fc.assert(
            fc.property(arbEstate, fc.integer({ min: 1, max: 500 }), ({ nodes, edges }, userCount) => {
                const systems = nodes.filter(n => n.type === 'ITSystem');
                if (systems.length < 2) return;

                const fromSystem = { ...systems[0], users: userCount + 100 };
                const toSystem = { ...systems[1], users: 50 };

                const testNodes = nodes.map(n => {
                    if (n.id === fromSystem.id) return fromSystem;
                    if (n.id === toSystem.id) return toSystem;
                    return n;
                });

                const totalBefore = fromSystem.users + toSystem.users;

                const result = applyMigrateUsers(testNodes, edges, {
                    type: 'migrate-users',
                    fromSystemId: fromSystem.id,
                    toSystemId: toSystem.id,
                    userCount,
                });

                const resultFrom = result.nodes.find(n => n.id === fromSystem.id);
                const resultTo = result.nodes.find(n => n.id === toSystem.id);
                const totalAfter = resultFrom.users + resultTo.users;

                expect(totalAfter).toBe(totalBefore);
            })
        );
    });

    it('Property: SplitSharedService produces correct count of new systems', () => {
        fc.assert(
            fc.property(
                arbEstate,
                fc.array(fc.record({
                    successorName: fc.constantFrom('Successor-A', 'Successor-B', 'Successor-C'),
                    label: fc.string({ minLength: 1, maxLength: 20 }),
                }), { minLength: 2, maxLength: 4 }),
                ({ nodes, edges }, splits) => {
                    const systems = nodes.filter(n => n.type === 'ITSystem');
                    if (systems.length === 0) return;

                    const targetSystem = systems[0];
                    const originalSystemCount = systems.length;

                    const result = applySplitSharedService(nodes, edges, {
                        type: 'split-shared-service',
                        systemId: targetSystem.id,
                        splits,
                    });

                    const resultSystems = result.nodes.filter(n => n.type === 'ITSystem');

                    // Original removed, N new ones added
                    expect(resultSystems.length).toBe(originalSystemCount - 1 + splits.length);
                    expect(result.nodes.some(n => n.id === targetSystem.id)).toBe(false);

                    // Each new system has correct ID pattern
                    splits.forEach((_, idx) => {
                        const expectedId = `${targetSystem.id}-split-${idx}`;
                        expect(result.nodes.some(n => n.id === expectedId)).toBe(true);
                    });

                    // Each new system has REALIZES edges to the same functions as original
                    const originalFuncTargets = new Set(
                        edges
                            .filter(e => e.source === targetSystem.id && e.relationship === 'REALIZES')
                            .map(e => e.target)
                    );

                    splits.forEach((_, idx) => {
                        const newId = `${targetSystem.id}-split-${idx}`;
                        const newFuncTargets = new Set(
                            result.edges
                                .filter(e => e.source === newId && e.relationship === 'REALIZES')
                                .map(e => e.target)
                        );
                        expect(newFuncTargets).toEqual(originalFuncTargets);
                    });
                }
            )
        );
    });

    it('Property: SplitSharedService conserves total users', () => {
        fc.assert(
            fc.property(
                arbSystem.map(s => ({ ...s, users: 1000 })),
                arbFunction,
                fc.array(fc.record({
                    successorName: fc.constantFrom('Successor-A', 'Successor-B', 'Successor-C'),
                    label: fc.string({ minLength: 1, maxLength: 20 }),
                }), { minLength: 2, maxLength: 4 }),
                (system, fn, splits) => {
                    const nodes = [system, fn];
                    const edges = [{ source: system.id, target: fn.id, relationship: 'REALIZES' }];

                    const result = applySplitSharedService(nodes, edges, {
                        type: 'split-shared-service',
                        systemId: system.id,
                        splits,
                    });

                    const originalUsers = system.users;
                    const newSystems = result.nodes.filter(n => n.type === 'ITSystem');
                    const totalUsersAfter = newSystems.reduce((sum, s) => sum + (s.users || 0), 0);

                    expect(totalUsersAfter).toBe(originalUsers);
                }
            )
        );
    });

    it('Property: ProcureReplacement adds one system when no replacement specified', () => {
        fc.assert(
            fc.property(arbEstate, arbSystem, ({ nodes, edges }, newSys) => {
                // Ensure newSys ID doesn't collide
                if (nodes.some(n => n.id === newSys.id)) return;

                const fn = nodes.find(n => n.type === 'Function');
                if (!fn) return;

                const originalCount = nodes.filter(n => n.type === 'ITSystem').length;

                const result = applyProcureReplacement(nodes, edges, {
                    type: 'procure-replacement',
                    functionId: fn.lgaFunctionId,
                    newSystem: newSys,
                    replacesSystemId: null,
                });

                const resultCount = result.nodes.filter(n => n.type === 'ITSystem').length;
                expect(resultCount).toBe(originalCount + 1);
            })
        );
    });

    it('Property: ProcureReplacement replaces one system when replacesSystemId is valid', () => {
        fc.assert(
            fc.property(arbEstate, arbSystem, ({ nodes, edges }, newSys) => {
                // Ensure newSys ID doesn't collide
                if (nodes.some(n => n.id === newSys.id)) return;

                const existingSys = nodes.find(n => n.type === 'ITSystem');
                const fn = nodes.find(n => n.type === 'Function');
                if (!existingSys || !fn) return;

                const originalCount = nodes.filter(n => n.type === 'ITSystem').length;

                const result = applyProcureReplacement(nodes, edges, {
                    type: 'procure-replacement',
                    functionId: fn.lgaFunctionId,
                    newSystem: newSys,
                    replacesSystemId: existingSys.id,
                });

                const resultCount = result.nodes.filter(n => n.type === 'ITSystem').length;
                expect(resultCount).toBe(originalCount); // one added, one removed
                expect(result.nodes.some(n => n.id === existingSys.id)).toBe(false);
                expect(result.nodes.some(n => n.id === newSys.id)).toBe(true);
            })
        );
    });

    it('Property: Unknown action type returns warning and unchanged nodes/edges', () => {
        fc.assert(
            fc.property(arbEstate, ({ nodes, edges }) => {
                const result = applyAction(nodes, edges, { type: 'nonsense-action' });

                expect(result.nodes).toEqual(nodes);
                expect(result.edges).toEqual(edges);
                expect(result.warnings).toContain('Unknown action type: nonsense-action');
            })
        );
    });

});
