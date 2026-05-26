/**
 * Property tests for template-converter.js
 *
 * Tests:
 *  - parseContractEnd: all date format variants
 *  - convertXlsxToArchitecture: council info, nodes, edges, dependencies,
 *    unmatched warnings, EXAMPLE skipping, missing optional fields
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';
import { parseContractEnd, convertXlsxToArchitecture, DOMAIN_SHEET_NAMES } from '../../src/features/template-converter.js';

// ---------------------------------------------------------------------------
// Mock the global XLSX object (SheetJS is loaded from CDN at runtime)
// ---------------------------------------------------------------------------
beforeAll(() => {
    globalThis.XLSX = {
        utils: {
            sheet_to_json: (sheet) => sheet.__mockData || [],
        },
    };
});

// ---------------------------------------------------------------------------
// Helpers for building mock workbooks
// ---------------------------------------------------------------------------

/**
 * Build a minimal mock workbook.
 *
 * @param {object} sheets  — keys are sheet names; values are arrays-of-arrays
 *                           (the raw row data returned by sheet_to_json).
 */
function mockWorkbook(sheets) {
    const SheetNames = Object.keys(sheets);
    const Sheets = {};
    for (const [name, data] of Object.entries(sheets)) {
        Sheets[name] = { __mockData: data };
    }
    return { SheetNames, Sheets };
}

/**
 * Build the guidance + header rows for a domain sheet, followed by the given
 * data rows.
 *
 * Template layout:
 *   row[0] — guidance text
 *   row[1] — column headers (ESD ID, Function, System Name, …)
 *   row[2] — EXAMPLE row (must be skipped)
 *   row[3+]— real data
 */
function domainSheetRows(dataRows) {
    return [
        ['This sheet contains IT systems for the domain.'],
        ['ESD ID', 'Function', 'System Name', 'Vendor', 'Users', 'Annual Cost',
         'Contract End', 'Notice Period', 'Portability', 'Data Partitioning',
         'Cloud Hosted?', 'ERP?', 'Shared With', 'Support Model', 'Capabilities Provided'],
        ['148', 'Adult Social Care', 'EXAMPLE SYSTEM', 'EXAMPLE Vendor', 100, '£100k',
         '03/2027', 12, 'High', 'Segmented', 'Yes', 'No', '', 'vendor-supported', 'payments'],
        ...dataRows,
    ];
}

/**
 * A single realistic domain data row.
 */
function makeRow({
    esdId = '148',
    fnLabel = 'Adult Social Care',
    systemName = 'Liquidlogic LAS',
    vendor = 'System C',
    users = 3500,
    annualCost = '£950000',
    contractEnd = '03/2027',
    noticePeriod = 12,
    portability = 'High',
    dataPartitioning = 'Segmented',
    cloud = 'Yes',
    erp = 'No',
    sharedWith = '',
    supportModel = 'vendor-supported',
    capabilities = 'payments',
} = {}) {
    return [esdId, fnLabel, systemName, vendor, users, annualCost, contractEnd,
            noticePeriod, portability, dataPartitioning, cloud, erp,
            sharedWith, supportModel, capabilities];
}

// ---------------------------------------------------------------------------
// ===== parseContractEnd tests =====
// ---------------------------------------------------------------------------

