/**
 * template-converter.js
 *
 * Converts a SheetJS workbook (produced from the LGR council architecture
 * Excel template) into the app's council architecture JSON schema.
 *
 * Exports:
 *   parseContractEnd(value)         — parses various date formats → {endYear, endMonth}
 *   convertXlsxToArchitecture(wb)   — converts workbook → {architecture, warnings}
 *
 * The global XLSX object (SheetJS) must be available at runtime (loaded from CDN).
 */

import { LGA_FUNCTIONS } from '../constants/lga-functions.js';

// -----------------------------------------------------------------------
// Domain sheet names (exact match required)
// -----------------------------------------------------------------------
export const DOMAIN_SHEET_NAMES = [
    'Health & Social Care',
    'Administration & Government',
    'Environmental Protection',
    'Planning & Building Control',
    'Housing',
    'Transport & Highways',
    'Advice & Benefits',
    'Leisure & Culture',
    'Business & Employment',
];

// -----------------------------------------------------------------------
// Column indices within a domain sheet row (0-based)
// -----------------------------------------------------------------------
const COL = {
    ESD_ID:             0,  // A
    FUNCTION:           1,  // B
    SYSTEM_NAME:        2,  // C
    VENDOR:             3,  // D
    VERSION:            4,  // E
    USERS:              5,  // F
    ANNUAL_COST:        6,  // G
    CONTRACT_END:       7,  // H
    NOTICE_PERIOD:      8,  // I
    PORTABILITY:        9,  // J
    DATA_PARTITIONING:  10, // K
    CLOUD_HOSTED:       11, // L
    HOSTING_PARTNER:    12, // M
    ERP:                13, // N
    SHARED_WITH:        14, // O
    TARGET_AUTHORITIES: 15, // P
    SUPPORT_MODEL:      16, // Q
    CAPABILITIES:       17, // R
};

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

/**
 * Excel date serial → JS Date.
 * Excel serial day 1 = 1900-01-01. Excel incorrectly treats 1900 as a leap
 * year (Lotus 1-2-3 compatibility), so serial ≤ 60 need adjustment.
 */
function excelSerialToDate(serial) {
    const MS_PER_DAY = 86400000;
    // Excel epoch is 1899-12-30 when adjusted for the Lotus bug
    const epoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(epoch.getTime() + serial * MS_PER_DAY);
}

/**
 * parseContractEnd(value)
 *
 * Accepts:
 *   - null / undefined / empty string → returns null
 *   - Excel numeric serial (number > 1000) → converts to date
 *   - "mm/yyyy" → {endYear, endMonth}
 *   - "yyyy-mm"  → {endYear, endMonth}
 *   - "mm/yy"   → {endYear (20xx), endMonth}
 *   - Any other string that can be parsed by Date.parse → best effort
 *
 * Returns { endYear: number, endMonth: number } or null.
 */
export function parseContractEnd(value) {
    if (value === null || value === undefined || value === '') return null;

    // Numeric — treat as Excel serial date
    if (typeof value === 'number') {
        if (value < 1) return null; // zero / negative serials meaningless
        const d = excelSerialToDate(Math.floor(value));
        if (isNaN(d.getTime())) return null;
        return { endYear: d.getUTCFullYear(), endMonth: d.getUTCMonth() + 1 };
    }

    const s = String(value).trim();
    if (!s) return null;

    // "mm/yyyy"
    const mmYyyy = s.match(/^(\d{1,2})\/(\d{4})$/);
    if (mmYyyy) {
        const month = parseInt(mmYyyy[1], 10);
        const year  = parseInt(mmYyyy[2], 10);
        if (month >= 1 && month <= 12) return { endYear: year, endMonth: month };
    }

    // "yyyy-mm" (or "yyyy-mm-dd" — take month from second segment)
    const yyyyMm = s.match(/^(\d{4})-(\d{1,2})/);
    if (yyyyMm) {
        const year  = parseInt(yyyyMm[1], 10);
        const month = parseInt(yyyyMm[2], 10);
        if (month >= 1 && month <= 12) return { endYear: year, endMonth: month };
    }

    // "mm/yy"
    const mmYy = s.match(/^(\d{1,2})\/(\d{2})$/);
    if (mmYy) {
        const month = parseInt(mmYy[1], 10);
        const year  = 2000 + parseInt(mmYy[2], 10);
        if (month >= 1 && month <= 12) return { endYear: year, endMonth: month };
    }

    // Fallback: try JS Date parse
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
        return { endYear: d.getFullYear(), endMonth: d.getMonth() + 1 };
    }

    return null;
}

