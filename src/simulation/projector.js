/**
 * Decision Projector — Translates FunctionDecisions into legacy action objects.
 *
 * The projector is a pure function bridge between the new decision-centric model
 * and the existing action engine. It takes a Map of FunctionDecisions and produces
 * an ordered array of legacy action objects that applyAllActions() can process.
 *
 * Projection rules:
 * - 'choose' → consolidate action (with optional disaggregate action first)
 * - 'procure' → procure-replacement action
 * - 'defer' → extend-contract actions for expiring systems + deferral-cost obligations
 *
 * Critical ordering:
 * 1. Disaggregate/boundary decisions first (create new node IDs)
 * 2. Choose/procure decisions next (reference system nodes)
 * 3. Defer decisions last (extend contracts)
 *
 * Retained-system guard:
 * Before generating any decommission consequences, the projector builds a complete
 * set of all system IDs retained by ANY decision. A system retained by Decision A
 * must NOT be decommissioned as a consequence of Decision B.
 *
 * ERP sever-only:
 * When a 'choose' decision removes a system that is retained by another decision
 * (i.e., it serves other functions), the system's REALIZES edge to the current
 * function is severed but the system node is preserved.
 */

import { generateDeferralObligations } from './obligations.js';

/**
 * Projects a set of FunctionDecisions into an ordered array of legacy action objects
 * and a set of projector-generated obligations.
 *
 * @param {Map<string, FunctionDecision>} decisions  Keyed by getDecisionKey(functionId, successorName)
 * @param {Array} baselineNodes
 * @param {Array} baselineEdges
 * @param {Map|null} baselineAllocation  Map<successorName, Map<lgaFunctionId, SystemAllocation[]>>
 * @param {Map|null} lgaFunctionMap  Map<lgaFunctionId, { label, ... }>
 * @returns {{ actions: Array, obligations: Array }}
 */
export function projectDecisions(decisions, baselineNodes, baselineEdges, baselineAllocation, lgaFunctionMap) {
    if (!decisions || decisions.size === 0) {
        return { actions: [], obligations: [] };
    }

    // Step 1: Build a global set of all retained system IDs across ALL decisions.
    // A system is "retained" if it appears in any decision's retainedSystemIds.
    const globalRetainedSystemIds = new Set();
    for (const decision of decisions.values()) {
        if (decision.retainedSystemIds) {
            for (const id of decision.retainedSystemIds) {
                globalRetainedSystemIds.add(id);
            }
        }
    }

    // Step 2: Sort decisions for deterministic ordering:
    // Priority 0: disaggregate boundary decisions (boundaryChoice === 'disaggregate') — these produce both disaggregate + consolidate
    // Priority 1: choose/procure decisions without disaggregation
    // Priority 2: defer decisions
    const sorted = [...decisions.values()].sort(decisionOrder);

    // Step 3: Project each decision into actions and obligations
    const allActions = [];
    const allObligations = [];

    for (const decision of sorted) {
        const { actions, obligations } = projectOneDecision(
            decision,
            baselineNodes,
            baselineEdges,
            baselineAllocation,
            lgaFunctionMap,
            globalRetainedSystemIds
        );
        allActions.push(...actions);
        allObligations.push(...obligations);
    }

    return { actions: allActions, obligations: allObligations };
}

/**
 * Determines the sort priority for ordering decisions.
 * Disaggregate boundary decisions first, then choose/procure, then defer.
 */
function decisionOrder(a, b) {
    return decisionPriority(a) - decisionPriority(b);
}

function decisionPriority(decision) {
    if (decision.systemChoice === 'defer') return 2;
    if (decision.boundaryChoice === 'disaggregate') return 0;
    // Primary establish-shared decisions run before propagated decisions so that
    // REALIZES edges are created in the shared successors' cells before the
    // propagated consolidate actions try to work with the shared system.
    if (decision.boundaryChoice === 'establish-shared' && !decision.sharedServiceOrigin) return 0;
    // Propagated decisions (auto-created from establish-shared) run after primary
    if (decision.sharedServiceOrigin) return 1;
    return 1;
}

