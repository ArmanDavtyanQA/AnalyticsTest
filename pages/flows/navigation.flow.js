import { expect } from '@playwright/test';
import { Sidebar } from '../components/sidebar.component.js';
import { TransactionsGrid } from '../components/transactionsGrid.component.js';
import { ReportsGrid } from '../components/reportsGrid.component.js';
import { CreateReportModal } from '../components/createReportModal.component.js';
import { login, signInPasswordInput, ROUTES } from './auth.flow.js';

const FIRST_RENDER_TIMEOUT = 30_000;

/**
 * Opens an app route with the saved session. Every page load silently fetches a fresh
 * access token from Keycloak; when that SSO session is gone the app redirects to the
 * sign-in form before rendering anything, so sign in once and reopen the route.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} route - one of {@link ROUTES}
 */
async function openRoute(page, route) {
    const sidebar = new Sidebar(page);
    const passwordInput = signInPasswordInput(page);
    const rendered = sidebar.container.or(passwordInput).first();

    await page.goto(route, { waitUntil: 'domcontentloaded' });
    const renderedInTime = await rendered
        .waitFor({ timeout: FIRST_RENDER_TIMEOUT })
        .then(() => true, () => false);
    if (!renderedInTime) {
        // Neither recovers by itself: a failed app-bundle download leaves a blank page, and a
        // failed token check makes the app stop on Keycloak's unconfirmed logout page (the
        // SSO session is still valid there, so opening the route again signs back in).
        console.log(`[Navigation] ${route} rendered nothing within ${FIRST_RENDER_TIMEOUT / 1000}s `
            + `(at ${page.url()}) — opening it again.`);
        await page.goto(route, { waitUntil: 'domcontentloaded' });
    }
    await expect(rendered).toBeVisible({ timeout: 60_000 });
    if (await passwordInput.isVisible()) {
        console.log(`[Navigation] Keycloak session expired while opening ${route} — signing in again.`);
        await login(page);
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await expect(sidebar.container, `still signed out after re-login (${route})`)
            .toBeVisible({ timeout: 60_000 });
    }
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await sidebar.collapse();
}

/**
 * Opens Transactions and waits for its first grid query to render.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<import('../components/transactionsGrid.component.js').TransactionsPage>}
 *   the default view (last 14 days, no filters) as returned by the API
 */
export async function goToTransactions(page) {
    const grid = new TransactionsGrid(page);
    return grid.waitForQuery(async () => {
        await openRoute(page, ROUTES.transactions);
        await expect(grid.table).toBeVisible({ timeout: 60_000 });
    }, {
        description: 'the default Transactions view',
        allowEmpty: true,
        timeout: 90_000,
    });
}

/**
 * Opens the active Reports page and waits for its grid.
 * @param {import('@playwright/test').Page} page
 */
export async function goToReports(page) {
    await openRoute(page, ROUTES.reports);
    await new ReportsGrid(page).waitForLoad();
    await expect(new CreateReportModal(page).openButton).toBeVisible();
}

/**
 * Opens the Archived reports page and waits for its grid.
 * @param {import('@playwright/test').Page} page
 */
export async function goToArchivedReports(page) {
    await openRoute(page, ROUTES.reportsArchive);
    await new ReportsGrid(page).waitForLoad();
}
