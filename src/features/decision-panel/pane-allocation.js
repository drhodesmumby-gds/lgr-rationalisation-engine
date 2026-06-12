/**
 * Pane 2 — Successor allocation cards.
 *
 * Renders one card per successor with system selection dropdown and
 * "Share with..." toggle. Handles derived label computation and escalation link.
 */

import { state } from '../../state.js';
import { escHtml } from '../../ui-helpers.js';
import { getDecisionKey } from '../../simulation/decisions.js';
import { buildHostingPartnerOptions } from './helpers.js';

/**
 * Renders Pane 2 for the given function — successor cards with allocation dropdowns.
 *
 * @param {Object} params
 * @param {string} params.functionId
 * @param {string} params.primarySuccessorName - the successor that opened the panel
 * @param {Array} params.systems - competing systems for this (function, primarySuccessor) cell
 * @param {Object|null} params.existingDecision
 * @param {boolean} params.isExpanded - true if in State 2
 * @param {Object|null} [params.pendingFormState] - unsaved edits from navigation
 * @returns {string} HTML
 */
export function renderPane2Allocation({
    functionId,
    primarySuccessorName,
    systems,
    existingDecision,
    isExpanded,
    pendingFormState
}) {
    const successors = state.transitionStructure ? state.transitionStructure.successors : [];
    const allSuccessorNames = successors.map(s => s.name);
    const decisions = state.simulationState ? state.simulationState.decisions : new Map();

    const systemOptions = systems.map(sys => {
        const label = `${sys.label || 'Unnamed'} (${sys.sourceCouncil || sys._sourceCouncil || 'Unknown'})`;
        return { id: sys.id, label };
    });

    const sharedSuccessors = pendingFormState
        ? (pendingFormState.sharedWithSuccessors || [])
        : existingDecision ? (existingDecision.sharedWithSuccessors || []) : [];
    const primaryIsLinked = sharedSuccessors.length > 0;

    let cardsHtml = '';

    let primarySelectedId;
    let primaryChoice;

    if (pendingFormState && pendingFormState.primarySystemValue && pendingFormState.primarySystemValue !== '') {
        const pv = pendingFormState.primarySystemValue;
        if (pv === '__defer__') {
            primaryChoice = 'defer';
            primarySelectedId = null;
        } else if (pv === '__procure__') {
            primaryChoice = 'procure';
            primarySelectedId = null;
        } else {
            primaryChoice = 'choose';
            primarySelectedId = pv;
        }
    } else {
        primarySelectedId = existingDecision && existingDecision.systemChoice === 'choose' && existingDecision.retainedSystemIds.length > 0
            ? existingDecision.retainedSystemIds[0]
            : null;
        primaryChoice = existingDecision ? existingDecision.systemChoice : null;
    }

    cardsHtml += renderSuccessorCard({
        successorName: primarySuccessorName,
        isPrimary: true,
        isLinked: primaryIsLinked,
        systemOptions,
        selectedSystemId: primarySelectedId,
        selectedChoice: primaryChoice,
        existingDecision,
        functionId,
        allSuccessorNames: allSuccessorNames.filter(n => n !== primarySuccessorName),
        sharedSuccessors
    });

    for (const succName of allSuccessorNames) {
        if (succName === primarySuccessorName) continue;

        const isSecondary = sharedSuccessors.includes(succName);
        const otherKey = getDecisionKey(functionId, succName);
        const otherDecision = decisions.get(otherKey);

        if (isSecondary) {
            // Only show linked card if primary has actually selected a system
            const hasSystemSelected = (primaryChoice === 'choose' && primarySelectedId) || primaryChoice === 'procure';

            if (hasSystemSelected) {
                const sharedSystemLabel = primaryChoice === 'choose' && primarySelectedId
                    ? (systems.find(s => s.id === primarySelectedId)?.label || primarySelectedId)
                    : primaryChoice === 'procure' && existingDecision?.procuredSystem
                        ? existingDecision.procuredSystem.label
                        : 'new system';

                cardsHtml += `
                    <div class="border-2 border-dashed border-[#00703c] p-2.5 mb-2 bg-[#f8fdf9]">
                        <div class="font-bold text-xs mb-1">${escHtml(succName)}
                            <span class="inline-block text-[9px] px-1.5 py-0.5 font-bold bg-[#cce2d8] text-[#00703c] border border-[#00703c] ml-1.5">Shared</span>
                        </div>
                        <div class="text-xs text-[#00703c] p-1.5 bg-[#f0fdf4] border border-[#cce2d8]">
                            <strong>${escHtml(sharedSystemLabel)}</strong> — shared with ${escHtml(primarySuccessorName)}
                        </div>
                        <div class="text-[10px] text-[#505a5f] mt-1">
                            <a href="#" class="text-[#d4351c] underline unlink-shared-btn" data-successor="${escHtml(succName)}">Unlink</a> — make independent decision
                        </div>
                    </div>`;
            } else {
                // Sharing intent set but no system chosen — show as regular card with note
                const otherAllocMap = state.simulationState?.baselineAllocation || state.successorAllocationMap;
                const otherSuccMap = otherAllocMap ? otherAllocMap.get(succName) : null;
                const otherAllocations = otherSuccMap ? (otherSuccMap.get(functionId) || []) : [];
                const otherSystems = otherAllocations.map(a => ({
                    id: a.system.id,
                    label: `${a.system.label || 'Unnamed'} (${a.sourceCouncil || 'Unknown'})`
                }));

                cardsHtml += renderSuccessorCard({
                    successorName: succName,
                    isPrimary: false,
                    isLinked: false,
                    systemOptions: otherSystems,
                    selectedSystemId: null,
                    selectedChoice: null,
                    existingDecision: null,
                    functionId,
                    allSuccessorNames: [],
                    sharedSuccessors: []
                });
            }
        } else {
            const otherAllocMap = state.simulationState?.baselineAllocation || state.successorAllocationMap;
            const otherSuccMap = otherAllocMap ? otherAllocMap.get(succName) : null;
            const otherAllocations = otherSuccMap ? (otherSuccMap.get(functionId) || []) : [];
            const otherSystems = otherAllocations.map(a => ({
                id: a.system.id,
                label: `${a.system.label || 'Unnamed'} (${a.sourceCouncil || 'Unknown'})`
            }));

            const otherSelectedId = otherDecision && otherDecision.systemChoice === 'choose' && otherDecision.retainedSystemIds.length > 0
                ? otherDecision.retainedSystemIds[0] : null;

            cardsHtml += renderSuccessorCard({
                successorName: succName,
                isPrimary: false,
                isLinked: false,
                systemOptions: otherSystems,
                selectedSystemId: otherSelectedId,
                selectedChoice: otherDecision ? otherDecision.systemChoice : null,
                existingDecision: otherDecision,
                functionId,
                allSuccessorNames: [],
                sharedSuccessors: []
            });
        }
    }

    const derivedHtml = renderDerivedLabel(primaryChoice, sharedSuccessors, primarySelectedId, systems, existingDecision);

    const escalationHtml = !isExpanded
        ? `<div class="mt-3 p-2 border-2 border-dashed border-[#1d70b8] text-center bg-[#f0f4ff] cursor-pointer" id="escalateToExpanded">
            <div class="text-xs font-bold text-[#1d70b8]">↗ Assign system to additional functions</div>
            <div class="text-[10px] text-[#505a5f]">Opens expanded view for multi-function allocation</div>
           </div>`
        : '';

    const funcLabel = state.lgaFunctionMap?.get(functionId)?.label || functionId;

    return `
        <div class="pane-label">Allocation${isExpanded ? ': ' + escHtml(funcLabel) : ''}</div>
        <div class="text-xs text-[#505a5f] mb-2">For each successor, what system serves this function?</div>
        ${cardsHtml}
        ${derivedHtml}
        ${escalationHtml}
    `;
}

