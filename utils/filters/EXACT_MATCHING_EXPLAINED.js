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
