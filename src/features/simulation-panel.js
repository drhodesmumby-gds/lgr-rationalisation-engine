import { state } from '../state.js';
import { escHtml } from '../ui-helpers.js';
import { applyAllActions } from '../simulation/actions.js';
import { computeSimulationImpact } from '../simulation/impact.js';
import { computeObligationSeverity, generateMigrationScopeBullets } from '../simulation/obligations.js';
import { renderDashboard } from '../main.js';
import { buildSuccessorAllocation } from '../analysis/allocation.js';
import { buildEstateSankeyData, buildFunctionSankeyData } from './sankey-data.js';
import { renderSankeyDiagram, destroySankeyDiagram, PREDECESSOR_COLOURS } from './sankey-diagram.js';

// ===================================================================
// SIMULATION ENTRY / EXIT
// ===================================================================

export function enterSimulation() {
    const baselineAllocation = state.transitionStructure
        ? buildSuccessorAllocation(state.mergedArchitecture.nodes, state.mergedArchitecture.edges, state.transitionStructure).allocation
        : null;
    state.simulationState = {
        baselineNodes: JSON.parse(JSON.stringify(state.mergedArchitecture.nodes)),
        baselineEdges: JSON.parse(JSON.stringify(state.mergedArchitecture.edges)),
        baselineAllocation,
        actions: [],
        lastImpact: null
    };
    renderDashboard();
}

export function exitSimulation() {
    state.simulationState = null;
    renderDashboard();
}

// ===================================================================
// RECOMPUTE
// ===================================================================

export function recomputeSimulation() {
    if (!state.simulationState) return;
    const ss = state.simulationState;
    if (ss.actions.length === 0) {
        ss.lastImpact = null;
    } else {
        ss.lastImpact = computeSimulationImpact({
            baselineNodes: ss.baselineNodes,
            baselineEdges: ss.baselineEdges,
            actions: ss.actions,
            transitionStructure: state.transitionStructure,
            lgaFunctionMap: state.lgaFunctionMap,
            perspective: state.activePerspective
        });
    }
    renderDashboard();
}

// ===================================================================
// SIMULATION WORKSPACE RENDERING
// ===================================================================

// Module-level UI state for workspace
let _actionPanelCollapsed = false;
let _sankeyDrillDown = null; // successor name for function-level, or null for estate
let _sankeySizeMode = 'count'; // 'count' | 'cost'
let _sankeyCouncilFilter = null; // council name to filter by, or null for all
let _sankeyFunctionFilter = null; // lgaFunctionId to filter by, or null for all
let _sankeyOverlay = 'default'; // 'default' | 'migration' | 'cross-successor' | 'contract'

/**
 * Main workspace render function. Replaces the old toolbar.
 * Renders a side-by-side layout: action panel (left) + Sankey (right).
 */
export function renderSimulationWorkspace() {
    const toolbar = document.getElementById('simulationToolbar');
    if (!toolbar) return;

    if (!state.simulationState) {
        toolbar.classList.add('hidden');
        toolbar.innerHTML = '';
        return;
    }

    const actions = state.simulationState.actions;
    const impact = state.simulationState.lastImpact;

    // Build the workspace shell
    toolbar.innerHTML = `
        <div class="sim-workspace">
            <span class="sim-mode-banner">SIMULATION MODE</span>
            <div class="sim-workspace-layout">
                <div id="simActionPanel" class="sim-action-panel${_actionPanelCollapsed ? ' sim-panel-collapsed' : ''}"></div>
                <div id="simSankeyPanel" class="sim-sankey-panel"></div>
            </div>
        </div>
    `;
    toolbar.classList.remove('hidden');

    // Render action panel content
    const actionPanel = toolbar.querySelector('#simActionPanel');
    renderActionPanel(actionPanel, actions, impact);

    // Render Sankey panel content
    const sankeyPanel = toolbar.querySelector('#simSankeyPanel');
    renderSankeyPanel(sankeyPanel);
}

// Keep backward-compatible alias
export const renderSimulationToolbar = renderSimulationWorkspace;

/**
 * Renders the action panel content into the given element.
 */
