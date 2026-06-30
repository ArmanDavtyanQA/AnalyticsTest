import { expect } from '@playwright/test';
import { Sidebar } from '../components/sidebar.component.js';
import { waitForGridToLoad } from '../../helpers.js';
import { ROUTES } from './auth.flow.js';

/**
 * Lands on the dashboard page assuming the user is already authenticated via storageState.
 * Falls back to interactive login if the auth session has expired.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function goToDashboard(page) {
    if (!page.url().includes(ROUTES.dashboard)) {
        await page.goto(ROUTES.dashboard, { waitUntil: 'domcontentloaded' });
    }
    await expect(page).toHaveURL(new RegExp(`${ROUTES.dashboard}$`));
    const dashboardHeader = page.locator('.application-list__top p').first();
    await expect(dashboardHeader).toBeVisible({ timeout: 30_000 });
    await expect(dashboardHeader).toContainText('Հայտերի պատմություն');
}

/**
 * Collapses the side navigation. The auth storageState can carry a persisted
 * `--opened --pin` sidebar preference that overlaps filter chips and intercepts pointer
 * events. We remove the `--opened` class so the sidebar collapses to its narrow pinned width.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function collapseSidebar(page) {
    await page.mouse.move(0, 0);
    await page.evaluate(() => {
        document.querySelectorAll('.side-navigation.side-navigation--opened').forEach((el) => {
            el.classList.remove('side-navigation--opened');
        });
    }).catch(() => { });
}

/**
 * Navigates to the Transactions page via the sidebar and waits for the grid to settle.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function goToTransactions(page) {
    // reports / reportsArchive both contain the transactions path as a substring,
    // so only treat the bare transactions route as "already here".
    const alreadyHere =
        page.url().includes(ROUTES.transactions) && !page.url().includes(ROUTES.reports);
    if (!alreadyHere) {
        // Direct deep-link is far cheaper than the dashboard -> sidebar hop (one fewer
        // full page load per test). Fall back to sidebar nav only if auth lapsed and
        // we got bounced off the page.
        await page.goto(ROUTES.transactions, { waitUntil: 'domcontentloaded' });
        const landed =
            page.url().includes(ROUTES.transactions) && !page.url().includes(ROUTES.reports);
        if (!landed) {
            await goToDashboard(page);
            const sidebar = new Sidebar(page);
            await sidebar.navigate('Գործարքներ');
            await page.waitForURL(`**${ROUTES.transactions}`);
        }
    }
    await collapseSidebar(page);
    await waitForGridToLoad(page, 90000, { allowEmpty: true });
}

/**
 * Navigates to the Reports page via the sidebar and waits for the grid to settle.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function goToReports(page) {
    // The archive URL contains the reports URL as a substring, so exclude it
    // explicitly - otherwise we'd treat the archive page as "already on reports".
    const alreadyHere =
        page.url().includes(ROUTES.reports) && !page.url().includes(ROUTES.reportsArchive);
    if (!alreadyHere) {
        // Direct deep-link instead of the dashboard -> sidebar hop. Fall back to
        // sidebar nav only if auth lapsed and the direct load bounced us elsewhere.
        await page.goto(ROUTES.reports, { waitUntil: 'domcontentloaded' });
        const landed =
            page.url().includes(ROUTES.reports) && !page.url().includes(ROUTES.reportsArchive);
        if (!landed) {
            await goToDashboard(page);
            const sidebar = new Sidebar(page);
            await sidebar.navigate('Հաշվետվություններ');
            // Anchor to the exact reports path — the archive URL contains it as a substring.
            await page.waitForURL(new RegExp(`${ROUTES.reports}$`));
        }
    }
    await collapseSidebar(page);
    await waitForGridToLoad(page, 90000, { allowEmpty: true });
    await expect(page.getByRole('button', { name: 'Ստեղծել' })).toBeVisible();
}

/**
 * Navigates to the Archived reports page and waits for its grid to settle.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function goToArchivedReports(page) {
    if (!page.url().includes(ROUTES.reportsArchive)) {
        await page.goto(ROUTES.reportsArchive, { waitUntil: 'domcontentloaded' });
    }
    await expect(page).toHaveURL(new RegExp(`${ROUTES.reportsArchive}$`));
    await collapseSidebar(page);
    await waitForGridToLoad(page, 90000, { allowEmpty: true });
}
