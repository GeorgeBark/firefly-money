# Plans

One file per piece of work, named after it in kebab-case (`es-locale.md`). Plans
live only on the `georgebark` branch and are committed on their own, never in
the same commit as code (see [CLAUDE.md](../CLAUDE.md#branches)).

Each plan starts with:

```markdown
# <Title>

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

| Plan | Status | Branch |
|---|---|---|
| [Regional formats](es-locale.md) | discussed | feat/locale |
| [Sign in through Cloudflare Access](cloudflare-access-auth.md) | to discuss | feat/cloudflare-access |
| [Category groups](category-groups.md) | to discuss | feat/category-groups |
| [Transfers name the other account](transfer-counterpart.md) | to discuss | feat/transfer-counterpart |
| [Reports with one shape](reports-one-shape.md) | to discuss | — |
| [Custom reports](custom-reports.md) | to discuss | feat/custom-reports |
| [Investments, assets and wallets](investments.md) | to discuss | — |
| [Dollar-cost averaging](dca.md) | to discuss (later) | — |
| [Installment plans](installment-plans.md) | to discuss (later) | — |
| [AI assistant](ai-assistant.md) | to discuss | — |
| [Native mobile app](native-app.md) | to discuss | — |
