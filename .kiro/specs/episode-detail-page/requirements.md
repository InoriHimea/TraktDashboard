# Requirements Document

## Introduction

为追剧应用（Trakt TV Show Tracker）添加每集详情页功能。目前应用已有剧集详情页（ShowDetailPage），展示剧集整体进度和各季剧集缩略图列表，但缺少单集维度的详情页。

本功能参考 Trakt 的单集详情页布局，在用户点击 EpisodeGrid 中的剧集缩略图（EpisodeThumbnail）后，跳转至该集的专属详情页，展示：
1. 顶部信息卡片：截图/封面、集标题、所属剧集与季集编号、导演信息、年份/类型、评分、剧情简介、Watch 按钮
2. 底部当前季横向滚动剧集列表：展示同季所有集的缩略图，当前集高亮，可横向滚动

数据来源：已有的 Trakt API（剧集元数据、评分）和 TMDB API（截图、导演等扩展信息），通过现有后端 `/api/shows/:id` 端点及新增的 `/api/shows/:showId/episodes/:season/:episode` 端点提供。

---

## Glossary

- **EpisodeDetailPage**: 单集详情页，路由为 `/shows/:showId/seasons/:season/episodes/:episode`
- **EpisodeInfoCard**: 详情页顶部信息卡片组件，展示截图、标题、元数据、简介、Watch 按钮
- **EpisodeSeasonStrip**: 详情页底部当前季横向滚动剧集列表组件
- **EpisodeThumbnail**: EpisodeGrid 中的单集缩略图卡片（已有组件，需添加点击导航）
- **EpisodeProgress**: 已有类型，包含单集进度数据（watched、airDate、stillPath 等）
- **ShowProgress**: 已有类型，包含剧集完整进度数据（show、seasons）
- **EpisodeDetailData**: 新增 API 响应类型，包含单集详细元数据（导演、评分、TMDB 扩展信息）
- **API_Server**: 后端 Hono 服务，运行于 `apps/api`
- **Web_Client**: 前端 React + TypeScript 应用，运行于 `apps/web`
- **Trakt_API**: 外部 Trakt.tv API，提供剧集元数据和评分
- **TMDB_API**: 外部 The Movie Database API，提供截图、导演等扩展元数据
- **MetadataCache**: 数据库中的元数据缓存表（`metadataCache`），已用于 Trakt/TMDB 数据缓存
- **WatchActionPanel**: 点击 Watch 按钮后从右侧滑出的操作面板，包含四个标记时间选项；选择 Just now / Release date / Unknown date 后面板内切换为确认视图
- **DateTimePickerModal**: 点击 Other date 后弹出的独立日期时间选择器弹窗，包含本地化格式的日期时间输入框及 Cancel / Mark as Watched 按钮
- **WatchHistoryPanel**: 点击 History 按钮后从右侧滑出的历史记录面板，展示该剧集/该集的所有观看记录
- **WatchHistoryEntry**: 单条观看历史记录，包含集标题、观看时间、删除按钮
- **WatchResetCursor**: 数据库中记录"重置进度"事件的游标，存储重置发生的时间戳；进度计算仅统计最新游标时间点之后的观看记录
- **ShowDetailPage**: 已有的剧集详情页，展示剧集整体进度和各季剧集列表

---

## Requirements

### Requirement 1: 单集详情页路由与导航

**User Story:** As a 追剧用户, I want 点击剧集缩略图后进入该集的专属详情页, so that 我可以查看该集的完整信息。

#### Acceptance Criteria

