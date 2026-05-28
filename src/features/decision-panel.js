/**
 * Decision Panel — Successor-first allocation model.
 *
 * Opens a modal for a specific (functionId, successorName) pair. Users
 * allocate systems to successors via dropdowns, with sharing configured
 * through "Share with..." toggles and a per-function checkbox grid.
 *
 * Two states:
 *   State 1 (Simple): system comparison cards + successor allocation cards
 *   State 2 (Expanded): function navigator + allocation cards + sharing grid
 *
 * The operating model boundary (shared/disaggregate/none) is derived from
 * the combination of per-successor choices, never selected directly.
 */

import { state } from '../state.js';
import { escHtml } from '../ui-helpers.js';
import { getDecisionKey } from '../simulation/decisions.js';
import { isCapabilitySystem } from '../analysis/allocation.js';
import { recomputeSimulation } from './simulation-panel.js';
import { showConfirm } from '../ui-notifications.js';

import { renderTierBadge, getSuccessorNamesForSystem } from './decision-panel/helpers.js';
import { renderPane1Simple, renderPane1Expanded } from './decision-panel/pane-systems.js';
import { renderPane2Allocation } from './decision-panel/pane-allocation.js';
import { renderPane3CostImpact } from './decision-panel/pane-cost-impact.js';
import { renderSharingGrid } from './decision-panel/sharing-grid.js';
import { applyDecisionFromPanel } from './decision-panel/apply-decision.js';
import { LGA_FUNCTIONS } from '../constants/lga-functions.js';
import { createDecision } from '../simulation/decisions.js';

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let _currentFunctionId = null;
let _currentSuccessorName = null;
let _panelOpener = null;
let _trapCleanup = null;
let _allSystems = [];
let _isExpanded = false;
let _primarySystem = null;
let _allFunctions = [];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Opens the Decision Panel for a given (functionId, successorName) cell.
 *
 * @param {string} functionId
 * @param {string} successorName
 */
export function openDecisionPanel(functionId, successorName) {
    if (!state.simulationState) return;

    _currentFunctionId = functionId;
    _currentSuccessorName = successorName;
    _panelOpener = document.activeElement;

    renderPanel(functionId, successorName);

    const modal = document.getElementById('decisionPanelModal');
    if (!modal) return;

    modal.classList.remove('hidden');
    _trapCleanup = createFocusTrap(modal);

    const closeBtn = document.getElementById('btnCloseDecisionPanel');
    if (closeBtn) closeBtn.focus();
}

// ---------------------------------------------------------------------------
// Core rendering
// ---------------------------------------------------------------------------

