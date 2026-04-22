// ===================================================================
// SANKEY DATA EXTRACTION — Pure functions, no DOM, no D3
// ===================================================================
// Data shapes:
//   allocMap: Map<successorName, Map<lgaFunctionId, SystemAllocation[]>>
//   SystemAllocation: { system: { id, label, vendor, users, annualCost, _sourceCouncil, ... },
//                       sourceCouncil, allocationType, needsAllocationReview, isDisaggregation }

/**
 * Returns a Set of system IDs referenced by any action in the actions array.
 * @param {Array} actions
 * @returns {Set<string>}
 */
export function getAffectedSystemIds(actions) {
    const ids = new Set();
    if (!Array.isArray(actions)) return ids;
    actions.forEach(action => {
        if (action.systemId) ids.add(action.systemId);
        if (action.targetSystemId) ids.add(action.targetSystemId);
        if (action.fromSystemId) ids.add(action.fromSystemId);
        if (action.toSystemId) ids.add(action.toSystemId);
        if (action.replacesSystemId) ids.add(action.replacesSystemId);
        if (Array.isArray(action.removeSystemIds)) {
            action.removeSystemIds.forEach(id => ids.add(id));
        }
        if (action.newSystem && action.newSystem.id) ids.add(action.newSystem.id);
    });
    return ids;
}

/**
 * Builds estate-level Sankey data: predecessors (left) → successors (right).
 * Link values are system counts (or annual cost sums if sizeMode === 'cost').
 *
 * @param {Map} allocMap  Map<successorName, Map<lgaFunctionId, SystemAllocation[]>>
 * @param {Object|null} transitionStructure  { vestingDate, successors: [{name, ...}] }
 * @param {Array} actions  Simulation actions array (used for sim-affected detection)
 * @param {string} [sizeMode='count']  'count' | 'cost'
 * @returns {{ nodes: Array, links: Array }}
 */
export function buildEstateSankeyData(allocMap, transitionStructure, actions, sizeMode = 'count') {
    if (!allocMap || allocMap.size === 0) {
        return { nodes: [], links: [] };
    }

    const affectedIds = getAffectedSystemIds(actions || []);

    // Collect all predecessor council names and successor names
    const predecessorSet = new Set();
    const successorSet = new Set();

    // Track link weights: (predecessorCouncil, successorName) → { count, cost }
    const linkMap = new Map(); // key: `${pred}|||${succ}`

    allocMap.forEach((funcMap, successorName) => {
        successorSet.add(successorName);
        funcMap.forEach((allocations, _lgaFunctionId) => {
            allocations.forEach(a => {
                const council = a.sourceCouncil || (a.system && a.system._sourceCouncil) || 'Unknown';
                predecessorSet.add(council);
                const key = `${council}|||${successorName}`;
                if (!linkMap.has(key)) {
                    linkMap.set(key, { count: 0, cost: 0, hasSimAction: false });
                }
                const entry = linkMap.get(key);
                entry.count += 1;
                if (a.system && typeof a.system.annualCost === 'number') {
                    entry.cost += a.system.annualCost;
                }
                if (a.system && affectedIds.has(a.system.id)) {
                    entry.hasSimAction = true;
                }
            });
        });
    });

    // If transitionStructure has successors listed but some have no allocations, still include them
    if (transitionStructure && transitionStructure.successors) {
        transitionStructure.successors.forEach(s => successorSet.add(s.name));
    }

    const predecessors = Array.from(predecessorSet).sort();
    const successors = Array.from(successorSet).sort();

    const nodes = [
        ...predecessors.map(name => ({ id: `pred:${name}`, label: name, nodeType: 'predecessor' })),
        ...successors.map(name => ({ id: `succ:${name}`, label: name, nodeType: 'successor' }))
    ];

    const links = [];
    linkMap.forEach((entry, key) => {
        const [pred, succ] = key.split('|||');
        const value = sizeMode === 'cost' ? (entry.cost || entry.count) : entry.count;
        if (value > 0) {
            links.push({
                source: `pred:${pred}`,
                target: `succ:${succ}`,
                value,
                rawCount: entry.count,
                rawCost: entry.cost,
                hasSimAction: entry.hasSimAction
            });
        }
    });

    return { nodes, links };
}

