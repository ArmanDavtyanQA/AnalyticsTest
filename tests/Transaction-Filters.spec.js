import { test, expect } from '../fixtures/index.js';
import {
    creationDateFilterRange,
    openDetailsSideSheet,
    getSideSheetValue,
    resetFilters,
    selectFilterByLabel,
    parseDate,
} from '../helpers.js';
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

        const tableBody = page.locator('.transactions-wrapper__listing table tbody');
        const tableCreationDateTD = tableBody.locator('tr:first-child td:nth-child(3) p');
        await expect(tableBody).toBeVisible();
        await expect(tableCreationDateTD).toBeVisible();

        const txDateText = (await tableCreationDateTD.textContent()).trim();
        const { startDate: startDateText, endDate: endDateText } = testData.creationDateFilters.standardRange;
        const txDate = parseDate(txDateText);
        const startDate = parseDate(startDateText);
        const endDate = parseDate(endDateText);
        expect(txDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(txDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
    });

    test('Creation date filter with exact date', async ({ page }) => {
        const creationDateFilter = page.locator('.filter-chip[data-filter-id="creationDate"]');
        await expect(creationDateFilter).toBeVisible();
        await creationDateFilter.click();

        const filterPopup = page.locator('.filter-popup.show');
        await expect(filterPopup).toBeVisible();

        const switcher = filterPopup.locator('.filter-popup__container .switcher').first();
        await expect(switcher).toBeVisible();
        await switcher.click();

        const transactionEndDateInput = page.locator('input[name="trasnactionEndDate"]');
        await expect(transactionEndDateInput).toBeHidden();
        const transactionStartDateInput = page.locator('input[name="transactionStartDate"]');
        await expect(transactionStartDateInput).toBeVisible();

        const dateConfig = testData.creationDateFilters.exactDate;
        await transactionStartDateInput.fill(dateConfig.startDate);
        await transactionStartDateInput.press('Enter');
        await expect(filterPopup).toBeHidden();

        const tableBody = page.locator('.transactions-wrapper__listing table tbody');
        const tableCreationDateTD = tableBody.locator('tr:first-child td:nth-child(3) p');
        await expect(tableBody).toBeVisible();
        await expect(tableCreationDateTD).toBeVisible();

        const txDateText = (await tableCreationDateTD.textContent()).trim();
        const startDateText = await transactionStartDateInput.inputValue();
        expect(parseDate(txDateText).getTime()).toBeGreaterThanOrEqual(parseDate(startDateText).getTime());
    });

    test('Settlement date filter with exact date', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        const sideSheet = await openDetailsSideSheet(page);
        const settlementDateValue = await getSideSheetValue(sideSheet, 1, 3);
        await sideSheet.locator('[data-id="dismiss-svg-icon"]').click();
        await expect(sideSheet).toBeHidden();

        await selectFilterByLabel(page, 'Հաշվանցման ամսաթիվ');
        const dateOnly = settlementDateValue.split(' ')[0];
        const filterPopup = page.locator('.filter-popup:visible, .filter-popup.show').first();
        await expect(filterPopup).toBeVisible();

        const settlementStartDate = filterPopup.locator('input[name*="tartDate"]').first();
        const settlementEndDate = filterPopup.locator('input[name*="ndDate"]').first();
        const switcher = filterPopup.locator('.switcher').first();
        if (await switcher.isVisible() && await settlementStartDate.isHidden()) {
            await switcher.click();
            await expect(settlementStartDate).toBeVisible();
        }
        await expect(settlementStartDate).toBeVisible();
        await settlementStartDate.fill(dateOnly);
        if (await settlementEndDate.isVisible()) {
            await settlementEndDate.fill(dateOnly);
        }

        const submitButton = filterPopup.locator('button[type="submit"], .filter-popup__footer button').first();
        await expect(submitButton).toBeVisible();
        await submitButton.click();

        const tableBody = page.locator('.transactions-wrapper__listing table tbody');
        await expect(tableBody).toBeVisible();
        await expect(tableBody.locator('.react-loading-skeleton').first()).toBeHidden({ timeout: 30_000 });

        const filteredSideSheet = await openDetailsSideSheet(page);
        const settlementDateActualValue = await getSideSheetValue(filteredSideSheet, 1, 3);
        expect(settlementDateActualValue).toBe(settlementDateValue);
        await filteredSideSheet.locator('[data-id="dismiss-svg-icon"]').click();
        await expect(filteredSideSheet).toBeHidden();
    });

    test('Settlement date filter with date range', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        const sideSheet = await openDetailsSideSheet(page);
        const settlementDateValue = await getSideSheetValue(sideSheet, 1, 3);
        await sideSheet.locator('[data-id="dismiss-svg-icon"]').click();
        await expect(sideSheet).toBeHidden();

        await selectFilterByLabel(page, 'Հաշվանցման ամսաթիվ');
        const dateOnly = settlementDateValue.split(' ')[0];
        const filterPopup = page.locator('.filter-popup:visible, .filter-popup.show').first();
        await expect(filterPopup).toBeVisible();

        const settlementStartDate = filterPopup.locator('input[name*="tartDate"]').first();
        const settlementEndDate = filterPopup.locator('input[name*="ndDate"]').first();
        const switcher = filterPopup.locator('.switcher').first();
        await switcher.click();
        await expect(settlementStartDate).toBeVisible();
        await settlementStartDate.fill(dateOnly);
        if (await settlementEndDate.isVisible()) {
            await settlementEndDate.fill(dateOnly);
        }

        const submitButton = filterPopup.locator('button[type="submit"], .filter-popup__footer button').first();
        await expect(submitButton).toBeVisible();
        await submitButton.click();

        const tableBody = page.locator('.transactions-wrapper__listing table tbody');
        await expect(tableBody).toBeVisible();
        await expect(tableBody.locator('.react-loading-skeleton').first()).toBeHidden({ timeout: 30_000 });

        const filteredSideSheet = await openDetailsSideSheet(page);
        const settlementDateActualValue = await getSideSheetValue(filteredSideSheet, 1, 3);
        expect(settlementDateActualValue).toBe(settlementDateValue);
        await filteredSideSheet.locator('[data-id="dismiss-svg-icon"]').click();
        await expect(filteredSideSheet).toBeHidden();
    });

    test('Card number filter', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        await selectFilterByLabel(page, 'Քարտի համար');
        const cardNumber = page.locator('.filter-popup__container .input [name="cardNumber"]');
        await cardNumber.fill('0348');

        const submitButton = page.locator('.filter-popup:visible .filter-popup__footer button[type="submit"]');
        await expect(submitButton).toBeEnabled();
        await submitButton.click();

        const tableCardNumberTD = page.locator('.transactions-wrapper__listing table tbody tr:first-child td:nth-child(4) p');
        await expect(tableCardNumberTD).toBeVisible();
    });

    test('Exact amount filter', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        await selectFilterByLabel(page, 'Գումար');
        const amount = page.locator('.filter-popup__container .input [name="amountStartRange"]');
        await amount.fill('100');

        const submitButton = page.locator('.filter-popup:visible .filter-popup__footer button[type="submit"]');
        await expect(submitButton).toBeEnabled();
        await submitButton.click();

        const tableAmountTD = page.locator('.transactions-wrapper__listing table tbody tr:first-child td:nth-child(5) p');
        await expect(tableAmountTD).toBeVisible();
        const amountValue = parseFloat(((await tableAmountTD.textContent()) || '').trim());
        expect(amountValue).toBeGreaterThanOrEqual(100);
    });

    test('Amount range filter', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        await selectFilterByLabel(page, 'Գումար');

        const filterPopupVisible = page.locator('.filter-popup:visible');
        const amountSwitcher = filterPopupVisible.locator('.filter-popup__container .switcher').first();
        await expect(amountSwitcher).toBeVisible();
        await amountSwitcher.click();

        await page.locator('.filter-popup__container .input [name="amountStartRange"]').fill('50');
        await page.locator('.filter-popup__container .input [name="amountEndRange"]').fill('150');

        const submitButton = page.locator('.filter-popup:visible .filter-popup__footer button[type="submit"]');
        await expect(submitButton).toBeEnabled();
        await submitButton.click();

        const tableAmountTD = page.locator('.transactions-wrapper__listing table tbody tr:first-child td:nth-child(5) p');
        await expect(tableAmountTD).toBeVisible();
        const amountValue = parseFloat(((await tableAmountTD.textContent()) || '').trim());
        expect(amountValue).toBeGreaterThanOrEqual(50);
        expect(amountValue).toBeLessThanOrEqual(150);
    });

    test('Authorization Code UniqueID', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        await selectFilterByLabel(page, 'Ունիկալ ID');
        await page.locator('.unique-id-filter__col .select__input').click();
        const authCodeOption = page.locator('.select__options .select__option').filter({ hasText: 'Authorization Code' });
        await expect(authCodeOption).toBeVisible();
        await authCodeOption.click();
        await page.locator('input[name="uniqueIdValue"]').fill('937065');

        const submitButton = page.locator('.filter-popup:visible .filter-popup__footer button[type="submit"]');
        await expect(submitButton).toBeEnabled();
        await submitButton.click();

        const sideSheet = await openDetailsSideSheet(page);
        expect(await getSideSheetValue(sideSheet, 'DETAILS_CARD', 'AUTHORIZATION_CODE')).toBe('937065');
    });

    test('RRN 1 UniqueID', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        await selectFilterByLabel(page, 'Ունիկալ ID');
        await page.locator('.unique-id-filter__col .select__input').click();
        const rrn1Option = page.locator('.select__options .select__option').filter({ hasText: 'RRN 1' });
        await expect(rrn1Option).toBeVisible();
        await rrn1Option.click();
        await page.locator('input[name="uniqueIdValue"]').fill('603219937057');

        const submitButton = page.locator('.filter-popup:visible .filter-popup__footer button[type="submit"]');
        await expect(submitButton).toBeEnabled();
        await submitButton.click();

        const sideSheet = await openDetailsSideSheet(page, 0);
        expect(await getSideSheetValue(sideSheet, 'DETAILS_CARD', 'RRN_1')).toBe('603219937057');
    });

    test('RRN 2 UniqueID', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        await selectFilterByLabel(page, 'Ունիկալ ID');
        await page.locator('.unique-id-filter__col .select__input').click();
        const rrn2Option = page.locator('.select__options .select__option').filter({ hasText: 'RRN 2' });
        await expect(rrn2Option).toBeVisible();
        await rrn2Option.click();
        await page.locator('input[name="uniqueIdValue"]').fill('128685432785');

        const submitButton = page.locator('.filter-popup:visible .filter-popup__footer button[type="submit"]');
        await expect(submitButton).toBeEnabled();
        await submitButton.click();

        const sideSheet = await openDetailsSideSheet(page);
        expect(await getSideSheetValue(sideSheet, 'DETAILS_CARD', 'RRN_2')).toBe('128685432785');
    });

    test('RRN 3 UniqueID', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        await selectFilterByLabel(page, 'Ունիկալ ID');
        await page.locator('.unique-id-filter__col .select__input').click();
        const rrn3Option = page.locator('.select__options .select__option').filter({ hasText: 'RRN 3' });
        await expect(rrn3Option).toBeVisible();
        await rrn3Option.click();
        await page.locator('input[name="uniqueIdValue"]').fill('8255937065');

        const submitButton = page.locator('.filter-popup:visible .filter-popup__footer button[type="submit"]');
        await expect(submitButton).toBeEnabled();
        await submitButton.click();

        const sideSheet = await openDetailsSideSheet(page);
        expect(await getSideSheetValue(sideSheet, 'DETAILS_CARD', 'RRN_3')).toBe('8255937065');
    });

    test('Terminal ID filter', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        const sideSheet = await openDetailsSideSheet(page);
        const terminalIdValue = await getSideSheetValue(sideSheet, 1, 1);
        await sideSheet.locator('[data-id="dismiss-svg-icon"]').click();
        await expect(sideSheet).toBeHidden();

        await selectFilterByLabel(page, 'Տերմինալ ID');
        await filterDropdown(page, terminalIdValue);

        const tableBody = page.locator('.transactions-wrapper__listing table tbody');
        await expect(tableBody).toBeVisible();
        await expect(tableBody.locator('.react-loading-skeleton').first()).toBeHidden({ timeout: 30_000 });

        const filteredSideSheet = await openDetailsSideSheet(page);
        expect(await getSideSheetValue(filteredSideSheet, 1, 1)).toBe(terminalIdValue);
        await filteredSideSheet.locator('[data-id="dismiss-svg-icon"]').click();
        await expect(filteredSideSheet).toBeHidden();
    });

    test('Serial number filter', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        const sideSheet = await openDetailsSideSheet(page);
        const serialNumberValue = await getSideSheetValue(sideSheet, 4, 1);
        await sideSheet.locator('[data-id="dismiss-svg-icon"]').click();
        await expect(sideSheet).toBeHidden();

        await selectFilterByLabel(page, 'Սերիական համար');
        await filterDropdown(page, serialNumberValue);

        const tableBody = page.locator('.transactions-wrapper__listing table tbody');
        await expect(tableBody).toBeVisible();
        await expect(tableBody.locator('.react-loading-skeleton').first()).toBeHidden({ timeout: 30_000 });

        const filteredSideSheet = await openDetailsSideSheet(page);
        expect(await getSideSheetValue(filteredSideSheet, 4, 1)).toBe(serialNumberValue);
        await filteredSideSheet.locator('[data-id="dismiss-svg-icon"]').click();
        await expect(filteredSideSheet).toBeHidden();
    });

    test('Merchant name filter', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        const sideSheet = await openDetailsSideSheet(page);
        const merchantNameValue = ((await page
            .locator('.side-sheet__container .side-sheet__header .side-sheet__title')
            .textContent()) || '').trim();
        await sideSheet.locator('[data-id="dismiss-svg-icon"]').click();
        await expect(sideSheet).toBeHidden();

        await selectFilterByLabel(page, 'ԱՍԿ անվանում');
        await filterDropdown(page, merchantNameValue);

        const tableBody = page.locator('.transactions-wrapper__listing table tbody');
        await expect(tableBody).toBeVisible();
        await expect(tableBody.locator('.react-loading-skeleton').first()).toBeHidden({ timeout: 30_000 });

        const filteredSideSheet = await openDetailsSideSheet(page);
        const merchantNameActualValue = ((await filteredSideSheet.locator('.side-sheet__title').textContent()) || '').trim();
        expect(merchantNameActualValue).toBe(merchantNameValue);
        await filteredSideSheet.locator('[data-id="dismiss-svg-icon"]').click();
        await expect(filteredSideSheet).toBeHidden();
    });

    test('Address filter', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        const sideSheet = await openDetailsSideSheet(page);
        const addressValue = await getSideSheetValue(sideSheet, 3, 2);
        await sideSheet.locator('[data-id="dismiss-svg-icon"]').click();
        await expect(sideSheet).toBeHidden();

        await selectFilterByLabel(page, 'Հասցե');
        await filterDropdown(page, addressValue);

        const tableBody = page.locator('.transactions-wrapper__listing table tbody');
        await expect(tableBody).toBeVisible();
        await expect(tableBody.locator('.react-loading-skeleton').first()).toBeHidden({ timeout: 30_000 });

        const filteredSideSheet = await openDetailsSideSheet(page);
        expect(await getSideSheetValue(filteredSideSheet, 3, 2)).toBe(addressValue);
        await filteredSideSheet.locator('[data-id="dismiss-svg-icon"]').click();
        await expect(filteredSideSheet).toBeHidden();
    });
});
