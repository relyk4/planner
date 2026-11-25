# Backlog

Each item is written so it can be pasted into a GitHub issue as is. Suggested
order is top to bottom. Finished items move to "Done" at the end.

Several items change the same areas (toolbar, map) in `static/js/board.js`, so
run them one at a time or rebase often.

---

## 5. Ticket keys become links

**Do:**
- A plan setting, "Ticket link address", for example
  `https://jira.example/browse/`. Each key (for example `UDM-123`) becomes
  that address plus the key.
- Each item gets an optional "Link override" field holding a full URL.
- Keys show as links in the editor, in the grid's Ticket column and on map
  labels. Links open in a new tab.
- With no address set, keys stay plain text, so nothing breaks offline.
- Only `http(s)` URLs are allowed.

**Done when:** setting the address makes every key clickable, and clearing it
reverts them to plain text.

---

## 6. Re-import from Jira by key (update, don't duplicate)

**Do:**
- When importing CSV or XLSX, match rows to existing items by ticket key.
- Matched rows update status, dates, owner, parent and links. Unmatched keys
  become new items. Existing items not in the file are left alone.
- Show a preview before applying, for example "12 updated, 3 new, 40
  unchanged", with an expandable list of what changes.
- Apply the whole import as one `mut()`, so it is one Undo step and one
  version.
- Mapping stays the same: epics become features, stories and tasks become
  tasks, "Blocks" links become FS dependencies.

**Done when:** importing the same export twice changes nothing the second
time, and an edited export updates only what changed.

---

## Ideas not yet scheduled

- Owner and team filters, plus a "My work" view (building on the status
  filter).
- PI and iteration fields, with filtering and grouping.
- Export the map as PNG or PDF for briefings.
- Quick find (Ctrl/Cmd+K) to jump to an item by name or key.
- Automatic daily backup of `planner.db` into `data/backups/`, keeping the
  last 14.
- Live read-only Jira sync through `server.py` (`urllib`, Personal Access
  Token). It needs security sign-off on the target network first.

---

## Done

- **Status filter on all three views** (Nov 2026). Filter menu, presets, a
  "Showing X of Y" summary, closed-up empty steps on the map, and the open
  item kept visible.
- **Split `index.html` into a few files** (Nov 2026). Styles in
  `static/app.css`, the script in classic `<script src>` files under
  `static/js/`. No visible change.
- **One toolbar row above the view, a single Add menu, and a Releases tab**
  (Nov 2026). The toolbar sits directly above the active view and scrolls
  sideways instead of wrapping; *Add ▾* replaces the four add buttons and
  works with the keyboard. Releases moved off the plan page into their own
  tab, with a page per release, linked from the sidebar.
- **Done work shows translucent green on the map** (Nov 2026). Done task
  bars are a see-through green tint with a green outline and dark text (light
  mode) or light text (dark mode); the status dot next to a done task is solid
  green everywhere it appears, and the legend matches.
- **Milestones and externals can be dragged to any gate** (Nov 2026). Drag
  a milestone diamond or external square sideways on the map, or use
  *Earlier gate* / *Later gate* in its editor. The drop pins it (`gate`);
  what waits on it moves along. Dropping it earlier than its links allow
  snaps it to the earliest valid gate and says which link holds it. *Reset to
  auto* clears the pin.
- **Full screen and zoom for the dependency map** (Nov 2026). *Full screen*
  in the toolbar hides the sidebar, header, tallies and legend and uses the
  browser's full screen when it can; Esc exits. The map zooms from 50% to
  200% with the `−`/`%`/`+` buttons, Ctrl/Cmd + wheel or a trackpad pinch,
  around the cursor. The map is redrawn at each zoom, so it stays sharp and
  drag still lands on the right step. The zoom level is remembered per
  viewer. The embedded timeline keeps its own Days/Weeks/Months scale.
- **Draw dependencies on the map by dragging** (Nov 2026). Hovering a
  task bar, milestone or external shows a circle on its start and end edge.
  Drag one onto another item to link them; the two edges give the type (end
  → start FS, start → start SS, end → end FF, start → end SF), shown on the
  drop edge while dragging. Loops and duplicates are refused; Esc cancels.
  The new link opens in the editor to set its type and lag.
- **Drag empty map space to pan the dependency map** (Nov 2026). Press on
  empty space in the map and drag to move the view both ways at once; the
  step header and Work breakdown column stay pinned. Bars, markers, link tags
  and handles keep their own drag and click, and a click without movement
  still closes the editor. Hold Space to pan from anywhere, bars included.
  Mouse and trackpad only; touch keeps scrolling natively.
- **Milestones and externals can be shown under an objective or feature**
  (Nov 2026). *Show under* in their editor puts the row under an objective
  (feature level) or a feature (task level) in the map, grid and Gantt. It
  only moves the row: links, steps, dates and tallies don't change. A
  collapsed objective or feature shows their markers on its row; deleting it
  moves them back to the top section. Dragging rows in and out of groups
  waits on #19.
- **Legend opens from the toolbar** (Nov 2026). *Legend* in the toolbar
  opens a panel over the view, also in full screen; Esc or a click outside
  closes it. Short sections (task status, dates and risk, links and link
  states, milestones and externals, map extras, timeline and Gantt) each
  draw their swatches with the views' own classes, plus "How it works"
  bullets. It shows only what the current view draws. The bottom-of-page
  legend and the timeline's own key strip are gone.
