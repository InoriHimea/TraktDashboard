# Requirements Document

## Introduction

本功能将重构 trakt-dashboard 的数据同步架构，将 Trakt API 从仅用于观看记录提升为剧集元数据的主数据源（show info、seasons、episodes，包含 TBA 未播出集）。TMDB API 降级为翻译补充源，仅在用户设置了 `displayLanguage` 时用于获取本地化标题、简介和海报。

核心动机：
1. Trakt 提供完整的 TBA（To Be Announced）条目，TMDB 不提前返回未来集数据
2. Trakt 的 Specials（Season 0）数据更准确
3. 减少对 TMDB 的依赖，降低外部 API 调用量

## Glossary

- **Sync_Service**: `apps/api/src/services/sync.ts` 中的同步逻辑模块
- **Trakt_Client**: `apps/api/src/services/trakt.ts` 中的 Trakt API 客户端
- **TMDB_Client**: `apps/api/src/services/tmdb.ts` 中的 TMDB API 客户端
- **TBA Episode**: To Be Announced，已知存在但尚未播出、尚无完整元数据的集数条目
- **Specials**: Season 0，特别集，Trakt 对此数据更准确
- **displayLanguage**: 用户在 `userSettings` 中配置的显示语言（如 `zh-CN`）
- **Primary_Source**: 作为元数据权威来源的 API，当前目标为 Trakt
- **Translation_Source**: 仅提供本地化翻译的补充 API，当前目标为 TMDB
- **Metadata_Cache**: `metadata_cache` 数据库表，用于缓存外部 API 响应
- **upsertShowFromTrakt**: 替代现有 `upsertShowFromTmdb` 的新核心函数

---

## Requirements

### Requirement 1: Trakt Show 详情获取

**User Story:** As a 系统同步模块, I want to 通过 Trakt API 获取 show 的完整元数据, so that 不再依赖 TMDB 作为 show 基础信息的来源。

#### Acceptance Criteria

1. WHEN `Trakt_Client` 调用 `GET /shows/{traktId}?extended=full` 时，THE `Trakt_Client` SHALL 返回包含 `title`、`overview`、`status`、`first_aired`、`network`、`genres`、`ids`（含 `tmdb`、`tvdb`、`imdb`、`trakt`、`slug`）字段的 `TraktShowDetail` 对象
2. IF Trakt API 返回非 200 状态码，THEN THE `Trakt_Client` SHALL 抛出包含状态码和路径信息的错误
3. THE `Trakt_Client` SHALL 对 `GET /shows/{traktId}?extended=full` 响应进行缓存，缓存键格式为 `trakt_show_{traktId}`，TTL 为 7 天
4. WHEN 缓存命中且未过期时，THE `Trakt_Client` SHALL 直接返回缓存数据，不发起网络请求

### Requirement 2: Trakt Seasons 列表获取

**User Story:** As a 系统同步模块, I want to 通过 Trakt API 获取 show 的所有季信息（含 Season 0 Specials）, so that 能准确反映 Trakt 的季结构，包括特别集。

#### Acceptance Criteria

1. WHEN `Trakt_Client` 调用 `GET /shows/{traktId}/seasons?extended=full` 时，THE `Trakt_Client` SHALL 返回 `TraktSeasonDetail[]` 数组，每项包含 `number`、`episode_count`、`first_aired`、`overview`、`ids` 字段
2. THE `Trakt_Client` SHALL 在返回结果中包含 `number === 0` 的 Specials 季（若存在）
3. THE `Trakt_Client` SHALL 对 seasons 列表响应进行缓存，缓存键格式为 `trakt_seasons_{traktId}`，TTL 为 7 天
4. IF Trakt API 返回非 200 状态码，THEN THE `Trakt_Client` SHALL 抛出包含状态码和路径信息的错误

### Requirement 3: Trakt Episodes 列表获取（含 TBA）

**User Story:** As a 系统同步模块, I want to 通过 Trakt API 获取某季的所有集（包括 TBA 未播出集）, so that 数据库中能存储完整的集数结构，用户可看到未来集的占位信息。

#### Acceptance Criteria

