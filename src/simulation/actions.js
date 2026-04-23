/**
 * Simulation Action Engine (pure functions)
 *
 * Action object shapes (discriminated union on `type`):
 *
 * { type: 'consolidate', functionId: string, successorName: string, targetSystemId: string, removeSystemIds?: string[], scopeFunctionNodeIds?: string[] }
 * { type: 'consolidate-erp', successorName: string, targetSystemId: string, affectedFunctionIds: string[], removedPerFunction: Object }
 * { type: 'decommission', systemId: string }
 * { type: 'extend-contract', systemId: string, newEndYear: number, newEndMonth: number }
 * { type: 'migrate-users', fromSystemId: string, toSystemId: string, userCount: number }
 * { type: 'split-shared-service', systemId: string, splits: Array<{ successorName: string, label: string }> }
 * { type: 'disaggregate', systemId: string, splits: Array<{ successorName: string, label: string }> }
 * { type: 'procure-replacement', functionId: string, successorName: string, newSystem: object, replacesSystemId: string }
 *
 * SimulationResult shape:
 * {
 *   nodes: Array<object>,       // deep-copied, modified ITSystem/Function nodes
 *   edges: Array<object>,       // deep-copied, modified REALIZES edges
 *   warnings: Array<string>,    // human-readable warning strings
 *   obligations: Array<object>, // data migration / cross-successor impact obligations
 *   appliedCount: number        // number of actions successfully applied
 * }
 */

import { generateObligations, generateDisaggregationObligations } from './obligations.js';

/**
 * @param {Array} baselineNodes
 * @param {Array} baselineEdges
 * @param {Array} actions
 * @param {Map|null} [baselineAllocation]  Baseline successor allocation map (for obligation generation)
 * @param {Map|null} [lgaFunctionMap]  LGA function map (for obligation labels)
 *
 * Action object shapes (discriminated union on `type`):
 * consolidate now supports an optional `severOnly: string[]` field — systems in this
 * array have their REALIZES edge to the target function removed but their node and
 * other edges are preserved (used for ERP systems that still serve other functions).
 */
export function applyAllActions(baselineNodes, baselineEdges, actions, baselineAllocation, lgaFunctionMap) {
    // Deep-copy baseline
    let nodes = JSON.parse(JSON.stringify(baselineNodes));
    let edges = JSON.parse(JSON.stringify(baselineEdges));
    const allWarnings = [];
    const allObligations = [];
    let appliedCount = 0;

    // Apply each action sequentially
    for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        const beforeNodes = nodes;

        const result = applyAction(nodes, edges, action);

        // Generate obligations for systems removed by this action
        if (baselineAllocation) {
            const removedIds = getRemovedSystemIds(beforeNodes, result.nodes);
            if (removedIds.size > 0) {
                const removedSystems = beforeNodes.filter(n => removedIds.has(n.id));
                const targetSystem = getTargetSystem(result.nodes, action);
                const obligations = generateObligations(
                    baselineAllocation, action, i,
                    removedSystems, targetSystem, lgaFunctionMap
                );
                allObligations.push(...obligations);
            }
        }

        // Generate disaggregation-specific obligations (the original system is removed,
        // but this is not a consolidation — it's a partition obligation per split)
        if (action.type === 'disaggregate') {
            const originalSystem = beforeNodes.find(n => n.id === action.systemId);
            if (originalSystem) {
                const obligations = generateDisaggregationObligations(
                    originalSystem, action, i, lgaFunctionMap
                );
                allObligations.push(...obligations);
            }
        }

        nodes = result.nodes;
        edges = result.edges;
        allWarnings.push(...result.warnings);
        appliedCount++;
    }

    return { nodes, edges, warnings: allWarnings, obligations: allObligations, appliedCount };
}

/**
 * Detects which system IDs were present before but absent after an action.
 */
function getRemovedSystemIds(beforeNodes, afterNodes) {
    const afterIds = new Set(afterNodes.map(n => n.id));
    return new Set(
        beforeNodes
            .filter(n => n.type === 'ITSystem' && !afterIds.has(n.id))
            .map(n => n.id)
    );
}

/**
 * Extracts the target system from the result nodes for a given action.
 * For consolidate: the targetSystemId. For procure-replacement: the newSystem.
 * For consolidate-erp: the targetSystemId (anchor ERP).
 */
