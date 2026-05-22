/**
 * Rel Panel — right pane of the unified architecture editor.
 * Capabilities, consuming systems, dependencies, and sharing relationships.
 */

import { LGAM_CAPABILITIES } from '../../constants/capabilities.js';
import { renderCapabilityPills, renderChipSelector, wireSmartInputs } from './smart-inputs.js';

// --- Rendering ---

/**
 * Render the relationships panel for the selected system.
 * @param {object|null} system — the ITSystem node object, or null if nothing selected
 * @param {object} editorState — { nodes, edges, councilName, councilMetadata }
 * @returns {string} HTML string
 */
export function renderRelPanel(system, editorState) {
    if (!system) {
        return `<div class="flex items-center justify-center h-full text-sm text-[#505a5f]">
            Select a system to view its relationships.
        </div>`;
    }

    const { nodes, edges } = editorState;
    const activeCaps = system.capabilityType || [];
    const hasCaps = activeCaps.length > 0;

    // Find consumers: edges where target = this system, relationship = CONSUMES_CAPABILITY
    const consumerEdges = edges
        .map((e, idx) => ({ ...e, _edgeIdx: idx }))
        .filter(e => e.target === system.id && e.relationship === 'CONSUMES_CAPABILITY');

    // Find dependencies: edges where source = this system, relationship = CONSUMES_CAPABILITY
    const dependencyEdges = edges
        .map((e, idx) => ({ ...e, _edgeIdx: idx }))
        .filter(e => e.source === system.id && e.relationship === 'CONSUMES_CAPABILITY');

    let html = `<div class="p-4 overflow-y-auto h-full" data-rel-panel>`;

    // === Section 1: Capabilities Provided ===
    html += sectionHeading('Capabilities Provided');
    html += `<div class="mb-5">`;
    html += renderCapabilityPills({
        active: activeCaps,
        vocabulary: LGAM_CAPABILITIES,
        allowCustom: true
    });
    html += `</div>`;

    // === Section 2: Systems Consuming from This ===
    if (hasCaps) {
        html += sectionHeading('Systems Consuming from This');
        html += `<div class="mb-5" data-rel-consumers>`;

        if (consumerEdges.length === 0) {
            html += `<p class="text-xs text-[#505a5f] italic mb-2">No systems consume capabilities from this system.</p>`;
        }

        for (const edge of consumerEdges) {
            const consumerNode = nodes.find(n => n.id === edge.source);
            if (!consumerNode) continue;
            const edgeCaps = edge.capabilities || [];

            html += `<div class="ml-2 mb-2 p-2 bg-[#f3f2f1] border border-[#b1b4b6]">`;
            html += `<div class="flex items-center justify-between">`;
            html += `<span class="text-sm font-bold text-[#0b0c0c]">${escHtml(consumerNode.label || consumerNode.id)}</span>`;
            html += `<button type="button"
                        class="text-[#d4351c] hover:text-[#942514] text-sm leading-none"
                        data-rel-action="remove-consumer"
                        data-rel-consumer-id="${escAttr(consumerNode.id)}"
                        aria-label="Remove ${escAttr(consumerNode.label || consumerNode.id)}">&times;</button>`;
            html += `</div>`;

            // Show toggleable pills for this consumer's capabilities (subset of provider's active caps)
            html += `<div class="flex flex-wrap gap-1 mt-1.5" data-rel-consumer-caps="${escAttr(consumerNode.id)}">`;
            for (const cap of activeCaps) {
                const capDef = LGAM_CAPABILITIES.find(c => c.id === cap) || { id: cap, label: cap };
                const isUsed = edgeCaps.includes(cap);
                const classes = isUsed
                    ? 'bg-[#1d70b8] text-white border-[#1d70b8]'
                    : 'bg-[#f3f2f1] text-[#505a5f] border-[#b1b4b6]';
                html += `<button type="button"
                            class="inline-flex items-center px-2 py-0.5 text-xs font-bold border transition-colors ${classes}"
                            data-rel-action="toggle-consumer-cap"
                            data-rel-consumer-id="${escAttr(consumerNode.id)}"
                            data-rel-cap-id="${escAttr(cap)}"
                            aria-pressed="${isUsed}">
                            ${escHtml(capDef.label)}
                        </button>`;
            }
            html += `</div>`;
            html += `</div>`;
        }

        // Add consumer link/dropdown
        html += renderAddConsumerControl(system, nodes, edges, consumerEdges);
        html += `</div>`;
    }

    // === Section 3: Depends On ===
    html += sectionHeading('Depends On');
    html += `<div class="mb-5" data-rel-dependencies>`;

    if (dependencyEdges.length === 0) {
        html += `<p class="text-xs text-[#505a5f] italic mb-2">This system does not consume capabilities from others.</p>`;
    }

    for (const edge of dependencyEdges) {
        const providerNode = nodes.find(n => n.id === edge.target);
        if (!providerNode) continue;
        const edgeCaps = edge.capabilities || [];
        const providerCaps = providerNode.capabilityType || [];

        html += `<div class="ml-2 mb-2 p-2 bg-[#f3f2f1] border border-[#b1b4b6]">`;
        html += `<div class="flex items-center justify-between">`;
        html += `<span class="text-sm font-bold text-[#0b0c0c]">${escHtml(providerNode.label || providerNode.id)}</span>`;
        html += `<button type="button"
                    class="text-[#d4351c] hover:text-[#942514] text-sm leading-none"
                    data-rel-action="remove-dependency"
                    data-rel-edge-idx="${edge._edgeIdx}"
                    aria-label="Remove dependency on ${escAttr(providerNode.label || providerNode.id)}">&times;</button>`;
        html += `</div>`;
        if (providerCaps.length > 0) {
            html += `<div class="flex flex-wrap gap-1 mt-1.5">`;
            for (const capId of providerCaps) {
                const capDef = LGAM_CAPABILITIES.find(c => c.id === capId) || { id: capId, label: capId };
                const isActive = edgeCaps.includes(capId);
                const classes = isActive
                    ? 'bg-[#1d70b8] text-white border-[#1d70b8]'
                    : 'bg-[#f3f2f1] text-[#505a5f] border-[#b1b4b6]';
                html += `<button type="button"
                            class="inline-flex items-center px-2 py-0.5 text-xs font-bold border transition-colors ${classes}"
                            data-rel-action="toggle-dep-cap"
                            data-rel-edge-idx="${edge._edgeIdx}"
                            data-rel-cap-id="${escAttr(capId)}"
                            aria-pressed="${isActive}">
                            ${escHtml(capDef.label)}
                        </button>`;
            }
            html += `</div>`;
        }
        html += `</div>`;
    }

    // Add dependency link/dropdown
    html += renderAddDependencyControl(system, nodes, dependencyEdges);
    html += `<div data-rel-dep-cap-picker></div>`;
    html += `</div>`;

    // === Section 4: Shared With ===
    html += sectionHeading('Shared With');
    html += `<div class="mb-5">`;
    // Collect all council names from sharedWith arrays across all systems
    const allCouncilNames = [...new Set(
        nodes.filter(n => n.type === 'ITSystem' && n.sharedWith)
            .flatMap(n => n.sharedWith)
    )].sort();
    if (editorState.councilName && !allCouncilNames.includes(editorState.councilName)) {
        allCouncilNames.push(editorState.councilName);
        allCouncilNames.sort();
    }
    html += renderChipSelector({
        chips: system.sharedWith || [],
        placeholder: 'Council name...',
        name: 'sharedWith',
        datalistId: 'shared-with-datalist',
        datalistOptions: allCouncilNames
    });
    html += `</div>`;

    html += `</div>`;
    return html;
}

