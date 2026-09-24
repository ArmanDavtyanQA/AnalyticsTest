# SME Analytics Automation

Playwright end-to-end tests for the Ameriabank SME POS Analytics web app: Transactions filters and scheduled Reports on the shared test environment. `AGENTS.md` is the detailed briefing (product, DOM contracts, conventions, known gaps).

## Prerequisites

- Node.js 18 or newer
- Access to `https://sme-ecosystem-pos-analytics.test.ameriabank.am`

## Installation

```bash
npm install
npx playwright install chromium
```

Credentials come from `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` and `E2E_OTP_CODE`; `BASE_URL` overrides the environment.

## Running tests

Tests run one at a time (`workers: 1`) because the shared backend does not tolerate parallel load. Every run starts with the `setup` project, which signs in and saves `playwright/.auth/user.json`.

```bash
npm test                                         # everything
npx playwright test tests/Transaction-Filters.spec.js
npm run test:reports                             # the three Reports specs
npm run test:headed                              # watch the browser
npm run test:ui                                  # Playwright UI mode
npm run test:debug                               # step through with the inspector
npx playwright test --list                       # check that every file compiles
```

The Reports specs create real reports named `Autom … <timestamp>` and remove them in `afterAll`, even when a test fails. `Reports.z-cleanup.spec.js` (local only, skipped on CI) sweeps up anything left by interrupted runs.

## Project structure

```
.
├── fixtures/index.js          # test fixtures: request blocking, profile-verification handler, page objects
├── helpers.js                 # grid wait wrappers and DD-MM-YYYY date utilities
├── pages/
│   ├── components/            # page objects: filters, calendar, grids, side sheet, report wizard, sidebar
│   └── flows/                 # login, navigation, profile verification, report cleanup
├── tests/
│   ├── auth.setup.js          # signs in once and saves the storage state
│   ├── Transaction-Filters.spec.js
│   └── smeAnalytics/          # Reports, Reports-actions, Reports.z-cleanup
├── playwright.config.js
└── AGENTS.md
```

Selectors and UI copy live in `pages/components`; specs only describe scenarios. Filter values are read from the data the page shows (last 14 days), never hardcoded.

## Reports and artifacts

```bash
npm run test:report
```

The HTML report is written to `playwright-report/`. Traces, screenshots and videos of failed tests go to `test-results/`.