function renderActionPanel(el, actions, impact) {
    if (_actionPanelCollapsed) {
        el.innerHTML = `
            <div class="sim-panel-collapsed-content">
                <button onclick="window._simToggleActionPanel()" class="sim-panel-collapse-btn" title="Expand action panel" aria-label="Expand action panel">&#x276F;</button>
                <span class="sim-panel-collapsed-badge">${actions.length}</span>
            </div>
        `;
        return;
    }

    let warningHtml = '';
    if (impact && impact.warnings && impact.warnings.length > 0) {
        const humanized = [...new Set(impact.warnings)].map(w => w.replace(/\s*\(\d+\)\s*/g, ' ').replace(/\s{2,}/g, ' ').trim());
        warningHtml = `<div class="mt-2 p-2 bg-yellow-50 border-l-4 border-l-[#f47738] text-xs text-gray-800">
            <span class="font-bold">Warnings:</span> ${humanized.map(escHtml).join(' &bull; ')}
        </div>`;
    }

    let actionsHtml = '';
    if (actions.length === 0) {
        actionsHtml = '<span class="text-sm text-gray-600 italic">No actions added. Click "Add Action" to simulate a change.</span>';
    } else {
        actionsHtml = actions.map((action, idx) => {
            const label = getActionLabel(action);
            return `<span class="sim-action-chip">
                ${escHtml(label)}
                <button class="sim-chip-edit" onclick="window._simEditAction(${idx})" title="Edit" aria-label="Edit action">&#9998;</button>
                <button class="sim-chip-delete" onclick="window._simRemoveAction(${idx})" title="Remove this action" aria-label="Remove action">&times;</button>
            </span>`;
        }).join(' ');
    }

    const metricsHtml = impact ? renderBeforeAfterMetrics(impact, true) : '';
    const obligationsHtml = impact ? renderObligationsPanel(impact.obligations) : '';

    el.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-bold text-[#0b0c0c]">${actions.length} action${actions.length !== 1 ? 's' : ''}</span>
            <button onclick="window._simToggleActionPanel()" class="sim-panel-collapse-btn" title="Collapse action panel" aria-label="Collapse action panel">&#x276E;</button>
        </div>
        <div class="flex flex-col gap-2 mb-3">
            <button onclick="window._simOpenActionBuilder()" class="gds-btn text-sm px-3 py-1.5 font-bold w-full text-left">+ Add Action</button>
            ${actions.length > 0 ? `<button onclick="window._simClearAll()" class="gds-btn-secondary px-3 py-1.5 text-sm font-bold w-full text-left">Clear All</button>` : ''}
        </div>
        <div class="flex flex-col gap-1 mb-2">${actionsHtml}</div>
        ${warningHtml}
        ${metricsHtml ? `<div class="mt-3">${metricsHtml}</div>` : ''}
        ${obligationsHtml}
        <div class="mt-4 pt-3 border-t border-[#f47738]">
            <button onclick="window._simExit()" class="gds-btn-secondary px-3 py-1.5 text-sm font-bold border-[#d4351c] text-[#d4351c] w-full text-left">Exit Simulation</button>
        </div>
    `;
}

/**
 * Renders the Sankey panel: breadcrumb + size toggle + diagram + legend.
 */
function renderSankeyPanel(el) {
    // Build Sankey data
    const allocMap = (state.simulationState?.lastImpact?.afterAllocation)
        || state.simulationState?.baselineAllocation
        || state.successorAllocationMap;

    const actions = state.simulationState ? state.simulationState.actions : [];

    // Breadcrumb
    let breadcrumbHtml = '';
    if (_sankeyDrillDown) {
        breadcrumbHtml = `<div class="sankey-breadcrumb">
            <a onclick="window._simSankeyBack()" href="#">&larr; Estate view</a>
            &rsaquo; ${escHtml(_sankeyDrillDown)}
        </div>`;
    } else {
        breadcrumbHtml = `<div class="sankey-breadcrumb">Estate overview &mdash; click a successor to drill down</div>`;
    }

    // Build data first so we can extract council list for filter dropdown
    let sankeyData;
    let viewMode;

    if (_sankeyDrillDown) {
        sankeyData = buildFunctionSankeyData(allocMap, _sankeyDrillDown, state.lgaFunctionMap, actions, _sankeySizeMode, _sankeyCouncilFilter, _sankeyFunctionFilter);
        viewMode = 'function';
    } else {
        sankeyData = buildEstateSankeyData(allocMap, state.transitionStructure, actions, _sankeySizeMode);
        viewMode = 'estate';
    }

    // Filter dropdowns (function drill-down only)
    let filterHtml = '';
    if (_sankeyDrillDown) {
        // Get councils and functions from unfiltered data to always show all options
        const unfilteredData = buildFunctionSankeyData(allocMap, _sankeyDrillDown, state.lgaFunctionMap, actions, _sankeySizeMode, null, null);
        const councils = [...new Set(unfilteredData.nodes.filter(n => n.nodeType === 'system').map(n => n.council))].sort();
        const functions = unfilteredData.nodes.filter(n => n.nodeType === 'function').sort((a, b) => a.label.localeCompare(b.label));

        if (councils.length > 1) {
            filterHtml += `<select class="sim-sankey-filter" onchange="window._simSankeyFilterCouncil(this.value)">
                <option value="">All councils</option>
                ${councils.map(c => `<option value="${escHtml(c)}"${_sankeyCouncilFilter === c ? ' selected' : ''}>${escHtml(c)}</option>`).join('')}
            </select>`;
        }
        if (functions.length > 1) {
            filterHtml += `<select class="sim-sankey-filter" onchange="window._simSankeyFilterFunction(this.value)">
                <option value="">All functions</option>
                ${functions.map(f => `<option value="${escHtml(f.lgaFunctionId)}"${_sankeyFunctionFilter === f.lgaFunctionId ? ' selected' : ''}>${escHtml(f.label)}</option>`).join('')}
            </select>`;
        }
    }

    // Size toggle + overlay toggle
    const countActive = _sankeySizeMode === 'count' ? ' active' : '';
    const costActive = _sankeySizeMode === 'cost' ? ' active' : '';

    const hasObligations = state.simulationState?.lastImpact?.obligations?.length > 0;
    const overlayBtns = hasObligations ? `
        <div class="flex gap-1 flex-wrap mt-1">
            <button class="sim-sankey-overlay-toggle${_sankeyOverlay === 'default' ? ' active' : ''}" onclick="window._simSankeySetOverlay('default')">Systems</button>
            <button class="sim-sankey-overlay-toggle${_sankeyOverlay === 'migration' ? ' active' : ''}" onclick="window._simSankeySetOverlay('migration')">Data migration</button>
            <button class="sim-sankey-overlay-toggle${_sankeyOverlay === 'cross-successor' ? ' active' : ''}" onclick="window._simSankeySetOverlay('cross-successor')">Cross-successor</button>
            <button class="sim-sankey-overlay-toggle${_sankeyOverlay === 'contract' ? ' active' : ''}" onclick="window._simSankeySetOverlay('contract')">Contract risk</button>
        </div>` : '';

    const sizeToggleHtml = `
        <div class="sim-sankey-controls">
            ${breadcrumbHtml}
            ${filterHtml}
            <div class="flex gap-1 ml-auto">
                <button class="sim-sankey-size-toggle${countActive}" onclick="window._simSankeySetSize('count')">System count</button>
                <button class="sim-sankey-size-toggle${costActive}" onclick="window._simSankeySetSize('cost')">Annual cost</button>
            </div>
            ${overlayBtns}
        </div>
    `;

    el.innerHTML = sizeToggleHtml + '<div id="sankeyDiagramContainer" style="width:100%;"></div>';

    const container = el.querySelector('#sankeyDiagramContainer');
    if (!container) return;

    if (!allocMap || allocMap.size === 0) {
        container.innerHTML = '<div style="padding:24px;color:#505a5f;font-size:13px;">No allocation data available. Transition mode required for Sankey diagram.</div>';
        return;
    }

    const obligations = state.simulationState?.lastImpact?.obligations || [];

    renderSankeyDiagram(container, sankeyData, {
        viewMode,
        sizeMode: _sankeySizeMode,
        overlay: _sankeyOverlay,
        obligations,
        vestingDate: state.transitionStructure?.vestingDate || null,
        onAction: (action) => {
            if (!state.simulationState) return;
            state.simulationState.actions.push(action);
            recomputeSimulation();
        },
        onDrillDown: (successorName) => {
            _sankeyDrillDown = successorName;
            renderSimulationWorkspace();
        },
        onBack: () => {
            _sankeyDrillDown = null;
            _sankeyCouncilFilter = null;
            _sankeyFunctionFilter = null;
            renderSimulationWorkspace();
        }
    });

    // Council colour legend for function view
    if (viewMode === 'function') {
        const councils = [...new Set(sankeyData.nodes.filter(n => n.nodeType === 'system').map(n => n.council))].sort();
        if (councils.length > 0) {
            const legendHtml = councils.map((c, i) => {
                const colour = PREDECESSOR_COLOURS[i % PREDECESSOR_COLOURS.length];
                return `<span class="sankey-legend-item"><span class="sankey-legend-swatch" style="background:${colour}"></span>${escHtml(c)}</span>`;
            }).join('');
            container.insertAdjacentHTML('afterend', `<div class="sankey-legend">${legendHtml}</div>`);
        }
    }
}

// ===================================================================
// OBLIGATIONS PANEL
// ===================================================================

function renderObligationsPanel(obligations) {
    if (!obligations || obligations.length === 0) return '';

    const weights = state.signalWeights || {};
    const scored = obligations.map(obl => ({
        ...obl,
        severity: computeObligationSeverity(obl, weights)
    }));

    // Sort: high first, then unresolved, then by function
    scored.sort((a, b) => {
        const sevOrder = { high: 0, medium: 1, low: 2 };
        if (sevOrder[a.severity] !== sevOrder[b.severity]) return sevOrder[a.severity] - sevOrder[b.severity];
        if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
        return 0;
    });

    const crossSuccessor = scored.filter(o => o.type === 'cross-successor-impact');
    const unresolved = scored.filter(o => !o.resolved && o.type !== 'cross-successor-impact');
    const resolved = scored.filter(o => o.resolved && o.type !== 'cross-successor-impact');

    let html = '<div class="mt-3 pt-3 border-t border-[#f47738]">';
    html += '<span class="text-xs font-bold text-[#0b0c0c]">Data obligations</span>';

    if (crossSuccessor.length > 0) {
        // Deduplicate by fromSystem.id + affected successor
        const seen = new Set();
        const unique = crossSuccessor.filter(o => {
            const key = `${o.fromSystem.id}-${o.affectedSuccessors.join(',')}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        html += `<div class="mt-2 p-2 bg-red-50 border-l-4 border-l-[#d4351c] text-xs">
            <span class="font-bold text-[#d4351c]">Cross-successor impact:</span>
            ${unique.map(o =>
                `<div class="mt-1">${escHtml(o.fromSystem.label)} also serves <strong>${o.affectedSuccessors.map(escHtml).join(', ')}</strong></div>`
            ).join('')}
        </div>`;
    }

    if (unresolved.length > 0) {
        html += `<div class="mt-2 text-xs">
            <span class="font-bold text-[#d4351c]">${unresolved.length} unresolved:</span>
            ${unresolved.slice(0, 5).map(o => renderObligationChip(o)).join('')}
            ${unresolved.length > 5 ? `<div class="mt-1 text-gray-500">+${unresolved.length - 5} more</div>` : ''}
        </div>`;
    }

    if (resolved.length > 0) {
        html += `<div class="mt-2 text-xs text-gray-600">${resolved.length} resolved (data migrating to target systems)</div>`;
    }

    html += `<button class="text-xs text-[#1d70b8] underline font-bold mt-2 block text-left" onclick="window._simOpenObligationDetail()">View migration plan &rarr;</button>`;

    html += '</div>';
    return html;
}

function renderObligationChip(obl) {
    const sevBg = { high: '#d4351c', medium: '#f47738', low: '#b1b4b6' };
    const sevText = { high: '#fff', medium: '#0b0c0c', low: '#0b0c0c' };
    const sevLabel = obl.severity.toUpperCase();
    const bg = sevBg[obl.severity] || '#b1b4b6';
    const fg = sevText[obl.severity] || '#0b0c0c';
    const dest = obl.toSystem ? escHtml(obl.toSystem.label) : '<span class="text-[#d4351c]">???</span>';
    const funcLabel = obl.functionLabel ? ` (${escHtml(obl.functionLabel)})` : '';
    const crossTag = obl.type === 'cross-successor-impact' ? ' <span class="text-[#d4351c] font-bold">CROSS</span>' : '';
    return `<div class="mt-1 flex items-start gap-1">
        <span style="background:${bg};color:${fg};font-size:9px;padding:1px 4px;font-weight:bold;flex-shrink:0;">${sevLabel}</span>
        <span>${escHtml(obl.fromSystem.label)} &rarr; ${dest}${funcLabel}${crossTag}</span>
    </div>`;
}

// ===================================================================
// OBLIGATION DETAIL MODAL
// ===================================================================

let _expandedObligationGroups = new Set();

function openObligationDetail() {
    const obligations = state.simulationState?.lastImpact?.obligations;
    if (!obligations || obligations.length === 0) return;

    // Expand all groups on first open — now keyed by source system ID
    const systemIds = [...new Set(obligations.map(o => o.fromSystem.id))];
    _expandedObligationGroups = new Set(systemIds);

    renderObligationDetailContent(obligations);

    const modal = document.getElementById('obligationDetailModal');
    if (modal) {
        // Store current focus for return on close
        _obligationDetailOpener = document.activeElement;
        modal.classList.remove('hidden');
        // Set up focus trap and move focus into modal
        _obligationDetailTrapCleanup = createFocusTrap(modal);
        const closeBtn = document.getElementById('btnCloseObligationDetail');
        if (closeBtn) closeBtn.focus();
    }
}

