import { test, expect } from '../../fixtures/index.js';
import { goToReports, goToArchivedReports } from '../../pages/flows/navigation.flow.js';
import {
    CreateReportModal,
    REPORT_FREQUENCY,
    REPORT_BY,
    REPORT_FILTERS,
    expectReportInGrid,
} from '../../pages/components/createReportModal.component.js';
import { ReportsGrid } from '../../pages/components/reportsGrid.component.js';

const REPORT_EMAIL = 'arman.davtyan.qa@gmail.com';

async function createReport(page, base) {
    const name = `${base} ${Date.now()}`;
    console.log(`[setup] creating report "${name}"`);
    await new CreateReportModal(page).create({
        name,
        email: REPORT_EMAIL,
        frequency: REPORT_FREQUENCY.DAILY,
        reportBy: REPORT_BY.SETTLEMENT_DATE,
        filter: { id: REPORT_FILTERS.TERMINAL_ID, optionIndex: 0 },
    });
    console.log(`[setup] report "${name}" created`);
    return name;
}

test.describe('Reports - row actions', () => {
    // Cases 1-7 act on ONE report created in case 1 (plus the duplicate made in
    // case 4). Serial mode preserves order. Case 7 archives both reports from case 6
    // and permanently deletes them from the archived grid (final cleanup).
    test.describe.configure({ mode: 'serial' });

    // Shared across the serial chain. The report is persisted server-side, so each
    // (fresh-page) test only needs the names carried forward.
    let reportName;
    let duplicateName;

    test.beforeEach(async ({ page }) => {
        await goToReports(page);
    });

    test('Activate report via toggle', async ({ page }) => {
        const grid = new ReportsGrid(page);
        reportName = await createReport(page, 'Autom Flow');

        await grid.reload();
        await grid.expectToggleState(reportName, false);
        // activate() reloads and re-asserts the persisted ON state internally.
        await grid.activate(reportName);
    });

    test('Deactivate report via toggle', async ({ page }) => {
        const grid = new ReportsGrid(page);
        expect(reportName, 'report from case 1 is required').toBeTruthy();

        await grid.reload();
        await grid.expectToggleState(reportName, true);
        // The report is active from case 1; deactivate() reloads + asserts OFF internally.
        await grid.deactivate(reportName);
    });

    test('Open report History tab', async ({ page }) => {
        const grid = new ReportsGrid(page);
        expect(reportName, 'report from case 1 is required').toBeTruthy();

        await grid.reload();
        // Opens the previously deactivated report's details on the History tab.
        await grid.openHistory(reportName);
        await grid.expectHistoryTabOpen();
        await grid.closeSideSheet();
    });

    test('Duplicate and rename report', async ({ page }) => {
        const grid = new ReportsGrid(page);
        expect(reportName, 'report from case 1 is required').toBeTruthy();

        await grid.reload();
        // Independent name — NOT derived from reportName. If the copy embedded the
        // parent name, substring-based row matching (`hasText`) would treat the
        // duplicate row as the parent and break the archive/unarchive assertions.
        duplicateName = `Autom Flow Copy ${Date.now()}`;
        await grid.duplicate(reportName, duplicateName);

        await expectReportInGrid(page, duplicateName);
    });

    test('Archive report (main + duplicate gone from Active, present in Archived)', async ({ page }) => {
        const grid = new ReportsGrid(page);
        expect(reportName && duplicateName, 'report + duplicate from cases 1 & 4 are required').toBeTruthy();

        await grid.reload();
        await grid.expectInGrid(reportName);
        await grid.expectInGrid(duplicateName);

        // Archive BOTH reports. archive() reloads the active grid and asserts each
        // row is gone internally.
        await grid.archive(reportName);
        await grid.archive(duplicateName);

        await goToArchivedReports(page);
        const archivedGrid = new ReportsGrid(page);
        await archivedGrid.expectInGrid(reportName);
        await archivedGrid.expectInGrid(duplicateName);
    });

    test('Unarchive report (main + duplicate back to Active, gone from Archived)', async ({ page }) => {
        expect(reportName && duplicateName, 'report + duplicate from cases 1 & 4 are required').toBeTruthy();

        await goToArchivedReports(page);
        const archivedGrid = new ReportsGrid(page);
        await archivedGrid.expectInGrid(reportName);
        await archivedGrid.expectInGrid(duplicateName);

        // Unarchive the same two reports archived in case 5.
        await archivedGrid.unarchive(reportName);
        await archivedGrid.unarchive(duplicateName);

        await archivedGrid.reload();
        await archivedGrid.expectNotInGrid(reportName);
        await archivedGrid.expectNotInGrid(duplicateName);

        await goToReports(page);
        const grid = new ReportsGrid(page);
        await grid.expectInGrid(reportName);
        await grid.expectInGrid(duplicateName);
    });

    test('Delete archived reports (main + duplicate gone from Archived and Active)', async ({ page }) => {
        const grid = new ReportsGrid(page);
        expect(reportName && duplicateName, 'report + duplicate from cases 1 & 4 are required').toBeTruthy();

        await grid.reload();
        await grid.expectInGrid(reportName);
        await grid.expectInGrid(duplicateName);

        // Archive the same two reports restored in case 6, then delete from Archived.
        await grid.archive(reportName);
        await grid.archive(duplicateName);

        await goToArchivedReports(page);
        const archivedGrid = new ReportsGrid(page);
        await archivedGrid.expectInGrid(reportName);
        await archivedGrid.expectInGrid(duplicateName);

        await archivedGrid.deleteReport(reportName);
        await archivedGrid.deleteReport(duplicateName);

        await goToReports(page);
        const activeGrid = new ReportsGrid(page);
        await activeGrid.expectNotInGrid(reportName);
        await activeGrid.expectNotInGrid(duplicateName);
    });
});
