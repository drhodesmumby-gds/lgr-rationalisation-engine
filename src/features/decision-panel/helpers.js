/**
 * Decision Panel Helpers — shared utilities for pane rendering.
 */

import { state } from '../../state.js';
import { escHtml } from '../../ui-helpers.js';
import { classifyVestingZone, computeNoticeDeadline } from '../../analysis/allocation.js';
import { getHostingType } from '../../analysis/hosting.js';
import { LGAM_CAPABILITIES } from '../../constants/capabilities.js';
import { getDecisionKey } from '../../simulation/decisions.js';

/**
 * Renders a tier badge span element.
 * @param {1|2|3} tier
 * @returns {string} HTML
 */
export function renderTierBadge(tier) {
    const tierConfig = {
        1: { label: 'Tier 1 — Day 1 Critical', bg: '#d4351c', fg: 'white' },
        2: { label: 'Tier 2 — High Priority', bg: '#f47738', fg: '#0b0c0c' },
        3: { label: 'Tier 3 — Post-Day 1', bg: '#b1b4b6', fg: '#0b0c0c' }
    };
    const cfg = tierConfig[tier] || tierConfig[2];
    return `<span style="background:${cfg.bg};color:${cfg.fg};font-size:11px;padding:2px 8px;font-weight:bold;">${escHtml(cfg.label)}</span>`;
}

/**
 * Returns the successor names that have a given system in their allocations.
 * @param {string} sysId
 * @returns {string[]}
 */
export function getSuccessorNamesForSystem(sysId) {
    const names = [];
    const allocMap = state.successorAllocationMap;
    if (!allocMap) return names;
    for (const [successorName, fnMap] of allocMap) {
        for (const [, allocations] of fnMap) {
            if (allocations.some(a => a.system && a.system.id === sysId)) {
                names.push(successorName);
                break;
            }
        }
    }
    return names;
}

/**
 * Builds datalist options for hosting partner suggestions.
 * @returns {string} HTML option elements
 */
export function buildHostingPartnerOptions() {
    const names = new Set();
    const predecessors = new Set();

    if (state.transitionStructure && state.transitionStructure.successors) {
        for (const s of state.transitionStructure.successors) {
            for (const p of (s.fullPredecessors || [])) predecessors.add(p);
            for (const p of (s.partialPredecessors || [])) predecessors.add(p);
            if (s.name) names.add(s.name);
        }
    }

    if (state.mergedArchitecture && state.mergedArchitecture.nodes) {
        for (const node of state.mergedArchitecture.nodes) {
            if (node.sharedWith) {
                node.sharedWith.forEach(c => { if (!predecessors.has(c)) names.add(c); });
            }
            if (node.hostingPartner && !predecessors.has(node.hostingPartner)) {
                names.add(node.hostingPartner);
            }
        }
    }

    return [...names].sort().map(n => `<option value="${escHtml(n)}">`).join('');
}

/**
 * Short description of a decision for display in cross-successor context.
 * @param {Object} decision
 * @returns {string}
 */
export function describeDecision(decision) {
    if (!decision) return '';
    switch (decision.systemChoice) {
        case 'choose':
            return `Keep ${(decision.retainedSystemIds || []).length} system(s)`;
        case 'procure':
            return `Procure: ${decision.procuredSystem ? decision.procuredSystem.label : 'new system'}`;
        case 'defer':
            return 'Deferred';
        default:
            return decision.systemChoice;
    }
}

/**
 * Derives the boundaryChoice value from the current panel state.
 *
 * @param {Object} params
 * @param {string} params.systemChoice - 'choose' | 'procure' | 'defer'
 * @param {string[]} params.sharedWithSuccessors - successor names linked into shared service
 * @param {boolean} params.hasExistingSharedWith - whether the chosen system has sharedWith in its data
 * @param {boolean} params.isDisaggregation - whether the system is from a partial predecessor
 * @param {boolean} params.hasMultipleSuccessors - whether transition has >1 successor
 * @returns {'none'|'disaggregate'|'maintain-shared'|'establish-shared'}
 */
export function computeDerivedBoundary({
    systemChoice,
    sharedWithSuccessors,
    hasExistingSharedWith,
    isDisaggregation,
    hasMultipleSuccessors
}) {
    if (systemChoice === 'defer') return 'none';
    if (!hasMultipleSuccessors) return 'none';

    if (sharedWithSuccessors && sharedWithSuccessors.length > 0) {
        if (hasExistingSharedWith) return 'maintain-shared';
        return 'establish-shared';
    }

    if (isDisaggregation) return 'disaggregate';

    return 'none';
}

/**
 * Renders a single system card with metadata badges and contract info.
 * @param {Object} sys - system node with metadata
 * @param {string|null} vestingDate - ISO date string
 * @param {Object} [options]
 * @param {boolean} [options.compact] - render a compact card (for Pane 1 in State 2)
 * @returns {string} HTML
 */
