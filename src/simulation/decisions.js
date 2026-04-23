/**
 * Decision Data Model — Pure helpers for function-first simulation decisions.
 *
 * A FunctionDecision represents a team's choice for how a specific function
 * will be operated in a specific successor authority after reorganisation.
 * Decisions replace the old action-centric model: users decide at the function
 * level, and the projector translates decisions into the legacy action language.
 *
 * @typedef {Object} FunctionDecision
 * @property {string} id                         -- unique ID e.g. 'dec-148-north-essex-1714000000000'
 * @property {string} functionId                 -- lgaFunctionId (ESD taxonomy ID)
 * @property {string} successorName              -- successor authority name
 * @property {string} timestamp                  -- ISO 8601 timestamp of when decision was made
 *
 * // Axis 1: System Choice
 * @property {'choose'|'procure'|'defer'} systemChoice
 * @property {string[]} retainedSystemIds        -- systems to keep running (choose)
 * @property {Object|null} procuredSystem        -- new system spec (procure)
 * @property {string} [procuredSystem.label]
 * @property {string} [procuredSystem.vendor]
 * @property {number} [procuredSystem.annualCost]
 * @property {boolean} [procuredSystem.isCloud]
 *
 * // Axis 2: Operating Model Boundary
 * @property {'none'|'disaggregate'|'maintain-shared'|'establish-shared'} boundaryChoice
 * @property {Array<{successorName: string, label: string}>} disaggregationSplits
 * @property {string[]} sharedWithSuccessors     -- successor names sharing the service (establish-shared primary)
 * @property {string|null} sharedServiceOrigin   -- decision key of primary decision (set on propagated decisions)
 *
 * // Contract handling (explicit extend decisions for defer)
 * @property {Array<{systemId: string, newEndYear: number, newEndMonth: number}>} contractExtensions
 */

/**
 * Returns the canonical map key for a (functionId, successorName) pair.
 *
 * @param {string} functionId
 * @param {string} successorName
 * @returns {string}
 *
 * @example
 * getDecisionKey('148', 'North Essex Unitary')
 * // => '148::North Essex Unitary'
 */
export function getDecisionKey(functionId, successorName) {
    return `${functionId}::${successorName}`;
}

/**
 * Creates a well-formed FunctionDecision object with a unique ID and timestamp.
 *
 * @param {Object} params
 * @param {string} params.functionId
 * @param {string} params.successorName
 * @param {'choose'|'procure'|'defer'} params.systemChoice
 * @param {string[]} [params.retainedSystemIds]
 * @param {Object|null} [params.procuredSystem]
 * @param {'none'|'disaggregate'|'maintain-shared'|'establish-shared'} [params.boundaryChoice]
 * @param {Array<{successorName: string, label: string}>} [params.disaggregationSplits]
 * @param {string[]} [params.sharedWithSuccessors]   -- successor names sharing the service
 * @param {string|null} [params.sharedServiceOrigin] -- decision key of primary decision (propagated only)
 * @param {Array<{systemId: string, newEndYear: number, newEndMonth: number}>} [params.contractExtensions]
 * @returns {FunctionDecision}
 */
export function createDecision({
    functionId,
    successorName,
    systemChoice,
    retainedSystemIds,
    procuredSystem,
    boundaryChoice,
    disaggregationSplits,
    sharedWithSuccessors,
    sharedServiceOrigin,
    contractExtensions
}) {
    const slug = successorName.replace(/\s+/g, '-').toLowerCase();
    return {
        id: `dec-${functionId}-${slug}-${Date.now()}`,
        functionId,
        successorName,
        timestamp: new Date().toISOString(),
        systemChoice,
        retainedSystemIds: retainedSystemIds || [],
        procuredSystem: procuredSystem || null,
        boundaryChoice: boundaryChoice || 'none',
        disaggregationSplits: disaggregationSplits || [],
        sharedWithSuccessors: sharedWithSuccessors || [],
        sharedServiceOrigin: sharedServiceOrigin || null,
        contractExtensions: contractExtensions || []
    };
}

/**
 * Validates a FunctionDecision object.
 *
 * @param {FunctionDecision} decision
 * @returns {{ valid: true } | { valid: false, errors: string[] }}
 */
export function validateDecision(decision) {
    const errors = [];

    if (!decision || typeof decision !== 'object') {
        return { valid: false, errors: ['Decision must be an object'] };
    }

    if (!decision.functionId || typeof decision.functionId !== 'string') {
        errors.push('functionId must be a non-empty string');
    }

    if (!decision.successorName || typeof decision.successorName !== 'string') {
        errors.push('successorName must be a non-empty string');
    }

    const validChoices = ['choose', 'procure', 'defer'];
    if (!validChoices.includes(decision.systemChoice)) {
        errors.push(`systemChoice must be one of: ${validChoices.join(', ')}`);
    }

    if (!Array.isArray(decision.retainedSystemIds)) {
        errors.push('retainedSystemIds must be an array');
    }

    if (decision.systemChoice === 'choose' && Array.isArray(decision.retainedSystemIds) && decision.retainedSystemIds.length === 0) {
        errors.push('choose decision must have at least one retainedSystemId');
    }

    if (decision.systemChoice === 'procure' && !decision.procuredSystem) {
        errors.push('procure decision must specify procuredSystem');
    }

    if (decision.procuredSystem !== null && decision.procuredSystem !== undefined) {
        if (typeof decision.procuredSystem !== 'object') {
            errors.push('procuredSystem must be an object or null');
        } else {
            if (!decision.procuredSystem.label) {
                errors.push('procuredSystem.label is required');
            }
        }
    }

    const validBoundaryChoices = ['none', 'disaggregate', 'maintain-shared', 'establish-shared'];
    if (decision.boundaryChoice && !validBoundaryChoices.includes(decision.boundaryChoice)) {
        errors.push(`boundaryChoice must be one of: ${validBoundaryChoices.join(', ')}`);
    }

    if (!Array.isArray(decision.disaggregationSplits)) {
        errors.push('disaggregationSplits must be an array');
    }

    if (decision.sharedWithSuccessors !== undefined && decision.sharedWithSuccessors !== null) {
        if (!Array.isArray(decision.sharedWithSuccessors)) {
            errors.push('sharedWithSuccessors must be an array of strings');
        } else if (decision.sharedWithSuccessors.some(s => typeof s !== 'string')) {
            errors.push('sharedWithSuccessors must contain only strings');
        }
    }

    if (decision.sharedServiceOrigin !== undefined && decision.sharedServiceOrigin !== null) {
        if (typeof decision.sharedServiceOrigin !== 'string') {
            errors.push('sharedServiceOrigin must be a string or null');
        }
    }

    if (!Array.isArray(decision.contractExtensions)) {
        errors.push('contractExtensions must be an array');
    }

    if (errors.length > 0) {
        return { valid: false, errors };
    }

    return { valid: true };
}