1. THE Web_Client SHALL 注册路由 `/shows/:showId/seasons/:season/episodes/:episode`，渲染 EpisodeDetailPage 组件
2. WHEN 用户点击 EpisodeGrid 中的 EpisodeThumbnail（非未播出集），THE Web_Client SHALL 导航至对应集的 EpisodeDetailPage 路由
3. WHEN 用户点击 EpisodeDetailPage 上的返回按钮，THE Web_Client SHALL 导航回上一页（ShowDetailPage）
4. IF 路由参数 `showId`、`season` 或 `episode` 不是有效正整数，THEN THE Web_Client SHALL 重定向至 `/progress` 页面
5. WHILE EpisodeDetailPage 数据加载中，THE Web_Client SHALL 展示骨架屏占位（Skeleton）

---

### Requirement 2: 后端单集详情 API 端点

**User Story:** As a Web_Client, I want 通过 API 获取单集的完整元数据（包括导演、评分、TMDB 扩展信息）, so that 详情页可以展示完整内容。

#### Acceptance Criteria

1. THE API_Server SHALL 提供端点 `GET /api/shows/:showId/episodes/:season/:episode`，返回 EpisodeDetailData
2. WHEN 请求的 `showId`、`season`、`episode` 均为有效正整数且记录存在，THE API_Server SHALL 返回 HTTP 200 及 EpisodeDetailData
3. IF 请求的 showId 在数据库中不存在，THEN THE API_Server SHALL 返回 HTTP 404 及错误信息
4. IF 请求的 season 或 episode 编号在该剧集中不存在，THEN THE API_Server SHALL 返回 HTTP 404 及错误信息
5. THE API_Server SHALL 从 MetadataCache 读取 TMDB 单集扩展数据（crew/导演），缓存 TTL 为 7 天
6. WHEN MetadataCache 中无有效缓存，THE API_Server SHALL 调用 TMDB_API 获取单集详情并写入 MetadataCache
7. THE EpisodeDetailData SHALL 包含以下字段：episodeId、showId、seasonNumber、episodeNumber、title、translatedTitle、overview、translatedOverview、airDate、runtime、stillPath、watched、watchedAt、traktRating（0–100 整数或 null）、directors（字符串数组）、show（包含 title、posterPath、genres、traktId、tmdbId）

---

### Requirement 3: EpisodeInfoCard 顶部信息卡片

**User Story:** As a 追剧用户, I want 在详情页顶部看到该集的截图、标题、元数据和简介, so that 我能快速了解该集内容。

#### Acceptance Criteria

1. THE EpisodeInfoCard SHALL 展示该集的截图（stillPath），图片比例为 16:9
2. IF stillPath 为 null 或图片加载失败，THEN THE EpisodeInfoCard SHALL 展示 EpisodePlaceholder 占位组件
3. THE EpisodeInfoCard SHALL 展示集标题（优先 translatedTitle，fallback 为 title）
4. THE EpisodeInfoCard SHALL 展示所属剧集名称及季集编号，格式为 `Season {N} · Episode {N}`
5. THE EpisodeInfoCard SHALL 展示 traktRating，格式为百分比整数（如 `78%`）；IF traktRating 为 null，THEN THE EpisodeInfoCard SHALL 不展示评分区域
6. THE EpisodeInfoCard SHALL 展示剧情简介（优先 translatedOverview，fallback 为 overview）；IF 两者均为 null，THEN THE EpisodeInfoCard SHALL 不展示简介区域
7. WHERE directors 数组非空，THE EpisodeInfoCard SHALL 展示导演信息
8. THE EpisodeInfoCard SHALL 展示 airDate（年份）和 runtime（分钟数）
9. THE EpisodeInfoCard SHALL 展示 Watch 按钮；WHEN 用户点击 Watch 按钮，THE Web_Client SHALL 滚动至 EpisodeSeasonStrip 区域

---

### Requirement 4: EpisodeSeasonStrip 当前季横向滚动列表

**User Story:** As a 追剧用户, I want 在详情页底部看到当前季的所有剧集缩略图并能横向滚动, so that 我可以快速切换到同季其他集。

#### Acceptance Criteria

