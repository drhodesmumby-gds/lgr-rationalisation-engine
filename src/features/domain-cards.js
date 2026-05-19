import { getRootCategoryId, getRootCategories } from '../taxonomy.js';
import { state } from '../state.js';
import { DEFAULT_TIER_MAP } from '../constants/tier-map.js';

export function computeDomainSummaries() {
    const rootCategories = getRootCategories();
    const summaries = new Map();

    rootCategories.forEach(root => {
        summaries.set(root.id, {
            rootId: root.id,
            label: root.label,
            functionCount: 0,
            systemCount: 0,
            totalSpend: 0,
            tiers: { 1: 0, 2: 0, 3: 0 },
            decidedCount: 0,
            decidableCount: 0,
            preVestingTriggers: 0,
            hasMonolithicDisagg: false,
            _systemIds: new Set()
        });
    });

    for (const [lgaId, fnData] of state.lgaFunctionMap) {
        const rootId = getRootCategoryId(lgaId);
        if (!rootId || !summaries.has(rootId)) continue;

        const summary = summaries.get(rootId);
        summary.functionCount++;

        const tier = (state.tierMap && state.tierMap.get(lgaId)) || DEFAULT_TIER_MAP.get(lgaId) || 2;
        summary.tiers[tier]++;

        const funcEdges = state.mergedArchitecture.edges.filter(
            e => fnData.localNodeIds.has(e.target) && e.relationship === 'REALIZES'
        );
        const systemNodes = funcEdges
            .map(e => state.mergedArchitecture.nodes.find(n => n.id === e.source))
            .filter(n => n && n.type === 'ITSystem');

        systemNodes.forEach(sys => {
            if (!summary._systemIds.has(sys.id)) {
                summary._systemIds.add(sys.id);
                summary.systemCount++;
                summary.totalSpend += sys.annualCost || 0;
            }

            if (state.transitionStructure?.vestingDate && sys.endYear && sys.noticePeriod) {
                const vestingDate = new Date(state.transitionStructure.vestingDate);
                const expiryDate = new Date(sys.endYear, (sys.endMonth || 1) - 1);
                const noticeDate = new Date(expiryDate);
                noticeDate.setMonth(noticeDate.getMonth() - sys.noticePeriod);
                if (noticeDate < vestingDate) {
                    summary.preVestingTriggers++;
                }
            }

            if (sys.dataPartitioning === 'Monolithic' && state.transitionStructure?.successors) {
                const isPartial = state.transitionStructure.successors.some(s =>
                    s.partialPredecessors && s.partialPredecessors.includes(sys._sourceCouncil)
                );
                if (isPartial) summary.hasMonolithicDisagg = true;
            }
        });

        if (state.simulationState?.decisions && state.operatingMode === 'transition' && state.successorAllocationMap) {
            for (const [successorName, fnMap] of state.successorAllocationMap) {
                if (fnMap.has(lgaId)) {
                    const allocations = fnMap.get(lgaId);
                    if (allocations.length > 1) {
                        summary.decidableCount++;
                        const key = `${lgaId}::${successorName}`;
                        if (state.simulationState.decisions.has(key)) {
                            summary.decidedCount++;
                        }
                    }
                }
            }
        }
    }

    return Array.from(summaries.values())
        .filter(s => s.functionCount > 0)
        .sort((a, b) => {
            if (a.tiers[1] > 0 && b.tiers[1] === 0) return -1;
            if (b.tiers[1] > 0 && a.tiers[1] === 0) return 1;
            const aUndecided = a.decidableCount - a.decidedCount;
            const bUndecided = b.decidableCount - b.decidedCount;
            if (aUndecided !== bUndecided) return bUndecided - aUndecided;
            return b.functionCount - a.functionCount;
        });
}

export function renderDomainCards(summaries) {
    if (summaries.length === 0) {
        return '<p class="text-sm text-gray-500 p-4">No function data loaded.</p>';
    }

    const cards = summaries.map(s => {
        const tierColour = s.tiers[1] > 0 ? '#d4351c' : s.tiers[2] > 0 ? '#f47738' : '#b1b4b6';
        const spendDisplay = s.totalSpend > 0 ? `£${(s.totalSpend / 1000000).toFixed(1)}m/yr` : '';
        const progressPct = s.decidableCount > 0 ? Math.round((s.decidedCount / s.decidableCount) * 100) : -1;

        let riskHtml = '';
        if (s.preVestingTriggers > 0) {
            riskHtml += `<span class="text-[11px] text-[#d4351c] font-bold block mt-1">▲ ${s.preVestingTriggers} pre-vesting trigger${s.preVestingTriggers > 1 ? 's' : ''}</span>`;
        }
        if (s.hasMonolithicDisagg) {
            riskHtml += `<span class="text-[11px] text-[#d4351c] font-bold block mt-0.5">⚠ Monolithic disaggregation</span>`;
        }

        let progressHtml = '';
        if (progressPct >= 0) {
            progressHtml = `
                <div class="mt-2">
                    <div class="flex justify-between text-[10px] text-gray-500 mb-0.5">
                        <span>${s.decidedCount}/${s.decidableCount} decided</span>
                        <span>${progressPct}%</span>
                    </div>
                    <div class="w-full h-1.5 bg-gray-200 overflow-hidden">
                        <div class="h-full bg-[#00703c]" style="width:${progressPct}%"></div>
                    </div>
                </div>`;
        }

        return `
            <button class="domain-card" data-domain-id="${s.rootId}" aria-label="${s.label}: ${s.functionCount} functions, ${s.systemCount} systems">
                <div class="domain-card-accent" style="background-color: ${tierColour}"></div>
                <h3 class="text-sm font-bold mb-1">${s.label}</h3>
                <p class="text-xs text-gray-600">${s.functionCount} functions · ${s.systemCount} systems${spendDisplay ? ' · ' + spendDisplay : ''}</p>
                <div class="flex gap-1 mt-1.5 flex-wrap">
                    ${s.tiers[1] > 0 ? `<span class="gds-tag tag-red text-[9px]">Tier 1: ${s.tiers[1]}</span>` : ''}
                    ${s.tiers[2] > 0 ? `<span class="gds-tag tag-orange text-[9px]">Tier 2: ${s.tiers[2]}</span>` : ''}
                    ${s.tiers[3] > 0 ? `<span class="gds-tag tag-blue text-[9px]">Tier 3: ${s.tiers[3]}</span>` : ''}
                </div>
                ${riskHtml}
                ${progressHtml}
            </button>`;
    }).join('');

    return `<div class="domain-cards-grid">${cards}</div>`;
}
