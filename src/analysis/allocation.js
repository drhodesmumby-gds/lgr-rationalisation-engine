// --- Successor Allocation Engine (pure function) ---
// Computes which systems appear in which successor columns.
// Returns Map<successorName, Map<lgaFunctionId, SystemAllocation[]>>
// Also returns a warnings array for UI display.
export function buildSuccessorAllocation(nodes, edges, transitionStructure) {
    const warnings = [];
    const result = new Map();

    if (!transitionStructure || !transitionStructure.successors || transitionStructure.successors.length === 0) {
        return { allocation: result, warnings };
    }

    // Initialise successor maps
    transitionStructure.successors.forEach(s => {
        result.set(s.name, new Map());
    });

    // Build a set of valid successor names for validation
    const validSuccessorNames = new Set(transitionStructure.successors.map(s => s.name));

    // Build lookup: council → { successor, type } entries
    // A council can appear in multiple successors (as partial predecessor)
    const councilToSuccessors = new Map();
    transitionStructure.successors.forEach(s => {
        (s.fullPredecessors || []).forEach(council => {
            if (!councilToSuccessors.has(council)) councilToSuccessors.set(council, []);
            councilToSuccessors.get(council).push({ successor: s.name, type: 'full' });
        });
        (s.partialPredecessors || []).forEach(council => {
            if (!councilToSuccessors.has(council)) councilToSuccessors.set(council, []);
            councilToSuccessors.get(council).push({ successor: s.name, type: 'partial' });
        });
    });

    // Build lookup: system ID → array of lgaFunctionIds it REALIZES
    // We need to go through edges to find REALIZES relationships,
    // then look up the target node to get its lgaFunctionId
    const nodeById = new Map();
    nodes.forEach(n => nodeById.set(n.id, n));

    const systemToFunctions = new Map();
    edges.forEach(edge => {
        if (edge.relationship === 'REALIZES') {
            const targetNode = nodeById.get(edge.target);
            if (targetNode && targetNode.lgaFunctionId) {
                if (!systemToFunctions.has(edge.source)) systemToFunctions.set(edge.source, new Set());
                systemToFunctions.get(edge.source).add(targetNode.lgaFunctionId);
            }
        }
    });

    // Get all ITSystem nodes
    const systems = nodes.filter(n => n.type === 'ITSystem');

    // Track which systems are assigned to which successors (for isDisaggregation)
    const systemSuccessorCount = new Map(); // systemId → Set<successorName>

    // Process each system
    systems.forEach(sys => {
        const sourceCouncil = sys._sourceCouncil;
        const functionIds = systemToFunctions.get(sys.id);

        if (!functionIds || functionIds.size === 0) {
            // System doesn't REALIZE any function — skip but don't warn
            // (it may be connected via other relationship types)
            return;
        }

        // Determine allocation targets
        let allocations = []; // { successorName, allocationType, needsAllocationReview }

        if (sys.targetAuthorities && Array.isArray(sys.targetAuthorities) && sys.targetAuthorities.length > 0) {
            // targetAuthorities override: assign to specified successors
            sys.targetAuthorities.forEach(targetName => {
                if (validSuccessorNames.has(targetName)) {
                    allocations.push({
                        successorName: targetName,
                        allocationType: 'targeted',
                        needsAllocationReview: false
                    });
                } else {
                    warnings.push(`System "${sys.label}" references unknown successor "${targetName}" in targetAuthorities — check transition structure`);
                }
            });
        } else if (sourceCouncil && councilToSuccessors.has(sourceCouncil)) {
            // Use predecessor mapping
            const mappings = councilToSuccessors.get(sourceCouncil);

            // Check if this council is a full predecessor of any successor
            const fullMappings = mappings.filter(m => m.type === 'full');
            const partialMappings = mappings.filter(m => m.type === 'partial');

            if (fullMappings.length > 0) {
                // Full predecessor: assign to that successor
                fullMappings.forEach(m => {
                    allocations.push({
                        successorName: m.successor,
                        allocationType: 'full',
                        needsAllocationReview: false
                    });
                });
            }

            if (partialMappings.length > 0) {
                // Partial predecessor: assign to all successors listing this council as partial
                partialMappings.forEach(m => {
                    allocations.push({
                        successorName: m.successor,
                        allocationType: 'partial',
                        needsAllocationReview: true
                    });
                });
            }
        } else {
            // Unallocated system
            warnings.push(`System "${sys.label}" from "${sourceCouncil || 'unknown'}" is not assigned to any successor — council not found in transition structure`);
            return;
        }

        if (allocations.length === 0) {
            warnings.push(`System "${sys.label}" from "${sourceCouncil || 'unknown'}" could not be allocated to any successor`);
            return;
        }

        // Track successor assignments for isDisaggregation
        if (!systemSuccessorCount.has(sys.id)) systemSuccessorCount.set(sys.id, new Set());
        allocations.forEach(a => systemSuccessorCount.get(sys.id).add(a.successorName));
    });

    // Now build the final allocation map with isDisaggregation computed
    systems.forEach(sys => {
        const sourceCouncil = sys._sourceCouncil;
        const functionIds = systemToFunctions.get(sys.id);

        if (!functionIds || functionIds.size === 0) return;

        let allocations = [];

        if (sys.targetAuthorities && Array.isArray(sys.targetAuthorities) && sys.targetAuthorities.length > 0) {
            sys.targetAuthorities.forEach(targetName => {
                if (validSuccessorNames.has(targetName)) {
                    allocations.push({
                        successorName: targetName,
                        allocationType: 'targeted',
                        needsAllocationReview: false
                    });
                }
            });
        } else if (sourceCouncil && councilToSuccessors.has(sourceCouncil)) {
            const mappings = councilToSuccessors.get(sourceCouncil);
            const fullMappings = mappings.filter(m => m.type === 'full');
            const partialMappings = mappings.filter(m => m.type === 'partial');

            if (fullMappings.length > 0) {
                fullMappings.forEach(m => {
                    allocations.push({
                        successorName: m.successor,
                        allocationType: 'full',
                        needsAllocationReview: false
                    });
                });
            }

            if (partialMappings.length > 0) {
                partialMappings.forEach(m => {
                    allocations.push({
                        successorName: m.successor,
                        allocationType: 'partial',
                        needsAllocationReview: true
                    });
                });
            }
        } else {
            return;
        }

        if (allocations.length === 0) return;

        // Determine isDisaggregation: system appears in 2+ successor columns
        const successorSet = systemSuccessorCount.get(sys.id) || new Set();
        const isDisaggregation = successorSet.size >= 2;

        // Place the system into each allocated successor's function maps
        allocations.forEach(alloc => {
            const successorMap = result.get(alloc.successorName);
            if (!successorMap) return; // shouldn't happen if validSuccessorNames check passed

            functionIds.forEach(funcId => {
                if (!successorMap.has(funcId)) successorMap.set(funcId, []);
                successorMap.get(funcId).push({
                    system: { ...sys },
                    sourceCouncil: sourceCouncil,
                    allocationType: alloc.allocationType,
                    needsAllocationReview: alloc.needsAllocationReview,
                    isDisaggregation: isDisaggregation
                });
            });
        });
    });

    return { allocation: result, warnings };
}

