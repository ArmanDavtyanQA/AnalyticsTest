const { test, expect } = require('@playwright/test');

test.describe('Login Page', () => {
    test('should open localhost:3000 and perform login', async ({ page }) => {
        await page.goto('http://localhost:3000');



        const h1 = page.locator('h1').first();
        await expect(h1).toBeVisible();
        await expect(h1).toContainText('Մուտք');

        const emailInput = page.locator('input[data-id="login-email-input"]');
        await expect(emailInput).toBeVisible();
        await emailInput.fill('trfsucity@mailinator.com');

        const passwordInput = page.locator('input[data-id=\"login-password-input\"]');
        await expect(passwordInput).toBeVisible();
        await passwordInput.fill('Arpine.123');

        const loginButton = page.locator('button[data-id=\"login-button\"]');
        await expect(loginButton).toBeVisible();
        await loginButton.click();

        const dashboardUrl = 'http://localhost:3000/dashboard/applications-list';
        const otpUrl = 'http://localhost:3000/otp-verification-required';

        // Wait for either dashboard or OTP verification
        await page.waitForURL(
            url => url.toString().startsWith(dashboardUrl) || url.toString().startsWith(otpUrl),
            { timeout: 10000 }
        );

        // If OTP verification is required, fill the six inputs and submit
        if (page.url().startsWith(otpUrl)) {
            const otpInputs = page.locator('input');
            await expect(otpInputs.first()).toBeVisible();

            const otpCode = ['1', '2', '3', '4', '5', '6'];
            const count = await otpInputs.count();
            for (let i = 0; i < Math.min(count, otpCode.length); i++) {
                await otpInputs.nth(i).fill(otpCode[i]);
            }

            const otpSubmit = page.locator('button[data-id=\"enter-verification-code-continue-button\"]');
            await expect(otpSubmit).toBeVisible();
            await otpSubmit.click();

            await expect(page).toHaveURL(dashboardUrl);
        } else {
            // Otherwise should already be on dashboard
            await expect(page).toHaveURL(dashboardUrl);
        }
    });
});

