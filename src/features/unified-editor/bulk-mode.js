/**
 * Bulk Mode — table view with pinned columns and column group tabs
 * for editing multiple IT systems at once.
 */

import { formatThousands, parseThousands } from './smart-inputs.js';
import { LGA_FUNCTIONS } from '../../constants/lga-functions.js';
import { LGAM_CAPABILITIES } from '../../constants/capabilities.js';

// --- Constants ---

const TABS = [
    { id: 'contract', label: 'Contract & Cost' },
    { id: 'technical', label: 'Technical' },
    { id: 'relationships', label: 'Relationships' }
];

const KEY_FIELDS = ['vendor', 'annualCost', 'endYear', 'portability', 'dataPartitioning', 'isCloud', 'supportModel'];

// --- Rendering ---

/**
 * Renders the bulk table view with column group tabs.
 * @param {object} editorState — { nodes, edges, ... }
 * @returns {string} HTML string
 */
export function renderBulkMode(editorState) {
    const activeTab = editorState._bulkActiveTab || 'contract';

    let html = `<div class="flex flex-col h-full overflow-hidden" data-bulk-mode>`;

    // Tab bar
    html += `<div class="flex border-b border-[#b1b4b6] bg-white px-4 flex-shrink-0" data-bulk-tabs>`;
    for (const tab of TABS) {
        const isActive = tab.id === activeTab;
        const classes = isActive
            ? 'font-bold text-[#0b0c0c] border-b-[3px] border-[#1d70b8]'
            : 'font-bold text-[#505a5f] border-b-[3px] border-transparent hover:text-[#0b0c0c] hover:border-[#b1b4b6]';
        html += `<button type="button" data-bulk-tab="${tab.id}"
            class="px-4 py-2 text-sm ${classes} transition-colors">${escHtml(tab.label)}</button>`;
    }
    html += `</div>`;

    // Table wrapper
    html += `<div class="flex-1 overflow-auto" data-bulk-table-wrapper>`;
    html += renderTable(editorState, activeTab);
    html += `</div>`;

    html += `</div>`;
    return html;
}

/**
 * Renders the table for the given tab.
 */
