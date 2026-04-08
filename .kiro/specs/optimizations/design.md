# 优化设计文档

## 参考文件

#[[file:apps/api/src/middleware/auth.ts]]
#[[file:apps/api/src/services/trakt.ts]]
#[[file:apps/api/src/services/sync.ts]]
#[[file:apps/api/src/jobs/scheduler.ts]]
#[[file:packages/db/src/schema.ts]]
#[[file:apps/web/src/lib/api.ts]]
#[[file:apps/web/src/hooks/index.ts]]
#[[file:packages/types/src/index.ts]]

---

## 1. 安全加固

### 1.1 API_SECRET 强制校验

在 `apps/api/src/middleware/auth.ts` 顶部添加启动校验：

```typescript
const rawSecret = process.env.API_SECRET
if (!rawSecret || rawSecret.length < 32) {
  throw new Error('[auth] API_SECRET must be set and at least 32 characters long')
}
const secret = new TextEncoder().encode(rawSecret)
```

模块加载时即触发，进程无法启动，避免弱密钥上线。

### 1.2 Token 刷新分布式锁

复用 `scheduler.ts` 中已有的 `getRedis()` 获取 ioredis 实例，在 `trakt.ts` 中实现锁：

```
refreshToken(userId):
  lockKey = `lock:token-refresh:${userId}`
  acquired = redis.SET lockKey "1" NX EX 30
  if not acquired:
    wait 500ms, retry up to 10 times
    re-read token from DB (another process refreshed it)
    return fresh token
  try:
    do refresh
  finally:
    redis.DEL lockKey
```

`getRedis()` 从 `scheduler.ts` 导出供 `trakt.ts` 复用，避免重复创建连接。

### 1.3 getHistory 统一走 traktFetch

当前 `getHistory` 内部直接 `fetch` + 手动读 token。重构为：

```typescript
getHistory: async (userId, startAt) => {
  const all = []
  let page = 1
  while (true) {
    const params = { limit: '100', page: String(page), ...(startAt && { start_at: startAt }) }
    // 复用 traktFetch，自动处理 token 刷新
    const { data, headers } = await traktFetchWithHeaders('/sync/history/episodes', userId, params)
    all.push(...data)
    const pageCount = parseInt(headers.get('X-Pagination-Page-Count') || '1')
    if (page >= pageCount) break
    page++
  }
  return all
}
```

需要 `traktFetch` 同时返回 response headers，或单独封装一个 `traktFetchRaw`。

---

## 2. 性能优化

### 2.1 shows/progress 分页

路由层变更（`apps/api/src/routes/shows.ts`）：

```typescript
const { filter = 'watching', q = '', limit = '50', offset = '0' } = c.req.query()
const limitNum = Math.min(parseInt(limit), 200)
const offsetNum = parseInt(offset)

// 查询加 .limit(limitNum).offset(offsetNum)
// 同时查 count(*) 获取 total

return c.json({ data, total, limit: limitNum, offset: offsetNum })
```

前端 `useShowsProgress` 接受可选的 `{ limit, offset }` 参数，queryKey 包含分页参数。

### 2.2 BullMQ Repeat Job

`scheduler.ts` 重构：

```typescript
// 启动时为每个用户注册 repeat job
async function registerUserSyncJob(userId: number) {
  await queue.add(
    'incremental-sync',
    { userId },
    {
      jobId: `sync-user-${userId}`,  // 幂等，重复调用不会重复入队
      repeat: { every: intervalMinutes * 60 * 1000 },
      removeOnComplete: 10,
      removeOnFail: 5,
    }
  )
}

export async function startScheduler() {
  // 启动 worker
  // 为所有现有用户注册
  const allUsers = await db.select({ id: users.id }).from(users)
  for (const user of allUsers) {
    await registerUserSyncJob(user.id)
  }
}

// 新用户登录后调用
export { registerUserSyncJob }
```

`auth` 路由的 OAuth callback 中，创建用户后调用 `registerUserSyncJob(userId)`。

---

## 3. 数据可靠性

### 3.1 watch_history 联合唯一索引

Schema 变更：

