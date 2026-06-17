import { expect } from '@playwright/test';
import { waitForGridToLoad } from '../../helpers.js';

/**
 * Localized UI copy used by the reports grid row actions.
 */
const TEXT = {
    // 3-dot menu items (active grid)
    duplicate: 'Կրկնօրինակել',
    archive: 'Արխիվացնել',
    // 3-dot menu items (archived grid)
    unarchive: 'հանել արխիվից',
    delete: 'Ջնջել',
    // confirmation modal buttons
    confirmActivate: 'Ակտիվացնել',
    confirmDeactivate: 'Ապաակտիվացնել',
    confirmArchive: 'Արխիվացնել',
    // duplicate (edit + review) modals
    historyTab: 'Պատմություն',
    editLink: 'Խմբագրել',
    editSubmit: 'Հաստատել փոփոխությունը',
    reviewSubmit: 'Ստեղծել',
};

const ROW = '.reports-table table tbody tr';
const NAME_CELL = 'td[id$="_name"]';
const ACTIONS_CELL = 'td[id$="_actions"]';

/**
 * Small console logger so every action and assertion shows up in the test output,
 * as requested ("for all success or fail cases please add logs").
 */
function log(msg) {
    console.log(`[ReportsGrid] ${msg}`);
}

/**
 * Page Object for the Reports grid (works for both the active reports page and the
 * archived reports page, which share the same table markup).
 *
 * Each row exposes three actions in its sticky "Գործողություններ" cell:
 *   1. an active/inactive toggle (opens an Activate/Deactivate confirmation modal),
 *   2. a history button (opens the details side-sheet on the History tab),
 *   3. a 3-dot menu with "Duplicate" and "Archive".
 */
