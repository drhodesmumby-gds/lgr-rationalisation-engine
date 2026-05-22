/**
 * Props Panel — centre pane of the unified architecture editor.
 * System properties form with labelled sections for Identity, Contract & Cost, and Technical Profile.
 */

import { LGA_FUNCTIONS } from '../../constants/lga-functions.js';
import { formatThousands, parseThousands, renderChipSelector, renderRadioGroup, wireSmartInputs } from './smart-inputs.js';

// --- Rendering ---

/**
 * Render the properties panel for the selected system.
 * @param {object|null} system — the ITSystem node object, or null if nothing selected
 * @param {object} editorState — { nodes, edges }
 * @returns {string} HTML string
 */
export function renderPropsPanel(system, editorState) {
    if (!system) {
        return `<div class="flex items-center justify-center h-full text-sm text-[#505a5f]">
            Select a system from the list to edit its properties.
        </div>`;
    }

    const { nodes, edges } = editorState;

    // Resolve current functions from REALIZES edges
    const functionEdges = edges.filter(e => e.source === system.id && e.relationship === 'REALIZES');
    const functionNodes = functionEdges.map(e => nodes.find(n => n.id === e.target && n.type === 'Function')).filter(Boolean);
    const functionChips = functionNodes.map(fn => fn.label || fn.lgaFunctionId || fn.id);
    const functionChipValues = functionNodes.map(fn => fn.lgaFunctionId || fn.id);

    // Build datalist options for function autocomplete (exclude already-assigned)
    const assignedIds = new Set(functionNodes.map(fn => fn.lgaFunctionId).filter(Boolean));
    const availableFunctions = LGA_FUNCTIONS.filter(f => !assignedIds.has(f.id));
    const datalistOptions = availableFunctions.map(f => f.label);

    let html = `<div class="p-4 overflow-y-auto h-full" data-props-panel>`;

    // === Completeness indicator ===
    html += renderCompletenessBanner(system, editorState);

    // === Section 1: Identity ===
    html += sectionHeading('Identity');
    html += `<div class="grid grid-cols-2 gap-x-4 gap-y-2 mb-5">`;

    html += fieldRow('System Name',
        `<input type="text" data-prop-field="label" value="${escAttr(system.label || '')}"
                class="w-full text-sm border-2 border-[#0b0c0c] p-1 focus:outline-3 focus:outline-[#ffdd00] focus:outline-offset-0" />`
    );

    html += fieldRow('Vendor',
        `<input type="text" data-prop-field="vendor" value="${escAttr(system.vendor || '')}"
                class="w-full text-sm border-2 border-[#0b0c0c] p-1 focus:outline-3 focus:outline-[#ffdd00] focus:outline-offset-0" />`
    );

    html += fieldRow('Users',
        `<input type="text" data-prop-field="users" data-format="thousands"
                value="${system.users ? formatThousands(system.users) : ''}"
                class="w-full text-sm border-2 border-[#0b0c0c] p-1 focus:outline-3 focus:outline-[#ffdd00] focus:outline-offset-0" />`
    );

    html += fieldRow('ERP system',
        `<label class="inline-flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" data-prop-field="isERP" ${system.isERP ? 'checked' : ''}
                   class="w-5 h-5 border-2 border-[#0b0c0c]" />
            <span class="text-[#0b0c0c]">Monolithic ERP</span>
        </label>`
    );

    html += `</div>`;
    html += `<div class="flex flex-col gap-2 mb-5">`;
    html += fieldRow('Functions',
        renderChipSelector({
            chips: functionChips,
            placeholder: 'Add function...',
            name: 'functions',
            datalistId: 'props-fn-datalist',
            datalistOptions
        })
    );
    html += `</div>`;

    // === Section 2: Contract & Cost ===
    html += sectionHeading('Contract & Cost');
    html += `<div class="grid grid-cols-3 gap-x-4 gap-y-2 mb-5">`;

    html += fieldRow('Annual Cost',
        `<input type="text" data-prop-field="annualCost" data-format="thousands" data-prefix="£"
                value="${system.annualCost ? formatThousands(system.annualCost, { prefix: '£' }) : ''}"
                class="w-full text-sm border-2 border-[#0b0c0c] p-1 focus:outline-3 focus:outline-[#ffdd00] focus:outline-offset-0" />`
    );

    html += fieldRow('Contract End',
        `<div class="flex items-center gap-1">
            <input type="number" data-prop-field="endMonth" value="${system.endMonth || ''}" placeholder="MM"
                   min="1" max="12"
                   class="w-[3rem] text-sm border-2 border-[#0b0c0c] p-1 focus:outline-3 focus:outline-[#ffdd00] focus:outline-offset-0 text-center" />
            <span class="text-[#505a5f] text-sm">/</span>
            <input type="number" data-prop-field="endYear" value="${system.endYear || ''}" placeholder="YYYY"
                   min="2020" max="2040"
                   class="w-[4rem] text-sm border-2 border-[#0b0c0c] p-1 focus:outline-3 focus:outline-[#ffdd00] focus:outline-offset-0 text-center" />
        </div>`
    );

    html += fieldRow('Notice Period',
        `<div class="flex items-center gap-1.5">
            <input type="number" data-prop-field="noticePeriod" value="${system.noticePeriod || ''}"
                   min="0"
                   class="w-[3rem] text-sm border-2 border-[#0b0c0c] p-1 focus:outline-3 focus:outline-[#ffdd00] focus:outline-offset-0 text-center" />
            <span class="text-xs text-[#505a5f]">months</span>
        </div>`
    );

    html += `</div>`;

    // === Section 3: Technical Profile ===
    html += sectionHeading('Technical Profile');
    html += `<div class="grid grid-cols-2 gap-x-4 gap-y-2 mb-5">`;

    // Hosting
    const hostingSelected = system.isCloud === true ? 'Cloud' : (system.isCloud === false ? 'On-Premise' : '');
    html += renderRadioGroup({
        name: 'hosting',
        title: 'Hosting',
        options: ['Cloud', 'On-Premise'],
        selected: hostingSelected,
        hint: 'Where the system is primarily hosted.'
    });

    // Data Partitioning
    html += renderRadioGroup({
        name: 'dataPartitioning',
        title: 'Data Partitioning',
        options: ['Segmented', 'Monolithic'],
        selected: system.dataPartitioning || '',
        hint: 'Segmented: data separated by area. Monolithic: entangled across areas.'
    });

    // Data Portability
    html += renderRadioGroup({
        name: 'portability',
        title: 'Data Portability',
        options: ['High', 'Medium', 'Low'],
        selected: system.portability || '',
        hint: 'How easily data can be bulk-extracted.'
    });

    // Support Model
    html += fieldRow('Support Model',
        `<select data-prop-field="supportModel"
                 class="text-sm border-2 border-[#0b0c0c] p-1 focus:outline-3 focus:outline-[#ffdd00] focus:outline-offset-0">
            <option value="" ${!system.supportModel ? 'selected' : ''}>— Select —</option>
            <option value="vendor-supported" ${system.supportModel === 'vendor-supported' ? 'selected' : ''}>Vendor-supported</option>
            <option value="community-supported" ${system.supportModel === 'community-supported' ? 'selected' : ''}>Community-supported</option>
            <option value="unsupported" ${system.supportModel === 'unsupported' ? 'selected' : ''}>Unsupported</option>
        </select>`,
        'Ongoing maintenance and support model for this system.'
    );

    html += `</div>`;

    // === Delete system ===
    html += `<div class="mt-6 pt-4 border-t border-[#b1b4b6]">`;
    html += `<button type="button" data-prop-action="delete"
        class="text-sm text-[#d4351c] hover:text-[#942514] font-bold underline">Delete this system</button>`;
    html += `</div>`;

    html += `</div>`;
    return html;
}