function renderTable(editorState, activeTab) {
    const { nodes, edges } = editorState;
    const systems = [];
    nodes.forEach((node, idx) => {
        if (node.type === 'ITSystem') {
            systems.push({ node, idx });
        }
    });

    const functionLookup = buildFunctionLookup(nodes, edges);
    const functionLookupMulti = buildFunctionLookupMulti(nodes, edges);
    const columnDefs = getColumnDefs(activeTab);

    let html = `<table class="w-full border-collapse" style="min-width:900px" data-bulk-table>`;

    // Header
    html += `<thead><tr class="sticky top-0 bg-[#f3f2f1] z-10">`;
    // Pinned columns
    html += `<th class="sticky left-0 z-20 bg-[#f3f2f1] text-sm font-bold text-[#0b0c0c] py-2 px-3 text-left border-b-2 border-[#0b0c0c]" style="min-width:150px">System Name</th>`;
    html += `<th class="sticky z-20 bg-[#f3f2f1] text-sm font-bold text-[#0b0c0c] py-2 px-3 text-left border-b-2 border-[#0b0c0c]" style="min-width:100px;left:150px">Vendor</th>`;
    html += `<th class="sticky z-20 bg-[#f3f2f1] text-sm font-bold text-[#0b0c0c] py-2 px-3 text-left border-b-2 border-[#0b0c0c]" style="min-width:120px;left:250px">Function</th>`;
    // Dynamic columns
    for (const col of columnDefs) {
        html += `<th class="bg-[#f3f2f1] text-sm font-bold text-[#0b0c0c] py-2 px-3 text-left border-b-2 border-[#0b0c0c]" style="min-width:${col.width}px">${escHtml(col.label)}</th>`;
    }
    // Status column (pinned right)
    html += `<th class="sticky right-0 z-20 bg-[#f3f2f1] text-sm font-bold text-[#0b0c0c] py-2 px-3 text-center border-b-2 border-[#0b0c0c]" style="min-width:50px">Status</th>`;
    html += `</tr></thead>`;

    // Body
    html += `<tbody>`;
    for (let i = 0; i < systems.length; i++) {
        const { node, idx } = systems[i];
        const rowBg = i % 2 === 0 ? 'bg-white' : 'bg-[#f3f2f1]';
        const fnLabel = functionLookup.get(node.id) || '';
        const status = computeCompleteness(node);

        html += `<tr class="${rowBg}">`;
        // Pinned: System Name
        html += `<td class="sticky left-0 z-10 ${rowBg} py-3 px-3 border-b border-[#b1b4b6]" style="min-width:150px">`;
        html += `<input type="text" value="${escAttr(node.label || '')}" data-bulk-row="${idx}" data-bulk-field="label"
            class="w-full text-sm py-0.5 px-1 border border-[#b1b4b6] bg-white p-1 focus:border-2 focus:border-[#0b0c0c] focus:outline-3 focus:outline-[#ffdd00]" />`;
        html += `</td>`;
        // Pinned: Vendor
        html += `<td class="sticky z-10 ${rowBg} py-3 px-3 border-b border-[#b1b4b6]" style="min-width:100px;left:150px">`;
        html += `<input type="text" value="${escAttr(node.vendor || '')}" data-bulk-row="${idx}" data-bulk-field="vendor" list="bulk-vendor-datalist"
            class="w-full text-sm py-0.5 px-1 border border-[#b1b4b6] bg-white p-1 focus:border-2 focus:border-[#0b0c0c] focus:outline-3 focus:outline-[#ffdd00]" />`;
        html += `</td>`;
        // Pinned: Function (chip-based with autocomplete)
        const fnLabels = functionLookupMulti.get(node.id) || [];
        html += `<td class="sticky z-10 ${rowBg} py-3 px-3 border-b border-[#b1b4b6]" style="min-width:160px;left:250px">`;
        html += `<div class="flex flex-wrap items-center gap-0.5" data-bulk-chip-container="${idx}-function">`;
        for (const fn of fnLabels) {
            html += `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] bg-[#f3f2f1] border border-[#b1b4b6]"
                data-bulk-chip-row="${idx}" data-bulk-chip-field="function" data-bulk-chip-value="${escAttr(fn)}">
                ${escHtml(fn)}
                <button type="button" class="text-[#d4351c] font-bold leading-none ml-0.5"
                    data-bulk-chip-remove data-bulk-chip-row="${idx}" data-bulk-chip-field="function" data-bulk-chip-value="${escAttr(fn)}">&times;</button>
            </span>`;
        }
        html += `<input type="text" placeholder="+" list="bulk-fn-datalist" data-bulk-chip-input="${idx}-function" data-bulk-chip-row="${idx}" data-bulk-chip-field="function"
            class="w-20 text-[11px] px-1 py-0.5 border border-[#b1b4b6] bg-white focus:border-[#0b0c0c] focus:outline-3 focus:outline-[#ffdd00]" />`;
        html += `</div></td>`;
        // Dynamic columns
        for (const col of columnDefs) {
            html += `<td class="py-3 px-3 border-b border-[#b1b4b6]">`;
            html += renderCell(col, node, idx, editorState);
            html += `</td>`;
        }
        // Status
        html += `<td class="sticky right-0 z-10 ${rowBg} py-3 px-3 border-b border-[#b1b4b6] text-center text-sm">${status}</td>`;
        html += `</tr>`;
    }
    html += `</tbody></table>`;

    // Function datalist for autocomplete
    html += `<datalist id="bulk-fn-datalist">`;
    for (const fn of LGA_FUNCTIONS) {
        html += `<option value="${escAttr(fn.label)}">`;
    }
    html += `</datalist>`;

    // Vendor datalist for autocomplete
    const vendors = [...new Set(systems.map(s => s.node.vendor).filter(Boolean))].sort();
    html += `<datalist id="bulk-vendor-datalist">`;
    for (const v of vendors) {
        html += `<option value="${escAttr(v)}">`;
    }
    html += `</datalist>`;

    // Council datalist for sharedWith autocomplete
    const councils = [...new Set(systems.flatMap(s => s.node.sharedWith || []).filter(Boolean))].sort();
    html += `<datalist id="bulk-council-datalist">`;
    for (const c of councils) {
        html += `<option value="${escAttr(c)}">`;
    }
    html += `</datalist>`;

    return html;
}

/**
 * Renders a single cell based on column definition.
 */
