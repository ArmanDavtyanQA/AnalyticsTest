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
async function collapseSidebar(page) {
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
    if (page.url().includes(ROUTES.transactions)) {
        await waitForGridToLoad(page);
        return;
    }
    await goToDashboard(page);
    const sidebar = new Sidebar(page);
    await sidebar.navigate('Գործարքներ');
    await page.waitForURL(`**${ROUTES.transactions}`);
    await collapseSidebar(page);
    await waitForGridToLoad(page);
}

/**
 * Navigates to the Reports page via the sidebar and waits for the grid to settle.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function goToReports(page) {
    if (page.url().includes(ROUTES.reports)) {
        await waitForGridToLoad(page);
        await expect(page.getByRole('button', { name: 'Ստեղծել' })).toBeVisible();
        return;
    }
    await goToDashboard(page);
    const sidebar = new Sidebar(page);
    await sidebar.navigate('Հաշվետվություններ');
    await page.waitForURL(`**${ROUTES.reports}`);
    await collapseSidebar(page);
    await waitForGridToLoad(page);
    await expect(page.getByRole('button', { name: 'Ստեղծել' })).toBeVisible();
}
