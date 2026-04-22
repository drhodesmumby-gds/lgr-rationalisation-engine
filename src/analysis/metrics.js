import { state } from '../state.js';
import { classifyVestingZone, detectSharedServiceBoundary } from './allocation.js';

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
