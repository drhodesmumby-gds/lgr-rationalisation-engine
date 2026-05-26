/**
 * template-generator.js
 *
 * Generates an ExcelJS workbook (Excel .xlsx) that councils can fill in
 * with their IT system architecture data, ready for import into the
 * LGR Rationalisation Engine via the template-converter.
 *
 * Exports:
 *   generateTemplate()   — Returns an ExcelJS workbook object (synchronous)
 *   downloadTemplate()   — Generates and triggers browser download (async)
 *
 * The global ExcelJS object must be available at runtime (loaded from CDN).
 */

import { LGA_FUNCTIONS } from '../constants/lga-functions.js';
import { LGAM_CAPABILITIES } from '../constants/capabilities.js';
import { getRootCategories, getDescendantIds } from '../taxonomy.js';
import { DOMAIN_SHEET_NAMES } from './template-converter.js';

// -----------------------------------------------------------------------
// Example system rows per domain (col order matches domain sheet headers)
// ESD ID | Function | System Name | Vendor | Users | Annual Cost (£) |
// Contract End | Notice Period (months) | Portability | Data Partitioning |
// Hosting | ERP? | Shared With | Support Model | Capabilities Provided
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
    'Definitions':              'What each dropdown field means — refer here if unsure',
    '_Lookups':                 'Validation lists (internal use)',
    '_SystemNames':             'System name registry (internal use)',
};

// -----------------------------------------------------------------------
// Domain column headers
// -----------------------------------------------------------------------
const DOMAIN_HEADERS = [
    'ESD ID', 'Function', 'System Name', 'Vendor', 'Users',
    'Annual Cost (£)', 'Contract End', 'Notice Period (months)',
    'Portability', 'Data Partitioning', 'Hosting', 'ERP?',
    'Shared With', 'Support Model', 'Capabilities Provided',
];

// -----------------------------------------------------------------------
// Column widths (character units)
// -----------------------------------------------------------------------
const DOMAIN_COL_WIDTHS = [8, 30, 28, 18, 8, 14, 13, 10, 12, 15, 12, 6, 22, 20, 22];

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

/**
 * Get today's date as YYYY-MM-DD.
 */
function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

/**
 * Apply column widths to a worksheet.
 * @param {object} sheet - ExcelJS worksheet
 * @param {number[]} widths - Array of column widths (1-indexed internally)
 */
function applyColumnWidths(sheet, widths) {
    widths.forEach((w, i) => {
        sheet.getColumn(i + 1).width = w;
    });
}

// -----------------------------------------------------------------------
// Sheet builders
// -----------------------------------------------------------------------

function buildIndexSheet(wb) {
    const sheet = wb.addWorksheet('Index');
    applyColumnWidths(sheet, [35, 55]);

    const allSheetNames = ['Council Info', ...DOMAIN_SHEET_NAMES, 'Dependencies', 'Definitions'];

    // Row 1: Title
    const titleRow = sheet.addRow(['LGR Architecture Data Template']);
    titleRow.font = { bold: true, size: 14 };
    sheet.mergeCells('A1:B1');

    // Row 2: blank
    sheet.addRow([]);

    // Rows 3-9: Instructions
    sheet.addRow(['Instructions:']);
    sheet.getCell('A3').font = { bold: true };
    sheet.addRow(['1. Fill in the "Council Info" sheet with your council\'s name, tier, and financial distress status.']);
    sheet.addRow(['2. For each domain sheet, list the IT systems your council uses for each function.']);
    sheet.addRow(['3. Leave function rows empty if you do not deliver that function — do not delete them.']);
    sheet.addRow(['4. Add extra rows for the same function if multiple systems serve it.']);
    sheet.addRow(['5. Use the "Dependencies" sheet to record system-to-system capability links.']);
    sheet.addRow(['6. Upload the completed file to the LGR Workspace Engine.']);

    // Row 10: blank
    sheet.addRow([]);

    // Row 11: Sheet table header
    const headerRow = sheet.addRow(['Sheet name', 'Description']);
    headerRow.font = { bold: true };

    // Sheet rows with hyperlinks
    for (const name of allSheetNames) {
        const row = sheet.addRow([name, SHEET_DESCRIPTIONS[name] || '']);
        const cell = row.getCell(1);
        cell.value = { text: name, hyperlink: `#'${name}'!A1` };
        cell.font = { color: { argb: 'FF1D70B8' }, underline: true };
    }

    // Footer
    sheet.addRow([]);
    sheet.addRow([`Template v1.0 — generated ${todayISO()}`]);

    return sheet;
}