function getTargetSystem(resultNodes, action) {
    if (action.type === 'consolidate' && action.targetSystemId) {
        return resultNodes.find(n => n.id === action.targetSystemId) || null;
    }
    if (action.type === 'consolidate-erp' && action.targetSystemId) {
        return resultNodes.find(n => n.id === action.targetSystemId) || null;
    }
    if (action.type === 'procure-replacement' && action.newSystem) {
        return resultNodes.find(n => n.id === action.newSystem.id) || null;
    }
    return null;
}

export function applyAction(nodes, edges, action) {
    switch (action.type) {
        case 'consolidate':         return applyConsolidate(nodes, edges, action);
        case 'consolidate-erp':     return applyConsolidateErp(nodes, edges, action);
        case 'decommission':        return applyDecommission(nodes, edges, action);
        case 'extend-contract':     return applyExtendContract(nodes, edges, action);
        case 'migrate-users':       return applyMigrateUsers(nodes, edges, action);
        case 'split-shared-service':return applySplitSharedService(nodes, edges, action);
        case 'disaggregate':        return applyDisaggregate(nodes, edges, action);
        case 'procure-replacement': return applyProcureReplacement(nodes, edges, action);
        default:
            return { nodes, edges, warnings: [`Unknown action type: ${action.type}`] };
    }
}

export function applyConsolidate(nodes, edges, action) {
    const warnings = [];
    const { functionId, targetSystemId, removeSystemIds, successorName } = action;

    // severOnly: systems whose REALIZES edge to this function is removed, but the system
    // node and all other edges are preserved. Used for ERP systems that still serve other functions.
    const severOnlySet = new Set(action.severOnly || []);

    // Find target system
    const targetIdx = nodes.findIndex(n => n.id === targetSystemId && n.type === 'ITSystem');
    if (targetIdx === -1) {
        return { nodes, edges, warnings: [`Consolidate: target system ${targetSystemId} not found`] };
    }

    // Find function nodes for this lgaFunctionId
    const funcNodeIds = new Set(
        nodes.filter(n => n.type === 'Function' && n.lgaFunctionId === functionId).map(n => n.id)
    );

    if (funcNodeIds.size === 0) {
        return { nodes, edges, warnings: [`Consolidate: no function nodes found for lgaFunctionId ${functionId}`] };
    }

    // Scoped function node IDs for sever-only edge removal (when provided by projector).
    // Limits sever-only edge removal to function nodes reachable from systems in the
    // current (successor, function) cell — prevents severing edges to other successors'
    // function nodes that share the same lgaFunctionId but are different graph nodes.
    const severScopeFuncIds = action.scopeFunctionNodeIds
        ? new Set(action.scopeFunctionNodeIds)
        : funcNodeIds;

    let systemsToRemoveAll;
    if (removeSystemIds && removeSystemIds.length > 0) {
        // Scoped consolidation: only act on explicitly listed systems
        systemsToRemoveAll = new Set(removeSystemIds.filter(id => id !== targetSystemId));
    } else {
        // Global fallback: act on all systems serving this function except target
        const systemIdsServingFunction = new Set();
        edges.forEach(e => {
            if (e.relationship === 'REALIZES' && funcNodeIds.has(e.target)) {
                systemIdsServingFunction.add(e.source);
            }
        });
        systemsToRemoveAll = new Set([...systemIdsServingFunction].filter(id => id !== targetSystemId));
    }

    if (systemsToRemoveAll.size === 0 && severOnlySet.size === 0) {
        return { nodes, edges, warnings: [] }; // Nothing to consolidate
    }

    // Partition: systems in severOnly are edge-severed only; others are fully removed
    const toFullyRemove = new Set([...systemsToRemoveAll].filter(id => !severOnlySet.has(id)));
    const toSeverEdgesOnly = new Set([...systemsToRemoveAll].filter(id => severOnlySet.has(id)));

    // Also handle severOnly IDs that weren't in removeSystemIds (explicit sever-only set)
    severOnlySet.forEach(id => {
        if (id !== targetSystemId && !toSeverEdgesOnly.has(id)) {
            toSeverEdgesOnly.add(id);
        }
    });

    // Transfer users from FULLY removed systems to target (not from sever-only systems)
    let transferredUsers = 0;
    toFullyRemove.forEach(sysId => {
        const sys = nodes.find(n => n.id === sysId);
        if (sys && typeof sys.users === 'number') {
            transferredUsers += sys.users;
        }
    });
    if (transferredUsers > 0 && typeof nodes[targetIdx].users === 'number') {
        nodes[targetIdx].users += transferredUsers;
    }

    // Fully remove systems that are not sever-only
    nodes = nodes.filter(n => !toFullyRemove.has(n.id));

    // Remove ALL edges from fully removed systems
    edges = edges.filter(e => !toFullyRemove.has(e.source));

    // For sever-only systems: remove ONLY their REALIZES edges to this function's nodes
    // (preserve the system node and all other edges)
    // Use severScopeFuncIds instead of funcNodeIds to limit removal to this cell's
    // function nodes, preventing cross-successor edge removal.
    if (toSeverEdgesOnly.size > 0) {
        edges = edges.filter(e => {
            // Keep the edge unless: it's from a sever-only system AND it's a REALIZES edge to this function's scope
            const isSeverSource = toSeverEdgesOnly.has(e.source);
            const isRealizesEdge = e.relationship === 'REALIZES';
            const targetIsThisFunction = severScopeFuncIds.has(e.target);
            return !(isSeverSource && isRealizesEdge && targetIsThisFunction);
        });
    }

    // Check for unserved functions at the lgaFunctionId level.
    // After cross-council consolidation, individual Function nodes from removed councils
    // may lose their realizer, but the function is still served if ANY node with the same
    // lgaFunctionId has a realizer (e.g. the target system's own council's Function node).
    const anyRealizer = Array.from(severScopeFuncIds).some(fnId =>
        edges.some(e => e.relationship === 'REALIZES' && e.target === fnId)
    );
    if (!anyRealizer) {
        const fnNode = nodes.find(n => severScopeFuncIds.has(n.id));
        const label = fnNode ? fnNode.label : functionId;
        const scope = successorName ? ` in ${successorName}` : '';
        warnings.push(`Consolidate: function ${label} (${functionId}) may be unserved${scope} after consolidation`);
    }

    return { nodes, edges, warnings };
}

