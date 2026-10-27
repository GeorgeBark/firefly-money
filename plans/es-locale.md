# Regional formats (locale)

- **Status:** discussed
- **Branch:** feat/locale
- **Upstream:** yes. Nothing in it is specific to this fork; it is also the
  first PR, to see how upstream takes contributions.

## Why

Money formats every amount and date as `en-US`. With a EUR Firefly the user sees
`€1,234.56` instead of `1.234,56 €`, month names in English, and US-style dates.
The currency itself is right: `S.currency` comes from Firefly's primary currency
(`core/lists.ts`). Only the formatting is hard-coded.

## What is there today (v1.4.0)

- `'en-US'` or `toLocale…` appears 10 times in 6 files: `core/base.ts`
  (`money()` and the month labels), `core/feed.ts`, `features/datepicker.ts`,
  `features/networth.ts`, `pages/loans.ts`, `pages/settings.ts`.
- Quick add (`features/nlparse.ts`) already accepts a comma decimal (`5,40`) but
  only strips `$`, not `€`, and its date words (`features/nldate.ts`) are
  English only (`today`, `yesterday`, weekdays).
- Loan plans are read from a `Monthly payment: $…` line in account notes
  (`PLAN_RE` in `core/lists.ts`), which only allows `$`.

## What to do

1. One place that decides the locale: a setting in Settings → Appearance (or
   Months & budgets) with "Automatic" as the default, which uses
   `navigator.language`. Store it in `SYNCED` so it follows the user between
   devices.
2. Route every number, currency and date format through helpers that use it
   (`money()`, the month labels, the other eight call sites). Cache the
   `Intl.NumberFormat`/`DateTimeFormat` objects per locale, as `fmtFor` already
   does per currency.
3. Week start for the calendar views from the locale (Monday in `es-ES`).
4. Quick add: accept the currency symbol of the primary currency, not only `$`,
   and both `,` and `.` as decimal separator according to the locale.
5. `PLAN_RE`: accept any currency symbol or none.
6. Tests in `test/` for the helpers and for quick-add amounts in `es-ES`.

Out of scope here: translating the interface (strings stay English) and Spanish
date words in quick add (`ayer`, `hoy`). Both could follow as separate plans.

## Open questions

- Setting in Appearance or in Months & budgets?
- Should the demo use a non-US locale to show it off?
