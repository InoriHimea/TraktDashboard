# 技术设计文档：ui-detail-stats-redesign

## Overview

本次改动是纯前端 UI 层的重构，不涉及后端 API 或数据库 schema 变更。所有所需数据字段（`tmdbId`、`tvdbId`、`translatedName`、`originalName`、`displayLanguage`）已存在于 `Show` 类型中。

改动范围：
- `apps/web/src/pages/ShowDetailPage.tsx` — 外链标签补全 + Trakt 风格视觉重设计
- `apps/web/src/pages/StatsPage.tsx` — 布局优化
- `apps/web/src/pages/SettingsPage.tsx` — 主题切换控件
- `apps/web/src/index.css` — 浅色主题 CSS 变量 + FOUC 防止脚本
- `apps/web/index.html` — 内联 FOUC 防止脚本

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  index.html                                         │
│  └─ <script> FOUC 防止：读取 localStorage['theme']  │
│     并在 React 挂载前设置 data-theme                 │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  index.css  (@theme 深色变量 + [data-theme="light"] │
│             覆盖规则)                                │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  React App                                          │
│  ├─ ShowDetailPage  (外链标签 + Trakt 风格布局)      │
│  ├─ StatsPage       (4 列卡片 + 并排面板)            │
│  └─ SettingsPage    (主题切换控件 → localStorage)    │
└─────────────────────────────────────────────────────┘
```

主题状态不进入 React state / Context，直接操作 `document.documentElement.dataset.theme` 和 `localStorage`，避免引入全局 Context 的复杂度。

---

## Components and Interfaces

### 1. ExternalLinkBadge（外链标签）

复用现有内联 `<a>` 样式，提取为独立组件以消除重复：

```tsx
interface ExternalLinkBadgeProps {
  href: string
  label: string
}
// 渲染：target="_blank" rel="noreferrer"，样式与现有标签一致
```

外链标签渲染顺序由父组件控制，按 TMDB → TVDB → IMDB → Trakt 排列。

### 2. ShowDetailPage 布局重构

新布局结构：

```
┌──────────────────────────────────────────────────────┐
│  Backdrop（全宽，min-height: 320px，object-fit:cover）│
│  + 底部渐变遮罩（transparent → var(--color-bg)）      │
│  + 返回按钮（左上角）                                 │
└──────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────┐
│  [海报 140×210px]  [标题区域]                         │
│  左下角叠加在      主标题（translatedName 或 title）  │
│  Backdrop 上       副标题（originalName，条件显示）   │
│                    年份 · 网络 · 状态 · 类型标签       │
│                    外链标签（TMDB/TVDB/IMDB/Trakt）   │
│                    进度条 + 统计行                    │
└──────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────┐
│  Overview 文本（max-width: 680px）                    │
└──────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────┐
│  季/集折叠列表（保持不变）                            │
└──────────────────────────────────────────────────────┘
```

海报通过 `position: absolute; bottom: -70px; left: 32px` 叠加在 Backdrop 底部，内容区域通过 `padding-top` 为海报留出空间。

### 3. 标题选择逻辑

```ts
function resolveTitle(show: Show): { primary: string; secondary: string | null } {
  if (show.translatedName && show.displayLanguage) {
    return { primary: show.translatedName, secondary: show.originalName ?? show.title }
  }
  return { primary: show.title, secondary: null }
}
```

### 4. StatsPage 布局变更

- StatCard 网格：`grid-template-columns: repeat(4, 1fr)`（宽屏），`repeat(2, 1fr)`（< 768px）
- 图表容器：`min-height: 200px`（从 180px 提升）
- 底部面板：`grid-template-columns: 1fr 1fr`（宽屏），`1fr`（< 768px）
- 条件渲染：`topGenres.length > 0` 和 `recentlyWatched.length > 0` 控制面板显示

### 5. 主题系统

```ts
// lib/theme.ts（新文件）
type Theme = 'dark' | 'light'

export function applyTheme(theme: Theme): void {
  if (theme === 'light') {
    document.documentElement.dataset.theme = 'light'
  } else {
    delete document.documentElement.dataset.theme
  }
}

export function persistTheme(theme: Theme): void {
  localStorage.setItem('theme', theme)
}

export function loadTheme(): Theme {
  const stored = localStorage.getItem('theme')
  return stored === 'light' ? 'light' : 'dark'
}
```

SettingsPage 中的主题切换控件：读取当前 `localStorage` 值初始化本地 state，切换时同步调用 `applyTheme` + `persistTheme`。

### 6. FOUC 防止

在 `apps/web/index.html` 的 `<head>` 中内联脚本（不可 defer/async）：

```html
<script>
  (function() {
    var t = localStorage.getItem('theme');
    if (t === 'light') document.documentElement.dataset.theme = 'light';
  })();
