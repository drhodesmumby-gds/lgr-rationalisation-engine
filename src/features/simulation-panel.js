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
import { importScenario } from './scenario-manager.js';

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

    // Auto-load pending scenario if one was uploaded at Stage 1
    if (state.pendingScenario) {
        try {
            const result = importScenario(JSON.stringify(state.pendingScenario), {
                lgaFunctionMap: state.lgaFunctionMap,
                transitionStructure: state.transitionStructure
            });
            state.simulationState.decisions = result.decisions;
            state.pendingScenario = null;
            recomputeSimulation();
        } catch (e) {
            console.warn('Failed to auto-load pending scenario:', e.message);
            state.pendingScenario = null;
        }
    }
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
let _sankeyDrillDown = null; // successor name for function-level, or null for estate
let _sankeySizeMode = 'count'; // 'count' | 'cost'
let _sankeyCouncilFilter = null; // council name to filter by, or null for all
let _sankeyFunctionFilter = null; // lgaFunctionId to filter by, or null for all
let _sankeyOverlay = 'default'; // 'default' | 'migration' | 'cross-successor' | 'contract'
let _sankeyRenderTarget = null; // the element the Sankey overlay is currently rendering into

/**
 * Main workspace render function. Targets the right-docked #simulationSidePanel.
 * When simulation is inactive: hides the panel.
 * When collapsed: renders a narrow strip with badge and expand button.
 * When expanded: renders a vertical stack with all decision content.
 */
export function renderSimulationWorkspace() {
    const panel = document.getElementById('simulationSidePanel');
    if (!panel) return;

    // Hide any legacy simulationToolbar element if it still exists
    const oldToolbar = document.getElementById('simulationToolbar');
    if (oldToolbar) oldToolbar.classList.add('hidden');

    if (!state.simulationState) {
        panel.classList.add('hidden');
        panel.innerHTML = '';
        return;
    }

    panel.classList.remove('hidden');

    if (state.simPanelCollapsed) {
        panel.classList.add('sim-side-panel-collapsed');
        panel.classList.remove('sim-side-panel-expanded');
        const decisions = state.simulationState.decisions || new Map();
        panel.innerHTML = `
            <div class="sim-side-collapsed-content">
                <button onclick="window._simToggleSidePanel()" class="sim-side-expand-btn" title="Expand panel" aria-label="Expand simulation panel">&#x276E;</button>
                <span class="sim-side-badge">${decisions.size}</span>
                <span class="sim-side-label">Decisions</span>
            </div>
        `;
        return;
    }

    panel.classList.remove('sim-side-panel-collapsed');
    panel.classList.add('sim-side-panel-expanded');

    const impact = state.simulationState.lastImpact;

    // Build the side panel shell: orange header + scrollable content area
    let html = '';
    html += `<div class="bg-[#f47738] text-white px-3 py-2 flex items-center justify-between shrink-0">`;
    html += `<span class="text-sm font-bold uppercase tracking-wide">Simulation</span>`;
    html += `<button onclick="window._simToggleSidePanel()" class="text-white hover:text-gray-200 font-bold text-lg p-1" title="Collapse panel" aria-label="Collapse simulation panel">&#x276F;</button>`;
    html += `</div>`;
    html += `<div class="sim-side-panel-content"></div>`;

    panel.innerHTML = html;

    // Fill the content area using the existing renderDecisionSummary logic
    const contentEl = panel.querySelector('.sim-side-panel-content');
    if (contentEl) {
        renderDecisionSummary(contentEl, impact);
    }
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
    // Check baseline nodes first
    const baseNode = state.simulationState.baselineNodes.find(n => n.id === systemId);
    if (baseNode) return baseNode.label;
    // Check simulated nodes (includes procured systems)
    if (state.simulationState.lastImpact) {
        const simNode = state.simulationState.lastImpact.simulationResult.nodes.find(n => n.id === systemId);
        if (simNode) return simNode.label;
    }
    // Check decisions for procured system labels
    if (state.simulationState.decisions) {
        for (const dec of state.simulationState.decisions.values()) {
            if (dec.procuredSystem && dec.procuredSystem.id === systemId) {
                return dec.procuredSystem.label;
            }
        }
    }
    return systemId;
}