function renderPanel(functionId, successorName) {
    const content = document.getElementById('decisionPanelContent');
    if (!content) return;

    const funcEntry = state.lgaFunctionMap ? state.lgaFunctionMap.get(functionId) : null;
    const funcLabel = funcEntry ? funcEntry.label : `Function ${functionId}`;
    const tierNum = state.tierMap ? (state.tierMap.get(functionId) || 2) : 2;
    const tierBadge = renderTierBadge(tierNum);
    const vestingDate = state.transitionStructure ? state.transitionStructure.vestingDate : null;

    // Get competing systems from allocation
    const allocMap = state.simulationState.baselineAllocation || state.successorAllocationMap;
    const successorMap = allocMap ? allocMap.get(successorName) : null;
    const cellAllocations = successorMap ? (successorMap.get(functionId) || []) : [];
    const systems = cellAllocations.map(a => ({
        ...a.system,
        sourceCouncil: a.sourceCouncil,
        _sourceCouncil: a.sourceCouncil,
        isDisaggregation: a.isDisaggregation || false,
        allocationType: a.allocationType
    }));
    _allSystems = systems;

    // Check existing decision
    const decisions = state.simulationState.decisions;
    const existingDecision = decisions ? decisions.get(getDecisionKey(functionId, successorName)) : null;

    // Show propagated shared-service read-only view if applicable
    const footer = document.getElementById('decisionPanelFooter');
    if (existingDecision && existingDecision.sharedServiceOrigin) {
        content.innerHTML = renderPropagatedSharedServiceView(existingDecision, funcLabel, successorName, tierBadge);
        if (footer) footer.classList.add('hidden');
        return;
    }
    if (footer) footer.classList.remove('hidden');

    // Determine if expanded state is needed
    _isExpanded = detectExpandedState(systems, functionId, successorName);

    // Build header
    const headerHtml = renderHeader(funcLabel, successorName, tierBadge, existingDecision);

    // Build panes
    let pane1Html, pane2Html, pane3Html;

    if (_isExpanded) {
        // State 2: find the primary system and all functions it serves
        _primarySystem = findPrimarySystem(systems, functionId, successorName);
        _allFunctions = findAllFunctionsForSystem(_primarySystem, successorName);

        pane1Html = renderPane1Expanded(_primarySystem, _allFunctions, functionId, successorName, vestingDate);
        pane2Html = renderPane2Allocation({
            functionId,
            primarySuccessorName: successorName,
            systems,
            existingDecision,
            isExpanded: true
        });

        // Add sharing grid below allocation
        const gridFunctions = _allFunctions.map(f => {
            const key = getDecisionKey(f.funcId, successorName);
            const dec = decisions.get(key);
            return {
                funcId: f.funcId,
                label: f.label,
                systemLabel: dec && dec.systemChoice === 'choose' && dec.retainedSystemIds.length > 0
                    ? (state.simulationState.baselineNodes || []).find(n => n.id === dec.retainedSystemIds[0])?.label || null
                    : null,
                decided: !!dec || f.funcId === functionId
            };
        });
        const otherSuccessors = (state.transitionStructure?.successors || [])
            .map(s => s.name)
            .filter(n => n !== successorName);
        const sharingGridHtml = otherSuccessors.length > 0
            ? renderSharingGrid(gridFunctions, successorName, otherSuccessors)
            : '';
        pane2Html += sharingGridHtml;

        pane3Html = renderPane3CostImpact({
            functionId,
            primarySuccessorName: successorName,
            systems,
            selectedSystemId: existingDecision?.retainedSystemIds?.[0] || null,
            systemChoice: existingDecision?.systemChoice || 'defer',
            sharedWithSuccessors: existingDecision?.sharedWithSuccessors || [],
            procuredSystem: existingDecision?.procuredSystem || null,
            existingDecision,
            isExpanded: true,
            primarySystem: _primarySystem,
            allFunctions: _allFunctions
        });
    } else {
        // State 1: simple
        pane1Html = renderPane1Simple(systems, vestingDate);
        pane2Html = renderPane2Allocation({
            functionId,
            primarySuccessorName: successorName,
            systems,
            existingDecision,
            isExpanded: false
        });
        pane3Html = renderPane3CostImpact({
            functionId,
            primarySuccessorName: successorName,
            systems,
            selectedSystemId: existingDecision?.retainedSystemIds?.[0] || null,
            systemChoice: existingDecision?.systemChoice || 'defer',
            sharedWithSuccessors: existingDecision?.sharedWithSuccessors || [],
            procuredSystem: existingDecision?.procuredSystem || null,
            existingDecision,
            isExpanded: false,
            primarySystem: null,
            allFunctions: []
        });
    }

    const pane1Width = _isExpanded ? 'w-[22%] min-w-[160px]' : 'w-[28%]';
    const pane2Width = _isExpanded ? 'w-[46%]' : 'w-[40%]';
    const pane3Width = _isExpanded ? 'w-[32%]' : 'w-[32%]';

    content.innerHTML = headerHtml + `
        <div class="flex flex-1 min-h-0">
            <div class="${pane1Width} overflow-y-auto border-r border-[#b1b4b6] pr-3 shrink-0">
                ${pane1Html}
            </div>
            <div class="${pane2Width} overflow-y-auto px-3">
                ${pane2Html}
            </div>
            <div class="${pane3Width} overflow-y-auto pl-3 border-l border-[#b1b4b6] bg-[#fafcff]">
                ${pane3Html}
            </div>
        </div>`;

    wireInteractivity(systems, successorName, existingDecision);
}

