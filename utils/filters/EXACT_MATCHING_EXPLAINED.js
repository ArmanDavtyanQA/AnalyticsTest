/**
 * EXACT MATCHING EXPLAINED
 * 
 * This guide illustrates how the filterDropdown helper ensures we select 
 * exactly what we searched for, avoiding common pitfalls with partial matches.
 */

// --- SCENARIO 1: Exact Match Found ---
// Search Value: "19126142"
// Results in UI:
// 1. "19126142" <- [MATCH] .controller__right .flexbox text is "19126142"
// 2. "191261420"
// Action: Clicks Checkbox of Item 1.

// --- SCENARIO 2: Partial Match Found (Pitfall avoided) ---
// Search Value: "1912614"
// Results in UI:
// 1. "19126142"
// 2. "19126143"
// logic:
//   "19126142" === "1912614" ? No
//   "19126143" === "1912614" ? No
// Action: Throws FilterDropdownError("No item found matching search value '1912614'...")

// --- CODE IMPLEMENTATION SNIPPET ---
/*
for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    const valueText = (await item.locator('.controller__right .flexbox').textContent())?.trim();

    if (valueText === searchValue) {
        // EXACT MATCH FOUND
        await item.locator('input[type="checkbox"]').check();
        return;
    }
}
*/

// --- COMPARISON ---

const comparison = {
    before: {
        method: "page.locator('.checked-list__item').filter({ hasText: '1912' }).first().click()",
        result: "Might click '19126' instead of '1912'",
        risk: "HIGH - inconsistent test results"
    },
    after: {
        method: "await filterDropdown(page, '1912')",
        result: "Only clicks if text is exactly '1912'",
        risk: "ZERO - strictly deterministic"
    }
};

console.table(comparison);
