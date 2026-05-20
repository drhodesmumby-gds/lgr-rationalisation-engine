# Data Preparation Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a downloadable Excel template and .xlsx converter to Stage 1, enabling councils to prepare architecture data in a familiar spreadsheet format.

**Architecture:** Two new feature modules (`template-generator.js` and `template-converter.js`) plus a minor change to the Stage 1 upload handler in `main.js`. SheetJS library loaded lazily from CDN (same pattern already used by `import-wizard.js`). The converter is a pure function accepting a SheetJS workbook and returning a standard council JSON object.

**Tech Stack:** SheetJS (xlsx library, CDN-loaded), ES modules, existing ESD taxonomy (`LGA_FUNCTIONS`, `getRootCategories`, `getRootCategoryId`, `getDescendantIds`)

---

### Task 1: Template Converter (Pure Function + Tests)

**Files:**
- Create: `src/features/template-converter.js`
- Create: `tests/properties/template-converter.property.test.js`

This is the core logic — a pure function that takes a SheetJS workbook object and returns a council architecture JSON. Built first because it's independently testable.

- [ ] **Step 1: Create `src/features/template-converter.js` with date parsing utility**

```js
import { LGA_FUNCTIONS } from '../constants/lga-functions.js';
import { getRootCategories, getRootCategoryId } from '../taxonomy.js';

const DOMAIN_SHEET_NAMES = [
    'Health & Social Care',
    'Administration & Government',
    'Environmental Protection',
    'Planning & Building Control',
    'Housing',
    'Transport & Highways',
    'Advice & Benefits',
    'Leisure & Culture',
    'Business & Employment'
];

export function parseContractEnd(value) {
    if (value == null || value === '') return { endYear: undefined, endMonth: undefined };

    if (typeof value === 'number') {
        const date = new Date(Math.round((value - 25569) * 86400 * 1000));
        return { endYear: date.getFullYear(), endMonth: date.getMonth() + 1 };
    }

    const str = String(value).trim();

    const mmYyyy = str.match(/^(\d{1,2})[\/\-](\d{4})$/);
    if (mmYyyy) return { endYear: parseInt(mmYyyy[2]), endMonth: parseInt(mmYyyy[1]) };

    const yyyyMm = str.match(/^(\d{4})[\/\-](\d{1,2})$/);
    if (yyyyMm) return { endYear: parseInt(yyyyMm[1]), endMonth: parseInt(yyyyMm[2]) };

    const mmYy = str.match(/^(\d{1,2})[\/\-](\d{2})$/);
    if (mmYy) {
        const year = parseInt(mmYy[2]) + 2000;
        return { endYear: year, endMonth: parseInt(mmYy[1]) };
    }

    return { endYear: undefined, endMonth: undefined };
}

export function convertXlsxToArchitecture(workbook) {
    const warnings = [];
    const nodes = [];
    const edges = [];
    const functionNodeIds = new Map();
    let systemIndex = 0;

    const councilSheet = workbook.Sheets['Council Info'];
    let councilName = 'Unknown Council';
    let tier = 'district';
    let financialDistress = false;

    if (councilSheet) {
        const data = XLSX.utils.sheet_to_json(councilSheet, { header: 1 });
        const headerRow = data.findIndex(r => r && r[0] && String(r[0]).toLowerCase().includes('council name'));
        if (headerRow >= 0 && data[headerRow + 1]) {
            const row = data[headerRow + 1];
            if (row[0] && !String(row[0]).toUpperCase().includes('EXAMPLE')) {
                councilName = String(row[0]).trim();
                tier = row[1] ? String(row[1]).trim().toLowerCase() : 'district';
                financialDistress = row[2] ? String(row[2]).trim().toLowerCase() === 'yes' : false;
            } else if (data[headerRow + 2]) {
                const row2 = data[headerRow + 2];
                councilName = row2[0] ? String(row2[0]).trim() : councilName;
                tier = row2[1] ? String(row2[1]).trim().toLowerCase() : 'district';
                financialDistress = row2[2] ? String(row2[2]).trim().toLowerCase() === 'yes' : false;
            }
        }
    }

    for (const sheetName of DOMAIN_SHEET_NAMES) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const headerRow = data.findIndex(r => r && r[0] !== undefined && (String(r[0]).toLowerCase().includes('esd') || String(r[0]).match(/^\d+$/)));
        const startRow = headerRow >= 0 ? headerRow : 3;

        for (let i = startRow; i < data.length; i++) {
            const row = data[i];
            if (!row || !row[2]) continue;

            const systemName = String(row[2]).trim();
            if (!systemName || systemName.toUpperCase().includes('EXAMPLE')) continue;

            const esdId = row[0] != null ? String(row[0]).trim() : null;
            if (!esdId) {
                warnings.push(`Row ${i + 1} in "${sheetName}" has a system but no ESD ID — skipped`);
                continue;
            }

            const fnId = `fn-${esdId}`;
            if (!functionNodeIds.has(esdId)) {
                const fnDef = LGA_FUNCTIONS.find(f => f.id === esdId);
                const label = fnDef ? fnDef.label : (row[1] ? String(row[1]).trim() : `Function ${esdId}`);
                nodes.push({ id: fnId, label, type: 'Function', lgaFunctionId: esdId });
                functionNodeIds.set(esdId, fnId);
            }

            systemIndex++;
            const sysId = `sys-${systemIndex}`;
            const { endYear, endMonth } = parseContractEnd(row[6]);

            const vendor = row[3] ? String(row[3]).trim() : undefined;
            const portability = row[8] ? String(row[8]).trim() : undefined;
            const dataPartitioning = row[9] ? String(row[9]).trim() : undefined;
            const isCloud = row[10] != null ? String(row[10]).trim().toLowerCase() === 'yes' : undefined;
            const isERP = row[11] != null ? String(row[11]).trim().toLowerCase() === 'yes' : undefined;
            const sharedWith = row[12] ? String(row[12]).split(',').map(s => s.trim()).filter(Boolean) : undefined;
            const supportModel = row[13] ? String(row[13]).trim().toLowerCase().replace(/\s+/g, '-') : undefined;
            const capabilityType = row[14] ? String(row[14]).split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : undefined;

            const sysNode = {
                id: sysId,
                label: systemName,
                type: 'ITSystem',
                owner: councilName,
                _templateName: systemName
            };
            if (vendor) sysNode.vendor = vendor;
            if (row[4] != null && row[4] !== '') sysNode.users = Number(row[4]);
            if (row[5] != null && row[5] !== '') { sysNode.annualCost = Number(row[5]); sysNode.cost = `£${Number(row[5]).toLocaleString()}/yr`; }
            if (endYear) sysNode.endYear = endYear;
            if (endMonth) sysNode.endMonth = endMonth;
            if (row[7] != null && row[7] !== '') sysNode.noticePeriod = Number(row[7]);
            if (portability && ['High', 'Medium', 'Low'].includes(portability)) sysNode.portability = portability;
            if (dataPartitioning && ['Segmented', 'Monolithic'].includes(dataPartitioning)) sysNode.dataPartitioning = dataPartitioning;
            if (isCloud !== undefined) sysNode.isCloud = isCloud;
            if (isERP !== undefined) sysNode.isERP = isERP;
            if (sharedWith && sharedWith.length > 0) sysNode.sharedWith = sharedWith;
            if (supportModel && ['vendor-supported', 'community-supported', 'unsupported'].includes(supportModel)) sysNode.supportModel = supportModel;
            if (capabilityType && capabilityType.length > 0) sysNode.capabilityType = capabilityType;

            nodes.push(sysNode);
            edges.push({ source: sysId, target: fnId, relationship: 'REALIZES' });
        }
    }

    const depSheet = workbook.Sheets['Dependencies'];
    if (depSheet) {
        const depData = XLSX.utils.sheet_to_json(depSheet, { header: 1 });
        const nameToId = new Map();
        nodes.filter(n => n.type === 'ITSystem').forEach(n => {
            nameToId.set(n._templateName.toLowerCase(), n.id);
        });

        for (let i = 1; i < depData.length; i++) {
            const row = depData[i];
            if (!row || !row[0] || !row[1]) continue;
            const depName = String(row[0]).trim().toLowerCase();
            const provName = String(row[1]).trim().toLowerCase();
            if (depName.includes('example')) continue;

            const sourceId = nameToId.get(depName);
            const targetId = nameToId.get(provName);

            if (!sourceId) { warnings.push(`Dependencies row ${i + 1}: "${row[0]}" not found in domain sheets`); continue; }
            if (!targetId) { warnings.push(`Dependencies row ${i + 1}: "${row[1]}" not found in domain sheets`); continue; }

            const capabilities = row[2] ? String(row[2]).split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : ['integration'];
            edges.push({ source: sourceId, target: targetId, relationship: 'CONSUMES_CAPABILITY', capabilities });
        }
    }

    nodes.filter(n => n.type === 'ITSystem').forEach(n => { delete n._templateName; });

    return {
        architecture: {
            councilName,
            councilMetadata: { tier, financialDistress },
            nodes,
            edges
        },
        warnings
    };
}
```