// ---------------------------------------------------------------------------
// State detection
// ---------------------------------------------------------------------------

function detectExpandedState(systems, functionId, successorName) {
    // Expanded if: any system is ERP, or is disaggregation (partial predecessor),
    // or system has sharedWith, or system serves multiple functions in this successor
    const hasErp = systems.some(s => s.isERP);
    const hasDisagg = systems.some(s => s.isDisaggregation);
    const hasShared = systems.some(s => s.sharedWith && s.sharedWith.length > 0);

    if (hasErp || hasDisagg || hasShared) return true;

    // Check if any system serves multiple functions in this successor
    const allocMap = state.simulationState.baselineAllocation || state.successorAllocationMap;
    const successorMap = allocMap ? allocMap.get(successorName) : null;
    if (successorMap) {
        for (const sys of systems) {
            let funcCount = 0;
            for (const [, allocations] of successorMap) {
                if (allocations.some(a => a.system && a.system.id === sys.id)) funcCount++;
            }
            if (funcCount > 1) return true;
        }
    }

    return false;
}

function findPrimarySystem(systems, functionId, successorName) {
    // Prefer ERP, then disaggregation systems, then first system
    const erp = systems.find(s => s.isERP);
    if (erp) return erp;
    const disagg = systems.find(s => s.isDisaggregation);
    if (disagg) return disagg;
    const shared = systems.find(s => s.sharedWith && s.sharedWith.length > 0);
    if (shared) return shared;
    // Find the system that serves the most functions
    const allocMap = state.simulationState.baselineAllocation || state.successorAllocationMap;
    const successorMap = allocMap ? allocMap.get(successorName) : null;
    if (successorMap && systems.length > 0) {
        let best = systems[0];
        let bestCount = 0;
        for (const sys of systems) {
            let count = 0;
            for (const [, allocations] of successorMap) {
                if (allocations.some(a => a.system && a.system.id === sys.id)) count++;
            }
            if (count > bestCount) { best = sys; bestCount = count; }
        }
        return best;
    }
    return systems[0] || null;
}

