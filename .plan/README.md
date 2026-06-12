# `.plan/` — requirement & planning tracking

This directory is version-controlled and holds the project's living requirement spec and
planning/optimization checklists.

## Convention

- **`requirement.md`** — the current feature set, constraints, and non-functional
  requirements. Update it when scope changes.
- **Optimization / upgrade plans** — staged checklists named `plan-<YYYYMMDD>.md`. The active
  plan currently lives at the repo root (`plan-20260608.md`) for historical reasons; new plans
  should be added here. Each tracked task checks off its box and bumps the root version before
  commit (see README "Version Cadence").

## Status legend

- `[ ]` not started · `[x]` done · `[~]` partially done / intentionally scoped down (with rationale).
