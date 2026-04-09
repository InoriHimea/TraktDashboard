# Implementation Plan: ui-redesign-multilang

## Overview

按照设计文档，分层实现：先完成数据库 schema 与迁移，再扩展类型定义，然后实现后端 API，接着更新同步服务与调度器，最后重构前端布局、新增页面、重构组件，并补充属性测试。

## Tasks

- [x] 1. 数据库 Schema 变更
  - [x] 1.1 在 `packages/db/src/schema.ts` 中新增 `userSettings` 表
    - 字段：`id`、`userId`（外键 `users.id`，唯一）、`displayLanguage`（默认 `zh-CN`）、`syncIntervalMinutes`（默认 60）、`httpProxy`（可为 null）、`updatedAt`
    - 参照设计文档 Data Models 中的 `userSettings` 定义
    - _Requirements: 5.1_
  - [x] 1.2 在 `packages/db/src/schema.ts` 的 `shows` 表中新增三个多语言字段
    - 新增 `originalName: text('original_name')`、`translatedName: text('translated_name')`、`displayLanguage: text('display_language')`，均可为 null
    - _Requirements: 6.1_

- [x] 2. 数据库迁移文件
  - [x] 2.1 创建 `packages/db/drizzle/0002_multilang_settings.sql`
    - 包含 `CREATE TABLE IF NOT EXISTS user_settings` 语句（字段与 schema 一致）
    - 包含三条 `ALTER TABLE shows ADD COLUMN IF NOT EXISTS` 语句
    - 参照设计文档 Data Models 中的迁移 SQL
    - _Requirements: 5.1, 6.1_
  - [x] 2.2 更新 `packages/db/drizzle/meta/_journal.json`，追加迁移条目 `0002_multilang_settings`
    - _Requirements: 5.1, 6.1_

- [x] 3. 类型定义更新（packages/types）
  - [x] 3.1 在 `packages/types/src/index.ts` 的 `Show` 接口中新增三个字段
    - `originalName: string | null`、`translatedName: string | null`、`displayLanguage: string | null`
    - _Requirements: 6.4_
  - [x] 3.2 在 `packages/types/src/index.ts` 中新增 `UserSettings` 接口
    - 字段：`userId: number`、`displayLanguage: string`、`syncIntervalMinutes: number`、`httpProxy: string | null`
    - _Requirements: 5.1_

- [x] 4. 后端 Settings API
  - [x] 4.1 创建 `apps/api/src/routes/settings.ts`，实现 `GET /api/settings`
    - 从 `user_settings` 表查询当前用户记录；若不存在，返回默认值对象（`displayLanguage: 'zh-CN'`，`syncIntervalMinutes: 60`，`httpProxy: null`）
    - 使用 `c.get('userId')` 获取认证用户 ID
    - _Requirements: 5.2_
  - [x] 4.2 在 `apps/api/src/routes/settings.ts` 中实现 `PUT /api/settings`
    - 校验 `syncIntervalMinutes`：若提供，必须为 [1, 10080] 整数，否则返回 `400`
    - 校验 `httpProxy`：若提供且非空，必须匹配 `^https?://`，否则返回 `400`
    - 通过 drizzle upsert（`onConflictDoUpdate`）写入 `user_settings` 表，返回完整设置对象
    - _Requirements: 5.3, 5.4, 5.5_
  - [x] 4.3 在 `apps/api/src/index.ts` 中注册 `settingsRoutes`，挂载到 `/api/settings`，并加上 auth 中间件
    - _Requirements: 5.2, 5.3_

- [x] 5. Checkpoint — 确保后端 Settings API 可正常响应
  - 确保所有测试通过，如有疑问请向用户确认。

- [x] 6. TMDB Service 多语言扩展
  - [x] 6.1 在 `apps/api/src/services/tmdb.ts` 的 `TmdbShow` 接口中新增 `original_name: string` 字段
    - _Requirements: 7.2_
  - [x] 6.2 将 `getTmdbShow` 签名扩展为 `getTmdbShow(tmdbId: number, language?: string): Promise<TmdbShow>`
    - 有 `language` 时，缓存键改为 `${tmdbId}_${language}`，并在 TMDB API URL 中附加 `language` 查询参数
    - 无 `language` 时，保持原有行为（缓存键为 `String(tmdbId)`，不附加 `language` 参数）
    - _Requirements: 7.1, 7.3, 7.4_
  - [x] 6.3 在 `buildFetchOptions()` 中改为从 `user_settings` 表动态读取 `httpProxy`，回退到环境变量 `HTTP_PROXY` / `HTTPS_PROXY`
    - 由于 `buildFetchOptions` 目前是模块级常量，需改为每次请求时调用的函数，并在 `fetchWithRetry` 中传入
    - _Requirements: 9.1_

