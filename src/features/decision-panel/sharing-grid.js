/**
 * Sharing Grid — checkbox matrix showing who participates in which function.
 *
 * The grid syncs bidirectionally with the "Share with..." toggles in the
 * successor cards. It provides the bird's-eye view across all functions.
 */

import { state } from '../../state.js';
import { escHtml } from '../../ui-helpers.js';
import { LGA_FUNCTIONS } from '../../constants/lga-functions.js';
import { getDecisionKey } from '../../simulation/decisions.js';

/**
 * Computes the grid state: for each (function, successor) pair, returns
 * true (checked), false (unchecked), or 'disabled' (function not yet decided).
 *
 * @param {Array<{funcId, label, systemLabel, decided}>} functions
 * @param {string} primarySuccessor
 * @param {string[]} otherSuccessors
 * @param {Map} decisions - the decisions map
 * @returns {Object} - { [funcId]: { [successorName]: true|false|'disabled' } }
 */
export function computeGridState(functions, primarySuccessor, otherSuccessors, decisions) {
    const grid = {};

    for (const func of functions) {
        grid[func.funcId] = {};
        grid[func.funcId][primarySuccessor] = true;

        for (const other of otherSuccessors) {
            if (!func.decided) {
                grid[func.funcId][other] = 'disabled';
            } else {
                const key = getDecisionKey(func.funcId, other);
                const dec = decisions.get(key);
                grid[func.funcId][other] = !!(dec && dec.sharedServiceOrigin);
            }
        }
    }

    return grid;
}

/**
 * Renders the sharing grid HTML.
 *
 * @param {Array<{funcId, label, systemLabel, decided}>} functions
 * @param {string} primarySuccessor
 * @param {string[]} otherSuccessors
 * @returns {string} HTML
 */
export function renderSharingGrid(functions, primarySuccessor, otherSuccessors) {
    const decisions = state.simulationState ? state.simulationState.decisions : new Map();
    const gridState = computeGridState(functions, primarySuccessor, otherSuccessors, decisions);

    let headerCells = '<th class="text-left"></th>';
    for (const func of functions) {
        const sysNote = func.systemLabel ? `<br><span style="font-size:9px;font-weight:normal;">(${escHtml(func.systemLabel)})</span>` : '';
        headerCells += `<th class="text-center">${escHtml(func.label)}${sysNote}</th>`;
    }
    headerCells += '<th class="text-center"><button class="bg-transparent border-2 border-dashed border-[#1d70b8] text-[#1d70b8] text-[9px] font-bold px-1.5 py-0.5 cursor-pointer add-func-btn">+ Func</button></th>';

    let rows = '';

    rows += `<tr class="bg-[#f0fdf4]"><td class="font-semibold text-left">${escHtml(primarySuccessor)}<br><span class="text-[9px] text-[#00703c] font-bold">Primary</span></td>`;
    for (const func of functions) {
        rows += `<td class="text-center"><input type="checkbox" checked disabled class="w-4 h-4"></td>`;
    }
    rows += '<td></td></tr>';

    for (const other of otherSuccessors) {
        rows += `<tr><td class="font-semibold text-left">${escHtml(other)}</td>`;
        for (const func of functions) {
            const cellState = gridState[func.funcId][other];
            if (cellState === 'disabled') {
                rows += `<td class="text-center"><input type="checkbox" disabled class="w-4 h-4 opacity-30"></td>`;
            } else {
                const checked = cellState ? 'checked' : '';
                rows += `<td class="text-center"><input type="checkbox" ${checked} class="w-4 h-4 cursor-pointer grid-share-cb" data-func-id="${escHtml(func.funcId)}" data-successor="${escHtml(other)}"></td>`;
            }
        }
        rows += '<td></td></tr>';
    }

    return `
        <div class="mt-3 p-2 bg-[#f0fdf4] border border-[#00703c]" id="sharingGridSection">
            <div class="text-[10px] font-bold text-[#00703c] mb-1.5">⟷ Sharing overview — all functions</div>
            <table class="w-full border-collapse text-xs">
                <thead><tr class="border-b border-[#b1b4b6]">${headerCells}</tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="text-[10px] text-[#505a5f] mt-1">Primary = always uses it · Checked = shared participant · Disabled = pending</div>
        </div>`;
}

/**
 * Derives which sharing groups exist from grid state.
 *
 * @param {Object} gridState
 * @param {Array} functions
 * @param {string} primarySuccessor
 * @param {string[]} otherSuccessors
 * @returns {string}
 */
export function deriveSharedGroupsFromGrid(gridState, functions, primarySuccessor, otherSuccessors) {
    const parts = [];
    for (const func of functions) {
        if (!func.decided) {
            parts.push(`${func.label}: Pending`);
            continue;
        }
        const shared = otherSuccessors.filter(s => gridState[func.funcId][s] === true);
        if (shared.length > 0) {
            parts.push(`${func.label}: Shared (${[primarySuccessor, ...shared].join(' + ')})`);
        } else {
            parts.push(`${func.label}: ${primarySuccessor} only`);
        }
    }
    return parts.join(' · ');
}