// --- Event Wiring ---

/**
 * Wire event listeners for the properties panel.
 * @param {HTMLElement} container — DOM element containing the rendered props panel
 * @param {object} options
 * @param {function} options.onChange — (nodeIdx, field, value) called on field change
 * @param {function} options.onFunctionAdd — (nodeIdx, lgaId) called when a function chip is added
 * @param {function} options.onFunctionRemove — (nodeIdx, lgaId) called when a function chip is removed
 */
export function wirePropsPanel(container, options = {}) {
    const { onChange, onFunctionAdd, onFunctionRemove, onDelete } = options;
    const panel = container.querySelector('[data-props-panel]');
    if (!panel) return;

    // Get current nodeIdx from container data attribute
    function getNodeIdx() {
        const idx = container.dataset.selectedIdx;
        return idx != null ? parseInt(idx, 10) : null;
    }

    // Wire smart inputs (thousands formatting, radio changes, chip changes)
    wireSmartInputs(panel, {
        onChipChange(name, chips) {
            if (name !== 'functions') return;
            const nodeIdx = getNodeIdx();
            if (nodeIdx == null) return;

            // Determine removed chip by comparing with previous state
            // The chip removal is handled individually via the callback below
        },
        onRadioChange(name, value) {
            const nodeIdx = getNodeIdx();
            if (nodeIdx == null || !onChange) return;

            if (name === 'hosting') {
                onChange(nodeIdx, 'isCloud', value === 'Cloud');
            } else if (name === 'dataPartitioning') {
                onChange(nodeIdx, 'dataPartitioning', value);
            } else if (name === 'portability') {
                onChange(nodeIdx, 'portability', value);
            }
        }
    });

    // Chip removal — functions
    panel.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-chip-action="remove"][data-chip-name="functions"]');
        if (btn) {
            const chipValue = btn.dataset.chipValue;
            const nodeIdx = getNodeIdx();
            if (nodeIdx == null || !onFunctionRemove) return;
            const lgaFn = LGA_FUNCTIONS.find(f => f.label === chipValue);
            if (lgaFn) onFunctionRemove(nodeIdx, lgaFn.id);
            return;
        }

        // Delete system
        const deleteBtn = e.target.closest('[data-prop-action="delete"]');
        if (deleteBtn && onDelete) {
            const nodeIdx = getNodeIdx();
            if (nodeIdx == null) return;
            if (confirm('Delete this system? This will also remove all its edges.')) {
                onDelete(nodeIdx);
            }
        }
    });

    // Chip add — functions (on Enter in chip input)
    panel.addEventListener('keydown', (e) => {
        const target = e.target;
        if (!target.matches || !target.matches('[data-chip-action="input"][data-chip-name="functions"]')) return;
        if (e.key !== 'Enter') return;

        const value = target.value.trim();
        if (!value) return;

        const nodeIdx = getNodeIdx();
        if (nodeIdx == null || !onFunctionAdd) return;

        // Resolve lgaFunctionId from label
        const lgaFn = LGA_FUNCTIONS.find(f => f.label.toLowerCase() === value.toLowerCase());
        if (lgaFn) {
            onFunctionAdd(nodeIdx, lgaFn.id);
        }
    });

    // Text/number input change — blur-based for text, change for number/select
    panel.addEventListener('blur', (e) => {
        const input = e.target;
        if (!input.matches || !input.matches('[data-prop-field]')) return;
        const field = input.dataset.propField;
        const nodeIdx = getNodeIdx();
        if (nodeIdx == null || !onChange) return;

        let value;
        if (input.type === 'checkbox') return; // handled separately
        if (input.dataset.format === 'thousands') {
            value = parseThousands(input.value);
            if (isNaN(value)) value = null;
        } else if (input.type === 'number') {
            value = input.value ? parseInt(input.value, 10) : null;
        } else {
            value = input.value;
        }

        onChange(nodeIdx, field, value);
    }, true);

    // Checkbox change
    panel.addEventListener('change', (e) => {
        const input = e.target;
        if (!input.matches) return;

        if (input.matches('[data-prop-field]') && input.type === 'checkbox') {
            const field = input.dataset.propField;
            const nodeIdx = getNodeIdx();
            if (nodeIdx == null || !onChange) return;
            onChange(nodeIdx, field, input.checked);
        }

        // Select element
        if (input.matches('select[data-prop-field]')) {
            const field = input.dataset.propField;
            const nodeIdx = getNodeIdx();
            if (nodeIdx == null || !onChange) return;
            onChange(nodeIdx, field, input.value || null);
        }
    });
}

