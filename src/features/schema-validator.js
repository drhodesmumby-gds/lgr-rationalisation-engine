/**
 * schema-validator.js
 *
 * Pure validation functions for LGR Rationalisation Engine input files.
 * Uses SCHEMA_DEFINITIONS as the single source of truth for enum values.
 */

import { SCHEMA_DEFINITIONS } from '../constants/schema-definitions.js';

// Pull enum lists from schema definitions (avoid hardcoding)
const ITSYSTEM_DEF = SCHEMA_DEFINITIONS.architecture.nodeTypes.ITSystem;

function getEnumFor(fieldName) {
    const field = ITSYSTEM_DEF.fields.find(f => f.name === fieldName);
    return field && field.enum ? field.enum : null;
}

const VALID_PORTABILITY    = getEnumFor('portability');
const VALID_PARTITIONING   = getEnumFor('dataPartitioning');
const VALID_SUPPORT_MODELS = getEnumFor('supportModel');
const VALID_NODE_TYPES     = ['Function', 'ITSystem'];

/**
 * Returns { valid, errors, warnings, info }
 */
function makeResult() {
    return { valid: true, errors: [], warnings: [], info: [] };
}

function addError(result, message, path) {
    result.errors.push(path ? { message, path } : { message });
    result.valid = false;
}

function addWarning(result, message, path) {
    result.warnings.push(path ? { message, path } : { message });
}

function addInfo(result, message) {
    result.info.push({ message });
}

/**
 * Case-insensitive enum check. Returns the correct-case value if a
 * case-insensitive match exists, otherwise null.
 */
function findCaseInsensitiveMatch(value, enumValues) {
    if (!enumValues) return null;
    const lower = String(value).toLowerCase();
    return enumValues.find(e => e.toLowerCase() === lower) || null;
}

// ---------------------------------------------------------------------------
// validateArchitecture
// ---------------------------------------------------------------------------

