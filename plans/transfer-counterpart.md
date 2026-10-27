# Transfers name the other account

- **Status:** to discuss
- **Branch:** feat/transfer-counterpart
- **Upstream:** maybe

## Why

Seen in Securo: a transfer row carries a "Transfer" label while its icon already
says it is a transfer. The user would rather the row said where the money went
or came from.

Money today (`core/feed.ts`): the row shows the transfer icon, the destination
name as the title, and a `Transfer` chip where a category would go.

## Idea discussed

In an account's view, show the counterpart: `→ Savings` on the leg going out and
`← Current account` on the leg coming in, instead of the generic chip. In the
all-accounts feed, `Current account → Savings`.
