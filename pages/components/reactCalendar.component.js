import { expect } from '@playwright/test';

/**
 * Transactions / Analytics date picker — filter popup with a single react-calendar.
 *
 * Markup:
 *   .filter-popup.show
 *     input[name="transactionStartDate"]          Date from  (DD-MM-YYYY)
 *     input[name="trasnactionEndDate"]            Date to    (product typo)
 *     .switcher input[type="checkbox"]            "Apply range"
 *     .react-calendar                             month tiles
 *     .filter-popup__footer button[type="submit"] Apply
 */

const POPUP = '.filter-popup.show, .filter-popup.filter-popup--medium.show, .filter-popup:visible';
const START_NAME = 'transactionStartDate';
const END_NAMES = 'input[name="trasnactionEndDate"], input[name="transactionEndDate"]';
const APPLY_RANGE_LABEL = /Apply range|Կիրառել միջակայքը/i;
const APPLY_BUTTON = /^(Apply|Կիրառել)$/;

/** Normalize testData / UI values to the input format (`DD-MM-YYYY`). */
export const toCalendarInputDate = (value) => {
    if (value == null || value === '') return '';
    return String(value).trim().replace(/\//g, '-');
};

/**
 * @param {string|null|undefined} value
 * @returns {{ day: number, month: number, year: number }}
 */
export const parseCalendarParts = (value) => {
    const formatted = toCalendarInputDate(value);
    if (!formatted) {
        throw new Error(`parseCalendarParts: expected a date string, got ${JSON.stringify(value)}`);
    }
    const [day, month, year] = formatted.split('-').map(Number);
    if (![day, month, year].every((n) => Number.isFinite(n))) {
        throw new Error(`parseCalendarParts: invalid date "${formatted}"`);
    }
    return { day, month, year };
};

/** Build react-calendar tile aria-label (`August 10, 2026`). */
export const toCalendarAriaLabel = (value) => {
    const { day, month, year } = parseCalendarParts(value);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });
};

/**
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} [root]
 */
export class ReactCalendar {
    constructor(page, root) {
        this.page = page;
        this.root = root
            ?? page.locator(POPUP).filter({
                has: page.locator(`input[name="${START_NAME}"]`),
            }).first();
    }

    /** Bind to an already-open date filter popup. */
    static inPopup(page, popup) {
        return new ReactCalendar(page, popup);
    }

    /**
     * Opens a date filter chip and waits for the popup calendar.
     * @param {import('@playwright/test').Page} page
     * @param {string} filterId e.g. `creationDate`, `settlementDate`
     */
    static async openFromChip(page, filterId) {
        const chip = page.locator(`.filter-chip[data-filter-id="${filterId}"]`);
        await expect(chip).toBeVisible({ timeout: 15_000 });
        await chip.click();
        const calendar = new ReactCalendar(page);
        await calendar.expectVisible();
        return calendar;
    }

    /**
     * Waits for the date popup after "Add filter" → date option.
     * Some date filters only add a chip; click the chip if the popup did not auto-open.
     * @param {import('@playwright/test').Page} page
     * @param {{ chipText?: string|RegExp }} [options]
     */
    static async waitForOpen(page, { chipText } = {}) {
        const calendar = new ReactCalendar(page);
        const opened = await calendar.root
            .waitFor({ state: 'visible', timeout: 5_000 })
            .then(() => true)
            .catch(() => false);
        if (!opened) {
            if (chipText) {
                const chip = page.locator('.filter-chip').filter({ hasText: chipText }).last();
                await expect(chip).toBeVisible({ timeout: 10_000 });
                await chip.click();
            }
            await calendar.expectVisible();
        } else {
            await expect(calendar.startInput()).toBeVisible({ timeout: 10_000 });
        }
        return calendar;
    }

    startInput() {
        return this.root.locator(`input[name="${START_NAME}"]`);
    }

    endInput() {
        return this.root.locator(END_NAMES).first();
    }

    applyRangeCheckbox() {
        return this.root.locator(
            '.switcher input[type="checkbox"], '
            + '.controller--switch input[type="checkbox"]',
        ).first();
    }

