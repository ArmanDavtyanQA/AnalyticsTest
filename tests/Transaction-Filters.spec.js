import { test, expect } from '../fixtures/index.js';
import { parseDate, formatDate, addDays } from '../helpers.js';
import { goToTransactions } from '../pages/flows/navigation.flow.js';
import { ROUTES } from '../pages/flows/auth.flow.js';
import { GRID_COLUMNS, parseGridAmount, cardNumberSeed } from '../pages/components/transactionsGrid.component.js';
import { isSideSheetValuePopulated } from '../pages/components/transactionSideSheet.component.js';

/** Row indexes whose details are checked after a filter that only the side sheet can verify. */
const firstAndLastRow = ({ items }) => [...new Set([0, items.length - 1])];

test.describe('Filters', () => {
    /** @type {import('../pages/components/transactionsGrid.component.js').TransactionsPage} */
    let defaultView;

    test.beforeEach(async ({ page, transactionFilters }) => {
        defaultView = await goToTransactions(page);
        expect(defaultView.totalCount, 'the default Transactions view (last 14 days) is empty').toBeGreaterThan(0);
        transactionFilters.expectNoFilters(defaultView.variables);
    });

    test('Test environment login and navigation', async ({ page, transactionsGrid }) => {
        await expect(page).toHaveURL(new RegExp(`${ROUTES.transactions}$`));
        await expect(transactionsGrid.rows).toHaveCount(defaultView.items.length);
    });

    test('Creation date filter with date range', async ({ transactionsGrid, transactionFilters }) => {
        // Rows come newest first: ending the range before the newest day makes an ignored filter visible.
        const newest = parseDate(await transactionsGrid.getText(GRID_COLUMNS.CREATION_DATE));
        const start = addDays(newest, -3);
        const end = addDays(newest, -1);

        await transactionFilters.filterByCreationDateRange(formatDate(start), formatDate(end));

        await transactionsGrid.expectEveryRow(GRID_COLUMNS.CREATION_DATE, (text) => {
            const day = parseDate(text);
            return day >= start && day <= end;
        }, `within ${formatDate(start)} – ${formatDate(end)}`);
    });

    test('Creation date filter with exact date', async ({ transactionsGrid, transactionFilters }) => {
        test.fail(true, 'Product bug: applying an exact creation date updates the chip but sends no '
            + 'GetTransactions query, so the grid keeps the previous rows.');
        const newest = parseDate(await transactionsGrid.getText(GRID_COLUMNS.CREATION_DATE));
        const day = formatDate(addDays(newest, -1));

        await transactionFilters.filterByExactCreationDate(day);

        await transactionsGrid.expectEveryRow(GRID_COLUMNS.CREATION_DATE, day);
    });

    test('Settlement date filter with exact date', async ({ transactionFilters, sideSheet }) => {
        const { values } = await sideSheet.findRowWith(['SETTLEMENT_DATE']);
        const day = formatDate(parseDate(values.SETTLEMENT_DATE));

        const result = await transactionFilters.filterBySettlementDate(day);

        for (const row of firstAndLastRow(result)) {
            await sideSheet.open(row);
            const settlement = await sideSheet.getFieldValue('SETTLEMENT_DATE');
            expect(formatDate(parseDate(settlement)), `settlement date of row ${row}`).toBe(day);
            await sideSheet.dismiss();
        }
    });

    test('Settlement date filter with date range', async ({ transactionFilters, sideSheet }) => {
        const { values } = await sideSheet.findRowWith(['SETTLEMENT_DATE']);
        const end = parseDate(values.SETTLEMENT_DATE);
        const start = addDays(end, -1);

        const result = await transactionFilters.filterBySettlementDate(formatDate(start), formatDate(end));

        for (const row of firstAndLastRow(result)) {
            await sideSheet.open(row);
            const settlement = parseDate(await sideSheet.getFieldValue('SETTLEMENT_DATE'));
            expect(settlement.getTime(), `settlement date of row ${row}`).toBeGreaterThanOrEqual(start.getTime());
            expect(settlement.getTime(), `settlement date of row ${row}`).toBeLessThanOrEqual(end.getTime());
            await sideSheet.dismiss();
        }
    });

    test('Card number filter', async ({ transactionsGrid, transactionFilters }) => {
        const { value: card } = await transactionsGrid.firstUsableValue(GRID_COLUMNS.CARD_NUMBER, {
            accept: (text) => Boolean(cardNumberSeed(text)),
        });
        const lastFour = cardNumberSeed(card);

        await transactionFilters.filterByCardNumber(lastFour);

        await transactionsGrid.expectEveryRow(
            GRID_COLUMNS.CARD_NUMBER,
            (text) => text.replace(/\D/g, '').endsWith(lastFour),
            `ending in ${lastFour}`,
        );
    });

    test('Exact amount filter', async ({ transactionsGrid, transactionFilters }) => {
        const amount = await transactionsGrid.getAmount();
        expect(amount, 'grid amount cell is not numeric').toBeGreaterThan(0);

        await transactionFilters.filterByExactAmount(amount);

        await transactionsGrid.expectEveryRow(
            GRID_COLUMNS.AMOUNT,
            (text) => parseGridAmount(text) === amount,
            `equal to ${amount}`,
        );
    });

    test('Amount range filter', async ({ transactionsGrid, transactionFilters }) => {
        const amount = await transactionsGrid.getAmount();
        expect(amount, 'grid amount cell is not numeric').toBeGreaterThan(0);
        const low = Math.max(0, Math.floor(amount) - 10);
        const high = Math.ceil(amount) + 10;

        await transactionFilters.filterByAmountRange(low, high);

        await transactionsGrid.expectEveryRow(GRID_COLUMNS.AMOUNT, (text) => {
            const value = parseGridAmount(text);
            return value >= low && value <= high;
        }, `between ${low} and ${high}`);
    });

    test('Authorization Code UniqueID', async ({ transactionFilters, sideSheet }) => {
        const code = defaultView.items.map((item) => item.authorizationCode).find(isSideSheetValuePopulated);
        expect(code, 'no transaction on the first page has an authorization code').toBeTruthy();

        const result = await transactionFilters.filterByUniqueId('AUTHORIZATION_CODE', code);

        expect(result.items.map((item) => item.authorizationCode).filter((value) => value !== code),
            'authorization codes other than the filter value').toEqual([]);
        for (const row of firstAndLastRow(result)) {
            await sideSheet.open(row);
            expect(await sideSheet.getFieldValue('AUTHORIZATION_CODE'), `authorization code of row ${row}`).toBe(code);
            await sideSheet.dismiss();
        }
    });

    for (const rrn of ['RRN_1', 'RRN_2', 'RRN_3']) {
        test(`${rrn.replace('_', ' ')} UniqueID`, async ({ transactionFilters, sideSheet }) => {
            const { values } = await sideSheet.findRowWith([rrn]);

            const result = await transactionFilters.filterByUniqueId(rrn, values[rrn]);

            for (const row of firstAndLastRow(result)) {
                await sideSheet.open(row);
                expect(await sideSheet.getFieldValue(rrn), `${rrn} of row ${row}`).toBe(values[rrn]);
                await sideSheet.dismiss();
            }
        });
    }

    test('Terminal ID filter', async ({ transactionsGrid, transactionFilters }) => {
        const { value } = await transactionsGrid.firstUsableValue(GRID_COLUMNS.TERMINAL_ID);

        await transactionFilters.filterByChecklist('TERMINAL_ID', value);

        await transactionsGrid.expectEveryRow(GRID_COLUMNS.TERMINAL_ID, value);
    });

    test('Serial number filter', async ({ transactionFilters, sideSheet }) => {
        const { values } = await sideSheet.findRowWith(['SERIAL_NUMBER']);

        const result = await transactionFilters.filterByChecklist('SERIAL_NUMBER', values.SERIAL_NUMBER);

        expect(result.totalCount, `no transactions for serial ${values.SERIAL_NUMBER}`).toBeGreaterThan(0);
        for (const row of firstAndLastRow(result)) {
            await sideSheet.open(row);
            expect(await sideSheet.getFieldValue('SERIAL_NUMBER'), `serial number of row ${row}`)
                .toBe(values.SERIAL_NUMBER);
            await sideSheet.dismiss();
        }
    });

    test('Merchant name filter', async ({ transactionsGrid, transactionFilters }) => {
        const { value } = await transactionsGrid.firstUsableValue(GRID_COLUMNS.MERCHANT_NAME);

        await transactionFilters.filterByChecklist('MERCHANT_NAME', value);

        await transactionsGrid.expectEveryRow(GRID_COLUMNS.MERCHANT_NAME, value);
    });

    test('Address filter', async ({ transactionsGrid, transactionFilters }) => {
        const { value } = await transactionsGrid.firstUsableValue(GRID_COLUMNS.ADDRESS);

        await transactionFilters.filterByChecklist('ADDRESS', value);

        await transactionsGrid.expectEveryRow(GRID_COLUMNS.ADDRESS, value);
    });

    test('Reset filters restores the default view', async ({ transactionsGrid, transactionFilters }) => {
        const { value: card } = await transactionsGrid.firstUsableValue(GRID_COLUMNS.CARD_NUMBER, {
            accept: (text) => Boolean(cardNumberSeed(text)),
        });
        await transactionFilters.filterByCardNumber(cardNumberSeed(card));

        const restored = await transactionFilters.reset();

        transactionFilters.expectNoFilters(restored.variables);
        expect(restored.variables.transactionStartDate).toBe(defaultView.variables.transactionStartDate);
        expect(restored.variables.trasnactionEndDate).toBe(defaultView.variables.trasnactionEndDate);
    });
});
