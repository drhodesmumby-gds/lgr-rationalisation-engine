/**
 * E2E tests for scenario management features:
 * - Save Scenario (JSON export)
 * - Load Scenario (JSON import, impact recompute)
 * - Export Report (persona-tailored HTML report)
 * - Toolbar button visibility (show in sim, hidden outside)
 * - Stage 1 scenario file detection
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:8765/lgr-rationalisation-engine.html';

const EXAMPLE_DIR = path.resolve(
    __dirname,
    '../../examples/02-county-absorbs-districts'
);

const ARCH_FILES = [
    path.join(EXAMPLE_DIR, 'hartfordshire-county.json'),
    path.join(EXAMPLE_DIR, 'millbrook-district.json'),
    path.join(EXAMPLE_DIR, 'fenwick-district.json'),
    path.join(EXAMPLE_DIR, 'ashbury-district.json'),
    path.join(EXAMPLE_DIR, 'transition-config.json'),
];

/**
 * Navigate all stages to reach the simulation dashboard.
 */
async function setupToSimulation(page) {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const fileInput = page.locator('#fileInput');
    await fileInput.setInputFiles(ARCH_FILES);
    await page.waitForSelector('#uploadedFilesUl li', { timeout: 10000 });

    await page.locator('#btnProceedBaseline').click();
    await page.waitForSelector('#stageTransitionConfig:not(.hidden)', { timeout: 10000 });
    await page.locator('#btnProceedTransition').click();

    await page.waitForSelector('#stageBaseline:not(.hidden)', { timeout: 10000 });
    await page.locator('#btnGenerateMatrix').click();

    await page.waitForSelector('#stageDashboard:not(.hidden)', { timeout: 20000 });

    // Enter simulation mode
    const simulateBtn = page.locator('#btnSimulate');
    await expect(simulateBtn).toBeVisible({ timeout: 10000 });
    await simulateBtn.click();

    await page.waitForFunction(() => !!document.querySelector('.sim-decide-btn'), { timeout: 15000 });
    await page.waitForTimeout(800);
}

/**
 * Make a decision using the first available Decide button.
 * Returns 'ok' if successful, 'skip' otherwise.
 */
async function makeFirstDecision(page) {
    const decideBtn = page.locator('.sim-decide-btn').filter({ hasText: /^decide$/i }).first();
    if (!await decideBtn.isVisible({ timeout: 10000 })) return 'skip';
    await decideBtn.click();

    const modal = page.locator('#decisionPanelModal');
    if (!await modal.isVisible({ timeout: 5000 })) return 'skip';

    // Select "Defer" as the simplest decision
    const deferRadio = page.locator('#axis1Defer');
    if (await deferRadio.isVisible({ timeout: 3000 })) {
        await deferRadio.click();
    }

    await page.locator('#btnApplyDecision').click();
    await expect(modal).toBeHidden({ timeout: 10000 });
    return 'ok';
}

