# Requirements Document

## Introduction

对 trakt-dashboard 前端界面进行全面重构，将左侧固定侧边栏改为顶部水平导航栏，新增 Sync（同步日志）和 Settings（设置）页面，重新设计剧集卡片为海报大图风格，并引入多语言标题支持（通过 TMDB API 获取翻译标题与原始标题）。后端新增 `user_settings` 表和 `/api/settings` 接口，`shows` 表扩展多语言字段，`getTmdbShow` 支持语言参数。

## Glossary

- **TopNav**：顶部水平导航栏组件，替代现有左侧侧边栏
- **SyncPage**：新增的同步执行日志页面（路由 `/sync`）
- **SettingsPage**：新增的设置页面（路由 `/settings`）
- **ShowCard**：剧集进度卡片组件，重构为海报大图风格
- **UserSettings**：用户设置实体，存储于 `user_settings` 数据库表
- **Settings_API**：后端 `/api/settings` 接口，提供 GET/PUT 操作
- **TMDB_Service**：后端 TMDB 数据获取服务（`apps/api/src/services/tmdb.ts`）
- **Display_Language**：用于 TMDB 翻译内容的语言代码，格式如 `zh-CN`、`en-US`、`ja-JP`
- **translated_name**：从 TMDB API 按 Display_Language 获取的翻译标题
- **original_name**：TMDB `original_name` 字段，即剧集的原始语言标题
- **Scheduler**：后端定时同步任务（`apps/api/src/jobs/scheduler.ts`）

---

## Requirements

### Requirement 1：顶部导航栏布局

**User Story:** 作为用户，我希望通过顶部水平导航栏在各页面间切换，以便获得更宽敞的内容展示区域。

#### Acceptance Criteria

1. THE **TopNav** SHALL 在页面顶部渲染包含以下四个导航项的水平导航栏：Statistics、Progress、Sync、Settings。
2. WHEN 用户点击导航项，THE **TopNav** SHALL 跳转至对应路由（`/stats`、`/progress`、`/sync`、`/settings`）并高亮当前激活项。
3. THE **TopNav** SHALL 在左侧展示应用 Logo（`trakt·dash`）和当前登录用户的 Trakt 用户名。
4. THE **TopNav** SHALL 在右侧提供登出按钮。
5. THE **TopNav** SHALL 保持现有深色主题 CSS 变量系统（`--color-bg`、`--color-surface` 等），不引入新的 UI 组件库。
6. WHEN 页面宽度小于 768px，THE **TopNav** SHALL 保持可用性，导航项不得溢出或遮挡内容区域。

---

### Requirement 2：Statistics 与 Progress 页面适配

**User Story:** 作为用户，我希望现有的统计和进度页面在新布局下正常工作，不丢失任何功能。

#### Acceptance Criteria

1. WHEN 用户访问 `/stats`，THE **StatsPage** SHALL 在 TopNav 下方的内容区正常渲染所有统计数据。
2. WHEN 用户访问 `/progress`，THE **ProgressPage** SHALL 在 TopNav 下方的内容区正常渲染剧集进度列表。
3. THE **ProgressPage** SHALL 保留现有的 filter（watching / completed / all）和搜索功能。
4. IF 原侧边栏中的同步状态面板被移除，THEN THE **SyncPage** SHALL 承接同步触发和状态展示功能（见 Requirement 3）。

---

### Requirement 3：Sync 同步日志页面

**User Story:** 作为用户，我希望在专属页面查看实时同步进度、历史日志和失败列表，以便了解同步状态并排查问题。

#### Acceptance Criteria

1. WHEN 用户访问 `/sync`，THE **SyncPage** SHALL 展示当前同步状态（idle / running / completed / error）。
2. WHILE 同步状态为 `running`，THE **SyncPage** SHALL 实时展示进度条、已处理数量（`progress / total`）和当前正在同步的剧集名称，刷新间隔不超过 2000ms。
3. WHEN 同步状态为 `idle` 或 `completed`，THE **SyncPage** SHALL 展示"立即同步"按钮，点击后触发同步并将状态切换为 `running`。
4. WHEN 同步状态为 `error`，THE **SyncPage** SHALL 展示错误信息文本。
5. WHEN `syncState.failedShows` 数组长度大于 0，THE **SyncPage** SHALL 展示失败剧集列表，每项包含剧集标题和错误原因。
6. THE **SyncPage** SHALL 展示上次同步完成时间（`lastSyncAt`），格式为本地化日期时间字符串。

---

### Requirement 4：Settings 设置页面（前端）

**User Story:** 作为用户，我希望在设置页面配置显示语言、同步间隔和代理，以便个性化应用行为。

#### Acceptance Criteria

1. WHEN 用户访问 `/settings`，THE **SettingsPage** SHALL 从 `GET /api/settings` 加载当前设置并填充表单。
2. THE **SettingsPage** SHALL 提供 Display_Language 输入项，支持输入符合 BCP 47 格式的语言代码（如 `zh-CN`、`en-US`、`ja-JP`），默认值为 `zh-CN`。
3. THE **SettingsPage** SHALL 提供同步间隔输入项（单位：分钟），接受 1 到 10080（7天）之间的整数。
4. THE **SettingsPage** SHALL 提供 HTTP 代理输入项，接受空字符串或合法的 HTTP/HTTPS URL 格式。
5. WHEN 用户点击保存，THE **SettingsPage** SHALL 调用 `PUT /api/settings` 提交表单数据，并在成功后展示确认提示。
6. IF `PUT /api/settings` 返回错误，THEN THE **SettingsPage** SHALL 展示错误信息，不关闭表单。

