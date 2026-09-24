export class Sidebar {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
        this.container = page.locator('.side-navigation');
    }

    /**
     * Collapses the navigation. The storageState can carry a persisted `--opened --pin`
     * preference that makes it overlap filter chips and the grids' sticky action cells.
     */
    async collapse() {
        await this.page.mouse.move(0, 0);
        await this.page.evaluate(() => {
            document.querySelectorAll('.side-navigation.side-navigation--opened').forEach((el) => {
                el.classList.remove('side-navigation--opened');
            });
        });
    }
}
