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
 * @property {'data-migration'|'function-gap'|'cross-successor-impact'|'data-partition'|'deferral-cost'} type
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
 *
 * Additional fields for type 'deferral-cost':
 * @property {Array<{id: string, label: string, annualCost: number, users: number}>} [parallelSystems]
 * @property {number} [combinedAnnualCost]
 * @property {Array<{systemId: string, label: string, currentEnd: string, extendedTo: string}>} [contractExtensionsNeeded]
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
 * Generates obligations specific to disaggregation.
 * Unlike consolidation (where obligations track removed -> target),
 * disaggregation obligations track the data partitioning challenge
 * of splitting one system into N successor-scoped instances.
 *
 * Uses equal division of users/cost (same as split-shared-service).
 *
 * @param {Object} originalSystem  The system being disaggregated
 * @param {Object} action          The disaggregate action
 * @param {number} actionIndex     Index into the actions array
 * @param {Map|null} lgaFunctionMap
 * @returns {SimulationObligation[]}
 */
export function generateDisaggregationObligations(originalSystem, action, actionIndex, lgaFunctionMap) {
    const obligations = [];
    const sys = originalSystem;
    const totalUsers = typeof sys.users === 'number' ? sys.users : 0;
    const totalCost = typeof sys.annualCost === 'number' ? sys.annualCost : 0;
    const splitCount = action.splits.length;

    action.splits.forEach((split, splitIndex) => {
        // Equal division, remainder to last split
        let userCount, annualCost;
        if (splitIndex < splitCount - 1) {
            userCount = Math.round(totalUsers / splitCount);
            annualCost = Math.round(totalCost / splitCount);
        } else {
            const perSplit = Math.round(totalUsers / splitCount);
            userCount = totalUsers - perSplit * (splitCount - 1);
            const perSplitCost = Math.round(totalCost / splitCount);
            annualCost = totalCost - perSplitCost * (splitCount - 1);
        }

        obligations.push({
            id: `obl-${actionIndex}-disagg-${sys.id}-${split.successorName}`,
            type: 'data-partition',
            actionIndex,
            actionType: 'disaggregate',
            fromSystem: {
                id: sys.id,
                label: sys.label || sys.id,
                council: sys._sourceCouncil || 'Unknown',
                vendor: sys.vendor || null,
                users: totalUsers,
                annualCost: totalCost,
                dataPartitioning: sys.dataPartitioning || null,
                portability: sys.portability || null,
                isERP: !!sys.isERP,
                isCloud: !!sys.isCloud,
                endYear: sys.endYear || null,
                endMonth: sys.endMonth || null,
                noticePeriod: sys.noticePeriod || null
            },
            toSystem: {
                id: `${sys.id}-disagg-${splitIndex}`,
                label: split.label,
                council: split.successorName
            },
            affectedSuccessors: [split.successorName],
            functionId: null,       // Disaggregation affects ALL functions the system serves
            functionLabel: null,
            isMonolithic: sys.dataPartitioning === 'Monolithic',
            isLowPortability: sys.portability === 'Low',
            isERP: !!sys.isERP,
            isOnPrem: !sys.isCloud,
            userCount,
            annualCost,
            contractEndDate: sys.endYear ? `${sys.endYear}-${String(sys.endMonth || 12).padStart(2, '0')}` : null,
            noticePeriod: typeof sys.noticePeriod === 'number' ? sys.noticePeriod : null,
            splitIndex,
            splitCount,
            resolved: true   // The partition target IS defined (the split instance)
        });
    });

    return obligations;
}

/**
 * Generates obligations for a 'defer' decision.
 *
 * A deferral obligation tracks the ongoing cost and operational risk of running
 * competing systems in parallel while a consolidation decision is delayed. Deferrals
 * are inherently unresolved — the obligation persists until a consolidation decision
 * is made.
 *
 * @param {FunctionDecision} decision  The defer decision
 * @param {Map|null} baselineAllocation  Map<successorName, Map<lgaFunctionId, SystemAllocation[]>>
 * @param {Map|null} lgaFunctionMap  Map<lgaFunctionId, { label, ... }>
 * @returns {SimulationObligation[]}
 */