function renderCell(col, node, nodeIdx, editorState) {
    const { field, type } = col;

    if (type === 'text') {
        const value = getFieldValue(node, field, editorState);
        return `<input type="text" value="${escAttr(value)}" data-bulk-row="${nodeIdx}" data-bulk-field="${field}"
            class="w-full text-sm py-0.5 px-1 border border-[#b1b4b6] bg-white p-1 focus:border-2 focus:border-[#0b0c0c] focus:outline-3 focus:outline-[#ffdd00]" />`;
    }

    if (type === 'number') {
        const raw = node[field];
        const display = (raw != null && !isNaN(raw)) ? String(raw) : '';
        return `<input type="text" value="${escAttr(display)}" data-bulk-row="${nodeIdx}" data-bulk-field="${field}"
            class="w-full text-sm py-0.5 px-1 border border-[#b1b4b6] bg-white p-1 focus:border-2 focus:border-[#0b0c0c] focus:outline-3 focus:outline-[#ffdd00] text-right" />`;
    }

    if (type === 'thousands') {
        const raw = node[field];
        const display = (raw != null && !isNaN(raw)) ? formatThousands(raw, { prefix: '£' }) : '';
        return `<input type="text" value="${escAttr(display)}" data-bulk-row="${nodeIdx}" data-bulk-field="${field}"
            data-format="thousands" data-prefix="£"
            class="w-full text-sm py-0.5 px-1 border border-[#b1b4b6] bg-white p-1 focus:border-2 focus:border-[#0b0c0c] focus:outline-3 focus:outline-[#ffdd00] text-right" />`;
    }

    if (type === 'contract-end') {
        const mm = node.endMonth ? String(node.endMonth).padStart(2, '0') : '';
        const yyyy = node.endYear ? String(node.endYear) : '';
        const display = (mm && yyyy) ? `${mm}/${yyyy}` : (yyyy || '');
        return `<input type="text" value="${escAttr(display)}" data-bulk-row="${nodeIdx}" data-bulk-field="contractEnd"
            placeholder="MM/YYYY"
            class="w-full text-sm py-0.5 px-1 border border-[#b1b4b6] bg-white p-1 focus:border-2 focus:border-[#0b0c0c] focus:outline-3 focus:outline-[#ffdd00]" />`;
    }

    if (type === 'select') {
        const current = getSelectValue(node, field);
        let opts = `<option value="">--</option>`;
        for (const opt of col.options) {
            const sel = opt.value === current ? 'selected' : '';
            opts += `<option value="${escAttr(opt.value)}" ${sel}>${escHtml(opt.label)}</option>`;
        }
        return `<select data-bulk-row="${nodeIdx}" data-bulk-field="${field}"
            class="w-full text-sm py-0.5 px-0.5 border border-[#b1b4b6] bg-white p-1 focus:border-2 focus:border-[#0b0c0c] focus:outline-3 focus:outline-[#ffdd00]">${opts}</select>`;
    }

    if (type === 'comma-text') {
        const arr = node[field] || [];
        const display = Array.isArray(arr) ? arr.join(', ') : String(arr);
        const listAttr = field === 'sharedWith' ? ' list="bulk-council-datalist"' : '';
        return `<input type="text" value="${escAttr(display)}" data-bulk-row="${nodeIdx}" data-bulk-field="${field}"${listAttr}
            class="w-full text-sm py-0.5 px-1 border border-[#b1b4b6] bg-white p-1 focus:border-2 focus:border-[#0b0c0c] focus:outline-3 focus:outline-[#ffdd00]" />`;
    }

    if (type === 'readonly') {
        const value = getReadonlyValue(node, field, editorState);
        return `<span class="text-sm text-[#505a5f]">${escHtml(value)}</span>`;
    }

    if (type === 'cap-pills') {
        const active = node.capabilityType || [];
        let h = `<div class="flex flex-wrap gap-0.5">`;
        for (const cap of LGAM_CAPABILITIES) {
            const isOn = active.includes(cap.id);
            const cls = isOn
                ? 'bg-[#1d70b8] text-white border-[#1d70b8]'
                : 'bg-white text-[#505a5f] border-[#b1b4b6]';
            h += `<button type="button" data-bulk-cap-row="${nodeIdx}" data-bulk-cap-id="${cap.id}" aria-pressed="${isOn}"
                class="px-1.5 py-0.5 text-[10px] font-bold border ${cls}">${escHtml(cap.label)}</button>`;
        }
        h += `</div>`;
        return h;
    }

    if (type === 'chip-cell') {
        const arr = node[field] || [];
        let h = `<div class="flex flex-wrap items-center gap-0.5" data-bulk-chip-container="${nodeIdx}-${field}">`;
        for (const val of arr) {
            h += `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] bg-[#f3f2f1] border border-[#b1b4b6]"
                data-bulk-chip-row="${nodeIdx}" data-bulk-chip-field="${field}" data-bulk-chip-value="${escAttr(val)}">
                ${escHtml(val)}
                <button type="button" class="text-[#d4351c] font-bold leading-none ml-0.5"
                    data-bulk-chip-remove data-bulk-chip-row="${nodeIdx}" data-bulk-chip-field="${field}" data-bulk-chip-value="${escAttr(val)}">&times;</button>
            </span>`;
        }
        const listAttr = field === 'sharedWith' ? ' list="bulk-council-datalist"' : '';
        h += `<input type="text" placeholder="+"${listAttr} data-bulk-chip-input="${nodeIdx}-${field}" data-bulk-chip-row="${nodeIdx}" data-bulk-chip-field="${field}"
            class="w-16 text-[11px] px-1 py-0.5 border border-[#b1b4b6] bg-white focus:border-[#0b0c0c] focus:outline-3 focus:outline-[#ffdd00]" />`;
        h += `</div>`;
        return h;
    }

    if (type === 'dep-cell') {
        const { edges, nodes: allNodes } = editorState;
        const deps = edges.filter(e => e.source === node.id && e.relationship === 'CONSUMES_CAPABILITY');
        let h = `<div class="flex flex-wrap items-center gap-0.5" data-bulk-dep-container="${nodeIdx}">`;
        for (const edge of deps) {
            const provider = allNodes.find(n => n.id === edge.target);
            const label = provider ? provider.label : edge.target;
            const caps = (edge.capabilities || []).join(', ');
            h += `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] bg-[#f3f2f1] border border-[#b1b4b6]"
                title="${escAttr(caps ? 'Caps: ' + caps : 'All capabilities')}">
                ${escHtml(label)}
                <button type="button" class="text-[#d4351c] font-bold leading-none ml-0.5"
                    data-bulk-dep-remove data-bulk-dep-row="${nodeIdx}" data-bulk-dep-target="${escAttr(edge.target)}">&times;</button>
            </span>`;
        }
        // Add input - only shows providers (systems with capabilityType)
        h += `<input type="text" placeholder="+" list="bulk-dep-datalist-${nodeIdx}" data-bulk-dep-input="${nodeIdx}"
            class="w-16 text-[11px] px-1 py-0.5 border border-[#b1b4b6] bg-white focus:border-[#0b0c0c] focus:outline-3 focus:outline-[#ffdd00]" />`;
        // Build datalist of available providers
        const existingTargets = new Set(deps.map(e => e.target));
        const providers = allNodes.filter(n => n.type === 'ITSystem' && n.id !== node.id && n.capabilityType && n.capabilityType.length > 0 && !existingTargets.has(n.id));
        h += `<datalist id="bulk-dep-datalist-${nodeIdx}">`;
        for (const p of providers) {
            h += `<option value="${escAttr(p.label)}" data-sys-id="${escAttr(p.id)}">`;
        }
        h += `</datalist>`;
        h += `</div>`;
        return h;
    }

    if (type === 'edit-link') {
        return `<button type="button" data-bulk-focus-row="${nodeIdx}"
            class="text-xs text-[#1d70b8] hover:text-[#003078] underline font-bold">Edit</button>`;
    }

    return '';
}