// --- Event Wiring ---

/**
 * Wire event listeners for the relationships panel.
 * @param {HTMLElement} container — DOM element containing the rendered rel panel
 * @param {object} options
 * @param {function} options.onCapabilityToggle — (nodeIdx, capId, active)
 * @param {function} options.onCustomCapability — (nodeIdx, capId)
 * @param {function} options.onConsumerAdd — (nodeIdx, consumerSysId)
 * @param {function} options.onConsumerRemove — (nodeIdx, consumerSysId)
 * @param {function} options.onConsumerCapToggle — (nodeIdx, consumerSysId, capId, active)
 * @param {function} options.onDependencyAdd — (nodeIdx, providerSysId, caps)
 * @param {function} options.onDependencyRemove — (nodeIdx, edgeIdx)
 * @param {function} options.onSharedWithChange — (nodeIdx, councils)
 */
export function wireRelPanel(container, options = {}) {
    const {
        onCapabilityToggle,
        onCustomCapability,
        onConsumerAdd,
        onConsumerRemove,
        onConsumerCapToggle,
        onDependencyAdd,
        onDependencyRemove,
        onDependencyCapToggle,
        onSharedWithChange
    } = options;

    const panel = container.querySelector('[data-rel-panel]');
    if (!panel) return;

    function getNodeIdx() {
        const idx = container.dataset.selectedIdx;
        return idx != null ? parseInt(idx, 10) : null;
    }

    // Wire smart inputs for chip and capability pill interactions
    wireSmartInputs(panel, {
        onChipChange(name, chips) {
            if (name !== 'sharedWith') return;
            const nodeIdx = getNodeIdx();
            if (nodeIdx == null || !onSharedWithChange) return;
            onSharedWithChange(nodeIdx, chips);
        },
        onCapabilityToggle(capId, isActive) {
            const nodeIdx = getNodeIdx();
            if (nodeIdx == null) return;

            // Check if this is a custom capability (not in vocabulary)
            const isCustom = !LGAM_CAPABILITIES.some(c => c.id === capId);
            if (isCustom && isActive && onCustomCapability) {
                onCustomCapability(nodeIdx, capId);
            } else if (onCapabilityToggle) {
                onCapabilityToggle(nodeIdx, capId, isActive);
            }
        }
    });

    // Capability picker toggle (dependency flow)
    panel.addEventListener('click', (e) => {
        const capBtn = e.target.closest('[data-dep-cap-select]');
        if (!capBtn) return;
        const wasActive = capBtn.getAttribute('aria-pressed') === 'true';
        capBtn.setAttribute('aria-pressed', String(!wasActive));
        if (wasActive) {
            capBtn.classList.remove('bg-[#1d70b8]', 'text-white', 'border-[#1d70b8]');
            capBtn.classList.add('bg-[#f3f2f1]', 'text-[#505a5f]', 'border-[#b1b4b6]');
        } else {
            capBtn.classList.remove('bg-[#f3f2f1]', 'text-[#505a5f]', 'border-[#b1b4b6]');
            capBtn.classList.add('bg-[#1d70b8]', 'text-white', 'border-[#1d70b8]');
        }
    });

    // Click delegation for rel-panel-specific actions
    panel.addEventListener('click', (e) => {
        const target = e.target.closest('[data-rel-action]');
        if (!target) return;

        const action = target.dataset.relAction;
        const nodeIdx = getNodeIdx();
        if (nodeIdx == null) return;

        switch (action) {
            case 'remove-consumer': {
                const consumerId = target.dataset.relConsumerId;
                if (consumerId && onConsumerRemove) {
                    onConsumerRemove(nodeIdx, consumerId);
                }
                break;
            }

            case 'toggle-consumer-cap': {
                const consumerId = target.dataset.relConsumerId;
                const capId = target.dataset.relCapId;
                const wasActive = target.getAttribute('aria-pressed') === 'true';
                const nowActive = !wasActive;

                // Update visual state
                target.setAttribute('aria-pressed', String(nowActive));
                if (nowActive) {
                    target.classList.remove('bg-[#f3f2f1]', 'text-[#505a5f]', 'border-[#b1b4b6]');
                    target.classList.add('bg-[#1d70b8]', 'text-white', 'border-[#1d70b8]');
                } else {
                    target.classList.remove('bg-[#1d70b8]', 'text-white', 'border-[#1d70b8]');
                    target.classList.add('bg-[#f3f2f1]', 'text-[#505a5f]', 'border-[#b1b4b6]');
                }

                if (consumerId && capId && onConsumerCapToggle) {
                    onConsumerCapToggle(nodeIdx, consumerId, capId, nowActive);
                }
                break;
            }

            case 'toggle-dep-cap': {
                const edgeIdx = parseInt(target.dataset.relEdgeIdx, 10);
                const capId = target.dataset.relCapId;
                const wasActive = target.getAttribute('aria-pressed') === 'true';
                const nowActive = !wasActive;

                // Update visual state
                target.setAttribute('aria-pressed', String(nowActive));
                if (nowActive) {
                    target.classList.remove('bg-[#f3f2f1]', 'text-[#505a5f]', 'border-[#b1b4b6]');
                    target.classList.add('bg-[#1d70b8]', 'text-white', 'border-[#1d70b8]');
                } else {
                    target.classList.remove('bg-[#1d70b8]', 'text-white', 'border-[#1d70b8]');
                    target.classList.add('bg-[#f3f2f1]', 'text-[#505a5f]', 'border-[#b1b4b6]');
                }

                if (!isNaN(edgeIdx) && capId && onDependencyCapToggle) {
                    onDependencyCapToggle(nodeIdx, edgeIdx, capId, nowActive);
                }
                break;
            }

            case 'remove-dependency': {
                const edgeIdx = parseInt(target.dataset.relEdgeIdx, 10);
                if (!isNaN(edgeIdx) && onDependencyRemove) {
                    onDependencyRemove(nodeIdx, edgeIdx);
                }
                break;
            }

            case 'show-add-consumer': {
                const dropdown = panel.querySelector('[data-rel-consumer-dropdown]');
                if (dropdown) {
                    dropdown.classList.toggle('hidden');
                }
                break;
            }

            case 'select-consumer': {
                const sysId = target.dataset.relSysId;
                if (sysId && onConsumerAdd) {
                    onConsumerAdd(nodeIdx, sysId);
                }
                // Hide dropdown
                const dropdown = panel.querySelector('[data-rel-consumer-dropdown]');
                if (dropdown) dropdown.classList.add('hidden');
                break;
            }

            case 'show-add-dependency': {
                const dropdown = panel.querySelector('[data-rel-dependency-dropdown]');
                if (dropdown) {
                    dropdown.classList.toggle('hidden');
                }
                break;
            }

            case 'select-dependency': {
                const sysId = target.dataset.relSysId;
                const capsStr = target.dataset.relCaps || '';
                const allCaps = capsStr ? capsStr.split(',') : [];
                // Hide system list, show capability picker for this provider
                const dropdown = panel.querySelector('[data-rel-dependency-dropdown]');
                if (dropdown) dropdown.classList.add('hidden');
                const pickerArea = panel.querySelector('[data-rel-dep-cap-picker]');
                if (pickerArea && allCaps.length > 0) {
                    const providerLabel = target.querySelector('.font-bold')?.textContent || sysId;
                    let pickerHtml = `<div class="mt-2 p-2 border-2 border-[#0b0c0c] bg-white">`;
                    pickerHtml += `<p class="text-xs font-bold text-[#0b0c0c] mb-1">Select capabilities to consume from ${escHtml(providerLabel)}:</p>`;
                    pickerHtml += `<div class="flex flex-wrap gap-1 mb-2">`;
                    for (const capId of allCaps) {
                        const def = LGAM_CAPABILITIES.find(x => x.id === capId);
                        const label = def ? def.label : capId;
                        pickerHtml += `<button type="button"
                            class="inline-flex items-center px-2 py-1 text-xs font-bold border bg-[#f3f2f1] text-[#505a5f] border-[#b1b4b6]"
                            data-dep-cap-select="${escAttr(capId)}" aria-pressed="false">${escHtml(label)}</button>`;
                    }
                    pickerHtml += `</div>`;
                    pickerHtml += `<div class="flex gap-2">`;
                    pickerHtml += `<button type="button" data-rel-action="confirm-dependency" data-rel-sys-id="${escAttr(sysId)}"
                        class="gds-btn px-3 py-1 text-xs">Add dependency</button>`;
                    pickerHtml += `<button type="button" data-rel-action="cancel-dependency"
                        class="text-xs text-[#1d70b8] hover:text-[#003078] underline font-bold">Cancel</button>`;
                    pickerHtml += `</div></div>`;
                    pickerArea.innerHTML = pickerHtml;
                } else if (sysId && onDependencyAdd) {
                    onDependencyAdd(nodeIdx, sysId, allCaps);
                }
                break;
            }

            case 'confirm-dependency': {
                const sysId = target.dataset.relSysId;
                const pickerArea = panel.querySelector('[data-rel-dep-cap-picker]');
                if (pickerArea && sysId && onDependencyAdd) {
                    const selectedCaps = [];
                    pickerArea.querySelectorAll('[data-dep-cap-select][aria-pressed="true"]').forEach(btn => {
                        selectedCaps.push(btn.dataset.depCapSelect);
                    });
                    onDependencyAdd(nodeIdx, sysId, selectedCaps);
                    pickerArea.innerHTML = '';
                }
                break;
            }

            case 'cancel-dependency': {
                const pickerArea = panel.querySelector('[data-rel-dep-cap-picker]');
                if (pickerArea) pickerArea.innerHTML = '';
                break;
            }
        }
    });

    // Filter input delegation for dropdowns
    panel.addEventListener('input', (e) => {
        if (e.target.matches('[data-rel-filter]')) {
            const query = e.target.value.toLowerCase();
            const dropdown = e.target.closest('[data-rel-consumer-dropdown], [data-rel-dependency-dropdown]');
            if (dropdown) {
                dropdown.querySelectorAll('[data-rel-action^="select-"]').forEach(btn => {
                    const text = btn.textContent.toLowerCase();
                    btn.style.display = text.includes(query) ? '' : 'none';
                });
                // Also show/hide group headers if all their items are hidden
                dropdown.querySelectorAll('[data-rel-group-header]').forEach(header => {
                    const next = [];
                    let sibling = header.nextElementSibling;
                    while (sibling && !sibling.hasAttribute('data-rel-group-header')) {
                        next.push(sibling);
                        sibling = sibling.nextElementSibling;
                    }
                    const anyVisible = next.some(el => el.style.display !== 'none');
                    header.style.display = anyVisible ? '' : 'none';
                });
            }
        }
    });
}

