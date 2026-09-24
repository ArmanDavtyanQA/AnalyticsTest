import { TransactionsGrid, transactionsQueryVariables } from './pages/components/transactionsGrid.component.js';
import { ReportsGrid } from './pages/components/reportsGrid.component.js';

/**
 * Suite-wide waits and date utilities. UI knowledge (selectors, filter flows, grid
 * parsing) lives in pages/components and pages/flows, which never import this file.
 */

const LOAD_TIMEOUT = 90_000;

/**
 * Resolves with the next `GetTransactions` response. Start it before the action that
 * reloads the grid, await it afterwards; rejects when nothing answers within `timeout`.
 * `TransactionsGrid.waitForQuery` does the same and also checks the query variables and
 * waits for the rows to render — the filter methods use that.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout]
 */
export const waitForGridResponse = (page, timeout = LOAD_TIMEOUT) =>
    page.waitForResponse((response) => transactionsQueryVariables(response.request()) !== null, { timeout });

/**
 * Waits for the Transactions grid to render rows; with `allowEmpty` the empty state
 * also counts as loaded.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout]
 * @param {{ allowEmpty?: boolean }} [options]
 * @returns {Promise<'data' | 'empty'>}
 */
export const waitForGridToLoad = (page, timeout = LOAD_TIMEOUT, { allowEmpty = false } = {}) =>
    new TransactionsGrid(page).waitForLoad({ timeout, allowEmpty });

/**
 * Waits for the Reports grid (active or archived) to finish loading.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout]
 */
export const waitForReportsGridToLoad = (page, timeout = LOAD_TIMEOUT) =>
    new ReportsGrid(page).waitForLoad({ timeout });

const DATE_PATTERN = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/;

/**
 * Parses the first `DD-MM-YYYY` date in a text (`/` and `.` separators work too), e.g.
 * a grid cell or a side-sheet value that also carries a time.
 * @param {string} text
 * @returns {Date}
 */
export const parseDate = (text) => {
    const match = String(text ?? '').match(DATE_PATTERN);
    if (!match) {
        throw new Error(`Expected a DD-MM-YYYY date, got "${text}".`);
    }
    const [, day, month, year] = match.map(Number);
    return new Date(year, month - 1, day);
};

/**
 * Formats a date as `DD-MM-YYYY`, the format of the grid and the date filter inputs.
 * @param {Date} date
 */
export const formatDate = (date) => [
    String(date.getDate()).padStart(2, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    date.getFullYear(),
].join('-');

/**
 * A new date `days` after `date` (negative values go back).
 * @param {Date} date
 * @param {number} days
 */
export const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};
