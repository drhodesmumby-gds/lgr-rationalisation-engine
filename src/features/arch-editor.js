import { state } from '../state.js';
import { LGA_FUNCTIONS } from '../constants/lga-functions.js';
import { getLgaFunction } from '../taxonomy.js';
import { escHtml } from '../ui-helpers.js';
import { runBaselining, renderDashboard } from '../main.js';


function generateId() {
    return 'node-' + Math.random().toString(36).slice(2, 10);
}


function openArchEditor(uploadIdx) {
    const upload = state.rawUploads[uploadIdx];
    if (!upload) return;
    state.archEditorState = {
        uploadIdx,
        data: JSON.parse(JSON.stringify(upload.data)),
        activeTab: 'council'
    };
    document.getElementById('archEditorTitle').textContent = `Edit Architecture: ${upload.data.councilName || upload.filename}`;
    document.getElementById('archEditorConfirm').classList.add('hidden');
    renderArchEditorTab('council');
    document.getElementById('architectureEditorModal').classList.remove('hidden');
}


function renderArchEditorTab(tab) {
    state.archEditorState.activeTab = tab;
    // Update tab button styles
    document.querySelectorAll('.arch-tab-btn').forEach(btn => {
        const isActive = btn.getAttribute('data-tab') === tab;
        btn.classList.toggle('border-[#1d70b8]', isActive);
        btn.classList.toggle('border-transparent', !isActive);
    });
    const content = document.getElementById('archEditorContent');
    if (tab === 'council') content.innerHTML = buildCouncilTab();
    else if (tab === 'functions') content.innerHTML = buildFunctionsTab();
    else if (tab === 'systems') content.innerHTML = buildSystemsTab();
    else if (tab === 'edges') content.innerHTML = buildEdgesTab();
}


function buildCouncilTab() {
    const d = state.archEditorState.data;
    const tier = d.councilMetadata?.tier || '';
    const distress = d.councilMetadata?.financialDistress === true;
    return `
        <div class="space-y-6 p-2">
            <div>
                <label class="block font-bold mb-1 text-sm">Council Name</label>
                <input id="archCouncilName" type="text" class="border-2 border-[#0b0c0c] p-2 text-base w-full max-w-md" value="${escHtml(d.councilName || '')}">
            </div>
            <div>
                <label class="block font-bold mb-1 text-sm">Tier</label>
                <select id="archCouncilTier" class="border-2 border-[#0b0c0c] p-2 text-base">
                    <option value="">-- not set --</option>
                    ${['county','district','borough','unitary'].map(t => `<option value="${t}" ${tier===t?'selected':''}>${t}</option>`).join('')}
                </select>
            </div>
            <div class="flex items-center gap-3">
                <input id="archCouncilDistress" type="checkbox" ${distress?'checked':''} class="w-5 h-5 cursor-pointer">
                <label for="archCouncilDistress" class="font-bold text-sm cursor-pointer">Financial Distress</label>
            </div>
        </div>`;
}


function buildFunctionsTab() {
    const nodes = (state.archEditorState.data.nodes || []).filter(n => n.type === 'Function');
    let rows = nodes.map((fn, i) => {
        const globalIdx = state.archEditorState.data.nodes.indexOf(fn);
        return `<tr>
            <td class="px-2 py-2"><input type="text" class="border border-[#b1b4b6] p-1 text-xs font-mono w-24" value="${escHtml(fn.id)}" data-field="id" data-node-idx="${globalIdx}" readonly style="background:#f3f2f1"></td>
            <td class="px-2 py-2"><input type="text" class="border border-[#b1b4b6] p-1 text-xs w-48 arch-fn-input" value="${escHtml(fn.label||'')}" data-field="label" data-node-idx="${globalIdx}"></td>
            <td class="px-2 py-2">
                <input type="text" list="lgaFunctionsDatalist" class="border border-[#b1b4b6] p-1 text-xs w-48 arch-fn-input" value="${escHtml(fn.lgaFunctionId||'')}" data-field="lgaFunctionId" data-node-idx="${globalIdx}" placeholder="e.g. 148">
            </td>
            <td class="px-2 py-2">
                <button class="btn-remove-fn text-[#d4351c] font-bold text-xs hover:underline" data-node-idx="${globalIdx}">Remove</button>
            </td>
        </tr>`;
    }).join('');

    return `
        <div class="p-2">
            <div class="flex items-center justify-between mb-3">
                <span class="font-bold text-sm">${nodes.length} Function node(s)</span>
                <button id="btnAddFunction" class="gds-btn-secondary px-3 py-1.5 text-sm font-bold hover:bg-gray-100">+ Add Function</button>
            </div>
            <div class="overflow-x-auto">
                <table class="gds-table text-sm">
                    <thead><tr>
                        <th class="px-2 py-2 text-xs">ID</th>
                        <th class="px-2 py-2 text-xs">Label</th>
                        <th class="px-2 py-2 text-xs">LGA Function ID</th>
                        <th class="px-2 py-2 text-xs"></th>
                    </tr></thead>
                    <tbody id="fnTableBody">${rows}</tbody>
                </table>
            </div>
        </div>`;
}