function renderObligationDetailContent(obligations) {
    const content = document.getElementById('obligationDetailContent');
    if (!content) return;

    const weights = state.signalWeights || {};
    const persona = state.activePersona || 'executive';
    const personaLabels = { executive: 'Executive / Transition Board', commercial: 'Commercial / Transition Director', architect: 'Enterprise Architect (CTO)' };

    const scored = obligations.map(obl => ({
        ...obl,
        severity: computeObligationSeverity(obl, weights)
    }));

    // Summary counts
    const highCount = scored.filter(o => o.severity === 'high').length;
    const unresolvedCount = scored.filter(o => !o.resolved).length;
    const crossCount = scored.filter(o => o.type === 'cross-successor-impact').length;

    // Data complexity flags (deduplicate by system id)
    const seenSystems = new Set();
    let monolithicCount = 0, lowPortCount = 0, erpCount = 0;
    scored.forEach(o => {
        if (seenSystems.has(o.fromSystem.id)) return;
        seenSystems.add(o.fromSystem.id);
        if (o.isMonolithic) monolithicCount++;
        if (o.isLowPortability) lowPortCount++;
        if (o.isERP) erpCount++;
    });

    // Group by source system ID
    const groups = new Map();
    scored.forEach(obl => {
        const sysId = obl.fromSystem.id;
        if (!groups.has(sysId)) groups.set(sysId, []);
        groups.get(sysId).push(obl);
    });

    // Sort groups: cross-successor first, then highest severity, then alphabetical by system label
    const sevOrder = { high: 0, medium: 1, low: 2 };
    const sortedGroups = [...groups.entries()].sort((a, b) => {
        const aCross = a[1].some(o => o.type === 'cross-successor-impact');
        const bCross = b[1].some(o => o.type === 'cross-successor-impact');
        if (aCross !== bCross) return aCross ? -1 : 1;
        const aMaxSev = Math.min(...a[1].map(o => sevOrder[o.severity] ?? 2));
        const bMaxSev = Math.min(...b[1].map(o => sevOrder[o.severity] ?? 2));
        if (aMaxSev !== bMaxSev) return aMaxSev - bMaxSev;
        const aLabel = a[1][0]?.fromSystem.label || '';
        const bLabel = b[1][0]?.fromSystem.label || '';
        return aLabel.localeCompare(bLabel);
    });

    let html = `
        <div class="mb-6">
            <p class="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Simulation</p>
            <h2 id="obligationDetailTitle" class="text-2xl font-bold mb-1">Data Migration Plan</h2>
            <div class="flex items-center gap-3 flex-wrap text-sm text-gray-600">
                <span>Persona: <strong>${personaLabels[persona] || persona}</strong></span>
                <span>${scored.length} obligation${scored.length !== 1 ? 's' : ''}</span>
            </div>
        </div>

        <div class="mb-6">
            <h3 class="font-bold text-base mb-3 border-b pb-1">Summary</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <div class="border border-gray-300 p-3 text-center">
                    <div class="text-2xl font-bold">${scored.length}</div>
                    <div class="text-xs text-gray-600">Total</div>
                </div>
                <div class="border border-gray-300 p-3 text-center ${highCount > 0 ? 'border-l-4 border-l-[#d4351c]' : ''}">
                    <div class="text-2xl font-bold ${highCount > 0 ? 'text-[#d4351c]' : ''}">${highCount}</div>
                    <div class="text-xs text-gray-600">High severity</div>
                </div>
                <div class="border border-gray-300 p-3 text-center ${unresolvedCount > 0 ? 'border-l-4 border-l-[#f47738]' : ''}">
                    <div class="text-2xl font-bold ${unresolvedCount > 0 ? 'text-[#f47738]' : ''}">${unresolvedCount}</div>
                    <div class="text-xs text-gray-600">Unresolved</div>
                </div>
                <div class="border border-gray-300 p-3 text-center ${crossCount > 0 ? 'border-l-4 border-l-[#d4351c]' : ''}">
                    <div class="text-2xl font-bold ${crossCount > 0 ? 'text-[#d4351c]' : ''}">${crossCount}</div>
                    <div class="text-xs text-gray-600">Cross-successor</div>
                </div>
            </div>`;

    // Data complexity flags
    const flags = [];
    if (monolithicCount > 0) flags.push(`${monolithicCount} monolithic system${monolithicCount !== 1 ? 's' : ''}`);
    if (lowPortCount > 0) flags.push(`${lowPortCount} low-portability`);
    if (erpCount > 0) flags.push(`${erpCount} ERP`);
    if (flags.length > 0) {
        html += `<div class="text-xs text-gray-600 mt-1"><strong>Data complexity flags:</strong> ${flags.join(' &middot; ')}</div>`;
    }

    html += `</div>`;

    // Per-source-system groups
    sortedGroups.forEach(([sysId, obls]) => {
        const hasCross = obls.some(o => o.type === 'cross-successor-impact');
        const isExpanded = _expandedObligationGroups.has(sysId);
        const chevron = isExpanded ? '&#x25BE;' : '&#x25B8;';
        const sysLabel = obls[0].fromSystem.label;
        const maxSev = obls.reduce((best, o) => sevOrder[o.severity] < sevOrder[best] ? o.severity : best, 'low');
        const sevBg = { high: '#d4351c', medium: '#f47738', low: '#b1b4b6' };
        const sevText = { high: '#fff', medium: '#0b0c0c', low: '#0b0c0c' };
        const groupColour = sevBg[maxSev] || '#b1b4b6';
        const groupTextColour = sevText[maxSev] || '#0b0c0c';

        html += `<div class="mb-4 obl-detail-card border border-gray-300 bg-white" style="border-left: 4px solid ${groupColour};">
            <button class="flex items-center gap-2 w-full p-3 text-left" aria-expanded="${isExpanded}" onclick="window._simToggleObligationGroup('${escHtml(sysId)}')">
                <span class="text-sm">${chevron}</span>
                <span style="background:${groupColour};color:${groupTextColour};font-size:10px;padding:2px 6px;font-weight:bold;flex-shrink:0;">${maxSev.toUpperCase()}</span>
                <h4 class="font-bold text-sm flex-1">${escHtml(sysLabel)} <span class="text-gray-500 font-normal">(${obls.length} obligation${obls.length !== 1 ? 's' : ''})</span></h4>
                ${hasCross ? '<span style="background:#d4351c;color:#fff;font-size:10px;padding:2px 6px;font-weight:bold;text-transform:uppercase;flex-shrink:0;">Cross-successor</span>' : ''}
            </button>`;

        if (isExpanded) {
            const sys = obls[0].fromSystem;

            // 1. Source system card (once)
            html += `<div class="border-t border-gray-200 p-3 bg-gray-50">
                <div class="text-[12px] font-bold uppercase text-gray-500 mb-1">Source system</div>
                <div class="font-bold text-sm mb-1">${escHtml(sys.label)}</div>
                <div class="text-xs text-gray-600 mb-2">${escHtml(sys.council)}${sys.vendor ? ' &middot; ' + escHtml(sys.vendor) : ''}</div>`;

            if (persona === 'commercial' || persona === 'executive') {
                html += `<div class="text-xs space-y-1 border-t pt-2 mt-1">`;
                if (sys.users > 0) html += `<div class="flex justify-between"><span class="text-gray-500">Users</span><strong>${sys.users.toLocaleString()}</strong></div>`;
                if (sys.annualCost > 0) html += `<div class="flex justify-between"><span class="text-gray-500">Cost</span><strong>&pound;${sys.annualCost.toLocaleString()}/yr</strong></div>`;
                const firstWithContract = obls.find(o => o.contractEndDate);
                if (firstWithContract) {
                    const notice = firstWithContract.noticePeriod ? ` (${firstWithContract.noticePeriod}mo notice)` : '';
                    html += `<div class="flex justify-between"><span class="text-gray-500">Contract</span><span>${firstWithContract.contractEndDate}${notice}</span></div>`;
                }
                html += `</div>`;
            }
            if (persona === 'architect' || persona === 'executive') {
                const rep = obls[0];
                html += `<div class="text-xs space-y-1 border-t pt-2 mt-1">`;
                html += `<div class="flex justify-between"><span class="text-gray-500">Hosting</span><span class="${rep.isOnPrem ? 'text-[#d4351c] font-bold' : 'text-[#00703c]'}">${rep.isOnPrem ? 'On-premise' : 'Cloud'}</span></div>`;
                if (sys.dataPartitioning) {
                    const isMonoClass = rep.isMonolithic ? 'text-[#d4351c] font-bold' : '';
                    html += `<div class="flex justify-between"><span class="text-gray-500">Data</span><span class="${isMonoClass}">${escHtml(sys.dataPartitioning)}</span></div>`;
                }
                if (sys.portability) {
                    const portClass = rep.isLowPortability ? 'text-[#d4351c] font-bold' : 'text-[#00703c]';
                    html += `<div class="flex justify-between"><span class="text-gray-500">Portability</span><span class="${portClass}">${escHtml(sys.portability)}</span></div>`;
                }
                if (rep.isERP) html += `<div class="flex justify-between"><span class="text-gray-500">Type</span><span class="text-[#d4351c] font-bold">ERP</span></div>`;
                html += `</div>`;
            }

            html += `</div>`;

            // 2. Migration scope bullets (once, from first obligation)
            const bullets = generateMigrationScopeBullets(obls[0]);
            if (bullets.length > 0) {
                html += `<div class="border-t border-gray-200 p-3">
                    <div class="text-[12px] font-bold uppercase text-gray-500 mb-1">Migration scope</div>
                    <ul class="obl-scope-list text-xs text-gray-700 space-y-1">
                        ${bullets.map(b => `<li>${escHtml(b)}</li>`).join('')}
                    </ul>
                </div>`;
            }

            // 3. Compact obligations table
            html += `<div class="border-t border-gray-200 p-3">
                <div class="text-[12px] font-bold uppercase text-gray-500 mb-1">Obligations</div>
                <div class="overflow-x-auto">
                <table class="w-full text-xs border-collapse">
                    <thead>
                        <tr class="text-left text-gray-500 border-b border-gray-200">
                            <th scope="col" class="pb-1 pr-2 font-semibold">Severity</th>
                            <th scope="col" class="pb-1 pr-2 font-semibold">Function</th>
                            <th scope="col" class="pb-1 pr-2 font-semibold">Target</th>
                            <th scope="col" class="pb-1 pr-2 font-semibold">Successor</th>
                            <th scope="col" class="pb-1 font-semibold">Type</th>
                        </tr>
                    </thead>
                    <tbody>`;

            obls.forEach(obl => {
                const rowBadgeBg = sevBg[obl.severity] || '#b1b4b6';
                const rowBadgeFg = sevText[obl.severity] || '#0b0c0c';
                const targetCell = obl.toSystem
                    ? escHtml(obl.toSystem.label)
                    : '<span class="text-[#d4351c] font-bold">Unresolved</span>';
                const crossCell = obl.type === 'cross-successor-impact'
                    ? '<span style="background:#d4351c;color:#fff;font-size:9px;padding:1px 4px;font-weight:bold;">CROSS</span>'
                    : '';
                const rowBg = !obl.resolved ? ' class="bg-white"' : '';
                html += `<tr${rowBg}>
                    <td class="py-1 pr-2"><span style="background:${rowBadgeBg};color:${rowBadgeFg};font-size:9px;padding:1px 4px;font-weight:bold;">${obl.severity.toUpperCase()}</span></td>
                    <td class="py-1 pr-2">${escHtml(obl.functionLabel || obl.functionId)}</td>
                    <td class="py-1 pr-2">${targetCell}</td>
                    <td class="py-1 pr-2">${escHtml(obl.affectedSuccessors[0] || '')}</td>
                    <td class="py-1">${crossCell}</td>
                </tr>`;
            });

            html += `</tbody></table></div></div>`;
        }

        html += `</div>`;
    });

    content.innerHTML = html;
}

