/**
 * Property tests for the scenario save/load roundtrip.
 *
 * Tests that:
 * - Exported scenario envelopes can be re-imported with full fidelity
 * - validateScenarioEnvelope rejects envelopes with wrong type or missing decisions
 * - importScenario throws on decisions missing all required fields
 * - Unknown function IDs produce warnings, not errors
 * - Duplicate decision keys: last one wins
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { importScenario, validateScenarioEnvelope } from '../../src/features/scenario-manager.js';
import { getDecisionKey } from '../../src/simulation/decisions.js';

// --- Inline generators ---

const arbFunctionId = fc.constantFrom('1', '2', '3', '4', '5', '148', '150');
const arbSuccessorName = fc.constantFrom('Successor-A', 'Successor-B', 'Successor-C');
const arbSystemChoice = fc.constantFrom('choose', 'procure', 'defer');

const arbDecision = fc.record({
    id: fc.stringMatching(/^dec-[a-z0-9]{3,12}$/),
    functionId: arbFunctionId,
    successorName: arbSuccessorName,
    timestamp: fc.constant(new Date().toISOString()),
    systemChoice: arbSystemChoice,
    retainedSystemIds: fc.array(fc.stringMatching(/^sys-[a-z0-9]{3,8}$/), { maxLength: 3 }),
    procuredSystem: fc.constant(null),
    boundaryChoice: fc.constantFrom('none', 'disaggregate', 'maintain-shared', 'establish-shared'),
    disaggregationSplits: fc.constant([]),
    sharedWithSuccessors: fc.constant([]),
    sharedServiceOrigin: fc.constant(null),
    contractExtensions: fc.constant([])
});

// lgaFunctionMap covering all IDs used in arbDecision
const arbLgaFunctionMap = fc.constant(
    new Map([
        ['1',   { label: 'F1' }],
        ['2',   { label: 'F2' }],
        ['3',   { label: 'F3' }],
        ['4',   { label: 'F4' }],
        ['5',   { label: 'F5' }],
        ['148', { label: 'ASC' }],
        ['150', { label: 'Waste' }]
    ])
);

// transitionStructure covering all successor names used in arbDecision
const arbTransitionStructure = fc.constant({
    vestingDate: '2027-04-01',
    successors: [
        { name: 'Successor-A' },
        { name: 'Successor-B' },
        { name: 'Successor-C' }
    ]
});

/**
 * Builds a minimal but well-formed scenario envelope from an array of decisions.
 */
function buildEnvelope(decisions) {
    return {
        type: 'lgr-scenario',
        version: 1,
        exportedAt: new Date().toISOString(),
        metadata: {
            persona: 'executive',
            vestingDate: '2027-04-01',
            successors: ['Successor-A', 'Successor-B', 'Successor-C'],
            decisionCount: decisions.length
        },
        decisions
    };
}

