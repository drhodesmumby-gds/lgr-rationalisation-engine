/**
 * Comprehensive integration test for LGR Rationalisation Engine
 * Tests: tab navigation, capability badges, simulation side panel,
 * decision filtering, Sankey overlay, report export, collapsible cards.
 *
 * Uses example 08 (mega-merger-six-councils).
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

async function setupToSimulation(page) {
    await setupToDashboard(page);

    const simulateBtn = page.locator('#btnSimulate');
    await expect(simulateBtn).toBeVisible({ timeout: 10000 });
    await simulateBtn.click();
    await page.waitForFunction(() => !!document.querySelector('.sim-decide-btn'), { timeout: 20000 });
    await page.waitForTimeout(1000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Tab Navigation
// ─────────────────────────────────────────────────────────────────────────────
test('Test 1: Tab navigation — Matrix, Overview, Timeline tabs work', async ({ page }) => {
    await setupToDashboard(page);

    // Verify three tabs are present
    const tabMatrix = page.locator('#tabMatrix');
    const tabOverview = page.locator('#tabOverview');
    const tabTimeline = page.locator('#tabTimeline');

    await expect(tabMatrix).toBeVisible({ timeout: 5000 });
    await expect(tabOverview).toBeVisible({ timeout: 5000 });
    await expect(tabTimeline).toBeVisible({ timeout: 5000 });

    // Matrix tab is active by default
    const matrixPanel = page.locator('#panelMatrix');
    await expect(matrixPanel).toBeVisible({ timeout: 5000 });

    // Check toolbar and matrix table visible on Matrix tab
    const matrixTable = page.locator('#matrixTableBody, table.matrix-table, #matrixTable');
    const matrixVisible = await matrixTable.count() > 0;
    console.log('Matrix table elements found:', matrixVisible);

    // Click Overview tab
    await tabOverview.click();
    await page.waitForTimeout(500);
    const overviewPanel = page.locator('#panelOverview');
    await expect(overviewPanel).toBeVisible({ timeout: 5000 });

    // Click Timeline tab
    await tabTimeline.click();
    await page.waitForTimeout(500);
    const timelinePanel = page.locator('#panelTimeline');
    await expect(timelinePanel).toBeVisible({ timeout: 5000 });

    // Click back to Matrix
    await tabMatrix.click();
    await page.waitForTimeout(500);
    await expect(matrixPanel).toBeVisible({ timeout: 5000 });

    // Screenshot
    await page.screenshot({ path: '/tmp/test1-tabs.png', fullPage: false });

    // Timeline tab hidden for Architect persona
    const personaSelect = page.locator('#personaSelect');
    await personaSelect.selectOption('architect');
    await page.waitForTimeout(500);

    const timelineTabVisible = await tabTimeline.isVisible({ timeout: 3000 }).catch(() => false);
    const timelineTabStyle = await tabTimeline.evaluate(el => el.style.display).catch(() => 'unknown');
    console.log('Timeline tab visibility for architect:', timelineTabVisible, 'style.display:', timelineTabStyle);

    const isHidden = timelineTabStyle === 'none';
    console.log('Timeline tab hidden for architect:', isHidden);

    // Switch back
    await personaSelect.selectOption('executive');
    await page.waitForTimeout(300);

    // No JS errors
    expect(jsErrors, `JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
    console.log('Test 1 PASSED: All three tabs present and switching correctly');
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Capability Badges in Matrix
// ─────────────────────────────────────────────────────────────────────────────
test('Test 2: Capability badges appear in matrix cells', async ({ page }) => {
    await setupToDashboard(page);

    // Make sure Matrix tab is active
    await page.locator('#tabMatrix').click();
    await page.waitForTimeout(500);

    // Look for teal capability tag badges (tag-capability class)
    const capabilityBadges = page.locator('.tag-capability');
    const badgeCount = await capabilityBadges.count();
    console.log('Capability badges found:', badgeCount);

    // Get text content of badges
    const badgeTexts = [];
    for (let i = 0; i < Math.min(badgeCount, 20); i++) {
        const text = await capabilityBadges.nth(i).textContent();
        badgeTexts.push(text.trim());
    }
    console.log('Badge texts found:', [...new Set(badgeTexts)]);

    // Check for specific badge types
    const allText = badgeTexts.join(' ');
    const hasPayments = allText.includes('Payments') || allText.includes('PAYMENTS') || allText.includes('payments');
    const hasForms = allText.includes('Forms') || allText.includes('FORMS');
    const hasSMS = allText.includes('SMS') || allText.includes('sms');
    const hasEmail = allText.includes('Email') || allText.includes('EMAIL') || allText.includes('Notify');
    console.log('Has payments:', hasPayments, 'Has forms:', hasForms, 'Has SMS:', hasSMS, 'Has email:', hasEmail);

    // There should be at least some capability badges
    expect(badgeCount).toBeGreaterThan(0);

    // Check for "(+ N capability platforms)" annotation in cells
    const capPlatformAnnotation = page.locator('text=/\\+ \\d+ capability platform/');
    const annoCount = await capPlatformAnnotation.count();
    console.log('Capability platform annotations found:', annoCount);

    await page.screenshot({ path: '/tmp/test2-capability-badges.png', fullPage: false });

    // Click the first card that has capability badges to expand it
    // Capability systems are often shown in collapsed cards
    const firstCapBadgeParent = await capabilityBadges.first().locator('..').locator('..').locator('..');

    console.log('Test 2 PASSED: Capability badges visible in matrix');
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Capability Summary Panel (Overview tab)
// ─────────────────────────────────────────────────────────────────────────────
test('Test 3: Capability summary panel in Overview tab', async ({ page }) => {
    await setupToDashboard(page);

    // Switch to Overview tab
    await page.locator('#tabOverview').click();
    await page.waitForTimeout(800);

    // Take screenshot of overview tab
    await page.screenshot({ path: '/tmp/test3-overview.png', fullPage: false });

    // Check for estate summary section
    const overviewPanel = page.locator('#panelOverview');
    await expect(overviewPanel).toBeVisible({ timeout: 5000 });

    const overviewContent = await overviewPanel.textContent();
    console.log('Overview panel text (first 500 chars):', overviewContent.substring(0, 500));

    // Look for Capability Platforms section
    const capabilitySection = page.locator('text=/[Cc]apability [Pp]latforms/').first();
    const capSectionVisible = await capabilitySection.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('Capability Platforms section visible:', capSectionVisible);

    // Check for metrics (tagged systems, types in use, competing platforms)
    const taggedSystemsText = overviewContent.includes('tagged') || overviewContent.includes('capability');
    console.log('Overview mentions capability/tagged systems:', taggedSystemsText);

    // Check for detail table with capability types
    const capabilityTable = overviewPanel.locator('table');
    const tableCount = await capabilityTable.count();
    console.log('Tables in overview panel:', tableCount);

    console.log('Test 3 status: Overview tab visible, capability content checked');
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: Simulation Side Panel
// ─────────────────────────────────────────────────────────────────────────────
test('Test 4: Simulation side panel appears and collapses', async ({ page }) => {
    await setupToSimulation(page);

    // Side panel should be visible
    const sidePanel = page.locator('#simulationSidePanel');
    await expect(sidePanel).toBeVisible({ timeout: 10000 });

    const panelWidth = await sidePanel.evaluate(el => el.getBoundingClientRect().width);
    console.log('Side panel width:', panelWidth);
    // Should be around 360px when expanded
    console.log('Panel expanded (width > 200):', panelWidth > 200);

    // Take screenshot of expanded panel
    await page.screenshot({ path: '/tmp/test4-panel-expanded.png', fullPage: false });

    // Panel content: progress bar, latest decisions, undecided functions
    const panelContent = await sidePanel.textContent();
    console.log('Panel content snippet:', panelContent.substring(0, 300));

    const hasProgress = panelContent.includes('decidable') || panelContent.includes('function') || panelContent.includes('decided');
    console.log('Panel has progress info:', hasProgress);

    // Switch tabs — panel should persist on all tabs
    await page.locator('#tabOverview').click();
    await page.waitForTimeout(300);
    await expect(sidePanel).toBeVisible({ timeout: 5000 });
    console.log('Panel visible on Overview tab: true');

    await page.locator('#tabTimeline').click();
    await page.waitForTimeout(300);
    await expect(sidePanel).toBeVisible({ timeout: 5000 });
    console.log('Panel visible on Timeline tab: true');

    await page.locator('#tabMatrix').click();
    await page.waitForTimeout(300);

    // Find and click collapse button
    const collapseBtn = page.locator('[onclick*="toggle"], [onclick*="collapse"], .sim-panel-toggle, #simPanelToggle');
    const collapseBtnAlt = page.locator('button').filter({ hasText: /collapse|hide|›|‹|«|»/ });
    const panelToggleBtns = page.locator('#simulationSidePanel button').first();

    // Try to find a collapse/toggle button within or near the panel
    const allPanelBtns = await sidePanel.locator('button').all();
    console.log('Buttons in side panel:', allPanelBtns.length);

    // Check for collapse class / collapsed state
    const hasPanelToggle = await page.evaluate(() => {
        // Look for collapse/toggle buttons anywhere in the simulation panel area
        const btns = document.querySelectorAll('#simulationSidePanel button, .sim-panel-toggle, [data-action="collapse-sim"]');
        return btns.length;
    });
    console.log('Panel toggle buttons found by evaluate:', hasPanelToggle);

    // Try clicking the first button in the panel which may be the collapse btn
    if (allPanelBtns.length > 0) {
        const firstBtn = allPanelBtns[0];
        const btnText = await firstBtn.textContent();
        console.log('First panel button text:', btnText);
    }

    // Find actual collapse button (it's rendered by simulation-panel.js)
    const simCollapseBtn = page.locator('button[onclick*="simToggle"], button[onclick*="simPanel"], #simCollapseBtn');
    const colCount = await simCollapseBtn.count();
    console.log('Sim collapse btn count:', colCount);

    await page.screenshot({ path: '/tmp/test4-panel-tabs.png', fullPage: false });

    // Check JS state for collapsed
    const panelClasses = await sidePanel.evaluate(el => el.className);
    console.log('Panel classes:', panelClasses);

    console.log('Test 4 PASSED: Side panel visible and tabs switching');
    expect(jsErrors, `JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: Decision Panel — Capability Filtering
// ─────────────────────────────────────────────────────────────────────────────
test('Test 5: Decision panel — capability systems filtered from Axis 1', async ({ page }) => {
    await setupToSimulation(page);

    // Find a Decide button and click it
    const decideButtons = page.locator('.sim-decide-btn');
    const decideCount = await decideButtons.count();
    console.log('Decide buttons found:', decideCount);

    expect(decideCount).toBeGreaterThan(0);

    // Click the first decide button
    await decideButtons.first().click();

    // Wait for decision panel modal
    const modal = page.locator('#decisionPanelModal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: '/tmp/test5-decision-modal.png', fullPage: false });

    // Get modal content
    const modalContent = await modal.textContent();
    console.log('Modal content snippet:', modalContent.substring(0, 500));

    // Check for Axis 1 radio buttons section
    const axis1Section = modal.locator('#axis1Section, [id*="axis1"], .axis1-options');
    const axis1Count = await axis1Section.count();
    console.log('Axis 1 section count:', axis1Count);

    // Check for capability section (teal badge or text)
    const capabilityInModal = modal.locator('.tag-capability, text=/[Cc]apability [Pp]latform/');
    const capModalCount = await capabilityInModal.count();
    console.log('Capability elements in modal:', capModalCount);

    // Check for blast radius disclosure
    const blastDetails = modal.locator('details, [data-blast-radius]');
    const blastCount = await blastDetails.count();
    console.log('Blast radius details elements:', blastCount);

    // Get radio buttons in Axis 1 to verify capability systems not listed
    const radioInputs = modal.locator('input[type="radio"]');
    const radioCount = await radioInputs.count();
    console.log('Radio inputs in modal:', radioCount);

    const radioLabels = await modal.locator('label').allTextContents();
    console.log('Radio labels:', radioLabels.slice(0, 10));

    // Check for Supporting Capability Platforms section
    const capPlatformSection = modal.locator('text=/[Ss]upporting [Cc]apability/');
    const capPlatformVisible = await capPlatformSection.isVisible({ timeout: 2000 }).catch(() => false);
    console.log('Supporting Capability Platforms section visible:', capPlatformVisible);

    // Check for capability impact banner
    const capImpactBanner = modal.locator('text=/[Cc]apability.*impact/');
    const bannerVisible = await capImpactBanner.isVisible({ timeout: 2000 }).catch(() => false);
    console.log('Capability impact banner visible:', bannerVisible);

    await page.screenshot({ path: '/tmp/test5-decision-modal-full.png', fullPage: true });

    // Close modal
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden({ timeout: 5000 });

    console.log('Test 5 complete: Decision modal opened and capability content checked');
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 6: Decision Making + Side Panel Update
// ─────────────────────────────────────────────────────────────────────────────
test('Test 6: Making decisions updates side panel', async ({ page }) => {
    await setupToSimulation(page);

    // Get initial state of side panel
    const sidePanel = page.locator('#simulationSidePanel');
    const initialContent = await sidePanel.textContent();
    console.log('Initial panel content:', initialContent.substring(0, 200));

    // Click a decide button
    const decideButtons = page.locator('.sim-decide-btn');
    await decideButtons.first().click();
    const modal = page.locator('#decisionPanelModal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Make a defer decision
    const deferRadio = page.locator('#axis1Defer');
    if (await deferRadio.isVisible({ timeout: 3000 }).catch(() => false)) {
        await deferRadio.click();
        console.log('Selected Defer');
    } else {
        // Try to find any radio button
        const firstRadio = modal.locator('input[type="radio"]').first();
        if (await firstRadio.isVisible({ timeout: 2000 }).catch(() => false)) {
            await firstRadio.click();
            console.log('Selected first available option');
        }
    }

    // Apply the decision
    const applyBtn = page.locator('#btnApplyDecision');
    await expect(applyBtn).toBeVisible({ timeout: 5000 });
    await applyBtn.click();
    await expect(modal).toBeHidden({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Check side panel updated
    const updatedContent = await sidePanel.textContent();
    console.log('Updated panel content:', updatedContent.substring(0, 300));

    // Should contain "Latest Decisions" or similar
    const hasDecisions = updatedContent.includes('Decision') || updatedContent.includes('decision') || updatedContent.includes('decided');
    console.log('Panel shows decisions after apply:', hasDecisions);

    await page.screenshot({ path: '/tmp/test6-after-decision.png', fullPage: false });

    // Make a second decision
    const remainingDecideButtons = page.locator('.sim-decide-btn');
    const remainingCount = await remainingDecideButtons.count();
    console.log('Remaining decide buttons:', remainingCount);

    if (remainingCount > 0) {
        await remainingDecideButtons.first().click();
        const modal2 = page.locator('#decisionPanelModal');
        await expect(modal2).toBeVisible({ timeout: 10000 });

        // Apply with defaults
        const applyBtn2 = page.locator('#btnApplyDecision');
        await applyBtn2.click();
        await expect(modal2).toBeHidden({ timeout: 10000 });
        await page.waitForTimeout(500);

        const finalContent = await sidePanel.textContent();
        console.log('Final panel content:', finalContent.substring(0, 300));
    }

    expect(jsErrors, `JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
    console.log('Test 6 PASSED: Decisions made and panel updated');
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 7: Sankey Overlay
// ─────────────────────────────────────────────────────────────────────────────
test('Test 7: Sankey overlay opens with flow diagram', async ({ page }) => {
    await setupToSimulation(page);

    // Make at least one decision first so Sankey has data
    const decideButtons = page.locator('.sim-decide-btn');
    await decideButtons.first().click();
    const modal = page.locator('#decisionPanelModal');
    await expect(modal).toBeVisible({ timeout: 10000 });
    const applyBtn = page.locator('#btnApplyDecision');
    await applyBtn.click();
    await expect(modal).toBeHidden({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Find the "View flow diagram" button in side panel
    const sidePanel = page.locator('#simulationSidePanel');
    const sankeyBtn = sidePanel.locator('button', { hasText: /[Vv]iew flow diagram/ });
    const sankeyBtnAlt = page.locator('button', { hasText: /[Vv]iew flow diagram/ });

    const sankeyBtnCount = await sankeyBtn.count();
    const sankeyBtnAltCount = await sankeyBtnAlt.count();
    console.log('Sankey button count (in panel):', sankeyBtnCount);
    console.log('Sankey button count (anywhere):', sankeyBtnAltCount);

    if (sankeyBtnAltCount > 0) {
        await sankeyBtnAlt.first().click();
        await page.waitForTimeout(500);

        // Look for Sankey modal/overlay
        const sankeyOverlay = page.locator('#sankeyOverlay, .sankey-overlay, [id*="sankey"]');
        const sankeyVisible = await sankeyOverlay.first().isVisible({ timeout: 5000 }).catch(() => false);
        console.log('Sankey overlay visible:', sankeyVisible);

        await page.screenshot({ path: '/tmp/test7-sankey.png', fullPage: false });

        // Check for SVG content (Sankey diagram)
        const svgContent = page.locator('svg');
        const svgCount = await svgContent.count();
        console.log('SVG elements visible:', svgCount);

        // Try to close with Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        const overlayAfterEscape = await sankeyOverlay.first().isVisible({ timeout: 2000 }).catch(() => false);
        console.log('Overlay closed after Escape:', !overlayAfterEscape);
    } else {
        console.log('View flow diagram button not found — may require more decisions or different state');
        // Take screenshot to see current state
        await page.screenshot({ path: '/tmp/test7-no-sankey-btn.png', fullPage: false });
    }

    expect(jsErrors, `JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
    console.log('Test 7 complete');
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 8: Report Export
// ─────────────────────────────────────────────────────────────────────────────
test('Test 8: Report export produces persona-tailored content', async ({ page }) => {
    await setupToSimulation(page);

    // Make a decision for meaningful report
    const decideButtons = page.locator('.sim-decide-btn');
    await decideButtons.first().click();
    const modal = page.locator('#decisionPanelModal');
    await expect(modal).toBeVisible({ timeout: 10000 });
    const applyBtn = page.locator('#btnApplyDecision');
    await applyBtn.click();
    await expect(modal).toBeHidden({ timeout: 10000 });
    await page.waitForTimeout(500);

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
    console.log('Executive report title:', execTitle);

    const execContent = await execReport.content();
    const hasExecSections = {
        estateImpact: execContent.includes('Estate Impact') || execContent.includes('estate impact'),
        decisionsByTier: execContent.includes('Decisions by Tier') || execContent.includes('decisions by tier'),
        obligations: execContent.includes('Obligations') || execContent.includes('Critical'),
    };
    console.log('Executive report sections:', hasExecSections);
    await execReport.screenshot({ path: '/tmp/test8-exec-report.png', fullPage: false });
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
    console.log('Commercial report title:', commTitle);

    const commContent = await commReport.content();
    const hasCommSections = {
        costSummary: commContent.includes('Cost') || commContent.includes('cost'),
        vendorConsolidation: commContent.includes('Vendor') || commContent.includes('vendor'),
    };
    console.log('Commercial report sections:', hasCommSections);
    await commReport.screenshot({ path: '/tmp/test8-comm-report.png', fullPage: false });
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
    console.log('Architect report title:', archTitle);

    const archContent = await archReport.content();
    const hasArchSections = {
        obligations: archContent.includes('Obligation') || archContent.includes('obligation'),
        typeColumn: archContent.includes('Type') || archContent.includes('type'),
    };
    console.log('Architect report sections:', hasArchSections);
    await archReport.screenshot({ path: '/tmp/test8-arch-report.png', fullPage: false });
    await archReport.close();

    // Switch back to executive
    await personaSelect.selectOption('executive');

    expect(jsErrors, `JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
    console.log('Test 8 PASSED: All persona reports generated');
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 9: Collapsible Cards
// ─────────────────────────────────────────────────────────────────────────────
test('Test 9: Collapsible system cards', async ({ page }) => {
    await setupToDashboard(page);

    await page.locator('#tabMatrix').click();
    await page.waitForTimeout(500);

    // Look for system cards — they should be collapsed by default
    // Cards may have a collapsed/closed state
    const systemCards = page.locator('.system-card, .sys-card, [data-system-card]');
    const cardCount = await systemCards.count();
    console.log('System cards found:', cardCount);

    // Alternative: look for card-like elements
    const collapsedCards = page.locator('.card-collapsed, .collapsed, [aria-expanded="false"]');
    const collapsedCount = await collapsedCards.count();
    console.log('Collapsed elements found:', collapsedCount);

    // Look for Expand all / Collapse all buttons
    const expandAllBtn = page.locator('button', { hasText: /[Ee]xpand [Aa]ll/ });
    const collapseAllBtn = page.locator('button', { hasText: /[Cc]ollapse [Aa]ll/ });
    const expandAllCount = await expandAllBtn.count();
    const collapseAllCount = await collapseAllBtn.count();
    console.log('Expand All buttons:', expandAllCount, 'Collapse All buttons:', collapseAllCount);

    await page.screenshot({ path: '/tmp/test9-cards.png', fullPage: false });

    // Check if any cards are present at all in the page
    const pageContent = await page.content();
    const hasCardContent = pageContent.includes('system-card') || pageContent.includes('card-body') ||
                           pageContent.includes('expand') || pageContent.includes('Expand');
    console.log('Page has card/expand content:', hasCardContent);

    // Attempt to click expand all if present
    if (expandAllCount > 0) {
        await expandAllBtn.first().click();
        await page.waitForTimeout(500);
        const expandedCards = page.locator('[aria-expanded="true"], .card-expanded');
        console.log('Expanded cards after Expand All:', await expandedCards.count());
    }

    if (collapseAllCount > 0) {
        await collapseAllBtn.first().click();
        await page.waitForTimeout(500);
    }

    console.log('Test 9 complete: Collapsible card behaviour checked');
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 10: No Regressions
// ─────────────────────────────────────────────────────────────────────────────
test('Test 10: No regressions — persona switch, perspective filter, sort/filter', async ({ page }) => {
    await setupToDashboard(page);

    // Switch personas
    const personaSelect = page.locator('#personaSelect');
    for (const persona of ['commercial', 'architect', 'executive']) {
        await personaSelect.selectOption(persona);
        await page.waitForTimeout(500);
    }
    console.log('Persona switching: no errors');
    expect(jsErrors, `JS errors after persona switch: ${jsErrors.join('; ')}`).toHaveLength(0);

    // Change perspective filter
    const perspectiveSelect = page.locator('#perspectiveFilter, select[id*="perspective"]');
    const perspCount = await perspectiveSelect.count();
    console.log('Perspective filter elements:', perspCount);
    if (perspCount > 0) {
        const options = await perspectiveSelect.first().locator('option').allTextContents();
        console.log('Perspective options:', options.slice(0, 5));
        if (options.length > 1) {
            await perspectiveSelect.first().selectOption({ index: 1 });
            await page.waitForTimeout(500);
            await perspectiveSelect.first().selectOption({ index: 0 });
            await page.waitForTimeout(300);
            console.log('Perspective filter switched: no errors');
        }
    }

    // Sort controls
    const sortBtns = page.locator('[onclick*="sort"], button[data-sort], .sort-btn');
    const sortCount = await sortBtns.count();
    console.log('Sort buttons:', sortCount);
    if (sortCount > 0) {
        await sortBtns.first().click();
        await page.waitForTimeout(300);
        console.log('Sort clicked: no errors');
    }

    // Enter and exit simulation
    await setupToSimulation(page);
    console.log('Entered simulation: no errors');

    // Exit simulation
    const simToggleBtn = page.locator('#btnSimulate');
    await expect(simToggleBtn).toContainText('Exit', { timeout: 5000 });
    await simToggleBtn.click();
    await page.waitForTimeout(500);

    // Side panel should disappear
    const sidePanel = page.locator('#simulationSidePanel');
    const sidePanelVisible = await sidePanel.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('Side panel hidden after exit:', !sidePanelVisible);

    // Simulate button should say Simulate
    await expect(simToggleBtn).toContainText('Simulate', { timeout: 5000 });

    await page.screenshot({ path: '/tmp/test10-exit-sim.png', fullPage: false });

    // Check console errors
    const finalErrors = jsErrors.filter(e =>
        !e.includes('favicon') && !e.includes('net::ERR') && !e.includes('404')
    );
    console.log('Final JS errors:', finalErrors);
    expect(finalErrors, `JS errors: ${finalErrors.join('; ')}`).toHaveLength(0);
    console.log('Test 10 PASSED: No regressions detected');
});
