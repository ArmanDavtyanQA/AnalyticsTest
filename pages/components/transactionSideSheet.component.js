import { expect } from '@playwright/test';

/** Row item — new builds use transactions-list-card__item; legacy used list-card__item. */
const ITEM =
    '.transactions-list-card__item, .list-card__item.transaction-list-item, .list-card__item';

/**
 * Known transaction-detail fields keyed for tests.
 * Each entry lists bilingual label text shown in the first `<p>` of the row item.
 */
export const SIDE_SHEET_FIELDS = {
    CREATION_DATE: /^(Creation Date|Ստեղծման ամսաթիվ)$/i,
    SETTLEMENT_DATE: /^(Settlement date|Հաշվանցման ամսաթիվ)$/i,
    AMOUNT: /^(Amount|Գումար)$/i,
    CARD_NUMBER: /^(Card number|Քարտի համար)$/i,
    AUTHORIZATION_CODE: /^(Authorization code|Հաստատման կոդ|Լիազորության կոդ)$/i,
    RRN_1: /^RRN 1$/i,
    RRN_2: /^RRN 2$/i,
    RRN_3: /^RRN 3$/i,
    TERMINAL_ID: /^(Terminal ID|Տերմինալի ID)$/i,
    SERIAL_NUMBER: /^(Serial number|Սերիական համար)$/i,
    ADDRESS: /^(Address|Հասցե)$/i,
};

/** @deprecated Numeric section/item pairs — map to {@link SIDE_SHEET_FIELDS} keys. */
const LEGACY_FIELD_MAP = {
    '1:3': 'SETTLEMENT_DATE',
    '1:1': 'TERMINAL_ID',
    '4:1': 'SERIAL_NUMBER',
    '3:2': 'ADDRESS',
    'DETAILS_CARD:AUTHORIZATION_CODE': 'AUTHORIZATION_CODE',
    'DETAILS_CARD:RRN_1': 'RRN_1',
    'DETAILS_CARD:RRN_2': 'RRN_2',
    'DETAILS_CARD:RRN_3': 'RRN_3',
    'DETAILS_CARD:TERMINAL_ID': 'TERMINAL_ID',
};

/** True when side-sheet text is a real value (not empty / literal "null null" / N/A). */
export const isSideSheetValuePopulated = (text) => {
    const trimmed = (text ?? '').trim();
    return (
        trimmed.length > 0
        && !/^(null\s*)+$/i.test(trimmed)
        && !/^n\/a$/i.test(trimmed)
    );
};

/** Usable as a filter-dropdown search seed (same rules as populated side-sheet values). */
export const isUsableFilterSeed = (text) => isSideSheetValuePopulated(text);

/** Resolves legacy (section, item) or (sectionKey, itemKey) to a {@link SIDE_SHEET_FIELDS} key. */
export function resolveSideSheetFieldKey(sectionOrField, itemKey) {
    if (itemKey === undefined || itemKey === null) {
        return sectionOrField;
    }
    const legacy = LEGACY_FIELD_MAP[`${sectionOrField}:${itemKey}`];
    if (legacy) {
        return legacy;
    }
    if (typeof itemKey === 'string' && SIDE_SHEET_FIELDS[itemKey]) {
        return itemKey;
    }
    throw new Error(
        `Unknown side-sheet field mapping for section=${sectionOrField}, item=${itemKey}. `
        + 'Use a SIDE_SHEET_FIELDS key (e.g. "SETTLEMENT_DATE") instead of numeric indices.',
    );
}

/**
 * Reads the visible value from a side-sheet row item.
 * Structure: label `<p>` + value `<p>` containing a copy button and a `<span>`.
 */
export async function readSideSheetItemValue(item) {
    const valueParagraph = item.locator('p').nth(1);
    const spanText = (await valueParagraph.locator('span').last().textContent().catch(() => '') ?? '').trim();
    if (isSideSheetValuePopulated(spanText)) {
        return spanText;
    }
    // Some builds render the value in a bare div (no span) after the copy button.
    const stripped = (await valueParagraph.evaluate((el) => {
        const clone = el.cloneNode(true);
        clone.querySelectorAll('button, .copy-icon').forEach((n) => n.remove());
        return (clone.textContent ?? '').trim();
    }).catch(() => '')).trim();
    if (isSideSheetValuePopulated(stripped)) {
        return stripped;
    }
    const full = (await item.innerText().catch(() => '')).trim();
    const lines = full.split('\n').map((l) => l.trim()).filter(Boolean);
    return lines.slice(1).join(' ').trim();
}

/**
 * Page object for the transaction details side sheet.
 */
export class TransactionSideSheet {
    /**
     * @param {import('@playwright/test').Locator} root - `.side-sheet__container`
     */
    constructor(root) {
        this.root = root;
        this.content = root.locator('.side-sheet__content');
    }

    /** Locator for a field row matched by its label `<p>` (hy/en). */
    fieldItem(fieldKey) {
        const labelPattern = SIDE_SHEET_FIELDS[fieldKey];
        if (!labelPattern) {
            throw new Error(`Unknown side-sheet field "${fieldKey}". Known: ${Object.keys(SIDE_SHEET_FIELDS).join(', ')}`);
        }
        // Match the label paragraph only — row-level hasText fails because the row
        // also contains the value (e.g. "Ստեղծման ամսաթիվ\n01-02-2026 23:58").
        return this.content
            .locator(ITEM)
            .filter({ has: this.content.locator('p', { hasText: labelPattern }) })
            .first();
    }

    /**
     * Waits for a field value to populate and returns it.
     * @param {keyof typeof SIDE_SHEET_FIELDS} fieldKey
     */
    async getFieldValue(fieldKey, { timeout = 15_000 } = {}) {
        const item = this.fieldItem(fieldKey);
        await expect
            .poll(async () => isSideSheetValuePopulated(await readSideSheetItemValue(item)), {
                timeout,
                message: `Side sheet field "${fieldKey}" did not populate.`,
            })
            .toBe(true);
        return readSideSheetItemValue(item);
    }

    async dismiss() {
        await this.root.locator('[data-id="dismiss-svg-icon"]').click();
        await expect(this.root).toBeHidden();
    }
}