// ===================================================================
// BEFORE/AFTER ESTATE SUMMARY METRICS
// ===================================================================

function compactSpend(val) {
    if (val === null || val === undefined) return '—';
    if (val >= 1000000) return '£' + (val / 1000000).toFixed(1) + 'M';
    if (val >= 1000) return '£' + Math.round(val / 1000) + 'k';
    return '£' + val.toLocaleString();
}

export function renderBeforeAfterMetrics(impact, compact = false) {
    if (!impact) return '';

    const before = impact.before;
    const after = impact.after;
    const delta = impact.delta;

    function deltaHtml(value, lowerIsBetter) {
        if (value === null || value === 0) return `<span class="sim-delta-neutral">—</span>`;
        const sign = value > 0 ? '+' : '';
        const isGood = lowerIsBetter ? value < 0 : value > 0;
        const cls = isGood ? 'sim-delta-positive' : 'sim-delta-negative';
        const arrow = isGood ? '\u25BC' : '\u25B2';
        return `<span class="${cls}">${arrow} ${sign}${value}</span>`;
    }

    function spendDeltaHtml(value) {
        if (value === null || value === 0) return `<span class="sim-delta-neutral">—</span>`;
        const isSaving = value < 0;
        const cls = isSaving ? 'sim-delta-positive' : 'sim-delta-negative';
        const abs = Math.abs(value);
        const arrow = isSaving ? '\u25BC' : '\u25B2';
        const prefix = value > 0 ? '+£' : '-£';
        return `<span class="${cls}">${arrow} ${prefix}${abs.toLocaleString()}</span>`;
    }

    // Compact mode: used inside the 360px action panel
    if (compact) {
        function compactDelta(value, lowerIsBetter) {
            if (value === null || value === 0) return '';
            const isGood = lowerIsBetter ? value < 0 : value > 0;
            const cls = isGood ? 'sim-delta-positive' : 'sim-delta-negative';
            const sign = value > 0 ? '+' : '';
            return `<span class="${cls}">${sign}${value}</span>`;
        }
        function compactSpendDelta(value) {
            if (value === null || value === 0) return '';
            const isSaving = value < 0;
            const cls = isSaving ? 'sim-delta-positive' : 'sim-delta-negative';
            return `<span class="${cls}">${compactSpend(value)}</span>`;
        }

        let html = '<div class="grid grid-cols-2 gap-2">';

        html += `<div class="border border-gray-300 p-2 bg-[#fff3cd] border-l-4 border-l-[#f47738] text-xs">
            <div class="font-bold">${before.systemCount} → ${after.systemCount} ${compactDelta(delta.systemCount, true)}</div>
            <div class="text-gray-700">Systems</div>
        </div>`;

        if (before.totalAnnualSpend !== null || after.totalAnnualSpend !== null) {
            html += `<div class="border border-gray-300 p-2 bg-[#fff3cd] border-l-4 border-l-[#f47738] text-xs">
                <div class="font-bold">${compactSpend(before.totalAnnualSpend)} → ${compactSpend(after.totalAnnualSpend)} ${compactSpendDelta(delta.totalAnnualSpend)}</div>
                <div class="text-gray-700">IT spend</div>
            </div>`;
        }

        if (before.preVestingNoticeCount !== null || after.preVestingNoticeCount !== null) {
            const bv = before.preVestingNoticeCount ?? '—';
            const av = after.preVestingNoticeCount ?? '—';
            html += `<div class="border border-gray-300 p-2 bg-[#fff3cd] border-l-4 border-l-[#f47738] text-xs">
                <div class="font-bold">${bv} → ${av} ${compactDelta(delta.preVestingNoticeCount, true)}</div>
                <div class="text-gray-700">Pre-vesting</div>
            </div>`;
        }

        if (before.disaggregationCount !== null || after.disaggregationCount !== null) {
            const bd = before.disaggregationCount ?? '—';
            const ad = after.disaggregationCount ?? '—';
            html += `<div class="border border-gray-300 p-2 bg-[#fff3cd] border-l-4 border-l-[#f47738] text-xs">
                <div class="font-bold">${bd} → ${ad} ${compactDelta(delta.disaggregationCount, true)}</div>
                <div class="text-gray-700">Disaggregations</div>
            </div>`;
        }

        html += '</div>';
        return html;
    }

    // Full mode: used in estate summary
    let html = '<div class="grid grid-cols-2 md:grid-cols-4 gap-4">';

    // System count
    html += `<div class="border border-gray-300 p-4 bg-[#fff3cd] border-l-4 border-l-[#f47738]">
        <div class="sim-before-after mb-1">
            <div class="sim-before">Before: <strong>${before.systemCount}</strong></div>
            <div class="sim-after">After: <strong>${after.systemCount}</strong></div>
        </div>
        <p class="text-xs font-bold text-gray-700">Total systems ${deltaHtml(delta.systemCount, true)}</p>
    </div>`;

    // Spend (if available)
    if (before.totalAnnualSpend !== null || after.totalAnnualSpend !== null) {
        const beforeSpend = before.totalAnnualSpend !== null ? '£' + before.totalAnnualSpend.toLocaleString() : '—';
        const afterSpend = after.totalAnnualSpend !== null ? '£' + after.totalAnnualSpend.toLocaleString() : '—';
        html += `<div class="border border-gray-300 p-4 bg-[#fff3cd] border-l-4 border-l-[#f47738]">
            <div class="sim-before-after mb-1">
                <div class="sim-before">Before: <strong>${beforeSpend}</strong></div>
                <div class="sim-after">After: <strong>${afterSpend}</strong></div>
            </div>
            <p class="text-xs font-bold text-gray-700">Annual IT spend ${spendDeltaHtml(delta.totalAnnualSpend)}</p>
        </div>`;
    }

    // Pre-vesting notice triggers (if available)
    if (before.preVestingNoticeCount !== null || after.preVestingNoticeCount !== null) {
        const bv = before.preVestingNoticeCount !== null ? before.preVestingNoticeCount : '—';
        const av = after.preVestingNoticeCount !== null ? after.preVestingNoticeCount : '—';
        html += `<div class="border border-gray-300 p-4 bg-[#fff3cd] border-l-4 border-l-[#f47738]">
            <div class="sim-before-after mb-1">
                <div class="sim-before">Before: <strong>${bv}</strong></div>
                <div class="sim-after">After: <strong>${av}</strong></div>
            </div>
            <p class="text-xs font-bold text-gray-700">Pre-vesting triggers ${deltaHtml(delta.preVestingNoticeCount, true)}</p>
        </div>`;
    }

    // Disaggregation count (if available)
    if (before.disaggregationCount !== null || after.disaggregationCount !== null) {
        const bd = before.disaggregationCount !== null ? before.disaggregationCount : '—';
        const ad = after.disaggregationCount !== null ? after.disaggregationCount : '—';
        html += `<div class="border border-gray-300 p-4 bg-[#fff3cd] border-l-4 border-l-[#f47738]">
            <div class="sim-before-after mb-1">
                <div class="sim-before">Before: <strong>${bd}</strong></div>
                <div class="sim-after">After: <strong>${ad}</strong></div>
            </div>
            <p class="text-xs font-bold text-gray-700">Disaggregations required ${deltaHtml(delta.disaggregationCount, true)}</p>
        </div>`;
    }

    html += '</div>';
    return html;
}

