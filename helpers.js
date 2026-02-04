import { expect } from '@playwright/test';
import testData from './testData.json' assert { type: 'json' };

export const openDetailsSideSheet = async (page, rowIndex = 0) => {
    const tableBody = page.locator(
        '.transactions-wrapper__listing table tbody'
    );

    await expect(page.locator('.filter-popup.show')).toBeHidden({ timeout: 5000 });
    await expect(tableBody).toBeVisible({ timeout: 15000 });
    await expect(tableBody.locator('.react-loading-skeleton').first()).toBeHidden({ timeout: 30000 });
    const row = tableBody.locator('tr').nth(rowIndex);
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.click();
    const sideSheet = page.locator('.side-sheet__container');
    await expect(sideSheet).toBeVisible({ timeout: 15000 });
    await expect(
        sideSheet.locator('.side-sheet__content')
    ).toBeVisible();
    return sideSheet;
};

export const creationDateFilterRange = async (page, configKey = 'standardRange') => {
    const dateConfig = testData.creationDateFilters[configKey];
    if (!dateConfig) {
        throw new Error(`Date configuration '${configKey}' not found in testData.json`);
    }
    const creationDateFilter = page.locator('.filter-chip[data-filter-id="creationDate"]');
    await expect(creationDateFilter).toBeVisible({ timeout: 4000 });
    await creationDateFilter.click();
    const filterPopup = page.locator('.filter-popup.show');
    await expect(filterPopup).toBeVisible();
    const transactionStartDateInput = page.locator('input[name="transactionStartDate"]');
    const transactionEndDateInput = page.locator('input[name="trasnactionEndDate"]');
    await expect(transactionStartDateInput).toBeVisible();
    await transactionStartDateInput.fill(dateConfig.startDate);
    if (dateConfig.endDate) {
        const endDateVisible = await transactionEndDateInput.isVisible().catch(() => false);
        if (endDateVisible) {
            await transactionEndDateInput.fill(dateConfig.endDate);
        }
    }
    await transactionStartDateInput.press('Enter');
}

/**
 * Retrieves a value from the Side Sheet using semantic section and item indices.
 * 
 * @param {Locator} sideSheet - The side sheet container locator
 * @param {number} sectionIndex - The list-card index (typically 5 for details)
 * @param {number} itemIndex - The transaction-list-item index within the section
 * @returns {Promise<string>} The trimmed text value from the span element
 * @throws {Error} If the DOM structure is not found or values are missing
 */
export const getSideSheetValue = async (sideSheet, sectionIndex, itemIndex) => {
    const config = testData.sideSheet;
    const sectionIdx = typeof sectionIndex === 'string' ? config.sections[sectionIndex] : sectionIndex;
    const itemIdx = typeof itemIndex === 'string' ? config.items[itemIndex] : itemIndex;
    const cardPath = `${config.selectors.card}:nth-child(${sectionIdx})`;
    const itemPath = `${config.selectors.item}`;
    const valuePath = `${config.selectors.valueSpan}`;

    try {
        const value = await sideSheet
            .locator(config.selectors.content)
            .locator(cardPath)
            .locator(config.selectors.itemContainer)
            .locator(itemPath)
            .nth(itemIdx)
            .locator(valuePath)
            .textContent({ timeout: 15000 });

        if (!value) {
            throw new Error(
                `Side Sheet value is empty. ` +
                `Section: ${sectionIndex}, Item: ${itemIndex}. ` +
                `Selector path: ${cardPath} > ${itemPath}[${itemIndex}] > ${valuePath}`
            );
        }

        return value.trim();
    } catch (error) {
        try {
            const items = sideSheet
                .locator(config.selectors.content)
                .locator(cardPath)
                .locator(config.selectors.itemContainer)
                .locator(config.selectors.item);
            const count = await items.count();
            console.log(`Debug: Found ${count} items in section ${sectionIdx}:`);
            for (let i = 0; i < count; i++) {
                const text = await items.nth(i).innerText();
                console.log(` - Item ${i}: "${text.replace(/\n/g, ' ')}"`);
            }
        } catch (e) {
            console.log('Debug: Failed to log items:', e.message);
        }

        throw new Error(
            `Failed to retrieve Side Sheet value at section ${sectionIndex} (idx: ${sectionIdx}), item ${itemIndex} (idx: ${itemIdx}). ` +
            `Original error: ${error.message}`
        );
    }
}

export const resetFilters = async (page) => {
    const resetButton = page.locator('.filter-chip[data-filter-id="reset"]');
    const resetButtonExists = await resetButton.count() > 0;

    if (resetButtonExists) {
        await expect(resetButton).toBeVisible({ timeout: 5000 });
        await resetButton.click();
        await page.waitForTimeout(500);
    }
};

/**
 * Robustly retrieves a filter option from the .add-filter popup.
 * 
 * Waits for the popup to be visible, queries only within it, and matches label text
 * with trimming to avoid flakiness from hidden/detached DOM nodes in parallel execution.
 * 
 * @param {Page} page - The Playwright page object
 * @param {string} labelText - The label text to match (will be trimmed)
 * @returns {Locator} The filter item locator scoped to the visible .add-filter container
 */
export const getFilterByLabel = async (page, labelText) => {
    const addFilterPopup = page.locator('.add-filter');
    await expect(addFilterPopup).toBeVisible({ timeout: 5000 });
    const trimmedLabel = labelText.trim();
    return addFilterPopup.locator('.add-filter-list .add-filter-list__item', { hasText: new RegExp(`^${trimmedLabel}$`, 'i') });
};