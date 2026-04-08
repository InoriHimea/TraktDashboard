# 优化需求文档

## 概述

对 trakt-dashboard 项目进行一系列安全、性能和可靠性优化，涵盖后端 API、同步服务、数据库 schema 和前端类型安全。

## 需求列表

### 1. 安全加固

#### 1.1 强制校验 API_SECRET
- **现状**：`auth.ts` 中存在 fallback secret `'fallback-secret-change-in-production'`，生产环境若未设置环境变量将使用弱密钥
- **要求**：服务启动时若 `API_SECRET` 未设置或长度小于 32 字符，立即抛出错误并终止进程

#### 1.2 Token 刷新竞态保护
- **现状**：`refreshToken()` 无锁保护，并发请求可能同时触发多次刷新，导致 refresh token 失效
- **要求**：使用 Redis `SET NX EX` 实现分布式锁，确保同一用户的 token 刷新串行执行，锁超时设为 30 秒

#### 1.3 修复 getHistory 绕过 token 刷新
- **现状**：`trakt.ts` 的 `getHistory` 方法直接读取数据库 token，不经过 `traktFetch`，token 过期时静默失败
- **要求**：将 `getHistory` 重构为使用统一的 `traktFetch` 方法，确保自动刷新逻辑生效

### 2. 性能优化

#### 2.1 shows/progress 接口分页
- **现状**：`GET /api/shows/progress` 一次返回所有数据，100+ 部剧时响应慢
- **要求**：
  - 支持 `limit`（默认 50，最大 200）和 `offset` 查询参数
  - 响应体包含 `total`、`limit`、`offset` 字段
  - 前端 `useShowsProgress` hook 支持分页参数

#### 2.2 调度器改用 BullMQ repeat job
- **现状**：使用 `setInterval` 轮询数据库并入队，进程重启后会产生重复 job
- **要求**：
  - 改用 BullMQ 的 `repeat` 选项创建周期性 job
  - 使用 `jobId: sync-user-${userId}` 防止重复入队
  - 服务启动时为所有已存在用户注册 repeat job
  - 新用户首次登录时注册其 repeat job

### 3. 数据可靠性

#### 3.1 修复 watch_history 重复数据问题
- **现状**：`traktPlayId` 字段可为 null，`unique` 约束对 null 值不生效，`syncEpisodeProgress` 中插入时 `traktPlayId: null`，导致重复行
- **要求**：
  - 在 `watch_history` 表上添加 `(userId, episodeId, watchedAt)` 联合唯一索引作为去重依据
  - `syncEpisodeProgress` 中的 `onConflictDoNothing` 改为基于该联合索引
  - 生成对应的数据库迁移文件

#### 3.2 同步失败记录与重试
- **现状**：单个 show 同步失败只打印日志，没有记录失败列表，也没有重试
- **要求**：
  - `syncState` 表新增 `failedShows` jsonb 字段，记录失败的 `{ tmdbId, title, error }` 列表
  - 全量同步完成后将失败列表写入该字段
  - `GET /api/sync/status` 响应中包含 `failedShows` 字段

#### 3.3 外部 API 429 处理
- **现状**：TMDB/Trakt 返回 429 时直接抛错，show 被跳过
- **要求**：
  - `traktFetch` 和 TMDB fetch 遇到 429 时，读取 `Retry-After` 响应头，等待对应时间后重试，最多重试 3 次
  - 超过重试次数后才将该 show 计入失败列表

### 4. 前端类型安全

#### 4.1 消除 api.ts 中的 any 类型
- **现状**：`apps/web/src/lib/api.ts` 中大量使用 `any`，`packages/types` 包未被前端使用
- **要求**：
  - 在 `packages/types/src/index.ts` 中定义 `ShowProgress`、`ShowDetail`、`SyncStatus`、`StatsOverview` 等接口
  - `api.ts` 中所有接口调用替换为对应的具体类型
  - `hooks/index.ts` 中的 hook 返回值类型随之更新

## 非功能性要求

- 所有改动需保持向后兼容，不破坏现有 API 契约
- 数据库 schema 变更需生成 Drizzle 迁移文件
- 不引入新的运行时依赖（Redis 锁复用现有 ioredis 连接）
