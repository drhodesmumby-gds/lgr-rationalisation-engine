/**
 * template-generator.js
 *
 * Generates a SheetJS workbook (Excel .xlsx) that councils can fill in
 * with their IT system architecture data, ready for import into the
 * LGR Rationalisation Engine via the template-converter.
 *
 * Exports:
 *   generateTemplate()   — Returns a SheetJS workbook object
 *   downloadTemplate()   — Generates and triggers browser download
 *
 * The global XLSX object (SheetJS) must be available at runtime (loaded from CDN).
 */

import { LGA_FUNCTIONS } from '../constants/lga-functions.js';
import { LGAM_CAPABILITIES } from '../constants/capabilities.js';
import { getRootCategories, getDescendantIds } from '../taxonomy.js';
import { DOMAIN_SHEET_NAMES } from './template-converter.js';

// -----------------------------------------------------------------------
// Example system rows per domain (col order matches domain sheet headers)
// ESD ID | Function | System Name | Vendor | Users | Annual Cost (£) |
// Contract End | Notice Period (months) | Portability | Data Partitioning |
// Cloud Hosted? | ERP? | Shared With | Support Model | Capabilities Provided
// -----------------------------------------------------------------------
const EXAMPLE_SYSTEMS = {
    'Health & Social Care':           ['148', 'Adult social care', 'Liquidlogic LAS', 'System C', 3500, 950000, '03/2028', 12, 'High', 'Segmented', 'Yes', 'No', '', 'Vendor-supported', ''],
    'Administration & Government':    ['116', 'Finance', 'SAP S/4HANA', 'SAP', 7000, 2300000, '03/2030', 18, 'Low', 'Monolithic', 'No', 'Yes', '', 'Vendor-supported', 'payments,workflow'],
    'Environmental Protection':       ['34', 'Environmental health', 'Idox Public Protection', 'Idox', 40, 60000, '06/2027', 6, 'Medium', 'Segmented', 'No', 'No', '', 'Vendor-supported', ''],
    'Planning & Building Control':    ['101', 'Development control', 'Idox Uniform', 'Idox', 25, 45000, '12/2027', 6, 'Medium', 'Segmented', 'Yes', 'No', '', 'Vendor-supported', ''],
    'Housing':                        ['66', 'Housing', 'NEC Housing', 'NEC', 80, 120000, '09/2028', 9, 'Low', 'Monolithic', 'No', 'No', '', 'Vendor-supported', ''],
    'Transport & Highways':           ['109', 'Highway maintenance', 'Confirm Highways', 'Confirm', 150, 280000, '06/2029', 12, 'Medium', 'Segmented', 'No', 'No', 'Other County Council', 'Vendor-supported', ''],
    'Advice & Benefits':              ['3', 'Benefits', 'NEC Revenues & Benefits', 'NEC', 200, 350000, '03/2028', 12, 'Low', 'Monolithic', 'No', 'No', '', 'Vendor-supported', ''],
    'Leisure & Culture':              ['76', 'Libraries', 'Koha LMS', 'In-House', 45, 30000, '12/2027', 3, 'High', 'Segmented', 'Yes', 'No', '', 'Community-supported', ''],
    'Business & Employment':          ['7', 'Business advice and support', 'CRM System', 'Microsoft', 60, 85000, '09/2028', 6, 'High', 'Segmented', 'Yes', 'No', '', 'Vendor-supported', ''],
};

// -----------------------------------------------------------------------
// Sheet descriptions for the Index sheet
// -----------------------------------------------------------------------
const SHEET_DESCRIPTIONS = {
    'Index':                    'This sheet — instructions and workbook guide',
    'Council Info':             'Your council name, tier, and financial status',
    'Health & Social Care':     'Systems for adult social care, children\'s services, public health',
    'Administration & Government': 'Finance, HR, ICT, democratic services, legal',
    'Environmental Protection': 'Environmental health, waste management, parks',
    'Planning & Building Control': 'Planning applications, building control, heritage',
    'Housing':                  'Council housing, homelessness, housing advice',
    'Transport & Highways':     'Highways, transport, road safety, parking',
    'Advice & Benefits':        'Revenues, benefits, welfare rights, grants',
    'Leisure & Culture':        'Libraries, leisure centres, arts, museums',
    'Business & Employment':    'Business support, regeneration, trading standards',
    'Dependencies':             'System-to-system capability dependencies',
    '_Lookups':                 'Validation lists (internal use)',
    '_SystemNames':             'System name registry (internal use)',
};

// -----------------------------------------------------------------------
// Domain column headers
// -----------------------------------------------------------------------
const DOMAIN_HEADERS = [
    'ESD ID', 'Function', 'System Name', 'Vendor', 'Users',
    'Annual Cost (£)', 'Contract End', 'Notice Period (months)',
    'Portability', 'Data Partitioning', 'Cloud Hosted?', 'ERP?',
    'Shared With', 'Support Model', 'Capabilities Provided',
];

// -----------------------------------------------------------------------
// Column widths
// -----------------------------------------------------------------------
const DOMAIN_COL_WIDTHS = [8, 30, 28, 18, 8, 14, 13, 10, 12, 15, 12, 6, 22, 20, 22];

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

