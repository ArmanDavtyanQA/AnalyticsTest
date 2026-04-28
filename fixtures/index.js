import { test as base, expect } from '@playwright/test';

const BLOCK_HOST_PATTERNS = [
    /googletagmanager\.com/i,
    /google-analytics\.com/i,
    /googleads\./i,
    /doubleclick\.net/i,
    /hotjar\.com/i,
    /facebook\.net/i,
    /clarity\.ms/i,
    /segment\.io/i,
];

const BLOCK_RESOURCE_TYPES = new Set(['media']);

/**
 * Adds route blockers for third-party analytics and heavy media to speed up navigation
 * without affecting test logic. Fonts, images, and stylesheets are left alone because UI behaviour
 * (icons / role-based locators / domcontentloaded timing) often relies on them.
 *
 * @param {import('@playwright/test').BrowserContext | import('@playwright/test').Page} target
 */
export async function installRouteBlockers(target) {
    await target.route('**/*', (route) => {
        const request = route.request();
        const url = request.url();
        const type = request.resourceType();

        if (BLOCK_HOST_PATTERNS.some((re) => re.test(url))) {
            return route.abort();
        }

        if (BLOCK_RESOURCE_TYPES.has(type)) {
            return route.abort();
        }

        return route.continue();
    });
}

export const test = base.extend({
    context: async ({ context }, use) => {
        await installRouteBlockers(context);
        await use(context);
    },
});

export { expect };
