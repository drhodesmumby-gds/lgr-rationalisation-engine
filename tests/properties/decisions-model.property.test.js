import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createDecision, validateDecision, getDecisionKey } from '../../src/simulation/decisions.js';
import { computeDerivedBoundary } from '../../src/features/decision-panel/helpers.js';

describe('FunctionDecision new fields', () => {
    const arbDecisionParams = fc.record({
        functionId: fc.stringMatching(/^[0-9]{1,3}$/),
        successorName: fc.string({ minLength: 1, maxLength: 30 }),
        systemChoice: fc.constantFrom('choose', 'procure', 'defer'),
        retainedSystemIds: fc.array(fc.stringMatching(/^sys-[a-z0-9]+$/), { minLength: 0, maxLength: 3 }),
        rationale: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: null }),
        decidedBy: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
        resolvedVia: fc.option(fc.stringMatching(/^[0-9]{1,3}$/), { nil: null }),
        assignedFunctions: fc.option(fc.array(fc.stringMatching(/^[0-9]{1,3}$/), { minLength: 0, maxLength: 5 }), { nil: null })
    });

    it('createDecision includes new fields when provided', () => {
        fc.assert(fc.property(arbDecisionParams, (params) => {
            if (params.systemChoice === 'choose' && params.retainedSystemIds.length === 0) {
                params.retainedSystemIds = ['sys-default'];
            }
            const decision = createDecision(params);
            expect(decision.rationale).toBe(params.rationale);
            expect(decision.decidedBy).toBe(params.decidedBy);
            expect(decision.resolvedVia).toBe(params.resolvedVia);
            expect(decision.assignedFunctions).toEqual(params.assignedFunctions);
        }));
    });

    it('createDecision defaults new fields to null when omitted', () => {
        const decision = createDecision({
            functionId: '148',
            successorName: 'West Elmhurst',
            systemChoice: 'defer'
        });
        expect(decision.rationale).toBeNull();
        expect(decision.decidedBy).toBeNull();
        expect(decision.resolvedVia).toBeNull();
        expect(decision.assignedFunctions).toBeNull();
    });

    it('validateDecision passes with new optional fields', () => {
        fc.assert(fc.property(arbDecisionParams, (params) => {
            if (params.systemChoice === 'choose' && params.retainedSystemIds.length === 0) {
                params.retainedSystemIds = ['sys-default'];
            }
            if (params.systemChoice === 'procure') {
                params.procuredSystem = { label: 'Test System' };
            }
            const decision = createDecision(params);
            const result = validateDecision(decision);
            expect(result.valid).toBe(true);
        }));
    });

    it('validateDecision rejects non-string rationale', () => {
        const decision = createDecision({
            functionId: '148',
            successorName: 'West Elmhurst',
            systemChoice: 'defer'
        });
        decision.rationale = 123;
        const result = validateDecision(decision);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('rationale'))).toBe(true);
    });

    it('validateDecision rejects non-array assignedFunctions', () => {
        const decision = createDecision({
            functionId: '148',
            successorName: 'West Elmhurst',
            systemChoice: 'defer'
        });
        decision.assignedFunctions = 'not-an-array';
        const result = validateDecision(decision);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('assignedFunctions'))).toBe(true);
    });
});

describe('boundaryChoice derivation', () => {
    it('getDecisionKey produces consistent keys', () => {
        fc.assert(fc.property(
            fc.stringMatching(/^[0-9]{1,3}$/),
            fc.string({ minLength: 1, maxLength: 30 }),
            (funcId, successor) => {
                const key = getDecisionKey(funcId, successor);
                expect(key).toBe(`${funcId}::${successor}`);
                expect(key.split('::').length).toBeGreaterThanOrEqual(2);
            }
        ));
    });
});

describe('computeDerivedBoundary', () => {
    it('returns none for defer regardless of other params', () => {
        fc.assert(fc.property(
            fc.boolean(),
            fc.boolean(),
            fc.boolean(),
            fc.array(fc.string(), { minLength: 0, maxLength: 3 }),
            (hasExisting, isDisagg, hasMultiple, shared) => {
                const result = computeDerivedBoundary({
                    systemChoice: 'defer',
                    sharedWithSuccessors: shared,
                    hasExistingSharedWith: hasExisting,
                    isDisaggregation: isDisagg,
                    hasMultipleSuccessors: hasMultiple
                });
                expect(result).toBe('none');
            }
        ));
    });

    it('returns establish-shared when linked and no existing sharedWith', () => {
        fc.assert(fc.property(
            fc.constantFrom('choose', 'procure'),
            fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 3 }),
            (choice, shared) => {
                const result = computeDerivedBoundary({
                    systemChoice: choice,
                    sharedWithSuccessors: shared,
                    hasExistingSharedWith: false,
                    isDisaggregation: false,
                    hasMultipleSuccessors: true
                });
                expect(result).toBe('establish-shared');
            }
        ));
    });

    it('returns maintain-shared when linked and has existing sharedWith', () => {
        fc.assert(fc.property(
            fc.constantFrom('choose', 'procure'),
            fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 3 }),
            (choice, shared) => {
                const result = computeDerivedBoundary({
                    systemChoice: choice,
                    sharedWithSuccessors: shared,
                    hasExistingSharedWith: true,
                    isDisaggregation: false,
                    hasMultipleSuccessors: true
                });
                expect(result).toBe('maintain-shared');
            }
        ));
    });

    it('returns disaggregate for partial predecessor with no sharing', () => {
        fc.assert(fc.property(
            fc.constantFrom('choose', 'procure'),
            (choice) => {
                const result = computeDerivedBoundary({
                    systemChoice: choice,
                    sharedWithSuccessors: [],
                    hasExistingSharedWith: false,
                    isDisaggregation: true,
                    hasMultipleSuccessors: true
                });
                expect(result).toBe('disaggregate');
            }
        ));
    });

    it('returns none when single successor', () => {
        fc.assert(fc.property(
            fc.constantFrom('choose', 'procure'),
            (choice) => {
                const result = computeDerivedBoundary({
                    systemChoice: choice,
                    sharedWithSuccessors: [],
                    hasExistingSharedWith: false,
                    isDisaggregation: false,
                    hasMultipleSuccessors: false
                });
                expect(result).toBe('none');
            }
        ));
    });
});