// --- Internal helpers ---

/**
 * Render the "+ Add consuming system" control with a hideable dropdown.
 */
function renderAddConsumerControl(system, nodes, edges, consumerEdges) {
    const existingConsumerIds = new Set(consumerEdges.map(e => e.source));
    const candidates = nodes.filter(n =>
        n.type === 'ITSystem' &&
        n.id !== system.id &&
        !existingConsumerIds.has(n.id)
    ).sort((a, b) => (a.label || '').localeCompare(b.label || ''));

    if (candidates.length === 0) {
        return `<p class="text-xs text-[#505a5f] mt-1">No other systems available to add.</p>`;
    }

    // Group candidates by domain (function) for easier navigation
    const grouped = groupCandidatesByDomain(candidates, nodes, edges);

    let html = `<div class="mt-2">`;
    html += `<button type="button"
                class="text-xs text-[#1d70b8] hover:text-[#003078] underline font-bold"
                data-rel-action="show-add-consumer">+ Add consuming system</button>`;
    html += `<div class="hidden mt-1 max-h-48 overflow-y-auto border-2 border-[#0b0c0c] bg-white" data-rel-consumer-dropdown>`;
    html += `<input type="text" placeholder="Filter systems..." data-rel-filter="consumer"
        class="w-full px-2 py-1 text-sm border-b-2 border-[#0b0c0c] mb-1 sticky top-0 bg-white z-10 focus:outline-3 focus:outline-[#ffdd00]" />`;
    for (const group of grouped) {
        if (group.label) {
            html += `<div class="px-2 py-0.5 bg-[#f3f2f1] text-xs font-bold text-[#505a5f] border-b border-[#b1b4b6]" data-rel-group-header>${escHtml(group.label)}</div>`;
        }
        for (const node of group.systems) {
            html += `<button type="button"
                        class="block w-full text-left px-3 py-1.5 text-sm hover:bg-[#f3f2f1] text-[#0b0c0c] border-b border-[#f3f2f1]"
                        data-rel-action="select-consumer"
                        data-rel-sys-id="${escAttr(node.id)}">
                        ${escHtml(node.label || node.id)}
                        ${node.vendor ? `<span class="text-xs text-[#505a5f] ml-1">(${escHtml(node.vendor)})</span>` : ''}
                    </button>`;
        }
    }
    html += `</div>`;
    html += `</div>`;
    return html;
}

