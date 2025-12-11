# SME Analytics Automation

Automation project using Playwright for end-to-end testing.

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browsers:
```bash
npx playwright install
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in headed mode (see browser)
```bash
npm run test:headed
```

### Run tests in debug mode
```bash
npm run test:debug
```

### Run tests with UI mode
```bash
npm run test:ui
```

### Run tests for specific browser
```bash
npm run test:chrome
npm run test:firefox
npm run test:webkit
```

### View test report
```bash
npm run test:report
```

## Project Structure

```
.
├── tests/              # Test files
│   ├── example.spec.js
│   └── search.spec.js
├── utils/              # Helper functions
│   └── helpers.js
├── playwright.config.js # Playwright configuration
├── package.json        # Project dependencies
└── README.md          # This file
```

## Configuration

Edit `playwright.config.js` to customize:
- Test directory
- Browser configurations
- Timeouts
- Screenshots and videos
- Reporters

## Writing Tests

Example test structure:

```javascript
const { test, expect } = require('@playwright/test');

test('my test', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example/);
});
```

## Test Reports

After running tests, view the HTML report:
```bash
npm run test:report
```

Reports are also saved in the `playwright-report/` directory.

## Screenshots and Videos

- Screenshots are taken on test failure (configured in `playwright.config.js`)
- Videos are saved for failed tests
- All artifacts are stored in `test-results/` directory

## CI/CD Integration

The project is configured to work with CI environments:
- Retries are enabled on CI
- Workers are limited to 1 on CI
- Trace collection is enabled for debugging

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
- [Best Practices](https://playwright.dev/docs/best-practices)

