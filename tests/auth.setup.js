import { test as setup, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { login, ROUTES } from '../pages/flows/auth.flow.js';

const STORAGE_STATE = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
    setup.setTimeout(120_000);
    await login(page);
    await expect(page).toHaveURL(new RegExp(`${ROUTES.dashboard}$`));

    // Ensure parent directories exist before writing storage state. The path is gitignored
    // and absent on fresh clones; some Playwright versions do not auto-create parent dirs,
    // so we create them explicitly to avoid an ENOENT failure that would block every test.
    await mkdir(path.dirname(STORAGE_STATE), { recursive: true });
    await page.context().storageState({ path: STORAGE_STATE });
});
