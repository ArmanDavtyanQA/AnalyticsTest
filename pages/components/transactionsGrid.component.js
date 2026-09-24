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
const GRAPHQL_PATH = '/proxy/graphql';
const QUERY_NAME = 'GetTransactions';
// The empty state replaces <tbody> inside the table.
const EMPTY_STATE_TEXT = /արդյունքներ չեն գտնվել|no results found|no data/i;
const LOAD_TIMEOUT = 90_000;
// The app sends the query right after Apply; waiting longer only delays the failure
// when a filter change never reaches the backend.
const QUERY_SENT_TIMEOUT = 30_000;

/**
 * Parses a grid amount cell (`"750 AMD"`, `"2618.50 USD"`) to a number.
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
 * Last 4 digits of a masked card (`"5501xxxx8274"` → `"8274"`); `''` when the
 * transaction has no card (`"0xxxx0"`).
 * @param {string} text
 */
export const cardNumberSeed = (text) => {
    const digits = String(text ?? '').replace(/\D/g, '');
    if (digits.length < 4 || /^0+$/.test(digits)) return '';
    return digits.slice(-4);
};

/**
 * Variables of a `GetTransactions` GraphQL request, or `null` for any other request.
 * @param {import('@playwright/test').Request} request
 * @returns {Record<string, any> | null}
 */
export function transactionsQueryVariables(request) {
    if (request.method() !== 'POST' || !request.url().includes(GRAPHQL_PATH)) return null;
    let body;
    try {
        body = request.postDataJSON();
    } catch {
        return null;
    }
    return body?.operationName === QUERY_NAME ? (body.variables ?? {}) : null;
}

const parseJson = (text) => {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
};

const emptyGridMessage = (description) =>
    `Transactions grid returned 0 rows for ${description}. The test environment has no `
    + 'matching data; seed the filter from rows the grid actually shows.';

/**
 * @typedef {object} TransactionsPage
 * @property {Record<string, any>} variables - the `GetTransactions` variables that were sent
 * @property {Record<string, any>[]} items - rows of the first page, as returned by the API
 * @property {number} totalCount - matches across all pages
 */

/**
 * @param {import('@playwright/test').Request} request
 * @param {string} description
 * @returns {Promise<TransactionsPage>}
 */
