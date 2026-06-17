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
    test.beforeEach(async ({ page }) => {
        await goToReports(page);
    });

    test('Activate report via toggle', async ({ page }) => {
        const grid = new ReportsGrid(page);
        const name = await createReport(page, 'Autom Activate');

        await grid.reload();
        await grid.expectToggleState(name, false);
        await grid.activate(name);

        await grid.reload();
        await grid.expectToggleState(name, true);
    });

    test('Deactivate report via toggle', async ({ page }) => {
        const grid = new ReportsGrid(page);
        const name = await createReport(page, 'Autom Deactivate');

        await grid.reload();
        await grid.activate(name);
        await grid.reload();
        await grid.expectToggleState(name, true);

        await grid.deactivate(name);
        await grid.reload();
        await grid.expectToggleState(name, false);
    });

    test('Open report History tab', async ({ page }) => {
        const grid = new ReportsGrid(page);
        const name = await createReport(page, 'Autom History');

        await grid.reload();
        await grid.openHistory(name);
        await grid.expectHistoryTabOpen();
        await grid.closeSideSheet();
    });

    test('Duplicate and rename report', async ({ page }) => {
        const grid = new ReportsGrid(page);
        const sourceName = await createReport(page, 'Autom Dup Source');

        await grid.reload();
        const newName = `Autom Dup Copy ${Date.now()}`;
        await grid.duplicate(sourceName, newName);

        await expectReportInGrid(page, newName);
    });

    test('Archive report (gone from Active, present in Archived)', async ({ page }) => {
        const grid = new ReportsGrid(page);
        const name = await createReport(page, 'Autom Archive');

        await grid.reload();
        await grid.expectInGrid(name);
        await grid.archive(name);

        await grid.reload();
        await grid.expectNotInGrid(name);

        await goToArchivedReports(page);
        const archivedGrid = new ReportsGrid(page);
        await archivedGrid.expectInGrid(name);
    });

    test('Unarchive report (back to Active, gone from Archived)', async ({ page }) => {
        const grid = new ReportsGrid(page);
        const name = await createReport(page, 'Autom Unarchive');

        await grid.reload();
        await grid.archive(name);

        await goToArchivedReports(page);
        const archivedGrid = new ReportsGrid(page);
        await archivedGrid.expectInGrid(name);
        await archivedGrid.unarchive(name);

        await archivedGrid.reload();
        await archivedGrid.expectNotInGrid(name); 

        await goToReports(page);
        await new ReportsGrid(page).expectInGrid(name);
    });

    test('Delete archived report (gone from Archived and Active)', async ({ page }) => {
        const grid = new ReportsGrid(page);
        const name = await createReport(page, 'Autom Delete');

        await grid.reload();
        await grid.archive(name);

        await goToArchivedReports(page);
        const archivedGrid = new ReportsGrid(page);
        await archivedGrid.expectInGrid(name);
        await archivedGrid.deleteReport(name);

        await archivedGrid.reload();
        await archivedGrid.expectNotInGrid(name); 

        await goToReports(page);
        await new ReportsGrid(page).expectNotInGrid(name);
    });
});
