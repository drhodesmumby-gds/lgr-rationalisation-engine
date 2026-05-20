import { state } from '../state.js';
import { classifyVestingZone, detectSharedServiceBoundary } from './allocation.js';
import { classifySupportModel } from './signals.js';
import { DEFAULT_TIER_MAP } from '../constants/tier-map.js';

// Computes the effective playbook tier for a function node.
// Pure function: accepts inputs, returns { tier, promoted, originalTier }.
//
// - functionNode: object with `lgaFunctionId` (string) and optional `tier` (number) override
// - defaultTierMap: Map<string, number> mapping ESD function IDs to tier numbers (1, 2, or 3)
// - vestingDate: optional ISO date string (e.g. "2028-04-01") or null/undefined
// - systems: array of system objects serving this function, each with optional endYear, endMonth, noticePeriod
//
// Logic:
// 1. If functionNode has a `tier` field, use that override; otherwise look up defaultTierMap (default to Tier 2 if unmapped).
// 2. If effective tier is 3 AND vestingDate is set AND any system has a notice trigger before vesting, promote to Tier 2.
// 3. Return { tier, promoted, originalTier }.
export function computeEffectiveTier(functionNode, defaultTierMap, vestingDate, systems) {
    const originalTier = (functionNode && functionNode.tier != null)
        ? functionNode.tier
        : (defaultTierMap.get(functionNode && functionNode.lgaFunctionId) || 2);

    let tier = originalTier;
    let promoted = false;

    if (tier === 3 && vestingDate) {
        const vDate = new Date(vestingDate);
        const vestingMonth = vDate.getFullYear() * 12 + (vDate.getMonth() + 1);

        const hasPreVestingNotice = (systems || []).some(function(sys) {
            if (!sys.endYear) return false;
            const noticeTriggerMonth = sys.endYear * 12 + (sys.endMonth || 12) - (sys.noticePeriod || 0);
            return noticeTriggerMonth < vestingMonth;
        });

        if (hasPreVestingNotice) {
            tier = 2;
            promoted = true;
        }
    }

    return { tier: tier, promoted: promoted, originalTier: originalTier };
}

// Sort function rows by the active sort mode.
// Accepts an array of objects with { tier, collisionCount, label, earliestNotice }.
// Returns a new sorted array (does not mutate the input).
export function sortFunctionRows(rows) {
    return rows.slice().sort(function(a, b) {
        switch (state.activeSortMode) {
            case 'collisions':
                return b.collisionCount - a.collisionCount || a.label.localeCompare(b.label);
            case 'alpha':
                return a.label.localeCompare(b.label);
            case 'urgency':
                return (a.earliestNotice || Infinity) - (b.earliestNotice || Infinity);
            default: // 'tier'
                if (a.tier !== b.tier) return a.tier - b.tier;
                if (a.collisionCount !== b.collisionCount) return b.collisionCount - a.collisionCount;
                return a.label.localeCompare(b.label);
        }
    });
}

// --- Rationalisation pattern classification (pure) ---
// Accepts a SystemAllocation[] array for a function × successor cell.
// Returns one of: 'inherit-as-is', 'choose-and-consolidate',
//   'extract-and-partition', 'extract-partition-and-consolidate'
export function classifyRationalisationPattern(allocations) {
    if (!allocations || allocations.length === 0) {
        return 'inherit-as-is';
    }

    const hasDisaggregation = allocations.some(function(a) { return a.isDisaggregation === true; });

    if (!hasDisaggregation && allocations.length === 1) {
        return 'inherit-as-is';
    }

    if (!hasDisaggregation && allocations.length >= 2) {
        return 'choose-and-consolidate';
    }

    // At this point hasDisaggregation is true (1+ systems with isDisaggregation)
    // "competing non-partial systems" = systems with allocationType !== "partial" AND isDisaggregation === false
    var competingNonPartial = allocations.filter(function(a) {
        return a.allocationType !== 'partial' && a.isDisaggregation === false;
    });

    if (competingNonPartial.length > 0) {
        return 'extract-partition-and-consolidate';
    }

    return 'extract-and-partition';
}

// Selects 1-2 headline signals for inline display
export function getHeadlineMetrics(signals, pattern) {
    if (!signals || signals.length === 0) return null;
    // Prefer strong signals with highest weight
    const strong = signals.filter(s => s.strong);
    const candidate = strong.length > 0 ? strong[0] : signals[0];
    // Pattern-aware: for extract patterns prioritise data signals, for consolidate prioritise vendor/volume
    if (pattern === 'extract-and-partition' || pattern === 'extract-partition-and-consolidate') {
        const dataSignal = signals.find(s => s.id === 'dataMonolith' || s.id === 'dataPortability');
        if (dataSignal) return dataSignal;
    }
    if (pattern === 'choose-and-consolidate') {
        const volSignal = signals.find(s => s.id === 'userVolume' || s.id === 'vendorDensity');
        if (volSignal) return volSignal;
    }
    return candidate;
}