/**
 * Render the "+ Add dependency" control with a hideable dropdown.
 * Only shows systems that provide capabilities (have capabilityType set).
 */
function renderAddDependencyControl(system, nodes, dependencyEdges) {
    const existingProviderIds = new Set(dependencyEdges.map(e => e.target));
    const candidates = nodes.filter(n =>
        n.type === 'ITSystem' &&
        n.id !== system.id &&
        !existingProviderIds.has(n.id) &&
        n.capabilityType && n.capabilityType.length > 0
    ).sort((a, b) => (a.label || '').localeCompare(b.label || ''));

    if (candidates.length === 0) {
        return `<p class="text-xs text-[#505a5f] mt-1">No capability providers available to add.</p>`;
    }

    let html = `<div class="mt-2">`;
    html += `<button type="button"
                class="text-xs text-[#1d70b8] hover:text-[#003078] underline font-bold"
                data-rel-action="show-add-dependency">+ Add dependency</button>`;
    html += `<div class="hidden mt-1 max-h-48 overflow-y-auto border-2 border-[#0b0c0c] bg-white" data-rel-dependency-dropdown>`;
    html += `<input type="text" placeholder="Filter systems..." data-rel-filter="dependency"
        class="w-full px-2 py-1 text-sm border-b-2 border-[#0b0c0c] mb-1 sticky top-0 bg-white z-10 focus:outline-3 focus:outline-[#ffdd00]" />`;
    for (const node of candidates) {
        const caps = (node.capabilityType || []).join(',');
        const capLabels = (node.capabilityType || []).map(c => {
            const def = LGAM_CAPABILITIES.find(x => x.id === c);
            return def ? def.label : c;
        }).join(', ');
        html += `<button type="button"
                    class="block w-full text-left px-3 py-1.5 text-sm hover:bg-[#f3f2f1] text-[#0b0c0c] border-b border-[#f3f2f1]"
                    data-rel-action="select-dependency"
                    data-rel-sys-id="${escAttr(node.id)}"
                    data-rel-caps="${escAttr(caps)}">
                    <span class="font-bold">${escHtml(node.label || node.id)}</span>
                    <span class="block text-xs text-[#505a5f]">Provides: ${escHtml(capLabels)}</span>
                </button>`;
    }
    html += `</div>`;
    html += `</div>`;
    return html;
}

function groupCandidatesByDomain(candidates, nodes, edges) {
    const ungrouped = [];
    const grouped = new Map();
    for (const sys of candidates) {
        const realizeEdge = edges.find(e => e.source === sys.id && e.relationship === 'REALIZES');
        if (realizeEdge) {
            const fnNode = nodes.find(n => n.id === realizeEdge.target && n.type === 'Function');
            const label = fnNode ? fnNode.label : 'Other';
            if (!grouped.has(label)) grouped.set(label, []);
            grouped.get(label).push(sys);
        } else {
            ungrouped.push(sys);
        }
    }
    const result = [...grouped.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, systems]) => ({ label, systems }));
    if (ungrouped.length > 0) {
        result.push({ label: 'Other', systems: ungrouped });
    }
    return result;
}

/**
 * Render a section heading.
 */
function sectionHeading(title) {
    return `<div class="font-bold text-[#0b0c0c] text-sm border-b border-[#b1b4b6] pb-1 mb-3">${escHtml(title)}</div>`;
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
