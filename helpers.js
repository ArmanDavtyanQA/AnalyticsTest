import { expect } from '@playwright/test';
import testData from './testData.json' assert { type: 'json' };

/**
 * Generic Helpers
 */

export const wait = async (ms) => new Promise(resolve => setTimeout(resolve, ms));

const TABLE_BODY_SELECTOR =
    '.transactions-wrapper__listing table tbody, main table tbody, table tbody';
const TABLE_SELECTOR =
    '.transactions-wrapper__listing table, main table, table';
// Localized "no results" copy. The empty state replaces <tbody> with a <div>
// that contains this message when the API returns zero rows.
const EMPTY_STATE_TEXT = /արդյունքներ չեն գտնվել|no results found|no data/i;

const EMPTY_STATE_ERROR =
    'Transactions grid loaded but returned 0 rows ("Ցավոք, արդյունքներ չեն գտնվել"). ' +
    'The currently applied filters match no data on the test environment. ' +
    'Widen the date range in testData.json (or pick a value with known data) and rerun.';

// The grid is backed by a single GraphQL endpoint. Every filter / navigation that
// reloads the grid fires a POST whose operationName is "GetTransactions". The
// response is the slow part (~20-35s for wide ranges), so syncing on it lets us
// wait for the *actual* reload instead of racing against the previously rendered
// (stale) rows before deciding "data vs 0 rows".
const GRID_GRAPHQL_URL = '/proxy/graphql';
const GRID_OPERATION = 'GetTransactions';

/**
 * Resolves when the transactions grid's GraphQL query responds.
 *
 * Register this *before* the action that triggers the reload (filter submit,
 * navigation), then await it afterwards. Resolves to `null` (never rejects) if no
 * matching response arrives within the timeout, so callers can always fall back to
 * the DOM-based {@link waitForGridToLoad}.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout
 */
export const waitForGridResponse = (page, timeout = 60000) =>
    page
        .waitForResponse(
            (res) => {
                if (!res.url().includes(GRID_GRAPHQL_URL)) return false;
                if (res.request().method() !== 'POST') return false;
                const body = res.request().postData() || '';
                return body.includes(GRID_OPERATION);
            },
            { timeout }
        )
        .catch(() => null);

/**
 * Waits for the transactions grid to reach a terminal state.
 *
 * The grid can legitimately take ~30s+ to resolve for wide date ranges that return
 * large datasets, so the default timeout is generous. The loading skeleton rows live
 * *inside* <tbody>, so a visible <tbody> alone does not mean "loaded"; we wait until
 * those skeletons clear (-> data) or the empty-state placeholder appears (-> 0 rows).
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout
 * @param {{ allowEmpty?: boolean }} [options]
 *   - `allowEmpty: false` (default): throw a clear error if the grid resolves to 0
 *     rows. Use after applying a filter that is expected to match data, so a 0-row
 *     result fails loudly instead of causing a confusing downstream timeout.
 *   - `allowEmpty: true`: return normally on 0 rows. Use for navigation / reset,
 *     where a previously persisted filter may legitimately leave the grid empty and
 *     a later step (e.g. resetFilters) is responsible for recovering.
 * @returns {Promise<'data' | 'empty'>} the terminal state that was reached.
 */
export const waitForGridToLoad = async (page, timeout = 90000, { allowEmpty = false } = {}) => {
    let gridState = 'loading';
    await expect
        .poll(
            async () => {
                // Empty state: API returned 0 rows. Checked first because in this
                // state <tbody> is replaced by the placeholder, so there are no
                // skeletons to wait on.
                const emptyVisible = await page
                    .locator(TABLE_SELECTOR)
                    .first()
                    .locator('p', { hasText: EMPTY_STATE_TEXT })
                    .first()
                    .isVisible()
                    .catch(() => false);
                if (emptyVisible) {
                    gridState = 'empty';
                    return 'empty';
                }

                // Data state: <tbody> is visible AND all loading skeletons have
                // resolved into real rows.
                const tableBody = page.locator(TABLE_BODY_SELECTOR).first();
                const tbodyVisible = await tableBody.isVisible().catch(() => false);
                if (tbodyVisible) {
                    const visibleSkeletons = await tableBody
                        .locator('.react-loading-skeleton:visible')
                        .count()
                        .catch(() => 1);
                    if (visibleSkeletons === 0) {
                        gridState = 'data';
                        return 'data';
                    }
                }

                return 'loading';
            },
            {
                timeout,
                message:
                    `Transactions grid still showing loading skeletons after ${timeout}ms. ` +
                    'The GetTransactions GraphQL query has not returned. This usually means the ' +
                    'current filter combination triggers a very slow/expensive backend query ' +
                    '(e.g. a text filter applied over a very wide date range). Narrow the date ' +
                    'range, use a filter value known to return data quickly, or raise the timeout.',
            }
        )
        .not.toBe('loading');

    if (gridState === 'empty' && !allowEmpty) {
        throw new Error(EMPTY_STATE_ERROR);
    }

    return gridState;
};

