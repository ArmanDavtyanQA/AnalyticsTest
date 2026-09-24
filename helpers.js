import { expect } from '@playwright/test';
import testData from './testData.json' assert { type: 'json' };
import { ReactCalendar } from './pages/components/reactCalendar.component.js';
import { handleProfileVerification, isProfileVerificationRequired } from './pages/flows/profileVerification.flow.js';
import {
    TransactionSideSheet,
    isSideSheetValuePopulated,
    isUsableFilterSeed,
    resolveSideSheetFieldKey,
    readSideSheetItemValue,
} from './pages/components/transactionSideSheet.component.js';

export { ReactCalendar, toCalendarInputDate } from './pages/components/reactCalendar.component.js';
export {
    TransactionSideSheet,
    SIDE_SHEET_FIELDS,
    isSideSheetValuePopulated,
    isUsableFilterSeed,
    resolveSideSheetFieldKey,
    readSideSheetItemValue,
} from './pages/components/transactionSideSheet.component.js';

/** Bilingual filter labels for "Add filter" popup (hy / en). */
export const FILTER_LABELS = {
    SETTLEMENT_DATE: /^(Settlement date|Հաշվանցման ամսաթիվ)$/i,
    CREATION_DATE: /^(Creation date|Ստեղծման ամսաթիվ)$/i,
    CARD_NUMBER: /^(Card number|Քարտի համար)$/i,
    AMOUNT: /^(Amount|Գումար)$/i,
    UNIQUE_ID: /^(Unique ID|Ունիկալ ID)$/i,
    TERMINAL_ID: /^(Terminal ID|Տերմինալ ID)$/i,
    SERIAL_NUMBER: /^(Serial number|Սերիական համար)$/i,
    MERCHANT_NAME: /^(ASC name|Merchant name|ԱՍԿ անվանում)$/i,
    ADDRESS: /^(Address|Հասցե)$/i,
};

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
    await handleProfileVerification(page);

    let gridState = 'loading';
    await expect
        .poll(
            async () => {
                if (await isProfileVerificationRequired(page)) {
                    await handleProfileVerification(page);
                    return 'loading';
                }

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

const REPORTS_TABLE =
    '.transactions-reports-wrapper table, .reports-table table, .transactions-wrapper__listing table, table';
const REPORTS_TABLE_BODY =
    '.transactions-reports-wrapper table tbody, .reports-table table tbody, '
    + '.transactions-wrapper__listing table tbody, table tbody';
/** Data cell text — header rows have buttons, not `td p`. Prefer :visible. */
const REPORTS_DATA_CELL =
    '.transactions-reports-wrapper table tbody tr td p, .reports-table table tbody tr td p, '
    + '.transactions-wrapper__listing table tbody tr td p, table tbody tr td p';

/**
 * Waits for the reports grid (active or archived) to finish loading.
 * Do not use {@link waitForGridToLoad} on reports pages — that helper targets the
 * transactions grid and can poll the wrong table / wait on GetTransactions semantics.
 *
 * Readiness is based on a visible data cell (or empty-state copy). Remount only when
 * no `td p` exists in the DOM at all — a narrow `.reports-table` selector used to
 * miss an already-painted grid and poll "loading" until timeout.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout]
 */
export const waitForReportsGridToLoad = async (page, timeout = 90_000) => {
    await handleProfileVerification(page);

    const tableBody = page.locator(REPORTS_TABLE_BODY).first();
    const dataCell = page.locator(`${REPORTS_DATA_CELL} >> visible=true`).first();

    const hasPaintedRows = async () => dataCell.isVisible().catch(() => false);
    const hasDataCellInDom = async () =>
        (await page.locator(REPORTS_DATA_CELL).count().catch(() => 0)) > 0;

    await expect
        .poll(
            async () => {
                if (await isProfileVerificationRequired(page)) {
                    await handleProfileVerification(page);
                    return 'loading';
                }

                const emptyVisible = await page
                    .locator(REPORTS_TABLE)
                    .first()
                    .locator('p', { hasText: EMPTY_STATE_TEXT })
                    .first()
                    .isVisible()
                    .catch(() => false);
                if (emptyVisible) {
                    return 'ready';
                }

                if (await hasPaintedRows()) {
                    return 'ready';
                }

                // DOM has cells but visibility probe failed — still ready if skeletons are gone.
                if (await hasDataCellInDom()) {
                    const skeletons = await page
                        .locator('.react-loading-skeleton:visible')
                        .count()
                        .catch(() => 0);
                    if (skeletons === 0) {
                        return 'ready';
                    }
                }

                const bodyVisible = await tableBody.isVisible().catch(() => false);
                if (!bodyVisible) {
                    return 'loading';
                }
                const visibleSkeletons = await tableBody
                    .locator('.react-loading-skeleton:visible')
                    .count()
                    .catch(() => 1);
                return visibleSkeletons === 0 ? 'ready' : 'loading';
            },
            {
                timeout,
                message:
                    `Reports grid not ready after ${timeout}ms. `
                    + 'Either the table never mounted (wrong selector / SPA shell) '
                    + 'or loading skeletons never cleared under backend load.',
            },
        )
        .not.toBe('loading');
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
    const normalized = String(value).trim().replace(/\//g, '-');
    const [dd, mm, yyyy] = normalized.split('-').map(Number);
    return new Date(yyyy, mm - 1, dd);
};


export const dismissSideSheet = async (sideSheet) => {
    const sheet = sideSheet instanceof TransactionSideSheet
        ? sideSheet
        : new TransactionSideSheet(sideSheet);
    await sheet.dismiss();
};

/**
 * Opens a transaction row's details side sheet and waits until the async details
 * payload has painted at least one real field.
 */
export const openDetailsSideSheet = async (page, rowIndex = 0, { detailsTimeout = 30_000 } = {}) => {
    await expect(page.locator('.filter-popup.show')).toBeHidden({ timeout: 5000 }).catch(() => { });

    await waitForGridToLoad(page);

    const tableBody = page.locator('.transactions-wrapper__listing table tbody');
    const row = tableBody.locator('tr').nth(rowIndex);
    await expect(row).toBeVisible({ timeout: 15000 });

    const root = page.locator('.side-sheet__container');
    for (const cellIndex of [0, 1, 4]) {
        if (await root.isVisible().catch(() => false)) break;
        await row.locator('td').nth(cellIndex).click({ timeout: 5_000 }).catch(() => { });
        const opened = await root
            .waitFor({ state: 'visible', timeout: 5_000 })
            .then(() => true)
            .catch(() => false);
        if (opened) break;
    }
    await expect(root).toBeVisible({ timeout: 15000 });
    await expect(root.locator('.side-sheet__content')).toBeVisible();

    const sheet = new TransactionSideSheet(root);
    await expect
        .poll(
            async () => isSideSheetValuePopulated(
                await readSideSheetItemValue(sheet.fieldItem('CREATION_DATE')).catch(() => ''),
            ),
            {
                timeout: detailsTimeout,
                message:
                    'Transaction details side sheet opened but values never populated '
                    + '(still empty / "null null"). The details fetch likely stalled.',
            },
        )
        .toBe(true);

    return root;
};

/**
 * Reads a side-sheet field by semantic key (e.g. `SETTLEMENT_DATE`) or legacy indices.
 */
export const getSideSheetValue = async (
    sideSheet,
    sectionOrField,
    itemKey,
    { timeout = 15000 } = {},
) => {
    const fieldKey = resolveSideSheetFieldKey(sectionOrField, itemKey);
    const sheet = sideSheet instanceof TransactionSideSheet
        ? sideSheet
        : new TransactionSideSheet(sideSheet);

    try {
        return await sheet.getFieldValue(fieldKey, { timeout });
    } catch (error) {
        try {
            const items = sheet.content.locator(
                '.transactions-list-card__item, .list-card__item',
            );
            const count = await items.count();
            console.log(`Debug: Found ${count} side-sheet items:`);
            for (let i = 0; i < count; i++) {
                const text = await items.nth(i).innerText();
                console.log(` - Item ${i}: "${text.replace(/\n/g, ' ')}"`);
            }
        } catch (e) {
            console.log('Debug: Failed to log side-sheet items:', e.message);
        }

        throw new Error(
            `Failed to retrieve side-sheet field "${fieldKey}" `
            + `(from section=${sectionOrField}, item=${itemKey ?? 'n/a'}). `
            + `Original error: ${error.message}`,
        );
    }
};

export const applyDateFilter = async (page, filterId, configKey = 'standardRange', { timeout = 90_000 } = {}) => {
    const dateConfig = testData.creationDateFilters[configKey];
    if (!dateConfig) {
        throw new Error(`Date configuration '${configKey}' not found in testData.json`);
    }

    const calendar = await ReactCalendar.openFromChip(page, filterId);
    await calendar.setRange(dateConfig.startDate, dateConfig.endDate);

    const gridResponse = waitForGridResponse(page, timeout);
    await calendar.apply();
    await gridResponse;
    await waitForGridToLoad(page, timeout);
};

export const creationDateFilterRange = async (page, configKey = 'standardRange', options) => {
    return applyDateFilter(page, 'creationDate', configKey, options);
};

export const applyCreationDateExact = async (page, dateOnly, { timeout = 90_000 } = {}) => {
    const calendar = await ReactCalendar.openFromChip(page, 'creationDate');
    await calendar.setExact(dateOnly);

    const gridResponse = waitForGridResponse(page, timeout);
    await calendar.apply();
    await gridResponse;
    await waitForGridToLoad(page, timeout);
};

export const fillVisibleCalendarRange = async (
    page,
    startDate,
    endDate,
    { forceRange = false, chipText } = {},
) => {
    const calendar = await ReactCalendar.waitForOpen(page, { chipText });
    if (forceRange || (endDate && startDate !== endDate)) {
        await calendar.setRange(startDate, endDate ?? startDate);
    } else {
        await calendar.setExact(startDate);
    }
    return { calendar };
};

export const settlementDateFilterRange = async (page, configKey = 'settlementDate') => {
    return applyDateFilter(page, 'settlementDate', configKey);
};

export const getSideSheetFilterSeed = async (
    page,
    sectionOrField,
    itemIndex,
    { maxRows = 12, perRowTimeout = 8_000 } = {},
) => {
    const fieldKey = resolveSideSheetFieldKey(sectionOrField, itemIndex);
    const seeds = await getSideSheetFilterSeeds(
        page,
        [{ key: 'value', field: fieldKey }],
        { maxRows, perRowTimeout },
    );
    return seeds.value;
};

export const getSideSheetFilterSeeds = async (
    page,
    fields,
    { maxRows = 12, perRowTimeout = 8_000 } = {},
) => {
    const fieldDesc = fields
        .map((f) => (f.field ? `${f.key}(${f.field})` : `${f.key}(${f.section}/${f.item})`))
        .join(', ');

    for (let row = 0; row < maxRows; row++) {
        const openSheet = page.locator('.side-sheet__container');
        if (await openSheet.isVisible().catch(() => false)) {
            await dismissSideSheet(openSheet).catch(() => { });
        }

        let sideSheet;
        try {
            sideSheet = await openDetailsSideSheet(page, row, { detailsTimeout: 20_000 });
        } catch {
            console.log(
                `[FilterSeed] NOT FOUND: could not open details for grid row ${row} `
                + `(looking for ${fieldDesc}).`,
            );
            continue;
        }

        const sheet = new TransactionSideSheet(sideSheet);
        try {
            const result = {};
            let allUsable = true;
            let unusableKey = null;
            let unusableValue = null;
            for (const field of fields) {
                const fieldKey = field.field
                    ? field.field
                    : resolveSideSheetFieldKey(field.section, field.item);
                const value = await sheet.getFieldValue(fieldKey, { timeout: perRowTimeout });
                if (!isUsableFilterSeed(value)) {
                    allUsable = false;
                    unusableKey = field.key;
                    unusableValue = value;
                    break;
                }
                result[field.key] = value;
            }
            if (allUsable) {
                await dismissSideSheet(sheet);
                return result;
            }
            console.log(
                `[FilterSeed] NOT FOUND: row ${row} ${unusableKey} is unusable `
                + `(value="${unusableValue ?? ''}") — trying next row.`,
            );
        } catch {
            console.log(
                `[FilterSeed] NOT FOUND: row ${row} missing populated ${fieldDesc} — trying next row.`,
            );
        }

        await dismissSideSheet(sheet).catch(() => { });
    }

    throw new Error(
        `No usable side-sheet filter seeds [${fieldDesc}] in the first ${maxRows} grid rows `
        + '(values were empty, "null null", or N/A).',
    );
};

export const getMerchantNameFromGrid = async (page, rowIndex = 0) => {
    const cell = page
        .locator('.transactions-wrapper__listing table tbody tr')
        .nth(rowIndex)
        .locator('td')
        .nth(1)
        .locator('p');
    await expect(cell).toBeVisible({ timeout: 15_000 });
    const name = ((await cell.textContent()) || '').trim();
    expect(name, 'grid merchant name cell was empty').toBeTruthy();
    return name;
};

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
 * @param {string|RegExp} labelText
 */
export const getFilterByLabel = async (page, labelText) => {
    const addFilterPopup = page.locator('.add-filter');
    await expect(addFilterPopup).toBeVisible({ timeout: 5000 });
    const pattern = labelText instanceof RegExp
        ? labelText
        : new RegExp(`^${String(labelText).trim()}$`, 'i');
    return addFilterPopup.locator('.add-filter-list .add-filter-list__item', { hasText: pattern });
};

/**
 * Opens "Add Filter" popup and selects one by label (string or {@link FILTER_LABELS} regex).
 */
export const selectFilterByLabel = async (page, labelText) => {
    const addFilterChip = page.locator('.filter-chip:not([data-filter-id])');
    await expect(addFilterChip).toBeVisible({ timeout: 10000 });
    await addFilterChip.click();

    const filterOption = await getFilterByLabel(page, labelText);
    await expect(filterOption).toBeVisible();
    await filterOption.click();
};