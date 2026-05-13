/**
 * Evaluator test: Baseline Report feature
 * Tests: button presence, simulate button co-existence, and report HTML content
 * Uses example 08 (mega-merger-six-councils).
 */

const { test, expect } = require('@playwright/test');
const path = require('path');

const BASE_URL = 'http://localhost:8765/dist/lgr-rationalisation-engine.html';
const EXAMPLE_DIR = path.resolve(
    __dirname,
    '../../examples/08-mega-merger-six-councils'
);

const ARCH_FILES = [
    path.join(EXAMPLE_DIR, 'elmhurst-district.json'),
    path.join(EXAMPLE_DIR, 'fairford-borough.json'),
    path.join(EXAMPLE_DIR, 'grantham-district.json'),
    path.join(EXAMPLE_DIR, 'hatherley-district.json'),
    path.join(EXAMPLE_DIR, 'ivybridge-borough.json'),
    path.join(EXAMPLE_DIR, 'westshire-county.json'),
    path.join(EXAMPLE_DIR, 'transition-config.json'),
];

const jsErrors = [];

async function setupToDashboard(page) {
    jsErrors.length = 0;
    page.on('pageerror', err => jsErrors.push(err.message));
    page.on('console', msg => {
        if (msg.type() === 'error') {
            const t = msg.text();
            if (!t.includes('favicon') && !t.includes('net::ERR') && !t.includes('404')) {
                jsErrors.push(t);
            }
        }
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const fileInput = page.locator('#fileInput');
    await fileInput.setInputFiles(ARCH_FILES);
    await page.waitForSelector('#uploadedFilesUl li', { timeout: 15000 });

    // Proceed to transition config
    await page.locator('#btnProceedBaseline').click();
    await page.waitForSelector('#stageTransitionConfig:not(.hidden)', { timeout: 15000 });

    // Proceed to baselining
    await page.locator('#btnProceedTransition').click();
    await page.waitForSelector('#stageBaseline:not(.hidden)', { timeout: 15000 });

    // Generate matrix (Stage 3)
    await page.locator('#btnGenerateMatrix').click();
    await page.waitForSelector('#stageDashboard:not(.hidden)', { timeout: 30000 });
    await page.waitForTimeout(1500);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Baseline Report button and Simulate button both present
// ─────────────────────────────────────────────────────────────────────────────
test('Baseline Report button and Simulate button co-exist on Stage 3', async ({ page }) => {
    await setupToDashboard(page);

    // Check Baseline Report button exists
    const baselineBtn = page.locator('#btnBaselineReport');
    const baselineBtnVisible = await baselineBtn.isVisible({ timeout: 10000 });
    console.log('Baseline Report button visible:', baselineBtnVisible);
    expect(baselineBtnVisible).toBe(true);

    // Check Simulate button exists
    const simulateBtn = page.locator('#btnSimulate');
    const simulateBtnVisible = await simulateBtn.isVisible({ timeout: 5000 });
    console.log('Simulate button visible:', simulateBtnVisible);
    expect(simulateBtnVisible).toBe(true);

    // Screenshot showing both buttons together
    await page.screenshot({ path: '/tmp/baseline-report-both-buttons.png', fullPage: false });

    const baselineBtnText = await baselineBtn.textContent();
    const simulateBtnText = await simulateBtn.textContent();
    console.log('Baseline button text:', baselineBtnText.trim());
    console.log('Simulate button text:', simulateBtnText.trim());

    expect(jsErrors, `JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
    console.log('Test 1 PASSED: Both buttons present');
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Baseline Report content verification via direct function call
// ─────────────────────────────────────────────────────────────────────────────
test('Baseline Report generates correct HTML content', async ({ page }) => {
    await setupToDashboard(page);

    // Step 1: Install window.open interceptor BEFORE clicking button
    await page.evaluate(() => {
        window.__capturedReportHtml = null;
        window.__origOpen = window.open;
        window.open = function(url, target) {
            const fakeWin = {
                document: {
                    write(h) { window.__capturedReportHtml = h; },
                    close() {}
                }
            };
            return fakeWin;
        };
    });

    // Step 2: Click the button
    await page.locator('#btnBaselineReport').click();
    await page.waitForTimeout(500);

    // Step 3: Restore and retrieve
    const reportHtml = await page.evaluate(() => {
        window.open = window.__origOpen;
        return window.__capturedReportHtml;
    });

    console.log('Report HTML captured:', reportHtml ? `${reportHtml.length} chars` : 'null');

    if (!reportHtml) {
        // Check for JS errors in console
        const consoleErrors = jsErrors.join('; ');
        console.log('JS errors at time of failure:', consoleErrors);
        await page.screenshot({ path: '/tmp/baseline-report-no-output.png', fullPage: false });
        throw new Error(`No report HTML was generated. JS errors: ${consoleErrors}`);
    }

    const first3000 = reportHtml.substring(0, 3000);
    console.log('Report HTML first 3000 chars:', first3000);

    // Check title
    const hasBaselineTitle = reportHtml.includes('Baseline Estate Report');
    console.log('Has "Baseline Estate Report" title:', hasBaselineTitle);
    expect(hasBaselineTitle).toBe(true);

    // Check tier distribution
    // Extract tier counts from report — look for numbers near tier labels
    const tier1Pattern = /Tier 1[^<\d]*(\d+)/;
    const tier2Pattern = /Tier 2[^<\d]*(\d+)/;
    const tier3Pattern = /Tier 3[^<\d]*(\d+)/;
    const tier1Match = reportHtml.match(tier1Pattern);
    const tier2Match = reportHtml.match(tier2Pattern);
    const tier3Match = reportHtml.match(tier3Pattern);
    console.log('Tier 1 match:', tier1Match ? tier1Match[0] : 'not found');
    console.log('Tier 2 match:', tier2Match ? tier2Match[0] : 'not found');
    console.log('Tier 3 match:', tier3Match ? tier3Match[0] : 'not found');

    // Should have non-zero Tier 1 and Tier 2
    const tier1Count = tier1Match ? parseInt(tier1Match[1]) : 0;
    const tier2Count = tier2Match ? parseInt(tier2Match[1]) : 0;
    console.log('Tier 1 count:', tier1Count, 'Tier 2 count:', tier2Count);
    expect(tier1Count).toBeGreaterThan(0);
    expect(tier2Count).toBeGreaterThan(0);

    // Check Critical Path Items section
    const hasCriticalPath = reportHtml.includes('Critical Path');
    console.log('Has "Critical Path" section:', hasCriticalPath);
    expect(hasCriticalPath).toBe(true);

    // Check Per-Successor Summary section
    const hasPerSuccessor = reportHtml.includes('Per-Successor');
    console.log('Has "Per-Successor" section:', hasPerSuccessor);
    expect(hasPerSuccessor).toBe(true);

    expect(jsErrors, `JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
    console.log('Test 2 PASSED: Report content verified');
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Baseline Report opens a new window (actual open behaviour)
// ─────────────────────────────────────────────────────────────────────────────
test('Baseline Report button opens a new window when clicked', async ({ page, context }) => {
    // Grant popup permission
    await context.grantPermissions([]);

    await setupToDashboard(page);

    const [newPage] = await Promise.all([
        context.waitForEvent('page', { timeout: 15000 }),
        page.locator('#btnBaselineReport').click()
    ]);

    await newPage.waitForLoadState('domcontentloaded', { timeout: 15000 });
    await newPage.waitForTimeout(1000);

    const newPageTitle = await newPage.title();
    console.log('New window title:', newPageTitle);

    const newPageContent = await newPage.content();
    console.log('New window content (first 1000 chars):', newPageContent.substring(0, 1000));

    const hasBaselineTitle = newPageContent.includes('Baseline') || newPageContent.includes('baseline');
    console.log('New window has Baseline content:', hasBaselineTitle);

    await newPage.screenshot({ path: '/tmp/baseline-report-new-window.png', fullPage: false });
    await newPage.close();

    expect(hasBaselineTitle).toBe(true);
    expect(jsErrors, `JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
    console.log('Test 3 PASSED: Report opens in new window');
});
