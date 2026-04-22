/**
 * Simulation Action Engine (pure functions)
 *
 * Action object shapes (discriminated union on `type`):
 *
 * { type: 'consolidate', functionId: string, successorName: string, targetSystemId: string, removeSystemIds?: string[] }
 * { type: 'decommission', systemId: string }
 * { type: 'extend-contract', systemId: string, newEndYear: number, newEndMonth: number }
 * { type: 'migrate-users', fromSystemId: string, toSystemId: string, userCount: number }
 * { type: 'split-shared-service', systemId: string, splits: Array<{ successorName: string, label: string }> }
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

import { generateObligations } from './obligations.js';

/**
 * @param {Array} baselineNodes
 * @param {Array} baselineEdges
 * @param {Array} actions
 * @param {Map|null} [baselineAllocation]  Baseline successor allocation map (for obligation generation)
 * @param {Map|null} [lgaFunctionMap]  LGA function map (for obligation labels)
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
 */
function getTargetSystem(resultNodes, action) {
    if (action.type === 'consolidate' && action.targetSystemId) {
        return resultNodes.find(n => n.id === action.targetSystemId) || null;
    }
    if (action.type === 'procure-replacement' && action.newSystem) {
        return resultNodes.find(n => n.id === action.newSystem.id) || null;
    }
    return null;
}

export function applyAction(nodes, edges, action) {
    switch (action.type) {
        case 'consolidate': return applyConsolidate(nodes, edges, action);
        case 'decommission': return applyDecommission(nodes, edges, action);
        case 'extend-contract': return applyExtendContract(nodes, edges, action);
        case 'migrate-users': return applyMigrateUsers(nodes, edges, action);
        case 'split-shared-service': return applySplitSharedService(nodes, edges, action);
        case 'procure-replacement': return applyProcureReplacement(nodes, edges, action);
        default:
            return { nodes, edges, warnings: [`Unknown action type: ${action.type}`] };
    }
}

export function applyConsolidate(nodes, edges, action) {
    const warnings = [];
    const { functionId, targetSystemId, removeSystemIds, successorName } = action;

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

    let systemsToRemove;
    if (removeSystemIds && removeSystemIds.length > 0) {
        // Scoped consolidation: only remove explicitly listed systems
        systemsToRemove = new Set(removeSystemIds.filter(id => id !== targetSystemId));
    } else {
        // Global fallback: remove all systems serving this function except target
        const systemIdsServingFunction = new Set();
        edges.forEach(e => {
            if (e.relationship === 'REALIZES' && funcNodeIds.has(e.target)) {
                systemIdsServingFunction.add(e.source);
            }
        });
        systemsToRemove = new Set([...systemIdsServingFunction].filter(id => id !== targetSystemId));
    }

    if (systemsToRemove.size === 0) {
        return { nodes, edges, warnings: [] }; // Nothing to consolidate
    }

    // Transfer users from removed systems to target
    let transferredUsers = 0;
    systemsToRemove.forEach(sysId => {
        const sys = nodes.find(n => n.id === sysId);
        if (sys && typeof sys.users === 'number') {
            transferredUsers += sys.users;
        }
    });
    if (transferredUsers > 0 && typeof nodes[targetIdx].users === 'number') {
        nodes[targetIdx].users += transferredUsers;
    }

    // Remove the systems
    nodes = nodes.filter(n => !systemsToRemove.has(n.id));

    // Remove edges from removed systems
    edges = edges.filter(e => !systemsToRemove.has(e.source));

    // Check for unserved functions at the lgaFunctionId level.
    // After cross-council consolidation, individual Function nodes from removed councils
    // may lose their realizer, but the function is still served if ANY node with the same
    // lgaFunctionId has a realizer (e.g. the target system's own council's Function node).
    const anyRealizer = Array.from(funcNodeIds).some(fnId =>
        edges.some(e => e.relationship === 'REALIZES' && e.target === fnId)
    );
    if (!anyRealizer) {
        const fnNode = nodes.find(n => funcNodeIds.has(n.id));
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
