import { state } from '../state.js';
import { LGA_FUNCTIONS } from '../constants/lga-functions.js';
import { getLgaFunction } from '../taxonomy.js';
import { escHtml } from '../ui-helpers.js';


const IMPORT_TARGET_FIELDS = [
    { section: 'System Details', fields: [
        { id: 'label',          label: 'System Name *',         required: true },
        { id: 'vendor',         label: 'Vendor / Supplier',     required: false },
        { id: 'owner',          label: 'Owner',                 required: false }
    ]},
    { section: 'Commercial', fields: [
        { id: 'cost',           label: 'Cost (string)',         required: false },
        { id: 'annualCost',     label: 'Annual Cost (number)',  required: false },
        { id: 'endYear',        label: 'Contract End Year',     required: false },
        { id: 'endMonth',       label: 'Contract End Month',    required: false },
        { id: 'noticePeriod',   label: 'Notice Period (months)',required: false }
    ]},
    { section: 'Technical', fields: [
        { id: 'portability',    label: 'Portability',           required: false },
        { id: 'dataPartitioning',label: 'Data Partitioning',    required: false },
        { id: 'isCloud',        label: 'Is Cloud / Hosted',     required: false },
        { id: 'isERP',          label: 'Is ERP',                required: false },
        { id: 'users',          label: 'User Count',            required: false }
    ]},
    { section: 'Relationships', fields: [
        { id: 'sharedWith',     label: 'Shared With',           required: false },
        { id: '_rawDepartment', label: 'Department / Service Area', required: false }
    ]}
];


// Auto-detection rules: each entry is {field, test} where test(header) returns true if likely match
const IMPORT_AUTODETECT_RULES = [
    { field: 'label',            test: h => /system|application|app\b|^name$/i.test(h) },
    { field: 'vendor',           test: h => /vendor|supplier/i.test(h) },
    { field: 'users',            test: h => /\buser/i.test(h) },
    { field: 'annualCost',       test: h => /annual|yearly/i.test(h) },
    { field: 'cost',             test: h => /cost/i.test(h) && !/annual|yearly/i.test(h) },
    { field: 'endYear',          test: h => /contract/i.test(h) && /end|expir/i.test(h) },
    { field: 'endMonth',         test: h => /end\s*month|contract\s*month/i.test(h) && !/year/i.test(h) },
    { field: 'noticePeriod',     test: h => /notice/i.test(h) },
    { field: 'isCloud',          test: h => /cloud|hosted|hosting/i.test(h) },
    { field: 'isERP',            test: h => /\berp\b/i.test(h) },
    { field: '_rawDepartment',   test: h => /department|service area|function|directorate/i.test(h) },
    { field: 'sharedWith',       test: h => /shared/i.test(h) },
    { field: 'portability',      test: h => /portab/i.test(h) },
    { field: 'dataPartitioning', test: h => /partition/i.test(h) }
];


function autoDetectColumnMap(headers) {
    const map = {};
    headers.forEach(h => {
        for (const rule of IMPORT_AUTODETECT_RULES) {
            if (rule.test(h) && !Object.values(map).includes(h)) {
                if (!map[rule.field]) map[rule.field] = h;
                break;
            }
        }
    });
    return map;
}


function coerceImportedRow(raw, columnMap) {
    const sys = {};
    // Helper to get raw value by mapped column
    const get = field => {
        const col = columnMap[field];
        return col ? raw[col] : undefined;
    };

    // String fields
    if (get('label'))  sys.label  = String(get('label')).trim();
    if (get('vendor')) sys.vendor = String(get('vendor')).trim();
    if (get('owner'))  sys.owner  = String(get('owner')).trim();
    if (get('cost'))   sys.cost   = String(get('cost')).trim();

    // Numeric fields
    ['annualCost','endYear','endMonth','noticePeriod','users'].forEach(f => {
        const v = get(f);
        if (v !== undefined && v !== null && v !== '') {
            const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
            if (!isNaN(n)) sys[f] = n;
        }
    });

    // Boolean fields
    const parseBool = (v, falseyExtra) => {
        if (v === undefined || v === null || v === '') return undefined;
        const s = String(v).toLowerCase().trim();
        if (['yes','true','1','y'].includes(s)) return true;
        const falsey = ['no','false','0','n'].concat(falseyExtra || []);
        if (falsey.some(f => s.includes(f))) return false;
        return undefined;
    };
    const cloudVal = parseBool(get('isCloud'), ['on-premise','on premise','onpremise']);
    if (cloudVal !== undefined) sys.isCloud = cloudVal;
    const erpVal = parseBool(get('isERP'));
    if (erpVal !== undefined) sys.isERP = erpVal;

    // sharedWith — array
    const sw = get('sharedWith');
    if (sw !== undefined && sw !== null && String(sw).trim() !== '') {
        sys.sharedWith = String(sw).split(/[,;]/).map(s => s.trim()).filter(Boolean);
    }

    // portability — validated enum
    const portRaw = get('portability');
    if (portRaw) {
        const p = String(portRaw).trim();
        const match = ['High','Medium','Low'].find(v => v.toLowerCase() === p.toLowerCase());
        if (match) sys.portability = match;
    }

    // dataPartitioning — validated enum
    const dpRaw = get('dataPartitioning');
    if (dpRaw) {
        const dp = String(dpRaw).trim();
        const match = ['Segmented','Monolithic'].find(v => v.toLowerCase() === dp.toLowerCase());
        if (match) sys.dataPartitioning = match;
    }

    // _rawDepartment — keep as string (for later function mapping)
    const dept = get('_rawDepartment');
    if (dept !== undefined && dept !== null && String(dept).trim() !== '') {
        sys._rawDepartment = String(dept).trim();
    }

    return sys;
}


function deduplicateImportedSystems(systems) {
    const seen = new Map(); // key: label+vendor (lower) -> index in result
    const result = [];
    systems.forEach(sys => {
        if (!sys.label) return;
        const key = (sys.label + '|' + (sys.vendor || '')).toLowerCase();
        if (seen.has(key)) {
            const idx = seen.get(key);
            // Merge _rawDepartment
            if (sys._rawDepartment) {
                const existing = result[idx]._rawDepartments || [];
                if (result[idx]._rawDepartment && !existing.includes(result[idx]._rawDepartment)) {
                    existing.push(result[idx]._rawDepartment);
                }
                if (!existing.includes(sys._rawDepartment)) {
                    existing.push(sys._rawDepartment);
                }
                result[idx]._rawDepartments = existing;
                delete result[idx]._rawDepartment;
            }
        } else {
            seen.set(key, result.length);
            result.push({ ...sys });
        }
    });
    return result;
}


function openImportWizard(mode) {
    mode = mode || 'file';
    state.importWizardState = {
        step: 1,
        mode: mode,
        councilName: '',
        councilTier: '',
        financialDistress: false,
        rawRows: null,
        headers: [],
        columnMap: {},
        mappedSystems: [],
        functionAssignments: new Map(),
        manualSystems: []  // used in manual mode before conversion to mappedSystems
    };
    renderImportWizardStep();
    document.getElementById('importWizardModal').classList.remove('hidden');
}


function closeImportWizard() {
    state.importWizardState = null;
    document.getElementById('importWizardModal').classList.add('hidden');
    document.getElementById('importWizardError').classList.add('hidden');
}


