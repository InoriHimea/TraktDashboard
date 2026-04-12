# Implementation Plan: trakt-primary-datasource

## Overview

将 Trakt API 提升为剧集元数据主数据源。分三步推进：先扩展 `trakt.ts` 新增接口和方法（含缓存），再重构 `sync.ts` 替换主 upsert 函数，最后编写属性测试验证正确性属性。

## Tasks

- [ ] 1. 扩展 trakt.ts：新增类型接口
  - 在 `apps/api/src/services/trakt.ts` 中新增 `TraktShowDetail`、`TraktSeasonDetail`、`TraktEpisodeDetail` 三个 TypeScript 接口
  - `TraktShowDetail`：包含 `title`、`year`、`overview`、`status`、`first_aired`、`network`、`genres`、`ids`（含 `trakt`、`slug`、`tvdb`、`imdb`、`tmdb`）
  - `TraktSeasonDetail`：包含 `number`、`episode_count`、`first_aired`、`overview`、`ids`
  - `TraktEpisodeDetail`：包含 `number`、`season`、`title`（可 null）、`overview`（可 null）、`first_aired`（可 null）、`runtime`（可 null）、`ids`
  - _Requirements: 1.1, 2.1, 3.1_

- [ ] 2. 扩展 trakt.ts：实现带缓存的 getShowDetail / getSeasons / getEpisodes
  - [ ] 2.1 实现 `getShowDetail(traktId, userId)` 方法
    - 调用 `GET /shows/{traktId}?extended=full`，复用现有 `traktFetch` 基础设施
    - 使用 `metadata_cache` 表缓存响应，`source='trakt_show'`，`externalId='trakt_show_{traktId}'`，TTL 7 天
    - 非 200 响应抛出包含状态码信息的错误
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 2.2 为 getShowDetail 编写属性测试
    - **Property 2: 非 200 状态码始终抛出错误**
    - **Validates: Requirements 1.2, 2.4, 3.4**
    - 使用 `fc.integer({ min: 400, max: 599 })` 生成状态码，验证每个状态码都抛出错误
    - 注释：`// Feature: trakt-primary-datasource, Property 2: 非 200 状态码始终抛出错误`

  - [ ]* 2.3 为缓存机制编写属性测试
    - **Property 3: 缓存命中时不发起网络请求（幂等性）**
    - **Validates: Requirements 1.4, 8.3**
    - 使用 `fc.integer({ min: 1 })` 生成 traktId，验证第二次调用不触发 fetch
    - **Property 4: 缓存写入使用正确的键格式**
    - **Validates: Requirements 1.3, 2.3, 3.3, 8.1, 8.4**
    - 验证 `externalId` 符合 `trakt_show_{id}`、`trakt_seasons_{id}`、`trakt_episodes_{id}_s{n}` 格式
    - 注释：`// Feature: trakt-primary-datasource, Property 3/4`

  - [ ] 2.4 实现 `getSeasons(traktId, userId)` 方法
    - 调用 `GET /shows/{traktId}/seasons?extended=full`
    - 缓存：`source='trakt_seasons'`，`externalId='trakt_seasons_{traktId}'`，TTL 7 天
    - 不过滤任何季（含 `number === 0` 的 Specials）
    - 非 200 响应抛出错误
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 8.1, 8.2_

  - [ ]* 2.5 为 getSeasons 编写属性测试
    - **Property 5: Season 0（Specials）不被过滤**
    - **Validates: Requirements 2.2**
    - 使用 `fc.array` 生成含 `number=0` 条目的 seasons 数组，验证返回结果包含该条目
    - 注释：`// Feature: trakt-primary-datasource, Property 5: Season 0 不被过滤`

  - [ ] 2.6 实现 `getEpisodes(traktId, seasonNumber, userId)` 方法
    - 调用 `GET /shows/{traktId}/seasons/{seasonNumber}/episodes?extended=full`
    - 缓存：`source='trakt_episodes'`，`externalId='trakt_episodes_{traktId}_s{seasonNumber}'`，TTL 24 小时
    - 不过滤任何集（含 `first_aired === null` 的 TBA 集）
    - 非 200 响应抛出错误
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 8.1, 8.2_

  - [ ]* 2.7 为 getEpisodes 编写属性测试
    - **Property 6: TBA 集数不被过滤**
    - **Validates: Requirements 3.2**
    - 使用 `fc.array` 生成含 `first_aired=null` 条目的 episodes 数组，验证返回结果包含 TBA 集
    - 注释：`// Feature: trakt-primary-datasource, Property 6: TBA 集数不被过滤`

- [ ] 3. Checkpoint — 确认 trakt.ts 扩展完整
  - 确保所有测试通过，如有疑问请询问用户。