function buildSystemsTab() {
    const nodes = (state.archEditorState.data.nodes || []).filter(n => n.type === 'ITSystem');
    const rows = nodes.map(sys => {
        const globalIdx = state.archEditorState.data.nodes.indexOf(sys);
        const portOpts = ['High','Medium','Low'].map(v => `<option value="${v}" ${sys.portability===v?'selected':''}>${v}</option>`).join('');
        const dpOpts = ['Segmented','Monolithic'].map(v => `<option value="${v}" ${sys.dataPartitioning===v?'selected':''}>${v}</option>`).join('');
        return `<tr>
            <td class="px-2 py-1"><input type="text" class="border border-[#b1b4b6] p-1 text-xs w-32 arch-sys-input" value="${escHtml(sys.label||'')}" data-field="label" data-node-idx="${globalIdx}"></td>
            <td class="px-2 py-1"><input type="text" class="border border-[#b1b4b6] p-1 text-xs w-28 arch-sys-input" value="${escHtml(sys.vendor||'')}" data-field="vendor" data-node-idx="${globalIdx}"></td>
            <td class="px-2 py-1"><input type="number" class="border border-[#b1b4b6] p-1 text-xs w-20 arch-sys-input" value="${sys.users||''}" data-field="users" data-node-idx="${globalIdx}" min="0"></td>
            <td class="px-2 py-1"><input type="text" class="border border-[#b1b4b6] p-1 text-xs w-24 arch-sys-input" value="${escHtml(sys.cost||'')}" data-field="cost" data-node-idx="${globalIdx}" placeholder="£80k/yr"></td>
            <td class="px-2 py-1"><input type="number" class="border border-[#b1b4b6] p-1 text-xs w-20 arch-sys-input" value="${sys.annualCost||''}" data-field="annualCost" data-node-idx="${globalIdx}" min="0"></td>
            <td class="px-2 py-1"><input type="number" class="border border-[#b1b4b6] p-1 text-xs w-16 arch-sys-input" value="${sys.endYear||''}" data-field="endYear" data-node-idx="${globalIdx}" placeholder="2027"></td>
            <td class="px-2 py-1"><input type="number" class="border border-[#b1b4b6] p-1 text-xs w-12 arch-sys-input" value="${sys.endMonth||''}" data-field="endMonth" data-node-idx="${globalIdx}" min="1" max="12"></td>
            <td class="px-2 py-1"><input type="number" class="border border-[#b1b4b6] p-1 text-xs w-14 arch-sys-input" value="${sys.noticePeriod||''}" data-field="noticePeriod" data-node-idx="${globalIdx}" min="0"></td>
            <td class="px-2 py-1"><select class="border border-[#b1b4b6] p-1 text-xs w-24 arch-sys-input" data-field="portability" data-node-idx="${globalIdx}"><option value="">--</option>${portOpts}</select></td>
            <td class="px-2 py-1"><select class="border border-[#b1b4b6] p-1 text-xs w-24 arch-sys-input" data-field="dataPartitioning" data-node-idx="${globalIdx}"><option value="">--</option>${dpOpts}</select></td>
            <td class="px-2 py-1 text-center"><input type="checkbox" class="arch-sys-input" ${sys.isCloud?'checked':''} data-field="isCloud" data-node-idx="${globalIdx}"></td>
            <td class="px-2 py-1 text-center"><input type="checkbox" class="arch-sys-input" ${sys.isERP?'checked':''} data-field="isERP" data-node-idx="${globalIdx}"></td>
            <td class="px-2 py-1"><input type="text" class="border border-[#b1b4b6] p-1 text-xs w-32 arch-sys-input" value="${escHtml((sys.sharedWith||[]).join(', '))}" data-field="sharedWith" data-node-idx="${globalIdx}" placeholder="Council A, Council B"></td>
            <td class="px-2 py-1"><input type="text" class="border border-[#b1b4b6] p-1 text-xs w-28 arch-sys-input" value="${escHtml(sys.owner||'')}" data-field="owner" data-node-idx="${globalIdx}"></td>
            <td class="px-2 py-1"><button class="btn-remove-sys text-[#d4351c] font-bold text-xs hover:underline" data-node-idx="${globalIdx}">Remove</button></td>
        </tr>`;
    }).join('');

    return `
        <div class="p-2">
            <div class="flex items-center justify-between mb-3">
                <span class="font-bold text-sm">${nodes.length} IT System node(s)</span>
                <button id="btnAddSystem" class="gds-btn-secondary px-3 py-1.5 text-sm font-bold hover:bg-gray-100">+ Add System</button>
            </div>
            <div class="overflow-x-auto">
                <table class="gds-table text-xs whitespace-nowrap">
                    <thead><tr>
                        <th class="px-2 py-1">Label</th><th class="px-2 py-1">Vendor</th>
                        <th class="px-2 py-1">Users</th><th class="px-2 py-1">Cost</th>
                        <th class="px-2 py-1">Annual £</th><th class="px-2 py-1">End Yr</th>
                        <th class="px-2 py-1">End Mo</th><th class="px-2 py-1">Notice</th>
                        <th class="px-2 py-1">Portability</th><th class="px-2 py-1">Data Layer</th>
                        <th class="px-2 py-1">Cloud</th><th class="px-2 py-1">ERP</th>
                        <th class="px-2 py-1">Shared With</th><th class="px-2 py-1">Owner</th>
                        <th class="px-2 py-1"></th>
                    </tr></thead>
                    <tbody id="sysTableBody">${rows}</tbody>
                </table>
            </div>
        </div>`;
}


