/**
 * Detailed modal content inspection for capability filtering verification.
 */

const { test, expect } = require('@playwright/test');
const path = require('path');

const BASE_URL = 'http://localhost:8765/lgr-rationalisation-engine.html';
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

test('Inspect decision modal in detail — capability filtering and blast radius', async ({ page }) => {
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
    await page.waitForTimeout(1500);

    await page.locator('#btnSimulate').click();
    await page.waitForFunction(() => !!document.querySelector('.sim-decide-btn'), { timeout: 20000 });
    await page.waitForTimeout(1000);

    // Open the first decide button's modal
    const decideButtons = page.locator('.sim-decide-btn');
    await decideButtons.first().click();
    const modal = page.locator('#decisionPanelModal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Get full modal HTML for analysis
    const modalHtml = await modal.innerHTML();
    const modalText = await modal.textContent();

    // Log sections of the modal
    console.log('=== MODAL TEXT ===');
    console.log(modalText.substring(0, 2000));

    // Check for specific capability content
    const capSectionMatch = modalText.match(/Capability platform impact[^]*?(\n|$)/i);
    console.log('Capability platform impact section:', capSectionMatch ? capSectionMatch[0] : 'not found');

    // Check for blast radius details
    const detailsEls = modal.locator('details');
    const detailsCount = await detailsEls.count();
    console.log('Blast radius <details> elements:', detailsCount);

    for (let i = 0; i < detailsCount; i++) {
        const detailsText = await detailsEls.nth(i).textContent();
        console.log(`Details ${i} text:`, detailsText.substring(0, 200));
        // Expand it
        const summary = detailsEls.nth(i).locator('summary');
        if (await summary.isVisible().catch(() => false)) {
            await summary.click();
            await page.waitForTimeout(200);
            const expandedText = await detailsEls.nth(i).textContent();
            console.log(`Details ${i} expanded:`, expandedText.substring(0, 300));
        }
    }

    // Look for "serves N functions" text in capability section
    const servesNFunctions = modalText.match(/serves \d+ function/gi);
    console.log('"Serves N functions" occurrences:', servesNFunctions);

    // Check which systems appear in Axis 1 vs capability section
    const axis1Section = await modal.locator('#axis1Section').textContent().catch(() => 'not found');
    console.log('Axis 1 section:', axis1Section.substring(0, 300));

    // Screenshot at full viewport size
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.screenshot({ path: '/tmp/modal-detail-full.png', fullPage: false });

    // Check for SAP S/4HANA ERP or Payments systems in capability area
    const hasPaymentsCapSection = modalHtml.includes('tag-capability') &&
                                  (modalHtml.includes('Payments') || modalHtml.includes('payments'));
    console.log('Modal has capability badge in HTML:', modalHtml.includes('tag-capability'));
    console.log('Modal has Payments capability:', hasPaymentsCapSection);

    // Count systems in capability section vs axis1 section
    const capabilitySystemCount = (modalHtml.match(/tag-capability/g) || []).length;
    console.log('tag-capability occurrences in modal HTML:', capabilitySystemCount);

    // Check for "Capability platform impact" text block
    const hasCPImpact = modalText.includes('Capability platform impact');
    console.log('Has "Capability platform impact" text:', hasCPImpact);

    console.log('Test complete');
});

test('Inspect capability badges on matrix — identify badge types and serves annotation', async ({ page }) => {
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
    await page.waitForTimeout(1500);

    // Expand all cards in first cell
    await page.locator('#tabMatrix').click();

    // Use "Expand all" on the first cell
    const expandAllBtns = page.locator('button:has-text("Expand all"), button:has-text("Expand All")');
    const count = await expandAllBtns.count();
    console.log('Expand All buttons:', count);

    // Expand all cells
    for (let i = 0; i < Math.min(count, 3); i++) {
        try {
            await expandAllBtns.nth(i).click();
            await page.waitForTimeout(200);
        } catch { }
    }

    // Now look for "serves N functions" text
    const servesText = page.locator('text=/serves \\d+ function/');
    const servesCount = await servesText.count();
    console.log('"Serves N functions" occurrences on page:', servesCount);

    if (servesCount > 0) {
        for (let i = 0; i < Math.min(servesCount, 5); i++) {
            const text = await servesText.nth(i).textContent();
            console.log(`  Serves text ${i}:`, text);
        }
    }

    // Get page content snippet around capability tags
    const allCapBadges = page.locator('.tag-capability');
    const badgeCount = await allCapBadges.count();
    console.log('Total capability badges:', badgeCount);

    // Get parent context for first few badges
    for (let i = 0; i < Math.min(badgeCount, 10); i++) {
        const badge = allCapBadges.nth(i);
        const text = await badge.textContent();
        const parentText = await badge.evaluate(el => {
            // Walk up to find system card parent
            let p = el.parentElement;
            for (let j = 0; j < 5; j++) {
                if (!p) break;
                p = p.parentElement;
            }
            return p ? p.textContent.substring(0, 150) : '';
        });
        console.log(`Badge ${i}: "${text}" in context: "${parentText.replace(/\s+/g, ' ').trim()}"`);
    }

    await page.screenshot({ path: '/tmp/matrix-badges-expanded.png', fullPage: false });
    console.log('Test complete');
});

test('Verify "serves N functions" in expanded capability card', async ({ page }) => {
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
    await page.waitForTimeout(1500);

    // Get full page text
    const bodyText = await page.evaluate(() => document.body.textContent);

    // Check for "+ N capability platforms" annotation
    const capAnnotationMatches = bodyText.match(/\+ \d+ capability platform/g);
    console.log('Capability platform annotations in page text:', capAnnotationMatches);

    // Expand cards to find "serves N functions"
    const expandBtns = page.locator('[aria-expanded="false"]');
    const colCount = await expandBtns.count();
    console.log('Collapsed elements to expand:', colCount);

    // Click a few to expand
    for (let i = 0; i < Math.min(colCount, 10); i++) {
        try {
            await expandBtns.nth(0).click();
            await page.waitForTimeout(100);
        } catch { break; }
    }

    // Check for "serves N functions" text after expanding
    const bodyTextAfter = await page.evaluate(() => document.body.textContent);
    const servesMatches = bodyTextAfter.match(/serves \d+ function/gi);
    console.log('"serves N functions" in page after expansion:', servesMatches);

    // Look at the HTML source of expanded cards
    const expandedHtml = await page.evaluate(() => {
        const expanded = document.querySelectorAll('[aria-expanded="true"]');
        return [...expanded].slice(0, 3).map(el => el.innerHTML.substring(0, 500)).join('\n---\n');
    });
    console.log('Expanded card HTML (first 3):', expandedHtml.substring(0, 1500));

    console.log('Test complete');
});