1. THE EpisodeSeasonStrip SHALL 展示当前季所有剧集的缩略图列表，支持横向滚动
2. THE EpisodeSeasonStrip SHALL 高亮当前正在查看的集（视觉上与其他集有明显区分）
3. WHEN 页面加载完成，THE Web_Client SHALL 自动将当前集的缩略图滚动至可视区域内（scroll into view）
4. WHEN 用户点击 EpisodeSeasonStrip 中的某集缩略图（非未播出集），THE Web_Client SHALL 导航至该集的 EpisodeDetailPage
5. THE EpisodeSeasonStrip SHALL 对未播出集（aired === false）禁用点击导航，并展示"未播出"标签
6. THE EpisodeSeasonStrip SHALL 对已观看集展示已看标记（对勾图标）

---

### Requirement 5: 数据获取与错误处理

**User Story:** As a 追剧用户, I want 详情页在数据加载失败时给出明确提示并支持重试, so that 我不会因网络问题卡在空白页面。

#### Acceptance Criteria

1. THE Web_Client SHALL 使用 React Query 管理 EpisodeDetailPage 的数据请求，queryKey 包含 `['episode-detail', showId, season, episode]`
2. WHEN API 请求成功，THE Web_Client SHALL 渲染 EpisodeInfoCard 和 EpisodeSeasonStrip
3. IF API 请求返回错误（非 2xx），THEN THE Web_Client SHALL 展示错误状态 UI，包含错误提示文字和"重新加载"按钮
4. WHEN 用户点击"重新加载"按钮，THE Web_Client SHALL 重新发起 API 请求
5. THE Web_Client SHALL 在 EpisodeDetailPage 加载期间展示骨架屏，骨架屏结构与最终布局一致（顶部卡片区 + 底部列表区）

---

### Requirement 6: 多语言支持

**User Story:** As a 使用非英语界面的用户, I want 详情页的标题和简介优先展示本地化内容, so that 我能以母语阅读剧集信息。

#### Acceptance Criteria

1. THE EpisodeInfoCard SHALL 优先展示 translatedTitle；IF translatedTitle 为 null，THEN THE EpisodeInfoCard SHALL 展示 title
2. THE EpisodeInfoCard SHALL 优先展示 translatedOverview；IF translatedOverview 为 null，THEN THE EpisodeInfoCard SHALL 展示 overview
3. THE API_Server SHALL 根据用户的 displayLanguage 设置，在调用 TMDB_API 时传递对应的 language 参数
4. THE API_Server SHALL 为不同语言的 TMDB 请求使用独立的 MetadataCache 键（格式：`tmdb_episode_{tmdbId}_{language}`）

---

### Requirement 7: 可访问性

**User Story:** As a 使用键盘或辅助技术的用户, I want 详情页的交互元素可通过键盘访问, so that 我可以无障碍地使用该功能。

#### Acceptance Criteria

1. THE EpisodeDetailPage SHALL 为主要内容区域设置语义化 HTML 标签（`<main>`、`<article>`、`<section>`）
2. THE EpisodeInfoCard 中的 Watch 按钮 SHALL 具有可访问的文字标签（aria-label 或可见文字）
3. THE EpisodeSeasonStrip 中的每个缩略图 SHALL 具有 aria-label，格式为 `S{NN}E{NN} {title}`
4. THE EpisodeSeasonStrip 中当前集的缩略图 SHALL 设置 `aria-current="true"`
5. WHEN 用户通过键盘（Tab/Enter）操作 EpisodeThumbnail，THE Web_Client SHALL 触发与鼠标点击相同的导航行为

---

### Requirement 8: 标记已观看（Watch 操作）

**User Story:** As a 追剧用户, I want 在剧集详情页和每集详情页点击 Watch 按钮后选择观看时间并标记为已观看, so that 我可以灵活记录实际的观看时间。

#### Acceptance Criteria

