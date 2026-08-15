# Tasks

This folder is a lightweight, file-based task board. Each task lives in its own Markdown file so people can claim and complete work in parallel with fewer editing conflicts.

## Workflow

1. Create a task from [TEMPLATE.md](TEMPLATE.md), using the next number and a short name: `004-example-task.md`.
2. Set `owner` to your GitHub handle and `status` to `in-progress` before starting.
3. List dependencies and acceptance criteria before doing substantial work.
4. Keep notes and links in the task file so another person can pick it up.
5. Set `status` to `blocked` with a clear blocker, or `done` with the result and verification.

Allowed statuses are `ready`, `in-progress`, `blocked`, and `done`.

## Collaboration rules

- One owner at a time per task.
- Keep tasks independently useful and reasonably small.
- Prefer touching your task file plus its deliverable; avoid unrelated cleanup.
- Coordinate section ownership before multiple people edit the PRD.
- Make dependencies explicit rather than assuming a particular work order.

## Initial tasks

| Task | Status | Owner |
| --- | --- | --- |
| [001 — Define the first user and problem](001-define-user-and-problem.md) | Ready | Unassigned |
| [002 — Research NYC path data](002-research-nyc-path-data.md) | Done | codex |
| [003 — Explore path qualities](003-explore-path-qualities.md) | Ready | Unassigned |

Project-specific collaboration lessons are kept in [lessons.md](lessons.md).