// --- Column definitions per tab ---

function getColumnDefs(activeTab) {
    switch (activeTab) {
        case 'contract':
            return [
                { field: 'annualCost', label: 'Annual Cost', type: 'thousands', width: 100 },
                { field: 'contractEnd', label: 'Contract End', type: 'contract-end', width: 80 },
                { field: 'noticePeriod', label: 'Notice (months)', type: 'number', width: 60 }
            ];
        case 'technical':
            return [
                { field: 'isCloud', label: 'Hosting', type: 'select', width: 90,
                    options: [{ value: 'true', label: 'Cloud' }, { value: 'false', label: 'On-Premise' }] },
                { field: 'dataPartitioning', label: 'Partitioning', type: 'select', width: 100,
                    options: [{ value: 'Segmented', label: 'Segmented' }, { value: 'Monolithic', label: 'Monolithic' }] },
                { field: 'portability', label: 'Portability', type: 'select', width: 80,
                    options: [{ value: 'High', label: 'High' }, { value: 'Medium', label: 'Medium' }, { value: 'Low', label: 'Low' }] },
                { field: 'supportModel', label: 'Support Model', type: 'select', width: 130,
                    options: [
                        { value: 'vendor-supported', label: 'vendor-supported' },
                        { value: 'community-supported', label: 'community-supported' },
                        { value: 'unsupported', label: 'unsupported' }
                    ] }
            ];
        case 'relationships':
            return [
                { field: 'capabilityType', label: 'Provides', type: 'cap-pills', width: 260 },
                { field: 'sharedWith', label: 'Shared With', type: 'chip-cell', width: 180 },
                { field: 'dependsOn', label: 'Depends On', type: 'dep-cell', width: 200 }
            ];
        default:
            return [];
    }
}

