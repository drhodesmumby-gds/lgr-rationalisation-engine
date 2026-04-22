import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
    buildEstateSankeyData,
    buildFunctionSankeyData,
    getAffectedSystemIds
} from '../../src/features/sankey-data.js';

// ===================================================================
// Generators
// ===================================================================

const arbSystemId = fc.stringMatching(/^sys-[a-z0-9]{3,6}$/);
const arbFuncId = fc.constantFrom('1', '2', '3', '4', '5', '148', '150', '200');
const arbCouncilName = fc.constantFrom('Alpha Council', 'Beta District', 'Gamma County', 'Delta Borough');
const arbSuccessorName = fc.constantFrom('North Unitary', 'South Unitary', 'East Unitary');

// Minimal SystemAllocation shape
const arbAllocation = fc.record({
    system: fc.record({
        id: arbSystemId,
        label: fc.string({ minLength: 1, maxLength: 30 }),
        annualCost: fc.option(fc.integer({ min: 10000, max: 500000 }), { nil: undefined }),
        _sourceCouncil: arbCouncilName,
    }),
    sourceCouncil: arbCouncilName,
    allocationType: fc.constantFrom('full', 'partial'),
    isDisaggregation: fc.boolean(),
}).map(a => {
    // Clean up undefined optional fields
    if (a.system.annualCost === undefined) delete a.system.annualCost;
    return a;
});

// Build a minimal allocMap: Map<successorName, Map<lgaFunctionId, SystemAllocation[]>>
const arbAllocMap = fc.tuple(
    fc.uniqueArray(arbSuccessorName, { minLength: 1, maxLength: 3 }),
    fc.uniqueArray(arbFuncId, { minLength: 1, maxLength: 3 }),
    fc.array(arbAllocation, { minLength: 1, maxLength: 6 })
).map(([successors, funcIds, allocations]) => {
    const allocMap = new Map();
    successors.forEach(succ => {
        const funcMap = new Map();
        funcIds.forEach((funcId, fi) => {
            // Assign a subset of allocations to each (funcId, successor) pair
            const subset = allocations.filter((_, idx) => idx % successors.length === successors.indexOf(succ));
            if (subset.length > 0) {
                funcMap.set(funcId, subset);
            }
        });
        if (funcMap.size > 0) {
            allocMap.set(succ, funcMap);
        }
    });
    return allocMap;
}).filter(allocMap => allocMap.size > 0);

// ===================================================================
// getAffectedSystemIds tests
// ===================================================================

describe('getAffectedSystemIds', () => {
    it('Property: returns empty Set for empty actions array', () => {
        const result = getAffectedSystemIds([]);
        expect(result.size).toBe(0);
    });

    it('Property: returns empty Set for null/undefined', () => {
        expect(getAffectedSystemIds(null).size).toBe(0);
        expect(getAffectedSystemIds(undefined).size).toBe(0);
    });

    it('Property: decommission action adds systemId to result', () => {
        fc.assert(fc.property(arbSystemId, (sysId) => {
            const result = getAffectedSystemIds([{ type: 'decommission', systemId: sysId }]);
            expect(result.has(sysId)).toBe(true);
        }));
    });

    it('Property: all referenced IDs are included', () => {
        fc.assert(fc.property(
            arbSystemId, arbSystemId, arbSystemId,
            (sysId1, sysId2, sysId3) => {
                const actions = [
                    { type: 'migrate-users', fromSystemId: sysId1, toSystemId: sysId2 },
                    { type: 'decommission', systemId: sysId3 },
                ];
                const result = getAffectedSystemIds(actions);
                expect(result.has(sysId1)).toBe(true);
                expect(result.has(sysId2)).toBe(true);
                expect(result.has(sysId3)).toBe(true);
            }
        ));
    });

    it('Property: result is a Set (no duplicates)', () => {
        fc.assert(fc.property(arbSystemId, (sysId) => {
            const actions = [
                { type: 'decommission', systemId: sysId },
                { type: 'decommission', systemId: sysId },
            ];
            const result = getAffectedSystemIds(actions);
            expect(result.size).toBe(1);
        }));
    });
});