function updateImportWizardStepBar(step) {
    const mode = state.importWizardState ? state.importWizardState.mode : 'file';

    // Update modal title
    const titleEl = document.getElementById('importWizardTitle');
    if (titleEl) titleEl.textContent = mode === 'manual' ? 'Build Register from Scratch' : 'Import from Spreadsheet';

    // In manual mode, steps 2 and 3 collapse to a single "Add Systems" step (logical step 2, displayed at position 2).
    // Step 3 indicator is hidden; step 4 is the Review step.
    // We map logical display steps: file=[1,2,3,4], manual=[1,2,_,4] where _ is hidden.
    const stepLabels = mode === 'manual'
        ? { 1: 'Council Info', 2: 'Add Systems', 3: null, 4: 'Review' }
        : { 1: 'Source', 2: 'Column Mapping', 3: 'Function Mapping', 4: 'Review' };

    // Show/hide step 3 indicator and its preceding separator in manual mode
    const step3El = document.querySelector('.import-step-item-3');
    const step3Sep = document.querySelector('.import-step-sep-2');
    if (step3El) step3El.classList.toggle('hidden', mode === 'manual');
    if (step3Sep) step3Sep.classList.toggle('hidden', mode === 'manual');

    // Determine effective step number for visual highlighting.
    // In manual mode, step 4 (Review) appears after step 2 (Add Systems), so we highlight step 4 at position 4.
    document.querySelectorAll('.import-step-indicator').forEach(el => {
        const s = parseInt(el.getAttribute('data-step'));
        if (mode === 'manual' && s === 3) return; // hidden, skip
        const num = el.querySelector('.import-step-num');
        const labelEl = el.querySelector('.import-step-label');
        if (labelEl && stepLabels[s] !== null && stepLabels[s] !== undefined) {
            labelEl.textContent = stepLabels[s];
        }
        // In manual mode, logical progress: step goes 1→2→4. Renumber step 4 display to "3".
        let displayNum = s;
        if (mode === 'manual' && s === 4) { displayNum = 3; if (num) num.textContent = '3'; }
        else if (mode === 'file' && num) { num.textContent = String(s); }

        if (s === step) {
            el.classList.add('border-[#1d70b8]', 'text-[#1d70b8]');
            el.classList.remove('border-transparent', 'text-gray-400', 'border-[#00703c]', 'text-[#00703c]');
            if (num) { num.classList.add('bg-[#1d70b8]', 'text-white'); num.classList.remove('bg-gray-200', 'text-gray-500', 'bg-[#00703c]'); }
        } else if (s < step || (mode === 'manual' && step === 4 && s === 2)) {
            el.classList.remove('border-[#1d70b8]', 'text-[#1d70b8]', 'border-transparent');
            el.classList.add('border-[#00703c]', 'text-[#00703c]');
            if (num) { num.classList.remove('bg-[#1d70b8]', 'text-white', 'bg-gray-200', 'text-gray-500'); num.classList.add('bg-[#00703c]', 'text-white'); }
        } else {
            el.classList.remove('border-[#1d70b8]', 'text-[#1d70b8]', 'border-[#00703c]', 'text-[#00703c]');
            el.classList.add('border-transparent', 'text-gray-400');
            if (num) { num.classList.remove('bg-[#1d70b8]', 'text-white', 'bg-[#00703c]'); num.classList.add('bg-gray-200', 'text-gray-500'); }
        }
    });
}


function setImportWizardError(msg) {
    const el = document.getElementById('importWizardError');
    if (msg) {
        el.textContent = msg;
        el.classList.remove('hidden');
    } else {
        el.classList.add('hidden');
        el.textContent = '';
    }
}


function renderImportWizardStep() {
    const state = state.importWizardState;
    if (!state) return;
    updateImportWizardStepBar(state.step);
    setImportWizardError(null);
    const content = document.getElementById('importWizardContent');
    const backBtn = document.getElementById('btnImportBack');
    const nextBtn = document.getElementById('btnImportNext');
    const isManual = state.mode === 'manual';

    if (state.step === 1) {
        backBtn.classList.add('invisible');
        nextBtn.textContent = 'Next';
        nextBtn.disabled = false;
        content.innerHTML = buildImportStep1HTML();
        if (!isManual) wireImportStep1DragDrop();
    } else if (state.step === 2) {
        backBtn.classList.remove('invisible');
        nextBtn.textContent = 'Next';
        nextBtn.disabled = false;
        if (isManual) {
            content.innerHTML = buildImportStep2aHTML();
        } else {
            content.innerHTML = buildImportStep2HTML();
            updateImportStep2Preview();
        }
    } else if (state.step === 3) {
        backBtn.classList.remove('invisible');
        nextBtn.textContent = 'Next';
        nextBtn.disabled = false;
        content.innerHTML = buildImportStep3HTML();
    } else if (state.step === 4) {
        backBtn.classList.remove('invisible');
        nextBtn.textContent = 'Import';
        nextBtn.disabled = false;
        content.innerHTML = buildImportStep4HTML();
    }
}


function buildImportStep1HTML() {
    const s = state.importWizardState;
    const isManual = s.mode === 'manual';
    const dataSourceSection = isManual ? `
        <div class="p-4 bg-blue-50 border-l-4 border-l-[#1d70b8] text-sm">
            <p class="font-bold text-[#1d70b8] mb-1">Building from scratch</p>
            <p class="text-gray-700">You'll add systems manually in the next step. Each system can be linked to one or more ESD standard functions inline.</p>
        </div>` : `
        <div class="space-y-4">
            <p class="font-bold text-sm">Data source</p>
            <!-- Upload file card -->
            <div id="importFileCard" class="border-2 border-[#b1b4b6] p-4 hover:border-[#1d70b8] transition-colors">
                <p class="font-bold text-sm mb-2">Upload a file</p>
                <p class="text-xs text-gray-600 mb-3">Supported formats: CSV, TSV, Excel (.xlsx, .xls) &mdash; <button id="btnDownloadTemplateCSV" class="text-[#1d70b8] underline text-xs font-bold bg-transparent border-none cursor-pointer p-0">Download template CSV</button></p>
                <label class="gds-btn-secondary px-3 py-2 text-sm font-bold cursor-pointer inline-block">
                    Choose file
                    <input type="file" id="importFileInput" accept=".csv,.tsv,.xlsx,.xls" class="sr-only">
                </label>
                <span id="importFileLabel" class="ml-3 text-sm text-gray-600">${s.rawRows ? escHtml(s._sourceFilename || 'File loaded') : 'No file chosen'}</span>
                <div id="importFileLoading" class="hidden mt-2 text-sm text-[#1d70b8] font-bold">Loading library for Excel files...</div>
            </div>
            <!-- Paste card -->
            <div class="border-2 border-[#b1b4b6] p-4 hover:border-[#1d70b8] transition-colors">
                <p class="font-bold text-sm mb-2">Paste from clipboard</p>
                <p class="text-xs text-gray-600 mb-3">Paste tab-separated data (e.g. copied from Excel or a spreadsheet)</p>
                <textarea id="importPasteArea" class="border-2 border-[#b1b4b6] p-2 text-sm w-full font-mono" rows="5"
                    placeholder="Paste data here (first row should be headers)...">${s._pastedText || ''}</textarea>
                <button id="btnImportProcessPaste" class="gds-btn-secondary px-3 py-2 text-sm font-bold mt-2">Process pasted data</button>
            </div>
        </div>
        ${s.rawRows ? `<div class="p-3 bg-green-50 border-l-4 border-l-[#00703c] text-[#00703c] font-bold text-sm">
            ${s.rawRows.length} rows parsed. ${s.headers.length} columns detected.
        </div>` : ''}`;

    return `
    <div class="space-y-6 p-2">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label class="block font-bold mb-1 text-sm" for="importCouncilName">Council Name <span class="text-[#d4351c]">*</span></label>
                <input id="importCouncilName" type="text" class="border-2 border-[#0b0c0c] p-2 text-base w-full"
                    value="${escHtml(s.councilName || '')}" placeholder="e.g. Northshire County Council">
            </div>
            <div>
                <label class="block font-bold mb-1 text-sm" for="importCouncilTier">Council Tier</label>
                <select id="importCouncilTier" class="border-2 border-[#0b0c0c] p-2 text-base w-full">
                    <option value="">-- not set --</option>
                    ${['county','district','borough','unitary'].map(t => `<option value="${t}" ${s.councilTier===t?'selected':''}>${t}</option>`).join('')}
                </select>
            </div>
        </div>
        <div class="flex items-center gap-3">
            <input id="importFinancialDistress" type="checkbox" ${s.financialDistress?'checked':''} class="w-5 h-5 cursor-pointer">
            <label for="importFinancialDistress" class="font-bold text-sm cursor-pointer">Financial Distress</label>
        </div>
        <hr class="border-gray-200">
        ${dataSourceSection}
    </div>`;
}


