// ===================================================================
// SANKEY DIAGRAM — D3-based SVG rendering and interaction handling
// Accesses D3 via window.d3 (loaded from CDN as global)
// ===================================================================

const PREDECESSOR_COLOURS = ['#1d70b8', '#00703c', '#d53880', '#f47738', '#53284f', '#28a197'];
const SUCCESSOR_COLOUR = '#0b0c0c';
const SYSTEM_COLOUR = '#b1b4b6';
const FUNCTION_COLOUR = '#53284f';

let _activeContextMenu = null;

/**
 * Dismiss any open context menu.
 */
function dismissContextMenu() {
    if (_activeContextMenu) {
        _activeContextMenu.remove();
        _activeContextMenu = null;
    }
}

/**
 * Show a context menu at (x, y) inside containerEl with given items.
 * @param {HTMLElement} containerEl
 * @param {number} x
 * @param {number} y
 * @param {string} headerText
 * @param {Array<{label: string, action: function}>} items
 */
function showContextMenu(containerEl, x, y, headerText, items) {
    dismissContextMenu();

    const menu = document.createElement('div');
    menu.className = 'sankey-context-menu';

    const header = document.createElement('div');
    header.className = 'sankey-context-menu-header';
    header.textContent = headerText;
    menu.appendChild(header);

    items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'sankey-context-menu-item';
        el.textContent = item.label;
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            dismissContextMenu();
            item.action();
        });
        menu.appendChild(el);
    });

    // Position relative to container
    const rect = containerEl.getBoundingClientRect();
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    containerEl.appendChild(menu);
    _activeContextMenu = menu;

    // Dismiss on outside click or Escape
    const onClickOutside = (e) => {
        if (!menu.contains(e.target)) {
            dismissContextMenu();
            document.removeEventListener('click', onClickOutside, true);
        }
    };
    const onKeyDown = (e) => {
        if (e.key === 'Escape') {
            dismissContextMenu();
            document.removeEventListener('keydown', onKeyDown);
        }
    };
    setTimeout(() => {
        document.addEventListener('click', onClickOutside, true);
        document.addEventListener('keydown', onKeyDown);
    }, 0);
}

/**
 * Cleans up SVG and any remaining context menus from a container.
 * @param {HTMLElement} containerEl
 */
export function destroySankeyDiagram(containerEl) {
    if (!containerEl) return;
    dismissContextMenu();
    const svg = containerEl.querySelector('svg.sankey-svg');
    if (svg) svg.remove();
}

/**
 * Renders a D3 Sankey SVG into containerEl.
 *
 * @param {HTMLElement} containerEl  The .sim-sankey-panel element
 * @param {{ nodes: Array, links: Array }} data  Output of buildEstateSankeyData or buildFunctionSankeyData
 * @param {{
 *   onAction: function(action: object): void,
 *   onDrillDown: function(successorName: string): void,
 *   onBack: function(): void,
 *   sizeMode: 'count'|'cost',
 *   viewMode: 'estate'|'function'
 * }} options
 */