// ===================================================================
// buildEstateSankeyData tests
// ===================================================================

describe('buildEstateSankeyData', () => {
    it('Property: returns empty result for null allocMap', () => {
        const result = buildEstateSankeyData(null, null, []);
        expect(result.nodes).toEqual([]);
        expect(result.links).toEqual([]);
    });

    it('Property: returns empty result for empty allocMap', () => {
        const result = buildEstateSankeyData(new Map(), null, []);
        expect(result.nodes).toEqual([]);
        expect(result.links).toEqual([]);
    });

    it('Property: all returned links reference valid node ids', () => {
        fc.assert(fc.property(arbAllocMap, (allocMap) => {
            const { nodes, links } = buildEstateSankeyData(allocMap, null, []);
            const nodeIds = new Set(nodes.map(n => n.id));
            links.forEach(link => {
                expect(nodeIds.has(link.source)).toBe(true);
                expect(nodeIds.has(link.target)).toBe(true);
            });
        }));
    });

    it('Property: all links have positive value', () => {
        fc.assert(fc.property(arbAllocMap, (allocMap) => {
            const { links } = buildEstateSankeyData(allocMap, null, []);
            links.forEach(link => {
                expect(link.value).toBeGreaterThan(0);
            });
        }));
    });

    it('Property: node types are predecessor or successor only', () => {
        fc.assert(fc.property(arbAllocMap, (allocMap) => {
            const { nodes } = buildEstateSankeyData(allocMap, null, []);
            nodes.forEach(node => {
                expect(['predecessor', 'successor']).toContain(node.nodeType);
            });
        }));
    });

    it('Property: predecessor node IDs start with "pred:"', () => {
        fc.assert(fc.property(arbAllocMap, (allocMap) => {
            const { nodes } = buildEstateSankeyData(allocMap, null, []);
            const preds = nodes.filter(n => n.nodeType === 'predecessor');
            preds.forEach(n => {
                expect(n.id.startsWith('pred:')).toBe(true);
            });
        }));
    });

    it('Property: successor node IDs start with "succ:"', () => {
        fc.assert(fc.property(arbAllocMap, (allocMap) => {
            const { nodes } = buildEstateSankeyData(allocMap, null, []);
            const succs = nodes.filter(n => n.nodeType === 'successor');
            succs.forEach(n => {
                expect(n.id.startsWith('succ:')).toBe(true);
            });
        }));
    });

    it('Property: node IDs are unique', () => {
        fc.assert(fc.property(arbAllocMap, (allocMap) => {
            const { nodes } = buildEstateSankeyData(allocMap, null, []);
            const ids = nodes.map(n => n.id);
            expect(new Set(ids).size).toBe(ids.length);
        }));
    });

    it('Property: sizeMode=cost uses cost values when available', () => {
        // Build an allocMap with known annualCost values
        const allocMap = new Map([
            ['Successor A', new Map([
                ['1', [{ system: { id: 'sys-1', label: 'Sys1', annualCost: 100000, _sourceCouncil: 'Council A' }, sourceCouncil: 'Council A', allocationType: 'full', isDisaggregation: false }]]
            ])]
        ]);
        const { links: countLinks } = buildEstateSankeyData(allocMap, null, [], 'count');
        const { links: costLinks } = buildEstateSankeyData(allocMap, null, [], 'cost');
        expect(countLinks[0].value).toBe(1);
        expect(costLinks[0].value).toBe(100000);
    });

    it('Property: hasSimAction is true when a system in that link is affected', () => {
        const systemId = 'sys-abc';
        const allocMap = new Map([
            ['Successor A', new Map([
                ['1', [{ system: { id: systemId, label: 'Sys', _sourceCouncil: 'Council A' }, sourceCouncil: 'Council A', allocationType: 'full', isDisaggregation: false }]]
            ])]
        ]);
        const actions = [{ type: 'decommission', systemId }];
        const { links } = buildEstateSankeyData(allocMap, null, actions);
        expect(links[0].hasSimAction).toBe(true);
    });
});

// ===================================================================
// buildFunctionSankeyData tests
// ===================================================================