describe('parseContractEnd', () => {

    it('returns null for null', () => expect(parseContractEnd(null)).toBeNull());
    it('returns null for undefined', () => expect(parseContractEnd(undefined)).toBeNull());
    it('returns null for empty string', () => expect(parseContractEnd('')).toBeNull());

    it('parses mm/yyyy format', () => {
        expect(parseContractEnd('03/2027')).toEqual({ endYear: 2027, endMonth: 3 });
        expect(parseContractEnd('12/2030')).toEqual({ endYear: 2030, endMonth: 12 });
        expect(parseContractEnd('1/2025')).toEqual({ endYear: 2025, endMonth: 1 });
    });

    it('parses yyyy-mm format', () => {
        expect(parseContractEnd('2027-03')).toEqual({ endYear: 2027, endMonth: 3 });
        expect(parseContractEnd('2030-12')).toEqual({ endYear: 2030, endMonth: 12 });
    });

    it('parses yyyy-mm-dd format (ISO date string)', () => {
        const result = parseContractEnd('2027-03-31');
        expect(result).not.toBeNull();
        expect(result.endYear).toBe(2027);
        expect(result.endMonth).toBe(3);
    });

    it('parses mm/yy format with 20xx century assumption', () => {
        expect(parseContractEnd('03/27')).toEqual({ endYear: 2027, endMonth: 3 });
        expect(parseContractEnd('12/30')).toEqual({ endYear: 2030, endMonth: 12 });
    });

    it('parses Excel serial number (numeric)', () => {
        // Excel serial 46113 = 2026-03-31 (approx)
        const result = parseContractEnd(46113);
        expect(result).not.toBeNull();
        expect(result.endYear).toBeGreaterThanOrEqual(2025);
        expect(result.endMonth).toBeGreaterThanOrEqual(1);
        expect(result.endMonth).toBeLessThanOrEqual(12);
    });

    it('returns null for serial 0', () => {
        expect(parseContractEnd(0)).toBeNull();
    });

    it('returns null for negative serial', () => {
        expect(parseContractEnd(-5)).toBeNull();
    });

    it('returns null for unrecognised string', () => {
        expect(parseContractEnd('not-a-date')).toBeNull();
        expect(parseContractEnd('N/A')).toBeNull();
    });

    // Property: mm/yyyy always produces correct month and a sane year
    it('property — mm/yyyy always extracts valid month and year', () => {
        fc.assert(fc.property(
            fc.integer({ min: 1, max: 12 }),
            fc.integer({ min: 2020, max: 2040 }),
            (month, year) => {
                const s = `${String(month).padStart(2, '0')}/${year}`;
                const result = parseContractEnd(s);
                return result !== null
                    && result.endMonth === month
                    && result.endYear === year;
            }
        ));
    });

    // Property: yyyy-mm always extracts correct month and year
    it('property — yyyy-mm always extracts valid month and year', () => {
        fc.assert(fc.property(
            fc.integer({ min: 1, max: 12 }),
            fc.integer({ min: 2020, max: 2040 }),
            (month, year) => {
                const s = `${year}-${String(month).padStart(2, '0')}`;
                const result = parseContractEnd(s);
                return result !== null
                    && result.endMonth === month
                    && result.endYear === year;
            }
        ));
    });

    // Property: Excel serial → endMonth always between 1 and 12
    it('property — Excel serial always produces valid month', () => {
        fc.assert(fc.property(
            fc.integer({ min: 1, max: 60000 }),
            (serial) => {
                const result = parseContractEnd(serial);
                if (result === null) return true; // acceptable for edge serials
                return result.endMonth >= 1 && result.endMonth <= 12;
            }
        ));
    });
});

// ---------------------------------------------------------------------------
// ===== convertXlsxToArchitecture tests =====
// ---------------------------------------------------------------------------