/**
 * Build a SheetJS !cols array from an array of pixel widths (character units).
 */
function colWidths(widths) {
    return widths.map(wch => ({ wch }));
}

/**
 * Create a simple sheet from an array-of-arrays (aoa).
 * Attaches column widths if provided.
 */
function makeSheet(aoa, widths) {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    if (widths) {
        ws['!cols'] = colWidths(widths);
    }
    return ws;
}

/**
 * Get today's date as YYYY-MM-DD.
 */
function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

// -----------------------------------------------------------------------
// Sheet builders
// -----------------------------------------------------------------------

function buildIndexSheet() {
    const allSheetNames = ['Index', 'Council Info', ...DOMAIN_SHEET_NAMES, 'Dependencies', '_Lookups', '_SystemNames'];

    const aoa = [];

    // Row 1: Title
    aoa.push(['LGR Architecture Data Template']);
    aoa.push([]);

    // Rows 3-8: Instructions (6 bullet points)
    aoa.push(['Instructions:']);
    aoa.push(['• Fill in the "Council Info" sheet with your council\'s name, tier, and financial distress status.']);
    aoa.push(['• For each domain sheet, list the IT systems your council uses for each function.']);
    aoa.push(['• Leave function rows empty if you do not deliver that function — do not delete them.']);
    aoa.push(['• Add extra rows for the same function if multiple systems serve it.']);
    aoa.push(['• Use the "Dependencies" sheet to record system-to-system capability links.']);
    aoa.push(['• Do not rename, reorder, or delete any sheet. Do not change column headers.']);
    aoa.push([]);

    // Row 10: Sheet table header
    aoa.push(['Sheets in this workbook:']);
    aoa.push(['Sheet name', 'Description']);

    // Sheet rows
    for (const name of allSheetNames) {
        aoa.push([name, SHEET_DESCRIPTIONS[name] || '']);
    }

    aoa.push([]);
    aoa.push([`Template v1.0 — generated ${todayISO()}`]);

    return makeSheet(aoa, [35, 55]);
}

function buildCouncilInfoSheet() {
    const aoa = [
        ['Enter your council\'s details below. This identifies your architecture in the merged estate.'],
        [],
        ['Council Name', 'Council Tier', 'Financial Distress'],
        ['EXAMPLE — delete this row', 'District', 'No'],
        [],
    ];
    const ws = makeSheet(aoa, [30, 15, 18]);
    ws['!dataValidation'] = [
        { sqref: 'B4:B100', type: 'list', formula1: '"County,District,Borough,Unitary"' },
        { sqref: 'C4:C100', type: 'list', formula1: '"Yes,No"' },
    ];
    return ws;
}

/**
 * Build a domain sheet for a given root ESD category.
 *
 * @param {string} sheetName  - The DOMAIN_SHEET_NAMES entry for this root
 * @param {string} rootId     - ESD root category id
 * @returns {object}          - SheetJS worksheet
 */
function buildDomainSheet(sheetName, rootId) {
    // Collect all leaf/non-root functions in this domain
    const descendantIds = getDescendantIds(rootId);

    // Filter LGA_FUNCTIONS to get only direct-or-indirect descendants
    const functions = LGA_FUNCTIONS
        .filter(f => descendantIds.has(f.id))
        .sort((a, b) => a.label.localeCompare(b.label));

    const example = EXAMPLE_SYSTEMS[sheetName] || null;

    const aoa = [];

    // Row 1: Guidance
    aoa.push([`List the IT systems your council uses for each ${sheetName} function below. Leave functions empty if you don't deliver them. Add extra rows if multiple systems serve the same function.`]);

    // Row 2: Column headers
    aoa.push(DOMAIN_HEADERS);

    // Row 3: Example row
    if (example) {
        aoa.push(example);
    } else {
        // Fallback placeholder example
        const firstFn = functions[0];
        aoa.push([
            firstFn ? firstFn.id : '',
            firstFn ? firstFn.label : '',
            'Example System Name',
            'Example Vendor',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            'Vendor-supported',
            '',
        ]);
    }

    // Rows 4+: One row per function (ESD ID + label pre-filled, rest empty)
    for (const fn of functions) {
        aoa.push([fn.id, fn.label, '', '', '', '', '', '', '', '', '', '', '', '', '']);
    }

    const domainSheet = makeSheet(aoa, DOMAIN_COL_WIDTHS);
    domainSheet['!dataValidation'] = [
        { sqref: 'I3:I200', type: 'list', formula1: '"High,Medium,Low"' },
        { sqref: 'J3:J200', type: 'list', formula1: '"Segmented,Monolithic"' },
        { sqref: 'K3:K200', type: 'list', formula1: '"Yes,No"' },
        { sqref: 'L3:L200', type: 'list', formula1: '"Yes,No"' },
        { sqref: 'N3:N200', type: 'list', formula1: '"Vendor-supported,Community-supported,Unsupported"' },
    ];
    return domainSheet;
}