export function validateArchitecture(json) {
    const result = makeResult();

    // Null / undefined
    if (json === null || json === undefined) {
        addError(result, 'Input is null or undefined');
        return result;
    }

    // Not an object
    if (typeof json !== 'object' || Array.isArray(json)) {
        addError(result, 'Input is not a valid JSON object');
        return result;
    }

    // Required top-level fields
    if (!json.councilName) {
        addError(result, 'Missing required field: councilName', 'councilName');
    }

    if (!json.nodes || !Array.isArray(json.nodes)) {
        addError(result, 'Missing required field: nodes (must be an array)', 'nodes');
    }

    if (!json.edges || !Array.isArray(json.edges)) {
        addError(result, 'Missing required field: edges (must be an array)', 'edges');
    }

    // If nodes or edges are missing we cannot continue structural validation
    if (!result.valid && (result.errors.some(e => e.path === 'nodes') || result.errors.some(e => e.path === 'edges'))) {
        // Still add info if councilName is present
        if (json.councilName) addInfo(result, `Council: ${json.councilName}`);
        return result;
    }

    const nodes = Array.isArray(json.nodes) ? json.nodes : [];
    const edges = Array.isArray(json.edges) ? json.edges : [];

    // Info summary
    if (json.councilName) addInfo(result, `Council: ${json.councilName}`);

    // -----------------------------------------------------------------------
    // Node validation
    // -----------------------------------------------------------------------
    const nodeIds = new Set();
    const duplicateIds = new Set();
    const functionNodeIds = new Set();
    const systemNodeIds = new Set();

    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const nodeRef = node.id ? `'${node.id}'` : `at index ${i}`;

        // Required: id
        if (!node.id) {
            addError(result, `Node at index ${i}: missing required field 'id'`, `nodes[${i}]`);
        } else {
            if (nodeIds.has(node.id)) {
                duplicateIds.add(node.id);
            }
            nodeIds.add(node.id);
        }

        // Required: type
        if (!node.type) {
            addError(result, `Node at index ${i}: missing required field 'type'`, `nodes[${i}]`);
            continue; // can't do type-specific checks without type
        }

        if (!VALID_NODE_TYPES.includes(node.type)) {
            addError(result, `Node ${nodeRef}: invalid type '${node.type}' (must be 'Function' or 'ITSystem')`, `nodes[${i}].type`);
            continue;
        }

        if (node.type === 'Function') {
            if (node.id) functionNodeIds.add(node.id);
            if (!node.lgaFunctionId) {
                const label = node.label || node.id || `at index ${i}`;
                addError(result, `Function node '${label}': missing required field 'lgaFunctionId'`, `nodes[${i}].lgaFunctionId`);
            }
        }

        if (node.type === 'ITSystem') {
            if (node.id) systemNodeIds.add(node.id);

            if (!node.vendor) {
                const label = node.label || node.id || `at index ${i}`;
                addError(result, `ITSystem node '${label}': missing required field 'vendor'`, `nodes[${i}].vendor`);
            }

            // Enum warnings — portability, dataPartitioning, supportModel
            const enumChecks = [
                { field: 'portability', valid: VALID_PORTABILITY },
                { field: 'dataPartitioning', valid: VALID_PARTITIONING },
                { field: 'supportModel', valid: VALID_SUPPORT_MODELS }
            ];
            const nodeLabel = node.label || node.id || `at index ${i}`;
            for (const { field, valid } of enumChecks) {
                if (node[field] !== undefined && node[field] !== null && node[field] !== '') {
                    if (!valid.includes(node[field])) {
                        const suggestion = findCaseInsensitiveMatch(node[field], valid);
                        if (suggestion) {
                            addWarning(result, `Node '${nodeLabel}': ${field} value '${node[field]}' should be '${suggestion}'`, `nodes[${i}].${field}`);
                        } else {
                            addWarning(result, `Node '${nodeLabel}': ${field} value '${node[field]}' is not a recognised value (expected one of: ${valid.join(', ')})`, `nodes[${i}].${field}`);
                        }
                    }
                }
            }

            // Missing optional but valuable fields
            if (node.annualCost === undefined || node.annualCost === null) {
                addWarning(result, `Node '${nodeLabel}': missing 'annualCost' — cost analysis will be limited`, `nodes[${i}].annualCost`);
            }
            if (node.endYear === undefined || node.endYear === null) {
                addWarning(result, `Node '${nodeLabel}': missing 'endYear' — contract timeline will be incomplete`, `nodes[${i}].endYear`);
            }
        }
    }

    // Duplicate IDs
    for (const dupId of duplicateIds) {
        addError(result, `Duplicate node ID: '${dupId}'`);
    }

    // -----------------------------------------------------------------------
    // Edge validation
    // -----------------------------------------------------------------------
    const realizesTargets = new Set();   // system IDs that have a REALIZES edge pointing at them (as source)
    const realizedFunctions = new Set(); // function IDs that are the target of a REALIZES edge

    let realizesCount = 0;
    let consumesCount = 0;

    const nodeLabels = new Map();
    nodes.forEach(n => { if (n.id && n.label) nodeLabels.set(n.id, n.label); });

    for (let i = 0; i < edges.length; i++) {
        const edge = edges[i];
        const rel = edge.relationship || 'unknown';
        const srcLabel = nodeLabels.get(edge.source) || edge.source || '?';
        const tgtLabel = nodeLabels.get(edge.target) || edge.target || '?';
        const context = rel === 'REALIZES' ? `${srcLabel} → ${tgtLabel} (REALIZES)`
            : rel === 'CONSUMES_CAPABILITY' ? `${srcLabel} → ${tgtLabel} (CONSUMES_CAPABILITY)`
            : `${srcLabel} → ${tgtLabel} (${rel})`;

        if (!edge.source || !edge.target) {
            addError(result, `Edge ${i + 1}: missing 'source' or 'target' — ${context}. Check the Dependencies tab.`, `edges[${i}]`);
            continue;
        }

        if (!nodeIds.has(edge.source)) {
            addError(result, `Edge ${i + 1}: source '${srcLabel}' (id: ${edge.source}) does not match any node. Check Systems or Functions tab.`, `edges[${i}].source`);
        }

        if (!nodeIds.has(edge.target)) {
            addError(result, `Edge ${i + 1}: target '${tgtLabel}' (id: ${edge.target}) does not match any node. Check Systems or Functions tab.`, `edges[${i}].target`);
        }

        if (rel === 'REALIZES') {
            realizesCount++;
            realizesTargets.add(edge.source);
            realizedFunctions.add(edge.target);
        } else if (rel === 'CONSUMES_CAPABILITY') {
            consumesCount++;
            if (!edge.capabilities || !Array.isArray(edge.capabilities) || edge.capabilities.length === 0) {
                addWarning(result, `Dependency: ${srcLabel} → ${tgtLabel} has no capabilities listed. Add at least one (e.g., 'payments').`, `edges[${i}].capabilities`);
            }
        }
    }

    // Orphaned ITSystem warnings (no REALIZES edge with this system as source)
    for (const sysId of systemNodeIds) {
        if (!realizesTargets.has(sysId)) {
            const sysNode = nodes.find(n => n.id === sysId);
            const label = (sysNode && sysNode.label) ? sysNode.label : sysId;
            addWarning(result, `ITSystem node '${label}': no REALIZES edge — system is orphaned`);
        }
    }

    // Function nodes with no systems connected
    for (const fnId of functionNodeIds) {
        if (!realizedFunctions.has(fnId)) {
            const fnNode = nodes.find(n => n.id === fnId);
            const label = (fnNode && fnNode.label) ? fnNode.label : fnId;
            addWarning(result, `Function node '${label}': no systems realize this function`);
        }
    }

    // -----------------------------------------------------------------------
    // Info summary
    // -----------------------------------------------------------------------
    const fnCount  = functionNodeIds.size;
    const sysCount = systemNodeIds.size;

    addInfo(result, `${fnCount} Function node${fnCount !== 1 ? 's' : ''}`);
    addInfo(result, `${sysCount} ITSystem node${sysCount !== 1 ? 's' : ''}`);
    addInfo(result, `${edges.length} edge${edges.length !== 1 ? 's' : ''} (${realizesCount} REALIZES, ${consumesCount} CONSUMES_CAPABILITY)`);

    // Field completeness for ITSystem nodes
    const systemNodes = nodes.filter(n => n.type === 'ITSystem');
    const total = systemNodes.length;
    if (total > 0) {
        const withAnnualCost  = systemNodes.filter(n => n.annualCost !== undefined && n.annualCost !== null).length;
        const withEndYear     = systemNodes.filter(n => n.endYear !== undefined && n.endYear !== null).length;
        const withPortability = systemNodes.filter(n => n.portability !== undefined && n.portability !== null && n.portability !== '').length;
        addInfo(result, `Field completeness: annualCost ${withAnnualCost}/${total}, endYear ${withEndYear}/${total}, portability ${withPortability}/${total}`);
    }

    return result;
}