// ===================================================================
// ACTION BUILDER MODAL
// ===================================================================

let _actionBuilderStep = 1;
let _actionBuilderType = null;
let _editingActionIndex = null;

function editAction(idx) {
    if (!state.simulationState) return;
    const action = state.simulationState.actions[idx];
    if (!action) return;

    let prefill = {};
    switch (action.type) {
        case 'consolidate':
            prefill = { funcId: action.functionId, successorName: action.successorName, targetSystemId: action.targetSystemId };
            break;
        case 'decommission':
            prefill = { systemId: action.systemId };
            break;
        case 'extend-contract':
            prefill = { systemId: action.systemId, newEndYear: action.newEndYear, newEndMonth: action.newEndMonth };
            break;
        case 'migrate-users':
            prefill = { fromSystemId: action.fromSystemId, toSystemId: action.toSystemId, userCount: action.userCount };
            break;
        case 'split-shared-service':
            prefill = { systemId: action.systemId, splits: action.splits };
            break;
        case 'procure-replacement':
            prefill = {
                funcId: action.functionId,
                successorName: action.successorName,
                newSystemLabel: action.newSystem?.label,
                newSystemVendor: action.newSystem?.vendor,
                annualCost: action.newSystem?.annualCost,
                isCloud: action.newSystem?.isCloud,
                replacesSystemId: action.replacesSystemId
            };
            break;
    }

    _editingActionIndex = idx;
    openActionBuilderWithContext(action.type, prefill);
}

export function openActionBuilder() {
    _actionBuilderStep = 1;
    _actionBuilderType = null;
    _editingActionIndex = null;
    const modal = document.getElementById('actionBuilderModal');
    if (!modal) return;
    renderActionBuilderStep1();
    document.getElementById('actionBuilderError').classList.add('hidden');
    _actionBuilderOpener = document.activeElement;
    modal.classList.remove('hidden');
    _actionBuilderTrapCleanup = createFocusTrap(modal);
    const closeBtn = document.getElementById('btnCloseActionBuilder');
    if (closeBtn) closeBtn.focus();
}

/**
 * Opens the action builder modal pre-filled at step 2 for a given action type.
 * Called from Sankey context menus to skip step 1.
 * @param {string} type  Action type (e.g. 'decommission', 'extend-contract', etc.)
 * @param {Object} prefill  Fields to pre-fill: { systemId, funcId, successorName, fromSystemId, ... }
 */
export function openActionBuilderWithContext(type, prefill = {}) {
    _actionBuilderStep = 2;
    _actionBuilderType = type;
    const modal = document.getElementById('actionBuilderModal');
    if (!modal) return;
    document.getElementById('actionBuilderError').classList.add('hidden');
    renderActionBuilderStep2(type);
    if (modal.classList.contains('hidden')) {
        _actionBuilderOpener = document.activeElement;
    }
    modal.classList.remove('hidden');
    if (!_actionBuilderTrapCleanup) {
        _actionBuilderTrapCleanup = createFocusTrap(modal);
    }
    const closeBtn = document.getElementById('btnCloseActionBuilder');
    if (closeBtn) closeBtn.focus();

    // Update title to indicate edit vs add
    const titleEl = document.getElementById('actionBuilderTitle');
    if (titleEl && _editingActionIndex !== null) {
        titleEl.textContent = `Edit Action: ${getActionTypeName(type)}`;
    }

    // Pre-fill fields after DOM is updated
    requestAnimationFrame(() => {
        if (prefill.systemId) {
            const el = document.getElementById('field_systemId');
            if (el) el.value = prefill.systemId;
        }
        if (prefill.fromSystemId) {
            const el = document.getElementById('field_fromSystemId');
            if (el) el.value = prefill.fromSystemId;
        }
        if (prefill.toSystemId) {
            const el = document.getElementById('field_toSystemId');
            if (el) el.value = prefill.toSystemId;
        }
        if (prefill.newEndYear != null) {
            const el = document.getElementById('field_newEndYear');
            if (el) el.value = prefill.newEndYear;
        }
        if (prefill.newEndMonth != null) {
            const el = document.getElementById('field_newEndMonth');
            if (el) el.value = prefill.newEndMonth;
        }
        if (prefill.userCount != null) {
            const el = document.getElementById('field_userCount');
            if (el) el.value = prefill.userCount;
        }
        if (prefill.newSystemLabel != null) {
            const el = document.getElementById('field_newSystemLabel');
            if (el) el.value = prefill.newSystemLabel;
        }
        if (prefill.newSystemVendor != null) {
            const el = document.getElementById('field_newSystemVendor');
            if (el) el.value = prefill.newSystemVendor;
        }
        if (prefill.annualCost != null) {
            const el = document.getElementById('field_annualCost');
            if (el) el.value = prefill.annualCost;
        }
        if (prefill.isCloud != null) {
            const el = document.getElementById('field_isCloud');
            if (el) el.checked = !!prefill.isCloud;
        }
        if (prefill.replacesSystemId != null) {
            const el = document.getElementById('field_replacesSystemId');
            if (el) el.value = prefill.replacesSystemId;
        }
        if (prefill.funcId) {
            const funcEl = document.getElementById('field_funcId');
            if (funcEl) {
                funcEl.value = prefill.funcId;
                funcEl.dispatchEvent(new Event('change'));
            }
        }
        if (prefill.successorName) {
            const succEl = document.getElementById('field_successorName');
            if (succEl) {
                succEl.value = prefill.successorName;
                succEl.dispatchEvent(new Event('change'));
            }
        }
        // For consolidate: targetSystemId must wait for the systems dropdown to populate async
        if (type === 'consolidate' && prefill.targetSystemId) {
            requestAnimationFrame(() => {
                const el = document.getElementById('field_targetSystemId');
                if (el) el.value = prefill.targetSystemId;
            });
        }
        // For split-shared-service: populate split rows
        if (type === 'split-shared-service' && prefill.splits && prefill.splits.length > 0) {
            // Clear default rows
            const splitRows = document.getElementById('splitRows');
            if (splitRows) {
                splitRows.innerHTML = '';
                _splitRowCount = 0;
                prefill.splits.forEach(split => {
                    addSplitRow();
                    const rows = splitRows.querySelectorAll('.split-row');
                    const row = rows[rows.length - 1];
                    if (row) {
                        const succSel = row.querySelector('.split-successor');
                        const labelInp = row.querySelector('.split-label');
                        if (succSel) succSel.value = split.successorName;
                        if (labelInp) labelInp.value = split.label;
                    }
                });
            }
        }
    });
}

function renderActionBuilderStep1() {
    _actionBuilderStep = 1;
    const content = document.getElementById('actionBuilderContent');
    if (!content) return;

    const types = [
        { id: 'consolidate', label: 'Consolidate Systems', desc: 'Choose one system to keep for a function; decommission others' },
        { id: 'decommission', label: 'Decommission System', desc: 'Remove a system entirely' },
        { id: 'extend-contract', label: 'Extend Contract', desc: "Change a system's contract end date" },
        { id: 'migrate-users', label: 'Migrate Users', desc: 'Move users from one system to another' },
        { id: 'split-shared-service', label: 'Split Shared Service', desc: 'Split a shared service into separate instances per successor' },
        { id: 'procure-replacement', label: 'Procure Replacement', desc: 'Add a new system to replace an existing one' }
    ];

    let html = '<p class="text-sm font-bold mb-4 text-gray-700">Step 1 of 2: Select the type of action to simulate</p>';
    html += '<div class="space-y-2">';
    types.forEach(t => {
        html += `<label class="flex items-start gap-3 p-3 border-2 border-gray-300 cursor-pointer hover:border-[#f47738] has-[:checked]:border-[#f47738] has-[:checked]:bg-[#fff3cd]">
            <input type="radio" name="actionType" value="${t.id}" class="mt-1">
            <div>
                <span class="font-bold text-sm">${escHtml(t.label)}</span>
                <p class="text-xs text-gray-600 mt-0.5">${escHtml(t.desc)}</p>
            </div>
        </label>`;
    });
    html += '</div>';
    html += '<div class="mt-4"><button onclick="window._simActionBuilderNext()" class="gds-btn px-4 py-2 text-sm font-bold">Next: Configure &rarr;</button></div>';

    content.innerHTML = html;
    document.getElementById('actionBuilderTitle').textContent = 'Add Simulation Action';
    document.getElementById('btnApplyAction').style.display = 'none';
}