// --- Estate summary metrics (pure function) ---
// Computes aggregate metrics for the estate summary panel.
// Accepts mergedArchitecture, lgaFunctionMap, transitionStructure, successorAllocationMap, and activePerspective.
// Returns a metrics object with all computed values.
export function computeEstateSummaryMetrics(mergedArch, lgaFuncMap, transStruct, successorAllocMap, perspective) {
    // All ITSystem nodes before filtering
    var allSystemsUnfiltered = (mergedArch.nodes || []).filter(function(n) { return n.type === 'ITSystem'; });

    // Apply perspective filtering
    var allSystems = allSystemsUnfiltered;
    var predecessorCount = mergedArch.councils ? mergedArch.councils.size : 0;
    var perspectiveFiltered = perspective && perspective !== 'all';

    if (perspectiveFiltered) {
        if (state.operatingMode === 'transition' && successorAllocMap) {
            var perspectiveSystemIds = new Set();
            var perspectiveCouncils = new Set();
            if (successorAllocMap.has(perspective)) {
                successorAllocMap.get(perspective).forEach(function(allocations) {
                    allocations.forEach(function(alloc) {
                        if (alloc.system) {
                            perspectiveSystemIds.add(alloc.system.id);
                            if (alloc.system._sourceCouncil) perspectiveCouncils.add(alloc.system._sourceCouncil);
                        }
                    });
                });
                allSystems = allSystemsUnfiltered.filter(function(s) { return perspectiveSystemIds.has(s.id); });
                predecessorCount = perspectiveCouncils.size || 1;
            }
        } else {
            // Discovery mode: filter by _sourceCouncil
            allSystems = allSystemsUnfiltered.filter(function(s) { return s._sourceCouncil === perspective; });
            predecessorCount = 1;
        }
    }

    // System count — count ITSystem nodes
    var systemCount = allSystems.length;

    // Collision count — lgaFunctionMap entries with councils.size > 1
    var collisionCount = 0;
    if (lgaFuncMap && typeof lgaFuncMap.forEach === 'function') {
        lgaFuncMap.forEach(function(entry) {
            if (entry.councils && entry.councils.size > 1) {
                collisionCount++;
            }
        });
    }

    // Total annual spend — sum of annualCost across all systems (null if none have it)
    var totalAnnualSpend = null;
    allSystems.forEach(function(sys) {
        if (typeof sys.annualCost === 'number' && !isNaN(sys.annualCost)) {
            if (totalAnnualSpend === null) totalAnnualSpend = 0;
            totalAnnualSpend += sys.annualCost;
        }
    });

    // Pre-vesting notice trigger count — null if no vesting date
    var preVestingNoticeCount = null;
    if (transStruct && transStruct.vestingDate) {
        var vDate = new Date(transStruct.vestingDate);
        var vestingMonth = vDate.getFullYear() * 12 + (vDate.getMonth() + 1);
        preVestingNoticeCount = 0;
        allSystems.forEach(function(sys) {
            if (sys.endYear && typeof sys.noticePeriod === 'number') {
                var noticeTriggerMonth = sys.endYear * 12 + (sys.endMonth || 12) - sys.noticePeriod;
                if (noticeTriggerMonth < vestingMonth) {
                    preVestingNoticeCount++;
                }
            }
        });
    }

    // Transition-mode metrics — null if not in transition mode
    var isTransitionMode = !!(transStruct && transStruct.successors && transStruct.successors.length > 0 && successorAllocMap);
    var disaggregationCount = null;
    var monolithicDisaggregationCount = null;
    var crossBoundarySharedServiceCount = null;

    if (isTransitionMode) {
        // Build a set of all unique system IDs that have isDisaggregation: true
        var disaggregatedSystemIds = new Set();
        var monolithicDisaggregatedSystemIds = new Set();

        successorAllocMap.forEach(function(funcMap) {
            funcMap.forEach(function(allocations) {
                allocations.forEach(function(alloc) {
                    if (alloc.isDisaggregation) {
                        disaggregatedSystemIds.add(alloc.system.id);
                        if (alloc.system.dataPartitioning === 'Monolithic') {
                            monolithicDisaggregatedSystemIds.add(alloc.system.id);
                        }
                    }
                });
            });
        });

        disaggregationCount = disaggregatedSystemIds.size;
        monolithicDisaggregationCount = monolithicDisaggregatedSystemIds.size;

        // Cross-boundary shared service count
        // Build councilToSuccessorMap from transitionStructure
        var councilToSuccessorMap = new Map();
        transStruct.successors.forEach(function(succ) {
            (succ.fullPredecessors || []).forEach(function(c) {
                if (!councilToSuccessorMap.has(c)) councilToSuccessorMap.set(c, []);
                councilToSuccessorMap.get(c).push(succ.name);
            });
            (succ.partialPredecessors || []).forEach(function(c) {
                if (!councilToSuccessorMap.has(c)) councilToSuccessorMap.set(c, []);
                councilToSuccessorMap.get(c).push(succ.name);
            });
        });

        crossBoundarySharedServiceCount = 0;
        var seenSharedSystemIds = new Set();
        allSystems.forEach(function(sys) {
            if (sys.sharedWith && Array.isArray(sys.sharedWith) && sys.sharedWith.length > 0) {
                if (!seenSharedSystemIds.has(sys.id)) {
                    seenSharedSystemIds.add(sys.id);
                    var boundary = detectSharedServiceBoundary(sys, councilToSuccessorMap);
                    if (boundary.unwinding) {
                        crossBoundarySharedServiceCount++;
                    }
                }
            }
        });
    }

    // Critical path systems — null if no vesting date
    var criticalPathSystems = null;
    if (transStruct && transStruct.vestingDate) {
        var cpVDate = new Date(transStruct.vestingDate);
        var cpVestingMonth = cpVDate.getFullYear() * 12 + (cpVDate.getMonth() + 1);
        criticalPathSystems = [];
        allSystems.forEach(function(sys) {
            if (sys.endYear && typeof sys.noticePeriod === 'number' && sys.noticePeriod > 0) {
                var noticeTriggerMonth = sys.endYear * 12 + (sys.endMonth || 12) - sys.noticePeriod;
                if (noticeTriggerMonth < cpVestingMonth) {
                    var triggerY = Math.floor((noticeTriggerMonth - 1) / 12);
                    var triggerM = ((noticeTriggerMonth - 1) % 12) + 1;
                    criticalPathSystems.push({
                        label: sys.label,
                        vendor: sys.vendor || 'Unknown',
                        sourceCouncil: sys._sourceCouncil || '',
                        noticePeriod: sys.noticePeriod,
                        endMonth: sys.endMonth || 12,
                        endYear: sys.endYear,
                        triggerMonth: noticeTriggerMonth,
                        triggerY: triggerY,
                        triggerM: triggerM,
                        monthsBeforeVesting: cpVestingMonth - noticeTriggerMonth
                    });
                }
            }
        });
        criticalPathSystems.sort(function(a, b) { return a.triggerMonth - b.triggerMonth; });
    }

    return {
        predecessorCount: predecessorCount,
        systemCount: systemCount,
        collisionCount: collisionCount,
        totalAnnualSpend: totalAnnualSpend,
        preVestingNoticeCount: preVestingNoticeCount,
        disaggregationCount: disaggregationCount,
        monolithicDisaggregationCount: monolithicDisaggregationCount,
        crossBoundarySharedServiceCount: crossBoundarySharedServiceCount,
        criticalPathSystems: criticalPathSystems,
        filteredSystems: allSystems
    };
}

