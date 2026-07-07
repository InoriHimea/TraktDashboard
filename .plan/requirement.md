# Trakt Dashboard — Requirements

Living spec of the current functional and non-functional requirements. Last reviewed: 2026-06-21.

## Product

A self-hosted TV-show and movie progress tracker powered by Trakt + TMDB. Single-user oriented,
privacy-first (data stays on the user's server).

## Functional requirements

- **Auth** — Trakt OAuth login; session cookie + JWT; logout.
- **Shows** — list with progress (filter watching/completed/all, search); show detail with
  season/episode breakdown; episode detail; reset-show progress (reset cursor).
- **Movies** — watched movie library with rewatch counts and last-watched dates; movie detail.
- **Watchlist** — two-way sync with Trakt (Trakt is source of truth on periodic reconcile).
- **Collection** — local DB is an **unbounded, add-only archive**; Trakt is the capped (≤100) syncable
  subset. Pull (Trakt → local) is incremental and never deletes local rows (items dropped from
  Trakt — including cap eviction — are retained locally). Delete (local → Trakt) propagates: removing
  a local item also removes it from the Trakt collection. Show collection captures episode-level rows
  with media format metadata. Sync runs automatically inside the scheduled incremental sync.
- **Calendar** — upcoming/recent episodes within a bounded window (≤90 days each direction),
  grouped by air date, showing watched status.
- **Stats** — monthly watch charts, top genres, totals (episodes/movies/runtime).
- **Sync** — initial full sync; scheduled incremental sync (episodes + movies + watchlist);
  manual trigger; status + diagnostics (`/sync/status`, `/sync/health`).
- **Settings** — display language, sync interval, HTTP proxy.
- **i18n** — bilingual UI (zh-CN / en-US) + multilingual TMDB content resolution.

## Non-functional requirements

- **Reliability** — per-user sync mutex; OAuth refresh concurrency-safe; provider HTTP retry
  with backoff + Retry-After; per-provider rate limiting; queue health → 503 (no fake success);
  BullMQ jobs must re-throw on failure (not swallow) so failed status and retries apply;
  repeatable-job upsert: remove step is best-effort, add step always executes;
  Web Push TTL ≥ 86400 s so offline devices receive daily reminders;
  VAPID applicationServerKey compared on re-subscribe — stale subscription unsubscribed and
  refreshed on key rotation so pushes do not silently fail;
  unsubscribe() failure during key rotation re-checks getSubscription(): if the browser
  retained the local record, throws "push-rotation-blocked" (UI shows retry prompt) rather
  than calling subscribe() which would throw InvalidStateError per W3C Push §4.3;
  if the browser cleaned up the record despite throwing, subscribe() proceeds normally;
  stale endpoint auto-pruned on next 404/410 from airing-reminders;
  airing-reminder Promise.all per-subscription sends individually caught so one sendPush
  rejection does not abort the entire user batch.
- **Correctness** — reset cursor applied consistently to count / next-episode / lastWatchedAt;
  null-safe timestamp serialization; required `userId` for episode creation;
  air_date stored as full ISO timestamp — all SQL comparisons must use `LEFT(air_date, 10)`
  to avoid today's episodes being excluded from progress/calendar due to timestamp > date-string ordering;
  incremental sync cursor rollback covers both episode AND movie failures;
  mark-watched `alreadyWatched` count scoped to the target season only;
  Trakt pagination header validated with `Number.isFinite` guard before use.
- **Performance** — stale-while-revalidate metadata cache with per-source TTLs; next-episode via
  `NOT EXISTS` anti-join; route-split web bundles.
- **Security** — self-hosted; DB/Redis bound to loopback; nginx security headers + CSP
  (report-only); secrets via env; CSV export sanitizes formula-injection triggers (space-prefix
  when first char is =+-@, consistent detection and prefix on same string);
  `jellyfinApiKey` encrypted at rest (AES-256-GCM via `encryptToken`) and masked as `"***"` in API responses;
  `start` script sets `NODE_ENV=production` so missing `API_SECRET` causes a hard fail (no dev-fallback secret in prod);
  `runMigrations()` failure exits the process rather than serving requests on a broken schema;
  Jellyfin auto-delete scoped to configured library IDs via per-library `ParentId` queries — never touches
  other libraries (`AncestorIds` is silently IGNORED by Jellyfin 10.11 /Items and must not be relied on;
  `AnyProviderIdEquals` returns unfiltered results — all provider-id matching is done client-side);
  push subscription capped at 10 per user (429 on overflow; same-endpoint re-subscribe
  excluded from count so VAPID-rotation re-register is never blocked);
  airing-reminder title correct for same-show multi-episode airings (no "+0");
  airing-reminder body overflow indicated with "+N" when episodes exceed 4-item display cap;
  SW clients.claim() inside waitUntil, guaranteed even when cache cleanup fails;
  SW install: cache failure causes install to fail (old SW stays active); skipWaiting
  only fires after successful shell cache write;
  SW navigate fetch cache.put is fire-and-forget with explicit error swallow;
  SW static-asset cache-miss fetch has explicit offline fallback (Response.error()) instead of propagating unhandled rejection;
  push enable-path failure sets pushEnabled=false (not re-sync) so UI cannot show
  "enabled" when the backend has no subscription record.
- **Quality gates** — CI runs lint (eslint + prettier) + typecheck + build + coverage tests;
  coverage floors enforced.

## Constraints

- Runtime: Bun (API runs TypeScript source, no build step); React 19 + Vite (web).
- Workspace packages (`types`, `db`, `i18n`) are source-resolved and workspace-internal.
- Deployment: Docker Compose (postgres, redis/keydb, api, web/nginx).
- Versioning: fixed root version, all packages aligned (SemVer; patch for fixes, minor for features).

---

## 下一步路线图（截至 2026-06-12）

> 当前已完成：plan-20260608（P0–P3 全部）、episode-detail-page、tv-shows-and-movies-separation。
> 以下为建议的后续迭代方向，按优先级排列。

### N1 — 技术债清偿（遗留 `[~]` 项）

| 编号   | 描述                                                                                                                                                                                                       | 来源                       |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| N1-T01 | 将 HTTP 超时从 `Promise.race` 升级为真正的 `AbortController` 取消，覆盖 `providerFetch` / Trakt / TMDB                                                                                                     | plan-20260608 P1-T02 `[~]` |
| N1-T02 | ~~完成 Hono RPC hook 逐路由迁移~~ **已放弃（2026-07-06，N5-T09 决策）**：rpc client 创建后零采用，完成迁移需重写全部路由为链式写法 + 迁移 76+ 调用点，收益不抵成本；`api.ts` + 共享 types 包为唯一正式方案 | plan-20260608 P1-T12 `[~]` |
| N1-T03 | 将 nginx CSP 从 `Content-Security-Policy-Report-Only` 升级为强制执行模式，补全 `nonce` 或 `hash` 白名单                                                                                                    | plan-20260608 P2-T08 `[~]` |
| N1-T04 | 补充 Calendar 路由回归测试（`calendar.test.ts`），覆盖 `watched` 标志、越界日期范围、空结果分支                                                                                                            | plan-20260608 P1-T13 `[~]` |

### N2 — 功能增强

| 编号   | 描述                                                                                                             | 优先级 |
| ------ | ---------------------------------------------------------------------------------------------------------------- | ------ |
| N2-T01 | **Watchlist 专属 UI 页面** — 当前 Watchlist API 已实现，缺少独立浏览页面；支持添加/移除、按类型（剧集/电影）筛选 | 高     |
| N2-T02 | **观看历史时间轴** — 全局跨剧集/电影的倒序时间轴视图；支持按日期范围筛选、导出 CSV                               | 高     |
| N2-T03 | **统计页增强** — 新增：播放平台/来源分布、连续追剧节奏分析、年度/月度对比、最长连续观看记录                      | 中     |
| N2-T04 | **电影详情页 Watch Again 弹窗** ✅ — `MovieDetailPage.tsx:585` 已实现 DateTimePickerModal                        | 已完成 |
| N2-T05 | **新番提醒** ✅ — Web Push 播出提醒已实现（v0.50.x）；v0.50.3 修复 TTL/SUBJECT/状态同步等 13 项审查问题          | 已完成 |
| N2-T06 | **数据导出** ✅ — CSV/JSON 导出已实现（v0.50.x）；v0.50.3 修复 CSV Injection sanitizer                           | 已完成 |
| N2-T07 | **播出提醒分级** — 首播(S1E1) / 回归季(SxE1) / 季终 三类事件可单独开关；detail: plan-20260619-001 F02            | 高     |
| N2-T08 | **统计热力图 & 习惯分析** — GitHub 风格 52×7 观看热力图 + 星期分布图；detail: plan-20260619-001 F03              | 中     |
| N2-T09 | **全局搜索 + 一键加入** — 顶栏搜索调 Trakt/TMDB，结果直接加 Watchlist；detail: plan-20260619-001 F04             | 高     |
| N2-T10 | **接着看 / Up Next 面板** — 跨剧下一集队列，复用已算好的 nextEpisodeId；detail: plan-20260619-001 F05            | 高     |
| N2-T11 | **我的评分写入 + 评分统计** — 写回 Trakt /sync/ratings，Stats 新增评分分布图；detail: plan-20260619-001 F06      | 中     |
| N2-T12 | **Jellyfin 正在播放联动** — 读 Jellyfin Sessions，一键「追平进度」；detail: plan-20260619-001 F07                | 中     |
| N2-T13 | **发现页（Trending / 推荐）** — Trakt trending + recommendations，卡片直接加 Watchlist；F08                      | 中     |
| N2-T14 | **集级笔记** — 本地私人观后感，episodeId/movieId 绑定，支持导出；F09                                             | 低     |
| N2-T15 | **自定义列表** — 双向同步 Trakt /users/me/lists；F10                                                             | 低     |
| N2-T16 | **数据导入** — JSON 格式观看历史导入，与导出对称；F12                                                            | 低     |

### N3 — 测试与质量

| 编号   | 描述                                                                                                                            | 优先级 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------- | ------ |
| N3-T01 | **E2E 测试（Playwright）** — 覆盖核心路径：登录 → 同步 → 剧集列表 → 剧集详情 → 标记已看；电影路径同理                           | 高     |
| N3-T02 | **提升覆盖率阈值** — API lines 目标 40%（当前 ~28% floor），web lines 目标 20%（当前 ~13% floor）                               | 中     |
| N3-T03 | **Movies API 属性测试** — 补充 `apps/api/src/services/__tests__/movies.property.test.ts`（kiro spec 中已规划但标记为 optional） | 中     |
| N3-T04 | **MovieCard 快照/视觉回归** — 在现有 property test 基础上增加 `@storybook/test-runner` 或 Percy 截图比对                        | 低     |

### N4 — 基础设施与运维

| 编号   | 描述                                                                                                           | 优先级 |
| ------ | -------------------------------------------------------------------------------------------------------------- | ------ |
| N4-T01 | **PWA 支持** — manifest.json + SW precache 壳页；detail: plan-20260619-001 F11                                 | 中     |
| N4-T02 | **Docker 健康检查 smoke test** — 在 CI 中用 `docker compose up --wait` 验证容器启停（当前仅校验 compose 结构） | 中     |
| N4-T03 | **Observability 持久化** — 当前同步指标存进程内存；引入轻量 SQLite 表或日志文件持久化 last-N 次同步摘要        | 低     |
| N4-T04 | **依赖自动更新** — 接入 Renovate Bot，按主版本/次版本分组 PR，与 CI 门禁联动                                   | 低     |

### N5 — Jellyfin 自动删除迭代（2026-07-02 巡检后规划）

已实现（v0.80–v0.82）：两段式队列（标记→次日删）、7 天季度缓冲（用户确认保留）、入队前
Jellyfin 存在性校验（限定勾选库）、设置页队列/历史面板、卡片待删除角标、取消拆分
（永不删除/推迟 7 天，条目粒度）、排除列表管理、剧集详情页永不删除开关、自动删除总开关
（默认关闭）。

| 编号   | 描述                                                                                                                                                                                                                                                            | 优先级 |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| N5-T01 | **已诊断：DELETE 500 = Jellyfin UserData 墓碑约束 bug（jellyfin#16975/#15343，修复 PR#16062 仅随 12.0 发布，不回落 10.11.x）** — 文件删除成功后 DB 清理失败留幽灵条目并中断扫描 cleanup；用户 10.11.11（群辉）无升级解法，仅能手动 SQL 清理                     | 高     |
| N5-T10 | ✅ **10.11 适配：Phase 2 遇 500 自动 defer 7 天并在历史标注"文件可能已删（jellyfin#16975）"** — 四个删除点统一 classify，500 时写 defer 排除并阻断同轮重新入队；历史面板显示 errorMessage；判定逻辑提纯至 jellyfin-auto-delete-rules.ts 并补单测；12.0 后可移除 | 已完成 |
| N5-T02 | ✅ **队列条目"立即删除"按钮** — 新增 `deleteQueueEntryNow` + `POST /jellyfin/delete-queue/:id/now`，设置页按钮走 ConfirmDialog 二次确认，不等次日定时任务                                                                                                       | 已完成 |
| N5-T03 | ✅ **删除前 Web Push 提醒** — Phase 1 新入队（非重复入队）时按 displayLanguage 推送"X 将于明天删除"，VAPID 未配置时整段跳过                                                                                                                                     | 已完成 |
| N5-T04 | ✅ **电影自动删除** — 已看完（watch_history 存在记录）+ 最近一次观看满 30 天自动入队；复用现有总开关，`deleteQueueEntryNow`/推迟/永不/推送提醒全部同步支持电影                                                                                                  | 已完成 |
| N5-T05 | ✅ **修复 upsertRepeatableJob 去重** — 改用 BullMQ upsertJobScheduler（原子 update-in-place），启动时一次性 purgeLegacyRepeatableJobs 清理历史重复项                                                                                                            | 已完成 |
| N5-T06 | ✅ **清理死代码 SyncPage.tsx**（36K，/sync 已重定向设置页）— 顺带清理仅它使用的 10 个 `sync.*` i18n key + 孤立的 `nav.sync` key                                                                                                                                 | 已完成 |
| N5-T07 | ✅ **设置页拆分页签** — 拆为 常规/Jellyfin/通知/备份 四页签（pages/settings/\*Tab.tsx + 通用 Tabs 组件），SettingsPage 转纯容器，逻辑零改动；保存按钮全局常驻                                                                                                   | 已完成 |
| N5-T08 | ✅ **显示语言改下拉框** — 12 个常用语言（本族名称标注），已保存的非列表值动态保留为选项，不静默改动用户设置                                                                                                                                                     | 已完成 |
| N5-T09 | ✅ **完成或放弃 N1-T02 RPC 迁移** — 用户确认放弃：删除零引用的 rpc.ts / AppType 导出 / app-type 包导出，web 移除 @trakt-dashboard/api 与 hono 依赖；api.ts + 共享 types 为唯一正式方案                                                                          | 已完成 |