export function actionBuilderNext() {
    if (_actionBuilderStep === 1) {
        const selected = document.querySelector('input[name="actionType"]:checked');
        if (!selected) {
            showActionBuilderError('Please select an action type.');
            return;
        }
        _actionBuilderType = selected.value;
        _actionBuilderStep = 2;
        renderActionBuilderStep2(_actionBuilderType);
    }
}

function getSimulatedNodes() {
    if (!state.simulationState) return [];
    const impact = state.simulationState.lastImpact;
    if (impact && impact.simulationResult) {
        return impact.simulationResult.nodes;
    }
    // No actions applied yet — use baseline
    return state.simulationState.baselineNodes;
}

function getSimulatedITSystems() {
    return getSimulatedNodes().filter(n => n.type === 'ITSystem');
}

function systemOptionLabel(s) {
    const parts = [s.label];
    if (s._sourceCouncil) parts.push(s._sourceCouncil);
    const meta = [];
    if (typeof s.users === 'number') meta.push(`${s.users.toLocaleString()} users`);
    if (typeof s.annualCost === 'number') meta.push(`£${s.annualCost.toLocaleString()}/yr`);
    if (s.vendor) meta.push(s.vendor);
    if (s.sharedWith && s.sharedWith.length > 0) meta.push('shared');
    if (meta.length > 0) parts.push(meta.join(', '));
    return parts.join(' — ');
}

function renderActionBuilderStep2(type) {
    const content = document.getElementById('actionBuilderContent');
    if (!content) return;

    document.getElementById('actionBuilderTitle').textContent = `Add Action: ${getActionTypeName(type)}`;
    document.getElementById('btnApplyAction').style.display = '';

    const systems = getSimulatedITSystems();
    const lgaFunctions = Array.from(state.lgaFunctionMap.values()).sort((a, b) => a.label.localeCompare(b.label));
    const successors = (state.transitionStructure && state.transitionStructure.successors) ? state.transitionStructure.successors : [];

    let html = `<p class="text-sm text-gray-600 mb-4"><button onclick="window._simActionBuilderBack()" class="text-[#1d70b8] underline font-bold text-sm">&larr; Back</button></p>`;
    html += '<div class="space-y-4" id="actionBuilderForm">';

    if (type === 'consolidate') {
        html += buildSelectField('funcId', 'Function', lgaFunctions.map(f => ({ value: f.lgaId, label: f.label })), '', 'onchange="window._simUpdateConsolidateSystems()"');
        html += buildSelectField('successorName', 'Successor Authority', successors.map(s => ({ value: s.name, label: s.name })), '', 'onchange="window._simUpdateConsolidateSystems()"');
        html += `<div id="consolidateSystemField">${buildSelectField('targetSystemId', 'Target System (keep)', [], 'Select a function and successor first')}</div>`;
    } else if (type === 'decommission') {
        html += buildSystemSelect('systemId', 'System to decommission', systems);
    } else if (type === 'extend-contract') {
        html += buildSystemSelect('systemId', 'System', systems);
        html += `<div class="grid grid-cols-2 gap-4">
            <div>
                <label class="block text-sm font-bold mb-1">New End Year</label>
                <input type="number" id="field_newEndYear" min="2025" max="2040" value="2030" class="border-2 border-[#0b0c0c] p-2 text-sm w-full">
            </div>
            <div>
                <label class="block text-sm font-bold mb-1">New End Month</label>
                <select id="field_newEndMonth" class="border-2 border-[#0b0c0c] p-2 text-sm w-full">
                    ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
                </select>
            </div>
        </div>`;
    } else if (type === 'migrate-users') {
        const systemsWithUsers = systems.filter(s => (s.users || 0) > 0);
        html += buildSystemSelect('fromSystemId', 'From System', systemsWithUsers);
        html += buildSystemSelect('toSystemId', 'To System', systems);
        html += `<div>
            <label class="block text-sm font-bold mb-1">User Count to Migrate</label>
            <input type="number" id="field_userCount" min="1" value="100" class="border-2 border-[#0b0c0c] p-2 text-sm w-48">
        </div>`;
    } else if (type === 'split-shared-service') {
        const sharedSystems = systems.filter(s => s.sharedWith && s.sharedWith.length > 0);
        html += buildSystemSelect('systemId', 'System to split',
            sharedSystems.length > 0 ? sharedSystems : systems
        );
        html += `<div id="splitsContainer">
            <label class="block text-sm font-bold mb-2">Splits (one per successor)</label>
            <div id="splitRows" class="space-y-2"></div>
            <button type="button" onclick="window._simAddSplitRow()" class="mt-2 gds-btn-secondary px-3 py-1.5 text-xs font-bold">+ Add Split</button>
        </div>`;
    } else if (type === 'procure-replacement') {
        html += buildSelectField('funcId', 'Function', lgaFunctions.map(f => ({ value: f.lgaId, label: f.label })));
        html += buildSelectField('successorName', 'Successor Authority', successors.map(s => ({ value: s.name, label: s.name })));
        html += `<div><label class="block text-sm font-bold mb-1">New System Label</label>
            <input type="text" id="field_newSystemLabel" class="border-2 border-[#0b0c0c] p-2 text-sm w-full" placeholder="e.g. Capita Revenues Cloud"></div>`;
        html += `<div><label class="block text-sm font-bold mb-1">Vendor</label>
            <input type="text" id="field_newSystemVendor" class="border-2 border-[#0b0c0c] p-2 text-sm w-full" placeholder="e.g. Capita"></div>`;
        html += `<div><label class="block text-sm font-bold mb-1">Annual Cost (£)</label>
            <input type="number" id="field_annualCost" min="0" class="border-2 border-[#0b0c0c] p-2 text-sm w-48" placeholder="e.g. 150000"></div>`;
        html += `<div class="flex items-center gap-2"><input type="checkbox" id="field_isCloud" checked class="w-4 h-4"><label for="field_isCloud" class="text-sm font-bold">Cloud-hosted</label></div>`;
        html += buildSystemSelect('replacesSystemId', 'Replaces (optional)', systems, 'None — new procurement');
    }

    html += '</div>';
    content.innerHTML = html;

    // Initialise split rows for split-shared-service
    if (type === 'split-shared-service') {
        addSplitRow();
        addSplitRow();
    }
}

function buildSelectField(id, label, options, placeholder, extraAttrs) {
    const ph = placeholder ? `<option value="">${escHtml(placeholder)}</option>` : '';
    const opts = options.map(o => `<option value="${escHtml(String(o.value))}">${escHtml(o.label)}</option>`).join('');
    return `<div>
        <label for="field_${id}" class="block text-sm font-bold mb-1">${escHtml(label)}</label>
        <select id="field_${id}" class="border-2 border-[#0b0c0c] p-2 text-sm w-full" ${extraAttrs || ''}>${ph}${opts}</select>
    </div>`;
}

function buildSystemSelect(id, label, systems, placeholder, extraAttrs) {
    // Group systems by _sourceCouncil
    const groups = new Map();
    systems.forEach(s => {
        const council = s._sourceCouncil || 'Unknown';
        if (!groups.has(council)) groups.set(council, []);
        groups.get(council).push(s);
    });

    // Sort councils alphabetically, systems within each group alphabetically
    const sortedCouncils = [...groups.keys()].sort();

    let optsHtml = '';
    if (placeholder) {
        optsHtml += `<option value="">${escHtml(placeholder)}</option>`;
    }

    if (sortedCouncils.length <= 1) {
        // No grouping needed — single council or no council info
        const allSystems = systems.slice().sort((a, b) => (a.label || '').localeCompare(b.label || ''));
        optsHtml += allSystems.map(s =>
            `<option value="${escHtml(s.id)}">${escHtml(systemOptionLabel(s))}</option>`
        ).join('');
    } else {
        sortedCouncils.forEach(council => {
            const councilSystems = groups.get(council).slice().sort((a, b) => (a.label || '').localeCompare(b.label || ''));
            optsHtml += `<optgroup label="${escHtml(council)}">`;
            optsHtml += councilSystems.map(s =>
                `<option value="${escHtml(s.id)}">${escHtml(systemOptionLabel(s))}</option>`
            ).join('');
            optsHtml += '</optgroup>';
        });
    }

    return `<div>
        <label for="field_${id}" class="block text-sm font-bold mb-1">${escHtml(label)}</label>
        <select id="field_${id}" class="border-2 border-[#0b0c0c] p-2 text-sm w-full" ${extraAttrs || ''}>${optsHtml}</select>
    </div>`;
}

