// ===================================================================
// SANKEY DIAGRAM — D3-based SVG rendering and interaction handling
// Accesses D3 via window.d3 (loaded from CDN as global)
// ===================================================================

import { escHtml } from '../ui-helpers.js';
import { classifyVestingZone } from '../analysis/allocation.js';
import { computeObligationSeverity } from '../simulation/obligations.js';

const PREDECESSOR_COLOURS = ['#1d70b8', '#00703c', '#d53880', '#f47738', '#53284f', '#28a197'];
const SUCCESSOR_COLOUR = '#0b0c0c';
const SYSTEM_COLOUR = '#b1b4b6';
const FUNCTION_COLOUR = '#53284f';

// Export for use in legend rendering
export { PREDECESSOR_COLOURS };

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

// ===================================================================
// HOVER TOOLTIP — shared singleton, repositioned on mousemove
// ===================================================================

let _tooltip = null;

function getTooltip() {
    if (!_tooltip) {
        _tooltip = document.createElement('div');
        _tooltip.className = 'sankey-tooltip';
        _tooltip.style.display = 'none';
        document.body.appendChild(_tooltip);
    }
    return _tooltip;
}

function showTooltip(event, html) {
    const tip = getTooltip();
    tip.innerHTML = html;
    tip.style.display = 'block';
    tip.style.left = (event.pageX + 12) + 'px';
    tip.style.top = (event.pageY - 10) + 'px';
}

