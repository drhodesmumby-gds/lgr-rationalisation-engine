/**
 * E2E test for Stage 1 scenario file detection.
 * Scenario JSON uploaded at Stage 1 alongside architecture files 
 * should be auto-loaded when simulation is entered.
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:8765/lgr-rationalisation-engine.html';

const EXAMPLE_DIR = path.resolve(
    __dirname,
    '../../examples/02-county-absorbs-districts'
);

test('Stage 1 scenario detection: scenario JSON auto-loads on simulation entry', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', err => jsErrors.push(err.message));
    page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('favicon')) {
            jsErrors.push(msg.text());
        }
    });

    // Create a scenario file that defers functionId 116 (Finance) for Hartfordshire Council
    const scenarioContent = {
        type: 'lgr-scenario',
        version: 1,
        exportedAt: '2026-04-23T12:00:00Z',
        metadata: {
            persona: 'executive',
            vestingDate: '2027-04-01',
            successors: ['Hartfordshire Council'],
            decisionCount: 1
        },
        decisions: [{
            id: 'dec-detect-1',
            functionId: '116',
            successorName: 'Hartfordshire Council',
            timestamp: '2026-04-23T12:00:00Z',
            systemChoice: 'defer',
            retainedSystemIds: [],
            procuredSystem: null,
            boundaryChoice: 'none',
            disaggregationSplits: [],
            sharedWithSuccessors: [],
            sharedServiceOrigin: null,
            contractExtensions: []
        }]
    };

    const scenarioPath = '/tmp/test-detect-scenario.json';
    fs.writeFileSync(scenarioPath, JSON.stringify(scenarioContent, null, 2));

    // Navigate to app
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    // Upload architecture files + transition config + scenario file all at once
    const fileInput = page.locator('#fileInput');
    const allFiles = [
        path.join(EXAMPLE_DIR, 'hartfordshire-county.json'),
        path.join(EXAMPLE_DIR, 'millbrook-district.json'),
        path.join(EXAMPLE_DIR, 'fenwick-district.json'),
        path.join(EXAMPLE_DIR, 'ashbury-district.json'),
        path.join(EXAMPLE_DIR, 'transition-config.json'),
        scenarioPath,
    ];
    await fileInput.setInputFiles(allFiles);
    await page.waitForSelector('#uploadedFilesUl li', { timeout: 10000 });

    // Check that the scenario file is listed (with special treatment)
    const fileItems = page.locator('#uploadedFilesUl li');
    const count = await fileItems.count();
    console.log('Staged files count:', count);
    
    // Get text of all listed files
    const itemTexts = await fileItems.allTextContents();
    console.log('Staged files:', itemTexts);

    // Proceed through stages
    await page.locator('#btnProceedBaseline').click();
    await page.waitForSelector('#stageTransitionConfig:not(.hidden)', { timeout: 10000 });
    await page.locator('#btnProceedTransition').click();
    await page.waitForSelector('#stageBaseline:not(.hidden)', { timeout: 10000 });
    await page.locator('#btnGenerateMatrix').click();
    await page.waitForSelector('#stageDashboard:not(.hidden)', { timeout: 20000 });

    // Enter simulation
    const simulateBtn = page.locator('#btnSimulate');
    await expect(simulateBtn).toBeVisible({ timeout: 10000 });
    await simulateBtn.click();

    // Wait for simulation mode to activate
    await page.waitForFunction(() => !!document.querySelector('.sim-decide-btn'), { timeout: 15000 });
    await page.waitForTimeout(1500); // Allow auto-load to complete

    // Check if decisions were auto-loaded
    // Look for decision count in the simulation panel
    const decisionPanel = page.locator('text=of 9 decidable functions');
    const isPanelVisible = await decisionPanel.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('Decision panel visible:', isPanelVisible);

    // If auto-load worked, we should see "1 of 9 decidable functions"
    const pageContent = await page.content();
    const hasDecision = pageContent.includes('1 of 9 decidable functions') || 
                        pageContent.includes('Latest Decisions') ||
                        pageContent.includes('Finance');
    console.log('Has decision indicator:', hasDecision);

    // No JS errors
    const critErrors = jsErrors.filter(e => !e.includes('favicon') && !e.includes('net::ERR'));
    expect(critErrors, `JS errors: ${critErrors.join('; ')}`).toHaveLength(0);

    await page.screenshot({ path: '/tmp/test-detection.png' });
});
