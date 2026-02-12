const { expect } = require('@playwright/test');

class FilterDropdownError extends Error {
    constructor(message, step, originalError = null) {
        super(message);
        this.name = 'FilterDropdownError';
        this.step = step;
        this.originalError = originalError;
        this.timestamp = new Date().toISOString();
    }
}

/**
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} searchValue - The exact text value to find and select
 * @param {Object} [options] - Configuration options
 * @returns {Promise<{success: boolean, selectedValue: string, wasAlreadyChecked: boolean, duration: number}>}
 */
async function filterDropdown(page, searchValue, options = {}) {
    const startTime = Date.now();
    const config = {
        containerSelector: '.filter-popup',
        timeout: 10000,
        searchDebounce: 1200,
        verifySelection: true,
        waitForClose: true,
        forceClick: false,
        ...options
    };

    try {
        // 1. Wait for popup visibility
        const container = page.locator(`${config.containerSelector}.show`).first();
        await container.waitFor({ state: 'visible', timeout: config.timeout })
            .catch(e => { throw new FilterDropdownError(`Filter popup did not become visible within ${config.timeout}ms`, 'VISIBILITY_WAIT', e); });

        // 2. Clear and fill search input
        const searchInput = container.locator('.search input[name="search"]');
        await searchInput.clear();
        await searchInput.fill(searchValue);

        // Wait for potential debounce/network filter
        await page.waitForTimeout(config.searchDebounce);

        // 3. Find exact match
        const items = container.locator('.checked-list .checked-list__item');
        const count = await items.count();

        if (count === 0) {
            throw new FilterDropdownError(`No results found after searching for "${searchValue}"`, 'SEARCH_RESULTS');
        }

        let targetItem = null;
        let wasAlreadyChecked = false;

        for (let i = 0; i < count; i++) {
            const item = items.nth(i);
            const valueElement = item.locator('.controller__right .flexbox');
            const valueText = (await valueElement.textContent())?.trim();

            if (valueText === searchValue) {
                targetItem = item;
                const checkbox = item.locator('input[type="checkbox"]');
                wasAlreadyChecked = await checkbox.isChecked();
                break;
            }
        }

        if (!targetItem) {
            throw new FilterDropdownError(`No item found matching search value "${searchValue}". Checked ${count} item(s) but none matched exactly.`, 'EXACT_MATCH');
        }

        // 4. Select the item
        if (!wasAlreadyChecked || config.forceClick) {
            // Using JS evaluate click is the most robust way to handle styled/hidden checkboxes 
            // that may be technically "outside the viewport" or obstructed according to Playwright.
            const checkbox = targetItem.locator('input[type="checkbox"]');
            await checkbox.evaluate(el => el.click());

            if (config.verifySelection) {
                // Wait a moment for UI state to update before verifying
                await page.waitForTimeout(600);
                const isChecked = await checkbox.isChecked();
                if (!isChecked) {
                    throw new FilterDropdownError(`Checkbox verification failed for value "${searchValue}" - selection did not persist after evaluate(click)`, 'VERIFY_SELECTION');
                }
            }
        }

        // 5. Submit filter
        const submitButton = container.locator('.filter-popup__footer button[type="submit"]');
        await expect(submitButton).toBeEnabled({ timeout: 5000 });
        await submitButton.click();

        // 6. Wait for close
        if (config.waitForClose) {
            await container.waitFor({ state: 'hidden', timeout: config.timeout });
        }

        return {
            success: true,
            selectedValue: searchValue,
            wasAlreadyChecked,
            duration: Date.now() - startTime
        };

    } catch (error) {
        if (error instanceof FilterDropdownError) throw error;
        throw new FilterDropdownError(error.message, 'UNEXPECTED', error);
    }
}

/**
 * Selects multiple values in a filter dropdown.
 * 
 * @param {import('@playwright/test').Page} page 
 * @param {string[]} searchValues 
 * @param {Object} [options] 
 */
async function filterDropdownMultiple(page, searchValues, options = {}) {
    const results = [];
    for (const value of searchValues) {
        // For multiple, we don't want to close until the last one, 
        // but typically this UI requires one search-click-search loop or bulk selection.
        // Assuming search-and-select flow:
        const result = await filterDropdown(page, value, { ...options, waitForClose: false });
        results.push(result);
    }

    // Finally submit manually if waitForClose was false
    const container = page.locator(`${options.containerSelector || '.filter-popup'}.show`).first();
    await container.locator('.filter-popup__footer button[type="submit"]').click();

    if (options.waitForClose !== false) {
        await container.waitFor({ state: 'hidden' });
    }

    return results;
}

/**
 * Clears the current search in the dropdown.
 * @param {import('@playwright/test').Page} page 
 */
async function clearFilterDropdown(page) {
    const container = page.locator('.filter-popup.show').first();
    const searchInput = container.locator('.search input[name="search"]');
    await searchInput.clear();
    await page.waitForTimeout(500);
}

module.exports = {
    filterDropdown,
    filterDropdownMultiple,
    clearFilterDropdown,
    FilterDropdownError
};
