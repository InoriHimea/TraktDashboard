# Trakt Dashboard — Requirements

Living spec of the current functional and non-functional requirements. Last reviewed: 2026-06-16.

## Product

A self-hosted TV-show and movie progress tracker powered by Trakt + TMDB. Single-user oriented,
privacy-first (data stays on the user's server).

## Functional requirements

- **Auth** — Trakt OAuth login; session cookie + JWT; logout.
- **Shows** — list with progress (filter watching/completed/all, search); show detail with
  season/episode breakdown; episode detail; reset-show progress (reset cursor).
- **Movies** — watched movie library with rewatch counts and last-watched dates; movie detail.
- **Watchlist** — two-way sync with Trakt (Trakt is source of truth on periodic reconcile).
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
  unsubscribe() failure during key rotation is swallowed so the user is never permanently
  wedged — stale endpoint is auto-pruned on next 404/410 from airing-reminders;
  airing-reminder Promise.all per-subscription sends individually caught so one sendPush
  rejection does not abort the entire user batch.
- **Correctness** — reset cursor applied consistently to count / next-episode / lastWatchedAt;
  null-safe timestamp serialization; required `userId` for episode creation.
- **Performance** — stale-while-revalidate metadata cache with per-source TTLs; next-episode via
  `NOT EXISTS` anti-join; route-split web bundles.
- **Security** — self-hosted; DB/Redis bound to loopback; nginx security headers + CSP
  (report-only); secrets via env; CSV export sanitizes formula-injection triggers (space-prefix
  when first char is =+-@, consistent detection and prefix on same string);
  push subscription capped at 10 per user (429 on overflow; same-endpoint re-subscribe
  excluded from count so VAPID-rotation re-register is never blocked);
  airing-reminder title correct for same-show multi-episode airings (no "+0");
  airing-reminder body overflow indicated with "+N" when episodes exceed 4-item display cap;
  SW clients.claim() inside waitUntil, guaranteed even when cache cleanup fails;
  SW install: cache failure causes install to fail (old SW stays active); skipWaiting
  only fires after successful shell cache write;
  SW navigate fetch cache.put is fire-and-forget with explicit error swallow;
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

| 编号   | 描述                                                                                                                    | 来源                       |
| ------ | ----------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| N1-T01 | 将 HTTP 超时从 `Promise.race` 升级为真正的 `AbortController` 取消，覆盖 `providerFetch` / Trakt / TMDB                  | plan-20260608 P1-T02 `[~]` |
| N1-T02 | 完成 Hono RPC hook 逐路由迁移——将 `apps/web/src/hooks/index.ts` 中仍使用手写 `api.ts` 的 hook 切换为 typed `rpc` client | plan-20260608 P1-T12 `[~]` |
| N1-T03 | 将 nginx CSP 从 `Content-Security-Policy-Report-Only` 升级为强制执行模式，补全 `nonce` 或 `hash` 白名单                 | plan-20260608 P2-T08 `[~]` |
| N1-T04 | 补充 Calendar 路由回归测试（`calendar.test.ts`），覆盖 `watched` 标志、越界日期范围、空结果分支                         | plan-20260608 P1-T13 `[~]` |

### N2 — 功能增强

| 编号   | 描述                                                                                                             | 优先级 |
| ------ | ---------------------------------------------------------------------------------------------------------------- | ------ |
| N2-T01 | **Watchlist 专属 UI 页面** — 当前 Watchlist API 已实现，缺少独立浏览页面；支持添加/移除、按类型（剧集/电影）筛选 | 高     |
| N2-T02 | **观看历史时间轴** — 全局跨剧集/电影的倒序时间轴视图；支持按日期范围筛选、导出 CSV                               | 高     |
| N2-T03 | **统计页增强** — 新增：播放平台/来源分布、连续追剧节奏分析、年度/月度对比、最长连续观看记录                      | 中     |
| N2-T04 | **电影详情页 Watch Again 弹窗** — `MovieDetailPage` 缺少与 `EpisodeDetailPage` 对等的「再看一次」日期时间选择器  | 中     |
| N2-T05 | **新番提醒** ✅ — Web Push 播出提醒已实现（v0.50.x）；v0.50.3 修复 TTL/SUBJECT/状态同步等 13 项审查问题          | 已完成 |
| N2-T06 | **数据导出** ✅ — CSV/JSON 导出已实现（v0.50.x）；v0.50.3 修复 CSV Injection sanitizer                           | 已完成 |

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
| N4-T01 | **PWA 支持** — Service Worker + Web App Manifest，实现主屏安装与离线壳页（内容仍需在线）                       | 中     |
| N4-T02 | **Docker 健康检查 smoke test** — 在 CI 中用 `docker compose up --wait` 验证容器启停（当前仅校验 compose 结构） | 中     |
| N4-T03 | **Observability 持久化** — 当前同步指标存进程内存；引入轻量 SQLite 表或日志文件持久化 last-N 次同步摘要        | 低     |
| N4-T04 | **依赖自动更新** — 接入 Renovate Bot，按主版本/次版本分组 PR，与 CI 门禁联动                                   | 低     |
