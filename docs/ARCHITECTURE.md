# Architecture

## Repository layout

```
server.py              Python 3.8+ stdlib HTTP server + SQLite storage + JSON API
static/index.html      Page markup; loads app.css and js/*.js (relative paths)
static/app.css         All styles
static/js/             The app script as classic scripts, loaded in order (below)
data/                  Live data (planner.db). Gitignored. Never touch.
tests/test_server.py   API tests (unittest, stdlib)
tests/ui/              jsdom smoke test (dev-only, npm)
docs/                  This file, DECISIONS.md, BACKLOG.md
Dockerfile, docker-compose.yml, start.sh, start.bat
```

## Server (`server.py`)

- `ThreadingHTTPServer`, but every API request runs under one global `LOCK`
  with its own SQLite connection (WAL mode). Simple and safe for a handful of
  users.
- Tables:
  - `plans(id, name, created, updated, updated_by, rev, archived, data)`:
    `data` is the plan JSON, stored whole.
  - `versions(id, plan_id, rev, ts, user, note, nchanges, data)`: full
    snapshots.
  - `changes(id, plan_id, rev, ts, user, item_id, item_type, item_name, field, old, new)`:
    one row per changed field.
- **Saving** (`PUT /api/plans/{id}` with `{data, base_rev}`):
  - If `base_rev` is stale, the server answers 409 and the client shows the
    conflict dialog.
  - Otherwise `diff(old, new)` compares items (`ITEM_FIELDS`), links (added,
    changed or removed), releases (`REL_FIELDS`) and the title. Each difference
    becomes a `changes` row.
  - Versions coalesce: autosaves from the same user within
    `--coalesce` seconds (default 120), with no note, update the latest
    version instead of adding one.
- **Attribution**: the `X-User` header (URL-encoded) from the name box in the
  sidebar.
- **Static files** come from `static/` (subfolders included), with a
  path-traversal guard. `.js` and `.css` content types are pinned in `main()`.
  Unknown paths without an extension fall back to `index.html`.
- The full route list is in README.md under "API".

## Client (`static/`)

`index.html` is markup only. `app.css` holds every style. The script is a set
of classic `<script src>` files (no modules, no bundler) that share globals as
if they were one script. They load in this order, and code that runs at load
time can only use names from its own file or an earlier one.

### Files and sections

