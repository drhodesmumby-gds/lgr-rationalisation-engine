/**
 * Unified Editor — main orchestrator module.
 * Manages state, renders the three-pane layout, and handles mode switching
 * between Focus and Bulk modes.
 */

import { renderListPanel, wireListPanel } from './list-panel.js';
import { renderPropsPanel, wirePropsPanel } from './props-panel.js';
import { renderRelPanel, wireRelPanel } from './rel-panel.js';
import { renderBulkMode, wireBulkMode } from './bulk-mode.js';
import { renderDepMatrix, wireDepMatrix } from './dep-matrix.js';
import { LGA_FUNCTIONS } from '../../constants/lga-functions.js';

// --- Rendering ---

/**
 * Render the full unified editor HTML.
 * @param {object} json — architecture data ({ nodes, edges, councilName, councilMetadata })
 * @param {object} [options] — { source: 'scratch'|'edit'|'validator', title? }
 * @returns {string} HTML string
 */
export function renderUnifiedEditor(json, options = {}) {
    const title = options.title || 'Architecture Editor';
    const allUploads = options.allUploads || [];
    const currentIdx = options.currentUploadIdx != null ? options.currentUploadIdx : -1;

    let html = `<div class="flex flex-col h-screen bg-[#f3f2f1] border-t-4 border-[#1d70b8]" data-unified-editor>`;

    // === Header ===
    html += `<div class="flex items-center justify-between px-4 py-2 bg-white border-b border-[#b1b4b6] flex-shrink-0">`;

    // Left: title/council switcher + mode toggle
    html += `<div class="flex items-center gap-4">`;
    if (allUploads.length > 1) {
        html += `<select id="ue-editor-title" data-ue-action="switch-council" class="text-lg font-bold text-[#0b0c0c] border-2 border-[#0b0c0c] px-2 py-0.5 focus:outline-3 focus:outline-[#ffdd00]">`;
        allUploads.forEach((u, i) => {
            const name = u.data.councilName || u.filename || `Upload ${i + 1}`;
            const sel = i === currentIdx ? 'selected' : '';
            html += `<option value="${i}" ${sel}>${escHtml(name)}</option>`;
        });
        html += `</select>`;
    } else {
        html += `<h2 id="ue-editor-title" class="text-lg font-bold text-[#0b0c0c]">${escHtml(title)}</h2>`;
    }

    // Mode toggle (segmented control)
    html += `<div class="inline-flex border border-[#b1b4b6] overflow-hidden" data-ue-mode-toggle>`;
    html += `<button type="button" data-ue-mode="focus"
                class="px-3 py-1 text-sm font-bold bg-[#1d70b8] text-white transition-colors">Focus</button>`;
    html += `<button type="button" data-ue-mode="bulk"
                class="px-3 py-1 text-sm font-bold bg-white text-[#0b0c0c] border-l border-[#b1b4b6] transition-colors">Bulk</button>`;
    html += `</div>`;
    html += `</div>`;

    // Right: action buttons
    html += `<div class="flex items-center gap-2">`;
    html += `<button type="button" data-ue-action="dep-matrix"
                class="px-3 py-1.5 text-sm text-[#1d70b8] hover:text-[#003078] font-bold hover:underline">Dependencies</button>`;
    html += `<button type="button" data-ue-action="back"
                class="px-3 py-1.5 text-sm text-[#1d70b8] hover:text-[#003078] font-bold hover:underline">Back</button>`;
    html += `<button type="button" data-ue-action="export"
                class="gds-btn-secondary px-3 py-1.5 text-sm font-bold">Export JSON</button>`;
    html += `<button type="button" data-ue-action="save"
                class="gds-btn px-4 py-1.5 text-sm">Save</button>`;
    html += `</div>`;

    html += `</div>`;

    // === Focus mode: three-pane grid ===
    html += `<div class="flex-1 overflow-hidden" data-ue-focus-container style="display: grid; grid-template-columns: 230px 1fr 280px;">`;
    html += `<div id="ue-list-panel" class="overflow-y-auto h-full"></div>`;
    html += `<div id="ue-props-panel" class="overflow-y-auto h-full border-l border-[#b1b4b6]"></div>`;
    html += `<div id="ue-rel-panel" class="overflow-y-auto h-full border-l border-[#b1b4b6]"></div>`;
    html += `</div>`;

    // === Bulk mode: full-width container (hidden by default) ===
    html += `<div class="flex-1 overflow-hidden hidden" data-ue-bulk-container>`;
    html += `<div id="ue-bulk-panel" class="h-full overflow-auto"></div>`;
    html += `</div>`;

    // === Dependency matrix: full-width container (hidden by default) ===
    html += `<div class="flex-1 overflow-hidden hidden" data-ue-depmatrix-container>`;
    html += `<div id="ue-depmatrix-panel" class="h-full overflow-auto p-4"></div>`;
    html += `</div>`;

    html += `</div>`;
    return html;
}

