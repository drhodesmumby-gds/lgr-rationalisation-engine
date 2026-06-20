/**
 * Pane 1 — System context and function navigation.
 *
 * State 1 (simple): renders system comparison cards.
 * State 2 (expanded): renders compact system info + function navigator list.
 */

import { state } from '../../state.js';
import { escHtml } from '../../ui-helpers.js';
import { renderSystemCard, findAllFunctionsForSystem } from './helpers.js';
import { getDecisionKey } from '../../simulation/decisions.js';

/**
 * Renders Pane 1 for State 1 (simple case): system comparison cards.
 *
 * @param {Array} systems - competing systems in the cell
 * @param {string|null} vestingDate
 * @returns {string} HTML
 */
export function renderPane1Simple(systems, vestingDate) {
    if (!systems || systems.length === 0) {
        return `
            <div class="pane-label">Systems</div>
            <div class="p-4 bg-[#f3f2f1] border border-[#b1b4b6] text-sm text-gray-600 italic">
                No systems allocated to this function for this successor.
            </div>`;
    }

    const cards = systems.map(sys => renderSystemCard(sys, vestingDate)).join('');

    return `
        <div class="pane-label">Competing Systems (${systems.length})</div>
        <div class="flex flex-col gap-3">
            ${cards}
        </div>
    `;
}

/**
 * Renders Pane 1 for State 2 (expanded): hierarchical list of systems and their functions.
 *
 * @param {Array} systems - the competing systems
 * @param {string} currentFunctionId - currently selected function
 * @param {string} successorName - primary successor
 * @param {string|null} vestingDate
 * @param {Object} [pendingPerFunction] - map of funcId → pending form state for unsaved decisions
 * @returns {string} HTML
 */
export function renderPane1Expanded(systems, currentFunctionId, successorName, vestingDate, pendingPerFunction) {
    const decisions = state.simulationState ? state.simulationState.decisions : new Map();

    // Sort systems from most to least entangled
    const sortedSystems = [...systems].sort((a, b) => {
        const lenA = findAllFunctionsForSystem(a, successorName).length;
        const lenB = findAllFunctionsForSystem(b, successorName).length;
        return lenB - lenA;
    });

    const systemBlocks = sortedSystems.map(sys => {
        const systemCardHtml = renderSystemCard(sys, vestingDate, { compact: true });
        const functions = findAllFunctionsForSystem(sys, successorName);
        
        // Sort so the currently edited function is pinned to the top
        const sortedFunctions = [...functions].sort((a, b) => {
            if (a.funcId === currentFunctionId) return -1;
            if (b.funcId === currentFunctionId) return 1;
            return a.label.localeCompare(b.label);
        });

        const funcRows = sortedFunctions.map(f => {
            const isCurrent = f.funcId === currentFunctionId;
            const key = getDecisionKey(f.funcId, successorName);
            const existing = decisions.get(key);

            const pendingState = pendingPerFunction && pendingPerFunction[f.funcId];
            const hasPendingSystem = pendingState && pendingState.primarySystemValue && pendingState.primarySystemValue !== '';

            let statusBadge;
            if (isCurrent) {
                statusBadge = '<span class="text-[9px] px-1.5 py-0.5 font-bold bg-[#f0f4ff] text-[#1d70b8]">Editing</span>';
            } else if (existing && existing.resolvedVia) {
                statusBadge = '<span class="text-[9px] px-1.5 py-0.5 font-bold bg-[#f3f2f1] text-[#505a5f]">Resolved</span>';
            } else if (existing && existing.sharedServiceOrigin) {
                statusBadge = '<span class="text-[9px] px-1.5 py-0.5 font-bold bg-[#cce2d8] text-[#00703c]">Shared ✓</span>';
            } else if (existing) {
                statusBadge = '<span class="text-[9px] px-1.5 py-0.5 font-bold bg-[#cce2d8] text-[#00703c]">Done ✓</span>';
            } else if (hasPendingSystem) {
                statusBadge = '<span class="text-[9px] px-1.5 py-0.5 font-bold bg-[#fde68a] text-[#0b0c0c]">Configured</span>';
            } else {
                statusBadge = '<span class="text-[9px] px-1.5 py-0.5 font-bold bg-[#f3f2f1] text-[#505a5f]">Pending</span>';
            }

            const selectedClass = isCurrent ? 'border-[#1d70b8] bg-[#f0f4ff] border-2' : 'border border-[#b1b4b6] bg-[#fafafa]';

            return `
                <div class="flex items-center p-1.5 ${selectedClass} mb-0.5 cursor-pointer text-xs func-nav-row" data-func-id="${escHtml(f.funcId)}">
                    <span class="flex-1 font-semibold text-[11px] leading-tight pr-1">${escHtml(f.label)}</span>
                    ${statusBadge}
                </div>`;
        }).join('');

        const isErp = sys.isERP || false;
        const decommNote = isErp
            ? `<div class="mt-1 p-1.5 bg-[#fff7e6] border-l-4 border-l-[#f47738] text-[10px]">
                <strong>ERP:</strong> Decommissioned when all ${functions.length} functions resolved away.
               </div>`
            : '';

        const entanglementBadge = functions.length > 3 
            ? `<div class="mb-1.5 mt-1 text-[10px] font-bold text-[#d4351c] bg-[#fdf3f2] p-1 inline-block border border-[#d4351c]">Highly entangled (${functions.length} functions)</div>`
            : '';

        return `
            <div class="mb-4">
                <div class="font-bold text-[13px] mb-0.5 leading-tight">${escHtml(sys.label || 'Unnamed')}</div>
                <div class="text-[10px] text-gray-500 mb-1.5">${escHtml(sys.sourceCouncil || sys._sourceCouncil || '')}</div>
                ${systemCardHtml}
                <div class="mt-2 pl-2 border-l-2 border-[#b1b4b6]">
                    <div class="text-[9px] font-bold uppercase text-[#505a5f] mb-1">Functions served</div>
                    ${entanglementBadge}
                    <div class="pr-1">
                        ${funcRows}
                    </div>
                    ${decommNote}
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="pane-label">Competing Systems</div>
        <div class="mt-2">
            ${systemBlocks}
        </div>
    `;
}
