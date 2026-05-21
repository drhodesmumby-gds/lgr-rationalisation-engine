import { describe, it, expect } from 'vitest';
import { validateArchitecture, validateTransitionConfig } from '../../src/features/schema-validator.js';

describe('validateArchitecture', () => {
    const VALID = {
        councilName: 'Test',
        nodes: [
            { id: 'fn-1', label: 'Finance', type: 'Function', lgaFunctionId: '116' },
            { id: 'sys-1', label: 'SAP', type: 'ITSystem', vendor: 'SAP' }
        ],
        edges: [{ source: 'sys-1', target: 'fn-1', relationship: 'REALIZES' }]
    };

    it('returns valid for a correct file', () => {
        const result = validateArchitecture(VALID);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('errors on null input', () => {
        const result = validateArchitecture(null);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it('errors on undefined input', () => {
        const result = validateArchitecture(undefined);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message.includes('null or undefined'))).toBe(true);
    });

    it('errors on non-object input', () => {
        const result = validateArchitecture('not an object');
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message.includes('not a valid JSON object'))).toBe(true);
    });

    it('errors on array input', () => {
        const result = validateArchitecture([]);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message.includes('not a valid JSON object'))).toBe(true);
    });

    it('errors on missing councilName', () => {
        const result = validateArchitecture({ nodes: [], edges: [] });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message.includes('councilName'))).toBe(true);
    });

    it('errors on missing nodes', () => {
        const result = validateArchitecture({ councilName: 'X', edges: [] });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message.includes('nodes'))).toBe(true);
    });

    it('errors on nodes not being an array', () => {
        const result = validateArchitecture({ councilName: 'X', nodes: 'not-array', edges: [] });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message.includes('nodes'))).toBe(true);
    });

    it('errors on missing edges', () => {
        const result = validateArchitecture({ councilName: 'X', nodes: [] });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message.includes('edges'))).toBe(true);
    });

    it('errors on node missing id', () => {
        const result = validateArchitecture({ councilName: 'X', nodes: [{ type: 'Function', label: 'Test', lgaFunctionId: '1' }], edges: [] });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message.includes("missing required field 'id'"))).toBe(true);
    });

    it('errors on node missing type', () => {
        const result = validateArchitecture({ councilName: 'X', nodes: [{ id: 'n1', label: 'Test' }], edges: [] });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message.includes("missing required field 'type'"))).toBe(true);
    });

    it('errors on node with invalid type', () => {
        const result = validateArchitecture({ councilName: 'X', nodes: [{ id: 'n1', type: 'Unknown', label: 'Test' }], edges: [] });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message.includes("invalid type 'Unknown'"))).toBe(true);
    });

    it('errors on Function node missing lgaFunctionId', () => {
        const result = validateArchitecture({ councilName: 'X', nodes: [{ id: 'fn-1', type: 'Function', label: 'Test' }], edges: [] });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message.includes('lgaFunctionId'))).toBe(true);
    });

    it('errors on ITSystem missing vendor', () => {
        const result = validateArchitecture({ councilName: 'X', nodes: [{ id: 's1', type: 'ITSystem', label: 'Sys' }], edges: [] });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message.includes('vendor'))).toBe(true);
    });

    it('errors on edge referencing non-existent source node', () => {
        const result = validateArchitecture({
            councilName: 'X',
            nodes: [{ id: 'fn-1', type: 'Function', label: 'F', lgaFunctionId: '1' }],
            edges: [{ source: 'nonexistent', target: 'fn-1', relationship: 'REALIZES' }]
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message.includes('nonexistent'))).toBe(true);
    });

    it('errors on edge referencing non-existent target node', () => {
        const result = validateArchitecture({
            councilName: 'X',
            nodes: [{ id: 'sys-1', type: 'ITSystem', label: 'S', vendor: 'V' }],
            edges: [{ source: 'sys-1', target: 'missing-fn', relationship: 'REALIZES' }]
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message.includes('missing-fn'))).toBe(true);
    });

    it('errors on edge missing source or target', () => {
        const result = validateArchitecture({
            councilName: 'X',
            nodes: [{ id: 'fn-1', type: 'Function', label: 'F', lgaFunctionId: '1' }],
            edges: [{ target: 'fn-1', relationship: 'REALIZES' }]
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message.includes("missing 'source' or 'target'"))).toBe(true);
    });

    it('errors on duplicate node IDs', () => {
        const result = validateArchitecture({
            councilName: 'X',
            nodes: [
                { id: 'dup', type: 'Function', label: 'F', lgaFunctionId: '1' },
                { id: 'dup', type: 'ITSystem', label: 'S', vendor: 'V' }
            ],
            edges: []
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message.includes('Duplicate'))).toBe(true);
    });

    it('warns on wrong-case enum value for portability', () => {
        const result = validateArchitecture({
            councilName: 'X',
            nodes: [
                { id: 'fn-1', type: 'Function', label: 'F', lgaFunctionId: '1' },
                { id: 'sys-1', type: 'ITSystem', label: 'S', vendor: 'V', portability: 'high' }
            ],
            edges: [{ source: 'sys-1', target: 'fn-1', relationship: 'REALIZES' }]
        });
        expect(result.valid).toBe(true); // warnings don't block
        expect(result.warnings.some(w => w.message.includes("'high'") && w.message.includes("'High'"))).toBe(true);
    });

    it('warns on wrong-case enum value for dataPartitioning', () => {
        const result = validateArchitecture({
            councilName: 'X',
            nodes: [
                { id: 'fn-1', type: 'Function', label: 'F', lgaFunctionId: '1' },
                { id: 'sys-1', type: 'ITSystem', label: 'S', vendor: 'V', dataPartitioning: 'monolithic' }
            ],
            edges: [{ source: 'sys-1', target: 'fn-1', relationship: 'REALIZES' }]
        });
        expect(result.valid).toBe(true);
        expect(result.warnings.some(w => w.message.includes("'monolithic'") && w.message.includes("'Monolithic'"))).toBe(true);
    });

    it('warns on orphaned ITSystem', () => {
        const result = validateArchitecture({
            councilName: 'X',
            nodes: [
                { id: 'fn-1', type: 'Function', label: 'F', lgaFunctionId: '1' },
                { id: 'sys-1', type: 'ITSystem', label: 'Orphan', vendor: 'V' }
            ],
            edges: []
        });
        expect(result.valid).toBe(true);
        expect(result.warnings.some(w => w.message.includes('orphaned'))).toBe(true);
    });

    it('warns on Function with no systems', () => {
        const result = validateArchitecture({
            councilName: 'X',
            nodes: [
                { id: 'fn-1', type: 'Function', label: 'NoSystems', lgaFunctionId: '1' }
            ],
            edges: []
        });
        expect(result.valid).toBe(true);
        expect(result.warnings.some(w => w.message.includes('no systems realize'))).toBe(true);
    });

    it('warns on missing annualCost', () => {
        const result = validateArchitecture({
            councilName: 'X',
            nodes: [
                { id: 'fn-1', type: 'Function', label: 'F', lgaFunctionId: '1' },
                { id: 'sys-1', type: 'ITSystem', label: 'S', vendor: 'V' }
            ],
            edges: [{ source: 'sys-1', target: 'fn-1', relationship: 'REALIZES' }]
        });
        expect(result.warnings.some(w => w.message.includes('annualCost'))).toBe(true);
    });

    it('warns on CONSUMES_CAPABILITY edge with empty capabilities array', () => {
        const result = validateArchitecture({
            councilName: 'X',
            nodes: [
                { id: 'fn-1', type: 'Function', label: 'F', lgaFunctionId: '1' },
                { id: 'sys-1', type: 'ITSystem', label: 'S1', vendor: 'V', annualCost: 1000, endYear: 2027, portability: 'High' },
                { id: 'sys-2', type: 'ITSystem', label: 'S2', vendor: 'V', annualCost: 1000, endYear: 2027, portability: 'High' }
            ],
            edges: [
                { source: 'sys-1', target: 'fn-1', relationship: 'REALIZES' },
                { source: 'sys-2', target: 'fn-1', relationship: 'REALIZES' },
                { source: 'sys-2', target: 'sys-1', relationship: 'CONSUMES_CAPABILITY', capabilities: [] }
            ]
        });
        expect(result.valid).toBe(true);
        // Should warn about the empty-capabilities dependency — mentions both system names
        const capWarning = result.warnings.find(w => w.message.includes('S2') && w.message.includes('S1'));
        expect(capWarning).toBeDefined();
        expect(capWarning.path).toContain('capabilities');
    });

    it('provides info summary', () => {
        const result = validateArchitecture(VALID);
        expect(result.info.length).toBeGreaterThan(0);
        expect(result.info.some(i => i.message.includes('Function'))).toBe(true);
        expect(result.info.some(i => i.message.includes('ITSystem'))).toBe(true);
    });

    it('includes council name in info', () => {
        const result = validateArchitecture(VALID);
        expect(result.info.some(i => i.message.includes('Test'))).toBe(true);
    });

    it('includes field completeness in info', () => {
        const result = validateArchitecture(VALID);
        expect(result.info.some(i => i.message.includes('Field completeness'))).toBe(true);
    });

    it('includes edges summary in info', () => {
        const result = validateArchitecture(VALID);
        expect(result.info.some(i => i.message.includes('REALIZES'))).toBe(true);
    });
});

