/**
 * Evaluator tests for Sprint report-refinements-1
 * Tests WI-1 through WI-6
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:8765/lgr-rationalisation-engine.html';

// Use example 05 (3 councils: oakham county, brackley district, winsford district)
const EXAMPLE_DIR = path.resolve(
    __dirname,
    '../../examples/05-erp-entanglement-trap'
);

const ARCH_FILES = [
    path.join(EXAMPLE_DIR, 'oakham-county.json'),
    path.join(EXAMPLE_DIR, 'brackley-district.json'),
    path.join(EXAMPLE_DIR, 'winsford-district.json'),
    path.join(EXAMPLE_DIR, 'transition-config.json'),
];

/**
 * Navigate all stages to reach the simulation dashboard.
 * Returns once simulation mode is active and decide buttons are visible.
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

    // Wait for simulation UI (decide buttons) and Export Report button
    await page.waitForFunction(() => !!document.querySelector('.sim-decide-btn'), { timeout: 20000 });
    await page.waitForFunction(() => {
        const btn = document.getElementById('btnExportReport');
        return btn && !btn.classList.contains('hidden');
    }, { timeout: 10000 });
    await page.waitForTimeout(500);
}

/**
 * Make a choose decision for the first decidable function.
 * Returns after the decision is applied.
 */