export function renderSankeyDiagram(containerEl, data, options = {}) {
    if (!containerEl) return;

    destroySankeyDiagram(containerEl);

    const d3 = window.d3;
    if (!d3 || !d3.sankey) {
        // D3 or d3-sankey not loaded yet — render a placeholder
        const placeholder = document.createElement('div');
        placeholder.style.cssText = 'padding: 24px; color: #505a5f; font-size: 13px;';
        placeholder.textContent = 'Sankey diagram requires D3 (loading...)';
        containerEl.appendChild(placeholder);
        return;
    }

    const { nodes: rawNodes, links: rawLinks } = data;
    if (!rawNodes || rawNodes.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'padding: 24px; color: #505a5f; font-size: 13px;';
        empty.textContent = 'No data to display.';
        containerEl.appendChild(empty);
        return;
    }

    const { onAction, onDrillDown, sizeMode, viewMode } = options;

    // Build predecessor colour index for consistent colouring
    const predecessorNames = rawNodes.filter(n => n.nodeType === 'predecessor').map(n => n.label);
    const predecessorColourMap = new Map(predecessorNames.map((name, i) => [name, PREDECESSOR_COLOURS[i % PREDECESSOR_COLOURS.length]]));

    // Build system-to-council colour map for function view
    const systemCouncilColourMap = new Map();
    if (viewMode === 'function') {
        rawNodes.filter(n => n.nodeType === 'system').forEach((n, i) => {
            const colour = PREDECESSOR_COLOURS[i % PREDECESSOR_COLOURS.length];
            systemCouncilColourMap.set(n.id, colour);
        });
    }

    // Dimensions
    const width = containerEl.clientWidth || 600;
    const height = Math.max(380, rawNodes.length * 22 + 80);
    const marginL = 12;
    const marginR = 12;
    const marginT = 16;
    const marginB = 20;

    // Deep-clone nodes and links so D3 sankey can mutate them
    const nodes = rawNodes.map(n => ({ ...n }));
    const nodeIdToIdx = new Map(nodes.map((n, i) => [n.id, i]));

    const links = rawLinks
        .filter(l => nodeIdToIdx.has(l.source) && nodeIdToIdx.has(l.target))
        .map(l => ({
            ...l,
            source: nodeIdToIdx.get(l.source),
            target: nodeIdToIdx.get(l.target)
        }));

    if (links.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'padding: 24px; color: #505a5f; font-size: 13px;';
        empty.textContent = 'No flows to display for current allocation.';
        containerEl.appendChild(empty);
        return;
    }

    // D3 Sankey layout
    const sankeyLayout = d3.sankey()
        .nodeId((d, i) => i)
        .nodeWidth(20)
        .nodePadding(14)
        .nodeAlign(d3.sankeyLeft)
        .extent([[marginL, marginT], [width - marginR, height - marginB]]);

    let graph;
    try {
        graph = sankeyLayout({ nodes, links });
    } catch (e) {
        const errEl = document.createElement('div');
        errEl.style.cssText = 'padding: 24px; color: #d4351c; font-size: 13px;';
        errEl.textContent = 'Error rendering Sankey diagram.';
        containerEl.appendChild(errEl);
        return;
    }

    // Create SVG
    const svg = d3.create('svg')
        .attr('class', 'sankey-svg')
        .attr('width', width)
        .attr('height', height)
        .style('display', 'block');

    // Node colour function
    function nodeColour(d) {
        if (d.nodeType === 'predecessor') return predecessorColourMap.get(d.label) || '#1d70b8';
        if (d.nodeType === 'successor') return SUCCESSOR_COLOUR;
        if (d.nodeType === 'system') return systemCouncilColourMap.get(d.id) || SYSTEM_COLOUR;
        if (d.nodeType === 'function') return FUNCTION_COLOUR;
        return '#b1b4b6';
    }

    // Render links
    const linkGroup = svg.append('g').attr('class', 'sankey-links');

    linkGroup.selectAll('path')
        .data(graph.links)
        .join('path')
        .attr('class', d => `sankey-link${d.hasSimAction ? ' sim-affected' : ''}`)
        .attr('d', d3.sankeyLinkHorizontal())
        .attr('stroke', d => {
            // Use source node colour
            const srcNode = graph.nodes[typeof d.source === 'object' ? graph.nodes.indexOf(d.source) : d.source];
            return nodeColour(srcNode || {});
        })
        .attr('stroke-width', d => Math.max(1, d.width))
        .on('mouseover', function() {
            d3.select(this).style('stroke-opacity', 0.65);
        })
        .on('mouseout', function() {
            d3.select(this).style('stroke-opacity', d3.select(this).classed('sim-affected') ? 0.5 : 0.35);
        })
        .on('click', function(event, d) {
            // Drill down into the target successor
            if (onDrillDown && d.target && d.target.nodeType === 'successor') {
                onDrillDown(d.target.label);
            }
        });

    // Render nodes
    const nodeGroup = svg.append('g').attr('class', 'sankey-nodes');

    const nodeGs = nodeGroup.selectAll('g')
        .data(graph.nodes)
        .join('g')
        .attr('class', 'sankey-node')
        .attr('transform', d => `translate(${d.x0},${d.y0})`);

    nodeGs.append('rect')
        .attr('height', d => Math.max(1, d.y1 - d.y0))
        .attr('width', d => d.x1 - d.x0)
        .attr('fill', d => {
            if (d.nodeType === 'system' && d.isAffected) return '#f47738';
            return nodeColour(d);
        })
        .attr('stroke', d => d.nodeType === 'system' && d.isAffected ? '#d4351c' : '#0b0c0c')
        .attr('stroke-width', d => d.nodeType === 'system' && d.isAffected ? 2 : 1)
        .on('click', function(event, d) {
            event.preventDefault();
            if (d.nodeType === 'successor' && onDrillDown) {
                onDrillDown(d.label);
            }
        })
        .on('contextmenu', function(event, d) {
            event.preventDefault();
            handleNodeContextMenu(event, d, containerEl, onAction, onDrillDown, sizeMode);
        });

    // Node labels — left or right side depending on position
    nodeGs.append('text')
        .attr('x', d => d.x0 < width / 2 ? (d.x1 - d.x0 + 6) : -6)
        .attr('y', d => (d.y1 - d.y0) / 2)
        .attr('dy', '0.35em')
        .attr('text-anchor', d => d.x0 < width / 2 ? 'start' : 'end')
        .style('font-size', '11px')
        .style('font-weight', 'bold')
        .style('fill', '#0b0c0c')
        .style('pointer-events', 'none')
        .text(d => {
            const label = d.label || '';
            // Truncate long labels
            return label.length > 28 ? label.slice(0, 26) + '…' : label;
        });

    containerEl.appendChild(svg.node());
}

