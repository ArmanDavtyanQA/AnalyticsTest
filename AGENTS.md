# Project briefing: SME POS Analytics — Playwright E2E automation

Use this as ground truth about the repository `autom`: the product under test, how the suite is built, the UI/DOM contracts it relies on, the conventions to keep, and known gaps. File, class and function names are exact.

## 1. Product and environment

- Product: Ameriabank "Ameria Business" SME ecosystem — POS analytics web app. Merchants see their POS terminal transactions, schedule e-mailed reports, and view analytics.
- Test environment: `https://sme-ecosystem-pos-analytics.test.ameriabank.am` (override with `BASE_URL`). Login happens on a separate auth app: `https://sme-ecosystem-auth-onboarding.test.ameriabank.am/auth/login`.
- React SPA. The UI language is switchable (Armenian / English, header selector); failure snapshots arrive in both languages. Every locator based on visible text must accept both.
- Data API: GraphQL at `https://sme-ecosystem.test.ameriabank.am/proxy/graphql`. The transactions grid query is `GetTransactions` (response `data.transaction.settled.{ items, totalCount, pageNumber, pageSize, totalPages }`, 20 rows per page). The default view (last 14 days) holds ~247k rows and answers in 0.2–4 s.
- The environment is shared and its data changes over time; tests must not assume fixed rows. In Sep 2026 the newest transactions were from 15-09-2026.
- Session: Keycloak (`auth-external.test.k8s.ameriabank.am`). The saved storage state holds a 5-minute access token; every page load silently fetches a fresh one while the SSO session lives. The SSO session dies after roughly 30–40 minutes idle; the app then redirects to the sign-in form before rendering anything. `goTo*` flows detect that and sign in again.

## 2. Stack, configuration, commands

- Node.js + `@playwright/test` 1.59, plain JavaScript with ESM `import` syntax everywhere, including `playwright.config.js` (Playwright transpiles; `package.json` has no `"type": "module"`).
- `playwright.config.js`:
  - `testDir: './tests'`, `workers: 1`, `fullyParallel: false` — the backend cannot handle parallel load; do not raise this.
  - Timeouts: test 240 s, expect 10 s, action 15 s, navigation 90 s. Retries: 1 locally, 2 on CI.
  - trace/video retain-on-failure, screenshot only-on-failure. The top-level viewport is 1440×900, but `devices['Desktop Chrome']` in the `chromium` project overrides it to 1280×720.
  - `testIdAttribute: 'data-id'` → `getByTestId('x')` means `[data-id="x"]`.
  - Projects: `setup` (`tests/auth.setup.js` logs in once, saves `playwright/.auth/user.json`) → `chromium` (reuses that storage state).
