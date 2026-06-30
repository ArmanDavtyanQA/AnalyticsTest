// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const STORAGE_STATE = 'playwright/.auth/user.json';
const RUN_ALL_BROWSERS = !!process.env.ALL_BROWSERS;

module.exports = defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 1,
    // The shared test backend is slow: some filters require a wide date range whose
    // GetTransactions query takes ~45s. Running these concurrently overwhelms the env
    // and pushes navigations/queries past their timeouts. Serial execution keeps each
    // query within budget and is far more reliable here (at the cost of suite runtime).
    workers: 1,

    // A single test can legitimately chain navigation + a wide-range GetTransactions
    // (~45s) + a filtered reload (~45s). Under sustained serial load those queries
    // spike, so 180s left no margin and produced ~4 timeout failures per full run.
    // 240s absorbs that variance; the navigation/redundant-reload cleanups keep the
    // overall suite runtime in check.
    timeout: 240_000,
    expect: {
        timeout: 10_000,
    },

    reporter: process.env.CI
        ? [['github'], ['html', { open: 'never' }]]
        : [['list'], ['html', { open: 'never' }]],

    use: {
        baseURL: process.env.BASE_URL || 'https://sme-ecosystem-pos-analytics.test.ameriabank.am',
        testIdAttribute: 'data-id',
        actionTimeout: 15_000,
        navigationTimeout: 90_000,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        viewport: { width: 1440, height: 900 },
    },

    projects: [
        {
            name: 'setup',
            testMatch: /.*\.setup\.js/,
        },
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                storageState: STORAGE_STATE,
            },
            dependencies: ['setup'],
        },
        ...(RUN_ALL_BROWSERS
            ? [
                {
                    name: 'firefox',
                    use: {
                        ...devices['Desktop Firefox'],
                        storageState: STORAGE_STATE,
                    },
                    dependencies: ['setup'],
                },
                {
                    name: 'webkit',
                    use: {
                        ...devices['Desktop Safari'],
                        storageState: STORAGE_STATE,
                    },
                    dependencies: ['setup'],
                },
            ]
            : []),
    ],
});