function buildEdgesTab() {
    const edges = state.archEditorState.data.edges || [];
    const nodes = state.archEditorState.data.nodes || [];
    const systems = nodes.filter(n => n.type === 'ITSystem');
    const functions = nodes.filter(n => n.type === 'Function');

    const rows = edges.map((edge, i) => {
        const srcNode = nodes.find(n => n.id === edge.source);
        const tgtNode = nodes.find(n => n.id === edge.target);
        return `<tr>
            <td class="px-2 py-2 text-sm">${escHtml(srcNode ? srcNode.label : edge.source)}</td>
            <td class="px-2 py-2 text-sm text-gray-500">REALIZES</td>
            <td class="px-2 py-2 text-sm">${escHtml(tgtNode ? tgtNode.label : edge.target)}</td>
            <td class="px-2 py-2"><button class="btn-remove-edge text-[#d4351c] font-bold text-xs hover:underline" data-edge-idx="${i}">Remove</button></td>
        </tr>`;
    }).join('');

    const sysOptions = systems.map(s => `<option value="${escHtml(s.id)}">${escHtml(s.label||s.id)}</option>`).join('');
    const fnOptions = functions.map(f => `<option value="${escHtml(f.id)}">${escHtml(f.label||f.id)}</option>`).join('');

    return `
        <div class="p-2">
            <div class="mb-4 flex items-end gap-3 flex-wrap">
                <div>
                    <label class="block font-bold text-xs mb-1">System</label>
                    <select id="newEdgeSystem" class="border-2 border-[#0b0c0c] p-1 text-sm">
                        <option value="">-- select system --</option>${sysOptions}
                    </select>
                </div>
                <div>
                    <label class="block font-bold text-xs mb-1">Function</label>
                    <select id="newEdgeFunction" class="border-2 border-[#0b0c0c] p-1 text-sm">
                        <option value="">-- select function --</option>${fnOptions}
                    </select>
                </div>
                <button id="btnAddEdge" class="gds-btn-secondary px-3 py-1.5 text-sm font-bold hover:bg-gray-100">+ Add Edge</button>
            </div>
            <table class="gds-table text-sm">
                <thead><tr>
                    <th class="px-2 py-2">System</th>
                    <th class="px-2 py-2">Relationship</th>
                    <th class="px-2 py-2">Function</th>
                    <th class="px-2 py-2"></th>
                </tr></thead>
                <tbody id="edgeTableBody">${rows}</tbody>
            </table>
        </div>`;
}