/**
 * Computes a transition cost estimate from simulation state.
 * Returns null if no simulation is active or no costs to report.
 */
export function computeTransitionCosts() {
    if (!state.simulationState) return null;
    const decisions = state.simulationState.decisions;
    if (!decisions || decisions.size === 0) return null;

    const obligations = state.simulationState.lastImpact?.obligations || [];
    const projObligations = obligations; // merged in recomputeSimulation

    let exitCosts = 0;
    let procurementCosts = 0;
    let annualRemoved = 0;
    let annualAdded = 0;

    // From obligations: data-migration type means a system is being removed
    obligations.forEach(obl => {
        if (obl.type === 'data-migration' && obl.fromSystem) {
            exitCosts += obl.fromSystem.annualCost || 0;
            annualRemoved += obl.fromSystem.annualCost || 0;
        }
    });

    // From decisions: procure decisions have upfrontCost and annualCost
    for (const dec of decisions.values()) {
        if (dec.systemChoice === 'procure' && dec.procuredSystem) {
            procurementCosts += dec.procuredSystem.upfrontCost || 0;
            annualAdded += dec.procuredSystem.annualCost || 0;
        }
    }

    // Deferral costs
    let deferralCosts = 0;
    obligations.forEach(obl => {
        if (obl.type === 'deferral-cost') {
            deferralCosts += obl.combinedAnnualCost || 0;
        }
    });

    return {
        exitCosts,
        procurementCosts,
        deferralCosts,
        annualSavings: annualRemoved - annualAdded,
        year1Total: exitCosts + procurementCosts + deferralCosts
    };
}

function formatCostValue(value) {
    if (value === 0) return '0';
    return value.toLocaleString('en-GB');
}

function renderTransitionCostCard() {
    const costs = computeTransitionCosts();
    if (!costs || costs.year1Total === 0 && costs.annualSavings === 0) return '';

    const savingsColour = costs.annualSavings >= 0 ? 'text-[#00703c]' : 'text-[#d4351c]';

    return `<div class="mt-4 p-3 bg-[#f3f2f1] border border-[#b1b4b6]">
        <p class="font-bold text-sm text-[#0b0c0c] mb-2">Transition Cost Estimate</p>
        <div class="text-xs space-y-1">
            <div class="flex justify-between"><span>Exit/migration costs:</span><span class="font-bold">£${formatCostValue(costs.exitCosts)}</span></div>
            <div class="flex justify-between"><span>Procurement (one-off):</span><span class="font-bold">£${formatCostValue(costs.procurementCosts)}</span></div>
            <div class="flex justify-between"><span>Deferral (parallel running):</span><span class="font-bold">£${formatCostValue(costs.deferralCosts)}</span></div>
            <div class="flex justify-between border-t border-[#b1b4b6] pt-1 mt-1"><span class="font-bold">Year 1 total:</span><span class="font-bold text-[#d4351c]">£${formatCostValue(costs.year1Total)}</span></div>
            <div class="flex justify-between"><span>Annual savings (ongoing):</span><span class="font-bold ${savingsColour}">£${formatCostValue(Math.abs(costs.annualSavings))}/yr${costs.annualSavings < 0 ? ' (increase)' : ''}</span></div>
        </div>
    </div>`;
}

/**
 * Renders the decision summary panel into the given element.
 * Replaces the old renderActionPanel / action chip display.
 *
 * @param {HTMLElement} el
 * @param {Object|null} impact
 */
