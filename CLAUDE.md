# firefly-money (GeorgeBark fork) — agent instructions

This is GeorgeBark's fork of [Muffy0906/firefly-money](https://github.com/Muffy0906/firefly-money),
the Money front end for Firefly III. The fork runs the user's own build on their
homelab and is where changes are developed before, or instead of, going upstream.

This file and `plans/` exist only on the `georgebark` branch. Agents working in a
worktree of another branch read this file through a symlink in the worktree's
parent directory (see [Worktrees](#worktrees)).

## Branches

| Branch | Starts from | Holds | Goes to |
|---|---|---|---|
| `main` | — | an exact mirror of `upstream/main`, never a commit of ours | — |
| `feat/<name>` | `main` | one change, code only | merged into `georgebark`; optionally a PR upstream |
| `gb/<name>` | `georgebark` | a change that only makes sense for this fork | merged into `georgebark` |
| `georgebark` | — | the default branch: `main` + our merged changes + `plans/` + this file | tagged and deployed |

Rules:

- **Upstream-worthy work goes on `feat/*` from `main`.** That branch is
  what a pull request to Muffy0906 would be, so it must never contain `plans/`,
  this file, `AGENTS.md` or `.github/workflows/georgebark.yml`.
- **Bring a branch into `georgebark` with a merge** (`git merge --no-ff`), never
  a cherry-pick. A `feat/*` branch may be rebased onto `main` while it is open; `georgebark` and its tags are never rewritten.
- **Never mix `plans/` and code in one commit.**
- **Sync with upstream:** `git fetch upstream`, fast-forward `main` to
  `upstream/main` and push it to `origin`, then merge `main` into `georgebark`.
  Sync before starting a `feat/*` branch, so it starts from upstream's latest.
- Do not push to `upstream`. Opening a pull request upstream is the user's call.

## Plans

`plans/` holds one Markdown file per piece of work: what it is for, the branch
it lives on, its status, and the decisions taken. Start every non-trivial change
by writing or updating its plan, and keep the status current. See
[plans/README.md](plans/README.md).

## Worktrees

Orca creates worktrees under `~/orca/workspaces/firefly-money/<name>`, on a
`feat/<name>` branch, with `origin/main` (this fork's `main`) as the default
base ref for this repo. That directory holds
symlinks `CLAUDE.md` and `AGENTS.md` to this checkout's copies
(`/Users/bark/developer/projects/firefly-money`), so an agent in any worktree
finds these instructions. Plans are read and written in that main checkout, on
`georgebark`, not in the feature worktree.

### Starting work on a plan

The flow is always: review the plan in the main checkout, then launch the agent
that implements it from there. The agent in the main checkout (on `georgebark`)
talks plans through with the user and keeps `plans/` current. It launches an
implementing agent only when the user has reviewed the plan and asks for it to
start. Then:

1. Sync `main` (see [Branches](#branches)) and set the plan's status to
   `in progress`, with its branch, in a plans-only commit.
2. Create the worktree with an agent in it through the Orca CLI:

   ```sh
   orca worktree create --repo path:/Users/bark/developer/projects/firefly-money \
     --name locale --agent claude \
     --prompt "Implement P-01. The plan is /Users/bark/developer/projects/firefly-money/plans/01-es-locale.md."
   ```

   The worktree starts from `origin/main` on branch `feat/<name>`. Run
   `npm ci` in it before building; worktrees start without `node_modules`.
3. The agent in the worktree writes code only. It reads the plan by its path in
   the main checkout and does not edit it; it reports what it did and what is
   left, and the main-checkout agent records that in the plan.
4. When the user accepts the work, merge `feat/<name>` into `georgebark`
   (`--no-ff`), update the plan's status, and remove the worktree with
   `orca worktree rm`. The branch stays if a PR upstream is still wanted.

## Releases and deployment

- Tag `georgebark` as `v<upstream version>-gb.<n>` (for example `v1.4.0-gb.2`)
  and push the tag. `.github/workflows/georgebark.yml` builds
  `ghcr.io/georgebark/firefly-money:<version>`; a push to `georgebark` builds
  `latest`.
- Upstream's `docker.yml` and `pages.yml` are disabled in this fork's Actions
  settings and are left unchanged.
- The deployment lives in the user's home-infra repo
  (`/Users/bark/developer/projects/home-infra`), `stacks/firefly-money/`, on a homelab host. Deploying means bumping the image tag there and following that
  stack's README. Do not deploy without being asked.

## Working on the code

The app is TypeScript with no framework, bundled by esbuild and served by nginx.
Read upstream's [README](README.md#development) first; the essentials:

- `app/src/main.ts` imports every module in the order it runs. A module only
  imports from modules above it; anything further down is reached through `App`.
- Markup is built with the `html` tag from `core/html.ts`. Never join `html`
  results with `+`.
- Handlers are `data-onclick="App.name(…)"` attributes, never `onclick=`; each
  module adds its methods with `Object.assign(App, { … })`.
- Pure logic goes in modules without side effects, with a Vitest test in
  `test/`.
- Settings that should follow the user between devices go in `SYNCED` in
  `features/sync.ts`; they are stored in the Firefly preference `money_settings`.

Commands: `npm run build`, `npm run check`, `npm run lint`, `npm test`. Before
calling a change done, run those four and the smoke test against the demo server
(`python3 dev/mock_server.py`, then `python3 dev/smoke_test.py`).

**Never test against the user's real Firefly.** It holds their real finances and
Money writes to it. Use the demo server; if a change needs real data, ask.

## Conventions

- Everything written into the repo is in English. The user may talk in Spanish.
- Match the surrounding code: its density, naming and comment style.
- Never commit secrets (Firefly tokens, passwords, `.env`).