```typescript
export const watchHistory = pgTable('watch_history', {
  // ...现有字段不变
}, (t) => [
  // 保留现有索引
  index('watch_history_user_idx').on(t.userId),
  index('watch_history_episode_idx').on(t.episodeId),
  index('watch_history_watched_at_idx').on(t.watchedAt),
  // 新增：去重用联合唯一索引（精确到分钟，避免同一集多次观看被误去重）
  uniqueIndex('watch_history_dedup_idx').on(t.userId, t.episodeId, t.watchedAt),
])
```

`syncEpisodeProgress` 中的 insert 改为：
```typescript
.onConflictDoNothing({ target: [watchHistory.userId, watchHistory.episodeId, watchHistory.watchedAt] })
```

需运行 `pnpm db:generate` 生成迁移文件。

### 3.2 同步失败记录

Schema 变更（`syncState` 表新增字段）：

```typescript
failedShows: jsonb('failed_shows').$type<Array<{ tmdbId: number; title: string; error: string }>>().default([]),
```

`triggerFullSync` 中收集失败：

```typescript
const failures: Array<{ tmdbId: number; title: string; error: string }> = []

// 在 catch 块中
failures.push({ tmdbId, title: ws.show.title, error: String(e) })

// 完成后写入
await db.update(syncState).set({ failedShows: failures, ... })
```

### 3.3 429 重试逻辑

封装通用重试 helper：

```typescript
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, options)
    if (res.status !== 429) return res
    if (attempt === maxRetries) return res  // 让调用方处理最终失败
    const retryAfter = parseInt(res.headers.get('Retry-After') || '5')
    await new Promise(r => setTimeout(r, retryAfter * 1000))
  }
  throw new Error('unreachable')
}
```

`traktFetch` 和 `tmdb.ts` 中的 fetch 调用替换为 `fetchWithRetry`。

---

## 4. 前端类型安全

### 4.1 packages/types 定义共享接口

`packages/types/src/index.ts` 新增：

```typescript
export interface ShowProgress {
  id: number
  title: string
  posterPath: string | null
  status: string
  watchedEpisodes: number
  airedEpisodes: number
  totalEpisodes: number
  completed: boolean
  lastWatchedAt: string | null
  nextEpisode: { seasonNumber: number; episodeNumber: number; title: string | null } | null
}

export interface SyncStatus {
  status: 'idle' | 'running' | 'completed' | 'error'
  progress: number
  total: number
  currentShow: string | null
  lastSyncAt: string | null
  error: string | null
  failedShows: Array<{ tmdbId: number; title: string; error: string }>
}

export interface StatsOverview {
  totalShows: number
  totalEpisodes: number
  totalRuntime: number
  monthlyActivity: Array<{ month: string; count: number }>
  topGenres: Array<{ genre: string; count: number }>
  recentlyWatched: ShowProgress[]
}

export interface ShowDetail extends ShowProgress {
  overview: string | null
  network: string | null
  firstAired: string | null
  genres: string[]
  backdropPath: string | null
  seasons: SeasonDetail[]
}

export interface SeasonDetail {
  seasonNumber: number
  episodeCount: number
  watchedCount: number
  episodes: EpisodeDetail[]
}

export interface EpisodeDetail {
  episodeNumber: number
  title: string | null
  airDate: string | null
  runtime: number | null
  watched: boolean
  watchedAt: string | null
}
```

`apps/web/src/lib/api.ts` 导入并使用这些类型替换 `any`。

---

## 变更文件汇总

| 文件 | 变更类型 |
|------|---------|
| `apps/api/src/middleware/auth.ts` | 添加启动校验 |
| `apps/api/src/services/trakt.ts` | 锁保护 + getHistory 重构 + 429 重试 |
| `apps/api/src/services/tmdb.ts` | 429 重试 |
| `apps/api/src/services/sync.ts` | 失败收集 |
| `apps/api/src/jobs/scheduler.ts` | 改用 repeat job，导出 getRedis |
| `apps/api/src/routes/shows.ts` | 分页支持 |
| `packages/db/src/schema.ts` | watch_history 联合唯一索引，syncState failedShows 字段 |
| `packages/db/drizzle/` | 新增迁移文件 |
| `packages/types/src/index.ts` | 新增共享类型 |
| `apps/web/src/lib/api.ts` | 替换 any 类型 |
| `apps/web/src/hooks/index.ts` | 分页参数支持，类型更新 |