function renderDecisionSummary(el, impact) {
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
            const sharedTag = dec.sharedServiceOrigin
                ? ' <span class="text-[10px] font-bold text-[#0b0c0c]">[Shared]</span>'
                : (dec.sharedWithSuccessors && dec.sharedWithSuccessors.length > 0
                    ? ` <span class="text-[10px] text-gray-400">(shared with ${dec.sharedWithSuccessors.length})</span>`
                    : '');
            const safeFuncId = escHtml(dec.functionId);
            const safeSucc = escHtml(dec.successorName);
            return `<div class="text-xs py-1 border-b border-gray-100 last:border-0 flex items-start gap-1">
                <div class="flex-1">
                    <span class="font-bold">${escHtml(funcLabel)}</span>
                    <span class="text-gray-500"> (${safeSucc})</span>${sharedTag}
                    <span class="block text-gray-700">&rarr; ${escHtml(dLabel)}</span>
                </div>
                <button onclick="window._simOpenDecision('${safeFuncId}', '${safeSucc}')" class="text-gray-400 hover:text-[#1d70b8] p-0.5" title="Edit decision" aria-label="Edit decision for ${escHtml(funcLabel)}">&#9998;</button>
                <button onclick="window._simRemoveDecision('${safeFuncId}', '${safeSucc}')" class="text-gray-400 hover:text-[#d4351c] p-0.5" title="Remove decision" aria-label="Remove decision for ${escHtml(funcLabel)}">&times;</button>
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
            undecidedCells.sort((a, b) => {
                const tierA = state.tierMap ? (state.tierMap.get(a.funcId) || 3) : 3;
                const tierB = state.tierMap ? (state.tierMap.get(b.funcId) || 3) : 3;
                return tierA - tierB; // Tier 1 first
            });
            const SHOW_LIMIT = 10;
            const visible = undecidedCells.slice(0, SHOW_LIMIT);
            const overflow = undecidedCells.length - visible.length;
            const rows = visible.map(cell => {
                const safeFuncId = escHtml(cell.funcId);
                const safeSucc = escHtml(cell.succName);
                const tier = state.tierMap ? (state.tierMap.get(cell.funcId) || 3) : 3;
                const tierBadge = tier === 1 ? '<span class="gds-tag tag-red" style="font-size:9px;padding:1px 4px;">T1</span>'
                    : tier === 2 ? '<span class="gds-tag tag-orange" style="font-size:9px;padding:1px 4px;">T2</span>'
                    : '';
                return `<div class="text-xs py-0.5 border-b border-gray-100 last:border-0 flex items-center justify-between gap-1">
                    <span class="truncate flex items-center gap-1" title="${escHtml(cell.funcLabel)} (${safeSucc})">${tierBadge}${escHtml(cell.funcLabel)} <span class="text-gray-400">(${safeSucc})</span></span>
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
    const costCardHtml = renderTransitionCostCard();

    el.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold uppercase tracking-wide text-[#0b0c0c]">Decisions</span>
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
        ${costCardHtml}
        <div class="mt-3 pt-3 border-t border-[#f47738] flex flex-col gap-2">
            ${!!(state.simulationState?.baselineAllocation || state.successorAllocationMap)
                ? `<button onclick="window._simOpenSankeyOverlay()" class="gds-btn-secondary px-3 py-1.5 text-sm font-bold w-full text-left border-[#1d70b8] text-[#1d70b8]">View flow diagram</button>`
                : ''}
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
            if (_sankeyRenderTarget) {
                renderSankeyPanel(_sankeyRenderTarget);
            } else {
                renderSimulationWorkspace();
            }
        },
        onBack: () => {
            _sankeyDrillDown = null;
            _sankeyCouncilFilter = null;
            _sankeyFunctionFilter = null;
            if (_sankeyRenderTarget) {
                renderSankeyPanel(_sankeyRenderTarget);
            } else {
                renderSimulationWorkspace();
            }
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
        const govCount = resolved.filter(o => o.type === 'shared-service-governance').length;
        const migCount = resolved.length - govCount;
        const parts = [];
        if (migCount > 0) parts.push(`${migCount} migration${migCount !== 1 ? 's' : ''} resolved`);
        if (govCount > 0) parts.push(`${govCount} governance arrangement${govCount !== 1 ? 's' : ''} established`);
        html += `<div class="mt-2 text-xs text-gray-600">${parts.join(', ')}</div>`;
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
let _obligationActiveTab = 'migration';  // 'migration' | 'governance'

function openObligationDetail() {
    _obligationActiveTab = 'migration';  // Reset to migration tab on open
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

    const sevOrder = { high: 0, medium: 1, low: 2 };

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
                    <div class="text-2xl font-bold ${unresolvedCount > 0 ? 'text-[#0b0c0c]' : ''}">${unresolvedCount}</div>
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

    // Governance obligations
    const governanceObls = scored.filter(o => o.type === 'shared-service-governance');
    const migrationObls = scored.filter(o => o.type !== 'shared-service-governance');

    // Tab bar — only show if there are governance obligations
    if (governanceObls.length > 0) {
        const migActive = _obligationActiveTab === 'migration';
        const govActive = _obligationActiveTab === 'governance';
        const activeStyle = 'border-b-2 border-[#1d70b8] text-[#1d70b8] font-bold';
        const inactiveStyle = 'text-gray-500 hover:text-[#0b0c0c]';

        html += `<div class="flex gap-6 border-b border-gray-300 mb-4">
            <button class="pb-2 text-sm ${migActive ? activeStyle : inactiveStyle}"
                    onclick="window._simSwitchObligationTab('migration')">
                Migration Plan (${migrationObls.length})
            </button>
            <button class="pb-2 text-sm ${govActive ? activeStyle : inactiveStyle}"
                    onclick="window._simSwitchObligationTab('governance')">
                Governance (${governanceObls.length})
            </button>
        </div>`;
    }

    // Filter to active tab's obligations
    const visibleObls = (governanceObls.length > 0 && _obligationActiveTab === 'governance')
        ? governanceObls
        : migrationObls;

    if (visibleObls.length === 0) {
        html += `<div class="p-6 text-center text-sm text-gray-500 italic">No ${_obligationActiveTab === 'governance' ? 'governance' : 'migration'} obligations generated by current decisions.</div>`;
    }

    // Per-source-system groups (filtered to active tab)
    const groups = new Map();
    visibleObls.forEach(obl => {
        const sysId = obl.fromSystem.id;
        if (!groups.has(sysId)) groups.set(sysId, []);
        groups.get(sysId).push(obl);
    });

    // Sort groups: cross-successor first, then highest severity, then alphabetical by system label
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

            // 2. Scope bullets (once, from first obligation)
            const bullets = generateMigrationScopeBullets(obls[0]);
            if (bullets.length > 0) {
                const scopeHeading = obls[0].type === 'shared-service-governance' ? 'Governance scope' : 'Migration scope';
                html += `<div class="border-t border-gray-200 p-3">
                    <div class="text-[12px] font-bold uppercase text-gray-500 mb-1">${scopeHeading}</div>
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
                        : obl.type === 'shared-service-governance'
                            ? '<span style="background:#1d70b8;color:#fff;font-size:9px;padding:1px 4px;font-weight:bold;">GOVERN</span>'
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
        case 'establish-shared-service': {
            const targetLabel = obl.toSystem ? obl.toSystem.label : 'selected system';
            return `Decision: establish ${targetLabel} as shared service for ${funcLabel}${successorText}`;
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
// SANKEY OVERLAY MODAL
// ===================================================================

let _sankeyOverlayOpener = null;

function openSankeyOverlay() {
    const modal = document.getElementById('sankeyOverlayModal');
    if (!modal) return;
    _sankeyOverlayOpener = document.activeElement;
    modal.classList.remove('hidden');

    // Render Sankey into the overlay content
    const content = document.getElementById('sankeyOverlayContent');
    if (content) {
        _sankeyRenderTarget = content;
        renderSankeyPanel(content);
    }

    // Focus the close button
    document.getElementById('btnCloseSankeyOverlay')?.focus();
}

function closeSankeyOverlay() {
    const modal = document.getElementById('sankeyOverlayModal');
    if (!modal) return;
    modal.classList.add('hidden');

    // Clear content and render target
    const content = document.getElementById('sankeyOverlayContent');
    if (content) content.innerHTML = '';
    _sankeyRenderTarget = null;

    // Return focus to opener
    if (_sankeyOverlayOpener && typeof _sankeyOverlayOpener.focus === 'function') {
        _sankeyOverlayOpener.focus();
    }
    _sankeyOverlayOpener = null;
}

// Wire Sankey overlay close handlers
const sankeyOverlayModal = document.getElementById('sankeyOverlayModal');
if (sankeyOverlayModal) {
    document.getElementById('btnCloseSankeyOverlay')?.addEventListener('click', closeSankeyOverlay);
    sankeyOverlayModal.addEventListener('click', (e) => {
        if (e.target === sankeyOverlayModal) closeSankeyOverlay();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!sankeyOverlayModal.classList.contains('hidden')) {
                e.preventDefault();
                closeSankeyOverlay();
            }
        }
    });
}

// ===================================================================
// GLOBAL WINDOW HOOKS (called from inline HTML onclick handlers)
// ===================================================================

// Track opener elements for focus return
let _obligationDetailOpener = null;
let _obligationDetailTrapCleanup = null;

// Sankey overlay window hook
window._simOpenSankeyOverlay = openSankeyOverlay;

// Decision summary window hooks
window._simExit = exitSimulation;
window._simRemoveDecision = function(functionId, successorName) {
    if (!state.simulationState || !state.simulationState.decisions) return;
    const key = `${functionId}::${successorName}`;
    const dec = state.simulationState.decisions.get(key);
    if (!dec) return;
    // Also remove propagated shared-service decisions if this was the primary
    if (dec.sharedWithSuccessors && dec.sharedWithSuccessors.length > 0) {
        dec.sharedWithSuccessors.forEach(otherSucc => {
            const propKey = `${functionId}::${otherSucc}`;
            const propDec = state.simulationState.decisions.get(propKey);
            if (propDec && propDec.sharedServiceOrigin) {
                state.simulationState.decisions.delete(propKey);
            }
        });
    }
    state.simulationState.decisions.delete(key);
    recomputeSimulation();
};
window._simClearAllDecisions = function() {
    if (!state.simulationState) return;
    state.simulationState.decisions = new Map();
    state.simulationState.projectedActions = [];
    state.simulationState.lastImpact = null;
    recomputeSimulation();
};
window._simToggleSidePanel = function() {
    state.simPanelCollapsed = !state.simPanelCollapsed;
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
    if (_sankeyRenderTarget) renderSankeyPanel(_sankeyRenderTarget);
};
window._simSankeySetSize = function(mode) {
    _sankeySizeMode = mode;
    if (_sankeyRenderTarget) renderSankeyPanel(_sankeyRenderTarget);
};
window._simSankeyFilterCouncil = function(council) {
    _sankeyCouncilFilter = council || null;
    if (_sankeyRenderTarget) renderSankeyPanel(_sankeyRenderTarget);
};
window._simSankeyFilterFunction = function(funcId) {
    _sankeyFunctionFilter = funcId || null;
    if (_sankeyRenderTarget) renderSankeyPanel(_sankeyRenderTarget);
};
window._simSankeySetOverlay = function(overlay) {
    _sankeyOverlay = overlay || 'default';
    if (_sankeyRenderTarget) renderSankeyPanel(_sankeyRenderTarget);
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
window._simSwitchObligationTab = function(tab) {
    _obligationActiveTab = tab;
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
