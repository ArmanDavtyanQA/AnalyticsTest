import { test, expect } from '@playwright/test';
import { creationDateFilterRange, openDetailsSideSheet, getSideSheetValue, resetFilters, selectFilterByLabel, parseDate } from '../../helpers';
import { filterDropdown } from '../../utils/filters/filterDropdown';
import { Sidebar } from '../../pages/components/sidebar.component';
import { waitForGridToLoad } from '../../helpers/grid.helper';
import testData from '../../testData.json' assert { type: 'json' };

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

    const sidebar = new Sidebar(page);
    await sidebar.navigate('Հաշվետվություններ');
    await waitForGridToLoad(page);

    const transactionPageTitle = page.locator('.header__inner p');
    await expect(transactionPageTitle).toBeVisible();
    await expect(transactionPageTitle).toContainText('Հաշվետվություններ');
}

test.describe('Reports', () => {
    test.setTimeout(120000);
    test.beforeEach(async ({ page }) => {
        await page.context().clearCookies();
        await login(page);
        const dashboardHeader = page.locator('.application-list__top p').first();
        await expect(dashboardHeader).toBeVisible({ timeout: 15000 });
        await expect(dashboardHeader).toContainText('Հայտերի պատմություն');
        await resetFilters(page);
    });

    test('Test environment login and navigation', async ({ page }) => {
        await goToTransactions(page);
        const transactionPageTitle = page.locator('.header__inner p');
        await expect(transactionPageTitle).toBeVisible();
        await expect(transactionPageTitle).toContainText('Հաշվետվություններ');
        console.log("Navigated to Reports page");
    });

    test('Create Daily report', async ({ page }) => {

    })
})
