import { expect } from '@playwright/test';

export const ROUTES = {
    root: '/',
    dashboard: '/dashboard/applications-list',
    transactions: '/dashboard/transactions-reports',
    reports: '/dashboard/transactions-reports-builder',
    otp: '/otp-verification-required',
};

const TEST_USER = {
    email: process.env.E2E_USER_EMAIL || 'trfsucity@mailinator.com',
    password: process.env.E2E_USER_PASSWORD || 'Arpine.123',
    otp: (process.env.E2E_OTP_CODE || '123456').split(''),
};

const EMAIL_SELECTOR = [
    'input[data-id="login-email-input"]',
    'input[type="email"]',
    'input[name*="email" i]',
    'input[placeholder*="Էլհասց"]',
    'input[placeholder*="email" i]',
].join(', ');

const PASSWORD_SELECTOR = [
    'input[data-id="login-password-input"]',
    'input[type="password"]',
    'input[name*="password" i]',
    'input[placeholder*="գաղտնաբառ"]',
    'input[placeholder*="password" i]',
].join(', ');

async function getFirstVisible(page, selector) {
    const candidates = page.locator(selector);
    const count = await candidates.count();
    for (let i = 0; i < count; i++) {
        const element = candidates.nth(i);
        if (await element.isVisible().catch(() => false)) {
            return element;
        }
    }
    return null;
}

async function waitForLoginForm(page, timeout = 20_000) {
    await expect
        .poll(
            async () => {
                const email = await getFirstVisible(page, EMAIL_SELECTOR);
                const password = await getFirstVisible(page, PASSWORD_SELECTOR);
                return Boolean(email && password);
            },
            { timeout, message: 'Login form (email + password) did not become visible' }
        )
        .toBe(true);
}

/**
 * Performs a full UI login. Idempotent: short-circuits if already on the dashboard.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function login(page) {
    await page.addInitScript(() => {
        window.process = window.process || { env: {} };
    });

    await page.goto(ROUTES.root, { waitUntil: 'domcontentloaded' });

    if (page.url().includes('/dashboard/')) {
        return;
    }

    await waitForLoginForm(page).catch(async () => {
        await page.goto(
            'https://sme-ecosystem-auth-onboarding.test.ameriabank.am/auth/login',
            { waitUntil: 'domcontentloaded' }
        );
        await waitForLoginForm(page);
    });

    const email = await getFirstVisible(page, EMAIL_SELECTOR);
    if (!email) throw new Error('Email input not visible after waiting for login form.');
    await email.fill(TEST_USER.email);

    const password = await getFirstVisible(page, PASSWORD_SELECTOR);
    if (!password) throw new Error('Password input not visible after waiting for login form.');
    await password.fill(TEST_USER.password);

    const submit = page
        .getByRole('button', { name: /(մուտք գործել|մուտք|sign in|login)/i })
        .or(page.getByTestId('login-button'))
        .first();
    await expect(submit).toBeVisible();
    await submit.click();

    await page.waitForURL(
        url => {
            const u = url.toString();
            return u.includes(ROUTES.dashboard) || u.includes(ROUTES.otp);
        },
        { timeout: 60_000 }
    );

    if (page.url().includes(ROUTES.otp)) {
        const otpInputs = page.locator('input:not([readonly])');
        await expect(otpInputs.first()).toBeEditable();
        const count = await otpInputs.count();
        for (let i = 0; i < Math.min(count, TEST_USER.otp.length); i++) {
            await otpInputs.nth(i).fill(TEST_USER.otp[i]);
        }
        await page.getByTestId('enter-verification-code-continue-button').click();
    }

    await expect(page).toHaveURL(new RegExp(`${ROUTES.dashboard}$`));
}
