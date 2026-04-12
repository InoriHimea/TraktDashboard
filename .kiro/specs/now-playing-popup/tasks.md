# Implementation Plan: now-playing-popup

## Overview

在 trakt·dash 中新增"正在播放"浮层卡片。分五步推进：类型定义 → 后端路由 → 前端 API/Hook → 组件 → 属性测试。

## Tasks

- [x] 1. 类型定义：packages/types/src/index.ts 新增 NowPlayingEpisode
  - 导出 `NowPlayingEpisode` 接口，包含 `show`（title, posterPath, traktSlug）、`episode`（seasonNumber, episodeNumber, title）、`expiresAt`、`runtime`
  - _Requirements: 6.1_

- [x] 2. 后端：trakt.ts 新增 getWatching 方法
  - 在 `getTraktClient()` 返回对象中新增 `getWatching(userId)` 方法
  - 调用 `GET /users/me/watching?extended=full`，204 返回 null，非 200/204 抛出错误
  - _Requirements: 1.1, 1.3, 1.5_

- [x] 3. 后端：新增 apps/api/src/routes/trakt.ts 路由
  - 实现 `GET /api/trakt/watching`，受 authMiddleware 保护
  - 调用 `getWatching`，从 `shows` 表按 traktSlug 查询 posterPath
  - 204 → `{ data: null }` HTTP 200；Trakt 失败 → HTTP 502
  - 注册到 apps/api/src/index.ts
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 4. 前端：api.ts 新增 trakt.watching 方法
  - 在 `api` 对象中新增 `trakt: { watching: () => ... }`
  - _Requirements: 2.1_

- [x] 5. 前端：hooks/index.ts 新增 useNowPlaying hook
  - `refetchInterval: 30_000`，`staleTime: 25_000`
  - 返回 `{ data, isWatching, isLoading, error }`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 6. 前端：新增 NowPlayingPopup.tsx 组件
  - 固定定位浮层，framer-motion 淡入/上滑动画
  - 海报图、S·E 标签、剧集标题、剩余时间、进度条、骨架屏
  - 点击外部/Escape 关闭
  - _Requirements: 3.1–3.8, 4.3, 4.4, 5.1–5.5_

- [x] 7. 前端：修改 TopNav.tsx 集成触发按钮
  - 调用 `useNowPlaying()`，isWatching 时渲染脉冲触发按钮
  - 管理 isOpen 状态，渲染 NowPlayingPopup
  - _Requirements: 4.1, 4.2, 4.5, 4.6_

- [x] 8. 属性测试：nowPlaying.property.test.ts（纯逻辑）
  - Property 2: 剩余时间格式正确性
  - Property 3: 播放进度百分比有界性
  - Property 4: S·E 格式化正确性
  - _Requirements: 3.3, 3.5, 3.6_

- [x]* 9. 属性测试：NowPlayingPopup.property.test.tsx（组件）
  - Property 5: 海报加载失败时显示占位图
  - Property 6: 触发按钮可见性与 isWatching 状态一致
  - Property 7: 点击触发按钮切换弹窗可见性
  - _Requirements: 3.2, 4.1, 4.2_

## Notes

- 标有 `*` 的任务为可选属性测试
- 无数据库 schema 变更