function buildCouncilInfoSheet(wb) {
    const sheet = wb.addWorksheet('Council Info');
    applyColumnWidths(sheet, [30, 15, 18]);

    // Row 1: Guidance
    const guidanceRow = sheet.addRow(['Enter your council\'s details below. This identifies your architecture in the merged estate.']);
    guidanceRow.font = { italic: true };
    sheet.mergeCells('A1:C1');
    guidanceRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    // Row 2: blank
    sheet.addRow([]);

    // Row 3: Headers
    const headerRow = sheet.addRow(['Council Name', 'Council Tier', 'Financial Distress']);
    headerRow.font = { bold: true };

    // Row 4: Example
    const exampleRow = sheet.addRow(['EXAMPLE — delete this row', 'District', 'No']);
    exampleRow.font = { italic: true, color: { argb: 'FF666666' } };
    exampleRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
    });

    // Data validation on Tier (column B) and Financial Distress (column C) for rows 4-100
    for (let row = 4; row <= 100; row++) {
        sheet.getCell(`B${row}`).dataValidation = {
            type: 'list', allowBlank: true,
            formulae: ['"County,District,Borough,Unitary"']
        };
        sheet.getCell(`C${row}`).dataValidation = {
            type: 'list', allowBlank: true,
            formulae: ['"Yes,No"']
        };
    }

    return sheet;
}

/**
 * Build a domain sheet for a given root ESD category.
 *
 * @param {object} wb        - ExcelJS workbook
 * @param {string} sheetName - The DOMAIN_SHEET_NAMES entry for this root
 * @param {string} rootId    - ESD root category id
 * @returns {object}         - ExcelJS worksheet
 */
