# Implementation Plan: Episode Detail Page

## Overview

基于已完成的 requirements.md 和 design.md，将 Episode Detail Page 功能拆解为可增量执行的编码任务。
实现顺序：数据库 Schema → 类型定义 → 后端 API → 前端组件 → 路由注册 → 属性测试。

## Tasks

- [x] 1. 数据库 Schema 变更与迁移
  - 修改 `packages/db/src/schema.ts`：将 `watchHistory.watchedAt` 改为可空（去掉 `.notNull()`），新增 `source` 字段（`'trakt' | 'manual'`，默认 `'manual'`）
  - 新增 `watchResetCursors` 表定义（字段：id、userId、showId、resetAt、createdAt），添加 `wrc_user_show_idx` 和 `wrc_reset_at_idx` 索引
  - 创建迁移文件 `packages/db/drizzle/0004_watch_history_nullable_watched_at.sql`：`ALTER TABLE watch_history ALTER COLUMN watched_at DROP NOT NULL;` + `CREATE TABLE watch_reset_cursors ...`
  - _Requirements: 8.17, 10.3, 10.6_

- [x] 2. 类型定义（packages/types）
  - [x] 2.1 在 `packages/types/src/index.ts` 新增 `EpisodeDetailData` 接口
    - 字段：episodeId、showId、seasonNumber、episodeNumber、title、translatedTitle、overview、translatedOverview、airDate、runtime、stillPath、watched、watchedAt、traktRating、directors、show、seasonEpisodes
    - _Requirements: 2.7_
  - [x] 2.2 新增 `WatchHistoryEntry` 接口
    - 字段：id、episodeId、seasonNumber、episodeNumber、episodeTitle、watchedAt、source
    - _Requirements: 9.5_
  - [x] 2.3 新增 `WatchResetCursor` 接口
    - 字段：id、userId、showId、resetAt
    - _Requirements: 10.3_
- [x] 3. 后端服务层：computeWatchedEpisodes 与 TMDB/Trakt 扩展
  - [x] 3.1 在 `apps/api/src/services/sync.ts`（或新建 `progress.ts`）实现 `computeWatchedEpisodes(db, userId, showId)` 函数
    - 查询最新 WatchResetCursor（取 resetAt 最大值）
    - 若存在游标，过滤条件为 `watchedAt > resetAt OR watchedAt IS NULL`；否则统计全部
    - 返回 `count(distinct episodeId)` 整数
    - _Requirements: 10.4, 10.5_
  - [x] 3.2 在 `apps/api/src/services/tmdb.ts` 新增 `getTmdbEpisodeDetail(tmdbShowId, seasonNumber, episodeNumber, language?, userId?)` 函数
    - 检查 metadataCache（source='tmdb_episode'，TTL 7天）
    - 缓存未命中时调用 TMDB `/tv/{id}/season/{s}/episode/{e}?append_to_response=credits`
    - 从 `credits.crew` 过滤 `job === 'Director'` 提取导演名单
    - 写入 metadataCache，缓存键格式 `tmdb_episode_{tmdbId}_s{s}e{e}_{language}`
    - TMDB 调用失败时降级返回 `{ directors: [], rating: null }`，不抛出异常
    - _Requirements: 2.5, 2.6, 6.3, 6.4_
  - [x] 3.3 在 `apps/api/src/services/trakt.ts` 新增 `getEpisodeRating(traktId, season, episode, userId)` 方法
    - 调用 Trakt `/shows/{traktId}/seasons/{s}/episodes/{e}/ratings`
    - 将 0–10 浮点数转换为 0–100 整数（`Math.round(rating * 10)`）
    - 调用失败时降级返回 `null`
    - _Requirements: 2.7_

