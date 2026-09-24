# Project briefing: SME POS Analytics — Playwright E2E automation

Use this as ground truth about the repository `autom`: the product under test, how the suite is built, the UI/DOM contracts it relies on, the conventions to keep, and known gaps. File, class and function names are exact.

## 1. Product and environment

- Product: Ameriabank "Ameria Business" SME ecosystem — POS analytics web app. Merchants see their POS terminal transactions, schedule e-mailed reports, and view analytics.
- Test environment: `https://sme-ecosystem-pos-analytics.test.ameriabank.am` (override with `BASE_URL`). Login happens on a separate auth app: `https://sme-ecosystem-auth-onboarding.test.ameriabank.am/auth/login`.
- React SPA. The UI language is switchable (Armenian / English, header selector); failure snapshots arrive in both languages. Every locator based on visible text must accept both.
- Data API: GraphQL at `/proxy/graphql`. The transactions grid query (`GetTransactions`) is slow: 20–45 s for wide date ranges (~247k rows in a recent snapshot).
- The environment is shared and its data changes over time; tests must not assume fixed rows.

## 2. Stack, configuration, commands

- Node.js + `@playwright/test` 1.59, plain JavaScript. Project files use ESM `import` syntax (Playwright transpiles; `package.json` has no `"type": "module"`). `utils/filters/*` is CommonJS.
- `playwright.config.js`:
  - `testDir: './tests'`, `workers: 1`, `fullyParallel: false` — the backend cannot handle parallel load; do not raise this.
  - Timeouts: test 240 s, expect 10 s, action 15 s, navigation 90 s. Retries: 1 locally, 2 on CI.
  - trace/video retain-on-failure, screenshot only-on-failure, viewport 1440×900.
  - `testIdAttribute: 'data-id'` → `getByTestId('x')` means `[data-id="x"]`.
  - Projects: `setup` (`tests/auth.setup.js` logs in once, saves `playwright/.auth/user.json`) → `chromium` (reuses that storage state). `ALL_BROWSERS=1` adds Firefox and WebKit.