export function generateDeferralObligations(decision, baselineAllocation, lgaFunctionMap) {
    const obligations = [];
    if (!baselineAllocation || !decision) return obligations;

    const { functionId, successorName } = decision;

    const successorMap = baselineAllocation.get(successorName);
    if (!successorMap) return obligations;

    const allocations = successorMap.get(functionId);
    if (!allocations || allocations.length === 0) return obligations;

    const funcEntry = lgaFunctionMap && lgaFunctionMap.get(functionId);
    const funcLabel = funcEntry ? funcEntry.label : functionId;

    // Gather parallel systems data
    const parallelSystems = [];
    let combinedAnnualCost = 0;
    let totalUsers = 0;
    let hasMonolithic = false;
    let hasLowPortability = false;
    let hasERP = false;
    let hasOnPrem = false;
    const contractExtensionsNeeded = [];

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const horizonYear = currentYear + 2;

    for (const alloc of allocations) {
        const sys = alloc.system;
        if (!sys) continue;

        const annualCost = typeof sys.annualCost === 'number' ? sys.annualCost : 0;
        const users = typeof sys.users === 'number' ? sys.users : 0;

        parallelSystems.push({
            id: sys.id,
            label: sys.label || sys.id,
            annualCost,
            users
        });

        combinedAnnualCost += annualCost;
        totalUsers += users;

        if (sys.dataPartitioning === 'Monolithic') hasMonolithic = true;
        if (sys.portability === 'Low') hasLowPortability = true;
        if (sys.isERP) hasERP = true;
        if (!sys.isCloud) hasOnPrem = true;

        // Check if contract extension is needed (expires within deferral horizon)
        if (sys.endYear && sys.endYear <= horizonYear) {
            const currentEnd = sys.endYear
                ? `${sys.endYear}-${String(sys.endMonth || 12).padStart(2, '0')}`
                : null;
            const extendedEndYear = horizonYear + 1;
            const extendedTo = `${extendedEndYear}-${String(sys.endMonth || 3).padStart(2, '0')}`;
            contractExtensionsNeeded.push({
                systemId: sys.id,
                label: sys.label || sys.id,
                currentEnd,
                extendedTo
            });
        }
    }

    if (parallelSystems.length === 0) return obligations;

    obligations.push({
        id: `obl-defer-${functionId}-${successorName.replace(/\s+/g, '-').toLowerCase()}`,
        type: 'deferral-cost',
        actionIndex: -1,            // Not tied to a specific action index
        actionType: 'defer',
        fromSystem: parallelSystems.length > 0 ? {
            id: parallelSystems[0].id,
            label: parallelSystems[0].label,
            council: 'Multiple (deferred)',
            vendor: null,
            users: totalUsers,
            annualCost: combinedAnnualCost,
            dataPartitioning: hasMonolithic ? 'Monolithic' : 'Segmented',
            portability: hasLowPortability ? 'Low' : 'Medium',
            isERP: hasERP,
            isCloud: !hasOnPrem,
            endYear: null,
            endMonth: null,
            noticePeriod: null
        } : null,
        toSystem: null,             // No target — decision is deferred
        affectedSuccessors: [successorName],
        functionId,
        functionLabel: funcLabel,
        isMonolithic: hasMonolithic,
        isLowPortability: hasLowPortability,
        isERP: hasERP,
        isOnPrem: hasOnPrem,
        userCount: totalUsers,
        annualCost: combinedAnnualCost,
        contractEndDate: null,
        noticePeriod: null,
        resolved: false,            // Deferrals are inherently unresolved
        parallelSystems,
        combinedAnnualCost,
        contractExtensionsNeeded
    });

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

    // Data partition obligations (disaggregation) — always significant complexity
    if (obl.type === 'data-partition') score += 1;

    // Deferral obligations — ongoing parallel running cost accumulates risk
    if (obl.type === 'deferral-cost') {
        // Multiple parallel systems indicate higher consolidation complexity
        const parallelCount = (obl.parallelSystems || []).length;
        if (parallelCount >= 3) score += 3;
        else if (parallelCount >= 2) score += 2;
        else score += 1;

        // Contract extensions needed indicate imminent cost pressure
        const extensionCount = (obl.contractExtensionsNeeded || []).length;
        if (extensionCount > 0 && weights.contractUrgency > 0) {
            score += weights.contractUrgency;
        }
    }

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

    // Disaggregation-specific
    if (obl.type === 'data-partition') {
        const successor = obl.affectedSuccessors[0] || 'successor';
        const splitCount = obl.splitCount || 2;
        bullets.push(`Data partition: 1 of ${splitCount} equal parts to ${successor}`);
        if (obl.isMonolithic) {
            bullets.push('Monolithic data store requires extraction before partition — no clean geographic split boundary exists in the data layer');
        } else {
            bullets.push('Segmented data — geographic partition may be achievable through configuration or tenant separation');
        }
    }

    // Deferral-cost specific bullets
    if (obl.type === 'deferral-cost') {
        const parallelCount = (obl.parallelSystems || []).length;
        if (parallelCount > 1) {
            bullets.push(`${parallelCount} systems running in parallel — consolidation decision deferred`);
        } else {
            bullets.push('System retained without consolidation — ongoing running cost continues');
        }

        if (obl.combinedAnnualCost > 0) {
            const costLabel = obl.combinedAnnualCost >= 1000000
                ? `\u00A3${(obl.combinedAnnualCost / 1000000).toFixed(1)}M`
                : `\u00A3${Math.round(obl.combinedAnnualCost / 1000)}k`;
            bullets.push(`Combined ongoing cost: ${costLabel}/yr`);
        }

        const extensionsNeeded = obl.contractExtensionsNeeded || [];
        if (extensionsNeeded.length > 0) {
            const systemNames = extensionsNeeded.map(e => e.label).join(', ');
            bullets.push(`Contract extension(s) required: ${systemNames}`);
        }

        if (obl.isERP) {
            bullets.push('ERP system(s) involved — deferral may affect multiple functions');
        }

        // Always unresolved for deferral
        bullets.push('Deferral is not a permanent solution — consolidation decision required to close this obligation');
        return bullets;
    }

    // Unresolved
    if (!obl.resolved) {
        bullets.push('No target system identified — function gap requires resolution before Day 1');
    }

    return bullets;
}
