# Backlog

Each item is written so it can be pasted into a GitHub issue as is. Suggested
order is top to bottom. Finished items move to "Done" at the end.

Several items change the same areas (toolbar, map) in `static/js/board.js`, so
run them one at a time or rebase often.

---

## 4. Full screen and zoom for the dependency map

**Do:**
- A full-screen button on the map. Use the browser Fullscreen API, with a
  fallback that hides the sidebar and header if it's unavailable. Esc exits.
- Zoom in and out: Ctrl/Cmd + mouse wheel and trackpad pinch over the map,
  plus `+`/`−`/reset buttons. Zoom scales the chart (step width, row height,
  text) around the cursor and keeps it sharp. Don't apply a CSS
  `transform` scale on the whole thing if that blurs it or breaks drag hit
  areas.
- Dragging bars and the timeline still lands where expected at every zoom.
- Zoom level is a per-viewer preference (localStorage).

**Done when:**
- Zooming between 50% and 200% is smooth on a 100-task plan.
- Drag-to-move still works at every zoom.

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
