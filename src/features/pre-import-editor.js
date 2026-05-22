/**
 * pre-import-editor.js
 *
 * Full-page tabbed editor for fixing JSON architecture files before import.
 * Invoked from the validation panel after a user clicks "Open in Editor".
 *
 * Exports:
 *   renderPreImportEditor(json) — returns HTML string
 *   wirePreImportEditor(json, onImport, onBack) — attaches event handlers
 */

import { SCHEMA_DEFINITIONS } from '../constants/schema-definitions.js';
import { LGA_FUNCTIONS } from '../constants/lga-functions.js';
import { getRootCategoryId } from '../taxonomy.js';
import { validateArchitecture } from './schema-validator.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function getEnumFor(fieldName) {
    const fields = SCHEMA_DEFINITIONS.architecture.nodeTypes.ITSystem.fields;
    const field = fields.find(f => f.name === fieldName);
    return (field && field.enum) ? field.enum : [];
}

function getTierOptions() {
    const tierField = SCHEMA_DEFINITIONS.architecture.topLevel
        .find(f => f.name === 'councilMetadata');
    if (tierField && tierField.fields) {
        const tf = tierField.fields.find(f => f.name === 'tier');
        return (tf && tf.enum) ? tf.enum : ['county', 'district', 'borough', 'unitary'];
    }
    return ['county', 'district', 'borough', 'unitary'];
}

const LGA_ID_SET = new Set(LGA_FUNCTIONS.map(f => f.id));

function lgaStatusIcon(lgaFunctionId) {
    if (!lgaFunctionId) return '<span class="text-[#d4351c] font-bold">✗</span>';
    return LGA_ID_SET.has(String(lgaFunctionId))
        ? '<span class="text-[#00703c] font-bold">✓</span>'
        : '<span class="text-[#d4351c] font-bold">✗</span>';
}

function systemStatusIcon(node) {
    const ok = node.label && node.label.trim() && node.vendor && node.vendor.trim();
    return ok
        ? '<span class="text-[#00703c] font-bold">✓</span>'
        : '<span class="text-[#d4351c] font-bold">✗</span>';
}

function generateId(prefix) {
    return prefix + '-' + Math.random().toString(36).slice(2, 9);
}

// ---------------------------------------------------------------------------
// renderPreImportEditor
// ---------------------------------------------------------------------------

export function renderPreImportEditor(json) {
    const nodes = Array.isArray(json.nodes) ? json.nodes : [];
    const edges = Array.isArray(json.edges) ? json.edges : [];
    const functions = nodes.filter(n => n.type === 'Function');
    const systems = nodes.filter(n => n.type === 'ITSystem');
    const deps = edges.filter(e => e.relationship === 'CONSUMES_CAPABILITY');

    return `
<div id="preImportEditorView" class="w-full px-4 md:px-8">
    <button id="btnBackFromEditor" class="text-[#1d70b8] underline font-bold text-sm mb-5 block">← Back to validator</button>
    <h2 class="text-2xl font-bold mb-1">Edit Architecture File</h2>
    <p class="text-sm text-gray-600 mb-6">Edit the data below, then re-validate or import directly to the engine.</p>

    <!-- Tab bar -->
    <div class="border-b border-gray-300 mb-6 flex gap-0">
        <button class="pre-import-tab-btn border-b-4 border-[#1d70b8] px-5 py-2 font-bold text-sm bg-white" data-tab="council">Council Info</button>
        <button class="pre-import-tab-btn border-b-4 border-transparent px-5 py-2 font-bold text-sm text-gray-600 bg-white hover:border-gray-400" data-tab="functions">Functions (${functions.length})</button>
        <button class="pre-import-tab-btn border-b-4 border-transparent px-5 py-2 font-bold text-sm text-gray-600 bg-white hover:border-gray-400" data-tab="systems">Systems (${systems.length})</button>
        <button class="pre-import-tab-btn border-b-4 border-transparent px-5 py-2 font-bold text-sm text-gray-600 bg-white hover:border-gray-400" data-tab="dependencies">Dependencies (${deps.length})</button>
    </div>

    <!-- Tab panels -->
    <div id="preImportTabCouncil">${buildCouncilTabHtml(json)}</div>
    <div id="preImportTabFunctions" class="hidden">${buildFunctionsTabHtml(nodes)}</div>
    <div id="preImportTabSystems" class="hidden">${buildSystemsTabHtml(nodes, edges)}</div>
    <div id="preImportTabDependencies" class="hidden">${buildDependenciesTabHtml(nodes, edges)}</div>

    <!-- Datalist for LGA functions -->
    <datalist id="lgaFunctionsEditorDatalist">
        ${LGA_FUNCTIONS.map(f => `<option value="${escHtml(f.id)}" label="${escHtml(f.label)}">`).join('')}
    </datalist>

    <!-- Revalidation result banner -->
    <div id="preImportRevalidateBanner" class="hidden mt-4"></div>

    <!-- Footer actions -->
    <div class="mt-8 pt-5 border-t border-gray-300 flex flex-wrap gap-3 items-center">
        <button id="btnEditorRevalidate" class="gds-btn-secondary px-4 py-2 text-sm font-bold">Re-validate</button>
        <button id="btnEditorExport" class="gds-btn-secondary px-4 py-2 text-sm font-bold">Export JSON</button>
        <button id="btnEditorImport" class="gds-btn px-4 py-2 text-sm font-bold">Import to Engine</button>
    </div>
</div>`;
}