function buildImportStep2HTML() {
    const s = state.importWizardState;
    const headers = s.headers;
    const previewRows = (s.rawRows || []).slice(0, 5);

    // Build preview table
    let previewTableHTML = `<div class="overflow-x-auto text-xs">
        <table class="gds-table">
            <thead><tr>${headers.map(h => `<th class="px-2 py-1 whitespace-nowrap">${escHtml(h)}</th>`).join('')}</tr></thead>
            <tbody>${previewRows.map(row => `<tr>${headers.map(h => `<td class="px-2 py-1 whitespace-nowrap max-w-xs truncate">${escHtml(String(row[h] ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
    </div>`;

    // Build column mapping controls
    const colOptions = `<option value="">(skip)</option>` + headers.map(h => `<option value="${escHtml(h)}">${escHtml(h)}</option>`).join('');
    let mappingHTML = IMPORT_TARGET_FIELDS.map(section => {
        const rows = section.fields.map(f => {
            const selected = s.columnMap[f.id] || '';
            return `<div class="flex items-center gap-2 mb-2">
                <label class="text-xs font-bold w-40 flex-shrink-0">${escHtml(f.label)}</label>
                <select class="import-col-map-select border border-[#b1b4b6] p-1 text-xs flex-1" data-field="${f.id}">
                    ${colOptions.replace(`value="${escHtml(selected)}"`, `value="${escHtml(selected)}" selected`)}
                </select>
            </div>`;
        }).join('');
        return `<div class="mb-4">
            <p class="font-bold text-xs uppercase tracking-wider text-gray-500 mb-2">${escHtml(section.section)}</p>
            ${rows}
        </div>`;
    }).join('');

    return `
    <div class="flex flex-col lg:flex-row gap-4 h-full">
        <!-- Left: preview table (60%) -->
        <div class="lg:w-3/5 flex-shrink-0">
            <p class="font-bold text-sm mb-2">Data preview (first 5 rows)</p>
            ${previewTableHTML}
        </div>
        <!-- Right: mapping (40%) -->
        <div class="lg:w-2/5 overflow-y-auto">
            <p class="font-bold text-sm mb-3">Map columns to fields</p>
            ${mappingHTML}
            <hr class="my-4 border-gray-200">
            <p class="font-bold text-sm mb-2">Live preview (first row)</p>
            <div id="importMappingPreview" class="text-xs bg-gray-50 border border-gray-200 p-3 rounded font-mono whitespace-pre-wrap"></div>
        </div>
    </div>`;
}


function updateImportStep2Preview() {
    const s = state.importWizardState;
    const previewEl = document.getElementById('importMappingPreview');
    if (!previewEl || !s.rawRows || !s.rawRows.length) return;
    const firstRow = s.rawRows[0];
    const coerced = coerceImportedRow(firstRow, s.columnMap);
    previewEl.textContent = JSON.stringify(coerced, null, 2);
}


function buildManualSystemCardHTML(idx, sys) {
    // sys may be a partial object from state, or a blank default
    sys = sys || {};
    const isExpanded = sys._expanded !== false; // default expanded
    const label = escHtml(sys.label || '');
    const vendor = escHtml(sys.vendor || '');
    const owner = escHtml(sys.owner || '');
    const users = sys.users !== undefined ? sys.users : '';
    const annualCost = sys.annualCost !== undefined ? sys.annualCost : '';
    const endYear = sys.endYear !== undefined ? sys.endYear : '';
    const endMonth = sys.endMonth !== undefined ? sys.endMonth : '';
    const noticePeriod = sys.noticePeriod !== undefined ? sys.noticePeriod : '';
    const portability = sys.portability || 'High';
    const dataPartitioning = sys.dataPartitioning || 'Segmented';
    const isCloud = sys.isCloud !== false;  // default true
    const isERP = !!sys.isERP;
    const sharedWith = escHtml((sys.sharedWith || []).join(', '));

    const monthOptions = Array.from({length: 12}, (_, i) => {
        const m = i + 1;
        return `<option value="${m}" ${endMonth == m ? 'selected' : ''}>${m}</option>`;
    }).join('');

    // Function assignments for this system
    const assignments = state.importWizardState.functionAssignments;
    const fnPickerHTML = buildFnPickerHTML('sys:' + idx, idx, assignments);

    const bodyClass = isExpanded ? '' : 'hidden';

    return `<div class="manual-sys-card border-2 border-[#b1b4b6] mb-3" data-card-idx="${idx}">
        <div class="manual-sys-card-header flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer select-none" data-card-idx="${idx}">
            <span class="font-bold text-sm">System ${idx + 1}${label ? ': ' + label : ''}</span>
            <div class="flex items-center gap-3">
                <button class="manual-sys-remove text-xs text-[#d4351c] font-bold underline" data-card-idx="${idx}" type="button">Remove</button>
                <span class="manual-sys-toggle text-gray-400 text-lg font-bold">${isExpanded ? '&#9650;' : '&#9660;'}</span>
            </div>
        </div>
        <div class="manual-sys-card-body px-4 py-4 space-y-4 ${bodyClass}">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="md:col-span-2">
                    <label class="block font-bold mb-1 text-xs" for="manual-label-${idx}">System Name <span class="text-[#d4351c]">*</span></label>
                    <input id="manual-label-${idx}" type="text" class="manual-field border-2 border-[#0b0c0c] p-2 text-sm w-full" data-field="label" data-idx="${idx}"
                        value="${label}" placeholder="e.g. Liquidlogic LAS">
                </div>
                <div>
                    <label class="block font-bold mb-1 text-xs" for="manual-vendor-${idx}">Vendor / Supplier</label>
                    <input id="manual-vendor-${idx}" type="text" class="manual-field border-2 border-[#b1b4b6] p-2 text-sm w-full" data-field="vendor" data-idx="${idx}"
                        value="${vendor}" placeholder="e.g. Capita">
                </div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                    <label class="block font-bold mb-1 text-xs" for="manual-users-${idx}">Users</label>
                    <input id="manual-users-${idx}" type="number" min="0" class="manual-field border-2 border-[#b1b4b6] p-2 text-sm w-full" data-field="users" data-idx="${idx}"
                        value="${users}" placeholder="e.g. 150">
                </div>
                <div>
                    <label class="block font-bold mb-1 text-xs" for="manual-annualCost-${idx}">Annual Cost (£)</label>
                    <input id="manual-annualCost-${idx}" type="number" min="0" class="manual-field border-2 border-[#b1b4b6] p-2 text-sm w-full" data-field="annualCost" data-idx="${idx}"
                        value="${annualCost}" placeholder="e.g. 50000">
                </div>
                <div>
                    <label class="block font-bold mb-1 text-xs" for="manual-noticePeriod-${idx}">Notice Period (months)</label>
                    <input id="manual-noticePeriod-${idx}" type="number" min="0" class="manual-field border-2 border-[#b1b4b6] p-2 text-sm w-full" data-field="noticePeriod" data-idx="${idx}"
                        value="${noticePeriod}" placeholder="e.g. 6">
                </div>
                <div>
                    <label class="block font-bold mb-1 text-xs" for="manual-owner-${idx}">Owner</label>
                    <input id="manual-owner-${idx}" type="text" class="manual-field border-2 border-[#b1b4b6] p-2 text-sm w-full" data-field="owner" data-idx="${idx}"
                        value="${owner}" placeholder="e.g. Finance Dept">
                </div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                    <label class="block font-bold mb-1 text-xs">Contract End</label>
                    <div class="flex gap-2">
                        <input type="number" class="manual-field border-2 border-[#b1b4b6] p-2 text-sm w-24" data-field="endYear" data-idx="${idx}"
                            value="${endYear}" placeholder="Year" min="2020" max="2040" aria-label="Contract end year">
                        <select class="manual-field border-2 border-[#b1b4b6] p-2 text-sm" data-field="endMonth" data-idx="${idx}" aria-label="Contract end month">
                            <option value="">Month</option>
                            ${monthOptions}
                        </select>
                    </div>
                </div>
                <div>
                    <label class="block font-bold mb-1 text-xs">Hosting</label>
                    <div class="flex gap-4 mt-1">
                        <label class="flex items-center gap-1 text-xs cursor-pointer">
                            <input type="radio" class="manual-field" name="manual-isCloud-${idx}" data-field="isCloud" data-idx="${idx}" value="true" ${isCloud ? 'checked' : ''}>
                            Cloud
                        </label>
                        <label class="flex items-center gap-1 text-xs cursor-pointer">
                            <input type="radio" class="manual-field" name="manual-isCloud-${idx}" data-field="isCloud" data-idx="${idx}" value="false" ${!isCloud ? 'checked' : ''}>
                            On-premise
                        </label>
                    </div>
                </div>
                <div>
                    <label class="block font-bold mb-1 text-xs">Portability</label>
                    <div class="flex gap-3 mt-1">
                        ${['High','Medium','Low'].map(v => `<label class="flex items-center gap-1 text-xs cursor-pointer">
                            <input type="radio" class="manual-field" name="manual-portability-${idx}" data-field="portability" data-idx="${idx}" value="${v}" ${portability === v ? 'checked' : ''}>
                            ${v}
                        </label>`).join('')}
                    </div>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block font-bold mb-1 text-xs">Data Partitioning</label>
                    <div class="flex gap-4 mt-1">
                        ${['Segmented','Monolithic'].map(v => `<label class="flex items-center gap-1 text-xs cursor-pointer">
                            <input type="radio" class="manual-field" name="manual-dataPartitioning-${idx}" data-field="dataPartitioning" data-idx="${idx}" value="${v}" ${dataPartitioning === v ? 'checked' : ''}>
                            ${v}
                        </label>`).join('')}
                    </div>
                </div>
                <div>
                    <label class="block font-bold mb-1 text-xs">Shared With (comma-separated)</label>
                    <input type="text" class="manual-field border-2 border-[#b1b4b6] p-2 text-sm w-full" data-field="sharedWith" data-idx="${idx}"
                        value="${sharedWith}" placeholder="e.g. Eastgate District, Westbrook Borough">
                </div>
            </div>
            <div class="flex items-center gap-3">
                <input type="checkbox" id="manual-isERP-${idx}" class="manual-field w-4 h-4 cursor-pointer" data-field="isERP" data-idx="${idx}" ${isERP ? 'checked' : ''}>
                <label for="manual-isERP-${idx}" class="font-bold text-xs cursor-pointer">This is an ERP system</label>
            </div>
            <div>
                <label class="block font-bold mb-1 text-xs">ESD Function Assignment</label>
                <p class="text-xs text-gray-500 mb-2">Link this system to one or more standard ESD functions. Type a function ID or name below.</p>
                ${fnPickerHTML}
            </div>
        </div>
    </div>`;
}


function buildImportStep2aHTML() {
    const s = state.importWizardState;
    const systems = s.manualSystems || [];
    // Always show at least one empty card
    const count = Math.max(systems.length, 1);
    let cardsHTML = '';
    for (let i = 0; i < count; i++) {
        cardsHTML += buildManualSystemCardHTML(i, systems[i] || null);
    }
    return `
    <div class="space-y-4 p-2">
        <p class="text-sm text-gray-700">Add each IT system for <strong>${escHtml(s.councilName || 'this council')}</strong>. Expand a card to fill in details and assign ESD functions.</p>
        <div id="manualSystemCards">${cardsHTML}</div>
        <button id="btnAddManualSystem" class="gds-btn-secondary px-4 py-2 font-bold text-sm" type="button">+ Add another system</button>
    </div>`;
}


function readManualSystemsFromDOM() {
    // Reads all manual-sys-card elements and builds manualSystems array
    const cards = document.querySelectorAll('.manual-sys-card');
    const systems = [];
    cards.forEach(card => {
        const idx = parseInt(card.getAttribute('data-card-idx'));
        const sys = {};
        card.querySelectorAll('.manual-field').forEach(el => {
            const field = el.getAttribute('data-field');
            if (!field) return;
            if (el.type === 'radio') {
                if (!el.checked) return;
                if (field === 'isCloud') sys.isCloud = el.value === 'true';
                else sys[field] = el.value;
            } else if (el.type === 'checkbox') {
                sys[field] = el.checked;
            } else if (el.type === 'number') {
                const v = el.value.trim();
                if (v !== '') sys[field] = parseFloat(v);
            } else {
                const v = el.value.trim();
                if (v === '') return;
                // Coerce numeric-valued selects (endMonth, endYear, noticePeriod) to numbers
                if (['endMonth', 'endYear', 'noticePeriod'].includes(field)) {
                    const n = parseInt(v, 10);
                    if (!isNaN(n)) { sys[field] = n; return; }
                }
                sys[field] = v;
            }
        });
        // sharedWith: convert comma string to array
        if (typeof sys.sharedWith === 'string') {
            sys.sharedWith = sys.sharedWith.split(',').map(s => s.trim()).filter(Boolean);
        }
        // Preserve expansion state
        const body = card.querySelector('.manual-sys-card-body');
        sys._expanded = body ? !body.classList.contains('hidden') : true;
        systems.push({ idx, sys });
    });
    // Store in state preserving card order
    return systems.map(x => x.sys);
}


function wireImportStep1DragDrop() {
    const fileCard = document.getElementById('importFileCard');
    if (!fileCard) return;
    fileCard.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        fileCard.classList.add('border-[#1d70b8]', 'bg-blue-50');
        fileCard.classList.remove('border-[#b1b4b6]');
    });
    fileCard.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        fileCard.classList.remove('border-[#1d70b8]', 'bg-blue-50');
        fileCard.classList.add('border-[#b1b4b6]');
    });
    fileCard.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        fileCard.classList.remove('border-[#1d70b8]', 'bg-blue-50');
        fileCard.classList.add('border-[#b1b4b6]');
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) handleImportFileSelect(file);
    });
}