function findAllFunctionsForSystem(primarySystem, successorName) {
    if (!primarySystem) return [];
    const allocMap = state.simulationState.baselineAllocation || state.successorAllocationMap;
    const successorMap = allocMap ? allocMap.get(successorName) : null;
    if (!successorMap) return [];

    const functions = [];
    for (const [funcId, allocations] of successorMap) {
        if (allocations.some(a => a.system && a.system.id === primarySystem.id)) {
            const funcEntry = state.lgaFunctionMap ? state.lgaFunctionMap.get(funcId) : null;
            functions.push({
                funcId,
                label: funcEntry ? funcEntry.label : `Function ${funcId}`
            });
        }
    }
    return functions;
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function renderHeader(funcLabel, successorName, tierBadge, existingDecision) {
    return `
        <div class="mb-4 shrink-0">
            <p class="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Decision</p>
            <h2 id="decisionPanelTitle" class="text-2xl font-bold mb-1">${escHtml(funcLabel)}</h2>
            <div class="flex items-center gap-3 flex-wrap">
                <span class="text-sm font-bold text-gray-700">Successor: ${escHtml(successorName)}</span>
                ${tierBadge}
                ${existingDecision ? '<span class="text-xs font-bold text-[#00703c] bg-green-50 border border-[#00703c] px-2 py-0.5">Editing existing decision</span>' : ''}
                ${_isExpanded ? '<span class="text-xs font-bold text-[#1d70b8] bg-blue-50 border border-[#1d70b8] px-2 py-0.5">Expanded scope</span>' : ''}
            </div>
        </div>
    `;
}

// ---------------------------------------------------------------------------
// Propagated shared-service read-only view (preserved from original)
// ---------------------------------------------------------------------------

function renderPropagatedSharedServiceView(decision, funcLabel, successorName, tierBadge) {
    const origin = decision.sharedServiceOrigin || '';
    const originParts = origin.split('::');
    const originSuccessorName = originParts.length >= 2 ? originParts.slice(1).join('::') : origin;

    const retainedId = decision.retainedSystemIds && decision.retainedSystemIds.length > 0
        ? decision.retainedSystemIds[0] : null;
    const baselineNodes = state.simulationState ? state.simulationState.baselineNodes : null;
    const sharedSystem = retainedId && baselineNodes
        ? baselineNodes.find(n => n.id === retainedId) : null;
    const systemLabel = sharedSystem ? sharedSystem.label : (retainedId || 'shared system');
    const systemVendor = sharedSystem && sharedSystem.vendor ? ` — ${sharedSystem.vendor}` : '';

    return `
        <div class="mb-6">
            <p class="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Shared Service Decision</p>
            <h2 id="decisionPanelTitle" class="text-2xl font-bold mb-1">${escHtml(funcLabel)}</h2>
            <div class="flex items-center gap-3 flex-wrap">
                <span class="text-sm font-bold text-gray-700">Successor: ${escHtml(successorName)}</span>
                ${tierBadge}
            </div>
        </div>
        <div class="p-4 bg-blue-50 border-l-4 border-l-[#1d70b8] mb-4">
            <p class="text-sm font-bold text-[#1d70b8] mb-1">This function is served by a shared service</p>
            <p class="text-sm text-gray-700 mb-2">
                <strong>${escHtml(systemLabel)}</strong>${escHtml(systemVendor)} has been established as a shared service
                by <strong>${escHtml(originSuccessorName)}</strong>.
                This successor authority participates in that shared arrangement.
            </p>
            <div class="flex gap-2 flex-wrap mt-3">
                <button type="button" class="gds-btn text-sm px-3 py-1.5"
                        onclick="window._simOpenDecision('${escHtml(decision.functionId)}', '${escHtml(originSuccessorName)}')">
                    Edit shared arrangement in ${escHtml(originSuccessorName)}
                </button>
                <button type="button"
                        class="text-sm px-3 py-1.5 bg-[#d4351c] text-white font-bold hover:bg-[#aa2a16]"
                        data-action="unlink-shared-service"
                        data-function-id="${escHtml(decision.functionId)}"
                        data-successor-name="${escHtml(successorName)}">
                    Remove from shared service
                </button>
            </div>
        </div>
        <p class="text-xs text-gray-500">To change which system serves this function in ${escHtml(successorName)}, first remove it from the shared service above, then make an independent decision.</p>
    `;
}

// ---------------------------------------------------------------------------
// Interactivity wiring
// ---------------------------------------------------------------------------

function wireInteractivity(systems, successorName, existingDecision) {
    const content = document.getElementById('decisionPanelContent');
    if (!content) return;

    // Successor dropdown changes → show/hide procure detail, update Pane 3 only
    content.querySelectorAll('.successor-system-select').forEach(select => {
        select.addEventListener('change', () => {
            const card = select.closest('.successor-card');
            const procureDetail = card ? card.querySelector('[data-procure-detail]') : null;
            if (procureDetail) {
                procureDetail.classList.toggle('hidden', select.value !== '__procure__');
            }
            rerenderPane3Only();
        });
    });

    // Share toggles
    content.querySelectorAll('.share-successor-cb').forEach(cb => {
        cb.addEventListener('change', () => {
            // Sync with grid if present
            const gridCb = content.querySelector(`.grid-share-cb[data-successor="${cb.dataset.successor}"][data-func-id="${_currentFunctionId}"]`);
            if (gridCb) gridCb.checked = cb.checked;
            // Re-render to update linked cards
            renderPanel(_currentFunctionId, _currentSuccessorName);
        });
    });

    // Grid checkbox sync → card toggle
    content.querySelectorAll('.grid-share-cb').forEach(cb => {
        cb.addEventListener('change', () => {
            const cardCb = content.querySelector(`.share-successor-cb[data-successor="${cb.dataset.successor}"]`);
            if (cardCb && cb.dataset.funcId === _currentFunctionId) {
                cardCb.checked = cb.checked;
                cardCb.dispatchEvent(new Event('change'));
            }
        });
    });

    // Function navigator clicks (State 2)
    content.querySelectorAll('.func-nav-row').forEach(row => {
        row.addEventListener('click', () => {
            const newFuncId = row.dataset.funcId;
            if (newFuncId && newFuncId !== _currentFunctionId) {
                _currentFunctionId = newFuncId;
                renderPanel(_currentFunctionId, _currentSuccessorName);
            }
        });
    });

    // Escalation button (State 1 → State 2)
    const escalateBtn = content.querySelector('#escalateToExpanded');
    if (escalateBtn) {
        escalateBtn.addEventListener('click', () => {
            _isExpanded = true;
            renderPanel(_currentFunctionId, _currentSuccessorName);
        });
    }

    // Unlink shared service buttons
    content.querySelectorAll('.unlink-shared-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const successor = btn.dataset.successor;
            if (successor) {
                window._simUnlinkSharedService(_currentFunctionId, successor);
                renderPanel(_currentFunctionId, _currentSuccessorName);
            }
        });
    });

    // Cost split inputs
    content.querySelectorAll('.cost-split-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const sysId = e.target.dataset.systemId;
            const successor = e.target.dataset.successor;
            let pct = parseInt(e.target.value, 10);
            if (isNaN(pct) || pct < 0) pct = 0;
            if (pct > 100) pct = 100;
            e.target.value = pct;

            const proportion = pct / 100;
            if (!state.costSplitOverrides[sysId]) state.costSplitOverrides[sysId] = {};
            state.costSplitOverrides[sysId][successor] = proportion;

            const successorNames = getSuccessorNamesForSystem(sysId);
            const remaining = 1 - proportion;
            const otherSuccessors = successorNames.filter(s => s !== successor);
            if (otherSuccessors.length > 0) {
                const equalRemaining = remaining / otherSuccessors.length;
                otherSuccessors.forEach(s => {
                    state.costSplitOverrides[sysId][s] = Math.max(0, equalRemaining);
                });
            }

            renderPanel(_currentFunctionId, _currentSuccessorName);
        });
    });

    // Cost split shortcuts
    content.querySelectorAll('.cost-split-shortcut').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const action = link.dataset.action;
            const primarySelect = content.querySelector('.successor-card[data-is-primary="true"] .successor-system-select');
            const sysId = primarySelect ? primarySelect.value : null;
            if (!sysId || sysId.startsWith('__')) return;

            const successorNames = getSuccessorNamesForSystem(sysId);
            if (successorNames.length === 0) return;

            if (action === 'equal') {
                delete state.costSplitOverrides[sysId];
            } else if (action === 'by-users') {
                const sys = systems.find(s => s.id === sysId);
                if (sys && sys.users) {
                    const totalUsers = successorNames.length * (sys.users / successorNames.length);
                    const equalProp = 1 / successorNames.length;
                    if (!state.costSplitOverrides[sysId]) state.costSplitOverrides[sysId] = {};
                    successorNames.forEach(s => {
                        state.costSplitOverrides[sysId][s] = equalProp;
                    });
                }
            } else if (action === 'by-functions') {
                // Weight by how many functions each successor uses this system for
                const allocMap = state.simulationState.baselineAllocation || state.successorAllocationMap;
                const counts = {};
                let total = 0;
                successorNames.forEach(sName => {
                    const succMap = allocMap ? allocMap.get(sName) : null;
                    let count = 0;
                    if (succMap) {
                        for (const [, allocations] of succMap) {
                            if (allocations.some(a => a.system && a.system.id === sysId)) count++;
                        }
                    }
                    counts[sName] = count;
                    total += count;
                });
                if (total > 0) {
                    if (!state.costSplitOverrides[sysId]) state.costSplitOverrides[sysId] = {};
                    successorNames.forEach(s => {
                        state.costSplitOverrides[sysId][s] = counts[s] / total;
                    });
                }
            }

            renderPanel(_currentFunctionId, _currentSuccessorName);
        });
    });

    // "+ Func" button
    const addFuncBtn = content.querySelector('.add-func-btn');
    if (addFuncBtn) {
        addFuncBtn.addEventListener('click', () => {
            showAddFunctionTypeahead(addFuncBtn);
        });
    }
}

