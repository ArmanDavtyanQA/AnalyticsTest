import { expect } from '@playwright/test';
import testData from './testData.json' assert { type: 'json' };

export const terminalIdFinder = async (n) => {
    return`.filter-popup__content .checked-list .checked-list__item:nth-child(${n}) label .controller__right`;
}

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
        const transactionEndDateInput = page.locator('input[name="transactionEndDate"]');
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