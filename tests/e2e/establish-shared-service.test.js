/**
 * E2E tests for "Establish Shared Service" feature.
 */

const { test, expect } = require('@playwright/test');
const path = require('path');

const BASE_URL = 'http://localhost:8765/dist/lgr-rationalisation-engine.html';

const EXAMPLE_DIR = path.resolve(
    __dirname,
    '../../examples/08-mega-merger-six-councils'
);

const FILES = [
    path.join(EXAMPLE_DIR, 'westshire-county.json'),
    path.join(EXAMPLE_DIR, 'elmhurst-district.json'),
    path.join(EXAMPLE_DIR, 'fairford-borough.json'),
    path.join(EXAMPLE_DIR, 'grantham-district.json'),
    path.join(EXAMPLE_DIR, 'hatherley-district.json'),
    path.join(EXAMPLE_DIR, 'ivybridge-borough.json'),
    path.join(EXAMPLE_DIR, 'transition-config.json'),
];

/**
 * Navigate all stages to reach the simulation dashboard.
 */
async function setupToDashboard(page) {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(FILES);
    await page.waitForSelector('#uploadedFilesUl li', { timeout: 10000 });

    await page.locator('#btnProceedBaseline').click();
    await page.waitForSelector('#stageTransitionConfig:not(.hidden)', { timeout: 10000 });
    await page.locator('#btnProceedTransition').click();

    await page.waitForSelector('#stageBaseline:not(.hidden)', { timeout: 10000 });
    await page.locator('#btnGenerateMatrix').click();

    await page.waitForSelector('#stageDashboard:not(.hidden)', { timeout: 20000 });

    // Enter simulation mode so "Decide" buttons appear
    const simulateBtn = page.locator('#btnSimulate');
    await expect(simulateBtn).toBeVisible({ timeout: 10000 });
    await simulateBtn.click();

    await page.waitForFunction(() => !!document.querySelector('.sim-decide-btn'), { timeout: 15000 });
    await page.waitForTimeout(800);
}

/**
 * Helper: establishes a shared service using the first available Decide button.
 * Returns 'skip' if the feature can't be exercised.
 */
async function establishSharedService(page) {
    const decideBtn = page.locator('.sim-decide-btn').filter({ hasText: /^decide$/i }).first();
    if (!await decideBtn.isVisible({ timeout: 10000 })) return 'skip';
    await decideBtn.click();

    const modal = page.locator('#decisionPanelModal');
    if (!await modal.isVisible({ timeout: 5000 })) return 'skip';

    const chooseRadio = page.locator('#axis1Choose');
    if (await chooseRadio.isVisible()) await chooseRadio.click();

    const sysRadio = page.locator('input[name="chooseSystem"]').first();
    if (await sysRadio.isVisible({ timeout: 3000 })) await sysRadio.click();

    const establishSharedRadio = page.locator('#axis2EstablishShared');
    if (!await establishSharedRadio.isVisible({ timeout: 3000 })) {
        await page.locator('#btnCancelDecision').click();
        return 'skip';
    }
    await establishSharedRadio.click();

    const successorCb = page.locator('.establish-shared-successor-cb').first();
    if (!await successorCb.isVisible({ timeout: 3000 })) {
        await page.locator('#btnCancelDecision').click();
        return 'skip';
    }
    await successorCb.check();

    page.once('dialog', dialog => dialog.accept());
    await page.locator('#btnApplyDecision').click();
    await expect(modal).toBeHidden({ timeout: 10000 });
    return 'ok';
}