function rerenderPane3Only() {
    const content = document.getElementById('decisionPanelContent');
    if (!content) return;

    // Read current state from the DOM
    const primarySelect = content.querySelector('.successor-card[data-is-primary="true"] .successor-system-select');
    const selectValue = primarySelect ? primarySelect.value : '';

    let systemChoice = 'defer';
    let selectedSystemId = null;
    let procuredSystem = null;

    if (selectValue === '__defer__') {
        systemChoice = 'defer';
    } else if (selectValue === '__procure__') {
        systemChoice = 'procure';
        const card = primarySelect.closest('.successor-card');
        const labelField = card ? card.querySelector('.procure-field[data-field="label"]') : null;
        procuredSystem = {
            label: labelField ? labelField.value : '',
            annualCost: 0
        };
    } else if (selectValue && selectValue !== '') {
        systemChoice = 'choose';
        selectedSystemId = selectValue;
    }

    const sharedCbs = content.querySelectorAll('.share-successor-cb:checked');
    const sharedWithSuccessors = [...sharedCbs].map(cb => cb.dataset.successor);

    const decisions = state.simulationState ? state.simulationState.decisions : new Map();
    const existingDecision = decisions.get(getDecisionKey(_currentFunctionId, _currentSuccessorName));

    // Find the Pane 3 container (third child of the flex container)
    const panes = content.querySelector('.flex.flex-1.min-h-0');
    if (!panes) return;
    const pane3 = panes.children[2];
    if (!pane3) return;

    pane3.innerHTML = renderPane3CostImpact({
        functionId: _currentFunctionId,
        primarySuccessorName: _currentSuccessorName,
        systems: _allSystems,
        selectedSystemId,
        systemChoice,
        sharedWithSuccessors,
        procuredSystem,
        existingDecision,
        isExpanded: _isExpanded,
        primarySystem: _primarySystem,
        allFunctions: _allFunctions
    });

    // Re-wire cost split inputs within pane 3
    pane3.querySelectorAll('.cost-split-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const sysId = e.target.dataset.systemId;
            const successor = e.target.dataset.successor;
            let pct = parseInt(e.target.value, 10);
            if (isNaN(pct) || pct < 0) pct = 0;
            if (pct > 100) pct = 100;
            e.target.value = pct;

            const proportion = pct / 100;
            if (!state.costSplitOverrides[sysId]) state.costSplitOverrides[sysId] = {};
            state.costSplitOverrides[sysId][successor] = proportion;

            const successorNames = getSuccessorNamesForSystem(sysId);
            const remaining = 1 - proportion;
            const otherSuccessors = successorNames.filter(s => s !== successor);
            if (otherSuccessors.length > 0) {
                const equalRemaining = remaining / otherSuccessors.length;
                otherSuccessors.forEach(s => {
                    state.costSplitOverrides[sysId][s] = Math.max(0, equalRemaining);
                });
            }
            rerenderPane3Only();
        });
    });
}

