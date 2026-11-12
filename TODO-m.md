# 已完成任务

## TD-042-B — 最小 Docker 构建验证候选

- 状态：限定实现与 CI 验证已完成，尚未合并、发布或部署；不是完整 RSS 候选。
- 基线：GitHub `main` 的 `1f16615aa2890612fdaa6aefca241df69e999973`，不携带其他本地未发布提交、个人审计资料或未提交业务改动。
- 实现：API 系统依赖安装分阶段限时及日志、统一包源参数、PostgreSQL 17 客户端及版本检查；PR 独立构建 API/Web 镜像而不发布。CI Node.js 统一为 22。
- E2E：使用与锁定 Playwright 1.60.0 匹配、固定 linux/amd64 digest 的官方 noble 镜像。创建前检查镜像无卷声明，工作区仅 host bind，无发布端口，使用 runner UID/GID、有限 CPU/内存/PID、cap-drop 与 no-new-privileges，按运行专属名称和标签清理。
- 修复历史：旧文档格式阻断仅修行首空白；两个测试文件按本地时间构造 UTC 夹具，保留原断言；Ubuntu 26.04 不受支持后固定 runner 为 24.04；APT 域名解析故障在一次重试后仍出现，改用预装镜像；随后修复容器用户与工作区所有者不匹配的写权限问题。
- 本地验证：18 项依赖安装与 CI 接线回归、格式及差分检查通过；两个时间戳测试文件在 UTC、Asia/Shanghai 下均 27/27 通过。合成测试不替代实际运行。
- 实际验证：提交 `7360ff1ac05937f35b9289314974fbb33cb395b0` 的 [CI 43219767475](https://github.com/InoriHimea/TraktDashboard/actions/runs/43219767475) 为 success；ci、docker-build、e2e 均通过。API/Web 镜像实际构建成功，E2E 为 17 通过、1 跳过（18.9 秒），容器清理步骤通过。
- 跳过与限制：既有可选 MovieCard 视觉基线未启用；完整 smoke-test 在 PR 中按范围跳过。绿色 CI 不等于完整 RSS、PG16/KeyDB/API/Nginx 运行验收或真实资源验收；也不证明旧远端 APK 网络故障根因已确定。
- 审查：主代理核对最终工作流、Docker 安装接线、测试差分和实际日志；未发现本次限定范围内新增的阻断问题。main 既有运行冒烟与独立发布工作流仍需在合并前审查，不能由 PR 绿色直接授权合并。
- 证据：[PR #1](https://github.com/InoriHimea/TraktDashboard/pull/1)、上述固定提交和 CI。后续纯日期缺陷、完整候选与发布决策见 `TODO.md`。