</script>
```

此脚本在 CSS 加载后、React bundle 执行前运行，确保首屏无主题闪烁。

---

## Data Models

无新增数据模型。所有字段已存在于 `packages/types/src/index.ts` 的 `Show` 接口：

```ts
interface Show {
  tmdbId: number          // TMDB 外链
  tvdbId: number | null   // TVDB 外链（可选）
  imdbId: string | null   // IMDB 外链（已有）
  traktSlug: string | null // Trakt 外链（已有）
  originalName: string | null   // 副标题来源
  translatedName: string | null // 主标题来源（条件）
  displayLanguage: string | null // 控制翻译标题显示
  // ...其余字段不变
}
```

主题偏好存储于 `localStorage`，键名 `theme`，值为 `'light'` 或 `'dark'`（缺省视为 `'dark'`）。

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: TMDB 外链标签条件渲染

*For any* Show 对象，当且仅当 `tmdbId` 非 null 时，渲染输出中应包含指向 `https://www.themoviedb.org/tv/{tmdbId}` 的链接；当 `tmdbId` 为 null 时，渲染输出中不应包含该链接。

**Validates: Requirements 1.1, 1.4**

### Property 2: TVDB 外链标签条件渲染

*For any* Show 对象，当且仅当 `tvdbId` 非 null 时，渲染输出中应包含指向 `https://www.thetvdb.com/?tab=series&id={tvdbId}` 的链接；当 `tvdbId` 为 null 时，渲染输出中不应包含该链接。

**Validates: Requirements 1.2, 1.5**

### Property 3: 外链标签顺序不变式

*For any* Show 对象（各外链字段随机有无），渲染输出中出现的外链标签，其顺序必须满足：TMDB 在 TVDB 之前，TVDB 在 IMDB 之前，IMDB 在 Trakt 之前（仅对实际存在的标签比较相对顺序）。

**Validates: Requirements 1.3**

### Property 4: 外链标签安全属性

*For any* Show 对象，渲染输出中所有外链 `<a>` 标签都必须同时具有 `target="_blank"` 和 `rel="noreferrer"` 属性。

**Validates: Requirements 1.6**

### Property 5: 标题选择逻辑

*For any* Show 对象，`resolveTitle` 函数的输出满足：若 `translatedName` 和 `displayLanguage` 均非 null，则 `primary === translatedName` 且 `secondary` 包含 `originalName`（或 `title`）；否则 `primary === title` 且 `secondary === null`。

**Validates: Requirements 2.5, 2.6**

### Property 6: 详情页必要字段渲染

*For any* ShowProgress 对象，ShowDetailPage 的渲染输出中应包含 show 的标题（primary title）、年份（firstAired 年份）、状态（status）以及所有 genres 标签。

**Validates: Requirements 2.4**

### Property 7: 主题应用往返

*For any* theme 值（`'light'` 或 `'dark'`），调用 `applyTheme(theme)` 后，`document.documentElement.dataset.theme` 的状态应与 theme 一致：`'light'` 时值为 `'light'`，`'dark'` 时属性不存在或值为 `'dark'`。

**Validates: Requirements 4.2, 4.3**

### Property 8: 主题持久化往返

*For any* theme 值，调用 `persistTheme(theme)` 后，`loadTheme()` 应返回相同的 theme 值；当 localStorage 中无 `theme` 键时，`loadTheme()` 应返回 `'dark'`。

**Validates: Requirements 4.4, 4.5, 4.8**

---

## Error Handling

| 场景 | 处理方式 |
|------|----------|
| `backdropPath` 为 null | 渲染纯色背景占位（`var(--color-surface)`），不显示 `<img>` |
| `posterPath` 为 null | 渲染 `<Tv2>` 图标占位，保持布局不变 |
| `translatedName` 为 null | 回退到 `show.title`，不显示副标题（见 `resolveTitle`）|
| `topGenres` 为空数组 | 隐藏 Top Genres 面板，不留空白占位 |
| `recentlyWatched` 为空数组 | 隐藏 Recent Activity 面板，不留空白占位 |
| localStorage 不可用 | `loadTheme` 捕获异常，返回默认值 `'dark'`；FOUC 脚本用 try/catch 包裹 |
| `tmdbId` / `tvdbId` 为 null | 不渲染对应外链标签（条件渲染，无错误状态） |

---

## Testing Strategy

### 单元测试（Unit Tests）

针对具体示例、边界情况和工具函数：

- `resolveTitle` 函数：4 个示例覆盖 translatedName/displayLanguage 的 null 组合
- `loadTheme`：localStorage 为空时返回 `'dark'`
- `applyTheme`：`'light'` 设置属性，`'dark'` 移除属性
- StatsPage 条件渲染：`topGenres=[]` 时不渲染 Top Genres 面板（Requirements 3.5）
- StatsPage 条件渲染：`recentlyWatched=[]` 时不渲染 Recent Activity 面板（Requirements 3.6）
- SettingsPage：渲染后存在主题切换控件（Requirements 4.1）
- ShowDetailPage：渲染后存在季/集折叠列表（Requirements 2.8）