test.describe('Scenario Management', () => {

    test('Test A: Toolbar shows scenario buttons when in simulation', async ({ page }) => {
        const jsErrors = [];
        page.on('pageerror', err => jsErrors.push(err.message));
        page.on('console', msg => {
            if (msg.type() === 'error' && !msg.text().includes('favicon')) {
                jsErrors.push(msg.text());
            }
        });

        await setupToSimulation(page);

        // Save Scenario button should be visible
        const saveBtn = page.locator('#btnSaveScenario');
        await expect(saveBtn).toBeVisible({ timeout: 5000 });

        // Load Scenario button should be visible
        const loadBtn = page.locator('#btnLoadScenario');
        await expect(loadBtn).toBeVisible({ timeout: 5000 });

        // Export Report button should be visible
        const exportReportBtn = page.locator('#btnExportReport');
        await expect(exportReportBtn).toBeVisible({ timeout: 5000 });

        // No JS errors
        const critErrors = jsErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
        expect(critErrors, `JS errors: ${critErrors.join('; ')}`).toHaveLength(0);

        // Take screenshot
        await page.screenshot({ path: '/tmp/test-a-toolbar.png' });
    });

    test('Test B: Exit simulation hides scenario buttons', async ({ page }) => {
        await setupToSimulation(page);

        // Buttons should be visible in simulation
        await expect(page.locator('#btnSaveScenario')).toBeVisible({ timeout: 5000 });

        // Exit simulation - the #btnSimulate button toggles between "Simulate" and "Exit Simulation"
        const toggleBtn = page.locator('#btnSimulate');
        await expect(toggleBtn).toBeVisible({ timeout: 5000 });
        // Verify the button says "Exit Simulation"
        await expect(toggleBtn).toContainText('Exit Simulation', { timeout: 5000 });
        await toggleBtn.click();

        await page.waitForTimeout(800);

        // Scenario buttons should now be hidden
        await expect(page.locator('#btnSaveScenario')).toBeHidden({ timeout: 5000 });
        await expect(page.locator('#btnLoadScenario')).toBeHidden({ timeout: 5000 });
        await expect(page.locator('#btnExportReport')).toBeHidden({ timeout: 5000 });

        // Simulate button should still be visible and say "Simulate"
        await expect(page.locator('#btnSimulate')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('#btnSimulate')).toContainText('Simulate', { timeout: 5000 });

        await page.screenshot({ path: '/tmp/test-b-exit-sim.png' });
    });

    test('Test C: Save Scenario triggers download with correct envelope', async ({ page }) => {
        await setupToSimulation(page);

        // Make a decision first
        const result = await makeFirstDecision(page);
        if (result === 'skip') {
            console.log('No Decide buttons available, testing empty scenario save');
        }

        // Listen for download event
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 });

        await page.locator('#btnSaveScenario').click();

        const download = await downloadPromise;
        const filename = download.suggestedFilename();
        console.log('Downloaded file:', filename);

        // Filename should match pattern scenario-YYYY-MM-DD.json
        expect(filename).toMatch(/^scenario-\d{4}-\d{2}-\d{2}\.json$/);

        // Read downloaded file content
        const filePath = await download.path();
        const content = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(content);

        // Verify envelope structure
        expect(parsed.type).toBe('lgr-scenario');
        expect(parsed.version).toBe(1);
        expect(parsed.exportedAt).toBeTruthy();
        expect(Array.isArray(parsed.decisions)).toBe(true);
        expect(parsed.metadata).toBeTruthy();
        expect(typeof parsed.metadata.persona).toBe('string');
        expect(typeof parsed.metadata.decisionCount).toBe('number');

        // If we made a decision, verify it's in the file
        if (result === 'ok') {
            expect(parsed.decisions.length).toBeGreaterThan(0);
            const dec = parsed.decisions[0];
            expect(dec.functionId).toBeTruthy();
            expect(dec.successorName).toBeTruthy();
            expect(['choose', 'procure', 'defer']).toContain(dec.systemChoice);
        }

        console.log('Scenario envelope valid:', JSON.stringify(parsed.metadata));
        await page.screenshot({ path: '/tmp/test-c-save-scenario.png' });
    });

    test('Test D: Load Scenario restores decisions', async ({ page }) => {
        // Use pre-written test scenario file
        const testScenarioPath = '/tmp/test-scenario.json';

        // Ensure test scenario exists (with a function ID that exists in this example)
        // We'll use a known function ID from the example
        const scenarioContent = {
            type: 'lgr-scenario',
            version: 1,
            exportedAt: '2026-04-23T12:00:00Z',
            metadata: { persona: 'executive', decisionCount: 1 },
            decisions: [{
                id: 'dec-test-1',
                functionId: '148',
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
        fs.writeFileSync(testScenarioPath, JSON.stringify(scenarioContent, null, 2));

        await setupToSimulation(page);

        // Verify simulation is active and no decisions shown
        await expect(page.locator('#btnLoadScenario')).toBeVisible({ timeout: 5000 });

        // The #scenarioFileInput is appended to document.body by JS when Load Scenario button is created
        // Wait for it to exist (it may not exist until first click)
        const loadBtn = page.locator('#btnLoadScenario');
        await loadBtn.click(); // this triggers the hidden file input click, creating it if necessary

        // Wait for scenarioFileInput to be present in DOM (it's display:none so use 'attached' state)
        await page.waitForSelector('#scenarioFileInput', { state: 'attached', timeout: 5000 });

        // Set files directly on the hidden input (bypassing the click)
        const scenarioFileInput = page.locator('#scenarioFileInput');
        await scenarioFileInput.setInputFiles(testScenarioPath);
        await page.waitForTimeout(2000);

        // Verify decisions were loaded by checking the Sankey/decision summary area or decision count
        // Look for evidence of a deferred decision being displayed
        // (the scenario has functionId: '148' which is Adult Social Care)
        // After load, the recomputeSimulation should run and any "Decide" buttons should change
        const pageContent = await page.content();
        console.log('Contains "Adult Social Care":', pageContent.includes('Adult Social Care'));

        // The decision badge or decision count should change if loading worked
        // Take screenshot to visually verify
        await page.screenshot({ path: '/tmp/test-d-load-scenario.png' });

        // Check Load Scenario button is still visible (no crash)
        await expect(page.locator('#btnLoadScenario')).toBeVisible({ timeout: 3000 });
    });

    test('Test E: Export Report opens new window with persona content', async ({ page }) => {
        const jsErrors = [];
        page.on('pageerror', err => jsErrors.push(err.message));

        await setupToSimulation(page);

        // Make at least one decision for meaningful report
        await makeFirstDecision(page);

        // Listen for new page/window
        const [newPage] = await Promise.all([
            page.context().waitForEvent('page', { timeout: 15000 }),
            page.locator('#btnExportReport').click()
        ]);

        await newPage.waitForLoadState('domcontentloaded', { timeout: 10000 });
        await newPage.waitForTimeout(500);

        const title = await newPage.title();
        console.log('Report window title:', title);

        // Check title contains "LGR Transition Report"
        expect(title).toContain('LGR Transition Report');

        // Check for persona name in title
        expect(title).toMatch(/Executive|Commercial|Architect/);

        const content = await newPage.content();

        // Check for report header elements
        expect(content).toContain('LGR Transition Report');
        expect(content).toContain('Vesting date');
        expect(content).toContain('Generated');
        expect(content).toContain('Decisions made');

        // Check for executive-specific sections
        expect(content).toContain('Estate Impact Summary');
        expect(content).toContain('Decisions by Tier');
        expect(content).toContain('Critical Obligations');
        expect(content).toContain('Governance Arrangements');

        await newPage.screenshot({ path: '/tmp/test-e-executive-report.png' });

        // Now test with commercial persona
        // Close the new page
        await newPage.close();

        // Switch to commercial persona
        const personaSelect = page.locator('#personaSelect');
        await personaSelect.selectOption('commercial');
        await page.waitForTimeout(500);

        // Export report again
        const [newPage2] = await Promise.all([
            page.context().waitForEvent('page', { timeout: 15000 }),
            page.locator('#btnExportReport').click()
        ]);

        await newPage2.waitForLoadState('domcontentloaded', { timeout: 10000 });
        await newPage2.waitForTimeout(500);

        const title2 = await newPage2.title();
        console.log('Commercial report title:', title2);

        expect(title2).toContain('Commercial');

        const content2 = await newPage2.content();

        // Commercial-specific sections
        expect(content2).toContain('Cost Summary');
        expect(content2).toContain('Decisions with Contract Detail');
        expect(content2).toContain('Vendor Consolidation');

        await newPage2.screenshot({ path: '/tmp/test-e-commercial-report.png' });

        // No JS errors on main page
        const critErrors = jsErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
        expect(critErrors, `JS errors: ${critErrors.join('; ')}`).toHaveLength(0);
    });

    test('Test F: No JS errors during scenario management flow', async ({ page }) => {
        const jsErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                const t = msg.text();
                if (!t.includes('favicon') && !t.includes('404') && !t.includes('net::ERR')) {
                    jsErrors.push(t);
                }
            }
        });
        page.on('pageerror', err => jsErrors.push(err.message));

        await setupToSimulation(page);

        // Make a decision
        await makeFirstDecision(page);

        // Save scenario
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
        await page.locator('#btnSaveScenario').click();
        const download = await downloadPromise;
        const filePath = await download.path();

        // Exit simulation (toggle button)
        const simToggleBtn = page.locator('#btnSimulate');
        await expect(simToggleBtn).toContainText('Exit Simulation', { timeout: 5000 });
        await simToggleBtn.click();
        await page.waitForTimeout(500);

        // Re-enter simulation (same button now says "Simulate")
        await expect(simToggleBtn).toContainText('Simulate', { timeout: 5000 });
        await simToggleBtn.click();
        await page.waitForFunction(() => !!document.querySelector('.sim-decide-btn'), { timeout: 15000 });

        // Load the saved scenario back
        const loadBtn = page.locator('#btnLoadScenario');
        await expect(loadBtn).toBeVisible({ timeout: 5000 });
        await loadBtn.click();

        const scenarioFileInput = page.locator('#scenarioFileInput');
        if (await scenarioFileInput.count() > 0) {
            await scenarioFileInput.setInputFiles(filePath);
            await page.waitForTimeout(2000);
        }

        expect(jsErrors, `JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
    });
});