// --- Internal helpers ---

const KEY_FIELDS = ['vendor', 'annualCost', 'endYear', 'portability', 'dataPartitioning', 'isCloud', 'supportModel'];
const KEY_FIELD_LABELS = {
    vendor: 'Vendor',
    annualCost: 'Annual Cost',
    endYear: 'Contract End Year',
    portability: 'Data Portability',
    dataPartitioning: 'Data Partitioning',
    isCloud: 'Hosting',
    supportModel: 'Support Model'
};

function renderCompletenessBanner(system, editorState) {
    let html = '';

    // Critical structural errors (red)
    const errors = [];
    if (!system.label || !system.label.trim()) errors.push('System has no name');
    const hasFunction = editorState.edges.some(e => e.source === system.id && e.relationship === 'REALIZES');
    if (!hasFunction) errors.push('No function assigned — system won\'t appear in analysis');

    if (errors.length > 0) {
        html += `<div class="mb-2 p-2 bg-[#fce4e4] border-l-4 border-[#d4351c] text-sm">
            <span class="font-bold text-[#d4351c]">✗ ${errors.length} error${errors.length > 1 ? 's' : ''}:</span>
            <span class="text-[#0b0c0c] ml-1">${errors.join('; ')}</span>
        </div>`;
    }

    // Analysis field completeness (amber/green)
    const missing = KEY_FIELDS.filter(f => {
        const val = system[f];
        return val == null || val === '' || val === undefined;
    });
    if (missing.length === 0 && errors.length === 0) {
        html += `<div class="mb-3 p-2 bg-[#e6f4ea] border-l-4 border-[#00703c] text-sm text-[#00703c] font-bold">
            ✓ All fields complete
        </div>`;
    } else if (missing.length > 0) {
        const labels = missing.map(f => KEY_FIELD_LABELS[f]);
        html += `<div class="mb-3 p-2 bg-[#fef3e8] border-l-4 border-[#f47738] text-sm">
            <span class="font-bold text-[#f47738]">⚠ ${missing.length} field${missing.length > 1 ? 's' : ''} needed for analysis:</span>
            <span class="text-[#505a5f] ml-1">${labels.join(', ')}</span>
        </div>`;
    }

    return html;
}

/**
 * Render a section heading.
 */
function sectionHeading(title) {
    return `<div class="font-bold text-[#0b0c0c] text-sm border-b border-[#b1b4b6] pb-1 mb-3">${escHtml(title)}</div>`;
}

/**
 * Render a labelled field row.
 * @param {string} label
 * @param {string} inputHtml
 * @param {string} [hint] — optional hint text
 */
function fieldRow(label, inputHtml, hint) {
    const hintHtml = hint ? `<span class="text-xs text-[#505a5f] mt-0.5">${escHtml(hint)}</span>` : '';
    return `<div class="flex flex-col gap-0.5">
        <label class="font-bold text-[#0b0c0c] text-sm">${escHtml(label)}</label>
        ${hintHtml}
        ${inputHtml}
    </div>`;
}

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