/**
 * Submits the visible filter popup and waits for the transactions grid reload.
 * Register the GraphQL waiter before clicking so we don't read stale skeleton rows.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout]
 */
export const submitVisibleFilterPopup = async (page, timeout = 90_000) => {
    const submitButton = page
        .locator('.filter-popup:visible .filter-popup__footer button[type="submit"]')
        .first();
    await expect(submitButton).toBeEnabled();
    const gridResponse = waitForGridResponse(page, timeout);
    await submitButton.click();
    await expect(page.locator('.filter-popup:visible')).toBeHidden({ timeout: 10_000 }).catch(() => { });
    await gridResponse;
    return waitForGridToLoad(page, timeout);
};

export const takeScreenshot = async (page, name) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-results/${name}-${timestamp}.png`;
    await page.screenshot({ path: filename, fullPage: true });
    return filename;
};

export const isElementVisible = async (locator, timeout = 5000) => {
    try {
        await locator.waitFor({ state: 'visible', timeout });
        return true;
    } catch {
        return false;
    }
};

export const fillWithRetry = async (locator, value, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            await locator.clear();
            await locator.fill(value);
            return;
        } catch (error) {
            if (i === retries - 1) throw error;
            await wait(1000);
        }
    }
};

export const parseDate = (value) => {
    if (!value) return null;
    const [dd, mm, yyyy] = value.split('-').map(Number);
    return new Date(yyyy, mm - 1, dd);
};


export const openDetailsSideSheet = async (page, rowIndex = 0) => {
    await expect(page.locator('.filter-popup.show')).toBeHidden({ timeout: 5000 });

    // Wait for either rows or the empty state, then surface a clear error if
    // there are no rows to click. Otherwise this used to time out on
    // `tbody.toBeVisible`, masking the real cause (filter returned 0 results).
    await waitForGridToLoad(page);

    const tableBody = page.locator('.transactions-wrapper__listing table tbody');
    const row = tableBody.locator('tr').nth(rowIndex);
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.click();
    const sideSheet = page.locator('.side-sheet__container');
    await expect(sideSheet).toBeVisible({ timeout: 15000 });
    await expect(
        sideSheet.locator('.side-sheet__content')
    ).toBeVisible();
    return sideSheet;
};

export const applyDateFilter = async (page, filterId, configKey = 'standardRange') => {
    const dateConfig = testData.creationDateFilters[configKey];
    if (!dateConfig) {
        throw new Error(`Date configuration '${configKey}' not found in testData.json`);
    }
    const filterChip = page.locator(`.filter-chip[data-filter-id="${filterId}"]`);
    await expect(filterChip).toBeVisible({ timeout: 15_000 });
    await filterChip.click();
    const filterPopup = page.locator('.filter-popup.show');
    await expect(filterPopup).toBeVisible();
    const transactionStartDateInput = page.locator('input[name="transactionStartDate"]');
    const transactionEndDateInput = page.locator('input[name="trasnactionEndDate"]');
    await expect(transactionStartDateInput).toBeVisible();
    await transactionStartDateInput.fill(dateConfig.startDate);
    if (dateConfig.endDate) {
        const endDateVisible = await transactionEndDateInput.isVisible().catch(() => false);
        if (endDateVisible) {
            await transactionEndDateInput.fill(dateConfig.endDate);
        }
    }
    // Start listening for the grid reload BEFORE the submit so we don't miss it
    // and don't read stale rows that are still on screen pre-reload.
    const gridResponse = waitForGridResponse(page);
    await transactionStartDateInput.press('Enter');
    const submitButton = filterPopup.locator('button[type="submit"], .filter-popup__footer button').first();
    if (await filterPopup.isVisible()) {
        await expect(submitButton).toBeEnabled({ timeout: 5000 });
        await submitButton.click();
    }
    await expect(filterPopup).toBeHidden({ timeout: 10_000 });
    await gridResponse;
    await waitForGridToLoad(page);
}

export const creationDateFilterRange = async (page, configKey = 'standardRange') => {
    return applyDateFilter(page, 'creationDate', configKey);
}

export const settlementDateFilterRange = async (page, configKey = 'settlementDate') => {
    return applyDateFilter(page, 'settlementDate', configKey);
}



/**
 * Retrieves a value from the Side Sheet using semantic section and item indices.
 * 
 * @param {Locator} sideSheet - The side sheet container locator
 * @param {number} sectionIndex - The list-card index (typically 5 for details)
 * @param {number} itemIndex - The transaction-list-item index within the section
 * @returns {Promise<string>} The trimmed text value from the span element
 * @throws {Error} If the DOM structure is not found or values are missing
 */
export const getSideSheetValue = async (sideSheet, sectionIndex, itemIndex) => {
    const config = testData.sideSheet;
    const sectionIdx = typeof sectionIndex === 'string' ? config.sections[sectionIndex] : sectionIndex;
    const itemIdx = typeof itemIndex === 'string' ? config.items[itemIndex] : itemIndex;
    const cardPath = `${config.selectors.card}:nth-child(${sectionIdx})`;
    const itemPath = `${config.selectors.item}`;
    const valuePath = `${config.selectors.valueSpan}`;

    try {
        const value = await sideSheet
            .locator(config.selectors.content)
            .locator(cardPath)
            .locator(config.selectors.itemContainer)
            .locator(itemPath)
            .nth(itemIdx)
            .locator(valuePath)
            .textContent({ timeout: 15000 });

        if (!value) {
            throw new Error(
                `Side Sheet value is empty. ` +
                `Section: ${sectionIndex}, Item: ${itemIndex}. ` +
                `Selector path: ${cardPath} > ${itemPath}[${itemIndex}] > ${valuePath}`
            );
        }

        return value.trim();
    } catch (error) {
        try {
            const items = sideSheet
                .locator(config.selectors.content)
                .locator(cardPath)
                .locator(config.selectors.itemContainer)
                .locator(config.selectors.item);
            const count = await items.count();
            console.log(`Debug: Found ${count} items in section ${sectionIdx}:`);
            for (let i = 0; i < count; i++) {
                const text = await items.nth(i).innerText();
                console.log(` - Item ${i}: "${text.replace(/\n/g, ' ')}"`);
            }
        } catch (e) {
            console.log('Debug: Failed to log items:', e.message);
        }

        throw new Error(
            `Failed to retrieve Side Sheet value at section ${sectionIndex} (idx: ${sectionIdx}), item ${itemIndex} (idx: ${itemIdx}). ` +
            `Original error: ${error.message}`
        );
    }
}

export const resetFilters = async (page) => {
    const resetButton = page.locator('.filter-chip[data-filter-id="reset"]');
    if ((await resetButton.count()) === 0) {
        return;
    }

    await expect(resetButton).toBeVisible({ timeout: 5000 });
    await resetButton.click();

    // Reset is considered successful if EITHER the reset chip disappears OR the
    // grid finishes reloading. Failures from BOTH signals must surface so dirty
    // state is not silently swallowed.
    try {
        await expect(resetButton).toBeHidden({ timeout: 5000 });
    } catch (chipHiddenError) {
        try {
            await waitForGridToLoad(page, 90000, { allowEmpty: true });
        } catch (gridLoadError) {
            throw new Error(
                'resetFilters: reset chip remained visible AND grid did not finish loading. ' +
                `Reset chip "toBeHidden" error: ${chipHiddenError.message}. ` +
                `Grid load error: ${gridLoadError.message}`
            );
        }
    }
};

/**
 * Robustly retrieves a filter option from the .add-filter popup.
 * 
 * Waits for the popup to be visible, queries only within it, and matches label text
 * with trimming to avoid flakiness from hidden/detached DOM nodes in parallel execution.
 * 
 * @param {Page} page - The Playwright page object
 * @param {string} labelText - The label text to match (will be trimmed)
 * @returns {Locator} The filter item locator scoped to the visible .add-filter container
 */
export const getFilterByLabel = async (page, labelText) => {
    const addFilterPopup = page.locator('.add-filter');
    await expect(addFilterPopup).toBeVisible({ timeout: 5000 });
    const trimmedLabel = labelText.trim();
    return addFilterPopup.locator('.add-filter-list .add-filter-list__item', { hasText: new RegExp(`^${trimmedLabel}$`, 'i') });
};

/**
 * Opens "Add Filter" popup and selects one by label.
 */
export const selectFilterByLabel = async (page, labelText) => {
    const addFilterChip = page.locator('.filter-chip:not([data-filter-id])');
    await expect(addFilterChip).toBeVisible({ timeout: 10000 });
    await addFilterChip.click();

    const filterOption = await getFilterByLabel(page, labelText);
    await expect(filterOption).toBeVisible();
    await filterOption.click();
};