async function makeChooseDecision(page) {
    const decideBtns = page.locator('.sim-decide-btn');
    const count = await decideBtns.count();
    if (count === 0) throw new Error('No decide buttons found');

    await decideBtns.first().click();
    await page.waitForSelector('#decisionPanelModal:not(.hidden)', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Select "choose existing system"
    await page.locator('#axis1Choose').click();
    await page.waitForTimeout(300);

    // Choose the first available system radio
    const sysRadios = page.locator('input[name="chooseSystem"]');
    const radioCount = await sysRadios.count();
    if (radioCount > 0) {
        await sysRadios.first().click();
        await page.waitForTimeout(200);
    }

    // Apply decision
    await page.locator('#btnApplyDecision').click();
    await page.waitForFunction(() => {
        const modal = document.getElementById('decisionPanelModal');
        return !modal || modal.classList.contains('hidden');
    }, { timeout: 10000 });
    await page.waitForTimeout(500);
}

/**
 * Make a defer decision for the second decidable function.
 */
async function makeDeferDecision(page) {
    const decideBtns = page.locator('.sim-decide-btn');
    const count = await decideBtns.count();
    if (count < 1) throw new Error('No defer-able decide buttons found');

    // Click the first available decide button
    await decideBtns.first().click();
    await page.waitForSelector('#decisionPanelModal:not(.hidden)', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Select "defer"
    const deferRadio = page.locator('#axis1Defer, input[value="defer"][name="axis1Choice"]');
    const deferVisible = await deferRadio.isVisible().catch(() => false);
    if (deferVisible) {
        await deferRadio.click();
        await page.waitForTimeout(300);
    }

    // Apply decision
    await page.locator('#btnApplyDecision').click();
    await page.waitForFunction(() => {
        const modal = document.getElementById('decisionPanelModal');
        return !modal || modal.classList.contains('hidden');
    }, { timeout: 10000 });
    await page.waitForTimeout(500);
}

/**
 * Open a persona-specific report in a new tab.
 * Returns the new page.
 */
async function openReport(page, persona) {
    // Set persona
    await page.locator('#personaSelect').selectOption(persona);
    await page.waitForTimeout(500);

    // Open report in new tab
    const exportBtn = page.locator('#btnExportReport');
    await expect(exportBtn).toBeVisible({ timeout: 10000 });

    const [newPage] = await Promise.all([
        page.context().waitForEvent('page'),
        exportBtn.click()
    ]);
    await newPage.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {});
    await newPage.waitForTimeout(2000);
    return newPage;
}

test.describe('Sprint report-refinements-1 evaluation', () => {
    test.setTimeout(180000);

    test('WI-5: Commercial Report has Procurement Action Timeline section', async ({ page }) => {
        const jsErrors = [];
        page.on('pageerror', err => jsErrors.push(err.message));

        await setupToSimulation(page);
        // Make decisions so timeline has data
        await makeChooseDecision(page);
        await makeDeferDecision(page);

        await page.screenshot({ path: '/tmp/eval-wi5-before-export.png' });

        const newPage = await openReport(page, 'commercial');
        const reportContent = await newPage.content();
        await newPage.screenshot({ path: '/tmp/eval-wi5-commercial-report.png' });
        fs.writeFileSync('/tmp/eval-commercial-report.html', reportContent);

        // Check for Procurement Action Timeline section
        const hasProcurementTimeline = reportContent.includes('Procurement Action Timeline');
        console.log('[WI-5] Has Procurement Action Timeline:', hasProcurementTimeline);

        // Check table columns
        const hasNoticeTriggerCol = reportContent.includes('Notice Trigger');
        const hasVestingContextCol = reportContent.includes('Vesting Context');
        const hasActionRequiredCol = reportContent.includes('Action Required');
        const hasSystemCol = reportContent.includes('>System<');
        const hasVendorCol = reportContent.includes('>Vendor<');
        console.log('[WI-5] Notice Trigger col:', hasNoticeTriggerCol);
        console.log('[WI-5] Vesting Context col:', hasVestingContextCol);
        console.log('[WI-5] Action Required col:', hasActionRequiredCol);
        console.log('[WI-5] System col:', hasSystemCol);
        console.log('[WI-5] Vendor col:', hasVendorCol);

        // Check action required values
        const hasNovate = reportContent.includes('Novate') || reportContent.includes('novate');
        const hasDeferredAction = reportContent.includes('Decision needed') || reportContent.includes('deferred');
        const hasServeNotice = reportContent.includes('Serve notice') || reportContent.includes('serve notice');
        console.log('[WI-5] Has Novate/renew action:', hasNovate);
        console.log('[WI-5] Has Deferred action:', hasDeferredAction);
        console.log('[WI-5] Has Serve notice action:', hasServeNotice);

        // Check sort order (rows should be sorted by date)
        // We check that dates are present
        const dateMatches = reportContent.match(/20[0-9]{2}-[0-9]{2}/g) || [];
        console.log('[WI-5] Date entries found in report:', dateMatches.length);

        expect(hasProcurementTimeline, 'Procurement Action Timeline section should exist').toBe(true);
        expect(hasNoticeTriggerCol, 'Notice Trigger column should exist').toBe(true);
        expect(hasVestingContextCol, 'Vesting Context column should exist').toBe(true);
        expect(hasActionRequiredCol, 'Action Required column should exist').toBe(true);

        await newPage.close();
        const critErrors = jsErrors.filter(e => !e.includes('favicon') && !e.includes('net::ERR'));
        expect(critErrors, `JS errors: ${critErrors.join('; ')}`).toHaveLength(0);
    });

    test('WI-4: Deferred functions show parallel systems detail in Commercial report', async ({ page }) => {
        const jsErrors = [];
        page.on('pageerror', err => jsErrors.push(err.message));

        await setupToSimulation(page);
        await makeDeferDecision(page);

        const newPage = await openReport(page, 'commercial');
        const reportContent = await newPage.content();
        await newPage.screenshot({ path: '/tmp/eval-wi4-deferred-section.png' });
        fs.writeFileSync('/tmp/eval-commercial-report-wi4.html', reportContent);

        // Check for defer-related text
        const hasDeferText = reportContent.includes('Defer') || reportContent.includes('deferred') ||
                             reportContent.includes('no consolidation decision');
        console.log('[WI-4] Has defer text in report:', hasDeferText);

        // Check for parallel systems display
        const hasParallelSystems = reportContent.includes('parallel') ||
                                   reportContent.includes('Systems running') ||
                                   reportContent.includes('running in parallel');
        console.log('[WI-4] Has parallel systems:', hasParallelSystems);

        // Check for system detail (vendor, cost, contract end)
        const hasVendorDetail = reportContent.match(/Vendor|vendor/) !== null;
        const hasCostDetail = reportContent.match(/£[0-9]|annual cost|cost/i) !== null;
        console.log('[WI-4] Has vendor detail:', hasVendorDetail);
        console.log('[WI-4] Has cost detail:', hasCostDetail);

        expect(hasDeferText, 'Report should contain defer/deferred section').toBe(true);

        await newPage.close();
        const critErrors = jsErrors.filter(e => !e.includes('favicon') && !e.includes('net::ERR'));
        expect(critErrors, `JS errors: ${critErrors.join('; ')}`).toHaveLength(0);
    });

    test('WI-3: Commercial Report shows vesting-relative date framing', async ({ page }) => {
        const jsErrors = [];
        page.on('pageerror', err => jsErrors.push(err.message));

        await setupToSimulation(page);
        // Make a defer decision so the report has contract notice data with vesting context
        await makeDeferDecision(page);

        const newPage = await openReport(page, 'commercial');
        const reportContent = await newPage.content();
        await newPage.screenshot({ path: '/tmp/eval-wi3-vesting-relative.png' });

        // Check for vesting-relative framing
        const hasBeforeVesting = reportContent.includes('before vesting');
        const hasAfterVesting = reportContent.includes('after vesting');
        const hasAtVesting = reportContent.includes('at vesting');
        const hasMonthsRelative = reportContent.includes('months before') || reportContent.includes('months after');
        const hasOverdue = reportContent.includes('OVERDUE');
        const hasVestingRelative = hasBeforeVesting || hasAfterVesting || hasAtVesting || hasMonthsRelative || hasOverdue;

        console.log('[WI-3] Before vesting:', hasBeforeVesting);
        console.log('[WI-3] After vesting:', hasAfterVesting);
        console.log('[WI-3] At vesting:', hasAtVesting);
        console.log('[WI-3] Months relative:', hasMonthsRelative);
        console.log('[WI-3] OVERDUE:', hasOverdue);
        console.log('[WI-3] Has vesting-relative framing:', hasVestingRelative);

        // Check notice trigger label format
        const hasNoticeTriggerLabel = reportContent.includes('Notice trigger') ||
                                      reportContent.includes('Notice Trigger');
        console.log('[WI-3] Has notice trigger label:', hasNoticeTriggerLabel);

        expect(hasVestingRelative, 'Report should show vesting-relative date framing').toBe(true);
        expect(hasNoticeTriggerLabel, 'Report should show notice trigger labels').toBe(true);

        await newPage.close();
        const critErrors = jsErrors.filter(e => !e.includes('favicon') && !e.includes('net::ERR'));
        expect(critErrors, `JS errors: ${critErrors.join('; ')}`).toHaveLength(0);
    });

    test('WI-1: Architect Report obligations table has To System column', async ({ page }) => {
        const jsErrors = [];
        page.on('pageerror', err => jsErrors.push(err.message));

        await setupToSimulation(page);
        await makeChooseDecision(page);

        const newPage = await openReport(page, 'architect');
        const reportContent = await newPage.content();
        await newPage.screenshot({ path: '/tmp/eval-wi1-architect-report.png' });
        fs.writeFileSync('/tmp/eval-architect-report.html', reportContent);

        // Check for obligations table section
        const hasObligationsSection = reportContent.includes('Obligation') || reportContent.includes('Migration');
        console.log('[WI-1] Has obligations section:', hasObligationsSection);

        // Check for "To System" column header
        const hasToSystemCol = reportContent.includes('To System');
        console.log('[WI-1] Has To System column:', hasToSystemCol);

        // Check for "From System" column header
        const hasFromSystemCol = reportContent.includes('From System');
        console.log('[WI-1] Has From System column:', hasFromSystemCol);

        // Check column order: From System before To System
        const fromPos = reportContent.indexOf('From System');
        const toPos = reportContent.indexOf('To System');
        const correctOrder = fromPos < toPos;
        console.log('[WI-1] From System pos:', fromPos, 'To System pos:', toPos, 'Correct order:', correctOrder);

        expect(hasObligationsSection, 'Architect report should have obligations section').toBe(true);
        expect(hasToSystemCol, 'Architect obligations table should have To System column').toBe(true);
        expect(hasFromSystemCol, 'Architect obligations table should have From System column').toBe(true);
        expect(correctOrder, 'From System column should come before To System').toBe(true);

        await newPage.close();
        const critErrors = jsErrors.filter(e => !e.includes('favicon') && !e.includes('net::ERR'));
        expect(critErrors, `JS errors: ${critErrors.join('; ')}`).toHaveLength(0);
    });

    test('WI-2: Architect Report has Technical posture summary narrative box', async ({ page }) => {
        const jsErrors = [];
        page.on('pageerror', err => jsErrors.push(err.message));

        await setupToSimulation(page);
        // Make a decision so post-simulation data exists for narrative
        await makeChooseDecision(page);

        const newPage = await openReport(page, 'architect');
        const reportContent = await newPage.content();
        await newPage.screenshot({ path: '/tmp/eval-wi2-narrative.png' });

        // Check for Technical Summary section
        const hasTechnicalSummary = reportContent.includes('Technical Summary') ||
                                    reportContent.includes('Technical summary');
        console.log('[WI-2] Has Technical Summary section:', hasTechnicalSummary);

        // Check for narrative synthesis box ("Technical posture summary")
        const hasNarrativeSummaryBox = reportContent.includes('Technical posture summary');
        console.log('[WI-2] Has narrative posture summary box:', hasNarrativeSummaryBox);

        // Check for specific bullet patterns
        const hasERPBullet = reportContent.includes('ERP footprint');
        const hasTotalSystemsBullet = reportContent.includes('Total unique systems') ||
                                      reportContent.includes('unique systems reduce') ||
                                      reportContent.includes('unique systems increase');
        const hasOnPremBullet = reportContent.includes('On-premise systems');
        console.log('[WI-2] Has ERP footprint bullet:', hasERPBullet);
        console.log('[WI-2] Has total systems bullet:', hasTotalSystemsBullet);
        console.log('[WI-2] Has on-prem bullet:', hasOnPremBullet);

        // Check for purple left border styling
        const hasPurpleBorder = reportContent.includes('#4c2c92') || reportContent.includes('4c2c92');
        const hasGreyBackground = reportContent.includes('#f3f2f1') || reportContent.includes('f3f2f1');
        console.log('[WI-2] Has purple border:', hasPurpleBorder);
        console.log('[WI-2] Has grey background:', hasGreyBackground);

        expect(hasTechnicalSummary, 'Architect report should have Technical Summary section').toBe(true);
        expect(hasNarrativeSummaryBox, 'Architect report should have Technical posture summary box').toBe(true);
        expect(hasERPBullet || hasTotalSystemsBullet || hasOnPremBullet,
            'Narrative box should contain natural language bullets').toBe(true);

        await newPage.close();
        const critErrors = jsErrors.filter(e => !e.includes('favicon') && !e.includes('net::ERR'));
        expect(critErrors, `JS errors: ${critErrors.join('; ')}`).toHaveLength(0);
    });

    test('WI-6: Notification appears below header bar, not overlapping', async ({ page }) => {
        const jsErrors = [];
        page.on('pageerror', err => jsErrors.push(err.message));

        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);

        // Check notification area DOM positioning
        const positionCheck = await page.evaluate(() => {
            const header = document.querySelector('header');
            const notifArea = document.getElementById('notificationArea');
            if (!header || !notifArea) return { error: 'Missing elements' };

            const styles = getComputedStyle(notifArea);
            return {
                headerZIndex: parseInt(getComputedStyle(header).zIndex) || 0,
                notifZIndex: parseInt(styles.zIndex) || 0,
                notifPosition: styles.position,
                notifTop: styles.top,
                // Check notificationArea is a sibling/child after header (DOM order)
                headerInnerHTML: header.className,
                notifAreaClass: notifArea.className,
                // Check DOM order: is notification area after header?
                docOrderCorrect: header.compareDocumentPosition(notifArea) & Node.DOCUMENT_POSITION_FOLLOWING
            };
        });
        console.log('[WI-6] Position check:', JSON.stringify(positionCheck));

        // The notification area should be positioned after the header in DOM
        expect(positionCheck.docOrderCorrect, 'Notification area should come after header in DOM').toBeTruthy();
        // Notification z-index should be > header z-index (notifications should appear on top of content but below modals)
        console.log('[WI-6] Header z-index:', positionCheck.headerZIndex);
        console.log('[WI-6] Notification z-index:', positionCheck.notifZIndex);

        // Trigger a notification by uploading an invalid JSON file
        fs.writeFileSync('/tmp/invalid-test.json', '{ "not": "a valid architecture file }');
        const fileInput = page.locator('#fileInput');
        await fileInput.setInputFiles('/tmp/invalid-test.json');
        await page.waitForTimeout(1500);

        await page.screenshot({ path: '/tmp/eval-wi6-notification.png' });

        // Get positions of header and notification
        const layoutCheck = await page.evaluate(() => {
            const header = document.querySelector('header');
            const notifications = document.querySelectorAll('.app-notification');
            if (!header) return { error: 'No header' };

            const headerRect = header.getBoundingClientRect();
            const results = [];
            notifications.forEach((notif, i) => {
                const notifRect = notif.getBoundingClientRect();
                results.push({
                    notifIndex: i,
                    notifTop: notifRect.top,
                    notifBottom: notifRect.bottom,
                    headerTop: headerRect.top,
                    headerBottom: headerRect.bottom,
                    // Is notification top below (or at) header bottom?
                    isBelow: notifRect.top >= headerRect.bottom - 5 // 5px tolerance
                });
            });
            return {
                headerBottom: headerRect.bottom,
                notificationCount: notifications.length,
                notifications: results
            };
        });
        console.log('[WI-6] Layout check:', JSON.stringify(layoutCheck));

        if (layoutCheck.notificationCount > 0) {
            const allBelow = layoutCheck.notifications.every(n => n.isBelow);
            console.log('[WI-6] All notifications below header:', allBelow);
            expect(allBelow, 'All notifications should appear below the header bar').toBe(true);
        } else {
            // No notification appeared - try uploading a valid non-JSON file
            console.log('[WI-6] No notification visible - checking DOM structure');
            // At minimum verify the DOM structure is correct (notification area is after header)
            const domCheck = await page.evaluate(() => {
                const notifArea = document.getElementById('notificationArea');
                const header = document.querySelector('header');
                const isAfterHeader = header && notifArea &&
                    (header.compareDocumentPosition(notifArea) & Node.DOCUMENT_POSITION_FOLLOWING);
                return { isAfterHeader: !!isAfterHeader };
            });
            console.log('[WI-6] Notification area after header in DOM:', domCheck.isAfterHeader);
            expect(domCheck.isAfterHeader, 'Notification area should be after header in DOM').toBe(true);
        }

        const critErrors = jsErrors.filter(e => !e.includes('favicon') && !e.includes('net::ERR'));
        expect(critErrors, `JS errors: ${critErrors.join('; ')}`).toHaveLength(0);
    });

});