export class ReportsGrid {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
        this.rows = page.locator(ROW);
    }

    /** Reloads the page and waits for the grid to settle (the grid does not auto-refresh). */
    async reload() {
        log('reloading grid');
        await this.page.reload({ waitUntil: 'domcontentloaded' });
        await waitForGridToLoad(this.page, 90000, { allowEmpty: true });
        return this;
    }

    /** Locator for the row whose name cell contains `name` (use unique names). */
    rowByName(name) {
        return this.rows.filter({
            has: this.page.locator(`${NAME_CELL} p, ${NAME_CELL}`).filter({ hasText: name }),
        });
    }

    /**
     * Returns report names visible in the current grid whose text contains `substring`.
     * Reloads are the caller's responsibility when iterating after mutations.
     */
    async collectNamesContaining(substring) {
        const nameLocator = this.page.locator(`${ROW} ${NAME_CELL} p, ${ROW} ${NAME_CELL}`);
        const texts = await nameLocator.allInnerTexts();
        const names = [...new Set(
            texts
                .map((text) => text.trim().split('\n')[0].trim())
                .filter((text) => text.length > 0 && text.includes(substring)),
        )];
        log(`found ${names.length} report(s) matching "${substring}": ${names.length ? names.join(', ') : '(none)'}`);
        return names;
    }

    /** Collapse an opened sidebar so sticky row actions are not covered. */
    async ensureActionsReachable() {
        await this.page.mouse.move(0, 0);
        await this.page.evaluate(() => {
            document.querySelectorAll('.side-navigation.side-navigation--opened').forEach((el) => {
                el.classList.remove('side-navigation--opened');
            });
        }).catch(() => { });
    }

    /** Asserts the report is present and returns its row locator. */
    async expectInGrid(name, { timeout = 30_000 } = {}) {
        const row = this.rowByName(name).first();
        try {
            await expect(row).toBeVisible({ timeout });
            log(`PASS: report "${name}" is present in the grid`);
        } catch (e) {
            log(`FAIL: report "${name}" was NOT found in the grid`);
            throw e;
        }
        return row;
    }

    /** Asserts the report is absent from the current grid. */
    async expectNotInGrid(name, { timeout = 30_000 } = {}) {
        try {
            await expect(this.rowByName(name)).toHaveCount(0, { timeout });
            log(`PASS: report "${name}" is absent from the grid`);
        } catch (e) {
            log(`FAIL: report "${name}" is still present in the grid`);
            throw e;
        }
    }

    /** Checkbox locator backing a row's active/inactive toggle. */
    toggleCheckbox(name) {
        return this.rowByName(name).first().locator(`${ACTIONS_CELL} .switcher input[type="checkbox"]`);
    }

    /** Returns whether the report's toggle is currently active (checked). */
    async isActive(name) {
        return this.toggleCheckbox(name).isChecked();
    }

    /** Asserts the toggle state of a report and logs the result. */
    async expectToggleState(name, active) {
        const checkbox = this.toggleCheckbox(name);
        try {
            if (active) await expect(checkbox).toBeChecked();
            else await expect(checkbox).not.toBeChecked();
            log(`PASS: "${name}" toggle is ${active ? 'ACTIVE' : 'INACTIVE'}`);
        } catch (e) {
            log(`FAIL: "${name}" toggle is NOT ${active ? 'ACTIVE' : 'INACTIVE'}`);
            throw e;
        }
    }

    // --- confirmation modal ----------------------------------------------------

    confirmModal() {
        return this.page.locator('.modal--confirmation');
    }

    /** Clicks a button (by exact text) inside the confirmation modal and waits for it to close. */
    async confirmWith(buttonText) {
        const modal = this.confirmModal();
        await expect(modal).toBeVisible();
        await modal.getByRole('button', { name: buttonText, exact: true }).click();
        await expect(modal).toBeHidden();
    }

    // --- toggle (activate / deactivate) ---------------------------------------

    async clickToggle(name) {
        const row = await this.expectInGrid(name);
        await row.locator(`${ACTIONS_CELL} .switcher .controller--switch`).click();
    }

    /** Activates a (currently inactive) report and confirms. */
    async activate(name) {
        log(`activating "${name}" ...`);
        await this.clickToggle(name);
        await this.confirmWith(TEXT.confirmActivate);
        log(`activate confirmed for "${name}"`);
        return this;
    }

    /** Deactivates a (currently active) report and confirms. */
    async deactivate(name) {
        log(`deactivating "${name}" ...`);
        await this.clickToggle(name);
        await this.confirmWith(TEXT.confirmDeactivate);
        log(`deactivate confirmed for "${name}"`);
        return this;
    }

    // --- history ---------------------------------------------------------------

    /** Opens the history side-sheet for a report (the non-menu action button). */
    async openHistory(name) {
        const row = await this.expectInGrid(name);
        log(`opening history for "${name}" ...`);
        await row.locator(`${ACTIONS_CELL} button.btn--icon:not([data-id="more-icon-btn"])`).click();
        const sideSheet = this.page.locator('.side-sheet__container');
        await expect(sideSheet).toBeVisible();
        return sideSheet;
    }

    /** Asserts the side-sheet's History tab is the selected one. */
    async expectHistoryTabOpen() {
        const selectedTab = this.page.locator('.side-sheet__container .tabs-container .tab--selected');
        try {
            await expect(selectedTab).toContainText(TEXT.historyTab);
            log('PASS: History tab is open in the side-sheet');
        } catch (e) {
            log('FAIL: History tab is NOT the selected tab');
            throw e;
        }
    }

    async closeSideSheet() {
        const sideSheet = this.page.locator('.side-sheet__container');
        await sideSheet.locator('[data-id="dismiss-svg-icon"]').click();
        await expect(sideSheet).toBeHidden();
    }

    // --- 3-dot menu ------------------------------------------------------------

    /** Opens a row's 3-dot menu and returns the dropdown locator. */
    async openRowMenu(name) {
        await this.ensureActionsReachable();
        const row = await this.expectInGrid(name);
        const moreBtn = row.locator(`${ACTIONS_CELL} button[data-id="more-icon-btn"]`);
        await moreBtn.scrollIntoViewIfNeeded();
        await expect(moreBtn).toBeVisible();

        // Dismiss any menu left open from a prior row.
        await this.page.keyboard.press('Escape').catch(() => { });

        await moreBtn.click();
        const menu = this.page.locator('.menu-dropdown').filter({ visible: true }).last();
        try {
            await expect(menu).toBeVisible({ timeout: 5_000 });
        } catch {
            // Sticky actions or sidebar overlap can swallow the first click — retry once.
            await moreBtn.click();
            await expect(menu).toBeVisible({ timeout: 15_000 });
        }
        return menu;
    }

    /** Opens the row menu and clicks one of its options by text. */
    async runMenuAction(name, optionText) {
        const menu = await this.openRowMenu(name);
        await menu.locator('.select__option').filter({ hasText: optionText }).click();
    }

    // --- duplicate -------------------------------------------------------------

    /**
     * Duplicates a report, renames the copy via the "Հիմնական" edit step, and submits.
     *
     * Flow: 3-dot -> Duplicate -> review modal -> edit "Basic" -> rename -> confirm edit
     *       -> back on review modal -> submit (Create).
     *
     * @param {string} sourceName
     * @param {string} newName - unique name to assert in the grid afterwards
     */
    async duplicate(sourceName, newName) {
        log(`duplicating "${sourceName}" as "${newName}" ...`);
        await this.runMenuAction(sourceName, TEXT.duplicate);

        // Review modal (read-only summary of the copy).
        const reviewModal = this.page
            .locator('.modal__container')
            .filter({ has: this.page.locator('.reports-submit-review') });
        await expect(reviewModal).toBeVisible();

        // Edit the "Basic" (Հիմնական) section.
        const basicSection = reviewModal.locator('.reports-submit-review .item').filter({ hasText: 'Հիմնական' });
        await basicSection.getByText(TEXT.editLink).click();

        // Edit modal carries the name input.
        const editModal = this.page
            .locator('.modal__container')
            .filter({ has: this.page.locator('input[name="name"]') });
        await expect(editModal).toBeVisible();
        const nameInput = editModal.locator('input[name="name"]');
        await nameInput.fill(newName);
        await expect(nameInput).toHaveValue(newName);
        await editModal.getByRole('button', { name: TEXT.editSubmit }).click();

        // Back on the review modal -> submit the copy.
        await expect(reviewModal).toBeVisible();
        await reviewModal.getByRole('button', { name: TEXT.reviewSubmit, exact: true }).click();
        await expect(this.page.locator('.modal__container')).toBeHidden();
        log(`duplicate submitted as "${newName}"`);
        return this;
    }

    // --- archive ---------------------------------------------------------------

    /** Archives a report (3-dot -> Archive -> confirm). */
    async archive(name) {
        log(`archiving "${name}" ...`);
        await this.runMenuAction(name, TEXT.archive);
        await this.confirmWith(TEXT.confirmArchive);
        log(`archive confirmed for "${name}"`);
        return this;
    }

    // --- archived grid: unarchive / delete ------------------------------------

    /**
     * Confirms the unarchive/delete popup. Unlike the activate/archive confirmation,
     * this popup uses an inline footer; the destructive/primary action is the
     * `submit` button, so we click that regardless of UI language.
     */
    async confirmFooterAction() {
        const footer = this.page.locator('.modal__footer-inline').filter({ visible: true }).first();
        await expect(footer).toBeVisible();
        await footer.locator('button[type="submit"]').click();
        await expect(footer).toBeHidden();
    }

    /** Restores an archived report (3-dot -> Unarchive -> confirm). */
    async unarchive(name) {
        log(`unarchiving "${name}" ...`);
        await this.runMenuAction(name, TEXT.unarchive);
        await this.confirmFooterAction();
        log(`unarchive confirmed for "${name}"`);
        return this;
    }

    /** Permanently deletes an archived report (3-dot -> Delete -> confirm). */
    async deleteReport(name) {
        log(`deleting "${name}" ...`);
        await this.runMenuAction(name, TEXT.delete);
        await this.confirmFooterAction();
        log(`delete confirmed for "${name}"`);
        return this;
    }
}
