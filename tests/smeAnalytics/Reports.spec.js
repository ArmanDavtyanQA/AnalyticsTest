import { test, expect } from '../../fixtures/index.js';
import { resetFilters } from '../../helpers.js';
import { goToReports } from '../../pages/flows/navigation.flow.js';
import { ROUTES } from '../../pages/flows/auth.flow.js';

test.describe('Reports', () => {
    test.beforeEach(async ({ page }) => {
        await goToReports(page);
        await resetFilters(page);
    });

    test('Test environment login and navigation', async ({ page }) => {
        await expect(page).toHaveURL(new RegExp(`${ROUTES.reports}$`));
        await expect(page.getByRole('button', { name: 'Ստեղծել' })).toBeVisible();
    });

    test.skip('Create Daily report', async () => {
        // TODO: implement Create Daily report flow once requirements are stable.
    });
});