### 属性测试（Property-Based Tests）

使用 [fast-check](https://github.com/dubzzz/fast-check)（TypeScript 生态首选 PBT 库），每个属性测试最少运行 100 次迭代。

每个属性测试必须在注释中标注：
`// Feature: ui-detail-stats-redesign, Property {N}: {property_text}`

**Property 1 — TMDB 外链标签条件渲染**
```
// Feature: ui-detail-stats-redesign, Property 1: TMDB 外链标签条件渲染
fc.assert(fc.property(
  fc.record({ tmdbId: fc.option(fc.integer({ min: 1 }), { nil: null }), ...otherShowFields }),
  (show) => {
    const html = renderExternalLinks(show)
    const hasTmdb = html.includes('themoviedb.org/tv/')
    return show.tmdbId !== null ? hasTmdb : !hasTmdb
  }
), { numRuns: 100 })
```

**Property 2 — TVDB 外链标签条件渲染**
```
// Feature: ui-detail-stats-redesign, Property 2: TVDB 外链标签条件渲染
fc.assert(fc.property(
  fc.record({ tvdbId: fc.option(fc.integer({ min: 1 }), { nil: null }), ...otherShowFields }),
  (show) => {
    const html = renderExternalLinks(show)
    const hasTvdb = html.includes('thetvdb.com')
    return show.tvdbId !== null ? hasTvdb : !hasTvdb
  }
), { numRuns: 100 })
```

**Property 3 — 外链标签顺序不变式**
```
// Feature: ui-detail-stats-redesign, Property 3: 外链标签顺序不变式
fc.assert(fc.property(
  arbitraryShow,
  (show) => {
    const links = extractLinkLabels(renderExternalLinks(show)) // ['TMDB','IMDB',...]
    const order = ['TMDB', 'TVDB', 'IMDB', 'Trakt']
    const indices = links.map(l => order.indexOf(l)).filter(i => i >= 0)
    return indices.every((v, i) => i === 0 || indices[i - 1] <= v)
  }
), { numRuns: 100 })
```

**Property 4 — 外链标签安全属性**
```
// Feature: ui-detail-stats-redesign, Property 4: 外链标签安全属性
fc.assert(fc.property(
  arbitraryShow,
  (show) => {
    const anchors = queryAllAnchors(renderExternalLinks(show))
    return anchors.every(a => a.target === '_blank' && a.rel.includes('noreferrer'))
  }
), { numRuns: 100 })
```

**Property 5 — 标题选择逻辑**
```
// Feature: ui-detail-stats-redesign, Property 5: 标题选择逻辑
fc.assert(fc.property(
  fc.record({
    title: fc.string({ minLength: 1 }),
    translatedName: fc.option(fc.string({ minLength: 1 }), { nil: null }),
    originalName: fc.option(fc.string({ minLength: 1 }), { nil: null }),
    displayLanguage: fc.option(fc.string({ minLength: 2 }), { nil: null }),
  }),
  (show) => {
    const { primary, secondary } = resolveTitle(show as Show)
    if (show.translatedName && show.displayLanguage) {
      return primary === show.translatedName && secondary !== null
    }
    return primary === show.title && secondary === null
  }
), { numRuns: 200 })
```

**Property 6 — 详情页必要字段渲染**
```
// Feature: ui-detail-stats-redesign, Property 6: 详情页必要字段渲染
fc.assert(fc.property(
  arbitraryShowProgress,
  (progress) => {
    const html = renderShowHeader(progress)
    const { primary } = resolveTitle(progress.show)
    return html.includes(primary) && html.includes(progress.show.status)
  }
), { numRuns: 100 })
```

**Property 7 — 主题应用往返**
```
// Feature: ui-detail-stats-redesign, Property 7: 主题应用往返
fc.assert(fc.property(
  fc.constantFrom('light', 'dark'),
  (theme) => {
    applyTheme(theme as Theme)
    const attr = document.documentElement.dataset.theme
    return theme === 'light' ? attr === 'light' : attr === undefined || attr === 'dark'
  }
), { numRuns: 100 })
```

**Property 8 — 主题持久化往返**
```
// Feature: ui-detail-stats-redesign, Property 8: 主题持久化往返
fc.assert(fc.property(
  fc.constantFrom('light', 'dark'),
  (theme) => {
    persistTheme(theme as Theme)
    return loadTheme() === theme
  }
), { numRuns: 100 })
```

### 测试工具选型

| 工具 | 用途 |
|------|------|
| Vitest | 测试运行器（与 Vite 生态一致） |
| @testing-library/react | 组件渲染与 DOM 查询 |
| fast-check | 属性测试（PBT） |
| jsdom | 浏览器 DOM 模拟（Vitest 默认环境） |