| File (banner) | What's there |
|---|---|
| `js/core.js` | constants (`TYPES`, `LBL`, `KIND`, `XS`, `ZO`), date helpers (`dn`, `fd`, `iso`), `mk()`, `sample()`, `blank()`, `norm()`, `mut`/`undo`, `compute()`, `relStats()`, `calc()`, `recalc()`, filter (`FST`, `flt`, `fltSet`, `stepsShown`), `rowsVisible()`, `focusSet()` |
| `js/board.js` | link routing (`poly`, `route`, `tagAt`), `renderStats`, `renderTimeline`, `renderBoard`, drawer (`renderDrawer`, `depBlock`, `depCard`, `moveRow`, `gateRow`), `render`, `soft`, actions (`moveTo`, `moveGate`, `addItem`, `addRel`, `del`, `move`), board drag (`dragMove`/`dragEnd`), drawing links on the map (`lkShow`, `lkHit`, `lkMove`/`lkEnd`), timeline drag (`tdMove`/`tdEnd`), map/drawer/toolbar handlers; `// ===== views`: `renderView`, `renderGantt`; `// ----- releases`: `openRel`, release list and release page (`relListHtml`, `relPageHtml`, `renderRelv`), the sidebar release list (`renderRailRels`), `relSay` (overdue/at-risk text shared with the drawer) |
| `js/store.js` (`// ===== storage`) | `LS` (safe localStorage), `Store` (server or local mode), `save`/`flush` autosave, conflict dialog, `openPlan`, `renderPlans`, `newPlan`, `boot` |
| `js/grid.js` (`// ----- grid`) | `GCOLS`, `GEDIT`, `cellHtml`, `gridRows`, `renderGrid`, keyboard moves, `gridEdit`, `setCell`, `parseDeps` |
| `js/history.js` (`// ===== history`) | change log and versions panel (`loadHist`, `renderHist`) |
| `js/import.js` (`// ===== import`) | CSV parser, `.xlsx` reader (zip + `DecompressionStream`), column guessing, `buildImport` |
| `js/wiring.js` (`// ===== wiring`) | menus (Settings and More in the app bar, the toolbar's Add menu with arrow-key support, `placeMenu` for toolbar menus), filter menu (`renderFlt`, `fltLoad`, `fltSave`), the System settings panel (`sysPanel`, `setTheme`), dialogs, rail (including the release list) and tabs; ends with `boot()`, so it loads last |

### Data model (plan JSON, `S`)

```js
{
  title, view: 'map'|'grid'|'gantt'|'rel', relOpen, sample, msCollapsed, extCollapsed,
  itemIds: 'outline'|'key',                  // Plan settings > Item IDs; default 'outline'
  ticketUrl: '',                             // Plan settings > Ticket link address; '' = keys stay plain text
  cal: { asof: 'YYYY-MM-DD' | '' },          // status date; blank = today
  tl:  { open, zoom: 'days'|'weeks'|'months'|'quarters', only },
  releases: [{ id, name, target, status: 'planned'|'active'|'released', notes, due }],
  items: [{
    id, type: 'obj'|'feat'|'task'|'ms'|'ext', parent,   // ms/ext: null (top section) or an obj/feat id ("Show under", display only)
    name, key, owner, status, notes, collapsed,
    deps: [{ id, type: 'FS'|'SS'|'FF'|'SF', lag, st: 'auto'|'blocked', note }],
    blocker,            // free text; non-empty makes a task Blocked
    earliest,           // task pinned to a step (null = auto)
    gate,               // milestone/external pinned to a gate (null = auto)
    rel,                // release id; '' = inherit from feature; '-' = none
    target, due, startBy, startedOn, doneOn,   // ISO dates or ''
    team, ref,          // external items: team name, their ticket
    url,                // link override for the item's ticket: a full http(s) URL, or ''
    color               // features: '#rrggbb'
  }]
}
```

`relOpen` is no longer used (it collapsed the old release ledger above the map)
but stays in `norm()` so saved plans round-trip unchanged.

Task `status` is `todo|doing|done|blocked`. Milestone `status` is
`todo|done` (`done` means "mark reached"). External `status` is
`pending|committed|atrisk|delivered|blocked`. `norm()` is the single place
that cleans and defaults all of this, and it must accept every older shape.

### How the layout and states are computed (`compute()`)

- **Codes**: objectives `1`, features `1.2`, tasks `1.2.3`, milestones `M1`,
  externals `X1`. These come from order in `S.items`.
  - `C.code` is always the outline number. The Grid's `findRef()` accepts it
    as well as ticket keys, so typed links work in either mode.
  - `C.lbl` is what the page shows: the same as `C.code`, except that with
    `itemIds: 'key'` a feature or task with a ticket key shows the key.
    Every display site (map, Gantt, Grid, editor, Releases, tooltips, toasts,
    CSV) uses `C.lbl`. Keys are shown in full; the name next to them truncates
    instead. `idk(id)` adds the `idk` class to a row's code span when it shows
    a key, which caps only very long keys (12em) so the name keeps some room.
  - Ticket links (`core.js`): `tkUrl(it)` is the item's `url` override, else
    `ticketUrl` plus the URI-encoded key (`key`, or `ref` for externals; an
    external `ref` that is itself a URL is used as is). `okUrl()` lets only
    `http(s)` through, so anything else stays plain text. `tkHtml()` wraps a
    key in `<a class="tkl" target="_blank">` on the map row labels and the
    Grid's Ticket column; the editor shows an "Open" link (`tkSay()`). Task
    bars don't link, so dragging a bar never opens a ticket.
- **Links**: `C.links(task)` is the task's own deps plus its feature's deps.
  A feature-level link makes every task in it wait.
- **Steps** (`C.step`): positions are measured in step boundaries. A task
  occupies `(step-1, step]`.
  - A link's bound is `at(pred, type[0]) + lag`, where `at` is the
    predecessor's start (`step-1`) or finish (`step`).
  - For a task whose link type ends in `S`, the bound is +1.
  - A task's step is the max of its bounds, at least 1 and at least
    `earliest`.
  - Milestones and externals sit on a boundary (a "gate"): the max of their
    bounds, at least 0 and at least `gate`.
  - `C.minOf(id)` is where an item's links alone would put it, and
    `C.whyMin(id)` names the link that sets that.
  - `C.N` is the deepest step.
- **Satisfied**: a link whose predecessor side is `S` needs the predecessor
  started; `F` needs it done.
- **Effective state** (`C.eff`), in priority order:
  - Tasks: `done`, then `blocked` (status, blocker text or a blocked link),
    then `doing`, then `waiting` (an unsatisfied `?S` link), then `ready`.
  - Milestones: `reached` or `open`.
  - Externals: their status.
- **Warnings** (`C.warn`): a task's status contradicts a link (started
  before an `?S` link was satisfied, or done before an `?F` link was).