1. THE ShowDetailPage 和 EpisodeDetailPage 的 Watch 按钮区域 SHALL 各自展示一个 Watch 按钮
2. WHEN 用户点击 Watch 按钮，THE Web_Client SHALL 从页面右侧滑出 WatchActionPanel
3. THE WatchActionPanel SHALL 展示以下四个选项：
   - **Just now**：将观看时间记录为当前时间戳
   - **Release date**：将观看时间记录为该集的 airDate
   - **Other date**：打开日期时间选择器弹窗，允许用户输入自定义日期时间
   - **Unknown date**：记录一条不含具体时间的观看记录（watchedAt 为 null）
4. WHEN 用户点击 Other date 选项，THE Web_Client SHALL 打开一个独立的日期时间选择器弹窗（DateTimePickerModal）
5. THE DateTimePickerModal SHALL 包含一个日期时间输入框，显示格式为本地化格式（`YYYY/MM/DD 上午/下午 HH:mm`），输入框左侧展示日历图标，右侧提供日历图标按钮可调用系统原生日期选择器
6. WHEN DateTimePickerModal 打开时，THE Web_Client SHALL 将日期时间输入框的默认值设置为当前日期时间
7. THE DateTimePickerModal SHALL 在底部展示两个按钮：Cancel（灰色）和 Mark as Watched（主色调紫色）
8. WHEN 用户在 DateTimePickerModal 中点击 Cancel，THE Web_Client SHALL 关闭 DateTimePickerModal 并返回 WatchActionPanel，不执行任何写入操作
9. WHEN 用户在 DateTimePickerModal 中点击 Mark as Watched，THE Web_Client SHALL 将用户选择的日期时间作为最终确认，调用 API 写入观看记录，watchedAt 为用户选择的日期时间（转换为 UTC 时间戳）
10. WHEN 用户选择 Just now，THE WatchActionPanel SHALL 切换至确认视图，展示将要记录的时间摘要（格式为"标记为已观看：{本地化日期时间}"）及 Mark as Watched（紫色）和 Cancel（灰色）两个按钮
11. WHEN 用户选择 Release date，THE WatchActionPanel SHALL 切换至确认视图，展示将要记录的时间摘要（格式为"标记为已观看：{airDate 本地化日期时间}"）及 Mark as Watched（紫色）和 Cancel（灰色）两个按钮
12. WHEN 用户选择 Unknown date，THE WatchActionPanel SHALL 切换至确认视图，展示时间摘要"标记为已观看：未知时间"及 Mark as Watched（紫色）和 Cancel（灰色）两个按钮
13. WHEN 用户在 WatchActionPanel 确认视图中点击 Cancel，THE Web_Client SHALL 返回 WatchActionPanel 的选项视图，不执行任何写入操作
14. WHEN 用户在 WatchActionPanel 确认视图中点击 Mark as Watched，THE API_Server SHALL 在 watchHistory 表中插入对应记录
15. WHEN 用户选择 Just now 并最终确认，THE API_Server SHALL 在 watchHistory 表中插入一条记录，watchedAt 为服务端当前 UTC 时间
16. WHEN 用户选择 Release date 并最终确认，THE API_Server SHALL 在 watchHistory 表中插入一条记录，watchedAt 为该集的 airDate（转换为 UTC 时间戳）
17. WHEN 用户选择 Unknown date 并最终确认，THE API_Server SHALL 在 watchHistory 表中插入一条记录，watchedAt 为 null
18. IF 该集的 airDate 为 null，THEN THE WatchActionPanel SHALL 禁用 Release date 选项并展示不可用提示
19. WHEN 观看记录写入成功，THE Web_Client SHALL 关闭 WatchActionPanel 并刷新当前页面的进度数据
20. IF API 写入失败，THEN THE Web_Client SHALL 在 WatchActionPanel 或 DateTimePickerModal 内展示错误提示，不关闭面板
21. WHEN 用户点击 WatchActionPanel 以外的区域或按下 Escape 键，THE Web_Client SHALL 关闭 WatchActionPanel