// --- Migration complexity indicator (pure function) ---
// Computes a T-shirt size (S/M/L/XL) based on system properties.
// Gives immediate context about how difficult decommission/migration would be.
export function computeMigrationComplexity(system) {
    if (!system) return { size: 'S', label: 'Simple', score: 0, factors: [] };

    let score = 0;
    const factors = [];

    // User count
    const users = typeof system.users === 'number' ? system.users : 0;
    if (users >= 2000) { score += 3; factors.push(users.toLocaleString() + ' users'); }
    else if (users >= 500) { score += 2; factors.push(users.toLocaleString() + ' users'); }
    else if (users >= 50) { score += 1; factors.push(users.toLocaleString() + ' users'); }

    // Data partitioning
    if (system.dataPartitioning === 'Monolithic') { score += 2; factors.push('Monolithic'); }

    // Hosting
    if (system.isCloud === false) { score += 1; factors.push('On-prem'); }

    // ERP
    if (system.isERP) { score += 2; factors.push('ERP'); }

    let size, label;
    if (score <= 1) { size = 'S'; label = 'Simple'; }
    else if (score <= 3) { size = 'M'; label = 'Moderate'; }
    else if (score <= 5) { size = 'L'; label = 'Large'; }
    else { size = 'XL'; label = 'Very Large'; }

    return { size, label, score, factors };
}