// --- Vesting Zone Classification (pure function) ---
// Classifies a system's notice trigger into one of four zones
// relative to the vesting date.
// Returns: 'pre-vesting' | 'year-1' | 'natural-expiry' | 'long-tail'
export function classifyVestingZone(endYear, endMonth, noticePeriod, vestingDate) {
    const noticeTriggerMonth = endYear * 12 + (endMonth || 12) - noticePeriod;
    const vDate = new Date(vestingDate);
    const vestingMonth = vDate.getFullYear() * 12 + (vDate.getMonth() + 1);

    if (noticeTriggerMonth < vestingMonth) {
        return 'pre-vesting';
    } else if (noticeTriggerMonth < vestingMonth + 12) {
        return 'year-1';
    } else if (noticeTriggerMonth < vestingMonth + 36) {
        return 'natural-expiry';
    } else {
        return 'long-tail';
    }
}

// --- Shared service boundary detection (pure function) ---
// Accepts a system node (with sharedWith array and _sourceCouncil) and a
// council-to-successor mapping (Map<councilName, string[]> where each value
// is an array of successor names the council maps to).
// Resolves each council in [_sourceCouncil, ...sharedWith] to its successors.
// If all map to the same successor → { unwinding: false }
// If 2+ different successors → { unwinding: true, successors: [...] }
export function detectSharedServiceBoundary(systemNode, councilToSuccessorMap) {
    var councils = [systemNode._sourceCouncil];
    if (systemNode.sharedWith && Array.isArray(systemNode.sharedWith)) {
        councils = councils.concat(systemNode.sharedWith);
    }

    var allSuccessors = new Set();
    councils.forEach(function(council) {
        var successors = councilToSuccessorMap.get(council);
        if (successors && Array.isArray(successors)) {
            successors.forEach(function(s) { allSuccessors.add(s); });
        }
        // If council is not found in the mapping, skip (unmapped)
    });

    if (allSuccessors.size <= 1) {
        return { unwinding: false };
    }

    return { unwinding: true, successors: Array.from(allSuccessors) };
}

// --- Cross-tier collision detection (pure function) ---
// Accepts a function row's systems array and the councilTierMap (Map<councilName, string>).
// If systems originate from councils with different tier values → { crossTier: true, tiers: [...] }
// If all same tier or no tier data → { crossTier: false }
export function detectCrossTierCollision(systems, councilTierMap) {
    if (!systems || !Array.isArray(systems) || systems.length === 0) {
        return { crossTier: false };
    }

    var tiers = new Set();
    systems.forEach(function(sys) {
        if (sys._sourceCouncil && councilTierMap && councilTierMap.get) {
            var tier = councilTierMap.get(sys._sourceCouncil);
            if (tier) {
                tiers.add(tier);
            }
        }
    });

    if (tiers.size <= 1) {
        return { crossTier: false };
    }

    return { crossTier: true, tiers: Array.from(tiers) };
}

// --- Financial distress propagation (pure function) ---
// Accepts a list of council metadata objects [{ councilName, financialDistress }, ...]
// Returns a Set<councilName> of councils with financialDistress: true
export function propagateFinancialDistress(councilMetadataList) {
    var result = new Set();
    if (!councilMetadataList || !Array.isArray(councilMetadataList)) {
        return result;
    }
    councilMetadataList.forEach(function(meta) {
        if (meta && meta.councilName && meta.financialDistress === true) {
            result.add(meta.councilName);
        }
    });
    return result;
}
