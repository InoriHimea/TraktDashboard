<div align="center">
  <h1>Trakt Dashboard</h1>
  <p>
    <strong>基于 Trakt 的自托管影视进度追踪器</strong>
  </p>
  <p>
    <a href="https://github.com/InoriHimea/TraktDashboard/actions"><img src="https://github.com/InoriHimea/TraktDashboard/workflows/Build%20%26%20Push%20Docker%20Images/badge.svg" alt="CI Status"></a>
    <a href="https://github.com/InoriHimea/TraktDashboard/blob/github/LICENSE"><img src="https://img.shields.io/github/license/InoriHimea/TraktDashboard" alt="License"></a>
    <a href="https://github.com/InoriHimea/TraktDashboard/releases"><img src="https://img.shields.io/github/v/release/InoriHimea/TraktDashboard" alt="Release"></a>
  </p>
  <p>
    <a href="README.md">English</a> · <a href="#特性">特性</a> · <a href="#快速开始">快速开始</a> · <a href="#文档">文档</a>
  </p>
  <img src="https://via.placeholder.com/800x450/08080e/7c6af7?text=Trakt+Dashboard+Screenshot" alt="Screenshot">
</div>

---

## ✨ 特性

- 📺 **剧集进度追踪** — 每部剧集的可视化进度条，按季度细分
- 🎬 **电影库** — 追踪已观看电影，记录重看次数和最后观看日期
- 🔄 **自动同步** — 定时从 Trakt 后台同步（可配置间隔）
- 📊 **观看统计** — 月度观看图表、热门类型、总观看时长
- 🎨 **现代化界面** — 基于 React 19 和 Tailwind CSS v4 的深色主题响应式设计
- 🚀 **快速轻量** — 由 Bun 运行时驱动，性能优化
- 🐳 **一键部署** — 使用 Docker Compose 一条命令启动
- 🔒 **隐私优先** — 自托管，数据保存在你的服务器上

## 🏗️ 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | React 19 · Vite 8 · Tailwind CSS v4 · Framer Motion · TanStack Query |
| **后端** | Bun · Hono · BullMQ |
| **数据库** | PostgreSQL 16 · Drizzle ORM |
| **队列** | Redis 7 |
| **代理** | Nginx |
| **容器** | Docker Compose |

## 🚀 快速开始

### 前置要求

