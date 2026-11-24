# Planner: guide for coding agents

Read this first. It applies to every agent and model working in this repo
(omp, Claude Code, or anything else). `CLAUDE.md` just points here.

## What this is

An offline dependency planner for one project manager now and a small team
later. Objectives → features → tasks are laid out in **steps** (sequence, not
dates) by typed dependencies (FS, SS, FF, SF, with lag), plus milestones,
external-team dependencies, releases and dates. There are three views over the
same data: **Dependency map** (the main one), **Grid** (spreadsheet editing)
and **Gantt**. Plans, every version and a field-level change log live in one
SQLite file.

It must run on air-gapped and classified networks. That drives most of the
rules below.

Deeper reading:
- `docs/ARCHITECTURE.md`: how the code is laid out, the data model and how
  steps, states and date flags are computed.
- `docs/DECISIONS.md`: choices already made. Don't undo these without asking.
- `docs/BACKLOG.md`: planned work, written so each item can become an issue.

## Hard rules

1. **No runtime dependencies.** `server.py` uses the Python 3.8+ standard
   library only. `static/index.html` is plain HTML, CSS and JavaScript: no
   frameworks, no npm packages, no build step, no CDN links, no web fonts, no
   external images or scripts. It must work with no internet. Dev-only tooling
   under `tests/` is fine.
2. **Never touch real data.** `data/` holds the owner's live `planner.db`. Don't
   read it, modify it or commit it. Run your own server with its own folder:
   `python3 server.py --port 8090 --data .data-dev`.
3. **Old plans must keep loading.** Plan JSON is stored as-is in SQLite and in
   users' backup files. Any new field must be optional, with its default set in
   `norm()`. Never rename or repurpose an existing field. Server schema changes
   must be additive (`CREATE ... IF NOT EXISTS`, `ALTER TABLE ... ADD`).
4. **Plan edits go through `mut(fn)`**, so Undo, autosave, versions and the
   change log all see them. View-only state (filters, zoom, scroll) does not.
5. **Escape user text.** Any string from plan data that goes into HTML passes
   through `esc()`.
6. **Light and dark.** Use the CSS variables (`--ink`, `--bg`, `--mute`,
   `--line`, `--accent`, `--ok`, `--late`, `--red`, and the others) and
   `light-dark()`. Don't hard-code colors, except the feature color palette `PAL`.
7. **Keep `file://` working.** Opened straight from disk, the page falls back
   to localStorage (`Store.mode === 'local'`). New features should degrade
   gracefully there (for example, history is server-only).
8. **One issue, one branch, one small PR.** Don't fold refactors into feature
   PRs.

## Run it

```sh
python3 server.py --port 8090 --data .data-dev   # pick a free port per worktree
```

Open `http://localhost:8090`, then use *More* > *New sample plan*. The sample
exercises every feature (blocked chains, overdue work, externals, releases,
all four link types) and is the fastest way to see a change.

When running parallel worktrees (Orca), give each worktree its own `--port`
and `--data` folder. `.data-*` folders are gitignored.

## Check your work before opening a PR

1. `python3 -m unittest discover -s tests -v`: server API tests (stdlib).
2. `cd tests/ui && npm install && npm test`: UI smoke test in jsdom (needs
   Node 18+). It starts its own server on a free port with a temp data folder.
   Extend it when you add a feature: one or two `ok(...)` lines that click
   through the new thing.
3. Syntax check the page script:
   `python3 -c "s=open('static/index.html').read();i=s.rfind('<script>');j=s.rfind('</script>');open('/tmp/p.js','w').write(s[i+8:j])" && node --check /tmp/p.js`
4. In a real browser, load the sample plan and check:
   - all three views
   - light and dark mode
   - a narrow window (under 900px)
   - that the console is clean

   For UI changes, attach a screenshot to the PR.

jsdom gotcha: top-level `let`/`const` in the page script are not reachable from
test code. Drive the page through the DOM (clicks, `input`/`change` events).
Editor fields record the undo snapshot on `focusin`, so call `.focus()` before
changing a value.

## How the page is put together (short version)

`static/index.html` is one file: markup, then CSS, then one `<script>` split by
banner comments (`// ===== storage`, `// ===== views`, `// ----- grid`,
`// ===== history`, `// ===== import`, `// ===== wiring`).

Render pipeline: `mut(fn)` → `render()` → `recalc()`, which calls `compute()`,
`relStats()`, `calc()` and `fltSet()` and fills `C`. Then come
`renderStats()`, `renderRels()`, `renderView()` (`renderBoard` /
`renderGrid` / `renderGantt`) and `renderDrawer()`, and finally `save()`
(debounced autosave). `soft()` is the debounced version used while typing.

Globals worth knowing:
- `S`: the plan
- `C`: computed results, rebuilt every render
- `map` / `kids`: id lookup and children
- `sel` / `selRel`: what's open in the editor
- `view`: the current view
- `flt`: the status filter, stored per plan in localStorage
- `cur`: the open plan's id and rev

Every view renders from `rowsVisible()`, so anything that hides or shows rows
belongs there.

## Gotchas learned the hard way

- **Global, short CSS class names collide.** Before adding a class, grep for it
  (`.ms` clashed and became `.mk`; `.top` clashed and became `.up`/`.lo`).
- **Order of `const` declarations matters** (temporal dead zone). `board`,
  `grid`, `views` and `dr` are declared together near the top for this reason.
- **Event handlers on `#views` must ignore events from `#gridv` and from
  detached targets** (`if(!e.target.isConnected||e.target.closest('#gridv'))return;`).
  Re-renders replace `innerHTML`, so a click can land on a node that no longer
  exists.
- **Each grid cell editor keeps its own local `G` object.** A shared editor
  variable once committed the wrong cell on blur.
- **Re-rendering destroys focus.** When rebuilding a panel the user is
  interacting with, restore focus the way `renderDrawer()` and `renderFlt()` do.
- **The step layout is computed, never stored.** Don't add dates to steps
  (see DECISIONS).
- **The map's link routing is deliberate.** A lanes/casing redesign was tried
  and the owner rejected it. Leave routing alone unless an issue asks for it.
- **`index.html` is large and one file.** Two agents editing it in parallel
  will conflict. Keep PRs small and rebase often; see the "Split index.html"
  item in the backlog.

## Working style

- The owner is a project manager, not a front-end developer. Write PR
  descriptions in plain language: what changed, how to try it, and anything
  that behaves differently than before.
- Visual choices are iterated with the owner. When a design choice is open,
  pick the most consistent option with what's there and say so in the PR,
  rather than stopping.
- Don't add telemetry, analytics, login systems or network calls to outside
  hosts.

## Git

- Branch: `feat/<issue>-short-name`, `fix/<issue>-short-name`,
  `docs/...`.
- Commits: short imperative subject ("Add status filter to all views").
- PRs use `.github/pull_request_template.md` and say `Closes #<issue>`.
- Never commit: `data/`, `.data-*/`, `backups/`, `*.db*`, `node_modules/`.