// --- Programme Readiness Profile (pure-ish: reads state.mergedArchitecture.edges) ---
// Computes a synthesised RAG profile across 4 readiness factors.
// Returns { overall: 'red'|'amber'|'green', factors: [...] }
export function computeReadinessProfile(systems, lgaFunctionMap, transitionStructure, tierMap, successorAllocationMap, activeFactors) {
    const factors = [];
    const now = new Date();
    const currentMonth = now.getFullYear() * 12 + (now.getMonth() + 1);

    // Build system → LGA function mapping from merged architecture edges
    const edges = (state.mergedArchitecture && state.mergedArchitecture.edges) || [];
    const systemToFunctionIds = new Map();
    if (lgaFunctionMap) {
        for (const [lgaId, fnData] of lgaFunctionMap) {
            const fnNodeIds = fnData.localNodeIds; // Set of function node IDs
            if (!fnNodeIds) continue;
            edges.forEach(function(e) {
                if (fnNodeIds.has(e.target) && e.relationship === 'REALIZES') {
                    if (!systemToFunctionIds.has(e.source)) systemToFunctionIds.set(e.source, []);
                    systemToFunctionIds.get(e.source).push(lgaId);
                }
            });
        }
    }

    // Helper: get highest tier (lowest number) for a system
    function getHighestTierForSystem(sys) {
        const fnIds = systemToFunctionIds.get(sys.id) || [];
        let best = 3;
        for (const lgaId of fnIds) {
            const tier = (tierMap && tierMap.get(lgaId)) || DEFAULT_TIER_MAP.get(lgaId) || 2;
            if (tier < best) best = tier;
        }
        return best;
    }

    // --- Factor 1: Contract urgency ---
    const contractActive = activeFactors && activeFactors.contractUrgency;
    if (contractActive) {
        let overdueT1T2 = 0;
        let overdueT3 = 0;
        let upcomingT1T2 = 0;
        const sixMonthsOut = currentMonth + 6;
        const twelveMonthsOut = currentMonth + 12;

        (systems || []).forEach(function(sys) {
            if (!sys.endYear || typeof sys.noticePeriod !== 'number') return;
            const noticeTriggerMonth = sys.endYear * 12 + (sys.endMonth || 12) - sys.noticePeriod;
            const tier = getHighestTierForSystem(sys);
            if (noticeTriggerMonth < currentMonth) {
                // Overdue
                if (tier <= 2) overdueT1T2++;
                else overdueT3++;
            } else if (noticeTriggerMonth <= sixMonthsOut && tier <= 2) {
                upcomingT1T2++;
            }
        });

        let status, detail;
        if (overdueT1T2 > 0) {
            status = 'red';
            detail = overdueT1T2 + ' overdue Tier 1/2 notice trigger' + (overdueT1T2 !== 1 ? 's' : '');
        } else if (overdueT3 > 0 || upcomingT1T2 > 0) {
            status = 'amber';
            const parts = [];
            if (overdueT3 > 0) parts.push(overdueT3 + ' overdue Tier 3');
            if (upcomingT1T2 > 0) parts.push(upcomingT1T2 + ' Tier 1/2 within 6 months');
            detail = parts.join('; ');
        } else {
            status = 'green';
            detail = 'No overdue triggers; no Tier 1/2 triggers within 12 months';
        }
        factors.push({ id: 'contractUrgency', label: 'Contract urgency', status: status, detail: detail, active: true });
    } else {
        factors.push({ id: 'contractUrgency', label: 'Contract urgency', status: 'green', detail: 'Disabled', active: false });
    }

    // --- Factor 2: Disaggregation complexity ---
    const disaggActive = activeFactors && activeFactors.disaggregationComplexity;
    if (disaggActive) {
        // Find systems from partial predecessors
        const partialPredecessors = new Set();
        if (transitionStructure && transitionStructure.successors) {
            transitionStructure.successors.forEach(function(succ) {
                (succ.partialPredecessors || []).forEach(function(c) { partialPredecessors.add(c); });
            });
        }

        let hasMonolithicErp = false;
        let hasDisaggregation = false;

        (systems || []).forEach(function(sys) {
            if (sys._sourceCouncil && partialPredecessors.has(sys._sourceCouncil)) {
                hasDisaggregation = true;
                if (sys.isERP && sys.dataPartitioning === 'Monolithic') {
                    hasMonolithicErp = true;
                }
            }
        });

        let status, detail;
        if (hasMonolithicErp) {
            status = 'red';
            detail = 'Monolithic ERP system from partial predecessor requires disaggregation';
        } else if (hasDisaggregation) {
            status = 'amber';
            detail = 'Disaggregation required but no monolithic ERPs affected';
        } else {
            status = 'green';
            detail = 'No disaggregation required in estate';
        }
        factors.push({ id: 'disaggregationComplexity', label: 'Disaggregation complexity', status: status, detail: detail, active: true });
    } else {
        factors.push({ id: 'disaggregationComplexity', label: 'Disaggregation complexity', status: 'green', detail: 'Disabled', active: false });
    }

    // --- Factor 3: Unsupported systems ---
    const unsupportedActive = activeFactors && activeFactors.unsupportedSystems;
    if (unsupportedActive) {
        let unsupportedT1 = 0;
        let unsupportedAny = 0;

        (systems || []).forEach(function(sys) {
            const support = classifySupportModel(sys);
            if (support.model === 'unsupported' || support.model === 'unknown') {
                unsupportedAny++;
                const tier = getHighestTierForSystem(sys);
                if (tier === 1) unsupportedT1++;
            }
        });

        let status, detail;
        if (unsupportedT1 > 0) {
            status = 'red';
            detail = unsupportedT1 + ' unsupported system' + (unsupportedT1 !== 1 ? 's' : '') + ' serving Tier 1 functions';
        } else if (unsupportedAny > 0) {
            status = 'amber';
            detail = unsupportedAny + ' unsupported/unknown system' + (unsupportedAny !== 1 ? 's' : '') + ' in estate';
        } else {
            status = 'green';
            detail = 'All systems vendor-supported or community-supported';
        }
        factors.push({ id: 'unsupportedSystems', label: 'Unsupported systems', status: status, detail: detail, active: true });
    } else {
        factors.push({ id: 'unsupportedSystems', label: 'Unsupported systems', status: 'green', detail: 'Disabled', active: false });
    }

    // --- Factor 4: Shared service unwinding ---
    const sharedActive = activeFactors && activeFactors.sharedServiceUnwinding;
    if (sharedActive) {
        let unwindingCount = 0;
        let sharedCount = 0;

        if (transitionStructure && transitionStructure.successors) {
            // Build councilToSuccessorMap
            const councilToSuccessorMap = new Map();
            transitionStructure.successors.forEach(function(succ) {
                (succ.fullPredecessors || []).forEach(function(c) {
                    if (!councilToSuccessorMap.has(c)) councilToSuccessorMap.set(c, []);
                    councilToSuccessorMap.get(c).push(succ.name);
                });
                (succ.partialPredecessors || []).forEach(function(c) {
                    if (!councilToSuccessorMap.has(c)) councilToSuccessorMap.set(c, []);
                    councilToSuccessorMap.get(c).push(succ.name);
                });
            });

            (systems || []).forEach(function(sys) {
                if (sys.sharedWith && Array.isArray(sys.sharedWith) && sys.sharedWith.length > 0) {
                    sharedCount++;
                    const boundary = detectSharedServiceBoundary(sys, councilToSuccessorMap);
                    if (boundary.unwinding) unwindingCount++;
                }
            });
        }

        let status, detail;
        if (unwindingCount > 0) {
            status = 'red';
            detail = unwindingCount + ' shared service' + (unwindingCount !== 1 ? 's' : '') + ' crossing successor boundaries';
        } else if (sharedCount > 0) {
            status = 'amber';
            detail = sharedCount + ' shared service' + (sharedCount !== 1 ? 's' : '') + ' — boundary uncertain';
        } else {
            status = 'green';
            detail = 'No shared services in estate';
        }
        factors.push({ id: 'sharedServiceUnwinding', label: 'Shared service unwinding', status: status, detail: detail, active: true });
    } else {
        factors.push({ id: 'sharedServiceUnwinding', label: 'Shared service unwinding', status: 'green', detail: 'Disabled', active: false });
    }

    // Synthesised overall = worst of active factors
    const activeFactorStatuses = factors.filter(function(f) { return f.active; }).map(function(f) { return f.status; });
    let overall = 'green';
    if (activeFactorStatuses.includes('red')) overall = 'red';
    else if (activeFactorStatuses.includes('amber')) overall = 'amber';

    return { overall: overall, factors: factors };
}
