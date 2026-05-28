/**
 * Apply Decision — reads panel form state, derives boundaryChoice, validates,
 * stores decision, creates propagated decisions, calls recompute.
 */

import { state } from '../../state.js';
import { escHtml } from '../../ui-helpers.js';
import { createDecision, getDecisionKey, validateDecision } from '../../simulation/decisions.js';
import { computeDerivedBoundary } from './helpers.js';
import { recomputeSimulation } from '../simulation-panel.js';
import { showConfirm } from '../../ui-notifications.js';

/**
 * Reads form state from the new successor-first panel layout and applies the decision.
 *
 * @param {Object} params
 * @param {string} params.functionId
 * @param {string} params.successorName - primary successor
 * @param {Array} params.systems - competing systems in cell
 * @param {Function} params.closePanel - callback to close the modal
 * @param {Function} params.showError - callback to show error message
 * @returns {Promise<boolean>} true if applied successfully
 */
export async function applyDecisionFromPanel({ functionId, successorName, systems, closePanel, showError }) {
    if (!state.simulationState) return false;

    const content = document.getElementById('decisionPanelContent');
    if (!content) return false;

    // Read primary successor's dropdown
    const primaryCard = content.querySelector(`.successor-card[data-is-primary="true"]`);
    if (!primaryCard) {
        showError('Could not find primary successor card.');
        return false;
    }

    const select = primaryCard.querySelector('.successor-system-select');
    if (!select || !select.value) {
        showError('Please select a system for the primary successor.');
        return false;
    }

    const selectValue = select.value;

    // Determine systemChoice and details
    let systemChoice;
    let retainedSystemIds = [];
    let procuredSystem = null;

    if (selectValue === '__defer__') {
        systemChoice = 'defer';
    } else if (selectValue === '__procure__') {
        systemChoice = 'procure';
        const labelField = primaryCard.querySelector('.procure-field[data-field="label"]');
        const label = labelField ? labelField.value.trim() : '';
        if (!label) {
            showError('Please enter a system name for the procured replacement.');
            if (labelField) labelField.focus();
            return false;
        }
        const vendorField = primaryCard.querySelector('.procure-field[data-field="vendor"]');
        const costField = primaryCard.querySelector('.procure-field[data-field="annualCost"]');
        const hostingField = primaryCard.querySelector('.procure-field[data-field="hosting"]');

        procuredSystem = {
            label,
            vendor: vendorField ? vendorField.value.trim() : '',
            annualCost: costField && costField.value ? Number(costField.value) : 0,
            hosting: hostingField ? hostingField.value : 'cloud'
        };
    } else if (selectValue === '') {
        showError('Please select a system.');
        return false;
    } else {
        systemChoice = 'choose';
        retainedSystemIds = [selectValue];
    }

    // Read shared successors from checkboxes
    const sharedCbs = content.querySelectorAll('.share-successor-cb:checked');
    const sharedWithSuccessors = [...sharedCbs].map(cb => cb.dataset.successor);

    // Read rationale
    const rationaleEl = content.querySelector('#decisionRationale');
    const rationale = rationaleEl ? rationaleEl.value.trim() || null : null;

    // Derive boundaryChoice
    const chosenSystem = systemChoice === 'choose' ? systems.find(s => s.id === retainedSystemIds[0]) : null;
    const hasExistingSharedWith = chosenSystem && chosenSystem.sharedWith && chosenSystem.sharedWith.length > 0;
    const isDisaggregation = chosenSystem ? (chosenSystem.isDisaggregation || false) : false;
    const hasMultipleSuccessors = (state.transitionStructure?.successors?.length || 0) > 1;

    const boundaryChoice = computeDerivedBoundary({
        systemChoice,
        sharedWithSuccessors,
        hasExistingSharedWith,
        isDisaggregation,
        hasMultipleSuccessors
    });

    // --- Cascade delete: if old decision had sharedWithSuccessors, remove propagated ---
    const currentKey = getDecisionKey(functionId, successorName);
    const oldDecision = state.simulationState.decisions.get(currentKey);
    if (oldDecision && oldDecision.sharedWithSuccessors && oldDecision.sharedWithSuccessors.length > 0) {
        for (const oldSharedSuccessor of oldDecision.sharedWithSuccessors) {
            const oldPropKey = getDecisionKey(functionId, oldSharedSuccessor);
            const oldPropDecision = state.simulationState.decisions.get(oldPropKey);
            if (oldPropDecision && oldPropDecision.sharedServiceOrigin === currentKey) {
                state.simulationState.decisions.delete(oldPropKey);
            }
        }
    }

    // --- Conflict check for establish-shared ---
    if (boundaryChoice === 'establish-shared' && sharedWithSuccessors.length > 0) {
        for (const sharedSuccessor of sharedWithSuccessors) {
            const targetKey = getDecisionKey(functionId, sharedSuccessor);
            const targetDecision = state.simulationState.decisions.get(targetKey);
            if (targetDecision && !targetDecision.sharedServiceOrigin) {
                showError(`${sharedSuccessor} already has an independent decision for this function. Remove it before establishing a shared service.`);
                return false;
            }
        }
    }

    // --- Confirmation for establish-shared ---
    if (boundaryChoice === 'establish-shared' && sharedWithSuccessors.length > 0) {
        let systemLabel;
        if (systemChoice === 'choose' && retainedSystemIds.length > 0) {
            const sys = systems.find(s => s.id === retainedSystemIds[0]);
            systemLabel = sys ? sys.label : retainedSystemIds[0];
        } else if (systemChoice === 'procure' && procuredSystem) {
            systemLabel = procuredSystem.label;
        } else {
            systemLabel = 'selected system';
        }

        const funcEntry = state.lgaFunctionMap ? state.lgaFunctionMap.get(functionId) : null;
        const funcLabel = funcEntry ? funcEntry.label : functionId;

        const lines = [`${successorName} (primary)`];
        for (const sharedSuccessor of sharedWithSuccessors) {
            let decommCount = 0;
            if (state.simulationState && state.simulationState.baselineAllocation) {
                const succMap = state.simulationState.baselineAllocation.get(sharedSuccessor);
                if (succMap) {
                    const allocations = succMap.get(functionId);
                    if (allocations) {
                        const chosenId = retainedSystemIds.length > 0 ? retainedSystemIds[0] : null;
                        decommCount = allocations.filter(a => a.system && a.system.id !== chosenId).length;
                    }
                }
            }
            const decommNote = decommCount > 0 ? ` (${decommCount} system${decommCount !== 1 ? 's' : ''} to be decommissioned)` : ' (no existing systems)';
            lines.push(`${sharedSuccessor}${decommNote}`);
        }

        const confirmMsg = `${systemLabel} will become the shared system for ${funcLabel} across: ${lines.join(', ')}. This will decommission competing systems in all listed successors.`;

        const confirmed = await showConfirm({
            containerId: 'decisionPanelNotifications',
            title: 'Establish shared service?',
            message: confirmMsg,
            confirmLabel: 'Establish',
            cancelLabel: 'Cancel'
        });
        if (!confirmed) return false;
    }

    // --- Pre-generate procured system ID for shared propagation ---
    if (boundaryChoice === 'establish-shared' && systemChoice === 'procure' && procuredSystem) {
        const slug = successorName.replace(/\s+/g, '-').toLowerCase();
        procuredSystem.id = `sys-procured-${functionId}-${slug}-${Date.now()}`;
    }

    // Create the primary decision
    const decision = createDecision({
        functionId,
        successorName,
        systemChoice,
        retainedSystemIds,
        procuredSystem,
        boundaryChoice,
        disaggregationSplits: [],
        sharedWithSuccessors,
        rationale
    });

    const validation = validateDecision(decision);
    if (!validation.valid) {
        showError('Validation failed: ' + validation.errors.join(', '));
        return false;
    }

    // Store primary decision
    state.simulationState.decisions.set(currentKey, decision);

    // --- Create propagated decisions for shared successors ---
    if (boundaryChoice === 'establish-shared' && sharedWithSuccessors.length > 0) {
        let propagatedRetainedIds;
        if (systemChoice === 'choose') {
            propagatedRetainedIds = [...retainedSystemIds];
        } else if (systemChoice === 'procure') {
            propagatedRetainedIds = [procuredSystem.id];
        } else {
            propagatedRetainedIds = [];
        }

        for (const sharedSuccessor of sharedWithSuccessors) {
            const propagatedDecision = createDecision({
                functionId,
                successorName: sharedSuccessor,
                systemChoice: 'choose',
                retainedSystemIds: propagatedRetainedIds,
                procuredSystem: null,
                boundaryChoice: 'establish-shared',
                disaggregationSplits: [],
                sharedWithSuccessors: [],
                sharedServiceOrigin: currentKey,
                contractExtensions: []
            });

            const propKey = getDecisionKey(functionId, sharedSuccessor);
            state.simulationState.decisions.set(propKey, propagatedDecision);
        }
    }

    recomputeSimulation();
    closePanel();
    return true;
}