- [ ] 4. 重构 sync.ts：实现 upsertShowFromTrakt
  - [ ] 4.1 实现 `upsertShowFromTrakt(traktId, traktShow, userId)` 函数骨架
    - 读取 `userSettings.displayLanguage`
    - 调用 `getShowDetail(traktId, userId)` 获取 show 元数据
    - 若 `ids.tmdb` 为 null，抛出 `'Missing TMDB id (required for poster/image support)'` 错误
    - _Requirements: 4.1, 4.2, 9.1, 9.5_

  - [ ] 4.2 实现 shows 表 upsert 逻辑
    - 字段映射：`title`/`overview`/`status`/`firstAired`/`network`/`genres` 来自 Trakt；`posterPath`/`backdropPath` 来自 TMDB（仅 displayLanguage 非空时）
    - `originalName` 使用 `traktDetail.title`（Trakt 无 original_name）
    - `totalSeasons` = `traktSeasons.length`，`totalEpisodes` = `sum(season.episode_count)`（在获取 seasons 后填充）
    - `onConflictDoUpdate` target: `shows.tmdbId`
    - _Requirements: 4.2, 4.7, 5.1, 5.2, 5.3, 5.4, 9.1, 9.4_

  - [ ] 4.3 实现 seasons 和 episodes 并发 upsert
    - 调用 `getSeasons(traktId, userId)` 获取所有季（含 Season 0）
    - 使用 `pLimit(SEASON_CONCURRENCY)` 并发对每季调用 `getEpisodes`
    - TBA 集（`first_aired === null`）写入时 `airDate`/`title`/`overview` 设为 null，`traktId` 设为 `traktEpisode.ids.trakt`
    - `episodes.tmdbId` 使用 `traktEpisode.ids.tmdb`（可为 null）
    - 单季 `getEpisodes` 失败时 `console.warn` 并跳过，不中断整体流程
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 9.2, 9.3_

  - [ ]* 4.4 为 upsertShowFromTrakt 编写属性测试：tmdbId 非空写入
    - **Property 7: upsertShowFromTrakt 写入 shows 表时 tmdbId 非空**
    - **Validates: Requirements 4.7, 9.1**
    - 使用 `fc.integer` 生成 tmdbId，验证 `shows.tmdbId` 等于输入值
    - 注释：`// Feature: trakt-primary-datasource, Property 7: tmdbId 非空写入`

  - [ ]* 4.5 为 upsertShowFromTrakt 编写属性测试：TBA 字段为 null
    - **Property 8: TBA 集数以 null 字段写入 episodes 表**
    - **Validates: Requirements 4.5, 9.2**
    - 生成 `first_aired=null` 的 TBA episode，验证写入后 `airDate`/`title`/`overview` 为 null，`traktId` 非空
    - 注释：`// Feature: trakt-primary-datasource, Property 8: TBA 字段为 null`

  - [ ] 4.6 实现 TMDB 翻译补充逻辑
    - 仅当 `displayLanguage` 非空时调用 `getTmdbShow` 和 `getTmdbSeason`
    - `translatedName`：TMDB 标题与 Trakt 标题不同时写入，否则为 null
    - `translatedOverview`：TMDB 简介与 Trakt 简介不同时写入，否则为 null
    - TMDB 调用失败时 `console.warn` 并继续，不中断同步
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 4.7 为 TMDB 翻译逻辑编写属性测试
    - **Property 9: displayLanguage 为空时跳过所有 TMDB 调用**
    - **Validates: Requirements 5.5**
    - 使用 `fc.constant(null)` 作为 displayLanguage，验证 `getTmdbShow` 调用次数为 0
    - **Property 10: TMDB 翻译仅在标题/简介不同时写入**
    - **Validates: Requirements 5.2, 5.3**
    - 使用 `fc.tuple(fc.string(), fc.string())` 生成 (traktTitle, tmdbTitle)，验证相同时 null、不同时写入
    - **Property 11: TMDB 失败不中断同步流程**
    - **Validates: Requirements 5.6**
    - mock TMDB 抛出任意错误，验证 `upsertShowFromTrakt` 正常返回 show id
    - 注释：`// Feature: trakt-primary-datasource, Property 9/10/11`

- [ ] 5. 重构 sync.ts：替换所有 upsertShowFromTmdb 调用点
  - [ ] 5.1 替换 `syncSingleShow` 中的调用
    - 将 `upsertShowFromTmdb(input.tmdbId, input.traktShow, userId)` 替换为 `upsertShowFromTrakt(input.traktId, input.traktShow, userId)`
    - `input.traktId` 已在 `syncSingleShow` 入口处校验非空
    - _Requirements: 6.1, 6.3_

  - [ ] 5.2 替换 `triggerIncrementalSync` 中的调用
    - 将 `upsertShowFromTmdb(tmdbId, entries[0].show, userId)` 替换为 `upsertShowFromTrakt(traktId, entries[0].show, userId)`
    - 从 `entries[0].show.ids.trakt` 取 traktId；若为 null，记录失败并跳过
    - _Requirements: 6.2, 6.4_

  - [ ]* 5.3 为替换后的调用点编写属性测试
    - **Property 12: ids.tmdb 为 null 的 show 记录为失败项**
    - **Validates: Requirements 9.5**
    - 生成 `ids.tmdb=null` 的 show，验证 `upsertShowFromTrakt` 抛出含 `'Missing TMDB id'` 的错误
    - 注释：`// Feature: trakt-primary-datasource, Property 12: null tmdbId 记录失败`

- [ ] 6. 重构 sync.ts：更新 findOrCreateEpisode 使用 Trakt
  - 将 `findOrCreateEpisode` 中的 `getTmdbSeason` 调用替换为 `Trakt_Client.getEpisodes`
  - 新建集时 `traktId` 设为 `traktEpisode.ids.trakt`，`tmdbId` 设为 `traktEpisode.ids.tmdb`（可 null）
  - `getEpisodes` 调用失败时返回 null，与现有行为一致
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 7. Final Checkpoint — 确认所有测试通过
  - 确保所有测试通过，如有疑问请询问用户。

## Notes

- 标有 `*` 的子任务为可选属性测试，可跳过以加快 MVP 进度
- 每个属性测试文件放置于 `apps/api/src/services/__tests__/` 目录，使用 fast-check 库
- 每个属性测试注释格式：`// Feature: trakt-primary-datasource, Property N: <property_text>`
- 无数据库 schema 变更，无迁移文件
- `upsertShowFromTmdb` 函数在替换完所有调用点后可保留（不删除），避免潜在的引用问题
