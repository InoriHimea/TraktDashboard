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

| 文件                                         | 日期       | 状态                                                      |
| -------------------------------------------- | ---------- | --------------------------------------------------------- |
| [plan-20260608.md](plan-20260608.md)         | 2026-06-08 | ✅ 全部完成（P0–P3）                                      |
| [plan-20260612.md](plan-20260612.md)         | 2026-06-12 | ✅ 全部完成（N1–N4 / E1–E2）                              |
| [plan-20260615.md](plan-20260615.md)         | 2026-06-15 | ✅ 全部完成（10/10 冲刺）                                 |
| [plan-20260616.md](plan-20260616.md)         | 2026-06-16 | ✅ 全部完成（审查修复 R01–R13，v0.50.3）                  |
| [plan-20260617.md](plan-20260617.md)         | 2026-06-17 | ✅ 全部完成                                               |
| [plan-20260617b.md](plan-20260617b.md)       | 2026-06-17 | ✅ 全部完成                                               |
| [plan-20260617c.md](plan-20260617c.md)       | 2026-06-17 | ✅ 全部完成                                               |
| [plan-20260617d.md](plan-20260617d.md)       | 2026-06-17 | ✅ 全部完成                                               |
| [plan-20260617e.md](plan-20260617e.md)       | 2026-06-17 | ✅ 全部完成（Jellyfin 集成）                              |
| [plan-20260619.md](plan-20260619.md)         | 2026-06-19 | ✅ 全部完成（审查修复 R01–R15）                           |
| [plan-20260619-001.md](plan-20260619-001.md) | 2026-06-19 | ✅ 全部完成（F01–F12；2026-07-07 对账补记）               |
| [plan-20260621.md](plan-20260621.md)         | 2026-06-21 | ✅ 完成（R04：迁移缺表、日历结局角标、电影增量同步）      |
| [plan-20260622.md](plan-20260622.md)         | 2026-06-22 | ✅ 全部完成（收藏集级元数据；2026-07-07 对账补记）        |
| [plan-20260702.md](plan-20260702.md)         | 2026-07-02 | ✅ 全部完成（取消拆分永不/推迟 + 自动删除总开关）         |
| [plan-20260705.md](plan-20260705.md)         | 2026-07-05 | ✅ 全部完成（N5 分阶段 T02–T09，T10 转入 N6）             |
| [plan-20260706.md](plan-20260706.md)         | 2026-07-06 | 🗂 进行中（N6 四批：T10+单测 / 工程卫生 / 备份 / 移动端） |

## Status legend

- `[ ]` not started · `[x]` done · `[~]` partially done / intentionally scoped down (with rationale).