function renderSuccessorCard({
    successorName, isPrimary, isLinked, systemOptions,
    selectedSystemId, selectedChoice, existingDecision, functionId,
    allSuccessorNames, sharedSuccessors
}) {
    const borderClass = isLinked
        ? 'border-2 border-[#0b0c0c] bg-white'
        : 'border border-[#b1b4b6] bg-white';

    const primaryBadge = isPrimary && isLinked
        ? '<span class="inline-block text-[9px] px-1.5 py-0.5 font-bold bg-[#cce2d8] text-[#00703c] border border-[#00703c] ml-1.5">Primary</span>'
        : '';

    let optionsHtml = '<option value="">— Select system —</option>';
    optionsHtml += systemOptions.map(opt =>
        `<option value="${escHtml(opt.id)}" ${opt.id === selectedSystemId ? 'selected' : ''}>${escHtml(opt.label)}</option>`
    ).join('');
    optionsHtml += `<option value="__procure__" ${selectedChoice === 'procure' ? 'selected' : ''}>Procure new system</option>`;
    optionsHtml += `<option value="__defer__" ${selectedChoice === 'defer' ? 'selected' : ''}>Defer — decide post-vesting</option>`;

    const showProcure = selectedChoice === 'procure';
    const ps = existingDecision?.procuredSystem || {};
    const procureDetailHtml = `
        <div class="mt-1.5 p-2 bg-[#fafafa] border border-[#e5e5e5] text-xs ${showProcure ? '' : 'hidden'}" data-procure-detail>
            <div class="flex justify-between items-center mb-1"><span>System:</span><input class="border border-[#b1b4b6] px-1.5 py-0.5 text-xs w-32 procure-field" data-field="label" value="${escHtml(ps.label || '')}"></div>
            <div class="flex justify-between items-center mb-1"><span>Vendor:</span><input class="border border-[#b1b4b6] px-1.5 py-0.5 text-xs w-32 procure-field" data-field="vendor" value="${escHtml(ps.vendor || '')}"></div>
            <div class="flex justify-between items-center mb-1"><span>Annual cost:</span><input type="number" class="border border-[#b1b4b6] px-1.5 py-0.5 text-xs w-32 procure-field" data-field="annualCost" value="${ps.annualCost || ''}"></div>
            <div class="flex justify-between items-center"><span>Hosting:</span>
                <select class="border border-[#b1b4b6] px-1 py-0.5 text-xs w-32 procure-field" data-field="hosting">
                    <option value="cloud" ${(ps.hosting || 'cloud') === 'cloud' ? 'selected' : ''}>Cloud</option>
                    <option value="on-premise" ${ps.hosting === 'on-premise' ? 'selected' : ''}>On-premise</option>
                    <option value="partner-hosted" ${ps.hosting === 'partner-hosted' ? 'selected' : ''}>Partner-hosted</option>
                </select>
            </div>
        </div>`;

    let shareToggleHtml = '';
    if (isPrimary && allSuccessorNames.length > 0 && selectedChoice && selectedChoice !== 'defer' && selectedChoice !== null) {
        const checkboxes = allSuccessorNames.map(name => {
            const checked = sharedSuccessors.includes(name) ? 'checked' : '';
            return `<div class="flex items-center gap-1.5 text-xs py-0.5"><input type="checkbox" class="share-successor-cb" data-successor="${escHtml(name)}" ${checked}><label>${escHtml(name)}</label></div>`;
        }).join('');

        shareToggleHtml = `
            <div class="mt-1.5 p-2 bg-[#f0f4ff] border border-[#1d70b8]" data-share-toggle>
                <div class="text-[10px] font-bold text-[#1d70b8] mb-1">⟷ Share with other successors</div>
                ${checkboxes}
            </div>`;
    }

    return `
        <div class="${borderClass} p-2.5 mb-2 successor-card" data-successor="${escHtml(successorName)}" data-is-primary="${isPrimary}">
            <div class="font-bold text-xs mb-1.5">${escHtml(successorName)}${primaryBadge}</div>
            <select class="w-full border border-[#0b0c0c] p-1.5 text-xs bg-white successor-system-select" data-successor="${escHtml(successorName)}">
                ${optionsHtml}
            </select>
            ${procureDetailHtml}
            ${shareToggleHtml}
        </div>`;
}

function renderDerivedLabel(primaryChoice, sharedSuccessors, selectedSystemId, systems, existingDecision) {
    if (!primaryChoice || primaryChoice === 'defer') return '';

    if (sharedSuccessors.length > 0) {
        const sysLabel = primaryChoice === 'choose' && selectedSystemId
            ? (systems.find(s => s.id === selectedSystemId)?.label || 'selected system')
            : primaryChoice === 'procure' && existingDecision?.procuredSystem
                ? existingDecision.procuredSystem.label
                : 'new system';
        return `<div class="p-1.5 mt-2 text-[10px] font-bold bg-[#f0f4ff] border-l-4 border-l-[#1d70b8] text-[#0b0c0c]">
            <span class="text-[#1d70b8]">⟷</span> Shared service: ${escHtml(sysLabel)} (${sharedSuccessors.length + 1} successors)
        </div>`;
    }

    return '';
}
