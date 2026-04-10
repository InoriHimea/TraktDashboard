# 需求文档

## 简介

本功能对追剧仪表盘的 UI 进行一系列改进，涵盖四个方向：

1. **详情页外链标签补全**：在剧集详情页补充 TMDB 和 TVDB 的外链入口，与现有的 IMDB、Trakt 标签保持一致。
2. **详情页视觉重设计**：参照 Trakt 网站的详情页风格，重构布局与视觉层次，并在设置了 `displayLanguage` 时展示对应 locale 的翻译标题。
3. **Statistics 页面布局优化**：改善统计页面的信息密度与视觉结构。
4. **浅色主题支持**：在 CSS 变量层面引入 light theme，允许用户在设置中切换深色/浅色背景。

---

## 词汇表

- **DetailPage（详情页）**：`ShowDetailPage` 组件，展示单部剧集的完整进度与剧集列表。
- **StatsPage（统计页）**：`StatsPage` 组件，展示用户的整体观看统计数据。
- **SettingsPage（设置页）**：`SettingsPage` 组件，管理用户偏好配置。
- **ExternalLinkBadge（外链标签）**：详情页右上角的外部链接按钮，目前包含 IMDB 和 Trakt。
- **Backdrop（背景大图）**：详情页顶部的宽幅剧集背景图。
- **TranslatedTitle（翻译标题）**：`Show.translatedName` 字段，由 TMDB 根据 `displayLanguage` 返回的本地化标题。
- **OriginalTitle（原始标题）**：`Show.originalName` 字段，剧集的原始语言标题。
- **Theme（主题）**：由 CSS 变量集合定义的全局视觉风格，当前仅有深色主题。
- **LightTheme（浅色主题）**：一套以浅色背景为基础的 CSS 变量覆盖集合。
- **ThemePreference（主题偏好）**：用户在设置中选择的深色/浅色主题选项，持久化存储于 `localStorage`。

---

## 需求

### 需求 1：补充 TMDB 和 TVDB 外链标签

**用户故事：** 作为用户，我希望在详情页能直接跳转到 TMDB 和 TVDB 页面，以便快速查阅剧集的元数据来源。

#### 验收标准

1. WHEN `show.tmdbId` 存在，THE DetailPage SHALL 在外链标签区域渲染一个指向 `https://www.themoviedb.org/tv/{tmdbId}` 的 TMDB 外链标签。
2. WHEN `show.tvdbId` 存在，THE DetailPage SHALL 在外链标签区域渲染一个指向 `https://www.thetvdb.com/?tab=series&id={tvdbId}` 的 TVDB 外链标签。
3. THE DetailPage SHALL 按照 TMDB → TVDB → IMDB → Trakt 的顺序排列所有外链标签。
4. IF `show.tmdbId` 为 null，THEN THE DetailPage SHALL 不渲染 TMDB 外链标签。
5. IF `show.tvdbId` 为 null，THEN THE DetailPage SHALL 不渲染 TVDB 外链标签。
6. THE ExternalLinkBadge SHALL 在新标签页中打开外部链接，并设置 `rel="noreferrer"`。

---

### 需求 2：详情页视觉重设计（Trakt 风格）

**用户故事：** 作为用户，我希望详情页拥有更丰富的视觉层次，参照 Trakt 的设计风格，以便获得更沉浸的浏览体验。

#### 验收标准

1. THE DetailPage SHALL 在顶部渲染一个全宽 Backdrop 区域，高度不低于 320px，图片以 `object-fit: cover` 方式填充。
2. THE DetailPage SHALL 在 Backdrop 底部叠加一个从透明到页面背景色的渐变遮罩，使内容区域与背景图自然过渡。
3. THE DetailPage SHALL 在 Backdrop 左下角区域叠加显示剧集海报，海报尺寸不小于 140×210px，并带有圆角与阴影。
4. THE DetailPage SHALL 在海报右侧展示标题、年份、总集数、类型标签（genres）、状态标签（status）。
5. WHEN `show.translatedName` 不为 null 且 `show.displayLanguage` 不为 null，THE DetailPage SHALL 将 `show.translatedName` 作为主标题显示，并将 `show.originalName`（或 `show.title`）以较小字号显示为副标题。
6. WHEN `show.translatedName` 为 null 或 `show.displayLanguage` 为 null，THE DetailPage SHALL 将 `show.title` 作为主标题显示，不显示副标题。
7. THE DetailPage SHALL 在标题区域下方展示剧情简介（`show.overview`），最大宽度不超过 680px，行高不低于 1.6。
8. THE DetailPage SHALL 保留现有的季/集进度折叠列表，位于简介下方。

---

### 需求 3：Statistics 页面布局优化

**用户故事：** 作为用户，我希望统计页面的信息更易于扫读，布局更合理，以便快速了解我的观看概况。

#### 验收标准

1. THE StatsPage SHALL 将顶部统计卡片（StatCard）从 2 列网格调整为 4 列网格（在宽屏下），以减少垂直滚动。
2. THE StatsPage SHALL 在统计卡片与图表之间保持不少于 24px 的间距。
3. THE StatsPage SHALL 将"Top Genres"与"Recent Activity"两个面板调整为在宽屏下并排显示（2 列），在窄屏（< 768px）下堆叠为单列。
4. THE StatsPage SHALL 为月度活跃图表（Monthly Activity）设置最小高度 200px，以提升可读性。
5. WHEN `stats.topGenres` 为空数组，THE StatsPage SHALL 隐藏 Top Genres 面板，不留空白占位。
6. WHEN `stats.recentlyWatched` 为空数组，THE StatsPage SHALL 隐藏 Recent Activity 面板，不留空白占位。

---

### 需求 4：浅色主题支持

**用户故事：** 作为用户，我希望能在设置中切换浅色背景，以便在明亮环境下获得更舒适的阅读体验。

#### 验收标准

1. THE SettingsPage SHALL 提供一个主题切换控件（深色 / 浅色），允许用户选择 ThemePreference。
2. WHEN 用户选择浅色主题，THE System SHALL 在 `<html>` 元素上添加 `data-theme="light"` 属性。
3. WHEN 用户选择深色主题，THE System SHALL 移除 `<html>` 元素上的 `data-theme` 属性（或设置为 `"dark"`）。
4. THE System SHALL 将 ThemePreference 持久化存储至 `localStorage`，键名为 `theme`。
5. WHEN 页面加载时，THE System SHALL 从 `localStorage` 读取 ThemePreference 并在渲染前应用对应主题，避免主题闪烁（FOUC）。
6. THE index.css SHALL 定义 `[data-theme="light"]` 选择器，覆盖以下 CSS 变量以实现浅色主题：
   - `--color-bg`、`--color-surface`、`--color-surface-2`、`--color-surface-3`、`--color-surface-4` 使用浅色背景值
   - `--color-text`、`--color-text-secondary`、`--color-text-muted` 使用深色文字值
   - `--color-border`、`--color-border-subtle` 使用浅色边框值
7. WHILE 浅色主题激活，THE System SHALL 保持 `--color-accent`（紫色）不变，以维持品牌一致性。
8. IF 用户未设置 ThemePreference，THEN THE System SHALL 默认使用深色主题。
