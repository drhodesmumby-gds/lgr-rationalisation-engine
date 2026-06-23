import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import ExcelJS from '@protobi/exceljs';

const testDir = path.join(__dirname, 'test-results');

test.describe('Excel Template E2E', () => {
    test.beforeAll(() => {
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
    });

    test('generate empty template from app and verify it imports flawlessly', async ({ page }) => {
        // Go to the app
        await page.goto('http://localhost:8765/lgr-rationalisation-engine.html');
        
        // Wait for page to be ready
        await page.waitForSelector('#btnDownloadTemplate');

        // Click "Download Template (.xlsx)" and intercept download
        const downloadPromise = page.waitForEvent('download');
        await page.click('#btnDownloadTemplate');
        const download = await downloadPromise;
        
        // Save the downloaded template
        const downloadPath = path.join(testDir, 'empty-template.xlsx');
        await download.saveAs(downloadPath);
        
        // Upload the downloaded template
        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.click('#btnUploadJson'); 
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(downloadPath);
        
        // Verify successful import (wait for editor to show up with NO validation errors)
        await page.waitForSelector('.function-card', { timeout: 5000 });
        
        // Count should be 0 because it's empty, but the page shouldn't have crashed!
        const functionCards = await page.locator('.function-card').count();
        expect(functionCards).toBe(0); // empty template means 0 mapped systems
        
        // Check that no error modal or text is shown
        const errorModal = await page.locator('.error-message').isVisible();
        expect(errorModal).toBeFalsy();
    });

    test('import a pre-populated Excel file with data', async ({ page }) => {
        // 1. Generate an Excel file using Node.js
        const wb = new ExcelJS.Workbook();
        
        // Council Info
        const councilSheet = wb.addWorksheet('Council Info');
        councilSheet.addRow(['Council Name*', 'Testshire County Council']);
        councilSheet.addRow(['Council Tier*', 'County']);
        councilSheet.addRow(['Financial Distress', 'No']);
        
        // Domain Sheet: Finance
        const financeSheet = wb.addWorksheet('Finance');
        // Add headers (mocking the exact headers from DOMAIN_HEADERS)
        financeSheet.addRow([
            'ESD ID', 'Function', 'System Name*', 'Vendor*', 'Version', 'Users',
            'Annual Cost (£)', 'Contract End', 'Notice Period (months)',
            'Portability', 'Data Partitioning', 'Hosting', 'Hosting Partner', 'ERP?',
            'Shared With', 'Target Authorities', 'Support Model', 'Capabilities Provided'
        ]);
        
        // Add a row of data
        financeSheet.addRow([
            '123', 'Payroll', 'PayMaster 3000', 'TechCorp', 'v5', 150,
            50000, '12/2028', 6,
            'High', 'Segmented', 'Cloud', '', 'Yes',
            '', '', 'Vendor-supported', 'payments'
        ]);

        // Shared Capabilities Sheet
        const sharedSheet = wb.addWorksheet('Shared Capabilities');
        sharedSheet.addRow(['Guidance text...']);
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
        const depSheet = wb.addWorksheet('Dependencies');
        depSheet.addRow(['Guidance text...']);
        depSheet.addRow(['System that depends*', 'System it depends on*', 'What for?', 'Match ✓']);
        depSheet.addRow(['PayMaster 3000', 'Auth0', 'sso', '✓']);
        
        // Write file
        const filePath = path.join(testDir, 'prepopulated-template.xlsx');
        await wb.xlsx.writeFile(filePath);

        // 2. Upload it in the browser
        await page.goto('http://localhost:8765/lgr-rationalisation-engine.html');
        await page.waitForSelector('#btnUploadJson');

        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.click('#btnUploadJson'); 
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(filePath);

        // 3. Verify it imported successfully
        await page.waitForSelector('.function-card', { timeout: 5000 });
        
        // We should see "PayMaster 3000" inside the editor view!
        const systemNodes = await page.locator('.system-node').count();
        expect(systemNodes).toBe(2); // Paymaster and Auth0

        // Check the names rendered in the DOM
        const textContent = await page.locator('.function-card').allTextContents();
        const joinedText = textContent.join(' ');
        expect(joinedText).toContain('PayMaster 3000');
        
        // Wait, Auth0 might not be in a function card because it's a Shared Capability.
        // It should be injected dynamically. We expect at least the PayMaster one.
    });
});
