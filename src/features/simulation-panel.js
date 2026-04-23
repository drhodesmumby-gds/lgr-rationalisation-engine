import { state } from '../state.js';
import { escHtml } from '../ui-helpers.js';
import { computeSimulationImpact } from '../simulation/impact.js';
import { computeObligationSeverity, generateMigrationScopeBullets } from '../simulation/obligations.js';
import { projectDecisions } from '../simulation/projector.js';
import { getDecisionKey } from '../simulation/decisions.js';
import { renderDashboard } from '../main.js';
import { buildSuccessorAllocation } from '../analysis/allocation.js';
import { buildEstateSankeyData, buildFunctionSankeyData } from './sankey-data.js';
import { renderSankeyDiagram, destroySankeyDiagram, PREDECESSOR_COLOURS } from './sankey-diagram.js';
// NOTE: openDecisionPanel is NOT imported here to avoid circular dependency
// (decision-panel.js imports recomputeSimulation from this file).
// Instead we call window._simOpenDecision() which is wired up by decision-panel.js.

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
        decisions: new Map(),
        projectedActions: [],
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

    // Prefer decisions (new path) when the decisions map is non-empty.
    // Fall back to raw actions (legacy path) when decisions map is empty.
    const useDecisions = ss.decisions && ss.decisions.size > 0;

    if (useDecisions) {
        // New path: project decisions into actions via the pure projector
        const { actions: projectedActions, obligations: projObligations } = projectDecisions(
            ss.decisions,
            ss.baselineNodes,
            ss.baselineEdges,
            ss.baselineAllocation,
            state.lgaFunctionMap
        );
        ss.projectedActions = projectedActions;

        if (projectedActions.length === 0) {
            ss.lastImpact = null;
        } else {
            ss.lastImpact = computeSimulationImpact({
                baselineNodes: ss.baselineNodes,
                baselineEdges: ss.baselineEdges,
                actions: projectedActions,
                transitionStructure: state.transitionStructure,
                lgaFunctionMap: state.lgaFunctionMap,
                perspective: state.activePerspective
            });
            // Merge projector-generated obligations with engine-generated obligations
            if (ss.lastImpact) {
                ss.lastImpact.obligations = [
                    ...(ss.lastImpact.obligations || []),
                    ...projObligations
                ];
            }
        }
    } else {
        // Legacy path: use raw actions array directly
        ss.projectedActions = [];
        if (!ss.actions || ss.actions.length === 0) {
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
 * Renders a side-by-side layout: decision summary panel (left) + Sankey (right).
 */
export function renderSimulationWorkspace() {
    const toolbar = document.getElementById('simulationToolbar');
    if (!toolbar) return;

    if (!state.simulationState) {
        toolbar.classList.add('hidden');
        toolbar.innerHTML = '';
        return;
    }

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

    // Render decision summary panel content
    const actionPanel = toolbar.querySelector('#simActionPanel');
    renderDecisionSummary(actionPanel, impact);

    // Render Sankey panel content
    const sankeyPanel = toolbar.querySelector('#simSankeyPanel');
    renderSankeyPanel(sankeyPanel);
}

// Keep backward-compatible alias
export const renderSimulationToolbar = renderSimulationWorkspace;

// ===================================================================
// DECISION SUMMARY PANEL (replaces old action panel)
// ===================================================================

/**
 * Counts the number of function+successor pairs that have 2 or more competing systems.
 * These are the cells where a decision is meaningful.
 * @returns {number}
 */
function countDecidableFunctions() {
    const ss = state.simulationState;
    if (!ss) return 0;
    const allocMap = ss.baselineAllocation || state.successorAllocationMap;
    if (!allocMap) return 0;
    let count = 0;
    allocMap.forEach((funcMap) => {
        funcMap.forEach((allocations) => {
            if (allocations.length >= 2) count++;
        });
    });
    return count;
}

/**
 * Computes ERP decision status: for each ERP system, how many functions it covers
 * and how many of those have decisions (and breakdown by choice type).
 *
 * @param {Map} decisions - state.simulationState.decisions
 * @returns {Array<{erpLabel: string, totalFunctions: number, decidedCount: number, retained: number, replacedByChoice: number, replacedByProcure: number, deferred: number}>}
 */
function computeErpDecisionStatus(decisions) {
    const ss = state.simulationState;
    if (!ss) return [];
    const allocMap = ss.baselineAllocation || state.successorAllocationMap;
    if (!allocMap) return [];

    // Find all ERP systems and which function+successor cells they appear in
    const erpMap = new Map(); // erpSystemId -> { label, cells: [{functionId, successorName}] }

    allocMap.forEach((funcMap, successorName) => {
        funcMap.forEach((allocations, functionId) => {
            allocations.forEach(a => {
                if (a.system && a.system.isERP) {
                    const id = a.system.id;
                    if (!erpMap.has(id)) {
                        erpMap.set(id, { label: a.system.label || id, cells: [] });
                    }
                    erpMap.get(id).cells.push({ functionId, successorName });
                }
            });
        });
    });

    const result = [];
    erpMap.forEach((erp, erpSystemId) => {
        // Unique function+successor cells
        const uniqueCells = [];
        const seen = new Set();
        erp.cells.forEach(c => {
            const k = `${c.functionId}::${c.successorName}`;
            if (!seen.has(k)) { seen.add(k); uniqueCells.push(c); }
        });

        let decidedCount = 0, retained = 0, replacedByChoice = 0, replacedByProcure = 0, deferred = 0;
        uniqueCells.forEach(c => {
            const dec = decisions.get(getDecisionKey(c.functionId, c.successorName));
            if (dec) {
                decidedCount++;
                if (dec.systemChoice === 'defer') {
                    deferred++;
                } else if (dec.systemChoice === 'choose') {
                    // Is the ERP system in the retained set?
                    const erpRetained = (dec.retainedSystemIds || []).includes(erpSystemId);
                    if (erpRetained) { retained++; } else { replacedByChoice++; }
                } else if (dec.systemChoice === 'procure') {
                    // Procure means all old systems (including the ERP) are replaced by a new procurement
                    replacedByProcure++;
                }
            }
        });

        result.push({
            erpLabel: erp.label,
            totalFunctions: uniqueCells.length,
            decidedCount,
            retained,
            replacedByChoice,
            replacedByProcure,
            deferred
        });
    });

    return result;
}

/**
 * Returns a compact human-readable label for a decision.
 * @param {Object} decision
 * @param {string} [systemLabel] - optional resolved label for retained system
 * @returns {string}
 */
function decisionLabel(decision, systemLabel) {
    if (decision.systemChoice === 'choose') {
        return systemLabel ? `Keep ${systemLabel}` : 'Keep system';
    }
    if (decision.systemChoice === 'procure') {
        return decision.procuredSystem ? `Procure ${decision.procuredSystem.label}` : 'Procure replacement';
    }
    if (decision.systemChoice === 'defer') {
        return 'Deferred';
    }
    return decision.systemChoice;
}

/**
 * Resolves the label for the retained/chosen system ID from baseline nodes.
 * @param {string} systemId
 * @returns {string}
 */
function resolveSystemLabel(systemId) {
    if (!state.simulationState) return systemId;
    const node = state.simulationState.baselineNodes.find(n => n.id === systemId);
    return node ? node.label : systemId;
}

/**
 * Renders the decision summary panel into the given element.
 * Replaces the old renderActionPanel / action chip display.
 *
 * @param {HTMLElement} el
 * @param {Object|null} impact
 */
function renderDecisionSummary(el, impact) {
    if (_actionPanelCollapsed) {
        const decisions = state.simulationState ? state.simulationState.decisions : new Map();
        el.innerHTML = `
            <div class="sim-panel-collapsed-content">
                <button onclick="window._simToggleActionPanel()" class="sim-panel-collapse-btn" title="Expand panel" aria-label="Expand decision panel">&#x276F;</button>
                <span class="sim-panel-collapsed-badge">${decisions.size}</span>
            </div>
        `;
        return;
    }

    const decisions = state.simulationState ? (state.simulationState.decisions || new Map()) : new Map();
    const totalDecidable = countDecidableFunctions();
    const decidedCount = decisions.size;
    const pct = totalDecidable > 0 ? Math.round((decidedCount / totalDecidable) * 100) : 0;

    // Progress bar
    const progressBarHtml = `
        <div class="mt-1 mb-1" aria-label="Decision progress: ${pct}%">
            <div class="w-full bg-gray-200 h-2 border border-gray-300">
                <div class="h-full bg-[#1d70b8]" style="width:${pct}%"></div>
            </div>
            <div class="text-xs text-gray-500 mt-0.5">${decidedCount} of ${totalDecidable} decidable functions &mdash; ${pct}%</div>
        </div>
    `;

    // Latest 5 decisions (sorted by timestamp descending)
    const sortedDecisions = [...decisions.values()]
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 5);

    let latestHtml = '';
    if (sortedDecisions.length === 0) {
        latestHtml = '<div class="text-xs text-gray-500 italic">No decisions made yet. Click "Decide" on a matrix cell to begin.</div>';
    } else {
        latestHtml = sortedDecisions.map(dec => {
            const funcEntry = state.lgaFunctionMap ? state.lgaFunctionMap.get(dec.functionId) : null;
            const funcLabel = funcEntry ? funcEntry.label : `Function ${dec.functionId}`;
            const retainedLabel = dec.systemChoice === 'choose' && dec.retainedSystemIds && dec.retainedSystemIds.length > 0
                ? resolveSystemLabel(dec.retainedSystemIds[0])
                : null;
            const dLabel = decisionLabel(dec, retainedLabel);
            return `<div class="text-xs py-0.5 border-b border-gray-100 last:border-0">
                <span class="font-bold">${escHtml(funcLabel)}</span>
                <span class="text-gray-500"> (${escHtml(dec.successorName)})</span>
                <span class="block text-gray-700">&rarr; ${escHtml(dLabel)}</span>
            </div>`;
        }).join('');
    }

    // Undecided Functions — cells with 2+ systems but no decision yet
    let undecidedHtml = '';
    {
        const allocMap = state.simulationState?.baselineAllocation || state.successorAllocationMap;
        const undecidedCells = [];
        if (allocMap) {
            allocMap.forEach((funcMap, succName) => {
                funcMap.forEach((allocations, funcId) => {
                    if (allocations.length >= 2) {
                        const decKey = getDecisionKey(funcId, succName);
                        if (!decisions.has(decKey)) {
                            const funcEntry = state.lgaFunctionMap ? state.lgaFunctionMap.get(funcId) : null;
                            const funcLabel = funcEntry ? funcEntry.label : `Function ${funcId}`;
                            undecidedCells.push({ funcId, succName, funcLabel });
                        }
                    }
                });
            });
        }
        if (undecidedCells.length > 0) {
            const SHOW_LIMIT = 10;
            const visible = undecidedCells.slice(0, SHOW_LIMIT);
            const overflow = undecidedCells.length - visible.length;
            const rows = visible.map(cell => {
                const safeFuncId = escHtml(cell.funcId);
                const safeSucc = escHtml(cell.succName);
                return `<div class="text-xs py-0.5 border-b border-gray-100 last:border-0 flex items-center justify-between gap-1">
                    <span class="truncate" title="${escHtml(cell.funcLabel)} (${safeSucc})">${escHtml(cell.funcLabel)} <span class="text-gray-400">(${safeSucc})</span></span>
                    <button class="text-xs font-bold text-[#1d70b8] underline whitespace-nowrap"
                            onclick="window._simOpenDecision('${safeFuncId}', '${safeSucc}')"
                            type="button">Decide</button>
                </div>`;
            }).join('');
            const moreHtml = overflow > 0
                ? `<div class="text-xs text-gray-400 mt-1">+${overflow} more undecided</div>`
                : '';
            undecidedHtml = `
                <div class="mt-2 pt-2 border-t border-gray-200">
                    <div class="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Undecided Functions</div>
                    ${rows}
                    ${moreHtml}
                </div>
            `;
        }
    }

    // ERP status
    const erpStatuses = computeErpDecisionStatus(decisions);
    let erpHtml = '';
    if (erpStatuses.length > 0) {
        const erpRows = erpStatuses.map(erp => {
            const parts = [];
            if (erp.retained > 0) parts.push(`${erp.retained} retained`);
            if (erp.replacedByChoice > 0) parts.push(`${erp.replacedByChoice} replaced`);
            if (erp.replacedByProcure > 0) parts.push(`${erp.replacedByProcure} procured`);
            if (erp.deferred > 0) parts.push(`${erp.deferred} deferred`);
            const breakdown = parts.length > 0 ? ` (${parts.join(', ')})` : '';
            return `<div class="text-xs py-0.5">
                <span class="inline-block text-xs px-1 py-0 bg-[#d4351c] text-white font-bold mr-1">ERP</span>
                <strong>${escHtml(erp.erpLabel)}</strong>: ${erp.decidedCount}/${erp.totalFunctions} decided${escHtml(breakdown)}
            </div>`;
        }).join('');
        erpHtml = `
            <div class="mt-2 pt-2 border-t border-gray-200">
                <div class="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">ERP Status</div>
                ${erpRows}
            </div>
        `;
    }

    // Warnings
    let warningHtml = '';
    if (impact && impact.warnings && impact.warnings.length > 0) {
        const humanized = [...new Set(impact.warnings)].map(w => w.replace(/\s*\(\d+\)\s*/g, ' ').replace(/\s{2,}/g, ' ').trim());
        warningHtml = `<div class="mt-2 p-2 bg-yellow-50 border-l-4 border-l-[#f47738] text-xs text-gray-800">
            <span class="font-bold">Warnings:</span> ${humanized.map(escHtml).join(' &bull; ')}
        </div>`;
    }

    const metricsHtml = impact ? renderBeforeAfterMetrics(impact, true) : '';
    const obligationsHtml = impact ? renderObligationsPanel(impact.obligations) : '';

    el.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold uppercase tracking-wide text-[#0b0c0c]">Decisions</span>
            <button onclick="window._simToggleActionPanel()" class="sim-panel-collapse-btn" title="Collapse panel" aria-label="Collapse decision panel">&#x276E;</button>
        </div>
        ${progressBarHtml}
        <div class="mt-2 pt-2 border-t border-gray-200">
            <div class="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Latest Decisions</div>
            ${latestHtml}
        </div>
        ${undecidedHtml}
        ${erpHtml}
        ${warningHtml}
        ${metricsHtml ? `<div class="mt-3">${metricsHtml}</div>` : ''}
        ${obligationsHtml}
        <div class="mt-3 pt-3 border-t border-[#f47738] flex flex-col gap-2">
            ${decidedCount > 0 ? `<button onclick="window._simClearAllDecisions()" class="gds-btn-secondary px-3 py-1.5 text-sm font-bold w-full text-left">Clear All Decisions</button>` : ''}
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

    // Prefer projected actions (from decisions) when available; fall back to raw actions
    const actions = state.simulationState
        ? (state.simulationState.projectedActions?.length > 0
            ? state.simulationState.projectedActions
            : (state.simulationState.actions || []))
        : [];

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
        successorName: _sankeyDrillDown || null,
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
            const repObl = obls[0];

            // Decision language description (using actionType + obligation context)
            const decisionDescription = buildDecisionDescription(repObl);
            if (decisionDescription) {
                html += `<div class="border-t border-gray-200 p-3 bg-blue-50">
                    <div class="text-[12px] font-bold uppercase text-gray-500 mb-1">Decision</div>
                    <div class="text-xs font-bold text-[#1d70b8]">${escHtml(decisionDescription)}</div>
                </div>`;
            }

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
                    : obl.type === 'data-partition'
                        ? '<span style="background:#4c2c92;color:#fff;font-size:9px;padding:1px 4px;font-weight:bold;">PARTITION</span>'
                        : '';
                const functionCell = obl.type === 'data-partition'
                    ? '<span class="text-gray-500 italic">(all functions)</span>'
                    : escHtml(obl.functionLabel || obl.functionId);
                const rowBg = !obl.resolved ? ' class="bg-white"' : '';
                html += `<tr${rowBg}>
                    <td class="py-1 pr-2"><span style="background:${rowBadgeBg};color:${rowBadgeFg};font-size:9px;padding:1px 4px;font-weight:bold;">${obl.severity.toUpperCase()}</span></td>
                    <td class="py-1 pr-2">${functionCell}</td>
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
// HELPERS
// ===================================================================

/**
 * Builds a human-readable decision-language description for an obligation.
 * Used in the obligation detail modal to replace "Action: consolidate" language.
 *
 * @param {Object} obl  A SimulationObligation
 * @returns {string|null}  Human-readable description or null if no description available
 */
function buildDecisionDescription(obl) {
    const funcLabel = obl.functionLabel || obl.functionId || 'this function';
    const successor = (obl.affectedSuccessors && obl.affectedSuccessors[0]) || null;
    const successorText = successor ? ` for ${successor}` : '';

    switch (obl.actionType) {
        case 'consolidate':
        case 'choose': {
            // "Decision: chose [target system] for [function] ([successor])"
            const targetLabel = obl.toSystem ? obl.toSystem.label : 'selected system';
            return `Decision: chose ${targetLabel} for ${funcLabel}${successorText}`;
        }
        case 'procure-replacement':
        case 'procure': {
            const targetLabel = obl.toSystem ? obl.toSystem.label : 'procured replacement';
            return `Decision: procure ${targetLabel} for ${funcLabel}${successorText}`;
        }
        case 'defer': {
            return `Decision: deferred ${funcLabel}${successorText} — running systems in parallel`;
        }
        case 'disaggregate': {
            const splitTarget = obl.toSystem ? obl.toSystem.label : 'successor instance';
            return `Decision: disaggregate — split into ${splitTarget}${successorText}`;
        }
        case 'split-shared-service': {
            return `Decision: split shared service for ${funcLabel}${successorText}`;
        }
        default:
            return null;
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
let _obligationDetailOpener = null;
let _obligationDetailTrapCleanup = null;

// Decision summary window hooks
window._simExit = exitSimulation;
window._simClearAllDecisions = function() {
    if (!state.simulationState) return;
    state.simulationState.decisions = new Map();
    state.simulationState.projectedActions = [];
    state.simulationState.lastImpact = null;
    recomputeSimulation();
};
window._simToggleActionPanel = function() {
    _actionPanelCollapsed = !_actionPanelCollapsed;
    renderSimulationWorkspace();
};


// Helper hooks for Sankey context menu to access allocation data and function labels
window._simGetAllocationMap = function() {
    if (!state.simulationState) return null;
    return state.simulationState.baselineAllocation || state.successorAllocationMap || null;
};
window._simGetFunctionLabel = function(funcId) {
    if (!state.lgaFunctionMap) return funcId;
    const entry = state.lgaFunctionMap.get(funcId);
    return entry ? entry.label : funcId;
};

// Sankey panel hooks
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
