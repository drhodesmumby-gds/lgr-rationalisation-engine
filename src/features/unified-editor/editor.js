/**
 * Unified Editor — main orchestrator module.
 * Manages state, renders the three-pane layout, and handles mode switching
 * between Focus and Bulk modes.
 */

import { renderListPanel, wireListPanel } from './list-panel.js';
import { renderPropsPanel, wirePropsPanel } from './props-panel.js';
import { renderRelPanel, wireRelPanel } from './rel-panel.js';
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

    let html = `<div class="flex flex-col h-screen bg-gray-50" data-unified-editor>`;

    // === Header ===
    html += `<div class="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0">`;

    // Left: title + mode toggle
    html += `<div class="flex items-center gap-4">`;
    html += `<h2 class="text-lg font-bold text-gray-900">${escHtml(title)}</h2>`;

    // Mode toggle (segmented control)
    html += `<div class="inline-flex rounded border border-gray-300 overflow-hidden" data-ue-mode-toggle>`;
    html += `<button type="button" data-ue-mode="focus"
                class="px-3 py-1 text-sm font-medium bg-blue-600 text-white transition-colors">Focus</button>`;
    html += `<button type="button" data-ue-mode="bulk"
                class="px-3 py-1 text-sm font-medium bg-white text-gray-700 border-l border-gray-300 hover:bg-gray-50 transition-colors">Bulk</button>`;
    html += `</div>`;
    html += `</div>`;

    // Right: action buttons
    html += `<div class="flex items-center gap-2">`;
    html += `<button type="button" data-ue-action="back"
                class="px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 hover:underline">Back</button>`;
    html += `<button type="button" data-ue-action="export"
                class="px-3 py-1.5 text-sm border border-blue-600 text-blue-600 rounded hover:bg-blue-50 font-medium">Export JSON</button>`;
    html += `<button type="button" data-ue-action="save"
                class="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-medium">Save</button>`;
    html += `</div>`;

    html += `</div>`;

    // === Focus mode: three-pane grid ===
    html += `<div class="flex-1 overflow-hidden" data-ue-focus-container style="display: grid; grid-template-columns: 230px 1fr 280px;">`;
    html += `<div id="ue-list-panel" class="overflow-y-auto h-full"></div>`;
    html += `<div id="ue-props-panel" class="overflow-y-auto h-full border-l border-gray-200"></div>`;
    html += `<div id="ue-rel-panel" class="overflow-y-auto h-full border-l border-gray-200"></div>`;
    html += `</div>`;

    // === Bulk mode: full-width container (hidden by default) ===
    html += `<div class="flex-1 overflow-hidden hidden" data-ue-bulk-container>`;
    html += `<div id="ue-bulk-panel" class="p-8 text-center text-gray-500">Bulk mode — coming soon</div>`;
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
            onFunctionRemove: handleFunctionRemove
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

    function handleSharedWithChange(nodeIdx, councils) {
        if (nodeIdx == null || !editorState.nodes[nodeIdx]) return;
        editorState.nodes[nodeIdx].sharedWith = councils;
    }

    // --- Mode toggle ---

    function setMode(newMode) {
        if (newMode === mode) return;
        mode = newMode;

        const focusBtn = container.querySelector('[data-ue-mode="focus"]');
        const bulkBtn = container.querySelector('[data-ue-mode="bulk"]');

        if (newMode === 'focus') {
            focusContainer.style.display = 'grid';
            bulkContainer.classList.add('hidden');
            focusBtn.classList.remove('bg-white', 'text-gray-700');
            focusBtn.classList.add('bg-blue-600', 'text-white');
            bulkBtn.classList.remove('bg-blue-600', 'text-white');
            bulkBtn.classList.add('bg-white', 'text-gray-700');
        } else {
            focusContainer.style.display = 'none';
            bulkContainer.classList.remove('hidden');
            bulkBtn.classList.remove('bg-white', 'text-gray-700');
            bulkBtn.classList.add('bg-blue-600', 'text-white');
            focusBtn.classList.remove('bg-blue-600', 'text-white');
            focusBtn.classList.add('bg-white', 'text-gray-700');
        }
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
