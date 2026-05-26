import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { _compareField as compareField, _countMissing as countMissing } from '../../src/features/unified-editor/bulk-mode.js';

const KEY_FIELDS = ['vendor', 'annualCost', 'endYear', 'portability', 'dataPartitioning', 'hosting', 'supportModel'];

const arbSystemNode = fc.record({
    id: fc.string({ minLength: 1, maxLength: 10 }),
    label: fc.string({ minLength: 0, maxLength: 30 }),
    type: fc.constant('ITSystem'),
    vendor: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
    annualCost: fc.option(fc.integer({ min: 0, max: 5000000 }), { nil: undefined }),
    endYear: fc.option(fc.integer({ min: 2024, max: 2035 }), { nil: undefined }),
    endMonth: fc.option(fc.integer({ min: 1, max: 12 }), { nil: undefined }),
    noticePeriod: fc.option(fc.integer({ min: 0, max: 36 }), { nil: undefined }),
    portability: fc.option(fc.constantFrom('High', 'Medium', 'Low'), { nil: undefined }),
    dataPartitioning: fc.option(fc.constantFrom('Segmented', 'Monolithic'), { nil: undefined }),
    hosting: fc.option(fc.constantFrom('cloud', 'on-premise', 'partner-hosted'), { nil: undefined }),
    supportModel: fc.option(fc.constantFrom('vendor-supported', 'community-supported', 'unsupported'), { nil: undefined }),
});

