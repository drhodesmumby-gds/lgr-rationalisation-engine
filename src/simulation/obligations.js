// ===================================================================
// SIMULATION OBLIGATIONS — Pure functions for data migration tracking
// ===================================================================
//
// When a simulation action removes a system, the *need* it served
// (data, users, functions) doesn't disappear. This module generates
// obligation records that track what must happen for the transition
// to remain viable: data migrations, user transfers, function gaps,
// and cross-successor impact where a shared predecessor is affected.
//
// Obligation severity is computed at render time using the active
// persona's signal weights, so the same obligation can appear as
// high-severity for an architect but low-severity for an executive.

/**
 * @typedef {Object} SimulationObligation
 * @property {string} id
 * @property {'data-migration'|'function-gap'|'cross-successor-impact'} type
 * @property {number} actionIndex
 * @property {string} actionType
 * @property {Object} fromSystem
 * @property {Object|null} toSystem
 * @property {string[]} affectedSuccessors
 * @property {string} functionId
 * @property {string} functionLabel
 * @property {boolean} isMonolithic
 * @property {boolean} isLowPortability
 * @property {boolean} isERP
 * @property {boolean} isOnPrem
 * @property {number} userCount
 * @property {number} annualCost
 * @property {string|null} contractEndDate
 * @property {number|null} noticePeriod
 * @property {boolean} resolved
 */

/**
 * Generates obligation records for systems removed by a simulation action.
 *
 * For each removed system, finds all (successor, function) pairs it served
 * in the baseline allocation. If the system served a successor OTHER than
 * the action's target successor, a cross-successor-impact obligation is
 * created. If a target system exists (consolidate/procure-replacement),
 * the obligation is marked resolved.
 *
 * @param {Map|null} baselineAllocation  Map<successorName, Map<lgaFunctionId, SystemAllocation[]>>
 * @param {Object} action  The simulation action
 * @param {number} actionIndex  Index into the actions array
 * @param {Array} removedSystems  System nodes that were removed
 * @param {Object|null} targetSystem  The system that absorbs responsibility (or null)
 * @param {Map|null} lgaFunctionMap  Map<lgaFunctionId, { lgaId, label, ... }>
 * @returns {SimulationObligation[]}
 */
export function generateObligations(baselineAllocation, action, actionIndex, removedSystems, targetSystem, lgaFunctionMap) {
    const obligations = [];
    if (!baselineAllocation || !removedSystems || removedSystems.length === 0) return obligations;

    // Determine the action's "home" successor (if any)
    const actionSuccessor = action.successorName || null;

    for (const sys of removedSystems) {
        const sysId = sys.id;

        // Find every (successor, function) pair this system was allocated to
        baselineAllocation.forEach((funcMap, successorName) => {
            funcMap.forEach((allocations, lgaFunctionId) => {
                const match = allocations.find(a => a.system && a.system.id === sysId);
                if (!match) return;

                const funcEntry = lgaFunctionMap && lgaFunctionMap.get(lgaFunctionId);
                const funcLabel = funcEntry ? funcEntry.label : lgaFunctionId;

                const isCrossSuccessor = actionSuccessor && successorName !== actionSuccessor;

                const fromSystemData = {
                    id: sys.id,
                    label: sys.label || sys.id,
                    council: sys._sourceCouncil || match.sourceCouncil || 'Unknown',
                    vendor: sys.vendor || null,
                    users: typeof sys.users === 'number' ? sys.users : 0,
                    annualCost: typeof sys.annualCost === 'number' ? sys.annualCost : 0,
                    dataPartitioning: sys.dataPartitioning || null,
                    portability: sys.portability || null,
                    isERP: !!sys.isERP,
                    isCloud: !!sys.isCloud,
                    endYear: sys.endYear || null,
                    endMonth: sys.endMonth || null,
                    noticePeriod: sys.noticePeriod || null
                };

                const toSystemData = targetSystem ? {
                    id: targetSystem.id,
                    label: targetSystem.label || targetSystem.id,
                    council: targetSystem._sourceCouncil || 'Unknown'
                } : null;

                const oblType = isCrossSuccessor
                    ? 'cross-successor-impact'
                    : (toSystemData ? 'data-migration' : 'function-gap');

                const resolved = !!toSystemData && !isCrossSuccessor;

                obligations.push({
                    id: `obl-${actionIndex}-${sysId}-${successorName}-${lgaFunctionId}`,
                    type: oblType,
                    actionIndex,
                    actionType: action.type,
                    fromSystem: fromSystemData,
                    toSystem: toSystemData,
                    affectedSuccessors: isCrossSuccessor ? [successorName] : [actionSuccessor || successorName],
                    functionId: lgaFunctionId,
                    functionLabel: funcLabel,
                    isMonolithic: sys.dataPartitioning === 'Monolithic',
                    isLowPortability: sys.portability === 'Low',
                    isERP: !!sys.isERP,
                    isOnPrem: !sys.isCloud,
                    userCount: typeof sys.users === 'number' ? sys.users : 0,
                    annualCost: typeof sys.annualCost === 'number' ? sys.annualCost : 0,
                    contractEndDate: sys.endYear ? `${sys.endYear}-${String(sys.endMonth || 12).padStart(2, '0')}` : null,
                    noticePeriod: typeof sys.noticePeriod === 'number' ? sys.noticePeriod : null,
                    resolved
                });
            });
        });
    }

    return obligations;
}

