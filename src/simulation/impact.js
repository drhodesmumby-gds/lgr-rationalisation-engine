import { buildSuccessorAllocation } from '../analysis/allocation.js';
import { computeEstateSummaryMetrics } from '../analysis/metrics.js';
import { applyAllActions } from './actions.js';

/**
 * Computes the impact of simulation actions on the estate.
 *
 * @param {Object} params
 * @param {Array} params.baselineNodes - Original merged architecture nodes
 * @param {Array} params.baselineEdges - Original merged architecture edges
 * @param {Array} params.actions - Array of action objects to apply
 * @param {Object|null} params.transitionStructure - Transition structure (or null for discovery mode)
 * @param {Map} params.lgaFunctionMap - The LGA function map
 * @param {string} params.perspective - The active perspective ('all' or a name)
 * @returns {Object} Impact result with before/after metrics and delta
 */
export function computeSimulationImpact({
    baselineNodes, baselineEdges, actions,
    transitionStructure, lgaFunctionMap, perspective
}) {
    // 1. Compute "before" allocation and metrics using baseline
    const beforeAlloc = transitionStructure
        ? buildSuccessorAllocation(baselineNodes, baselineEdges, transitionStructure)
        : { allocation: null, warnings: [] };

    const beforeMetrics = computeEstateSummaryMetrics(
        { nodes: baselineNodes, edges: baselineEdges, councils: extractCouncils(baselineNodes) },
        lgaFunctionMap,
        transitionStructure,
        beforeAlloc.allocation,
        perspective
    );

    // 2. Apply all actions to get simulated state (with obligation generation)
    const simResult = applyAllActions(baselineNodes, baselineEdges, actions, beforeAlloc.allocation, lgaFunctionMap);

    // 3. Compute "after" allocation and metrics using simulated state
    const afterAlloc = transitionStructure
        ? buildSuccessorAllocation(simResult.nodes, simResult.edges, transitionStructure)
        : { allocation: null, warnings: [] };

    const afterMetrics = computeEstateSummaryMetrics(
        { nodes: simResult.nodes, edges: simResult.edges, councils: extractCouncils(simResult.nodes) },
        lgaFunctionMap,
        transitionStructure,
        afterAlloc.allocation,
        perspective
    );

    // 4. Compute deltas
    const delta = {
        systemCount: afterMetrics.systemCount - beforeMetrics.systemCount,
        totalAnnualSpend: computeSpendDelta(beforeMetrics.totalAnnualSpend, afterMetrics.totalAnnualSpend),
        preVestingNoticeCount: computeNullableDelta(beforeMetrics.preVestingNoticeCount, afterMetrics.preVestingNoticeCount),
        disaggregationCount: computeNullableDelta(beforeMetrics.disaggregationCount, afterMetrics.disaggregationCount),
    };

    return {
        before: beforeMetrics,
        after: afterMetrics,
        delta,
        simulationResult: simResult,
        afterAllocation: afterAlloc.allocation,
        warnings: [...simResult.warnings, ...afterAlloc.warnings],
        obligations: simResult.obligations || [],
    };
}

/**
 * Extract council names from nodes array.
 * @param {Array} nodes
 * @returns {Set<string>}
 */
function extractCouncils(nodes) {
    const councils = new Set();
    nodes.forEach(n => {
        if (n._sourceCouncil) councils.add(n._sourceCouncil);
    });
    return councils;
}

/**
 * Compute delta for spend values (either could be null).
 */
function computeSpendDelta(before, after) {
    if (before === null && after === null) return null;
    return (after || 0) - (before || 0);
}

/**
 * Compute delta for nullable integer values.
 */
function computeNullableDelta(before, after) {
    if (before === null && after === null) return null;
    return (after || 0) - (before || 0);
}
