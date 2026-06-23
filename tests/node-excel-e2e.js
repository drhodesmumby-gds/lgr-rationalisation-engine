import fs from 'fs';
import path from 'path';
import ExcelJS from '@protobi/exceljs';
import * as xlsx from 'xlsx';
import { generateTemplate } from '../src/features/template-generator.js';
import { convertXlsxToArchitecture } from '../src/features/template-converter.js';
import { validateArchitecture } from '../src/features/schema-validator.js';

// Inject globals
global.window = {};
global.document = { createElement: () => ({}) };
global.ExcelJS = ExcelJS;
global.XLSX = xlsx;

async function runTest() {
    console.log('Generating empty template...');
    const wb = generateTemplate();
    
    // We can't easily write and read back using just memory because template-converter uses SheetJS
    // Let's write it to disk
    const outPath = path.join(process.cwd(), 'tests', 'test-results', 'node-empty-template.xlsx');
    
    // Create test-results dir if needed
    if (!fs.existsSync(path.dirname(outPath))) {
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
    }
    
    await wb.xlsx.writeFile(outPath);
    console.log(`Saved template to ${outPath}`);
    
    console.log('Loading template with SheetJS (as the converter does)...');
    const buffer = fs.readFileSync(outPath);
    const data = new Uint8Array(buffer);
    const sheetJsWb = xlsx.read(data, { type: 'array' });
    
    console.log('Converting to architecture...');
    const result = convertXlsxToArchitecture(sheetJsWb);
    
    if (result.warnings && result.warnings.length > 0) {
        console.log('CONVERSION WARNINGS:', result.warnings);
    }
    
    console.log('Validating architecture against schema...');
    const validation = validateArchitecture(result.architecture);
    if (!validation.valid) {
        console.error('SCHEMA VALIDATION ERRORS:', validation.errors);
        process.exit(1);
    }
    
    console.log('✅ Empty template E2E node test PASSED!');
    
    // Now let's try a pre-populated sheet
    console.log('\n--- Pre-populating template ---');
    const popWb = new ExcelJS.Workbook();
    // Council Info
    const councilSheet = popWb.addWorksheet('Council Info');
    councilSheet.addRow(['Council Name*', 'Testshire County Council']);
    councilSheet.addRow(['Council Tier*', 'County']);
    councilSheet.addRow(['Financial Distress', 'No']);
    
    // Domain Sheet: Administration & Government
    const financeSheet = popWb.addWorksheet('Administration & Government');
    financeSheet.addRow(['Padding 1']);
    financeSheet.addRow(['Padding 2']);
    financeSheet.addRow(['Padding 3']);
    financeSheet.addRow([
        'ESD ID', 'Function', 'System Name*', 'Vendor*', 'Version', 'Users',
        'Annual Cost (£)', 'Contract End', 'Notice Period (months)',
        'Portability', 'Data Partitioning', 'Hosting', 'Hosting Partner', 'ERP?',
        'Shared With', 'Target Authorities', 'Support Model', 'Capabilities Provided'
    ]);
    financeSheet.addRow([
        'e.g. 123', 'e.g. Finance', 'e.g. Oracle', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
    ]);
    financeSheet.addRow([
        '123', 'Payroll', 'PayMaster 3000', 'TechCorp', 'v5', 150,
        50000, '12/2028', 6,
        'High', 'Segmented', 'Cloud', '', 'Yes',
        '', '', 'Vendor-supported', 'payments'
    ]);

    // Shared Capabilities Sheet
    const sharedSheet = popWb.addWorksheet('Shared Capabilities');
    sharedSheet.addRow(['Padding 1']);
    sharedSheet.addRow(['Padding 2']);
    sharedSheet.addRow(['Padding 3']);
    sharedSheet.addRow([
        'System Name*', 'Vendor*', 'Version', 'Users',
        'Annual Cost (£)', 'Contract End', 'Notice Period (months)',
        'Portability', 'Data Partitioning', 'Hosting', 'Hosting Partner', 'ERP?',
        'Shared With', 'Target Authorities', 'Support Model', 'Capabilities Provided'
    ]);
    sharedSheet.addRow([
        'Auth0', 'Okta', '', '',
        10000, '', '',
        '', '', 'Cloud', '', 'No',
        '', '', 'Vendor-supported', 'sso'
    ]);

    // Dependencies Sheet
    const depSheet = popWb.addWorksheet('Dependencies');
    depSheet.addRow(['Padding 1']);
    depSheet.addRow(['Padding 2']);
    depSheet.addRow(['Padding 3']);
    depSheet.addRow(['System that depends*', 'System it depends on*', 'What for?', 'Match ✓']);
    depSheet.addRow(['PayMaster 3000', 'Auth0', 'sso', '✓']);
    
    const popPath = path.join(process.cwd(), 'tests', 'test-results', 'node-prepopulated-template.xlsx');
    await popWb.xlsx.writeFile(popPath);
    
    console.log('Loading populated template...');
    const popBuffer = fs.readFileSync(popPath);
    const popData = new Uint8Array(popBuffer);
    const popSheetJsWb = xlsx.read(popData, { type: 'array' });
    
    const popResult = convertXlsxToArchitecture(popSheetJsWb);
    if (popResult.warnings && popResult.warnings.length > 0) {
        console.log('POPULATED CONVERSION WARNINGS:', popResult.warnings);
    }
    
    const popValidation = validateArchitecture(popResult.architecture);
    if (!popValidation.valid) {
        console.error('POPULATED SCHEMA VALIDATION ERRORS:', popValidation.errors);
        process.exit(1);
    }
    
    console.log(`Successfully mapped ${popResult.architecture.nodes.length} systems!`);
    console.log('Nodes parsed:', popResult.architecture.nodes.map(n => n.id));
    console.log('✅ Pre-populated template E2E node test PASSED!');
}

runTest().catch(console.error);
