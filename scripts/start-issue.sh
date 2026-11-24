#!/usr/bin/env bash
# Start work on a GitHub issue.
#   1. Creates a branch named <type>/<number>-<short-title>, linked to the issue
#      (it shows under "Development" on the issue page), and checks it out.
#   2. Moves the issue to "In progress" on the project board, if it can.
#
# Usage:  scripts/start-issue.sh <issue-number> [feat|fix|docs]
# Needs:  gh logged in with the "project" scope (gh auth refresh -s project)
# Project settings can be overridden with PLANNER_PROJECT_OWNER / PLANNER_PROJECT.
set -euo pipefail

n="${1:?Usage: scripts/start-issue.sh <issue-number> [feat|fix|docs]}"
type="${2:-feat}"
owner="${PLANNER_PROJECT_OWNER:-relyk4}"
project="${PLANNER_PROJECT:-1}"

case "$n" in (*[!0-9]*|"") echo "Issue number must be a number, got: $n" >&2; exit 1;; esac
case "$type" in (feat|fix|docs) ;; (*) echo "Type must be feat, fix or docs" >&2; exit 1;; esac

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "You have uncommitted changes. Commit or stash them first." >&2
  exit 1
fi

repo=$(gh repo view --json nameWithOwner -q .nameWithOwner)
title=$(gh issue view "$n" --json title -q .title)
slug=$(printf '%s' "$title" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' | cut -c1-40 | sed -E 's/-+$//')
branch="$type/$n-$slug"

git fetch origin --quiet

if git show-ref --verify --quiet "refs/heads/$branch"; then
  git switch "$branch"
elif git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
  git switch --track "origin/$branch"
else
  gh issue develop "$n" --repo "$repo" --base main --name "$branch" --checkout
fi
echo "On branch $branch for #$n: $title"

# Move the card to "In progress". Failure here never stops the work.
move_card() {
  local pid fid oid iid
  pid=$(gh project view "$project" --owner "$owner" --format json -q .id) || return 1
  fid=$(gh project field-list "$project" --owner "$owner" --format json \
        -q '.fields[] | select(.name=="Status") | .id') || return 1
  oid=$(gh project field-list "$project" --owner "$owner" --format json \
        -q '.fields[] | select(.name=="Status") | .options[] | select(.name|ascii_downcase|test("in.?progress")) | .id' | head -1) || return 1
  iid=$(gh project item-list "$project" --owner "$owner" --limit 500 --format json \
        -q ".items[] | select(.content.number==$n and .content.repository==\"$repo\") | .id" | head -1) || return 1
  [ -n "$pid" ] && [ -n "$fid" ] && [ -n "$oid" ] && [ -n "$iid" ] || return 1
  gh project item-edit --project-id "$pid" --id "$iid" --field-id "$fid" --single-select-option-id "$oid" >/dev/null
}
if move_card; then
  echo "Moved #$n to In progress on project $project."
else
  echo "Note: couldn't move #$n on the project board (check it's on project $project and has an \"In progress\" status)." >&2
fi
