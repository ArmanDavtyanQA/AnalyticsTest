const { expect } = require('@playwright/test');
const { filterDropdown } = require('./filterDropdown');

/**
 * Base class for all filter components using the shared dropdown UI.
 * Demonstrates how to encapsulate common filter logic.
 */
class BaseFilterComponent {
    constructor(page, label, containerSelector = '.filter-popup') {
        this.page = page;
        this.label = label;
        this.containerSelector = containerSelector;
        this.chip = page.locator('.filter-chip:not([data-filter-id])');
        this.activeFilterChip = page.locator('.filter-chip[data-filter-id]');
    }

    /**
     * Opens the filter popup by clicking the 'Add Filter' chip and selecting the label.
     */
    async open() {
        await expect(this.chip).toBeVisible({ timeout: 10000 });
        await this.chip.click();

        const filterOption = this.page.locator('.add-filter .add-filter-item').filter({ hasText: this.label });
        await expect(filterOption).toBeVisible();
        await filterOption.click();
    }

    /**
     * Generic filter method that uses the dropdown helper.
     * @param {string} value 
     */
    async filterByValue(value) {
        await this.open();
        return await filterDropdown(this.page, value, {
            containerSelector: this.containerSelector,
            verifySelection: true,
            waitForClose: true
        });
    }
}

/**
 * Specialized filter for Terminal ID.
 */
class TerminalIdFilter extends BaseFilterComponent {
    constructor(page) {
        super(page, 'Տերմինալ ID');
    }

    async filterByTerminalId(id) {
        console.log(`[POM] Filtering by Terminal ID: ${id}`);
        return await this.filterByValue(id);
    }
}

/**
 * Specialized filter for Status.
 */
class StatusFilter extends BaseFilterComponent {
    constructor(page) {
        super(page, 'Կարգավիճակ');
    }

    async filterByStatus(status) {
        console.log(`[POM] Filtering by Status: ${status}`);
        return await this.filterByValue(status);
    }
}

/**
 * Example Page Object for the Dashboard/Transactions page.
 */
class DashboardPage {
    constructor(page) {
        this.page = page;
        this.terminalIdFilter = new TerminalIdFilter(page);
        this.statusFilter = new StatusFilter(page);
        this.tableBody = page.locator('.transactions-wrapper__listing table tbody');
        this.skeleton = this.tableBody.locator('.react-loading-skeleton');
    }

    async navigate() {
        await this.page.goto('https://sme-ecosystem-pos-analytics.test.ameriabank.am/dashboard/applications-list');
    }

    async waitForTableLoaded() {
        await expect(this.tableBody).toBeVisible({ timeout: 15000 });
        await expect(this.skeleton.first()).toBeHidden({ timeout: 30000 });
    }
}

module.exports = {
    BaseFilterComponent,
    TerminalIdFilter,
    StatusFilter,
    DashboardPage
};