- Docker & Docker Compose v2
- 免费的 [Trakt](https://trakt.tv) 账号
- 免费的 [TMDB API 密钥](https://www.themoviedb.org/settings/api)

### 安装步骤

1. **克隆仓库**

```bash
git clone https://github.com/InoriHimea/TraktDashboard.git
cd TraktDashboard
```

2. **创建环境变量文件**

```bash
cp .env.example .env
```

3. **配置 Trakt OAuth**

- 访问 https://trakt.tv/oauth/applications/new
- 设置 **Redirect URI** 为 `http://localhost/auth/callback`
- 将 **Client ID** 和 **Client Secret** 复制到 `.env`

4. **获取 TMDB API 密钥**

- 访问 https://www.themoviedb.org/settings/api
- 将你的 API 密钥复制到 `.env` 的 `TMDB_API_KEY`

5. **编辑 `.env` 文件**

```env
TRAKT_CLIENT_ID=你的_trakt_client_id
TRAKT_CLIENT_SECRET=你的_trakt_client_secret
TRAKT_REDIRECT_URI=http://localhost/auth/callback
TMDB_API_KEY=你的_tmdb_api_key
API_SECRET=生成一个随机的32字符字符串
```

6. **使用 Docker 启动**

```bash
docker compose up -d
```

7. **访问仪表板**

在浏览器中打开 http://localhost 并连接你的 Trakt 账号。首次同步将自动开始。

## 📖 文档

### 项目结构

```
trakt-dashboard/
├── apps/
│   ├── api/                    # 后端 API (Bun + Hono)
│   │   ├── src/
│   │   │   ├── routes/         # API 路由 (auth, shows, sync, stats)
│   │   │   ├── services/       # 业务逻辑 (Trakt, TMDB, sync)
│   │   │   ├── jobs/           # 后台任务 (BullMQ)
│   │   │   └── middleware/     # JWT 认证
│   │   └── Dockerfile
│   └── web/                    # 前端 (React 19)
│       ├── src/
│       │   ├── pages/          # 页面组件
│       │   ├── components/     # 可复用 UI 组件
│       │   ├── hooks/          # React hooks (TanStack Query)
│       │   └── lib/            # 工具函数和 API 客户端
│       └── Dockerfile
└── packages/
    ├── types/                  # 共享 TypeScript 类型
    └── db/                     # 数据库模式 (Drizzle ORM)
```

### 同步机制

**初始同步**（首次登录时触发）：
1. 从 Trakt API 获取所有已观看的剧集
2. 检索每部剧集的详细剧集进度
3. 从 TMDB 丰富元数据（海报、背景图、剧集截图）
4. 存储到 PostgreSQL，缓存 7 天
5. 计算进度摘要

**增量同步**（默认每 15 分钟运行一次）：
1. 仅获取自上次同步以来的新观看历史
2. 更新受影响剧集的进度
3. 如果缓存过期则刷新陈旧的元数据

**手动同步**：在 UI 中点击"立即同步"或调用 `POST /api/sync/trigger`

### API 端点

```
GET  /health                   健康检查
GET  /auth/trakt               启动 Trakt OAuth 流程
GET  /auth/callback            OAuth 回调处理
GET  /auth/me                  当前用户认证状态
POST /auth/logout              清除会话

GET  /api/shows/progress       列出所有剧集及进度
                               查询参数: ?filter=watching|completed|all&q=搜索
GET  /api/shows/:id            单个剧集的完整季度/剧集详情
GET  /api/shows/:id/seasons    仅季度列表

GET  /api/sync/status          当前同步状态
POST /api/sync/trigger         队列增量同步
POST /api/sync/full            启动完整重新同步

GET  /api/stats/overview       观看统计和图表
```

### 环境变量

| 变量 | 必需 | 默认值 | 描述 |
|------|------|--------|------|
| `TRAKT_CLIENT_ID` | ✅ | — | Trakt OAuth 应用客户端 ID |
| `TRAKT_CLIENT_SECRET` | ✅ | — | Trakt OAuth 应用客户端密钥 |
| `TRAKT_REDIRECT_URI` | ✅ | — | 必须与 Trakt 应用设置匹配 |
| `TMDB_API_KEY` | ✅ | — | TMDB v3 API 密钥 |
| `TVDB_API_KEY` | — | — | TVDB API 密钥（可选）|
| `API_SECRET` | ✅ | — | JWT 签名密钥（32+ 字符）|
| `POSTGRES_USER` | — | `trakt` | 数据库用户名 |
| `POSTGRES_PASSWORD` | — | `trakt` | 数据库密码 |
| `POSTGRES_DB` | — | `trakt_dashboard` | 数据库名称 |
| `SYNC_INTERVAL_MINUTES` | — | `15` | 自动同步频率 |
| `FRONTEND_URL` | — | `http://localhost` | 用于 CORS 和 OAuth |

## 🛠️ 开发

### 本地设置

```bash
# 安装依赖
pnpm install

# 复制环境变量文件
cp .env.example .env
# 填入真实的 API 密钥

# 启动 PostgreSQL 和 Redis
docker compose up postgres redis -d

# 运行数据库迁移
cd packages/db && pnpm db:migrate

# 启动开发服务器
pnpm dev
```

- 前端: http://localhost:5173
- API: http://localhost:3001
- 健康检查: http://localhost:3001/health
- 如果 API 不在 `http://localhost:3001`，请设置 `VITE_API_BASE`。

### 构建

```bash
# 类型检查
pnpm typecheck

# 构建所有包
pnpm build

# 运行测试
pnpm test
```

## 🚢 部署

### Docker Compose（推荐）

更新生产环境的 `.env`：

```env
TRAKT_REDIRECT_URI=https://yourdomain.com/auth/callback
FRONTEND_URL=https://yourdomain.com
API_SECRET=<强随机字符串>
POSTGRES_PASSWORD=<强密码>
```

部署：

```bash
docker compose pull
docker compose up -d
```

### 反向代理（HTTPS）

Caddy 配置示例：

```
yourdomain.com {
  reverse_proxy localhost:80
}
```

Nginx 配置示例：

```nginx
server {
  listen 443 ssl http2;
  server_name yourdomain.com;

  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;

  location / {
    proxy_pass http://localhost:80;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

## 🤝 贡献

欢迎贡献！请随时提交 Pull Request。

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交你的更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开一个 Pull Request

## 📝 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

- [Trakt](https://trakt.tv) 提供的强大 API
- [TMDB](https://www.themoviedb.org) 提供的丰富元数据
- [TVDB](https://thetvdb.com) 提供的额外电视剧数据

## 📧 联系方式

- GitHub: [@InoriHimea](https://github.com/InoriHimea)
- 项目链接: [https://github.com/InoriHimea/TraktDashboard](https://github.com/InoriHimea/TraktDashboard)

---

<div align="center">
  <sub>由 <a href="https://github.com/InoriHimea">InoriHimea</a> 用 ❤️ 构建</sub>
</div>