function syncEditorFieldsToState() {
    // Council tab — sync if inputs are present in DOM
    const nameEl = document.getElementById('archCouncilName');
    if (nameEl) {
        const tierEl = document.getElementById('archCouncilTier');
        const distressEl = document.getElementById('archCouncilDistress');
        state.archEditorState.data.councilName = nameEl.value;
        if (!state.archEditorState.data.councilMetadata) state.archEditorState.data.councilMetadata = {};
        if (tierEl) state.archEditorState.data.councilMetadata.tier = tierEl.value || undefined;
        if (distressEl) state.archEditorState.data.councilMetadata.financialDistress = distressEl.checked;
    }
    // Functions tab — sync if inputs are present in DOM
    document.querySelectorAll('.arch-fn-input').forEach(input => {
        const idx = parseInt(input.getAttribute('data-node-idx'));
        const field = input.getAttribute('data-field');
        if (!isNaN(idx) && field && state.archEditorState.data.nodes[idx]) {
            state.archEditorState.data.nodes[idx][field] = input.value;
        }
    });
    // Systems tab — sync if inputs are present in DOM
    document.querySelectorAll('.arch-sys-input').forEach(input => {
        const idx = parseInt(input.getAttribute('data-node-idx'));
        const field = input.getAttribute('data-field');
        if (isNaN(idx) || !field || !state.archEditorState.data.nodes[idx]) return;
        const node = state.archEditorState.data.nodes[idx];
        if (input.type === 'checkbox') {
            node[field] = input.checked;
        } else if (input.type === 'number') {
            const v = input.value.trim();
            node[field] = v === '' ? undefined : Number(v);
        } else if (field === 'sharedWith') {
            const parts = input.value.split(',').map(s => s.trim()).filter(Boolean);
            node[field] = parts.length ? parts : undefined;
        } else if (input.tagName === 'SELECT' || input.type === 'text') {
            node[field] = input.value || undefined;
        }
    });
}


function buildExportData() {
    const d = state.archEditorState.data;
    // Clean up undefined values
    const cleanNodes = (d.nodes || []).map(node => {
        const cleaned = {};
        Object.entries(node).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') cleaned[k] = v;
        });
        return cleaned;
    });
    const cleanEdges = (d.edges || []).map(edge => {
        const cleaned = {};
        Object.entries(edge).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') cleaned[k] = v;
        });
        return cleaned;
    });
    const result = { councilName: d.councilName };
    if (d.councilMetadata && Object.keys(d.councilMetadata).length > 0) {
        const cm = {};
        if (d.councilMetadata.tier) cm.tier = d.councilMetadata.tier;
        if (d.councilMetadata.financialDistress) cm.financialDistress = true;
        if (Object.keys(cm).length) result.councilMetadata = cm;
    }
    result.nodes = cleanNodes;
    result.edges = cleanEdges;
    return result;
}

const archEditorModal = document.getElementById('architectureEditorModal');

