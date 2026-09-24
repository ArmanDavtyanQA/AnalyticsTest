import { expect } from '@playwright/test';
import { ReactCalendar, parseCalendarParts } from './reactCalendar.component.js';
import { TransactionsGrid } from './transactionsGrid.component.js';

/** Bilingual labels in the "Add filter" menu (hy / en). */
export const FILTER_LABELS = {
    SETTLEMENT_DATE: /^(Settlement date|Հաշվանցման ամսաթիվ)$/i,
    CREATION_DATE: /^(Creation date|Ստեղծման ամսաթիվ)$/i,
    CARD_NUMBER: /^(Card number|Քարտի համար)$/i,
    AMOUNT: /^(Amount|Գումար)$/i,
    UNIQUE_ID: /^(Unique ID|Ունիկալ ID)$/i,
    TERMINAL_ID: /^(Terminal ID|Տերմինալ ID)$/i,
    SERIAL_NUMBER: /^(Serial number|Սերիական համար)$/i,
    MERCHANT_NAME: /^(ASC name|Merchant name|ԱՍԿ անվանում)$/i,
    ADDRESS: /^(Address|Հասցե)$/i,
};

/**
 * Unique ID types by the `GetTransactions` variable each one sets, which is also the
 * `id` of its option in the type select.
 */
export const UNIQUE_ID_TYPES = {
    AUTHORIZATION_CODE: 'authorizationCode',
    RRN_1: 'rRN1',
    RRN_2: 'rRN2',
    RRN_3: 'rRN3',
};

/** Checklist filters (search + pick one value) and the list variable each one fills. */
export const CHECKLIST_FILTERS = {
    TERMINAL_ID: { label: FILTER_LABELS.TERMINAL_ID, variable: 'terminalIds' },
    SERIAL_NUMBER: { label: FILTER_LABELS.SERIAL_NUMBER, variable: 'serialNumbers' },
    MERCHANT_NAME: { label: FILTER_LABELS.MERCHANT_NAME, variable: 'merchantNames' },
    ADDRESS: { label: FILTER_LABELS.ADDRESS, variable: 'addresses' },
};

/** Variables that stay unset until the user applies a (non-date) filter. */
const SCALAR_FILTER_VARIABLES = [
    'amountStartRange', 'amountEndRange', 'cardNumber', 'authorizationCode',
    'rRN1', 'rRN2', 'rRN3', 'settlementStartDate', 'settlementEndDate',
];
const LIST_FILTER_VARIABLES = ['serialNumbers', 'merchantNames', 'addresses'];

/**
 * `YYYY-MM-DD` for a `DD-MM-YYYY` value. Date variables are sent as UTC midnight of
 * the picked day (`2026-09-10T00:00:00.000Z`), so the prefix identifies the day.
 */