- Env vars: `BASE_URL`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`, `E2E_OTP_CODE` (test env code is `123456`), `CI` (retries 2, GitHub reporter, forbidOnly, skips the cleanup spec), `ALL_BROWSERS`.
- Commands: `npm test`, `npm run test:headed`, `npm run test:ui`, `npm run test:debug`, `npm run test:report`, `npm run test:reports` (the three Reports files, `--grep @reports`), `npx playwright test tests/Transaction-Filters.spec.js`, `npx playwright test --list` (fast check that all files compile and imports resolve).

## 3. Repository map

| Path | Responsibility |
|---|---|
| `fixtures/index.js` | Extends `test` with request blocking (analytics trackers, media). All specs import `{ test, expect }` from here. |
| `helpers.js` | Shared helpers + re-exports: grid waits, filter helpers, side-sheet helpers, date parsing, `FILTER_LABELS`. Specs usually import from here. |
| `pages/flows/auth.flow.js` | `ROUTES`, `TEST_USER`, `login()`, `fillOtp()`. |
| `pages/flows/navigation.flow.js` | `goToDashboard`, `goToTransactions`, `goToReports`, `goToArchivedReports`, `goToAnalytics`, `collapseSidebar`. |
| `pages/flows/profileVerification.flow.js` | Detects and completes the "verify your profile" lock and its OTP modal. |
| `pages/components/sidebar.component.js` | `Sidebar` page object. |
| `pages/components/reactCalendar.component.js` | `ReactCalendar` — date filter popup (creation / settlement date). |
| `pages/components/transactionsGrid.component.js` | `TransactionsGrid`, `GRID_COLUMNS`, `parseGridAmount`, `cardNumberSeed` (new, not committed yet). |
| `pages/components/transactionSideSheet.component.js` | `TransactionSideSheet`, `SIDE_SHEET_FIELDS` — transaction details panel. |
| `pages/components/createReportModal.component.js` | `CreateReportModal` (4-step wizard), `REPORT_FREQUENCY`, `REPORT_BY`, `REPORT_FILTERS`, `expectReportInGrid()`. |
| `pages/components/reportsGrid.component.js` | `ReportsGrid` — toggle, history, duplicate, archive, unarchive, delete. |
| `tests/auth.setup.js` | Login + storage state. |
| `tests/Transaction-Filters.spec.js` | 16 Transactions filter tests. |
| `tests/smeAnalytics/Reports.spec.js` | 7 tests: navigation + create 6 report variants. |
| `tests/smeAnalytics/Reports-actions.spec.js` | 7 serial, stateful row-action tests. |
| `tests/smeAnalytics/Reports.z-cleanup.spec.js` | 3 serial cleanup tests, skipped on CI. |
| `testData.json` | Named date ranges (`DD-MM-YYYY`). |
| `utils/filters/filterDropdown.js` (+ `.d.ts`) | `filterDropdown()` for searchable checkbox-list filters. |
| `utils/filters/pageObjects.js`, `e2e.test.js`, `filterDropdown.test.js`, `EXACT_MATCHING_EXPLAINED.js` | Legacy examples outside `testDir`; never run, outdated selectors. |
| `helpers/grid.helper.js` | Empty file. |

## 4. Architecture rules

- Specs (`tests/**`) hold scenario steps and assertions only.
- Flows (`pages/flows`) are journeys across pages (login, navigation, verification).
- Page objects (`pages/components`) own one UI area each: selectors, bilingual copy maps at the top of the file (`TEXT`, `*_LABELS`, `GRID_COLUMNS`), and intent-level methods (`create()`, `activate()`, `getText()`).
- `helpers.js` holds cross-cutting waits and older functional helpers and re-exports page objects. New UI knowledge belongs in a page object, not in specs or `helpers.js`.
- When frontend markup changes, fix the page object; specs should rarely change.
- Import direction: `navigation.flow.js`, `createReportModal`, `reportsGrid` import `helpers.js`; `helpers.js` imports `reactCalendar`, `transactionsGrid`, `transactionSideSheet`, `profileVerification`. Never make `helpers.js` import a file that imports it (circular import).

## 5. Application areas and the DOM they rely on

### 5.1 Login, OTP, profile verification
- `login(page)`: opens `/`; if not already on `/dashboard/`, fills email/password (e.g. `input[data-id="login-email-input"]`), clicks the login button, completes `/otp-verification-required` with `fillOtp()`. Ends on `/dashboard/applications-list`.
- OTP modal "Enter the code": `.modal__container` containing `.enter-verificationCode` / `.otp`; one `input[type="text"]` per digit (`max="1"`, not `maxlength`); Continue = `[data-id="enter-verification-code-continue-button"]`.
- Profile verification lock (rare; Transactions, Reports, Analytics): `.empty-container` with "To unlock the page, verify your profile" / "Էջը տեսնելու համար անցեք նույնականացում" and button "Verify my profile" / "Նույնականացվել". `handleProfileVerification(page)` clicks it, enters the OTP, waits for the lock to clear, logs `[ProfileVerification]`. Every `goTo*` flow and both grid-wait polls already call it; new page flows must too.

### 5.2 Navigation and layout
- `ROUTES`: dashboard `/dashboard/applications-list`, transactions `/dashboard/transactions-reports`, reports `/dashboard/transactions-reports-builder`, archived reports `/dashboard/transactions-reports-builder-archive`, analytics `/dashboard/transactions-analytics`, OTP `/otp-verification-required`. POS terminals (`/dashboard/pos-terminals`) is in the sidebar but not automated.
- URL prefix trap: the transactions path is a prefix of the reports path, which is a prefix of the archive path. Compare URLs with anchored regexes (`ROUTES.reports + '$'`) or explicit exclusions, as `goToReports` does.
- `goTo*` flows deep-link with `page.goto(route, { waitUntil: 'domcontentloaded' })` (Transactions/Reports/Analytics fall back to dashboard + sidebar if the session bounced), then `collapseSidebar()` (a persisted opened sidebar covers the filter chips), `handleProfileVerification()`, and the page's grid wait.
- Sidebar: `.side-navigation`, links `.navigation-item__inner a`.

### 5.3 Transactions page

Filter bar:
- Chips: `.filter-chip[data-filter-id="creationDate"]` (always present), `[data-filter-id="settlementDate"]` (after adding), `[data-filter-id="reset"]` (clears filters). Applied filters persist between visits, so `beforeEach` calls `resetFilters()`.
- "Add filter" = `.filter-chip:not([data-filter-id])` → `.add-filter .add-filter-list .add-filter-list__item`. Use `selectFilterByLabel(page, FILTER_LABELS.X)`; keys: `SETTLEMENT_DATE`, `CREATION_DATE`, `CARD_NUMBER`, `AMOUNT`, `UNIQUE_ID`, `TERMINAL_ID`, `SERIAL_NUMBER`, `MERCHANT_NAME` ("ASC name" / "ԱՍԿ անվանում"), `ADDRESS`.
- Every filter opens `.filter-popup.show`; submit = `.filter-popup__footer button[type="submit"]`.
- Popup kinds:
  - Date → `ReactCalendar`: `input[name="transactionStartDate"]`, end `input[name="trasnactionEndDate"]` (product typo — keep it), `.switcher` "Apply range" toggles range vs single day, `.react-calendar` day tiles (`abbr[aria-label="August 10, 2026"]`), Apply. API: `ReactCalendar.openFromChip(page, 'creationDate')`, `ReactCalendar.waitForOpen(page, { chipText })`, `setRange(start, end)`, `setExact(day)`, `apply()`. Dates are `DD-MM-YYYY`.
  - Text inputs: card `input[name="cardNumber"]` (tests type the last 4 digits); amount `input[name="amountStartRange"]` plus a switcher that reveals `amountEndRange`; Unique ID: type select `.unique-id-filter__col .select__input` → `.select__options .select__option` ("Authorization Code", "RRN 1", "RRN 2", "RRN 3") and value `input[name="uniqueIdValue"]`.
  - Searchable checklists (Terminal ID, Serial number, Merchant name, Address) → `filterDropdown(page, value)`: types into `.search input[name="search"]`, waits for `.checked-list .checked-list__item` to stabilise, picks the item whose `.controller__right .flexbox` text exactly equals the value, checks it, submits, waits for close. Throws `FilterDropdownError` with `step` = `VISIBILITY_WAIT` | `SEARCH_RESULTS` | `EXACT_MATCH` | `UNEXPECTED`.
- Reload sync: start `waitForGridResponse(page)` before the click that reloads the grid, await it after, then `waitForGridToLoad(page)`. `submitVisibleFilterPopup()` and `applyDateFilter()` / `creationDateFilterRange()` already do this.

Grid — `TransactionsGrid`:
- `.transactions-wrapper__listing .advanced-table table`. Columns can be dragged to reorder and resized; headers are sort buttons. Never locate cells by position (`nth-child`, `td.nth(n)`).
- Every cell has a stable id `{rowIndex}_{columnKey}`; keys (`GRID_COLUMNS`): `posType`, `merchantName`, `address`, `terminalId`, `creationDate`, `cardNumber`, `amount`. Text is in a `<p>`. API: `grid.cell(key, row)`, `grid.getText(key, row)`, `grid.getAmount(row)`, `grid.firstUsableValue(key, { accept })`.
- Formats: date `DD-MM-YYYY` (`parseDate()`); amount `"750 AMD"` (`parseGridAmount()`); card `"5501xxxx8274"`, `"0xxxx0"` = no card (`cardNumberSeed()` returns last 4 digits or `''`); POS type has trailing spaces (`"POS HDM   "`) — always trim.
- States: loading = `.react-loading-skeleton` rows in `tbody`; empty = `<p>` "Ցավոք, արդյունքներ չեն գտնվել" / "No results found". `waitForGridToLoad(page, timeout, { allowEmpty })` returns `'data' | 'empty'` and throws on empty unless `allowEmpty: true`.
- Footer `.advanced-table__footer`: page-size select (20), counter "1 - 20 / N", "Go to page" input + button, `ul.pagination` (`li.active`, prev/next). Not automated yet.
- Clicking a row opens the details side sheet.

Transaction details side sheet — `TransactionSideSheet`:
- `.side-sheet__container .side-sheet__content`, rows `.transactions-list-card__item` (older builds `.list-card__item`). Row = label `<p>` + value `<p>` (copy button + `<span>`). Values load asynchronously and read "null null" until ready. Close = `[data-id="dismiss-svg-icon"]`.
- Field keys (`SIDE_SHEET_FIELDS`, bilingual label regexes): `CREATION_DATE`, `SETTLEMENT_DATE`, `AMOUNT`, `CARD_NUMBER`, `AUTHORIZATION_CODE`, `RRN_1`, `RRN_2`, `RRN_3`, `TERMINAL_ID`, `SERIAL_NUMBER`, `ADDRESS`. Rows are matched by the label `<p>` only, because the row text also contains the value.
- Helpers: `openDetailsSideSheet(page, row)` (waits until values populate), `getSideSheetValue(sheet, 'KEY')`, `getSideSheetFilterSeed(page, 'KEY')` (opens rows one by one until a usable value; slow, up to 12 rows), `dismissSideSheet(sheet)`.

### 5.4 Reports (scheduled e-mail reports)
- Page: title "Հաշվետվություններ" / "Reports", button "Ստեղծել" / "Create", icon link to the archive page.
- Grid (active and archived share markup): `.transactions-reports-wrapper table` (older: `.reports-table`); columns Name, Frequency, By (settlement / creation date), Expected date, Actions; cells `td[id$="_name"]`, `td[id$="_actions"]`. Wait with `waitForReportsGridToLoad(page)` — never `waitForGridToLoad` here. The grid does not refresh after mutations, so `ReportsGrid` reloads and re-checks a bounded number of times, then asserts strictly.
- Row actions sit in a sticky right-pinned column (`prepareRowActions()` scrolls it into view, `clickLocatorCenter()` clicks the centre):
  1. Active switch `.controller--switch` (checkbox inside) → `.modal--confirmation` with "Activate/Ակտիվացնել" or "Deactivate/Ապաակտիվացնել".
  2. History icon button → side sheet with the History tab selected.
  3. 3-dot `button[data-id="more-icon-btn"]` → menu rendered in a portal `.select__options` (older `.menu-dropdown`) with `.select__option`: Duplicate / Archive on the active grid, Unarchive / Delete on the archived grid. Archive confirms in `.modal--confirmation`; Unarchive and Delete confirm via `.modal__footer-inline button[type="submit"]`.
- Duplicate: review modal (`.reports-submit-review`) → edit "Basic / Հիմնական" → rename in `input[name="name"]` → "Confirm change" → back on review → "Create".
- Create wizard — `CreateReportModal` (`.modal__container`, stepper "Քայլ N/4" / "Step N/4"; Continue and Create are the footer `button[type="submit"]`):
  1. Name `input[name="name"]`; recipient combobox `#email-input` → `.multi-textarea-chips__dropdown[role="listbox"] .multi-textarea-chips__dropdown-item`.
  2. Frequency Daily / Weekly / Monthly (text tabs) and "Report by" cards Settlement date / Creation date (text only, no stable class — clicked by label). Receiving day keeps its default.
  3. Optional filters: `.filter-chip[data-filter-id]` `1` Terminal ID, `2` Merchant name, `3` Address, `4` POS type (`REPORT_FILTERS`) → `.filter-popup__body .filter-popup__item .controller` → Apply.
  4. Review → Create; the modal closes.
  Usage: `new CreateReportModal(page).create({ name, email, frequency: REPORT_FREQUENCY.DAILY, reportBy: REPORT_BY.SETTLEMENT_DATE, filter: { id: REPORT_FILTERS.TERMINAL_ID, optionIndex: 0 } })`, then `expectReportInGrid(page, name)`.

### 5.5 Analytics
- `/dashboard/transactions-analytics`. `goToAnalytics(page)` handles navigation and the verification lock. Same date filter popup as Transactions (`ReactCalendar`). No specs yet.

## 6. Test suites (34 tests including setup)

- `Transaction-Filters.spec.js` (16); `beforeEach`: `goToTransactions` + `resetFilters`.
  - Creation date range / exact → grid `creationDate` checked against the chosen dates.
  - Settlement date exact / range → seed from the side sheet, assert in the side sheet (not a grid column).
  - Card number → seed last 4 digits from the grid; exact amount / amount range → seed from the grid amount; assert in the grid.
  - Authorization code, RRN 1/2/3 → hardcoded IDs, assert in the side sheet.
  - Terminal ID, Merchant name, Address → seed from the grid column, `filterDropdown`, assert the same column.
  - Serial number → seed from the side sheet, assert in the side sheet.
- `Reports.spec.js` (7): navigation; create Daily / Weekly / Monthly × Settlement / Creation date reports with a Terminal ID filter; assert the row appears.
- `Reports-actions.spec.js` (7, `mode: 'serial'`, shared `reportName` / `duplicateName`): activate → deactivate → history → duplicate & rename → archive both → unarchive both → delete both. Stateful: run the whole file; a failure skips the rest, a retry reruns the chain.
- `Reports.z-cleanup.spec.js` (3, serial, skipped when `CI` is set, 10 min timeout): finds every report titled with "Autom" on both grids, archives the active ones, deletes the archived ones, asserts none remain. Named `z-cleanup` so it sorts after the other Reports files.

## 7. Test data rules

- `testData.json` → `creationDateFilters`: `standardRange` (01-12-2023 → 03-02-2026), `recentRange` (01-01-2026 → 30-06-2026), `currentYear`, `lastQuarter`, `lastMonth`, `exactDate`, `addressFilterRange`, `settlementDate`. Used via `creationDateFilterRange(page, 'recentRange')`.
- Prefer seed-from-data: apply a date range, read a real value from the grid (or side sheet if it is not a column), filter by it, assert the filtered rows.
- Only the Unique ID tests use hardcoded values (e.g. auth code `937065`); those transactions exist inside `standardRange`, so changing that range breaks them.
- Wide ranges make `GetTransactions` slow; use `recentRange` for checklist/text filters.
- Created reports are named `Autom … ${Date.now()}` — unique, and matched by the cleanup spec. Never derive a duplicate's name from its parent (rows are matched by exact name).

## 8. Conventions and Playwright practices

- Style: ESM imports, 4-space indent, single quotes, semicolons, trailing commas in multi-line literals, JSDoc on exported functions/classes, numeric separators (`90_000`). Comments explain why (constraints, backend behaviour), not what the next line does.
- Locator priority: stable attributes (`td[id$="_amount"]`, `input[name=…]`, meaningful `data-id`) → role + bilingual name (`getByRole('button', { name: /^(Create|Ստեղծել)$/ })`) → bilingual text → CSS classes. Many elements render empty `id=""` / `data-id=""`; those are not hooks.
- Visible copy is always a bilingual regex. Anchor it (`^…$`) only on the element holding exactly that text (e.g. a label `<p>`), never on a container.
- Scope locators to their owner (modal, popup, row). Portals and hidden duplicates exist: use `.filter({ visible: true })`, `.first()` / `.last()` deliberately.
- Web-first assertions; `expect.poll` for composite states; no fixed sleeps.
- Register `waitForResponse` before the action that triggers it.
- Lagging server state (reports): bounded reload-and-recheck, then a strict assertion with a clear message.
- Log key steps with a prefix: `[ReportsGrid]`, `[ProfileVerification]`, `[FilterSeed]`, `[Reports-cleanup]`, `[setup]`.
- Error messages should name the likely cause (see `EMPTY_STATE_ERROR` and the `waitForGridToLoad` poll message in `helpers.js`).

## 9. Current state and known gaps (24 Sep 2026)

- Uncommitted: `transactionsGrid.component.js` (new), plus `helpers.js` and `Transaction-Filters.spec.js` moved to id-based grid cells. `npx playwright test --list` passes; this refactor has not been run against the environment yet.
- Unused code: `takeScreenshot`, `isElementVisible`, `fillWithRetry`, `applyCreationDateExact`, `settlementDateFilterRange`, `getMerchantNameFromGrid`, `getGridCellText`, `Sidebar.expectActive`, `ReactCalendar.inPopup`, `ReactCalendar.clickDayByAriaLabel`. `filterDropdown`'s `searchDebounce` option is accepted but ignored.
- Dead/legacy: `helpers/grid.helper.js` (empty), the four legacy files in `utils/filters/`, outdated `README.md`.
- Single-language strings: `goToDashboard` asserts the Armenian header "Հայտերի պատմություն"; sidebar fallbacks use Armenian labels; Unique ID type options are matched in English.
- Test user defaults are hardcoded in `auth.flow.js`; they should come from environment variables / CI secrets.
- Not covered: Analytics page, grid sorting / pagination / column reorder, POS type filter on Transactions, editing an existing report, weekly/monthly receiving-day selection, a full English-UI run.

## 10. How to write a change request for the coding agent

Include:
1. Goal — the behaviour or test to add or fix.
2. Scope — files or areas that may change, and anything that must not.
3. Evidence — failing test name and location, full error and call log, the Playwright page snapshot (ARIA YAML: roles and text, no classes) and/or the component's outerHTML when classes or attributes matter, and the UI language. The HTML report's "Copy prompt" output is ideal.
4. Acceptance — e.g. "`npx playwright test tests/Transaction-Filters.spec.js` passes".
5. Constraints — bilingual locators, no positional selectors, no fixed waits, selectors live in page objects, keep `workers: 1`, do not commit unless asked.

Typical landing spots: date popup → `reactCalendar.component.js`; Add-filter menu and labels → `FILTER_LABELS` / `selectFilterByLabel` in `helpers.js`; checklist popups → `utils/filters/filterDropdown.js`; transactions table → `transactionsGrid.component.js` + `waitForGridToLoad`; details panel → `transactionSideSheet.component.js`; report wizard → `createReportModal.component.js`; report row actions and modals → `reportsGrid.component.js`; login/OTP → `auth.flow.js`; lock screen → `profileVerification.flow.js`; timeouts and parallelism → `playwright.config.js`.
