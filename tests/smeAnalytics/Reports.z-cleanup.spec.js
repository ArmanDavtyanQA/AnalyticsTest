/**
 * Manual cleanup for leftover automation reports.
 *
 * File is named `Reports.z-cleanup` so it sorts after `Reports.spec.js` and
 * `Reports-actions.spec.js` when the suite runs serially (workers: 1). Finds
 * every report whose title contains "Autom" on the active grid, archives them,
 * then permanently deletes matching reports from the archived grid.
 *
 * Run the full reports suite (tests first, cleanup last):
 *   npm run test:reports
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
 * Reads matching report titles from the active and archived grids (no mutations).
 * @returns {{ active: string[], archived: string[] }}
 */
async function scanBothGrids(page, substring) {
    await goToReports(page);
    const activeGrid = new ReportsGrid(page);
    await activeGrid.reload();
    const active = await activeGrid.collectNamesContaining(substring);

    await goToArchivedReports(page);
    const archivedGrid = new ReportsGrid(page);
    await archivedGrid.reload();
    const archived = await archivedGrid.collectNamesContaining(substring);

    return { active, archived };
}

/** Logs how many matching titles were found on each grid (including when zero). */
function logGridStatus({ active, archived }, substring) {
    if (active.length === 0) {
        log(`Active grid: no reports whose title contains "${substring}".`);
    } else {
        log(
            `Active grid: ${active.length} report(s) whose title contains "${substring}": `
            + active.join(', '),
        );
    }

    if (archived.length === 0) {
        log(`Archived grid: no reports whose title contains "${substring}".`);
    } else {
        log(
            `Archived grid: ${archived.length} report(s) whose title contains "${substring}": `
            + archived.join(', '),
        );
    }
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

test.describe('Reports - cleanup', { tag: '@reports' }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeEach(({ }, testInfo) => {
        test.skip(!!process.env.CI, 'manual cleanup — run locally with: npm run test:reports');
        testInfo.setTimeout(600_000);
    });

    // Shared scan results for the serial chain.
    let activeMatches = [];
    let archivedMatches = [];

    test('scan active and archived grids for Autom titles', async ({ page }) => {
        log(`scanning for reports whose title contains "${AUTOM_TITLE_MATCH}"`);

        ({ active: activeMatches, archived: archivedMatches } = await scanBothGrids(
            page,
            AUTOM_TITLE_MATCH,
        ));
        logGridStatus({ active: activeMatches, archived: archivedMatches }, AUTOM_TITLE_MATCH);
    });

    test('log when no Autom reports exist on active or archived grid', async () => {
        const nothingOnActive = activeMatches.length === 0;
        const nothingOnArchived = archivedMatches.length === 0;

        if (nothingOnActive) {
            log(
                `Active grid: no reports whose title contains "${AUTOM_TITLE_MATCH}" — nothing to archive.`,
            );
        }

        if (nothingOnArchived) {
            log(
                `Archived grid: no reports whose title contains "${AUTOM_TITLE_MATCH}" — nothing to delete.`,
            );
        }

        if (nothingOnActive && nothingOnArchived) {
            log('Both grids are already clear — no cleanup actions required.');
        } else {
            log(
                `Matching reports present (active: ${activeMatches.length}, `
                + `archived: ${archivedMatches.length}) — cleanup runs in the next test.`,
            );
        }
    });

    test('remove all reports whose title contains "Autom" (active + archived)', async ({ page }) => {
        if (activeMatches.length === 0 && archivedMatches.length === 0) {
            log('No matching reports found during scan — skipping archive/delete actions.');
            return;
        }

        log(`cleaning reports whose title contains "${AUTOM_TITLE_MATCH}"`);

        let archivedCount = 0;
        if (activeMatches.length > 0) {
            archivedCount = await archiveAllOnActiveGrid(page, AUTOM_TITLE_MATCH);
            log(`archived ${archivedCount} report(s) from the active grid`);
        } else {
            log(`Active grid: no reports whose title contains "${AUTOM_TITLE_MATCH}" — skipping archive.`);
        }

        let deletedCount = 0;
        const archivedToDelete = archivedMatches.length + archivedCount;
        if (archivedToDelete > 0) {
            deletedCount = await deleteAllOnArchivedGrid(page, AUTOM_TITLE_MATCH);
            log(`deleted ${deletedCount} report(s) from the archived grid`);
        } else {
            log(
                `Archived grid: no reports whose title contains "${AUTOM_TITLE_MATCH}" — skipping delete.`,
            );
        }

        await expectNoAutomReportsOnEitherGrid(page, AUTOM_TITLE_MATCH);
        log(
            `cleanup complete — archived ${archivedCount}, deleted ${deletedCount}; `
            + `no "${AUTOM_TITLE_MATCH}" titles remain on either grid`,
        );
    });
});
