import { describe, it, expect } from 'vitest';
import { generateTemplate } from '../src/features/template-generator.js';
import { convertXlsxToArchitecture } from '../src/features/template-converter.js';
import * as ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

// Mock globals
globalThis.ExcelJS = ExcelJS;
globalThis.XLSX = XLSX;

describe('E2E Excel Export & Import Sweep', () => {
    it('generates a template and imports it flawlessly without warnings', async () => {
        // 1. Generate the ExcelJS workbook
        const wb = generateTemplate();
        
        // 2. Write it to a buffer
        const buffer = await wb.xlsx.writeBuffer();
        
        // 3. Read it back using SheetJS (XLSX) as the browser would
        const parsedWb = XLSX.read(buffer, { type: 'buffer' });
        
        // 4. Run the converter
        const { architecture, warnings } = convertXlsxToArchitecture(parsedWb);
        
        // 5. Output warnings to console to help debugging if any
        if (warnings.length > 0) {
            console.log("Warnings:", warnings);
        }
        
        // 6. Assertions
        expect(architecture.nodes.length).toBeGreaterThan(0);
        expect(warnings).toEqual([]); // We expect NO warnings for a pristine template!
    });
});
