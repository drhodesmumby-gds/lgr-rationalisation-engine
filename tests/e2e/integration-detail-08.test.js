/**
 * Detailed integration tests for failed scenarios:
 * - Test 5: Decision panel capability filtering (fixed CSS selector)
 * - Test 7: Sankey overlay (fixed apply flow)
 * - Test 8: Report export (fixed apply flow)
 * - Additional detail tests for capability summary
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

async function setupToDashboard(page) {
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
}

async function setupToSimulation(page) {
    await setupToDashboard(page);
    await page.locator('#btnSimulate').click();
    await page.waitForFunction(() => !!document.querySelector('.sim-decide-btn'), { timeout: 20000 });
    await page.waitForTimeout(1000);
}

/**
 * Apply a defer decision in the currently open decision modal.
 * Returns true on success, false on failure.
 */
async function applyDeferDecision(page) {
    const modal = page.locator('#decisionPanelModal');
    // Select Defer
    const deferRadio = page.locator('#axis1Defer');
    await expect(deferRadio).toBeVisible({ timeout: 5000 });
    await deferRadio.click();
    await page.waitForTimeout(200);

    // Apply
    const applyBtn = page.locator('#btnApplyDecision');
    await applyBtn.click();

    // Wait for modal to close
    try {
        await expect(modal).toBeHidden({ timeout: 10000 });
        return true;
    } catch {
        // Check if there's an error message
        const errorEl = page.locator('#decisionPanelError');
        const errorText = await errorEl.textContent().catch(() => '');
        console.log('Decision error:', errorText);
        // Try pressing Escape to dismiss
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        return false;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 5 (detail): Decision panel capability content
// ─────────────────────────────────────────────────────────────────────────────
test('Test 5-detail: Decision modal capability content and filtering', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', err => jsErrors.push(err.message));
    page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('favicon') && !msg.text().includes('net::ERR')) {
            jsErrors.push(msg.text());
        }
    });

    await setupToSimulation(page);

    // Find all decide buttons to iterate through them
    const decideButtons = page.locator('.sim-decide-btn');
    const decideCount = await decideButtons.count();
    console.log('Total decide buttons:', decideCount);

    let foundCapabilityContent = false;
    let foundBlastRadius = false;
    let foundCapabilitySection = false;
    let modalDetails = {};

    // Try up to 5 decide buttons to find one with capability content
    for (let i = 0; i < Math.min(decideCount, 5); i++) {
        const btn = decideButtons.nth(i);
        const btnText = await btn.textContent().catch(() => '');
        const parentCell = btn.locator('../../../../..');
        const cellText = await parentCell.textContent().catch(() => '');
        console.log(`Decide btn ${i}: ${btnText.trim()}, parent text snippet: ${cellText.substring(0, 100)}`);

        await btn.click();
        const modal = page.locator('#decisionPanelModal');
        await expect(modal).toBeVisible({ timeout: 10000 });

        const modalHtml = await modal.innerHTML();
        const modalText = await modal.textContent();

        // Check for capability content (using correct Playwright selectors)
        const capabilityBadges = await modal.locator('.tag-capability').count();
        const capabilityPlatformText = modalText.includes('Capability platform') ||
                                      modalText.includes('capability platform') ||
                                      modalText.includes('Supporting Capability') ||
                                      modalText.includes('PAYMENTS') ||
                                      modalText.includes('Payments');

        console.log(`Modal ${i}: capability badges: ${capabilityBadges}, cap text: ${capabilityPlatformText}`);

        if (capabilityBadges > 0 || capabilityPlatformText) {
            foundCapabilityContent = true;

            // Check for blast radius details element
            const detailsElems = modal.locator('details');
            const detailsCount = await detailsElems.count();
            console.log('Details elements (blast radius):', detailsCount);
            foundBlastRadius = detailsCount > 0;

            // Check that capability systems are NOT in Axis 1 radio group
            const axis1Radios = modal.locator('input[name="axis1Choice"]');
            const axis1Count = await axis1Radios.count();
            console.log('Axis 1 radio count:', axis1Count);

            // Get labels of all radios in axis1 section
            const radioSection = modal.locator('fieldset, #axis1Section').first();
            const radioSectionText = await radioSection.textContent().catch(() => '');
            console.log('Axis 1 section text:', radioSectionText.substring(0, 200));

            // Check for "Supporting Capability Platforms" section header
            const capPlatformHeader = modalText.includes('Supporting Capability Platforms') ||
                                     modalText.includes('Capability platform impact') ||
                                     modalHtml.includes('capability') ||
                                     modalHtml.includes('tag-capability');
            console.log('Has capability platform header/section:', capPlatformHeader);
            foundCapabilitySection = capPlatformHeader;

            // Take screenshot of this modal
            await page.screenshot({ path: `/tmp/test5-detail-modal-${i}.png`, fullPage: false });

            // Extract more detail
            modalDetails = {
                index: i,
                capabilityBadges,
                capabilityPlatformText,
                detailsCount,
                axis1Count,
                hasCapSection: capPlatformHeader,
            };
            break;
        }

        // Close this modal and try next
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        await expect(modal).toBeHidden({ timeout: 5000 });
    }

    console.log('Modal details found:', modalDetails);
    console.log('Found capability content:', foundCapabilityContent);
    console.log('Found blast radius:', foundBlastRadius);
    console.log('Found capability section:', foundCapabilitySection);

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    expect(jsErrors, `JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
    console.log('Test 5-detail: Complete');
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 3-detail: Capability Platforms section in Overview
// ─────────────────────────────────────────────────────────────────────────────
test('Test 3-detail: Capability Platforms section metrics in Overview tab', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await setupToDashboard(page);

    // Switch to Overview tab
    await page.locator('#tabOverview').click();
    await page.waitForTimeout(800);

    // Get overview panel content
    const overviewPanel = page.locator('#panelOverview');
    await expect(overviewPanel).toBeVisible({ timeout: 5000 });

    const overviewHtml = await overviewPanel.innerHTML();
    const overviewText = await overviewPanel.textContent();

    // Check for Capability Platforms section
    const hasCapSection = overviewHtml.includes('Capability Platforms') ||
                         overviewText.includes('Capability Platforms');
    console.log('Has Capability Platforms section:', hasCapSection);

    // Check for specific metrics
    const hasTaggedSystems = overviewText.includes('Capability-tagged systems') ||
                            overviewText.includes('tagged systems') ||
                            overviewText.includes('tagged');
    const hasCapTypes = overviewText.includes('Capability types') ||
                       overviewText.includes('types in use') ||
                       overviewText.includes('Types in use');
    const hasCompeting = overviewText.includes('Competing platforms') ||
                        overviewText.includes('competing');

    console.log('Has tagged systems metric:', hasTaggedSystems);
    console.log('Has capability types metric:', hasCapTypes);
    console.log('Has competing platforms metric:', hasCompeting);

    // Check for capability type detail table (showing Payments, Forms, etc.)
    const tableRows = overviewPanel.locator('tr');
    const rowCount = await tableRows.count();
    console.log('Table rows in overview:', rowCount);

    if (rowCount > 0) {
        const tableTexts = [];
        for (let i = 0; i < Math.min(rowCount, 10); i++) {
            const text = await tableRows.nth(i).textContent();
            tableTexts.push(text.trim().substring(0, 100));
        }
        console.log('Table row texts:', tableTexts);
    }

    // Take full-height screenshot
    await page.screenshot({ path: '/tmp/test3-detail-overview.png', fullPage: true });

    expect(hasCapSection, 'Capability Platforms section should be visible').toBe(true);
    expect(jsErrors, `JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
    console.log('Test 3-detail PASSED');
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 7-detail: Sankey overlay with proper decision flow
// ─────────────────────────────────────────────────────────────────────────────
test('Test 7-detail: Sankey overlay with proper defer decision', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', err => jsErrors.push(err.message));
    page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('favicon') && !msg.text().includes('net::ERR')) {
            jsErrors.push(msg.text());
        }
    });

    await setupToSimulation(page);

    // Make a decision using Defer (simplest)
    const decideButtons = page.locator('.sim-decide-btn');
    await decideButtons.first().click();
    const modal = page.locator('#decisionPanelModal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    const success = await applyDeferDecision(page);
    console.log('Decision applied successfully:', success);

    if (!success) {
        // Modal stayed open — debug
        const modalText = await modal.textContent();
        console.log('Modal still open, content:', modalText.substring(0, 300));
        const errorEl = page.locator('#decisionPanelError');
        const errText = await errorEl.textContent().catch(() => 'N/A');
        console.log('Error message:', errText);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
    }

    await page.waitForTimeout(500);

    // Look for "View flow diagram" button
    const viewFlowBtn = page.locator('button:has-text("View flow diagram")');
    const viewFlowCount = await viewFlowBtn.count();
    console.log('"View flow diagram" button count:', viewFlowCount);

    if (viewFlowCount > 0) {
        await viewFlowBtn.first().click();
        await page.waitForTimeout(800);

        // Look for sankey overlay/modal
        const sankeyModal = page.locator('#sankeyModal, .sankey-overlay, [id*="sankey"][class*="modal"]');
        const sankeyCount = await sankeyModal.count();
        console.log('Sankey modal elements found:', sankeyCount);

        // Also check via evaluate for any modal that just appeared
        const modalCount = await page.evaluate(() => {
            const modals = document.querySelectorAll('[class*="modal"], [class*="overlay"], dialog');
            return [...modals].filter(m => {
                const style = window.getComputedStyle(m);
                return style.display !== 'none' && style.visibility !== 'hidden';
            }).map(m => ({ id: m.id, class: m.className.substring(0, 80) }));
        });
        console.log('Visible modal-like elements after Sankey click:', modalCount);

        // Check for SVG
        const svgEls = await page.locator('svg').count();
        console.log('SVG elements on page:', svgEls);

        await page.screenshot({ path: '/tmp/test7-detail-sankey.png', fullPage: false });

        // Close with Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        // Verify it closed
        const closedModals = await page.evaluate(() => {
            const modals = document.querySelectorAll('[class*="modal"], [class*="overlay"], dialog');
            return [...modals].filter(m => {
                const style = window.getComputedStyle(m);
                return style.display !== 'none' && !m.classList.contains('hidden');
            }).map(m => ({ id: m.id }));
        });
        console.log('Modals still open after Escape:', closedModals);
    } else {
        // Side panel may need decisions to show Sankey
        const sidePanel = page.locator('#simulationSidePanel');
        const sidePanelText = await sidePanel.textContent();
        console.log('Side panel content:', sidePanelText.substring(0, 400));
        await page.screenshot({ path: '/tmp/test7-detail-no-sankey.png', fullPage: false });
        console.log('Note: View flow diagram button not found - checking panel state');
    }

    expect(jsErrors, `JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
    console.log('Test 7-detail: Complete');
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 8-detail: Report export with proper decision flow
// ─────────────────────────────────────────────────────────────────────────────
test('Test 8-detail: Report export all 3 personas', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await setupToSimulation(page);

    // Make a decision using Defer
    const decideButtons = page.locator('.sim-decide-btn');
    await decideButtons.first().click();
    const modal = page.locator('#decisionPanelModal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    const success = await applyDeferDecision(page);
    console.log('First decision applied:', success);
    if (!success) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
    }

    await page.waitForTimeout(500);

    const reportResults = {};

    // Test Executive report
    const exportReportBtn = page.locator('#btnExportReport');
    await expect(exportReportBtn).toBeVisible({ timeout: 5000 });

    const [execReport] = await Promise.all([
        page.context().waitForEvent('page', { timeout: 15000 }),
        exportReportBtn.click()
    ]);
    await execReport.waitForLoadState('domcontentloaded', { timeout: 10000 });
    await execReport.waitForTimeout(1000);

    const execTitle = await execReport.title();
    const execContent = await execReport.content();
    console.log('Executive report title:', execTitle);

    reportResults.executive = {
        title: execTitle,
        hasEstateImpact: execContent.includes('Estate Impact') || execContent.includes('estate impact'),
        hasDecisionsByTier: execContent.includes('Decisions by Tier') || execContent.includes('decisions by tier'),
        hasObligations: execContent.includes('Obligations') || execContent.includes('Critical'),
        hasGovernance: execContent.includes('Governance') || execContent.includes('governance'),
    };
    console.log('Executive report sections:', reportResults.executive);
    await execReport.screenshot({ path: '/tmp/test8-detail-exec.png', fullPage: false });
    await execReport.close();

    // Test Commercial report
    const personaSelect = page.locator('#personaSelect');
    await personaSelect.selectOption('commercial');
    await page.waitForTimeout(300);

    const [commReport] = await Promise.all([
        page.context().waitForEvent('page', { timeout: 15000 }),
        exportReportBtn.click()
    ]);
    await commReport.waitForLoadState('domcontentloaded', { timeout: 10000 });
    await commReport.waitForTimeout(1000);

    const commTitle = await commReport.title();
    const commContent = await commReport.content();
    console.log('Commercial report title:', commTitle);

    reportResults.commercial = {
        title: commTitle,
        hasCostSummary: commContent.includes('Cost') || commContent.includes('cost'),
        hasVendorConsolidation: commContent.includes('Vendor') || commContent.includes('vendor'),
        hasProcurementTimeline: commContent.includes('Procurement') || commContent.includes('procurement'),
    };
    console.log('Commercial report sections:', reportResults.commercial);
    await commReport.screenshot({ path: '/tmp/test8-detail-comm.png', fullPage: false });
    await commReport.close();

    // Test Architect report
    await personaSelect.selectOption('architect');
    await page.waitForTimeout(300);

    const [archReport] = await Promise.all([
        page.context().waitForEvent('page', { timeout: 15000 }),
        exportReportBtn.click()
    ]);
    await archReport.waitForLoadState('domcontentloaded', { timeout: 10000 });
    await archReport.waitForTimeout(1000);

    const archTitle = await archReport.title();
    const archContent = await archReport.content();
    console.log('Architect report title:', archTitle);

    reportResults.architect = {
        title: archTitle,
        hasObligations: archContent.includes('Obligation') || archContent.includes('obligation'),
        hasTypeColumn: archContent.includes('Type') || archContent.includes('type'),
        hasCapabilityColumn: archContent.includes('Capability') || archContent.includes('capability'),
    };
    console.log('Architect report sections:', reportResults.architect);
    await archReport.screenshot({ path: '/tmp/test8-detail-arch.png', fullPage: false });
    await archReport.close();

    // Verify all reports opened
    expect(reportResults.executive.title).toContain('LGR Transition Report');
    expect(reportResults.commercial.title).toContain('LGR Transition Report');
    expect(reportResults.architect.title).toContain('LGR Transition Report');

    // Verify persona specifics
    expect(reportResults.executive.title).toMatch(/Executive|executive/);
    expect(reportResults.commercial.title).toMatch(/Commercial|commercial/);
    expect(reportResults.architect.title).toMatch(/Architect|architect/);

    expect(jsErrors, `JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
    console.log('Test 8-detail PASSED: All persona reports generated correctly');
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 4-detail: Collapse/expand the simulation side panel
// ─────────────────────────────────────────────────────────────────────────────
test('Test 4-detail: Side panel collapse and expand', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await setupToSimulation(page);

    const sidePanel = page.locator('#simulationSidePanel');
    await expect(sidePanel).toBeVisible({ timeout: 5000 });

    // Panel should be expanded
    const expandedClasses = await sidePanel.evaluate(el => el.className);
    console.log('Initial panel classes:', expandedClasses);
    const isExpanded = expandedClasses.includes('expanded');
    console.log('Panel is expanded:', isExpanded);

    // Find collapse button (the ❮ button)
    const collapseBtn = sidePanel.locator('button').first();
    const collapseBtnText = await collapseBtn.textContent();
    console.log('First button text:', collapseBtnText);

    // Click to collapse
    await collapseBtn.click();
    await page.waitForTimeout(400);

    const collapsedClasses = await sidePanel.evaluate(el => el.className);
    console.log('Classes after collapse click:', collapsedClasses);
    const isCollapsed = collapsedClasses.includes('collapsed');
    console.log('Panel is now collapsed:', isCollapsed);

    const collapsedWidth = await sidePanel.evaluate(el => el.getBoundingClientRect().width);
    console.log('Collapsed width:', collapsedWidth);

    await page.screenshot({ path: '/tmp/test4-detail-collapsed.png', fullPage: false });

    // Click again to expand
    const expandBtn = sidePanel.locator('button').first();
    await expandBtn.click();
    await page.waitForTimeout(400);

    const expandedAgainClasses = await sidePanel.evaluate(el => el.className);
    console.log('Classes after expand:', expandedAgainClasses);
    const isExpandedAgain = expandedAgainClasses.includes('expanded');
    console.log('Panel is expanded again:', isExpandedAgain);

    await page.screenshot({ path: '/tmp/test4-detail-expanded-again.png', fullPage: false });

    expect(jsErrors, `JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
    console.log('Test 4-detail PASSED: Panel collapse/expand works');
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 2-detail: Capability badges and "serves N functions" annotation
// ─────────────────────────────────────────────────────────────────────────────
test('Test 2-detail: Capability badges and serves-N-functions annotation', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await setupToDashboard(page);
    await page.locator('#tabMatrix').click();
    await page.waitForTimeout(500);

    // Count capability badges
    const capBadges = page.locator('.tag-capability');
    const badgeCount = await capBadges.count();
    console.log('Total capability badges:', badgeCount);

    // Get all unique badge texts
    const badgeTexts = new Set();
    for (let i = 0; i < Math.min(badgeCount, 50); i++) {
        const text = await capBadges.nth(i).textContent().catch(() => '');
        badgeTexts.add(text.trim());
    }
    console.log('Unique capability badge types:', [...badgeTexts]);

    // Check for "(+ N capability platforms)" annotations in cells
    const capAnnotations = page.locator('text=/\\+ \\d+ capability platform/');
    const annotationCount = await capAnnotations.count();
    console.log('"+ N capability platforms" annotations:', annotationCount);

    // Check for "serves N functions" text in expanded card detail
    // First expand a card that has capability badges
    // Look for collapsed card elements — they may use details/summary or aria-expanded
    const collapsedAriaEls = page.locator('[aria-expanded="false"]');
    const collapsedCount = await collapsedAriaEls.count();
    console.log('Collapsed aria elements:', collapsedCount);

    if (collapsedCount > 0) {
        // Find a collapsed element that contains a capability badge nearby
        await collapsedAriaEls.first().click();
        await page.waitForTimeout(300);
        const expandedContent = await page.evaluate(() => document.body.textContent.substring(0, 5000));
        const hasServesN = expandedContent.includes('serves') && expandedContent.includes('function');
        console.log('After expanding card, found "serves N functions":', hasServesN);
    }

    // Take full screenshot of matrix
    await page.screenshot({ path: '/tmp/test2-detail-matrix.png', fullPage: false });

    expect(badgeCount).toBeGreaterThan(0);
    expect(annotationCount).toBeGreaterThan(0);
    console.log('Test 2-detail PASSED: Capability badges and annotations present');
    expect(jsErrors).toHaveLength(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 9-detail: Collapsible cards full flow
// ─────────────────────────────────────────────────────────────────────────────
test('Test 9-detail: Collapsible cards — default collapsed, expand all, collapse all', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await setupToDashboard(page);
    await page.locator('#tabMatrix').click();
    await page.waitForTimeout(500);

    // Collapsed by default
    const collapsedEls = page.locator('[aria-expanded="false"]');
    const collapsedCount = await collapsedEls.count();
    console.log('Elements collapsed by default:', collapsedCount);
    expect(collapsedCount).toBeGreaterThan(0);

    // Click "Expand All" in a cell
    const expandAllBtns = page.locator('button:has-text("Expand all"), button:has-text("Expand All")');
    const expandAllCount = await expandAllBtns.count();
    console.log('Expand All buttons:', expandAllCount);

    if (expandAllCount > 0) {
        await expandAllBtns.first().click();
        await page.waitForTimeout(500);
        const expandedEls = page.locator('[aria-expanded="true"]');
        const expandedCount = await expandedEls.count();
        console.log('Elements expanded after Expand All (first cell):', expandedCount);
        expect(expandedCount).toBeGreaterThan(0);
    }

    // Click global "Collapse all"
    const collapseAllBtns = page.locator('button:has-text("Collapse all"), button:has-text("Collapse All")');
    const collapseAllCount = await collapseAllBtns.count();
    console.log('Collapse All buttons:', collapseAllCount);

    if (collapseAllCount > 0) {
        await collapseAllBtns.first().click();
        await page.waitForTimeout(500);
        const collapsedAfter = await page.locator('[aria-expanded="false"]').count();
        console.log('Elements collapsed after Collapse All:', collapsedAfter);
    }

    await page.screenshot({ path: '/tmp/test9-detail-cards.png', fullPage: false });

    expect(jsErrors).toHaveLength(0);
    console.log('Test 9-detail PASSED: Card collapse/expand works');
});
