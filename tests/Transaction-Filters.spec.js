import { test, expect } from '../fixtures/index.js';
import {
    creationDateFilterRange,
    openDetailsSideSheet,
    getSideSheetValue,
    getSideSheetFilterSeed,
    dismissSideSheet,
    resetFilters,
    selectFilterByLabel,
    parseDate,
    waitForGridToLoad,
    submitVisibleFilterPopup,
    fillVisibleCalendarRange,
    FILTER_LABELS,
    TransactionsGrid,
    GRID_COLUMNS,
    cardNumberSeed,
} from '../helpers.js';
import { ReactCalendar } from '../pages/components/reactCalendar.component.js';
import { filterDropdown } from '../utils/filters/filterDropdown.js';
import { goToTransactions } from '../pages/flows/navigation.flow.js';
import { ROUTES } from '../pages/flows/auth.flow.js';
import testData from '../testData.json' assert { type: 'json' };

test.describe('Filters', () => {
    test.beforeEach(async ({ page }) => {
        await goToTransactions(page);
        await resetFilters(page);
    });

    test('Test environment login and navigation', async ({ page }) => {
        await expect(page).toHaveURL(new RegExp(`${ROUTES.transactions}$`));
    });

    test('Creation date filter with date range', async ({ page }) => {
        await creationDateFilterRange(page);
        const filterPopup = page.locator('.filter-popup.show');
        await expect(filterPopup).toBeHidden();

        const grid = new TransactionsGrid(page);
        const txDateText = await grid.getText(GRID_COLUMNS.CREATION_DATE);
        const { startDate: startDateText, endDate: endDateText } = testData.creationDateFilters.standardRange;
        const txDate = parseDate(txDateText);
        const startDate = parseDate(startDateText);
        const endDate = parseDate(endDateText);
        expect(txDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(txDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
    });

    test('Creation date filter with exact date', async ({ page }) => {
        const calendar = await ReactCalendar.openFromChip(page, 'creationDate');
        const dateConfig = testData.creationDateFilters.exactDate;
        await calendar.setExact(dateConfig.startDate);
        await calendar.apply();

        await waitForGridToLoad(page);

        const txDateText = await new TransactionsGrid(page).getText(GRID_COLUMNS.CREATION_DATE);
        expect(parseDate(txDateText).getTime()).toBeGreaterThanOrEqual(parseDate(dateConfig.startDate).getTime());
    });

    test('Settlement date filter with exact date', async ({ page }) => {
        await creationDateFilterRange(page, 'recentRange');
        const settlementDateValue = await getSideSheetFilterSeed(page, 'SETTLEMENT_DATE');
        await selectFilterByLabel(page, FILTER_LABELS.SETTLEMENT_DATE);
        const dateOnly = settlementDateValue.split(' ')[0];
        const { calendar } = await fillVisibleCalendarRange(page, dateOnly, dateOnly, {
            chipText: FILTER_LABELS.SETTLEMENT_DATE,
        });
        await calendar.apply();
        await waitForGridToLoad(page);

        const filteredSideSheet = await openDetailsSideSheet(page);
        expect(await getSideSheetValue(filteredSideSheet, 'SETTLEMENT_DATE')).toBe(settlementDateValue);
        await dismissSideSheet(filteredSideSheet);
    });

    test('Settlement date filter with date range', async ({ page }) => {
        await creationDateFilterRange(page, 'recentRange');
        const settlementDateValue = await getSideSheetFilterSeed(page, 'SETTLEMENT_DATE');
        await selectFilterByLabel(page, FILTER_LABELS.SETTLEMENT_DATE);
        const dateOnly = settlementDateValue.split(' ')[0];
        const { calendar } = await fillVisibleCalendarRange(page, dateOnly, dateOnly, {
            forceRange: true,
            chipText: FILTER_LABELS.SETTLEMENT_DATE,
        });
        await calendar.apply();
        await waitForGridToLoad(page);

        const filteredSideSheet = await openDetailsSideSheet(page);
        expect(await getSideSheetValue(filteredSideSheet, 'SETTLEMENT_DATE')).toBe(settlementDateValue);
        await dismissSideSheet(filteredSideSheet);
    });

    test('Card number filter', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        const grid = new TransactionsGrid(page);
        const { value: cardCell } = await grid.firstUsableValue(
            GRID_COLUMNS.CARD_NUMBER,
            { accept: (value) => Boolean(cardNumberSeed(value)) },
        );
        const lastFour = cardNumberSeed(cardCell);

        await selectFilterByLabel(page, FILTER_LABELS.CARD_NUMBER);
        await page.locator('.filter-popup__container .input [name="cardNumber"]').fill(lastFour);

        await submitVisibleFilterPopup(page);

        const filteredCard = await new TransactionsGrid(page).getText(GRID_COLUMNS.CARD_NUMBER);
        expect(filteredCard.replace(/\D/g, '')).toContain(lastFour);
    });

    test('Exact amount filter', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        const grid = new TransactionsGrid(page);
        const seedAmount = await grid.getAmount();
        expect(seedAmount, 'grid amount cell was not numeric').toBeGreaterThan(0);

        await selectFilterByLabel(page, FILTER_LABELS.AMOUNT);
        await page.locator('.filter-popup__container .input [name="amountStartRange"]').fill(String(seedAmount));

        await submitVisibleFilterPopup(page);

        const filteredAmount = await new TransactionsGrid(page).getAmount();
        expect(filteredAmount).toBeGreaterThanOrEqual(seedAmount);
    });

    test('Amount range filter', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        const grid = new TransactionsGrid(page);
        const seedAmount = await grid.getAmount();
        expect(seedAmount, 'grid amount cell was not numeric').toBeGreaterThan(0);
        const low = Math.max(0, Math.floor(seedAmount) - 10);
        const high = Math.ceil(seedAmount) + 10;

        await selectFilterByLabel(page, FILTER_LABELS.AMOUNT);

        const filterPopupVisible = page.locator('.filter-popup:visible');
        const amountSwitcher = filterPopupVisible.locator('.switcher, .controller--switch').first();
        await expect(amountSwitcher).toBeVisible();
        await amountSwitcher.click();

        await page.locator('.filter-popup__container .input [name="amountStartRange"]').fill(String(low));
        await page.locator('.filter-popup__container .input [name="amountEndRange"]').fill(String(high));

        await submitVisibleFilterPopup(page);

        const filteredAmount = await new TransactionsGrid(page).getAmount();
        expect(filteredAmount).toBeGreaterThanOrEqual(low);
        expect(filteredAmount).toBeLessThanOrEqual(high);
    });

    test('Authorization Code UniqueID', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        await selectFilterByLabel(page, FILTER_LABELS.UNIQUE_ID);
        await page.locator('.unique-id-filter__col .select__input').click();
        const authCodeOption = page.locator('.select__options .select__option').filter({ hasText: 'Authorization Code' });
        await expect(authCodeOption).toBeVisible();
        await authCodeOption.click();
        await page.locator('input[name="uniqueIdValue"]').fill('937065');

        const submitButton = page.locator('.filter-popup:visible .filter-popup__footer button[type="submit"]');
        await expect(submitButton).toBeEnabled();
        await submitButton.click();

        const sideSheet = await openDetailsSideSheet(page);
        expect(await getSideSheetValue(sideSheet, 'AUTHORIZATION_CODE')).toBe('937065');
    });

    test('RRN 1 UniqueID', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        await selectFilterByLabel(page, FILTER_LABELS.UNIQUE_ID);
        await page.locator('.unique-id-filter__col .select__input').click();
        const rrn1Option = page.locator('.select__options .select__option').filter({ hasText: 'RRN 1' });
        await expect(rrn1Option).toBeVisible();
        await rrn1Option.click();
        await page.locator('input[name="uniqueIdValue"]').fill('603219937057');

        const submitButton = page.locator('.filter-popup:visible .filter-popup__footer button[type="submit"]');
        await expect(submitButton).toBeEnabled();
        await submitButton.click();

        const sideSheet = await openDetailsSideSheet(page, 0);
        expect(await getSideSheetValue(sideSheet, 'RRN_1')).toBe('603219937057');
    });

    test('RRN 2 UniqueID', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        await selectFilterByLabel(page, FILTER_LABELS.UNIQUE_ID);
        await page.locator('.unique-id-filter__col .select__input').click();
        const rrn2Option = page.locator('.select__options .select__option').filter({ hasText: 'RRN 2' });
        await expect(rrn2Option).toBeVisible();
        await rrn2Option.click();
        await page.locator('input[name="uniqueIdValue"]').fill('128685432785');

        const submitButton = page.locator('.filter-popup:visible .filter-popup__footer button[type="submit"]');
        await expect(submitButton).toBeEnabled();
        await submitButton.click();

        const sideSheet = await openDetailsSideSheet(page);
        expect(await getSideSheetValue(sideSheet, 'RRN_2')).toBe('128685432785');
    });

    test('RRN 3 UniqueID', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        await selectFilterByLabel(page, FILTER_LABELS.UNIQUE_ID);
        await page.locator('.unique-id-filter__col .select__input').click();
        const rrn3Option = page.locator('.select__options .select__option').filter({ hasText: 'RRN 3' });
        await expect(rrn3Option).toBeVisible();
        await rrn3Option.click();
        await page.locator('input[name="uniqueIdValue"]').fill('8255937065');

        const submitButton = page.locator('.filter-popup:visible .filter-popup__footer button[type="submit"]');
        await expect(submitButton).toBeEnabled();
        await submitButton.click();

        const sideSheet = await openDetailsSideSheet(page);
        expect(await getSideSheetValue(sideSheet, 'RRN_3')).toBe('8255937065');
    });

    test('Terminal ID filter', async ({ page }) => {
        await creationDateFilterRange(page, 'recentRange');
        const grid = new TransactionsGrid(page);
        const { value: terminalIdValue } = await grid.firstUsableValue(GRID_COLUMNS.TERMINAL_ID);

        await selectFilterByLabel(page, FILTER_LABELS.TERMINAL_ID);
        await filterDropdown(page, terminalIdValue);

        await waitForGridToLoad(page);

        expect(await new TransactionsGrid(page).getText(GRID_COLUMNS.TERMINAL_ID)).toBe(terminalIdValue);
    });

    test('Serial number filter', async ({ page }) => {
        await creationDateFilterRange(page, 'recentRange');
        const serialNumberValue = await getSideSheetFilterSeed(page, 'SERIAL_NUMBER');

        await selectFilterByLabel(page, FILTER_LABELS.SERIAL_NUMBER);
        await filterDropdown(page, serialNumberValue);

        await waitForGridToLoad(page);

        const filteredSideSheet = await openDetailsSideSheet(page);
        expect(await getSideSheetValue(filteredSideSheet, 'SERIAL_NUMBER')).toBe(serialNumberValue);
        await dismissSideSheet(filteredSideSheet);
    });

    test('Merchant name filter', async ({ page }) => {
        await creationDateFilterRange(page, 'recentRange');
        const grid = new TransactionsGrid(page);
        const { value: merchantNameValue } = await grid.firstUsableValue(GRID_COLUMNS.MERCHANT_NAME);

        await selectFilterByLabel(page, FILTER_LABELS.MERCHANT_NAME);
        await filterDropdown(page, merchantNameValue);

        await waitForGridToLoad(page);

        expect(await new TransactionsGrid(page).getText(GRID_COLUMNS.MERCHANT_NAME)).toBe(merchantNameValue);
    });

    test('Address filter', async ({ page }) => {
        await creationDateFilterRange(page, 'recentRange');
        const grid = new TransactionsGrid(page);
        const { value: addressValue } = await grid.firstUsableValue(GRID_COLUMNS.ADDRESS);

        await selectFilterByLabel(page, FILTER_LABELS.ADDRESS);
        await filterDropdown(page, addressValue);

        await waitForGridToLoad(page);

        expect(await new TransactionsGrid(page).getText(GRID_COLUMNS.ADDRESS)).toBe(addressValue);
    });
});