archEditorModal.addEventListener('click', function(e) {
    // Tab switching
    if (e.target.classList.contains('arch-tab-btn')) {
        syncEditorFieldsToState();
        renderArchEditorTab(e.target.getAttribute('data-tab'));
        return;
    }

    // Add Function
    if (e.target.id === 'btnAddFunction') {
        const newFn = { id: generateId(), label: 'New Function', type: 'Function', lgaFunctionId: '' };
        state.archEditorState.data.nodes.push(newFn);
        renderArchEditorTab('functions');
        return;
    }

    // Remove Function
    if (e.target.classList.contains('btn-remove-fn')) {
        const nodeIdx = parseInt(e.target.getAttribute('data-node-idx'));
        const node = state.archEditorState.data.nodes[nodeIdx];
        if (!node) return;
        const referencedEdges = (state.archEditorState.data.edges || []).filter(edge => edge.source === node.id || edge.target === node.id);
        if (referencedEdges.length > 0) {
            if (!confirm(`"${node.label}" is referenced by ${referencedEdges.length} edge(s). Remove node and its edges?`)) return;
            state.archEditorState.data.edges = state.archEditorState.data.edges.filter(edge => edge.source !== node.id && edge.target !== node.id);
        }
        state.archEditorState.data.nodes.splice(nodeIdx, 1);
        renderArchEditorTab('functions');
        return;
    }

    // Add System
    if (e.target.id === 'btnAddSystem') {
        const newSys = { id: generateId(), label: 'New System', type: 'ITSystem' };
        state.archEditorState.data.nodes.push(newSys);
        renderArchEditorTab('systems');
        return;
    }

    // Remove System
    if (e.target.classList.contains('btn-remove-sys')) {
        const nodeIdx = parseInt(e.target.getAttribute('data-node-idx'));
        const node = state.archEditorState.data.nodes[nodeIdx];
        if (!node) return;
        state.archEditorState.data.edges = (state.archEditorState.data.edges || []).filter(edge => edge.source !== node.id && edge.target !== node.id);
        state.archEditorState.data.nodes.splice(nodeIdx, 1);
        renderArchEditorTab('systems');
        return;
    }

    // Add Edge
    if (e.target.id === 'btnAddEdge') {
        const sysEl = document.getElementById('newEdgeSystem');
        const fnEl = document.getElementById('newEdgeFunction');
        const sysId = sysEl?.value;
        const fnId = fnEl?.value;
        if (!sysId || !fnId) { alert('Select both a system and a function.'); return; }
        const exists = (state.archEditorState.data.edges || []).some(edge => edge.source === sysId && edge.target === fnId);
        if (exists) { alert('This edge already exists.'); return; }
        if (!state.archEditorState.data.edges) state.archEditorState.data.edges = [];
        state.archEditorState.data.edges.push({ source: sysId, target: fnId, relationship: 'REALIZES' });
        renderArchEditorTab('edges');
        return;
    }

    // Remove Edge
    if (e.target.classList.contains('btn-remove-edge')) {
        const edgeIdx = parseInt(e.target.getAttribute('data-edge-idx'));
        state.archEditorState.data.edges.splice(edgeIdx, 1);
        renderArchEditorTab('edges');
        return;
    }
});

// Close via X or Cancel
document.getElementById('btnCloseArchEditor').addEventListener('click', () => {
    archEditorModal.classList.add('hidden');
    state.archEditorState = null;
});
document.getElementById('btnCancelArchEditor').addEventListener('click', (e) => {
    e.stopPropagation();
    archEditorModal.classList.add('hidden');
    state.archEditorState = null;
});
archEditorModal.addEventListener('click', (e) => {
    if (e.target === archEditorModal) {
        archEditorModal.classList.add('hidden');
        state.archEditorState = null;
    }
});

// Apply Changes
document.getElementById('btnApplyArchChanges').addEventListener('click', (e) => {
    e.stopPropagation();
    syncEditorFieldsToState();
    const exportData = buildExportData();
    state.rawUploads[state.archEditorState.uploadIdx].data = exportData;

    // Update the file list item text in Stage 1
    const listItems = document.querySelectorAll('#uploadedFilesUl li');
    const li = listItems[state.archEditorState.uploadIdx];
    if (li) {
        const span = li.querySelector('span');
        if (span) {
            const nodeCount = exportData.nodes?.length || 0;
            span.textContent = `${exportData.councilName || state.rawUploads[state.archEditorState.uploadIdx].filename} (${nodeCount} nodes)`;
        }
    }

    // Re-trigger baselining if already past stage 1
    const stageBaseline = document.getElementById('stageBaseline');
    const stageDashboard = document.getElementById('stageDashboard');
    if (!stageBaseline.classList.contains('hidden') || !stageDashboard.classList.contains('hidden')) {
        runBaselining();
    }
    if (!stageDashboard.classList.contains('hidden')) {
        renderDashboard();
    }

    const confirm = document.getElementById('archEditorConfirm');
    confirm.textContent = 'Changes applied successfully.';
    confirm.classList.remove('hidden');
    setTimeout(() => {
        confirm.classList.add('hidden');
        archEditorModal.classList.add('hidden');
        state.archEditorState = null;
    }, 1500);
});

// Export JSON
document.getElementById('btnExportArchJson').addEventListener('click', (e) => {
    e.stopPropagation();
    syncEditorFieldsToState();
    const exportData = buildExportData();
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(exportData.councilName || 'council').replace(/\s+/g, '-').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Helper: wire up an "Edit Architecture" button to open the editor


// Helper: wire up an "Edit Architecture" button to open the editor
function wireEditArchBtn(btn) {
    btn.addEventListener('click', function() {
        const idx = parseInt(this.getAttribute('data-upload-idx'));
        if (!isNaN(idx) && state.rawUploads[idx]) openArchEditor(idx);
    });
}

export { openArchEditor, wireEditArchBtn, generateId };
