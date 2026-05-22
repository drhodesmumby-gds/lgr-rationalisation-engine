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
        return `<div class="flex items-center justify-center h-full text-sm text-gray-400">
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
            html += `<p class="text-xs text-gray-400 italic mb-2">No systems consume capabilities from this system.</p>`;
        }

        for (const edge of consumerEdges) {
            const consumerNode = nodes.find(n => n.id === edge.source);
            if (!consumerNode) continue;
            const edgeCaps = edge.capabilities || [];

            html += `<div class="ml-2 mb-2 p-2 bg-gray-50 rounded border border-gray-100">`;
            html += `<div class="flex items-center justify-between">`;
            html += `<span class="text-sm font-semibold text-gray-800">${escHtml(consumerNode.label || consumerNode.id)}</span>`;
            html += `<button type="button"
                        class="text-gray-400 hover:text-red-600 text-sm leading-none"
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
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200';
                html += `<button type="button"
                            class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${classes}"
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
        html += renderAddConsumerControl(system, nodes, consumerEdges);
        html += `</div>`;
    }

    // === Section 3: Depends On ===
    html += sectionHeading('Depends On');
    html += `<div class="mb-5" data-rel-dependencies>`;

    if (dependencyEdges.length === 0) {
        html += `<p class="text-xs text-gray-400 italic mb-2">This system does not consume capabilities from others.</p>`;
    }

    for (const edge of dependencyEdges) {
        const providerNode = nodes.find(n => n.id === edge.target);
        if (!providerNode) continue;
        const edgeCaps = edge.capabilities || [];
        const capLabels = edgeCaps.map(c => {
            const def = LGAM_CAPABILITIES.find(x => x.id === c);
            return def ? def.label : c;
        });

        html += `<div class="ml-2 mb-2 p-2 bg-gray-50 rounded border border-gray-100">`;
        html += `<div class="flex items-center justify-between">`;
        html += `<span class="text-sm font-semibold text-gray-800">${escHtml(providerNode.label || providerNode.id)}</span>`;
        html += `<button type="button"
                    class="text-gray-400 hover:text-red-600 text-sm leading-none"
                    data-rel-action="remove-dependency"
                    data-rel-edge-idx="${edge._edgeIdx}"
                    aria-label="Remove dependency on ${escAttr(providerNode.label || providerNode.id)}">&times;</button>`;
        html += `</div>`;
        if (capLabels.length > 0) {
            html += `<div class="flex flex-wrap gap-1 mt-1">`;
            for (const label of capLabels) {
                html += `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">${escHtml(label)}</span>`;
            }
            html += `</div>`;
        }
        html += `</div>`;
    }

    // Add dependency link/dropdown
    html += renderAddDependencyControl(system, nodes, dependencyEdges);
    html += `</div>`;

    // === Section 4: Shared With ===
    html += sectionHeading('Shared With');
    html += `<div class="mb-5">`;
    html += renderChipSelector({
        chips: system.sharedWith || [],
        placeholder: 'Council name...',
        name: 'sharedWith'
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
                    target.classList.remove('bg-gray-100', 'text-gray-600', 'border-gray-300', 'hover:bg-gray-200');
                    target.classList.add('bg-blue-600', 'text-white', 'border-blue-600');
                } else {
                    target.classList.remove('bg-blue-600', 'text-white', 'border-blue-600');
                    target.classList.add('bg-gray-100', 'text-gray-600', 'border-gray-300', 'hover:bg-gray-200');
                }

                if (consumerId && capId && onConsumerCapToggle) {
                    onConsumerCapToggle(nodeIdx, consumerId, capId, nowActive);
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
                if (sysId && onDependencyAdd) {
                    // When adding a dependency, default to all provider's capabilities
                    const providerNode = panel.closest('[data-rel-panel]')
                        ? null // We'll pass empty caps; the parent orchestrator can enrich
                        : null;
                    onDependencyAdd(nodeIdx, sysId, []);
                }
                // Hide dropdown
                const dropdown = panel.querySelector('[data-rel-dependency-dropdown]');
                if (dropdown) dropdown.classList.add('hidden');
                break;
            }
        }
    });
}

// --- Internal helpers ---

/**
 * Render the "+ Add consuming system" control with a hideable dropdown.
 */
function renderAddConsumerControl(system, nodes, consumerEdges) {
    const existingConsumerIds = new Set(consumerEdges.map(e => e.source));
    const candidates = nodes.filter(n =>
        n.type === 'ITSystem' &&
        n.id !== system.id &&
        !existingConsumerIds.has(n.id)
    );

    if (candidates.length === 0) {
        return `<p class="text-xs text-gray-400 mt-1">No other systems available to add.</p>`;
    }

    let html = `<div class="mt-2">`;
    html += `<button type="button"
                class="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                data-rel-action="show-add-consumer">+ Add consuming system</button>`;
    html += `<div class="hidden mt-1 max-h-32 overflow-y-auto border border-gray-200 rounded bg-white shadow-sm" data-rel-consumer-dropdown>`;
    for (const node of candidates) {
        html += `<button type="button"
                    class="block w-full text-left px-2 py-1 text-sm hover:bg-blue-50 text-gray-700"
                    data-rel-action="select-consumer"
                    data-rel-sys-id="${escAttr(node.id)}">
                    ${escHtml(node.label || node.id)}
                </button>`;
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
    );

    if (candidates.length === 0) {
        return `<p class="text-xs text-gray-400 mt-1">No capability providers available to add.</p>`;
    }

    let html = `<div class="mt-2">`;
    html += `<button type="button"
                class="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                data-rel-action="show-add-dependency">+ Add dependency</button>`;
    html += `<div class="hidden mt-1 max-h-32 overflow-y-auto border border-gray-200 rounded bg-white shadow-sm" data-rel-dependency-dropdown>`;
    for (const node of candidates) {
        const caps = (node.capabilityType || []).map(c => {
            const def = LGAM_CAPABILITIES.find(x => x.id === c);
            return def ? def.label : c;
        }).join(', ');
        html += `<button type="button"
                    class="block w-full text-left px-2 py-1 text-sm hover:bg-blue-50 text-gray-700"
                    data-rel-action="select-dependency"
                    data-rel-sys-id="${escAttr(node.id)}">
                    <span class="font-medium">${escHtml(node.label || node.id)}</span>
                    <span class="text-xs text-gray-500 ml-1">(${escHtml(caps)})</span>
                </button>`;
    }
    html += `</div>`;
    html += `</div>`;
    return html;
}

/**
 * Render a section heading.
 */
function sectionHeading(title) {
    return `<div class="text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-200 pb-1 mb-3">${escHtml(title)}</div>`;
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