describe('convertXlsxToArchitecture — council info', () => {

    it('extracts council name from Council Info sheet', () => {
        const wb = mockWorkbook({
            'Council Info': [
                ['Council Name', 'Northshire County Council'],
                ['Tier', 'county'],
                ['Financial Distress', 'No'],
            ],
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        expect(architecture.councilName).toBe('Northshire County Council');
    });

    it('extracts tier from Council Info sheet', () => {
        const wb = mockWorkbook({
            'Council Info': [
                ['Council Name', 'Easton District'],
                ['Tier', 'district'],
                ['Financial Distress', 'No'],
            ],
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        expect(architecture.councilMetadata.tier).toBe('district');
    });

    it('sets financialDistress to true when Yes', () => {
        const wb = mockWorkbook({
            'Council Info': [
                ['Council Name', 'Distressed Borough'],
                ['Tier', 'borough'],
                ['Financial Distress', 'Yes'],
            ],
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        expect(architecture.councilMetadata.financialDistress).toBe(true);
    });

    it('warns and uses defaults when Council Info sheet missing', () => {
        const wb = mockWorkbook({});
        const { warnings } = convertXlsxToArchitecture(wb);
        expect(warnings.some(w => w.includes('Council Info'))).toBe(true);
    });
});


describe('convertXlsxToArchitecture — nodes and edges from domain sheets', () => {

    it('creates a Function node and an ITSystem node for a valid row', () => {
        const wb = mockWorkbook({
            'Health & Social Care': domainSheetRows([
                makeRow({ esdId: '148', systemName: 'Liquidlogic LAS' }),
            ]),
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        const fnNode  = architecture.nodes.find(n => n.type === 'Function');
        const sysNode = architecture.nodes.find(n => n.type === 'ITSystem');
        expect(fnNode).toBeDefined();
        expect(fnNode.lgaFunctionId).toBe('148');
        expect(sysNode).toBeDefined();
        expect(sysNode.label).toBe('Liquidlogic LAS');
    });

    it('creates a REALIZES edge from system to function', () => {
        const wb = mockWorkbook({
            'Health & Social Care': domainSheetRows([
                makeRow({ esdId: '148', systemName: 'Liquidlogic LAS' }),
            ]),
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        const edge = architecture.edges.find(e => e.relationship === 'REALIZES');
        expect(edge).toBeDefined();
        const fnNode  = architecture.nodes.find(n => n.type === 'Function');
        const sysNode = architecture.nodes.find(n => n.type === 'ITSystem');
        expect(edge.source).toBe(sysNode.id);
        expect(edge.target).toBe(fnNode.id);
    });

    it('deduplicates Function nodes across multiple systems sharing the same ESD ID', () => {
        const wb = mockWorkbook({
            'Health & Social Care': domainSheetRows([
                makeRow({ esdId: '148', systemName: 'System A' }),
                makeRow({ esdId: '148', systemName: 'System B' }),
            ]),
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        const fnNodes = architecture.nodes.filter(n => n.type === 'Function' && n.lgaFunctionId === '148');
        expect(fnNodes).toHaveLength(1);
    });

    it('creates two REALIZES edges for two systems on the same function', () => {
        const wb = mockWorkbook({
            'Health & Social Care': domainSheetRows([
                makeRow({ esdId: '148', systemName: 'System A' }),
                makeRow({ esdId: '148', systemName: 'System B' }),
            ]),
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        const realizeEdges = architecture.edges.filter(e => e.relationship === 'REALIZES');
        expect(realizeEdges).toHaveLength(2);
    });

    it('skips rows where system name is empty', () => {
        const wb = mockWorkbook({
            'Health & Social Care': domainSheetRows([
                makeRow({ systemName: '' }),
            ]),
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        expect(architecture.nodes.filter(n => n.type === 'ITSystem')).toHaveLength(0);
    });

    it('skips rows containing EXAMPLE in system name', () => {
        const wb = mockWorkbook({
            'Health & Social Care': domainSheetRows([
                makeRow({ systemName: 'EXAMPLE SYSTEM' }),
                makeRow({ systemName: 'My Example System' }), // "EXAMPLE" is substring — also skipped
            ]),
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        // The EXAMPLE row in domainSheetRows header is also skipped, so 0 ITSystem nodes expected
        expect(architecture.nodes.filter(n => n.type === 'ITSystem')).toHaveLength(0);
    });

    it('processes systems from multiple domain sheets', () => {
        const wb = mockWorkbook({
            'Health & Social Care': domainSheetRows([
                makeRow({ esdId: '148', systemName: 'System Alpha' }),
            ]),
            'Housing': domainSheetRows([
                makeRow({ esdId: '66', fnLabel: 'Housing', systemName: 'System Beta' }),
            ]),
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        const sysNodes = architecture.nodes.filter(n => n.type === 'ITSystem');
        expect(sysNodes).toHaveLength(2);
    });

    it('omits optional fields when not provided', () => {
        const row = ['148', 'Adult Social Care', 'Minimal System',
                     '', '', '', '', '', '', '', '', '', '', '', ''];
        const wb = mockWorkbook({
            'Health & Social Care': domainSheetRows([row]),
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        const sysNode = architecture.nodes.find(n => n.type === 'ITSystem');
        expect(sysNode).toBeDefined();
        expect(sysNode.vendor).toBeUndefined();
        expect(sysNode.users).toBeUndefined();
        expect(sysNode.annualCost).toBeUndefined();
        expect(sysNode.portability).toBeUndefined();
        expect(sysNode.dataPartitioning).toBeUndefined();
        expect(sysNode.hosting).toBeUndefined();
        expect(sysNode.isERP).toBeUndefined();
    });

    it('sets hosting and isERP from Yes/No values', () => {
        const wb = mockWorkbook({
            'Health & Social Care': domainSheetRows([
                makeRow({ cloud: 'Yes', erp: 'Yes' }),
            ]),
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        const sysNode = architecture.nodes.find(n => n.type === 'ITSystem');
        expect(sysNode.hosting).toBe('cloud');
        expect(sysNode.isERP).toBe(true);
    });

    it('rejects invalid portability values', () => {
        const wb = mockWorkbook({
            'Health & Social Care': domainSheetRows([
                makeRow({ portability: 'Excellent' }),
            ]),
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        const sysNode = architecture.nodes.find(n => n.type === 'ITSystem');
        expect(sysNode.portability).toBeUndefined();
    });

    it('accepts valid portability values (case-insensitive)', () => {
        const wb = mockWorkbook({
            'Health & Social Care': domainSheetRows([
                makeRow({ portability: 'high' }),
            ]),
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        const sysNode = architecture.nodes.find(n => n.type === 'ITSystem');
        expect(sysNode.portability).toBe('High');
    });

    it('rejects invalid dataPartitioning values', () => {
        const wb = mockWorkbook({
            'Health & Social Care': domainSheetRows([
                makeRow({ dataPartitioning: 'Distributed' }),
            ]),
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        const sysNode = architecture.nodes.find(n => n.type === 'ITSystem');
        expect(sysNode.dataPartitioning).toBeUndefined();
    });

    it('accepts valid dataPartitioning values (case-insensitive)', () => {
        const wb = mockWorkbook({
            'Health & Social Care': domainSheetRows([
                makeRow({ dataPartitioning: 'monolithic' }),
            ]),
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        const sysNode = architecture.nodes.find(n => n.type === 'ITSystem');
        expect(sysNode.dataPartitioning).toBe('Monolithic');
    });

    it('rejects invalid support model values', () => {
        const wb = mockWorkbook({
            'Health & Social Care': domainSheetRows([
                makeRow({ supportModel: 'in-house' }),
            ]),
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        const sysNode = architecture.nodes.find(n => n.type === 'ITSystem');
        expect(sysNode.supportModel).toBeUndefined();
    });

    it('accepts valid support model values', () => {
        const wb = mockWorkbook({
            'Health & Social Care': domainSheetRows([
                makeRow({ supportModel: 'vendor-supported' }),
            ]),
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        const sysNode = architecture.nodes.find(n => n.type === 'ITSystem');
        expect(sysNode.supportModel).toBe('vendor-supported');
    });

    it('parses sharedWith comma-separated string to array', () => {
        const wb = mockWorkbook({
            'Health & Social Care': domainSheetRows([
                makeRow({ sharedWith: 'Council A, Council B' }),
            ]),
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        const sysNode = architecture.nodes.find(n => n.type === 'ITSystem');
        expect(sysNode.sharedWith).toEqual(['Council A', 'Council B']);
    });

    it('parses capabilities comma-separated string to lowercase array', () => {
        const wb = mockWorkbook({
            'Health & Social Care': domainSheetRows([
                makeRow({ capabilities: 'Payments, Forms, SMS' }),
            ]),
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        const sysNode = architecture.nodes.find(n => n.type === 'ITSystem');
        expect(sysNode.capabilityType).toEqual(['payments', 'forms', 'sms']);
    });

    it('warns when ESD ID is not in the LGA taxonomy', () => {
        const wb = mockWorkbook({
            'Health & Social Care': domainSheetRows([
                makeRow({ esdId: '9999', systemName: 'Unknown Function System' }),
            ]),
        });
        const { warnings } = convertXlsxToArchitecture(wb);
        expect(warnings.some(w => w.includes('9999'))).toBe(true);
    });

    it('parses contract end date from mm/yyyy string', () => {
        const wb = mockWorkbook({
            'Health & Social Care': domainSheetRows([
                makeRow({ contractEnd: '06/2028' }),
            ]),
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        const sysNode = architecture.nodes.find(n => n.type === 'ITSystem');
        expect(sysNode.endYear).toBe(2028);
        expect(sysNode.endMonth).toBe(6);
    });

    it('parses annual cost stripping currency symbols', () => {
        const wb = mockWorkbook({
            'Health & Social Care': domainSheetRows([
                makeRow({ annualCost: '£250,000' }),
            ]),
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        const sysNode = architecture.nodes.find(n => n.type === 'ITSystem');
        expect(sysNode.annualCost).toBe(250000);
    });

    it('assigns unique IDs to each system node', () => {
        const wb = mockWorkbook({
            'Health & Social Care': domainSheetRows([
                makeRow({ systemName: 'System A' }),
                makeRow({ systemName: 'System B' }),
                makeRow({ systemName: 'System C' }),
            ]),
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        const sysIds = architecture.nodes
            .filter(n => n.type === 'ITSystem')
            .map(n => n.id);
        expect(new Set(sysIds).size).toBe(sysIds.length);
    });
});


describe('convertXlsxToArchitecture — dependency sheet', () => {

    function workbookWithDeps(depRows) {
        return mockWorkbook({
            'Health & Social Care': domainSheetRows([
                makeRow({ esdId: '148', systemName: 'System Alpha' }),
                makeRow({ esdId: '148', systemName: 'System Beta' }),
            ]),
            'Dependencies': [
                ['System that depends', 'System it depends on', 'What for?'],
                ...depRows,
            ],
        });
    }

    it('creates a CONSUMES_CAPABILITY edge between matched systems', () => {
        const wb = workbookWithDeps([
            ['System Alpha', 'System Beta', 'payments'],
        ]);
        const { architecture } = convertXlsxToArchitecture(wb);
        const capEdge = architecture.edges.find(e => e.relationship === 'CONSUMES_CAPABILITY');
        expect(capEdge).toBeDefined();
    });

    it('sets capabilities array on CONSUMES_CAPABILITY edge', () => {
        const wb = workbookWithDeps([
            ['System Alpha', 'System Beta', 'payments, forms'],
        ]);
        const { architecture } = convertXlsxToArchitecture(wb);
        const capEdge = architecture.edges.find(e => e.relationship === 'CONSUMES_CAPABILITY');
        expect(capEdge.capabilities).toEqual(['payments', 'forms']);
    });

    it('warns when dependent system name not found', () => {
        const wb = workbookWithDeps([
            ['Nonexistent System', 'System Beta', 'payments'],
        ]);
        const { warnings } = convertXlsxToArchitecture(wb);
        expect(warnings.some(w => w.includes('Nonexistent System'))).toBe(true);
    });

    it('warns when depended-on system name not found', () => {
        const wb = workbookWithDeps([
            ['System Alpha', 'Ghost System', 'payments'],
        ]);
        const { warnings } = convertXlsxToArchitecture(wb);
        expect(warnings.some(w => w.includes('Ghost System'))).toBe(true);
    });

    it('matches system names case-insensitively', () => {
        const wb = workbookWithDeps([
            ['system alpha', 'SYSTEM BETA', 'sso'],
        ]);
        const { architecture } = convertXlsxToArchitecture(wb);
        const capEdge = architecture.edges.find(e => e.relationship === 'CONSUMES_CAPABILITY');
        expect(capEdge).toBeDefined();
    });

    it('skips dependency rows where both names are empty', () => {
        const wb = workbookWithDeps([
            ['', '', 'payments'],
        ]);
        const { architecture } = convertXlsxToArchitecture(wb);
        const capEdge = architecture.edges.find(e => e.relationship === 'CONSUMES_CAPABILITY');
        expect(capEdge).toBeUndefined();
    });
});


describe('convertXlsxToArchitecture — output shape invariants', () => {

    it('always returns an architecture object with required top-level keys', () => {
        const wb = mockWorkbook({});
        const { architecture } = convertXlsxToArchitecture(wb);
        expect(architecture).toHaveProperty('councilName');
        expect(architecture).toHaveProperty('councilMetadata');
        expect(architecture).toHaveProperty('nodes');
        expect(architecture).toHaveProperty('edges');
        expect(Array.isArray(architecture.nodes)).toBe(true);
        expect(Array.isArray(architecture.edges)).toBe(true);
    });

    it('always returns a warnings array', () => {
        const wb = mockWorkbook({});
        const { warnings } = convertXlsxToArchitecture(wb);
        expect(Array.isArray(warnings)).toBe(true);
    });

    it('property — nodes array contains only Function and ITSystem types', () => {
        // Build a workbook with multiple valid rows
        const dataRows = [
            makeRow({ esdId: '148', systemName: 'System 1' }),
            makeRow({ esdId: '66',  fnLabel: 'Housing', systemName: 'System 2' }),
            makeRow({ esdId: '3',   fnLabel: 'Benefits', systemName: 'System 3' }),
        ];
        const wb = mockWorkbook({
            'Health & Social Care': domainSheetRows(dataRows),
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        for (const node of architecture.nodes) {
            expect(['Function', 'ITSystem']).toContain(node.type);
        }
    });

    it('property — all REALIZES edges reference node IDs that exist', () => {
        const wb = mockWorkbook({
            'Health & Social Care': domainSheetRows([
                makeRow({ esdId: '148', systemName: 'System A' }),
                makeRow({ esdId: '148', systemName: 'System B' }),
            ]),
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        const nodeIds = new Set(architecture.nodes.map(n => n.id));
        for (const edge of architecture.edges.filter(e => e.relationship === 'REALIZES')) {
            expect(nodeIds.has(edge.source)).toBe(true);
            expect(nodeIds.has(edge.target)).toBe(true);
        }
    });

    it('property — every ITSystem node has a corresponding REALIZES edge', () => {
        const wb = mockWorkbook({
            'Health & Social Care': domainSheetRows([
                makeRow({ esdId: '148', systemName: 'Alpha' }),
                makeRow({ esdId: '148', systemName: 'Beta' }),
            ]),
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        const realizeTargets = new Set(
            architecture.edges
                .filter(e => e.relationship === 'REALIZES')
                .map(e => e.source)
        );
        for (const sysNode of architecture.nodes.filter(n => n.type === 'ITSystem')) {
            expect(realizeTargets.has(sysNode.id)).toBe(true);
        }
    });

    it('property — every Function node has at least one REALIZES edge pointing to it', () => {
        const wb = mockWorkbook({
            'Health & Social Care': domainSheetRows([
                makeRow({ esdId: '148', systemName: 'Alpha' }),
            ]),
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        const realizeTargetFns = new Set(
            architecture.edges
                .filter(e => e.relationship === 'REALIZES')
                .map(e => e.target)
        );
        for (const fnNode of architecture.nodes.filter(n => n.type === 'Function')) {
            expect(realizeTargetFns.has(fnNode.id)).toBe(true);
        }
    });
});
