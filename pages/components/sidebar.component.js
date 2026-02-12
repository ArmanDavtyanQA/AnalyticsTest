import { expect } from '@playwright/test';

export class Sidebar {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
        this.container = page.locator('.side-navigation');
    }

    /**
     * Navigates to a menu item by its visible text.
     * @param {string} menuText
     */
    async navigate(menuText) {
        const link = this.container.locator('.navigation-item__inner a').filter({ hasText: menuText }).first();
        await expect(link).toBeVisible();
        await link.click();
    }

    /**
     * Navigates to a menu item by its href attribute.
     * @param {string} path
     */
    async navigateByHref(path) {
        const link = this.container.locator(`a[href="${path}"]`);
        await expect(link).toBeVisible();
        await link.click();
    }

    /**
     * Validates that a menu item is currently active.
     * @param {string} menuText
     */
    async expectActive(menuText) {
        const activeItem = this.container.locator('.navigation-item__inner.active');
        await expect(activeItem).toBeVisible();
        await expect(activeItem.locator('p')).toHaveText(menuText);
    }
}