/**
 * Builds function-level Sankey data for a single successor:
 * IT system nodes (left) → LGA function nodes (right).
 *
 * @param {Map} allocMap  Map<successorName, Map<lgaFunctionId, SystemAllocation[]>>
 * @param {string} successorName  The successor to drill into
 * @param {Map} lgaFunctionMap  Map<lgaFunctionId, { lgaId, label, ... }>
 * @param {Array} actions  Simulation actions array
 * @param {string} [sizeMode='count']  'count' | 'cost'
 * @returns {{ nodes: Array, links: Array }}
 */
export function buildFunctionSankeyData(allocMap, successorName, lgaFunctionMap, actions, sizeMode = 'count', councilFilter = null, functionFilter = null) {
    if (!allocMap || !allocMap.has(successorName)) {
        return { nodes: [], links: [] };
    }

    const affectedIds = getAffectedSystemIds(actions || []);
    const funcMap = allocMap.get(successorName);

    // Collect unique system IDs and function IDs
    const systemNodes = new Map(); // id → { id, label, nodeType, council }
    const functionNodes = new Map(); // lgaFunctionId → { id, label, nodeType }

    // Track link weights: (systemId, lgaFunctionId) → { count, cost }
    const linkMap = new Map();

    funcMap.forEach((allocations, lgaFunctionId) => {
        if (functionFilter && lgaFunctionId !== functionFilter) return;
        const funcEntry = lgaFunctionMap && lgaFunctionMap.get(lgaFunctionId);
        const funcLabel = funcEntry ? funcEntry.label : lgaFunctionId;
        const funcNodeId = `func:${lgaFunctionId}`;
        functionNodes.set(lgaFunctionId, { id: funcNodeId, label: funcLabel, nodeType: 'function', lgaFunctionId });

        allocations.forEach(a => {
            if (!a.system) return;
            if (councilFilter && (a.sourceCouncil || a.system._sourceCouncil || 'Unknown') !== councilFilter) return;
            const sys = a.system;
            const sysNodeId = `sys:${sys.id}`;
            if (!systemNodes.has(sys.id)) {
                systemNodes.set(sys.id, {
                    id: sysNodeId,
                    label: sys.label || sys.id,
                    nodeType: 'system',
                    systemId: sys.id,
                    council: a.sourceCouncil || sys._sourceCouncil || 'Unknown',
                    vendor: sys.vendor,
                    users: sys.users,
                    annualCost: sys.annualCost,
                    isAffected: affectedIds.has(sys.id),
                    // Contract data for overlay rendering
                    endYear: sys.endYear || null,
                    endMonth: sys.endMonth || null,
                    noticePeriod: sys.noticePeriod || null,
                    // Data characteristics for migration overlay
                    dataPartitioning: sys.dataPartitioning || null,
                    portability: sys.portability || null,
                    isERP: !!sys.isERP,
                    isCloud: !!sys.isCloud
                });
            }

            const key = `${sys.id}|||${lgaFunctionId}`;
            if (!linkMap.has(key)) {
                linkMap.set(key, { count: 1, cost: typeof sys.annualCost === 'number' ? sys.annualCost : 0, hasSimAction: affectedIds.has(sys.id) });
            }
        });
    });

    const nodes = [
        ...Array.from(systemNodes.values()),
        ...Array.from(functionNodes.values())
    ];

    const links = [];
    linkMap.forEach((entry, key) => {
        const [sysId, funcId] = key.split('|||');
        const value = sizeMode === 'cost' ? (entry.cost || 1) : entry.count;
        links.push({
            source: `sys:${sysId}`,
            target: `func:${funcId}`,
            value: Math.max(value, 1), // D3 sankey requires positive values
            rawCount: entry.count,
            rawCost: entry.cost,
            hasSimAction: entry.hasSimAction
        });
    });

    return { nodes, links };
}