function hideTooltip() {
    const tip = getTooltip();
    tip.style.display = 'none';
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
 *   viewMode: 'estate'|'function',
 *   overlay: 'default'|'migration'|'cross-successor'|'contract',
 *   obligations: Array,
 *   vestingDate: string|null
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

    const { onAction, onDrillDown, sizeMode, viewMode, overlay = 'default', obligations = [], vestingDate = null } = options;

    // Build predecessor colour index for consistent colouring
    const predecessorNames = rawNodes.filter(n => n.nodeType === 'predecessor').map(n => n.label);
    const predecessorColourMap = new Map(predecessorNames.map((name, i) => [name, PREDECESSOR_COLOURS[i % PREDECESSOR_COLOURS.length]]));

    // Build system-to-council colour map for function view — colour by source council, not array index
    const systemCouncilColourMap = new Map();
    if (viewMode === 'function') {
        const councils = [...new Set(rawNodes.filter(n => n.nodeType === 'system').map(n => n.council))].sort();
        const councilColourMap = new Map(councils.map((c, i) => [c, PREDECESSOR_COLOURS[i % PREDECESSOR_COLOURS.length]]));
        rawNodes.filter(n => n.nodeType === 'system').forEach(n => {
            systemCouncilColourMap.set(n.id, councilColourMap.get(n.council) || SYSTEM_COLOUR);
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

    // Build overlay colour helpers
    const contractZoneColour = { 'pre-vesting': '#d4351c', 'year-1': '#f47738', 'natural-expiry': '#00703c', 'long-tail': '#b1b4b6' };
    const migrationSevColour = { high: '#d4351c', medium: '#f47738', low: '#b1b4b6' };

    // Build obligation lookup maps for overlays
    const migrationSystemIds = new Set(obligations.filter(o => o.type === 'data-migration' || o.type === 'function-gap').map(o => o.fromSystem.id));
    const crossSuccessorSystemIds = new Set(obligations.filter(o => o.type === 'cross-successor-impact').map(o => o.fromSystem.id));
    const crossSuccessorSuccessors = new Set(obligations.filter(o => o.type === 'cross-successor-impact').flatMap(o => o.affectedSuccessors));
    const unresolvedSystemIds = new Set(obligations.filter(o => !o.resolved).map(o => o.fromSystem.id));

    function linkStrokeColour(d) {
        const srcNode = typeof d.source === 'object' ? d.source : graph.nodes[d.source];
        if (overlay === 'contract' && srcNode && srcNode.nodeType === 'system' && vestingDate) {
            if (srcNode.endYear) {
                const zone = classifyVestingZone(srcNode.endYear, srcNode.endMonth || 12, srcNode.noticePeriod || 0, vestingDate);
                return contractZoneColour[zone] || '#b1b4b6';
            }
            return '#b1b4b6';
        }
        if (overlay === 'cross-successor') {
            // Dim links not involved in cross-successor impact
            if (srcNode && srcNode.nodeType === 'predecessor' && crossSuccessorSuccessors.size > 0) {
                const tgtNode = typeof d.target === 'object' ? d.target : graph.nodes[d.target];
                if (tgtNode && tgtNode.nodeType === 'successor' && crossSuccessorSuccessors.has(tgtNode.label)) {
                    return '#d4351c';
                }
            }
        }
        return nodeColour(srcNode || {});
    }

    function linkStrokeOpacity(d) {
        if (overlay === 'cross-successor') {
            const tgtNode = typeof d.target === 'object' ? d.target : graph.nodes[d.target];
            if (tgtNode && tgtNode.nodeType === 'successor' && crossSuccessorSuccessors.has(tgtNode.label)) {
                return 0.6;
            }
            const srcNode = typeof d.source === 'object' ? d.source : graph.nodes[d.source];
            if (srcNode && srcNode.nodeType === 'system' && crossSuccessorSystemIds.has(srcNode.systemId)) {
                return 0.6;
            }
            return 0.15; // Dim non-affected links
        }
        return d.hasSimAction ? 0.5 : 0.35;
    }

    linkGroup.selectAll('path')
        .data(graph.links)
        .join('path')
        .attr('class', d => `sankey-link${d.hasSimAction ? ' sim-affected' : ''}`)
        .attr('d', d3.sankeyLinkHorizontal())
        .attr('stroke', linkStrokeColour)
        .attr('stroke-width', d => Math.max(1, d.width))
        .style('stroke-opacity', linkStrokeOpacity)
        .on('mouseenter', function(event, d) {
            d3.select(this).style('stroke-opacity', 0.65);
            const src = typeof d.source === 'object' ? d.source : graph.nodes[d.source];
            const tgt = typeof d.target === 'object' ? d.target : graph.nodes[d.target];
            const label = `${(src && src.label) || '?'} → ${(tgt && tgt.label) || '?'}`;
            const count = d.rawCount || 1;
            let detail = `${count} system${count !== 1 ? 's' : ''}`;
            if (sizeMode === 'cost' && typeof d.rawCost === 'number' && d.rawCost > 0) {
                detail += `<br>£${d.rawCost.toLocaleString()}/yr`;
            }
            // Contract overlay: add zone info
            if (overlay === 'contract' && src && src.endYear && vestingDate) {
                const zone = classifyVestingZone(src.endYear, src.endMonth || 12, src.noticePeriod || 0, vestingDate);
                const zoneLabels = { 'pre-vesting': 'Pre-vesting trigger', 'year-1': 'Year 1 post-vesting', 'natural-expiry': 'Natural expiry', 'long-tail': 'Long tail' };
                detail += `<br><strong style="color:${contractZoneColour[zone]}">${zoneLabels[zone] || zone}</strong>`;
                if (src.noticePeriod) detail += `<br>Notice: ${src.noticePeriod} months`;
            }
            // Migration overlay: add obligation info
            if (overlay === 'migration' && src && migrationSystemIds.has(src.systemId)) {
                detail += '<br><strong style="color:#d4351c">Data migration required</strong>';
                if (src.dataPartitioning === 'Monolithic') detail += '<br>Monolithic data';
                if (src.portability === 'Low') detail += '<br>Low portability';
            }
            showTooltip(event, `<strong>${escHtml(label)}</strong><br>${detail}`);
        })
        .on('mouseleave', function() {
            d3.select(this).style('stroke-opacity', linkStrokeOpacity);
            hideTooltip();
        })
        .on('click', function(event, d) {
            if (onDrillDown && d.target && d.target.nodeType === 'successor') {
                onDrillDown(d.target.label);
            }
        });

    // --- MIGRATION OVERLAY: dashed paths over affected links ---
    if (overlay === 'migration' && obligations.length > 0) {
        const signalWeights = window._simGetSignalWeights ? window._simGetSignalWeights() : {};
        const migrationLinks = graph.links.filter(l => {
            const src = typeof l.source === 'object' ? l.source : graph.nodes[l.source];
            return src && src.systemId && migrationSystemIds.has(src.systemId);
        });

        if (migrationLinks.length > 0) {
            const overlayGroup = svg.append('g').attr('class', 'sankey-migration-overlays');
            overlayGroup.selectAll('path')
                .data(migrationLinks)
                .join('path')
                .attr('class', 'sankey-migration-overlay')
                .attr('d', d3.sankeyLinkHorizontal())
                .attr('fill', 'none')
                .attr('stroke', d => {
                    const src = typeof d.source === 'object' ? d.source : graph.nodes[d.source];
                    if (!src || !src.systemId) return '#b1b4b6';
                    // Find matching obligation and compute severity
                    const obl = obligations.find(o => o.fromSystem.id === src.systemId && (o.type === 'data-migration' || o.type === 'function-gap'));
                    if (obl) {
                        const sev = computeObligationSeverity(obl, signalWeights);
                        return migrationSevColour[sev] || '#b1b4b6';
                    }
                    return '#b1b4b6';
                })
                .attr('stroke-width', d => Math.max(2, d.width * 0.5))
                .attr('stroke-dasharray', '8 4')
                .style('stroke-opacity', 0.7)
                .style('pointer-events', 'none');
        }
    }

    // --- CROSS-SUCCESSOR OVERLAY: dashed paths for affected estate links ---
    if (overlay === 'cross-successor' && viewMode === 'estate' && crossSuccessorSuccessors.size > 0) {
        // Find predecessor names that have cross-successor systems
        const crossPredecessors = new Set(obligations.filter(o => o.type === 'cross-successor-impact').map(o => o.fromSystem.council));
        const crossLinks = graph.links.filter(l => {
            const src = typeof l.source === 'object' ? l.source : graph.nodes[l.source];
            const tgt = typeof l.target === 'object' ? l.target : graph.nodes[l.target];
            return src && tgt && src.nodeType === 'predecessor' && tgt.nodeType === 'successor'
                && crossPredecessors.has(src.label) && crossSuccessorSuccessors.has(tgt.label);
        });

        if (crossLinks.length > 0) {
            const overlayGroup = svg.append('g').attr('class', 'sankey-cross-successor-overlays');
            overlayGroup.selectAll('path')
                .data(crossLinks)
                .join('path')
                .attr('class', 'sankey-cross-successor-overlay')
                .attr('d', d3.sankeyLinkHorizontal())
                .attr('fill', 'none')
                .attr('stroke', '#d4351c')
                .attr('stroke-width', d => Math.max(3, d.width * 0.6))
                .attr('stroke-dasharray', '10 5')
                .style('stroke-opacity', 0.6)
                .style('pointer-events', 'none');
        }
    }

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
            if (overlay === 'contract' && d.nodeType === 'system' && d.endYear && vestingDate) {
                const zone = classifyVestingZone(d.endYear, d.endMonth || 12, d.noticePeriod || 0, vestingDate);
                return contractZoneColour[zone] || nodeColour(d);
            }
            return nodeColour(d);
        })
        .attr('stroke', d => {
            if (overlay === 'migration' && d.nodeType === 'system' && unresolvedSystemIds.has(d.systemId)) return '#d4351c';
            if (overlay === 'cross-successor' && d.nodeType === 'system' && crossSuccessorSystemIds.has(d.systemId)) return '#d4351c';
            if (overlay === 'contract' && d.nodeType === 'system' && d.endYear && vestingDate) {
                const zone = classifyVestingZone(d.endYear, d.endMonth || 12, d.noticePeriod || 0, vestingDate);
                return contractZoneColour[zone] || '#0b0c0c';
            }
            if (d.nodeType === 'system' && d.isAffected) return '#d4351c';
            return '#0b0c0c';
        })
        .attr('stroke-width', d => {
            if (overlay === 'migration' && d.nodeType === 'system' && unresolvedSystemIds.has(d.systemId)) return 2.5;
            if (overlay === 'cross-successor' && d.nodeType === 'system' && crossSuccessorSystemIds.has(d.systemId)) return 2.5;
            if (d.nodeType === 'system' && d.isAffected) return 2;
            return 1;
        })
        .attr('stroke-dasharray', d => {
            if (overlay === 'migration' && d.nodeType === 'system' && unresolvedSystemIds.has(d.systemId)) return '4 2';
            if (overlay === 'cross-successor' && d.nodeType === 'system' && crossSuccessorSystemIds.has(d.systemId)) return '4 2';
            return null;
        })
        .on('mouseenter', function(event, d) {
            if (d.nodeType === 'system') {
                showTooltip(event, `<strong>${escHtml(d.label)}</strong><br>` +
                    `<span style="color:#505a5f">Source: ${escHtml(d.council || 'Unknown')}</span><br>` +
                    (d.vendor ? `Vendor: ${escHtml(d.vendor)}<br>` : '') +
                    (typeof d.users === 'number' ? `Users: ${d.users.toLocaleString()}<br>` : '') +
                    (typeof d.annualCost === 'number' ? `Cost: £${d.annualCost.toLocaleString()}/yr` : ''));
            } else if (d.nodeType === 'function') {
                showTooltip(event, `<strong>${escHtml(d.label)}</strong>`);
            } else if (d.nodeType === 'predecessor') {
                const count = (d.sourceLinks || []).reduce((sum, l) => sum + (l.rawCount || l.value), 0);
                showTooltip(event, `<strong>${escHtml(d.label)}</strong><br>${count} system allocation${count !== 1 ? 's' : ''}`);
            } else if (d.nodeType === 'successor') {
                const count = (d.targetLinks || []).reduce((sum, l) => sum + (l.rawCount || l.value), 0);
                showTooltip(event, `<strong>${escHtml(d.label)}</strong><br>${count} system allocation${count !== 1 ? 's' : ''}`);
            }
        })
        .on('mouseleave', hideTooltip)
        .on('click', function(event, d) {
            event.preventDefault();
            if (_wasDragged) { _wasDragged = false; return; }
            if (d.nodeType === 'successor' && onDrillDown) {
                onDrillDown(d.label);
            } else if (d.nodeType === 'system' || d.nodeType === 'function') {
                handleNodeContextMenu(event, d, containerEl, onAction, onDrillDown, sizeMode);
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
            let label = d.label || '';
            // Prepend council initials for system nodes in function view
            if (d.nodeType === 'system' && d.council) {
                const initials = d.council.split(' ').map(w => w[0]).join('').toUpperCase();
                label = `[${initials}] ${label}`;
            }
            const maxLen = (d.nodeType === 'system' || d.nodeType === 'function') ? 42 : 28;
            return label.length > maxLen ? label.slice(0, maxLen - 2) + '…' : label;
        });

    // ---------------------------------------------------------------
    // DRAG-AND-DROP for system nodes
    // ---------------------------------------------------------------

    // Decommission drop zone (hidden until drag starts)
    const decommZoneWidth = 130;
    const decommZoneHeight = 36;
    const decommZoneX = width - decommZoneWidth - marginR;
    const decommZoneY = height - decommZoneHeight - marginB;
    const decommZoneRect = { x: decommZoneX, y: decommZoneY, width: decommZoneWidth, height: decommZoneHeight };

    const decommZone = svg.append('g')
        .attr('class', 'sankey-decommission-zone')
        .style('display', 'none');

    decommZone.append('rect')
        .attr('x', decommZoneX)
        .attr('y', decommZoneY)
        .attr('width', decommZoneWidth)
        .attr('height', decommZoneHeight)
        .attr('rx', 4);

    decommZone.append('text')
        .attr('x', decommZoneX + decommZoneWidth / 2)
        .attr('y', decommZoneY + decommZoneHeight / 2)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'middle')
        .style('font-size', '11px')
        .style('font-weight', 'bold')
        .text('Decommission');

    // Drag-click guard: prevent short drags from also firing click
    let _wasDragged = false;

    const dragBehaviour = d3.drag()
        .on('start', function(event, d) {
            if (d.nodeType !== 'system') return;
            _wasDragged = false;
            dismissContextMenu();
            hideTooltip();
            d._dragStartX = d.x0;
            d._dragStartY = d.y0;
            d3.select(this).raise().classed('sankey-node-dragging', true);
            nodeGs.filter(dd => dd.nodeType === 'system' && dd !== d)
                .classed('sankey-drop-target', true);
            decommZone.style('display', 'block');
        })
        .on('drag', function(event, d) {
            if (d.nodeType !== 'system') return;
            if (Math.abs(event.x - d._dragStartX) > 3 || Math.abs(event.y - d._dragStartY) > 3) {
                _wasDragged = true;
            }
            d3.select(this).attr('transform', `translate(${event.x},${event.y})`);
        })
        .on('end', function(event, d) {
            if (d.nodeType !== 'system') return;
            d3.select(this).classed('sankey-node-dragging', false);
            nodeGs.classed('sankey-drop-target', false);
            decommZone.style('display', 'none');

            // Snap back to original position
            d3.select(this)
                .transition().duration(200)
                .attr('transform', `translate(${d._dragStartX},${d._dragStartY})`);

            if (!_wasDragged) return; // Was a click, not a drag

            // Hit-test: find drop target
            const dropTarget = findDropTarget(event, d, graph.nodes, decommZoneRect);

            if (dropTarget === 'decommission') {
                if (onAction) onAction({ type: 'decommission', systemId: d.systemId });
            } else if (dropTarget && dropTarget.nodeType === 'system' && dropTarget !== d) {
                if (window._simOpenActionBuilderWithContext) {
                    window._simOpenActionBuilderWithContext('migrate-users', {
                        fromSystemId: d.systemId,
                        toSystemId: dropTarget.systemId
                    });
                }
            }
        });

    nodeGs.filter(d => d.nodeType === 'system').call(dragBehaviour);

    containerEl.appendChild(svg.node());
}

/**
 * Hit-test for drag-and-drop: finds what node or zone the cursor landed on.
 */
function findDropTarget(event, draggedNode, nodes, decommZoneRect) {
    const sourceEvent = event.sourceEvent;
    const mx = sourceEvent.offsetX;
    const my = sourceEvent.offsetY;

    // Check decommission zone
    if (decommZoneRect &&
        mx >= decommZoneRect.x && mx <= decommZoneRect.x + decommZoneRect.width &&
        my >= decommZoneRect.y && my <= decommZoneRect.y + decommZoneRect.height) {
        return 'decommission';
    }

    // Check system nodes (bounding box hit test)
    for (const node of nodes) {
        if (node === draggedNode || node.nodeType !== 'system') continue;
        if (mx >= node.x0 && mx <= node.x1 && my >= node.y0 && my <= node.y1) {
            return node;
        }
    }
    return null;
}

/**
 * Handles click/right-click context menu on a Sankey node.
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
