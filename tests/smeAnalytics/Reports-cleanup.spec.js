/**
 * Manual cleanup for leftover automation reports.
 *
 * Two separate tests — run individually or together in order:
 *   1. Archive every "Autom" report still on the active grid
 *   2. Go to the archived grid and permanently delete every "Autom" report there
 *
 * Run on demand:
 *   npx playwright test tests/smeAnalytics/Reports-cleanup.spec.js
 *   npx playwright test tests/smeAnalytics/Reports-cleanup.spec.js -g "archive"
 *   npx playwright test tests/smeAnalytics/Reports-cleanup.spec.js -g "delete"
 *
 * Skipped in CI — trigger locally when you want to tidy the shared test environment.
 */
import { test, expect } from '../../fixtures/index.js';
import { goToReports, goToArchivedReports } from '../../pages/flows/navigation.flow.js';
import { ReportsGrid } from '../../pages/components/reportsGrid.component.js';

const AUTOM_NAME_MATCH = 'Autom';

function log(msg) {
    console.log(`[Reports-cleanup] ${msg}`);
}

/** Grid may not drop a row until reload — retry once before failing. */
async function waitUntilAbsent(grid, name) {
    try {
        await grid.expectNotInGrid(name, { timeout: 15_000 });
    } catch {
        log(`row still visible — reloading once for "${name}"`);
        await grid.reload();
        await grid.expectNotInGrid(name);
    }
}

test.describe('Reports - cleanup (manual)', () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeEach(() => {
        test.skip(!!process.env.CI, 'manual cleanup — run locally with: npx playwright test Reports-cleanup');
        test.setTimeout(600_000);
    });

    test('archive existing Autom reports on active grid', async ({ page }) => {
        log(`detecting active reports containing "${AUTOM_NAME_MATCH}"`);

        await goToReports(page);
        const grid = new ReportsGrid(page);

        let names = await grid.collectNamesContaining(AUTOM_NAME_MATCH);
        if (names.length === 0) {
            log('no matching reports on the active grid — nothing to archive');
            return;
        }

        log(`found ${names.length} on active grid — archiving one by one`);
        let archivedCount = 0;
        while (names.length > 0) {
            const name = names[0];
            archivedCount++;
            log(`archiving ${archivedCount}: "${name}"`);
            await grid.archive(name);
            await waitUntilAbsent(grid, name);
            names = await grid.collectNamesContaining(AUTOM_NAME_MATCH);
        }

        await grid.reload();
        const remaining = await grid.collectNamesContaining(AUTOM_NAME_MATCH);
        expect(remaining, 'Autom reports still on active grid').toHaveLength(0);
        log(`archived ${archivedCount} report(s) from the active grid`);
    });

    test('delete existing Autom reports on archived grid', async ({ page }) => {
        log(`navigating to archived grid to delete reports containing "${AUTOM_NAME_MATCH}"`);

        await goToArchivedReports(page);
        const grid = new ReportsGrid(page);
        await grid.reload();

        let names = await grid.collectNamesContaining(AUTOM_NAME_MATCH);
        if (names.length === 0) {
            log('no matching reports on the archived grid — nothing to delete');
            return;
        }

        log(`found ${names.length} on archived grid — deleting one by one`);
        let deletedCount = 0;
        while (names.length > 0) {
            const name = names[0];
            deletedCount++;
            log(`deleting ${deletedCount}: "${name}"`);
            await grid.deleteReport(name);
            await waitUntilAbsent(grid, name);
            names = await grid.collectNamesContaining(AUTOM_NAME_MATCH);
        }

        await grid.reload();
        const remaining = await grid.collectNamesContaining(AUTOM_NAME_MATCH);
        expect(remaining, 'Autom reports still on archived grid').toHaveLength(0);
        log(`deleted ${deletedCount} report(s) from the archived grid`);
    });
});