export function applyDecommission(nodes, edges, action) {
    const warnings = [];
    const { systemId } = action;

    const sysIdx = nodes.findIndex(n => n.id === systemId && n.type === 'ITSystem');
    if (sysIdx === -1) {
        return { nodes, edges, warnings: [`Decommission: system ${systemId} not found`] };
    }

    // Collect function targets this system realizes
    const functionTargets = new Set();
    edges.forEach(e => {
        if (e.source === systemId && e.relationship === 'REALIZES') {
            functionTargets.add(e.target);
        }
    });

    // Remove system node
    nodes = nodes.filter(n => n.id !== systemId);

    // Remove all edges from this system
    edges = edges.filter(e => e.source !== systemId);

    // Check for unserved functions
    functionTargets.forEach(fnNodeId => {
        const hasRealizer = edges.some(e => e.relationship === 'REALIZES' && e.target === fnNodeId);
        if (!hasRealizer) {
            const fnNode = nodes.find(n => n.id === fnNodeId);
            const label = fnNode ? fnNode.label : fnNodeId;
            const lgaId = fnNode ? fnNode.lgaFunctionId : '?';
            warnings.push(`Decommission: function ${label} (${lgaId}) is no longer served by any system`);
        }
    });

    return { nodes, edges, warnings };
}

export function applyExtendContract(nodes, edges, action) {
    const { systemId, newEndYear, newEndMonth } = action;

    const sysIdx = nodes.findIndex(n => n.id === systemId && n.type === 'ITSystem');
    if (sysIdx === -1) {
        return { nodes, edges, warnings: [`ExtendContract: system ${systemId} not found`] };
    }

    nodes[sysIdx] = { ...nodes[sysIdx], endYear: newEndYear, endMonth: newEndMonth };

    return { nodes, edges, warnings: [] };
}

export function applyMigrateUsers(nodes, edges, action) {
    const warnings = [];
    const { fromSystemId, toSystemId, userCount } = action;

    const fromIdx = nodes.findIndex(n => n.id === fromSystemId && n.type === 'ITSystem');
    const toIdx = nodes.findIndex(n => n.id === toSystemId && n.type === 'ITSystem');

    if (fromIdx === -1) {
        return { nodes, edges, warnings: [`MigrateUsers: source system ${fromSystemId} not found`] };
    }
    if (toIdx === -1) {
        return { nodes, edges, warnings: [`MigrateUsers: target system ${toSystemId} not found`] };
    }
    if (!userCount || userCount <= 0) {
        return { nodes, edges, warnings: ['MigrateUsers: userCount must be positive'] };
    }

    const fromUsers = typeof nodes[fromIdx].users === 'number' ? nodes[fromIdx].users : 0;
    let actualCount = userCount;
    if (fromUsers < userCount) {
        actualCount = fromUsers;
        warnings.push(`MigrateUsers: requested ${userCount} but ${nodes[fromIdx].label} only has ${fromUsers} users — migrating all`);
    }

    nodes[fromIdx] = { ...nodes[fromIdx], users: fromUsers - actualCount };
    const toUsers = typeof nodes[toIdx].users === 'number' ? nodes[toIdx].users : 0;
    nodes[toIdx] = { ...nodes[toIdx], users: toUsers + actualCount };

    return { nodes, edges, warnings };
}

