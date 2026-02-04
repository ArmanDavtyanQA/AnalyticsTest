import { Page, Locator } from '@playwright/test';

export interface FilterDropdownOptions {
    /** CSS Selector for the filter container. Default: '.filter-popup' */
    containerSelector?: string;
    /** Timeout in ms for visibility and submission. Default: 10000 */
    timeout?: number;
    /** Wait duration after filling search to allow UI to filter results. Default: 800 */
    searchDebounce?: number;
    /** If true, re-verifies that the checkbox is actually checked after interaction. Default: true */
    verifySelection?: boolean;
    /** If true, waits for the popup to disappear after clicking submit. Default: true */
    waitForClose?: boolean;
    /** If true, clicks the item even if it appears already checked. Default: false */
    forceClick?: boolean;
}

export interface FilterResult {
    /** True if the operation completed without errors */
    success: boolean;
    /** The value that was searched and selected */
    selectedValue: string;
    /** True if the item was already checked before interaction */
    wasAlreadyChecked: boolean;
    /** Total duration of the operation in milliseconds */
    duration: number;
}

/**
 * Robust Playwright helper for automating filter dropdown interactions with exact value matching.
 */
export function filterDropdown(
    page: Page,
    searchValue: string,
    options?: FilterDropdownOptions
): Promise<FilterResult>;

/**
 * Selects multiple values in a filter dropdown.
 */
export function filterDropdownMultiple(
    page: Page,
    searchValues: string[],
    options?: FilterDropdownOptions
): Promise<FilterResult[]>;

/**
 * Clears the current search in the dropdown.
 */
export function clearFilterDropdown(page: Page): Promise<void>;

/**
 * Custom error class for Filter Dropdown operations.
 */
export class FilterDropdownError extends Error {
    step: string;
    originalError: any;
    timestamp: string;
    constructor(message: string, step: string, originalError?: any);
}
