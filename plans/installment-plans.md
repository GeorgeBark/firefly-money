# Installment plans

- **Status:** to discuss (later, not in the first version)
- **Branch:** to decide
- **Upstream:** maybe

## Why

Seen in WYGIWYH: a purchase paid in instalments creates its future payments, so
upcoming instalments show before they are charged. Firefly's closest feature is
bills, which track a recurring amount but not a plan with a fixed number of
payments.

## To work out

Where the plan lives (Firefly recurring transactions with an end date, account
notes like loan plans, or a preference) and how a charged instalment is matched
to its plan.