export function applySplitSharedService(nodes, edges, action) {
    const warnings = [];
    const { systemId, splits } = action;

    const sysIdx = nodes.findIndex(n => n.id === systemId && n.type === 'ITSystem');
    if (sysIdx === -1) {
        return { nodes, edges, warnings: [`SplitSharedService: system ${systemId} not found`] };
    }

    if (!splits || splits.length === 0) {
        return { nodes, edges, warnings: ['SplitSharedService: splits array is empty'] };
    }

    const original = nodes[sysIdx];

    // Collect REALIZES edges from original
    const originalEdges = edges.filter(e => e.source === systemId && e.relationship === 'REALIZES');

    // Create new split systems
    const newSystems = splits.map((split, index) => {
        const newId = `${systemId}-split-${index}`;
        const newSys = { ...original, id: newId, label: split.label, sharedWith: [], targetAuthorities: [split.successorName] };

        // Divide users
        if (typeof original.users === 'number') {
            if (index < splits.length - 1) {
                newSys.users = Math.round(original.users / splits.length);
            } else {
                // Last split gets remainder
                const perSplit = Math.round(original.users / splits.length);
                newSys.users = original.users - perSplit * (splits.length - 1);
            }
        }

        // Divide cost
        if (typeof original.annualCost === 'number') {
            if (index < splits.length - 1) {
                newSys.annualCost = Math.round(original.annualCost / splits.length);
            } else {
                const perSplit = Math.round(original.annualCost / splits.length);
                newSys.annualCost = original.annualCost - perSplit * (splits.length - 1);
            }
        }

        return newSys;
    });

    // Create new edges for each new system (copy all REALIZES from original)
    const newEdges = [];
    newSystems.forEach(newSys => {
        originalEdges.forEach(origEdge => {
            newEdges.push({ source: newSys.id, target: origEdge.target, relationship: 'REALIZES' });
        });
    });

    // Remove original system and its edges
    nodes = nodes.filter(n => n.id !== systemId);
    edges = edges.filter(e => e.source !== systemId);

    // Add new systems and edges
    nodes = [...nodes, ...newSystems];
    edges = [...edges, ...newEdges];

    return { nodes, edges, warnings };
}

export function applyDisaggregate(nodes, edges, action) {
    const warnings = [];
    const { systemId, splits } = action;

    const sysIdx = nodes.findIndex(n => n.id === systemId && n.type === 'ITSystem');
    if (sysIdx === -1) {
        return { nodes, edges, warnings: [`Disaggregate: system ${systemId} not found`] };
    }

    if (!splits || splits.length < 2) {
        return { nodes, edges, warnings: ['Disaggregate: at least 2 splits required'] };
    }

    const original = nodes[sysIdx];

    // --- Monolithic data warning ---
    if (original.dataPartitioning === 'Monolithic') {
        warnings.push(
            `Disaggregate: ${original.label} has monolithic data partitioning — ` +
            `splitting the contract does not split the data. ` +
            `A data extraction and partitioning strategy is required before this system can be disaggregated.`
        );
    }

    // --- Low portability warning ---
    if (original.portability === 'Low') {
        warnings.push(
            `Disaggregate: ${original.label} has low data portability — ` +
            `vendor-specific data formats may require specialist ETL tooling for partition.`
        );
    }

    // --- ERP warning ---
    if (original.isERP) {
        warnings.push(
            `Disaggregate: ${original.label} is an ERP system — ` +
            `disaggregation affects all functions this ERP serves. ` +
            `Consider whether an ERP-level consolidation decision should be made first.`
        );
    }

    // Collect REALIZES edges from original
    const originalEdges = edges.filter(e => e.source === systemId && e.relationship === 'REALIZES');

    // Create new split systems with equal allocation (same as split-shared-service)
    const newSystems = splits.map((split, index) => {
        const newId = `${systemId}-disagg-${index}`;
        const newSys = {
            ...original,
            id: newId,
            label: split.label,
            sharedWith: [],
            targetAuthorities: [split.successorName],
            _disaggregatedFrom: systemId
        };

        // Equal user allocation — remainder to last split
        if (typeof original.users === 'number') {
            if (index < splits.length - 1) {
                newSys.users = Math.round(original.users / splits.length);
            } else {
                const perSplit = Math.round(original.users / splits.length);
                newSys.users = original.users - perSplit * (splits.length - 1);
            }
        }

        // Equal cost allocation — remainder to last split
        if (typeof original.annualCost === 'number') {
            if (index < splits.length - 1) {
                newSys.annualCost = Math.round(original.annualCost / splits.length);
            } else {
                const perSplit = Math.round(original.annualCost / splits.length);
                newSys.annualCost = original.annualCost - perSplit * (splits.length - 1);
            }
        }

        return newSys;
    });

    // Create new edges for each new system (copy all REALIZES from original)
    const newEdges = [];
    newSystems.forEach(newSys => {
        originalEdges.forEach(origEdge => {
            newEdges.push({ source: newSys.id, target: origEdge.target, relationship: 'REALIZES' });
        });
    });

    // Remove original system and its edges
    nodes = nodes.filter(n => n.id !== systemId);
    edges = edges.filter(e => e.source !== systemId);

    // Add new systems and edges
    nodes = [...nodes, ...newSystems];
    edges = [...edges, ...newEdges];

    return { nodes, edges, warnings };
}

