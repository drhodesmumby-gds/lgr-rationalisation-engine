/**
 * List Panel — left pane of the unified architecture editor.
 * Domain-grouped system list with search, filter, progress indicator, and + Add button.
 */

import { getRootCategoryId } from '../../taxonomy.js';
import { LGA_FUNCTIONS } from '../../constants/lga-functions.js';

// ESD root category labels
const ROOT_CATEGORY_LABELS = {
    '42': 'Administration and Government',
    '1': 'Advice and Benefits',
    '6': 'Business and Employment',
    '16': 'Community Safety',
    '95': 'Coastline Management',
    '30': 'Environmental Protection',
    '58': 'Health and Social Care',
    '66': 'Housing',
    '72': 'Leisure and Culture',
    '82': 'Licences, Permits and Permissions',
    '99': 'Planning and Building Control',
    '23': 'Schools and Education',
    '105': 'Transport and Highways'
};

// Consistent GDS grey for all domain group headers
const GROUP_COLOURS = [
    'bg-[#f3f2f1]'
];

// Key fields for completeness assessment
const KEY_FIELDS = ['vendor', 'annualCost', 'endYear', 'portability', 'dataPartitioning', 'isCloud', 'supportModel'];

/**
 * Count how many key fields are filled on a system node.
 */
function countFilledFields(system) {
    let filled = 0;
    for (const field of KEY_FIELDS) {
        const val = system[field];
        if (val !== null && val !== undefined && val !== '') {
            filled++;
        }
    }
    return filled;
}

/**
 * Determine completeness tier for a system.
 * @returns {{ icon: string, cls: string, label: string }}
 */
function completenessIndicator(system) {
    const filled = countFilledFields(system);
    const missing = KEY_FIELDS.length - filled;
    if (missing === 0) {
        return { icon: '✓', cls: 'text-[#00703c]', label: 'Complete' };
    } else if (filled >= 3) {
        return { icon: `⚠ ${missing}`, cls: 'text-[#f47738]', label: `${missing} fields missing` };
    } else {
        return { icon: '✗', cls: 'text-[#d4351c]', label: 'Mostly empty' };
    }
}

/**
 * Resolve a system's domain (root ESD category) from its REALIZES edges.
 * @returns {{ rootId: string|null, functionLabel: string|null }}
 */
function resolveSystemDomain(system, nodes, edges) {
    const realizesEdge = edges.find(e => e.source === system.id && e.relationship === 'REALIZES');
    if (!realizesEdge) return { rootId: null, functionLabel: null };

    const fnNode = nodes.find(n => n.id === realizesEdge.target && n.type === 'Function');
    if (!fnNode || !fnNode.lgaFunctionId) return { rootId: null, functionLabel: fnNode ? fnNode.label : null };

    const rootId = getRootCategoryId(fnNode.lgaFunctionId);
    return { rootId, functionLabel: fnNode.label };
}

/**
 * Group systems by domain.
 * @returns {Array<{ domainId: string, domainLabel: string, systems: Array }>}
 */
function groupSystemsByDomain(editorState) {
    const { nodes, edges } = editorState;
    const systems = nodes.filter(n => n.type === 'ITSystem');
    const groups = new Map(); // domainId → { domainLabel, systems: [{system, functionLabel, nodeIdx}] }

    for (const system of systems) {
        const nodeIdx = nodes.indexOf(system);
        const { rootId, functionLabel } = resolveSystemDomain(system, nodes, edges);

        const domainId = rootId || '__platform__';
        const domainLabel = rootId ? (ROOT_CATEGORY_LABELS[rootId] || 'Other') : 'Platform / Infrastructure';

        if (!groups.has(domainId)) {
            groups.set(domainId, { domainLabel, systems: [] });
        }
        groups.get(domainId).systems.push({ system, functionLabel, nodeIdx });
    }

    // Sort groups: named domains alphabetically, platform at end
    const sorted = [...groups.entries()].sort((a, b) => {
        if (a[0] === '__platform__') return 1;
        if (b[0] === '__platform__') return -1;
        return a[1].domainLabel.localeCompare(b[1].domainLabel);
    });

    return sorted.map(([domainId, data]) => ({
        domainId,
        domainLabel: data.domainLabel,
        systems: data.systems
    }));
}

/**
 * Render the full list panel HTML.
 * @param {object} editorState — { nodes, edges, councilName, councilMetadata }
 * @param {object} [options] — { selectedIdx, searchQuery }
 * @returns {string} HTML string
 */
