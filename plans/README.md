# Plans

One file per piece of work, numbered and named in kebab-case
(`01-es-locale.md`), with the same number in its title (`# P-01 — …`). Numbers
only identify a plan, they are not an order of work; they are never reused, and
a dropped plan keeps its number. Plans
live only on the `georgebark` branch and are committed on their own, never in
the same commit as code (see [CLAUDE.md](../CLAUDE.md#branches)).

Each plan starts with:

```markdown
# P-<nn> — <Title>

- **Status:** to discuss | discussed | in progress | merged into georgebark (vX.Y.Z-gb.N) | upstream PR #n | dropped
- **Branch:** feat/<name> or gb/<name>
- **Upstream:** worth a PR? yes / no / maybe, and why
```

Then: why the change is wanted, what it does, the decisions taken and their
reasons, and what is left. Keep the status line current as the work moves.

- **to discuss:** an idea the user has raised; not agreed yet. Talk it through
  with the user before planning code.
- **discussed:** agreed with the user; the plan says what to do.

This repo is public. Plans carry no personal data: no amounts, account names,
hostnames or addresses. The finance comparison that most of these plans come
from, with the user's real figures, lives in their private home-infra repo
(`docs/plans/finance-app-wishlist.md`).

## Index

| # | Plan | Status | Branch |
|---|---|---|---|
| P-01 | [Regional formats](01-es-locale.md) | discussed | feat/locale |
| P-02 | [Sign in through Cloudflare Access](02-cloudflare-access-auth.md) | to discuss | feat/cloudflare-access |
| P-03 | [Category groups](03-category-groups.md) | to discuss | feat/category-groups |
| P-04 | [Transfers name the other account](04-transfer-counterpart.md) | to discuss | feat/transfer-counterpart |
| P-05 | [Reports with one shape](05-reports-one-shape.md) | to discuss | — |
| P-06 | [Custom reports](06-custom-reports.md) | to discuss | feat/custom-reports |
| P-07 | [Investments, assets and wallets](07-investments.md) | to discuss | — |
| P-08 | [Dollar-cost averaging](08-dca.md) | to discuss (later) | — |
| P-09 | [Installment plans](09-installment-plans.md) | to discuss (later) | — |
| P-10 | [AI assistant](10-ai-assistant.md) | to discuss | — |
| P-11 | [Native mobile app](11-native-app.md) | to discuss | — |
