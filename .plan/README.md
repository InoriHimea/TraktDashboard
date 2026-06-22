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

| 文件                                         | 日期       | 状态                                                 |
| -------------------------------------------- | ---------- | ---------------------------------------------------- |
| [plan-20260608.md](plan-20260608.md)         | 2026-06-08 | ✅ 全部完成（P0–P3）                                 |
| [plan-20260612.md](plan-20260612.md)         | 2026-06-12 | ✅ 全部完成（N1–N4 / E1–E2）                         |
| [plan-20260615.md](plan-20260615.md)         | 2026-06-15 | ✅ 全部完成（10/10 冲刺）                            |
| [plan-20260616.md](plan-20260616.md)         | 2026-06-16 | ✅ 全部完成（审查修复 R01–R13，v0.50.3）             |
| [plan-20260617.md](plan-20260617.md)         | 2026-06-17 | ✅ 全部完成                                          |
| [plan-20260617b.md](plan-20260617b.md)       | 2026-06-17 | ✅ 全部完成                                          |
| [plan-20260617c.md](plan-20260617c.md)       | 2026-06-17 | ✅ 全部完成                                          |
| [plan-20260617d.md](plan-20260617d.md)       | 2026-06-17 | ✅ 全部完成                                          |
| [plan-20260617e.md](plan-20260617e.md)       | 2026-06-17 | ✅ 全部完成（Jellyfin 集成）                         |
| [plan-20260619.md](plan-20260619.md)         | 2026-06-19 | ✅ 全部完成（审查修复 R01–R15）                      |
| [plan-20260619-001.md](plan-20260619-001.md) | 2026-06-19 | 🗂 规划中（功能扩展 F02–F12，11 项）                 |
| [plan-20260621.md](plan-20260621.md)         | 2026-06-21 | ✅ 完成（R04：迁移缺表、日历结局角标、电影增量同步） |
| [plan-20260622.md](plan-20260622.md)         | 2026-06-22 | 🗂 规划中（收藏集级元数据 T01–T06）                  |

## Status legend

- `[ ]` not started · `[x]` done · `[~]` partially done / intentionally scoped down (with rationale).
