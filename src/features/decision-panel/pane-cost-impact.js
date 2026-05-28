/**
 * Pane 3 — Cost split, decommissions, obligations, rationale.
 */

import { state } from '../../state.js';
import { escHtml } from '../../ui-helpers.js';
import { getSuccessorNamesForSystem } from './helpers.js';
import { getDecisionKey } from '../../simulation/decisions.js';

/**
 * Renders Pane 3: cost split, decommissions, obligations, decommission tracker, rationale.
 *
 * @param {Object} params
 * @param {string} params.functionId
 * @param {string} params.primarySuccessorName
 * @param {Array} params.systems - all systems in cell
 * @param {string|null} params.selectedSystemId - currently chosen system
 * @param {string} params.systemChoice - 'choose' | 'procure' | 'defer'
 * @param {string[]} params.sharedWithSuccessors - linked successors
 * @param {Object|null} params.procuredSystem
 * @param {Object|null} params.existingDecision
 * @param {boolean} params.isExpanded
 * @param {Object|null} params.primarySystem - the ERP/complex system (State 2 only)
 * @param {Array} params.allFunctions - functions served by primary system (State 2 only)
 * @returns {string} HTML
 */
export function renderPane3CostImpact({
    functionId, primarySuccessorName, systems, selectedSystemId,
    systemChoice, sharedWithSuccessors, procuredSystem, existingDecision,
    isExpanded, primarySystem, allFunctions
}) {
    let html = '<div class="pane-label">Cost & Impact</div>';

    // --- Cost split section ---
    if (sharedWithSuccessors.length > 0 || (selectedSystemId && getSuccessorNamesForSystem(selectedSystemId).length > 1)) {
        const costSystem = selectedSystemId ? systems.find(s => s.id === selectedSystemId) : null;
        const annualCost = costSystem ? costSystem.annualCost : (procuredSystem ? procuredSystem.annualCost : 0);
        const systemLabel = costSystem ? costSystem.label : (procuredSystem ? procuredSystem.label : 'System');

        if (annualCost) {
            const participants = [primarySuccessorName, ...sharedWithSuccessors];
            const overrides = selectedSystemId ? (state.costSplitOverrides[selectedSystemId] || {}) : {};
            const equalProp = 1 / participants.length;

            html += `<div class="text-xs font-bold mb-1">${escHtml(systemLabel)} — £${Number(annualCost).toLocaleString()}/yr</div>`;
            html += `<div class="text-[10px] text-[#505a5f] mb-1.5">${sharedWithSuccessors.length > 0 ? 'Shared service' : 'Transition'} cost split:</div>`;

            for (const name of participants) {
                const prop = overrides[name] != null ? overrides[name] : equalProp;
                const pct = Math.round(prop * 100);
                const amount = Math.round(annualCost * prop);
                html += `<div class="flex justify-between items-center py-0.5 text-xs">
                    <span>${escHtml(name)}</span>
                    <span><input type="number" min="0" max="100" value="${pct}" class="w-11 border border-[#b1b4b6] px-1 py-0.5 text-[10px] text-right cost-split-input" data-system-id="${escHtml(selectedSystemId || '')}" data-successor="${escHtml(name)}">% → £${amount.toLocaleString()}</span>
                </div>`;
            }

            html += `<div class="text-[10px] text-right mt-1">
                <a href="#" class="text-[#1d70b8] underline cost-split-shortcut" data-action="equal">Equal</a> ·
                <a href="#" class="text-[#1d70b8] underline cost-split-shortcut" data-action="by-users">By users</a> ·
                <a href="#" class="text-[#1d70b8] underline cost-split-shortcut" data-action="by-functions">By functions</a>
            </div>`;

            html += '<div class="border-t border-[#e5e5e5] my-2.5"></div>';
        }
    }

    // --- Decommissions ---
    if (systemChoice === 'choose' && selectedSystemId) {
        const toDecommission = systems.filter(s => s.id !== selectedSystemId && !s.isERP);
        if (toDecommission.length > 0) {
            const totalSaved = toDecommission.reduce((sum, s) => sum + (s.annualCost || 0), 0);
            html += '<div class="text-xs font-bold mb-1">Decommissions</div>';
            html += toDecommission.map(s =>
                `<div class="text-xs text-[#d4351c]">• ${escHtml(s.label)}${s.annualCost ? ` — £${Number(s.annualCost).toLocaleString()}/yr saved` : ''}</div>`
            ).join('');
            if (totalSaved > 0) {
                html += `<div class="text-xs font-bold text-[#00703c] mt-0.5">Total saving: £${totalSaved.toLocaleString()}/yr</div>`;
            }
            html += '<div class="border-t border-[#e5e5e5] my-2.5"></div>';
        }
    }

    // --- Obligations preview ---
    html += '<div class="text-xs font-bold mb-1">Obligations</div>';
    const obligations = [];
    if (systemChoice === 'choose' && selectedSystemId) {
        const migrateFrom = systems.filter(s => s.id !== selectedSystemId);
        migrateFrom.forEach(s => {
            if (s.users > 0) obligations.push({ color: '#d4351c', text: `Data migration: ${s.label}` });
        });
    }
    if (systemChoice === 'procure') {
        obligations.push({ color: '#f47738', text: `Procurement: ${procuredSystem ? procuredSystem.label : 'new system'}` });
    }
    if (sharedWithSuccessors.length > 0) {
        obligations.push({ color: '#1d70b8', text: 'Shared service governance agreement' });
    }
    if (obligations.length === 0) {
        html += '<div class="text-xs text-[#505a5f] italic">No obligations for deferred decisions.</div>';
    } else {
        html += obligations.map(o =>
            `<div class="text-xs leading-relaxed"><span style="color:${o.color}">●</span> ${escHtml(o.text)}</div>`
        ).join('');
    }

    // --- ERP decommission tracker (State 2 only) ---
    if (isExpanded && primarySystem && allFunctions && allFunctions.length > 0) {
        const decisions = state.simulationState ? state.simulationState.decisions : new Map();
        html += '<div class="border-t border-[#e5e5e5] my-2.5"></div>';
        html += `<div class="text-xs font-bold mb-1">${escHtml(primarySystem.label)} decommission</div>`;

        let resolvedCount = 0;
        html += allFunctions.map(f => {
            const key = getDecisionKey(f.funcId, primarySuccessorName);
            const dec = decisions.get(key);
            const isCurrent = f.funcId === functionId;
            if (dec || isCurrent) resolvedCount++;

            if (isCurrent) return `<div class="text-xs"><span class="text-[#1d70b8]">◆</span> ${escHtml(f.label)} — editing</div>`;
            if (dec) return `<div class="text-xs"><span class="text-[#00703c]">✓</span> ${escHtml(f.label)} — resolved</div>`;
            return `<div class="text-xs"><span class="text-[#b1b4b6]">○</span> ${escHtml(f.label)} — pending</div>`;
        }).join('');

        const remaining = allFunctions.length - resolvedCount;
        if (remaining > 0) {
            html += `<div class="text-[10px] text-[#f47738] font-bold mt-1">${remaining} pending — not yet decommissioned</div>`;
        } else {
            html += `<div class="text-[10px] text-[#00703c] font-bold mt-1">All resolved — decommission triggered</div>`;
        }
    }

    // --- Rationale ---
    html += '<div class="border-t border-[#e5e5e5] my-2.5"></div>';
    const existingRationale = existingDecision ? (existingDecision.rationale || '') : '';
    html += `<div class="text-xs font-bold mb-1">Rationale <span class="font-normal text-[#86868b]">(optional)</span></div>`;
    html += `<textarea id="decisionRationale" class="w-full border border-[#b1b4b6] p-1.5 text-xs h-10 resize-y" placeholder="e.g. Cloud-first strategy, board decision 2026-06-01.">${escHtml(existingRationale)}</textarea>`;

    return html;
}
