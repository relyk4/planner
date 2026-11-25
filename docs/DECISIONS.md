# Decisions

These choices were made on purpose, mostly by the owner (Kyler) while using the
tool. Don't reverse one without an issue that says to. Add new entries at the
bottom.

| # | Decision | Why |
|---|---|---|
| 1 | **No frameworks, no build, no runtime packages.** Plain JS/CSS in one HTML file; Python stdlib server. | Must install and run on air-gapped and classified networks with nothing but Python. Easy Docker image, nothing to approve. React was considered and rejected for this reason. |
| 2 | **Steps are sequence, not time. Steps never carry dates.** | Dating steps made it impossible to have, say, 30 steps under one objective. Dates live on tasks, milestones, externals and releases instead. |
| 3 | **The dependency map is the main view.** Grid and Gantt are extra tabs over the same data. | The point of the tool is seeing order, blockers and dependencies. |
| 4 | **Four link types with lag, plus a manual "Blocked" link status.** Each link's tag shows its type on the map, and links are color-coded. | Needed to model real handoffs (for example, a task that can start but can't finish until another finishes). |
| 5 | **Satisfied links are green dotted lines.** | The owner asked for green rather than grey so finished handoffs read as "good", not "disabled". |
| 6 | **External team dependencies are first-class items** (`X1`…), placed at a gate, holding up whatever links to them until delivered. | Work often can't start until another team cuts a release. |
| 7 | **Overdue work has a knock-on effect.** Downstream items get an orange outline and "Held up by overdue …", parallel to the red blocked-chain outline. The effect clears when the overdue item is done. | Shows who is affected by a slip, not just who slipped. |
| 8 | **Objectives count features, not tasks.** | Objectives are tracked at feature level. |
| 9 | **Map link routing stays as is.** A lanes and casing redesign to stop overlaps was built, then reverted at the owner's request. | It looked worse. Overlap fixes need a different idea and the owner's sign-off. |
| 10 | **The legend opens on demand over the view, from *Legend* in the toolbar**, also in full screen, and shows only what applies to the current view. It replaced the collapsible dropdown at the bottom (#17), which replaced a legend at the top. | At the top it got in the way; at the bottom it sat below the fold and was hidden in full screen. Swatches reuse the views' own classes so they can't drift. |
| 11 | **Per-feature colors** show as a stripe on task bars and a tint on feature bars. | Features are easier to tell apart at a glance. |
| 12 | **History is server-side:** field-level change log, versions with coalescing, restore, and optimistic conflict check. | "Retains information" with an audit trail; ready for a team later. |
| 13 | **Status filter state is per viewer** (localStorage per plan), not stored in the plan. | When the team shares a plan, one person's filter must not change anyone else's view. |
| 14 | **The status filter closes up empty steps by default.** A thicker divider marks where steps were skipped. Step numbers keep their real values. | Hiding done work shouldn't leave a wall of empty columns. The real step number stays truthful. |
| 15 | **The item open in the editor stays visible even if the filter would hide it.** | Marking a task Done while Done is hidden shouldn't make it vanish mid-edit. |
| 16 | **The plan toolbar is one row directly above the active view, not sticky.** It scrolls sideways instead of wrapping. The four add buttons are one *Add ▾* menu. | Keeps the controls next to the view they act on and frees vertical space. Everything fits on one line at 1280px wide. |
| 17 | **Releases have their own tab and a page per release**, also listed in the sidebar under the plans. The release ledger no longer sits above the map. | The ledger pushed the map down on every plan; releases are looked at on their own, then shown on the map on demand ("Show on map"). |
| 18 | **The filter's "Showing X of Y tasks" summary sits on a slim line under the toolbar**, only while a filter is on. | Inside the toolbar it pushed the row past 1280px. |
| 19 | **Where a milestone or external is shown is display only.** "Show under" puts its row under an objective or feature (stored in its `parent`), but it never adds links, and its `M#`/`X#` code, step, states, dates and the tallies stay the same. Deleting the objective or feature puts it back in its top section. | It shows which workstream an item belongs to without changing the plan's logic. Links still come only from *Links* or dragging handles. |