1. WHEN `Trakt_Client` 调用 `GET /shows/{traktId}/seasons/{seasonNumber}/episodes?extended=full` 时，THE `Trakt_Client` SHALL 返回 `TraktEpisodeDetail[]` 数组，每项包含 `number`、`season`、`title`（可为 null）、`overview`（可为 null）、`first_aired`（可为 null）、`runtime`（可为 null）、`ids` 字段
2. THE `Trakt_Client` SHALL 在返回结果中包含 `first_aired` 为 null 的 TBA 集数条目
3. THE `Trakt_Client` SHALL 对 episodes 列表响应进行缓存，缓存键格式为 `trakt_episodes_{traktId}_s{seasonNumber}`，TTL 为 24 小时（TBA 数据更新频繁，TTL 短于 show/season 缓存）
4. IF Trakt API 返回非 200 状态码，THEN THE `Trakt_Client` SHALL 抛出包含状态码和路径信息的错误

### Requirement 4: 以 Trakt 为主源的 Show Upsert

**User Story:** As a 系统同步模块, I want to 使用 Trakt 数据作为主源来写入 shows/seasons/episodes 表, so that 数据库中的剧集结构以 Trakt 为准，不再以 TMDB 为准。

#### Acceptance Criteria

1. THE `Sync_Service` SHALL 实现 `upsertShowFromTrakt` 函数，接受 `traktId`、`traktShow`（来自 watched list）、`userId` 参数
2. WHEN `upsertShowFromTrakt` 执行时，THE `Sync_Service` SHALL 调用 `Trakt_Client.getShowDetail` 获取 show 基础元数据，并写入 `shows` 表
3. WHEN `upsertShowFromTrakt` 执行时，THE `Sync_Service` SHALL 调用 `Trakt_Client.getSeasons` 获取所有季（含 Season 0），并写入 `seasons` 表
4. WHEN `upsertShowFromTrakt` 执行时，THE `Sync_Service` SHALL 对每一季并发调用 `Trakt_Client.getEpisodes`，并将所有集（含 TBA）写入 `episodes` 表
5. WHEN 写入 TBA 集时，THE `Sync_Service` SHALL 将 `airDate`、`title`、`overview` 设为 null，`traktId` 设为 Trakt episode id
6. THE `Sync_Service` SHALL 将 `upsertShowFromTrakt` 的并发季获取限制在 `SEASON_CONCURRENCY`（4）以内，与现有行为一致
7. WHEN `upsertShowFromTrakt` 完成后，THE `Sync_Service` SHALL 在 `shows` 表中保留 `tmdbId` 字段（从 Trakt ids 中取得），以维持与现有数据的兼容性

### Requirement 5: TMDB 降级为翻译补充源

**User Story:** As a 系统同步模块, I want to 仅在用户设置了 displayLanguage 时调用 TMDB 获取翻译数据, so that 减少对 TMDB 的依赖，同时保留多语言显示能力。

#### Acceptance Criteria

1. WHILE `userId` 对应的 `userSettings.displayLanguage` 为非空值时，THE `Sync_Service` SHALL 调用 `TMDB_Client` 获取该语言的 show 标题、简介和海报路径
2. WHEN TMDB 返回的翻译标题与 Trakt 原始标题不同时，THE `Sync_Service` SHALL 将翻译标题写入 `shows.translatedName`
3. WHEN TMDB 返回的翻译简介与 Trakt 原始简介不同时，THE `Sync_Service` SHALL 将翻译简介写入 `shows.translatedOverview`
4. THE `Sync_Service` SHALL 使用 TMDB 的 `poster_path` 和 `backdrop_path` 填充 `shows.posterPath` 和 `shows.backdropPath`（Trakt 不提供图片）
5. IF `userSettings.displayLanguage` 为空或未设置，THEN THE `Sync_Service` SHALL 跳过所有 TMDB 翻译调用
6. IF TMDB 翻译调用失败，THEN THE `Sync_Service` SHALL 记录警告日志并继续同步，不中断整体流程
7. WHILE `userId` 对应的 `userSettings.displayLanguage` 为非空值时，THE `Sync_Service` SHALL 调用 `TMDB_Client` 获取每集的翻译标题和翻译简介，写入 `episodes.translatedTitle` 和 `episodes.translatedOverview`

### Requirement 6: 替换同步流程中的 TMDB 主调用

