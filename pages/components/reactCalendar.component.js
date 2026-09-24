import { expect } from '@playwright/test';

/**
 * Date filter popup (creation date / settlement date) with a single react-calendar.
 *
 * Markup:
 *   .filter-popup.show
 *     input[name="transactionStartDate" | "settlementStartDate"]   Date from  (DD-MM-YYYY)
 *     input[name="trasnactionEndDate" | "settlementEndDate"]       Date to, range mode only
 *     .switcher input[type="checkbox"]            "Apply range" (checked = range mode)
 *     .react-calendar                             month tiles
 *     .filter-popup__footer button[type="submit"] Apply
 *
 * The date inputs are masked: `fill()` leaves the old value in place, so dates are typed.
 */

const POPUP = '.filter-popup.show';
const START_INPUTS = 'input[name="transactionStartDate"], input[name="settlementStartDate"]';
const END_INPUTS =
    'input[name="trasnactionEndDate"], input[name="transactionEndDate"], input[name="settlementEndDate"]';
const APPLY_BUTTON = /^(Apply|Կիրառել)$/;

/** Normalizes a `DD-MM-YYYY` / `DD/MM/YYYY` value to the input format (`DD-MM-YYYY`). */
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

const monthIndex = ({ month, year }) => year * 12 + month;

export class ReactCalendar {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
        this.root = page.locator(POPUP).filter({ has: page.locator(START_INPUTS) }).first();
    }

    /**
     * Opens a date filter chip and waits for the popup calendar.
     * @param {import('@playwright/test').Page} page
     * @param {string} filterId e.g. `creationDate`, `settlementDate`
     */
    static async openFromChip(page, filterId) {
        await page.locator(`.filter-chip[data-filter-id="${filterId}"]`).click();
        const calendar = new ReactCalendar(page);
        await calendar.expectVisible();
        return calendar;
    }

    /**
     * Waits for the date popup after "Add filter" → date option. Some builds only add
     * the chip without opening the popup; `chip` is clicked in that case.
     * @param {import('@playwright/test').Page} page
     * @param {import('@playwright/test').Locator} chip
     */
    static async waitForOpen(page, chip) {
        const calendar = new ReactCalendar(page);
        const openedByItself = await calendar.root
            .waitFor({ state: 'visible', timeout: 5_000 })
            .then(() => true, () => false);
        if (!openedByItself) {
            await chip.click();
        }
        await calendar.expectVisible();
        return calendar;
    }

    startInput() {
        return this.root.locator(START_INPUTS).first();
    }

    endInput() {
        return this.root.locator(END_INPUTS).first();
    }

    applyRangeCheckbox() {
        return this.root.locator('.switcher input[type="checkbox"], .controller--switch input[type="checkbox"]').first();
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

    navigationLabel() {
        return this.root.locator('.react-calendar__navigation__label__labelText').first();
    }

    /** Enabled day tile for a `DD-MM-YYYY` value in the displayed month. */
    dayTile(value) {
        const name = toCalendarAriaLabel(value);
        return this.root
            .locator(`.react-calendar__tile:not([disabled]):has(abbr[aria-label="${name}"])`)
            .first();
    }

    async expectVisible({ timeout = 15_000 } = {}) {
        await expect(this.root).toBeVisible({ timeout });
        await expect(this.startInput()).toBeVisible({ timeout });
    }

    async expectHidden({ timeout = 10_000 } = {}) {
        await expect(this.root).toBeHidden({ timeout });
    }

    /**
     * Turns "Apply range" on (Date from + Date to) or off (exact day).
     * @param {boolean} enabled
     */
    async ensureRangeMode(enabled) {
        const checkbox = this.applyRangeCheckbox();
        if ((await checkbox.isChecked()) !== enabled) {
            await this.applyRangeSwitcher().click();
        }
        if (enabled) {
            await expect(checkbox).toBeChecked();
            await expect(this.endInput()).toBeVisible();
        } else {
            await expect(checkbox).not.toBeChecked();
        }
    }

    /**
     * Types a date and reports whether the input kept it.
     * @param {import('@playwright/test').Locator} input
     * @param {string} value dd-MM-yyyy or dd/MM/yyyy
     */
    async typeDate(input, value) {
        const formatted = toCalendarInputDate(value);
        await expect(input).toBeVisible();
        await input.click();
        await input.press('Control+A');
        await input.press('Backspace');
        await input.pressSequentially(formatted, { delay: 30 });
        await input.blur();
        return (await input.inputValue()) === formatted;
    }

    /**
     * Reads the month/year currently shown on the single `.react-calendar`.
     * Prefers the nav label (`August 2026`); falls back to day aria-labels.
     * @returns {Promise<{ month: number, year: number }>}
     */
    async readDisplayedMonthYear() {
        const label = this.navigationLabel();
        const labelText = (await label.count()) ? (await label.innerText()).trim() : '';
        const fromLabel = Date.parse(`${labelText} 1`);
        if (!Number.isNaN(fromLabel)) {
            const d = new Date(fromLabel);
            return { month: d.getMonth() + 1, year: d.getFullYear() };
        }

        const labels = await this.root
            .locator('.react-calendar__tile:not(.react-calendar__month-view__days__day--neighboringMonth) abbr[aria-label]')
            .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') || ''));
        for (const ariaLabel of labels) {
            const m = ariaLabel.match(/^([A-Za-z]+) \d+, (\d{4})$/);
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
        const target = monthIndex(parseCalendarParts(value));
        const prev = this.root.locator('.react-calendar__navigation__prev-button');
        const next = this.root.locator('.react-calendar__navigation__next-button');

        for (let step = 0; step < 48; step++) {
            const current = monthIndex(await this.readDisplayedMonthYear());
            if (current === target) return;
            await (current > target ? prev : next).click();
            await expect
                .poll(async () => monthIndex(await this.readDisplayedMonthYear()), {
                    message: 'Calendar month did not change after clicking a navigation arrow',
                })
                .not.toBe(current);
        }
        throw new Error(`Calendar did not reach ${toCalendarInputDate(value).slice(3)} within 48 steps`);
    }

    /**
     * Selects a bound via typed input; falls back to month nav + day tile.
     * @param {string} value
     * @param {'start'|'end'} which
     */
    async selectBound(value, which) {
        const input = which === 'end' ? this.endInput() : this.startInput();
        if (await this.typeDate(input, value)) {
            return;
        }
        await this.navigateToMonth(value);
        await this.dayTile(value).click();
        await expect(input).toHaveValue(toCalendarInputDate(value));
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
            await expect(this.endInput()).toHaveValue(toCalendarInputDate(endDate));
        }
        await expect(this.startInput()).toHaveValue(toCalendarInputDate(startDate));
    }

    /**
     * Exact day: Apply range OFF, Date from only. Builds that keep Date to visible get
     * the same day in both inputs.
     * @param {string} dateOnly
     */
    async setExact(dateOnly) {
        await this.expectVisible();
        await this.ensureRangeMode(false);
        await this.selectBound(dateOnly, 'start');
        if (await this.endInput().isVisible()) {
            await this.selectBound(dateOnly, 'end');
        }
        await expect(this.startInput()).toHaveValue(toCalendarInputDate(dateOnly));
    }

    /** Clicks Apply and waits for the popup to close. */
    async apply() {
        const apply = this.applyButton();
        await expect(apply).toBeEnabled();
        await apply.click();
        await this.expectHidden();
    }
}
