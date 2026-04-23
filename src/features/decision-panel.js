/**
 * Decision Panel — Function-first simulation decision UI
 *
 * Opens a modal for a specific (functionId, successorName) pair and lets
 * users record a FunctionDecision via two axes:
 *   Axis 1: System Choice   — choose existing / procure replacement / defer
 *   Axis 2: Operating Model — disaggregate / maintain-shared / establish-shared / none
 *
 * The panel reads competing systems from the baseline allocation map and writes
 * a FunctionDecision to state.simulationState.decisions, then calls
 * recomputeSimulation() to update the dashboard.
 *
 * Accessibility: focus trap, Escape to close, click-outside to close, all form
 * controls have associated labels.
 */

import { state } from '../state.js';
import { escHtml } from '../ui-helpers.js';
import { createDecision, getDecisionKey, validateDecision } from '../simulation/decisions.js';
import { classifyVestingZone } from '../analysis/allocation.js';
import { recomputeSimulation } from './simulation-panel.js';

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let _currentFunctionId = null;
let _currentSuccessorName = null;
let _panelOpener = null;
let _trapCleanup = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Opens the Decision Panel for a given (functionId, successorName) cell.
 * If a decision already exists for this cell it will be pre-filled.
 *
 * @param {string} functionId
 * @param {string} successorName
 */