// -----------------------------------------------------------------------
// Internal helpers for field cleaning
// -----------------------------------------------------------------------

function safeStr(v) {
    if (v === null || v === undefined) return '';
    return String(v).trim();
}

function safeInt(v) {
    if (v === null || v === undefined || v === '') return undefined;
    const n = typeof v === 'number' ? v : parseInt(String(v).replace(/[^0-9.-]/g, ''), 10);
    return isNaN(n) ? undefined : n;
}

function parseBool(v) {
    if (v === null || v === undefined || v === '') return undefined;
    const s = String(v).trim().toLowerCase();
    if (s === 'yes' || s === 'true' || s === '1') return true;
    if (s === 'no'  || s === 'false' || s === '0') return false;
    return undefined;
}

function parseCommaSeparated(v) {
    if (v === null || v === undefined || v === '') return [];
    return String(v).split(',').map(s => s.trim()).filter(Boolean);
}

function parsePortability(v) {
    const s = safeStr(v);
    if (['High', 'Medium', 'Low'].includes(s)) return s;
    // Case-insensitive match
    const match = ['High', 'Medium', 'Low'].find(p => p.toLowerCase() === s.toLowerCase());
    return match || undefined;
}

function parseDataPartitioning(v) {
    const s = safeStr(v);
    if (['Segmented', 'Monolithic'].includes(s)) return s;
    const match = ['Segmented', 'Monolithic'].find(p => p.toLowerCase() === s.toLowerCase());
    return match || undefined;
}

function parseSupportModel(v) {
    const s = safeStr(v).toLowerCase();
    if (s === 'vendor-supported' || s === 'vendor supported') return 'vendor-supported';
    if (s === 'community-supported' || s === 'community supported') return 'community-supported';
    if (s === 'unsupported') return 'unsupported';
    return undefined;
}

/**
 * Find the first data row index in a sheet's raw array-of-arrays.
 *
 * The template structure is:
 *   Row 0 — guidance text
 *   Row 1 — column headers (containing "ESD ID")
 *   Row 2 — example row
 *   Row 3+ — real data
 *
 * However we scan for the header row defensively.
 * Returns { headerRowIndex, dataStartIndex } or null if not found.
 */
function findHeaderRow(rows) {
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i];
        if (!Array.isArray(row)) continue;
        // Header row contains "ESD ID" in position 0 or a recognisable string
        const cell0 = safeStr(row[0]);
        const cell1 = safeStr(row[1]);
        if (
            cell0.toLowerCase().includes('esd') ||
            cell1.toLowerCase().includes('function') ||
            cell0.toLowerCase() === 'esd id'
        ) {
            return { headerRowIndex: i, dataStartIndex: i + 2 }; // skip header + example
        }
        // If cell 0 is a numeric ESD ID, this row is already data
        if (/^\d+$/.test(cell0)) {
            return { headerRowIndex: -1, dataStartIndex: i };
        }
    }
    return { headerRowIndex: -1, dataStartIndex: 0 };
}

// -----------------------------------------------------------------------
// Main converter
// -----------------------------------------------------------------------

/**
 * convertXlsxToArchitecture(workbook)
 *
 * Accepts a SheetJS workbook object.
 * Returns { architecture, warnings }.
 *
 * architecture — matches the council architecture JSON schema.
 * warnings     — array of human-readable strings describing issues found.
 */