    applyRangeSwitcher() {
        return this.root.locator('.switcher, .controller--switch').first();
    }

    /** Footer Apply (`type="submit"`). */
    applyButton() {
        const footer = this.root.locator('.filter-popup__footer button[type="submit"]').first();
        const byName = this.root.getByRole('button', { name: APPLY_BUTTON });
        return footer.or(byName).first();
    }

    async expectVisible({ timeout = 15_000 } = {}) {
        await expect(this.root).toBeVisible({ timeout });
        await expect(this.startInput()).toBeVisible({ timeout });
    }

    async expectHidden({ timeout = 10_000 } = {}) {
        await expect(this.root).toBeHidden({ timeout });
    }

    /**
     * Ensures range mode (Date to visible) or exact mode (Apply range off).
     * @param {boolean} enabled
     */
    async ensureRangeMode(enabled) {
        const endVisible = async () => this.endInput().isVisible().catch(() => false);
        if ((await endVisible()) === enabled) {
            const checkbox = this.applyRangeCheckbox();
            if (await checkbox.count()) {
                const checked = await checkbox.isChecked().catch(() => null);
                if (checked === enabled) return;
            } else if (enabled) {
                return;
            }
        }

        const checkbox = this.applyRangeCheckbox();
        if (await checkbox.count()) {
            const checked = await checkbox.isChecked().catch(() => null);
            if (checked !== null && checked !== enabled) {
                await this.applyRangeSwitcher().click().catch(async () => {
                    await checkbox.setChecked(enabled, { force: true });
                });
            }
        } else {
            await this.root.getByText(APPLY_RANGE_LABEL).first().click().catch(() => { });
        }

        if (enabled) {
            await expect(this.endInput()).toBeVisible({ timeout: 8_000 });
            return;
        }

        await expect
            .poll(async () => endVisible(), {
                timeout: 8_000,
                message: 'Apply-range switcher did not hide the Date to input',
            })
            .toBe(false)
            .catch(() => { });
    }

    /**
     * @param {import('@playwright/test').Locator} input
     * @param {string} value dd-MM-yyyy or dd/MM/yyyy
     */
    async fillDate(input, value) {
        const formatted = toCalendarInputDate(value);
        await expect(input).toBeVisible();
        await input.click();
        await input.fill('');
        await input.fill(formatted);
        let committed = await input.inputValue().catch(() => '');
        if (committed !== formatted) {
            await input.press('Control+A');
            await input.press('Backspace');
            await input.pressSequentially(formatted, { delay: 30 });
            committed = await input.inputValue().catch(() => '');
        }
        await input.blur().catch(() => input.press('Tab').catch(() => { }));
        return (await input.inputValue().catch(() => '')) === formatted;
    }

    /**
     * Reads the month/year currently shown on the single `.react-calendar`.
     * Prefers the nav label (`August 2026`); falls back to day aria-labels.
     * @returns {Promise<{ month: number, year: number }>}
     */
    async readDisplayedMonthYear() {
        const labelText = (await this.root
            .locator('.react-calendar__navigation__label__labelText')
            .first()
            .innerText()
            .catch(() => '')).trim();
        const fromLabel = Date.parse(`${labelText} 1`);
        if (!Number.isNaN(fromLabel)) {
            const d = new Date(fromLabel);
            return { month: d.getMonth() + 1, year: d.getFullYear() };
        }

        const labels = await this.root
            .locator(
                '.react-calendar__tile:not(.react-calendar__month-view__days__day--neighboringMonth) abbr[aria-label]',
            )
            .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') || ''));
        for (const label of labels) {
            const m = label.match(/^([A-Za-z]+) \d+, (\d{4})$/);
            if (!m) continue;
            const month = new Date(`${m[1]} 1, 2000`).getMonth() + 1;
            return { month, year: Number(m[2]) };
        }
        throw new Error(`Could not read calendar month/year (nav label="${labelText}")`);
    }

