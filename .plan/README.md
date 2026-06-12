# `.plan/` — requirement & planning tracking

This directory is version-controlled and holds the project's living requirement spec and
planning/optimization checklists.

## Convention

- **`requirement.md`** — the current feature set, constraints, and non-functional
  requirements. Update it when scope changes.
- **Optimization / upgrade plans** — staged checklists named `plan-<YYYYMMDD>.md`. All plans
  live here. Each tracked task checks off its box and bumps the root version before commit
  (see README "Version Cadence").

## Plans

| 文件                                 | 日期       | 状态                 |
| ------------------------------------ | ---------- | -------------------- |
| [plan-20260608.md](plan-20260608.md) | 2026-06-08 | ✅ 全部完成（P0–P3） |
| [plan-20260612.md](plan-20260612.md) | 2026-06-12 | 🚧 进行中（N1–N4）   |

## Status legend

- `[ ]` not started · `[x]` done · `[~]` partially done / intentionally scoped down (with rationale).
