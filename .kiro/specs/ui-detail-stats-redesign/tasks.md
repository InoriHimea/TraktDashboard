# Implementation Plan: ui-detail-stats-redesign

## Overview

纯前端 UI 改动，分五个阶段递进实现：主题系统 → 详情页外链与布局 → 统计页布局 → 设置页主题控件 → 测试补全。所有代码使用 TypeScript + React，测试使用 Vitest + @testing-library/react + fast-check。

## Tasks

- [x] 1. 安装测试依赖并配置 Vitest 环境
  - 在 `apps/web/package.json` 中添加 `vitest`、`@testing-library/react`、`@testing-library/jest-dom`、`fast-check` 到 devDependencies
  - 在 `apps/web/vite.config.ts` 中添加 `test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] }` 配置
  - 创建 `apps/web/src/test/setup.ts`，导入 `@testing-library/jest-dom`
  - _Requirements: 全局测试基础设施_

- [x] 2. 实现主题系统（theme.ts + index.css + index.html）
  - [x] 2.1 创建 `apps/web/src/lib/theme.ts`
    - 实现 `applyTheme(theme: Theme): void`：`'light'` 时设置 `document.documentElement.dataset.theme = 'light'`，`'dark'` 时删除该属性
    - 实现 `persistTheme(theme: Theme): void`：写入 `localStorage.setItem('theme', theme)`，用 try/catch 包裹
    - 实现 `loadTheme(): Theme`：读取 `localStorage.getItem('theme')`，返回 `'light'` 或默认 `'dark'`，用 try/catch 包裹
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.8_

  - [ ]* 2.2 为 `applyTheme` 写属性测试（Property 7）
    - `// Feature: ui-detail-stats-redesign, Property 7: 主题应用往返`
    - 对 `fc.constantFrom('light', 'dark')` 断言：调用后 `document.documentElement.dataset.theme` 与 theme 一致
    - **Property 7: 主题应用往返**
    - **Validates: Requirements 4.2, 4.3**

  - [ ]* 2.3 为 `persistTheme` / `loadTheme` 写属性测试（Property 8）
    - `// Feature: ui-detail-stats-redesign, Property 8: 主题持久化往返`
    - 对 `fc.constantFrom('light', 'dark')` 断言：`persistTheme(t)` 后 `loadTheme() === t`
    - 额外断言：清空 localStorage 后 `loadTheme()` 返回 `'dark'`
    - **Property 8: 主题持久化往返**
    - **Validates: Requirements 4.4, 4.5, 4.8**

  - [x] 2.4 在 `apps/web/index.html` 的 `<head>` 末尾插入 FOUC 防止内联脚本
    - 脚本内容：`(function(){ try{ var t=localStorage.getItem('theme'); if(t==='light') document.documentElement.dataset.theme='light'; }catch(e){} })()`
    - 脚本不得带 `defer` 或 `async` 属性
    - _Requirements: 4.5_

  - [x] 2.5 在 `apps/web/src/index.css` 末尾添加 `[data-theme="light"]` CSS 变量覆盖块
    - 覆盖 `--color-bg`、`--color-surface`、`--color-surface-2`、`--color-surface-3`、`--color-surface-4` 为浅色背景值
    - 覆盖 `--color-text`、`--color-text-secondary`、`--color-text-muted` 为深色文字值
    - 覆盖 `--color-border`、`--color-border-subtle` 为浅色边框值
    - 保持 `--color-accent` 不变（不在覆盖块中出现）
    - _Requirements: 4.6, 4.7_

