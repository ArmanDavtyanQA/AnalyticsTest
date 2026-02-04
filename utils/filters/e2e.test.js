const { test, expect } = require('@playwright/test');
const { DashboardPage } = require('./pageObjects');

test.describe('Filter Dropdown Helper - E2E Scenarios', () => {
    let dashboard;

    test.beforeEach(async ({ page }) => {
        dashboard = new DashboardPage(page);
        await dashboard.navigate();
        // Assume login is handled or session is valid
    });

    test('should filter by Terminal ID using POM', async ({ page }) => {
        const terminalId = '19124425';

        // Use the high-level POM method
        const result = await dashboard.terminalIdFilter.filterByTerminalId(terminalId);

        expect(result.success).toBe(true);
        expect(result.selectedValue).toBe(terminalId);

        // Verify table updates
        await dashboard.waitForTableLoaded();

        // Further verification (e.g., checking Side Sheet) could be done here
    });

    test('should filter by Status using POM', async ({ page }) => {
        const status = 'Հաստատված';

        const result = await dashboard.statusFilter.filterByStatus(status);

        expect(result.success).toBe(true);
        expect(result.selectedValue).toBe(status);

        await dashboard.waitForTableLoaded();
    });

    test('should handle multi-selection flow', async ({ page }) => {
        // This would demonstrate complex filtering logic
    });
});