describe('compareField — sort comparator', () => {
    const emptyLookup = new Map();
    const editorState = { nodes: [], edges: [] };

    describe('alphabetical fields (label, vendor, supportModel, portability, dataPartitioning)', () => {
        const alphaFields = ['label', 'vendor', 'supportModel', 'dataPartitioning', 'portability'];

        it('is antisymmetric: compare(a,b) === -compare(b,a)', () => {
            fc.assert(fc.property(
                arbSystemNode, arbSystemNode, fc.constantFrom(...alphaFields),
                (a, b, field) => {
                    const ab = compareField(a, b, field, editorState, emptyLookup);
                    const ba = compareField(b, a, field, editorState, emptyLookup);
                    if (ab > 0) expect(ba).toBeLessThan(0);
                    else if (ab < 0) expect(ba).toBeGreaterThan(0);
                    else expect(ba).toBe(0);
                }
            ), { numRuns: 200 });
        });

        it('equal values return 0 or tiebreak by label', () => {
            fc.assert(fc.property(arbSystemNode, fc.constantFrom(...alphaFields), (node, field) => {
                const result = compareField(node, { ...node }, field, editorState, emptyLookup);
                expect(result).toBe(0);
            }), { numRuns: 100 });
        });
    });

    describe('numeric fields (annualCost, noticePeriod, users)', () => {
        const numFields = ['annualCost', 'noticePeriod'];

        it('higher values sort after lower values', () => {
            fc.assert(fc.property(
                fc.integer({ min: 0, max: 1000000 }), fc.integer({ min: 0, max: 1000000 }),
                fc.constantFrom(...numFields),
                (valA, valB, field) => {
                    const a = { id: 'a', label: 'A', type: 'ITSystem', [field]: valA };
                    const b = { id: 'b', label: 'B', type: 'ITSystem', [field]: valB };
                    const result = compareField(a, b, field, editorState, emptyLookup);
                    if (valA < valB) expect(result).toBeLessThan(0);
                    else if (valA > valB) expect(result).toBeGreaterThan(0);
                }
            ), { numRuns: 200 });
        });

        it('null values sort last (after all non-null)', () => {
            fc.assert(fc.property(
                fc.integer({ min: 0, max: 1000000 }), fc.constantFrom(...numFields),
                (val, field) => {
                    const withVal = { id: 'a', label: 'A', type: 'ITSystem', [field]: val };
                    const withNull = { id: 'b', label: 'B', type: 'ITSystem', [field]: null };
                    expect(compareField(withVal, withNull, field, editorState, emptyLookup)).toBeLessThan(0);
                    expect(compareField(withNull, withVal, field, editorState, emptyLookup)).toBeGreaterThan(0);
                }
            ), { numRuns: 100 });
        });

        it('two nulls tiebreak by label', () => {
            const a = { id: 'a', label: 'Zeta', type: 'ITSystem', annualCost: null };
            const b = { id: 'b', label: 'Alpha', type: 'ITSystem', annualCost: null };
            expect(compareField(a, b, 'annualCost', editorState, emptyLookup)).toBeGreaterThan(0);
            expect(compareField(b, a, 'annualCost', editorState, emptyLookup)).toBeLessThan(0);
        });
    });

    describe('contractEnd (composite year*12+month)', () => {
        it('earlier dates sort before later dates', () => {
            fc.assert(fc.property(
                fc.integer({ min: 2024, max: 2035 }), fc.integer({ min: 1, max: 12 }),
                fc.integer({ min: 2024, max: 2035 }), fc.integer({ min: 1, max: 12 }),
                (yearA, monthA, yearB, monthB) => {
                    const a = { id: 'a', label: 'A', type: 'ITSystem', endYear: yearA, endMonth: monthA };
                    const b = { id: 'b', label: 'B', type: 'ITSystem', endYear: yearB, endMonth: monthB };
                    const valA = yearA * 12 + monthA;
                    const valB = yearB * 12 + monthB;
                    const result = compareField(a, b, 'contractEnd', editorState, emptyLookup);
                    if (valA < valB) expect(result).toBeLessThan(0);
                    else if (valA > valB) expect(result).toBeGreaterThan(0);
                }
            ), { numRuns: 200 });
        });

        it('null endYear sorts last', () => {
            const withDate = { id: 'a', label: 'A', type: 'ITSystem', endYear: 2027, endMonth: 6 };
            const noDate = { id: 'b', label: 'B', type: 'ITSystem', endYear: null, endMonth: null };
            expect(compareField(withDate, noDate, 'contractEnd', editorState, emptyLookup)).toBeLessThan(0);
            expect(compareField(noDate, withDate, 'contractEnd', editorState, emptyLookup)).toBeGreaterThan(0);
        });
    });

    describe('hosting (string enum)', () => {
        it('sorts cloud, on-premise, partner-hosted alphabetically', () => {
            const nodeCloud = { id: 'a', label: 'A', type: 'ITSystem', hosting: 'cloud' };
            const nodeOnPrem = { id: 'b', label: 'B', type: 'ITSystem', hosting: 'on-premise' };
            const nodePartner = { id: 'c', label: 'C', type: 'ITSystem', hosting: 'partner-hosted' };
            const co = compareField(nodeCloud, nodeOnPrem, 'hosting', editorState, emptyLookup);
            const cp = compareField(nodeCloud, nodePartner, 'hosting', editorState, emptyLookup);
            expect(co).toBeLessThan(0); // "cloud" < "on-premise"
            expect(cp).toBeLessThan(0); // "cloud" < "partner-hosted"
        });
    });

    describe('function field (via lookup)', () => {
        it('sorts by function label from lookup', () => {
            const lookup = new Map([['sys-1', 'Housing'], ['sys-2', 'Admin']]);
            const a = { id: 'sys-1', label: 'X', type: 'ITSystem' };
            const b = { id: 'sys-2', label: 'Y', type: 'ITSystem' };
            const result = compareField(a, b, 'function', editorState, lookup);
            expect(result).toBeGreaterThan(0); // "housing" > "admin"
        });

        it('missing function sorts last', () => {
            const lookup = new Map([['sys-1', 'Housing']]);
            const a = { id: 'sys-1', label: 'X', type: 'ITSystem' };
            const b = { id: 'sys-2', label: 'Y', type: 'ITSystem' };
            const result = compareField(a, b, 'function', editorState, lookup);
            expect(result).toBeGreaterThan(0); // "housing" > ""
        });
    });

    describe('unknown field', () => {
        it('returns 0 for unrecognised field names', () => {
            fc.assert(fc.property(
                arbSystemNode, arbSystemNode,
                fc.string({ minLength: 1, maxLength: 10 }).filter(s => !['label','vendor','supportModel','dataPartitioning','portability','annualCost','noticePeriod','users','contractEnd','isCloud','function'].includes(s)),
                (a, b, field) => {
                    expect(compareField(a, b, field, editorState, emptyLookup)).toBe(0);
                }
            ), { numRuns: 50 });
        });
    });
});

describe('countMissing — completeness calculation', () => {
    it('returns 0 for a fully-filled node', () => {
        const node = {
            vendor: 'Test', annualCost: 50000, endYear: 2027,
            portability: 'High', dataPartitioning: 'Segmented',
            hosting: 'cloud', supportModel: 'vendor-supported'
        };
        expect(countMissing(node)).toBe(0);
    });

    it('returns 7 for a completely empty node', () => {
        expect(countMissing({})).toBe(7);
    });

    it('counts each missing key field correctly', () => {
        fc.assert(fc.property(
            fc.subarray(KEY_FIELDS, { minLength: 0, maxLength: 7 }),
            (presentFields) => {
                const node = {};
                for (const f of presentFields) {
                    if (f === 'annualCost' || f === 'endYear') node[f] = 1000;
                    else if (f === 'isCloud') node[f] = true;
                    else node[f] = 'value';
                }
                expect(countMissing(node)).toBe(7 - presentFields.length);
            }
        ), { numRuns: 100 });
    });

    it('treats empty string as missing', () => {
        const node = { vendor: '', annualCost: null, endYear: undefined,
            portability: '', dataPartitioning: '', isCloud: undefined, supportModel: '' };
        expect(countMissing(node)).toBe(7);
    });
});