/**
 * Projects a single FunctionDecision into actions and obligations.
 *
 * @param {FunctionDecision} decision
 * @param {Array} baselineNodes
 * @param {Array} baselineEdges
 * @param {Map|null} baselineAllocation
 * @param {Map|null} lgaFunctionMap
 * @param {Set<string>} globalRetainedSystemIds  All system IDs retained by any decision
 * @returns {{ actions: Array, obligations: Array }}
 */
function projectOneDecision(decision, baselineNodes, baselineEdges, baselineAllocation, lgaFunctionMap, globalRetainedSystemIds) {
    switch (decision.systemChoice) {
        case 'choose':
            return projectChooseDecision(decision, baselineNodes, baselineEdges, baselineAllocation, lgaFunctionMap, globalRetainedSystemIds);
        case 'procure':
            return projectProcureDecision(decision, baselineNodes, baselineEdges, baselineAllocation, lgaFunctionMap, globalRetainedSystemIds);
        case 'defer':
            return projectDeferDecision(decision, baselineNodes, baselineEdges, baselineAllocation, lgaFunctionMap);
        default:
            return { actions: [], obligations: [] };
    }
}

/**
 * Projects a 'choose' decision.
 *
 * For each retained system (typically one, but multi-system is allowed):
 * - Find all other systems serving this function in this successor that are NOT retained
 * - Systems in globalRetainedSystemIds go to severOnly (edge removed, node kept)
 * - Other systems are fully removed via removeSystemIds
 *
 * If boundaryChoice === 'disaggregate', a disaggregate action is emitted BEFORE the consolidate.
 */