- [x] 4. 后端 API 端点（apps/api/src/routes/shows.ts）
  - [x] 4.1 实现 `GET /api/shows/:showId/episodes/:season/:episode`
    - 校验三个路径参数均为正整数，否则返回 400
    - 查询 episodes 表，showId 不存在返回 404，season/episode 不存在返回 404
    - 查询 watchHistory 获取最新观看记录（cursor-aware，调用 computeWatchedEpisodes 逻辑）
    - 调用 getTmdbEpisodeDetail 获取导演（降级处理）
    - 调用 getEpisodeRating 获取 traktRating（降级处理）
    - 查询当前季所有集（含 watched 状态）组装 seasonEpisodes
    - 返回 200 + EpisodeDetailData
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  - [x] 4.2 实现 `POST /api/shows/:showId/episodes/:season/:episode/watch`
    - 校验路径参数，确认 episode 存在
    - 接收请求体 `{ watchedAt: string | null }`
    - INSERT watchHistory（userId、episodeId、watchedAt、source='manual'）
    - 返回 201 + `{ ok: true, historyId }`
    - _Requirements: 8.14, 8.15, 8.16, 8.17_
  - [x] 4.3 实现 `GET /api/shows/:showId/episodes/:season/:episode/history`
    - 查询该集的 watchHistory 记录，按 `watchedAt DESC NULLS LAST` 排序
    - 返回 200 + `{ data: WatchHistoryEntry[] }`
    - _Requirements: 9.4_
  - [x] 4.4 实现 `GET /api/shows/:showId/history`
    - 查询该剧集所有集的 watchHistory，JOIN episodes 过滤 showId
    - 按 `watchedAt DESC NULLS LAST` 排序
    - 返回 200 + `{ data: WatchHistoryEntry[] }`
    - _Requirements: 9.3_
  - [x] 4.5 实现 `DELETE /api/shows/:showId/history/:historyId`
    - 校验 historyId 存在且属于当前 userId，否则返回 404
    - DELETE watchHistory 记录
    - 返回 200 + `{ ok: true }`
    - _Requirements: 9.9_
  - [x] 4.6 实现 `POST /api/shows/:showId/reset`
    - 校验 showId 存在
    - INSERT watchResetCursors（userId、showId、resetAt=NOW()）
    - 调用 computeWatchedEpisodes 重新计算进度
    - 返回 200 + 更新后的 ShowProgress
    - _Requirements: 10.3, 10.4, 10.10_

- [ ] 5. Checkpoint — 后端测试
  - 确保所有后端单元测试通过，如有问题请提出。
- [x] 6. API 客户端扩展（apps/web/src/lib/api.ts）
  - 新增 `api.episodes` 命名空间：`detail`、`watch`、`history` 三个方法
  - 在 `api.shows` 命名空间新增：`history(showId)`、`deleteHistory(showId, historyId)`、`reset(showId)` 三个方法
  - 所有方法使用现有 `request<T>()` 封装，传入正确的 method 和 body
  - _Requirements: 2.1, 9.3, 9.4, 9.9, 10.10_

- [x] 7. React Query Hooks（apps/web/src/hooks/index.ts）
  - [x] 7.1 新增 `useEpisodeDetail(showId, season, episode)` hook
    - queryKey: `['episode-detail', showId, season, episode]`
    - staleTime: 5 分钟；enabled: 三个参数均 > 0
    - _Requirements: 5.1_
  - [x] 7.2 新增 `useMarkWatched(showId, season, episode)` mutation hook
    - onSuccess 时 invalidate `['episode-detail', ...]` 和 `['show-detail', showId]`
    - _Requirements: 8.19_
  - [x] 7.3 新增 `useEpisodeHistory(showId, season, episode)` hook
    - queryKey: `['episode-history', showId, season, episode]`
    - _Requirements: 9.4_
  - [x] 7.4 新增 `useShowHistory(showId)` hook
    - queryKey: `['show-history', showId]`
    - _Requirements: 9.3_
  - [x] 7.5 新增 `useDeleteHistory(showId)` mutation hook
    - onSuccess 时 invalidate episode-history、show-history、episode-detail、show-detail
    - _Requirements: 9.9_
  - [x] 7.6 新增 `useResetProgress(showId)` mutation hook
    - onSuccess 时 invalidate `['show-detail', showId]` 和 `['shows-progress']`
    - _Requirements: 10.7_

- [x] 8. 基础 UI 组件
  - [x] 8.1 创建 `apps/web/src/components/SlidingPanel.tsx`
    - Props: open、onClose、children、title、width（默认 '380px'）
    - 使用 Framer Motion 实现从右侧滑入（x: '100%' → x: 0）
    - 点击遮罩（bg-black/50 backdrop-blur-sm）或按 Escape 触发 onClose
    - _Requirements: 8.2, 8.21, 9.2, 9.11_
  - [x] 8.2 创建 `apps/web/src/components/DateTimePickerModal.tsx`
    - Props: open、onClose、onConfirm(isoString)、defaultValue
    - 居中弹窗，日期时间输入框（本地化格式），左侧装饰日历图标，右侧触发 input[type=datetime-local] 的日历按鈕
    - 默认值为当前日期时间；Cancel → onClose；Mark as Watched → onConfirm(toISOString())
    - _Requirements: 8.4, 8.5, 8.6, 8.7, 8.8, 8.9_

