/**
 * Scenario Manager — Export and import simulation scenario snapshots.
 *
 * A scenario is a snapshot of all FunctionDecisions made in a simulation
 * session. It can be saved as a JSON file and loaded back to restore the
 * decision state for a matching transition structure.
 *
 * exportScenario() — reads state, triggers browser download (impure)
 * importScenario() — pure; parses + validates JSON string, returns Map + warnings
 * validateScenarioEnvelope() — pure; structural validation only
 */

import { state } from '../state.js';
import { getDecisionKey } from '../simulation/decisions.js';

/**
 * Valid systemChoice values for a FunctionDecision.
 * @type {string[]}
 */
const VALID_SYSTEM_CHOICES = ['choose', 'procure', 'defer'];

/**
 * Validates the structural shape of a parsed scenario envelope.
 *
 * @param {*} parsed — the result of JSON.parse()
 * @returns {{ valid: true } | { valid: false, errors: string[] }}
 */
export function validateScenarioEnvelope(parsed) {
    const errors = [];

    if (!parsed || typeof parsed !== 'object') {
        return { valid: false, errors: ['Scenario must be a JSON object'] };
    }

    if (parsed.type !== 'lgr-scenario') {
        errors.push(`Expected type "lgr-scenario", got ${JSON.stringify(parsed.type)}`);
    }

    if (!Array.isArray(parsed.decisions)) {
        errors.push('decisions must be an array');
    } else {
        parsed.decisions.forEach((d, i) => {
            if (!d || typeof d !== 'object') {
                errors.push(`decisions[${i}]: must be an object`);
                return;
            }
            if (!d.functionId || typeof d.functionId !== 'string') {
                errors.push(`decisions[${i}]: functionId must be a non-empty string`);
            }
            if (!d.successorName || typeof d.successorName !== 'string') {
                errors.push(`decisions[${i}]: successorName must be a non-empty string`);
            }
            if (!VALID_SYSTEM_CHOICES.includes(d.systemChoice)) {
                errors.push(`decisions[${i}]: systemChoice must be one of ${VALID_SYSTEM_CHOICES.join(', ')}`);
            }
        });
    }

    if (errors.length > 0) {
        return { valid: false, errors };
    }

    return { valid: true };
}

/**
 * Imports a scenario from a JSON string and validates it against the current
 * transition context. Pure — does not mutate state or trigger recomputation.
 *
 * @param {string} jsonString — raw JSON text from a scenario file
 * @param {{ lgaFunctionMap: Map, transitionStructure: Object|null }} context
 * @returns {{ decisions: Map<string, FunctionDecision>, warnings: string[] }}
 * @throws {Error} if the JSON is unparseable or the envelope is structurally invalid
 */
export function importScenario(jsonString, { lgaFunctionMap, transitionStructure }) {
    // --- 1. Parse ---
    let parsed;
    try {
        parsed = JSON.parse(jsonString);
    } catch (e) {
        throw new Error(`Invalid JSON: ${e.message}`);
    }

    // --- 2. Validate type ---
    if (!parsed || typeof parsed !== 'object' || parsed.type !== 'lgr-scenario') {
        throw new Error(
            `Not a valid scenario file: expected type "lgr-scenario", got ${JSON.stringify(parsed && parsed.type)}`
        );
    }

    // --- 3. Validate decisions array ---
    if (!Array.isArray(parsed.decisions)) {
        throw new Error('Scenario file is missing a valid decisions array');
    }

    // --- 4. Validate individual decisions; throw if any are completely invalid ---
    const hardErrors = [];
    parsed.decisions.forEach((d, i) => {
        const missingFields = [];
        if (!d || typeof d !== 'object') {
            hardErrors.push(`decisions[${i}]: must be an object`);
            return;
        }
        if (!d.functionId || typeof d.functionId !== 'string') missingFields.push('functionId');
        if (!d.successorName || typeof d.successorName !== 'string') missingFields.push('successorName');
        if (!VALID_SYSTEM_CHOICES.includes(d.systemChoice)) missingFields.push('systemChoice');

        // Only a hard error if ALL three required fields are missing/invalid
        if (missingFields.length === 3) {
            hardErrors.push(`decisions[${i}]: missing all required fields (functionId, successorName, systemChoice)`);
        }
    });

    if (hardErrors.length > 0) {
        throw new Error(`Scenario contains invalid decisions:\n${hardErrors.join('\n')}`);
    }

    // --- 5. Cross-reference warnings ---
    const warnings = [];

    const knownFunctionIds = lgaFunctionMap ? new Set(lgaFunctionMap.keys()) : null;
    const knownSuccessorNames = transitionStructure
        ? new Set((transitionStructure.successors || []).map(s => s.name))
        : null;

    parsed.decisions.forEach((d, i) => {
        if (knownFunctionIds && !knownFunctionIds.has(d.functionId)) {
            warnings.push(
                `decisions[${i}]: functionId "${d.functionId}" not found in current architecture`
            );
        }
        if (knownSuccessorNames && !knownSuccessorNames.has(d.successorName)) {
            warnings.push(
                `decisions[${i}]: successorName "${d.successorName}" not found in current transition structure`
            );
        }
    });

    // --- 6. Build Map (last-one-wins for duplicate keys) ---
    const decisionsMap = new Map(
        parsed.decisions.map(d => [getDecisionKey(d.functionId, d.successorName), d])
    );

    return { decisions: decisionsMap, warnings };
}

/**
 * Exports the current simulation decisions as a downloadable scenario JSON file.
 * Reads from state — impure. Triggers browser file download.
 *
 * @returns {void}
 */
export function exportScenario() {
    const decisionsMap = state.simulationState && state.simulationState.decisions
        ? state.simulationState.decisions
        : new Map();

    const decisionsArray = [...decisionsMap.values()];

    const envelope = {
        type: 'lgr-scenario',
        version: 1,
        exportedAt: new Date().toISOString(),
        metadata: {
            persona: state.activePersona,
            vestingDate: state.transitionStructure ? state.transitionStructure.vestingDate : null,
            successors: state.transitionStructure
                ? (state.transitionStructure.successors || []).map(s => s.name)
                : [],
            decisionCount: decisionsMap.size
        },
        decisions: decisionsArray
    };

    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = `scenario-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
}