- **Chains**: `C.chain` marks items held up by a blocker anywhere upstream
  (red outline). `C.lateUp` marks items held up by overdue work (orange
  outline).
- **Critical path**: walked back from the deepest unfinished task through
  the binding link.

### Date flags (`calc()` → `C.df[id]`)

| Flag | Meaning |
|---|---|
| `ls` | Late start: not started and past `startBy` |
| `od` | Overdue: not done and past `due` |
| `rk` | At risk: an unsatisfied predecessor ends after this item's `startBy`/`due` (or an external is marked at risk) |
| `sl` / `fl` | Started late / finished late (info only) |

"Today" is `C.T`: the status date if set, otherwise the real date.
Releases get `od`/`rk` from their tasks and externals.

### Views

- **Map** (`renderBoard`):
  - The left label column, the step header and the collapsible timeline sit
    over an absolutely positioned chart.
  - Links are SVG paths with tags.
  - Geometry lives in `geo` (`LW`, `CW`, `N`, `vs`). `bx(g)` turns a step
    boundary into an x position. When the filter closes up empty steps, `vs`
    is the list of visible steps.
  - Dragging a bar sideways pins the task to a step (`moveTo`). Dragging a
    milestone or external marker pins it to a gate (`moveGate`); dropping it
    earlier than its links allow snaps it to the earliest valid gate.
  - Hovering a task bar, milestone or external shows a handle on its start
    (left) and end (right) edge (`lkShow`). Dragging a handle onto another
    item adds a link to the item dropped on (`lkMove`/`lkEnd`): the dragged
    edge is the predecessor's, the drop edge the successor's, so end → start
    is FS, start → start SS, end → end FF, start → end SF. Duplicates and
    loops (`downOf`) are refused. `renderBoard` records each item's edge
    points in `geo.pt` for the handles and the drop hit test (`lkHit`).
  - Zoom (`mapZ`, 0.5 to 2) is a redraw, not a CSS transform:
    `renderBoard` multiplies its geometry (`LW`, `CW`, row height, offsets)
    by `mapZ` and sets `--z` on `#grid`; map text and marker sizes in
    `app.css` are written `calc(Npx*var(--z,1))`. `.tl` resets `--z` to 1,
    so the embedded timeline keeps its own scale. `zoomTo()` batches
    requests to one redraw per frame and keeps the point under the cursor
    in place. Drag code reads `geo`, so it follows the zoom.
  - The label column's width (`lbW`, at 100% zoom; `null` is the default
    for the window size, 170/250/330px) is set by dragging its right edge
    (`.lbw` in `.corner` and `.labels`), Left/Right on the focused edge, or
    a double-click to reset (`lbSet`). `lbWidth()` clamps it to 120px and
    60% of the visible width at the current zoom, and it feeds `LW` and the
    step width `CW`. Under 240px `#grid` gets `lbn`, which hides owners and
    release pills. `lbSet` keeps the first visible step in place.
  - Panning (`pan`, `panMove`/`panEnd`) is view-only: a mouse press on
    empty map space (not `[data-id]`, link tags, handles, the header, labels
    or timeline) that moves 6px sets `board.scrollLeft`/`scrollTop` from the
    pointer, so sticky header and labels keep working. Its `pointerdown` runs
    in the capture phase; while Space is held (`spaceOn`) it starts over bars
    too and stops the press reaching the bar, link and date drag handlers.
- **Grid** (`renderGrid`):
  - Columns come from `GCOLS`; which cells each type can edit comes from
    `GEDIT`.
  - Keyboard navigation works as in a spreadsheet.
  - "Depends on" accepts text like `1.2.3 SS+1, M2`.
- **Gantt** (`renderGantt` → `renderTimeline(...,full)`): dates only. Bars
  can be dragged or resized to change `startBy`/`due`.
