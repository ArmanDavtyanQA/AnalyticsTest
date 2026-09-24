/**
 * Manual cleanup for leftover automation reports.
 *
 * Each reports spec removes its own reports in `afterAll`; this sweeps up anything left
 * by interrupted runs. It finds every report whose title contains "Autom" on the active
 * grid, archives them, then permanently deletes matching reports from the archived grid.
 * The `z-` name sorts it after the other reports specs.
 *
 *   npm run test:reports
 *
 * Skipped in CI — trigger locally when you want to tidy the shared test environment.
 */
import { test, expect } from '../../fixtures/index.js';
import { goToReports, goToArchivedReports } from '../../pages/flows/navigation.flow.js';

/** Substring matched against the report title shown in the grid name column. */
const AUTOM_TITLE_MATCH = 'Autom';

function log(msg) {
    console.log(`[Reports-cleanup] ${msg}`);
}

/** Longest title first, so a parent is never picked before a copy that shares its prefix. */
const longestFirst = (names) => [...names].sort((a, b) => b.length - a.length);

test.describe('Reports - cleanup', { tag: '@reports' }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeEach(({ }, testInfo) => {
        test.skip(!!process.env.CI, 'manual cleanup — run locally with: npm run test:reports');
        testInfo.setTimeout(600_000);
    });

    // Shared scan results for the serial chain.
    let activeMatches = [];
    let archivedMatches = [];

    test('scan active and archived grids for Autom titles', async ({ page, reportsGrid }) => {
        log(`scanning for reports whose title contains "${AUTOM_TITLE_MATCH}"`);
        await goToReports(page);
        activeMatches = await reportsGrid.collectNamesContaining(AUTOM_TITLE_MATCH);
        await goToArchivedReports(page);
        archivedMatches = await reportsGrid.collectNamesContaining(AUTOM_TITLE_MATCH);
    });

    test('log when no Autom reports exist on active or archived grid', async () => {
        if (activeMatches.length === 0 && archivedMatches.length === 0) {
            log('Both grids are already clear — no cleanup actions required.');
        } else {
            log(
                `Matching reports present (active: ${activeMatches.length}, `
                + `archived: ${archivedMatches.length}) — cleanup runs in the next test.`,
            );
        }
    });

    test('remove all reports whose title contains "Autom" (active + archived)', async ({ page, reportsGrid }) => {
        if (activeMatches.length === 0 && archivedMatches.length === 0) {
            log('No matching reports found during scan — skipping archive/delete actions.');
            return;
        }

        // archive() / deleteReport() reload the grid, so each pass re-reads the names.
        await goToReports(page);
        let archivedCount = 0;
        for (let names = activeMatches; names.length > 0;
            names = await reportsGrid.collectNamesContaining(AUTOM_TITLE_MATCH)) {
            const [title] = longestFirst(names);
            log(`archiving ${++archivedCount} on active grid: "${title}"`);
            await reportsGrid.archive(title);
        }

        await goToArchivedReports(page);
        let deletedCount = 0;
        for (let names = await reportsGrid.collectNamesContaining(AUTOM_TITLE_MATCH); names.length > 0;
            names = await reportsGrid.collectNamesContaining(AUTOM_TITLE_MATCH)) {
            const [title] = longestFirst(names);
            log(`deleting ${++deletedCount} on archived grid: "${title}"`);
            await reportsGrid.deleteReport(title);
        }

        await goToReports(page);
        const onActive = await reportsGrid.collectNamesContaining(AUTOM_TITLE_MATCH);
        expect(onActive, `titles still on active grid: ${onActive.join(', ')}`).toHaveLength(0);
        await goToArchivedReports(page);
        const onArchived = await reportsGrid.collectNamesContaining(AUTOM_TITLE_MATCH);
        expect(onArchived, `titles still on archived grid: ${onArchived.join(', ')}`).toHaveLength(0);

        log(`cleanup complete — archived ${archivedCount}, deleted ${deletedCount}`);
    });
});