// --- Helpers ---

function getFieldValue(node, field, editorState) {
    if (field === 'contractEnd') {
        const mm = node.endMonth ? String(node.endMonth).padStart(2, '0') : '';
        const yyyy = node.endYear ? String(node.endYear) : '';
        return (mm && yyyy) ? `${mm}/${yyyy}` : (yyyy || '');
    }
    const val = node[field];
    if (Array.isArray(val)) return val.join(', ');
    return val != null ? String(val) : '';
}

function getSelectValue(node, field) {
    if (field === 'isCloud') {
        if (node.isCloud === true) return 'true';
        if (node.isCloud === false) return 'false';
        return '';
    }
    return node[field] || '';
}

function getReadonlyValue(node, field, editorState) {
    if (field === 'dependsOn') {
        // Find systems this node CONSUMES_CAPABILITY from
        const { edges, nodes } = editorState;
        const providers = [];
        for (const edge of edges) {
            if (edge.source === node.id && edge.relationship === 'CONSUMES_CAPABILITY') {
                const target = nodes.find(n => n.id === edge.target);
                if (target) providers.push(target.label || target.id);
            }
        }
        return providers.join(', ');
    }
    return '';
}

function buildFunctionLookup(nodes, edges) {
    const lookup = new Map();
    const fnNodes = new Map();
    for (const n of nodes) {
        if (n.type === 'Function') fnNodes.set(n.id, n);
    }
    for (const edge of edges) {
        if (edge.relationship === 'REALIZES' && fnNodes.has(edge.target)) {
            if (!lookup.has(edge.source)) {
                const fn = fnNodes.get(edge.target);
                // Resolve to LGA label if possible
                if (fn.lgaFunctionId) {
                    const lgaFn = LGA_FUNCTIONS.find(f => f.id === fn.lgaFunctionId);
                    if (lgaFn) {
                        lookup.set(edge.source, lgaFn.label);
                    } else {
                        lookup.set(edge.source, fn.label || '');
                    }
                } else {
                    lookup.set(edge.source, fn.label || '');
                }
            }
        }
    }
    return lookup;
}

function buildFunctionLookupMulti(nodes, edges) {
    const lookup = new Map();
    const fnNodes = new Map();
    for (const n of nodes) {
        if (n.type === 'Function') fnNodes.set(n.id, n);
    }
    for (const edge of edges) {
        if (edge.relationship === 'REALIZES' && fnNodes.has(edge.target)) {
            const fn = fnNodes.get(edge.target);
            let label;
            if (fn.lgaFunctionId) {
                const lgaFn = LGA_FUNCTIONS.find(f => f.id === fn.lgaFunctionId);
                label = lgaFn ? lgaFn.label : (fn.label || '');
            } else {
                label = fn.label || '';
            }
            if (!lookup.has(edge.source)) lookup.set(edge.source, []);
            lookup.get(edge.source).push(label);
        }
    }
    return lookup;
}

const KEY_FIELD_LABELS = {
    vendor: 'Vendor',
    annualCost: 'Annual Cost',
    endYear: 'Contract End Year',
    portability: 'Data Portability',
    dataPartitioning: 'Data Partitioning',
    isCloud: 'Hosting (Cloud/On-Prem)',
    supportModel: 'Support Model'
};

function computeCompleteness(node) {
    const missingFields = [];
    for (const f of KEY_FIELDS) {
        const val = node[f];
        if (val == null || val === '' || val === undefined) {
            missingFields.push(KEY_FIELD_LABELS[f] || f);
        }
    }
    const total = KEY_FIELDS.length;
    const filled = total - missingFields.length;
    if (filled === total) {
        return `<span class="text-[#00703c] font-medium" title="All analysis fields complete — this system will generate full signals">✓</span>`;
    }
    const tooltip = `Missing: ${missingFields.join(', ')}. These fields drive rationalisation signals.`;
    if (filled === 0) {
        return `<span class="text-[#d4351c] font-medium cursor-help" title="${escAttr(tooltip)}">✗ ${missingFields.length}</span>`;
    }
    return `<span class="text-[#f47738] font-medium cursor-help" title="${escAttr(tooltip)}">⚠ ${missingFields.length}</span>`;
}

// --- Event wiring ---

/**
 * Attaches event handlers for the bulk table view.
 * @param {HTMLElement} container — the bulk mode container element
 * @param {object} editorState — mutable editor state
 * @param {object} options — { onChange(nodeIdx, field, value) }
 */
