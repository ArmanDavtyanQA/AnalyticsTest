import { expect } from '@playwright/test';

export const ROUTES = {
    root: '/',
    dashboard: '/dashboard/applications-list',
    transactions: '/dashboard/transactions-reports',
    reports: '/dashboard/transactions-reports-builder',
    reportsArchive: '/dashboard/transactions-reports-builder-archive',
    analytics: '/dashboard/transactions-analytics',
    otp: '/otp-verification-required',
};

export const TEST_USER = {
    email: process.env.E2E_USER_EMAIL || 'trfsucity@mailinator.com',
    password: process.env.E2E_USER_PASSWORD || 'Arpine.123',
    otp: (process.env.E2E_OTP_CODE || '123456').split(''),
};

/**
 * Fills the in-app "Enter the code" modal (`.enter-verificationCode` / `.otp`)
 * or the login OTP page. Uses {@link TEST_USER.otp} (`E2E_OTP_CODE`, default `123456`).
 *
 * @returns {Promise<boolean>} true when inputs were found and filled
 */
export async function fillOtp(page, { timeout = 15_000 } = {}) {
    const codeModal = page.locator('.modal__container').filter({
        has: page.locator('.enter-verificationCode, .otp, [data-id="enter-verification-code-phone"]'),
    }).first();
    const modalVisible = await codeModal
        .waitFor({ state: 'visible', timeout })
        .then(() => true)
        .catch(() => false);

    let otpInputs;
    if (modalVisible) {
        otpInputs = codeModal.locator('.otp input[type="text"], .VerificationCode input[type="text"]');
    } else if (page.url().includes(ROUTES.otp)) {
        otpInputs = page.locator('input:not([readonly])');
    } else {
        return false;
    }

    await expect(otpInputs.first()).toBeVisible({ timeout: 10_000 });
    await expect(otpInputs.first()).toBeEditable({ timeout: 5_000 });

    const digits = TEST_USER.otp;
    const count = await otpInputs.count();
    for (let i = 0; i < Math.min(count, digits.length); i++) {
        await otpInputs.nth(i).click();
        await otpInputs.nth(i).fill(digits[i]);
    }

    const continueButton = (modalVisible ? codeModal : page)
        .locator('[data-id="enter-verification-code-continue-button"]')
        .or(page.getByRole('button', { name: /^(Continue|Շարունակել)$/i }))
        .first();
    if (modalVisible) {
        // The modal can submit by itself once the last digit is in: Continue turns
        // `pointer-events-none` and disappears with the modal, so a click may never land.
        await expect(async () => {
            if (await codeModal.isVisible()) {
                await continueButton.click({ timeout: 2_000 });
            }
            await expect(codeModal).toBeHidden({ timeout: 5_000 });
        }).toPass({ timeout: 30_000 });
        return true;
    }
    await expect(continueButton).toBeVisible({ timeout: 10_000 });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();
    return true;
}

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

/**
 * Password field of the sign-in form. The app redirects here, before rendering any
 * page content, when the Keycloak session behind the saved storageState is gone.
 * @param {import('@playwright/test').Page} page
 */
export const signInPasswordInput = (page) => page.locator(PASSWORD_SELECTOR).first();

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
    const password = await getFirstVisible(page, PASSWORD_SELECTOR);
    if (!password) throw new Error('Password input not visible after waiting for login form.');
    const submit = page
        .getByRole('button', { name: /(մուտք գործել|մուտք|sign in|login)/i })
        .or(page.getByTestId('login-button'))
        .first();
    const submitForm = async () => {
        await email.fill(TEST_USER.email);
        await password.fill(TEST_USER.password);
        await expect(submit).toBeVisible();
        await submit.click();
    };
    const leftSignIn = (url) => {
        const u = url.toString();
        return u.includes(ROUTES.dashboard) || u.includes(ROUTES.otp);
    };

    await submitForm();
    const signedIn = await page.waitForURL(leftSignIn, { timeout: 10_000 }).then(() => true, () => false);
    if (!signedIn && (await email.isVisible()) && (await email.inputValue()) === '') {
        // A slow sign-in page can re-render between filling and submitting, which clears
        // the fields and submits an empty form.
        console.log('[Login] The sign-in form was submitted empty; filling it in again.');
        await submitForm();
    }
    await page.waitForURL(leftSignIn, { timeout: 60_000 });

    if (page.url().includes(ROUTES.otp)) {
        const filled = await fillOtp(page, { timeout: 20_000 });
        if (!filled) {
            throw new Error('OTP page loaded but verification-code inputs were not found.');
        }
    }

    await expect(page).toHaveURL(new RegExp(`${ROUTES.dashboard}$`));
}