function buildDomainSheet(wb, sheetName, rootId) {
    const sheet = wb.addWorksheet(sheetName);
    applyColumnWidths(sheet, DOMAIN_COL_WIDTHS);

    // Collect all leaf/non-root functions in this domain
    const descendantIds = getDescendantIds(rootId);
    const functions = LGA_FUNCTIONS
        .filter(f => descendantIds.has(f.id))
        .sort((a, b) => a.label.localeCompare(b.label));

    const example = EXAMPLE_SYSTEMS[sheetName] || null;

    // Row 1: Guidance (merged across all columns, grey fill)
    const guidanceText = `List the IT systems your council uses for each ${sheetName} function below. Leave functions empty if you don't deliver them. Add extra rows if multiple systems serve the same function.`;
    const guidanceRow = sheet.addRow([guidanceText]);
    sheet.mergeCells(`A1:O1`);
    guidanceRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    guidanceRow.font = { italic: true };

    // Row 2: Column headers (bold)
    const headerRow = sheet.addRow(DOMAIN_HEADERS);
    headerRow.font = { bold: true };

    // Row 3: Example row (italic, grey fill, clearly marked)
    if (example) {
        const exRow = sheet.addRow(example);
        exRow.font = { italic: true, color: { argb: 'FF666666' } };
        exRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
        });
    } else {
        const firstFn = functions[0];
        const fallback = [
            firstFn ? firstFn.id : '', firstFn ? firstFn.label : '',
            'Example System Name', 'Example Vendor',
            '', '', '', '', '', '', '', '', '', 'Vendor-supported', '',
        ];
        const exRow = sheet.addRow(fallback);
        exRow.font = { italic: true, color: { argb: 'FF666666' } };
        exRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
        });
    }

    // Rows 4+: One row per function (ESD ID + label pre-filled, rest empty)
    for (const fn of functions) {
        sheet.addRow([fn.id, fn.label, '', '', '', '', '', '', '', '', '', '', '', '', '']);
    }

    // Add Excel Table (ListObject) for the data area — auto-expands as councils add rows
    const tableId = sheetName.replace(/[^a-zA-Z]/g, '');
    const lastDataRow = sheet.rowCount;
    sheet.addTable({
        name: tableId,
        ref: 'A2',
        headerRow: true,
        totalsRow: false,
        columns: DOMAIN_HEADERS.map(h => ({ name: h })),
        rows: Array.from({ length: lastDataRow - 2 }, (_, i) => {
            const row = sheet.getRow(i + 3);
            return DOMAIN_HEADERS.map((_, col) => row.getCell(col + 1).value || '');
        })
    });

    // Data validation with input messages (rows 3-200 for dropdown columns)
    const validations = {
        I: {
            type: 'list', allowBlank: true, formulae: ['"High,Medium,Low"'],
            showInputMessage: true, promptTitle: 'Data Portability',
            prompt: 'How easy is it to extract your data in bulk?\n\nHigh — Open APIs, standard formats (CSV/XML), vendor provides export tools. You could migrate data without vendor assistance.\n\nMedium — Some export capability exists but may require vendor support or have proprietary elements.\n\nLow — Proprietary format, no bulk export API, significant vendor lock-in. Migration requires vendor cooperation or reverse engineering.'
        },
        J: {
            type: 'list', allowBlank: true, formulae: ['"Segmented,Monolithic"'],
            showInputMessage: true, promptTitle: 'Data Partitioning',
            prompt: 'How is data organised within this system?\n\nSegmented — Data is logically separated (e.g., by service area, team, or geography). Can be split without major restructuring.\n\nMonolithic — Data is entangled across all areas the system serves. Splitting it would require ETL (Extract, Transform, Load) work and significant planning.'
        },
        K: {
            type: 'list', allowBlank: true, formulae: ['"Cloud,On-Premise,Partner-Hosted"'],
            showInputMessage: true, promptTitle: 'Hosting Model',
            prompt: 'Where is this system hosted?\n\nCloud — Vendor-hosted SaaS or cloud platform (Azure, AWS, etc.). Council has no infrastructure responsibility.\n\nOn-Premise — Hosted on council-owned servers or data centre.\n\nPartner-Hosted — Hosted by another council or shared service body.'
        },
        L: {
            type: 'list', allowBlank: true, formulae: ['"Yes,No"'],
            showInputMessage: true, promptTitle: 'ERP System?',
            prompt: 'Is this an Enterprise Resource Planning system?\n\nYes — A large integrated system spanning multiple functions (e.g., SAP, Oracle, Unit4). Typically handles finance, HR, procurement, etc. in one platform.\n\nNo — A system focused on a single function or service area.'
        },
        N: {
            type: 'list', allowBlank: true, formulae: ['"Vendor-supported,Community-supported,Unsupported"'],
            showInputMessage: true, promptTitle: 'Support Model',
            prompt: 'Who maintains and supports this system going forward?\n\nVendor-supported — Commercial vendor with SLA, support contract, and product roadmap.\n\nCommunity-supported — Maintained collaboratively (multi-council partnership, open source with active contributors, shared digital team).\n\nUnsupported — No active maintenance agreement. Original developer may have left, product may be end-of-life, or no SLA exists.'
        },
    };

    for (const [col, validation] of Object.entries(validations)) {
        for (let row = 3; row <= 200; row++) {
            sheet.getCell(`${col}${row}`).dataValidation = validation;
        }
    }

    // Cell notes on column headers (row 2)
    sheet.getCell('C2').note = 'The name of the IT system as your council knows it. Use the same name consistently (it must match in the Dependencies sheet).';
    sheet.getCell('D2').note = 'Software vendor name, or "In-House" if developed internally by the council.';
    sheet.getCell('E2').note = 'Approximate number of staff who regularly use this system.';
    sheet.getCell('F2').note = 'Annual licence, hosting, and support cost in pounds (number only, no £ symbol).';
    sheet.getCell('G2').note = 'When the current contract expires. Format: mm/yyyy (e.g., 03/2028).';
    sheet.getCell('H2').note = 'How many months notice you must give to exit the contract before it auto-renews.';
    sheet.getCell('M2').note = 'Other councils that share this same system instance with you. Comma-separated (e.g., "Westshire County, Easton District"). Leave blank if not shared.';
    sheet.getCell('O2').note = 'What capabilities does this system provide to OTHER systems? e.g., payments, SSO, forms, SMS. Only fill this if other systems depend on this one for a specific service.';

    return sheet;
}