export function wireBulkMode(container, editorState, options = {}) {
    if (!container) return;

    const { onChange } = options;

    // Tab switching
    const tabBar = container.querySelector('[data-bulk-tabs]');
    if (tabBar) {
        tabBar.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-bulk-tab]');
            if (!btn) return;
            const tabId = btn.dataset.bulkTab;
            if (tabId === editorState._bulkActiveTab) return;

            editorState._bulkActiveTab = tabId;

            // Update tab styles
            tabBar.querySelectorAll('[data-bulk-tab]').forEach(t => {
                t.classList.remove('text-[#0b0c0c]', 'border-b-[3px]', 'border-[#1d70b8]');
                t.classList.add('text-[#505a5f]', 'border-b-[3px]', 'border-transparent', 'hover:text-[#0b0c0c]', 'hover:border-[#b1b4b6]');
            });
            btn.classList.remove('text-[#505a5f]', 'border-transparent', 'hover:text-[#0b0c0c]', 'hover:border-[#b1b4b6]');
            btn.classList.add('text-[#0b0c0c]', 'border-b-[3px]', 'border-[#1d70b8]');

            // Re-render table
            const wrapper = container.querySelector('[data-bulk-table-wrapper]');
            if (wrapper) {
                wrapper.innerHTML = renderTable(editorState, tabId);
                wireTableInputs(wrapper, editorState, options);
            }
        });
    }

    // Wire table inputs (formatting + standard text change)
    const tableWrapper = container.querySelector('[data-bulk-table-wrapper]');
    if (tableWrapper) {
        wireTableInputs(tableWrapper, editorState, options);
    }

    // --- Single-registration handlers (must NOT be in wireTableInputs since that's called per tab switch) ---

    // Capability pill toggles, chip removes, dep removes, edit links
    container.addEventListener('click', (e) => {
        // Edit link → switch to focus mode
        const editBtn = e.target.closest('[data-bulk-focus-row]');
        if (editBtn && options.onFocusSystem) {
            options.onFocusSystem(parseInt(editBtn.dataset.bulkFocusRow, 10));
            return;
        }

        // Capability pill toggle
        const pill = e.target.closest('[data-bulk-cap-row]');
        if (pill && pill.dataset.bulkCapId) {
            const nodeIdx = parseInt(pill.dataset.bulkCapRow, 10);
            const capId = pill.dataset.bulkCapId;
            const wasOn = pill.getAttribute('aria-pressed') === 'true';
            const nowOn = !wasOn;
            pill.setAttribute('aria-pressed', String(nowOn));
            if (nowOn) {
                pill.classList.remove('bg-white', 'text-[#505a5f]', 'border-[#b1b4b6]');
                pill.classList.add('bg-[#1d70b8]', 'text-white', 'border-[#1d70b8]');
            } else {
                pill.classList.remove('bg-[#1d70b8]', 'text-white', 'border-[#1d70b8]');
                pill.classList.add('bg-white', 'text-[#505a5f]', 'border-[#b1b4b6]');
            }
            const node = editorState.nodes[nodeIdx];
            if (!node.capabilityType) node.capabilityType = [];
            if (nowOn && !node.capabilityType.includes(capId)) {
                node.capabilityType.push(capId);
            } else if (!nowOn) {
                node.capabilityType = node.capabilityType.filter(c => c !== capId);
            }
            return;
        }

        // Chip remove
        const removeBtn = e.target.closest('[data-bulk-chip-remove]');
        if (removeBtn) {
            const row = parseInt(removeBtn.dataset.bulkChipRow, 10);
            const field = removeBtn.dataset.bulkChipField;
            const value = removeBtn.dataset.bulkChipValue;
            const node = editorState.nodes[row];

            if (field === 'function') {
                // Remove REALIZES edge by matching function label
                const lgaFn = LGA_FUNCTIONS.find(f => f.label.toLowerCase() === value.toLowerCase());
                if (lgaFn) {
                    const fnNode = editorState.nodes.find(n => n.type === 'Function' && n.lgaFunctionId === lgaFn.id);
                    if (fnNode) {
                        editorState.edges = editorState.edges.filter(
                            edge => !(edge.source === node.id && edge.target === fnNode.id && edge.relationship === 'REALIZES')
                        );
                    }
                }
            } else if (node && Array.isArray(node[field])) {
                node[field] = node[field].filter(v => v !== value);
            }

            const chipEl = removeBtn.parentElement;
            if (chipEl && chipEl.hasAttribute('data-bulk-chip-value')) chipEl.remove();
            return;
        }

        // Dependency remove
        const depRemove = e.target.closest('[data-bulk-dep-remove]');
        if (depRemove) {
            const row = parseInt(depRemove.dataset.bulkDepRow, 10);
            const targetId = depRemove.dataset.bulkDepTarget;
            const node = editorState.nodes[row];
            editorState.edges = editorState.edges.filter(
                edge => !(edge.source === node.id && edge.target === targetId && edge.relationship === 'CONSUMES_CAPABILITY')
            );
            const chipEl = depRemove.closest('span');
            if (chipEl) chipEl.remove();
            return;
        }
    });

    // Chip input: add on Enter
    container.addEventListener('keydown', (e) => {
        const input = e.target;
        if (input.matches && input.matches('[data-bulk-chip-input]') && e.key === 'Enter') {
            e.preventDefault();
            addChipFromInput(input, editorState);
        }
        if (input.matches && input.matches('[data-bulk-dep-input]') && e.key === 'Enter') {
            e.preventDefault();
            addDepFromInput(input, editorState);
        }
    });

    // Chip/dep input: auto-add on datalist select
    container.addEventListener('input', (e) => {
        const input = e.target;
        if (input.matches && input.matches('[data-bulk-chip-input]')) {
            const listId = input.getAttribute('list');
            if (!listId) return;
            const datalist = document.getElementById(listId);
            if (!datalist) return;
            const value = input.value.trim();
            if (!value) return;
            if (Array.from(datalist.options).some(o => o.value === value)) {
                addChipFromInput(input, editorState);
            }
        }
        if (input.matches && input.matches('[data-bulk-dep-input]')) {
            const listId = input.getAttribute('list');
            if (!listId) return;
            const datalist = document.getElementById(listId);
            if (!datalist) return;
            const value = input.value.trim();
            if (!value) return;
            if (Array.from(datalist.options).some(o => o.value === value)) {
                addDepFromInput(input, editorState);
            }
        }
    });
}

