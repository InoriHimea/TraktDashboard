# Trakt Dashboard 分阶段改进计划

## Summary

- 审核通过后先创建 `plan.md`，写入本计划；当前 Plan Mode 不直接写文件。
- 计划采用小任务跟踪：每个实现任务完成后，更新 root `package.json` 版本号、把 `plan.md` 对应 task 从 `[ ]` 改为 `[x]`、通过验证后提交代码。
- 版本只更新 root `package.json`；`apps/*` 与 `packages/*` 的私有 version 暂不改。
- 页面整体不做大结构调整；电视节目进度条功能为保护区，只允许必要的视觉 token 适配，不改逻辑、交互、布局结构和统计语义。

## Task Checklist And Version Plan

- [x] **T0: 写入计划与 skills 基线**，无版本 bump
  创建 `plan.md`；保留已安装的 Vercel skills 与 `skills-lock.json`。提交：`docs(plan): add tracked improvement plan`

- [x] **T1: Settings 运行时生效**，`0.37.1`
  保存同步间隔后立即重新注册当前用户 BullMQ repeat job；Trakt/TMDB 请求统一按 user 读取 `httpProxy`，空值回退 env。提交：`fix(settings): apply runtime sync and proxy settings`

- [x] **T2: Watchlist 本地操作写入 Trakt**，`0.38.0`
  添加/移除待看时先调用 Trakt API，成功后写本地；删除对 Trakt 404/已不存在保持幂等。提交：`feat(watchlist): sync local changes to trakt`

- [x] **T3: Watchlist 周期对账**，`0.38.1`
  周期同步以 Trakt 为权威，upsert 远端存在项，并清理本地已不在远端 watchlist 的项；本地不存在媒体仍跳过并记录日志。提交：`fix(watchlist): reconcile local state from trakt`

- [x] **T4: Show detail nextEpisode 一致性**，`0.38.2`
  详情 API 返回真实 `nextEpisode`，与列表 API 的 progress cache 保持一致。提交：`fix(shows): return next episode in detail response`

- [x] **T5: 配置与部署一致性**，`0.38.3`
  dev 端口统一为 `5173`；同步 README、`.env.example`、Vite config；Docker build arg 统一为 `VITE_API_BASE`；Nginx 阻止访问 `*.map`。提交：`fix(config): align dev ports and build env names`

- [x] **T6: 真正的 lint 与类型收束**，`0.38.4`
  添加 ESLint flat config，启用 TypeScript、React hooks、jsx-a11y；替换前端 watchlist `ApiResponse<any>` 和 stats 小组件中的明显 `any`。提交：`chore(lint): add eslint quality gates`

- [x] **T7: 路由级 code splitting**，`0.38.5`
  `App` 路由页改为 `React.lazy` + `Suspense`；保持现有路由、页面结构和 loading 风格不变。目标：主 chunk 不再触发 500KB 警告。提交：`perf(web): split route bundles`

- [x] **T8: 测试补强**，`0.38.6`
  增加 settings、watchlist、show detail、路由 lazy loading 的单元/集成测试；保留现有 property tests。提交：`test: cover settings watchlist and show detail flows`

- [x] **T9: 赛博科技感设计系统基础**，`0.39.0`
  更新主题 tokens、边框、状态光效、HUD 式状态表达；不重排页面主结构，不改电视节目进度条功能。提交：`feat(theme): add cyber dashboard design tokens`

- [x] **T10: 图标与统计增强**，`0.39.1`
  可增加或替换统计图标、状态徽标、统计卡片视觉信息；统计页可轻量增加指标，但不改变现有核心数据流。提交：`feat(stats): enhance icons and dashboard metrics`

- [ ] **T11: 文档与截图收尾**，`0.39.2`
  README/README_zh 替换 placeholder 截图，记录端口、代理、watchlist 同步语义和版本节奏。提交：`docs: refresh setup notes and screenshots`

## Public Interfaces And Constraints

- `GET/PUT /api/settings` 响应结构保持 `{ data: UserSettings }`。
- `POST /api/watchlist` 与 `DELETE /api/watchlist/:id` 对前端 wire shape 保持兼容；内部新增 Trakt 错误类型只用于服务端判断。
- 不新增数据库 migration；使用现有 `user_settings`、`watchlist`、`user_show_progress.next_episode_id`。
- 电视节目进度条保护规则：不改 percentage 计算、不改 watched/aired 语义、不改点击跳转和 hover 行为、不重排其所在卡片结构。
- 视觉升级只做设计系统与组件表现层增强；不做 landing page，不重做导航信息架构。

## Test And Acceptance

- 每个实现 task 完成前必须通过：`pnpm typecheck`、`pnpm lint`、`pnpm test`；涉及前端 bundle 的 task 还必须通过 `pnpm build`。
- T7 验收：生产构建无主 chunk 超 500KB 警告，`html2canvas` 继续保持动态加载。
- T9/T10 验收：使用 Browser 检查 desktop/mobile 的 TV shows、movies、show detail、stats、sync、settings、login；确认无文字溢出、控件重叠、进度条行为回归。
- 每个 task 提交前更新 `plan.md`：把对应行从 `[ ]` 改为 `[x]`，并同步 root version。
