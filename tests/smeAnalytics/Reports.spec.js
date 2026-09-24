import { test, expect, withSignedInPage } from '../../fixtures/index.js';
import { goToReports } from '../../pages/flows/navigation.flow.js';
import { removeReports } from '../../pages/flows/reports.flow.js';
import { ROUTES } from '../../pages/flows/auth.flow.js';
import {
    CreateReportModal,
    REPORT_FREQUENCY,
    REPORT_BY,
    REPORT_FILTERS,
} from '../../pages/components/createReportModal.component.js';

const REPORT_EMAIL = 'arman.davtyan.qa@gmail.com';

const CREATE_CASES = [
    { title: 'Create Daily settled report', name: 'Daily Settled', frequency: REPORT_FREQUENCY.DAILY, reportBy: REPORT_BY.SETTLEMENT_DATE },
    { title: 'Create Weekly settled report', name: 'Weekly Settled', frequency: REPORT_FREQUENCY.WEEKLY, reportBy: REPORT_BY.SETTLEMENT_DATE },
    { title: 'Create Monthly settled report', name: 'Monthly Settled', frequency: REPORT_FREQUENCY.MONTHLY, reportBy: REPORT_BY.SETTLEMENT_DATE },
    { title: 'Create Daily created date report', name: 'Daily Created', frequency: REPORT_FREQUENCY.DAILY, reportBy: REPORT_BY.CREATION_DATE },
    { title: 'Create Weekly created date report', name: 'Weekly Created', frequency: REPORT_FREQUENCY.WEEKLY, reportBy: REPORT_BY.CREATION_DATE },
    { title: 'Create Monthly created date report', name: 'Monthly Created', frequency: REPORT_FREQUENCY.MONTHLY, reportBy: REPORT_BY.CREATION_DATE },
];

test.describe('Reports', { tag: '@reports' }, () => {
    /** Reports submitted by this file; removed after the run even when a test fails. */
    const created = [];

    test.beforeEach(async ({ page }) => {
        await goToReports(page);
    });

    test.afterAll(async ({ browser }, testInfo) => {
        test.setTimeout(10 * 60_000);
        await withSignedInPage(browser, testInfo, (page) => removeReports(page, created));
    });

    test('Test environment login and navigation', async ({ page }) => {
        await expect(page).toHaveURL(new RegExp(`${ROUTES.reports}$`));
        await expect(new CreateReportModal(page).openButton).toBeVisible();
    });

    for (const { title, name, frequency, reportBy } of CREATE_CASES) {
        test(title, async ({ page, reportsGrid }) => {
            const reportName = `Autom ${name} ${Date.now()}`;
            created.push(reportName);

            await new CreateReportModal(page).create({
                name: reportName,
                email: REPORT_EMAIL,
                frequency,
                reportBy,
                filter: { id: REPORT_FILTERS.TERMINAL_ID, optionIndex: 0 },
            });

            // The grid does not refresh by itself after a report is created.
            await reportsGrid.reload();
            await reportsGrid.expectInGrid(reportName);
        });
    }
});