// ---------------------------------------------------------------------------
// Tab HTML builders (called at render time and on re-render)
// ---------------------------------------------------------------------------

function buildCouncilTabHtml(json) {
    const meta = json.councilMetadata || {};
    const tier = meta.tier || '';
    const distress = meta.financialDistress === true;
    const tiers = getTierOptions();

    return `
<div class="max-w-lg space-y-6">
    <div>
        <label for="editorCouncilName" class="block font-bold text-sm mb-1">Council Name</label>
        <input id="editorCouncilName" type="text" class="border-2 border-[#0b0c0c] p-2 text-base w-full"
            value="${escHtml(json.councilName || '')}">
    </div>
    <div>
        <label for="editorCouncilTier" class="block font-bold text-sm mb-1">Tier</label>
        <select id="editorCouncilTier" class="border-2 border-[#0b0c0c] p-2 text-base">
            <option value="">-- not set --</option>
            ${tiers.map(t => `<option value="${t}"${tier === t ? ' selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}
        </select>
    </div>
    <div>
        <label for="editorFinancialDistress" class="block font-bold text-sm mb-1">Financial Distress</label>
        <select id="editorFinancialDistress" class="border-2 border-[#0b0c0c] p-2 text-base">
            <option value="false"${!distress ? ' selected' : ''}>No</option>
            <option value="true"${distress ? ' selected' : ''}>Yes</option>
        </select>
    </div>
</div>`;
}

function buildFunctionsTabHtml(nodes) {
    const functions = nodes.filter(n => n.type === 'Function');
    const rows = functions.map((fn, i) => {
        const globalIdx = nodes.indexOf(fn);
        return `
<tr data-index="${globalIdx}" class="border-b border-gray-200 hover:bg-gray-50">
    <td class="px-3 py-2 font-mono text-xs text-gray-500">${escHtml(fn.id || '')}</td>
    <td class="px-3 py-2">
        <input type="text" class="editor-fn-label border border-gray-300 p-1 text-sm w-full"
            value="${escHtml(fn.label || '')}" data-node-idx="${globalIdx}" data-field="label"
            placeholder="Function label">
    </td>
    <td class="px-3 py-2">
        <input type="text" list="lgaFunctionsEditorDatalist"
            class="editor-fn-lgaid border border-gray-300 p-1 text-sm w-36"
            value="${escHtml(fn.lgaFunctionId || '')}" data-node-idx="${globalIdx}" data-field="lgaFunctionId"
            placeholder="e.g. 148">
    </td>
    <td class="px-3 py-2 text-center">${lgaStatusIcon(fn.lgaFunctionId)}</td>
    <td class="px-3 py-2 text-center">
        <button class="editor-delete-fn text-[#d4351c] font-bold text-xs px-1 hover:underline"
            data-node-idx="${globalIdx}" title="Delete row">✕</button>
    </td>
</tr>`;
    }).join('');

    return `
<div>
    <div class="overflow-x-auto">
        <table class="w-full text-sm border border-gray-200" id="fnTable">
            <thead class="bg-gray-100 text-left">
                <tr>
                    <th class="px-3 py-2 text-xs font-bold text-gray-700 w-24">ID</th>
                    <th class="px-3 py-2 text-xs font-bold text-gray-700">Label</th>
                    <th class="px-3 py-2 text-xs font-bold text-gray-700 w-40">LGA Function ID</th>
                    <th class="px-3 py-2 text-xs font-bold text-gray-700 w-16 text-center">Valid</th>
                    <th class="px-3 py-2 w-10"></th>
                </tr>
            </thead>
            <tbody id="fnTableBody">${rows}</tbody>
        </table>
    </div>
    <button id="btnAddFunction" class="gds-btn-secondary mt-4 px-3 py-1.5 text-sm font-bold">+ Add Function</button>
</div>`;
}

function buildSystemsTabHtml(nodes, edges) {
    const systems = nodes.filter(n => n.type === 'ITSystem');
    const portabilityOpts = getEnumFor('portability');
    const supportOpts = getEnumFor('supportModel');

    const functions = nodes.filter(n => n.type === 'Function');

    // Group systems by root ESD category of their realized function
    const groups = new Map();
    const unassigned = [];
    for (const sys of systems) {
        const realizedEdge = edges.find(e => e.relationship === 'REALIZES' && e.source === sys.id);
        if (realizedEdge) {
            const fn = functions.find(f => f.id === realizedEdge.target);
            const lgaId = fn && fn.lgaFunctionId;
            let rootLabel = 'Other';
            if (lgaId) {
                const rootId = getRootCategoryId(lgaId);
                if (rootId) {
                    const rootFn = LGA_FUNCTIONS.find(f => f.id === rootId);
                    rootLabel = rootFn ? rootFn.label : 'Other';
                }
            }
            if (!groups.has(rootLabel)) groups.set(rootLabel, []);
            groups.get(rootLabel).push(sys);
        } else {
            unassigned.push(sys);
        }
    }
    if (unassigned.length > 0) groups.set('Unassigned (no function)', unassigned);


    // Build grouped HTML with collapsible sections
    const theadHtml = `<thead class="bg-gray-100 text-left">
        <tr>
            <th class="px-2 py-2 font-bold text-gray-700">Label</th>
            <th class="px-2 py-2 font-bold text-gray-700">Vendor</th>
            <th class="px-2 py-2 font-bold text-gray-700 w-20">Users</th>
            <th class="px-2 py-2 font-bold text-gray-700 w-24">Annual Cost (£)</th>
            <th class="px-2 py-2 font-bold text-gray-700 w-24">Portability</th>
            <th class="px-2 py-2 font-bold text-gray-700 w-16">Cloud</th>
            <th class="px-2 py-2 font-bold text-gray-700 w-36">Support Model</th>
            <th class="px-2 py-2 font-bold text-gray-700 w-36">Serves Function</th>
            <th class="px-2 py-2 font-bold text-gray-700 w-14 text-center">Valid</th>
            <th class="px-2 py-2 w-8"></th>
        </tr>
    </thead>`;

    let groupedHtml = '';
    for (const [groupLabel, groupSystems] of groups) {
        const groupRows = groupSystems.map(sys => {
            const globalIdx = nodes.indexOf(sys);
            const portSel = portabilityOpts.map(p =>
                `<option value="${p}"${sys.portability === p ? ' selected' : ''}>${p}</option>`
            ).join('');
            const supportSel = supportOpts.map(s =>
                `<option value="${s}"${sys.supportModel === s ? ' selected' : ''}>${s}</option>`
            ).join('');
            const realizedFnIds = edges
                .filter(e => e.relationship === 'REALIZES' && e.source === sys.id)
                .map(e => e.target);
            const fnOptions = functions.map(fn =>
                `<option value="${fn.id}"${realizedFnIds.includes(fn.id) ? ' selected' : ''}>${escHtml(fn.label || fn.lgaFunctionId || fn.id)}</option>`
            ).join('');

            return `<tr data-index="${globalIdx}" class="border-b border-gray-200 hover:bg-gray-50">
    <td class="px-2 py-1.5"><input type="text" class="editor-sys-field border border-gray-300 p-1 text-xs w-32" value="${escHtml(sys.label || '')}" data-node-idx="${globalIdx}" data-field="label"></td>
    <td class="px-2 py-1.5"><input type="text" class="editor-sys-field border border-gray-300 p-1 text-xs w-28" value="${escHtml(sys.vendor || '')}" data-node-idx="${globalIdx}" data-field="vendor"></td>
    <td class="px-2 py-1.5"><input type="number" class="editor-sys-field border border-gray-300 p-1 text-xs w-20" value="${sys.users != null ? sys.users : ''}" data-node-idx="${globalIdx}" data-field="users" min="0"></td>
    <td class="px-2 py-1.5"><input type="number" class="editor-sys-field border border-gray-300 p-1 text-xs w-24" value="${sys.annualCost != null ? sys.annualCost : ''}" data-node-idx="${globalIdx}" data-field="annualCost" min="0"></td>
    <td class="px-2 py-1.5"><select class="editor-sys-field border border-gray-300 p-1 text-xs" data-node-idx="${globalIdx}" data-field="portability"><option value="">--</option>${portSel}</select></td>
    <td class="px-2 py-1.5"><select class="editor-sys-field border border-gray-300 p-1 text-xs" data-node-idx="${globalIdx}" data-field="isCloud"><option value="">--</option><option value="true"${sys.isCloud === true ? ' selected' : ''}>Yes</option><option value="false"${sys.isCloud === false ? ' selected' : ''}>No</option></select></td>
    <td class="px-2 py-1.5"><select class="editor-sys-field border border-gray-300 p-1 text-xs" data-node-idx="${globalIdx}" data-field="supportModel"><option value="">--</option>${supportSel}</select></td>
    <td class="px-2 py-1.5"><select class="editor-sys-realizes border border-gray-300 p-1 text-xs w-36" data-node-idx="${globalIdx}" data-sys-id="${sys.id}"><option value="">-- none --</option>${fnOptions}</select></td>
    <td class="px-2 py-1.5 text-center" data-status-idx="${globalIdx}">${systemStatusIcon(sys)}</td>
    <td class="px-2 py-1.5 text-center"><button class="editor-delete-sys text-[#d4351c] font-bold text-xs px-1 hover:underline" data-node-idx="${globalIdx}">✕</button></td>
</tr>`;
        }).join('');

        groupedHtml += `<details open class="mb-2 border border-gray-200">
            <summary class="cursor-pointer px-3 py-2 bg-gray-50 font-bold text-sm select-none hover:bg-gray-100">${escHtml(groupLabel)} <span class="text-gray-400 font-normal">(${groupSystems.length})</span></summary>
            <div class="overflow-x-auto">
                <table class="w-full text-xs">${theadHtml}<tbody class="sysGroupBody">${groupRows}</tbody></table>
            </div>
        </details>`;
    }

    return `
<div>
    <div class="flex items-center gap-3 mb-3">
        <button id="btnRefreshGroups" class="text-[#1d70b8] underline text-xs font-bold">↻ Refresh grouping</button>
        <span class="text-xs text-gray-400">Re-sorts systems into domain groups after function changes</span>
    </div>
    ${groupedHtml}
    <button id="btnAddSystem" class="gds-btn-secondary mt-4 px-3 py-1.5 text-sm font-bold">+ Add System</button>
</div>`;
}

function buildDependenciesTabHtml(nodes, edges) {
    const systems = nodes.filter(n => n.type === 'ITSystem');
    const deps = edges.filter(e => e.relationship === 'CONSUMES_CAPABILITY');

    const sysOptionsHtml = systems.map(s =>
        `<option value="${escHtml(s.id)}">${escHtml(s.label || s.id)}</option>`
    ).join('');

    const rows = deps.map((dep, i) => {
        const globalIdx = edges.indexOf(dep);
        const caps = Array.isArray(dep.capabilities) ? dep.capabilities.join(', ') : '';
        return `
<tr data-edge-index="${globalIdx}" class="border-b border-gray-200 hover:bg-gray-50">
    <td class="px-3 py-2">
        <select class="editor-dep-field border border-gray-300 p-1 text-sm w-full"
            data-edge-idx="${globalIdx}" data-field="source">
            <option value="">-- select system --</option>
            ${sysOptionsHtml.replace(`value="${escHtml(dep.source)}"`, `value="${escHtml(dep.source)}" selected`)}
        </select>
    </td>
    <td class="px-3 py-2">
        <select class="editor-dep-field border border-gray-300 p-1 text-sm w-full"
            data-edge-idx="${globalIdx}" data-field="target">
            <option value="">-- select system --</option>
            ${sysOptionsHtml.replace(`value="${escHtml(dep.target)}"`, `value="${escHtml(dep.target)}" selected`)}
        </select>
    </td>
    <td class="px-3 py-2">
        <input type="text" class="editor-dep-field border border-gray-300 p-1 text-sm w-full"
            value="${escHtml(caps)}" data-edge-idx="${globalIdx}" data-field="capabilities"
            placeholder="e.g. payments, workflow">
    </td>
    <td class="px-3 py-2 text-center">
        <button class="editor-delete-dep text-[#d4351c] font-bold text-xs px-1 hover:underline"
            data-edge-idx="${globalIdx}" title="Delete row">✕</button>
    </td>
</tr>`;
    }).join('');

    return `
<div>
    <p class="text-sm text-gray-600 mb-4">CONSUMES_CAPABILITY edges — where one system depends on a capability provided by another. REALIZES edges are preserved automatically.</p>
    <div class="overflow-x-auto">
        <table class="w-full text-sm border border-gray-200" id="depTable">
            <thead class="bg-gray-100 text-left">
                <tr>
                    <th class="px-3 py-2 text-xs font-bold text-gray-700 w-1/3">Source System (consuming)</th>
                    <th class="px-3 py-2 text-xs font-bold text-gray-700 w-1/3">Target System (providing)</th>
                    <th class="px-3 py-2 text-xs font-bold text-gray-700">Capabilities (comma-separated)</th>
                    <th class="px-3 py-2 w-10"></th>
                </tr>
            </thead>
            <tbody id="depTableBody">${rows}</tbody>
        </table>
    </div>
    <button id="btnAddDependency" class="gds-btn-secondary mt-4 px-3 py-1.5 text-sm font-bold">+ Add Dependency</button>
</div>`;
}

// ---------------------------------------------------------------------------
// wirePreImportEditor
// ---------------------------------------------------------------------------

export function wirePreImportEditor(json, onImport, onBack) {
    // Deep clone — this is the mutable working copy
    let editorState = JSON.parse(JSON.stringify(json));
    if (!Array.isArray(editorState.nodes)) editorState.nodes = [];
    if (!Array.isArray(editorState.edges)) editorState.edges = [];
    if (!editorState.councilMetadata) editorState.councilMetadata = {};

    // ------------------------------------------------------------------
    // Back button
    // ------------------------------------------------------------------
    const btnBack = document.getElementById('btnBackFromEditor');
    if (btnBack) btnBack.addEventListener('click', () => onBack());

    // ------------------------------------------------------------------
    // Tab switching
    // ------------------------------------------------------------------
    const tabPanels = {
        council: document.getElementById('preImportTabCouncil'),
        functions: document.getElementById('preImportTabFunctions'),
        systems: document.getElementById('preImportTabSystems'),
        dependencies: document.getElementById('preImportTabDependencies'),
    };

    function activateTab(tabName) {
        document.querySelectorAll('.pre-import-tab-btn').forEach(btn => {
            const isActive = btn.getAttribute('data-tab') === tabName;
            btn.classList.toggle('border-[#1d70b8]', isActive);
            btn.classList.toggle('border-transparent', !isActive);
            btn.classList.toggle('text-gray-600', !isActive);
            btn.classList.toggle('font-bold', true);
        });
        Object.entries(tabPanels).forEach(([name, el]) => {
            if (el) el.classList.toggle('hidden', name !== tabName);
        });
    }

    document.querySelectorAll('.pre-import-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => activateTab(btn.getAttribute('data-tab')));
    });

    // ------------------------------------------------------------------
    // Council tab — live updates
    // ------------------------------------------------------------------
    const councilNameEl = document.getElementById('editorCouncilName');
    const councilTierEl = document.getElementById('editorCouncilTier');
    const financialDistressEl = document.getElementById('editorFinancialDistress');

    if (councilNameEl) {
        councilNameEl.addEventListener('input', () => {
            editorState.councilName = councilNameEl.value;
        });
    }
    if (councilTierEl) {
        councilTierEl.addEventListener('change', () => {
            editorState.councilMetadata.tier = councilTierEl.value || undefined;
        });
    }
    if (financialDistressEl) {
        financialDistressEl.addEventListener('change', () => {
            editorState.councilMetadata.financialDistress = financialDistressEl.value === 'true';
        });
    }

    // ------------------------------------------------------------------
    // Functions tab — delegate events
    // ------------------------------------------------------------------
    const fnBody = document.getElementById('fnTableBody');
    if (fnBody) {
        fnBody.addEventListener('input', (e) => {
            const target = e.target;
            if (!target.dataset.nodeIdx) return;
            const idx = parseInt(target.dataset.nodeIdx, 10);
            const field = target.dataset.field;
            editorState.nodes[idx][field] = target.value;
            // Update status icon
            const row = target.closest('tr');
            if (row && field === 'lgaFunctionId') {
                const statusCell = row.querySelector('td:nth-child(4)');
                if (statusCell) statusCell.innerHTML = lgaStatusIcon(target.value);
            }
        });

        fnBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('editor-delete-fn')) {
                const idx = parseInt(e.target.dataset.nodeIdx, 10);
                editorState.nodes.splice(idx, 1);
                rerenderFunctions();
            }
        });
    }

    document.getElementById('btnAddFunction')?.addEventListener('click', () => {
        editorState.nodes.push({
            id: generateId('fn'),
            label: '',
            type: 'Function',
            lgaFunctionId: ''
        });
        rerenderFunctions();
    });

    function rerenderFunctions() {
        const panel = document.getElementById('preImportTabFunctions');
        if (!panel) return;
        panel.innerHTML = buildFunctionsTabHtml(editorState.nodes);
        // Re-attach events for the new content
        const newBody = document.getElementById('fnTableBody');
        if (newBody) {
            newBody.addEventListener('input', (e) => {
                const target = e.target;
                if (!target.dataset.nodeIdx) return;
                const idx = parseInt(target.dataset.nodeIdx, 10);
                const field = target.dataset.field;
                editorState.nodes[idx][field] = target.value;
                const row = target.closest('tr');
                if (row && field === 'lgaFunctionId') {
                    const statusCell = row.querySelector('td:nth-child(4)');
                    if (statusCell) statusCell.innerHTML = lgaStatusIcon(target.value);
                }
            });
            newBody.addEventListener('click', (e) => {
                if (e.target.classList.contains('editor-delete-fn')) {
                    const idx = parseInt(e.target.dataset.nodeIdx, 10);
                    editorState.nodes.splice(idx, 1);
                    rerenderFunctions();
                }
            });
        }
        document.getElementById('btnAddFunction')?.addEventListener('click', () => {
            editorState.nodes.push({ id: generateId('fn'), label: '', type: 'Function', lgaFunctionId: '' });
            rerenderFunctions();
        });
        updateTabCounts();
    }

    // ------------------------------------------------------------------
    // Systems tab — delegate events
    // ------------------------------------------------------------------
    const sysBody = document.getElementById('preImportTabSystems');
    if (sysBody) {
        sysBody.addEventListener('input', (e) => {
            const target = e.target;
            if (!target.dataset.nodeIdx) return;
            const idx = parseInt(target.dataset.nodeIdx, 10);
            const field = target.dataset.field;
            const raw = target.value;
            if (field === 'users' || field === 'annualCost') {
                editorState.nodes[idx][field] = raw === '' ? undefined : Number(raw);
            } else if (field === 'isCloud') {
                editorState.nodes[idx][field] = raw === '' ? undefined : (raw === 'true');
            } else {
                editorState.nodes[idx][field] = raw;
            }
            // Refresh status icon
            const row = target.closest('tr');
            if (row) {
                const statusCell = row.querySelector('[data-status-idx]');
                if (statusCell) statusCell.innerHTML = systemStatusIcon(editorState.nodes[idx]);
            }
        });

        sysBody.addEventListener('change', (e) => {
            const target = e.target;
            if (!target.dataset.nodeIdx) return;
            const idx = parseInt(target.dataset.nodeIdx, 10);
            const field = target.dataset.field;
            const raw = target.value;
            if (field === 'isCloud') {
                editorState.nodes[idx][field] = raw === '' ? undefined : (raw === 'true');
            } else {
                editorState.nodes[idx][field] = raw || undefined;
            }
            const row = target.closest('tr');
            if (row) {
                const statusCell = row.querySelector('[data-status-idx]');
                if (statusCell) statusCell.innerHTML = systemStatusIcon(editorState.nodes[idx]);
            }
        });

        sysBody.addEventListener('change', (e) => {
            if (e.target.classList.contains('editor-sys-realizes')) {
                const sysId = e.target.dataset.sysId;
                const fnId = e.target.value;
                editorState.edges = editorState.edges.filter(
                    edge => !(edge.relationship === 'REALIZES' && edge.source === sysId)
                );
                if (fnId) {
                    editorState.edges.push({ source: sysId, target: fnId, relationship: 'REALIZES' });
                }
            }
        });

        sysBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('editor-delete-sys')) {
                const idx = parseInt(e.target.dataset.nodeIdx, 10);
                // Remove any edges that reference this node's id
                const removedId = editorState.nodes[idx] && editorState.nodes[idx].id;
                editorState.nodes.splice(idx, 1);
                if (removedId) {
                    editorState.edges = editorState.edges.filter(
                        e => e.source !== removedId && e.target !== removedId
                    );
                }
                rerenderSystems();
            }
        });
    }

    document.getElementById('btnAddSystem')?.addEventListener('click', () => {
        editorState.nodes.push({
            id: generateId('sys'),
            label: '',
            type: 'ITSystem',
            vendor: ''
        });
        rerenderSystems();
    });

    function rerenderSystems() {
        const panel = document.getElementById('preImportTabSystems');
        if (!panel) return;
        panel.innerHTML = buildSystemsTabHtml(editorState.nodes, editorState.edges);
        updateTabCounts();
        rerenderDependencies();
    }

    // Add System and Refresh buttons (delegated from panel)
    sysBody.addEventListener('click', (e) => {
        if (e.target.id === 'btnAddSystem') {
            editorState.nodes.push({ id: generateId('sys'), label: '', type: 'ITSystem', vendor: '' });
            rerenderSystems();
        }
        if (e.target.id === 'btnRefreshGroups') {
            rerenderSystems();
        }
    });

    // ------------------------------------------------------------------
    // Dependencies tab — delegate events
    // ------------------------------------------------------------------
    const depBody = document.getElementById('depTableBody');
    if (depBody) {
        depBody.addEventListener('change', (e) => {
            const target = e.target;
            if (!target.dataset.edgeIdx) return;
            const idx = parseInt(target.dataset.edgeIdx, 10);
            const field = target.dataset.field;
            editorState.edges[idx][field] = target.value;
        });

        depBody.addEventListener('input', (e) => {
            const target = e.target;
            if (!target.dataset.edgeIdx) return;
            const idx = parseInt(target.dataset.edgeIdx, 10);
            const field = target.dataset.field;
            if (field === 'capabilities') {
                editorState.edges[idx].capabilities = target.value
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);
            } else {
                editorState.edges[idx][field] = target.value;
            }
        });

        depBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('editor-delete-dep')) {
                const idx = parseInt(e.target.dataset.edgeIdx, 10);
                editorState.edges.splice(idx, 1);
                rerenderDependencies();
            }
        });
    }

    document.getElementById('btnAddDependency')?.addEventListener('click', () => {
        editorState.edges.push({
            source: '',
            target: '',
            relationship: 'CONSUMES_CAPABILITY',
            capabilities: []
        });
        rerenderDependencies();
    });

    function rerenderDependencies() {
        const panel = document.getElementById('preImportTabDependencies');
        if (!panel) return;
        panel.innerHTML = buildDependenciesTabHtml(editorState.nodes, editorState.edges);
        const newBody = document.getElementById('depTableBody');
        if (newBody) {
            newBody.addEventListener('change', (e) => {
                const target = e.target;
                if (!target.dataset.edgeIdx) return;
                const idx = parseInt(target.dataset.edgeIdx, 10);
                editorState.edges[idx][target.dataset.field] = target.value;
            });
            newBody.addEventListener('input', (e) => {
                const target = e.target;
                if (!target.dataset.edgeIdx) return;
                const idx = parseInt(target.dataset.edgeIdx, 10);
                const field = target.dataset.field;
                if (field === 'capabilities') {
                    editorState.edges[idx].capabilities = target.value.split(',').map(s => s.trim()).filter(Boolean);
                } else {
                    editorState.edges[idx][field] = target.value;
                }
            });
            newBody.addEventListener('click', (e) => {
                if (e.target.classList.contains('editor-delete-dep')) {
                    const idx = parseInt(e.target.dataset.edgeIdx, 10);
                    editorState.edges.splice(idx, 1);
                    rerenderDependencies();
                }
            });
        }
        document.getElementById('btnAddDependency')?.addEventListener('click', () => {
            editorState.edges.push({ source: '', target: '', relationship: 'CONSUMES_CAPABILITY', capabilities: [] });
            rerenderDependencies();
        });
        updateTabCounts();
    }

    // ------------------------------------------------------------------
    // Update tab counts (after add/delete)
    // ------------------------------------------------------------------
    function updateTabCounts() {
        const fns = editorState.nodes.filter(n => n.type === 'Function').length;
        const sys = editorState.nodes.filter(n => n.type === 'ITSystem').length;
        const dep = editorState.edges.filter(e => e.relationship === 'CONSUMES_CAPABILITY').length;
        document.querySelectorAll('.pre-import-tab-btn').forEach(btn => {
            const tab = btn.getAttribute('data-tab');
            if (tab === 'functions') btn.textContent = `Functions (${fns})`;
            if (tab === 'systems') btn.textContent = `Systems (${sys})`;
            if (tab === 'dependencies') btn.textContent = `Dependencies (${dep})`;
        });
    }

    // ------------------------------------------------------------------
    // Re-validate
    // ------------------------------------------------------------------
    document.getElementById('btnEditorRevalidate')?.addEventListener('click', () => {
        const result = validateArchitecture(editorState);
        const banner = document.getElementById('preImportRevalidateBanner');
        if (!banner) return;

        const statusColour = result.valid ? 'border-[#00703c] bg-green-50' : 'border-[#d4351c] bg-red-50';
        const statusText = result.valid ? '✓ Valid — ready to import' : `✗ ${result.errors.length} error${result.errors.length !== 1 ? 's' : ''} found`;
        const statusTextColour = result.valid ? 'text-[#00703c]' : 'text-[#d4351c]';

        let html = `<div class="border-l-4 ${statusColour} pl-4 py-3">`;
        html += `<p class="font-bold text-sm ${statusTextColour} mb-2">${statusText}</p>`;

        if (result.errors.length > 0) {
            html += '<ul class="text-sm text-[#d4351c] space-y-1 mb-2">';
            for (const err of result.errors) {
                html += `<li>• ${escHtml(err.message)}</li>`;
            }
            html += '</ul>';
        }
        if (result.warnings.length > 0) {
            html += '<ul class="text-sm text-[#f47738] space-y-1">';
            for (const warn of result.warnings) {
                html += `<li>• ${escHtml(warn.message)}</li>`;
            }
            html += '</ul>';
        }
        html += '</div>';

        banner.innerHTML = html;
        banner.classList.remove('hidden');
    });

    // ------------------------------------------------------------------
    // Export JSON
    // ------------------------------------------------------------------
    document.getElementById('btnEditorExport')?.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(editorState, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const name = (editorState.councilName || 'architecture').replace(/\s+/g, '-').toLowerCase();
        a.href = url;
        a.download = `${name}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // ------------------------------------------------------------------
    // Import to Engine
    // ------------------------------------------------------------------
    document.getElementById('btnEditorImport')?.addEventListener('click', () => {
        onImport(editorState);
    });
}

// =====================================================================
// TRANSITION CONFIG EDITOR
// =====================================================================

export function renderTransitionConfigEditor(json) {
    const successors = json.successors || [];
    let successorHtml = successors.map((s, i) => `
        <div class="border border-gray-200 p-4 mb-3" data-succ-idx="${i}">
            <div class="flex items-center justify-between mb-3">
                <h4 class="font-bold text-sm">Successor ${i + 1}</h4>
                <button class="tc-delete-succ text-[#d4351c] text-xs font-bold underline" data-succ-idx="${i}">Remove</button>
            </div>
            <div class="space-y-3">
                <div>
                    <label class="text-xs font-bold text-gray-600 block mb-1">Name</label>
                    <input type="text" class="tc-field border border-gray-300 p-2 text-sm w-full" data-succ-idx="${i}" data-field="name" value="${escHtml(s.name || '')}">
                </div>
                <div>
                    <label class="text-xs font-bold text-gray-600 block mb-1">Full Predecessors <span class="font-normal text-gray-400">(comma-separated council names)</span></label>
                    <input type="text" class="tc-field border border-gray-300 p-2 text-sm w-full" data-succ-idx="${i}" data-field="fullPredecessors" value="${escHtml((s.fullPredecessors || []).join(', '))}">
                </div>
                <div>
                    <label class="text-xs font-bold text-gray-600 block mb-1">Partial Predecessors <span class="font-normal text-gray-400">(comma-separated council names)</span></label>
                    <input type="text" class="tc-field border border-gray-300 p-2 text-sm w-full" data-succ-idx="${i}" data-field="partialPredecessors" value="${escHtml((s.partialPredecessors || []).join(', '))}">
                </div>
            </div>
        </div>
    `).join('');

    return `
<div id="tcEditorView" class="w-full px-4 md:px-8 max-w-3xl mx-auto">
    <button id="btnBackFromTcEditor" class="text-[#1d70b8] underline font-bold text-sm mb-6 block">← Back to validator</button>
    <h2 class="text-2xl font-bold mb-2">Edit Transition Configuration</h2>
    <p class="text-sm text-gray-600 mb-6">Edit the vesting date and successor authority definitions.</p>

    <div class="mb-6">
        <label class="text-sm font-bold text-gray-700 block mb-1">Vesting Date</label>
        <input type="date" id="tcVestingDate" class="border border-gray-300 p-2 text-sm" value="${escHtml(json.vestingDate || '')}">
    </div>

    <h3 class="text-lg font-bold mb-3">Successor Authorities</h3>
    <div id="tcSuccessorsList">${successorHtml}</div>
    <button id="btnAddSuccessor" class="gds-btn-secondary mt-3 px-3 py-1.5 text-sm font-bold">+ Add Successor</button>

    <div class="mt-8 pt-4 border-t border-gray-200 flex gap-3">
        <button id="btnTcExport" class="gds-btn-secondary px-3 py-1.5 text-sm font-bold">Export JSON</button>
        <button id="btnTcImport" class="gds-btn px-3 py-1.5 text-sm font-bold">Import to Engine</button>
    </div>
</div>`;
}

export function wireTransitionConfigEditor(json, onImport, onBack) {
    let editorState = JSON.parse(JSON.stringify(json));

    const container = document.getElementById('tcEditorView');
    if (!container) return;

    document.getElementById('btnBackFromTcEditor')?.addEventListener('click', onBack);

    document.getElementById('tcVestingDate')?.addEventListener('change', (e) => {
        editorState.vestingDate = e.target.value;
    });

    const list = document.getElementById('tcSuccessorsList');

    list.addEventListener('input', (e) => {
        if (!e.target.classList.contains('tc-field')) return;
        const idx = parseInt(e.target.dataset.succIdx, 10);
        const field = e.target.dataset.field;
        if (field === 'name') {
            editorState.successors[idx].name = e.target.value;
        } else if (field === 'fullPredecessors') {
            editorState.successors[idx].fullPredecessors = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
        } else if (field === 'partialPredecessors') {
            editorState.successors[idx].partialPredecessors = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
        }
    });

    list.addEventListener('click', (e) => {
        if (e.target.classList.contains('tc-delete-succ')) {
            const idx = parseInt(e.target.dataset.succIdx, 10);
            editorState.successors.splice(idx, 1);
            rerender();
        }
    });

    document.getElementById('btnAddSuccessor')?.addEventListener('click', () => {
        editorState.successors.push({ name: '', fullPredecessors: [], partialPredecessors: [] });
        rerender();
    });

    document.getElementById('btnTcExport')?.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(editorState, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'transition-config.json';
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    });

    document.getElementById('btnTcImport')?.addEventListener('click', () => {
        onImport(editorState);
    });

    function rerender() {
        const parent = container.parentElement;
        parent.innerHTML = renderTransitionConfigEditor(editorState);
        wireTransitionConfigEditor(editorState, onImport, onBack);
    }
}