- **Releases** (`renderRelv`): the list of releases, or one release's page
  when `relPage` is set (progress, tasks, features, outside and external
  dependencies, notes). "Edit release" opens the release in the drawer
  (`selRel`); "Show on map" switches to the map with `selRel` set so the
  release's work is highlighted. The sidebar lists the same releases under
  the plans (`renderRailRels`).
- Map, Grid and Gantt take their rows from `rowsVisible()`, which applies
  collapse state and the status filter.
  - The *Milestones* and *External dependencies* sections hold only the
    milestones and externals with no `parent`, and disappear when empty.
    One with a `parent` ("Show under" in its editor) is listed right after
    that objective's or feature's own rows, at feature depth under an
    objective and task depth under a feature (`lvlOf()`).
  - Placement is display only. `compute()` numbers `M#`/`X#` from
    `S.items` order wherever they're shown, and code that walks the outline
    keeps filtering `kids[...]` by type, so a placed milestone is never
    counted as a feature or task. `norm()` drops a `parent` that isn't an
    objective or feature back to `null`.
  - A collapsed objective or feature shows the markers of everything placed
    under it (`placedIn()`) on its own row, like a collapsed top section.
    Deleting it moves those items back to their top section (`del()`).

### Toolbar

- One row directly above the active view (not sticky): view tabs, Filter,
  **Add ▾** (objective, milestone, external, release), Undo, Expand all,
  Collapse features, Critical path, Link tags, then map zoom (`−`, level,
  `+`), Legend and Full screen pinned to the right end (`position: sticky`).
- It never wraps. When it doesn't fit it scrolls sideways, so its menus are
  `position: fixed` and placed by `placeMenu()` to avoid being clipped.
- The "Showing X of Y tasks" filter summary sits on its own line under the
  toolbar, only while a filter is on.
- In the Releases tab the tools that only affect Map, Grid and Gantt (Filter,
  Expand all, Collapse features, Critical path, Link tags) are disabled.
  Zoom is disabled outside the map.
- *Legend* (`lgdOpen()` in `wiring.js`) opens `#lgd`, a panel over the view
  placed by `placeMenu()`. Its markup is static in `index.html`, and every
  swatch is the real element the views draw (`.b`, `.dot`, `.mk`, `.xk`,
  `.tk`, an SVG `path.e` ...), taken out of absolute positioning by `.lgd`
  rules, so it can't drift from the map. Entries carry `data-v` (`map`,
  `gantt`, `list` for Grid and Releases); `renderView()` sets
  `#lgd[data-view]` and CSS hides what doesn't apply. Esc or a click
  outside closes it. Open or closed is never saved. The timeline and Gantt
  have no key strip of their own; their entries live in the legend.
- *Full screen* (`fullScreen()`) adds `.fullmap` to `#app`, which hides the
  sidebar, header and tallies so the toolbar and view fill the window
  (Legend still opens over it), and asks for browser full screen on the
  whole page (so the drawer and dialogs still show). Without the Fullscreen
  API the class alone is the fallback. Esc exits; it works from any tab.

### Storage (`Store`)

- **`server` mode** (when `api/health` answers): saves go to the API.
- **`local` mode** (`file://` or no server): saves go to localStorage. There
  is no history in this mode.
- Autosave is debounced in `save()` and done in `flush()`. On a 409 the
  conflict dialog offers "load theirs" or "keep mine".
- Per-viewer preferences use `LS` keys (`planner.user`, `planner.last`,
  `planner.flt.<planId>`, `planner.mapzoom` for the map zoom, `planner.lbw`
  for the map's Work breakdown column width,
  `planner.theme` (`system` | `light` | `dark`) for *System settings* > *Theme*, and
  `planner.plansrail` / `planner.relrail` for the sidebar's Plans and
  Releases sections being collapsed) and never go into plan data.
- *Settings* in the app bar has two entries. *Plan settings* (`calForm()` in
  the editor drawer) holds options saved in the plan, for everyone. *System
  settings* (`sysPanel()`, its own side panel `#sysp`, like History) holds
  per-viewer options kept in localStorage. New settings go in whichever of the
  two matches where they are stored.
- Theme: `setTheme()` in `wiring.js` sets `data-theme` on `<html>` (removed
  for System, so CSS `color-scheme: light dark` follows the OS live). A tiny
  inline script at the top of `<head>` applies the saved choice before the
  stylesheet loads, so there is no flash. Colours come from `light-dark()`
  variables; the sidebar is dark in both themes (`.rail{color-scheme:dark}`).