- [x] 7. 同步服务更新（Sync Service）
  - [x] 7.1 在 `apps/api/src/services/sync.ts` 的 `upsertShowFromTmdb` 函数中，从 `user_settings` 读取当前用户的 `displayLanguage`
    - 若 `displayLanguage` 非 null，调用 `getTmdbShow(tmdbId, displayLanguage)` 获取翻译数据
    - 将 `tmdb.original_name` 写入 `shows.originalName`
    - 将翻译标题（`tmdb.name`，即按 language 请求的结果）写入 `shows.translatedName`
    - 将 `displayLanguage` 写入 `shows.displayLanguage`
    - 若翻译请求失败，跳过翻译字段写入（保持 null），不中断同步
    - _Requirements: 6.2, 6.3_
  - [x] 7.2 在 `apps/api/src/routes/shows.ts` 的 `/progress` 和 `/:id` 路由中，将 `originalName`、`translatedName`、`displayLanguage` 包含在返回的 `show` 对象中
    - _Requirements: 6.4_

- [x] 8. Scheduler 动态同步间隔
  - [x] 8.1 修改 `apps/api/src/jobs/scheduler.ts` 的 `registerUserSyncJob` 函数
    - 从 `user_settings` 表查询该用户的 `syncIntervalMinutes`；若无记录，使用默认值 60
    - 用查询到的间隔替换模块级常量 `intervalMinutes`
    - _Requirements: 9.2, 9.3_

- [x] 9. 前端 TopNav 组件（新增）
  - [x] 9.1 创建 `apps/web/src/components/TopNav.tsx`
    - Props：`username: string | null`，`onLogout: () => void`
    - 渲染四个导航项：Statistics (`/stats`)、Progress (`/progress`)、Sync (`/sync`)、Settings (`/settings`)
    - 使用 `useLocation()` 判断激活项（`location.pathname.startsWith(to)`），激活项高亮
    - 左侧：Logo `trakt·dash` + `@{username}`；右侧：登出按钮
    - 高度 `56px`，`position: sticky; top: 0; z-index: 40`
    - 响应式：`< 768px` 时导航项仅显示图标 + 短标签，不换行
    - 使用现有 CSS 变量，不引入新 UI 库
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 10. 前端 Layout 重构
  - [x] 10.1 重构 `apps/web/src/components/Layout.tsx`，移除侧边栏，改为 TopNav + main 结构
    - 渲染 `<TopNav username={...} onLogout={logout} />`
    - `<main>` 设置 `paddingTop: '56px'`，包裹 `AnimatePresence` + `motion.div`（路由切换动画保持不变）
    - 移除所有侧边栏、同步面板相关代码
    - _Requirements: 1.1, 2.1, 2.2_

- [x] 11. 前端 SyncPage（新增）
  - [x] 11.1 创建 `apps/web/src/pages/SyncPage.tsx`
    - 使用 `useSyncStatus()` 获取数据，`running` 时 `refetchInterval` 为 `1500ms`（已在 hook 中实现）
    - 按状态机渲染：`running` 显示进度条 + `progress/total` + `currentShow`；`idle`/`completed` 显示"立即同步"按钮 + `lastSyncAt`；`error` 显示错误文本 + 按钮
    - 当 `failedShows.length > 0` 时渲染失败列表，每项展示 `title` 和 `error`
    - `lastSyncAt` 格式化为本地化日期时间字符串
    - 使用现有 CSS 变量，不引入新 UI 库
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 12. 前端 SettingsPage（新增）
  - [x] 12.1 在 `apps/web/src/lib/api.ts` 中新增 `api.settings.get()` 和 `api.settings.update()` 方法
    - `get`：`GET /api/settings`，返回 `ApiResponse<UserSettings>`
    - `update`：`PUT /api/settings`，接受 `Partial<UserSettings>` body，返回 `ApiResponse<UserSettings>`
    - _Requirements: 4.1, 4.5_
  - [x] 12.2 在 `apps/web/src/hooks/index.ts` 中新增 `useSettings()` 和 `useUpdateSettings()` hooks
    - `useSettings`：`useQuery`，调用 `api.settings.get()`
    - `useUpdateSettings`：`useMutation`，调用 `api.settings.update()`，成功后 invalidate `['settings']`
    - _Requirements: 4.1, 4.5_
  - [x] 12.3 创建 `apps/web/src/pages/SettingsPage.tsx`
    - `useEffect` 挂载时通过 `useSettings()` 填充表单（`displayLanguage`、`syncIntervalMinutes`、`httpProxy`）
    - 提供三个输入项：Display Language（BCP 47 文本输入，默认 `zh-CN`）、同步间隔（数字输入，1–10080）、HTTP 代理（文本输入，可为空）
    - 保存时调用 `useUpdateSettings()`，成功后展示确认提示；失败时展示内联错误，表单保持打开
    - 使用现有 CSS 变量，不引入新 UI 库
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 13. 前端 ShowCard 重构（海报大图风格）
  - [x] 13.1 重构 `apps/web/src/components/ShowCard.tsx` 为竖版海报卡片
    - 海报图片使用 `tmdbImage(show.posterPath, 'w300')`，宽高比 2:3
    - 若 `posterPath` 为 null，展示 `<Tv2>` 占位图标，不渲染 `<img>` 元素
    - 主标题：`show.translatedName ?? show.title`；副标题：仅当 `translatedName` 非 null 时展示 `originalName`
    - 展示 `traktId` 和 `tmdbId`
    - 展示进度条（已看集数 / 已播出集数）和完成百分比
    - 使用现有 CSS 变量，不引入新 UI 库
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [x] 14. 前端 ProgressPage 适配
  - [x] 14.1 修改 `apps/web/src/pages/ProgressPage.tsx`，移除内嵌左侧 filter rail，改为页面顶部水平 filter tabs
    - 将 `<aside>` 侧边栏替换为页面顶部的水平 tabs 行（`watching` / `completed` / `all`）
    - 保留现有 filter 状态逻辑、搜索框、统计数据展示
    - _Requirements: 2.2, 2.3_