function projectChooseDecision(decision, baselineNodes, baselineEdges, baselineAllocation, lgaFunctionMap, globalRetainedSystemIds) {
    const actions = [];
    const obligations = [];

    const { functionId, successorName, retainedSystemIds, boundaryChoice, disaggregationSplits } = decision;

    // Find all systems serving this function in this successor from baseline allocation
    const allSystemsInCell = getSystemsInCell(baselineAllocation, functionId, successorName);
    const retainedSet = new Set(retainedSystemIds || []);

    // Systems not retained in this decision
    const nonRetainedSystems = allSystemsInCell.filter(sysId => !retainedSet.has(sysId));

    // Partition non-retained systems:
    // - Systems retained by OTHER decisions → severOnly (remove their REALIZES edge, keep node)
    // - Systems not retained anywhere → removeSystemIds (fully decommission)
    const severOnly = nonRetainedSystems.filter(sysId => globalRetainedSystemIds.has(sysId));
    const removeSystemIds = nonRetainedSystems.filter(sysId => !globalRetainedSystemIds.has(sysId));

    // Use the first retained system as the target (if multiple, use first for consolidate target)
    // If no retained systems found in cell, fall back to first retainedSystemId
    const targetSystemId = retainedSystemIds && retainedSystemIds.length > 0 ? retainedSystemIds[0] : null;

    if (!targetSystemId) {
        return { actions, obligations };
    }

    // Emit disaggregate action FIRST if boundary choice requires it
    if (boundaryChoice === 'disaggregate' && disaggregationSplits && disaggregationSplits.length >= 2) {
        actions.push({
            type: 'disaggregate',
            systemId: targetSystemId,
            splits: disaggregationSplits
        });
    }

    // Emit establish-shared-service action BEFORE consolidate for primary establish-shared decisions.
    // Only emit from the PRIMARY decision (no sharedServiceOrigin), not from propagated decisions.
    // This creates REALIZES edges in the shared successors' cells before their consolidates run.
    if (boundaryChoice === 'establish-shared' && !decision.sharedServiceOrigin &&
        decision.sharedWithSuccessors && decision.sharedWithSuccessors.length > 0) {

        const sharedSuccessorFunctionNodeIds = {};
        for (const sharedSuccessor of decision.sharedWithSuccessors) {
            // Find function nodes reachable from the systems in the shared successor's cell
            const sharedCellSystemIds = new Set(getSystemsInCell(baselineAllocation, functionId, sharedSuccessor));
            const candidateFuncNodeIds = new Set(
                baselineNodes.filter(n => n.type === 'Function' && n.lgaFunctionId === functionId).map(n => n.id)
            );

            const fnNodeIds = new Set();
            baselineEdges.forEach(e => {
                if (sharedCellSystemIds.has(e.source) && e.relationship === 'REALIZES' && candidateFuncNodeIds.has(e.target)) {
                    fnNodeIds.add(e.target);
                }
            });

            // If the shared successor's cell has no systems, fall back to any function nodes with
            // this lgaFunctionId that aren't already in this decision's cell.
            if (fnNodeIds.size === 0) {
                const thisCellSysIds = new Set(allSystemsInCell);
                const thisCellFnIds = new Set();
                baselineEdges.forEach(e => {
                    if (thisCellSysIds.has(e.source) && e.relationship === 'REALIZES' && candidateFuncNodeIds.has(e.target)) {
                        thisCellFnIds.add(e.target);
                    }
                });
                candidateFuncNodeIds.forEach(fnId => {
                    if (!thisCellFnIds.has(fnId)) fnNodeIds.add(fnId);
                });
            }

            if (fnNodeIds.size > 0) {
                sharedSuccessorFunctionNodeIds[sharedSuccessor] = [...fnNodeIds];
            }
        }

        if (Object.keys(sharedSuccessorFunctionNodeIds).length > 0) {
            actions.push({
                type: 'establish-shared-service',
                systemId: targetSystemId,
                functionId,
                sharedSuccessorFunctionNodeIds
            });
        }
    }

    // Build the consolidate action
    const consolidateAction = {
        type: 'consolidate',
        functionId,
        successorName,
        targetSystemId,
        removeSystemIds: removeSystemIds.length > 0 ? removeSystemIds : []
    };

    // Add severOnly if there are ERP/shared systems to sever rather than fully remove
    if (severOnly.length > 0) {
        consolidateAction.severOnly = severOnly;
    }

    // Compute scope: function node IDs that belong to this (successor, function) cell.
    // This prevents sever-only edge removal from affecting other successors' function nodes
    // that share the same lgaFunctionId but are different graph nodes.
    //
    // Strategy: use function nodes reachable EXCLUSIVELY from systems that are unique to this
    // cell (not shared with any other successor's allocation for the same functionId).
    // Systems shared across successors (like ERPs) are excluded from scope determination;
    // instead we use the exclusive systems of this cell to identify its function nodes.
    const cellSystemIds = new Set(allSystemsInCell);
    const candidateFuncNodeIds = new Set(
        baselineNodes.filter(n => n.type === 'Function' && n.lgaFunctionId === functionId).map(n => n.id)
    );

    // Collect system IDs present in OTHER successors' cells for this same functionId
    const systemsInOtherSuccessors = new Set();
    if (baselineAllocation) {
        baselineAllocation.forEach((funcMap, otherSuccessorName) => {
            if (otherSuccessorName === successorName) return; // skip this cell's successor
            const otherAllocations = funcMap.get(functionId);
            if (!otherAllocations) return;
            otherAllocations.forEach(a => {
                if (a.system && a.system.id) systemsInOtherSuccessors.add(a.system.id);
            });
        });
    }

    // Systems exclusive to this cell (not shared with other successors)
    const exclusiveCellSystemIds = new Set(
        [...cellSystemIds].filter(id => !systemsInOtherSuccessors.has(id))
    );

    // scopeFuncNodeIds: function nodes reachable from EXCLUSIVE systems of this cell
    // If there are no exclusive systems (all systems are shared), fall back to all reachable
    // function nodes that are NOT reachable from other successors' exclusive systems.
    const scopeFuncNodeIds = new Set();
    const sourceSystemIds = exclusiveCellSystemIds.size > 0 ? exclusiveCellSystemIds : cellSystemIds;
    baselineEdges.forEach(e => {
        if (sourceSystemIds.has(e.source) && e.relationship === 'REALIZES' && candidateFuncNodeIds.has(e.target)) {
            scopeFuncNodeIds.add(e.target);
        }
    });

    // If using exclusive systems produced scope, use it; otherwise fall back to all candidates
    // (degenerate case: all systems are shared, no exclusive scope possible)
    if (scopeFuncNodeIds.size > 0) {
        consolidateAction.scopeFunctionNodeIds = [...scopeFuncNodeIds];
    }

    // Only emit the consolidate if there's something to consolidate
    if (removeSystemIds.length > 0 || severOnly.length > 0) {
        actions.push(consolidateAction);
    }

    return { actions, obligations };
}

