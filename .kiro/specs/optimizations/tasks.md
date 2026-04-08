# 实现任务列表

## Task 1: 安全加固 — API_SECRET 强制校验

- [x] 1.1 修改 `apps/api/src/middleware/auth.ts`，在模块顶部添加启动时校验逻辑：若 `API_SECRET` 未设置或长度 < 32，抛出错误终止进程，移除 fallback secret

## Task 2: 安全加固 — Token 刷新分布式锁

- [x] 2.1 在 `apps/api/src/jobs/scheduler.ts` 中将 `getRedis()` 导出为具名导出
- [x] 2.2 修改 `apps/api/src/services/trakt.ts`，在 `refreshToken` 函数中使用 Redis `SET NX EX 30` 实现分布式锁，锁获取失败时等待 500ms 后重试（最多 10 次），超时后从数据库重新读取最新 token 返回

## Task 3: 安全加固 — 修复 getHistory 绕过 token 刷新

- [x] 3.1 修改 `apps/api/src/services/trakt.ts`，新增 `traktFetchRaw` 方法同时返回 data 和 response headers
- [x] 3.2 将 `getHistory` 方法重构为使用 `traktFetchRaw`，移除内部直接读取数据库 token 的逻辑

## Task 4: 性能优化 — shows/progress 接口分页

- [x] 4.1 修改 `apps/api/src/routes/shows.ts` 中的 progress 路由，支持 `limit`（默认 50，最大 200）和 `offset` 查询参数，响应体包含 `total`、`limit`、`offset`
- [x] 4.2 修改 `apps/web/src/lib/api.ts` 中的 `shows.progress` 方法，接受可选的 `limit` 和 `offset` 参数
- [x] 4.3 修改 `apps/web/src/hooks/index.ts` 中的 `useShowsProgress`，接受分页参数并将其加入 queryKey

## Task 5: 性能优化 — 调度器改用 BullMQ repeat job

- [x] 5.1 修改 `apps/api/src/jobs/scheduler.ts`，移除 `setInterval`，改用 BullMQ `repeat` 选项创建周期性 job，使用 `jobId: sync-user-${userId}` 保证幂等性
- [x] 5.2 导出 `registerUserSyncJob(userId)` 函数，供新用户注册时调用
- [x] 5.3 修改 `apps/api/src/routes/auth.ts` 中的 OAuth callback，在用户首次创建后调用 `registerUserSyncJob`

## Task 6: 数据可靠性 — 修复 watch_history 重复数据

- [x] 6.1 修改 `packages/db/src/schema.ts`，在 `watchHistory` 表上添加 `(userId, episodeId, watchedAt)` 联合唯一索引 `watch_history_dedup_idx`
- [x] 6.2 手动创建迁移文件 `packages/db/drizzle/0001_optimizations.sql`
- [x] 6.3 修改 `apps/api/src/services/sync.ts` 中 `syncEpisodeProgress` 的 insert 语句，将 `onConflictDoNothing()` 改为基于联合唯一索引的冲突处理

## Task 7: 数据可靠性 — 同步失败记录

- [x] 7.1 修改 `packages/db/src/schema.ts`，在 `syncState` 表中新增 `failedShows` jsonb 字段
- [x] 7.2 迁移文件 `0001_optimizations.sql` 中包含对应 ALTER TABLE
- [x] 7.3 修改 `apps/api/src/services/sync.ts` 中的 `triggerFullSync`，收集每个 show 的失败信息，同步完成后写入 `failedShows` 字段
- [x] 7.4 修改 `apps/api/src/routes/sync.ts` 的 status 接口，响应中包含 `failedShows` 字段

## Task 8: 数据可靠性 — 外部 API 429 重试

- [x] 8.1 在 `apps/api/src/services/trakt.ts` 中封装 `fetchWithRetry`，遇到 429 时读取 `Retry-After` header 等待后重试，最多 3 次
- [x] 8.2 `traktFetch` 内部使用 `fetchWithRetry`
- [x] 8.3 在 `apps/api/src/services/tmdb.ts` 中同样引入 `fetchWithRetry`

## Task 9: 前端类型安全 — 定义共享类型

- [x] 9.1 在 `packages/types/src/index.ts` 中新增 `SyncState.failedShows`、`StatsOverview`、更新 `PaginatedResponse`
- [x] 9.2 修改 `apps/web/src/lib/api.ts`，导入具体类型，替换所有 `any`
- [x] 9.3 修改 `apps/web/src/hooks/index.ts`，更新各 hook 的返回类型