// ---------------------------------------------------------------------------
// validateTransitionConfig
// ---------------------------------------------------------------------------

export function validateTransitionConfig(json) {
    const result = makeResult();

    // Null / undefined
    if (json === null || json === undefined) {
        addError(result, 'Input is null or undefined');
        return result;
    }

    // Not an object
    if (typeof json !== 'object' || Array.isArray(json)) {
        addError(result, 'Input is not a valid JSON object');
        return result;
    }

    // vestingDate
    if (!json.vestingDate) {
        addError(result, 'Missing required field: vestingDate', 'vestingDate');
    } else {
        const dateVal = json.vestingDate;
        // Validate ISO date: YYYY-MM-DD, and that it parses to a real date
        const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
        const parsed = new Date(dateVal);
        if (!isoDateRegex.test(dateVal) || isNaN(parsed.getTime())) {
            addError(result, `vestingDate '${dateVal}' is not a valid date (expected YYYY-MM-DD)`, 'vestingDate');
        } else {
            // Warning if in the past
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (parsed < today) {
                addWarning(result, `vestingDate '${dateVal}' is in the past`);
            }
            addInfo(result, `Vesting date: ${dateVal}`);
        }
    }

    // successors
    if (!json.successors || !Array.isArray(json.successors)) {
        addError(result, 'Missing required field: successors (must be an array)', 'successors');
        return result;
    }

    if (json.successors.length === 0) {
        addError(result, 'successors array is empty — at least one successor required', 'successors');
    }

    let totalPredecessorAssignments = 0;

    for (let i = 0; i < json.successors.length; i++) {
        const s = json.successors[i];

        if (!s.name) {
            addError(result, `Successor at index ${i}: missing required field 'name'`, `successors[${i}].name`);
        }

        const hasFullPredecessors    = Array.isArray(s.fullPredecessors)    && s.fullPredecessors.length > 0;
        const hasPartialPredecessors = Array.isArray(s.partialPredecessors) && s.partialPredecessors.length > 0;

        if (!hasFullPredecessors && !hasPartialPredecessors) {
            if (s.name) {
                addWarning(result, `Successor '${s.name}': no predecessors assigned`);
            }
        }

        if (hasFullPredecessors)    totalPredecessorAssignments += s.fullPredecessors.length;
        if (hasPartialPredecessors) totalPredecessorAssignments += s.partialPredecessors.length;
    }

    // Info
    const successorCount = json.successors.length;
    addInfo(result, `${successorCount} successor authorit${successorCount !== 1 ? 'ies' : 'y'} defined`);
    addInfo(result, `${totalPredecessorAssignments} total predecessor assignment${totalPredecessorAssignments !== 1 ? 's' : ''}`);

    return result;
}
