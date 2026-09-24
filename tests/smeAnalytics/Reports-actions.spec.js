import { test, withSignedInPage } from '../../fixtures/index.js';
import { goToReports, goToArchivedReports } from '../../pages/flows/navigation.flow.js';
import { removeReports } from '../../pages/flows/reports.flow.js';
import {
    CreateReportModal,
    REPORT_FREQUENCY,
    REPORT_BY,
    REPORT_FILTERS,
} from '../../pages/components/createReportModal.component.js';

const REPORT_EMAIL = 'arman.davtyan.qa@gmail.com';

test.describe('Reports - row actions', { tag: '@reports' }, () => {
    // Every case acts on the report created by the first one (plus the copy made by
    // "Duplicate"), so the chain runs in order and a retry restarts it with new names.
    test.describe.configure({ mode: 'serial' });

    const reportName = `Autom Flow ${Date.now()}`;
    const duplicateName = `Autom Flow Copy ${Date.now()}`;

    test.beforeEach(async ({ page }) => {
        await goToReports(page);
    });

    test.afterAll(async ({ browser }, testInfo) => {
        test.setTimeout(5 * 60_000);
        await withSignedInPage(browser, testInfo, (page) => removeReports(page, [reportName, duplicateName]));
    });

    test('Activate report via toggle', async ({ page, reportsGrid }) => {
        await new CreateReportModal(page).create({
            name: reportName,
            email: REPORT_EMAIL,
            frequency: REPORT_FREQUENCY.DAILY,
            reportBy: REPORT_BY.SETTLEMENT_DATE,
            filter: { id: REPORT_FILTERS.TERMINAL_ID, optionIndex: 0 },
        });
        await reportsGrid.reload();
        await reportsGrid.expectToggleState(reportName, false);

        // activate() reloads and re-checks the persisted ON state.
        await reportsGrid.activate(reportName);
    });

    test('Deactivate report via toggle', async ({ reportsGrid }) => {
        await reportsGrid.expectToggleState(reportName, true);

        await reportsGrid.deactivate(reportName);
    });

    test('Open report History tab', async ({ reportsGrid }) => {
        await reportsGrid.openHistory(reportName);

        await reportsGrid.expectHistoryTabOpen();
        await reportsGrid.closeSideSheet();
    });

    test('Duplicate and rename report', async ({ reportsGrid }) => {
        await reportsGrid.duplicate(reportName, duplicateName);

        await reportsGrid.reload();
        await reportsGrid.expectInGrid(duplicateName);
    });

    test('Archive report (main + duplicate gone from Active, present in Archived)', async ({ page, reportsGrid }) => {
        // archive() reloads the active grid and waits for the row to disappear.
        await reportsGrid.archive(reportName);
        await reportsGrid.archive(duplicateName);

        await goToArchivedReports(page);
        await reportsGrid.expectInGrid(reportName);
        await reportsGrid.expectInGrid(duplicateName);
    });

    test('Unarchive report (main + duplicate back to Active, gone from Archived)', async ({ page, reportsGrid }) => {
        await goToArchivedReports(page);
        await reportsGrid.unarchive(reportName);
        await reportsGrid.unarchive(duplicateName);

        await reportsGrid.waitUntilNotInGrid(reportName);
        await reportsGrid.waitUntilNotInGrid(duplicateName);
        await goToReports(page);
        await reportsGrid.expectInGrid(reportName);
        await reportsGrid.expectInGrid(duplicateName);
    });

    test('Delete archived reports (main + duplicate gone from Archived and Active)', async ({ page, reportsGrid }) => {
        await reportsGrid.archive(reportName);
        await reportsGrid.archive(duplicateName);

        // deleteReport() reloads the archived grid and waits for the row to disappear.
        await goToArchivedReports(page);
        await reportsGrid.deleteReport(reportName);
        await reportsGrid.deleteReport(duplicateName);

        await goToReports(page);
        await reportsGrid.expectNotInGrid(reportName);
        await reportsGrid.expectNotInGrid(duplicateName);
    });
});
