import { test, expect } from '../../fixtures/index.js';
import { resetFilters } from '../../helpers.js';
import { goToReports } from '../../pages/flows/navigation.flow.js';
import { ROUTES } from '../../pages/flows/auth.flow.js';
import {
    CreateReportModal,
    REPORT_FREQUENCY,
    REPORT_BY,
    REPORT_FILTERS,
    expectReportInGrid,
} from '../../pages/components/createReportModal.component.js';

test.describe('Reports', () => {
    test.beforeEach(async ({ page }) => {
        await goToReports(page);
        await resetFilters(page);
    });

    test('Test environment login and navigation', async ({ page }) => {
        await expect(page).toHaveURL(new RegExp(`${ROUTES.reports}$`));
        await expect(page.getByRole('button', { name: 'Ստեղծել' })).toBeVisible();
    });

    test('Create Daily settled report', async ({ page }) => {
        const reportName = `Autom Daily Settled ${Date.now()}`;
        await new CreateReportModal(page).create({
            name: reportName,
            email: 'arman.davtyan.qa@gmail.com',
            frequency: REPORT_FREQUENCY.DAILY,
            reportBy: REPORT_BY.SETTLEMENT_DATE,
            filter: { id: REPORT_FILTERS.TERMINAL_ID, optionIndex: 0 },
        });
        await expectReportInGrid(page, reportName);
    });

    test('Create Weekly settled report', async ({ page }) => {
        const reportName = `Autom Weekly Settled ${Date.now()}`;
        await new CreateReportModal(page).create({
            name: reportName,
            email: 'arman.davtyan.qa@gmail.com',
            frequency: REPORT_FREQUENCY.WEEKLY,
            reportBy: REPORT_BY.SETTLEMENT_DATE,
            filter: { id: REPORT_FILTERS.TERMINAL_ID, optionIndex: 0 },
        });
        await expectReportInGrid(page, reportName);
    });

    test('Create Monthly settled report', async ({ page }) => {
        const reportName = `Autom Monthly Settled ${Date.now()}`;
        await new CreateReportModal(page).create({
            name: reportName,
            email: 'arman.davtyan.qa@gmail.com',
            frequency: REPORT_FREQUENCY.MONTHLY,
            reportBy: REPORT_BY.SETTLEMENT_DATE,
            filter: { id: REPORT_FILTERS.TERMINAL_ID, optionIndex: 0 },
        });
        await expectReportInGrid(page, reportName);
    });

    test('Create Daily created date report', async ({ page }) => {
        const reportName = `Autom Daily Created ${Date.now()}`;
        await new CreateReportModal(page).create({
            name: reportName,
            email: 'arman.davtyan.qa@gmail.com',
            frequency: REPORT_FREQUENCY.DAILY,
            reportBy: REPORT_BY.CREATION_DATE,
            filter: { id: REPORT_FILTERS.TERMINAL_ID, optionIndex: 0 },
        });
        await expectReportInGrid(page, reportName);
    });

    test('Create Weekly created date report', async ({ page }) => {
        const reportName = `Autom Weekly Created ${Date.now()}`;
        await new CreateReportModal(page).create({
            name: reportName,
            email: 'arman.davtyan.qa@gmail.com',
            frequency: REPORT_FREQUENCY.WEEKLY,
            reportBy: REPORT_BY.CREATION_DATE,
            filter: { id: REPORT_FILTERS.TERMINAL_ID, optionIndex: 0 },
        });
        await expectReportInGrid(page, reportName);
    });

    test('Create Monthly created date report', async ({ page }) => {
        const reportName = `Autom Monthly Created ${Date.now()}`;
        await new CreateReportModal(page).create({
            name: reportName,
            email: 'arman.davtyan.qa@gmail.com',
            frequency: REPORT_FREQUENCY.MONTHLY,
            reportBy: REPORT_BY.CREATION_DATE,
            filter: { id: REPORT_FILTERS.TERMINAL_ID, optionIndex: 0 },
        });
        await expectReportInGrid(page, reportName);
    });
});