- [ ] **Step 2: Write property tests for the converter**

Create `tests/properties/template-converter.property.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { parseContractEnd, convertXlsxToArchitecture } from '../../src/features/template-converter.js';

describe('parseContractEnd', () => {
    it('parses mm/yyyy format', () => {
        expect(parseContractEnd('03/2028')).toEqual({ endYear: 2028, endMonth: 3 });
        expect(parseContractEnd('12/2030')).toEqual({ endYear: 2030, endMonth: 12 });
    });

    it('parses yyyy-mm format', () => {
        expect(parseContractEnd('2028-03')).toEqual({ endYear: 2028, endMonth: 3 });
    });

    it('parses mm/yy format', () => {
        expect(parseContractEnd('03/28')).toEqual({ endYear: 2028, endMonth: 3 });
    });

    it('handles Excel date serial numbers', () => {
        const result = parseContractEnd(46844);
        expect(result.endYear).toBe(2028);
        expect(result.endMonth).toBe(3);
    });

    it('returns undefined for empty/null values', () => {
        expect(parseContractEnd(null)).toEqual({ endYear: undefined, endMonth: undefined });
        expect(parseContractEnd('')).toEqual({ endYear: undefined, endMonth: undefined });
        expect(parseContractEnd(undefined)).toEqual({ endYear: undefined, endMonth: undefined });
    });
});

describe('convertXlsxToArchitecture', () => {
    function makeMockWorkbook(sheets) {
        const wb = { SheetNames: Object.keys(sheets), Sheets: {} };
        for (const [name, data] of Object.entries(sheets)) {
            wb.Sheets[name] = { __mockData: data };
        }
        return wb;
    }

    // Mock XLSX.utils.sheet_to_json to use __mockData
    globalThis.XLSX = {
        utils: {
            sheet_to_json: (sheet, opts) => sheet.__mockData || []
        }
    };

    it('extracts council info', () => {
        const wb = makeMockWorkbook({
            'Council Info': [
                ['Council Name', 'Council Tier', 'Financial Distress'],
                ['Test Borough', 'Borough', 'No']
            ]
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        expect(architecture.councilName).toBe('Test Borough');
        expect(architecture.councilMetadata.tier).toBe('borough');
        expect(architecture.councilMetadata.financialDistress).toBe(false);
    });

    it('builds function and system nodes from domain sheet', () => {
        const wb = makeMockWorkbook({
            'Council Info': [['Council Name'], ['Test Council']],
            'Health & Social Care': [
                ['ESD ID', 'Function', 'System Name', 'Vendor', 'Users', 'Annual Cost'],
                ['148', 'Adult Social Care', 'Liquidlogic', 'System C', 500, 200000]
            ]
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        const fns = architecture.nodes.filter(n => n.type === 'Function');
        const sys = architecture.nodes.filter(n => n.type === 'ITSystem');
        expect(fns.length).toBe(1);
        expect(fns[0].lgaFunctionId).toBe('148');
        expect(sys.length).toBe(1);
        expect(sys[0].label).toBe('Liquidlogic');
        expect(sys[0].vendor).toBe('System C');
        expect(sys[0].users).toBe(500);
    });

    it('creates REALIZES edges', () => {
        const wb = makeMockWorkbook({
            'Council Info': [['Council Name'], ['Test']],
            'Housing': [
                ['ESD ID', 'Function', 'System Name', 'Vendor'],
                ['66', 'Housing', 'NEC Housing', 'NEC']
            ]
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        const realizes = architecture.edges.filter(e => e.relationship === 'REALIZES');
        expect(realizes.length).toBe(1);
        expect(realizes[0].source).toMatch(/^sys-/);
        expect(realizes[0].target).toBe('fn-66');
    });

    it('parses dependencies into CONSUMES_CAPABILITY edges', () => {
        const wb = makeMockWorkbook({
            'Council Info': [['Council Name'], ['Test']],
            'Health & Social Care': [
                ['ESD ID', 'Function', 'System Name', 'Vendor'],
                ['148', 'Adult Social Care', 'Liquidlogic', 'System C'],
                ['116', 'Finance', 'SAP', 'SAP']
            ],
            'Dependencies': [
                ['System that depends', 'System it depends on', 'What for?'],
                ['Liquidlogic', 'SAP', 'payments']
            ]
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        const caps = architecture.edges.filter(e => e.relationship === 'CONSUMES_CAPABILITY');
        expect(caps.length).toBe(1);
        expect(caps[0].capabilities).toEqual(['payments']);
    });

    it('warns on unmatched dependency names', () => {
        const wb = makeMockWorkbook({
            'Council Info': [['Council Name'], ['Test']],
            'Health & Social Care': [
                ['ESD ID', 'Function', 'System Name', 'Vendor'],
                ['148', 'Adult Social Care', 'Liquidlogic', 'System C']
            ],
            'Dependencies': [
                ['System that depends', 'System it depends on', 'What for?'],
                ['Liquidlogic', 'NonExistent', 'payments']
            ]
        });
        const { warnings } = convertXlsxToArchitecture(wb);
        expect(warnings.length).toBe(1);
        expect(warnings[0]).toContain('NonExistent');
    });

    it('skips rows with EXAMPLE marker', () => {
        const wb = makeMockWorkbook({
            'Council Info': [['Council Name'], ['Test']],
            'Housing': [
                ['ESD ID', 'Function', 'System Name', 'Vendor'],
                ['66', 'Housing', 'EXAMPLE — delete this row', 'Example Vendor'],
                ['66', 'Housing', 'Real System', 'Real Vendor']
            ]
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        const sys = architecture.nodes.filter(n => n.type === 'ITSystem');
        expect(sys.length).toBe(1);
        expect(sys[0].label).toBe('Real System');
    });

    it('handles missing optional fields gracefully', () => {
        const wb = makeMockWorkbook({
            'Council Info': [['Council Name'], ['Test']],
            'Housing': [
                ['ESD ID', 'Function', 'System Name', 'Vendor'],
                ['66', 'Housing', 'Basic System', 'Vendor']
            ]
        });
        const { architecture } = convertXlsxToArchitecture(wb);
        const sys = architecture.nodes.find(n => n.type === 'ITSystem');
        expect(sys.label).toBe('Basic System');
        expect(sys.users).toBeUndefined();
        expect(sys.annualCost).toBeUndefined();
        expect(sys.portability).toBeUndefined();
    });
});
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: All tests pass (existing 244 + new converter tests)

- [ ] **Step 4: Commit**

```bash
git add src/features/template-converter.js tests/properties/template-converter.property.test.js
git commit -m "feat: add template-converter module with date parsing and xlsx→JSON conversion"
```

---

### Task 2: Template Generator Module

**Files:**
- Create: `src/features/template-generator.js`

This module generates the Excel workbook with all sheets, validation, formulas, and examples.

- [ ] **Step 1: Create `src/features/template-generator.js`**

```js
import { LGA_FUNCTIONS } from '../constants/lga-functions.js';
import { LGAM_CAPABILITIES } from '../constants/capabilities.js';
import { getRootCategories, getRootCategoryId, getDescendantIds } from '../taxonomy.js';