export function applyConsolidateErp(nodes, edges, action) {
    const warnings = [];
    const { successorName, targetSystemId, affectedFunctionIds, removedPerFunction } = action;

    // Validate target system exists
    const targetIdx = nodes.findIndex(n => n.id === targetSystemId && n.type === 'ITSystem');
    if (targetIdx === -1) {
        return { nodes, edges, warnings: [`ConsolidateERP: target system ${targetSystemId} not found`] };
    }

    const targetSys = nodes[targetIdx];
    if (!targetSys.isERP) {
        warnings.push(`ConsolidateERP: ${targetSys.label} is not flagged as an ERP — proceeding anyway`);
    }

    if (!affectedFunctionIds || affectedFunctionIds.length === 0) {
        return { nodes, edges, warnings: [...warnings, 'ConsolidateERP: no affected functions specified'] };
    }

    // Apply consolidation for each affected function
    let currentNodes = nodes;
    let currentEdges = edges;

    for (const funcId of affectedFunctionIds) {
        const removeIds = (removedPerFunction && removedPerFunction[funcId]) ? removedPerFunction[funcId] : [];
        if (removeIds.length === 0) continue;

        const result = applyConsolidate(currentNodes, currentEdges, {
            type: 'consolidate',
            functionId: funcId,
            successorName,
            targetSystemId,
            removeSystemIds: removeIds
        });

        currentNodes = result.nodes;
        currentEdges = result.edges;
        warnings.push(...result.warnings);
    }

    return { nodes: currentNodes, edges: currentEdges, warnings };
}

export function applyProcureReplacement(nodes, edges, action) {
    const warnings = [];
    const { functionId, newSystem, replacesSystemId } = action;

    // Validate new system
    if (!newSystem || !newSystem.id || !newSystem.label) {
        return { nodes, edges, warnings: ['ProcureReplacement: newSystem must have id and label'] };
    }

    // Check for duplicate ID
    if (nodes.some(n => n.id === newSystem.id)) {
        return { nodes, edges, warnings: [`ProcureReplacement: system ${newSystem.id} already exists`] };
    }

    // Add new system node
    const sysNode = { ...newSystem, type: 'ITSystem' };
    nodes = [...nodes, sysNode];

    // Create REALIZES edges to function nodes
    const funcNodes = nodes.filter(n => n.type === 'Function' && n.lgaFunctionId === functionId);
    const newEdges = funcNodes.map(fn => ({
        source: sysNode.id,
        target: fn.id,
        relationship: 'REALIZES'
    }));
    edges = [...edges, ...newEdges];

    if (funcNodes.length === 0) {
        warnings.push(`ProcureReplacement: no function nodes found for lgaFunctionId ${functionId}`);
    }

    // Decommission replaced system if specified
    if (replacesSystemId) {
        const decommResult = applyDecommission(nodes, edges, { type: 'decommission', systemId: replacesSystemId });
        nodes = decommResult.nodes;
        edges = decommResult.edges;
        warnings.push(...decommResult.warnings);
    }

    return { nodes, edges, warnings };
}