export function renderListPanel(editorState, options = {}) {
    const { selectedIdx = null, searchQuery = '' } = options;
    const { nodes } = editorState;
    const systems = nodes.filter(n => n.type === 'ITSystem');

    // Progress calculation
    const totalSystems = systems.length;
    const completeSystems = systems.filter(s => countFilledFields(s) === KEY_FIELDS.length).length;
    const progressPct = totalSystems > 0 ? Math.round((completeSystems / totalSystems) * 100) : 0;

    // Group systems
    const groups = groupSystemsByDomain(editorState);

    // Filter by search query
    const query = searchQuery.trim().toLowerCase();
    const filteredGroups = query
        ? groups.map(g => ({
            ...g,
            systems: g.systems.filter(({ system }) =>
                (system.label || '').toLowerCase().includes(query) ||
                (system.vendor || '').toLowerCase().includes(query)
            )
        })).filter(g => g.systems.length > 0)
        : groups;

    // Build HTML
    let html = '';

    // Progress bar
    html += `<div class="px-3 pt-2 pb-1">
        <div class="flex items-center justify-between text-xs text-[#505a5f] mb-1">
            <span>${completeSystems}/${totalSystems} complete</span>
            <span>${progressPct}%</span>
        </div>
        <div class="w-full h-1.5 bg-[#f3f2f1] overflow-hidden">
            <div class="h-full bg-[#00703c] transition-all" style="width: ${progressPct}%"></div>
        </div>
    </div>`;

    // Search input
    html += `<div class="px-3 pt-2 pb-1">
        <div class="relative">
            <input type="text"
                data-list-search
                placeholder="Search systems..."
                value="${escAttr(searchQuery)}"
                class="w-full text-sm border-2 border-[#0b0c0c] p-2 pr-7 focus:outline-3 focus:outline-[#ffdd00] focus:outline-offset-0" />
            ${searchQuery ? `<button data-list-search-clear class="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#505a5f] hover:text-[#0b0c0c] text-sm px-1" title="Clear search">&times;</button>` : ''}
        </div>
    </div>`;

    // Add button
    html += `<div class="px-3 pt-1 pb-2 border-b border-[#b1b4b6]">
        <button data-list-add class="text-[#1d70b8] hover:text-[#003078] underline font-bold text-sm">+ Add system</button>
    </div>`;

    // Scrollable grouped list
    html += `<div class="flex-1 overflow-y-auto" data-list-scroll>`;

    let colourIdx = 0;
    for (const group of filteredGroups) {
        const bgClass = GROUP_COLOURS[colourIdx % GROUP_COLOURS.length];
        colourIdx++;

        html += `<div class="border-b border-[#b1b4b6]">`;
        // Group header
        html += `<div class="${bgClass} px-3 py-1.5 flex items-center justify-between sticky top-0 z-10">
            <span class="font-bold text-sm text-[#0b0c0c] truncate">${esc(group.domainLabel)}</span>
            <span class="bg-[#0b0c0c] text-white text-xs font-bold px-1.5 ml-1 flex-shrink-0">${group.systems.length}</span>
        </div>`;

        // System items
        for (const { system, functionLabel, nodeIdx } of group.systems) {
            const isSelected = nodeIdx === selectedIdx;
            const comp = completenessIndicator(system);
            const borderCls = isSelected ? 'border-l-4 border-[#1d70b8] bg-[#f3f2f1]' : 'border-l-4 border-l-transparent';

            html += `<div class="px-3 py-2 cursor-pointer hover:bg-[#f3f2f1] ${borderCls} flex items-start gap-2"
                data-list-item="${nodeIdx}" role="button" tabindex="0">
                <div class="flex-1 min-w-0">
                    <div class="font-bold text-sm text-[#0b0c0c] truncate">${esc(system.label || 'Untitled')}</div>
                    <div class="text-xs text-[#505a5f] truncate">${esc(system.vendor || '—')}${functionLabel ? ' · ' + esc(functionLabel) : ''}</div>
                </div>
                <div class="flex-shrink-0 text-xs ${comp.cls} font-medium whitespace-nowrap" title="${esc(comp.label)}">${comp.icon}</div>
            </div>`;
        }

        html += `</div>`;
    }

    if (filteredGroups.length === 0 && query) {
        html += `<div class="px-3 py-6 text-center text-sm text-[#505a5f]">No systems match "${esc(query)}"</div>`;
    }

    if (totalSystems === 0) {
        html += `<div class="px-3 py-6 text-center text-sm text-[#505a5f]">No systems yet. Click "+ Add system" to begin.</div>`;
    }

    html += `</div>`;

    // Wrap in flex column container
    return `<div class="flex flex-col h-full bg-white border-r border-[#b1b4b6]">${html}</div>`;
}

/**
 * Wire event listeners for the list panel.
 * @param {HTMLElement} container — the DOM element containing the rendered list panel
 * @param {object} options — { onSelect(nodeIdx), onAdd(), onSearch(query), onFilter(filter) }
 */
export function wireListPanel(container, options = {}) {
    const { onSelect, onAdd, onSearch, onFilter } = options;

    // Search input
    const searchInput = container.querySelector('[data-list-search]');
    if (searchInput && onSearch) {
        searchInput.addEventListener('input', (e) => {
            onSearch(e.target.value);
        });
    }

    // Clear search
    const clearBtn = container.querySelector('[data-list-search-clear]');
    if (clearBtn && onSearch) {
        clearBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            onSearch('');
        });
    }

    // Add button
    const addBtn = container.querySelector('[data-list-add]');
    if (addBtn && onAdd) {
        addBtn.addEventListener('click', () => {
            onAdd();
        });
    }

    // List items — use event delegation on scroll container
    const scrollContainer = container.querySelector('[data-list-scroll]');
    if (scrollContainer && onSelect) {
        scrollContainer.addEventListener('click', (e) => {
            const item = e.target.closest('[data-list-item]');
            if (item) {
                const nodeIdx = parseInt(item.getAttribute('data-list-item'), 10);
                if (!isNaN(nodeIdx)) onSelect(nodeIdx);
            }
        });
        scrollContainer.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const item = e.target.closest('[data-list-item]');
                if (item) {
                    e.preventDefault();
                    const nodeIdx = parseInt(item.getAttribute('data-list-item'), 10);
                    if (!isNaN(nodeIdx)) onSelect(nodeIdx);
                }
            }
        });
    }
}

// --- Utility ---

function esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
