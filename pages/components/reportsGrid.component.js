import { expect } from '@playwright/test';
import { Sidebar } from './sidebar.component.js';

/**
 * Localized UI copy used by the reports grid row actions.
 */
const TEXT = {
    duplicate: /^(Duplicate|Կրկնօրինակել)$/i,
    archive: /^(Archive|Արխիվացնել)$/i,
    unarchive: /^(Unarchive|հանել արխիվից)$/i,
    delete: /^(Delete|Ջնջել)$/i,
    confirmActivate: /^(Activate|Ակտիվացնել)$/i,
    confirmDeactivate: /^(Deactivate|Ապաակտիվացնել)$/i,
    confirmArchive: /^(Archive|Արխիվացնել)$/i,
    historyTab: /^(History|Պատմություն)$/i,
    editLink: /^(Edit|Խմբագրել)$/i,
    editSubmit: /^(Confirm change|Հաստատել փոփոխությունը)$/i,
    reviewSubmit: /^(Create|Ստեղծել)$/i,
    basicSection: /^(Basic|Հիմնական)$/i,
    emptyState: /արդյունքներ չեն գտնվել|no results found|no data/i,
};

const ROOT = '.transactions-reports-wrapper';
const NAME_CELL = 'td[id$="_name"]';
const ACTIONS_CELL = 'td[id$="_actions"]';
const LOAD_TIMEOUT = 90_000;

