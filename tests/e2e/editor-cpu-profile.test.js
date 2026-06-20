const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:8765/lgr-rationalisation-engine.html';
const EXAMPLE_DIR = path.resolve(__dirname, '../../examples/02-county-absorbs-districts');

test.setTimeout(60000); // Give it a minute

test('Record CPU Profile during rapid council switching', async ({ page }, testInfo) => {
    // 1. Setup CDP session for CPU Profiling
    const client = await page.context().newCDPSession(page);
    await client.send('Profiler.enable');
    
    // 2. Load page
    await page.goto(BASE_URL);

    // 3. Upload 2 councils
    const file1 = path.join(EXAMPLE_DIR, '01_Hartford_District_Architecture.xlsx');
    const file2 = path.join(EXAMPLE_DIR, '02_East_Hartford_Architecture.xlsx');
    
    // Upload file 1
    const fileChooserPromise1 = page.waitForEvent('filechooser');
    await page.locator('#btnOpenImportWizard').click();
    const fileChooser1 = await fileChooserPromise1;
    await fileChooser1.setFiles(file1);
    await page.locator('#btnImportNext').click();
    await page.waitForSelector('#preImportModal:not(.hidden)');
    await page.locator('#btnEditorImport').click();
    
    // Upload file 2
    const fileChooserPromise2 = page.waitForEvent('filechooser');
    await page.locator('#btnOpenImportWizard').click();
    const fileChooser2 = await fileChooserPromise2;
    await fileChooser2.setFiles(file2);
    await page.locator('#btnImportNext').click();
    await page.waitForSelector('#preImportModal:not(.hidden)');
    await page.locator('#btnEditorImport').click();

    // 4. Open Unified Editor for the first council
    await page.locator('button[onclick="openUnifiedEditor(0)"]').click();
    await page.waitForSelector('#unifiedEditorOverlay:not(.hidden)');

    // 5. Start Profiling
    console.log('Starting CPU Profile...');
    await client.send('Profiler.start');

    // 6. Rapidly switch councils 20 times
    console.log('Switching councils...');
    for (let i = 0; i < 20; i++) {
        const nextIdx = (i % 2 === 0) ? '1' : '0';
        
        // Wait for the select element to be ready
        const selectLocator = page.locator('[data-unified-editor] select[data-ue-action="switch-council"]');
        await selectLocator.waitFor({ state: 'attached' });
        
        // Use selectOption to trigger the change event
        await selectLocator.selectOption(nextIdx);
        
        // Small delay to allow setTimeout to run
        await page.waitForTimeout(50);
    }
    console.log('Finished switching councils.');

    // 7. Stop Profiling and save
    const { profile } = await client.send('Profiler.stop');
    const outPath = path.join(testInfo.outputDir, 'council-switch.cpuprofile');
    fs.mkdirSync(testInfo.outputDir, { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(profile));
    console.log(`Saved CPU profile to: ${outPath}`);
    
    // Attach to playwright report
    testInfo.attachments.push({
        name: 'CPU Profile',
        path: outPath,
        contentType: 'application/json'
    });

    expect(true).toBe(true);
});
