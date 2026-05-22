/**
 * Bulk Mode — table view with pinned columns and column group tabs
 * for editing multiple IT systems at once.
 */

import { formatThousands, parseThousands } from './smart-inputs.js';
import { LGA_FUNCTIONS } from '../../constants/lga-functions.js';

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
    html += `<div class="flex border-b border-gray-200 bg-white px-4 flex-shrink-0" data-bulk-tabs>`;
    for (const tab of TABS) {
        const isActive = tab.id === activeTab;
        const classes = isActive
            ? 'border-b-2 border-blue-600 text-blue-700'
            : 'text-gray-500 hover:text-gray-700';
        html += `<button type="button" data-bulk-tab="${tab.id}"
            class="px-4 py-2 text-sm font-medium ${classes} transition-colors">${escHtml(tab.label)}</button>`;
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
    const columnDefs = getColumnDefs(activeTab);

    let html = `<table class="w-full border-collapse" style="min-width:900px" data-bulk-table>`;

    // Header
    html += `<thead><tr class="sticky top-0 bg-gray-100 z-10">`;
    // Pinned columns
    html += `<th class="sticky left-0 z-20 bg-gray-100 text-xs font-medium text-gray-600 uppercase py-1 px-2 text-left border-b border-gray-200" style="min-width:150px">System Name</th>`;
    html += `<th class="sticky z-20 bg-gray-100 text-xs font-medium text-gray-600 uppercase py-1 px-2 text-left border-b border-gray-200" style="min-width:100px;left:150px">Vendor</th>`;
    html += `<th class="sticky z-20 bg-gray-100 text-xs font-medium text-gray-600 uppercase py-1 px-2 text-left border-b border-gray-200" style="min-width:120px;left:250px">Function</th>`;
    // Dynamic columns
    for (const col of columnDefs) {
        html += `<th class="bg-gray-100 text-xs font-medium text-gray-600 uppercase py-1 px-2 text-left border-b border-gray-200" style="min-width:${col.width}px">${escHtml(col.label)}</th>`;
    }
    // Status column (pinned right)
    html += `<th class="sticky right-0 z-20 bg-gray-100 text-xs font-medium text-gray-600 uppercase py-1 px-2 text-center border-b border-gray-200" style="min-width:50px">Status</th>`;
    html += `</tr></thead>`;

    // Body
    html += `<tbody>`;
    for (let i = 0; i < systems.length; i++) {
        const { node, idx } = systems[i];
        const rowBg = i % 2 === 0 ? 'bg-white' : 'bg-gray-50';
        const fnLabel = functionLookup.get(node.id) || '';
        const status = computeCompleteness(node);

        html += `<tr class="${rowBg}">`;
        // Pinned: System Name
        html += `<td class="sticky left-0 z-10 ${rowBg} py-1 px-2 border-b border-gray-100" style="min-width:150px">`;
        html += `<input type="text" value="${escAttr(node.label || '')}" data-bulk-row="${idx}" data-bulk-field="label"
            class="w-full text-xs py-0.5 px-1 border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 focus:outline-none rounded" />`;
        html += `</td>`;
        // Pinned: Vendor
        html += `<td class="sticky z-10 ${rowBg} py-1 px-2 border-b border-gray-100" style="min-width:100px;left:150px">`;
        html += `<input type="text" value="${escAttr(node.vendor || '')}" data-bulk-row="${idx}" data-bulk-field="vendor"
            class="w-full text-xs py-0.5 px-1 border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 focus:outline-none rounded" />`;
        html += `</td>`;
        // Pinned: Function (read-only)
        html += `<td class="sticky z-10 ${rowBg} py-1 px-2 border-b border-gray-100 text-xs text-gray-600" style="min-width:120px;left:250px">${escHtml(fnLabel)}</td>`;
        // Dynamic columns
        for (const col of columnDefs) {
            html += `<td class="py-1 px-2 border-b border-gray-100">`;
            html += renderCell(col, node, idx, editorState);
            html += `</td>`;
        }
        // Status
        html += `<td class="sticky right-0 z-10 ${rowBg} py-1 px-2 border-b border-gray-100 text-center text-xs">${status}</td>`;
        html += `</tr>`;
    }
    html += `</tbody></table>`;

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
            class="w-full text-xs py-0.5 px-1 border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 focus:outline-none rounded" />`;
    }

    if (type === 'number') {
        const raw = node[field];
        const display = (raw != null && !isNaN(raw)) ? String(raw) : '';
        return `<input type="text" value="${escAttr(display)}" data-bulk-row="${nodeIdx}" data-bulk-field="${field}"
            class="w-full text-xs py-0.5 px-1 border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 focus:outline-none rounded text-right" />`;
    }

    if (type === 'thousands') {
        const raw = node[field];
        const display = (raw != null && !isNaN(raw)) ? formatThousands(raw, { prefix: '£' }) : '';
        return `<input type="text" value="${escAttr(display)}" data-bulk-row="${nodeIdx}" data-bulk-field="${field}"
            data-format="thousands" data-prefix="£"
            class="w-full text-xs py-0.5 px-1 border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 focus:outline-none rounded text-right" />`;
    }

    if (type === 'contract-end') {
        const mm = node.endMonth ? String(node.endMonth).padStart(2, '0') : '';
        const yyyy = node.endYear ? String(node.endYear) : '';
        const display = (mm && yyyy) ? `${mm}/${yyyy}` : (yyyy || '');
        return `<input type="text" value="${escAttr(display)}" data-bulk-row="${nodeIdx}" data-bulk-field="contractEnd"
            placeholder="MM/YYYY"
            class="w-full text-xs py-0.5 px-1 border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 focus:outline-none rounded" />`;
    }

    if (type === 'select') {
        const current = getSelectValue(node, field);
        let opts = `<option value="">--</option>`;
        for (const opt of col.options) {
            const sel = opt.value === current ? 'selected' : '';
            opts += `<option value="${escAttr(opt.value)}" ${sel}>${escHtml(opt.label)}</option>`;
        }
        return `<select data-bulk-row="${nodeIdx}" data-bulk-field="${field}"
            class="w-full text-xs py-0.5 px-0.5 border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 focus:outline-none rounded">${opts}</select>`;
    }

    if (type === 'comma-text') {
        const arr = node[field] || [];
        const display = Array.isArray(arr) ? arr.join(', ') : String(arr);
        return `<input type="text" value="${escAttr(display)}" data-bulk-row="${nodeIdx}" data-bulk-field="${field}"
            class="w-full text-xs py-0.5 px-1 border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 focus:outline-none rounded" />`;
    }

    if (type === 'readonly') {
        const value = getReadonlyValue(node, field, editorState);
        return `<span class="text-xs text-gray-500">${escHtml(value)}</span>`;
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
                { field: 'sharedWith', label: 'Shared With', type: 'comma-text', width: 150 },
                { field: 'capabilityType', label: 'Capabilities', type: 'comma-text', width: 120 },
                { field: 'dependsOn', label: 'Depends On', type: 'readonly', width: 150 }
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

function computeCompleteness(node) {
    let filled = 0;
    for (const f of KEY_FIELDS) {
        const val = node[f];
        if (val != null && val !== '' && val !== undefined) filled++;
    }
    const total = KEY_FIELDS.length;
    if (filled === total) {
        return `<span class="text-green-600 font-medium" title="All key fields complete">✓</span>`;
    }
    const missing = total - filled;
    if (filled === 0) {
        return `<span class="text-red-500 font-medium" title="${missing} fields missing">✗</span>`;
    }
    return `<span class="text-amber-500 font-medium" title="${missing} fields missing">⚠ ${missing}</span>`;
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
                t.classList.remove('border-b-2', 'border-blue-600', 'text-blue-700');
                t.classList.add('text-gray-500', 'hover:text-gray-700');
            });
            btn.classList.remove('text-gray-500', 'hover:text-gray-700');
            btn.classList.add('border-b-2', 'border-blue-600', 'text-blue-700');

            // Re-render table
            const wrapper = container.querySelector('[data-bulk-table-wrapper]');
            if (wrapper) {
                wrapper.innerHTML = renderTable(editorState, tabId);
                wireTableInputs(wrapper, editorState, options);
            }
        });
    }

    // Wire table inputs
    const tableWrapper = container.querySelector('[data-bulk-table-wrapper]');
    if (tableWrapper) {
        wireTableInputs(tableWrapper, editorState, options);
    }
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