export function convertXlsxToArchitecture(workbook) {
    const warnings = [];
    let councilName = 'Unknown Council';
    let councilTier = 'unitary';
    let financialDistress = false;

    // Build a lookup map for LGA function IDs → labels
    const lgaLookup = new Map(LGA_FUNCTIONS.map(f => [String(f.id), f.label]));

    // -----------------------------------------------------------------------
    // 1. Parse Council Info sheet
    // -----------------------------------------------------------------------
    const infoSheet = workbook.Sheets['Council Info'];
    if (infoSheet) {
        const rows = XLSX.utils.sheet_to_json(infoSheet, { header: 1 });
        // Scan all rows for key-value pairs.  Typically:
        //   Row with "Council Name" in col 0, value in col 1
        //   Row with "Tier" in col 0, value in col 1
        //   Row with "Financial Distress" in col 0, value in col 1
        for (const row of rows) {
            if (!Array.isArray(row) || row.length < 2) continue;
            const key = safeStr(row[0]).toLowerCase().replace(/\*/g, '').trim();
            const val = row[1];
            if (key.includes('council') && key.includes('name')) {
                councilName = safeStr(val) || councilName;
            } else if (key === 'tier' || key === 'council tier') {
                const t = safeStr(val).toLowerCase();
                if (['county', 'district', 'borough', 'unitary'].includes(t)) councilTier = t;
            } else if (key.includes('financial') && key.includes('distress')) {
                const b = parseBool(val);
                if (b !== undefined) financialDistress = b;
            }
        }
    } else {
        warnings.push('Sheet "Council Info" not found — using defaults.');
    }

    // -----------------------------------------------------------------------
    // 2. Parse domain sheets
    // -----------------------------------------------------------------------
    const nodes = [];
    const edges = [];
    const functionsSeen = new Set();   // lgaFunctionId → node already added
    const systemsByName = new Map();   // system label (lowercase) → node id, for Dependencies
    let sysCounter = 0;

    for (const sheetName of DOMAIN_SHEET_NAMES) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
            // Not all councils will have every domain — skip silently
            continue;
        }

        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const { dataStartIndex } = findHeaderRow(rows);

        for (let ri = dataStartIndex; ri < rows.length; ri++) {
            const row = rows[ri];
            if (!Array.isArray(row)) continue;

            const systemName = safeStr(row[COL.SYSTEM_NAME]);

            // Skip empty rows and EXAMPLE rows
            if (!systemName || systemName.toUpperCase().includes('EXAMPLE')) continue;

            const rawEsdId = safeStr(row[COL.ESD_ID]);
            const esdId = rawEsdId.replace(/\D/g, ''); // strip any non-numeric chars

            // Resolve function label — prefer template value, fall back to taxonomy
            let fnLabel = safeStr(row[COL.FUNCTION]);
            if (!fnLabel && esdId && lgaLookup.has(esdId)) {
                fnLabel = lgaLookup.get(esdId);
            }
            if (!fnLabel && esdId) {
                fnLabel = `Function ${esdId}`;
            }
            if (!fnLabel) {
                // Can't determine function — log warning and skip
                warnings.push(`Row ${ri + 1} in "${sheetName}": system "${systemName}" has no ESD ID or Function name — skipped.`);
                continue;
            }

            // Warn if ESD ID not in taxonomy (but still add node)
            if (esdId && !lgaLookup.has(esdId)) {
                warnings.push(`ESD ID "${esdId}" (system "${systemName}" in "${sheetName}") not found in LGA taxonomy.`);
            }

            // ---------------------------------------------------------------
            // Function node (deduplicated by ESD ID)
            // ---------------------------------------------------------------
            const fnNodeId = esdId ? `fn-${esdId}` : `fn-${sheetName.replace(/\W/g, '')}-${ri}`;
            const dedupeKey = esdId || fnNodeId;

            if (!functionsSeen.has(dedupeKey)) {
                functionsSeen.add(dedupeKey);
                const fnNode = {
                    id: fnNodeId,
                    label: fnLabel,
                    type: 'Function',
                    _sourceSheet: sheetName
                };
                if (esdId) fnNode.lgaFunctionId = esdId;
                nodes.push(fnNode);
            }

            // ---------------------------------------------------------------
            // ITSystem node
            // ---------------------------------------------------------------
            sysCounter++;
            const sysNodeId = `sys-${sysCounter}`;

            const sysNode = {
                id: sysNodeId,
                label: systemName,
                type: 'ITSystem',
            };

            const vendor = safeStr(row[COL.VENDOR]);
            if (vendor) sysNode.vendor = vendor;

            const version = safeStr(row[COL.VERSION]);
            if (version) sysNode.version = version;

            const users = safeInt(row[COL.USERS]);
            if (users !== undefined) sysNode.users = users;

            // Annual cost — strip currency symbols / commas
            const rawCost = row[COL.ANNUAL_COST];
            const costStr = safeStr(rawCost).replace(/[£$,\s]/g, '');
            const annualCost = costStr ? parseFloat(costStr) : NaN;
            if (!isNaN(annualCost) && annualCost > 0) {
                sysNode.annualCost = annualCost;
            }

            // Contract end
            const contractEndParsed = parseContractEnd(row[COL.CONTRACT_END]);
            if (contractEndParsed) {
                sysNode.endYear  = contractEndParsed.endYear;
                sysNode.endMonth = contractEndParsed.endMonth;
            }

            const noticePeriod = safeInt(row[COL.NOTICE_PERIOD]);
            if (noticePeriod !== undefined) sysNode.noticePeriod = noticePeriod;

            const portability = parsePortability(row[COL.PORTABILITY]);
            if (portability !== undefined) sysNode.portability = portability;

            const dataPartitioning = parseDataPartitioning(row[COL.DATA_PARTITIONING]);
            if (dataPartitioning !== undefined) sysNode.dataPartitioning = dataPartitioning;

            const hostingRaw = safeStr(row[COL.CLOUD_HOSTED]).toLowerCase().trim();
            if (hostingRaw) {
                if (['yes','true','cloud','saas','hosted'].includes(hostingRaw)) sysNode.hosting = 'cloud';
                else if (['no','false','on-prem','on-premise','local'].includes(hostingRaw)) sysNode.hosting = 'on-premise';
                else if (['partner','shared','shared service'].includes(hostingRaw)) sysNode.hosting = 'partner-hosted';
            }
            
            const hostingPartner = safeStr(row[COL.HOSTING_PARTNER]);
            if (hostingPartner) sysNode.hostingPartner = hostingPartner;

            const isERP = parseBool(row[COL.ERP]);
            if (isERP !== undefined) sysNode.isERP = isERP;

            const sharedWithArr = parseCommaSeparated(row[COL.SHARED_WITH]);
            if (sharedWithArr.length > 0) sysNode.sharedWith = sharedWithArr;
            
            const targetAuthArr = parseCommaSeparated(row[COL.TARGET_AUTHORITIES]);
            if (targetAuthArr.length > 0) sysNode.targetAuthorities = targetAuthArr;

            const supportModel = parseSupportModel(row[COL.SUPPORT_MODEL]);
            if (supportModel !== undefined) sysNode.supportModel = supportModel;

            const capabilitiesArr = parseCommaSeparated(row[COL.CAPABILITIES]).map(c => c.toLowerCase());
            if (capabilitiesArr.length > 0) sysNode.capabilityType = capabilitiesArr;

            nodes.push(sysNode);

            // Track for dependency resolution (case-insensitive)
            systemsByName.set(systemName.toLowerCase(), sysNodeId);

            // ---------------------------------------------------------------
            // REALIZES edge
            // ---------------------------------------------------------------
            edges.push({
                source: sysNodeId,
                target: fnNodeId,
                relationship: 'REALIZES',
            });
        }
    }

    // -----------------------------------------------------------------------
    // 2b. Parse Shared Capabilities sheet
    // -----------------------------------------------------------------------
    const sharedSheet = workbook.Sheets['Shared Capabilities'];
    if (sharedSheet) {
        const rows = XLSX.utils.sheet_to_json(sharedSheet, { header: 1 });
        // Guidance (0), Header (1), Example (2) -> Data starts at 3
        const dataStartIndex = 3;

        for (let ri = dataStartIndex; ri < rows.length; ri++) {
            const row = rows[ri];
            if (!Array.isArray(row)) continue;

            // Columns are shifted left by 2 because ESD_ID and FUNCTION are omitted
            const systemName = safeStr(row[COL.SYSTEM_NAME - 2]);
            if (!systemName || systemName.toUpperCase().includes('EXAMPLE')) continue;

            sysCounter++;
            const sysNodeId = `sys-${sysCounter}`;

            const sysNode = {
                id: sysNodeId,
                label: systemName,
                type: 'ITSystem',
                isIndependent: true
            };

            const vendor = safeStr(row[COL.VENDOR - 2]);
            if (vendor) sysNode.vendor = vendor;

            const version = safeStr(row[COL.VERSION - 2]);
            if (version) sysNode.version = version;

            const users = safeInt(row[COL.USERS - 2]);
            if (users !== undefined) sysNode.users = users;

            const rawCost = row[COL.ANNUAL_COST - 2];
            const costStr = safeStr(rawCost).replace(/[£$,\s]/g, '');
            const annualCost = costStr ? parseFloat(costStr) : NaN;
            if (!isNaN(annualCost) && annualCost > 0) {
                sysNode.annualCost = annualCost;
            }

            const contractEndParsed = parseContractEnd(row[COL.CONTRACT_END - 2]);
            if (contractEndParsed) {
                sysNode.endYear  = contractEndParsed.endYear;
                sysNode.endMonth = contractEndParsed.endMonth;
            }

            const noticePeriod = safeInt(row[COL.NOTICE_PERIOD - 2]);
            if (noticePeriod !== undefined) sysNode.noticePeriod = noticePeriod;

            const portability = parsePortability(row[COL.PORTABILITY - 2]);
            if (portability !== undefined) sysNode.portability = portability;

            const dataPartitioning = parseDataPartitioning(row[COL.DATA_PARTITIONING - 2]);
            if (dataPartitioning !== undefined) sysNode.dataPartitioning = dataPartitioning;

            const hostingRaw = safeStr(row[COL.CLOUD_HOSTED - 2]).toLowerCase().trim();
            if (hostingRaw) {
                if (['yes','true','cloud','saas','hosted'].includes(hostingRaw)) sysNode.hosting = 'cloud';
                else if (['no','false','on-prem','on-premise','local'].includes(hostingRaw)) sysNode.hosting = 'on-premise';
                else if (['partner','shared','shared service'].includes(hostingRaw)) sysNode.hosting = 'partner-hosted';
            }
            
            const hostingPartner = safeStr(row[COL.HOSTING_PARTNER - 2]);
            if (hostingPartner) sysNode.hostingPartner = hostingPartner;

            const isERP = parseBool(row[COL.ERP - 2]);
            if (isERP !== undefined) sysNode.isERP = isERP;

            const sharedWithArr = parseCommaSeparated(row[COL.SHARED_WITH - 2]);
            if (sharedWithArr.length > 0) sysNode.sharedWith = sharedWithArr;
            
            const targetAuthArr = parseCommaSeparated(row[COL.TARGET_AUTHORITIES - 2]);
            if (targetAuthArr.length > 0) sysNode.targetAuthorities = targetAuthArr;

            const supportModel = parseSupportModel(row[COL.SUPPORT_MODEL - 2]);
            if (supportModel !== undefined) sysNode.supportModel = supportModel;

            const capabilitiesArr = parseCommaSeparated(row[COL.CAPABILITIES - 2]).map(c => c.toLowerCase());
            if (capabilitiesArr.length > 0) sysNode.capabilityType = capabilitiesArr;

            nodes.push(sysNode);
            systemsByName.set(systemName.toLowerCase(), sysNodeId);
            
            // NO REALIZES edges for independent systems
        }
    }

    // -----------------------------------------------------------------------
    // 3. Parse Dependencies sheet
    // -----------------------------------------------------------------------
    const depsSheet = workbook.Sheets['Dependencies'];
    if (depsSheet) {
        const rows = XLSX.utils.sheet_to_json(depsSheet, { header: 1 });
        // Find where data starts (skip header / guidance rows)
        let depStart = 0;
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
            const cell0 = safeStr(rows[i]?.[0]).toLowerCase();
            if (cell0.includes('system that depends') || cell0.includes('dependent') || cell0.includes('depends on')) {
                depStart = i + 1;
                break;
            }
            if (cell0 && !cell0.includes('depend') && /\w/.test(cell0)) {
                // Looks like a data row already
                depStart = i;
                break;
            }
        }

        for (let ri = depStart; ri < rows.length; ri++) {
            const row = rows[ri];
            if (!Array.isArray(row)) continue;

            // Col 0: system that depends, Col 1: system it depends on, Col 2: what for
            const dependentName   = safeStr(row[0]).toLowerCase();
            const dependedOnName  = safeStr(row[1]).toLowerCase();
            const whatFor         = parseCommaSeparated(row[2]).map(c => c.toLowerCase());

            if (!dependentName || !dependedOnName) continue;

            const dependentId  = systemsByName.get(dependentName);
            const dependedOnId = systemsByName.get(dependedOnName);

            if (!dependentId) {
                warnings.push(`Dependencies: system "${safeStr(row[0])}" not found in domain or capabilities sheets — edge skipped.`);
                continue;
            }
            if (!dependedOnId) {
                warnings.push(`Dependencies: system "${safeStr(row[1])}" not found in domain or capabilities sheets — edge skipped.`);
                continue;
            }

            edges.push({
                source: dependentId,
                target: dependedOnId,
                relationship: 'CONSUMES_CAPABILITY',
                capabilities: whatFor.length > 0 ? whatFor : undefined,
            });
        }
    }

    // -----------------------------------------------------------------------
    // 4. Assemble and return
    // -----------------------------------------------------------------------
    const architecture = {
        councilName,
        councilMetadata: {
            tier: councilTier,
            financialDistress,
        },
        nodes,
        edges,
    };

    return { architecture, warnings };
}
