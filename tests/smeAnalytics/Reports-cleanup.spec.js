/**
 * Manual cleanup for leftover automation reports.
 *
 * Finds every report whose title (name column) contains "Autom" on the active
 * grid, archives them, then permanently deletes all matching reports from the
 * archived grid (including ones that were already archived before this run).
 *
 * Run on demand:
 *   npx playwright test tests/smeAnalytics/Reports-cleanup.spec.js
 *
 * Skipped in CI — trigger locally when you want to tidy the shared test environment.
 */
import { test, expect } from '../../fixtures/index.js';
import { goToReports, goToArchivedReports } from '../../pages/flows/navigation.flow.js';
import { ReportsGrid } from '../../pages/components/reportsGrid.component.js';

/** Substring matched against the report title shown in the grid name column. */
const AUTOM_TITLE_MATCH = 'Autom';

function log(msg) {
    console.log(`[Reports-cleanup] ${msg}`);
}

/**
 * Archives every report on the active grid whose title contains `substring`.
 * @returns {number} how many reports were archived
 */
async function archiveAllOnActiveGrid(page, substring) {
    await goToReports(page);
    const grid = new ReportsGrid(page);
    await grid.reload();

    let archivedCount = 0;
    let names = await grid.collectNamesContaining(substring);
    while (names.length > 0) {
        // Longest titles first — exact row matching, but this avoids acting on a
        // parent title before its duplicate when names share a prefix.
        names.sort((a, b) => b.length - a.length);
        const title = names[0];
        archivedCount++;
        log(`archiving ${archivedCount} on active grid: "${title}"`);
        await grid.archive(title);
        names = await grid.collectNamesContaining(substring);
    }
    return archivedCount;
}

/**
 * Permanently deletes every report on the archived grid whose title contains `substring`.
 * @returns {number} how many reports were deleted
 */
async function deleteAllOnArchivedGrid(page, substring) {
    await goToArchivedReports(page);
    const grid = new ReportsGrid(page);
    await grid.reload();

    let deletedCount = 0;
    let names = await grid.collectNamesContaining(substring);
    while (names.length > 0) {
        names.sort((a, b) => b.length - a.length);
        const title = names[0];
        deletedCount++;
        log(`deleting ${deletedCount} on archived grid: "${title}"`);
        await grid.deleteReport(title);
        names = await grid.collectNamesContaining(substring);
    }
    return deletedCount;
}

/** Asserts no report title on either grid still contains `substring`. */
async function expectNoAutomReportsOnEitherGrid(page, substring) {
    await goToReports(page);
    const activeGrid = new ReportsGrid(page);
    await activeGrid.reload();
    const onActive = await activeGrid.collectNamesContaining(substring);
    expect(onActive, `titles still on active grid: ${onActive.join(', ')}`).toHaveLength(0);

    await goToArchivedReports(page);
    const archivedGrid = new ReportsGrid(page);
    await archivedGrid.reload();
    const onArchived = await archivedGrid.collectNamesContaining(substring);
    expect(onArchived, `titles still on archived grid: ${onArchived.join(', ')}`).toHaveLength(0);
}

test.describe('Reports - cleanup (manual)', () => {
    test.beforeEach(() => {
        test.skip(!!process.env.CI, 'manual cleanup — run locally with: npx playwright test Reports-cleanup');
        test.setTimeout(600_000);
    });

    test('remove all reports whose title contains "Autom" (active + archived)', async ({ page }) => {
        log(`cleaning reports whose title contains "${AUTOM_TITLE_MATCH}"`);

        const archivedCount = await archiveAllOnActiveGrid(page, AUTOM_TITLE_MATCH);
        if (archivedCount === 0) {
            log('no matching titles on the active grid');
        } else {
            log(`archived ${archivedCount} report(s) from the active grid`);
        }

        const deletedCount = await deleteAllOnArchivedGrid(page, AUTOM_TITLE_MATCH);
        if (deletedCount === 0) {
            log('no matching titles on the archived grid');
        } else {
            log(`deleted ${deletedCount} report(s) from the archived grid`);
        }

        await expectNoAutomReportsOnEitherGrid(page, AUTOM_TITLE_MATCH);
        log(
            `cleanup complete — archived ${archivedCount}, deleted ${deletedCount}; `
            + `no "${AUTOM_TITLE_MATCH}" titles remain on either grid`,
        );
    });
});