// ---------------------------------------------------------------------------
// Add Function typeahead
// ---------------------------------------------------------------------------

function showAddFunctionTypeahead(anchorEl) {
    // Remove existing typeahead if present
    const existing = document.getElementById('addFuncTypeahead');
    if (existing) existing.remove();

    const existingFuncIds = new Set(_allFunctions.map(f => f.funcId));

    const available = (LGA_FUNCTIONS || []).filter(f => !existingFuncIds.has(f.id));
    if (available.length === 0) return;

    const dropdown = document.createElement('div');
    dropdown.id = 'addFuncTypeahead';
    dropdown.className = 'absolute bg-white border-2 border-[#0b0c0c] shadow-lg z-50 max-h-48 overflow-y-auto w-64';
    dropdown.innerHTML = `
        <input type="text" placeholder="Search functions..." class="w-full border-b border-[#b1b4b6] p-2 text-xs" id="addFuncSearch">
        <div id="addFuncResults" class="max-h-40 overflow-y-auto">
            ${available.slice(0, 20).map(f => `<div class="p-1.5 text-xs cursor-pointer hover:bg-[#f0f4ff] add-func-option" data-func-id="${escHtml(f.id)}">${escHtml(f.label)}</div>`).join('')}
        </div>
    `;

    anchorEl.parentElement.style.position = 'relative';
    anchorEl.parentElement.appendChild(dropdown);

    const searchInput = dropdown.querySelector('#addFuncSearch');
    if (searchInput) {
        searchInput.focus();
        searchInput.addEventListener('input', () => {
            const q = searchInput.value.toLowerCase();
            const filtered = available.filter(f => f.label.toLowerCase().includes(q)).slice(0, 20);
            const results = dropdown.querySelector('#addFuncResults');
            results.innerHTML = filtered.map(f =>
                `<div class="p-1.5 text-xs cursor-pointer hover:bg-[#f0f4ff] add-func-option" data-func-id="${escHtml(f.id)}">${escHtml(f.label)}</div>`
            ).join('');
            wireAddFuncOptions(dropdown);
        });
    }

    wireAddFuncOptions(dropdown);

    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', function closeTypeahead(e) {
            if (!dropdown.contains(e.target) && e.target !== anchorEl) {
                dropdown.remove();
                document.removeEventListener('click', closeTypeahead);
            }
        });
    }, 0);
}