/**
 * Projects a 'procure' decision.
 *
 * Produces a procure-replacement action that adds the new system.
 * Existing systems serving this function in this successor are removed
 * (unless they are retained by other decisions).
 */
function projectProcureDecision(decision, baselineNodes, baselineEdges, baselineAllocation, lgaFunctionMap, globalRetainedSystemIds) {
    const actions = [];
    const { functionId, successorName, procuredSystem, boundaryChoice, disaggregationSplits } = decision;

    if (!procuredSystem || !procuredSystem.label) {
        return { actions, obligations: [] };
    }

    // Find all systems currently serving this function in this successor
    const allSystemsInCell = getSystemsInCell(baselineAllocation, functionId, successorName);

    // Compute scope: function nodes reachable from this cell's systems
    // (limits the procured system's REALIZES edges to this successor's function nodes)
    const cellSystemIds = new Set(allSystemsInCell);
    const candidateFuncNodeIds = new Set(
        baselineNodes.filter(n => n.type === 'Function' && n.lgaFunctionId === functionId).map(n => n.id)
    );
    const scopeFunctionNodeIds = [];
    baselineEdges.forEach(e => {
        if (cellSystemIds.has(e.source) && e.relationship === 'REALIZES' && candidateFuncNodeIds.has(e.target)) {
            scopeFunctionNodeIds.push(e.target);
        }
    });

    // Systems not retained by any decision are replaced
    const replacedSystems = allSystemsInCell.filter(sysId => !globalRetainedSystemIds.has(sysId));

    // Build the new system node
    const newSystemId = `sys-procured-${functionId}-${successorName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;
    const newSystem = {
        id: procuredSystem.id || newSystemId,
        label: procuredSystem.label,
        vendor: procuredSystem.vendor || null,
        annualCost: procuredSystem.annualCost || 0,
        isCloud: procuredSystem.isCloud !== undefined ? procuredSystem.isCloud : true,
        type: 'ITSystem'
    };

    // Emit disaggregate action FIRST if boundary choice requires it (for procured system context)
    if (boundaryChoice === 'disaggregate' && disaggregationSplits && disaggregationSplits.length >= 2) {
        // For procure + disaggregate: the new system would be disaggregated,
        // but since it's new, this is a future-state annotation rather than a graph op.
        // We still emit the disaggregate signal for ordering purposes.
    }

    // Emit establish-shared-service action for primary procure + establish-shared decisions.
    // Uses the pre-generated procured system ID (stored on procuredSystem.id) so propagated
    // decisions can reference the same system ID in their retainedSystemIds.
    if (boundaryChoice === 'establish-shared' && !decision.sharedServiceOrigin &&
        decision.sharedWithSuccessors && decision.sharedWithSuccessors.length > 0) {

        const procuredSystemId = newSystem.id;
        const sharedSuccessorFunctionNodeIds = {};
        for (const sharedSuccessor of decision.sharedWithSuccessors) {
            const sharedCellSystemIds = new Set(getSystemsInCell(baselineAllocation, functionId, sharedSuccessor));
            const fnNodeIds = new Set();
            baselineEdges.forEach(e => {
                if (sharedCellSystemIds.has(e.source) && e.relationship === 'REALIZES' && candidateFuncNodeIds.has(e.target)) {
                    fnNodeIds.add(e.target);
                }
            });
            // Fallback: any candidate function nodes not in this cell
            if (fnNodeIds.size === 0) {
                const thisCellFnIds = new Set(scopeFunctionNodeIds);
                candidateFuncNodeIds.forEach(fnId => {
                    if (!thisCellFnIds.has(fnId)) fnNodeIds.add(fnId);
                });
            }
            if (fnNodeIds.size > 0) {
                sharedSuccessorFunctionNodeIds[sharedSuccessor] = [...fnNodeIds];
            }
        }
        if (Object.keys(sharedSuccessorFunctionNodeIds).length > 0) {
            actions.push({
                type: 'establish-shared-service',
                systemId: procuredSystemId,
                functionId,
                sharedSuccessorFunctionNodeIds
            });
        }
    }

    // Emit procure-replacement action for the first replaced system (primary replacement)
    // Additional replaced systems are removed via separate decommission actions
    if (replacedSystems.length > 0) {
        actions.push({
            type: 'procure-replacement',
            functionId,
            successorName,
            newSystem,
            replacesSystemId: replacedSystems[0],
            scopeFunctionNodeIds: scopeFunctionNodeIds.length > 0 ? scopeFunctionNodeIds : undefined
        });

        // Decommission any additional replaced systems beyond the first
        for (let i = 1; i < replacedSystems.length; i++) {
            actions.push({
                type: 'decommission',
                systemId: replacedSystems[i]
            });
        }
    } else {
        // No systems to replace — just add the new one
        actions.push({
            type: 'procure-replacement',
            functionId,
            successorName,
            newSystem,
            replacesSystemId: null,
            scopeFunctionNodeIds: scopeFunctionNodeIds.length > 0 ? scopeFunctionNodeIds : undefined
        });
    }

    return { actions, obligations: [] };
}

/**
 * Projects a 'defer' decision.
 *
 * Produces extend-contract actions for systems whose contracts expire within
 * a 24-month deferral horizon (relative to the vesting date, or using current
 * year + 24 months as a fallback).
 *
 * Also generates a deferral-cost obligation tracking parallel running costs.
 */
function projectDeferDecision(decision, baselineNodes, baselineEdges, baselineAllocation, lgaFunctionMap) {
    const actions = [];
    const obligations = [];

    const { functionId, successorName, contractExtensions } = decision;

    // Apply any explicitly-specified contract extensions
    if (contractExtensions && contractExtensions.length > 0) {
        for (const ext of contractExtensions) {
            if (ext.systemId && ext.newEndYear) {
                actions.push({
                    type: 'extend-contract',
                    systemId: ext.systemId,
                    newEndYear: ext.newEndYear,
                    newEndMonth: ext.newEndMonth || 3
                });
            }
        }
    } else {
        // Auto-generate extensions for systems with contracts expiring within 24 months
        const allSystemsInCell = getSystemsInCell(baselineAllocation, functionId, successorName);
        const currentYear = new Date().getFullYear();
        const horizonYear = currentYear + 2;

        for (const sysId of allSystemsInCell) {
            const sysNode = baselineNodes.find(n => n.id === sysId && n.type === 'ITSystem');
            if (!sysNode) continue;

            // If contract ends within the horizon, extend it
            if (sysNode.endYear && sysNode.endYear <= horizonYear) {
                actions.push({
                    type: 'extend-contract',
                    systemId: sysId,
                    newEndYear: horizonYear + 1,
                    newEndMonth: sysNode.endMonth || 3
                });
            }
        }
    }

    // Generate deferral-cost obligations
    if (baselineAllocation) {
        const deferralObligations = generateDeferralObligations(decision, baselineAllocation, lgaFunctionMap);
        obligations.push(...deferralObligations);
    }

    return { actions, obligations };
}

/**
 * Gets all system IDs serving a specific (functionId, successorName) cell
 * from the baseline allocation map.
 *
 * @param {Map|null} baselineAllocation
 * @param {string} functionId
 * @param {string} successorName
 * @returns {string[]}
 */
function getSystemsInCell(baselineAllocation, functionId, successorName) {
    if (!baselineAllocation) return [];

    const successorMap = baselineAllocation.get(successorName);
    if (!successorMap) return [];

    const allocations = successorMap.get(functionId);
    if (!allocations) return [];

    return allocations
        .filter(a => a.system && a.system.id)
        .map(a => a.system.id);
}