/**
 * Computes obligation severity using the active persona's signal weights.
 * The same obligation shows as high-severity for a data-focused persona
 * (architect) but lower for a commercial persona.
 *
 * @param {SimulationObligation} obl
 * @param {Object} weights  Signal weights: { contractUrgency, userVolume, dataMonolith, dataPortability, techDebt, ... }
 * @returns {'high'|'medium'|'low'}
 */
export function computeObligationSeverity(obl, weights) {
    if (!weights) return 'medium';
    let score = 0;

    // Data complexity signals
    if (obl.isMonolithic && weights.dataMonolith > 0) score += weights.dataMonolith * 2;
    if (obl.isLowPortability && weights.dataPortability > 0) score += weights.dataPortability * 2;
    if (obl.isERP && weights.dataMonolith > 0) score += weights.dataMonolith;

    // Operational signals
    if (obl.isOnPrem && weights.techDebt > 0) score += weights.techDebt;
    if (obl.userCount > 1000 && weights.userVolume > 0) score += weights.userVolume;

    // Contract signals
    if (obl.contractEndDate && weights.contractUrgency > 0) {
        score += weights.contractUrgency;
    }

    // Cross-successor always elevated
    if (obl.type === 'cross-successor-impact') score += 2;

    if (score >= 5) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
}

/**
 * Generates descriptive bullet points summarising what a data migration
 * plan needs to cover for this obligation. Persona-neutral — the bullets
 * describe facts; the UI decides which to emphasise per persona.
 *
 * @param {SimulationObligation} obl
 * @returns {string[]}
 */
export function generateMigrationScopeBullets(obl) {
    const bullets = [];

    // Data complexity
    if (obl.isMonolithic) {
        bullets.push(obl.isERP
            ? 'Data extraction from monolithic ERP — likely requires specialist ETL tooling'
            : 'Monolithic data store — requires careful data partitioning or full extraction');
    }
    if (obl.isLowPortability) {
        bullets.push('Low portability — vendor-specific data formats, manual mapping likely required');
    }

    // User migration
    if (obl.userCount > 0) {
        bullets.push(`${obl.userCount.toLocaleString()} users to migrate or retrain`);
    }

    // Cost implication
    if (obl.annualCost > 0) {
        const label = obl.annualCost >= 1000000
            ? `\u00A3${(obl.annualCost / 1000000).toFixed(1)}M`
            : `\u00A3${Math.round(obl.annualCost / 1000)}k`;
        bullets.push(`${label}/yr cost associated with source system`);
    }

    // Infrastructure
    if (obl.isOnPrem) {
        bullets.push('On-premise hosting — decommission plan needed for physical infrastructure');
    }

    // Contract
    if (obl.contractEndDate) {
        const notice = obl.noticePeriod ? ` (${obl.noticePeriod}-month notice period)` : '';
        bullets.push(`Contract ends ${obl.contractEndDate}${notice}`);
    }

    // Cross-successor
    if (obl.type === 'cross-successor-impact') {
        bullets.push(`Cross-successor impact — removal affects ${obl.affectedSuccessors.join(', ')}`);
    }

    // Unresolved
    if (!obl.resolved) {
        bullets.push('No target system identified — function gap requires resolution before Day 1');
    }

    return bullets;
}
