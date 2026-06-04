import { expect } from '@playwright/test';
import { waitForGridToLoad } from '../../helpers.js';

/**
 * Localized UI copy used by the "Create report" wizard.
 */
const TEXT = {
    openButton: 'Ստեղծել',      // page-level "Create" button that opens the wizard
    modalTitle: 'Ստեղծել հաշվետվություն',
    continueButton: 'Շարունակել', // steps 1-3 footer
    createButton: 'Ստեղծել',     // step 4 footer (submit)
    applyButton: 'Կիրառել',      // filter popup apply
};

/**
 * Report frequency tab labels (step 2). Use {@link REPORT_FREQUENCY} keys in tests.
 */
const FREQUENCY_LABELS = {
    daily: 'Օրական',
    weekly: 'Շաբաթական',
    monthly: 'Ամսական',
};

export const REPORT_FREQUENCY = {
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
};

/**
 * "Report by date" radio labels (step 2). Use {@link REPORT_BY} keys in tests:
 *   - SETTLEMENT_DATE - for settled-date report cases
 *   - CREATION_DATE   - for created-date report cases
 */
const REPORT_BY_LABELS = {
    settlement: 'Հաշվանցման ամսաթիվ',
    creation: 'Ստեղծման ամսաթիվ',
};

export const REPORT_BY = {
    SETTLEMENT_DATE: 'settlement',
    CREATION_DATE: 'creation',
};

/**
 * Filter chips available on step 3, keyed by their `data-filter-id`.
 */
export const REPORT_FILTERS = {
    TERMINAL_ID: '1',
    MERCHANT_NAME: '2',
    ADDRESS: '3',
    POS_TYPE: '4',
};

const REPORT_GRID_ROW_SELECTOR =
    '.transactions-wrapper__listing table tbody tr, main table tbody tr, table tbody tr';

/**
 * Page Object for the 4-step "Create report" wizard.
 *
 * Steps:
 *   1. Details   - report name + recipient email(s)
 *   2. Frequency - Daily / Weekly / Monthly
 *   3. Filters   - optional filter chips (Terminal ID, Merchant Name, ...)
 *   4. Review    - submit to create
 *
 * Use {@link CreateReportModal#create} for the common end-to-end flow, or call the
 * individual step methods for finer-grained control in bespoke test cases.
 */