describe('validateTransitionConfig', () => {
    const VALID = {
        vestingDate: '2027-04-01',
        successors: [{ name: 'Test Unitary', fullPredecessors: ['Council A'] }]
    };

    it('returns valid for a correct config', () => {
        const result = validateTransitionConfig(VALID);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('errors on null input', () => {
        const result = validateTransitionConfig(null);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it('errors on undefined input', () => {
        const result = validateTransitionConfig(undefined);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message.includes('null or undefined'))).toBe(true);
    });

    it('errors on non-object input', () => {
        const result = validateTransitionConfig('string');
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message.includes('not a valid JSON object'))).toBe(true);
    });

    it('errors on missing vestingDate', () => {
        const result = validateTransitionConfig({ successors: [] });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message.includes('vestingDate'))).toBe(true);
    });

    it('errors on invalid vestingDate format', () => {
        const result = validateTransitionConfig({ vestingDate: 'not-a-date', successors: [{ name: 'X' }] });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message.includes('not a valid date'))).toBe(true);
    });

    it('errors on vestingDate with wrong format (US style)', () => {
        const result = validateTransitionConfig({ vestingDate: '04/01/2027', successors: [{ name: 'X' }] });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message.includes('not a valid date'))).toBe(true);
    });

    it('errors on missing successors', () => {
        const result = validateTransitionConfig({ vestingDate: '2027-04-01' });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message.includes('successors'))).toBe(true);
    });

    it('errors on empty successors array', () => {
        const result = validateTransitionConfig({ vestingDate: '2027-04-01', successors: [] });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message.includes('empty'))).toBe(true);
    });

    it('errors on successor missing name', () => {
        const result = validateTransitionConfig({ vestingDate: '2027-04-01', successors: [{ fullPredecessors: ['A'] }] });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message.includes("missing required field 'name'"))).toBe(true);
    });

    it('warns on successor with no predecessors', () => {
        const result = validateTransitionConfig({ vestingDate: '2027-04-01', successors: [{ name: 'Test' }] });
        expect(result.valid).toBe(true);
        expect(result.warnings.some(w => w.message.includes('no predecessors'))).toBe(true);
    });

    it('warns on vestingDate in the past', () => {
        const result = validateTransitionConfig({ vestingDate: '2020-01-01', successors: [{ name: 'Old Unitary', fullPredecessors: ['A'] }] });
        expect(result.valid).toBe(true);
        expect(result.warnings.some(w => w.message.includes('in the past'))).toBe(true);
    });

    it('provides info summary', () => {
        const result = validateTransitionConfig(VALID);
        expect(result.info.some(i => i.message.includes('Vesting date'))).toBe(true);
        expect(result.info.some(i => i.message.includes('successor'))).toBe(true);
    });

    it('includes predecessor count in info', () => {
        const result = validateTransitionConfig(VALID);
        expect(result.info.some(i => i.message.includes('predecessor'))).toBe(true);
    });

    it('handles multiple successors', () => {
        const result = validateTransitionConfig({
            vestingDate: '2027-04-01',
            successors: [
                { name: 'North Unitary', fullPredecessors: ['Council A', 'Council B'] },
                { name: 'South Unitary', partialPredecessors: ['Council C'] }
            ]
        });
        expect(result.valid).toBe(true);
        expect(result.info.some(i => i.message.includes('2 successor'))).toBe(true);
        expect(result.info.some(i => i.message.includes('3 total predecessor'))).toBe(true);
    });
});
