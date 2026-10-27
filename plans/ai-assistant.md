# AI assistant

- **Status:** to discuss
- **Branch:** to decide; needs a server
- **Upstream:** no (upstream's "Ask" deliberately uses no AI)

## Why

Seen in Sure: a chat assistant that answers questions about the user's money by
calling about 40 functions (read and write), LLM auto-categorisation and
merchant detection, PDF statement import, and an MCP endpoint.

## What Firefly offers

Almost all of it is covered by Firefly's API: accounts, transactions and search,
categories, tags, budgets and limits, bills, recurrences, piggy banks, rules,
and summaries (`/summary/basic`, `/insight/*`). Not in Firefly: holdings and
prices, valuations, PDF import. Auto-categorisation could hang off a Firefly
webhook on new transactions.

## To decide

- Needs a server: the model's key cannot live in the browser.
- Writes: a Firefly token has full access and no read-only scope, so a
  read-only assistant must be restricted in front of Firefly, and a writing one
  should confirm each change.
- Cloud model (data leaves home) or a local one (Ollama).
