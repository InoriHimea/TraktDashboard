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

| 文件                                         | 日期       | 状态                                                                                                                       |
| -------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| [plan-20260608.md](plan-20260608.md)         | 2026-06-08 | ✅ 全部完成（P0–P3）                                                                                                       |
| [plan-20260612.md](plan-20260612.md)         | 2026-06-12 | ✅ 全部完成（N1–N4 / E1–E2）                                                                                               |
| [plan-20260615.md](plan-20260615.md)         | 2026-06-15 | ✅ 全部完成（10/10 冲刺）                                                                                                  |
| [plan-20260616.md](plan-20260616.md)         | 2026-06-16 | ✅ 全部完成（审查修复 R01–R13，v0.50.3）                                                                                   |
| [plan-20260617.md](plan-20260617.md)         | 2026-06-17 | ✅ 全部完成                                                                                                                |
| [plan-20260617b.md](plan-20260617b.md)       | 2026-06-17 | ✅ 全部完成                                                                                                                |
| [plan-20260617c.md](plan-20260617c.md)       | 2026-06-17 | ✅ 全部完成                                                                                                                |
| [plan-20260617d.md](plan-20260617d.md)       | 2026-06-17 | ✅ 全部完成                                                                                                                |
| [plan-20260617e.md](plan-20260617e.md)       | 2026-06-17 | ✅ 全部完成（Jellyfin 集成）                                                                                               |
| [plan-20260619.md](plan-20260619.md)         | 2026-06-19 | ✅ 全部完成（审查修复 R01–R15）                                                                                            |
| [plan-20260619-001.md](plan-20260619-001.md) | 2026-06-19 | ✅ 全部完成（F01–F12；2026-07-07 对账补记）                                                                                |
| [plan-20260621.md](plan-20260621.md)         | 2026-06-21 | ✅ 完成（R04：迁移缺表、日历结局角标、电影增量同步）                                                                       |
| [plan-20260622.md](plan-20260622.md)         | 2026-06-22 | ✅ 全部完成（收藏集级元数据；2026-07-07 对账补记）                                                                         |
| [plan-20260702.md](plan-20260702.md)         | 2026-07-02 | ✅ 全部完成（取消拆分永不/推迟 + 自动删除总开关）                                                                          |
| [plan-20260705.md](plan-20260705.md)         | 2026-07-05 | ✅ 全部完成（N5 分阶段 T02–T09，T10 转入 N6）                                                                              |
| [plan-20260706.md](plan-20260706.md)         | 2026-07-06 | ✅ 全部完成（N6 四批：T10+单测 / 工程卫生 / 备份诊断+恢复 / 移动端；遗留：Gotify token、恢复生产演练）                     |
| [plan-20260712.md](plan-20260712.md)         | 2026-07-12 | ✅ 全部完成（N3-T02 覆盖率回升第一批 + N1-T04 对账 + 回顾补记的 trakt/discover/search/img/auth；api 22%→41%、web 22%→26%） |
| [plan-20260713.md](plan-20260713.md)         | 2026-07-13 | ✅ 全部完成（N3-T02 覆盖率回升第三批六批次：jellyfin service+route、backup 四云 provider+dump/restore+route；api 41%→65%） |
| [plan-20260714.md](plan-20260714.md)         | 2026-07-14 | ✅ 全部完成（N3-T02 覆盖率回升第四批：lib/push.ts + services/tmdb.ts + jobs/scheduler.ts；api 65%→70%）                    |
| [plan-20260715.md](plan-20260715.md)         | 2026-07-15 | ✅ 全部完成（N3-T02 覆盖率回升第五批：sync.ts/trakt.ts/shows.ts/history.ts 十个批次全部完成；api 69.6%→85.8%）             |
| [plan-20260715b.md](plan-20260715b.md)       | 2026-07-15 | ✅ 全部完成（N3-T02 覆盖率回升第六批：web 侧，13 个批次全部完成；web 25.5%→86.2%）                                         |
| [plan-20260718.md](plan-20260718.md)         | 2026-07-18 | 🚧 进行中（N2-T17：Trakt 观看历史重复记录审计与清理，2 个批次）                                                            |

## Status legend

- `[ ]` not started · `[x]` done · `[~]` partially done / intentionally scoped down (with rationale).
