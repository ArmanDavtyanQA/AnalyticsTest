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

    /** Locator for the row whose name cell text exactly matches `name`. */
    rowByName(name) {
        return this.rows.filter({
            has: this.page.locator(`${NAME_CELL} p`).getByText(name, { exact: true }),
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

    /**
     * Scrolls a row's sticky actions cell into the clickable viewport. The actions
     * column is pinned to the right; without horizontal scroll the toggle / menu
     * clicks often miss or hit an overlapping element.
     */
    async prepareRowActions(row) {
        await this.ensureActionsReachable();
        const actions = row.locator(ACTIONS_CELL);
        await actions.scrollIntoViewIfNeeded();
        await actions.evaluate((cell) => {
            cell.scrollIntoView({ block: 'nearest', inline: 'end' });
            const wrapper =
                cell.closest('.reports-table')?.parentElement
                ?? cell.closest('.transactions-wrapper__listing')
                ?? cell.closest('main');
            if (wrapper && wrapper.scrollWidth > wrapper.clientWidth) {
                wrapper.scrollLeft = wrapper.scrollWidth;
            }
        });
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

    /**
     * Waits for a row to disappear, reloading between checks. Mutations (archive /
     * delete) can commit slightly after the confirmation modal closes, so a single
     * reload may still show the old row.
     */
    async waitUntilNotInGrid(name, { reloads = 5 } = {}) {
        for (let attempt = 0; attempt < reloads; attempt++) {
            const absent = await this.rowByName(name)
                .count()
                .then((count) => count === 0)
                .catch(() => false);
            if (absent) {
                log(`PASS: report "${name}" is absent from the grid`);
                return;
            }
            if (attempt < reloads - 1) {
                log(`"${name}" still in grid — reloading (${attempt + 2}/${reloads})`);
                await this.reload();
            }
        }
        await this.expectNotInGrid(name);
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
    async expectToggleState(name, active, { timeout = 30_000 } = {}) {
        const checkbox = this.toggleCheckbox(name);
        try {
            if (active) await expect(checkbox).toBeChecked({ timeout });
            else await expect(checkbox).not.toBeChecked({ timeout });
            log(`PASS: "${name}" toggle is ${active ? 'ACTIVE' : 'INACTIVE'}`);
        } catch (e) {
            log(`FAIL: "${name}" toggle is NOT ${active ? 'ACTIVE' : 'INACTIVE'}`);
            throw e;
        }
    }

    /**
     * Waits for a toggle to reach the expected state, reloading between checks.
     * The reports grid does not auto-refresh and the activate/deactivate mutation
     * can commit slightly after its confirmation modal closes, so a single reload
     * may capture a stale (pre-commit) snapshot. Re-reading the same static page
     * would never recover, hence the reload-and-recheck loop.
     */
    async waitForToggleState(name, active, { reloads = 3, perCheckTimeout = 5_000 } = {}) {
        for (let attempt = 0; attempt < reloads; attempt++) {
            const checkbox = this.toggleCheckbox(name);
            const matched = await checkbox
                .isChecked({ timeout: perCheckTimeout })
                .then((checked) => checked === active)
                .catch(() => false);
            if (matched) {
                log(`PASS: "${name}" toggle is ${active ? 'ACTIVE' : 'INACTIVE'}`);
                return;
            }
            if (attempt < reloads - 1) {
                log(`toggle not ${active ? 'ACTIVE' : 'INACTIVE'} yet for "${name}" — reloading (${attempt + 2}/${reloads})`);
                await this.reload();
            }
        }
        // Final strict assertion to surface a clear, logged failure.
        await this.expectToggleState(name, active);
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
        await this.prepareRowActions(row);
        const toggle = row.locator(
            `${ACTIONS_CELL} label.controller--switch, ${ACTIONS_CELL} .controller--switch`,
        ).first();
        await expect(toggle).toBeVisible();
        // Center click is more reliable on the pinned actions cell than a default
        // click, which can land on an overlapping sticky element.
        await this.clickLocatorCenter(toggle);
    }

    /** Activates a (currently inactive) report and confirms. */
    async activate(name) {
        log(`activating "${name}" ...`);
        await this.clickToggle(name);
        await this.confirmWith(TEXT.confirmActivate);
        await this.reload();
        await this.waitForToggleState(name, true);
        log(`activate confirmed for "${name}"`);
        return this;
    }

    /** Deactivates a (currently active) report and confirms. */
    async deactivate(name) {
        log(`deactivating "${name}" ...`);
        await this.clickToggle(name);
        await this.confirmWith(TEXT.confirmDeactivate);
        await this.reload();
        await this.waitForToggleState(name, false);
        log(`deactivate confirmed for "${name}"`);
        return this;
    }

    // --- history ---------------------------------------------------------------

    /** Opens the history side-sheet for a report (the non-menu action button). */
    async openHistory(name) {
        const row = await this.expectInGrid(name);
        await this.prepareRowActions(row);
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

    /** Clicks the center of a locator — reliable for sticky / overlapped controls. */
    async clickLocatorCenter(locator) {
        await locator.hover().catch(() => { });
        const box = await locator.boundingBox();
        if (box) {
            await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            return;
        }
        await locator.click();
    }

    /**
     * Locator for the currently open row-action menu container. Both grids render
     * the dropdown in a portal (outside the row) as `.select__options` (older
     * builds: `.menu-dropdown`). We scope to the single visible/last container so
     * options are read from the menu we just opened — a page-wide `.select__option`
     * selector could leak options from a stale dropdown elsewhere in the DOM.
     *   - Active grid:  Duplicate (Կրկնօրինակել), Archive (Արխիվացնել)
     *   - Archived grid: Unarchive (հանել արխիվից), Delete (Ջնջել)
     */
    menuContainer() {
        return this.page.locator('.select__options, .menu-dropdown').filter({ visible: true }).last();
    }

    /** Opens a row's 3-dot menu and returns the scoped menu container locator. */
    async openRowMenu(name) {
        const row = await this.expectInGrid(name);
        await this.prepareRowActions(row);
        const moreBtn = row.locator(`${ACTIONS_CELL} button[data-id="more-icon-btn"]`);
        await expect(moreBtn).toBeVisible();

        // Scope options to the single open container (matching the wrapper + its
        // children together would trip strict mode).
        const menu = this.menuContainer();
        for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt > 0) {
                await this.page.keyboard.press('Escape').catch(() => { });
                await this.prepareRowActions(row);
            }
            await this.clickLocatorCenter(moreBtn);
            try {
                await expect(menu.locator('.select__option').first()).toBeVisible({ timeout: 8_000 });
                return menu;
            } catch (e) {
                if (attempt === 2) {
                    throw e;
                }
                log(`menu did not open for "${name}" — retrying (${attempt + 2}/3)`);
            }
        }
        return menu;
    }

    /** Opens the row menu and clicks one of its options by exact text. */
    async runMenuAction(name, optionText) {
        const menu = await this.openRowMenu(name);
        const option = menu.locator('.select__option').filter({ hasText: optionText }).first();
        await expect(option).toBeVisible();
        await this.clickLocatorCenter(option);
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
        await this.reload();
        await this.waitUntilNotInGrid(name);
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
        await this.reload();
        await this.waitUntilNotInGrid(name);
        log(`delete confirmed for "${name}"`);
        return this;
    }
}
