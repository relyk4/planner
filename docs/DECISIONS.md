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
| 10 | **The legend is a collapsible dropdown at the bottom.** | It kept getting in the way at the top. |
| 11 | **Per-feature colors** show as a stripe on task bars and a tint on feature bars. | Features are easier to tell apart at a glance. |
| 12 | **History is server-side:** field-level change log, versions with coalescing, restore, and optimistic conflict check. | "Retains information" with an audit trail; ready for a team later. |
| 13 | **Status filter state is per viewer** (localStorage per plan), not stored in the plan. | When the team shares a plan, one person's filter must not change anyone else's view. |
| 14 | **The status filter closes up empty steps by default.** A thicker divider marks where steps were skipped. Step numbers keep their real values. | Hiding done work shouldn't leave a wall of empty columns. The real step number stays truthful. |
| 15 | **The item open in the editor stays visible even if the filter would hide it.** | Marking a task Done while Done is hidden shouldn't make it vanish mid-edit. |