- [x] 9. Watch 操作面板
  - 创建 `apps/web/src/components/WatchActionPanel.tsx`
  - Props: open、onClose、episodeId、showId、seasonNumber、episodeNumber、airDate、onSuccess
  - 视图状态机：`'options' | 'confirm'`
  - options 视图：四个选项按鈕（Just now / Release date / Other date / Unknown date）
    - airDate 为 null 时 Release date 按鈕禁用并展示不可用提示
    - Other date → 打开 DateTimePickerModal（不切换 confirm 视图）
    - Just now / Release date / Unknown date → 切换至 confirm 视图
  - confirm 视图：时间摘要 + Mark as Watched（紫色）+ Cancel（灰色）
    - 调用 useMarkWatched，成功后调用 onSuccess 并关闭面板
    - 失败时在面板内展示内联错误提示，不关闭面板
  - 使用 SlidingPanel 作为容器
  - _Requirements: 8.2, 8.3, 8.10, 8.11, 8.12, 8.13, 8.14, 8.18, 8.19, 8.20, 8.21_

- [x] 10. 观看历史面板
  - 创建 `apps/web/src/components/WatchHistoryPanel.tsx`
  - Props: open、onClose、showId、seasonNumber?、episodeNumber?、onDeleted
  - 使用 useEpisodeHistory 或 useShowHistory（根据是否传入 season/episode）
  - 每条记录展示：集标题（`S{NN}·E{NN} - {title}`）、观看时间（相对/绝对）、删除按鈕（垃圾桶图标）
  - watchedAt 为 null → 展示「未知时间」
  - 空列表 → 展示「暂无观看记录」
  - 删除流程：点击垃圾桶 → 内联确认 → 调用 useDeleteHistory → 刷新列表
  - 删除失败时展示内联错误提示
  - 使用 SlidingPanel 作为容器
  - _Requirements: 9.2, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11_
- [x] 11. EpisodeInfoCard 组件
  - 创建 `apps/web/src/components/EpisodeInfoCard.tsx`
  - Props: data: EpisodeDetailData、onWatchClick、onHistoryClick
  - 布局：左侧 16:9 截图（~480px）+ 右侧元数据区
  - 截图加载失败时展示 `<EpisodePlaceholder />`
  - 标题：translatedTitle ?? title
  - 简介：translatedOverview ?? overview（均为 null 时不渲染简介区）
  - 评分：traktRating 非 null 时展示 `{traktRating}%` 徽章；为 null 时不渲染评分区
  - 导演：directors.length > 0 时展示
  - 展示 airDate（年份）和 runtime（分钟数）
  - Watch 按鈕（触发 onWatchClick）+ History 按鈕（触发 onHistoryClick）
  - Watch 按鈕设置 aria-label
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 6.1, 6.2, 7.2_

- [x] 12. EpisodeSeasonStrip 组件
  - 创建 `apps/web/src/components/EpisodeSeasonStrip.tsx`
  - Props: episodes: EpisodeProgress[]、seasonNumber、currentEpisodeNumber、showId
  - 横向滚动容器（snap-x snap-mandatory）
  - 当前集：高亮边框（border-violet-500）+ aria-current="true"
  - 页面加载后自动 scrollIntoView 当前集缩略图
  - 点击非未播出集 → navigate(/shows/:showId/seasons/:s/episodes/:e)
  - 未播出集禁用点击并展示「未播出」标签
  - 已观看集展示已看标记（对勾图标）
  - 每个缩略图设置 aria-label（格式：`S{NN}E{NN} {title}`）
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 7.3, 7.4, 7.5_

- [x] 13. EpisodeDetailPage 页面
  - 创建 `apps/web/src/pages/EpisodeDetailPage.tsx`
  - 使用 `useParams<RouteParams>()` 获取 showId、season、episode
  - 参数校验：任一非正整数 → `<Navigate to="/progress" replace />`
  - 使用 useEpisodeDetail 获取数据
  - 加载中：`<EpisodeDetailSkeleton />`（顶部卡片区 + 底部列表区骨架）
  - 错误：错误提示 + 「重新加载」按鈕（调用 refetch()）
  - 成功：`<EpisodeInfoCard />` + `<EpisodeSeasonStrip />`
  - 管理 WatchActionPanel 和 WatchHistoryPanel 的开关状态
  - 使用语义化 HTML 标签（`<main>`、`<article>`、`<section>`）
  - 返回按鈕：导航回上一页
  - _Requirements: 1.1, 1.3, 1.4, 1.5, 5.2, 5.3, 5.4, 5.5, 7.1_

- [x] 14. 修改 EpisodeGrid.tsx 添加点击导航
  - 向 EpisodeGrid 组件传入 `showId` prop
  - EpisodeThumbnail 非未播出集时添加 onClick 导航至 `/shows/${showId}/seasons/${seasonNumber}/episodes/${ep.episodeNumber}`
  - 修改 ShowDetailPage.tsx 中对 EpisodeGrid 的调用，传入 showId
  - _Requirements: 1.2, 4.4, 7.5_