/**
 * Handles right-click context menu on a Sankey node.
 */
function handleNodeContextMenu(event, d, containerEl, onAction, onDrillDown, sizeMode) {
    // Position relative to the container
    const rect = containerEl.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    let headerText = d.label || '';
    let items = [];

    if (d.nodeType === 'predecessor') {
        // Info only for predecessor nodes
        items = [
            { label: 'View details (info only)', action: () => {} }
        ];
    } else if (d.nodeType === 'successor') {
        items = [
            {
                label: 'Drill into function view',
                action: () => { if (onDrillDown) onDrillDown(d.label); }
            }
        ];
    } else if (d.nodeType === 'system') {
        const sysId = d.systemId;
        const sysLabel = d.label;
        items = [
            {
                label: 'Decommission',
                action: () => {
                    if (onAction) onAction({ type: 'decommission', systemId: sysId });
                }
            },
            {
                label: 'Extend Contract...',
                action: () => {
                    if (window._simOpenActionBuilderWithContext) {
                        window._simOpenActionBuilderWithContext('extend-contract', { systemId: sysId });
                    }
                }
            },
            {
                label: 'Migrate Users...',
                action: () => {
                    if (window._simOpenActionBuilderWithContext) {
                        window._simOpenActionBuilderWithContext('migrate-users', { fromSystemId: sysId });
                    }
                }
            },
            {
                label: 'Split Shared Service...',
                action: () => {
                    if (window._simOpenActionBuilderWithContext) {
                        window._simOpenActionBuilderWithContext('split-shared-service', { systemId: sysId });
                    }
                }
            }
        ];
    } else if (d.nodeType === 'function') {
        const funcId = d.lgaFunctionId;
        items = [
            {
                label: 'Consolidate in...',
                action: () => {
                    if (window._simOpenActionBuilderWithContext) {
                        window._simOpenActionBuilderWithContext('consolidate', { funcId });
                    }
                }
            },
            {
                label: 'Procure Replacement...',
                action: () => {
                    if (window._simOpenActionBuilderWithContext) {
                        window._simOpenActionBuilderWithContext('procure-replacement', { funcId });
                    }
                }
            }
        ];
    }

    if (items.length > 0) {
        showContextMenu(containerEl, x, y, headerText, items);
    }
}
