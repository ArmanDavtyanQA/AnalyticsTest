const { test, expect } = require('@playwright/test');
import { creationDateFilterRange, terminalIdFinder, openDetailsSideSheet, getSideSheetValue } from '../helpers';
import testData from '../testData.json' assert { type: 'json' };  


// Helper: logs into the test environment and ensures we land on the dashboard
async function login(page) {
    // Shim process.env in browser context to avoid app code errors that block load
    await page.addInitScript(() => {
        window.process = window.process || { env: {} };
    });

    await page.goto('https://sme-ecosystem-pos-analytics.test.ameriabank.am/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
    });

    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible({timeout:10000});
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

    // Wait for either dashboard or OTP verification
    await page.waitForURL(
        url => url.toString().startsWith(dashboardUrl) || url.toString().startsWith(otpUrl),
        { timeout: 100000 }
    );

    // If OTP verification is required, fill the six inputs and submit
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
        // Otherwise should already be on dashboard
        await expect(page).toHaveURL(dashboardUrl);
    }
}

// Helper: navigates to the Transactions page after login
async function goToTransactions(page) {
    await login(page);

    // Verify Applications History page header is present
    const applicationsHistoryHeader = page.locator('.application-list__top p').first();
    await expect(applicationsHistoryHeader).toBeVisible();
    await expect(applicationsHistoryHeader).toContainText('Հայտերի պատմություն');

    // Verify Transactions navigation item exists and is active
    const transactionsNavLink = page.locator(
        '.navigation-block .navigation-block__inner:nth-child(2) .navigation-item:nth-child(2) .navigation-item__inner a p'
    );
    await expect(transactionsNavLink).toBeVisible();
    await expect(transactionsNavLink).toContainText('Գործարքներ');

    // Navigate to Transactions by clicking the nav item
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

    test('Test environment login and navigation', async ({ page }) => {
        await goToTransactions(page);
    });

    test('Creation date filter with date range', async ({ page }) => {
        await goToTransactions(page);

        // Find and click the creationDate filter item
        const creationDateFilter = page.locator('.filter-chip[data-filter-id="creationDate"]');
        await expect(creationDateFilter).toBeVisible({timeout: 4000});
        await creationDateFilter.click();

        const filterPopup = page.locator('.filter-popup.show');
        await expect(filterPopup).toBeVisible();

        // Select and fill the transaction start date and end date
        const transactionStartDateInput = page.locator('input[name="transactionStartDate"]');
        const transactionEndDateInput = page.locator('input[name="trasnactionEndDate"]');
        await expect(transactionStartDateInput).toBeVisible();
        const dateConfig = testData.creationDateFilters.standardRange;
        await transactionStartDateInput.fill(dateConfig.startDate);
        await expect(transactionEndDateInput).toBeVisible();
        await transactionEndDateInput.fill(dateConfig.endDate);
        await transactionStartDateInput.press('Enter');

        // Validate first row creation date falls within selected range
        const tableCreationDateTD = page.locator('.transactions-wrapper__listing table tbody tr:first-child td:nth-child(3) p');
        await expect(tableCreationDateTD).toBeVisible();
        const txDateText = (await tableCreationDateTD.textContent()).trim();
        const startDateText = await transactionStartDateInput.inputValue();
        const endDateText = await transactionEndDateInput.inputValue();
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
        await goToTransactions(page);

        const creationDateFilter = page.locator('.filter-chip[data-filter-id="creationDate"]');
        await expect(creationDateFilter).toBeVisible({timeout: 4000});
        await creationDateFilter.click();
        const filterPopup = page.locator('.filter-popup.show');
        await expect(filterPopup).toBeVisible();

        // Await container alignment block to be visible
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

    test('Card number filter', async ({ page }) => {
        await goToTransactions(page);
        await creationDateFilterRange(page, 'standardRange');

        const addFilterChip = page.locator('.filter-chip:not([data-filter-id])');
        await expect(addFilterChip).toBeVisible({ timeout: 10000 });
        await creationDateFilterRange(page, 'standardRange');
        await addFilterChip.click();

        const addFilterPopup = page.locator('.add-filter');
        await expect(addFilterPopup).toBeVisible();
        const cardNumberFilter = page.locator('.add-filter-list .add-filter-list__item').nth(0);
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

    test('Exact amount filter', async({page}) =>{
        await goToTransactions(page);
        await creationDateFilterRange(page, 'standardRange');
        const addFilterChip = page.locator('.filter-chip:not([data-filter-id])');
        await expect(addFilterChip).toBeVisible({timeout: 10000});
        await addFilterChip.click();

        const addFilterPopup = page.locator('.add-filter');
        await expect(addFilterPopup).toBeVisible();

        const exactAmountFilter = page.locator('.add-filter-list .add-filter-list__item').nth(1);
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

    test('Amount range filter', async({page}) =>{
        await goToTransactions(page);
        await creationDateFilterRange(page, 'standardRange');
        const addFilterChip = page.locator('.filter-chip:not([data-filter-id])');
        await expect(addFilterChip).toBeVisible({timeout: 10000});
        await addFilterChip.click();

        const addFilterPopup = page.locator('.add-filter');
        await expect(addFilterPopup).toBeVisible();

        const amountRangeFilter = page.locator('.add-filter-list .add-filter-list__item').nth(1);
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

    test('Authorization Code UniqueID', async({page}) =>{
            await goToTransactions(page);
            await creationDateFilterRange(page, 'standardRange');
            const addFilterChip = page.locator('.filter-chip:not([data-filter-id])');
            await expect(addFilterChip).toBeVisible({timeout: 10000});
            await addFilterChip.click();
    
            const addFilterPopup = page.locator('.add-filter');
            await expect(addFilterPopup).toBeVisible();
    
            const uniqueIDFilter = page.locator('.add-filter-list .add-filter-list__item').nth(2);
            await uniqueIDFilter.click();
    
            const uniqueIdDropdown = page.locator('.unique-id-filter__col .select__input');
            await uniqueIdDropdown.click();
            const firstOption = page.locator('.select__options .select__option').first();
            await firstOption.click();
            const uniqueIDInput = page.locator('input[name="uniqueIdValue"]'); 
            await uniqueIDInput.fill('538885');
            const submitButton = page.locator('.filter-popup:visible .filter-popup__footer button[type="submit"]');
            await expect(submitButton).toBeEnabled();
            await submitButton.click();
            
            
            console.log('Submitted Authorization Code value:', await uniqueIDInput.inputValue());

            const sideSheet = await openDetailsSideSheet(page);
            const DETAILS_SECTION = testData.sideSheet.sections.DETAILS_CARD;
            const AUTH_CODE_ITEM = testData.sideSheet.items.AUTHORIZATION_CODE;
            
            const authCodeValue = await getSideSheetValue(sideSheet, DETAILS_SECTION, AUTH_CODE_ITEM);
            console.log('Authorization Code shown in details:', authCodeValue);
            expect(authCodeValue).toBe('538885');
            
    });

    test('RRN 1 UniqueID', async({page}) =>{
            await goToTransactions(page);
            await creationDateFilterRange(page, 'standardRange');
            const addFilterChip = page.locator('.filter-chip:not([data-filter-id])');
            await expect(addFilterChip).toBeVisible({timeout: 10000});
            await addFilterChip.click();
    
            const addFilterPopup = page.locator('.add-filter');
            await expect(addFilterPopup).toBeVisible();
    
            const uniqueIDFilter = page.locator('.add-filter-list .add-filter-list__item').nth(2);
            await uniqueIDFilter.click();
    
            const uniqueIdDropdown = page.locator('.unique-id-filter__col .select__input');
            await uniqueIdDropdown.click();
            const secondOption = page.locator('.select__options .select__option').nth(1);
            await secondOption.click();
            const uniqueIDInput = page.locator('input[name="uniqueIdValue"]'); 
            await uniqueIDInput.fill('008035538885');
            const submitButton = page.locator('.filter-popup:visible .filter-popup__footer button[type="submit"]');
            await expect(submitButton).toBeEnabled();
            await submitButton.click();            
            console.log('Submitted UniqueID value:', await uniqueIDInput.inputValue());

            const sideSheet = await openDetailsSideSheet(page, 0);
            const DETAILS_SECTION = testData.sideSheet.sections.DETAILS_CARD;
            const RRN_1_ITEM = testData.sideSheet.items.RRN_1;
            
            const rrn1Value = await getSideSheetValue(sideSheet, DETAILS_SECTION, RRN_1_ITEM);
            console.log('RRN 1 shown in details:', rrn1Value);
            
            expect(rrn1Value).toBe('008035538885');
    });

    test('RRN 2 UniqueID', async({page}) =>{
            await goToTransactions(page);
            await creationDateFilterRange(page, 'standardRange');
            const addFilterChip = page.locator('.filter-chip:not([data-filter-id])');
            await expect(addFilterChip).toBeVisible({timeout: 10000});
            await addFilterChip.click();
    
            const addFilterPopup = page.locator('.add-filter');
            await expect(addFilterPopup).toBeVisible();
    
            const uniqueIDFilter = page.locator('.add-filter-list .add-filter-list__item').nth(2);
            await uniqueIDFilter.click();
    
            const uniqueIdDropdown = page.locator('.unique-id-filter__col .select__input');
            await uniqueIdDropdown.click();
            const thirdOption = page.locator('.select__options .select__option').nth(2);
            await thirdOption.click();
            const uniqueIDInput = page.locator('input[name="uniqueIdValue"]'); 
            await uniqueIDInput.fill('127532730688');
            const submitButton = page.locator('.filter-popup:visible .filter-popup__footer button[type="submit"]');
            await expect(submitButton).toBeEnabled();
            await submitButton.click();
            console.log('Submitted UniqueID value:', await uniqueIDInput.inputValue());

            const sideSheet = await openDetailsSideSheet(page, 0);
            const DETAILS_SECTION = testData.sideSheet.sections.DETAILS_CARD;
            const RRN_2_ITEM = testData.sideSheet.items.RRN_2;
            
            const rrn2Value = await getSideSheetValue(sideSheet, DETAILS_SECTION, RRN_2_ITEM);
            console.log('RRN 2 shown in details:', rrn2Value);

            expect(rrn2Value).toBe('127532730688');
    });

    test('RRN 3 UniqueID', async({page}) =>{
            await goToTransactions(page);
            await creationDateFilterRange(page, 'standardRange');
            const addFilterChip = page.locator('.filter-chip:not([data-filter-id])');
            await expect(addFilterChip).toBeVisible({timeout: 10000});
            await addFilterChip.click();
    
            const addFilterPopup = page.locator('.add-filter');
            await expect(addFilterPopup).toBeVisible();
    
            const uniqueIDFilter = page.locator('.add-filter-list .add-filter-list__item').nth(2);
            await uniqueIDFilter.click();
    
            const uniqueIdDropdown = page.locator('.unique-id-filter__col .select__input');
            await uniqueIdDropdown.click();
            const fourthOption = page.locator('.select__options .select__option').nth(3);
            await fourthOption.click();
            const uniqueIDInput = page.locator('input[name="uniqueIdValue"]'); 
            await uniqueIDInput.fill('8035538885');
            const submitButton = page.locator('.filter-popup:visible .filter-popup__footer button[type="submit"]');
            await expect(submitButton).toBeEnabled();
            await submitButton.click();
            
            console.log('Submitted RRN 3 value:', await uniqueIDInput.inputValue());
            const sideSheet = await openDetailsSideSheet(page, 0);

            const DETAILS_SECTION = testData.sideSheet.sections.DETAILS_CARD;
            const RRN_3_ITEM = testData.sideSheet.items.RRN_3;
            
            const rrn3Value = await getSideSheetValue(sideSheet, DETAILS_SECTION, RRN_3_ITEM);
            console.log('RRN 3 shown in details:', rrn3Value);

            expect(rrn3Value).toBe('8035538885');
    });

    test ('Terminal ID filter', async({page}) =>{
            await goToTransactions(page);
            await creationDateFilterRange(page, 'standardRange');

            const sideSheet = await openDetailsSideSheet(page);
            const DETAILS_SECTION = testData.sideSheet.sections.DETAILS_CARD;
            const TERMINAL_ID_ITEM = testData.sideSheet.items.TERMINAL_ID;


            const addFilterChip = page.locator('.filter-chip:not([data-filter-id])');
            await expect(addFilterChip).toBeVisible({timeout: 10000});
            await addFilterChip.click();
    
            const addFilterPopup = page.locator('.add-filter');
            await expect(addFilterPopup).toBeVisible();
                
            const terminalIDFilter = page.locator('.add-filter-list .add-filter-list__item').nth(3);
            await terminalIDFilter.click();

            for(let i = 0; i < 5; i++){
                let terminalItem = page.locator(await terminalIdFinder(i + 1)); 
                await terminalItem.click();
            }
            const submitButton = page.locator('.filter-popup:visible .filter-popup__footer button[type="submit"]');
            await expect(submitButton).toBeEnabled();
            await submitButton.click();

            const tableTerminalIDTD = page.locator('.transactions-wrapper__listing table tbody tr:first-child td:nth-child(6) p');
            await expect(tableTerminalIDTD).toBeVisible();
            const terminalTxDateText = (await tableTerminalIDTD.textContent())?.trim();
            console.log('Terminal ID shown in table:', terminalTxDateText);

        
    });
});
