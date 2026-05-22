<div align="center">
  <h1>Trakt Dashboard</h1>
  <p>
    <strong>A self-hosted TV show and movie progress tracker powered by Trakt</strong>
  </p>
  <p>
    <a href="https://github.com/InoriHimea/TraktDashboard/actions"><img src="https://github.com/InoriHimea/TraktDashboard/workflows/Build%20%26%20Push%20Docker%20Images/badge.svg" alt="CI Status"></a>
    <a href="https://github.com/InoriHimea/TraktDashboard/blob/github/LICENSE"><img src="https://img.shields.io/github/license/InoriHimea/TraktDashboard" alt="License"></a>
    <a href="https://github.com/InoriHimea/TraktDashboard/releases"><img src="https://img.shields.io/github/v/release/InoriHimea/TraktDashboard" alt="Release"></a>
  </p>
  <p>
    <a href="README_zh.md">简体中文</a> · <a href="#features">Features</a> · <a href="#quick-start">Quick Start</a> · <a href="#documentation">Documentation</a>
  </p>
  <img src="https://via.placeholder.com/800x450/08080e/7c6af7?text=Trakt+Dashboard+Screenshot" alt="Screenshot">
</div>

---

## ✨ Features

- 📺 **Episode Progress Tracking** — Visual progress bars for every show, season-by-season breakdown
- 🎬 **Movie Library** — Track watched movies with rewatch counts and last watched dates
- 🔄 **Auto-Sync** — Scheduled background sync from Trakt (configurable interval)
- 📊 **Watch Statistics** — Monthly watch charts, top genres, total hours watched
- 🎨 **Modern UI** — Dark-themed, responsive design built with React 19 and Tailwind CSS v4
- 🚀 **Fast & Lightweight** — Powered by Bun runtime, optimized for performance
- 🐳 **Easy Deployment** — One-command Docker Compose setup
- 🔒 **Privacy-First** — Self-hosted, your data stays on your server

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 · Vite 8 · Tailwind CSS v4 · Framer Motion · TanStack Query |
| **Backend** | Bun · Hono · BullMQ |
| **Database** | PostgreSQL 16 · Drizzle ORM |
| **Queue** | Redis 7 |
| **Proxy** | Nginx |
| **Container** | Docker Compose |

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose v2
- A free [Trakt](https://trakt.tv) account
- A free [TMDB API key](https://www.themoviedb.org/settings/api)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/InoriHimea/TraktDashboard.git
cd TraktDashboard
```

2. **Create environment file**

```bash
cp .env.example .env
```

3. **Configure Trakt OAuth**

- Go to https://trakt.tv/oauth/applications/new
- Set **Redirect URI** to `http://localhost/auth/callback`
- Copy **Client ID** and **Client Secret** to `.env`

4. **Get TMDB API key**

- Go to https://www.themoviedb.org/settings/api
- Copy your API key to `.env` as `TMDB_API_KEY`

5. **Edit `.env` file**

```env
TRAKT_CLIENT_ID=your_trakt_client_id
TRAKT_CLIENT_SECRET=your_trakt_client_secret
TRAKT_REDIRECT_URI=http://localhost/auth/callback
TMDB_API_KEY=your_tmdb_api_key
API_SECRET=generate_a_random_32_char_string
```

6. **Launch with Docker**

```bash
docker compose up -d
```

7. **Access the dashboard**

Open http://localhost in your browser and connect your Trakt account. The first sync will start automatically.

## 📖 Documentation

### Project Structure

```
trakt-dashboard/
├── apps/
│   ├── api/                    # Backend API (Bun + Hono)
│   │   ├── src/
│   │   │   ├── routes/         # API routes (auth, shows, sync, stats)
│   │   │   ├── services/       # Business logic (Trakt, TMDB, sync)
│   │   │   ├── jobs/           # Background jobs (BullMQ)
│   │   │   └── middleware/     # JWT authentication
│   │   └── Dockerfile
│   └── web/                    # Frontend (React 19)
│       ├── src/
│       │   ├── pages/          # Page components
│       │   ├── components/     # Reusable UI components
│       │   ├── hooks/          # React hooks (TanStack Query)
│       │   └── lib/            # Utilities and API client
│       └── Dockerfile
└── packages/
    ├── types/                  # Shared TypeScript types
    └── db/                     # Database schema (Drizzle ORM)
```

### How Syncing Works

**Initial Sync** (triggered on first login):
1. Fetches all watched shows from Trakt API
2. Retrieves detailed episode progress for each show
3. Enriches metadata from TMDB (posters, backdrops, episode stills)
4. Stores everything in PostgreSQL with 7-day cache
5. Calculates progress summaries

**Incremental Sync** (runs every 15 minutes by default):
1. Fetches only new watch history since last sync
2. Updates affected shows' progress
3. Refreshes stale metadata if cache expired

**Manual Sync**: Click "Sync now" in the UI or `POST /api/sync/trigger`

### API Endpoints

```
GET  /health                   Health check
GET  /auth/trakt               Start Trakt OAuth flow
GET  /auth/callback            OAuth callback handler
GET  /auth/me                  Current user authentication status
POST /auth/logout              Clear session

GET  /api/shows/progress       List all shows with progress
                               Query params: ?filter=watching|completed|all&q=search
GET  /api/shows/:id            Single show with full season/episode details
GET  /api/shows/:id/seasons    Season list only

GET  /api/sync/status          Current sync state
POST /api/sync/trigger         Queue incremental sync
POST /api/sync/full            Start full re-sync

GET  /api/stats/overview       Watch statistics and charts
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TRAKT_CLIENT_ID` | ✅ | — | Trakt OAuth app client ID |
| `TRAKT_CLIENT_SECRET` | ✅ | — | Trakt OAuth app client secret |
| `TRAKT_REDIRECT_URI` | ✅ | — | Must match Trakt app settings |
| `TMDB_API_KEY` | ✅ | — | TMDB v3 API key |
| `TVDB_API_KEY` | — | — | TVDB API key (optional) |
| `API_SECRET` | ✅ | — | JWT signing secret (32+ chars) |
| `POSTGRES_USER` | — | `trakt` | Database username |
| `POSTGRES_PASSWORD` | — | `trakt` | Database password |
| `POSTGRES_DB` | — | `trakt_dashboard` | Database name |
| `SYNC_INTERVAL_MINUTES` | — | `15` | Auto-sync frequency |
| `FRONTEND_URL` | — | `http://localhost` | Used for CORS and OAuth |

## 🛠️ Development

### Local Setup

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env
# Fill in real API keys

# Start PostgreSQL and Redis
docker compose up postgres redis -d

# Run database migrations
cd packages/db && pnpm db:migrate

# Start development servers
pnpm dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001
- Health check: http://localhost:3001/health

### Building

```bash
# Type check
pnpm typecheck

# Build all packages
pnpm build

# Run tests
pnpm test
```

## 🚢 Deployment

### Docker Compose (Recommended)

Update `.env` for production:

```env
TRAKT_REDIRECT_URI=https://yourdomain.com/auth/callback
FRONTEND_URL=https://yourdomain.com
API_SECRET=<strong-random-string>
POSTGRES_PASSWORD=<strong-password>
```

Deploy:

```bash
docker compose pull
docker compose up -d
```

### Reverse Proxy (HTTPS)

Example Caddy configuration:

```
yourdomain.com {
  reverse_proxy localhost:80
}
```

Example Nginx configuration:

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

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Trakt](https://trakt.tv) for the amazing API
- [TMDB](https://www.themoviedb.org) for rich metadata
- [TVDB](https://thetvdb.com) for additional TV show data

## 📧 Contact

- GitHub: [@InoriHimea](https://github.com/InoriHimea)
- Project Link: [https://github.com/InoriHimea/TraktDashboard](https://github.com/InoriHimea/TraktDashboard)

---

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/InoriHimea">InoriHimea</a></sub>
</div>