function buildDependenciesSheet(wb) {
    const sheet = wb.addWorksheet('Dependencies');
    applyColumnWidths(sheet, [30, 30, 20, 14]);

    // Row 1: Guidance
    const guidanceRow = sheet.addRow(['List systems that depend on other systems for a specific capability. Ask yourself: if System B was removed or replaced, would System A stop working properly?']);
    sheet.mergeCells('A1:D1');
    guidanceRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    guidanceRow.font = { italic: true };

    // Row 2: Headers
    const headerRow = sheet.addRow(['System that depends', 'System it depends on', 'What for?', 'Match ✓']);
    headerRow.font = { bold: true };

    // Row 3: Example
    const exRow = sheet.addRow(['Liquidlogic LAS', 'SAP S/4HANA', 'payments', '']);
    exRow.font = { italic: true, color: { argb: 'FF666666' } };
    exRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
    });

    // Match formula: COUNTIF across all domain sheet system name columns (column C)
    const countifParts = DOMAIN_SHEET_NAMES.map(name => `COUNTIF('${name}'!C:C,A{row})`).join('+');
    const countifPartsB = DOMAIN_SHEET_NAMES.map(name => `COUNTIF('${name}'!C:C,B{row})`).join('+');
    for (let row = 3; row <= 100; row++) {
        const formula = `IF(AND(A${row}<>"",B${row}<>""),IF(AND(${countifParts.replace(/\{row\}/g, row)}>0,${countifPartsB.replace(/\{row\}/g, row)}>0),"✓","⚠ Not found"),"")`;
        sheet.getCell(`D${row}`).value = { formula };
    }

    // Cell notes on headers
    sheet.getCell('A2').note = 'The system that would break — use the EXACT same name you entered on the domain sheets.';
    sheet.getCell('B2').note = 'The system that provides the capability — use the EXACT same name from your domain sheets.';
    sheet.getCell('C2').note = 'What capability is consumed? e.g., payments, workflow, SSO, integration, SMS, forms.';
    sheet.getCell('D2').note = 'Auto-checks whether both system names match entries in your domain sheets. ✓ = found, ⚠ = not found (check spelling).';

    return sheet;
}

function buildDefinitionsSheet(wb) {
    const sheet = wb.addWorksheet('Definitions');
    applyColumnWidths(sheet, [22, 14, 60]);

    const titleRow = sheet.addRow(['Field Definitions']);
    titleRow.font = { bold: true, size: 13 };
    sheet.mergeCells('A1:C1');
    sheet.addRow([]);

    const definitions = [
        ['Data Portability', 'High', 'Open APIs available, standard data formats (CSV, XML, JSON). You could migrate data without vendor assistance. Vendor provides export tools and documentation.'],
        ['', 'Medium', 'Some export capability exists (e.g., report extracts, limited API) but may require vendor support or have proprietary elements. Migration is possible but needs planning.'],
        ['', 'Low', 'Proprietary data format with no bulk export API. Significant vendor lock-in. Migration requires vendor cooperation, reverse engineering, or expensive consultancy. High switching cost.'],
        [],
        ['Data Partitioning', 'Segmented', 'Data is logically separated by service area, team, or geography. If the system needed to be split across two new councils, the data could be divided without major restructuring.'],
        ['', 'Monolithic', 'Data is entangled across all areas the system serves. Users, records, and workflows are interleaved. Splitting would require ETL (Extract, Transform, Load) work — this is complex and time-consuming.'],
        [],
        ['Hosting', 'Cloud', 'Hosted by the vendor or in a cloud platform (Azure, AWS, Google Cloud). The council does not manage the servers. Includes SaaS, IaaS, and PaaS.'],
        ['', 'On-Premise', 'The system runs on servers owned or managed by the council. The council is responsible for infrastructure, patching, backups, and availability.'],
        ['', 'Partner-Hosted', 'Hosted by another council or shared service body. The council does not manage the infrastructure but depends on the partner for hosting continuity.'],
        [],
        ['ERP System?', 'Yes', 'An Enterprise Resource Planning system — a large integrated platform spanning multiple business functions (typically finance, HR, procurement, payroll). Examples: SAP, Oracle, Unit4, Microsoft Dynamics 365 Finance.'],
        ['', 'No', 'A system focused on a single function or service area. Most systems will be "No".'],
        [],
        ['Support Model', 'Vendor-supported', 'A commercial vendor provides a support contract, SLA, regular updates, and a product roadmap. If something breaks, you can raise a ticket and expect a response.'],
        ['', 'Community-supported', 'Maintained collaboratively — e.g., a multi-council partnership, an open source project with active contributors, or a shared digital team. Support comes from the community rather than a single vendor.'],
        ['', 'Unsupported', 'No active maintenance agreement exists. The original developer may have left, the product may be end-of-life, or no SLA is in place. If it breaks, there is no guaranteed route to fix it.'],
        [],
        ['Capabilities Provided', '(examples)', 'Only fill this if OTHER systems depend on this system for a specific service. Common capabilities:'],
        ['', 'payments', 'This system processes payments that other systems use (e.g., SAP providing payment processing to social care systems)'],
        ['', 'SSO', 'This system provides single sign-on authentication to other systems'],
        ['', 'forms', 'This system provides digital forms capability consumed by other systems'],
        ['', 'workflow', 'This system provides workflow/process automation consumed by other systems'],
        ['', 'SMS', 'This system provides SMS notification capability to other systems'],
        ['', 'integration', 'This system provides data integration/middleware services between other systems'],
    ];

    const headerRow = sheet.addRow(['Field', 'Value', 'What it means']);
    headerRow.font = { bold: true };
    headerRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    });

    for (const def of definitions) {
        if (!def || def.length === 0) { sheet.addRow([]); continue; }
        const row = sheet.addRow(def);
        if (def[0]) row.getCell(1).font = { bold: true };
    }

    return sheet;
}