---

### Requirement 9: 观看历史（History）

**User Story:** As a 追剧用户, I want 在剧集详情页和每集详情页查看并管理该剧集/该集的所有观看历史记录, so that 我可以了解自己的观看情况并删除错误记录。

#### Acceptance Criteria

1. THE ShowDetailPage 和 EpisodeDetailPage 的 Watch 按钮区域下方 SHALL 各自展示一个 History 按钮
2. WHEN 用户点击 History 按钮，THE Web_Client SHALL 从页面右侧滑出 WatchHistoryPanel
3. THE API_Server SHALL 提供端点 `GET /api/shows/:showId/history`，返回该剧集所有集的观看历史记录列表，按 watchedAt 降序排列
4. THE API_Server SHALL 提供端点 `GET /api/shows/:showId/episodes/:season/:episode/history`，返回该集的观看历史记录列表，按 watchedAt 降序排列
5. THE WatchHistoryPanel SHALL 展示每条 WatchHistoryEntry，包含：集标题（格式为 `S{NN}·E{NN} - {title}`）、观看时间（格式为相对时间或绝对时间）、删除按钮（垃圾桶图标）
6. IF watchedAt 为 null，THEN THE WatchHistoryPanel SHALL 展示"未知时间"代替观看时间
7. IF 历史记录列表为空，THEN THE WatchHistoryPanel SHALL 展示"暂无观看记录"提示
8. WHEN 用户点击某条 WatchHistoryEntry 的删除按钮，THE Web_Client SHALL 展示确认提示
9. WHEN 用户确认删除，THE API_Server SHALL 从 watchHistory 表中删除对应记录，THE Web_Client SHALL 刷新 WatchHistoryPanel 内的列表
10. IF 删除 API 请求失败，THEN THE Web_Client SHALL 在 WatchHistoryPanel 内展示错误提示
11. WHEN 用户点击 WatchHistoryPanel 以外的区域或按下 Escape 键，THE Web_Client SHALL 关闭 WatchHistoryPanel

---

### Requirement 10: 重置进度（Watch again）

**User Story:** As a 追剧用户, I want 在剧集进度达到 100% 时重置该剧集的观看进度并重新开始追剧, so that 我可以二刷剧集而不丢失原有的观看历史。

#### Acceptance Criteria

1. WHILE 某剧集的完成度（watchedEpisodes / airedEpisodes）达到 100%，THE ShowDetailPage SHALL 在 Watch 按钮区域展示"Watch again..."选项
2. WHEN 用户点击"Watch again..."，THE Web_Client SHALL 展示确认对话框，说明此操作将重置进度但保留历史记录
3. WHEN 用户确认重置，THE API_Server SHALL 在数据库中为该剧集插入一条新的 WatchResetCursor 记录，记录当前 UTC 时间戳
4. THE API_Server SHALL 在计算剧集进度（watchedEpisodes / airedEpisodes）时，仅统计最新 WatchResetCursor 时间戳之后的 watchHistory 记录
5. IF 某剧集存在多条 WatchResetCursor 记录，THEN THE API_Server SHALL 取 resetAt 最大的一条作为有效游标
6. THE API_Server SHALL 保留 WatchResetCursor 之前的所有 watchHistory 记录，不执行删除操作
7. WHEN 重置操作成功，THE Web_Client SHALL 关闭确认对话框并刷新 ShowDetailPage 的进度数据，进度显示应重置为基于新游标计算的值
8. IF 重置 API 请求失败，THEN THE Web_Client SHALL 关闭确认对话框并展示错误提示
9. THE EpisodeDetailPage SHALL 不展示"Watch again..."选项（该功能仅适用于 ShowDetailPage）
10. THE API_Server SHALL 提供端点 `POST /api/shows/:showId/reset`，写入新的 WatchResetCursor 并返回更新后的进度数据