describe('buildFunctionSankeyData', () => {
    it('Property: returns empty result when allocMap does not contain the successor', () => {
        const allocMap = new Map();
        const result = buildFunctionSankeyData(allocMap, 'Nonexistent Successor', new Map(), []);
        expect(result.nodes).toEqual([]);
        expect(result.links).toEqual([]);
    });

    it('Property: all returned links reference valid node ids', () => {
        fc.assert(fc.property(arbAllocMap, (allocMap) => {
            const successorName = Array.from(allocMap.keys())[0];
            const { nodes, links } = buildFunctionSankeyData(allocMap, successorName, new Map(), []);
            const nodeIds = new Set(nodes.map(n => n.id));
            links.forEach(link => {
                expect(nodeIds.has(link.source)).toBe(true);
                expect(nodeIds.has(link.target)).toBe(true);
            });
        }));
    });

    it('Property: all links have positive value (minimum 1)', () => {
        fc.assert(fc.property(arbAllocMap, (allocMap) => {
            const successorName = Array.from(allocMap.keys())[0];
            const { links } = buildFunctionSankeyData(allocMap, successorName, new Map(), []);
            links.forEach(link => {
                expect(link.value).toBeGreaterThanOrEqual(1);
            });
        }));
    });

    it('Property: system node IDs start with "sys:"', () => {
        fc.assert(fc.property(arbAllocMap, (allocMap) => {
            const successorName = Array.from(allocMap.keys())[0];
            const { nodes } = buildFunctionSankeyData(allocMap, successorName, new Map(), []);
            const systemNodes = nodes.filter(n => n.nodeType === 'system');
            systemNodes.forEach(n => {
                expect(n.id.startsWith('sys:')).toBe(true);
            });
        }));
    });

    it('Property: function node IDs start with "func:"', () => {
        fc.assert(fc.property(arbAllocMap, (allocMap) => {
            const successorName = Array.from(allocMap.keys())[0];
            const { nodes } = buildFunctionSankeyData(allocMap, successorName, new Map(), []);
            const funcNodes = nodes.filter(n => n.nodeType === 'function');
            funcNodes.forEach(n => {
                expect(n.id.startsWith('func:')).toBe(true);
            });
        }));
    });

    it('Property: node IDs are unique within a successor view', () => {
        fc.assert(fc.property(arbAllocMap, (allocMap) => {
            const successorName = Array.from(allocMap.keys())[0];
            const { nodes } = buildFunctionSankeyData(allocMap, successorName, new Map(), []);
            const ids = nodes.map(n => n.id);
            expect(new Set(ids).size).toBe(ids.length);
        }));
    });

    it('Property: affected system nodes have isAffected=true', () => {
        const systemId = 'sys-xyz';
        const allocMap = new Map([
            ['Successor A', new Map([
                ['1', [{ system: { id: systemId, label: 'Sys', _sourceCouncil: 'Council A' }, sourceCouncil: 'Council A', allocationType: 'full', isDisaggregation: false }]]
            ])]
        ]);
        const actions = [{ type: 'decommission', systemId }];
        const { nodes } = buildFunctionSankeyData(allocMap, 'Successor A', new Map(), actions);
        const sysNode = nodes.find(n => n.systemId === systemId);
        expect(sysNode).toBeDefined();
        expect(sysNode.isAffected).toBe(true);
    });

    it('Property: lgaFunctionMap labels are used when provided', () => {
        const allocMap = new Map([
            ['Successor A', new Map([
                ['148', [{ system: { id: 'sys-1', label: 'Sys1', _sourceCouncil: 'Council A' }, sourceCouncil: 'Council A', allocationType: 'full', isDisaggregation: false }]]
            ])]
        ]);
        const lgaFunctionMap = new Map([['148', { lgaId: '148', label: 'Adult Social Care' }]]);
        const { nodes } = buildFunctionSankeyData(allocMap, 'Successor A', lgaFunctionMap, []);
        const funcNode = nodes.find(n => n.nodeType === 'function');
        expect(funcNode.label).toBe('Adult Social Care');
    });
});