    /**
     * Walks prev/next arrows until the month view shows the target month/year.
     * @param {string} value
     */
    async navigateToMonth(value) {
        const { month: targetMonth, year: targetYear } = parseCalendarParts(value);
        const targetIdx = targetYear * 12 + targetMonth;
        const prev = this.root.locator('.react-calendar__navigation__prev-button');
        const next = this.root.locator('.react-calendar__navigation__next-button');

        for (let step = 0; step < 48; step++) {
            const current = await this.readDisplayedMonthYear();
            const currentIdx = current.year * 12 + current.month;
            if (currentIdx === targetIdx) return;
            if (currentIdx > targetIdx) {
                await prev.click();
            } else {
                await next.click();
            }
            await this.page.waitForTimeout(120);
        }
        throw new Error(
            `Calendar did not reach ${String(targetMonth).padStart(2, '0')}-${targetYear} within 48 steps`,
        );
    }

    /**
     * Click a day tile by value when it is enabled/visible.
     * @param {string} value
     * @returns {Promise<boolean>}
     */
    async clickDay(value) {
        const name = toCalendarAriaLabel(value);
        const tile = this.root
            .locator(`.react-calendar__tile:not([disabled]):has(abbr[aria-label="${name}"])`)
            .first();
        if (await tile.isVisible().catch(() => false)) {
            await tile.click();
            return true;
        }
        const byRole = this.root.getByRole('button', { name, exact: true });
        if (await byRole.isEnabled().catch(() => false)
            && await byRole.isVisible().catch(() => false)) {
            await byRole.click();
            return true;
        }
        return false;
    }

    /**
     * @param {string} ariaLabel e.g. "August 10, 2026"
     */
    async clickDayByAriaLabel(ariaLabel) {
        const tile = this.root
            .locator('.react-calendar__tile:not([disabled])')
            .filter({ has: this.page.locator(`abbr[aria-label="${ariaLabel}"]`) })
            .first();
        await expect(tile).toBeVisible({ timeout: 10_000 });
        await tile.click();
    }

    /**
     * Selects a bound via typed input; falls back to month nav + day tile.
     * @param {string} value
     * @param {'start'|'end'} which
     */
    async selectBound(value, which) {
        const input = which === 'end' ? this.endInput() : this.startInput();
        if (await this.fillDate(input, value)) {
            return;
        }
        await this.navigateToMonth(value);
        if (await this.clickDay(value)) {
            return;
        }
        throw new Error(
            `Could not set ${which} date ${toCalendarInputDate(value)} `
            + '(typed value did not stick and the day tile was unavailable).',
        );
    }

    /**
     * Apply range ON, then Date from / Date to.
     * @param {string} startDate
     * @param {string} [endDate]
     */
    async setRange(startDate, endDate) {
        await this.expectVisible();
        await this.ensureRangeMode(true);
        await this.selectBound(startDate, 'start');
        if (endDate) {
            await this.selectBound(endDate, 'end');
            await expect(this.endInput()).toHaveValue(toCalendarInputDate(endDate), {
                timeout: 8_000,
            });
        }
        await expect(this.startInput()).toHaveValue(toCalendarInputDate(startDate), {
            timeout: 8_000,
        });
    }

    /**
     * Exact day: Apply range OFF (Date to hidden), Date from only.
     * If the switcher cannot hide Date to, fills start = end.
     * @param {string} dateOnly
     */
    async setExact(dateOnly) {
        await this.expectVisible();
        await this.ensureRangeMode(false);
        await this.selectBound(dateOnly, 'start');
        if (await this.endInput().isVisible().catch(() => false)) {
            await this.selectBound(dateOnly, 'end');
        }
        await expect(this.startInput()).toHaveValue(toCalendarInputDate(dateOnly), {
            timeout: 8_000,
        });
    }

    /** Clicks Apply and waits for the filter popup to close. */
    async apply() {
        if (!(await this.root.isVisible().catch(() => false))) {
            return;
        }
        const apply = this.applyButton();
        await expect(apply).toBeVisible({ timeout: 10_000 });
        if (!(await apply.isEnabled().catch(() => false))) {
            await this.startInput().press('Enter').catch(() => { });
            if (!(await this.root.isVisible().catch(() => false))) {
                return;
            }
        }
        await expect(apply).toBeEnabled({ timeout: 10_000 });
        await apply.click();
        await this.expectHidden();
    }
}