**User Story:** As a 系统同步模块, I want to 在 full sync 和 incremental sync 中用 upsertShowFromTrakt 替换 upsertShowFromTmdb, so that 整个同步流程统一使用 Trakt 作为主数据源。

#### Acceptance Criteria

1. WHEN `triggerFullSync` 执行时，THE `Sync_Service` SHALL 调用 `upsertShowFromTrakt` 而非 `upsertShowFromTmdb`
2. WHEN `triggerIncrementalSync` 执行时，THE `Sync_Service` SHALL 调用 `upsertShowFromTrakt` 而非 `upsertShowFromTmdb`
3. WHEN `syncSingleShow` 执行时，THE `Sync_Service` SHALL 调用 `upsertShowFromTrakt` 而非 `upsertShowFromTmdb`
4. IF 某个 watched show 缺少 `traktId`（`ws.show.ids.trakt` 为 null），THEN THE `Sync_Service` SHALL 将该 show 记录为失败项（`failureMap`），错误信息为 `'Missing Trakt id'`
5. THE `Sync_Service` SHALL 保留现有的 `SHOW_CONCURRENCY`、`SHOW_TIMEOUT_MS`、失败重试逻辑，不改变并发控制行为

### Requirement 7: findOrCreateEpisode 使用 Trakt 数据

**User Story:** As a 系统同步模块, I want to 在 findOrCreateEpisode 中使用 Trakt API 而非 TMDB 来创建缺失集数, so that 新创建的集数条目与主数据源一致。

#### Acceptance Criteria

1. WHEN `findOrCreateEpisode` 未在数据库中找到目标集时，THE `Sync_Service` SHALL 调用 `Trakt_Client.getEpisodes` 获取该季集数数据
2. WHEN 从 Trakt 数据创建新集时，THE `Sync_Service` SHALL 将 `traktId` 设为 Trakt episode id，`tmdbId` 保持 null（除非已有 TMDB 数据）
3. IF `Trakt_Client.getEpisodes` 调用失败，THEN THE `Sync_Service` SHALL 返回 null，与现有行为一致

### Requirement 8: Trakt 元数据缓存管理

**User Story:** As a 系统同步模块, I want to 对 Trakt 元数据 API 响应进行缓存, so that 避免重复请求，减少 API 调用量和同步耗时。

#### Acceptance Criteria

1. THE `Trakt_Client` SHALL 使用现有的 `metadata_cache` 表存储 Trakt show/season/episode 响应，`source` 字段分别为 `trakt_show`、`trakt_seasons`、`trakt_episodes`
2. THE `Trakt_Client` SHALL 对 show 详情和 seasons 列表使用 7 天 TTL，对 episodes 列表使用 24 小时 TTL
3. WHEN 缓存命中且未过期时，THE `Trakt_Client` SHALL 返回缓存数据，不发起网络请求
4. WHEN 缓存未命中或已过期时，THE `Trakt_Client` SHALL 发起网络请求并将响应写入缓存
5. THE `Trakt_Client` SHALL 复用现有 `fetchWithRetry` 逻辑（含 429 重试和 token 刷新），不重复实现

### Requirement 9: 数据库 Schema 兼容性

**User Story:** As a 系统同步模块, I want to 在不破坏现有数据库结构的前提下完成架构切换, so that 无需数据迁移即可完成重构。

#### Acceptance Criteria

1. THE `Sync_Service` SHALL 保持 `shows.tmdbId` 字段非空（从 Trakt ids 中取得 `ids.tmdb`），维持现有唯一索引约束
2. THE `Sync_Service` SHALL 保持 `episodes.traktId` 字段的写入，使用 Trakt episode id
3. THE `Sync_Service` SHALL 保持 `episodes.tmdbId` 字段可为 null（Trakt 数据中 episode 级别的 tmdb id 不保证存在）
4. THE `Sync_Service` SHALL 保持 `shows.posterPath`、`shows.backdropPath` 字段由 TMDB 填充（Trakt 不提供图片 URL）
5. IF 某个 show 在 Trakt 中存在但 `ids.tmdb` 为 null，THEN THE `Sync_Service` SHALL 将该 show 记录为失败项，错误信息为 `'Missing TMDB id (required for poster/image support)'`