- Env vars: `BASE_URL`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`, `E2E_OTP_CODE` (test env code is `123456`), `CI` (retries 2, GitHub reporter, forbidOnly, skips the cleanup spec).
- Commands: `npm test`, `npm run test:headed`, `npm run test:ui`, `npm run test:debug`, `npm run test:report`, `npm run test:reports` (the three Reports files, `--grep @reports`), `npx playwright test tests/Transaction-Filters.spec.js`, `npx playwright test --list` (fast check that all files compile and imports resolve).

## 3. Repository map

| Path | Responsibility |
|---|---|
| `fixtures/index.js` | Extends `test`: request blocking (analytics trackers, the UXCam session recorder, media), the profile-verification locator handler on every page, and page-object fixtures `transactionsGrid`, `transactionFilters`, `sideSheet`, `reportsGrid`. `withSignedInPage(browser, testInfo, callback)` gives `afterAll` hooks a signed-in page. All specs import from here. |
| `helpers.js` | Thin: `waitForGridResponse`, `waitForGridToLoad`, `waitForReportsGridToLoad` (delegating to the grid page objects) and date utilities `parseDate`, `formatDate`, `addDays` (`DD-MM-YYYY`). |
| `pages/flows/auth.flow.js` | `ROUTES`, `TEST_USER`, `login()`, `fillOtp()`, `signInPasswordInput()`. |
| `pages/flows/navigation.flow.js` | `goToTransactions` (returns the default view's first page), `goToReports`, `goToArchivedReports`; sign-in recovery. |
| `pages/flows/profileVerification.flow.js` | `profileVerificationGate()` and `handleProfileVerification()` for the "verify your profile" lock and its OTP modal. |
| `pages/flows/reports.flow.js` | `removeReports(page, names)` — archive, then delete, skipping names that do not exist. |
| `pages/components/sidebar.component.js` | `Sidebar` — `container`, `collapse()`. |
| `pages/components/transactionFilters.component.js` | `TransactionFilters`, `FILTER_LABELS`, `UNIQUE_ID_TYPES`, `CHECKLIST_FILTERS` — filter bar, "Add filter" menu and every filter popup. |
| `pages/components/reactCalendar.component.js` | `ReactCalendar` — date filter popup (creation / settlement date). |
| `pages/components/transactionsGrid.component.js` | `TransactionsGrid`, `GRID_COLUMNS`, `parseGridAmount`, `cardNumberSeed`, `transactionsQueryVariables`. |
| `pages/components/transactionSideSheet.component.js` | `TransactionSideSheet`, `SIDE_SHEET_FIELDS` — transaction details panel. |
| `pages/components/createReportModal.component.js` | `CreateReportModal` (4-step wizard, `openButton`), `REPORT_FREQUENCY`, `REPORT_BY`, `REPORT_FILTERS`. |
| `pages/components/reportsGrid.component.js` | `ReportsGrid` — load wait, toggle, history, duplicate, archive, unarchive, delete. |
| `tests/auth.setup.js` | Login + storage state. |
| `tests/Transaction-Filters.spec.js` | 17 Transactions filter tests. |
| `tests/smeAnalytics/Reports.spec.js` | 7 tests: navigation + create 6 report variants. |
| `tests/smeAnalytics/Reports-actions.spec.js` | 7 serial, stateful row-action tests. |
| `tests/smeAnalytics/Reports.z-cleanup.spec.js` | 3 serial cleanup tests, skipped on CI. |

## 4. Architecture rules

- Specs (`tests/**`) hold scenario steps and assertions only.
- Flows (`pages/flows`) are journeys across pages (login, navigation, verification, report cleanup).
- Page objects (`pages/components`) own one UI area each: selectors, bilingual copy maps at the top of the file (`TEXT`, `*_LABELS`, `GRID_COLUMNS`), and intent-level methods (`filterByCardNumber()`, `activate()`, `getText()`).
- New UI knowledge belongs in a page object, never in specs or `helpers.js`. When frontend markup changes, fix the page object; specs should rarely change.
- Import direction: components import only `@playwright/test` and other components; flows import components and flows; `helpers.js` and `fixtures/index.js` sit on top. Nothing imports `helpers.js` except specs.

## 5. Application areas and the DOM they rely on

### 5.1 Login, OTP, profile verification
- `login(page)`: opens `/`; if not already on `/dashboard/`, fills email/password (e.g. `input[data-id="login-email-input"]`), clicks the login button, completes `/otp-verification-required` with `fillOtp()`. Ends on `/dashboard/applications-list`. A slow sign-in page can re-render between filling and submitting and send an empty form ("Պարտադիր լրացման դաշտ"); `login()` then fills and submits once more.
- OTP modal "Enter the code": `.modal__container` containing `.enter-verificationCode` / `.otp`; one `input[type="text"]` per digit (`max="1"`, not `maxlength`); Continue = `[data-id="enter-verification-code-continue-button"]`. The modal may submit by itself after the last digit (Continue turns `pointer-events-none`, then disappears), so `fillOtp()` clicks Continue only while the modal is still open.
- Profile verification lock (rare; Transactions, Reports, Analytics): `.empty-container` with "To unlock the page, verify your profile" / "Էջը տեսնելու համար անցեք նույնականացում" and button "Verify my profile" / "Նույնականացվել". The fixture registers `page.addLocatorHandler(profileVerificationGate(page), …)`, so `handleProfileVerification` runs automatically before any action or assertion the lock would block. Its time counts toward that step's timeout, which is why the first waits after navigation use 60–90 s.

### 5.2 Navigation and layout
- `ROUTES`: dashboard `/dashboard/applications-list`, transactions `/dashboard/transactions-reports`, reports `/dashboard/transactions-reports-builder`, archived reports `/dashboard/transactions-reports-builder-archive`, analytics `/dashboard/transactions-analytics`, OTP `/otp-verification-required`. POS terminals (`/dashboard/pos-terminals`) is in the sidebar but not automated.
- URL prefix trap: the transactions path is a prefix of the reports path, which is a prefix of the archive path. Compare URLs with anchored regexes (`ROUTES.reports + '$'`).
- `goTo*` flows deep-link with `page.goto(route, { waitUntil: 'domcontentloaded' })`, wait for `.side-navigation` or the sign-in password field, sign in again if needed, assert the URL, then `Sidebar.collapse()` (a persisted opened sidebar covers filter chips and sticky action cells) and wait for the page's grid. If nothing renders within 30 s, the route is opened once more: a failed download of the app bundle leaves a blank page, and a failed token check (401) makes the app stop on Keycloak's unconfirmed "Logging out — Do you want to log out?" page, where the SSO session is still valid.

### 5.3 Transactions page

Filter bar — `TransactionFilters`:
- Filters live in memory only (nothing in `persist:root`); every test starts from the default view: creation date = last 14 days, no other filter. `expectNoFilters(variables)` asserts that.
- Chips: `.filter-chip[data-filter-id="creationDate"]` (always present), `settlementDate` / `uniqueId` / `serialNumber` / … (after adding).
- "Clear filters" / "Ջնջել ֆիլտրերը" = `button.filters__reset`, always visible. `reset()` clicks it, waits for the query it sends (default dates, no filters) and asserts only the creation date chip is left.
- "Add filter" = `.filter-chip:not([data-filter-id])` → `.add-filter .add-filter-list__item`, picked by `FILTER_LABELS` (bilingual, anchored). Each filter opens `.filter-popup.show`; submit = `.filter-popup__footer button[type="submit"]`.
- Every `filterBy…()` method wraps its submit in `TransactionsGrid.waitForQuery(action, { match })`: it waits for the `GetTransactions` request whose variables carry that filter, reads the response, and waits until the table shows that page. A filter the UI drops fails there instead of passing on old rows. It returns `{ variables, items, totalCount }`.
- Popups and the variables they set:
  - Creation date → `filterByCreationDateRange(start, end)` (`transactionStartDate`, `trasnactionEndDate` — product typo, keep it), `filterByExactCreationDate(day)`. Dates are sent as `YYYY-MM-DDT00:00:00.000Z` for the picked local day; ranges include the end day through 23:59 local.
  - Settlement date → `filterBySettlementDate(day)` (`settlementStartDate`, `isExactSettlementDate: true`) or `filterBySettlementDate(start, end)` (`settlementEndDate` too, `isExactSettlementDate: false`). After "Add filter" the popup opens by itself, in exact mode.
  - Card number → `filterByCardNumber(lastFour)` (`cardNumber`; the UI asks for the last 4 digits).
  - Amount → `filterByExactAmount(n)` (`isExactAmount: true`, `amountStartRange`) and `filterByAmountRange(from, to)` (switcher reveals `amountEndRange`; `isExactAmount: false`).
  - Unique ID → `filterByUniqueId('AUTHORIZATION_CODE' | 'RRN_1' | 'RRN_2' | 'RRN_3', value)`: type select `.unique-id-filter__col .select__input` → portal `.select__option[id="authorizationCode" | "rRN1" | "rRN2" | "rRN3"]` (the id is also the query variable; labels are English-only), value `input[name="uniqueIdValue"]`. The selected option carries a check icon (`svg`); Authorization Code starts selected while the select shows no label, and clicking the selected option clears the type (see §9), so `selectUniqueIdType()` only clicks an unticked option.
  - Checklists (Terminal ID → `terminalIds`, Serial number → `serialNumbers`, Merchant name → `merchantNames`, Address → `addresses`) → `filterByChecklist(filter, value)`: search `.search input[name="search"]`, pick `.checked-list__item` whose `.controller__right .flexbox` text equals the value exactly (search also returns partial matches such as "… EREBUNI 2"). `filterByFirstChecklistEntry(filter)` ticks the first entry instead. The default query already lists all of the user's terminals in `terminalIds`.
- Date popup — `ReactCalendar`: start `input[name="transactionStartDate" | "settlementStartDate"]`, end `input[name="trasnactionEndDate" | "settlementEndDate"]` (range mode only), `.switcher` "Apply range" (checked = range), `.react-calendar` tiles (`abbr[aria-label="August 10, 2026"]`), Apply. The inputs are masked: `fill()` leaves the old value, so `typeDate()` selects all and types; `selectBound()` falls back to month navigation + day tile. In range mode a single tile click only starts a new range. API: `ReactCalendar.openFromChip(page, 'creationDate')`, `ReactCalendar.waitForOpen(page, chip)`, `setRange(start, end)`, `setExact(day)`, `apply()`.

Grid — `TransactionsGrid`:
- `.transactions-wrapper__listing .advanced-table table`. Columns can be dragged to reorder and resized; headers are sort buttons. Never locate cells by position (`nth-child`, `td.nth(n)`).
- Every cell has a stable id `{rowIndex}_{columnKey}`; keys (`GRID_COLUMNS`): `posType`, `merchantName`, `address`, `terminalId`, `creationDate`, `cardNumber`, `amount`. Text is in a `<p>` (`cellText()`). API: `cell(key, row)`, `getText(key, row)`, `getAmount(row)`, `firstUsableValue(key, { accept })`, `expectEveryRow(key, textOrRegexOrPredicate)`.
- Rows come newest first; all 20 rows of a page are rendered (no virtualization).
- Formats: date `DD-MM-YYYY` (`parseDate()`); amount `"750 AMD"`, integers without separators (`parseGridAmount()`); card `"5501xxxx8274"`, `"0xxxx0"` = no card (`cardNumberSeed()` returns the last 4 digits or `''`); POS type has trailing spaces (`"POS HDM   "`) — always trim.
- States: loading = visible `.react-loading-skeleton`; empty = `<p>` "Ցավոք, արդյունքներ չեն գտնվել" / "No results found" inside the table. `waitForLoad({ allowEmpty })` settles on whatever is shown; after an action that reloads the grid use `waitForQuery`.
- Footer `.advanced-table__footer`: page-size select (20), counter "1 - 20 / N", "Go to page", `ul.pagination`. Not automated yet.
- Clicking a row opens the details side sheet.

Transaction details side sheet — `TransactionSideSheet`:
- `.side-sheet__container .side-sheet__content`, rows `.transactions-list-card__item` (older builds `.list-card__item`). Row = label `<p>` + value `<p>` (copy button + text). Values read "null null" until the details load. Close = `[data-id="dismiss-svg-icon"]`.
- Field keys (`SIDE_SHEET_FIELDS`): `CREATION_DATE`, `SETTLEMENT_DATE` (`"15-09-2026 16:00"`), `AMOUNT`, `CARD_NUMBER`, `AUTHORIZATION_CODE`, `RRN_1`, `RRN_2`, `RRN_3`, `TERMINAL_ID` ("Տերմինալ ID"). The sheet has no serial number or address. Rows are matched by the label `<p>` only, because the row text also contains the value.
- API: `open(row)` (waits until details load), `getFieldValue(key)`, `dismiss()`, `findRowWith([keys])` (opens rows until one has every field populated; bounded by a time budget).

### 5.4 Reports (scheduled e-mail reports)
- Page: title "Հաշվետվություններ" / "Reports", button "Ստեղծել" / "Create" (`CreateReportModal.openButton`), icon link to the archive page.
- Grid (active and archived share markup): `.transactions-reports-wrapper table`; columns Name, Frequency, By (settlement / creation date), Expected date, Actions; cells `td[id$="_name"]`, `td[id$="_actions"]`. `ReportsGrid.waitForLoad()` (also `waitForReportsGridToLoad(page)`). The grid does not refresh after mutations, so `ReportsGrid` reloads and re-checks a bounded number of times, then asserts strictly. Rows are matched by exact name (`rowByName`).
- Row actions sit in a sticky right-pinned column (`prepareRowActions()` scrolls it into view, `clickLocatorCenter()` clicks the centre):
  1. Active switch `.controller--switch` (checkbox inside) → `.modal--confirmation` with "Activate/Ակտիվացնել" or "Deactivate/Ապաակտիվացնել".
  2. History icon button → side sheet with the History tab selected.
  3. 3-dot `button[data-id="more-icon-btn"]` → menu rendered in a portal `.select__options` (older `.menu-dropdown`) with `.select__option`: Duplicate / Archive on the active grid, Unarchive / Delete on the archived grid. Right after a reload the grid can re-render and swallow the click or close the menu, so `runMenuAction(name, option)` reopens it until that option shows (3 attempts). Archive confirms in `.modal--confirmation`; Unarchive and Delete confirm via `.modal__footer-inline button[type="submit"]`.
- Duplicate: review modal (`.reports-submit-review`, one `.report-details` card per section: title `<p>` + Edit button, then `.report-details__item` rows) → Edit on the "Basic / Հիմնական" card → rename in `input[name="name"]` → "Confirm change" → back on review → "Create".
- Create wizard — `CreateReportModal` (`.modal__container`, stepper "Քայլ N/4" / "Step N/4"; Continue and Create are the footer `button[type="submit"]`):
  1. Name `input[name="name"]`; recipient combobox `#email-input` → `.multi-textarea-chips__dropdown[role="listbox"] .multi-textarea-chips__dropdown-item`.
  2. Frequency Daily / Weekly / Monthly (text tabs) and "Report by" cards Settlement date / Creation date (text only, no stable class — clicked by label). Receiving day keeps its default.
  3. Optional filters: `.filter-chip[data-filter-id]` `1` Terminal ID, `2` Merchant name, `3` Address, `4` POS type (`REPORT_FILTERS`) → `.filter-popup__body .filter-popup__item .controller` → Apply.
  4. Review → Create; the modal closes.
  Usage: `new CreateReportModal(page).create({ name, email, frequency: REPORT_FREQUENCY.DAILY, reportBy: REPORT_BY.SETTLEMENT_DATE, filter: { id: REPORT_FILTERS.TERMINAL_ID, optionIndex: 0 } })`, then `reportsGrid.reload()` + `reportsGrid.expectInGrid(name)`.

### 5.5 Analytics
- `/dashboard/transactions-analytics`. Same date filter popup as Transactions (`ReactCalendar`). No flow or specs yet.

## 6. Test suites (35 tests including setup)

- `Transaction-Filters.spec.js` (17). `beforeEach`: `goToTransactions` returns the default view; it must be non-empty and carry no filters.
  - Creation date range → range ending the day before the newest row's day; every row's date inside it.
  - Creation date exact → marked `test.fail()` (product bug, see §9).
  - Settlement date exact / range → seed from a row's side sheet; check the first and last filtered rows' side sheets.
  - Card number, exact amount, amount range, Terminal ID, Merchant name, Address → seed from the grid; every visible row must match.
  - Authorization code → seed from the default view's API items; every returned item and the first/last rows' side sheets must match. RRN 1/2/3 → seed from a side sheet; check the first/last rows' side sheets.
  - Serial number → first checklist entry; asserts the query carries exactly that serial (coverage limit, see §9).
  - Reset → card filter, then reset restores the default query.
- `Reports.spec.js` (7): navigation; create Daily / Weekly / Monthly × Settlement / Creation date reports with a Terminal ID filter; assert the row appears. `afterAll` removes every report the file created.
- `Reports-actions.spec.js` (7, `mode: 'serial'`, names fixed per worker): activate → deactivate → history → duplicate & rename → archive both → unarchive both → archive and delete both. A failure skips the rest and a retry reruns the chain with new names; `afterAll` removes both reports whatever happened.
- `Reports.z-cleanup.spec.js` (3, serial, skipped when `CI` is set, 10 min timeout): sweeps every report titled with "Autom" left by interrupted runs from both grids and asserts none remain.

## 7. Test data rules

- No fixed dates or IDs. Seed every filter value from what the default view (last 14 days) shows: grid cells, the `GetTransactions` items returned by `goToTransactions`, or a row's side sheet for fields the grid lacks. Dates are computed from the newest row with `parseDate` / `addDays` / `formatDate`.
- Assert the filter on every visible row, not just the seed row. Prefer seeds that make an ignored filter visible (e.g. a date range that excludes the newest day).
- Reports are named `Autom … ${Date.now()}` — unique, and matched by the cleanup spec. Push the name to the spec's cleanup list before submitting; `afterAll` archives and deletes them through `withSignedInPage` + `removeReports`.

## 8. Conventions and Playwright practices

- Style: ESM imports, 4-space indent, single quotes, semicolons, trailing commas in multi-line literals, JSDoc on exported functions/classes, numeric separators (`90_000`). Comments explain why (constraints, backend behaviour), not what the next line does.
- Locator priority: stable attributes (`td[id$="_amount"]`, `input[name=…]`, meaningful `data-id` via `getByTestId`) → role + bilingual name (`getByRole('button', { name: /^(Create|Ստեղծել)$/ })`) → bilingual text → CSS classes. Many elements render empty `id=""` / `data-id=""`; those are not hooks.
- Visible copy is always a bilingual regex. Anchor it (`^…$`) only on the element holding exactly that text (e.g. a label `<p>`), never on a container.
- Scope locators to their owner (modal, popup, row). Portals and hidden duplicates exist: use `.filter({ visible: true })`, `.first()` / `.last()` deliberately.
- Web-first assertions; `expect.poll` for composite states; no fixed sleeps (`waitForTimeout`), no swallowed errors.
- Tie every grid wait to the action that causes it: `waitForQuery(action, { match })` for Transactions, `ReportsGrid.reload()` / `waitForLoad()` for Reports.
- Lagging server state (reports): bounded reload-and-recheck, then a strict assertion with a clear message.
- Log key steps with a prefix: `[ReportsGrid]`, `[ProfileVerification]`, `[Navigation]`, `[Login]`, `[Reports cleanup]`, `[Reports-cleanup]`.
- Error messages should name the likely cause (e.g. "No GetTransactions query for … was sent within 30s", "returned 0 rows for … seed the filter from rows the grid actually shows").

## 9. Current state and known gaps (24 Sep 2026)

- Product bug: an exact creation date (Apply range off) updates the chip but sends no `GetTransactions` query, so the grid keeps the previous rows. `Creation date filter with exact date` is marked `test.fail()`; remove the mark when the bug is fixed (Playwright then reports it as passing unexpectedly).
- Coverage limit: no transaction shows a serial number (not in the grid, not in the side sheet), so the serial filter test checks the query and rendering only. The first entries of the serial list have no transactions in the last 14 days; all 620 together match ~54k.
- Product bug: when `GET /proxy/api/Merchant/GetPersonEmails` fails (seen as a CORS error from a gateway error page), opening the Create report modal crashes the whole app to "Something went wrong — Reload Page" (`TypeError: T.map is not a function`). Tests fail on it and pass on retry; do not mask it.
- UX bug: the Unique ID type select shows an empty label although Authorization Code is selected; choosing "Authorization Code" then deselects it, and Apply silently does nothing (no query, popup stays open). The suite works around it in `selectUniqueIdType()`.
- Single-language strings: Unique ID type options are English-only in both UI languages.
- Test environment: outages happen (connection resets on the app bundle or GraphQL, whole `*.ameriabank.am` unreachable). Failures that name no query / a blank page / `net::ERR_*` are environmental; check reachability before debugging.
- Test user defaults are hardcoded in `auth.flow.js`; they should come from environment variables / CI secrets.
- Not covered: Analytics page, grid sorting / pagination / column reorder, POS type filter on Transactions, editing an existing report, weekly/monthly receiving-day selection, a full English-UI run.

## 10. How to write a change request for the coding agent

Include:
1. Goal — the behaviour or test to add or fix.
2. Scope — files or areas that may change, and anything that must not.
3. Evidence — failing test name and location, full error and call log, the Playwright page snapshot (ARIA YAML: roles and text, no classes) and/or the component's outerHTML when classes or attributes matter, and the UI language. The HTML report's "Copy prompt" output is ideal.
4. Acceptance — e.g. "`npx playwright test tests/Transaction-Filters.spec.js` passes".
5. Constraints — bilingual locators, no positional selectors, no fixed waits, selectors live in page objects, keep `workers: 1`, do not commit unless asked.

Typical landing spots: date popup → `reactCalendar.component.js`; filter bar, Add-filter menu and filter popups → `transactionFilters.component.js`; transactions table and query sync → `transactionsGrid.component.js`; details panel → `transactionSideSheet.component.js`; report wizard → `createReportModal.component.js`; report row actions and modals → `reportsGrid.component.js`; login/OTP → `auth.flow.js`; lock screen → `profileVerification.flow.js`; navigation and session recovery → `navigation.flow.js`; timeouts and parallelism → `playwright.config.js`.