const toQueryDate = (value) => {
    const { day, month, year } = parseCalendarParts(value);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const startsWithDay = (variable, day) => typeof variable === 'string' && variable.startsWith(toQueryDate(day));

const isSingleValueList = (list, value) =>
    Array.isArray(list) && list.length === 1 && String(list[0]) === String(value);

const exactText = (value) => new RegExp(`^${String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

/**
 * Filter bar above the transactions grid: date chips, the "Add filter" menu and the
 * popups behind it. Every `filterBy…` method waits for the `GetTransactions` query the
 * filter sends and for the grid to render it, then returns that page of data.
 */
export class TransactionFilters {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
        this.grid = new TransactionsGrid(page);
        this.addFilterChip = page.locator('.filter-chip:not([data-filter-id])');
        this.addFilterMenu = page.locator('.add-filter');
        this.clearButton = page.locator('button.filters__reset');
        // The creation date chip is always there; any other chip is a user filter.
        this.userFilterChips = page.locator('.filter-chip[data-filter-id]:not([data-filter-id="creationDate"])');

        this.popup = page.locator('.filter-popup.show').first();
        this.submitButton = this.popup.locator('.filter-popup__footer button[type="submit"]');
        this.cardNumberInput = this.popup.locator('input[name="cardNumber"]');
        this.amountFromInput = this.popup.locator('input[name="amountStartRange"]');
        this.amountToInput = this.popup.locator('input[name="amountEndRange"]');
        this.amountRangeSwitch = this.popup.locator('.switcher, .controller--switch').first();
        this.uniqueIdTypeSelect = this.popup.locator('.unique-id-filter__col .select__input');
        this.uniqueIdValueInput = this.popup.locator('input[name="uniqueIdValue"]');
        this.checklistSearch = this.popup.locator('.search input[name="search"]');
        this.checklistItems = this.popup.locator('.checked-list .checked-list__item');
    }

    /** Chip for an applied filter, by `data-filter-id` (`creationDate`, `settlementDate`). */
    chip(filterId) {
        return this.page.locator(`.filter-chip[data-filter-id="${filterId}"]`);
    }

    /**
     * Option of the Unique ID type select. The options render in a portal outside the popup.
     * @param {string} variable - a {@link UNIQUE_ID_TYPES} value
     */
    uniqueIdOption(variable) {
        return this.page.locator(`.select__options .select__option[id="${variable}"]`);
    }

    /**
     * Asserts a `GetTransactions` query carried no user filter (dates aside).
     * @param {Record<string, any>} variables
     */
    expectNoFilters(variables) {
        const applied = [
            ...SCALAR_FILTER_VARIABLES.filter((name) => variables[name] != null),
            ...LIST_FILTER_VARIABLES.filter((name) => variables[name]?.length),
        ];
        expect(applied, 'filters already applied to the Transactions query').toEqual([]);
    }

    /** Opens "Add filter" and picks an entry by its {@link FILTER_LABELS} label. */
    async add(label) {
        await this.addFilterChip.click();
        await expect(this.addFilterMenu).toBeVisible();
        await this.addFilterMenu.locator('.add-filter-list__item', { hasText: label }).click();
    }

    /** Submits the open popup and waits for the query it sends. */
    async submit(queryOptions) {
        await expect(this.submitButton).toBeEnabled();
        const result = await this.grid.waitForQuery(() => this.submitButton.click(), queryOptions);
        await expect(this.popup).toBeHidden();
        return result;
    }

    async filterByCreationDateRange(startDate, endDate) {
        const calendar = await ReactCalendar.openFromChip(this.page, 'creationDate');
        await calendar.setRange(startDate, endDate);
        return this.grid.waitForQuery(() => calendar.apply(), {
            match: (v) => startsWithDay(v.transactionStartDate, startDate)
                && startsWithDay(v.trasnactionEndDate, endDate),
            description: `creation date ${startDate} to ${endDate}`,
        });
    }

    async filterByExactCreationDate(date) {
        const calendar = await ReactCalendar.openFromChip(this.page, 'creationDate');
        await calendar.setExact(date);
        return this.grid.waitForQuery(() => calendar.apply(), {
            match: (v) => startsWithDay(v.transactionStartDate, date),
            description: `creation date ${date}`,
        });
    }

    /**
     * @param {string} startDate
     * @param {string} [endDate]
     * @param {{ range?: boolean }} [options] range mode even when both days are equal
     */
    async filterBySettlementDate(startDate, endDate = startDate, { range = startDate !== endDate } = {}) {
        await this.add(FILTER_LABELS.SETTLEMENT_DATE);
        const calendar = await ReactCalendar.waitForOpen(this.page, this.chip('settlementDate'));
        if (range) {
            await calendar.setRange(startDate, endDate);
        } else {
            await calendar.setExact(startDate);
        }
        return this.grid.waitForQuery(() => calendar.apply(), {
            match: (v) => startsWithDay(v.settlementStartDate, startDate)
                && (!range || startsWithDay(v.settlementEndDate, endDate)),
            description: `settlement date ${range ? `${startDate} to ${endDate}` : startDate}`,
        });
    }

    async filterByCardNumber(lastFour) {
        await this.add(FILTER_LABELS.CARD_NUMBER);
        await this.cardNumberInput.fill(lastFour);
        return this.submit({
            match: (v) => v.cardNumber === lastFour,
            description: `card number ending ${lastFour}`,
        });
    }

    async filterByExactAmount(amount) {
        await this.add(FILTER_LABELS.AMOUNT);
        await this.amountFromInput.fill(String(amount));
        return this.submit({
            match: (v) => v.isExactAmount === true && Number(v.amountStartRange) === amount,
            description: `exact amount ${amount}`,
        });
    }

    async filterByAmountRange(from, to) {
        await this.add(FILTER_LABELS.AMOUNT);
        await this.amountRangeSwitch.click();
        await expect(this.amountToInput).toBeVisible();
        await this.amountFromInput.fill(String(from));
        await this.amountToInput.fill(String(to));
        return this.submit({
            match: (v) => v.isExactAmount === false
                && Number(v.amountStartRange) === from
                && Number(v.amountEndRange) === to,
            description: `amount from ${from} to ${to}`,
        });
    }

    /**
     * @param {keyof typeof UNIQUE_ID_TYPES} type
     * @param {string} value
     */
    async filterByUniqueId(type, value) {
        const variable = UNIQUE_ID_TYPES[type];
        await this.add(FILTER_LABELS.UNIQUE_ID);
        await this.selectUniqueIdType(variable);
        await this.uniqueIdValueInput.fill(value);
        return this.submit({
            match: (v) => String(v[variable] ?? '') === value,
            description: `${type} ${value}`,
        });
    }

    /**
     * The type list marks the selected option with a check icon. Authorization Code starts
     * selected although the select shows no label, and clicking the selected option clears
     * the type, after which Apply does nothing.
     * @param {string} variable - a {@link UNIQUE_ID_TYPES} value
     */
    async selectUniqueIdType(variable) {
        const option = this.uniqueIdOption(variable);
        await this.uniqueIdTypeSelect.click();
        await expect(option).toBeVisible();
        if (await option.locator('svg').count() === 0) {
            await option.click();
        } else {
            // Escape leaves the list open; the select toggles it.
            await this.uniqueIdTypeSelect.click();
        }
        await expect(option).toBeHidden();
    }

    /**
     * Searches a checklist filter and ticks the item whose text equals `value` exactly
     * (search results also contain partial matches).
     * @param {keyof typeof CHECKLIST_FILTERS} filter
     * @param {string} value
     */
    async filterByChecklist(filter, value) {
        await this.add(CHECKLIST_FILTERS[filter].label);
        await this.checklistSearch.fill(value);
        const item = this.checklistItems
            .filter({ has: this.page.locator('.controller__right .flexbox', { hasText: exactText(value) }) })
            .first();
        return this.submitChecklistItem(filter, item, value);
    }

    /**
     * Ticks the first entry a checklist filter lists — for values the grid never shows.
     * @param {keyof typeof CHECKLIST_FILTERS} filter
     * @param {{ allowEmpty?: boolean }} [options]
     * @returns {Promise<import('./transactionsGrid.component.js').TransactionsPage & { value: string }>}
     */
    async filterByFirstChecklistEntry(filter, { allowEmpty = false } = {}) {
        await this.add(CHECKLIST_FILTERS[filter].label);
        const item = this.checklistItems.first();
        await expect(item).toBeVisible();
        const value = (await item.innerText()).trim();
        return { value, ...(await this.submitChecklistItem(filter, item, value, { allowEmpty })) };
    }

    async submitChecklistItem(filter, item, value, { allowEmpty = false } = {}) {
        const { variable } = CHECKLIST_FILTERS[filter];
        const checkbox = item.locator('input[type="checkbox"]');
        await expect(item).toBeVisible();
        // The styled checkbox sits under the label overlay; a native click bypasses the
        // pointer-interception check that makes Playwright's click retry until timeout.
        await checkbox.evaluate((input) => input.click());
        await expect(checkbox).toBeChecked();
        return this.submit({
            match: (v) => isSingleValueList(v[variable], value),
            description: `${filter} "${value}"`,
            allowEmpty,
        });
    }

    /** "Clear filters": drops every user filter and waits for the query that follows. */
    async reset() {
        const result = await this.grid.waitForQuery(() => this.clearButton.click(), {
            description: 'clearing the filters',
        });
        await expect(this.userFilterChips).toHaveCount(0);
        return result;
    }
}