- [x] 3. 实现 ShowDetailPage 外链标签补全与布局重设计
  - [x] 3.1 提取 `ExternalLinkBadge` 组件并补全 TMDB / TVDB 外链
    - 在 `ShowDetailPage.tsx` 内定义 `ExternalLinkBadge({ href, label })` 组件，复用现有 `<a>` 样式
    - 按 TMDB → TVDB → IMDB → Trakt 顺序渲染：`show.tmdbId` 存在时渲染 TMDB 链接，`show.tvdbId` 存在时渲染 TVDB 链接
    - 所有 `<a>` 标签必须带 `target="_blank"` 和 `rel="noreferrer"`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]* 3.2 为 TMDB 外链条件渲染写属性测试（Property 1）
    - `// Feature: ui-detail-stats-redesign, Property 1: TMDB 外链标签条件渲染`
    - 使用 `fc.option(fc.integer({ min: 1 }), { nil: null })` 生成 `tmdbId`
    - 断言：`tmdbId !== null` 时渲染包含 `themoviedb.org/tv/`，否则不包含
    - **Property 1: TMDB 外链标签条件渲染**
    - **Validates: Requirements 1.1, 1.4**

  - [ ]* 3.3 为 TVDB 外链条件渲染写属性测试（Property 2）
    - `// Feature: ui-detail-stats-redesign, Property 2: TVDB 外链标签条件渲染`
    - 使用 `fc.option(fc.integer({ min: 1 }), { nil: null })` 生成 `tvdbId`
    - 断言：`tvdbId !== null` 时渲染包含 `thetvdb.com`，否则不包含
    - **Property 2: TVDB 外链标签条件渲染**
    - **Validates: Requirements 1.2, 1.5**

  - [ ]* 3.4 为外链标签顺序写属性测试（Property 3）
    - `// Feature: ui-detail-stats-redesign, Property 3: 外链标签顺序不变式`
    - 随机生成各外链字段有无，提取渲染后所有链接的 label 顺序
    - 断言：出现的标签相对顺序满足 TMDB < TVDB < IMDB < Trakt
    - **Property 3: 外链标签顺序不变式**
    - **Validates: Requirements 1.3**

  - [ ]* 3.5 为外链标签安全属性写属性测试（Property 4）
    - `// Feature: ui-detail-stats-redesign, Property 4: 外链标签安全属性`
    - 对任意 Show 对象，断言所有 `<a>` 标签均有 `target="_blank"` 且 `rel` 包含 `noreferrer`
    - **Property 4: 外链标签安全属性**
    - **Validates: Requirements 1.6**

  - [x] 3.6 实现 `resolveTitle` 函数与双标题渲染
    - 在 `ShowDetailPage.tsx` 中实现 `resolveTitle(show)`：`translatedName && displayLanguage` 均非 null 时返回 `{ primary: translatedName, secondary: originalName ?? title }`，否则返回 `{ primary: title, secondary: null }`
    - 在标题区域渲染 `primary`（大字号）和 `secondary`（小字号，条件显示）
    - _Requirements: 2.5, 2.6_

  - [ ]* 3.7 为 `resolveTitle` 写属性测试（Property 5）
    - `// Feature: ui-detail-stats-redesign, Property 5: 标题选择逻辑`
    - 使用 `fc.record` 生成 `title`、`translatedName`、`originalName`、`displayLanguage` 的随机组合
    - 断言：两字段均非 null 时 `primary === translatedName && secondary !== null`；否则 `primary === title && secondary === null`
    - **Property 5: 标题选择逻辑**
    - **Validates: Requirements 2.5, 2.6**

  - [x] 3.8 重构 ShowDetailPage Backdrop 与海报布局
    - Backdrop 区域高度改为 `min-height: 320px`，图片使用 `object-fit: cover`
    - Backdrop 底部添加渐变遮罩：`linear-gradient(to bottom, transparent, var(--color-bg))`
    - 海报尺寸改为 `140×210px`，通过 `position: absolute; bottom: -70px; left: 32px` 叠加在 Backdrop 底部
    - 内容区域添加足够的 `padding-top` 为海报留出空间
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 3.9 为详情页必要字段渲染写属性测试（Property 6）
    - `// Feature: ui-detail-stats-redesign, Property 6: 详情页必要字段渲染`
    - 使用 `fc.record` 生成任意 ShowProgress，断言渲染输出包含 primary title 和 `show.status`
    - **Property 6: 详情页必要字段渲染**
    - **Validates: Requirements 2.4**

  - [ ]* 3.10 为 ShowDetailPage 写单元测试
    - 测试 `backdropPath` 为 null 时渲染纯色背景占位，不渲染 `<img>`
    - 测试 `posterPath` 为 null 时渲染图标占位
    - 测试季/集折叠列表存在（Requirements 2.8）
    - _Requirements: 2.1, 2.3, 2.8_

- [x] 4. Checkpoint — 确保所有测试通过
  - 运行 `pnpm --filter @trakt-dashboard/web test --run`，确保所有测试通过，如有问题请告知。

- [x] 5. 实现 StatsPage 布局优化
  - [x] 5.1 将 StatCard 网格改为 4 列
    - 将 `grid-template-columns` 改为 `repeat(4, 1fr)`（宽屏），通过媒体查询在 `< 768px` 时降为 `repeat(2, 1fr)`
    - 保持卡片间距不低于 24px（`gap` 值）
    - _Requirements: 3.1, 3.2_

  - [x] 5.2 调整图表最小高度与底部面板布局
    - 将 `ResponsiveContainer` 的 `height` 从 `180` 改为 `200`（满足 min-height 200px）
    - 底部面板 `grid-template-columns` 保持 `1fr 1fr`（宽屏），通过媒体查询在 `< 768px` 时改为 `1fr`
    - _Requirements: 3.3, 3.4_

  - [ ]* 5.3 为 StatsPage 条件渲染写单元测试
    - 测试 `topGenres=[]` 时不渲染 Top Genres 面板
    - 测试 `recentlyWatched=[]` 时不渲染 Recent Activity 面板
    - _Requirements: 3.5, 3.6_

- [x] 6. 实现 SettingsPage 主题切换控件
  - [x] 6.1 在 SettingsPage 中添加主题切换控件
    - 在 fields card 中添加 Theme 字段，使用 `<select>` 或两个 radio button 提供"Dark"/"Light"选项
    - 用 `useState` 初始化为 `loadTheme()` 的返回值
    - 切换时同步调用 `applyTheme(theme)` 和 `persistTheme(theme)`（即时生效，无需点击 Save）
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 6.2 为 SettingsPage 主题控件写单元测试
    - 测试渲染后存在主题切换控件（Requirements 4.1）
    - 测试切换选项后 `document.documentElement.dataset.theme` 随之变化
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 7. Final Checkpoint — 确保所有测试通过
  - 运行 `pnpm --filter @trakt-dashboard/web test --run`，确保全部测试通过，如有问题请告知。

## Notes

- 标有 `*` 的子任务为可选测试任务，可跳过以加快 MVP 进度
- 每个任务均引用具体需求条款以保证可追溯性
- 属性测试注释格式：`// Feature: ui-detail-stats-redesign, Property {N}: {描述}`
- 主题切换即时生效（不依赖 Save 按钮），持久化写入 localStorage
- FOUC 防止脚本必须是同步内联脚本，不得 defer/async
