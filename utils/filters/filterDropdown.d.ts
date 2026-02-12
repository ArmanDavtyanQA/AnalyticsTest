import { Page, Locator } from '@playwright/test';

export interface FilterDropdownOptions {
    containerSelector?: string;
    timeout?: number;
    searchDebounce?: number;
    verifySelection?: boolean;
    waitForClose?: boolean;
    forceClick?: boolean;
}

export interface FilterResult {
    success: boolean;
    selectedValue: string;
    wasAlreadyChecked: boolean;
    duration: number;
}

export function filterDropdown(
    page: Page,
    searchValue: string,
    options?: FilterDropdownOptions
): Promise<FilterResult>;

export function filterDropdownMultiple(
    page: Page,
    searchValues: string[],
    options?: FilterDropdownOptions
): Promise<FilterResult[]>;

export function clearFilterDropdown(page: Page): Promise<void>;

export class FilterDropdownError extends Error {
    step: string;
    originalError: any;
    timestamp: string;
    constructor(message: string, step: string, originalError?: any);
}