---

### Requirement 5：Settings API（后端）

**User Story:** 作为系统，我需要持久化用户设置，以便在重启后保留配置。

#### Acceptance Criteria

1. THE **Settings_API** SHALL 在数据库中维护 `user_settings` 表，字段包括：`userId`（外键关联 `users.id`）、`displayLanguage`（text，默认 `zh-CN`）、`syncIntervalMinutes`（integer，默认 60）、`httpProxy`（text，可为 null）。
2. WHEN 收到 `GET /api/settings` 请求，THE **Settings_API** SHALL 返回当前认证用户的设置对象；若记录不存在，SHALL 返回包含默认值的对象。
3. WHEN 收到 `PUT /api/settings` 请求且请求体包含合法字段，THE **Settings_API** SHALL 使用 upsert 操作更新或创建该用户的设置记录，并返回更新后的完整设置对象。
4. IF `PUT /api/settings` 请求体中 `syncIntervalMinutes` 不在 1 到 10080 范围内，THEN THE **Settings_API** SHALL 返回 HTTP 400 及描述性错误信息。
5. IF `PUT /api/settings` 请求体中 `httpProxy` 不为空且不是合法的 HTTP/HTTPS URL，THEN THE **Settings_API** SHALL 返回 HTTP 400 及描述性错误信息。
6. FOR ALL 合法的 UserSettings 对象，执行 `PUT` 后再执行 `GET` SHALL 返回等价的设置对象（round-trip 属性）。

---

### Requirement 6：shows 表多语言字段扩展

**User Story:** 作为系统，我需要在数据库中存储剧集的原始标题和翻译标题，以便前端展示多语言信息。

#### Acceptance Criteria

1. THE **shows** 表 SHALL 新增以下字段：`original_name`（text，可为 null）、`translated_name`（text，可为 null）、`display_language`（text，可为 null）。
2. WHEN 同步服务写入剧集数据，THE **Sync_Service** SHALL 将 TMDB `original_name` 字段值存入 `original_name` 列。
3. WHEN 同步服务写入剧集数据且 Display_Language 不为 `null`，THE **Sync_Service** SHALL 将按 Display_Language 获取的 TMDB 翻译标题存入 `translated_name` 列，并将 Display_Language 存入 `display_language` 列。
4. THE **Show** 类型（`packages/types/src/index.ts`）SHALL 新增 `originalName: string | null`、`translatedName: string | null`、`displayLanguage: string | null` 字段。

---

### Requirement 7：TMDB Service 多语言支持

**User Story:** 作为系统，我需要 TMDB 服务支持按语言获取翻译数据，以便存储和展示多语言标题。

#### Acceptance Criteria

1. WHEN 调用 `getTmdbShow(tmdbId, language)`，THE **TMDB_Service** SHALL 在 TMDB API 请求 URL 中附加 `language` 查询参数。
2. THE **TMDB_Service** SHALL 在 `TmdbShow` 类型中新增 `original_name: string` 字段。
3. WHEN `language` 参数与缓存记录的语言不同，THE **TMDB_Service** SHALL 绕过缓存重新请求 TMDB API，并以新的语言标识更新缓存键。
4. IF `language` 参数未提供，THEN THE **TMDB_Service** SHALL 使用不带 `language` 参数的原有行为（向后兼容）。

---

### Requirement 8：ShowCard 海报大图风格重构

**User Story:** 作为用户，我希望剧集卡片以海报大图风格展示，参考 Trakt 官网的卡片设计，以便更直观地识别剧集。

#### Acceptance Criteria

1. THE **ShowCard** SHALL 展示剧集海报图片，尺寸不小于 `w300`（TMDB 图片规格），宽高比为 2:3（竖版海报）。
2. IF 剧集无海报图片（`posterPath` 为 null），THEN THE **ShowCard** SHALL 展示占位图标，不得出现破损图片元素。
3. THE **ShowCard** SHALL 在卡片上展示 Trakt ID（`traktId`）和 TMDB ID（`tmdbId`）。
4. WHEN `show.translatedName` 不为 null，THE **ShowCard** SHALL 将 `translatedName` 作为主标题展示，并在其下方展示 `originalName` 作为副标题。
5. WHEN `show.translatedName` 为 null，THE **ShowCard** SHALL 将 `show.title` 作为主标题展示，不展示副标题。
6. THE **ShowCard** SHALL 展示观看进度（已看集数 / 已播出集数）和完成百分比。
7. THE **ShowCard** SHALL 保持现有深色主题 CSS 变量系统，不引入新的 UI 组件库。

---

### Requirement 9：代理与同步间隔动态配置

**User Story:** 作为系统，我需要在运行时从用户设置中读取代理和同步间隔，以便无需重启即可生效。

#### Acceptance Criteria

1. WHEN **TMDB_Service** 发起 HTTP 请求，THE **TMDB_Service** SHALL 优先读取 `user_settings.httpProxy`；若为空，SHALL 回退到环境变量 `HTTP_PROXY` / `HTTPS_PROXY`。
2. WHEN **Scheduler** 初始化或设置更新后，THE **Scheduler** SHALL 从 `user_settings.syncIntervalMinutes` 读取同步间隔并据此调整定时任务周期。
3. IF `user_settings` 表中无当前用户记录，THEN THE **Scheduler** SHALL 使用默认同步间隔 60 分钟。
