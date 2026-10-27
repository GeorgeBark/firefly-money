# P-07 — Investments, assets and wallets

- **Status:** to discuss
- **Branch:** to decide; probably mostly outside Money
- **Upstream:** no, as it needs storage Money does not have

## Why

From Securo the user likes assets (things whose value changes: property,
vehicles, investments) grouped in wallets, each with a value chart, its cost,
its value now and the gain. On top of that they want:

- **Contributions that look like contributions:** neutral (grey, or a pill) in
  lists, and a cumulative-contributions line under the value line in the chart,
  the gap being the gain.
- **More about the return:** money-weighted return (XIRR) as well as total
  gain; contributed and withdrawn to date; gain in amount and percent; return
  this year and per calendar year; time since the first contribution.
- **Every contribution names its source:** one of the user's accounts (a
  transfer, as Firefly books it) or an outside source such as a gift. Open: may
  outside money go straight in, or must it pass through an account first?

## What Firefly has

Contributions are transfers from another of the user's accounts and returns are
deposits and withdrawals in a returns category, so contributions, returns and
XIRR can be computed from Firefly today. Units and prices are not in Firefly:
market valuations need a store of their own, so this needs a server, which
Money does not have by design.

## Open questions

- Build it in the user's `firefly-sidecar` (a Firefly API sidecar with
  investment endpoints, sibling repo) and have Money read from it?
- What can be shown in Money with Firefly data alone (XIRR, contributions line)
  before any store exists?