/**
 * Wires delegated input events on the table wrapper.
 */
function wireTableInputs(wrapper, editorState, options) {
    const { onChange } = options;

    // Focus: strip thousands formatting
    wrapper.addEventListener('focus', (e) => {
        const input = e.target;
        if (input.matches && input.matches('[data-format="thousands"]')) {
            const raw = parseThousands(input.value);
            if (!isNaN(raw)) {
                input.value = String(raw);
            }
        }
    }, true);

    // Blur: apply thousands formatting
    wrapper.addEventListener('blur', (e) => {
        const input = e.target;
        if (input.matches && input.matches('[data-format="thousands"]')) {
            const raw = parseThousands(input.value);
            if (!isNaN(raw)) {
                const prefix = input.dataset.prefix || '';
                input.value = formatThousands(raw, { prefix });
            }
        }
    }, true);

    // Change: text inputs and selects
    wrapper.addEventListener('change', (e) => {
        const el = e.target;
        const row = el.dataset.bulkRow;
        const field = el.dataset.bulkField;
        if (row == null || !field) return;

        const nodeIdx = parseInt(row, 10);
        const value = parseFieldValue(field, el.value);

        if (onChange) {
            onChange(nodeIdx, field, value);
        }
    });

    // Input event for text fields — also fire onChange for immediate feedback
    wrapper.addEventListener('input', (e) => {
        const el = e.target;
        if (el.tagName === 'SELECT') return;
        const row = el.dataset.bulkRow;
        const field = el.dataset.bulkField;
        if (row == null || !field) return;

        // Skip thousands-formatted fields during typing — they fire on change/blur
        if (el.dataset.format === 'thousands') return;

        const nodeIdx = parseInt(row, 10);
        const value = parseFieldValue(field, el.value);

        if (onChange) {
            onChange(nodeIdx, field, value);
        }
    });

}

