const { test, expect } = require('@playwright/test');
import { creationDateFilterRange, openDetailsSideSheet, getSideSheetValue, resetFilters, getFilterByLabel } from '../helpers';
import { filterDropdown } from '../utils/filters/filterDropdown';
import testData from '../testData.json' assert { type: 'json' };

async function login(page) {
    await page.addInitScript(() => {
        window.process = window.process || { env: {} };
    });

    await page.goto('https://sme-ecosystem-pos-analytics.test.ameriabank.am/', {
        waitUntil: 'load',
        timeout: 90000,
    });

    await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
    }).catch(() => {
    });

    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible({ timeout: 10000 });
    await expect(h1).toContainText('Մուտք');

    const emailInput = page.locator('input[data-id="login-email-input"]');
    await expect(emailInput).toBeVisible();
    await emailInput.fill('trfsucity@mailinator.com');

    const passwordInput = page.locator('input[data-id="login-password-input"]');
    await expect(passwordInput).toBeVisible();
    await passwordInput.fill('Arpine.123');

    const loginButton = page.locator('button[data-id="login-button"]');
    await expect(loginButton).toBeVisible();
    await loginButton.click();

    const dashboardUrl = 'https://sme-ecosystem-pos-analytics.test.ameriabank.am/dashboard/applications-list';
    const otpUrl = 'https://sme-ecosystem-pos-analytics.test.ameriabank.am/otp-verification-required';
    await page.waitForURL(
        url => url.toString().startsWith(dashboardUrl) || url.toString().startsWith(otpUrl),
        { timeout: 100000 }
    );
    if (page.url().startsWith(otpUrl)) {
        const otpInputs = page.locator('input:not([readonly])');
        await expect(otpInputs.first()).toBeEditable({ timeout: 10000 });

        const otpCode = ['1', '2', '3', '4', '5', '6'];
        const count = await otpInputs.count();
        for (let i = 0; i < Math.min(count, otpCode.length); i++) {
            await otpInputs.nth(i).fill(otpCode[i]);
        }

        const otpSubmit = page.locator('button[data-id="enter-verification-code-continue-button"]');
        await expect(otpSubmit).toBeVisible();
        await otpSubmit.click();

        await expect(page).toHaveURL(dashboardUrl);
    } else {
        await expect(page).toHaveURL(dashboardUrl);
    }
} async function goToTransactions(page) {
    const applicationsHistoryHeader = page.locator('.application-list__top p').first();
    await expect(applicationsHistoryHeader).toBeVisible();
    await expect(applicationsHistoryHeader).toContainText('Հայտերի պատմություն');
    const transactionsNavLink = page.locator(
        '.navigation-block .navigation-block__inner:nth-child(2) .navigation-item:nth-child(2) .navigation-item__inner a p'
    );
    await expect(transactionsNavLink).toBeVisible();
    await expect(transactionsNavLink).toContainText('Գործարքներ');
    const transactionsNavAnchor = page.locator(
        '.navigation-block .navigation-block__inner:nth-child(2) .navigation-item:nth-child(2) .navigation-item__inner a'
    );
    await transactionsNavAnchor.click();

    const transactionPageTitle = page.locator('.header__inner p');
    await expect(transactionPageTitle).toBeVisible();
    await expect(transactionPageTitle).toContainText('Գործարքներ');
}

