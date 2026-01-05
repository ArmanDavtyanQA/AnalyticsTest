import { expect } from '@playwright/test';
import testData from './testData.json' assert { type: 'json' };

export const terminalIdFinder = async (n) => {
    return`.filter-popup__content .checked-list .checked-list__item:nth-child(${n}) label .controller__right`;
}

export const openDetailsSideSheet = async (page, rowIndex = 0) => {
    // 1. Ensure transactions table is rendered
    const tableBody = page.locator(
        '.transactions-wrapper__listing table tbody'
    );
    await expect(tableBody).toBeVisible({ timeout: 15000 });

    // 2. Click the ROW (not <p>, not text)
    const row = tableBody.locator('tr').nth(rowIndex);
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.click();

    // 3. Wait for side-sheet root container
    const sideSheet = page.locator('.side-sheet__container');
    await expect(sideSheet).toBeVisible({ timeout: 15000 });

    // 4. Optional: ensure content is loaded (recommended)
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
        await expect(creationDateFilter).toBeVisible({timeout: 4000});
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
    
    // Build selector path using constants
    const cardPath = `${config.selectors.card}:nth-child(${sectionIndex})`;
    const itemPath = `${config.selectors.item}`;
    const valuePath = `${config.selectors.valueSpan}`;
    
    try {
        const value = await sideSheet
            .locator(config.selectors.content)
            .locator(cardPath)
            .locator(config.selectors.itemContainer)
            .locator(itemPath)
            .nth(itemIndex)
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
        throw new Error(
            `Failed to retrieve Side Sheet value at section ${sectionIndex}, item ${itemIndex}. ` +
            `This may indicate the Side Sheet DOM structure has changed. ` +
            `Original error: ${error.message}`
        );
    }
}