function addChipFromInput(input, editorState) {
    const value = input.value.trim();
    if (!value) return;
    const row = parseInt(input.dataset.bulkChipRow, 10);
    const field = input.dataset.bulkChipField;
    const node = editorState.nodes[row];
    if (!node) return;

    if (field === 'function') {
        // Special handling: add REALIZES edge
        const lgaFn = LGA_FUNCTIONS.find(f => f.label.toLowerCase() === value.toLowerCase());
        if (!lgaFn) { input.value = ''; return; }
        // Check if already linked
        let fnNode = editorState.nodes.find(n => n.type === 'Function' && n.lgaFunctionId === lgaFn.id);
        if (!fnNode) {
            fnNode = { id: `fn-${lgaFn.id}`, label: lgaFn.label, type: 'Function', lgaFunctionId: lgaFn.id };
            editorState.nodes.push(fnNode);
        }
        const alreadyLinked = editorState.edges.some(e => e.source === node.id && e.target === fnNode.id && e.relationship === 'REALIZES');
        if (alreadyLinked) { input.value = ''; return; }
        editorState.edges.push({ source: node.id, target: fnNode.id, relationship: 'REALIZES' });
    } else {
        if (!node[field]) node[field] = [];
        if (node[field].includes(value)) { input.value = ''; return; }
        node[field].push(value);
    }

    // Insert chip before input
    const chipHtml = `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] bg-[#f3f2f1] border border-[#b1b4b6]"
        data-bulk-chip-row="${row}" data-bulk-chip-field="${field}" data-bulk-chip-value="${escAttr(value)}">
        ${escHtml(value)}
        <button type="button" class="text-[#d4351c] font-bold leading-none ml-0.5"
            data-bulk-chip-remove data-bulk-chip-row="${row}" data-bulk-chip-field="${field}" data-bulk-chip-value="${escAttr(value)}">&times;</button>
    </span>`;
    input.insertAdjacentHTML('beforebegin', chipHtml);
    input.value = '';
}

function addDepFromInput(input, editorState) {
    const value = input.value.trim();
    if (!value) return;
    const row = parseInt(input.dataset.bulkDepInput, 10);
    const node = editorState.nodes[row];
    if (!node) return;
    // Find provider by label
    const provider = editorState.nodes.find(n => n.type === 'ITSystem' && n.label === value && n.id !== node.id);
    if (!provider) { input.value = ''; return; }
    // Check if already exists
    const exists = editorState.edges.some(e => e.source === node.id && e.target === provider.id && e.relationship === 'CONSUMES_CAPABILITY');
    if (exists) { input.value = ''; return; }
    // Add edge with all provider caps
    editorState.edges.push({
        source: node.id,
        target: provider.id,
        relationship: 'CONSUMES_CAPABILITY',
        capabilities: [...(provider.capabilityType || [])]
    });
    // Insert chip before input
    const chipHtml = `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] bg-[#f3f2f1] border border-[#b1b4b6]"
        title="Caps: ${escAttr((provider.capabilityType || []).join(', '))}">
        ${escHtml(provider.label)}
        <button type="button" class="text-[#d4351c] font-bold leading-none ml-0.5"
            data-bulk-dep-remove data-bulk-dep-row="${row}" data-bulk-dep-target="${escAttr(provider.id)}">&times;</button>
    </span>`;
    input.insertAdjacentHTML('beforebegin', chipHtml);
    input.value = '';
}

/**
 * Parses a field value from the raw input string into the appropriate type.
 */
function parseFieldValue(field, rawValue) {
    // Thousands-formatted cost field
    if (field === 'annualCost') {
        const n = parseThousands(rawValue);
        return isNaN(n) ? null : n;
    }

    // Contract end: split MM/YYYY into { endMonth, endYear }
    if (field === 'contractEnd') {
        const match = rawValue.match(/^(\d{1,2})\/(\d{4})$/);
        if (match) {
            return { endMonth: parseInt(match[1], 10), endYear: parseInt(match[2], 10) };
        }
        // Try just a year
        const yearMatch = rawValue.match(/^(\d{4})$/);
        if (yearMatch) {
            return { endMonth: null, endYear: parseInt(yearMatch[1], 10) };
        }
        return { endMonth: null, endYear: null };
    }

    // Notice period
    if (field === 'noticePeriod') {
        const n = parseInt(rawValue, 10);
        return isNaN(n) ? null : n;
    }

    // Boolean fields (isCloud)
    if (field === 'isCloud') {
        if (rawValue === 'true') return true;
        if (rawValue === 'false') return false;
        return null;
    }

    // Function: resolve label to LGA function data
    if (field === 'function') {
        const lgaFn = LGA_FUNCTIONS.find(f => f.label.toLowerCase() === rawValue.trim().toLowerCase());
        return { type: 'function', lgaId: lgaFn ? lgaFn.id : null, label: rawValue.trim() };
    }

    // Comma-separated arrays
    if (field === 'sharedWith' || field === 'capabilityType') {
        if (!rawValue.trim()) return [];
        return rawValue.split(',').map(s => s.trim()).filter(Boolean);
    }

    // String fields (vendor, label, portability, dataPartitioning, supportModel)
    return rawValue;
}

// --- Internal HTML helpers ---

function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escAttr(str) {
    return escHtml(str);
}