const DOMAIN_CONFIGS = [
    { sheetName: 'Health & Social Care', tableId: 'HealthSocialCare' },
    { sheetName: 'Administration & Government', tableId: 'AdminGov' },
    { sheetName: 'Environmental Protection', tableId: 'EnvironmentalProtection' },
    { sheetName: 'Planning & Building Control', tableId: 'PlanningBuildingControl' },
    { sheetName: 'Housing', tableId: 'Housing' },
    { sheetName: 'Transport & Highways', tableId: 'TransportHighways' },
    { sheetName: 'Advice & Benefits', tableId: 'AdviceBenefits' },
    { sheetName: 'Leisure & Culture', tableId: 'LeisureCulture' },
    { sheetName: 'Business & Employment', tableId: 'BusinessEmployment' }
];

const SYSTEM_COLUMNS = [
    'ESD ID', 'Function', 'System Name', 'Vendor', 'Users',
    'Annual Cost (£)', 'Contract End', 'Notice Period (months)',
    'Portability', 'Data Partitioning', 'Cloud Hosted?', 'ERP?',
    'Shared With', 'Support Model', 'Capabilities Provided'
];

const EXAMPLE_SYSTEMS = {
    'Health & Social Care': ['148', 'Adult social care', 'Liquidlogic LAS', 'System C', 3500, 950000, '03/2028', 12, 'High', 'Segmented', 'Yes', 'No', '', 'Vendor-supported', ''],
    'Administration & Government': ['116', 'Finance', 'SAP S/4HANA', 'SAP', 7000, 2300000, '03/2030', 18, 'Low', 'Monolithic', 'No', 'Yes', '', 'Vendor-supported', 'payments,workflow'],
    'Environmental Protection': ['34', 'Environmental health', 'Idox Public Protection', 'Idox', 40, 60000, '06/2027', 6, 'Medium', 'Segmented', 'No', 'No', '', 'Vendor-supported', ''],
    'Planning & Building Control': ['101', 'Development control', 'Idox Uniform', 'Idox', 25, 45000, '12/2027', 6, 'Medium', 'Segmented', 'Yes', 'No', '', 'Vendor-supported', ''],
    'Housing': ['66', 'Housing', 'NEC Housing', 'NEC', 80, 120000, '09/2028', 9, 'Low', 'Monolithic', 'No', 'No', '', 'Vendor-supported', ''],
    'Transport & Highways': ['109', 'Highway maintenance', 'Confirm Highways', 'Confirm', 150, 280000, '06/2029', 12, 'Medium', 'Segmented', 'No', 'No', 'Other County Council', 'Vendor-supported', ''],
    'Advice & Benefits': ['3', 'Benefits', 'NEC Revenues & Benefits', 'NEC', 200, 350000, '03/2028', 12, 'Low', 'Monolithic', 'No', 'No', '', 'Vendor-supported', ''],
    'Leisure & Culture': ['76', 'Libraries', 'Koha LMS', 'In-House', 45, 30000, '12/2027', 3, 'High', 'Segmented', 'Yes', 'No', '', 'Community-supported', ''],
    'Business & Employment': ['7', 'Business advice and support', 'CRM System', 'Microsoft', 60, 85000, '09/2028', 6, 'High', 'Segmented', 'Yes', 'No', '', 'Vendor-supported', '']
};