describe('Scenario Roundtrip — Property Tests', () => {

    it('Property: roundtrip fidelity — every exported decision is importable with correct values', () => {
        fc.assert(
            fc.property(
                fc.array(arbDecision, { minLength: 1, maxLength: 10 }),
                arbLgaFunctionMap,
                arbTransitionStructure,
                (decisions, lgaFunctionMap, transitionStructure) => {
                    const envelope = buildEnvelope(decisions);
                    const json = JSON.stringify(envelope);

                    const result = importScenario(json, { lgaFunctionMap, transitionStructure });

                    // No hard errors — result must be returned
                    expect(result).toBeDefined();
                    expect(result.decisions).toBeInstanceOf(Map);
                    expect(Array.isArray(result.warnings)).toBe(true);

                    // Build a "last-one-wins" reference map for duplicate keys
                    // (matches importScenario's contract)
                    const expectedMap = new Map(
                        decisions.map(d => [getDecisionKey(d.functionId, d.successorName), d])
                    );

                    // Every key that survived deduplication must be in the result
                    expectedMap.forEach((expected, key) => {
                        const stored = result.decisions.get(key);
                        expect(stored).toBeTruthy();
                        expect(stored.functionId).toBe(expected.functionId);
                        expect(stored.successorName).toBe(expected.successorName);
                        expect(stored.systemChoice).toBe(expected.systemChoice);
                    });

                    // Result map size must equal the deduplicated count
                    expect(result.decisions.size).toBe(expectedMap.size);
                }
            ),
            { numRuns: 50 }
        );
    });

    it('Property: validateScenarioEnvelope rejects envelopes with wrong type field', () => {
        fc.assert(
            fc.property(
                // Generate any string except 'lgr-scenario'
                fc.string().filter(s => s !== 'lgr-scenario'),
                fc.array(arbDecision, { maxLength: 3 }),
                (wrongType, decisions) => {
                    const envelope = {
                        type: wrongType,
                        version: 1,
                        exportedAt: new Date().toISOString(),
                        metadata: {},
                        decisions
                    };

                    const result = validateScenarioEnvelope(envelope);
                    expect(result.valid).toBe(false);
                    expect(Array.isArray(result.errors)).toBe(true);
                    expect(result.errors.length).toBeGreaterThan(0);
                }
            ),
            { numRuns: 50 }
        );
    });

    it('Property: validateScenarioEnvelope rejects envelopes where decisions is not an array', () => {
        fc.assert(
            fc.property(
                // Generate non-array values for decisions
                fc.oneof(
                    fc.constant(null),
                    fc.constant(undefined),
                    fc.string(),
                    fc.integer(),
                    fc.record({ key: fc.string() })
                ),
                (nonArrayDecisions) => {
                    const envelope = {
                        type: 'lgr-scenario',
                        version: 1,
                        exportedAt: new Date().toISOString(),
                        metadata: {},
                        decisions: nonArrayDecisions
                    };

                    const result = validateScenarioEnvelope(envelope);
                    expect(result.valid).toBe(false);
                    expect(Array.isArray(result.errors)).toBe(true);
                    expect(result.errors.length).toBeGreaterThan(0);
                }
            ),
            { numRuns: 50 }
        );
    });

    it('Property: importScenario throws on decisions missing all required fields', () => {
        fc.assert(
            fc.property(
                // Generate a decision that is missing all three required fields
                fc.record({
                    id: fc.stringMatching(/^dec-[a-z0-9]{3,12}$/),
                    timestamp: fc.constant(new Date().toISOString()),
                    retainedSystemIds: fc.constant([]),
                    contractExtensions: fc.constant([])
                    // functionId, successorName, systemChoice all absent
                }),
                (badDecision) => {
                    const envelope = buildEnvelope([badDecision]);
                    const json = JSON.stringify(envelope);

                    expect(() => {
                        importScenario(json, { lgaFunctionMap: new Map(), transitionStructure: null });
                    }).toThrow();
                }
            ),
            { numRuns: 50 }
        );
    });

    it('Property: unknown function IDs produce warnings, not errors', () => {
        fc.assert(
            fc.property(
                fc.array(arbDecision, { minLength: 1, maxLength: 5 }),
                (decisions) => {
                    // Use an EMPTY lgaFunctionMap so all function IDs are unknown
                    const emptyFunctionMap = new Map();

                    const envelope = buildEnvelope(decisions);
                    const json = JSON.stringify(envelope);

                    // Should NOT throw
                    let result;
                    expect(() => {
                        result = importScenario(json, {
                            lgaFunctionMap: emptyFunctionMap,
                            transitionStructure: null
                        });
                    }).not.toThrow();

                    // Warnings must be non-empty (one per decision since all IDs are unknown)
                    expect(result.warnings.length).toBeGreaterThan(0);

                    // Map is still returned with valid entries
                    expect(result.decisions).toBeInstanceOf(Map);
                    expect(result.decisions.size).toBeGreaterThan(0);
                }
            ),
            { numRuns: 50 }
        );
    });

    it('Property: duplicate decision keys — last one wins', () => {
        fc.assert(
            fc.property(
                arbFunctionId,
                arbSuccessorName,
                arbSystemChoice,
                arbSystemChoice,
                (functionId, successorName, firstChoice, secondChoice) => {
                    const decisionFirst = {
                        id: 'dec-first',
                        functionId,
                        successorName,
                        timestamp: new Date().toISOString(),
                        systemChoice: firstChoice,
                        retainedSystemIds: [],
                        procuredSystem: null,
                        boundaryChoice: 'none',
                        disaggregationSplits: [],
                        sharedWithSuccessors: [],
                        sharedServiceOrigin: null,
                        contractExtensions: []
                    };

                    const decisionSecond = {
                        id: 'dec-second',
                        functionId,
                        successorName,
                        timestamp: new Date().toISOString(),
                        systemChoice: secondChoice,
                        retainedSystemIds: [],
                        procuredSystem: null,
                        boundaryChoice: 'none',
                        disaggregationSplits: [],
                        sharedWithSuccessors: [],
                        sharedServiceOrigin: null,
                        contractExtensions: []
                    };

                    const envelope = buildEnvelope([decisionFirst, decisionSecond]);
                    const json = JSON.stringify(envelope);

                    const result = importScenario(json, {
                        lgaFunctionMap: new Map([[functionId, { label: 'Test' }]]),
                        transitionStructure: {
                            vestingDate: '2027-04-01',
                            successors: [{ name: successorName }]
                        }
                    });

                    // Map should have exactly 1 entry for this key
                    expect(result.decisions.size).toBe(1);

                    // The stored decision should be the second one (last-one-wins)
                    const key = getDecisionKey(functionId, successorName);
                    const stored = result.decisions.get(key);
                    expect(stored).toBeDefined();
                    expect(stored.id).toBe('dec-second');
                    expect(stored.systemChoice).toBe(secondChoice);
                }
            ),
            { numRuns: 50 }
        );
    });

});