export class CreateReportModal {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
        this.root = page.locator('.modal__container');
        this.title = this.root.locator('.modal__title-large');
        this.stepper = this.root.locator('.modal-stepper p').first();
        this.nameInput = this.root.locator('input[name="name"]');
        this.emailInput = this.root.locator('#email-input');
        // The footer "submit" button advances steps 1-3 (Continue) and submits step 4 (Create).
        this.footerSubmit = this.root.locator('.modal-footer button[type="submit"]');
    }

    /** Opens the wizard from the reports page and waits for step 1. */
    async open() {
        await this.page.getByRole('button', { name: TEXT.openButton }).click();
        await expect(this.root).toBeVisible();
        await expect(this.title).toHaveText(TEXT.modalTitle);
        await this.expectStep(1);
        return this;
    }

    /**
     * Asserts the wizard is on the given step (1-4).
     * @param {1 | 2 | 3 | 4} step
     */
    async expectStep(step) {
        await expect(this.stepper).toHaveText(`Քայլ ${step}/4`);
    }

    /** Clicks the footer "Continue" (Շարունակել) to advance a step. */
    async continue() {
        await this.footerSubmit.filter({ hasText: TEXT.continueButton }).click();
        return this;
    }

    /**
     * Step 1 - fills the report name and (optionally) selects a recipient email.
     * @param {{ name: string, email?: string }} details
     */
    async fillDetails({ name, email } = {}) {
        await expect(this.nameInput).toBeVisible();
        await this.nameInput.fill(name);
        await expect(this.nameInput).toHaveValue(name);
        if (email) {
            await this.addEmail(email);
        }
        return this;
    }

    /**
     * Step 1 - searches the email combobox and selects the matching account option.
     * @param {string} email
     */
    async addEmail(email) {
        await expect(this.emailInput).toBeVisible();
        await this.emailInput.click();
        await this.emailInput.fill(email);
        const option = this.root
            .locator('.multi-textarea-chips__dropdown[role="listbox"] .multi-textarea-chips__dropdown-item')
            .filter({ hasText: email });
        await expect(option).toBeVisible();
        await option.click();
        return this;
    }

    /**
     * Step 2 - selects the report frequency tab.
     * @param {keyof typeof FREQUENCY_LABELS} frequency - use REPORT_FREQUENCY.*
     */
    async selectFrequency(frequency = REPORT_FREQUENCY.DAILY) {
        const label = FREQUENCY_LABELS[frequency];
        if (!label) {
            throw new Error(
                `Unknown report frequency "${frequency}". Use one of: ${Object.keys(FREQUENCY_LABELS).join(', ')}`
            );
        }
        await this.root.locator('.tabs-container .tab').filter({ hasText: label }).click();
        return this;
    }

    /**
     * Step 2 - selects the "report by date" radio.
     * @param {keyof typeof REPORT_BY_LABELS} reportBy - use REPORT_BY.*
     *   (SETTLEMENT_DATE for settled reports, CREATION_DATE for created-date reports)
     */
    async selectReportBy(reportBy) {
        const label = REPORT_BY_LABELS[reportBy];
        if (!label) {
            throw new Error(
                `Unknown "report by" option "${reportBy}". Use one of: ${Object.keys(REPORT_BY_LABELS).join(', ')}`
            );
        }
        // The whole card intercepts pointer events, so click the card itself rather
        // than the inner radio label (which would be blocked by the card overlay).
        const item = this.root.locator('.report-types .item-select').filter({ hasText: label });
        await item.click();
        await expect(item.locator('input[type="radio"]')).toBeChecked();
        return this;
    }

    /**
     * Step 3 - opens a filter chip, selects an option by index, and applies.
     * @param {string} filterId - a REPORT_FILTERS.* value (the chip's data-filter-id)
     * @param {{ optionIndex?: number }} [options]
     */
    async selectFilterOption(filterId, { optionIndex = 0 } = {}) {
        await this.page.locator(`.filter-chip[data-filter-id="${filterId}"]`).click();

        const popupBody = this.page.locator('.filter-popup__body').filter({ visible: true });
        await expect(popupBody).toBeVisible();

        const option = popupBody.locator('.filter-popup__item').nth(optionIndex);
        const checkbox = option.locator('input[type="checkbox"]');
        await option.locator('.controller').click();
        await expect(checkbox).toBeChecked();

        await this.page.getByRole('button', { name: TEXT.applyButton }).filter({ visible: true }).first().click();
        return this;
    }

    /** Step 4 - submits the wizard and waits for it to close. */
    async submit() {
        const createButton = this.footerSubmit.filter({ hasText: TEXT.createButton });
        await expect(createButton).toBeEnabled();
        await createButton.click();
        await expect(this.root).toBeHidden();
        return this;
    }

    /**
     * End-to-end convenience flow covering all four steps.
     *
     * @param {Object} config
     * @param {string} config.name - report name (make it unique to assert against the grid)
     * @param {string} [config.email] - recipient email to search & select
     * @param {keyof typeof FREQUENCY_LABELS} [config.frequency] - REPORT_FREQUENCY.* (default DAILY)
     * @param {keyof typeof REPORT_BY_LABELS} [config.reportBy] - REPORT_BY.* (settlement vs creation date)
     * @param {{ id: string, optionIndex?: number }} [config.filter] - optional step-3 filter
     */
    async create({ name, email, frequency = REPORT_FREQUENCY.DAILY, reportBy, filter } = {}) {
        await this.open();

        // Step 1 - details
        await this.fillDetails({ name, email });
        await this.continue();

        // Step 2 - frequency + report-by-date
        await this.expectStep(2);
        await this.selectFrequency(frequency);
        if (reportBy) {
            await this.selectReportBy(reportBy);
        }
        await this.continue();

        // Step 3 - filters (optional)
        await this.expectStep(3);
        if (filter) {
            await this.selectFilterOption(filter.id, { optionIndex: filter.optionIndex });
        }
        await this.continue();

        // Step 4 - review & submit
        await this.expectStep(4);
        await this.submit();
        return this;
    }
}

/**
 * Verifies a report with the given name is present in the reports grid.
 *
 * The grid does not auto-refresh after creation, so it is reloaded first (unless
 * disabled). Pair this with a unique report name to confirm the current run's report.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} name - the (ideally unique) report name to look for
 * @param {{ reload?: boolean, timeout?: number }} [options]
 */
export async function expectReportInGrid(page, name, { reload = true, timeout = 30_000 } = {}) {
    if (reload) {
        await page.reload({ waitUntil: 'domcontentloaded' });
    }
    await waitForGridToLoad(page);
    const row = page.locator(REPORT_GRID_ROW_SELECTOR).filter({ hasText: name });
    await expect(row.first()).toBeVisible({ timeout });
    return row.first();
}