export function renderSystemCard(sys, vestingDate, options = {}) {
    const isErp = sys.isERP || false;
    const cardBorder = isErp ? 'border-[#d4351c] border-2' : 'border border-gray-300';

    const hostingType = getHostingType(sys);
    const cloudBadge = hostingType === 'cloud'
        ? `<span class="inline-block text-xs px-1.5 py-0.5 bg-[#cce2d8] text-[#00703c] font-bold border border-[#00703c]">Cloud</span>`
        : hostingType === 'partner-hosted'
        ? `<span class="inline-block text-xs px-1.5 py-0.5 bg-[#fde68a] text-[#f47738] font-bold border border-[#f47738]">Partner</span>`
        : `<span class="inline-block text-xs px-1.5 py-0.5 bg-[#f3d9c9] text-[#f47738] font-bold border border-[#f47738]">On-prem</span>`;

    const portColors = { High: '#00703c', Medium: '#f47738', Low: '#d4351c' };
    const portBg = { High: '#cce2d8', Medium: '#fde68a', Low: '#fce4e1' };
    const portLabel = sys.portability || 'Unknown';
    const portBadge = `<span class="inline-block text-xs px-1.5 py-0.5 font-bold border" style="background:${portBg[portLabel]||'#f3f2f1'};color:${portColors[portLabel]||'#505a5f'};border-color:${portColors[portLabel]||'#b1b4b6'}">Port: ${escHtml(portLabel)}</span>`;

    const dataLabel = sys.dataPartitioning || 'Unknown';
    const dataBadge = dataLabel === 'Monolithic'
        ? `<span class="inline-block text-xs px-1.5 py-0.5 bg-[#fce4e1] text-[#d4351c] font-bold border border-[#d4351c]">Monolithic</span>`
        : `<span class="inline-block text-xs px-1.5 py-0.5 bg-[#f3f2f1] text-gray-600 font-bold border border-gray-300">${escHtml(dataLabel)}</span>`;

    const erpBadge = isErp
        ? `<span class="inline-block text-xs px-1.5 py-0.5 bg-[#d4351c] text-white font-bold">ERP</span>`
        : '';

    let contractHtml = '';
    if (sys.endYear) {
        const endStr = `${sys.endYear}-${String(sys.endMonth || 12).padStart(2, '0')}`;
        let zoneBadge = '';
        if (vestingDate) {
            const zone = classifyVestingZone(sys.endYear, sys.endMonth || 12, sys.noticePeriod || 0, vestingDate);
            const zoneColors = {
                'pre-vesting': { bg: '#fce4e1', fg: '#d4351c', label: 'Pre-vesting' },
                'year-1': { bg: '#fde68a', fg: '#0b0c0c', label: 'Year 1' },
                'natural-expiry': { bg: '#cce2d8', fg: '#00703c', label: 'Natural expiry' },
                'long-tail': { bg: '#f3f2f1', fg: '#0b0c0c', label: 'Long-tail' }
            };
            const z = zoneColors[zone] || zoneColors['long-tail'];
            zoneBadge = `<span class="inline-block text-xs px-1.5 py-0.5 font-bold border mt-1" style="background:${z.bg};color:${z.fg};border-color:${z.fg}">${z.label}</span>`;
        }
        const deadline = computeNoticeDeadline(sys);
        const deadlineBadge = deadline ? `<span class="text-[10px] ml-1 font-bold border border-gray-400 px-1">Notice: ${deadline.formatted}</span>` : '';
        contractHtml = `<div class="text-xs text-gray-600 mt-1">Ends: <strong>${escHtml(endStr)}</strong>${sys.noticePeriod ? ` (${sys.noticePeriod}m notice)` : ''}${deadlineBadge}</div>${zoneBadge}`;
    }

    const costDisplay = sys.annualCost != null
        ? `<div class="text-xs text-gray-600">Cost: <strong>£${Number(sys.annualCost).toLocaleString()}/yr</strong></div>`
        : '';

    if (options.compact) {
        return `
            <div class="${cardBorder} p-2 bg-white" data-system-id="${escHtml(sys.id || '')}">
                <div class="flex flex-wrap gap-1 mb-1">${cloudBadge}${portBadge}${dataBadge}${erpBadge}</div>
                <div class="text-xs text-gray-600">Vendor: <strong>${escHtml([sys.vendor, sys.version].filter(Boolean).join(' · '))}</strong></div>
                ${costDisplay}
                ${contractHtml}
                ${sys.notes ? `<p class="text-[10px] text-[#505a5f] italic mt-1 border-l-2 border-[#b1b4b6] pl-1">${escHtml(sys.notes)}</p>` : ''}
            </div>
        `;
    }

    return `
        <div class="${cardBorder} p-3 bg-white w-full" data-system-id="${escHtml(sys.id || '')}">
            <div class="font-bold text-sm mb-0.5">${escHtml(sys.label || 'Unnamed')}</div>
            <div class="text-xs text-gray-500 mb-2">${escHtml(sys.sourceCouncil || sys._sourceCouncil || 'Unknown council')}</div>
            <div class="flex flex-wrap gap-1 mb-2">${cloudBadge}${portBadge}${dataBadge}${erpBadge}</div>
            ${sys.vendor || sys.version ? `<div class="text-xs text-gray-600">Vendor: <strong>${escHtml([sys.vendor, sys.version].filter(Boolean).join(' · '))}</strong></div>` : ''}
            ${sys.users != null ? `<div class="text-xs text-gray-600">Users: <strong>${Number(sys.users).toLocaleString()}</strong></div>` : ''}
            ${costDisplay}
            ${contractHtml}
            ${sys.notes ? `<p class="text-xs text-[#505a5f] italic mt-1 border-l-2 border-[#b1b4b6] pl-2">${escHtml(sys.notes)}</p>` : ''}
        </div>
    `;
}

export function findAllFunctionsForSystem(primarySystem, successorName) {
    if (!primarySystem) return [];
    const allocMap = state.simulationState.baselineAllocation || state.successorAllocationMap;
    const successorMap = allocMap ? allocMap.get(successorName) : null;
    if (!successorMap) return [];

    const functions = [];
    for (const [funcId, allocations] of successorMap) {
        if (allocations.some(a => a.system && a.system.id === primarySystem.id)) {
            const funcEntry = state.lgaFunctionMap ? state.lgaFunctionMap.get(funcId) : null;
            functions.push({
                funcId,
                label: funcEntry ? funcEntry.label : `Function ${funcId}`
            });
        }
    }
    return functions;
}
