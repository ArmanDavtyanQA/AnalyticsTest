import { test as base, expect } from '@playwright/test';
import { handleProfileVerification, profileVerificationGate } from '../pages/flows/profileVerification.flow.js';
import { TransactionsGrid } from '../pages/components/transactionsGrid.component.js';
import { TransactionFilters } from '../pages/components/transactionFilters.component.js';
import { TransactionSideSheet } from '../pages/components/transactionSideSheet.component.js';
import { ReportsGrid } from '../pages/components/reportsGrid.component.js';

const BLOCK_HOST_PATTERNS = [
    /googletagmanager\.com/i,
    /google-analytics\.com/i,
    /googleads\./i,
    /doubleclick\.net/i,
    /hotjar\.com/i,
    /facebook\.net/i,
    /clarity\.ms/i,
    /segment\.io/i,
    // Session recorder; the page keeps a queueing `window.uxc` stub, so blocking it is safe.
    /uxcam\.com/i,
];

const BLOCK_RESOURCE_TYPES = new Set(['media']);

/**
 * Adds route blockers for third-party analytics and heavy media to speed up navigation
 * without affecting test logic. Fonts, images, and stylesheets are left alone because UI behaviour
 * (icons / role-based locators / domcontentloaded timing) often relies on them.
 *
 * @param {import('@playwright/test').BrowserContext | import('@playwright/test').Page} target
 */
export async function installRouteBlockers(target) {
    await target.route('**/*', (route) => {
        const request = route.request();
        const url = request.url();
        const type = request.resourceType();

        if (BLOCK_HOST_PATTERNS.some((re) => re.test(url))) {
            return route.abort();
        }

        if (BLOCK_RESOURCE_TYPES.has(type)) {
            return route.abort();
        }

        return route.continue();
    });
}

/**
 * Completes profile verification whenever its lock screen or OTP modal shows up in
 * front of an action or assertion. The handler's time counts toward that step's
 * timeout, so the first waits after navigation use generous timeouts.
 *
 * @param {import('@playwright/test').Page} page
 */
async function handleVerificationGate(page) {
    await page.addLocatorHandler(profileVerificationGate(page), async () => {
        await handleProfileVerification(page);
    });
}

/**
 * Runs `callback` with a signed-in page outside the test-scoped fixtures — for
 * `afterAll` cleanup, where `page` is not available. Uses the project's saved session.
 *
 * @template T
 * @param {import('@playwright/test').Browser} browser
 * @param {import('@playwright/test').TestInfo} testInfo
 * @param {(page: import('@playwright/test').Page) => Promise<T>} callback
 * @returns {Promise<T>}
 */
export async function withSignedInPage(browser, testInfo, callback) {
    const { baseURL, storageState, viewport, actionTimeout, navigationTimeout } = testInfo.project.use;
    const context = await browser.newContext({ baseURL, storageState, viewport });
    try {
        if (actionTimeout) context.setDefaultTimeout(actionTimeout);
        if (navigationTimeout) context.setDefaultNavigationTimeout(navigationTimeout);
        await installRouteBlockers(context);
        const page = await context.newPage();
        await handleVerificationGate(page);
        return await callback(page);
    } finally {
        await context.close();
    }
}

export const test = base.extend({
    context: async ({ context }, use) => {
        await installRouteBlockers(context);
        await use(context);
    },
    page: async ({ page }, use) => {
        await handleVerificationGate(page);
        await use(page);
    },
    transactionsGrid: async ({ page }, use) => {
        await use(new TransactionsGrid(page));
    },
    transactionFilters: async ({ page }, use) => {
        await use(new TransactionFilters(page));
    },
    sideSheet: async ({ page }, use) => {
        await use(new TransactionSideSheet(page));
    },
    reportsGrid: async ({ page }, use) => {
        await use(new ReportsGrid(page));
    },
});

export { expect };