function wireAddFuncOptions(dropdown) {
    dropdown.querySelectorAll('.add-func-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const funcId = opt.dataset.funcId;
            if (funcId) {
                // Add function to the list and re-render
                const funcEntry = state.lgaFunctionMap ? state.lgaFunctionMap.get(funcId) : null;
                _allFunctions.push({
                    funcId,
                    label: funcEntry ? funcEntry.label : `Function ${funcId}`
                });
                dropdown.remove();
                renderPanel(_currentFunctionId, _currentSuccessorName);
            }
        });
    });
}

// ---------------------------------------------------------------------------
// Close modal
// ---------------------------------------------------------------------------

function closeDecisionPanel() {
    const modal = document.getElementById('decisionPanelModal');
    if (!modal) return;

    modal.classList.add('hidden');
    _currentFunctionId = null;
    _currentSuccessorName = null;
    _isExpanded = false;
    _primarySystem = null;
    _allFunctions = [];

    if (_trapCleanup) {
        _trapCleanup();
        _trapCleanup = null;
    }

    if (_panelOpener && typeof _panelOpener.focus === 'function') {
        _panelOpener.focus();
        _panelOpener = null;
    }
}

// ---------------------------------------------------------------------------
// Focus trap
// ---------------------------------------------------------------------------

function createFocusTrap(modalEl) {
    const focusableSelectors = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    function trapFocus(e) {
        if (e.key !== 'Tab') return;
        const focusable = [...modalEl.querySelectorAll(focusableSelectors)].filter(el => !el.closest('[hidden]') && !el.closest('.hidden'));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
            if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
            if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
    }
    modalEl.addEventListener('keydown', trapFocus);
    return () => modalEl.removeEventListener('keydown', trapFocus);
}

// ---------------------------------------------------------------------------
// Modal event wiring (runs at module load time)
// ---------------------------------------------------------------------------