let _splitRowCount = 0;

function addSplitRow() {
    const container = document.getElementById('splitRows');
    if (!container) return;
    const successors = (state.transitionStructure && state.transitionStructure.successors) ? state.transitionStructure.successors : [];
    const idx = _splitRowCount++;
    const row = document.createElement('div');
    row.className = 'flex gap-2 items-center split-row';
    row.dataset.idx = idx;
    // Default each row to a different successor where possible
    const defaultIdx = Math.min(idx, successors.length - 1);
    const succOpts = successors.map((s, i) => `<option value="${escHtml(s.name)}"${i === defaultIdx ? ' selected' : ''}>${escHtml(s.name)}</option>`).join('');
    const splitId = `split_${idx}`;
    row.innerHTML = `
        <div class="flex-shrink-0 w-48">
            <label for="${splitId}_succ" class="sr-only">Successor authority for split ${idx + 1}</label>
            <select id="${splitId}_succ" class="border-2 border-[#0b0c0c] p-1.5 text-sm w-full split-successor">${succOpts}</select>
        </div>
        <div class="flex-1">
            <label for="${splitId}_label" class="sr-only">Instance label for split ${idx + 1}</label>
            <input id="${splitId}_label" type="text" class="border-2 border-[#0b0c0c] p-1.5 text-sm w-full split-label" placeholder="Instance label (e.g. System (North))">
        </div>
        <button type="button" onclick="this.closest('.split-row').remove()" class="text-[#d4351c] font-bold text-lg leading-none" aria-label="Remove split ${idx + 1}">&times;</button>
    `;
    container.appendChild(row);
}

export function updateConsolidateSystems() {
    const funcId = document.getElementById('field_funcId')?.value;
    const successorName = document.getElementById('field_successorName')?.value;
    const container = document.getElementById('consolidateSystemField');
    if (!container) return;

    if (!funcId || !successorName) {
        container.innerHTML = buildSelectField('targetSystemId', 'Target System (keep)', [], 'Select a function and successor first');
        return;
    }

    const systems = getSimulatedITSystems();
    const simNodes = getSimulatedNodes();
    const simEdges = state.simulationState
        ? (state.simulationState.lastImpact ? state.simulationState.lastImpact.simulationResult.edges : state.simulationState.baselineEdges)
        : [];

    // Find function nodes for this lgaFunctionId
    const funcNodeIds = new Set(simNodes.filter(n => n.type === 'Function' && n.lgaFunctionId === funcId).map(n => n.id));

    // Find system IDs serving this function
    const sysIdsServingFunction = new Set();
    simEdges.forEach(e => {
        if (e.relationship === 'REALIZES' && funcNodeIds.has(e.target)) {
            sysIdsServingFunction.add(e.source);
        }
    });

    // Filter to systems allocated to this successor
    let relevantSystems = systems.filter(s => sysIdsServingFunction.has(s.id));

    // Further filter by successor using allocation map (afterAllocation if available, else baselineAllocation)
    const allocMap = (state.simulationState && state.simulationState.lastImpact && state.simulationState.lastImpact.afterAllocation)
        ? state.simulationState.lastImpact.afterAllocation
        : (state.simulationState && state.simulationState.baselineAllocation)
            ? state.simulationState.baselineAllocation
            : null;
    if (allocMap && allocMap.has(successorName) && allocMap.get(successorName).has(funcId)) {
        const allocations = allocMap.get(successorName).get(funcId);
        const allocIds = new Set(allocations.map(a => a.system.id));
        relevantSystems = relevantSystems.filter(s => allocIds.has(s.id));
    }

    if (relevantSystems.length === 0) {
        container.innerHTML = buildSelectField('targetSystemId', 'Target System (keep)', [], 'No systems found for this combination');
        return;
    }

    container.innerHTML = buildSystemSelect('targetSystemId', 'Target System (keep)', relevantSystems);
}

function getConsolidateCellSystemIds(funcId, successorName) {
    const systems = getSimulatedITSystems();
    const simNodes = getSimulatedNodes();
    const simEdges = state.simulationState
        ? (state.simulationState.lastImpact ? state.simulationState.lastImpact.simulationResult.edges : state.simulationState.baselineEdges)
        : [];
    const funcNodeIds = new Set(simNodes.filter(n => n.type === 'Function' && n.lgaFunctionId === funcId).map(n => n.id));
    const sysIdsServingFunction = new Set();
    simEdges.forEach(e => {
        if (e.relationship === 'REALIZES' && funcNodeIds.has(e.target)) {
            sysIdsServingFunction.add(e.source);
        }
    });
    let relevantSystems = systems.filter(s => sysIdsServingFunction.has(s.id));
    // Use afterAllocation if available, else baselineAllocation for successor scoping
    const allocMap = (state.simulationState && state.simulationState.lastImpact && state.simulationState.lastImpact.afterAllocation)
        ? state.simulationState.lastImpact.afterAllocation
        : (state.simulationState && state.simulationState.baselineAllocation)
            ? state.simulationState.baselineAllocation
            : null;
    if (allocMap && allocMap.has(successorName) && allocMap.get(successorName).has(funcId)) {
        const allocations = allocMap.get(successorName).get(funcId);
        const allocIds = new Set(allocations.map(a => a.system.id));
        relevantSystems = relevantSystems.filter(s => allocIds.has(s.id));
    }
    return relevantSystems.map(s => s.id);
}

function showActionBuilderError(msg) {
    const el = document.getElementById('actionBuilderError');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
}

function clearActionBuilderError() {
    const el = document.getElementById('actionBuilderError');
    if (el) el.classList.add('hidden');
}

export function applyActionFromBuilder() {
    clearActionBuilderError();
    if (!state.simulationState) return;

    const type = _actionBuilderType;
    let action = null;

    try {
        if (type === 'consolidate') {
            const funcId = document.getElementById('field_funcId')?.value;
            const successorName = document.getElementById('field_successorName')?.value;
            const targetSystemId = document.getElementById('field_targetSystemId')?.value;
            if (!funcId || !successorName || !targetSystemId) {
                showActionBuilderError('Please fill in all fields.');
                return;
            }
            // Compute removeSystemIds: all systems in this cell except the target
            const removeSystemIds = getConsolidateCellSystemIds(funcId, successorName)
                .filter(id => id !== targetSystemId);
            action = { type: 'consolidate', functionId: funcId, successorName, targetSystemId, removeSystemIds };

        } else if (type === 'decommission') {
            const systemId = document.getElementById('field_systemId')?.value;
            if (!systemId) { showActionBuilderError('Please select a system.'); return; }
            action = { type: 'decommission', systemId };

        } else if (type === 'extend-contract') {
            const systemId = document.getElementById('field_systemId')?.value;
            const newEndYear = parseInt(document.getElementById('field_newEndYear')?.value, 10);
            const newEndMonth = parseInt(document.getElementById('field_newEndMonth')?.value, 10);
            if (!systemId || !newEndYear || !newEndMonth) { showActionBuilderError('Please fill in all fields.'); return; }
            action = { type: 'extend-contract', systemId, newEndYear, newEndMonth };

        } else if (type === 'migrate-users') {
            const fromSystemId = document.getElementById('field_fromSystemId')?.value;
            const toSystemId = document.getElementById('field_toSystemId')?.value;
            const userCount = parseInt(document.getElementById('field_userCount')?.value, 10);
            if (!fromSystemId || !toSystemId || !userCount || userCount <= 0) {
                showActionBuilderError('Please fill in all fields with valid values.');
                return;
            }
            if (fromSystemId === toSystemId) { showActionBuilderError('From and To systems must be different.'); return; }
            action = { type: 'migrate-users', fromSystemId, toSystemId, userCount };

        } else if (type === 'split-shared-service') {
            const systemId = document.getElementById('field_systemId')?.value;
            if (!systemId) { showActionBuilderError('Please select a system.'); return; }
            const splitRows = document.querySelectorAll('#splitRows .split-row');
            const splits = [];
            splitRows.forEach(row => {
                const successorName = row.querySelector('.split-successor')?.value;
                const label = row.querySelector('.split-label')?.value;
                if (successorName && label) splits.push({ successorName, label });
            });
            if (splits.length < 2) {
                showActionBuilderError('At least 2 split instances are required.');
                return;
            }
            action = { type: 'split-shared-service', systemId, splits };

        } else if (type === 'procure-replacement') {
            const funcId = document.getElementById('field_funcId')?.value;
            const successorName = document.getElementById('field_successorName')?.value;
            const label = document.getElementById('field_newSystemLabel')?.value?.trim();
            const vendor = document.getElementById('field_newSystemVendor')?.value?.trim();
            const annualCostRaw = document.getElementById('field_annualCost')?.value;
            const isCloud = document.getElementById('field_isCloud')?.checked;
            const replacesSystemId = document.getElementById('field_replacesSystemId')?.value || null;

            if (!funcId || !label) { showActionBuilderError('Function and system label are required.'); return; }
            const newSystem = {
                id: 'sim-' + Math.random().toString(36).slice(2, 10),
                label,
                vendor: vendor || null,
                annualCost: annualCostRaw ? parseInt(annualCostRaw, 10) : null,
                isCloud: !!isCloud,
                _sourceCouncil: successorName || 'Simulated',
                targetAuthorities: successorName ? [successorName] : []
            };
            action = { type: 'procure-replacement', functionId: funcId, successorName, newSystem, replacesSystemId };
        }
    } catch (err) {
        showActionBuilderError('Error building action: ' + err.message);
        return;
    }

    if (!action) return;

    if (_editingActionIndex !== null) {
        state.simulationState.actions[_editingActionIndex] = action;
        _editingActionIndex = null;
    } else {
        state.simulationState.actions.push(action);
    }
    document.getElementById('actionBuilderModal').classList.add('hidden');
    recomputeSimulation();
}

