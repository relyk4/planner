# Backlog

Each item is written so it can be pasted into a GitHub issue as is. Suggested
order is top to bottom. Finished items move to "Done" at the end.

Several items change the same areas (toolbar, map) in `static/js/board.js`, so
run them one at a time or rebase often.

---

## 3. Done work shows translucent green on the map

**Do:**
- Done task bars: green (`--ok`), slightly translucent, with text still
  readable in light and dark mode.
- The small status dot next to a done task is solid green.
- The legend matches.
- Other states are unchanged.

**Done when:** done work reads as clearly finished at a glance, and contrast
is still acceptable for the bar text.

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

## 7. Draw dependencies on the map by dragging between items

**Do:**
- Hovering near the left or right edge of a bar, milestone or external
  shows a small circle handle.
- Dragging from it draws a live arrow. Dropping on another item creates the
  link.
- The edges decide the type, predecessor edge first:
  - end → start = **FS**
  - start → start = **SS**
  - end → end = **FF**
  - start → end = **SF**
- While dragging, the drop target highlights the edge it will use and shows
  the type.
- Loops and duplicates are refused with a message. Esc cancels.
- Dragging from the middle of a bar still moves it between steps.
- The new link opens in the editor so type and lag can be adjusted.
- Undo works.

**Done when:** all four types can be drawn by mouse, and nothing about existing
drag-to-move behavior changes.

---

## 8. Drag milestones and external items to any step

**Do:**
- Milestones and external items can be dragged sideways on the map like
  tasks. Dropping one sets a pinned gate position (a new optional field,
  defaulted in `norm()`).
- Moving one later pushes its successors.
- Moving it earlier than its predecessors allow snaps to the earliest valid
  gate and says why (use `C.whyMin`).
- The editor shows the pin and has a "Reset to auto" option.

**Done when:** pins survive reload, old plans without the field load unchanged,
and undo works.

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
- **Full screen and zoom for the dependency map** (Nov 2026). *Full screen*
  in the toolbar hides the sidebar, header, tallies and legend and uses the
  browser's full screen when it can; Esc exits. The map zooms from 50% to
  200% with the `−`/`%`/`+` buttons, Ctrl/Cmd + wheel or a trackpad pinch,
  around the cursor. The map is redrawn at each zoom, so it stays sharp and
  drag still lands on the right step. The zoom level is remembered per
  viewer. The embedded timeline keeps its own Days/Weeks/Months scale.
