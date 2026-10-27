# P-06 — Custom reports

- **Status:** to discuss
- **Branch:** feat/custom-reports
- **Upstream:** maybe

## Why

The one thing the user would take from Actual: a report builder on top of the
transaction filters.

- Group by category, category group, payee or account, optionally split by a
  second of those.
- Measure spending, income or net; show it as a table, bar, line, area or donut,
  by month or year over a date range.
- Filter with the same conditions as the transaction list.
- Save it as a named card on the dashboard.

## Notes

Money already saves reports (`pages/reports.ts`: a name plus the page's range,
preset and comparison, synced in `money_settings`) and has a card dashboard. A
saved custom report would be one more card. Firefly's insight endpoints group by
category, tag, account or budget, which covers most single cuts; a second-level
split needs the transactions themselves. Groups depend on
[category groups](03-category-groups.md).
