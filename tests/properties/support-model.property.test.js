import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { classifySupportModel } from '../../src/analysis/signals.js';

describe('classifySupportModel', () => {
    it('returns unknown for null/undefined input', () => {
        expect(classifySupportModel(null).model).toBe('unknown');
        expect(classifySupportModel(undefined).model).toBe('unknown');
    });

    it('uses explicit supportModel when set to a valid value', () => {
        fc.assert(fc.property(
            fc.constantFrom('vendor-supported', 'community-supported', 'unsupported'),
            fc.string(),
            (model, vendor) => {
                const result = classifySupportModel({ supportModel: model, vendor });
                expect(result.model).toBe(model);
                expect(result.isExplicit).toBe(true);
            }
        ));
    });

    it('infers vendor-supported for commercial vendors without explicit supportModel', () => {
        fc.assert(fc.property(
            fc.stringMatching(/^[A-Za-z ]{2,20}$/).filter(v => v !== 'In-House'),
            (vendor) => {
                const result = classifySupportModel({ vendor });
                expect(result.model).toBe('vendor-supported');
                expect(result.isExplicit).toBe(false);
            }
        ));
    });

    it('returns unknown for In-House vendor without explicit supportModel', () => {
        const result = classifySupportModel({ vendor: 'In-House' });
        expect(result.model).toBe('unknown');
        expect(result.isExplicit).toBe(false);
    });

    it('returns unknown for systems with no vendor', () => {
        const result = classifySupportModel({ label: 'Test' });
        expect(result.model).toBe('unknown');
        expect(result.isExplicit).toBe(false);
    });

    it('always returns a non-empty summary string', () => {
        fc.assert(fc.property(
            fc.record({
                vendor: fc.option(fc.constantFrom('SAP', 'Civica', 'In-House', 'NEC'), { nil: undefined }),
                supportModel: fc.option(fc.constantFrom('vendor-supported', 'community-supported', 'unsupported', 'invalid'), { nil: undefined })
            }),
            (sys) => {
                const result = classifySupportModel(sys);
                expect(result.summary).toBeTruthy();
                expect(typeof result.summary).toBe('string');
                expect(result.summary.length).toBeGreaterThan(0);
            }
        ));
    });

    it('includes sharedWith councils in community-supported summary', () => {
        const result = classifySupportModel({
            vendor: 'In-House',
            supportModel: 'community-supported',
            sharedWith: ['Council A', 'Council B']
        });
        expect(result.summary).toContain('Council A');
        expect(result.summary).toContain('Council B');
    });

    it('model is always one of the four valid values', () => {
        fc.assert(fc.property(
            fc.record({
                vendor: fc.option(fc.constantFrom('SAP', 'In-House', 'Oracle', ''), { nil: undefined }),
                supportModel: fc.option(fc.string(), { nil: undefined }),
                sharedWith: fc.option(fc.array(fc.string(), { maxLength: 3 }), { nil: undefined })
            }),
            (sys) => {
                const result = classifySupportModel(sys);
                expect(['vendor-supported', 'community-supported', 'unsupported', 'unknown']).toContain(result.model);
            }
        ));
    });
});