/** Every action and assertion is logged so reports runs are traceable from the console. */
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
        this.root = page.locator(ROOT).first();
        this.rows = this.root.locator('table tbody tr');
        this.nameCells = this.root.locator(`${NAME_CELL} p`);
        this.emptyState = this.root.locator('p', { hasText: TEXT.emptyState }).first();
        this.skeletons = this.root.locator('.react-loading-skeleton').filter({ visible: true });
    }

    /**
     * Waits for the grid to finish loading: report names painted (or the empty state)
     * and no loading skeletons left. The grid never refreshes by itself after mutations.
     */
    async waitForLoad({ timeout = LOAD_TIMEOUT } = {}) {
        await expect(this.nameCells.or(this.emptyState).first()).toBeVisible({ timeout });
        await expect(this.skeletons).toHaveCount(0, { timeout });
        return this;
    }

    /** Reloads the page and waits for the reports grid to settle. */
    async reload() {
        log('reloading grid');
        await this.page.reload({ waitUntil: 'domcontentloaded' });
        await this.waitForLoad();
        return this;
    }

    /** Locator for the row whose name cell text exactly matches `name`. */
    rowByName(name) {
        return this.rows.filter({
            has: this.page.locator(`${NAME_CELL} p`).getByText(name, { exact: true }),
        });
    }

    /**
     * Report names in the current grid whose text contains `substring`.
     * Reloads are the caller's responsibility when iterating after mutations.
     */
    async collectNamesContaining(substring) {
        const texts = await this.nameCells.allInnerTexts();
        const names = [...new Set(
            texts
                .map((text) => text.trim().split('\n')[0].trim())
                .filter((text) => text.length > 0 && text.includes(substring)),
        )];
        log(`found ${names.length} report(s) matching "${substring}": ${names.length ? names.join(', ') : '(none)'}`);
        return names;
    }

    /**
     * Scrolls a row's sticky actions cell into the clickable viewport. The actions
     * column is pinned to the right; without horizontal scroll the toggle / menu
     * clicks often miss or hit an overlapping element.
     */
    async prepareRowActions(row) {
        await new Sidebar(this.page).collapse();
        const actions = row.locator(ACTIONS_CELL);
        await actions.scrollIntoViewIfNeeded();
        await actions.evaluate((cell) => {
            cell.scrollIntoView({ block: 'nearest', inline: 'end' });
            const wrapper = cell.closest('.transactions-reports-wrapper') ?? cell.closest('main');
            if (wrapper && wrapper.scrollWidth > wrapper.clientWidth) {
                wrapper.scrollLeft = wrapper.scrollWidth;
            }
        });
    }

    /** Whether a row with an exact title match is in the loaded grid (non-throwing). */
    async hasReport(name) {
        return (await this.rowByName(name).count()) > 0;
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
        for (let attempt = 0; attempt < reloads && await this.hasReport(name); attempt++) {
            log(`"${name}" still in grid — reloading (${attempt + 1}/${reloads})`);
            await this.reload();
        }
        await this.expectNotInGrid(name);
    }

    /** Checkbox locator backing a row's active/inactive toggle. */
    toggleCheckbox(name) {
        const actions = this.rowByName(name).first().locator(ACTIONS_CELL);
        return actions.locator('.switcher input[type="checkbox"], input[type="checkbox"]').first();
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

    /** Whether the loaded grid shows the report's toggle in the given state. */
    async isToggleState(name, active) {
        if (!(await this.hasReport(name))) return false;
        return (await this.toggleCheckbox(name).isChecked()) === active;
    }

    /**
     * Waits for a toggle to reach the expected state, reloading between checks.
     * The grid does not auto-refresh and the activate/deactivate mutation can commit
     * slightly after its confirmation modal closes, so one reload may be stale.
     */
    async waitForToggleState(name, active, { reloads = 5 } = {}) {
        for (let attempt = 0; attempt < reloads; attempt++) {
            if (await this.isToggleState(name, active)) {
                log(`PASS: "${name}" toggle is ${active ? 'ACTIVE' : 'INACTIVE'}`);
                return;
            }
            if (attempt < reloads - 1) {
                log(`toggle not ${active ? 'ACTIVE' : 'INACTIVE'} yet for "${name}" — reloading (${attempt + 2}/${reloads})`);
                await this.reload();
            }
        }
        await this.expectToggleState(name, active);
    }

    // --- confirmation modal ----------------------------------------------------

    confirmModal() {
        return this.page.locator('.modal--confirmation');
    }

    /** Clicks a button (by exact text) inside the confirmation modal and waits for it to close. */
    async confirmWith(buttonText) {
        const modal = this.confirmModal();
        await expect(modal).toBeVisible({ timeout: 10_000 });
        await modal.getByRole('button', { name: buttonText }).click();
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

    async toggleAndConfirm(name, confirmButtonText) {
        const modal = this.confirmModal();
        for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt > 0) {
                await this.page.keyboard.press('Escape');
                log(`toggle confirm modal did not open for "${name}" — retrying click (${attempt + 1}/3)`);
            }
            await this.clickToggle(name);
            const opened = await modal
                .waitFor({ state: 'visible', timeout: 5_000 })
                .then(() => true, () => false);
            if (opened) {
                await modal.getByRole('button', { name: confirmButtonText }).click();
                await expect(modal).toBeHidden();
                return;
            }
        }
        await this.confirmWith(confirmButtonText);
    }

    async activate(name, { attempts = 3 } = {}) {
        log(`activating "${name}" ...`);
        for (let attempt = 0; attempt < attempts; attempt++) {
            if (attempt > 0) {
                log(`"${name}" still INACTIVE after activate — retrying (${attempt + 1}/${attempts})`);
            }
            await this.toggleAndConfirm(name, TEXT.confirmActivate);
            await this.reload();
            if (await this.isToggleState(name, true)) {
                log(`activate confirmed for "${name}"`);
                return this;
            }
        }
        await this.expectToggleState(name, true);
        return this;
    }

    async deactivate(name, { attempts = 3 } = {}) {
        log(`deactivating "${name}" ...`);
        for (let attempt = 0; attempt < attempts; attempt++) {
            if (attempt > 0) {
                log(`"${name}" still ACTIVE after deactivate — retrying (${attempt + 1}/${attempts})`);
            }
            await this.toggleAndConfirm(name, TEXT.confirmDeactivate);
            await this.reload();
            if (await this.isToggleState(name, false)) {
                log(`deactivate confirmed for "${name}"`);
                return this;
            }
        }
        await this.expectToggleState(name, false);
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
        await locator.hover({ force: true });
        const box = await locator.boundingBox();
        if (!box) {
            throw new Error('Cannot click an element without a bounding box (not rendered).');
        }
        await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
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

    /**
     * Opens a row's 3-dot menu and clicks the option with `optionText`. Right after a
     * reload the grid can re-render, which swallows the click or closes the menu again,
     * so the menu is reopened until that option shows (3 attempts).
     */
    async runMenuAction(name, optionText) {
        const row = await this.expectInGrid(name);
        const moreBtn = row.locator(`${ACTIONS_CELL} button[data-id="more-icon-btn"]`);
        const option = this.menuContainer().locator('.select__option').filter({ hasText: optionText }).first();
        for (let attempt = 1; ; attempt++) {
            await this.prepareRowActions(row);
            await expect(moreBtn).toBeVisible();
            await this.clickLocatorCenter(moreBtn);
            try {
                await expect(option).toBeVisible({ timeout: 8_000 });
                break;
            } catch (error) {
                if (attempt === 3) {
                    throw error;
                }
                log(`menu for "${name}" did not show the option — reopening (${attempt + 1}/3)`);
                await this.page.keyboard.press('Escape');
            }
        }
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

        // Each section is a `.report-details` card: title <p> + Edit button, then its fields.
        const basicSection = reviewModal
            .locator('.reports-submit-review .report-details')
            .filter({ has: this.page.getByText(TEXT.basicSection) });
        await basicSection.getByRole('button', { name: TEXT.editLink }).click();

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
        await reviewModal.getByRole('button', { name: TEXT.reviewSubmit }).click();
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