function getFunctionsForDomain(rootId) {
    const descendantIds = getDescendantIds(rootId);
    descendantIds.add(rootId);
    return LGA_FUNCTIONS
        .filter(f => descendantIds.has(f.id) && f.parentId !== null)
        .sort((a, b) => a.label.localeCompare(b.label));
}

export function generateTemplate() {
    if (typeof XLSX === 'undefined') {
        throw new Error('SheetJS (XLSX) library not loaded. Check your internet connection.');
    }

    const wb = XLSX.utils.book_new();
    const rootCategories = getRootCategories();
    const rootIdToConfig = new Map();
    rootCategories.forEach(root => {
        const config = DOMAIN_CONFIGS.find(d => d.sheetName.toLowerCase().includes(root.label.toLowerCase().split(' ')[0]));
        if (config) rootIdToConfig.set(root.id, config);
    });

    // 1. Index sheet
    const indexData = [
        ['LGR Architecture Data Template'],
        [''],
        ['How to use:'],
        ['1. Fill in the Council Info sheet first'],
        ['2. Work through each domain sheet — delete the example row, fill in your systems'],
        ['3. If you don\'t deliver a function, leave the row empty'],
        ['4. Multiple systems for the same function = add extra rows with the same function ID and name'],
        ['5. Fill in the Dependencies sheet for systems that rely on other systems'],
        ['6. Upload the completed .xlsx to the LGR Rationalisation Engine'],
        [''],
        ['Sheets in this workbook:'],
        ['Sheet', 'Description'],
        ['Council Info', 'Your council name, tier, and financial status'],
    ];
    DOMAIN_CONFIGS.forEach(d => {
        indexData.push([d.sheetName, `IT systems serving ${d.sheetName} functions`]);
    });
    indexData.push(['Dependencies', 'System-to-system capability dependencies']);
    indexData.push(['']);
    indexData.push([`Template v1.0 — generated ${new Date().toISOString().split('T')[0]}`]);

    const indexSheet = XLSX.utils.aoa_to_sheet(indexData);
    indexSheet['!cols'] = [{ wch: 35 }, { wch: 55 }];
    XLSX.utils.book_append_sheet(wb, indexSheet, 'Index');

    // 2. Council Info sheet
    const councilData = [
        ['Enter your council\'s details below. This identifies your architecture in the merged estate.'],
        [''],
        ['Council Name', 'Council Tier', 'Financial Distress'],
        ['EXAMPLE — delete this row', 'District', 'No'],
        ['', '', '']
    ];
    const councilSheet = XLSX.utils.aoa_to_sheet(councilData);
    councilSheet['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, councilSheet, 'Council Info');

    // 3-11. Domain sheets
    for (const root of rootCategories) {
        const config = rootIdToConfig.get(root.id);
        if (!config) continue;

        const functions = getFunctionsForDomain(root.id);
        if (functions.length === 0) continue;

        const sheetData = [
            [`List the IT systems your council uses for each ${config.sheetName} function below. Leave functions empty if you don't deliver them. Add extra rows if multiple systems serve the same function.`],
            SYSTEM_COLUMNS,
        ];

        const exampleRow = EXAMPLE_SYSTEMS[config.sheetName];
        if (exampleRow) {
            sheetData.push(exampleRow);
        }

        functions.forEach(fn => {
            sheetData.push([fn.id, fn.label, '', '', '', '', '', '', '', '', '', '', '', '', '']);
        });

        const domainSheet = XLSX.utils.aoa_to_sheet(sheetData);
        domainSheet['!cols'] = [
            { wch: 8 }, { wch: 30 }, { wch: 28 }, { wch: 18 }, { wch: 8 },
            { wch: 14 }, { wch: 13 }, { wch: 10 }, { wch: 12 }, { wch: 15 },
            { wch: 12 }, { wch: 6 }, { wch: 22 }, { wch: 20 }, { wch: 22 }
        ];
        XLSX.utils.book_append_sheet(wb, domainSheet, config.sheetName);
    }

    // 12. Dependencies sheet
    const depData = [
        ['List systems that depend on other systems for a specific capability. Ask yourself: if System B was removed or replaced, would System A stop working properly?'],
        ['System that depends', 'System it depends on', 'What for?', 'Match ✓'],
        ['Liquidlogic LAS', 'SAP S/4HANA', 'payments', '✓'],
        ['', '', '', '']
    ];
    const depSheet = XLSX.utils.aoa_to_sheet(depData);
    depSheet['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 20 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, depSheet, 'Dependencies');

    // 13. _Lookups sheet (hidden)
    const lookupsData = [
        ['Tier', 'YesNo', 'Portability', 'DataPartitioning', 'SupportModel', 'Capabilities'],
        ['County', 'Yes', 'High', 'Segmented', 'Vendor-supported', ...LGAM_CAPABILITIES.map(c => c.id)],
        ['District', 'No', 'Medium', 'Monolithic', 'Community-supported'],
        ['Borough', '', 'Low', '', 'Unsupported'],
        ['Unitary', '', '', '', '']
    ];
    const lookupsSheet = XLSX.utils.aoa_to_sheet(lookupsData);
    XLSX.utils.book_append_sheet(wb, lookupsSheet, '_Lookups');

    // 14. _SystemNames sheet (hidden)
    const sysNamesData = [['System Names (auto-populated from domain sheets)']];
    const sysNamesSheet = XLSX.utils.aoa_to_sheet(sysNamesData);
    XLSX.utils.book_append_sheet(wb, sysNamesSheet, '_SystemNames');

    return wb;
}

export function downloadTemplate() {
    const wb = generateTemplate();
    XLSX.writeFile(wb, `lgr-architecture-template.xlsx`);
}
```

- [ ] **Step 2: Run build to verify no import errors**

Run: `node build.js`
Expected: Build succeeds (module not yet imported from main.js, but syntax must be valid)

- [ ] **Step 3: Commit**

```bash
git add src/features/template-generator.js
git commit -m "feat: add template-generator module for Excel workbook creation"
```

---

### Task 3: Wire Up Stage 1 UI

**Files:**
- Modify: `src/index.html` (add Download Template button)
- Modify: `src/main.js` (add xlsx upload detection, wire download button)

- [ ] **Step 1: Add "Download Template" button to Stage 1 in `src/index.html`**

Find the upload area section (around line 158-164, the `<div id="uploadArea">` section). After the upload area `div` and before the "Or import from a different format" section, add:

```html
<div class="mt-4 flex items-center gap-4">
    <button id="btnDownloadTemplate" class="gds-btn-secondary px-4 py-2 text-sm font-bold" type="button">Download Template (.xlsx)</button>
    <span class="text-xs text-gray-500">Structured spreadsheet with guidance — fill offline, then upload here</span>
</div>
```

- [ ] **Step 2: Wire the download button and xlsx upload detection in `src/main.js`**

Add import at the top of main.js (with other feature imports):
```js
import { downloadTemplate } from './features/template-generator.js';
import { convertXlsxToArchitecture } from './features/template-converter.js';
```

After the file input event listener (in the upload handler around line 399), add xlsx detection. The current handler does `const text = await file.text()` then `JSON.parse(text)`. We need to intercept .xlsx files BEFORE the text parsing. Modify the upload loop:

In the `fileInput.addEventListener('change', async (e) => {` handler, at the start of the `for (const file of files)` loop, BEFORE `const text = await file.text()`, add:

```js
        // Detect xlsx files and route to template converter
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            const loadXlsx = () => new Promise((resolve, reject) => {
                if (typeof XLSX !== 'undefined') { resolve(); return; }
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18/dist/xlsx.full.min.js';
                script.onload = resolve;
                script.onerror = () => reject(new Error('Failed to load Excel library'));
                document.head.appendChild(script);
            });
            try {
                await loadXlsx();
                const arrayBuffer = await file.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                const { architecture, warnings } = convertXlsxToArchitecture(workbook);
                state.rawUploads.push(architecture);
                const li = document.createElement('li');
                li.className = 'flex items-center gap-3';
                const span = document.createElement('span');
                const warnText = warnings.length > 0 ? ` (${warnings.length} warning${warnings.length > 1 ? 's' : ''})` : '';
                span.textContent = `${architecture.councilName} (${architecture.nodes.filter(n => n.type === 'ITSystem').length} systems from template)${warnText}`;
                li.appendChild(span);
                if (warnings.length > 0) {
                    const warnBtn = document.createElement('button');
                    warnBtn.className = 'text-[#f47738] text-xs underline cursor-pointer bg-transparent border-none';
                    warnBtn.textContent = 'View warnings';
                    warnBtn.onclick = () => alert(warnings.join('\n'));
                    li.appendChild(warnBtn);
                }
                listUl.appendChild(li);
            } catch (err) {
                showNotification({ type: 'error', message: `Failed to parse template: ${err.message}` });
            }
            continue;
        }
```

Wire the download button (after existing upload event listeners, around line 397):
```js
document.getElementById('btnDownloadTemplate')?.addEventListener('click', async () => {
    if (typeof XLSX === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18/dist/xlsx.full.min.js';
        script.onload = () => { downloadTemplate(); };
        script.onerror = () => { showNotification({ type: 'error', message: 'Failed to load Excel library. Check your internet connection.' }); };
        document.head.appendChild(script);
    } else {
        downloadTemplate();
    }
});
```

- [ ] **Step 3: Verify the Proceed button still shows after xlsx upload**

The existing logic shows the "Proceed to Baselining" button when `state.rawUploads.length > 0`. Since we push to `state.rawUploads`, this should work automatically. Verify by checking the existing proceed-button logic.

- [ ] **Step 4: Run tests and build**

Run: `npm test && node build.js`
Expected: All tests pass, build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/index.html src/main.js
git commit -m "feat: wire template download button and xlsx upload handler in Stage 1"
```

---

### Task 4: Browser Verification

**Files:** None (testing only)

- [ ] **Step 1: Serve and test template download**

Run: `python3 -m http.server 8765` (if not already running)

Navigate to `http://localhost:8765/dist/lgr-rationalisation-engine.html`
Click "Download Template (.xlsx)"
Verify: an xlsx file downloads

- [ ] **Step 2: Inspect downloaded template**

Open the downloaded file in Excel/LibreOffice:
- Verify Index sheet with instructions and hyperlinks
- Verify Council Info sheet with example row
- Verify domain sheets have pre-populated ESD functions and example rows
- Verify Dependencies sheet with guidance and example
- Verify _Lookups sheet exists (may be visible — hiding requires additional SheetJS config)

- [ ] **Step 3: Fill in test data and upload**

In the template:
- Fill Council Info (name, tier)
- Add 2-3 systems in a domain sheet
- Add 1 dependency row
- Save and upload to the engine
- Verify: council appears in staged files with correct system count

- [ ] **Step 4: Build dist and commit final state**

```bash
node build.js
git add dist/lgr-rationalisation-engine.html
git commit -m "build: include template feature in dist output"
```

---

### Task 5: Refinements (Post-MVP)

**Files:**
- Modify: `src/features/template-generator.js` (data validation, sheet hiding)

These are enhancements that improve the template quality but aren't required for the core flow to work.

- [ ] **Step 1: Add data validation to domain sheets**

In `generateTemplate()`, after creating each domain sheet, add data validation for dropdown columns (I, J, K, L, N). SheetJS supports this via the `!dataValidation` property:

```js
// Add data validation (SheetJS format)
if (!domainSheet['!dataValidation']) domainSheet['!dataValidation'] = [];
const lastRow = sheetData.length;
domainSheet['!dataValidation'].push(
    { sqref: `I3:I${lastRow + 50}`, type: 'list', formula1: '"High,Medium,Low"' },
    { sqref: `J3:J${lastRow + 50}`, type: 'list', formula1: '"Segmented,Monolithic"' },
    { sqref: `K3:K${lastRow + 50}`, type: 'list', formula1: '"Yes,No"' },
    { sqref: `L3:L${lastRow + 50}`, type: 'list', formula1: '"Yes,No"' },
    { sqref: `N3:N${lastRow + 50}`, type: 'list', formula1: '"Vendor-supported,Community-supported,Unsupported"' }
);
```

Note: SheetJS Pro supports data validation fully. The community edition has limited support — test whether `!dataValidation` is written to the output. If not, this step can be deferred.

- [ ] **Step 2: Hide helper sheets**

After creating all sheets, set visibility on _Lookups and _SystemNames:
```js
wb.Workbook = wb.Workbook || {};
wb.Workbook.Sheets = wb.Workbook.Sheets || [];
const sheetIndex = wb.SheetNames.indexOf('_Lookups');
if (sheetIndex >= 0) {
    while (wb.Workbook.Sheets.length <= sheetIndex) wb.Workbook.Sheets.push({});
    wb.Workbook.Sheets[sheetIndex].Hidden = 1;
}
const sysIndex = wb.SheetNames.indexOf('_SystemNames');
if (sysIndex >= 0) {
    while (wb.Workbook.Sheets.length <= sysIndex) wb.Workbook.Sheets.push({});
    wb.Workbook.Sheets[sysIndex].Hidden = 1;
}
```

- [ ] **Step 3: Run build and commit**

```bash
node build.js
git add src/features/template-generator.js dist/lgr-rationalisation-engine.html
git commit -m "feat: add data validation and hidden helper sheets to template"
```
