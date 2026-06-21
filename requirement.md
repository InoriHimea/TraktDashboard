# Trakt Dashboard — 需求基线

> 最后更新：2026-06-21（v0.66.2）

---

## 产品定位

以 Trakt.tv 为数据源的个人媒体追踪仪表盘，支持 Google Drive / WebDAV 备份、Jellyfin 播放状态同步、本地收藏档案管理。

---

## 核心功能模块

### F01 — 认证与用户管理

- Trakt OAuth 设备码登录
- 单用户模型；API 所有路由均需 userId 中间件

### F02 — 历史记录（History）

- 拉取 Trakt 观看历史并本地存档
- CSV 导入（电影 / 剧集）；导入时按 N 条 chunk 批量事务
- 剧集标题匹配用 `lower()=lower()` 精确等值，避免 LIKE 通配符误匹配

### F03 — 评分（Ratings）

- 拉取 Trakt 评分；前端 StarRating 组件（`useId()` 防 SVG 渐变 id 碰撞）
- PUT show 分支 tmdb 为 null 时不向 Trakt 发送空值

### F04 — 收藏（Collection）

- 语义：**本地无限永久存档**；Trakt 为受 100 条上限约束的可同步子集
    - 拉取（Trakt → 本地）：增量**只增不删**（Trakt 端删除 → 本地保留）
    - 删除（本地 → Trakt）：本地删某条 → 同步调用 Trakt 移除该条
    - 自动化：并入定时增量同步（scheduler → `syncUserCollection`）
- `GET /collection`：只返回 show/movie 级行（`season IS NULL`）
- `GET /collection/check`：NaN 守卫；`season IS NULL` 一致语义
- `DELETE /collection/:id`：NaN 守卫；`season IS NULL AND episode IS NULL` 才调 Trakt 移除；catch-all 错误（网络超时不阻断本地删除）
- `POST /collection/clear-remote`：`isNull(season)` 去重

### F05 — 列表（Lists）

- Trakt 用户自定义列表拉取与本地缓存
- `POST /lists/:id/items`：重复添加 `onConflictDoNothing`，返回 200

### F06 — 笔记（Notes）

- PUT 并发写：事务级 `pg_advisory_xact_lock(hashtext(key))` 序列化
- season/episode 允许 0（Specials）；空串参数不解析为 0

### F07 — Jellyfin 集成

- 拉取活跃会话；按配置的 Jellyfin 用户过滤（避免误读他人播放）
- 播放完成 → 自动打点 Trakt

### F08 — 备份（Backup）

**Google Drive**

- OAuth 设备码流程；`access_denied`/`expired_token` 等错误返回 400
- 上传文件夹 TOCTOU：re-list + `orderBy=createdTime` 取最旧 ID 收敛
- GDrive refresh_token 缺失时保留已存值

**WebDAV**

- 路径遍历防护：直接检查 encoded pathname（不 decodeURIComponent）
- fileId 限定在备份目录前缀内

**dumpDatabase**

- 5 分钟超时（SIGTERM pg_dump）
- gzip 空包守卫：`buf.length < 100`（gzip 固定 ≥20B header）
- SettingsPage GDrive 轮询 timer：`useRef` 镜像 + 空依赖 cleanup effect

### F09 — 定时同步（Scheduler）

- `triggerIncrementalSync`：history / ratings / collection / lists / jellyfin
- collection 同步 best-effort，失败仅 warn 不阻断主流程

### F10 — 数据库迁移

- Drizzle ORM；`_journal.json` 管理 0000–0017
- 所有迁移 SQL 幂等（`CREATE TABLE/INDEX IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`）
- journal 按 `when` 时间戳排序；新迁移必须同步登记 journal

---

## 非功能需求

| 项目     | 要求                                                        |
| -------- | ----------------------------------------------------------- |
| 运行时   | Bun（API）/ Node.js ≥20（构建工具）                         |
| 框架     | Hono（API）/ React 18（Web）                                |
| DB       | PostgreSQL；Drizzle ORM 0.45.x                              |
| 版本管理 | Conventional Commits；fix→patch, feat→minor, breaking→major |
| 提交后   | release hook 自动 bump version + tag + push origin + github |
| 测试     | `pnpm test`（118 用例）全绿；`pnpm typecheck` 零错误        |

---

## 已知遗留 / 后续可选

- episode 级收藏存档（目前只存 show/movie 级，episode 级为可选增强）
- 15 个存量 ESLint error（非本项目引入，待独立清理）
- WebDAV 多层文件夹路径遍历的更完整防护（目前 encoded-pathname check）
