# Filter Dropdown Automation Helper

A production-ready Playwright utility for robust interaction with filter dropdowns, designed for stability, maintainability, and senior-level developer experience.

## Features

- **Exact Value Matching**: Prevents false positives from partial matches.
- **Custom Error Handling**: Structured `FilterDropdownError` with status context.
- **Performance Tracking**: Built-in duration measurement.
- **POM Ready**: Designed to be encapsulated in Page Objects.
- **TypeScript Support**: Full type definitions included.
- **Verification Logic**: Optional post-selection state verification.

## Installation

The helper files are located in `utils/filters/`. Simply import them into your test or Page Object.

```javascript
const { filterDropdown } = require('./utils/filters/filterDropdown');
```

## Basic Usage

```javascript
// Simple exact match selection
await filterDropdown(page, '19126142');
```

## Advanced Configuration

```javascript
const result = await filterDropdown(page, '19126142', {
  timeout: 15000,           // Wait up to 15s for popup
  searchDebounce: 1000,      // Wait 1s after typing for results to stabilize
  verifySelection: true,     // Ensure checkbox is checked before proceeding
  waitForClose: true,        // Wait for popup to disappear after submit
  forceClick: false          // Skip click if already checked
});

if (result.success) {
  console.log(`Successfully filtered in ${result.duration}ms`);
}
```

## Page Object Model Pattern

It is highly recommended to wrap filters in descriptive classes:

```javascript
class TerminalIdFilter {
  constructor(page) {
    this.page = page;
  }

  async apply(id) {
    // 1. Logic to open the filter popup
    // 2. Call helper
    return await filterDropdown(this.page, id);
  }
}
```

## Error Handling

The helper throws `FilterDropdownError` which contains:
- `step`: Where the failure happened (e.g., `EXACT_MATCH`, `VERIFY_SELECTION`).
- `timestamp`: ISO string of when error occurred.
- `originalError`: The underlying Playwright error if applicable.

## API Reference

### `filterDropdown(page, searchValue, options)`
Main function for single value selection.

### `filterDropdownMultiple(page, searchValues, options)`
Helper for selecting multiple items in one flow.

### `clearFilterDropdown(page)`
Utility to clear the search input in the visible dropdown.

---

*Authored by Antigravity - Advanced Agentic Coding Team*
