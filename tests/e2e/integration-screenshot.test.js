/**
 * Quick screenshot test for key UI elements.
 */

const { test, expect } = require('@playwright/test');
const path = require('path');

const BASE_URL = 'http://localhost:8765/lgr-rationalisation-engine.html';
const EXAMPLE_DIR = path.resolve(__dirname, '../../examples/08-mega-merger-six-councils');
const ARCH_FILES = [
    path.join(EXAMPLE_DIR, 'elmhurst-district.json'),
    path.join(EXAMPLE_DIR, 'fairford-borough.json'),
    path.join(EXAMPLE_DIR, 'grantham-district.json'),
    path.join(EXAMPLE_DIR, 'hatherley-district.json'),
    path.join(EXAMPLE_DIR, 'ivybridge-borough.json'),
    path.join(EXAMPLE_DIR, 'westshire-county.json'),
    path.join(EXAMPLE_DIR, 'transition-config.json'),
];

test('Screenshot: decision modal with capability content', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#fileInput');
    await fileInput.setInputFiles(ARCH_FILES);
    await page.waitForSelector('#uploadedFilesUl li', { timeout: 15000 });
    await page.locator('#btnProceedBaseline').click();
    await page.waitForSelector('#stageTransitionConfig:not(.hidden)', { timeout: 15000 });
    await page.locator('#btnProceedTransition').click();
    await page.waitForSelector('#stageBaseline:not(.hidden)', { timeout: 15000 });
    await page.locator('#btnGenerateMatrix').click();
    await page.waitForSelector('#stageDashboard:not(.hidden)', { timeout: 30000 });
    await page.waitForTimeout(1000);
    await page.locator('#btnSimulate').click();
    await page.waitForFunction(() => !!document.querySelector('.sim-decide-btn'), { timeout: 20000 });
    await page.waitForTimeout(500);

    // Open first decide modal
    await page.locator('.sim-decide-btn').first().click();
    const modal = page.locator('#decisionPanelModal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: '/tmp/modal-capability-full.png', fullPage: false });

    // Expand blast radius details
    const details = modal.locator('details');
    const detailsCount = await details.count();
    for (let i = 0; i < detailsCount; i++) {
        const summary = details.nth(i).locator('summary');
        if (await summary.isVisible().catch(() => false)) {
            await summary.click();
            await page.waitForTimeout(100);
        }
    }
    await page.screenshot({ path: '/tmp/modal-blast-radius.png', fullPage: false });
    console.log('Screenshots saved');
});

test('Screenshot: overview capability platforms section', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#fileInput');
    await fileInput.setInputFiles(ARCH_FILES);
    await page.waitForSelector('#uploadedFilesUl li', { timeout: 15000 });
    await page.locator('#btnProceedBaseline').click();
    await page.waitForSelector('#stageTransitionConfig:not(.hidden)', { timeout: 15000 });
    await page.locator('#btnProceedTransition').click();
    await page.waitForSelector('#stageBaseline:not(.hidden)', { timeout: 15000 });
    await page.locator('#btnGenerateMatrix').click();
    await page.waitForSelector('#stageDashboard:not(.hidden)', { timeout: 30000 });
    await page.waitForTimeout(1000);

    // Overview tab
    await page.locator('#tabOverview').click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: '/tmp/overview-full.png', fullPage: true });
    console.log('Overview screenshot saved');
});

test('Screenshot: matrix with expanded cards showing serves-N-functions', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#fileInput');
    await fileInput.setInputFiles(ARCH_FILES);
    await page.waitForSelector('#uploadedFilesUl li', { timeout: 15000 });
    await page.locator('#btnProceedBaseline').click();
    await page.waitForSelector('#stageTransitionConfig:not(.hidden)', { timeout: 15000 });
    await page.locator('#btnProceedTransition').click();
    await page.waitForSelector('#stageBaseline:not(.hidden)', { timeout: 15000 });
    await page.locator('#btnGenerateMatrix').click();
    await page.waitForSelector('#stageDashboard:not(.hidden)', { timeout: 30000 });
    await page.waitForTimeout(1000);

    // Click Expand All on a few cells
    const expandBtns = page.locator('button.cell-expand-toggle');
    const btnCount = await expandBtns.count();
    console.log('Cell expand toggle buttons:', btnCount);
    for (let i = 0; i < Math.min(btnCount, 3); i++) {
        await expandBtns.nth(i).click();
        await page.waitForTimeout(100);
    }
    await page.screenshot({ path: '/tmp/matrix-expanded-cards.png', fullPage: false });
    console.log('Matrix expanded cards screenshot saved');
});
