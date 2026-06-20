import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeGridState, deriveSharedGroupsFromGrid } from '../../src/features/decision-panel/sharing-grid.js';

describe('sharing grid state', () => {
    const arbFunction = fc.record({
        funcId: fc.stringMatching(/^[0-9]{1,3}$/),
        label: fc.string({ minLength: 1, maxLength: 20 }),
        systemLabel: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
        decided: fc.boolean()
    });

    const arbSuccessor = fc.string({ minLength: 1, maxLength: 20 });

    it('primary successor is checked if it selected the current system', () => {
        fc.assert(fc.property(
            fc.array(arbFunction.map(f => ({ ...f, decided: true })), { minLength: 1, maxLength: 5 }),
            arbSuccessor,
            fc.array(arbSuccessor, { minLength: 1, maxLength: 3 }),
            fc.string({ minLength: 1, maxLength: 10 }), // selectedSystemId
            (functions, primary, others, selectedSystemId) => {
                const decisions = new Map();
                for (const f of functions) {
                    decisions.set(`${f.funcId}::${primary}`, {
                        systemChoice: 'choose',
                        retainedSystemIds: [selectedSystemId]
                    });
                }
                const gridState = computeGridState(functions, primary, others, decisions, null, selectedSystemId);
                for (const func of functions) {
                    expect(gridState[func.funcId][primary]).toBe(true);
                }
            }
        ));
    });

    it('undecided functions default to false for non-primary (no saved decisions)', () => {
        fc.assert(fc.property(
            fc.array(arbFunction.map(f => ({ ...f, decided: false })), { minLength: 1, maxLength: 5 }),
            arbSuccessor,
            fc.array(arbSuccessor, { minLength: 1, maxLength: 3 }),
            (functions, primary, others) => {
                const gridState = computeGridState(functions, primary, others, new Map());
                for (const func of functions) {
                    for (const other of others) {
                        expect(gridState[func.funcId][other]).toBe(false);
                    }
                }
            }
        ));
    });

    it('decided functions without shared origin show false for non-primary', () => {
        fc.assert(fc.property(
            fc.array(arbFunction.map(f => ({ ...f, decided: true })), { minLength: 1, maxLength: 5 }),
            arbSuccessor,
            fc.array(arbSuccessor, { minLength: 1, maxLength: 3 }),
            (functions, primary, others) => {
                const gridState = computeGridState(functions, primary, others, new Map());
                for (const func of functions) {
                    for (const other of others) {
                        expect(gridState[func.funcId][other]).toBe(false);
                    }
                }
            }
        ));
    });
});

describe('deriveSharedGroupsFromGrid', () => {
    it('reports pending for undecided functions', () => {
        const functions = [
            { funcId: '1', label: 'Finance', systemLabel: null, decided: false }
        ];
        const gridState = { '1': { 'North': true, 'South': 'disabled' } };
        const result = deriveSharedGroupsFromGrid(gridState, functions, 'North', ['South']);
        expect(result).toContain('Finance: Pending');
    });

    it('reports shared when other successor is checked', () => {
        const functions = [
            { funcId: '1', label: 'Finance', systemLabel: 'SAP', decided: true }
        ];
        const gridState = { '1': { 'North': true, 'South': true } };
        const result = deriveSharedGroupsFromGrid(gridState, functions, 'North', ['South']);
        expect(result).toContain('Finance: Shared (North + South)');
    });

    it('reports primary-only when no other successor is checked', () => {
        const functions = [
            { funcId: '1', label: 'Finance', systemLabel: 'SAP', decided: true }
        ];
        const gridState = { '1': { 'North': true, 'South': false } };
        const result = deriveSharedGroupsFromGrid(gridState, functions, 'North', ['South']);
        expect(result).toContain('Finance: North only');
    });
});