async function readTransactionsPage(request, description) {
    const response = await request.response();
    if (!response) {
        throw new Error(
            `${QUERY_NAME} for ${description} failed: ${request.failure()?.errorText ?? 'no response'}.`,
        );
    }
    const text = await response.text();
    const settled = parseJson(text)?.data?.transaction?.settled;
    if (!response.ok() || !settled) {
        throw new Error(
            `${QUERY_NAME} for ${description} returned HTTP ${response.status()}: ${text.slice(0, 300)}`,
        );
    }
    return {
        variables: transactionsQueryVariables(request),
        items: settled.items ?? [],
        totalCount: settled.totalCount ?? 0,
    };
}

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
        this.emptyState = this.table.locator('p', { hasText: EMPTY_STATE_TEXT }).first();
        this.skeletons = this.root.locator('.react-loading-skeleton').filter({ visible: true });
    }

    /** Data row by visible index (ids on the current page start at 0). */
    row(rowIndex = 0) {
        return this.rows.nth(rowIndex);
    }

    /**
     * Cell for a {@link GRID_COLUMNS} key. Uses `id$="_key"` so column drag-reorder
     * does not break lookups.
     * @param {string} columnKey
     * @param {number} [rowIndex]
     */
    cell(columnKey, rowIndex = 0) {
        return this.row(rowIndex).locator(`td[id$="_${columnKey}"]`).first();
    }

    /** Every rendered cell of a column, top to bottom. */
    column(columnKey) {
        return this.body.locator(`td[id$="_${columnKey}"]`);
    }

    /** The paragraph holding a cell's value. */
    cellText(columnKey, rowIndex = 0) {
        return this.cell(columnKey, rowIndex).locator('p').first();
    }

    /**
     * Trimmed text of a data cell.
     * @param {string} columnKey
     * @param {number} [rowIndex]
     */
    async getText(columnKey, rowIndex = 0) {
        const paragraph = this.cellText(columnKey, rowIndex);
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

    /**
     * Waits for the grid to settle on whatever it currently shows. It cannot tell old
     * rows from new ones, so after an action that reloads the grid use {@link waitForQuery}.
     * @param {{ timeout?: number, allowEmpty?: boolean }} [options]
     * @returns {Promise<'data' | 'empty'>}
     */
    async waitForLoad({ timeout = LOAD_TIMEOUT, allowEmpty = false } = {}) {
        await expect(this.body.locator('td p').or(this.emptyState).first()).toBeVisible({ timeout });
        await expect(this.skeletons).toHaveCount(0, { timeout });
        const empty = await this.emptyState.isVisible();
        if (empty && !allowEmpty) {
            throw new Error(emptyGridMessage('the current filters'));
        }
        return empty ? 'empty' : 'data';
    }

    /**
     * Runs `action`, waits for the `GetTransactions` query it sends, then for the table
     * to render that response. `match` pins the wait to the query carrying the expected
     * filter, so a filter the UI silently drops fails here instead of passing on old rows.
     *
     * @param {() => Promise<unknown>} action
     * @param {{
     *   match?: (variables: Record<string, any>) => boolean,
     *   description?: string,
     *   allowEmpty?: boolean,
     *   timeout?: number,
     * }} [options] `timeout` bounds how long the query may take to be sent
     * @returns {Promise<TransactionsPage>}
     */
    async waitForQuery(action, {
        match = () => true,
        description = 'the current filters',
        allowEmpty = false,
        timeout = QUERY_SENT_TIMEOUT,
    } = {}) {
        const requestPromise = this.page
            .waitForRequest((request) => {
                const variables = transactionsQueryVariables(request);
                return variables !== null && match(variables);
            }, { timeout })
            .catch((error) => {
                throw new Error(
                    `No ${QUERY_NAME} query for ${description} was sent within ${timeout / 1000}s.`,
                    { cause: error },
                );
            });
        const [request] = await Promise.all([requestPromise, action()]);
        const result = await readTransactionsPage(request, description);
        await this.expectRendered(result, { allowEmpty, description });
        return result;
    }

    /**
     * Waits until the table shows exactly the given page of data (row count plus the
     * first and last terminal IDs), or the empty state for zero matches.
     * @param {TransactionsPage} result
     * @param {{ allowEmpty?: boolean, description?: string }} [options]
     */
    async expectRendered({ items, totalCount }, { allowEmpty = false, description = 'the current filters' } = {}) {
        if (totalCount === 0) {
            await expect(this.emptyState).toBeVisible();
            if (!allowEmpty) {
                throw new Error(emptyGridMessage(description));
            }
            return;
        }
        await expect(this.skeletons).toHaveCount(0);
        await expect(this.rows).toHaveCount(items.length);
        for (const rowIndex of [0, items.length - 1]) {
            const terminalId = items[rowIndex].terminalId;
            if (terminalId != null) {
                await expect(this.cellText(GRID_COLUMNS.TERMINAL_ID, rowIndex)).toHaveText(String(terminalId));
            }
        }
    }

    /**
     * Asserts a column across every rendered row. `expected` is exact text, a RegExp, or a
     * predicate over the cell text (`description` names it in the failure message).
     * @param {string} columnKey
     * @param {string | RegExp | ((text: string) => boolean)} expected
     * @param {string} [description]
     */
    async expectEveryRow(columnKey, expected, description = String(expected)) {
        const count = await this.rows.count();
        expect(count, 'transactions grid has no rows to check').toBeGreaterThan(0);
        if (typeof expected !== 'function') {
            for (let rowIndex = 0; rowIndex < count; rowIndex++) {
                await expect(this.cellText(columnKey, rowIndex)).toHaveText(expected);
            }
            return;
        }
        await expect.poll(async () => {
            const texts = await this.column(columnKey).evaluateAll((cells) =>
                cells.map((cell) => cell.querySelector('p')?.textContent?.trim() ?? ''));
            return texts.filter((text) => !expected(text));
        }, { message: `"${columnKey}" values that are not ${description}` }).toEqual([]);
    }
}