test.describe('Filters', () => {
    test.setTimeout(120000);
    test.beforeEach(async ({ page }) => {
        await page.context().clearCookies();
        await login(page);
        const dashboardHeader = page.locator('.application-list__top p').first();
        await expect(dashboardHeader).toBeVisible({ timeout: 15000 });
        await expect(dashboardHeader).toContainText('Հայտերի պատմություն');
        await goToTransactions(page);
        await resetFilters(page);
    });

    test('Test environment login and navigation', async ({ page }) => {
        const transactionPageTitle = page.locator('.header__inner p');
        await expect(transactionPageTitle).toBeVisible();
        await expect(transactionPageTitle).toContainText('Գործարքներ');
    });

    test('Creation date filter with date range', async ({ page }) => {
        await creationDateFilterRange(page);
        const filterPopup = page.locator('.filter-popup.show');
        await expect(filterPopup).toBeHidden({ timeout: 5000 });
        const tableBody = page.locator('.transactions-wrapper__listing table tbody');
        await expect(tableBody).toBeVisible({ timeout: 10000 });
        const tableCreationDateTD = page.locator('.transactions-wrapper__listing table tbody tr:first-child td:nth-child(3) p');
        await expect(tableCreationDateTD).toBeVisible({ timeout: 10000 });
        const txDateText = (await tableCreationDateTD.textContent()).trim();
        const startDateText = testData.creationDateFilters.standardRange.startDate;
        const endDateText = testData.creationDateFilters.standardRange.endDate;
        const parse = (value) => {
            const [dd, mm, yyyy] = value.split('-').map(Number);
            return new Date(yyyy, mm - 1, dd);
        };
        const txDate = parse(txDateText);
        const startDate = parse(startDateText);
        const endDate = parse(endDateText);
        expect(txDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(txDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
        await console.log('Date range case passed');
    });

    test('Creation date filter with exact date', async ({ page }) => {
        const creationDateFilter = page.locator('.filter-chip[data-filter-id="creationDate"]');
        await expect(creationDateFilter).toBeVisible({ timeout: 4000 });
        await creationDateFilter.click();
        const filterPopup = page.locator('.filter-popup.show');
        await expect(filterPopup).toBeVisible();
        const switcher = filterPopup.locator('.filter-popup__container .switcher').first();
        await expect(switcher).toBeVisible({ timeout: 10000 });
        await switcher.click();
        const transactionEndDateInput = page.locator('input[name="trasnactionEndDate"]');
        await expect(transactionEndDateInput).toBeHidden();
        const transactionStartDateInput = page.locator('input[name="transactionStartDate"]');
        await expect(transactionStartDateInput).toBeVisible();
        const dateConfig = testData.creationDateFilters.exactDate;
        await transactionStartDateInput.fill(dateConfig.startDate);
        await transactionStartDateInput.press('Enter');
        const filterPopupAfter = page.locator('.filter-popup.show');
        await expect(filterPopupAfter).toBeHidden({ timeout: 5000 });
        const tableBody = page.locator('.transactions-wrapper__listing table tbody');
        await expect(tableBody).toBeVisible({ timeout: 10000 });
        const tableCreationDateTD = page.locator('.transactions-wrapper__listing table tbody tr:first-child td:nth-child(3) p');
        await expect(tableCreationDateTD).toBeVisible();
        const txDateText = (await tableCreationDateTD.textContent()).trim();
        const startDateText = await transactionStartDateInput.inputValue();
        const parse = (value) => {
            const [dd, mm, yyyy] = value.split('-').map(Number);
            return new Date(yyyy, mm - 1, dd);
        };
        const txDate = parse(txDateText);
        const startDate = parse(startDateText);
        expect(txDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        await console.log('Exact date case passed');
    });

    test('Settlement date filter with exact date', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        const sideSheet = await openDetailsSideSheet(page);
        const settlementDateValue = await getSideSheetValue(sideSheet, 1, 3);
        console.log('Settlement date from first transaction details:', settlementDateValue);
        await sideSheet.locator('[data-id="dismiss-svg-icon"]').click();
        await expect(sideSheet).toBeHidden({ timeout: 15000 });
        console.log('Closed side sheet');
        const addFilterChip = page.locator('.filter-chip:not([data-filter-id])');
        await expect(addFilterChip).toBeVisible({ timeout: 10000 });
        await addFilterChip.click();
        const addFilterPopup = page.locator('.add-filter');
        await expect(addFilterPopup).toBeVisible();
        const settlementDateFilter = await getFilterByLabel(page, 'Հաշվանցման ամսաթիվ');
        await expect(settlementDateFilter).toBeVisible();
        await settlementDateFilter.click();
        const dateOnly = settlementDateValue.split(' ')[0];
        const filterPopup = page.locator('.filter-popup:visible, .filter-popup.show').first();
        await expect(filterPopup).toBeVisible({ timeout: 10000 });

        const settlementStartDate = filterPopup.locator('input[name*="tartDate"]').first();
        const settlementEndDate = filterPopup.locator('input[name*="ndDate"]').first();

        const switcher = filterPopup.locator('.switcher').first();
        if (await switcher.isVisible() && await settlementStartDate.isHidden()) {
            await switcher.click();
            await page.waitForTimeout(1000);
        }

        await expect(settlementStartDate).toBeVisible({ timeout: 15000 });
        await settlementStartDate.fill(dateOnly);

        if (await settlementEndDate.isVisible()) {
            await settlementEndDate.fill(dateOnly);
        }

        const submitButton = filterPopup.locator('button[type="submit"], .filter-popup__footer button').first();
        await expect(submitButton).toBeVisible({ timeout: 10000 });
        await submitButton.click();

        console.log('Applied Settlement date filter');
        const tableBody = page.locator('.transactions-wrapper__listing table tbody');
        await expect(tableBody).toBeVisible({ timeout: 15000 });
        await expect(tableBody.locator('.react-loading-skeleton').first()).toBeHidden({ timeout: 30000 });
        const filteredSideSheet = await openDetailsSideSheet(page);
        const settlementDateActualValue = await getSideSheetValue(filteredSideSheet, 1, 3);
        console.log('Settlement date shown in details after filter:', settlementDateActualValue);
        expect(settlementDateActualValue).toBe(settlementDateValue);
        await filteredSideSheet.locator('[data-id="dismiss-svg-icon"]').click();
        await expect(filteredSideSheet).toBeHidden({ timeout: 10000 });
    })

    test('Settlement date filter with date range', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        const sideSheet = await openDetailsSideSheet(page);
        const settlementDateValue = await getSideSheetValue(sideSheet, 1, 3);
        console.log('Settlement date from first transaction details:', settlementDateValue);
        await sideSheet.locator('[data-id="dismiss-svg-icon"]').click();
        await expect(sideSheet).toBeHidden({ timeout: 15000 });
        console.log('Closed side sheet');
        const addFilterChip = page.locator('.filter-chip:not([data-filter-id])');
        await expect(addFilterChip).toBeVisible({ timeout: 10000 });
        await addFilterChip.click();
        const addFilterPopup = page.locator('.add-filter');
        await expect(addFilterPopup).toBeVisible({ timeout: 5000 });
        const settlementDateFilter = await getFilterByLabel(page, 'Հաշվանցման ամսաթիվ');
        await expect(settlementDateFilter).toBeVisible();
        await settlementDateFilter.click();
        const dateOnly = settlementDateValue.split(' ')[0];
        const filterPopup = page.locator('.filter-popup:visible, .filter-popup.show').first();
        await expect(filterPopup).toBeVisible({ timeout: 10000 });

        const settlementStartDate = filterPopup.locator('input[name*="tartDate"]').first();
        const settlementEndDate = filterPopup.locator('input[name*="ndDate"]').first();

        const switcher = filterPopup.locator('.switcher').first();
        await switcher.click();
        await page.waitForTimeout(1000);

        await expect(settlementStartDate).toBeVisible({ timeout: 15000 });
        await settlementStartDate.fill(dateOnly);

        if (await settlementEndDate.isVisible()) {
            await settlementEndDate.fill(dateOnly);
        }

        const submitButton = filterPopup.locator('button[type="submit"], .filter-popup__footer button').first();
        await expect(submitButton).toBeVisible({ timeout: 10000 });
        await submitButton.click();

        console.log('Applied Settlement date filter');
        const tableBody = page.locator('.transactions-wrapper__listing table tbody');
        await expect(tableBody).toBeVisible({ timeout: 15000 });
        await expect(tableBody.locator('.react-loading-skeleton').first()).toBeHidden({ timeout: 30000 });
        const filteredSideSheet = await openDetailsSideSheet(page);
        const settlementDateActualValue = await getSideSheetValue(filteredSideSheet, 1, 3);
        console.log('Settlement date shown in details after filter:', settlementDateActualValue);
        expect(settlementDateActualValue).toBe(settlementDateValue);
        await filteredSideSheet.locator('[data-id="dismiss-svg-icon"]').click();
        await expect(filteredSideSheet).toBeHidden({ timeout: 10000 });
    })

    test('Card number filter', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        const addFilterChip = page.locator('.filter-chip:not([data-filter-id])');
        await expect(addFilterChip).toBeVisible({ timeout: 10000 });
        await addFilterChip.click();
        const addFilterPopup = page.locator('.add-filter');
        await expect(addFilterPopup).toBeVisible({ timeout: 5000 });
        const cardNumberFilter = await getFilterByLabel(page, 'Քարտի համար');
        await expect(cardNumberFilter).toBeVisible();
        await cardNumberFilter.click();
        const cardNumber = page.locator('.filter-popup__container .input [name="cardNumber"]');
        await cardNumber.fill('0348');
        const cardNumberInput = page.locator('[name="cardNumber"]');
        console.log('Submitted card number:', await cardNumberInput.inputValue());
        const submitButton = page.locator('.filter-popup:visible .filter-popup__footer button[type="submit"]');
        await expect(submitButton).toBeEnabled();
        await submitButton.click();
        console.log('Card number filter applied');
        const tableCardNumberTD = page.locator('.transactions-wrapper__listing table tbody tr:first-child td:nth-child(4) p');
        await expect(tableCardNumberTD).toBeVisible();
        const cardTxDateText = (await tableCardNumberTD.textContent())?.trim();
        console.log('First row card number after card filter:', cardTxDateText);
    });

    test('Exact amount filter', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        const addFilterChip = page.locator('.filter-chip:not([data-filter-id])');
        await expect(addFilterChip).toBeVisible({ timeout: 10000 });
        await addFilterChip.click();
        const addFilterPopup = page.locator('.add-filter');
        await expect(addFilterPopup).toBeVisible();
        const exactAmountFilter = await getFilterByLabel(page, 'Գումար');
        await expect(exactAmountFilter).toBeVisible();
        await exactAmountFilter.click();
        const amount = page.locator('.filter-popup__container .input [name="amountStartRange"]');
        const amountInput = page.locator('[name="amountStartRange"]');
        await amount.fill('100');
        console.log('Submitted amount:', await amountInput.inputValue());
        const submitButton = page.locator('.filter-popup:visible .filter-popup__footer button[type="submit"]');
        await expect(submitButton).toBeEnabled();
        await submitButton.click();
        const tableAmountTD = page.locator('.transactions-wrapper__listing table tbody tr:first-child td:nth-child(5) p');
        await expect(tableAmountTD).toBeVisible();
        const amountTxDateText = (await tableAmountTD.textContent())?.trim();
        const amountValue = parseFloat(amountTxDateText);
        expect(amountValue).toBeGreaterThanOrEqual(100);
        console.log('Amount shown in table:', amountTxDateText);
    });

    test('Amount range filter', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        const addFilterChip = page.locator('.filter-chip:not([data-filter-id])');
        await expect(addFilterChip).toBeVisible({ timeout: 10000 });
        await addFilterChip.click();
        const addFilterPopup = page.locator('.add-filter');
        await expect(addFilterPopup).toBeVisible();
        const amountRangeFilter = await getFilterByLabel(page, 'Գումար');
        await expect(amountRangeFilter).toBeVisible();
        await amountRangeFilter.click();
        const filterPopupVisible = page.locator('.filter-popup:visible');
        const amountSwitcher = filterPopupVisible.locator('.filter-popup__container .switcher').first();
        await expect(amountSwitcher).toBeVisible({ timeout: 10000 });
        await amountSwitcher.click();
        const amountStart = page.locator('.filter-popup__container .input [name="amountStartRange"]');
        const amountEnd = page.locator('.filter-popup__container .input [name="amountEndRange"]');
        const amountStartInput = page.locator('[name="amountStartRange"]');
        const amountEndInput = page.locator('[name="amountEndRange"]');
        await amountStart.fill('50');
        await amountEnd.fill('150');
        console.log('Submitted amount range:', await amountStartInput.inputValue(), '-', await amountEndInput.inputValue());
        const submitButton = page.locator('.filter-popup:visible .filter-popup__footer button[type="submit"]');
        await expect(submitButton).toBeEnabled();
        await submitButton.click();
        const tableAmountTD = page.locator('.transactions-wrapper__listing table tbody tr:first-child td:nth-child(5) p');
        await expect(tableAmountTD).toBeVisible();
        const amountTxDateText = (await tableAmountTD.textContent())?.trim();
        const amountValue = parseFloat(amountTxDateText);
        expect(amountValue).toBeGreaterThanOrEqual(50);
        expect(amountValue).toBeLessThanOrEqual(150);
        console.log('Amount shown in table:', amountTxDateText);
    });

    test('Authorization Code UniqueID', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        const addFilterChip = page.locator('.filter-chip:not([data-filter-id])');
        await expect(addFilterChip).toBeVisible({ timeout: 10000 });
        await addFilterChip.click();
        const addFilterPopup = page.locator('.add-filter');
        await expect(addFilterPopup).toBeVisible();
        const uniqueIDFilter = await getFilterByLabel(page, 'Ունիկալ ID');
        await expect(uniqueIDFilter).toBeVisible();
        await uniqueIDFilter.click();
        const uniqueIdDropdown = page.locator('.unique-id-filter__col .select__input');
        await uniqueIdDropdown.click();
        const authCodeOption = page.locator('.select__options .select__option').filter({ hasText: 'Authorization Code' });
        await expect(authCodeOption).toBeVisible();
        await authCodeOption.click();
        const uniqueIDInput = page.locator('input[name="uniqueIdValue"]');
        await uniqueIDInput.fill('937065');
        const submitButton = page.locator('.filter-popup:visible .filter-popup__footer button[type="submit"]');
        await expect(submitButton).toBeEnabled();
        await submitButton.click();
        console.log('Submitted Authorization Code value:', await uniqueIDInput.inputValue());
        const sideSheet = await openDetailsSideSheet(page);
        const authCodeValue = await getSideSheetValue(sideSheet, 'DETAILS_CARD', 'AUTHORIZATION_CODE');
        console.log('Authorization Code shown in details:', authCodeValue);
        expect(authCodeValue).toBe('937065');
    });

    test('RRN 1 UniqueID', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        const addFilterChip = page.locator('.filter-chip:not([data-filter-id])');
        await expect(addFilterChip).toBeVisible({ timeout: 10000 });
        await addFilterChip.click();
        const addFilterPopup = page.locator('.add-filter');
        await expect(addFilterPopup).toBeVisible();
        const uniqueIDFilter = await getFilterByLabel(page, 'Ունիկալ ID');
        await expect(uniqueIDFilter).toBeVisible();
        await uniqueIDFilter.click();
        const uniqueIdDropdown = page.locator('.unique-id-filter__col .select__input');
        await uniqueIdDropdown.click();
        const rrn1Option = page.locator('.select__options .select__option').filter({ hasText: 'RRN 1' });
        await expect(rrn1Option).toBeVisible();
        await rrn1Option.click();
        const uniqueIDInput = page.locator('input[name="uniqueIdValue"]');
        await uniqueIDInput.fill('603219937057');
        const submitButton = page.locator('.filter-popup:visible .filter-popup__footer button[type="submit"]');
        await expect(submitButton).toBeEnabled();
        await submitButton.click();
        console.log('Submitted UniqueID value:', await uniqueIDInput.inputValue());
        const sideSheet = await openDetailsSideSheet(page, 0);
        const rrn1Value = await getSideSheetValue(sideSheet, 'DETAILS_CARD', 'RRN_1');
        console.log('RRN 1 shown in details:', rrn1Value);
        expect(rrn1Value).toBe('603219937057');
    });

    test('RRN 2 UniqueID', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        const addFilterChip = page.locator('.filter-chip:not([data-filter-id])');
        await expect(addFilterChip).toBeVisible({ timeout: 10000 });
        await addFilterChip.click();
        const addFilterPopup = page.locator('.add-filter');
        await expect(addFilterPopup).toBeVisible();
        const uniqueIDFilter = await getFilterByLabel(page, 'Ունիկալ ID');
        await expect(uniqueIDFilter).toBeVisible();
        await uniqueIDFilter.click();
        const uniqueIdDropdown = page.locator('.unique-id-filter__col .select__input');
        await uniqueIdDropdown.click();
        const rrn2Option = page.locator('.select__options .select__option').filter({ hasText: 'RRN 2' });
        await expect(rrn2Option).toBeVisible();
        await rrn2Option.click();
        const uniqueIDInput = page.locator('input[name="uniqueIdValue"]');
        await uniqueIDInput.fill('128685432785');
        const submitButton = page.locator('.filter-popup:visible .filter-popup__footer button[type="submit"]');
        await expect(submitButton).toBeEnabled();
        await submitButton.click();
        console.log('Submitted UniqueID value:', await uniqueIDInput.inputValue());
        const sideSheet = await openDetailsSideSheet(page);
        const rrn2Value = await getSideSheetValue(sideSheet, 'DETAILS_CARD', 'RRN_2');
        console.log('RRN 2 shown in details:', rrn2Value);
        expect(rrn2Value).toBe('128685432785');
    });

    test('RRN 3 UniqueID', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        const addFilterChip = page.locator('.filter-chip:not([data-filter-id])');
        await expect(addFilterChip).toBeVisible({ timeout: 10000 });
        await addFilterChip.click();
        const addFilterPopup = page.locator('.add-filter');
        await expect(addFilterPopup).toBeVisible();
        const uniqueIDFilter = await getFilterByLabel(page, 'Ունիկալ ID');
        await expect(uniqueIDFilter).toBeVisible();
        await uniqueIDFilter.click();
        const uniqueIdDropdown = page.locator('.unique-id-filter__col .select__input');
        await uniqueIdDropdown.click();
        const rrn3Option = page.locator('.select__options .select__option').filter({ hasText: 'RRN 3' });
        await expect(rrn3Option).toBeVisible();
        await rrn3Option.click();
        const uniqueIDInput = page.locator('input[name="uniqueIdValue"]');
        await uniqueIDInput.fill('8255937065');
        const submitButton = page.locator('.filter-popup:visible .filter-popup__footer button[type="submit"]');
        await expect(submitButton).toBeEnabled();
        await submitButton.click();
        console.log('Submitted RRN 3 value:', await uniqueIDInput.inputValue());
        const sideSheet = await openDetailsSideSheet(page);
        const rrn3Value = await getSideSheetValue(sideSheet, 'DETAILS_CARD', 'RRN_3');
        console.log('RRN 3 shown in details:', rrn3Value);
        expect(rrn3Value).toBe('8255937065');
    });

    test('Terminal ID filter', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        const sideSheet = await openDetailsSideSheet(page);
        const terminalIdValue = await getSideSheetValue(
            sideSheet,
            1,
            1
        );
        console.log('Terminal ID from first transaction details:', terminalIdValue);
        await sideSheet.locator('[data-id="dismiss-svg-icon"]').click();
        await expect(sideSheet).toBeHidden({ timeout: 15000 });
        console.log('Closed side sheet');
        const addFilterChip = page.locator('.filter-chip:not([data-filter-id])');
        await expect(addFilterChip).toBeVisible({ timeout: 10000 });
        await addFilterChip.click();
        const addFilterPopup = page.locator('.add-filter');
        await expect(addFilterPopup).toBeVisible();
        const terminalIDFilter = await getFilterByLabel(page, 'Տերմինալ ID');
        await expect(terminalIDFilter).toBeVisible();
        await terminalIDFilter.click();
        await filterDropdown(page, terminalIdValue);
        console.log('Applied Terminal ID filter using helper');
        const tableBody = page.locator('.transactions-wrapper__listing table tbody');
        await expect(tableBody).toBeVisible({ timeout: 15000 });
        await expect(tableBody.locator('.react-loading-skeleton').first()).toBeHidden({ timeout: 30000 });
        const filteredSideSheet = await openDetailsSideSheet(page);
        const terminalIdActualValue = await getSideSheetValue(filteredSideSheet, 1, 1);
        console.log('Terminal ID shown in details after filter:', terminalIdActualValue);
        expect(terminalIdActualValue).toBe(terminalIdValue);
        await filteredSideSheet.locator('[data-id="dismiss-svg-icon"]').click();
        await expect(filteredSideSheet).toBeHidden({ timeout: 10000 });
    });

    test('Serial number filter', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        const sideSheet = await openDetailsSideSheet(page);
        const serialNumberValue = await getSideSheetValue(
            sideSheet,
            4,
            1
        );
        console.log('Serial number from first transaction details:', serialNumberValue);
        await sideSheet.locator('[data-id="dismiss-svg-icon"]').click();
        await expect(sideSheet).toBeHidden({ timeout: 15000 });
        console.log('Closed side sheet');
        const addFilterChip = page.locator('.filter-chip:not([data-filter-id])');
        await expect(addFilterChip).toBeVisible({ timeout: 10000 });
        await addFilterChip.click();
        const addFilterPopup = page.locator('.add-filter');
        await expect(addFilterPopup).toBeVisible();
        const serialNumberFilter = await getFilterByLabel(page, 'Սերիական համար');
        await expect(serialNumberFilter).toBeVisible();
        await serialNumberFilter.click();
        await filterDropdown(page, serialNumberValue);
        console.log('Applied Serial number filter using helper');
        const tableBody = page.locator('.transactions-wrapper__listing table tbody');
        await expect(tableBody).toBeVisible({ timeout: 15000 });
        await expect(tableBody.locator('.react-loading-skeleton').first()).toBeHidden({ timeout: 30000 });
        const filteredSideSheet = await openDetailsSideSheet(page);
        const serialNumberActualValue = await getSideSheetValue(filteredSideSheet, 4, 1);
        console.log('Serial number shown in details after filter:', serialNumberActualValue);
        expect(serialNumberActualValue).toBe(serialNumberValue);
        await filteredSideSheet.locator('[data-id="dismiss-svg-icon"]').click();
        await expect(filteredSideSheet).toBeHidden({ timeout: 10000 });
    })

    test('Merchant name filter', async ({ page }) => {
        await creationDateFilterRange(page, 'standardRange');
        const sideSheet = await openDetailsSideSheet(page);
        const merchantNameValue = (await page.locator('.side-sheet__container .side-sheet__header .side-sheet__title').textContent()).trim();
        console.log('Merchant name from first transaction details:', merchantNameValue);
        await sideSheet.locator('[data-id="dismiss-svg-icon"]').click();
        await expect(sideSheet).toBeHidden({ timeout: 15000 });
        console.log('Closed side sheet');
        const addFilterChip = page.locator('.filter-chip:not([data-filter-id])');
        await expect(addFilterChip).toBeVisible({ timeout: 10000 });
        await addFilterChip.click();
        const addFilterPopup = page.locator('.add-filter');
        await expect(addFilterPopup).toBeVisible();
        const merchantNameFilter = await getFilterByLabel(page, 'ԱՍԿ անվանում');
        await expect(merchantNameFilter).toBeVisible();
        await merchantNameFilter.click();
        await filterDropdown(page, merchantNameValue);
        console.log('Applied Merchant name filter using helper');
        const tableBody = page.locator('.transactions-wrapper__listing table tbody');
        await expect(tableBody).toBeVisible({ timeout: 15000 });
        await expect(tableBody.locator('.react-loading-skeleton').first()).toBeHidden({ timeout: 30000 });
        const filteredSideSheet = await openDetailsSideSheet(page);
        const merchantNameActualValue = (await filteredSideSheet.locator('.side-sheet__title').textContent()).trim();
        console.log('Merchant name shown in details after filter:', merchantNameActualValue);
        expect(merchantNameActualValue).toBe(merchantNameValue);
        await filteredSideSheet.locator('[data-id="dismiss-svg-icon"]').click();
        await expect(filteredSideSheet).toBeHidden({ timeout: 10000 });
    })

});