- [x] 15. 前端路由更新
  - [x] 15.1 修改 `apps/web/src/App.tsx`，新增 `/sync` 和 `/settings` 路由
    - 导入 `SyncPage` 和 `SettingsPage`
    - 在 `<Routes>` 中添加 `<Route path="/sync" element={<SyncPage />} />` 和 `<Route path="/settings" element={<SettingsPage />} />`
    - _Requirements: 1.2, 3.1, 4.1_

- [x] 16. Checkpoint — 确保前端所有页面可正常渲染，路由跳转正确
  - 确保所有测试通过，如有疑问请向用户确认。

- [ ] 17. 属性测试（fast-check）
  - [ ]* 17.1 为 Property 1（Settings round-trip）编写属性测试
    - **Property 1: Settings round-trip**
    - 生成随机合法 `UserSettings`（`syncIntervalMinutes` 在 [1, 10080]，`httpProxy` 为 null 或合法 http(s):// URL）
    - 断言：PUT 后 GET 返回等价对象
    - 最少运行 100 次迭代
    - **Validates: Requirements 5.3, 5.6**
  - [ ]* 17.2 为 Property 2（syncIntervalMinutes 越界拒绝）编写属性测试
    - **Property 2: syncIntervalMinutes 越界拒绝**
    - 生成随机整数，过滤掉 [1, 10080] 范围内的值
    - 断言：PUT 返回 HTTP 400
    - 最少运行 100 次迭代
    - **Validates: Requirements 5.4**
  - [ ]* 17.3 为 Property 3（httpProxy 非法 URL 拒绝）编写属性测试
    - **Property 3: httpProxy 非法 URL 拒绝**
    - 生成随机非空字符串，过滤掉以 `http://` 或 `https://` 开头的字符串
    - 断言：PUT 返回 HTTP 400
    - 最少运行 100 次迭代
    - **Validates: Requirements 5.5**
  - [ ]* 17.4 为 Property 4（ShowCard 翻译标题优先级）编写属性测试
    - **Property 4: ShowCard 翻译标题优先级**
    - 生成随机 `ShowProgress`，`show.translatedName` 为非 null 字符串
    - 断言：渲染输出中主标题为 `translatedName`，副标题为 `originalName`
    - 最少运行 100 次迭代
    - **Validates: Requirements 8.4**
  - [ ]* 17.5 为 Property 5（ShowCard 无翻译标题时回退）编写属性测试
    - **Property 5: ShowCard 无翻译标题时回退**
    - 生成随机 `ShowProgress`，`show.translatedName` 为 null
    - 断言：渲染输出中主标题为 `show.title`，不存在副标题元素
    - 最少运行 100 次迭代
    - **Validates: Requirements 8.5**

- [x] 18. Final Checkpoint — 确保所有测试通过
  - 确保所有测试通过，如有疑问请向用户确认。

## Notes

- 标有 `*` 的子任务为可选项，可跳过以加快 MVP 进度
- 每个任务均引用了具体需求条款，便于追溯
- Checkpoint 任务用于阶段性验证，确保增量进度可用
- 属性测试使用 fast-check（TypeScript 生态，适配现有 Bun + TypeScript 栈），每个属性最少运行 100 次迭代
