import { ReportsGrid } from '../components/reportsGrid.component.js';
import { goToReports, goToArchivedReports } from './navigation.flow.js';

/**
 * Permanently removes reports by exact name: archives the ones still on the active
 * grid, then deletes them from the archived grid. Names that no longer exist anywhere
 * (never created, or already deleted by the test) are skipped.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string[]} names
 */
export async function removeReports(page, names) {
    if (names.length === 0) return;
    console.log(`[Reports cleanup] removing ${names.length} report(s): ${names.join(', ')}`);

    await goToReports(page);
    const activeGrid = new ReportsGrid(page);
    for (const name of names) {
        if (await activeGrid.hasReport(name)) {
            await activeGrid.archive(name);
        }
    }

    await goToArchivedReports(page);
    const archivedGrid = new ReportsGrid(page);
    for (const name of names) {
        if (await archivedGrid.hasReport(name)) {
            await archivedGrid.deleteReport(name);
        }
    }
}
