import { expect } from '@playwright/test';

/**
 * Visible transactions table. Columns are user-reorderable; cells keep stable ids
 * `{rowIndex}_{columnKey}` (e.g. `0_creationDate`). Always locate by that suffix.
 */
export const GRID_COLUMNS = {
    POS_TYPE: 'posType',
    MERCHANT_NAME: 'merchantName',
    ADDRESS: 'address',
    TERMINAL_ID: 'terminalId',
    CREATION_DATE: 'creationDate',
    CARD_NUMBER: 'cardNumber',
    AMOUNT: 'amount',
};

const ROOT = '.transactions-wrapper__listing';

/**
 * Parses a grid amount cell (`"750 AMD"`, `"2,618.50 USD"`) to a number.
 * @param {string} text
 */
export const parseGridAmount = (text) => {
    const match = String(text ?? '')
        .replace(/\u00a0/g, ' ')
        .match(/-?[\d]+(?:[.,]\d+)?/);
    if (!match) return NaN;
    return parseFloat(match[0].replace(',', '.'));
};

/**
 * Last 4 digits of a masked card (`"5501xxxx8274"` → `"8274"`).
 * @param {string} text
 */
export const cardNumberSeed = (text) => {
    const digits = String(text ?? '').replace(/\D/g, '');
    if (digits.length < 4 || /^0+$/.test(digits)) return '';
    return digits.slice(-4);
};

export class TransactionsGrid {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
        this.root = page.locator(ROOT).first();
        this.table = this.root.locator('.advanced-table table, table').first();
        this.body = this.table.locator('tbody');
        this.rows = this.body.locator('tr');
    }

    /** Data row by visible index (ids on the current page start at 0). */
    row(rowIndex = 0) {
        return this.rows.nth(rowIndex);
    }

    /**
     * Cell for a {@link GRID_COLUMNS} key. Uses `id$="_key"` so column drag-reorder
     * does not break filters.
     * @param {string} columnKey
     * @param {number} [rowIndex]
     */
    cell(columnKey, rowIndex = 0) {
        return this.row(rowIndex).locator(`td[id$="_${columnKey}"]`).first();
    }

    /**
     * Trimmed text of a data cell.
     * @param {string} columnKey
     * @param {number} [rowIndex]
     */
    async getText(columnKey, rowIndex = 0) {
        const paragraph = this.cell(columnKey, rowIndex).locator('p').first();
        await expect(paragraph).toBeVisible({ timeout: 15_000 });
        return ((await paragraph.textContent()) || '').trim();
    }

    /** Numeric amount from the Amount column. */
    async getAmount(rowIndex = 0) {
        return parseGridAmount(await this.getText(GRID_COLUMNS.AMOUNT, rowIndex));
    }

    /**
     * First row whose column text is usable as a filter seed.
     * @param {string} columnKey
     * @param {{ maxRows?: number, accept?: (value: string) => boolean }} [options]
     */
    async firstUsableValue(columnKey, { maxRows = 20, accept } = {}) {
        const count = Math.min(await this.rows.count(), maxRows);
        for (let row = 0; row < count; row++) {
            const value = await this.getText(columnKey, row);
            if (!value) continue;
            if (accept && !accept(value)) continue;
            return { row, value };
        }
        throw new Error(
            `No usable "${columnKey}" value in the first ${count} transactions grid rows.`,
        );
    }
}