function downloadTemplateCSV() {
    const headers = ['System Name','Vendor','Owner','Annual Cost','Contract End Year','Contract End Month','Notice Period (months)','Users','Portability','Data Partitioning','Cloud Hosted','Is ERP','Shared With','Department / Service Area'];
    const example = ['My System','Vendor Ltd','Council Name','50000','2028','3','6','100','High','Segmented','Yes','No','Other Council','Waste Management'];
    const csv = headers.join(',') + '\n' + example.join(',');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'council-systems-template.csv'; a.click();
    URL.revokeObjectURL(url);
}


function suggestLgaFunctions(rawText, topN = 3) {
    const stopwords = new Set(['and','the','of','for','in','to','a','an','at','by','or']);
    const normalise = text => text.toLowerCase()
        .split(/[\s\/,&\-]+/)
        .map(t => t.replace(/[^a-z0-9]/g, ''))
        .filter(t => t.length > 1 && !stopwords.has(t));

    const inputTokens = normalise(rawText);
    if (inputTokens.length === 0) return [];

    return LGA_FUNCTIONS.map(fn => {
        const fnTokens = normalise(fn.label);
        const parent = fn.parentId ? getLgaFunction(fn.parentId) : null;
        const allFnTokens = parent ? [...fnTokens, ...normalise(parent.label)] : fnTokens;
        const intersection = inputTokens.filter(t =>
            allFnTokens.some(ft => ft.includes(t) || t.includes(ft))
        );
        const score = intersection.length / Math.max(inputTokens.length, fnTokens.length);
        return { fn, score };
    })
    .filter(s => s.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}


function buildImportStep3HTML() {
    const s = state.importWizardState;
    const systems = s.mappedSystems || [];
    const assignments = s.functionAssignments || new Map();

    // Count how many systems have at least one assignment
    const mappedCount = systems.filter((_, i) => (assignments.get(i) || []).length > 0).length;
    const allMapped = mappedCount === systems.length;
    const summaryColour = allMapped ? 'bg-green-50 border-l-[#00703c] text-[#00703c]' : 'bg-yellow-50 border-l-[#f47738] text-[#0b0c0c]';

    // Check if any system has _rawDepartment or _rawDepartments
    const hasDeptColumn = systems.some(sys => sys._rawDepartment || (sys._rawDepartments && sys._rawDepartments.length));

    let bodyHTML = '';

    if (hasDeptColumn) {
        // Group by department
        const deptGroups = new Map(); // deptText -> [sysIdx]
        const noDept = [];
        systems.forEach((sys, idx) => {
            const depts = sys._rawDepartments || (sys._rawDepartment ? [sys._rawDepartment] : []);
            if (depts.length === 0) {
                noDept.push(idx);
            } else {
                depts.forEach(d => {
                    if (!deptGroups.has(d)) deptGroups.set(d, []);
                    deptGroups.get(d).push(idx);
                });
            }
        });

        deptGroups.forEach((indices, deptText) => {
            const suggestions = suggestLgaFunctions(deptText, 3);
            const pillsHTML = suggestions.map(s =>
                `<button class="import-fn-suggestion-pill bg-blue-50 text-[#1d70b8] border border-[#1d70b8] px-2 py-1 text-xs font-bold cursor-pointer hover:bg-[#1d70b8] hover:text-white" data-dept="${escHtml(deptText)}" data-fn-id="${escHtml(s.fn.id)}">${escHtml(s.fn.id + ' — ' + s.fn.label)}</button>`
            ).join(' ');

            bodyHTML += `<tr class="bg-gray-50 border-b-2 border-gray-300">
                <td colspan="3" class="px-3 py-2">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="font-bold text-sm">${escHtml(deptText)}</span>
                        ${pillsHTML ? `<span class="text-xs text-gray-500 ml-2">Suggested:</span> ${pillsHTML}` : ''}
                        <button class="import-apply-group-fn ml-auto text-xs text-[#1d70b8] underline font-bold" data-dept="${escHtml(deptText)}">Apply group assignment to all</button>
                        <div class="w-full mt-1">${buildFnPickerHTML('grp:' + deptText, 0, assignments)}</div>
                    </div>
                </td>
            </tr>`;

            indices.forEach(idx => {
                const sys = systems[idx];
                const sysAssignments = assignments.get(idx) || [];
                bodyHTML += `<tr class="border-b border-gray-100">
                    <td class="px-3 py-2 pl-8 text-sm font-medium">${escHtml(sys.label)}</td>
                    <td class="px-3 py-2 text-sm text-gray-500">${escHtml(sys.vendor || '')}</td>
                    <td class="px-3 py-2">${buildFnPickerHTML('sys:' + idx, idx, assignments)}</td>
                </tr>`;
            });
        });

        if (noDept.length > 0) {
            bodyHTML += `<tr class="bg-gray-50 border-b-2 border-gray-300">
                <td colspan="3" class="px-3 py-2 font-bold text-sm text-gray-600">No department assigned</td>
            </tr>`;
            noDept.forEach(idx => {
                const sys = systems[idx];
                bodyHTML += `<tr class="border-b border-gray-100">
                    <td class="px-3 py-2 pl-8 text-sm font-medium">${escHtml(sys.label)}</td>
                    <td class="px-3 py-2 text-sm text-gray-500">${escHtml(sys.vendor || '')}</td>
                    <td class="px-3 py-2">${buildFnPickerHTML('sys:' + idx, idx, assignments)}</td>
                </tr>`;
            });
        }

    } else {
        // Flat list with batch selection
        systems.forEach((sys, idx) => {
            bodyHTML += `<tr class="border-b border-gray-100">
                <td class="px-3 py-2 text-center">
                    <input type="checkbox" class="import-sys-checkbox w-4 h-4 cursor-pointer" data-idx="${idx}">
                </td>
                <td class="px-3 py-2 text-sm font-medium">${escHtml(sys.label)}</td>
                <td class="px-3 py-2 text-sm text-gray-500">${escHtml(sys.vendor || '')}</td>
                <td class="px-3 py-2">${buildFnPickerHTML('sys:' + idx, idx, assignments)}</td>
            </tr>`;
        });
    }

    const batchBar = !hasDeptColumn ? `
        <div class="flex items-center gap-3 mb-3 p-2 bg-gray-50 border border-gray-200">
            <span class="text-xs font-bold text-gray-600">Batch assign selected:</span>
            <input type="text" id="importBatchFnInput" list="lgaFunctionsDatalist" class="border border-[#b1b4b6] p-1 text-xs w-52" placeholder="Type function ID or name...">
            <button id="btnImportApplyBatch" class="gds-btn-secondary px-3 py-1 text-xs font-bold">Assign to checked</button>
        </div>` : '';

    const colHeaders = hasDeptColumn
        ? `<th class="px-3 py-2 text-left text-xs font-bold uppercase text-gray-500">System</th><th class="px-3 py-2 text-left text-xs font-bold uppercase text-gray-500">Vendor</th><th class="px-3 py-2 text-left text-xs font-bold uppercase text-gray-500">ESD Function</th>`
        : `<th class="px-3 py-2 w-8"></th><th class="px-3 py-2 text-left text-xs font-bold uppercase text-gray-500">System</th><th class="px-3 py-2 text-left text-xs font-bold uppercase text-gray-500">Vendor</th><th class="px-3 py-2 text-left text-xs font-bold uppercase text-gray-500">ESD Function</th>`;

    return `
    <div class="space-y-4 p-2">
        <p class="text-sm text-gray-700">Each system must be linked to at least one ESD standard function for cross-council analysis. Systems without a function assignment will be excluded from the rationalisation matrix.</p>
        <div class="p-3 border-l-4 ${summaryColour} text-sm font-bold">
            ${mappedCount} of ${systems.length} system${systems.length !== 1 ? 's' : ''} mapped
        </div>
        ${batchBar}
        <div class="overflow-auto">
            <table class="gds-table w-full text-sm">
                <thead><tr>${colHeaders}</tr></thead>
                <tbody id="importFnMappingBody">${bodyHTML}</tbody>
            </table>
        </div>
    </div>`;
}


function buildFnPickerHTML(key, sysIdx, assignments) {
    const fnIds = (typeof sysIdx === 'number' ? assignments.get(sysIdx) : null) || [];
    const pickersHTML = fnIds.length === 0
        ? buildSinglePickerHTML(key, sysIdx, '', 0)
        : fnIds.map((fnId, pickIdx) => buildSinglePickerHTML(key, sysIdx, fnId, pickIdx)).join('');
    return `<div class="fn-picker-group space-y-1" data-sys-idx="${sysIdx}">${pickersHTML}<button class="import-add-fn text-xs text-[#1d70b8] underline mt-1" data-sys-idx="${sysIdx}">+ add function</button></div>`;
}


function buildSinglePickerHTML(key, sysIdx, fnId, pickIdx) {
    const breadcrumb = fnId ? getLgaBreadcrumb(fnId) : null;
    const fnLabel = fnId ? (getLgaFunction(fnId) ? getLgaFunction(fnId).label : '') : '';
    return `<div class="fn-picker-row flex items-start gap-1" data-pick-idx="${pickIdx}">
        <div class="flex-1">
            <input type="text" list="lgaFunctionsDatalist"
                class="import-fn-input border border-[#b1b4b6] p-1 text-xs w-full"
                data-sys-idx="${sysIdx}" data-pick-idx="${pickIdx}"
                value="${escHtml(fnId ? fnId + (fnLabel ? ' — ' + fnLabel : '') : '')}"
                placeholder="Type function ID or name...">
            ${breadcrumb ? `<div class="text-xs text-gray-500 mt-0.5 fn-breadcrumb">${escHtml(breadcrumb)}</div>` : `<div class="text-xs text-gray-400 mt-0.5 fn-breadcrumb hidden"></div>`}
        </div>
        ${pickIdx > 0 ? `<button class="import-remove-fn text-xs text-[#d4351c] mt-1 flex-shrink-0" data-sys-idx="${sysIdx}" data-pick-idx="${pickIdx}">remove</button>` : ''}
    </div>`;
}


function buildImportStep4HTML() {
    const s = state.importWizardState;
    const systems = s.mappedSystems || [];
    const assignments = s.functionAssignments || new Map();

    // Compute unique function IDs and edge count
    const allFnIds = new Set();
    let edgeCount = 0;
    assignments.forEach((fnIds, sysIdx) => {
        fnIds.forEach(fnId => { allFnIds.add(fnId); edgeCount++; });
    });

    const unmappedSystems = systems.filter((_, i) => (assignments.get(i) || []).length === 0);
    const arch = assembleArchitecture();
    const archJson = JSON.stringify(arch, null, 2);

    const unmappedWarning = unmappedSystems.length > 0 ? `
        <div class="p-3 bg-yellow-50 border-l-4 border-l-[#f47738] text-[#0b0c0c] text-sm">
            <span class="font-bold">${unmappedSystems.length} system${unmappedSystems.length !== 1 ? 's have' : ' has'} no ESD function assigned.</span>
            They will appear in the architecture but will be excluded from cross-council analysis. You can assign functions later using the Edit Architecture tool.
        </div>` : '';

    const tierLabel = s.councilTier ? s.councilTier : 'not set';
    const distressLabel = s.financialDistress ? '<span class="ml-2 px-2 py-0.5 bg-red-100 text-[#d4351c] text-xs font-bold">Financial Distress</span>' : '';

    return `
    <div class="space-y-4 p-2">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="p-3 border border-gray-200 bg-gray-50">
                <p class="text-xs text-gray-500 font-bold uppercase mb-1">Council</p>
                <p class="font-bold text-base">${escHtml(s.councilName || '—')}${distressLabel}</p>
                <p class="text-sm text-gray-600">Tier: ${escHtml(tierLabel)}</p>
            </div>
            <div class="p-3 border border-gray-200 bg-gray-50">
                <p class="text-xs text-gray-500 font-bold uppercase mb-1">Architecture summary</p>
                <p class="text-sm"><span class="font-bold">${systems.length}</span> systems &nbsp; <span class="font-bold">${allFnIds.size}</span> functions &nbsp; <span class="font-bold">${edgeCount}</span> REALIZES edges</p>
                <p class="text-sm text-gray-600">${arch.nodes.length} total nodes</p>
            </div>
        </div>
        ${unmappedWarning}
        <details class="border border-gray-200">
            <summary class="px-3 py-2 cursor-pointer font-bold text-sm bg-gray-50">Preview generated architecture JSON</summary>
            <pre class="text-xs p-3 overflow-auto max-h-64 bg-white font-mono whitespace-pre-wrap">${escHtml(archJson)}</pre>
        </details>
        <div class="flex gap-3">
            <button id="btnImportExportJSON" class="gds-btn-secondary px-4 py-2 font-bold text-sm">Export JSON</button>
        </div>
    </div>`;
}


function syncImportStep1Fields() {
    const nameEl = document.getElementById('importCouncilName');
    const tierEl = document.getElementById('importCouncilTier');
    const distressEl = document.getElementById('importFinancialDistress');
    if (nameEl) state.importWizardState.councilName = nameEl.value.trim();
    if (tierEl) state.importWizardState.councilTier = tierEl.value;
    if (distressEl) state.importWizardState.financialDistress = distressEl.checked;
}


function updateImportStep3SummaryBar() {
    const s = state.importWizardState;
    if (!s || s.step !== 3) return;
    const systems = s.mappedSystems || [];
    const assignments = s.functionAssignments || new Map();
    const mappedCount = systems.filter((_, i) => (assignments.get(i) || []).length > 0).length;
    const allMapped = mappedCount === systems.length;
    const summaryEl = document.querySelector('#importWizardContent .border-l-4');
    if (summaryEl) {
        summaryEl.textContent = `${mappedCount} of ${systems.length} system${systems.length !== 1 ? 's' : ''} mapped`;
        summaryEl.className = 'p-3 border-l-4 text-sm font-bold ' + (allMapped ? 'bg-green-50 border-l-[#00703c] text-[#00703c]' : 'bg-yellow-50 border-l-[#f47738] text-[#0b0c0c]');
    }
}


function assembleArchitecture() {
    const s = state.importWizardState;
    const nodes = [];
    const edges = [];

    // Build Function nodes for each unique lgaFunctionId
    const fnNodeMap = new Map(); // lgaFunctionId -> nodeId
    s.functionAssignments.forEach((fnIds, sysIdx) => {
        fnIds.forEach(fnId => {
            if (!fnNodeMap.has(fnId)) {
                const lgaFn = getLgaFunction(fnId);
                const nodeId = generateId();
                fnNodeMap.set(fnId, nodeId);
                nodes.push({
                    id: nodeId,
                    label: lgaFn ? lgaFn.label : 'Function ' + fnId,
                    type: 'Function',
                    lgaFunctionId: fnId
                });
            }
        });
    });

    // Build ITSystem nodes and REALIZES edges
    s.mappedSystems.forEach((sys, idx) => {
        const sysNodeId = generateId();
        const sysNode = { id: sysNodeId, type: 'ITSystem', label: sys.label };
        ['vendor','owner','users','cost','annualCost','endYear','endMonth',
         'noticePeriod','portability','dataPartitioning','isCloud','isERP','sharedWith'
        ].forEach(f => { if (sys[f] !== undefined) sysNode[f] = sys[f]; });
        nodes.push(sysNode);

        const fnIds = s.functionAssignments.get(idx) || [];
        fnIds.forEach(fnId => {
            edges.push({
                source: sysNodeId,
                target: fnNodeMap.get(fnId),
                relationship: 'REALIZES'
            });
        });
    });

    const arch = { councilName: s.councilName, nodes, edges };
    if (s.councilTier || s.financialDistress) {
        arch.councilMetadata = {};
        if (s.councilTier) arch.councilMetadata.tier = s.councilTier;
        if (s.financialDistress) arch.councilMetadata.financialDistress = true;
    }
    return arch;
}


function syncImportStep2ColumnMap() {
    document.querySelectorAll('.import-col-map-select').forEach(sel => {
        const field = sel.getAttribute('data-field');
        if (sel.value) {
            state.importWizardState.columnMap[field] = sel.value;
        } else {
            delete state.importWizardState.columnMap[field];
        }
    });
}


function parseImportedCSV(text, delimiter) {
    const result = Papa.parse(text, {
        header: true,
        delimiter: delimiter || '',
        skipEmptyLines: true,
        transformHeader: h => h.trim()
    });
    return result;
}


function handleImportFileSelect(file) {
    if (!file) return;
    syncImportStep1Fields();
    state.importWizardState._sourceFilename = file.name;
    const ext = file.name.split('.').pop().toLowerCase();
    const fileLabel = document.getElementById('importFileLabel');
    if (fileLabel) fileLabel.textContent = file.name;

    if (ext === 'xlsx' || ext === 'xls') {
        // Lazy-load SheetJS
        const loadingEl = document.getElementById('importFileLoading');
        if (loadingEl) loadingEl.classList.remove('hidden');
        if (typeof XLSX === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18/dist/xlsx.full.min.js';
            script.onload = () => {
                if (loadingEl) loadingEl.classList.add('hidden');
                parseExcelFile(file);
            };
            script.onerror = () => {
                if (loadingEl) loadingEl.classList.add('hidden');
                setImportWizardError('Failed to load Excel library. Check your internet connection or use CSV instead.');
            };
            document.head.appendChild(script);
        } else {
            if (loadingEl) loadingEl.classList.add('hidden');
            parseExcelFile(file);
        }
    } else {
        // CSV or TSV
        const reader = new FileReader();
        reader.onload = e => {
            const delimiter = ext === 'tsv' ? '\t' : '';
            const result = parseImportedCSV(e.target.result, delimiter);
            if (result.errors && result.errors.length && !result.data.length) {
                setImportWizardError('Could not parse file. Make sure it is a valid CSV or TSV.');
                return;
            }
            state.importWizardState.rawRows = result.data;
            state.importWizardState.headers = result.meta.fields || [];
            state.importWizardState.columnMap = autoDetectColumnMap(state.importWizardState.headers);
            renderImportWizardStep();
        };
        reader.readAsText(file);
    }
}


function parseExcelFile(file, sheetName) {
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const workbook = XLSX.read(e.target.result, { type: 'array' });
            // If multiple sheets and no sheet selected yet, show selector
            if (!sheetName && workbook.SheetNames.length > 1) {
                // Show sheet selector inline
                const fileLabel = document.getElementById('importFileLabel');
                if (fileLabel) {
                    const sel = document.createElement('select');
                    sel.id = 'importSheetSelect';
                    sel.className = 'border border-[#b1b4b6] p-1 text-xs ml-3';
                    sel.setAttribute('aria-label', 'Select sheet');
                    workbook.SheetNames.forEach(sn => {
                        const opt = document.createElement('option');
                        opt.value = sn; opt.textContent = sn;
                        sel.appendChild(opt);
                    });
                    const btn = document.createElement('button');
                    btn.textContent = 'Use this sheet';
                    btn.className = 'gds-btn-secondary px-2 py-1 text-xs ml-2 font-bold';
                    btn.onclick = function() {
                        parseExcelSheetFromWorkbook(workbook, sel.value);
                    };
                    // Replace label with selector + button
                    fileLabel.textContent = '';
                    fileLabel.appendChild(document.createTextNode('Multiple sheets found: '));
                    fileLabel.appendChild(sel);
                    fileLabel.appendChild(btn);
                }
                return;
            }
            const selectedSheet = sheetName || workbook.SheetNames[0];
            parseExcelSheetFromWorkbook(workbook, selectedSheet);
        } catch (err) {
            setImportWizardError('Could not parse Excel file: ' + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}


function parseExcelSheetFromWorkbook(workbook, sheetName) {
    try {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        const normalisedRows = rows.map(row => {
            const out = {};
            Object.keys(row).forEach(k => { out[k.trim()] = row[k]; });
            return out;
        });
        state.importWizardState.rawRows = normalisedRows;
        state.importWizardState.headers = normalisedRows.length ? Object.keys(normalisedRows[0]) : [];
        state.importWizardState.columnMap = autoDetectColumnMap(state.importWizardState.headers);
        renderImportWizardStep();
    } catch (err) {
        setImportWizardError('Could not parse Excel sheet: ' + err.message);
    }
}


function handleImportNext() {
    const s = state.importWizardState;
    if (!s) return;
    setImportWizardError(null);
    const isManual = s.mode === 'manual';

    if (s.step === 1) {
        syncImportStep1Fields();
        if (!s.councilName) { setImportWizardError('Please enter a council name.'); return; }
        if (!isManual && (!s.rawRows || !s.rawRows.length)) { setImportWizardError('Please upload a file or paste data before continuing.'); return; }
        state.importWizardState.step = 2;
        if (!isManual && !Object.keys(s.columnMap).length) {
            state.importWizardState.columnMap = autoDetectColumnMap(s.headers);
        }
        renderImportWizardStep();

    } else if (s.step === 2) {
        if (isManual) {
            // Read system cards from DOM and convert to mappedSystems + functionAssignments
            const systems = readManualSystemsFromDOM();
            const validSystems = systems.filter(sys => sys.label);
            if (!validSystems.length) { setImportWizardError('Please add at least one system with a name before continuing.'); return; }
            state.importWizardState.manualSystems = systems;
            state.importWizardState.mappedSystems = validSystems;
            // Build a clean functionAssignments keyed sequentially by validSystems index.
            // Also carry original card idx so we restore correctly on Back.
            const newAssignments = new Map();
            let validIdx = 0;
            systems.forEach((sys, origIdx) => {
                if (!sys.label) return;
                const existing = state.importWizardState.functionAssignments.get(origIdx) || [];
                newAssignments.set(validIdx, existing);
                // Store original card idx on the system object for Back navigation
                sys._origCardIdx = origIdx;
                validIdx++;
            });
            state.importWizardState._savedAssignments = new Map(state.importWizardState.functionAssignments); // save for Back
            state.importWizardState.functionAssignments = newAssignments;
            state.importWizardState.step = 4; // skip step 3 in manual mode
            renderImportWizardStep();
        } else {
            syncImportStep2ColumnMap();
            if (!s.columnMap.label) { setImportWizardError('You must map at least one column to "System Name" before continuing.'); return; }
            const coerced = s.rawRows.map(row => coerceImportedRow(row, s.columnMap)).filter(sys => sys.label);
            state.importWizardState.mappedSystems = deduplicateImportedSystems(coerced);
            if (!state.importWizardState.functionAssignments) {
                state.importWizardState.functionAssignments = new Map();
            }
            state.importWizardState.step = 3;
            renderImportWizardStep();
        }

    } else if (s.step === 3) {
        state.importWizardState.step = 4;
        renderImportWizardStep();

    } else if (s.step === 4) {
        // Import action
        const arch = assembleArchitecture();
        const uploadIdx = state.rawUploads.length;
        const sourceLabel = isManual ? 'manual entry' : 'CSV';
        state.rawUploads.push({ filename: (s._sourceFilename || s.councilName + '-import'), data: arch });

        // Update file list in Stage 1
        const listUl = document.getElementById('uploadedFilesUl');
        const li = document.createElement('li');
        li.className = 'flex items-center gap-3';
        const span = document.createElement('span');
        span.textContent = `${arch.councilName || s.councilName} (${arch.nodes.length} nodes) — imported from ${sourceLabel}`;
        const editBtn = document.createElement('button');
        editBtn.className = 'btn-edit-arch gds-btn-secondary px-2 py-1 text-xs font-bold hover:bg-gray-100';
        editBtn.setAttribute('data-upload-idx', uploadIdx);
        editBtn.textContent = 'Edit Architecture';
        wireEditArchBtn(editBtn);
        li.appendChild(span);
        li.appendChild(editBtn);
        listUl.appendChild(li);
        document.getElementById('fileList').classList.remove('hidden');

        closeImportWizard();
    }
}


function handleImportBack() {
    const s = state.importWizardState;
    if (!s || s.step <= 1) return;
    setImportWizardError(null);
    const isManual = s.mode === 'manual';
    if (!isManual && s.step === 2) syncImportStep2ColumnMap();
    if (isManual && s.step === 2) {
        // Save current card state before going back
        state.importWizardState.manualSystems = readManualSystemsFromDOM();
    }
    // In manual mode: step 4 goes back to step 2 (skip step 3)
    if (isManual && s.step === 4) {
        // Restore pre-remap functionAssignments so card pickers show correctly
        if (s._savedAssignments) {
            state.importWizardState.functionAssignments = new Map(s._savedAssignments);
            state.importWizardState._savedAssignments = null;
        }
        state.importWizardState.step = 2;
    } else {
        state.importWizardState.step -= 1;
    }
    renderImportWizardStep();
}


// --- Import Wizard wiring ---
(function wireImportWizard() {
    const modal = document.getElementById('importWizardModal');

    // Open buttons
    document.getElementById('btnOpenImportWizard').addEventListener('click', function() { openImportWizard('file'); });
    document.getElementById('btnOpenManualEntry').addEventListener('click', function() { openImportWizard('manual'); });

    // Close button
    document.getElementById('btnCloseImportWizard').addEventListener('click', closeImportWizard);

    // Escape key closes the wizard
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && state.importWizardState) {
            closeImportWizard();
        }
    });

    // Click on backdrop closes wizard (but not on inner panel)
    document.getElementById('importWizardModal').addEventListener('click', function(e) {
        if (e.target === this) closeImportWizard();
    });

    // Focus trap: keep Tab cycling within the modal
    document.getElementById('importWizardModal').addEventListener('keydown', function(e) {
        if (e.key !== 'Tab' || !state.importWizardState) return;
        const focusable = this.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // Navigation buttons
    document.getElementById('btnImportNext').addEventListener('click', handleImportNext);
    document.getElementById('btnImportBack').addEventListener('click', handleImportBack);

    // Event delegation for dynamic content inside wizard
    modal.addEventListener('change', function(e) {
        if (!state.importWizardState) return;

        // File input change
        if (e.target.id === 'importFileInput') {
            const file = e.target.files[0];
            if (file) handleImportFileSelect(file);
            return;
        }

        // Column mapping select changes — update live preview
        if (e.target.classList.contains('import-col-map-select')) {
            syncImportStep2ColumnMap();
            updateImportStep2Preview();
            return;
        }

        // Step 3: function picker input change
        if (e.target.classList.contains('import-fn-input')) {
            const sysIdx = parseInt(e.target.getAttribute('data-sys-idx'));
            const pickIdx = parseInt(e.target.getAttribute('data-pick-idx'));
            const val = e.target.value.trim();
            // Extract ID from "ID — Label" format or plain ID
            const idMatch = val.match(/^(\d+)/);
            const fnId = idMatch ? idMatch[1] : null;
            const fn = fnId ? getLgaFunction(fnId) : null;

            // Update breadcrumb display
            const row = e.target.closest('.fn-picker-row');
            if (row) {
                const bc = row.querySelector('.fn-breadcrumb');
                if (bc) {
                    const breadcrumb = fn ? getLgaBreadcrumb(fnId) : null;
                    if (breadcrumb) {
                        bc.textContent = breadcrumb;
                        bc.classList.remove('hidden');
                    } else {
                        bc.textContent = '';
                        bc.classList.add('hidden');
                    }
                }
            }

            // Persist to state only if valid
            if (!isNaN(sysIdx)) {
                const current = state.importWizardState.functionAssignments.get(sysIdx) || [];
                const updated = [...current];
                if (fn) {
                    updated[pickIdx] = fnId;
                } else {
                    updated[pickIdx] = null;
                }
                state.importWizardState.functionAssignments.set(sysIdx, updated.filter(Boolean));
                updateImportStep3SummaryBar();
            }
            return;
        }
    });

    // Paste process button (click delegation)
    modal.addEventListener('click', function(e) {
        if (!state.importWizardState) return;

        if (e.target.id === 'btnImportProcessPaste') {
            const textarea = document.getElementById('importPasteArea');
            const text = textarea ? textarea.value.trim() : '';
            state.importWizardState._pastedText = text;
            if (!text) { setImportWizardError('Please paste some data first.'); return; }
            const result = parseImportedCSV(text, '\t');
            if (!result.data.length) {
                // Try comma delimiter
                const result2 = parseImportedCSV(text, ',');
                if (!result2.data.length) {
                    setImportWizardError('Could not parse pasted data. Make sure the first row contains column headers.');
                    return;
                }
                state.importWizardState.rawRows = result2.data;
                state.importWizardState.headers = result2.meta.fields || [];
            } else {
                state.importWizardState.rawRows = result.data;
                state.importWizardState.headers = result.meta.fields || [];
            }
            state.importWizardState.columnMap = autoDetectColumnMap(state.importWizardState.headers);
            setImportWizardError(null);
            syncImportStep1Fields();
            renderImportWizardStep();
            return;
        }

        // Step 1: download template CSV
        if (e.target.id === 'btnDownloadTemplateCSV') {
            downloadTemplateCSV();
            return;
        }

        // Step 3: add function picker
        if (e.target.classList.contains('import-add-fn')) {
            const sysIdx = parseInt(e.target.getAttribute('data-sys-idx'));
            if (isNaN(sysIdx)) return;
            const current = state.importWizardState.functionAssignments.get(sysIdx) || [];
            const pickIdx = current.length;
            // Append a new empty picker row
            const group = e.target.closest('.fn-picker-group');
            if (group) {
                const div = document.createElement('div');
                div.innerHTML = buildSinglePickerHTML('sys:' + sysIdx, sysIdx, '', pickIdx);
                group.insertBefore(div.firstElementChild, e.target);
            }
            return;
        }

        // Step 3: remove function picker
        if (e.target.classList.contains('import-remove-fn')) {
            const sysIdx = parseInt(e.target.getAttribute('data-sys-idx'));
            const pickIdx = parseInt(e.target.getAttribute('data-pick-idx'));
            if (isNaN(sysIdx)) return;
            const current = state.importWizardState.functionAssignments.get(sysIdx) || [];
            current.splice(pickIdx, 1);
            state.importWizardState.functionAssignments.set(sysIdx, current.filter(Boolean));
            const row = e.target.closest('.fn-picker-row');
            if (row) row.remove();
            updateImportStep3SummaryBar();
            return;
        }

        // Step 3: suggestion pill click
        if (e.target.classList.contains('import-fn-suggestion-pill')) {
            const deptText = e.target.getAttribute('data-dept');
            const fnId = e.target.getAttribute('data-fn-id');
            if (!deptText || !fnId) return;
            // Apply to all systems in this department group
            const systems = state.importWizardState.mappedSystems || [];
            systems.forEach((sys, idx) => {
                const depts = sys._rawDepartments || (sys._rawDepartment ? [sys._rawDepartment] : []);
                if (depts.includes(deptText)) {
                    const current = state.importWizardState.functionAssignments.get(idx) || [];
                    if (!current.includes(fnId)) {
                        state.importWizardState.functionAssignments.set(idx, [...current, fnId]);
                    }
                }
            });
            // Also set group picker input to show selection
            const groupRow = e.target.closest('tr');
            if (groupRow) {
                const grpInput = groupRow.querySelector('.import-fn-input');
                if (grpInput) {
                    const fn = getLgaFunction(fnId);
                    grpInput.value = fn ? fnId + ' — ' + fn.label : fnId;
                }
            }
            // Re-render step3 to reflect updated assignments in individual pickers
            renderImportWizardStep();
            return;
        }

        // Step 3: apply group assignment button
        if (e.target.classList.contains('import-apply-group-fn')) {
            const deptText = e.target.getAttribute('data-dept');
            if (!deptText) return;
            // Find the group picker input (same table row)
            const groupRow = e.target.closest('tr');
            if (!groupRow) return;
            const grpInput = groupRow.querySelector('.import-fn-input');
            if (!grpInput) return;
            const val = grpInput.value.trim();
            const idMatch = val.match(/^(\d+)/);
            const fnId = idMatch ? idMatch[1] : null;
            if (!fnId || !getLgaFunction(fnId)) {
                setImportWizardError('Please enter a valid ESD function ID or name in the group picker before applying.');
                return;
            }
            setImportWizardError(null);
            const systems = state.importWizardState.mappedSystems || [];
            systems.forEach((sys, idx) => {
                const depts = sys._rawDepartments || (sys._rawDepartment ? [sys._rawDepartment] : []);
                if (depts.includes(deptText)) {
                    const current = state.importWizardState.functionAssignments.get(idx) || [];
                    if (!current.includes(fnId)) {
                        state.importWizardState.functionAssignments.set(idx, [...current, fnId]);
                    }
                }
            });
            renderImportWizardStep();
            return;
        }

        // Step 3: batch assign to checked systems (flat mode)
        if (e.target.id === 'btnImportApplyBatch') {
            const input = document.getElementById('importBatchFnInput');
            if (!input) return;
            const val = input.value.trim();
            const idMatch = val.match(/^(\d+)/);
            const fnId = idMatch ? idMatch[1] : null;
            if (!fnId || !getLgaFunction(fnId)) {
                setImportWizardError('Please enter a valid ESD function ID in the batch field.');
                return;
            }
            setImportWizardError(null);
            document.querySelectorAll('.import-sys-checkbox:checked').forEach(cb => {
                const idx = parseInt(cb.getAttribute('data-idx'));
                if (isNaN(idx)) return;
                const current = state.importWizardState.functionAssignments.get(idx) || [];
                if (!current.includes(fnId)) {
                    state.importWizardState.functionAssignments.set(idx, [...current, fnId]);
                }
            });
            renderImportWizardStep();
            return;
        }

        // Step 4: export JSON
        if (e.target.id === 'btnImportExportJSON') {
            const arch = assembleArchitecture();
            const blob = new Blob([JSON.stringify(arch, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = (state.importWizardState.councilName || 'council') + '-architecture.json';
            a.click();
            URL.revokeObjectURL(url);
            return;
        }

        // Manual Step 2a: add another system
        if (e.target.id === 'btnAddManualSystem') {
            const container = document.getElementById('manualSystemCards');
            if (!container) return;
            const newIdx = container.querySelectorAll('.manual-sys-card').length;
            const div = document.createElement('div');
            div.innerHTML = buildManualSystemCardHTML(newIdx, null);
            container.appendChild(div.firstElementChild);
            // Scroll new card into view
            const newCard = container.lastElementChild;
            if (newCard) newCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return;
        }

        // Manual Step 2a: remove system card
        if (e.target.classList.contains('manual-sys-remove')) {
            e.stopPropagation(); // prevent card toggle
            const idx = parseInt(e.target.getAttribute('data-card-idx'));
            const container = document.getElementById('manualSystemCards');
            if (!container) return;
            const cards = container.querySelectorAll('.manual-sys-card');
            if (cards.length <= 1) {
                setImportWizardError('You need at least one system. Clear the fields instead of removing.');
                return;
            }
            const card = container.querySelector(`.manual-sys-card[data-card-idx="${idx}"]`);
            if (card) {
                // Remove from functionAssignments state too
                state.importWizardState.functionAssignments.delete(idx);
                card.remove();
                // Renumber remaining cards
                let newIdx = 0;
                container.querySelectorAll('.manual-sys-card').forEach(c => {
                    c.setAttribute('data-card-idx', newIdx);
                    const header = c.querySelector('.manual-sys-card-header');
                    if (header) header.setAttribute('data-card-idx', newIdx);
                    const removeBtn = c.querySelector('.manual-sys-remove');
                    if (removeBtn) removeBtn.setAttribute('data-card-idx', newIdx);
                    const titleSpan = header ? header.querySelector('span') : null;
                    const labelInput = c.querySelector('[data-field="label"]');
                    if (titleSpan) {
                        const curLabel = labelInput ? labelInput.value.trim() : '';
                        titleSpan.textContent = `System ${newIdx + 1}${curLabel ? ': ' + curLabel : ''}`;
                    }
                    // Update all data-idx attributes on fields and fn pickers
                    c.querySelectorAll('[data-idx]').forEach(el => el.setAttribute('data-idx', newIdx));
                    c.querySelectorAll('[data-sys-idx]').forEach(el => el.setAttribute('data-sys-idx', newIdx));
                    c.querySelectorAll('[name]').forEach(el => {
                        const name = el.getAttribute('name');
                        if (name) el.setAttribute('name', name.replace(/-\d+$/, '-' + newIdx));
                    });
                    c.querySelectorAll('[id]').forEach(el => {
                        const id = el.getAttribute('id');
                        if (id) el.setAttribute('id', id.replace(/-\d+$/, '-' + newIdx));
                    });
                    newIdx++;
                });
                // Rebuild functionAssignments with renumbered indices
                const oldAssignments = new Map(state.importWizardState.functionAssignments);
                state.importWizardState.functionAssignments = new Map();
                let rebuildIdx = 0;
                oldAssignments.forEach((val, key) => {
                    state.importWizardState.functionAssignments.set(rebuildIdx++, val);
                });
            }
            return;
        }

        // Manual Step 2a: toggle card expand/collapse (click on header)
        const cardHeader = e.target.closest('.manual-sys-card-header');
        if (cardHeader && !e.target.classList.contains('manual-sys-remove') && !e.target.classList.contains('import-add-fn') && !e.target.classList.contains('import-remove-fn')) {
            const card = cardHeader.closest('.manual-sys-card');
            if (!card) return;
            const body = card.querySelector('.manual-sys-card-body');
            const toggle = cardHeader.querySelector('.manual-sys-toggle');
            if (body) {
                const isHidden = body.classList.toggle('hidden');
                if (toggle) toggle.innerHTML = isHidden ? '&#9660;' : '&#9650;';
                // Update header title with current system name when collapsing
                if (isHidden) {
                    const labelInput = card.querySelector('[data-field="label"]');
                    const titleSpan = cardHeader.querySelector('span');
                    const idx = parseInt(card.getAttribute('data-card-idx'));
                    if (titleSpan && labelInput) {
                        const curLabel = labelInput.value.trim();
                        titleSpan.textContent = `System ${idx + 1}${curLabel ? ': ' + curLabel : ''}`;
                    }
                }
            }
            return;
        }
    });
})();

// =========================================================
// ARCHITECTURE EDITOR
// =========================================================

// Populate the LGA datalist on first use
(function populateLgaDatalist() {
    const dl = document.getElementById('lgaFunctionsDatalist');
    LGA_FUNCTIONS.forEach(fn => {
        const opt = document.createElement('option');
        opt.value = fn.id;
        opt.label = `${fn.id} — ${fn.label}`;
        dl.appendChild(opt);
    });
})();


export { openImportWizard, closeImportWizard, handleImportNext, handleImportBack };