// ===================================================================
// HELPERS
// ===================================================================

function getActionTypeName(type) {
    const names = {
        'consolidate': 'Consolidate Systems',
        'decommission': 'Decommission System',
        'extend-contract': 'Extend Contract',
        'migrate-users': 'Migrate Users',
        'split-shared-service': 'Split Shared Service',
        'procure-replacement': 'Procure Replacement'
    };
    return names[type] || type;
}

function getActionLabel(action) {
    switch (action.type) {
        case 'consolidate': {
            const funcEntry = state.lgaFunctionMap.get(action.functionId);
            const funcLabel = funcEntry ? funcEntry.label : action.functionId;
            const sys = getSimulatedITSystems().find(s => s.id === action.targetSystemId)
                || state.simulationState.baselineNodes.find(n => n.id === action.targetSystemId);
            const sysLabel = sys ? sys.label : action.targetSystemId;
            return `Consolidate ${funcLabel} in ${action.successorName} \u2192 keep ${sysLabel}`;
        }
        case 'decommission': {
            const sys = state.simulationState.baselineNodes.find(n => n.id === action.systemId);
            return `Decommission ${sys ? sys.label : action.systemId}`;
        }
        case 'extend-contract': {
            const sys = state.simulationState.baselineNodes.find(n => n.id === action.systemId);
            return `Extend ${sys ? sys.label : action.systemId} \u2192 ${action.newEndMonth}/${action.newEndYear}`;
        }
        case 'migrate-users': {
            const from = state.simulationState.baselineNodes.find(n => n.id === action.fromSystemId);
            const to = state.simulationState.baselineNodes.find(n => n.id === action.toSystemId);
            return `Migrate ${action.userCount} users: ${from ? from.label : action.fromSystemId} \u2192 ${to ? to.label : action.toSystemId}`;
        }
        case 'split-shared-service': {
            const sys = state.simulationState.baselineNodes.find(n => n.id === action.systemId);
            const n = action.splits ? action.splits.length : '?';
            return `Split ${sys ? sys.label : action.systemId} \u2192 ${n} instances`;
        }
        case 'procure-replacement': {
            const funcEntry = state.lgaFunctionMap.get(action.functionId);
            const funcLabel = funcEntry ? funcEntry.label : action.functionId;
            const label = action.newSystem ? action.newSystem.label : '?';
            const successor = action.successorName || '';
            return successor ? `Procure ${label} for ${funcLabel} \u2192 ${successor}` : `Procure ${label} for ${funcLabel}`;
        }
        default:
            return action.type;
    }
}

// ===================================================================
// FOCUS TRAP UTILITY
// ===================================================================

/**
 * Sets up a focus trap inside a modal element.
 * Returns a cleanup function that removes the event listener.
 */
function createFocusTrap(modalEl) {
    const focusableSelectors = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    function trapFocus(e) {
        if (e.key !== 'Tab') return;
        const focusable = [...modalEl.querySelectorAll(focusableSelectors)].filter(el => !el.closest('[hidden]') && !el.closest('.hidden'));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }
    modalEl.addEventListener('keydown', trapFocus);
    return () => modalEl.removeEventListener('keydown', trapFocus);
}

// ===================================================================
// GLOBAL WINDOW HOOKS (called from inline HTML onclick handlers)
// ===================================================================

// Track opener elements for focus return
let _actionBuilderOpener = null;
let _obligationDetailOpener = null;
let _actionBuilderTrapCleanup = null;
let _obligationDetailTrapCleanup = null;

// --- Wire action builder modal close/apply buttons ---
const actionBuilderModal = document.getElementById('actionBuilderModal');
if (actionBuilderModal) {
    const closeActionBuilderModal = () => {
        actionBuilderModal.classList.add('hidden');
        _editingActionIndex = null;
        if (_actionBuilderTrapCleanup) { _actionBuilderTrapCleanup(); _actionBuilderTrapCleanup = null; }
        if (_actionBuilderOpener && typeof _actionBuilderOpener.focus === 'function') {
            _actionBuilderOpener.focus();
            _actionBuilderOpener = null;
        }
    };
    document.getElementById('btnCloseActionBuilder').addEventListener('click', closeActionBuilderModal);
    document.getElementById('btnCancelAction').addEventListener('click', closeActionBuilderModal);
    document.getElementById('btnApplyAction').addEventListener('click', applyActionFromBuilder);
    actionBuilderModal.addEventListener('click', (e) => {
        if (e.target === actionBuilderModal) closeActionBuilderModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !actionBuilderModal.classList.contains('hidden')) {
            closeActionBuilderModal();
        }
    });
}

window._simExit = exitSimulation;
window._simOpenActionBuilder = openActionBuilder;
window._simOpenActionBuilderWithContext = openActionBuilderWithContext;
window._simEditAction = editAction;
window._simRemoveAction = function(idx) {
    if (!state.simulationState) return;
    state.simulationState.actions.splice(idx, 1);
    recomputeSimulation();
};
window._simClearAll = function() {
    if (!state.simulationState) return;
    state.simulationState.actions = [];
    recomputeSimulation();
};
window._simActionBuilderNext = actionBuilderNext;
window._simActionBuilderBack = function() {
    _actionBuilderStep = 1;
    _actionBuilderType = null;
    _editingActionIndex = null;
    renderActionBuilderStep1();
};
window._simUpdateConsolidateSystems = updateConsolidateSystems;
window._simAddSplitRow = addSplitRow;
window._simToggleActionPanel = function() {
    _actionPanelCollapsed = !_actionPanelCollapsed;
    renderSimulationWorkspace();
};
window._simSankeyBack = function() {
    _sankeyDrillDown = null;
    _sankeyCouncilFilter = null;
    _sankeyFunctionFilter = null;
    renderSimulationWorkspace();
};
window._simSankeySetSize = function(mode) {
    _sankeySizeMode = mode;
    renderSimulationWorkspace();
};
window._simSankeyFilterCouncil = function(council) {
    _sankeyCouncilFilter = council || null;
    renderSimulationWorkspace();
};
window._simSankeyFilterFunction = function(funcId) {
    _sankeyFunctionFilter = funcId || null;
    renderSimulationWorkspace();
};
window._simSankeySetOverlay = function(overlay) {
    _sankeyOverlay = overlay || 'default';
    renderSimulationWorkspace();
};
window._simGetSignalWeights = function() {
    return state.signalWeights || {};
};
window._simOpenObligationDetail = openObligationDetail;
window._simToggleObligationGroup = function(groupKey) {
    if (_expandedObligationGroups.has(groupKey)) {
        _expandedObligationGroups.delete(groupKey);
    } else {
        _expandedObligationGroups.add(groupKey);
    }
    // Re-render the modal content
    const obligations = state.simulationState?.lastImpact?.obligations;
    if (obligations) renderObligationDetailContent(obligations);
};

// --- Wire obligation detail modal close handlers ---
const obligationDetailModal = document.getElementById('obligationDetailModal');
if (obligationDetailModal) {
    const closeObligationDetailModal = () => {
        obligationDetailModal.classList.add('hidden');
        if (_obligationDetailTrapCleanup) { _obligationDetailTrapCleanup(); _obligationDetailTrapCleanup = null; }
        if (_obligationDetailOpener && typeof _obligationDetailOpener.focus === 'function') {
            _obligationDetailOpener.focus();
            _obligationDetailOpener = null;
        }
    };
    document.getElementById('btnCloseObligationDetail').addEventListener('click', closeObligationDetailModal);
    obligationDetailModal.addEventListener('click', (e) => {
        if (e.target === obligationDetailModal) closeObligationDetailModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !obligationDetailModal.classList.contains('hidden')) {
            closeObligationDetailModal();
        }
    });
}