function buildLookupsSheet(wb) {
    const sheet = wb.addWorksheet('_Lookups');
    sheet.state = 'hidden';

    const tierValues = ['County', 'District', 'Borough', 'Unitary'];
    const yesNo = ['Yes', 'No'];
    const portability = ['High', 'Medium', 'Low'];
    const dataPartitioning = ['Segmented', 'Monolithic'];
    const supportModels = ['Vendor-supported', 'Community-supported', 'Unsupported'];
    const capabilities = LGAM_CAPABILITIES.map(c => c.id);

    const headers = ['Tier', 'YesNo', 'Portability', 'DataPartitioning', 'SupportModel', 'Capabilities'];
    applyColumnWidths(sheet, [12, 8, 12, 16, 20, 16]);

    sheet.addRow(headers);
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };

    const maxRows = Math.max(
        tierValues.length,
        yesNo.length,
        portability.length,
        dataPartitioning.length,
        supportModels.length,
        capabilities.length,
    );

    for (let i = 0; i < maxRows; i++) {
        sheet.addRow([
            tierValues[i]       || '',
            yesNo[i]            || '',
            portability[i]      || '',
            dataPartitioning[i] || '',
            supportModels[i]    || '',
            capabilities[i]     || '',
        ]);
    }

    return sheet;
}

function buildSystemNamesSheet(wb) {
    const sheet = wb.addWorksheet('_SystemNames');
    sheet.state = 'hidden';
    applyColumnWidths(sheet, [70]);

    sheet.addRow(['System Names (auto-populated from domain sheets — used by Dependencies validation)']);
    sheet.addRow(['Note: system names are matched at import time rather than via live Excel formulas.']);

    return sheet;
}

// -----------------------------------------------------------------------
// Root category -> sheet name mapping
// -----------------------------------------------------------------------

function buildRootToSheetMap() {
    const ROOT_TO_SHEET = new Map();
    const roots = getRootCategories();
    roots.forEach(root => {
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
 * Returns an ExcelJS workbook containing 14 sheets ready for council data entry.
 * Requires the global ExcelJS object to be loaded (CDN).
 */
export function generateTemplate() {
    const wb = new ExcelJS.Workbook();

    // Sheet 1: Index
    buildIndexSheet(wb);

    // Sheet 2: Council Info
    buildCouncilInfoSheet(wb);

    // Sheets 3-11: Domain sheets
    const rootToSheet = buildRootToSheetMap();

    // Build reverse map for canonical ordering
    const sheetToRoot = new Map();
    for (const [rootId, sheetName] of rootToSheet.entries()) {
        sheetToRoot.set(sheetName, rootId);
    }

    for (const sheetName of DOMAIN_SHEET_NAMES) {
        const rootId = sheetToRoot.get(sheetName);
        if (!rootId) continue;

        const descendantIds = getDescendantIds(rootId);
        if (descendantIds.size === 0) continue;

        buildDomainSheet(wb, sheetName, rootId);
    }

    // Sheet 12: Dependencies
    buildDependenciesSheet(wb);

    // Sheet 13: Definitions
    buildDefinitionsSheet(wb);

    // Sheet 14: _Lookups (hidden)
    buildLookupsSheet(wb);

    // Sheet 15: _SystemNames (hidden)
    buildSystemNamesSheet(wb);

    return wb;
}

/**
 * downloadTemplate()
 *
 * Generates the template workbook and triggers a browser file download.
 * Requires the global ExcelJS object to be loaded (CDN).
 */
export async function downloadTemplate() {
    const wb = generateTemplate();
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lgr-architecture-template.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