export function openDecisionPanel(functionId, successorName) {
    if (!state.simulationState) return;

    _currentFunctionId = functionId;
    _currentSuccessorName = successorName;
    _panelOpener = document.activeElement;

    renderDecisionPanelContent(functionId, successorName);

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

/**
 * Renders all content inside #decisionPanelContent for the given cell.
 */
function renderDecisionPanelContent(functionId, successorName) {
    const content = document.getElementById('decisionPanelContent');
    if (!content) return;

    // Resolve function metadata
    const funcEntry = state.lgaFunctionMap ? state.lgaFunctionMap.get(functionId) : null;
    const funcLabel = funcEntry ? funcEntry.label : `Function ${functionId}`;

    // Get tier for this function
    const tierNum = state.tierMap ? (state.tierMap.get(functionId) || 2) : 2;
    const tierBadge = renderTierBadge(tierNum);

    // Retrieve competing systems from allocation
    const allocMap = state.simulationState.baselineAllocation || state.successorAllocationMap;
    const successorMap = allocMap ? allocMap.get(successorName) : null;
    const cellAllocations = successorMap ? (successorMap.get(functionId) || []) : [];
    const systems = cellAllocations.map(a => ({
        ...a.system,
        sourceCouncil: a.sourceCouncil,
        isDisaggregation: a.isDisaggregation || false,
        allocationType: a.allocationType
    }));

    // Check for an existing decision (edit mode)
    const decisions = state.simulationState.decisions;
    const existingDecision = decisions ? decisions.get(getDecisionKey(functionId, successorName)) : null;

    // Check if this is a propagated shared-service decision — show read-only view if so
    if (existingDecision && existingDecision.sharedServiceOrigin) {
        content.innerHTML = renderPropagatedSharedServiceView(existingDecision, funcLabel, successorName, tierBadge);
        return;
    }

    // Build the header
    const headerHtml = `
        <div class="mb-6">
            <p class="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Decision</p>
            <h2 id="decisionPanelTitle" class="text-2xl font-bold mb-1">${escHtml(funcLabel)}</h2>
            <div class="flex items-center gap-3 flex-wrap">
                <span class="text-sm font-bold text-gray-700">Successor: ${escHtml(successorName)}</span>
                ${tierBadge}
                ${existingDecision ? '<span class="text-xs font-bold text-[#00703c] bg-green-50 border border-[#00703c] px-2 py-0.5">Editing existing decision</span>' : ''}
            </div>
        </div>
    `;

    // Build competing systems cards
    const systemCardsHtml = renderSystemComparisonCards(systems, functionId, successorName);

    // Build Axis 1 (system choice)
    const axis1Html = renderAxisOne(systems, functionId, successorName, existingDecision);

    // Build Axis 2 (operating model boundary) — rendered conditionally inside axis 1 change handlers,
    // but always present in the DOM (conditionally hidden)
    const axis2Html = renderAxisTwo(systems, successorName, existingDecision);

    // Build ERP impact section (shown if any system is ERP)
    const hasErp = systems.some(s => s.isERP);
    const erpHtml = hasErp ? renderErpImpactSection(systems, successorName, functionId) : '';

    content.innerHTML = headerHtml + systemCardsHtml + axis1Html + axis2Html + erpHtml;

    // Wire Axis 1 radio change to update dynamic sections
    wireAxisOneInteractivity(systems, successorName, existingDecision);

    // Pre-fill if editing
    if (existingDecision) {
        prefillDecision(existingDecision, systems, successorName);
    }
}

// ---------------------------------------------------------------------------
// Propagated shared-service read-only view
// ---------------------------------------------------------------------------

/**
 * Renders a read-only view for a propagated shared-service decision.
 * Shows the shared system, the origin successor, and options to navigate to the
 * primary decision or unlink this propagated decision.
 *
 * @param {Object} decision  The propagated FunctionDecision
 * @param {string} funcLabel  Human-readable function label
 * @param {string} successorName  This successor's name
 * @param {string} tierBadge  HTML for tier badge
 * @returns {string} HTML
 */
function renderPropagatedSharedServiceView(decision, funcLabel, successorName, tierBadge) {
    const origin = decision.sharedServiceOrigin || '';
    // Parse the origin key back to successor name — format is 'functionId::successorName'
    const originParts = origin.split('::');
    const originSuccessorName = originParts.length >= 2 ? originParts.slice(1).join('::') : origin;

    // Find the shared system label
    const retainedId = decision.retainedSystemIds && decision.retainedSystemIds.length > 0
        ? decision.retainedSystemIds[0] : null;
    const baselineNodes = state.simulationState ? state.simulationState.baselineNodes : null;
    const sharedSystem = retainedId && baselineNodes
        ? baselineNodes.find(n => n.id === retainedId)
        : null;
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
                        onclick="window._simOpenDecision(${JSON.stringify(decision.functionId)}, ${JSON.stringify(originSuccessorName)})">
                    Edit shared arrangement in ${escHtml(originSuccessorName)}
                </button>
                <button type="button"
                        class="text-sm px-3 py-1.5 border border-[#d4351c] text-[#d4351c] font-bold hover:bg-red-50"
                        onclick="window._simUnlinkSharedService(${JSON.stringify(decision.functionId)}, ${JSON.stringify(successorName)})">
                    Remove from shared service
                </button>
            </div>
        </div>

        <p class="text-xs text-gray-500">To change which system serves this function in ${escHtml(successorName)}, first remove it from the shared service above, then make an independent decision.</p>
    `;
}

// ---------------------------------------------------------------------------
// Tier badge helper
// ---------------------------------------------------------------------------

function renderTierBadge(tier) {
    const tierConfig = {
        1: { label: 'Tier 1 — Day 1 Critical', bg: '#d4351c', fg: 'white' },
        2: { label: 'Tier 2 — High Priority', bg: '#f47738', fg: '#0b0c0c' },
        3: { label: 'Tier 3 — Post-Day 1', bg: '#b1b4b6', fg: '#0b0c0c' }
    };
    const cfg = tierConfig[tier] || tierConfig[2];
    return `<span style="background:${cfg.bg};color:${cfg.fg};font-size:11px;padding:2px 8px;font-weight:bold;">${escHtml(cfg.label)}</span>`;
}

// ---------------------------------------------------------------------------
// System comparison cards
// ---------------------------------------------------------------------------

/**
 * Renders side-by-side (or stacked) comparison cards for each competing system.
 */
export function renderSystemComparisonCards(systems, functionId, successorName) {
    if (!systems || systems.length === 0) {
        return `<div class="mb-6 p-4 bg-[#f3f2f1] border border-[#b1b4b6] text-sm text-gray-600 italic">No systems allocated to this function for this successor.</div>`;
    }

    const vestingDate = state.transitionStructure ? state.transitionStructure.vestingDate : null;
    const isHorizontal = systems.length <= 3;
    const containerClass = isHorizontal
        ? 'flex gap-3 flex-wrap'
        : 'flex flex-col gap-3';

    const cards = systems.map(sys => renderSystemCard(sys, vestingDate, isHorizontal)).join('');

    return `
        <div class="mb-6">
            <h3 class="font-bold text-sm uppercase tracking-wide text-gray-600 mb-3">Competing Systems (${systems.length})</h3>
            <div class="${containerClass}">
                ${cards}
            </div>
        </div>
    `;
}

function renderSystemCard(sys, vestingDate, isHorizontal) {
    const isErp = sys.isERP || false;
    const cardBorder = isErp ? 'border-[#d4351c] border-2' : 'border border-gray-300';
    const cardWidth = isHorizontal ? 'min-w-[180px] flex-1' : 'w-full';

    // Cloud / on-prem badge
    const cloudBadge = sys.isCloud
        ? `<span class="inline-block text-xs px-1.5 py-0.5 bg-[#cce2d8] text-[#00703c] font-bold border border-[#00703c]">Cloud</span>`
        : `<span class="inline-block text-xs px-1.5 py-0.5 bg-[#f3d9c9] text-[#f47738] font-bold border border-[#f47738]">On-prem</span>`;

    // Portability badge
    const portColors = { High: '#00703c', Medium: '#f47738', Low: '#d4351c' };
    const portBg = { High: '#cce2d8', Medium: '#fde68a', Low: '#fce4e1' };
    const portLabel = sys.portability || 'Unknown';
    const portBadge = `<span class="inline-block text-xs px-1.5 py-0.5 font-bold border" style="background:${portBg[portLabel]||'#f3f2f1'};color:${portColors[portLabel]||'#505a5f'};border-color:${portColors[portLabel]||'#b1b4b6'}">Port: ${escHtml(portLabel)}</span>`;

    // Data partitioning badge
    const dataLabel = sys.dataPartitioning || 'Unknown';
    const dataBadge = dataLabel === 'Monolithic'
        ? `<span class="inline-block text-xs px-1.5 py-0.5 bg-[#fce4e1] text-[#d4351c] font-bold border border-[#d4351c]">Monolithic</span>`
        : `<span class="inline-block text-xs px-1.5 py-0.5 bg-[#f3f2f1] text-gray-600 font-bold border border-gray-300">${escHtml(dataLabel)}</span>`;

    // ERP badge
    const erpBadge = isErp
        ? `<span class="inline-block text-xs px-1.5 py-0.5 bg-[#d4351c] text-white font-bold">ERP</span>`
        : '';

    // Contract / vesting zone
    let contractHtml = '';
    if (sys.endYear) {
        const endStr = `${sys.endYear}-${String(sys.endMonth || 12).padStart(2, '0')}`;
        let zoneBadge = '';
        if (vestingDate) {
            const zone = classifyVestingZone(sys.endYear, sys.endMonth || 12, sys.noticePeriod || 0, vestingDate);
            const zoneColors = {
                'pre-vesting': { bg: '#fce4e1', fg: '#d4351c', label: 'Pre-vesting' },
                'year-1': { bg: '#fde68a', fg: '#0b0c0c', label: 'Year 1' },
                'natural-expiry': { bg: '#cce2d8', fg: '#00703c', label: 'Natural expiry' },
                'long-tail': { bg: '#f3f2f1', fg: '#0b0c0c', label: 'Long-tail' }
            };
            const z = zoneColors[zone] || zoneColors['long-tail'];
            zoneBadge = `<span class="inline-block text-xs px-1.5 py-0.5 font-bold border" style="background:${z.bg};color:${z.fg};border-color:${z.fg}">${z.label}</span>`;
        }
        contractHtml = `<div class="text-xs text-gray-600 mt-1">Ends: <strong>${escHtml(endStr)}</strong>${sys.noticePeriod ? ` (${sys.noticePeriod}m notice)` : ''}</div>${zoneBadge ? `<div class="mt-1">${zoneBadge}</div>` : ''}`;
    }

    // Disaggregation note
    const disaggNote = sys.isDisaggregation
        ? `<div class="mt-1 text-xs text-[#f47738] font-bold">Partial predecessor system</div>`
        : '';

    return `
        <div class="${cardBorder} p-3 bg-white ${cardWidth}" data-system-id="${escHtml(sys.id || '')}">
            <div class="font-bold text-sm mb-0.5">${escHtml(sys.label || 'Unnamed')}</div>
            <div class="text-xs text-gray-500 mb-2">${escHtml(sys.sourceCouncil || 'Unknown council')}</div>
            <div class="flex flex-wrap gap-1 mb-2">
                ${cloudBadge}
                ${portBadge}
                ${dataBadge}
                ${erpBadge}
            </div>
            ${sys.vendor ? `<div class="text-xs text-gray-600">Vendor: <strong>${escHtml(sys.vendor)}</strong></div>` : ''}
            ${sys.users != null ? `<div class="text-xs text-gray-600">Users: <strong>${Number(sys.users).toLocaleString()}</strong></div>` : ''}
            ${sys.annualCost != null ? `<div class="text-xs text-gray-600">Cost: <strong>£${Number(sys.annualCost).toLocaleString()}/yr</strong></div>` : ''}
            ${contractHtml}
            ${disaggNote}
        </div>
    `;
}

// ---------------------------------------------------------------------------
// Axis 1: System Choice
// ---------------------------------------------------------------------------

/**
 * Renders the Axis 1 radio group (choose / procure / defer).
 */
export function renderAxisOne(systems, functionId, successorName, existingDecision) {
    const existingChoice = existingDecision ? existingDecision.systemChoice : null;

    // Build choose options (one per system, as radio buttons with label)
    const chooseOptions = systems.length > 0 ? systems.map(sys => {
        const isErp = sys.isERP || false;
        return `
            <div class="flex items-start gap-2 mt-2">
                <input type="radio" name="chooseSystem" id="chooseSystem_${escHtml(sys.id)}"
                       value="${escHtml(sys.id)}" class="mt-0.5">
                <label for="chooseSystem_${escHtml(sys.id)}" class="text-sm cursor-pointer">
                    <strong>${escHtml(sys.label || 'Unnamed')}</strong>
                    ${isErp ? '<span class="ml-1 text-xs text-[#d4351c] font-bold">(ERP)</span>' : ''}
                    <span class="text-gray-500 text-xs ml-1">${escHtml(sys.sourceCouncil || '')}</span>
                    ${sys.users != null ? `<span class="text-gray-500 text-xs ml-1">· ${Number(sys.users).toLocaleString()} users</span>` : ''}
                </label>
            </div>
        `;
    }).join('') : '<p class="text-sm text-gray-500 italic mt-1">No systems available to choose.</p>';

    // Decommission preview (shown when a system is chosen)
    const decommissionPreviewHtml = `
        <div id="decommissionPreview" class="hidden mt-3 p-3 bg-[#f3f2f1] border-l-4 border-l-[#d4351c] text-xs">
            <span class="font-bold text-[#d4351c]">Will decommission:</span>
            <div id="decommissionList" class="mt-1"></div>
        </div>
    `;

    // Deferral contrast: a collapsible <details> section shown in the "choose" option
    // so users can compare the consolidation decision against deferring
    const vestingDate = state.transitionStructure ? state.transitionStructure.vestingDate : null;
    const totalCost = systems.reduce((sum, s) => sum + (s.annualCost || 0), 0);
    const deferralContrastHtml = renderDeferralContrastCollapsible(systems, vestingDate, totalCost);

    // Combined cost for defer option (also shown in defer detail)
    const expiringSystemsHtml = renderDeferralContrast(systems, vestingDate);

    return `
        <div class="mb-6">
            <h3 class="font-bold text-base border-b border-[#b1b4b6] pb-2 mb-3">Axis 1: System Choice</h3>
            <fieldset>
                <legend class="sr-only">System choice for ${escHtml(successorName)}</legend>

                <!-- Option: Choose existing system -->
                <div class="mb-4">
                    <label class="flex items-center gap-2 font-bold text-sm cursor-pointer">
                        <input type="radio" name="axis1Choice" id="axis1Choose" value="choose"
                               ${existingChoice === 'choose' ? 'checked' : ''}>
                        Choose existing system
                    </label>
                    <div id="axis1ChooseDetail" class="ml-6 mt-2 ${existingChoice === 'choose' ? '' : 'hidden'}">
                        <fieldset>
                            <legend class="text-xs text-gray-600 mb-1">Select the system(s) to retain:</legend>
                            ${chooseOptions}
                        </fieldset>
                        ${decommissionPreviewHtml}
                        ${deferralContrastHtml}
                    </div>
                </div>

                <!-- Option: Procure replacement -->
                <div class="mb-4">
                    <label class="flex items-center gap-2 font-bold text-sm cursor-pointer">
                        <input type="radio" name="axis1Choice" id="axis1Procure" value="procure"
                               ${existingChoice === 'procure' ? 'checked' : ''}>
                        Procure replacement
                    </label>
                    <div id="axis1ProcureDetail" class="ml-6 mt-2 ${existingChoice === 'procure' ? '' : 'hidden'}">
                        <p class="text-xs text-gray-600 mb-2">All current systems for this function will be decommissioned and replaced.</p>
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label for="procureLabel" class="block text-xs font-bold mb-1">System name <span class="text-[#d4351c]">*</span></label>
                                <input type="text" id="procureLabel" class="border border-[#0b0c0c] p-1.5 text-sm w-full" placeholder="e.g. Northgate iDev" required>
                            </div>
                            <div>
                                <label for="procureVendor" class="block text-xs font-bold mb-1">Vendor</label>
                                <input type="text" id="procureVendor" class="border border-[#b1b4b6] p-1.5 text-sm w-full" placeholder="e.g. Northgate">
                            </div>
                            <div>
                                <label for="procureCost" class="block text-xs font-bold mb-1">Annual cost (£)</label>
                                <input type="number" id="procureCost" class="border border-[#b1b4b6] p-1.5 text-sm w-full" placeholder="e.g. 150000" min="0">
                            </div>
                            <div class="flex items-end pb-1.5">
                                <label class="flex items-center gap-2 text-xs font-bold cursor-pointer">
                                    <input type="checkbox" id="procureCloud" checked>
                                    Cloud-hosted
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Option: Defer -->
                <div class="mb-2">
                    <label class="flex items-center gap-2 font-bold text-sm cursor-pointer">
                        <input type="radio" name="axis1Choice" id="axis1Defer" value="defer"
                               ${existingChoice === 'defer' ? 'checked' : ''}>
                        Defer — keep running in parallel
                    </label>
                    <div id="axis1DeferDetail" class="ml-6 mt-2 ${existingChoice === 'defer' ? '' : 'hidden'}">
                        ${totalCost > 0 ? `<p class="text-sm text-gray-700"><strong>Combined ongoing cost:</strong> £${totalCost.toLocaleString()}/yr</p>` : ''}
                        ${expiringSystemsHtml}
                    </div>
                </div>
            </fieldset>
        </div>
    `;
}

/**
 * Returns an HTML summary of systems whose contracts may need extending for deferral.
 */
export function renderDeferralContrast(systems, vestingDate) {
    if (!systems || systems.length === 0) return '';
    if (!vestingDate) {
        return `<p class="text-xs text-gray-500 mt-1">Configure a vesting date to see contract extension requirements.</p>`;
    }

    const expiringHtml = systems
        .filter(s => s.endYear)
        .map(s => {
            const zone = classifyVestingZone(s.endYear, s.endMonth || 12, s.noticePeriod || 0, vestingDate);
            if (zone === 'pre-vesting' || zone === 'year-1') {
                const endStr = `${s.endYear}-${String(s.endMonth || 12).padStart(2, '0')}`;
                const zoneLabel = zone === 'pre-vesting' ? 'Pre-vesting — extension required before vesting' : 'Year 1 — extension likely needed';
                return `<div class="text-xs mt-1"><strong>${escHtml(s.label)}</strong>: ends ${endStr} — <span class="text-[#d4351c] font-bold">${zoneLabel}</span></div>`;
            }
            return null;
        })
        .filter(Boolean)
        .join('');

    if (!expiringHtml) {
        return `<p class="text-xs text-gray-600 mt-1">No contracts require immediate extension for deferral.</p>`;
    }

    return `
        <div class="mt-2 p-2 bg-yellow-50 border-l-4 border-l-[#f47738] text-xs">
            <span class="font-bold">Contract extensions required for deferral:</span>
            ${expiringHtml}
        </div>
    `;
}

/**
 * Renders a collapsible <details> "Compare with deferral" section for the "choose" option.
 * Shows combined parallel running cost, contract extensions needed, and operational notes.
 *
 * @param {Array} systems
 * @param {string|null} vestingDate
 * @param {number} totalCost
 * @returns {string} HTML
 */
function renderDeferralContrastCollapsible(systems, vestingDate, totalCost) {
    if (!systems || systems.length === 0) return '';

    // Only meaningful if there are 2+ systems (otherwise deferral and consolidation are the same)
    if (systems.length < 2) return '';

    // Contract extensions needed for deferral
    let contractExtensionsHtml = '';
    if (vestingDate) {
        const expiringItems = systems
            .filter(s => s.endYear)
            .map(s => {
                const zone = classifyVestingZone(s.endYear, s.endMonth || 12, s.noticePeriod || 0, vestingDate);
                if (zone === 'pre-vesting' || zone === 'year-1') {
                    const endStr = `${s.endYear}-${String(s.endMonth || 12).padStart(2, '0')}`;
                    const urgency = zone === 'pre-vesting' ? 'extension required before vesting' : 'extension likely needed';
                    return `<li><strong>${escHtml(s.label)}</strong>: ends ${endStr} — <span class="text-[#d4351c] font-bold">${urgency}</span></li>`;
                }
                return null;
            })
            .filter(Boolean);

        if (expiringItems.length > 0) {
            contractExtensionsHtml = `
                <div class="mt-2">
                    <p class="font-bold text-xs mb-1">Contract extensions needed:</p>
                    <ul class="list-disc pl-4 text-xs space-y-0.5">${expiringItems.join('')}</ul>
                </div>`;
        } else {
            contractExtensionsHtml = `<p class="text-xs text-gray-600 mt-1">No contracts require immediate extension for deferral.</p>`;
        }
    } else {
        contractExtensionsHtml = `<p class="text-xs text-gray-500 mt-1">Configure a vesting date to see contract extension requirements.</p>`;
    }

    const costLine = totalCost > 0
        ? `<p class="text-xs"><strong>Combined parallel running cost:</strong> <span class="font-bold text-[#d4351c]">£${totalCost.toLocaleString()}/yr</span> (${systems.length} systems)</p>`
        : '';

    return `
        <details class="mt-3 border border-[#b1b4b6] bg-yellow-50">
            <summary class="px-3 py-2 text-xs font-bold cursor-pointer text-gray-700 select-none">
                Compare with deferral — what if we keep all systems running in parallel?
            </summary>
            <div class="px-3 pb-3 pt-1 text-xs space-y-1">
                ${costLine}
                ${contractExtensionsHtml}
                <p class="text-xs text-gray-700 mt-2"><strong>No user migration required</strong> — all users remain on their current systems.</p>
                <p class="text-xs text-gray-600 mt-1"><em>Operational overhead:</em> running parallel systems increases support, licensing, and integration burden for the successor authority.</p>
            </div>
        </details>
    `;
}

// ---------------------------------------------------------------------------
// Axis 2: Operating Model Boundary
// ---------------------------------------------------------------------------

/**
 * Renders the Axis 2 section (boundary choice).
 * Hidden by default; shown when a chosen/procured system crosses boundaries.
 */
export function renderAxisTwo(systems, successorName, existingDecision) {
    const existingBoundary = existingDecision ? existingDecision.boundaryChoice : null;
    const existingSplits = existingDecision ? (existingDecision.disaggregationSplits || []) : [];

    // Pre-determine visibility based on systems and transition context
    const hasShared = systems.some(s => s.sharedWith && s.sharedWith.length > 0);
    const hasDisagg = systems.some(s => s.isDisaggregation);
    const hasMultipleSuccessors = (state.transitionStructure?.successors?.length || 0) > 1;

    // Hide entire Axis 2 when none of the contextual conditions apply AND no existing boundary choice
    const isRelevant = hasShared || hasDisagg || hasMultipleSuccessors;
    const hasSectionContent = isRelevant || existingBoundary;

    // Build disaggregation split rows
    const splitRows = existingSplits.length > 0
        ? existingSplits.map((split, i) => renderSplitRow(split, i)).join('')
        : renderSplitRow({ successorName: '', label: '' }, 0) + renderSplitRow({ successorName: '', label: '' }, 1);

    // Individual option visibility: each option hidden unless contextually relevant OR already selected
    const disaggHidden = (!hasDisagg && existingBoundary !== 'disaggregate') ? 'hidden' : '';
    const maintainSharedHidden = (!hasShared && existingBoundary !== 'maintain-shared') ? 'hidden' : '';
    const establishSharedHidden = (!hasMultipleSuccessors && existingBoundary !== 'establish-shared') ? 'hidden' : '';

    return `
        <div id="axis2Section" class="mb-6 ${hasSectionContent ? '' : 'hidden'}">
            <h3 class="font-bold text-base border-b border-[#b1b4b6] pb-2 mb-3">Axis 2: Operating Model Boundary</h3>
            <p class="text-xs text-gray-600 mb-3">Shown when the chosen system crosses successor boundaries, has shared service arrangements, or is a partial predecessor system.</p>
            <fieldset>
                <legend class="sr-only">Operating model boundary for ${escHtml(successorName)}</legend>

                <div class="mb-2">
                    <label class="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="axis2Choice" id="axis2None" value="none"
                               ${!existingBoundary || existingBoundary === 'none' ? 'checked' : ''}>
                        <span><strong>No boundary change</strong> — operate within single successor</span>
                    </label>
                </div>

                <div class="mb-2 ${disaggHidden}">
                    <label class="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="axis2Choice" id="axis2Disaggregate" value="disaggregate"
                               ${existingBoundary === 'disaggregate' ? 'checked' : ''}>
                        <span><strong>Disaggregate</strong> — split system along successor boundaries</span>
                    </label>
                    <div id="axis2DisaggDetail" class="ml-6 mt-2 ${existingBoundary === 'disaggregate' ? '' : 'hidden'}">
                        <p class="text-xs text-gray-600 mb-2">Define how the system will be split. Each successor gets its own instance:</p>
                        <div id="disaggSplitsContainer" class="space-y-2">
                            ${splitRows}
                        </div>
                        <button type="button" onclick="window._simDecisionAddSplit()" class="text-xs text-[#1d70b8] underline font-bold mt-2">+ Add split</button>
                    </div>
                </div>

                <div class="mb-2 ${maintainSharedHidden}">
                    <label class="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="axis2Choice" id="axis2MaintainShared" value="maintain-shared"
                               ${existingBoundary === 'maintain-shared' ? 'checked' : ''}>
                        <span><strong>Maintain shared service</strong> — keep existing cross-boundary arrangement</span>
                    </label>
                </div>

                <div class="mb-2 ${establishSharedHidden}">
                    <label class="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="axis2Choice" id="axis2EstablishShared" value="establish-shared"
                               ${existingBoundary === 'establish-shared' ? 'checked' : ''}>
                        <span><strong>Establish shared service</strong> — create new cross-boundary arrangement</span>
                    </label>
                    <div id="axis2EstablishSharedDetail" class="ml-6 mt-2 ${existingBoundary === 'establish-shared' ? '' : 'hidden'}">
                        <p class="text-xs text-gray-600 mb-2">Select which other successors will share this service. The chosen system will be adopted as the decided system for each selected successor, decommissioning their existing systems:</p>
                        <fieldset>
                            <legend class="text-xs font-bold text-gray-700 mb-2">Successors to include in shared service:</legend>
                            <div id="establishSharedSuccessorsContainer" class="space-y-1">
                                ${renderEstablishSharedSuccessorCheckboxes(successorName, existingDecision)}
                            </div>
                        </fieldset>
                    </div>
                </div>
            </fieldset>
        </div>
    `;
}

/**
 * Renders one checkbox per other successor in the transition structure.
 * Pre-fills from existingDecision.sharedWithSuccessors if editing.
 *
 * @param {string} currentSuccessorName
 * @param {Object|null} existingDecision
 * @returns {string} HTML
 */
function renderEstablishSharedSuccessorCheckboxes(currentSuccessorName, existingDecision) {
    const successors = state.transitionStructure ? state.transitionStructure.successors : [];
    const otherSuccessors = successors.filter(s => s.name !== currentSuccessorName);

    if (otherSuccessors.length === 0) {
        return '<p class="text-xs text-gray-500 italic">No other successor authorities available.</p>';
    }

    const preChecked = new Set(
        (existingDecision && existingDecision.sharedWithSuccessors) ? existingDecision.sharedWithSuccessors : []
    );

    return otherSuccessors.map(s => {
        const safeId = `shareWith_${escHtml(s.name.replace(/\s+/g, '_'))}`;
        const checked = preChecked.has(s.name) ? 'checked' : '';
        return `
            <div class="flex items-center gap-2">
                <input type="checkbox" id="${safeId}" name="establishSharedSuccessor"
                       value="${escHtml(s.name)}" class="establish-shared-successor-cb" ${checked}>
                <label for="${safeId}" class="text-sm cursor-pointer">${escHtml(s.name)}</label>
            </div>
        `;
    }).join('');
}

function renderSplitRow(split, index) {
    return `
        <div class="flex items-center gap-2 split-row">
            <div class="flex-1">
                <label for="splitSuccessor_${index}" class="sr-only">Successor name for split ${index + 1}</label>
                <input type="text" id="splitSuccessor_${index}" class="border border-[#b1b4b6] p-1.5 text-xs w-full split-successor-input"
                       placeholder="Successor name" value="${escHtml(split.successorName || '')}">
            </div>
            <div class="flex-1">
                <label for="splitLabel_${index}" class="sr-only">System label for split ${index + 1}</label>
                <input type="text" id="splitLabel_${index}" class="border border-[#b1b4b6] p-1.5 text-xs w-full split-label-input"
                       placeholder="System instance label (optional)" value="${escHtml(split.label || '')}">
            </div>
        </div>
    `;
}

// ---------------------------------------------------------------------------
// ERP Impact section
// ---------------------------------------------------------------------------

/**
 * Renders the ERP Impact section showing all functions the ERP covers in this successor.
 */
export function renderErpImpactSection(systems, successorName, currentFunctionId) {
    const erpSystems = systems.filter(s => s.isERP);
    if (erpSystems.length === 0) return '';

    const allocMap = state.simulationState.baselineAllocation || state.successorAllocationMap;
    const decisions = state.simulationState.decisions || new Map();
    const funcMap = state.lgaFunctionMap || new Map();

    let erpSectionsHtml = '';

    for (const erpSystem of erpSystems) {
        const erpSystemId = erpSystem.id;
        const successorFuncMap = allocMap ? allocMap.get(successorName) : null;
        if (!successorFuncMap) continue;

        // Find all functions this ERP serves in this successor
        const erpFunctions = [];
        successorFuncMap.forEach((allocations, funcId) => {
            if (allocations.some(a => a.system && a.system.id === erpSystemId)) {
                const existing = decisions.get(getDecisionKey(funcId, successorName));
                const funcEntry = funcMap.get(funcId);
                erpFunctions.push({
                    funcId,
                    label: funcEntry ? funcEntry.label : `Function ${funcId}`,
                    decided: !!existing,
                    isCurrent: funcId === currentFunctionId,
                    decision: existing
                });
            }
        });

        if (erpFunctions.length === 0) continue;

        const decidedCount = erpFunctions.filter(f => f.decided).length;

        const undecidedFunctions = erpFunctions.filter(f => !f.decided && !f.isCurrent);

        const funcRows = erpFunctions.map(f => {
            const status = f.isCurrent
                ? '<span class="text-xs font-bold text-[#1d70b8]">THIS DECISION</span>'
                : f.decided
                    ? `<span class="text-xs font-bold text-[#00703c]">Decided: ${escHtml(f.decision ? describeDecision(f.decision) : 'unknown')}</span>`
                    : '<span class="text-xs text-gray-500">Undecided</span>';

            const check = f.decided || f.isCurrent
                ? '<span class="text-[#00703c] font-bold mr-1">[x]</span>'
                : '<span class="text-gray-400 mr-1">[ ]</span>';

            return `<div class="flex items-center gap-2 text-xs py-0.5">
                ${check}<span class="${f.isCurrent ? 'font-bold' : ''}">${escHtml(f.label)}</span>
                <span class="ml-auto">${status}</span>
            </div>`;
        }).join('');

        // Bulk apply affordance: shown only when the current decision is a "choose" type
        // and there are undecided functions this ERP covers in the same successor.
        const bulkApplyHtml = undecidedFunctions.length > 0
            ? `<div class="mt-3 p-3 bg-blue-50 border-l-4 border-l-[#1d70b8]">
                <p class="text-sm font-bold">Apply to all ${undecidedFunctions.length} undecided function${undecidedFunctions.length !== 1 ? 's' : ''}?</p>
                <p class="text-xs text-gray-600 mt-1">This will apply the same system choice to: ${escHtml(undecidedFunctions.map(f => f.label).join(', '))}</p>
                <button type="button" class="gds-btn text-sm px-3 py-1.5 mt-2" onclick="window._simBulkApplyErp('${escHtml(erpSystemId)}', '${escHtml(successorName)}')">Apply to all undecided</button>
            </div>`
            : '';

        erpSectionsHtml += `
            <div class="mb-4 p-3 border border-[#d4351c] bg-[#fce4e1]">
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-xs px-1.5 py-0.5 bg-[#d4351c] text-white font-bold">ERP</span>
                    <strong class="text-sm">${escHtml(erpSystem.label || 'ERP System')}</strong>
                    <span class="text-xs text-gray-600">— ${erpSystem.vendor ? escHtml(erpSystem.vendor) : 'Unknown vendor'}</span>
                </div>
                <p class="text-xs text-gray-700 mb-2">Serves <strong>${erpFunctions.length}</strong> function${erpFunctions.length !== 1 ? 's' : ''} in ${escHtml(successorName)} — ${decidedCount}/${erpFunctions.length} decided:</p>
                <div class="space-y-0.5">
                    ${funcRows}
                </div>
                <p class="text-xs text-gray-500 mt-2">Removing this ERP from one function does not decommission it — it continues to serve other functions unless all are decided away.</p>
                ${bulkApplyHtml}
            </div>
        `;
    }

    if (!erpSectionsHtml) return '';

    return `
        <div class="mb-6">
            <h3 class="font-bold text-base border-b border-[#b1b4b6] pb-2 mb-3">ERP Impact</h3>
            ${erpSectionsHtml}
        </div>
    `;
}

function describeDecision(decision) {
    if (!decision) return '';
    switch (decision.systemChoice) {
        case 'choose':
            return `Keep ${(decision.retainedSystemIds || []).length} system(s)`;
        case 'procure':
            return `Procure: ${decision.procuredSystem ? escHtml(decision.procuredSystem.label) : 'new system'}`;
        case 'defer':
            return 'Deferred';
        default:
            return decision.systemChoice;
    }
}

// ---------------------------------------------------------------------------
// Interactivity wiring
// ---------------------------------------------------------------------------

/**
 * Wires radio/change handlers for Axis 1 within the modal.
 */
function wireAxisOneInteractivity(systems, successorName, existingDecision) {
    const content = document.getElementById('decisionPanelContent');
    if (!content) return;

    const chooseRadio = content.querySelector('#axis1Choose');
    const procureRadio = content.querySelector('#axis1Procure');
    const deferRadio = content.querySelector('#axis1Defer');

    const chooseDetail = content.querySelector('#axis1ChooseDetail');
    const procureDetail = content.querySelector('#axis1ProcureDetail');
    const deferDetail = content.querySelector('#axis1DeferDetail');

    const axis2Section = content.querySelector('#axis2Section');
    const disaggDetail = content.querySelector('#axis2DisaggDetail');
    const axis2Radios = content.querySelectorAll('input[name="axis2Choice"]');

    function showAxis1Detail(choice) {
        if (chooseDetail) chooseDetail.classList.toggle('hidden', choice !== 'choose');
        if (procureDetail) procureDetail.classList.toggle('hidden', choice !== 'procure');
        if (deferDetail) deferDetail.classList.toggle('hidden', choice !== 'defer');

        // Show Axis 2 only for choose or procure (not defer)
        if (axis2Section) {
            const hasMultipleSuccessors = (state.transitionStructure?.successors?.length || 0) > 1;
            const shouldShow = (choice === 'choose' || choice === 'procure') &&
                (systems.some(s => s.sharedWith && s.sharedWith.length > 0) ||
                 systems.some(s => s.isDisaggregation) ||
                 hasMultipleSuccessors ||
                 (existingDecision && existingDecision.boundaryChoice && existingDecision.boundaryChoice !== 'none'));
            axis2Section.classList.toggle('hidden', !shouldShow);
        }
    }

    if (chooseRadio) chooseRadio.addEventListener('change', () => {
        if (chooseRadio.checked) showAxis1Detail('choose');
    });
    if (procureRadio) procureRadio.addEventListener('change', () => {
        if (procureRadio.checked) showAxis1Detail('procure');
    });
    if (deferRadio) deferRadio.addEventListener('change', () => {
        if (deferRadio.checked) showAxis1Detail('defer');
    });

    // Wire choose-system radio to update decommission preview
    content.querySelectorAll('input[name="chooseSystem"]').forEach(radio => {
        radio.addEventListener('change', () => {
            updateDecommissionPreview(systems, radio.value, content);
        });
    });

    const establishSharedDetail = content.querySelector('#axis2EstablishSharedDetail');

    // Wire Axis 2 radios to show/hide detail panels
    axis2Radios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (disaggDetail) {
                disaggDetail.classList.toggle('hidden', radio.value !== 'disaggregate');
            }
            if (establishSharedDetail) {
                establishSharedDetail.classList.toggle('hidden', radio.value !== 'establish-shared');
            }
        });
    });
}

/**
 * Updates the decommission preview list when a system is chosen.
 */
function updateDecommissionPreview(systems, chosenId, content) {
    const preview = content.querySelector('#decommissionPreview');
    const list = content.querySelector('#decommissionList');
    if (!preview || !list) return;

    const toDecommission = systems.filter(s => s.id !== chosenId);
    if (toDecommission.length === 0) {
        preview.classList.add('hidden');
        return;
    }

    preview.classList.remove('hidden');
    list.innerHTML = toDecommission.map(s => {
        const userNote = s.users != null ? ` — ${Number(s.users).toLocaleString()} users to migrate` : '';
        const erpNote = s.isERP ? ' <span class="text-[#d4351c] font-bold">(ERP — edge severed only if serving other functions)</span>' : '';
        return `<div class="mt-0.5">${escHtml(s.label)}${erpNote}${userNote}</div>`;
    }).join('');
}

// ---------------------------------------------------------------------------
// Pre-fill from existing decision
// ---------------------------------------------------------------------------

function prefillDecision(decision, systems, successorName) {
    const content = document.getElementById('decisionPanelContent');
    if (!content) return;

    // Axis 1
    const axis1Radio = content.querySelector(`input[name="axis1Choice"][value="${decision.systemChoice}"]`);
    if (axis1Radio) {
        axis1Radio.checked = true;
        axis1Radio.dispatchEvent(new Event('change'));
    }

    if (decision.systemChoice === 'choose' && decision.retainedSystemIds && decision.retainedSystemIds.length > 0) {
        const firstRetained = decision.retainedSystemIds[0];
        const sysRadio = content.querySelector(`input[name="chooseSystem"][value="${CSS.escape(firstRetained)}"]`);
        if (sysRadio) {
            sysRadio.checked = true;
            updateDecommissionPreview(systems, firstRetained, content);
        }
    }

    if (decision.systemChoice === 'procure' && decision.procuredSystem) {
        const ps = decision.procuredSystem;
        const labelEl = content.querySelector('#procureLabel');
        const vendorEl = content.querySelector('#procureVendor');
        const costEl = content.querySelector('#procureCost');
        const cloudEl = content.querySelector('#procureCloud');
        if (labelEl) labelEl.value = ps.label || '';
        if (vendorEl) vendorEl.value = ps.vendor || '';
        if (costEl) costEl.value = ps.annualCost != null ? ps.annualCost : '';
        if (cloudEl) cloudEl.checked = ps.isCloud !== false;
    }

    // Axis 2
    if (decision.boundaryChoice && decision.boundaryChoice !== 'none') {
        const axis2Radio = content.querySelector(`input[name="axis2Choice"][value="${decision.boundaryChoice}"]`);
        if (axis2Radio) {
            axis2Radio.checked = true;
            axis2Radio.dispatchEvent(new Event('change'));
        }

        if (decision.boundaryChoice === 'disaggregate' && decision.disaggregationSplits && decision.disaggregationSplits.length > 0) {
            const container = content.querySelector('#disaggSplitsContainer');
            if (container) {
                container.innerHTML = decision.disaggregationSplits.map((split, i) => renderSplitRow(split, i)).join('');
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Apply Decision
// ---------------------------------------------------------------------------

/**
 * Reads the modal form, creates a FunctionDecision, stores it, and recomputes.
 */
export function applyDecisionFromPanel() {
    if (!state.simulationState) return;
    if (!_currentFunctionId || !_currentSuccessorName) return;

    const content = document.getElementById('decisionPanelContent');
    const errorEl = document.getElementById('decisionPanelError');

    if (!content || !errorEl) return;

    // Clear previous errors
    errorEl.classList.add('hidden');
    errorEl.textContent = '';

    // Read Axis 1
    const axis1Radio = content.querySelector('input[name="axis1Choice"]:checked');
    if (!axis1Radio) {
        showDecisionError('Please select a system choice (Axis 1).');
        return;
    }
    const systemChoice = axis1Radio.value;

    // Validate and read choice-specific fields
    let retainedSystemIds = [];
    let procuredSystem = null;

    if (systemChoice === 'choose') {
        const chosenRadio = content.querySelector('input[name="chooseSystem"]:checked');
        if (!chosenRadio) {
            showDecisionError('Please select which system to retain.');
            return;
        }
        retainedSystemIds = [chosenRadio.value];

    } else if (systemChoice === 'procure') {
        const labelEl = content.querySelector('#procureLabel');
        const label = labelEl ? labelEl.value.trim() : '';
        if (!label) {
            showDecisionError('Please enter a system name for the procured replacement.');
            if (labelEl) labelEl.focus();
            return;
        }
        const vendorEl = content.querySelector('#procureVendor');
        const costEl = content.querySelector('#procureCost');
        const cloudEl = content.querySelector('#procureCloud');
        procuredSystem = {
            label,
            vendor: vendorEl ? vendorEl.value.trim() : '',
            annualCost: costEl && costEl.value ? Number(costEl.value) : 0,
            isCloud: cloudEl ? cloudEl.checked : true
        };
    }

    // Read Axis 2
    const axis2Radio = content.querySelector('input[name="axis2Choice"]:checked');
    const boundaryChoice = axis2Radio ? axis2Radio.value : 'none';

    // Read disaggregation splits
    let disaggregationSplits = [];
    if (boundaryChoice === 'disaggregate') {
        const successorInputs = content.querySelectorAll('.split-successor-input');
        const labelInputs = content.querySelectorAll('.split-label-input');
        successorInputs.forEach((inp, i) => {
            const splitSuccessor = inp.value.trim();
            const splitLabel = labelInputs[i] ? labelInputs[i].value.trim() : '';
            if (splitSuccessor) {
                disaggregationSplits.push({ successorName: splitSuccessor, label: splitLabel });
            }
        });
        if (disaggregationSplits.length < 2) {
            showDecisionError('Disaggregation requires at least 2 splits with successor names.');
            return;
        }
    }

    // Read establish-shared successors
    let sharedWithSuccessors = [];
    if (boundaryChoice === 'establish-shared') {
        const checkedCbs = content.querySelectorAll('.establish-shared-successor-cb:checked');
        sharedWithSuccessors = [...checkedCbs].map(cb => cb.value);
        if (sharedWithSuccessors.length === 0) {
            showDecisionError('Establish shared service requires at least one other successor to share with.');
            return;
        }
    }

    // --- Cascade delete: if the OLD decision had sharedWithSuccessors, delete those propagated decisions ---
    const currentKey = getDecisionKey(_currentFunctionId, _currentSuccessorName);
    const oldDecision = state.simulationState.decisions.get(currentKey);
    if (oldDecision && oldDecision.sharedWithSuccessors && oldDecision.sharedWithSuccessors.length > 0) {
        for (const oldSharedSuccessor of oldDecision.sharedWithSuccessors) {
            const oldPropKey = getDecisionKey(_currentFunctionId, oldSharedSuccessor);
            const oldPropDecision = state.simulationState.decisions.get(oldPropKey);
            // Only delete if it was actually a propagated decision for THIS primary
            if (oldPropDecision && oldPropDecision.sharedServiceOrigin === currentKey) {
                state.simulationState.decisions.delete(oldPropKey);
            }
        }
    }

    // --- Conflict check for establish-shared: target successors must not have independent decisions ---
    if (boundaryChoice === 'establish-shared') {
        for (const sharedSuccessor of sharedWithSuccessors) {
            const targetKey = getDecisionKey(_currentFunctionId, sharedSuccessor);
            const targetDecision = state.simulationState.decisions.get(targetKey);
            if (targetDecision && !targetDecision.sharedServiceOrigin) {
                showDecisionError(`${sharedSuccessor} already has an independent decision for this function. Remove it before establishing a shared service.`);
                return;
            }
        }
    }

    // --- Pre-generate procured system ID for establish-shared + procure so propagated decisions can reference it ---
    if (boundaryChoice === 'establish-shared' && systemChoice === 'procure' && procuredSystem) {
        const slug = _currentSuccessorName.replace(/\s+/g, '-').toLowerCase();
        procuredSystem.id = `sys-procured-${_currentFunctionId}-${slug}-${Date.now()}`;
    }

    // Create the primary decision
    const decision = createDecision({
        functionId: _currentFunctionId,
        successorName: _currentSuccessorName,
        systemChoice,
        retainedSystemIds,
        procuredSystem,
        boundaryChoice,
        disaggregationSplits,
        sharedWithSuccessors
    });

    // Validate
    const validation = validateDecision(decision);
    if (!validation.valid) {
        showDecisionError('Validation failed: ' + validation.errors.join(', '));
        return;
    }

    // Store primary decision
    state.simulationState.decisions.set(currentKey, decision);

    // --- Create propagated decisions for each shared successor ---
    if (boundaryChoice === 'establish-shared' && sharedWithSuccessors.length > 0) {
        // Determine retainedSystemIds for propagated decisions
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
                functionId: _currentFunctionId,
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

            const propKey = getDecisionKey(_currentFunctionId, sharedSuccessor);
            state.simulationState.decisions.set(propKey, propagatedDecision);
        }
    }

    // Recompute simulation
    recomputeSimulation();

    // Close modal
    closeDecisionPanel();
}

function showDecisionError(msg) {
    const errorEl = document.getElementById('decisionPanelError');
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
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
// Focus trap (same pattern as simulation-panel.js)
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
    document.getElementById('btnApplyDecision').addEventListener('click', applyDecisionFromPanel);

    _decisionPanelModal.addEventListener('click', (e) => {
        if (e.target === _decisionPanelModal) closeDecisionPanel();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !_decisionPanelModal.classList.contains('hidden')) {
            closeDecisionPanel();
        }
    });
}

// ---------------------------------------------------------------------------
// Window hook for adding disaggregation splits
// ---------------------------------------------------------------------------

window._simDecisionAddSplit = function() {
    const container = document.getElementById('disaggSplitsContainer');
    if (!container) return;
    const currentCount = container.querySelectorAll('.split-row').length;
    const newRow = document.createElement('div');
    newRow.innerHTML = renderSplitRow({ successorName: '', label: '' }, currentCount);
    container.appendChild(newRow.firstElementChild);
};

// ---------------------------------------------------------------------------
// Temporary window hook for Phase 3 wiring
// ---------------------------------------------------------------------------

/**
 * Temporary global hook so Phase 3 can wire Decision Panel to matrix cell clicks.
 * Usage: window._simOpenDecision(functionId, successorName)
 */
window._simOpenDecision = function(functionId, successorName) {
    openDecisionPanel(functionId, successorName);
};

// ---------------------------------------------------------------------------
// Unlink from shared service — window hook
// ---------------------------------------------------------------------------

/**
 * Removes this successor's propagated decision from the shared service arrangement.
 * Updates the primary decision's sharedWithSuccessors to exclude this successor.
 * The successor's cell reverts to undecided.
 *
 * @param {string} functionId
 * @param {string} successorName  The propagated successor to unlink
 */
window._simUnlinkSharedService = function(functionId, successorName) {
    if (!state.simulationState) return;
    const decisions = state.simulationState.decisions;
    const propKey = getDecisionKey(functionId, successorName);
    const propDecision = decisions.get(propKey);
    if (!propDecision || !propDecision.sharedServiceOrigin) return;

    const primaryKey = propDecision.sharedServiceOrigin;
    const primaryDecision = decisions.get(primaryKey);

    // Remove this propagated decision
    decisions.delete(propKey);

    // Update the primary decision's sharedWithSuccessors
    if (primaryDecision && Array.isArray(primaryDecision.sharedWithSuccessors)) {
        const updated = {
            ...primaryDecision,
            sharedWithSuccessors: primaryDecision.sharedWithSuccessors.filter(s => s !== successorName)
        };
        decisions.set(primaryKey, updated);
    }

    // Recompute and close panel
    recomputeSimulation();
    closeDecisionPanel();
};

// ---------------------------------------------------------------------------
// ERP Bulk Apply — window hook
// ---------------------------------------------------------------------------

/**
 * Applies the current panel's decision to all undecided functions the given ERP covers
 * in the given successor. Creates individual FunctionDecision entries for each.
 *
 * Called from the "Apply to all undecided" button in the ERP Impact section.
 *
 * @param {string} erpSystemId   The ERP system's ID
 * @param {string} successorName  The successor authority name
 */
window._simBulkApplyErp = function(erpSystemId, successorName) {
    if (!state.simulationState) return;

    // Read the current axis-1 choice from the open panel
    const content = document.getElementById('decisionPanelContent');
    if (!content) return;

    const axis1Radio = content.querySelector('input[name="axis1Choice"]:checked');
    if (!axis1Radio) {
        const errorEl = document.getElementById('decisionPanelError');
        if (errorEl) {
            errorEl.textContent = 'Please make a system choice above before applying to all functions.';
            errorEl.classList.remove('hidden');
        }
        return;
    }

    const systemChoice = axis1Radio.value;
    let retainedSystemIds = [];
    let procuredSystem = null;

    if (systemChoice === 'choose') {
        const chosenRadio = content.querySelector('input[name="chooseSystem"]:checked');
        if (!chosenRadio) {
            const errorEl = document.getElementById('decisionPanelError');
            if (errorEl) {
                errorEl.textContent = 'Please select which system to retain before applying to all functions.';
                errorEl.classList.remove('hidden');
            }
            return;
        }
        retainedSystemIds = [chosenRadio.value];
    } else if (systemChoice === 'procure') {
        const labelEl = content.querySelector('#procureLabel');
        const label = labelEl ? labelEl.value.trim() : '';
        if (!label) {
            const errorEl = document.getElementById('decisionPanelError');
            if (errorEl) {
                errorEl.textContent = 'Please enter a system name before applying to all functions.';
                errorEl.classList.remove('hidden');
            }
            return;
        }
        const vendorEl = content.querySelector('#procureVendor');
        const costEl = content.querySelector('#procureCost');
        const cloudEl = content.querySelector('#procureCloud');
        procuredSystem = {
            label,
            vendor: vendorEl ? vendorEl.value.trim() : '',
            annualCost: costEl && costEl.value ? Number(costEl.value) : 0,
            isCloud: cloudEl ? cloudEl.checked : true
        };
    }

    // Find all undecided functions this ERP covers in this successor
    const allocMap = state.simulationState.baselineAllocation || state.successorAllocationMap;
    const decisions = state.simulationState.decisions;
    const successorFuncMap = allocMap ? allocMap.get(successorName) : null;
    if (!successorFuncMap) return;

    let appliedCount = 0;
    successorFuncMap.forEach((allocations, funcId) => {
        // Skip the current function (already being decided in the panel)
        if (funcId === _currentFunctionId) return;

        // Check if this function is served by the ERP
        const hasErp = allocations.some(a => a.system && a.system.id === erpSystemId);
        if (!hasErp) return;

        // Skip already-decided functions
        const existingKey = getDecisionKey(funcId, successorName);
        if (decisions.has(existingKey)) return;

        // Create a decision for this function with the same choice
        const decision = createDecision({
            functionId: funcId,
            successorName,
            systemChoice,
            retainedSystemIds: [...retainedSystemIds],
            procuredSystem: procuredSystem ? { ...procuredSystem } : null,
            boundaryChoice: 'none',
            disaggregationSplits: []
        });

        decisions.set(existingKey, decision);
        appliedCount++;
    });

    if (appliedCount === 0) return;

    // Recompute simulation with new decisions
    recomputeSimulation();

    // Re-render the panel content to show updated ERP status
    if (_currentFunctionId && _currentSuccessorName) {
        renderDecisionPanelContent(_currentFunctionId, _currentSuccessorName);
    }
};
