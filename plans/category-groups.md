# Category groups

- **Status:** to discuss
- **Branch:** feat/category-groups
- **Upstream:** maybe

## Why

The user liked category groups in Securo: a group has a name, icon, colour,
position and a hidden flag, and reports and budgets work at either level. Firefly
categories are flat; a category has a name, colour and notes, but no group field
(Firefly API, v6.7.9).

## Idea discussed

- Store the groups in a Firefly user preference (like `money_settings`), for
  example `money_category_groups`: groups and the category ids in each. It syncs
  between devices with no database of Money's own. Only Money understands it;
  Firefly and other tools keep seeing flat categories.
- Two levels everywhere: lists, reports and budgets show group totals that open
  into their categories. A category in no group falls into "Other".
- A preference is one JSON blob and the last write wins; fine for something
  edited rarely.

## Open questions

- Edited in Settings, or on the Categories page?
- Does a group also group budgets, or only categories?
