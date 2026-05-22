/**
 * Generators for unified editor module tests.
 *
 * Provides:
 *  - arbITSystemNode()  — ITSystem node with valid fields (no _sourceCouncil, for editor context)
 *  - arbFunctionNode()  — Function node with a valid LGA function ID drawn from the real taxonomy
 *  - arbEditorState()   — Full editorState: nodes (Functions + ITSystems) + REALIZES edges
 */

import fc from 'fast-check';
import { LGA_FUNCTIONS } from '../../src/constants/lga-functions.js';

// Leaf-only LGA function IDs — functions that have at least one entry in the taxonomy.
// We use the real array so generated states are internally consistent with taxonomy lookups.
const LGA_FUNCTION_IDS = LGA_FUNCTIONS.map(f => f.id);

// A small, stable pool of vendors to keep tests readable and deterministic.
const VENDORS = ['Civica', 'NEC', 'Capita', 'System C', 'Idox', 'Microsoft', 'SAP', 'In-House', 'Oracle'];

/**
 * Generates a single ITSystem node for use inside an editorState.
 * Unlike arbITSystem, this does NOT include _sourceCouncil — editors operate on
 * a single council's architecture where provenance is implicit.
 */
export function arbITSystemNode() {
    return fc.record({
        id: fc.uuid().map(u => `sys-${u}`),
        label: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{2,28}$/),
        type: fc.constant('ITSystem'),

        // All optional — mirrors the real schema
        vendor: fc.option(fc.constantFrom(...VENDORS), { nil: undefined }),
        users: fc.option(fc.integer({ min: 1, max: 50000 }), { nil: undefined }),
        annualCost: fc.option(fc.integer({ min: 1000, max: 5000000 }), { nil: undefined }),
        endYear: fc.option(fc.integer({ min: 2024, max: 2035 }), { nil: undefined }),
        endMonth: fc.option(fc.integer({ min: 1, max: 12 }), { nil: undefined }),
        noticePeriod: fc.option(fc.integer({ min: 0, max: 24 }), { nil: undefined }),
        portability: fc.option(fc.constantFrom('High', 'Medium', 'Low'), { nil: undefined }),
        dataPartitioning: fc.option(fc.constantFrom('Segmented', 'Monolithic'), { nil: undefined }),
        isCloud: fc.option(fc.boolean(), { nil: undefined }),
        isERP: fc.option(fc.boolean(), { nil: undefined }),
        supportModel: fc.option(
            fc.constantFrom('vendor-supported', 'community-supported', 'unsupported'),
            { nil: undefined }
        ),
        sharedWith: fc.option(
            fc.array(fc.stringMatching(/^[A-Za-z ]{4,20}$/), { minLength: 0, maxLength: 3 }),
            { nil: undefined }
        ),
        capabilityType: fc.option(
            fc.array(fc.constantFrom('payments', 'forms', 'sms', 'notifications'), { minLength: 0, maxLength: 3 }),
            { nil: undefined }
        ),
    }).map(rec => {
        const cleaned = {};
        for (const [k, v] of Object.entries(rec)) {
            if (v !== undefined) cleaned[k] = v;
        }
        return cleaned;
    });
}

/**
 * Generates a single Function node with a valid lgaFunctionId drawn from the real taxonomy.
 */
export function arbFunctionNode() {
    return fc.record({
        id: fc.uuid().map(u => `fn-${u}`),
        type: fc.constant('Function'),
        lgaFunctionId: fc.constantFrom(...LGA_FUNCTION_IDS),
    }).map(rec => {
        const lgaEntry = LGA_FUNCTIONS.find(f => f.id === rec.lgaFunctionId);
        return {
            id: rec.id,
            type: 'Function',
            label: lgaEntry ? lgaEntry.label : `Function ${rec.lgaFunctionId}`,
            lgaFunctionId: rec.lgaFunctionId,
        };
    });
}

/**
 * Generates a valid editorState with:
 *  - 0–3 Function nodes (unique lgaFunctionIds)
 *  - 1–5 ITSystem nodes
 *  - REALIZES edges pairing systems to functions (round-robin when functions exist)
 *  - councilName and councilMetadata
 *
 * Produces states that exercise grouping, search, and completeness logic
 * in list-panel, bulk-mode, and props-panel.
 */
export function arbEditorState() {
    const arbFunctionCount = fc.integer({ min: 0, max: 3 });
    const arbSystemCount = fc.integer({ min: 1, max: 5 });

    return fc.tuple(arbFunctionCount, arbSystemCount).chain(([fnCount, sysCount]) => {
        // Build unique function nodes
        const arbFunctions = fnCount === 0
            ? fc.constant([])
            : fc.uniqueArray(
                fc.constantFrom(...LGA_FUNCTION_IDS),
                { minLength: fnCount, maxLength: fnCount, comparator: (a, b) => a === b }
            ).map(ids =>
                ids.map(lgaId => {
                    const lgaEntry = LGA_FUNCTIONS.find(f => f.id === lgaId);
                    return {
                        id: `fn-${lgaId}`,
                        type: 'Function',
                        label: lgaEntry ? lgaEntry.label : `Function ${lgaId}`,
                        lgaFunctionId: lgaId,
                    };
                })
            );

        const arbSystems = fc.array(arbITSystemNode(), { minLength: sysCount, maxLength: sysCount });

        return fc.tuple(arbFunctions, arbSystems).map(([functions, systems]) => {
            const nodes = [...functions, ...systems];

            // Wire REALIZES edges: each system gets one edge to a function if functions exist
            const edges = [];
            if (functions.length > 0) {
                systems.forEach((sys, i) => {
                    const fn = functions[i % functions.length];
                    edges.push({ source: sys.id, target: fn.id, relationship: 'REALIZES' });
                });
            }

            return {
                councilName: 'Test Council',
                councilMetadata: { tier: 'district', financialDistress: false },
                nodes,
                edges,
            };
        });
    });
}

/**
 * Generates a fully-populated ITSystem node — all key analysis fields present.
 * Useful for completeness boundary tests.
 */
export function arbCompleteITSystemNode() {
    return fc.record({
        id: fc.uuid().map(u => `sys-${u}`),
        label: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{2,28}$/),
        type: fc.constant('ITSystem'),
        vendor: fc.constantFrom(...VENDORS),
        annualCost: fc.integer({ min: 1000, max: 5000000 }),
        endYear: fc.integer({ min: 2024, max: 2035 }),
        portability: fc.constantFrom('High', 'Medium', 'Low'),
        dataPartitioning: fc.constantFrom('Segmented', 'Monolithic'),
        isCloud: fc.boolean(),
        supportModel: fc.constantFrom('vendor-supported', 'community-supported', 'unsupported'),
    });
}

/**
 * Generates an ITSystem node with all key analysis fields absent (empty).
 * Useful for verifying the "mostly empty" completeness tier.
 */
export function arbEmptyITSystemNode() {
    return fc.record({
        id: fc.uuid().map(u => `sys-${u}`),
        label: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{2,28}$/),
        type: fc.constant('ITSystem'),
    });
}