const _decisionPanelModal = document.getElementById('decisionPanelModal');
if (_decisionPanelModal) {
    document.getElementById('btnCloseDecisionPanel').addEventListener('click', closeDecisionPanel);
    document.getElementById('btnCancelDecision').addEventListener('click', closeDecisionPanel);
    document.getElementById('btnApplyDecision').addEventListener('click', () => {
        applyDecisionFromPanel({
            functionId: _currentFunctionId,
            successorName: _currentSuccessorName,
            systems: _allSystems,
            closePanel: closeDecisionPanel,
            showError: (msg) => {
                const errorEl = document.getElementById('decisionPanelError');
                if (errorEl) {
                    errorEl.textContent = msg;
                    errorEl.classList.remove('hidden');
                }
            }
        });
    });

    _decisionPanelModal.addEventListener('click', async (e) => {
        if (e.target === _decisionPanelModal) { closeDecisionPanel(); return; }

        const unlinkBtn = e.target.closest('[data-action="unlink-shared-service"]');
        if (unlinkBtn) {
            const functionId = unlinkBtn.getAttribute('data-function-id');
            const successorName = unlinkBtn.getAttribute('data-successor-name');
            const confirmed = await showConfirm({
                containerId: 'decisionPanelNotifications',
                title: 'Remove from shared service',
                message: `Remove ${successorName} from the shared service arrangement? This will revert this cell to undecided.`,
                confirmLabel: 'Remove',
                cancelLabel: 'Cancel'
            });
            if (confirmed) window._simUnlinkSharedService(functionId, successorName);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !_decisionPanelModal.classList.contains('hidden')) {
            closeDecisionPanel();
        }
    });
}

// ---------------------------------------------------------------------------
// Window hooks (preserved for backward compatibility)
// ---------------------------------------------------------------------------

window._simOpenDecision = function(functionId, successorName) {
    openDecisionPanel(functionId, successorName);
};

window._simUnlinkSharedService = function(functionId, successorName) {
    if (!state.simulationState) return;
    const decisions = state.simulationState.decisions;
    const propKey = getDecisionKey(functionId, successorName);
    const propDecision = decisions.get(propKey);
    if (!propDecision || !propDecision.sharedServiceOrigin) return;

    const primaryKey = propDecision.sharedServiceOrigin;
    const primaryDecision = decisions.get(primaryKey);

    decisions.delete(propKey);

    if (primaryDecision && Array.isArray(primaryDecision.sharedWithSuccessors)) {
        const updated = {
            ...primaryDecision,
            sharedWithSuccessors: primaryDecision.sharedWithSuccessors.filter(s => s !== successorName)
        };
        decisions.set(primaryKey, updated);
    }

    recomputeSimulation();
    closeDecisionPanel();
};

window._simBulkApplyErp = function(erpSystemId, successorName) {
    if (!state.simulationState) return;

    const erpNode = state.simulationState.baselineNodes
        ? state.simulationState.baselineNodes.find(n => n.id === erpSystemId) : null;
    const erpLabel = erpNode ? erpNode.label : 'this ERP';

    const allocMap = state.simulationState.baselineAllocation || state.successorAllocationMap;
    const decisions = state.simulationState.decisions;
    const successorFuncMap = allocMap ? allocMap.get(successorName) : null;
    if (!successorFuncMap) return;

    let appliedCount = 0;

    successorFuncMap.forEach((allocations, funcId) => {
        if (funcId === _currentFunctionId) return;
        const hasErp = allocations.some(a => a.system && a.system.id === erpSystemId);
        if (!hasErp) return;
        const existingKey = getDecisionKey(funcId, successorName);
        if (decisions.has(existingKey)) return;

        const decision = createDecision({
            functionId: funcId,
            successorName,
            systemChoice: 'choose',
            retainedSystemIds: [erpSystemId],
            boundaryChoice: 'none',
            disaggregationSplits: []
        });
        decisions.set(existingKey, decision);
        appliedCount++;
    });

    if (appliedCount === 0) return;
    recomputeSimulation();
    if (_currentFunctionId && _currentSuccessorName) {
        renderPanel(_currentFunctionId, _currentSuccessorName);
    }
};

window._simDecisionAddSplit = function() {
    // Legacy hook — disaggregation splits not used in new panel but kept for compatibility
};
