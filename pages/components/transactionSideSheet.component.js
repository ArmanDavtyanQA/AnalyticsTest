import { expect } from '@playwright/test';
import { TransactionsGrid, GRID_COLUMNS } from './transactionsGrid.component.js';

/** Row item — new builds use transactions-list-card__item; legacy used list-card__item. */
const ITEM =
    '.transactions-list-card__item, .list-card__item.transaction-list-item, .list-card__item';

/**
 * Transaction-detail fields used by tests: the bilingual label in the first `<p>` of the
 * row item. The sheet shows no serial number or address; use the grid for those.
 */
export const SIDE_SHEET_FIELDS = {
    CREATION_DATE: /^(Creation Date|Ստեղծման ամսաթիվ)$/i,
    SETTLEMENT_DATE: /^(Settlement date|Հաշվանցման ամսաթիվ)$/i,
    AMOUNT: /^(Amount|Գումար)$/i,
    CARD_NUMBER: /^(Card number|Քարտի համար)$/i,
    AUTHORIZATION_CODE: /^(Authorization code|Հաստատման կոդ|Լիազորության կոդ)$/i,
    RRN_1: /^RRN 1$/i,
    RRN_2: /^RRN 2$/i,
    RRN_3: /^RRN 3$/i,
    TERMINAL_ID: /^(Terminal ID|Տերմինալ ID|Տերմինալի ID)$/i,
};

/** True when side-sheet text is a real value (not empty / literal "null null" / N/A). */
export const isSideSheetValuePopulated = (text) => {
    const trimmed = (text ?? '').trim();
    return (
        trimmed.length > 0
        && !/^(null\s*)+$/i.test(trimmed)
        && !/^n\/a$/i.test(trimmed)
    );
};

/**
 * Reads the visible value from a side-sheet row item (`''` when the row is absent).
 * Structure: label `<p>` + value `<p>` holding a copy button and the value text.
 * @param {import('@playwright/test').Locator} item
 */
export async function readSideSheetItemValue(item) {
    const valueParagraph = item.locator('p').nth(1);
    if ((await valueParagraph.count()) === 0) {
        return '';
    }
    const text = await valueParagraph.evaluate((el) => {
        const clone = el.cloneNode(true);
        clone.querySelectorAll('button, .copy-icon').forEach((node) => node.remove());
        return clone.textContent ?? '';
    });
    return text.trim();
}

/**
 * Transaction details side sheet, opened by clicking a transactions grid row.
 */
export class TransactionSideSheet {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
        this.grid = new TransactionsGrid(page);
        this.root = page.locator('.side-sheet__container');
        this.content = this.root.locator('.side-sheet__content');
        this.dismissButton = this.root.locator('[data-id="dismiss-svg-icon"]');
    }

    /** Locator for a field row matched by its label `<p>` (hy/en). */
    fieldItem(fieldKey) {
        const labelPattern = SIDE_SHEET_FIELDS[fieldKey];
        if (!labelPattern) {
            throw new Error(`Unknown side-sheet field "${fieldKey}". Known: ${Object.keys(SIDE_SHEET_FIELDS).join(', ')}`);
        }
        // Match the label paragraph only: the row text also contains the value.
        return this.content
            .locator(ITEM)
            .filter({ has: this.page.locator('p', { hasText: labelPattern }) })
            .first();
    }

    /**
     * Opens the details of a grid row and waits until they have loaded.
     * @param {number} [rowIndex]
     */
    async open(rowIndex = 0) {
        const cell = this.grid.cell(GRID_COLUMNS.MERCHANT_NAME, rowIndex);
        await expect(async () => {
            await cell.click();
            await expect(this.root).toBeVisible({ timeout: 5_000 });
        }).toPass({ timeout: 30_000 });
        await expect(this.content).toBeVisible();
        await this.waitForDetails();
        return this;
    }

    /** The sheet renders "null null" placeholders until the details request returns. */
    async waitForDetails({ timeout = 30_000 } = {}) {
        const creationDate = this.fieldItem('CREATION_DATE');
        await expect
            .poll(async () => isSideSheetValuePopulated(await readSideSheetItemValue(creationDate)), {
                timeout,
                message: 'Transaction details never populated (still empty / "null null").',
            })
            .toBe(true);
    }

    /**
     * Waits for a field value to populate and returns it.
     * @param {keyof typeof SIDE_SHEET_FIELDS} fieldKey
     */
    async getFieldValue(fieldKey, { timeout = 15_000 } = {}) {
        const item = this.fieldItem(fieldKey);
        await expect
            .poll(async () => isSideSheetValuePopulated(await readSideSheetItemValue(item)), {
                timeout,
                message: `Side sheet field "${fieldKey}" did not populate.`,
            })
            .toBe(true);
        return readSideSheetItemValue(item);
    }

    async dismiss() {
        await this.dismissButton.click();
        await expect(this.root).toBeHidden();
    }

    /**
     * Opens grid rows top to bottom until one has every field in `fieldKeys` populated,
     * then closes the sheet. Bounded by `budget` so it fails inside the test timeout.
     * @param {(keyof typeof SIDE_SHEET_FIELDS)[]} fieldKeys
     * @param {{ maxRows?: number, budget?: number }} [options]
     * @returns {Promise<{ row: number, values: Record<string, string> }>}
     */
    async findRowWith(fieldKeys, { maxRows = 20, budget = 120_000 } = {}) {
        const deadline = Date.now() + budget;
        const rowCount = Math.min(await this.grid.rows.count(), maxRows);
        let checked = 0;
        for (let row = 0; row < rowCount && Date.now() < deadline; row++, checked++) {
            await this.open(row);
            const values = {};
            for (const fieldKey of fieldKeys) {
                values[fieldKey] = await readSideSheetItemValue(this.fieldItem(fieldKey));
            }
            await this.dismiss();
            if (Object.values(values).every(isSideSheetValuePopulated)) {
                return { row, values };
            }
        }
        throw new Error(
            `None of the first ${checked} transactions has ${fieldKeys.join(' + ')} populated `
            + `(scan budget ${budget / 1000}s).`,
        );
    }
}
