import { state } from '../state.js';
import { escHtml } from '../ui-helpers.js';
import { applyAllActions } from '../simulation/actions.js';
import { computeSimulationImpact } from '../simulation/impact.js';
import { renderDashboard } from '../main.js';

// ===================================================================
// SIMULATION ENTRY / EXIT
// ===================================================================

export function enterSimulation() {
    state.simulationState = {
        baselineNodes: JSON.parse(JSON.stringify(state.mergedArchitecture.nodes)),
        baselineEdges: JSON.parse(JSON.stringify(state.mergedArchitecture.edges)),
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
// SIMULATION TOOLBAR RENDERING
// ===================================================================

export function renderSimulationToolbar() {
    const toolbar = document.getElementById('simulationToolbar');
    if (!toolbar) return;

    if (!state.simulationState) {
        toolbar.classList.add('hidden');
        toolbar.innerHTML = '';
        return;
    }

    const actions = state.simulationState.actions;
    const impact = state.simulationState.lastImpact;

    let warningHtml = '';
    if (impact && impact.warnings && impact.warnings.length > 0) {
        // Humanize warnings: strip raw ESD IDs like "(3)" or "(159)" that mean nothing to users
        const humanized = impact.warnings.map(w => w.replace(/\s*\(\d+\)\s*/g, ' ').replace(/\s{2,}/g, ' ').trim());
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
                <button onclick="window._simRemoveAction(${idx})" title="Remove this action" aria-label="Remove action">&times;</button>
            </span>`;
        }).join(' ');
    }

    toolbar.innerHTML = `
        <div class="sim-toolbar">
            <span class="sim-mode-banner">Simulation Mode</span>
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                    <span class="text-sm font-bold text-[#0b0c0c]">${actions.length} action${actions.length !== 1 ? 's' : ''} applied</span>
                    <button onclick="window._simOpenActionBuilder()" class="gds-btn text-sm px-3 py-1.5 font-bold">+ Add Action</button>
                    ${actions.length > 0 ? `<button onclick="window._simClearAll()" class="gds-btn-secondary px-3 py-1.5 text-sm font-bold">Clear All</button>` : ''}
                </div>
                <button onclick="window._simExit()" class="gds-btn-secondary px-3 py-1.5 text-sm font-bold border-[#d4351c] text-[#d4351c]">Exit Simulation</button>
            </div>
            <div class="flex flex-wrap gap-2 mb-2">${actionsHtml}</div>
            ${warningHtml}
        </div>
    `;
    toolbar.classList.remove('hidden');
}

// ===================================================================
// BEFORE/AFTER ESTATE SUMMARY METRICS
// ===================================================================

export function renderBeforeAfterMetrics(impact) {
    if (!impact) return '';

    const before = impact.before;
    const after = impact.after;
    const delta = impact.delta;

    function deltaHtml(value, lowerIsBetter) {
        if (value === null || value === 0) return `<span class="sim-delta-neutral">—</span>`;
        const sign = value > 0 ? '+' : '';
        const isGood = lowerIsBetter ? value < 0 : value > 0;
        const cls = isGood ? 'sim-delta-positive' : 'sim-delta-negative';
        const arrow = isGood ? '\u25BC' : '\u25B2'; // ▼ down=good for lowerIsBetter, ▲ up=bad
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

export function openActionBuilder() {
    _actionBuilderStep = 1;
    _actionBuilderType = null;
    const modal = document.getElementById('actionBuilderModal');
    if (!modal) return;
    renderActionBuilderStep1();
    document.getElementById('actionBuilderError').classList.add('hidden');
    modal.classList.remove('hidden');
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
        html += buildSelectField('systemId', 'System to decommission', systems.map(s => ({ value: s.id, label: systemOptionLabel(s) })));
    } else if (type === 'extend-contract') {
        html += buildSelectField('systemId', 'System', systems.map(s => ({ value: s.id, label: systemOptionLabel(s) })));
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
        html += buildSelectField('fromSystemId', 'From System', systemsWithUsers.map(s => ({ value: s.id, label: systemOptionLabel(s) })));
        html += buildSelectField('toSystemId', 'To System', systems.map(s => ({ value: s.id, label: systemOptionLabel(s) })));
        html += `<div>
            <label class="block text-sm font-bold mb-1">User Count to Migrate</label>
            <input type="number" id="field_userCount" min="1" value="100" class="border-2 border-[#0b0c0c] p-2 text-sm w-48">
        </div>`;
    } else if (type === 'split-shared-service') {
        const sharedSystems = systems.filter(s => s.sharedWith && s.sharedWith.length > 0);
        html += buildSelectField('systemId', 'System to split', sharedSystems.length > 0
            ? sharedSystems.map(s => ({ value: s.id, label: systemOptionLabel(s) }))
            : systems.map(s => ({ value: s.id, label: systemOptionLabel(s) }))
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
        html += buildSelectField('replacesSystemId', 'Replaces (optional)',
            [{ value: '', label: 'None — new procurement' }, ...systems.map(s => ({ value: s.id, label: systemOptionLabel(s) }))]
        );
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

    // Further filter by successor if allocation map available
    if (state.simulationState && state.simulationState.lastImpact && state.simulationState.lastImpact.afterAllocation) {
        const afterAlloc = state.simulationState.lastImpact.afterAllocation;
        if (afterAlloc.has(successorName) && afterAlloc.get(successorName).has(funcId)) {
            const allocations = afterAlloc.get(successorName).get(funcId);
            const allocIds = new Set(allocations.map(a => a.system.id));
            relevantSystems = relevantSystems.filter(s => allocIds.has(s.id));
        }
    }

    if (relevantSystems.length === 0) {
        container.innerHTML = buildSelectField('targetSystemId', 'Target System (keep)', [], 'No systems found for this combination');
        return;
    }

    container.innerHTML = buildSelectField('targetSystemId', 'Target System (keep)',
        relevantSystems.map(s => ({ value: s.id, label: systemOptionLabel(s) }))
    );
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
            action = { type: 'consolidate', functionId: funcId, successorName, targetSystemId };

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
                _sourceCouncil: successorName || 'Simulated'
            };
            action = { type: 'procure-replacement', functionId: funcId, successorName, newSystem, replacesSystemId };
        }
    } catch (err) {
        showActionBuilderError('Error building action: ' + err.message);
        return;
    }

    if (!action) return;

    state.simulationState.actions.push(action);
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
            return `Procure ${label} for ${funcLabel}`;
        }
        default:
            return action.type;
    }
}

// ===================================================================
// GLOBAL WINDOW HOOKS (called from inline HTML onclick handlers)
// ===================================================================

// --- Wire action builder modal close/apply buttons ---
const actionBuilderModal = document.getElementById('actionBuilderModal');
if (actionBuilderModal) {
    document.getElementById('btnCloseActionBuilder').addEventListener('click', () => {
        actionBuilderModal.classList.add('hidden');
    });
    document.getElementById('btnCancelAction').addEventListener('click', () => {
        actionBuilderModal.classList.add('hidden');
    });
    document.getElementById('btnApplyAction').addEventListener('click', applyActionFromBuilder);
    actionBuilderModal.addEventListener('click', (e) => {
        if (e.target === actionBuilderModal) actionBuilderModal.classList.add('hidden');
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !actionBuilderModal.classList.contains('hidden')) {
            actionBuilderModal.classList.add('hidden');
        }
    });
}

window._simExit = exitSimulation;
window._simOpenActionBuilder = openActionBuilder;
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
    renderActionBuilderStep1();
};
window._simUpdateConsolidateSystems = updateConsolidateSystems;
window._simAddSplitRow = addSplitRow;