// --- Wiring ---

/**
 * Wire the unified editor: manages editorState, wires all panels, mode toggle, and action buttons.
 * @param {HTMLElement} container — the DOM element containing the rendered editor
 * @param {object} json — architecture data to deep-clone into editorState
 * @param {object} [options] — { onSave(data), onBack(), source }
 * @returns {{ getState(): object, destroy(): void }}
 */
export function wireUnifiedEditor(container, json, options = {}) {
    const { onSave, onBack, source } = options;

    // --- State ---
    const editorState = structuredClone(json || {});
    if (!editorState.nodes) editorState.nodes = [];
    if (!editorState.edges) editorState.edges = [];
    if (!editorState.councilMetadata) editorState.councilMetadata = {};

    let selectedIdx = null;
    let mode = 'focus';
    let searchQuery = '';

    // --- DOM references ---
    const focusContainer = container.querySelector('[data-ue-focus-container]');
    const bulkContainer = container.querySelector('[data-ue-bulk-container]');
    const depMatrixContainer = container.querySelector('[data-ue-depmatrix-container]');
    const listPanelEl = container.querySelector('#ue-list-panel');
    const propsPanelEl = container.querySelector('#ue-props-panel');
    const relPanelEl = container.querySelector('#ue-rel-panel');

    // --- Panel render helper ---
    function renderPanel(panelEl, html) {
        if (!panelEl) return;
        panelEl.innerHTML = html;
    }

    // --- Re-render functions ---

    function rerenderList() {
        const html = renderListPanel(editorState, { selectedIdx, searchQuery });
        renderPanel(listPanelEl, html);
        wireListPanel(listPanelEl, {
            onSelect: handleSelect,
            onAdd: handleAdd,
            onSearch: handleSearch
        });
    }

    function rerenderProps() {
        const system = selectedIdx != null ? editorState.nodes[selectedIdx] : null;
        const html = renderPropsPanel(system, editorState);
        renderPanel(propsPanelEl, html);

        // Set data attribute so props panel can resolve nodeIdx
        if (selectedIdx != null) {
            propsPanelEl.dataset.selectedIdx = String(selectedIdx);
        } else {
            delete propsPanelEl.dataset.selectedIdx;
        }

        wirePropsPanel(propsPanelEl, {
            onChange: handleFieldChange,
            onFunctionAdd: handleFunctionAdd,
            onFunctionRemove: handleFunctionRemove,
            onDelete: handleDelete
        });
    }

    function rerenderRel() {
        const system = selectedIdx != null ? editorState.nodes[selectedIdx] : null;
        const html = renderRelPanel(system, editorState);
        renderPanel(relPanelEl, html);

        // Set data attribute so rel panel can resolve nodeIdx
        if (selectedIdx != null) {
            relPanelEl.dataset.selectedIdx = String(selectedIdx);
        } else {
            delete relPanelEl.dataset.selectedIdx;
        }

        wireRelPanel(relPanelEl, {
            onCapabilityToggle: handleCapabilityToggle,
            onCustomCapability: handleCustomCapability,
            onConsumerAdd: handleConsumerAdd,
            onConsumerRemove: handleConsumerRemove,
            onConsumerCapToggle: handleConsumerCapToggle,
            onDependencyAdd: handleDependencyAdd,
            onDependencyRemove: handleDependencyRemove,
            onDependencyCapToggle: handleDependencyCapToggle,
            onSharedWithChange: handleSharedWithChange
        });
    }

    // --- Event handlers ---

    function handleSelect(nodeIdx) {
        selectedIdx = nodeIdx;
        rerenderProps();
        rerenderRel();
        rerenderList(); // update selection highlight
    }

    function handleAdd() {
        const newId = `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const newNode = {
            id: newId,
            label: '',
            type: 'ITSystem',
            vendor: '',
            users: null,
            annualCost: null,
            endYear: null,
            endMonth: null,
            noticePeriod: null,
            portability: '',
            dataPartitioning: '',
            isCloud: null,
            isERP: false,
            supportModel: '',
            sharedWith: [],
            capabilityType: []
        };
        editorState.nodes.push(newNode);
        selectedIdx = editorState.nodes.length - 1;
        rerenderList();
        rerenderProps();
        rerenderRel();
    }

    function handleSearch(query) {
        searchQuery = query;
        rerenderList();
    }

    function handleFieldChange(nodeIdx, field, value) {
        if (nodeIdx == null || !editorState.nodes[nodeIdx]) return;
        editorState.nodes[nodeIdx][field] = value;
        // Re-render list (completeness may change) and props (if currently selected)
        rerenderList();
        if (nodeIdx === selectedIdx) {
            // Don't re-render props to avoid losing focus — only re-render list for completeness update
        }
    }

    function handleFunctionAdd(nodeIdx, lgaId) {
        if (nodeIdx == null || !editorState.nodes[nodeIdx]) return;
        const system = editorState.nodes[nodeIdx];

        // Find or create the Function node
        let fnNode = editorState.nodes.find(
            n => n.type === 'Function' && n.lgaFunctionId === lgaId
        );
        if (!fnNode) {
            const lgaEntry = LGA_FUNCTIONS.find(f => f.id === lgaId);
            fnNode = {
                id: `fn-${lgaId}`,
                label: lgaEntry ? lgaEntry.label : `Function ${lgaId}`,
                type: 'Function',
                lgaFunctionId: lgaId
            };
            editorState.nodes.push(fnNode);
        }

        // Add REALIZES edge if not present
        const existingEdge = editorState.edges.find(
            e => e.source === system.id && e.target === fnNode.id && e.relationship === 'REALIZES'
        );
        if (!existingEdge) {
            editorState.edges.push({
                source: system.id,
                target: fnNode.id,
                relationship: 'REALIZES'
            });
        }

        rerenderList();
        rerenderProps();
        rerenderRel();
    }

    function handleFunctionRemove(nodeIdx, lgaId) {
        if (nodeIdx == null || !editorState.nodes[nodeIdx]) return;
        const system = editorState.nodes[nodeIdx];

        // Find the Function node
        const fnNode = editorState.nodes.find(
            n => n.type === 'Function' && n.lgaFunctionId === lgaId
        );
        if (!fnNode) return;

        // Remove the REALIZES edge
        editorState.edges = editorState.edges.filter(
            e => !(e.source === system.id && e.target === fnNode.id && e.relationship === 'REALIZES')
        );

        // Check if the Function node is now orphaned (no edges pointing to it)
        const hasOtherEdges = editorState.edges.some(
            e => e.source === fnNode.id || e.target === fnNode.id
        );
        if (!hasOtherEdges) {
            editorState.nodes = editorState.nodes.filter(n => n !== fnNode);
            // Adjust selectedIdx if needed
            if (selectedIdx != null && selectedIdx >= editorState.nodes.length) {
                selectedIdx = editorState.nodes.length - 1;
                if (selectedIdx < 0) selectedIdx = null;
            }
        }

        rerenderList();
        rerenderProps();
        rerenderRel();
    }

    function handleDelete(nodeIdx) {
        if (nodeIdx == null || !editorState.nodes[nodeIdx]) return;
        const system = editorState.nodes[nodeIdx];
        // Remove all edges involving this system
        editorState.edges = editorState.edges.filter(
            e => e.source !== system.id && e.target !== system.id
        );
        // Remove the node
        editorState.nodes.splice(nodeIdx, 1);
        // Clear selection
        selectedIdx = null;
        rerenderList();
        rerenderProps();
        rerenderRel();
    }

    function handleCapabilityToggle(nodeIdx, capId, active) {
        if (nodeIdx == null || !editorState.nodes[nodeIdx]) return;
        const system = editorState.nodes[nodeIdx];
        if (!system.capabilityType) system.capabilityType = [];

        if (active) {
            if (!system.capabilityType.includes(capId)) {
                system.capabilityType.push(capId);
            }
        } else {
            system.capabilityType = system.capabilityType.filter(c => c !== capId);
        }

        rerenderRel();
    }

    function handleCustomCapability(nodeIdx, capId) {
        if (nodeIdx == null || !editorState.nodes[nodeIdx]) return;
        const system = editorState.nodes[nodeIdx];
        if (!system.capabilityType) system.capabilityType = [];
        if (!system.capabilityType.includes(capId)) {
            system.capabilityType.push(capId);
        }
        rerenderRel();
    }

    function handleConsumerAdd(nodeIdx, consumerSysId) {
        if (nodeIdx == null || !editorState.nodes[nodeIdx]) return;
        const system = editorState.nodes[nodeIdx];

        // Add CONSUMES_CAPABILITY edge from consumer to this system
        const existingEdge = editorState.edges.find(
            e => e.source === consumerSysId && e.target === system.id && e.relationship === 'CONSUMES_CAPABILITY'
        );
        if (!existingEdge) {
            editorState.edges.push({
                source: consumerSysId,
                target: system.id,
                relationship: 'CONSUMES_CAPABILITY',
                capabilities: []
            });
        }

        rerenderRel();
    }

    function handleConsumerRemove(nodeIdx, consumerSysId) {
        if (nodeIdx == null || !editorState.nodes[nodeIdx]) return;
        const system = editorState.nodes[nodeIdx];

        editorState.edges = editorState.edges.filter(
            e => !(e.source === consumerSysId && e.target === system.id && e.relationship === 'CONSUMES_CAPABILITY')
        );

        rerenderRel();
    }

    function handleConsumerCapToggle(nodeIdx, consumerSysId, capId, active) {
        if (nodeIdx == null || !editorState.nodes[nodeIdx]) return;
        const system = editorState.nodes[nodeIdx];

        const edge = editorState.edges.find(
            e => e.source === consumerSysId && e.target === system.id && e.relationship === 'CONSUMES_CAPABILITY'
        );
        if (!edge) return;
        if (!edge.capabilities) edge.capabilities = [];

        if (active) {
            if (!edge.capabilities.includes(capId)) {
                edge.capabilities.push(capId);
            }
        } else {
            edge.capabilities = edge.capabilities.filter(c => c !== capId);
        }

        // No re-render needed — visual state already toggled inline by rel-panel
    }

    function handleDependencyAdd(nodeIdx, providerSysId, caps) {
        if (nodeIdx == null || !editorState.nodes[nodeIdx]) return;
        const system = editorState.nodes[nodeIdx];

        const existingEdge = editorState.edges.find(
            e => e.source === system.id && e.target === providerSysId && e.relationship === 'CONSUMES_CAPABILITY'
        );
        if (!existingEdge) {
            editorState.edges.push({
                source: system.id,
                target: providerSysId,
                relationship: 'CONSUMES_CAPABILITY',
                capabilities: caps || []
            });
        }

        rerenderRel();
    }

    function handleDependencyRemove(nodeIdx, edgeIdx) {
        if (edgeIdx == null || edgeIdx < 0 || edgeIdx >= editorState.edges.length) return;
        editorState.edges.splice(edgeIdx, 1);
        rerenderRel();
    }

    function handleDependencyCapToggle(nodeIdx, edgeIdx, capId, active) {
        if (edgeIdx == null || edgeIdx < 0 || edgeIdx >= editorState.edges.length) return;
        const edge = editorState.edges[edgeIdx];
        if (!edge.capabilities) edge.capabilities = [];
        if (active) {
            if (!edge.capabilities.includes(capId)) edge.capabilities.push(capId);
        } else {
            edge.capabilities = edge.capabilities.filter(c => c !== capId);
        }
    }

    function handleSharedWithChange(nodeIdx, councils) {
        if (nodeIdx == null || !editorState.nodes[nodeIdx]) return;
        editorState.nodes[nodeIdx].sharedWith = councils;
    }

    // --- Mode toggle ---

    function rerenderBulk() {
        const bulkPanelEl = container.querySelector('#ue-bulk-panel');
        if (!bulkPanelEl) return;
        bulkPanelEl.innerHTML = renderBulkMode(editorState);
        wireBulkMode(bulkPanelEl, editorState, {
            onChange(nodeIdx, field, value) {
                if (field === 'contractEnd' && typeof value === 'object') {
                    editorState.nodes[nodeIdx].endMonth = value.endMonth;
                    editorState.nodes[nodeIdx].endYear = value.endYear;
                } else if (field === 'function' && typeof value === 'object' && value.type === 'function') {
                    // Update function assignment via edges
                    if (value.lgaId) {
                        const system = editorState.nodes[nodeIdx];
                        // Remove existing REALIZES edges for this system
                        editorState.edges = editorState.edges.filter(
                            e => !(e.source === system.id && e.relationship === 'REALIZES')
                        );
                        // Find or create function node
                        let fnNode = editorState.nodes.find(
                            n => n.type === 'Function' && n.lgaFunctionId === value.lgaId
                        );
                        if (!fnNode) {
                            const lgaEntry = LGA_FUNCTIONS.find(f => f.id === value.lgaId);
                            fnNode = {
                                id: `fn-${value.lgaId}`,
                                label: lgaEntry ? lgaEntry.label : value.label,
                                type: 'Function',
                                lgaFunctionId: value.lgaId
                            };
                            editorState.nodes.push(fnNode);
                        }
                        // Add REALIZES edge
                        editorState.edges.push({
                            source: system.id,
                            target: fnNode.id,
                            relationship: 'REALIZES'
                        });
                    }
                } else {
                    editorState.nodes[nodeIdx][field] = value;
                }
            },
            onFocusSystem(nodeIdx) {
                selectedIdx = nodeIdx;
                setMode('focus');
                rerenderList();
                rerenderProps();
                rerenderRel();
            }
        });
    }

    function setMode(newMode) {
        if (newMode === mode) return;
        mode = newMode;

        // Hide dep matrix when switching modes
        depMatrixContainer.classList.add('hidden');

        const focusBtn = container.querySelector('[data-ue-mode="focus"]');
        const bulkBtn = container.querySelector('[data-ue-mode="bulk"]');

        if (newMode === 'focus') {
            focusContainer.style.display = 'grid';
            bulkContainer.classList.add('hidden');
            focusBtn.classList.remove('bg-white', 'text-[#0b0c0c]', 'border-l', 'border-[#b1b4b6]');
            focusBtn.classList.add('bg-[#1d70b8]', 'text-white');
            bulkBtn.classList.remove('bg-[#1d70b8]', 'text-white');
            bulkBtn.classList.add('bg-white', 'text-[#0b0c0c]', 'border-l', 'border-[#b1b4b6]');
            rerenderList();
        } else {
            focusContainer.style.display = 'none';
            bulkContainer.classList.remove('hidden');
            bulkBtn.classList.remove('bg-white', 'text-[#0b0c0c]', 'border-l', 'border-[#b1b4b6]');
            bulkBtn.classList.add('bg-[#1d70b8]', 'text-white');
            focusBtn.classList.remove('bg-[#1d70b8]', 'text-white');
            focusBtn.classList.add('bg-white', 'text-[#0b0c0c]', 'border-l', 'border-[#b1b4b6]');
            rerenderBulk();
        }
    }

    function showDepMatrix() {
        // Hide focus and bulk, show dep matrix
        focusContainer.style.display = 'none';
        bulkContainer.classList.add('hidden');
        depMatrixContainer.classList.remove('hidden');

        const depPanelEl = container.querySelector('#ue-depmatrix-panel');
        if (!depPanelEl) return;
        depPanelEl.innerHTML = renderDepMatrix(editorState);
        wireDepMatrix(depPanelEl, {
            onBack() {
                depMatrixContainer.classList.add('hidden');
                setMode(mode); // restore previous mode view
                // Force the mode re-display since setMode guards against same-mode
                if (mode === 'focus') {
                    focusContainer.style.display = 'grid';
                } else {
                    bulkContainer.classList.remove('hidden');
                }
            },
            onJumpToSystem(nodeIdx) {
                depMatrixContainer.classList.add('hidden');
                focusContainer.style.display = 'grid';
                bulkContainer.classList.add('hidden');
                mode = 'focus';
                const focusBtn = container.querySelector('[data-ue-mode="focus"]');
                const bulkBtn = container.querySelector('[data-ue-mode="bulk"]');
                focusBtn.classList.remove('bg-white', 'text-[#0b0c0c]', 'border-l', 'border-[#b1b4b6]');
                focusBtn.classList.add('bg-[#1d70b8]', 'text-white');
                bulkBtn.classList.remove('bg-[#1d70b8]', 'text-white');
                bulkBtn.classList.add('bg-white', 'text-[#0b0c0c]', 'border-l', 'border-[#b1b4b6]');
                selectedIdx = nodeIdx;
                rerenderList();
                rerenderProps();
                rerenderRel();
            }
        });
    }

    // --- Wire mode toggle buttons ---
    const modeToggle = container.querySelector('[data-ue-mode-toggle]');
    if (modeToggle) {
        modeToggle.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-ue-mode]');
            if (btn) {
                setMode(btn.dataset.ueMode);
            }
        });
    }

    // --- Wire action buttons ---
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-ue-action]');
        if (!btn) return;

        const action = btn.dataset.ueAction;
        switch (action) {
            case 'back':
                if (onBack) onBack();
                break;
            case 'save':
                if (onSave) onSave(editorState);
                break;
            case 'export': {
                const blob = new Blob(
                    [JSON.stringify(editorState, null, 2)],
                    { type: 'application/json' }
                );
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = (editorState.councilName || 'architecture') + '.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                break;
            }
            case 'dep-matrix':
                showDepMatrix();
                break;
        }
    });

    // --- Council switcher ---
    container.addEventListener('change', (e) => {
        if (e.target.matches('[data-ue-action="switch-council"]')) {
            const newIdx = parseInt(e.target.value, 10);
            if (!isNaN(newIdx) && options.onSwitchCouncil) {
                if (onSave) onSave(editorState);
                options.onSwitchCouncil(newIdx);
            }
        }
    });

    // --- Initial render ---
    rerenderList();
    rerenderProps();
    rerenderRel();

    // --- Public API ---
    return {
        getState() {
            return editorState;
        },
        destroy() {
            // Clear panel contents to release event listeners
            if (listPanelEl) listPanelEl.innerHTML = '';
            if (propsPanelEl) propsPanelEl.innerHTML = '';
            if (relPanelEl) relPanelEl.innerHTML = '';
        }
    };
}

// --- Utility ---

function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