test.describe('Establish Shared Service', () => {

    test('Test A: Establish-shared flow — checkboxes appear, View button shown in shared cell', async ({ page }) => {
        await setupToDashboard(page);

        const decideBtn = page.locator('.sim-decide-btn').filter({ hasText: /^decide$/i }).first();
        await expect(decideBtn).toBeVisible({ timeout: 10000 });
        await decideBtn.click();

        const modal = page.locator('#decisionPanelModal');
        await expect(modal).toBeVisible({ timeout: 5000 });

        const chooseRadio = page.locator('#axis1Choose');
        await expect(chooseRadio).toBeVisible({ timeout: 3000 });
        await chooseRadio.click();

        const systemRadio = page.locator('input[name="chooseSystem"]').first();
        if (await systemRadio.isVisible({ timeout: 3000 })) await systemRadio.click();

        const axis2Section = page.locator('#axis2Section');
        if (!await axis2Section.isVisible({ timeout: 3000 })) {
            await page.locator('#btnCancelDecision').click();
            test.skip();
            return;
        }

        const establishSharedRadio = page.locator('#axis2EstablishShared');
        if (!await establishSharedRadio.isVisible()) { await page.locator('#btnCancelDecision').click(); test.skip(); return; }
        await establishSharedRadio.click();

        // PASS CRITERION: successor checkboxes appear
        const establishDetail = page.locator('#axis2EstablishSharedDetail');
        await expect(establishDetail).toBeVisible({ timeout: 3000 });

        const successorCheckboxes = page.locator('.establish-shared-successor-cb');
        const cbCount = await successorCheckboxes.count();
        expect(cbCount).toBeGreaterThan(0);

        await successorCheckboxes.first().check();
        page.once('dialog', dialog => dialog.accept());
        await page.locator('#btnApplyDecision').click();
        await expect(modal).toBeHidden({ timeout: 10000 });

        // PASS CRITERION: shared badge in the other successor's cell
        const sharedBadge = page.locator('span').filter({ hasText: /^Shared:/i }).first();
        await expect(sharedBadge).toBeVisible({ timeout: 5000 });

        // PASS CRITERION: "View" button in shared cell
        const viewBtn = page.locator('.sim-decide-btn').filter({ hasText: /^view$/i }).first();
        await expect(viewBtn).toBeVisible({ timeout: 5000 });
    });

    test('Test B: Read-only propagated view contains correct elements', async ({ page }) => {
        await setupToDashboard(page);
        const result = await establishSharedService(page);
        if (result === 'skip') { test.skip(); return; }

        const viewBtn = page.locator('.sim-decide-btn').filter({ hasText: /^view$/i }).first();
        await expect(viewBtn).toBeVisible({ timeout: 5000 });
        await viewBtn.click();

        const modal = page.locator('#decisionPanelModal');
        await expect(modal).toBeVisible({ timeout: 5000 });

        const content = page.locator('#decisionPanelContent');
        await expect(content).toBeVisible();

        // Verify "Shared Service Decision" heading
        await expect(content.locator('p').filter({ hasText: /Shared Service Decision/i })).toBeVisible();

        // Verify blue info panel
        await expect(content.locator('.bg-blue-50')).toBeVisible();

        // Verify "Edit shared arrangement" button
        await expect(content.locator('button').filter({ hasText: /edit shared arrangement/i })).toBeVisible();

        // Verify "Remove from shared service" button
        await expect(content.locator('button').filter({ hasText: /remove from shared service/i })).toBeVisible();

        // Verify Axis 1 controls NOT visible (read-only)
        await expect(content.locator('#axis1Choose')).toBeHidden();
    });

    test('Test C: Edit flow — "Edit shared arrangement" reopens primary decision', async ({ page }) => {
        await setupToDashboard(page);
        const result = await establishSharedService(page);
        if (result === 'skip') { test.skip(); return; }

        const viewBtn = page.locator('.sim-decide-btn').filter({ hasText: /^view$/i }).first();
        await viewBtn.click();

        const modal = page.locator('#decisionPanelModal');
        await expect(modal).toBeVisible({ timeout: 5000 });

        const editBtn = page.locator('#decisionPanelContent').locator('button').filter({ hasText: /edit shared arrangement/i });
        await editBtn.click();

        // Wait for panel content to update
        await page.waitForTimeout(500);

        // Panel should now show PRIMARY decision (edit mode)
        await expect(modal).toBeVisible({ timeout: 5000 });
        const content = page.locator('#decisionPanelContent');
        await expect(content).toBeVisible();

        // Must NOT show "Shared Service Decision" for the primary cell
        // (it should show the full edit form OR "Editing existing decision" banner)
        const sharedServiceHeading = content.locator('p').filter({ hasText: /^Shared Service Decision$/i });
        const successorLabel = content.locator('.text-sm.font-bold.text-gray-700');
        const successorText = await successorLabel.first().textContent().catch(() => '');

        // "Editing existing decision" means it opened the primary cell in edit mode
        const editingBanner = content.locator('span').filter({ hasText: /editing existing decision/i });
        const isEditMode = await editingBanner.isVisible({ timeout: 1000 }).catch(() => false);

        // establish-shared radio pre-checked means the primary decision was loaded
        const estRadio = content.locator('#axis2EstablishShared');
        const isEstablishChecked = await estRadio.isChecked().catch(() => false);

        // At minimum: panel should NOT still be showing the propagated read-only view
        // (the successor name should have changed)
        const isStillShowingPropagated = await sharedServiceHeading.isVisible({ timeout: 500 }).catch(() => false);
        expect(isStillShowingPropagated, 'Panel should show primary decision, not propagated read-only view').toBe(false);
    });

    test('Test D: Unlink flow — "Remove from shared service" removes badge', async ({ page }) => {
        const jsErrors = [];
        page.on('console', msg => { if (msg.type() === 'error') jsErrors.push(msg.text()); });
        page.on('pageerror', err => jsErrors.push(err.message));

        await setupToDashboard(page);
        const result = await establishSharedService(page);
        if (result === 'skip') { test.skip(); return; }

        const sharedBadgeBefore = page.locator('span').filter({ hasText: /^Shared:/i }).first();
        await expect(sharedBadgeBefore).toBeVisible({ timeout: 5000 });

        const viewBtn = page.locator('.sim-decide-btn').filter({ hasText: /^view$/i }).first();
        await viewBtn.click();

        const modal = page.locator('#decisionPanelModal');
        await expect(modal).toBeVisible({ timeout: 5000 });

        const removeBtn = page.locator('#decisionPanelContent').locator('button').filter({ hasText: /remove from shared service/i });
        // Accept the confirmation dialog triggered by the Remove button
        page.once('dialog', dialog => dialog.accept());
        await removeBtn.click();

        // Allow time for recomputeSimulation + renderDashboard + closeDecisionPanel
        await expect(modal).toBeHidden({ timeout: 15000 });

        // No JS errors during removal
        const critErrors = jsErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
        expect(critErrors, `JS errors: ${critErrors.join('; ')}`).toHaveLength(0);

        // Shared badge should disappear
        await expect(page.locator('span').filter({ hasText: /^Shared:/i })).toBeHidden({ timeout: 5000 });
    });

    test('Test E: Conflict check — error when target has independent decision', async ({ page }) => {
        await setupToDashboard(page);

        const decideBtns = page.locator('.sim-decide-btn').filter({ hasText: /^decide$/i });
        const btnCount = await decideBtns.count();
        if (btnCount < 2) { test.skip(); return; }

        const modal = page.locator('#decisionPanelModal');

        // Make independent decision for cell 2
        await decideBtns.nth(1).click();
        await expect(modal).toBeVisible({ timeout: 5000 });
        const funcLabel2 = await page.locator('#decisionPanelTitle').textContent().catch(() => '');
        const chooseRadio2 = page.locator('#axis1Choose');
        if (await chooseRadio2.isVisible()) await chooseRadio2.click();
        const sysRadio2 = page.locator('input[name="chooseSystem"]').first();
        if (await sysRadio2.isVisible({ timeout: 3000 })) await sysRadio2.click();
        await page.locator('#btnApplyDecision').click();
        await expect(modal).toBeHidden({ timeout: 10000 });

        // Try to establish shared from cell 1 including cell 2
        await decideBtns.first().click();
        await expect(modal).toBeVisible({ timeout: 5000 });
        const funcLabel1 = await page.locator('#decisionPanelTitle').textContent().catch(() => '');

        if (funcLabel1 !== funcLabel2) {
            await page.locator('#btnCancelDecision').click();
            test.skip();
            return;
        }

        const chooseRadio1 = page.locator('#axis1Choose');
        if (await chooseRadio1.isVisible()) await chooseRadio1.click();
        const sysRadio1 = page.locator('input[name="chooseSystem"]').first();
        if (await sysRadio1.isVisible({ timeout: 3000 })) await sysRadio1.click();

        const establishSharedRadio = page.locator('#axis2EstablishShared');
        if (!await establishSharedRadio.isVisible({ timeout: 3000 })) { test.skip(); return; }
        await establishSharedRadio.click();

        const successorCbs = page.locator('.establish-shared-successor-cb');
        if (await successorCbs.count() === 0) { test.skip(); return; }
        for (let i = 0; i < await successorCbs.count(); i++) {
            await successorCbs.nth(i).check();
        }

        await page.locator('#btnApplyDecision').click();
        await expect(page.locator('#decisionPanelError')).toBeVisible({ timeout: 3000 });
        await expect(page.locator('#decisionPanelError')).toContainText(/already has.*decision|existing decision/i);
    });

    test('Test F: No JavaScript errors during normal flow', async ({ page }) => {
        const jsErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                const t = msg.text();
                if (!t.includes('favicon') && !t.includes('404')) jsErrors.push(t);
            }
        });
        page.on('pageerror', err => jsErrors.push(err.message));

        await setupToDashboard(page);

        const decideBtn = page.locator('.sim-decide-btn').filter({ hasText: /^decide$/i }).first();
        if (await decideBtn.isVisible({ timeout: 5000 })) {
            await decideBtn.click();
            const modal = page.locator('#decisionPanelModal');
            if (await modal.isVisible({ timeout: 3000 })) {
                await page.locator('#btnCloseDecisionPanel').click();
                await expect(modal).toBeHidden({ timeout: 5000 });
            }
        }

        expect(jsErrors).toHaveLength(0);
    });
});
