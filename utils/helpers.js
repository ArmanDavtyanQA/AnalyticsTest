/**
 * Helper functions for Playwright tests
 */

/**
 * Wait for a specific amount of time
 * @param {number} ms - Milliseconds to wait
 */
async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Take a screenshot with timestamp
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} name - Screenshot name
 */
async function takeScreenshot(page, name) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-results/${name}-${timestamp}.png`;
    await page.screenshot({ path: filename, fullPage: true });
    return filename;
}

/**
 * Check if element is visible
 * @param {import('@playwright/test').Locator} locator - Element locator
 * @param {number} timeout - Timeout in milliseconds
 */
async function isElementVisible(locator, timeout = 5000) {
    try {
        await locator.waitFor({ state: 'visible', timeout });
        return true;
    } catch {
        return false;
    }
}

/**
 * Fill form field with retry
 * @param {import('@playwright/test').Locator} locator - Input locator
 * @param {string} value - Value to fill
 * @param {number} retries - Number of retries
 */
async function fillWithRetry(locator, value, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            await locator.clear();
            await locator.fill(value);
            return;
        } catch (error) {
            if (i === retries - 1) throw error;
            await wait(1000);
        }
    }
}

module.exports = {
    wait,
    takeScreenshot,
    isElementVisible,
    fillWithRetry,
};

