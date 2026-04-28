// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const STORAGE_STATE = 'playwright/.auth/user.json';
const RUN_ALL_BROWSERS = !!process.env.ALL_BROWSERS;

module.exports = defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 1,
    workers: process.env.CI ? 2 : 2,

    timeout: 90_000,
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