function buildDependenciesSheet() {
    const aoa = [
        ['List systems that depend on other systems for a specific capability. Ask yourself: if System B was removed or replaced, would System A stop working properly?'],
        ['System that depends', 'System it depends on', 'What for?', 'Match ✓'],
        ['Liquidlogic LAS', 'SAP S/4HANA', 'payments', '✓'],
        [],
    ];
    return makeSheet(aoa, [30, 30, 20, 12]);
}

function buildLookupsSheet() {
    const tierValues = ['County', 'District', 'Borough', 'Unitary'];
    const yesNo = ['Yes', 'No'];
    const portability = ['High', 'Medium', 'Low'];
    const dataPartitioning = ['Segmented', 'Monolithic'];
    const supportModels = ['Vendor-supported', 'Community-supported', 'Unsupported'];
    const capabilities = LGAM_CAPABILITIES.map(c => c.id);

    // Build headers row
    const headers = ['Tier', 'YesNo', 'Portability', 'DataPartitioning', 'SupportModel', 'Capabilities'];
    const aoa = [headers];

    // Find max rows needed
    const maxRows = Math.max(
        tierValues.length,
        yesNo.length,
        portability.length,
        dataPartitioning.length,
        supportModels.length,
        capabilities.length
    );

    for (let i = 0; i < maxRows; i++) {
        aoa.push([
            tierValues[i]       || '',
            yesNo[i]            || '',
            portability[i]      || '',
            dataPartitioning[i] || '',
            supportModels[i]    || '',
            capabilities[i]     || '',
        ]);
    }

    return makeSheet(aoa, [12, 8, 12, 16, 20, 16]);
}

function buildSystemNamesSheet() {
    const aoa = [
        ['System Names (auto-populated from domain sheets — used by Dependencies validation)'],
        ['Note: system names are matched at import time rather than via live Excel formulas.'],
    ];
    return makeSheet(aoa, [70]);
}

// -----------------------------------------------------------------------
// Root category → sheet name mapping
// -----------------------------------------------------------------------

function buildRootToSheetMap() {
    const ROOT_TO_SHEET = new Map();
    const roots = getRootCategories();
    roots.forEach(root => {
        // Match by comparing first significant word (case-insensitive)
        const rootWord = root.label.toLowerCase().split(/\s+/)[0];
        const match = DOMAIN_SHEET_NAMES.find(name => name.toLowerCase().startsWith(rootWord));
        if (match) ROOT_TO_SHEET.set(root.id, match);
    });
    return ROOT_TO_SHEET;
}

// -----------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------

/**
 * generateTemplate()
 *
 * Returns a SheetJS workbook containing 14 sheets ready for council data entry.
 * Requires the global XLSX object to be loaded (SheetJS CDN).
 */
export function generateTemplate() {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Index
    XLSX.utils.book_append_sheet(wb, buildIndexSheet(), 'Index');

    // Sheet 2: Council Info
    XLSX.utils.book_append_sheet(wb, buildCouncilInfoSheet(), 'Council Info');

    // Sheets 3-11: Domain sheets
    const rootToSheet = buildRootToSheetMap();

    // Append domain sheets in the canonical order of DOMAIN_SHEET_NAMES
    // so the tab order matches the index regardless of getRootCategories() order.
    const sheetToRoot = new Map();
    for (const [rootId, sheetName] of rootToSheet.entries()) {
        sheetToRoot.set(sheetName, rootId);
    }

    for (const sheetName of DOMAIN_SHEET_NAMES) {
        const rootId = sheetToRoot.get(sheetName);
        if (!rootId) continue; // no matching root category

        const descendantIds = getDescendantIds(rootId);
        if (descendantIds.size === 0) continue; // root has no child functions — skip

        XLSX.utils.book_append_sheet(wb, buildDomainSheet(sheetName, rootId), sheetName);
    }

    // Sheet 12: Dependencies
    XLSX.utils.book_append_sheet(wb, buildDependenciesSheet(), 'Dependencies');

    // Sheet 13: _Lookups
    XLSX.utils.book_append_sheet(wb, buildLookupsSheet(), '_Lookups');

    // Sheet 14: _SystemNames
    XLSX.utils.book_append_sheet(wb, buildSystemNamesSheet(), '_SystemNames');

    // Hide helper sheets
    wb.Workbook = wb.Workbook || {};
    wb.Workbook.Sheets = wb.Workbook.Sheets || [];
    while (wb.Workbook.Sheets.length < wb.SheetNames.length) {
        wb.Workbook.Sheets.push({});
    }
    const lookupsIdx = wb.SheetNames.indexOf('_Lookups');
    if (lookupsIdx >= 0) wb.Workbook.Sheets[lookupsIdx].Hidden = 1;
    const sysNamesIdx = wb.SheetNames.indexOf('_SystemNames');
    if (sysNamesIdx >= 0) wb.Workbook.Sheets[sysNamesIdx].Hidden = 1;

    return wb;
}

/**
 * downloadTemplate()
 *
 * Generates the template workbook and triggers a browser file download.
 * Requires the global XLSX object to be loaded (SheetJS CDN).
 */
export function downloadTemplate() {
    const wb = generateTemplate();
    XLSX.writeFile(wb, 'lgr-architecture-template.xlsx');
}