- [x] 15. 路由注册（apps/web/src/App.tsx）
  - 在现有路由中新增：
    `<Route path="/shows/:showId/seasons/:season/episodes/:episode" element={<EpisodeDetailPage />} />`
  - 导入 EpisodeDetailPage 组件
  - _Requirements: 1.1_

- [x] 16. ShowDetailPage 重置进度功能
  - 在 ShowDetailPage.tsx 中添加「观看进度达 100% 时展示 Watch again...」逻辑
  - 点击 Watch again... 展示确认对话框（说明保留历史记录）
  - 确认后调用 useResetProgress，成功后关闭对话框并刷新进度
  - 失败时展示错误提示
  - 在 Watch 按鈕区域新增 History 按鈕，打开 WatchHistoryPanel（展示全剧历史）
  - _Requirements: 10.1, 10.2, 10.7, 10.8, 10.9, 9.1_

- [ ] 17. Checkpoint — 前后端联调验证
  - 确保所有单元测试通过，如有问题请提出。
- [ ] 18. 属性测试（Property-Based Tests）
  - [ ]* 18.1 属性测试：Property 1 和 Property 2 — 本地化内容 Fallback Chain 与评分格式化
    - 创建 `apps/web/src/components/__tests__/EpisodeInfoCard.property.test.tsx`
    - **Property 1**: 对任意 EpisodeDetailData，translatedTitle 非 null 时展示 translatedTitle；为 null 时展示 title；同理适用于 overview
    - **Property 2**: 对任意 0–100 整数 traktRating，展示字符串应等于 `{traktRating}%`；为 null 时不渲染评分区
    - **Validates: Requirements 3.3, 3.5, 6.1, 6.2**
  - [ ]* 18.2 属性测试：Property 3 — 无效路由参数重定向
    - 创建 `apps/web/src/pages/__tests__/EpisodeDetailPage.property.test.tsx`
    - **Property 3**: 对任意非正整数的 showId/season/episode（负数、零、浮点数、非数字字符串），EpisodeDetailPage 应重定向至 /progress
    - **Validates: Requirements 1.4**
  - [ ]* 18.3 属性测试：Property 4 — 不存在 showId 返回 404
    - 创建 `apps/api/src/services/__tests__/shows.property.test.ts`
    - **Property 4**: 对任意不在数据库中的 showId，GET /api/shows/:showId/episodes/:s/:e 应返回 HTTP 404
    - **Validates: Requirements 2.3**
  - [ ]* 18.4 属性测试：Property 5 和 Property 6 — 进度计算游标窗口与多游标取最大值
    - 创建 `apps/api/src/services/__tests__/computeWatchedEpisodes.property.test.ts`
    - **Property 5**: 对任意观看历史集合和任意 resetAt，计算结果应等于 resetAt 之后的不重复集数（watchedAt 为 null 始终计入）
    - **Property 6**: 对任意非空 WatchResetCursor 列表，有效游标应是 resetAt 最大的那一条
    - **Validates: Requirements 10.4, 10.5**
  - [ ]* 18.5 属性测试：Property 7 — 重置不删除历史记录
    - 创建 `apps/api/src/services/__tests__/reset.property.test.ts`
    - **Property 7**: 对任意剧集，插入新 WatchResetCursor 前后 watchHistory 表记录总数不变
    - **Validates: Requirements 10.6**
  - [ ]* 18.6 属性测试：Property 8 — MetadataCache 键语言隔离
    - 创建 `apps/api/src/services/__tests__/tmdb.property.test.ts`
    - **Property 8**: 对任意 (tmdbId, language) 组合，生成的缓存键应等于 `tmdb_episode_{tmdbId}_s{s}e{e}_{language}`；不同语言不共享缓存条目
    - **Validates: Requirements 6.4**
  - [ ]* 18.7 属性测试：Property 9 — EpisodeThumbnail 导航 URL 构造
    - 创建 `apps/web/src/components/__tests__/EpisodeGrid.property.test.tsx`
    - **Property 9**: 对任意非未播出集，点击缩略图后导航 URL 应等于 `/shows/{showId}/seasons/{seasonNumber}/episodes/{episodeNumber}`
    - **Validates: Requirements 1.2, 4.4**

- [ ] 19. Final Checkpoint — 确保所有测试通过
  - 确保所有测试通过，如有问题请提出。

## Notes

- 标有 `*` 的子任务为可选项，可跳过以加快 MVP 交付
- 每个任务均引用具体需求编号以便追溯
- 属性测试使用 fast-check，每个属性测试至少运行 100 次迭代
- TMDB 导演数据和 Trakt 评分均采用降级策略，获取失败不阻断主响应
- computeWatchedEpisodes 中 watchedAt 为 null 的记录始终计入当前窗口